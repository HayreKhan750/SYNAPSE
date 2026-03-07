from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import connection
import redis
import os

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """System health check endpoint."""
    health = {'status': 'healthy', 'services': {}}
    try:
        connection.ensure_connection()
        health['services']['database'] = 'ok'
    except Exception:
        health['services']['database'] = 'error'
        health['status'] = 'degraded'
    try:
        r = redis.from_url(os.environ.get('REDIS_URL', 'redis://localhost:6379/0'))
        r.ping()
        health['services']['redis'] = 'ok'
    except Exception:
        health['services']['redis'] = 'error'
        health['status'] = 'degraded'
    return Response({'success': True, 'data': health})

@api_view(['POST'])
def semantic_search(request):
    """Semantic/vector search across all content types."""
    query = request.data.get('query', '')
    limit = request.data.get('limit', 10)
    content_types = request.data.get('content_types', ['article', 'paper', 'repository'])
    if not query:
        return Response({'success': False, 'error': {'message': 'query is required'}}, status=422)
    # Placeholder — full implementation in Phase 2.3
    return Response({
        'success': True,
        'data': [],
        'meta': {'query': query, 'limit': limit, 'note': 'Semantic search enabled in Phase 2.3'}
    })
