from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Q
from .models import Article
from .serializers import ArticleListSerializer, ArticleDetailSerializer
from apps.core.pagination import StandardPagination


class ArticleListView(ListAPIView):
    serializer_class = ArticleListSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['topic', 'source__source_type']
    search_fields = ['title', 'summary', 'author', 'topic', 'tags']
    ordering_fields = ['published_at', 'trending_score', 'view_count', 'scraped_at']
    ordering = ['-published_at']
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = Article.objects.select_related('source').all()
        # Tag filtering
        tag = self.request.GET.get('tag')
        if tag:
            qs = qs.filter(tags__icontains=tag)
        # Topic filtering
        topic = self.request.GET.get('topic')
        if topic and topic != 'All':
            qs = qs.filter(topic__iexact=topic)
        # Full-text search
        q = self.request.GET.get('q', '').strip()
        if q:
            qs = qs.filter(
                Q(title__icontains=q) |
                Q(summary__icontains=q) |
                Q(author__icontains=q) |
                Q(topic__icontains=q)
            )
        return qs


class ArticleDetailView(RetrieveAPIView):
    serializer_class = ArticleDetailSerializer
    permission_classes = [AllowAny]
    queryset = Article.objects.select_related('source').all()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.view_count += 1
        instance.save(update_fields=['view_count'])
        serializer = self.get_serializer(instance)
        return Response({'success': True, 'data': serializer.data})


class TrendingArticleListView(ListAPIView):
    serializer_class = ArticleListSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardPagination

    def get_queryset(self):
        return Article.objects.select_related('source').order_by('-trending_score', '-published_at')[:50]


@api_view(['GET'])
@permission_classes([AllowAny])
def article_topics(request):
    topics = Article.objects.exclude(topic='').values_list('topic', flat=True).distinct().order_by('topic')
    return Response({'success': True, 'data': list(topics)})


@api_view(['GET'])
@permission_classes([AllowAny])
def article_search(request):
    q = request.GET.get('q', '').strip()
    if not q:
        return Response({'success': False, 'error': {'message': 'Query parameter q is required'}}, status=400)
    results = Article.objects.filter(
        Q(title__icontains=q) |
        Q(summary__icontains=q) |
        Q(author__icontains=q) |
        Q(topic__icontains=q)
    ).select_related('source').order_by('-trending_score')[:20]
    serializer = ArticleListSerializer(results, many=True)
    return Response({'success': True, 'data': serializer.data, 'meta': {'query': q, 'total': len(serializer.data)}})
