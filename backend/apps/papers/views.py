from rest_framework import generics, filters
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import ResearchPaper
from .serializers import ResearchPaperSerializer
from apps.core.pagination import StandardPagination

class PaperFilter(django_filters.FilterSet):
    # categories is a JSONField (array). Use a custom filter to do
    # categories__contains=[value] which checks if the array contains the value.
    category   = django_filters.CharFilter(method='filter_category')
    difficulty = django_filters.ChoiceFilter(field_name='difficulty_level',
                     choices=ResearchPaper.Difficulty.choices)
    date_from  = django_filters.DateFilter(field_name='published_date', lookup_expr='gte')
    date_to    = django_filters.DateFilter(field_name='published_date', lookup_expr='lte')

    def filter_category(self, queryset, name, value):
        """Filter papers whose categories JSONField array contains the given value."""
        if not value:
            return queryset
        return queryset.filter(categories__contains=[value])

    class Meta:
        model  = ResearchPaper
        fields = ['difficulty', 'date_from', 'date_to']

class PaperListView(generics.ListAPIView):
    serializer_class   = ResearchPaperSerializer
    permission_classes = [AllowAny]
    pagination_class   = StandardPagination
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class    = PaperFilter
    search_fields      = ['title', 'abstract', 'authors', 'categories']
    ordering_fields    = ['published_date', 'citation_count', 'fetched_at']
    ordering           = ['-fetched_at']
    queryset           = ResearchPaper.objects.all()

class PaperDetailView(generics.RetrieveAPIView):
    queryset           = ResearchPaper.objects.all()
    serializer_class   = ResearchPaperSerializer
    permission_classes = [AllowAny]
    def retrieve(self, request, *args, **kwargs):
        return Response({'success': True, 'data': self.get_serializer(self.get_object()).data})

class TrendingPaperListView(generics.ListAPIView):
    serializer_class   = ResearchPaperSerializer
    permission_classes = [AllowAny]
    pagination_class   = StandardPagination
    queryset           = ResearchPaper.objects.order_by('-citation_count', '-published_date')
