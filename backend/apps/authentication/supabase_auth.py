"""
backend.apps.authentication.supabase_auth
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Supabase token exchange endpoint for Django JWT authentication.

This allows users to authenticate via Supabase and receive Django JWT tokens
for API access, maintaining full compatibility with the existing auth system.

Phase 10 — Supabase Integration

POST /api/v1/auth/supabase/
{
    "access_token": "supabase-access-token"
}
"""
from __future__ import annotations

import logging
from typing import Any

import structlog
import requests
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

logger = structlog.get_logger(__name__)


SUPABASE_URL = getattr(settings, 'SUPABASE_URL', '')
SUPABASE_SERVICE_ROLE_KEY = getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', '')


class SupabaseTokenExchangeView(APIView):
    """
    POST /api/v1/auth/supabase/

    Exchange a Supabase access token for Django JWT tokens.
    This enables Supabase as an additional auth layer while
    maintaining Django JWT for API access.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request: Request) -> Response:
        access_token = request.data.get('access_token')

        if not access_token:
            return Response(
                {'error': 'access_token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Verify the Supabase token with the Supabase Auth API
            user_info = self._verify_supabase_token(access_token)

            if not user_info:
                return Response(
                    {'error': 'Invalid Supabase token'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            # Get or create Django user
            user = self._get_or_create_user(user_info)

            if not user:
                return Response(
                    {'error': 'Failed to create user account'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Generate Django JWT tokens
            from rest_framework_simplejwt.tokens import RefreshToken
            from apps.users.serializers import UserProfileSerializer

            refresh = RefreshToken.for_user(user)
            access = str(refresh.access_token)

            # Optionally rotate refresh token
            refresh = RefreshToken.for_user(user)

            logger.info(
                "supabase_token_exchange_success",
                user_email=user.email,
                supabase_user_id=user_info.get('id'),
            )

            return Response({
                'access': access,
                'refresh': str(refresh),
                'user': UserProfileSerializer(user).data,
            })

        except Exception as exc:
            logger.exception("supabase_token_exchange_failed", error=str(exc))
            return Response(
                {'error': 'Authentication failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _verify_supabase_token(self, access_token: str) -> dict[str, Any] | None:
        """
        Verify Supabase access token using the Supabase Auth API.
        Uses the service role key for server-side verification.
        """
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            logger.error("supabase_credentials_missing")
            return None

        try:
            headers = {
                'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
            }

            response = requests.get(
                f'{SUPABASE_URL}/auth/v1/user',
                headers=headers,
                timeout=10,
            )

            if response.status_code == 200:
                return response.json()

            logger.warning(
                "supabase_token_verification_failed",
                status=response.status_code,
            )
            return None

        except requests.RequestException as exc:
            logger.error("supabase_api_request_failed", error=str(exc))
            return None

    def _get_or_create_user(self, user_info: dict[str, Any]):
        """
        Get or create a Django User from Supabase user info.
        Maps Supabase user attributes to Django User model.
        """
        from apps.users.models import User

        supabase_id = user_info.get('id')
        email = user_info.get('email')

        if not email:
            logger.error("supabase_user_missing_email", user_id=supabase_id)
            return None

        # Try to find existing user by email or supabase_id
        try:
            user = User.objects.get(email=email)

            # Update supabase_id if not set
            if not user.google_id and not user.github_id:
                user.google_id = supabase_id
                user.save(update_fields=['google_id', 'updated_at'])

            return user

        except User.DoesNotExist:
            # Create new user
            try:
                metadata = user_info.get('user_metadata', {}) or {}

                user = User.objects.create_user(
                    username=self._generate_username(email),
                    email=email,
                    password=None,  # No password for SSO users
                    first_name=metadata.get('first_name', ''),
                    last_name=metadata.get('last_name', ''),
                    google_id=supabase_id,
                    avatar_url=metadata.get('avatar_url', ''),
                    email_verified=True,
                )

                logger.info("supabase_user_created", user_email=email)

                return user

            except Exception as exc:
                logger.exception("supabase_user_creation_failed", error=str(exc))
                return None

    def _generate_username(self, email: str) -> str:
        """
        Generate a unique username from email address.
        """
        from django.contrib.auth.models import User
        import re

        # Extract username from email
        base_username = email.split('@')[0]
        # Remove non-alphanumeric characters
        base_username = re.sub(r'[^a-zA-Z0-9_]', '', base_username)
        # Ensure minimum length
        if len(base_username) < 3:
            base_username = base_username + 'user'

        username = base_username
        counter = 1

        # Ensure uniqueness
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        return username


class SupabaseWebhookView(APIView):
    """
    POST /api/v1/auth/supabase/webhook/

    Handle Supabase webhook events (user created, updated, deleted).
    Used for syncing user data between Supabase and Django.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request: Request) -> Response:
        # Verify webhook signature (optional but recommended)
        webhook_secret = getattr(settings, 'SUPABASE_WEBHOOK_SECRET', '')

        if webhook_secret:
            import hmac
            import hashlib

            signature = request.META.get('HTTP_SUPABASE_SIGNATURE', '')
            expected = hmac.new(
                webhook_secret.encode(),
                request.body,
                hashlib.sha256
            ).hexdigest()

            if not hmac.compare_digest(signature, expected):
                return Response(
                    {'error': 'Invalid webhook signature'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

        event_type = request.data.get('type')
        payload = request.data.get('payload', {})

        try:
            if event_type == 'user.created':
                self._handle_user_created(payload)
            elif event_type == 'user.updated':
                self._handle_user_updated(payload)
            elif event_type == 'user.deleted':
                self._handle_user_deleted(payload)
            else:
                logger.info("supabase_webhook_unknown_event", type=event_type)

            return Response({'status': 'ok'})

        except Exception as exc:
            logger.exception("supabase_webhook_failed", error=str(exc))
            return Response(
                {'error': 'Webhook processing failed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _handle_user_created(self, payload: dict) -> None:
        """Handle new user creation from Supabase."""
        # User creation is handled by token exchange endpoint
        logger.info("supabase_webhook_user_created", user_id=payload.get('id'))

    def _handle_user_updated(self, payload: dict) -> None:
        """Handle user update from Supabase."""
        from apps.users.models import User

        supabase_id = payload.get('id')
        email = payload.get('email')
        metadata = payload.get('user_metadata', {}) or {}

        try:
            user = User.objects.get(google_id=supabase_id) | User.objects.get(email=email)

            updates = {}
            if metadata.get('first_name'):
                updates['first_name'] = metadata['first_name']
            if metadata.get('last_name'):
                updates['last_name'] = metadata['last_name']
            if metadata.get('avatar_url'):
                updates['avatar_url'] = metadata['avatar_url']

            if updates:
                User.objects.filter(pk=user.pk).update(**updates)
                logger.info("supabase_webhook_user_updated", user_email=email)

        except User.DoesNotExist:
            logger.warning("supabase_webhook_user_not_found", user_id=supabase_id)

    def _handle_user_deleted(self, payload: dict) -> None:
        """Handle user deletion from Supabase."""
        from apps.users.models import User

        supabase_id = payload.get('id')

        try:
            User.objects.filter(google_id=supabase_id).delete()
            logger.info("supabase_webhook_user_deleted", user_id=supabase_id)
        except Exception as exc:
            logger.error("supabase_webhook_delete_failed", error=str(exc))
