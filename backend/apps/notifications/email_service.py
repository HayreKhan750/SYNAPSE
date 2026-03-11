"""
SendGrid email service for SYNAPSE notifications.

Provides two delivery methods:
  1. Django's built-in email backend (smtp / console / filebased)
     — works out of the box, uses EMAIL_BACKEND setting
  2. SendGrid Python SDK (direct API call)
     — used when SENDGRID_API_KEY is set and SENDGRID_USE_SDK=True

Phase 4.2 implementation.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


# ── Plain Django send_mail (SMTP / console) ───────────────────────────────────

def send_notification_email(
    to_email: str,
    subject: str,
    message: str,
    html_message: str | None = None,
) -> bool:
    """
    Send a transactional notification email using Django's email backend.

    In development (EMAIL_BACKEND = console), the email is printed to stdout.
    In production, set EMAIL_BACKEND = smtp and configure SendGrid SMTP credentials.

    Args:
        to_email:     Recipient email address
        subject:      Email subject line
        message:      Plain-text body
        html_message: Optional HTML body (falls back to plain text)

    Returns:
        True if sent successfully, False on error
    """
    try:
        from_email = settings.DEFAULT_FROM_EMAIL
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[to_email],
            html_message=html_message or _build_html(subject, message),
            fail_silently=False,
        )
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send email to {to_email}: {exc}")
        return False


def send_workflow_completion_email(user, workflow_name: str, run_status: str, run_id: str) -> bool:
    """
    Send a workflow completion email notification.

    Args:
        user:          Django User instance
        workflow_name: Name of the completed workflow
        run_status:    'success' or 'failed'
        run_id:        UUID string of the WorkflowRun

    Returns:
        True if sent successfully
    """
    emoji = '✅' if run_status == 'success' else '❌'
    status_label = 'completed successfully' if run_status == 'success' else 'failed'

    subject = f"{emoji} Workflow '{workflow_name}' {status_label}"
    message = (
        f"Hi {user.first_name or user.email},\n\n"
        f"Your SYNAPSE workflow '{workflow_name}' has {status_label}.\n\n"
        f"Run ID: {run_id}\n"
        f"Status: {run_status.upper()}\n\n"
        f"Log in to SYNAPSE to view the full run history.\n\n"
        f"— The SYNAPSE Team"
    )
    html_message = _build_workflow_html(
        user=user,
        workflow_name=workflow_name,
        run_status=run_status,
        run_id=run_id,
        emoji=emoji,
        status_label=status_label,
    )
    return send_notification_email(user.email, subject, message, html_message)


def send_welcome_email(user) -> bool:
    """Send a welcome email to a newly registered user."""
    subject = "👋 Welcome to SYNAPSE!"
    message = (
        f"Hi {user.first_name or user.email},\n\n"
        f"Welcome to SYNAPSE — your AI-powered tech intelligence platform!\n\n"
        f"You can now:\n"
        f"  • Browse the tech feed\n"
        f"  • Explore arXiv research papers\n"
        f"  • Chat with the AI assistant\n"
        f"  • Set up automation workflows\n\n"
        f"Get started at https://synapse.ai\n\n"
        f"— The SYNAPSE Team"
    )
    return send_notification_email(user.email, subject, message)


# ── SendGrid SDK (optional, direct API) ──────────────────────────────────────

def send_via_sendgrid_sdk(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: str | None = None,
) -> bool:
    """
    Send email directly via the SendGrid Python SDK.

    Only used when:
      - sendgrid package is installed
      - SENDGRID_API_KEY is set in environment

    Falls back to Django's email backend on any error.

    Args:
        to_email:      Recipient email address
        subject:       Email subject line
        html_content:  HTML email body
        plain_content: Optional plain-text fallback

    Returns:
        True if sent successfully
    """
    api_key = getattr(settings, 'SENDGRID_API_KEY', '')
    if not api_key:
        logger.warning("SENDGRID_API_KEY not set — falling back to Django email backend")
        return send_notification_email(
            to_email, subject,
            plain_content or strip_tags(html_content),
            html_content
        )

    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content

        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        mail = Mail(
            from_email=Email(settings.DEFAULT_FROM_EMAIL),
            to_emails=To(to_email),
            subject=subject,
            html_content=Content('text/html', html_content),
        )
        if plain_content:
            mail.add_content(Content('text/plain', plain_content))

        response = sg.send(mail)
        success = 200 <= response.status_code < 300
        if success:
            logger.info(f"SendGrid SDK: email sent to {to_email} (status {response.status_code})")
        else:
            logger.error(f"SendGrid SDK: failed for {to_email} (status {response.status_code})")
        return success

    except ImportError:
        logger.warning("sendgrid package not installed — falling back to Django email backend")
        return send_notification_email(
            to_email, subject,
            plain_content or strip_tags(html_content),
            html_content
        )
    except Exception as exc:
        logger.error(f"SendGrid SDK error for {to_email}: {exc}")
        return False


# ── HTML templates (inline, no template files needed) ────────────────────────

def _build_html(subject: str, body: str) -> str:
    """Build a simple branded HTML email."""
    body_html = body.replace('\n', '<br>')
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{subject}</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#6366f1,#06b6d4);padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">⚡ SYNAPSE</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">
            AI-Powered Tech Intelligence
          </p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0;">
            {body_html}
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #334155;">
          <p style="margin:0;color:#475569;font-size:12px;">
            You received this email because you have a SYNAPSE account.<br>
            © 2026 SYNAPSE. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _build_workflow_html(
    user, workflow_name: str, run_status: str,
    run_id: str, emoji: str, status_label: str
) -> str:
    """Build a workflow completion HTML email."""
    color = '#22c55e' if run_status == 'success' else '#ef4444'
    bg = 'rgba(34,197,94,0.1)' if run_status == 'success' else 'rgba(239,68,68,0.1)'
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Workflow {status_label}</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#6366f1,#06b6d4);padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">⚡ SYNAPSE</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Automation Center</p>
        </td></tr>
        <!-- Status badge -->
        <tr><td style="padding:32px 32px 0;">
          <div style="background:{bg};border:1px solid {color};border-radius:8px;
                      padding:16px 20px;text-align:center;">
            <p style="margin:0;font-size:28px;">{emoji}</p>
            <p style="margin:8px 0 0;color:{color};font-size:16px;font-weight:600;">
              Workflow {status_label.title()}
            </p>
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:24px 32px;">
          <p style="color:#e2e8f0;font-size:15px;margin:0 0 16px;">
            Hi {user.first_name or user.email},
          </p>
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px;">
            Your workflow has finished executing. Here are the details:
          </p>
          <table width="100%" style="border-collapse:collapse;">
            <tr>
              <td style="color:#64748b;font-size:13px;padding:8px 0;border-bottom:1px solid #334155;
                         width:40%;">Workflow</td>
              <td style="color:#e2e8f0;font-size:13px;padding:8px 0;border-bottom:1px solid #334155;
                         font-weight:500;">{workflow_name}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:13px;padding:8px 0;border-bottom:1px solid #334155;">
                Status</td>
              <td style="color:{color};font-size:13px;padding:8px 0;border-bottom:1px solid #334155;
                         font-weight:600;">{run_status.upper()}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:13px;padding:8px 0;">Run ID</td>
              <td style="color:#94a3b8;font-size:12px;padding:8px 0;font-family:monospace;">
                {run_id}</td>
            </tr>
          </table>
        </td></tr>
        <!-- CTA -->
        <tr><td style="padding:0 32px 32px;">
          <a href="http://localhost:3000/automation"
             style="display:inline-block;background:linear-gradient(135deg,#6366f1,#06b6d4);
                    color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;
                    font-size:14px;font-weight:600;">
            View in Automation Center →
          </a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #334155;">
          <p style="margin:0;color:#475569;font-size:12px;">
            © 2026 SYNAPSE. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
