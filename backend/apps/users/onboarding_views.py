"""
SYNAPSE Onboarding API Views
Handles the 5-step onboarding wizard flow for new users.

Endpoints:
    GET  /api/v1/auth/onboarding/status/           — get current onboarding state
    POST /api/v1/auth/onboarding/start/            — initialise OnboardingPreferences
    POST /api/v1/auth/onboarding/steps/<step>/complete/  — advance a step
    POST /api/v1/auth/onboarding/finish/           — mark user as fully onboarded
"""

import logging
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import OnboardingPreferences, User

logger = logging.getLogger(__name__)

TOTAL_STEPS = 5

STEP_CONFIG = {
    1: {"title": "Welcome to SYNAPSE", "description": "Let's get you set up in a few quick steps."},
    2: {"title": "Choose Your Interests", "description": "Select the topics you care about."},
    3: {"title": "What's Your Goal?", "description": "How do you plan to use SYNAPSE?"},
    4: {"title": "Take It for a Spin", "description": "Try your first search query."},
    5: {"title": "You're All Set!", "description": "Your personalised feed is ready."},
}

VALID_INTERESTS = {
    'ai_ml', 'web_dev', 'security', 'cloud_devops', 'research',
    'data_science', 'open_source', 'startup', 'finance', 'health_bio',
}

VALID_USE_CASES = {'research', 'automation', 'learning', 'archiving', 'team'}


