"""
backend.apps.authentication.urls
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
URL configuration for Supabase authentication integration.

POST /api/v1/auth/supabase/          - Token exchange (Supabase -> Django JWT)
POST /api/v1/auth/supabase/webhook/  - Supabase webhook handler
"""
from django.urls import path
from .supabase_auth import SupabaseTokenExchangeView, SupabaseWebhookView

app_name = 'authentication'

urlpatterns = [
    path('supabase/', SupabaseTokenExchangeView.as_view(), name='supabase-token-exchange'),
    path('supabase/webhook/', SupabaseWebhookView.as_view(), name='supabase-webhook'),
]
