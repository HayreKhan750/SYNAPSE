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
from django.utils import timezone
from .models import UserBookmark, Collection, UserActivity, DailyBriefing
from .serializers import BookmarkSerializer, CollectionSerializer, CollectionListSerializer
from .recommendations import recommend_for_user
from .trending import get_trending


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
    """Global full-text search across articles, repositories, research papers, and videos."""
    query = request.GET.get('q', '').strip()
    content_types = request.GET.get('types', 'articles,repos,papers,videos').split(',')
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
        ).select_related('source').order_by('-trending_score', '-published_at')[:limit]
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

    if 'videos' in content_types:
        from apps.videos.models import Video          # noqa: PLC0415
        from apps.videos.serializers import VideoSerializer  # noqa: PLC0415
        videos = Video.objects.filter(
            Q(title__icontains=query) |
            Q(description__icontains=query) |
            Q(channel_name__icontains=query) |
            Q(summary__icontains=query)
        ).order_by('-view_count')[:limit]
        results['videos'] = VideoSerializer(videos, many=True).data

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
def bm25_search_view(request):
    """
    POST /api/v1/search/bm25/

    Full-text BM25 search via PostgreSQL tsvector / tsquery + SearchRank.
    Best for exact keyword matches, acronyms, and rare terms.

    Request body (JSON):
        query        (str, required)
        limit        (int, optional)    default 10, max 50
        content_types (list, optional)  default all
        filters      (dict, optional)

    Response (200):
        { "success": true, "data": { "articles": [...], ... },
          "meta": { "query": "...", "mode": "bm25", ... } }
    """
    import time as _time
    from apps.core.search import bm25_search
    from apps.articles.serializers import ArticleListSerializer
    from apps.papers.serializers import ResearchPaperSerializer
    from apps.repositories.serializers import RepositorySerializer

    query = request.data.get('query', '').strip()
    if not query:
        return Response({'success': False, 'error': {'message': 'Field "query" is required.'}}, status=422)

    limit         = min(int(request.data.get('limit', 10)), 50)
    content_types = request.data.get('content_types', ['articles', 'papers', 'repos', 'videos'])
    filters       = request.data.get('filters', {})
    start         = _time.time()

    raw = bm25_search(query, content_types, limit, filters)

    data = {}
    serializer_map = {
        'articles': ArticleListSerializer,
        'papers':   ResearchPaperSerializer,
        'repos':    RepositorySerializer,
    }
    for ct, results in raw.items():
        Ser = serializer_map.get(ct)
        if Ser:
            serialized = Ser([r.obj for r in results], many=True).data
            for i, item in enumerate(serialized):
                item['bm25_rank'] = results[i].bm25_rank
            data[ct] = serialized
        else:
            # videos — inline serialization
            data[ct] = [
                {'id': str(r.obj.pk), 'title': r.obj.title, 'bm25_rank': r.bm25_rank}
                for r in results
            ]

    total = sum(len(v) for v in data.values())
    elapsed_ms = round((_time.time() - start) * 1000)

    # Log search activity
    try:
        if request.user and request.user.is_authenticated:
            UserActivity.objects.create(
                user=request.user,
                interaction_type='search',
                metadata={'query': query, 'mode': 'bm25'}
            )
    except Exception:
        pass

    return Response({
        'success': True,
        'data':    data,
        'meta':    {
            'query':              query,
            'mode':               'bm25',
            'limit':              limit,
            'total':              total,
            'content_types':      content_types,
            'execution_time_ms':  elapsed_ms,
        },
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def hybrid_search_view(request):
    """
    POST /api/v1/search/hybrid/

    Hybrid search: BM25 + semantic merged via Reciprocal Rank Fusion, with
    optional cross-encoder reranking. Recommended default for best quality.

    Request body (JSON):
        query         (str, required)
        limit         (int, optional)     default 10, max 50
        content_types (list, optional)    default all
        filters       (dict, optional)
        use_reranker  (bool, optional)    default true

    Response (200):
        { "success": true, "data": { "articles": [...], ... },
          "meta": { "query": "...", "mode": "hybrid", "reranked": true, ... } }
    """
    import time as _time
    import os
    import sys
    from apps.core.search import hybrid_search
    from apps.articles.serializers import ArticleListSerializer
    from apps.papers.serializers import ResearchPaperSerializer
    from apps.repositories.serializers import RepositorySerializer

    query = request.data.get('query', '').strip()
    if not query:
        return Response({'success': False, 'error': {'message': 'Field "query" is required.'}}, status=422)

    limit         = min(int(request.data.get('limit', 10)), 50)
    content_types = request.data.get('content_types', ['articles', 'papers', 'repos', 'videos'])
    filters       = request.data.get('filters', {})
    use_reranker  = bool(request.data.get('use_reranker', True))
    start         = _time.time()

    # ── Generate query embedding ──────────────────────────────────────────────
    try:
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        if project_root not in sys.path:
            sys.path.insert(0, project_root)
        from ai_engine.embeddings import embed_text
        query_vector = embed_text(query)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("Embedding generation failed: %s", exc)
        return Response(
            {'success': False, 'error': {'message': 'Embedding service unavailable.', 'detail': str(exc)}},
            status=503,
        )

    raw = hybrid_search(
        query=query,
        query_vector=query_vector,
        content_types=content_types,
        limit=limit,
        filters=filters,
        use_reranker=use_reranker,
    )

    data = {}
    serializer_map = {
        'articles': ArticleListSerializer,
        'papers':   ResearchPaperSerializer,
        'repos':    RepositorySerializer,
    }
    for ct, results in raw.items():
        Ser = serializer_map.get(ct)
        if Ser:
            serialized = Ser([r.obj for r in results], many=True).data
            for i, item in enumerate(serialized):
                item['similarity_score']  = results[i].similarity_score
                item['bm25_rank']         = results[i].bm25_rank
                item['semantic_rank']     = results[i].semantic_rank
                item['rrf_score']         = round(results[i].rrf_score, 6)
                item['rerank_score']      = results[i].rerank_score
            data[ct] = serialized
        else:
            data[ct] = [
                {
                    'id':              str(r.obj.pk),
                    'title':           r.obj.title,
                    'similarity_score': r.similarity_score,
                    'rrf_score':       round(r.rrf_score, 6),
                    'rerank_score':    r.rerank_score,
                }
                for r in results
            ]

    total      = sum(len(v) for v in data.values())
    elapsed_ms = round((_time.time() - start) * 1000)
    reranked   = use_reranker and any(
        r.rerank_score is not None
        for results in raw.values()
        for r in results
    )

    # Log search activity
    try:
        if request.user and request.user.is_authenticated:
            UserActivity.objects.create(
                user=request.user,
                interaction_type='search',
                metadata={'query': query, 'mode': 'hybrid', 'reranked': reranked}
            )
    except Exception:
        pass

    return Response({
        'success': True,
        'data':    data,
        'meta':    {
            'query':             query,
            'mode':              'hybrid',
            'reranked':          reranked,
            'limit':             limit,
            'total':             total,
            'content_types':     content_types,
            'execution_time_ms': elapsed_ms,
        },
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

    if 'tweets' in content_types:
        from apps.tweets.models import Tweet  # noqa: PLC0415
        from apps.tweets.serializers import TweetListSerializer  # noqa: PLC0415

        qs = (
            Tweet.objects
            .filter(embedding__isnull=False)
            .annotate(similarity=CosineDistance('embedding', query_vector))
            .order_by('similarity')
        )
        if filters.get('topic'):
            qs = qs.filter(topic__iexact=filters['topic'])

        tweets = list(qs[:limit])
        serialized = TweetListSerializer(tweets, many=True).data
        for i, item in enumerate(serialized):
            dist = getattr(tweets[i], 'similarity', None)
            item['similarity_score'] = round(1 - (dist / 2), 4) if dist is not None else None
        results['tweets'] = serialized

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
        # Evaluate queryset once — avoids second COUNT(*) query
        bookmark_list = list(bookmarks)
        serializer = BookmarkSerializer(bookmark_list, many=True)
        return Response({'success': True, 'data': serializer.data, 'meta': {'total': len(bookmark_list)}})


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


class ScraperRunView(APIView):
    """
    POST /scraper/run/
    Trigger a named scraper with optional custom parameters.
    Body: { "scraper": "youtube"|"github"|"hackernews"|"arxiv", "params": {...} }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.core.tasks import (
            scrape_youtube, scrape_github, scrape_hackernews, scrape_arxiv, scrape_twitter,
        )

        scraper_id = request.data.get('scraper', '').lower()
        params     = request.data.get('params', {}) or {}

        SCRAPERS = {
            'youtube': lambda p: scrape_youtube.delay(
                queries=[q.strip() for q in p.get('queries', '').splitlines() if q.strip()] or None,
                days_back=int(p.get('days_back', 30)),
                max_results=int(p.get('max_results', 20)),
            ),
            'github': lambda p: scrape_github.delay(
                days_back=1,
                language=p.get('language') if p.get('language') != 'All' else None,
                limit=int(p.get('max_repos', 25)),
                user_id=str(request.user.id) if request.user.is_authenticated else None,
            ),
            'hackernews': lambda p: scrape_hackernews.delay(
                story_type=p.get('story_type', 'top'),
                limit=int(p.get('max_stories', 30)),
            ),
            'arxiv': lambda p: scrape_arxiv.delay(
                categories=[c.strip() for c in p.get('categories', '').splitlines() if c.strip()] or None,
                days_back=int(p.get('days_back', 7)),
                max_papers=int(p.get('max_papers', 20)),
            ),
            'twitter': lambda p: scrape_twitter.delay(
                query=p.get('query') or None,
                max_results=int(p.get('max_results', 100)),
                user_id=str(request.user.id) if request.user.is_authenticated else None,
            ),
        }

        if scraper_id not in SCRAPERS:
            return Response({'error': f'Unknown scraper: {scraper_id}. Valid: {list(SCRAPERS.keys())}'}, status=400)

        try:
            task = SCRAPERS[scraper_id](params)
            return Response({
                'success': True,
                'task_id': task.id,
                'message': f'{scraper_id.title()} scraper queued (task {task.id[:8]}…)',
            })
        except Exception as exc:
            return Response({'error': str(exc)}, status=500)


class BookmarkNotesView(APIView):
    """PATCH /bookmarks/<id>/notes/ — update the notes on a bookmark."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            bookmark = UserBookmark.objects.get(pk=pk, user=request.user)
        except UserBookmark.DoesNotExist:
            return Response({'success': False, 'error': 'Bookmark not found'}, status=404)
        notes = request.data.get('notes', '')
        bookmark.notes = notes
        bookmark.save(update_fields=['notes'])
        return Response({'success': True, 'data': {'notes': bookmark.notes}})


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

    Content-based recommendations derived from user's recent interactions using
    a single User Interest Vector (mean of recent embeddings).

    Query params:
      - limit (int, default 12, max 50)
      - offset (int, default 0)
    """
    try:
        limit = min(int(request.GET.get('limit', 12)), 50)
    except Exception:
        limit = 12
    try:
        offset = max(int(request.GET.get('offset', 0)), 0)
    except Exception:
        offset = 0

    from django.core.cache import cache  # noqa: PLC0415
    cache_key = f'recs_user_{request.user.id}_l{limit}_o{offset}'
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    recs = recommend_for_user(request.user, limit=limit, offset=offset)
    data = {
        'articles': ArticleListSerializer(recs['articles'], many=True).data,
        'papers': ResearchPaperSerializer(recs['papers'], many=True).data,
        'repos': RepositorySerializer(recs['repos'], many=True).data,
    }
    total = sum(len(v) for v in data.values())
    response_data = {'success': True, 'data': data, 'meta': {'total': total, 'limit': limit, 'offset': offset}}
    cache.set(cache_key, response_data, timeout=300)  # Cache recommendations for 5 min
    return Response(response_data)


@api_view(['GET'])
@permission_classes([AllowAny])
def trending(request):
    """
    GET /api/v1/trending/

    Returns trending items across articles, papers, and repositories in the last N hours (default 48),
    scored by weighted user interactions (bookmark > like > view).

    Query params:
      - limit (int, default 20, max 50)
      - hours (int, default 48)
    """
    try:
        limit = min(int(request.GET.get('limit', 20)), 50)
    except Exception:
        limit = 20
    try:
        hours = max(int(request.GET.get('hours', 48)), 1)
    except Exception:
        hours = 48

    from django.core.cache import cache  # noqa: PLC0415
    cache_key = f'trending_l{limit}_h{hours}'
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    res = get_trending(limit_per_type=limit, hours=hours)

    art_objs = [o for (o, s) in res['articles']]
    pap_objs = [o for (o, s) in res['papers']]
    rep_objs = [o for (o, s) in res['repos']]

    arts = ArticleListSerializer(art_objs, many=True).data
    paps = ResearchPaperSerializer(pap_objs, many=True).data
    reps = RepositorySerializer(rep_objs, many=True).data

    # Inject trend_score preserving the ranking order
    for i, (_, score) in enumerate(res['articles']):
        if i < len(arts):
            arts[i]['trend_score'] = round(float(score), 3)
    for i, (_, score) in enumerate(res['papers']):
        if i < len(paps):
            paps[i]['trend_score'] = round(float(score), 3)
    for i, (_, score) in enumerate(res['repos']):
        if i < len(reps):
            reps[i]['trend_score'] = round(float(score), 3)

    trending_response = {
        'success': True,
        'data': {
            'articles': arts,
            'papers': paps,
            'repos': reps,
        },
        'meta': {
            'limit': limit,
            'hours': hours,
            'since': res['since'].isoformat(),
            'total': len(arts) + len(paps) + len(reps),
        }
    }
    cache.set(cache_key, trending_response, timeout=600)  # Cache trending for 10 min
    return Response(trending_response)


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


# ── TASK-305-B3: Daily Briefing endpoints ────────────────────────────────────

class TodayBriefingView(APIView):
    """GET /api/briefing/today/ — return today's briefing or 404."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        try:
            briefing = DailyBriefing.objects.get(user=request.user, date=today)
        except DailyBriefing.DoesNotExist:
            return Response(
                {'success': False, 'error': {'message': 'No briefing generated yet for today. Check back after 06:30 UTC.'}},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({
            'success': True,
            'data': {
                'id':            str(briefing.id),
                'date':          briefing.date.isoformat(),
                'content':       briefing.content,
                'sources':       briefing.sources,
                'topic_summary': briefing.topic_summary,
                'generated_at':  briefing.generated_at.isoformat(),
            }
        })


class BriefingHistoryView(APIView):
    """GET /api/briefing/history/ — last 7 days of briefings."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        briefings = DailyBriefing.objects.filter(user=request.user).order_by('-date')[:7]
        data = [
            {
                'id':            str(b.id),
                'date':          b.date.isoformat(),
                'content':       b.content,
                'sources':       b.sources,
                'topic_summary': b.topic_summary,
                'generated_at':  b.generated_at.isoformat(),
            }
            for b in briefings
        ]
        return Response({'success': True, 'data': data})