def _prefs_response(user: User, prefs: OnboardingPreferences) -> dict:
    """Serialise onboarding state for API response."""
    return {
        "is_onboarded": user.is_onboarded,
        "current_step": prefs.current_step,
        "total_steps": TOTAL_STEPS,
        "completed": prefs.completed,
        "interests": prefs.interests,
        "use_case": prefs.use_case,
        "step_config": STEP_CONFIG.get(prefs.current_step, {}),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def onboarding_status(request):
    """
    GET /api/v1/auth/onboarding/status/
    Returns the user's current onboarding state. Creates prefs record if missing.
    """
    user = request.user
    prefs, _ = OnboardingPreferences.objects.get_or_create(user=user)
    return Response(_prefs_response(user, prefs))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def onboarding_start(request):
    """
    POST /api/v1/auth/onboarding/start/
    Initialises (or resets) the onboarding preferences for the user.
    Returns step 1 config.
    """
    user = request.user
    prefs, created = OnboardingPreferences.objects.get_or_create(user=user)
    if not created and prefs.completed:
        # Already onboarded — return current state
        return Response(_prefs_response(user, prefs), status=status.HTTP_200_OK)

    prefs.current_step = 1
    prefs.save(update_fields=['current_step', 'updated_at'])
    logger.info("Onboarding started for user %s", user.email)
    return Response(_prefs_response(user, prefs), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def onboarding_complete_step(request, step: int):
    """
    POST /api/v1/auth/onboarding/steps/<step>/complete/
    Marks the given step as complete, saves any payload data, advances step counter.

    Step 2 payload: { "interests": ["ai_ml", "web_dev", ...] }
    Step 3 payload: { "use_case": "research" }
    Steps 1, 4, 5: no required payload.
    """
    user = request.user

    if step < 1 or step > TOTAL_STEPS:
        return Response(
            {"error": f"Invalid step. Must be between 1 and {TOTAL_STEPS}."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    prefs, _ = OnboardingPreferences.objects.get_or_create(user=user)

    # Save step-specific data
    update_fields = ['current_step', 'updated_at']

    if step == 2:
        interests = request.data.get('interests', [])
        if not isinstance(interests, list):
            return Response({"error": "interests must be a list."}, status=status.HTTP_400_BAD_REQUEST)
        invalid = set(interests) - VALID_INTERESTS
        if invalid:
            return Response(
                {"error": f"Invalid interests: {invalid}. Valid: {VALID_INTERESTS}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        prefs.interests = interests
        update_fields.append('interests')

    elif step == 3:
        use_case = request.data.get('use_case', '')
        if use_case and use_case not in VALID_USE_CASES:
            return Response(
                {"error": f"Invalid use_case. Valid options: {VALID_USE_CASES}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        prefs.use_case = use_case
        update_fields.append('use_case')

    # Advance step if this is the current step or an earlier one
    if step >= prefs.current_step:
        prefs.current_step = min(step + 1, TOTAL_STEPS)

    prefs.save(update_fields=update_fields)
    logger.info("User %s completed onboarding step %d", user.email, step)
    return Response(_prefs_response(user, prefs), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def onboarding_finish(request):
    """
    POST /api/v1/auth/onboarding/finish/
    Marks user as fully onboarded. Triggers welcome email.
    """
    user = request.user
    prefs, _ = OnboardingPreferences.objects.get_or_create(user=user)

    # Mark prefs as complete
    prefs.completed = True
    prefs.current_step = TOTAL_STEPS
    prefs.save(update_fields=['completed', 'current_step', 'updated_at'])

    # Mark user as onboarded
    user.is_onboarded = True
    user.onboarded_at = timezone.now()
    user.save(update_fields=['is_onboarded', 'onboarded_at'])

    # Send welcome email (non-blocking — fail silently)
    try:
        _send_welcome_email(user)
    except Exception as exc:
        logger.warning("Failed to send welcome email to %s: %s", user.email, exc)

    logger.info("Onboarding completed for user %s", user.email)
    return Response(
        {
            "message": "Onboarding complete! Welcome to SYNAPSE.",
            "is_onboarded": True,
            "onboarded_at": user.onboarded_at.isoformat(),
        },
        status=status.HTTP_200_OK,
    )


def _send_welcome_email(user: User) -> None:
    """Send a welcome email after onboarding completes."""
    from django.core.mail import send_mail
    from django.conf import settings

    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    interests_display = ", ".join(
        i.replace('_', ' ').title()
        for i in (getattr(user, 'onboarding_prefs', None) and user.onboarding_prefs.interests or [])
    ) or "various topics"

    send_mail(
        subject='🎉 Welcome to SYNAPSE — Your AI Research Hub',
        message=(
            f"Hi {user.first_name or user.username},\n\n"
            f"You've completed onboarding and your personalised feed is ready!\n\n"
            f"Your selected interests: {interests_display}\n\n"
            f"Here's what to explore next:\n"
            f"  🔍 Search: {frontend_url}/search\n"
            f"  🤖 AI Agents: {frontend_url}/agents\n"
            f"  ⚙️ Automations: {frontend_url}/automation\n"
            f"  📄 Documents: {frontend_url}/documents\n\n"
            f"— The SYNAPSE Team"
        ),
        html_message=(
            f"<div style='font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px'>"
            f"<h1 style='color:#4f46e5;margin-bottom:4px'>🎉 Welcome to SYNAPSE!</h1>"
            f"<p style='color:#64748b;margin-top:0'>Your AI research intelligence hub is ready.</p>"
            f"<p>Hi <strong>{user.first_name or user.username}</strong>,</p>"
            f"<p>Your personalised feed is live, tuned to: <strong>{interests_display}</strong>.</p>"
            f"<h3 style='color:#1e293b'>Explore what SYNAPSE can do:</h3>"
            f"<ul style='padding-left:20px;color:#334155;line-height:2'>"
            f"<li><a href='{frontend_url}/search' style='color:#4f46e5'>🔍 Smart Search</a> — semantic search across all indexed content</li>"
            f"<li><a href='{frontend_url}/agents' style='color:#4f46e5'>🤖 AI Agents</a> — autonomous research agents</li>"
            f"<li><a href='{frontend_url}/automation' style='color:#4f46e5'>⚙️ Automations</a> — schedule and automate workflows</li>"
            f"<li><a href='{frontend_url}/documents' style='color:#4f46e5'>📄 Documents</a> — AI-generated reports</li>"
            f"</ul>"
            f"<a href='{frontend_url}/home' style='display:inline-block;background:linear-gradient(135deg,#6366f1,#7c3aed);"
            f"color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:bold;margin-top:16px'>"
            f"Go to Dashboard →</a>"
            f"<p style='color:#94a3b8;font-size:12px;margin-top:32px'>— The SYNAPSE Team</p>"
            f"</div>"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )
