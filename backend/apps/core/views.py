from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.db.models import Q
import redis
import os

from apps.articles.models import Article
from apps.articles.serializers import ArticleListSerializer
from apps.repositories.models import Repository
from apps.repositories.serializers import RepositorySerializer
from apps.papers.models import ResearchPaper
from apps.papers.serializers import ResearchPaperSerializer
from .models import UserBookmark, Collection
from .serializers import BookmarkSerializer, CollectionSerializer, CollectionListSerializer


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    health = {'status': 'healthy', 'services': {}}
    try:
        connection.ensure_connection()
        health['services']['database'] = 'ok'
    except Exception:
        health['services']['database'] = 'error'
        health['status'] = 'degraded'
    try:
        r = redis.from_url(os.environ.get('REDIS_URL', 'redis://localhost:6380/0'))
        r.ping()
        health['services']['redis'] = 'ok'
    except Exception:
        health['services']['redis'] = 'error'
        health['status'] = 'degraded'
    return Response({'success': True, 'data': health})


@api_view(['GET'])
@permission_classes([AllowAny])
def global_search(request):
    """Global full-text search across articles, repositories, and research papers."""
    query = request.GET.get('q', '').strip()
    content_types = request.GET.get('types', 'articles,repos,papers').split(',')
    limit = min(int(request.GET.get('limit', 10)), 50)

    if not query or len(query) < 2:
        return Response({'success': False, 'error': {'message': 'Query must be at least 2 characters'}}, status=400)

    results = {}

    if 'articles' in content_types:
        articles = Article.objects.filter(
            Q(title__icontains=query) |
            Q(summary__icontains=query) |
            Q(author__icontains=query) |
            Q(topic__icontains=query)
        ).order_by('-trending_score', '-published_at')[:limit]
        results['articles'] = ArticleListSerializer(articles, many=True).data

    if 'repos' in content_types:
        repos = Repository.objects.filter(
            Q(name__icontains=query) |
            Q(description__icontains=query) |
            Q(owner__icontains=query) |
            Q(language__icontains=query)
        ).order_by('-stars')[:limit]
        results['repos'] = RepositorySerializer(repos, many=True).data

    if 'papers' in content_types:
        papers = ResearchPaper.objects.filter(
            Q(title__icontains=query) |
            Q(abstract__icontains=query) |
            Q(summary__icontains=query)
        ).order_by('-citation_count', '-published_date')[:limit]
        results['papers'] = ResearchPaperSerializer(papers, many=True).data

    total = sum(len(v) for v in results.values())
    return Response({
        'success': True,
        'data': results,
        'meta': {'query': query, 'total': total, 'limit': limit}
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def semantic_search(request):
    query = request.data.get('query', '')
    limit = request.data.get('limit', 10)
    if not query:
        return Response({'success': False, 'error': {'message': 'query is required'}}, status=422)
    return Response({
        'success': True, 'data': [],
        'meta': {'query': query, 'limit': limit, 'note': 'Semantic search enabled in Phase 2.3'}
    })


class BookmarkListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """List all bookmarks for the current user."""
        content_type_filter = request.GET.get('type')
        bookmarks = UserBookmark.objects.filter(user=request.user).select_related('content_type')
        if content_type_filter:
            bookmarks = bookmarks.filter(content_type__model=content_type_filter)
        serializer = BookmarkSerializer(bookmarks, many=True)
        return Response({'success': True, 'data': serializer.data, 'meta': {'total': bookmarks.count()}})


class BookmarkToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, content_type_name, object_id):
        """Toggle bookmark for a content object (add if not exists, remove if exists)."""
        try:
            ct = ContentType.objects.get(model=content_type_name)
        except ContentType.DoesNotExist:
            return Response({'success': False, 'error': {'message': 'Invalid content type'}}, status=400)

        bookmark, created = UserBookmark.objects.get_or_create(
            user=request.user,
            content_type=ct,
            object_id=str(object_id),
            defaults={
                'notes': request.data.get('notes', ''),
                'tags': request.data.get('tags', []),
            }
        )
        if not created:
            bookmark.delete()
            return Response({'success': True, 'data': {'bookmarked': False, 'message': 'Bookmark removed'}})
        serializer = BookmarkSerializer(bookmark)
        return Response({'success': True, 'data': {'bookmarked': True, 'bookmark': serializer.data}}, status=201)


class CollectionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        collections = Collection.objects.filter(user=request.user)
        serializer = CollectionListSerializer(collections, many=True)
        return Response({'success': True, 'data': serializer.data, 'meta': {'total': collections.count()}})

    def post(self, request):
        serializer = CollectionListSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response({'success': True, 'data': serializer.data}, status=201)
        return Response({'success': False, 'error': serializer.errors}, status=400)


class CollectionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return Collection.objects.get(pk=pk, user=user)
        except Collection.DoesNotExist:
            return None

    def get(self, request, pk):
        collection = self.get_object(pk, request.user)
        if not collection:
            return Response({'success': False, 'error': {'message': 'Not found'}}, status=404)
        serializer = CollectionSerializer(collection)
        return Response({'success': True, 'data': serializer.data})

    def patch(self, request, pk):
        collection = self.get_object(pk, request.user)
        if not collection:
            return Response({'success': False, 'error': {'message': 'Not found'}}, status=404)
        serializer = CollectionListSerializer(collection, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({'success': True, 'data': serializer.data})
        return Response({'success': False, 'error': serializer.errors}, status=400)

    def delete(self, request, pk):
        collection = self.get_object(pk, request.user)
        if not collection:
            return Response({'success': False, 'error': {'message': 'Not found'}}, status=404)
        collection.delete()
        return Response({'success': True, 'data': {'message': 'Collection deleted'}}, status=204)


class CollectionBookmarkView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Add a bookmark to a collection."""
        try:
            collection = Collection.objects.get(pk=pk, user=request.user)
        except Collection.DoesNotExist:
            return Response({'success': False, 'error': {'message': 'Not found'}}, status=404)
        bookmark_id = request.data.get('bookmark_id')
        try:
            bookmark = UserBookmark.objects.get(pk=bookmark_id, user=request.user)
        except UserBookmark.DoesNotExist:
            return Response({'success': False, 'error': {'message': 'Bookmark not found'}}, status=404)
        collection.bookmarks.add(bookmark)
        return Response({'success': True, 'data': {'message': 'Bookmark added to collection'}})

    def delete(self, request, pk):
        """Remove a bookmark from a collection."""
        try:
            collection = Collection.objects.get(pk=pk, user=request.user)
        except Collection.DoesNotExist:
            return Response({'success': False, 'error': {'message': 'Not found'}}, status=404)
        bookmark_id = request.data.get('bookmark_id')
        try:
            bookmark = UserBookmark.objects.get(pk=bookmark_id, user=request.user)
        except UserBookmark.DoesNotExist:
            return Response({'success': False, 'error': {'message': 'Bookmark not found'}}, status=404)
        collection.bookmarks.remove(bookmark)
        return Response({'success': True, 'data': {'message': 'Bookmark removed from collection'}})
