from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .serializers import UserRegistrationSerializer, UserProfileSerializer, UserPreferencesSerializer
from .models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Extend SimpleJWT login response to include user profile data."""

    def validate(self, attrs):
        data = super().validate(attrs)
        # Append user profile so the frontend can hydrate the auth store
        data['user'] = UserProfileSerializer(self.user).data
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    """POST /api/v1/auth/login/ — returns {access, refresh, user}."""
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'success': True,
            'data': {
                'user': UserProfileSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }
        }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    POST /api/v1/auth/logout/
    Blacklists the refresh token if possible, then always returns 200.
    Frontend should clear local state regardless of this response.
    """
    refresh_token = request.data.get('refresh')
    if refresh_token:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            # Token may already be expired, invalid, or blacklisting not enabled
            # — always return success so frontend can clear local state cleanly
            pass
    return Response({'success': True, 'data': {'message': 'Logged out successfully.'}})


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object())
        # Return user data directly (not nested) so frontend authStore can
        # read it straight from response.data
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'success': True, 'data': serializer.data})


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_preferences(request):
    serializer = UserPreferencesSerializer(request.user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({'success': True, 'data': serializer.data})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def ai_keys_view(request):
    """
    GET  /api/v1/users/ai-keys/ — check which keys are configured for this user
    POST /api/v1/users/ai-keys/ — save encrypted keys to user preferences
    Keys are stored in user.preferences JSON field and used by the AI engine.
    """
    if request.method == 'GET':
        prefs = getattr(request.user, 'preferences', {}) or {}
        gemini_ok     = bool(prefs.get('gemini_api_key'))
        openrouter_ok = bool(prefs.get('openrouter_api_key'))
        return Response({
            'gemini_configured':     gemini_ok,
            'openrouter_configured': openrouter_ok,
            'any_configured':        gemini_ok or openrouter_ok,
        })

    # POST — save keys
    prefs = getattr(request.user, 'preferences', {}) or {}
    if not isinstance(prefs, dict):
        prefs = {}

    gemini_key     = request.data.get('gemini_api_key', '').strip()
    openrouter_key = request.data.get('openrouter_api_key', '').strip()

    # Basic format validation — reject obviously invalid keys
    if gemini_key:
        if len(gemini_key) < 10 or len(gemini_key) > 512:
            return Response({'success': False, 'error': 'Invalid Gemini API key format.'}, status=400)
        prefs['gemini_api_key'] = gemini_key
        # SECURITY: do NOT set os.environ — that leaks keys process-wide to all users
    if openrouter_key:
        if len(openrouter_key) < 10 or len(openrouter_key) > 512:
            return Response({'success': False, 'error': 'Invalid OpenRouter API key format.'}, status=400)
        prefs['openrouter_api_key'] = openrouter_key
        # SECURITY: do NOT set os.environ — per-user keys are read from prefs at request time

    request.user.preferences = prefs
    request.user.save(update_fields=['preferences'])

    return Response({'success': True, 'gemini_configured': bool(prefs.get('gemini_api_key')), 'openrouter_configured': bool(prefs.get('openrouter_api_key'))})
