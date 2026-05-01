"""
Celery tasks for user management.
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def create_initial_workflows_task(self, user_id: str, prefs_id: str):
    """
    Celery task to create initial workflows for a new user.
    Runs asynchronously in the background so it doesn't block the onboarding endpoint.
    """
    try:
        from apps.users.models import User, OnboardingPreferences

        user = User.objects.get(id=user_id)
        prefs = OnboardingPreferences.objects.get(id=prefs_id)

        # Import here to avoid circular imports
        from apps.users.onboarding_views import _create_initial_workflows

        _create_initial_workflows(user, prefs)
        logger.info(f"Successfully created initial workflows for user {user.email}")

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for onboarding")
    except OnboardingPreferences.DoesNotExist:
        logger.error(f"OnboardingPreferences {prefs_id} not found for onboarding")
    except Exception as exc:
        logger.error(f"Failed to create initial workflows for user {user_id}: {exc}")
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60)
