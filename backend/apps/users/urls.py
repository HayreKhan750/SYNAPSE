from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/',        views.RegisterView.as_view(),              name='auth-register'),
    path('login/',           views.CustomTokenObtainPairView.as_view(), name='auth-login'),
    path('logout/',          views.logout_view,                         name='auth-logout'),
    path('token/refresh/',   TokenRefreshView.as_view(),                name='auth-token-refresh'),
    path('me/',              views.MeView.as_view(),                    name='auth-me'),
    path('me/preferences/',  views.update_preferences,                  name='auth-preferences'),
]
