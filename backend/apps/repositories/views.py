from rest_framework import generics, filters
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
import django_filters
from .models import Repository
from .serializers import RepositorySerializer
from apps.core.pagination import StandardPagination

class RepositoryFilter(django_filters.FilterSet):
    language  = django_filters.CharFilter(lookup_expr='iexact')
    stars_min = django_filters.NumberFilter(field_name='stars', lookup_expr='gte')
    trending  = django_filters.BooleanFilter(field_name='is_trending')
    class Meta:
        model  = Repository
        fields = ['language', 'stars_min', 'trending']

class RepositoryListView(generics.ListAPIView):
    serializer_class   = RepositorySerializer
    permission_classes = [AllowAny]
    pagination_class   = StandardPagination
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class    = RepositoryFilter
    search_fields      = ['name', 'description', 'owner', 'topics']
    ordering_fields    = ['stars', 'forks', 'stars_today', 'scraped_at']
    ordering           = ['-stars']
    queryset           = Repository.objects.all()

class RepositoryDetailView(generics.RetrieveAPIView):
    queryset           = Repository.objects.all()
    serializer_class   = RepositorySerializer
    permission_classes = [AllowAny]
    def retrieve(self, request, *args, **kwargs):
        return Response({'success': True, 'data': self.get_serializer(self.get_object()).data})

class TrendingRepositoryListView(generics.ListAPIView):
    serializer_class   = RepositorySerializer
    permission_classes = [AllowAny]
    pagination_class   = StandardPagination
    queryset           = Repository.objects.filter(is_trending=True).order_by('-stars_today')
