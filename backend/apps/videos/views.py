from rest_framework import generics, filters
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Video
from .serializers import VideoSerializer, VideoDetailSerializer
from apps.core.pagination import StandardPagination

class VideoListView(generics.ListAPIView):
    serializer_class   = VideoSerializer
    permission_classes = [AllowAny]
    pagination_class   = StandardPagination
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['title', 'description', 'channel_name', 'topics']
    ordering_fields    = ['published_at', 'view_count', 'like_count', 'fetched_at']
    ordering           = ['-fetched_at']
    def get_queryset(self):
        qs = Video.objects.all()
        # ── Personalization: scope to videos linked via UserVideo junction ──
        if self.request.user and self.request.user.is_authenticated:
            qs = qs.filter(user_videos__user=self.request.user)
        return qs
class VideoDetailView(generics.RetrieveAPIView):
    queryset           = Video.objects.all()
    serializer_class   = VideoDetailSerializer
    permission_classes = [AllowAny]
    def retrieve(self, request, *args, **kwargs):
        return Response({'success': True, 'data': self.get_serializer(self.get_object()).data})

class TrendingVideoListView(generics.ListAPIView):
    serializer_class   = VideoSerializer
    permission_classes = [AllowAny]
    pagination_class   = StandardPagination
    queryset           = Video.objects.order_by('-view_count')
