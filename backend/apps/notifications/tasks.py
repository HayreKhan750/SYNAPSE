"""
Celery tasks for the Notifications app.

Phase 4.2 — SendGrid email delivery tasks.
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    name='apps.notifications.tasks.send_notification_email_task',
)
def send_notification_email_task(
    self,
    notification_id: str,
) -> dict:
    """
    Send an email for a given Notification record.

    Looks up the Notification, builds the email content, and delivers
    it via the configured email backend (SendGrid SMTP or console).

    Args:
        notification_id: UUID string of the Notification to email.

    Returns:
        dict with status and notification_id.
    """
    from .models import Notification
    from .email_service import send_notification_email

    try:
        notification = Notification.objects.select_related('user').get(id=notification_id)
    except Notification.DoesNotExist:
        logger.error(f"Notification {notification_id} not found — cannot send email.")
        return {'status': 'failed', 'reason': 'Notification not found'}

    user = notification.user
    success = send_notification_email(
        to_email=user.email,
        subject=notification.title,
        message=notification.message,
    )

    if success:
        logger.info(f"Email sent for notification {notification_id} to {user.email}")
        return {'status': 'sent', 'notification_id': notification_id}
    else:
        logger.warning(f"Email delivery failed for notification {notification_id}")
        return self.retry(
            exc=Exception('Email delivery failed'),
            countdown=60 * (self.request.retries + 1),
        )


@shared_task(
    bind=True,
    max_retries=3,
    name='apps.notifications.tasks.send_workflow_completion_email_task',
)
def send_workflow_completion_email_task(
    self,
    user_id: str,
    workflow_name: str,
    run_status: str,
    run_id: str,
) -> dict:
    """
    Send a workflow completion email to a user.

    Decoupled from the workflow execution task so email delivery
    does not block or fail the workflow itself.

    Args:
        user_id:       UUID string of the User to notify.
        workflow_name: Name of the completed workflow.
        run_status:    'success' or 'failed'.
        run_id:        UUID string of the WorkflowRun.

    Returns:
        dict with status.
    """
    from apps.users.models import User
    from .email_service import send_workflow_completion_email

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found — cannot send workflow email.")
        return {'status': 'failed', 'reason': 'User not found'}

    success = send_workflow_completion_email(
        user=user,
        workflow_name=workflow_name,
        run_status=run_status,
        run_id=run_id,
    )

    if success:
        logger.info(f"Workflow completion email sent to {user.email}")
        return {'status': 'sent', 'user': user.email}
    else:
        return self.retry(
            exc=Exception('Workflow email delivery failed'),
            countdown=60 * (self.request.retries + 1),
        )
