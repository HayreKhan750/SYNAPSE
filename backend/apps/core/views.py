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
from .models import UserBookmark, Collection, UserActivity
from .serializers import BookmarkSerializer, CollectionSerializer, CollectionListSerializer
from .recommendations import recommend_for_user


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
    # Log search activity (Phase 2.4)
    try:
        if request.user and request.user.is_authenticated:
            UserActivity.objects.create(
                user=request.user,
                interaction_type='search',
                metadata={'query': query}
            )
    except Exception:
        pass
    return Response({
        'success': True,
        'data': results,
        'meta': {'query': query, 'total': total, 'limit': limit}
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def semantic_search(request):
    """
    POST /api/v1/search/semantic

    Perform semantic (vector) search across Articles, ResearchPapers,
    Repositories, and Videos using pgvector cosine similarity.

    Request body (JSON):
        query        (str, required)  — Natural language search query.
        limit        (int, optional)  — Max results per content type (default 10, max 50).
        content_types (list, optional) — Which types to search: articles, papers, repos, videos.
                                         Defaults to all four.
        filters      (dict, optional) — Optional per-type filters:
                                         {"source": "arxiv", "topic": "Machine Learning"}

    Response (200):
        {
          "success": true,
          "data": {
            "articles": [{...article fields..., "similarity_score": 0.92}, ...],
            "papers":   [{...paper fields...,   "similarity_score": 0.88}, ...],
            "repos":    [{...repo fields...,    "similarity_score": 0.85}, ...],
            "videos":   [{...video fields...,   "similarity_score": 0.80}, ...]
          },
          "meta": {
            "query": "...",
            "limit": 10,
            "total": 35,
            "execution_time_ms": 142
          }
        }
    """
    import time as _time
    import os
    import sys

    query = request.data.get('query', '').strip()
    if not query:
        return Response(
            {'success': False, 'error': {'message': 'Field "query" is required.'}},
            status=422,
        )

    limit = min(int(request.data.get('limit', 10)), 50)
    content_types = request.data.get('content_types', ['articles', 'papers', 'repos', 'videos'])
    filters = request.data.get('filters', {})

    start_time = _time.time()

    # ── 1. Generate query embedding ───────────────────────────────────────────
    try:
        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        if project_root not in sys.path:
            sys.path.insert(0, project_root)
        from ai_engine.embeddings import embed_text  # noqa: PLC0415
        query_vector = embed_text(query)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("Embedding generation failed: %s", exc)
        return Response(
            {'success': False, 'error': {'message': 'Embedding service unavailable.', 'detail': str(exc)}},
            status=503,
        )

    # ── 2. Search each content type ───────────────────────────────────────────
    from pgvector.django import CosineDistance  # noqa: PLC0415

    results = {}

    if 'articles' in content_types:
        from apps.articles.models import Article  # noqa: PLC0415
        from apps.articles.serializers import ArticleListSerializer  # noqa: PLC0415

        qs = (
            Article.objects
            .filter(embedding__isnull=False)
            .annotate(similarity=CosineDistance('embedding', query_vector))
            .order_by('similarity')
        )
        # Optional filters
        if filters.get('topic'):
            qs = qs.filter(topic__iexact=filters['topic'])
        if filters.get('source'):
            qs = qs.filter(source__source_type__iexact=filters['source'])
        if filters.get('date_from'):
            qs = qs.filter(published_at__gte=filters['date_from'])
        if filters.get('date_to'):
            qs = qs.filter(published_at__lte=filters['date_to'])

        articles = list(qs[:limit])
        serialized = ArticleListSerializer(articles, many=True).data
        for i, item in enumerate(serialized):
            # similarity from CosineDistance is distance (0=identical, 2=opposite);
            # convert to a 0–1 similarity score.
            dist = getattr(articles[i], 'similarity', None)
            item['similarity_score'] = round(1 - (dist / 2), 4) if dist is not None else None
        results['articles'] = serialized

    if 'papers' in content_types:
        from apps.papers.models import ResearchPaper  # noqa: PLC0415
        from apps.papers.serializers import ResearchPaperSerializer  # noqa: PLC0415

        qs = (
            ResearchPaper.objects
            .filter(embedding__isnull=False)
            .annotate(similarity=CosineDistance('embedding', query_vector))
            .order_by('similarity')
        )
        if filters.get('category'):
            qs = qs.filter(categories__icontains=filters['category'])
        if filters.get('difficulty'):
            qs = qs.filter(difficulty_level__iexact=filters['difficulty'])

        papers = list(qs[:limit])
        serialized = ResearchPaperSerializer(papers, many=True).data
        for i, item in enumerate(serialized):
            dist = getattr(papers[i], 'similarity', None)
            item['similarity_score'] = round(1 - (dist / 2), 4) if dist is not None else None
        results['papers'] = serialized

    if 'repos' in content_types:
        from apps.repositories.models import Repository  # noqa: PLC0415
        from apps.repositories.serializers import RepositorySerializer  # noqa: PLC0415

        qs = (
            Repository.objects
            .filter(embedding__isnull=False)
            .annotate(similarity=CosineDistance('embedding', query_vector))
            .order_by('similarity')
        )
        if filters.get('language'):
            qs = qs.filter(language__iexact=filters['language'])

        repos = list(qs[:limit])
        serialized = RepositorySerializer(repos, many=True).data
        for i, item in enumerate(serialized):
            dist = getattr(repos[i], 'similarity', None)
            item['similarity_score'] = round(1 - (dist / 2), 4) if dist is not None else None
        results['repos'] = serialized

    if 'videos' in content_types:
        from apps.videos.models import Video  # noqa: PLC0415
        from apps.videos.serializers import VideoSerializer  # noqa: PLC0415

        qs = (
            Video.objects
            .filter(embedding__isnull=False)
            .annotate(similarity=CosineDistance('embedding', query_vector))
            .order_by('similarity')
        )

        videos = list(qs[:limit])
        serialized = VideoSerializer(videos, many=True).data
        for i, item in enumerate(serialized):
            dist = getattr(videos[i], 'similarity', None)
            item['similarity_score'] = round(1 - (dist / 2), 4) if dist is not None else None
        results['videos'] = serialized

    # ── 3. Build response ─────────────────────────────────────────────────────
    total = sum(len(v) for v in results.values())
    elapsed_ms = round((_time.time() - start_time) * 1000)

    return Response({
        'success': True,
        'data': results,
        'meta': {
            'query': query,
            'limit': limit,
            'total': total,
            'content_types': content_types,
            'execution_time_ms': elapsed_ms,
        },
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
            # Log unbookmark activity
            try:
                UserActivity.objects.create(
                    user=request.user,
                    content_type=ct,
                    object_id=str(object_id),
                    interaction_type='unbookmark',
                )
            except Exception:
                pass
            bookmark.delete()
            return Response({'success': True, 'data': {'bookmarked': False, 'message': 'Bookmark removed'}})
        # Log bookmark activity
        try:
            UserActivity.objects.create(
                user=request.user,
                content_type=ct,
                object_id=str(object_id),
                interaction_type='bookmark',
            )
        except Exception:
            pass
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recommendations(request):
    """
    GET /api/v1/recommendations/

    Content-based recommendations derived from user's recent interactions.
    Returns up to 10 items per content type the user has not seen/bookmarked yet.
    """
    recs = recommend_for_user(request.user, limit=10)
    data = {
        'articles': ArticleListSerializer(recs['articles'], many=True).data,
        'papers': ResearchPaperSerializer(recs['papers'], many=True).data,
        'repos': RepositorySerializer(recs['repos'], many=True).data,
    }
    total = sum(len(v) for v in data.values())
    return Response({'success': True, 'data': data, 'meta': {'total': total}})


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
