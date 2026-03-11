"""
Celery tasks for the Automation app.

Implements the workflow execution engine with support for the following action types:
  - collect_news       : trigger a scraping run
  - summarize_content  : trigger NLP summarization for pending articles
  - generate_pdf       : placeholder for Phase 5 document generation
  - send_email         : send notification email to workflow owner
  - upload_to_drive    : placeholder for Phase 6 Google Drive integration
"""
import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


# ── Action handlers ───────────────────────────────────────────────────────────

def _action_collect_news(params: dict) -> dict:
    """Trigger scraping tasks for specified sources."""
    from apps.core.tasks import (
        scrape_hackernews, scrape_github, scrape_arxiv, scrape_youtube,
    )

    sources = params.get('sources', ['hackernews', 'github', 'arxiv', 'youtube'])
    task_ids = {}

    if 'hackernews' in sources:
        t = scrape_hackernews.delay(
            story_type=params.get('story_type', 'top'),
            limit=params.get('limit', 50),
        )
        task_ids['hackernews'] = t.id

    if 'github' in sources:
        t = scrape_github.delay(
            days_back=params.get('days_back', 1),
            limit=params.get('limit', 50),
        )
        task_ids['github'] = t.id

    if 'arxiv' in sources:
        t = scrape_arxiv.delay(
            days_back=params.get('days_back', 7),
            max_papers=params.get('max_papers', 100),
        )
        task_ids['arxiv'] = t.id

    if 'youtube' in sources:
        t = scrape_youtube.delay(
            days_back=params.get('days_back', 30),
            max_results=params.get('max_results', 10),
        )
        task_ids['youtube'] = t.id

    return {'action': 'collect_news', 'status': 'queued', 'task_ids': task_ids}


def _action_summarize_content(params: dict) -> dict:
    """Trigger summarization for pending articles."""
    from apps.articles.tasks import summarize_pending_articles, process_pending_articles_nlp

    batch_size = params.get('batch_size', 20)
    nlp_task = process_pending_articles_nlp.delay(batch_size=batch_size)
    sum_task = summarize_pending_articles.delay(batch_size=batch_size)

    return {
        'action': 'summarize_content',
        'status': 'queued',
        'task_ids': {
            'nlp': nlp_task.id,
            'summarize': sum_task.id,
        },
    }


def _action_generate_pdf(params: dict) -> dict:
    """Placeholder for Phase 5 PDF generation."""
    logger.info("generate_pdf action — will be implemented in Phase 5.")
    return {
        'action': 'generate_pdf',
        'status': 'skipped',
        'reason': 'PDF generation is implemented in Phase 5.',
    }


def _action_send_email(workflow, params: dict) -> dict:
    """Create an in-app notification and queue a SendGrid email for the workflow owner."""
    try:
        from apps.notifications.models import Notification
        from apps.notifications.tasks import send_notification_email_task

        notif = Notification.objects.create(
            user=workflow.user,
            title=params.get('subject', f"Workflow '{workflow.name}' completed"),
            message=params.get(
                'body',
                f"Your workflow '{workflow.name}' has completed successfully."
            ),
            notif_type='workflow_complete',
            metadata={'workflow_id': str(workflow.id)},
        )
        # Queue email delivery asynchronously so it doesn't block the workflow
        send_notification_email_task.delay(str(notif.id))

        return {
            'action': 'send_email',
            'status': 'notification_created',
            'notification_id': str(notif.id),
        }
    except Exception as exc:
        logger.warning(f"send_email action failed: {exc}")
        return {'action': 'send_email', 'status': 'failed', 'error': str(exc)}


def _action_upload_to_drive(params: dict) -> dict:
    """Placeholder for Phase 6 Google Drive integration."""
    logger.info("upload_to_drive action — will be implemented in Phase 6.")
    return {
        'action': 'upload_to_drive',
        'status': 'skipped',
        'reason': 'Google Drive integration is implemented in Phase 6.',
    }


# ── Action dispatcher ─────────────────────────────────────────────────────────

ACTION_HANDLERS = {
    'collect_news':      _action_collect_news,
    'summarize_content': _action_summarize_content,
    'generate_pdf':      _action_generate_pdf,
    'upload_to_drive':   _action_upload_to_drive,
}


