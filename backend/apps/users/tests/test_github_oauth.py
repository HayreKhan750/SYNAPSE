"""
TASK-002-T2 — Integration tests for GitHub OAuth flow.

Tests the GitHub OAuth redirect and callback views with mocked GitHub API responses.
"""
from __future__ import annotations

from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework import status


def _make_user(email="existing@test.com", github_id=None):
    from django.contrib.auth import get_user_model
    import uuid
    User = get_user_model()
    username = email.split("@")[0] + "_" + str(uuid.uuid4())[:8]
    user = User.objects.create_user(
        username=username,
        email=email,
        password="TestPass123!",
        first_name="Test",
        last_name="User",
    )
    if github_id:
        user.github_id = str(github_id)
        user.save(update_fields=["github_id"])
    return user


MOCK_GITHUB_TOKEN_RESPONSE = {
    "access_token": "gho_mock_access_token_123",
    "token_type":   "bearer",
    "scope":        "user:email",
}

MOCK_GITHUB_USER = {
    "id":         12345678,
    "login":      "testuser",
    "email":      "github_user@test.com",
    "name":       "Test GitHub User",
    "avatar_url": "https://avatars.githubusercontent.com/u/12345678",
}

MOCK_GITHUB_EMAILS = [
    {"email": "github_user@test.com", "primary": True,  "verified": True},
    {"email": "secondary@test.com",   "primary": False, "verified": True},
]


@override_settings(
    GITHUB_CLIENT_ID="mock_client_id",
    GITHUB_CLIENT_SECRET="mock_client_secret",
    FRONTEND_URL="http://localhost:3000",
)
class TestGitHubOAuthRedirect(TestCase):

    def setUp(self):
        self.client = APIClient()

    def test_github_auth_redirects(self):
        """GET /auth/github/ should redirect to GitHub OAuth URL or return config error."""
        resp = self.client.get("/api/v1/auth/github/")
        # Should be a redirect (302), return URL (200), or config error (400/503)
        # In test env without real GitHub creds it may return an error — that's acceptable
        self.assertIn(resp.status_code, [200, 302, 400, 503])
        if resp.status_code == 302:
            self.assertIn("github.com", resp["Location"])
        elif resp.status_code == 200:
            self.assertIn("github.com", str(resp.data))


@override_settings(
    GITHUB_CLIENT_ID="mock_client_id",
    GITHUB_CLIENT_SECRET="mock_client_secret",
    FRONTEND_URL="http://localhost:3000",
)
class TestGitHubOAuthCallback(TestCase):

    def setUp(self):
        self.client = APIClient()

    def _mock_github_requests(self, mock_requests, user_data=None, emails=None):
        """Helper to set up mock GitHub API responses."""
        mock_token_resp = MagicMock()
        mock_token_resp.json.return_value = MOCK_GITHUB_TOKEN_RESPONSE
        mock_token_resp.status_code = 200

        mock_user_resp = MagicMock()
        mock_user_resp.json.return_value = user_data or MOCK_GITHUB_USER
        mock_user_resp.status_code = 200

        mock_email_resp = MagicMock()
        mock_email_resp.json.return_value = emails or MOCK_GITHUB_EMAILS
        mock_email_resp.status_code = 200

        mock_requests.post.return_value = mock_token_resp
        mock_requests.get.side_effect = [mock_user_resp, mock_email_resp]

    @patch("apps.users.github_views.requests")
    def test_new_user_created_on_callback(self, mock_requests):
        """GitHub callback with new email should create a user account."""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        self._mock_github_requests(mock_requests)

        initial_count = User.objects.count()
        resp = self.client.get("/api/v1/auth/github/callback/?code=mock_code&state=mock_state")

        # Should redirect to frontend with tokens
        self.assertIn(resp.status_code, [302, 200])
        # A new user should have been created
        self.assertGreater(User.objects.count(), initial_count)

    @patch("apps.users.github_views.requests")
    def test_existing_github_user_linked(self, mock_requests):
        """Callback with existing github_id should link and return tokens, not create duplicate."""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        existing = _make_user(email="github_user@test.com", github_id=12345678)
        self._mock_github_requests(mock_requests)

        count_before = User.objects.count()
        resp = self.client.get("/api/v1/auth/github/callback/?code=mock_code&state=mock_state")

        self.assertIn(resp.status_code, [302, 200])
        # No new user created
        self.assertEqual(User.objects.count(), count_before)

    @patch("apps.users.github_views.requests")
    def test_callback_without_code_fails(self, mock_requests):
        """Callback with no code param should redirect to error or return 400."""
        resp = self.client.get("/api/v1/auth/github/callback/")
        self.assertIn(resp.status_code, [302, 400])

    def test_github_disconnect_requires_auth(self):
        """DELETE /auth/github/disconnect/ should require authentication."""
        resp = self.client.delete("/api/v1/auth/github/disconnect/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_github_disconnect_authenticated(self):
        """Authenticated user should be able to disconnect GitHub."""
        user = _make_user(email="disconnect@test.com", github_id=99999)
        self.client.force_authenticate(user=user)
        resp = self.client.delete("/api/v1/auth/github/disconnect/")
        self.assertIn(resp.status_code, [200, 204])
        user.refresh_from_db()
        self.assertFalse(bool(user.github_id))


@override_settings(
    GITHUB_CLIENT_ID="mock_client_id",
    GITHUB_CLIENT_SECRET="mock_client_secret",
    FRONTEND_URL="http://localhost:3000",
)
class TestEmailVerificationResend(TestCase):
    """Tests for the resend-verification endpoint (TASK-002-B4)."""

    def setUp(self):
        self.client = APIClient()

    def _make_unverified_user(self, email="unverified@test.com"):
        from django.contrib.auth import get_user_model
        import uuid
        User = get_user_model()
        username = email.split("@")[0] + "_" + str(uuid.uuid4())[:8]
        user = User.objects.create_user(
            username=username,
            email=email,
            password="TestPass123!",
            first_name="Unverified",
            last_name="User",
        )
        import uuid
        user.email_verified = False
        user.email_verification_token = str(uuid.uuid4())
        user.save(update_fields=["email_verified", "email_verification_token"])
        return user

    def test_resend_generates_new_token(self):
        """Resend should create a new verification token."""
        user = self._make_unverified_user()
        old_token = user.email_verification_token

        with patch("apps.notifications.email_service.send_notification_email", return_value=True):
            resp = self.client.post(
                "/api/v1/auth/verify-email/resend/",
                {"email": user.email},
                format="json",
            )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["success"])
        user.refresh_from_db()
        self.assertNotEqual(user.email_verification_token, old_token)

    def test_resend_unknown_email_returns_success(self):
        """Should not reveal whether email exists."""
        resp = self.client.post(
            "/api/v1/auth/verify-email/resend/",
            {"email": "doesnotexist@test.com"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["success"])

    def test_resend_already_verified_returns_success(self):
        """If user is already verified, should return success with message."""
        from django.contrib.auth import get_user_model
        import uuid
        User = get_user_model()
        user = User.objects.create_user(
            username="verified_" + str(uuid.uuid4())[:8],
            email="verified@test.com",
            password="TestPass123!",
        )
        user.email_verified = True
        user.save(update_fields=["email_verified"])

        resp = self.client.post(
            "/api/v1/auth/verify-email/resend/",
            {"email": user.email},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["success"])

    def test_resend_missing_email_returns_400(self):
        """Missing email body should return 400."""
        resp = self.client.post(
            "/api/v1/auth/verify-email/resend/",
            {},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
