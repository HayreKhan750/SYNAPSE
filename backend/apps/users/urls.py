from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from . import mfa_views

urlpatterns = [
    path('register/',        views.RegisterView.as_view(),              name='auth-register'),
    path('login/',           views.CustomTokenObtainPairView.as_view(), name='auth-login'),
    path('logout/',          views.logout_view,                         name='auth-logout'),
    path('token/refresh/',   TokenRefreshView.as_view(),                name='auth-token-refresh'),
    path('me/',              views.MeView.as_view(),                    name='auth-me'),
    path('me/preferences/',  views.update_preferences,                  name='auth-preferences'),
    path('ai-keys/',         views.ai_keys_view,                        name='user-ai-keys'),

    # ── MFA (Phase 9.1) ────────────────────────────────────────────────────────
    path('mfa/setup/',           mfa_views.mfa_setup,           name='mfa-setup'),
    path('mfa/setup/confirm/',   mfa_views.mfa_setup_confirm,   name='mfa-setup-confirm'),
    path('mfa/verify/',          mfa_views.mfa_verify,           name='mfa-verify'),
    path('mfa/verify-backup/',   mfa_views.mfa_verify_backup,   name='mfa-verify-backup'),
    path('mfa/disable/',         mfa_views.mfa_disable,          name='mfa-disable'),
    path('mfa/status/',          mfa_views.mfa_status,           name='mfa-status'),
]
