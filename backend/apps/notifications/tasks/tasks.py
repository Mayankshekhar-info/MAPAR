import logging
from celery import shared_task
from django.db import transaction

logger = logging.getLogger("mapar.notifications")


@shared_task(
    name="apps.notifications.tasks.send_task_assignment_email_async",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    ignore_result=True,
)
def send_task_assignment_email_async(self, action_point_id: int, is_reassignment: bool = False):
    """
    Asynchronously delivers the task assignment or reassignment alert.
    Executes after the database transaction has committed.
    """
    from apps.governance.models import GovernanceActionPoint
    from apps.notifications.services.task_assignment_email_service import TaskAssignmentEmailService

    try:
        action_point = (
            GovernanceActionPoint.objects.select_related("owner", "circle", "department", "assigned_by")
            .filter(id=action_point_id)
            .first()
        )
        if not action_point:
            logger.warning("Task ID %s not found. Skipping assignment email.", action_point_id)
            return

        success, record = TaskAssignmentEmailService.send_assignment_email(
            action_point=action_point,
            is_reassignment=is_reassignment,
        )

        if not success and record and record.status == record.Status.RETRYING:
            raise Exception(record.error_message or "Temporary SMTP error during assignment alert dispatch.")

    except Exception as exc:
        logger.error("Exception in send_task_assignment_email_async for task %s: %s", action_point_id, exc)
        raise self.retry(exc=exc)


@shared_task(
    name="apps.notifications.tasks.process_scheduled_reminders_task",
    ignore_result=True,
)
def process_scheduled_reminders_task(target_slot: str = "", force: bool = False):
    """
    Periodic Celery Beat task that evaluates and dispatches unclosed task reminders
    according to the Asia/Kolkata Friday/Saturday/Sunday matrix.
    """
    from apps.notifications.services.reminder_scheduler_service import ReminderSchedulerService

    slot = target_slot.strip() or None
    logger.info("Executing scheduled reminder background cycle (slot=%s, force=%s)...", slot, force)
    result = ReminderSchedulerService.process_scheduled_reminders(target_slot=slot, force=force)
    logger.info("Reminder background cycle finished: %s", result)
    return result
