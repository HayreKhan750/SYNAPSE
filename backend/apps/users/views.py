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
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response({'success': True, 'data': {'message': 'Logged out successfully.'}})
    except TokenError:
        return Response({'success': False, 'error': {'message': 'Invalid token.'}}, status=400)


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
        return Response({
            'gemini_configured':     bool(prefs.get('gemini_api_key')),
            'openrouter_configured': bool(prefs.get('openrouter_api_key')),
        })

    # POST — save keys
    prefs = getattr(request.user, 'preferences', {}) or {}
    if not isinstance(prefs, dict):
        prefs = {}

    gemini_key     = request.data.get('gemini_api_key', '').strip()
    openrouter_key = request.data.get('openrouter_api_key', '').strip()

    if gemini_key:
        prefs['gemini_api_key'] = gemini_key
        import os; os.environ['GEMINI_API_KEY'] = gemini_key
    if openrouter_key:
        prefs['openrouter_api_key'] = openrouter_key
        import os; os.environ['OPENROUTER_API_KEY'] = openrouter_key

    request.user.preferences = prefs
    request.user.save(update_fields=['preferences'])

    return Response({'success': True, 'gemini_configured': bool(prefs.get('gemini_api_key')), 'openrouter_configured': bool(prefs.get('openrouter_api_key'))})
