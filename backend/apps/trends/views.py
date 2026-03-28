"""
Trends app views — Technology Trend Radar (Phase 2 / dashboard widget).
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from datetime import timedelta

from .models import TechnologyTrend
from .serializers import TechnologyTrendSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def trend_list(request):
    """
    GET /api/v1/trends/
    Returns top technology trends, optionally filtered by category or date range.
    Query params:
      - category: filter by category string
      - days: number of days back to look (default 30)
      - limit: max results (default 20)
    """
    try:
        days = max(1, min(int(request.query_params.get("days", 30)), 365))
    except (ValueError, TypeError):
        days = 30
    try:
        limit = max(1, min(int(request.query_params.get("limit", 20)), 100))
    except (ValueError, TypeError):
        limit = 20
    category = request.query_params.get("category", "")

    since = timezone.now().date() - timedelta(days=days)
    qs = TechnologyTrend.objects.filter(date__gte=since)

    if category:
        qs = qs.filter(category__icontains=category)

    qs = qs.order_by("-trend_score")[:limit]
    serializer = TechnologyTrendSerializer(qs, many=True)
    return Response({
        "success": True,
        "count": len(serializer.data),
        "results": serializer.data,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def trend_detail(request, pk):
    """GET /api/v1/trends/<pk>/"""
    try:
        trend = TechnologyTrend.objects.get(pk=pk)
    except TechnologyTrend.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(TechnologyTrendSerializer(trend).data)