def _dispatch_action(workflow, action: dict) -> dict:
    """Dispatch a single action to its handler."""
    action_type = action.get('type', '')
    params = action.get('params', {})

    if action_type == 'send_email':
        return _action_send_email(workflow, params)

    handler = ACTION_HANDLERS.get(action_type)
    if handler:
        return handler(params)

    logger.warning(f"Unknown action type '{action_type}' in workflow {workflow.id}")
    return {'action': action_type, 'status': 'skipped', 'reason': 'Unknown action type'}


# ── Main execution task ───────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=2, name='apps.automation.tasks.execute_workflow')
def execute_workflow(self, workflow_id: str) -> dict:
    """
    Execute all actions defined in an AutomationWorkflow sequentially.

    Args:
        workflow_id: UUID string of the AutomationWorkflow to execute.

    Returns:
        dict with execution summary.
    """
    from .models import AutomationWorkflow, WorkflowRun

    task_id = self.request.id
    logger.info(f"[{task_id}] Executing workflow {workflow_id}")

    # Load workflow
    try:
        workflow = AutomationWorkflow.objects.get(id=workflow_id)
    except AutomationWorkflow.DoesNotExist:
        logger.error(f"[{task_id}] Workflow {workflow_id} not found.")
        return {'status': 'failed', 'error': 'Workflow not found'}

    # Guard: skip if not active
    if not workflow.is_active:
        logger.info(f"[{task_id}] Workflow {workflow_id} is inactive — skipping.")
        return {'status': 'skipped', 'reason': 'Workflow is not active'}

    # Create a WorkflowRun record
    run = WorkflowRun.objects.create(
        workflow=workflow,
        status=WorkflowRun.RunStatus.RUNNING,
    )

    # Update workflow status
    workflow.status = AutomationWorkflow.Status.ACTIVE
    workflow.save(update_fields=['status', 'updated_at'])

    action_results = []
    had_error = False

    try:
        for action in workflow.actions:
            action_type = action.get('type', 'unknown')
            logger.info(
                f"[{task_id}] Running action '{action_type}' "
                f"for workflow {workflow_id}"
            )
            try:
                result = _dispatch_action(workflow, action)
                action_results.append(result)
            except Exception as action_exc:
                logger.error(
                    f"[{task_id}] Action '{action_type}' failed: {action_exc}"
                )
                action_results.append({
                    'action': action_type,
                    'status': 'error',
                    'error': str(action_exc),
                })
                had_error = True

        # Finalize run
        run.status = WorkflowRun.RunStatus.FAILED if had_error else WorkflowRun.RunStatus.SUCCESS
        run.completed_at = timezone.now()
        run.result = {'actions': action_results}
        run.save(update_fields=['status', 'completed_at', 'result'])

        # Update workflow metadata
        now = timezone.now()
        workflow.last_run_at = now
        workflow.run_count = workflow.run_count + 1
        if had_error:
            workflow.status = AutomationWorkflow.Status.FAILED
        else:
            workflow.status = AutomationWorkflow.Status.ACTIVE
        workflow.save(update_fields=['last_run_at', 'run_count', 'status', 'updated_at'])

        logger.info(
            f"[{task_id}] Workflow {workflow_id} completed "
            f"({'with errors' if had_error else 'successfully'})"
        )
        return {
            'workflow_id': workflow_id,
            'run_id': str(run.id),
            'status': run.status,
            'actions': action_results,
        }

    except Exception as exc:
        logger.error(f"[{task_id}] Workflow {workflow_id} execution error: {exc}")
        run.status = WorkflowRun.RunStatus.FAILED
        run.completed_at = timezone.now()
        run.error_message = str(exc)
        run.save(update_fields=['status', 'completed_at', 'error_message'])

        workflow.status = AutomationWorkflow.Status.FAILED
        workflow.save(update_fields=['status', 'updated_at'])

        return self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@shared_task(name='apps.automation.tasks.cleanup_stale_runs')
def cleanup_stale_runs() -> dict:
    """
    Mark WorkflowRun records stuck in 'running' state for more than 1 hour as failed.
    This handles cases where a Celery worker crashed mid-execution.
    """
    from .models import WorkflowRun
    from datetime import timedelta

    cutoff = timezone.now() - timedelta(hours=1)
    stale = WorkflowRun.objects.filter(
        status=WorkflowRun.RunStatus.RUNNING,
        started_at__lt=cutoff,
    )
    count = stale.count()
    stale.update(
        status=WorkflowRun.RunStatus.FAILED,
        completed_at=timezone.now(),
        error_message='Run timed out — worker likely crashed.',
    )
    logger.info(f"cleanup_stale_runs: marked {count} stale runs as failed.")
    return {'cleaned_up': count}
