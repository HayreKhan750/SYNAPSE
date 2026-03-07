from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from .models import Article, Source
from .serializers import ArticleListSerializer, ArticleDetailSerializer, SourceSerializer
from .filters import ArticleFilter
from apps.core.pagination import StandardPagination


class ArticleListView(generics.ListAPIView):
    serializer_class   = ArticleListSerializer
    permission_classes = [AllowAny]
    pagination_class   = StandardPagination
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class    = ArticleFilter
    search_fields      = ['title', 'summary', 'topic', 'tags', 'keywords']
    ordering_fields    = ['published_at', 'trending_score', 'view_count', 'scraped_at']
    ordering           = ['-published_at']

    def get_queryset(self):
        return Article.objects.select_related('source').all()


class ArticleDetailView(generics.RetrieveAPIView):
    queryset           = Article.objects.select_related('source').all()
    serializer_class   = ArticleDetailSerializer
    permission_classes = [AllowAny]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.view_count += 1
        instance.save(update_fields=['view_count'])
        return Response({'success': True, 'data': self.get_serializer(instance).data})


class TrendingArticleListView(generics.ListAPIView):
    serializer_class   = ArticleListSerializer
    permission_classes = [AllowAny]
    pagination_class   = StandardPagination

    def get_queryset(self):
        return Article.objects.select_related('source').order_by('-trending_score')[:50]


@api_view(['GET'])
@permission_classes([AllowAny])
def article_topics(request):
    topics = Article.objects.exclude(topic='').values_list('topic', flat=True).distinct()
    return Response({'success': True, 'data': list(topics)})


@api_view(['GET'])
@permission_classes([AllowAny])
def article_search(request):
    q = request.GET.get('q', '').strip()
    if not q:
        return Response({'success': False, 'error': {'message': 'q parameter required'}}, status=422)
    articles = Article.objects.filter(
        Q(title__icontains=q) | Q(summary__icontains=q) |
        Q(topic__icontains=q) | Q(tags__contains=[q])
    ).select_related('source').order_by('-trending_score')[:20]
    serializer = ArticleListSerializer(articles, many=True)
    return Response({'success': True, 'data': serializer.data, 'meta': {'query': q, 'count': len(serializer.data)}})
