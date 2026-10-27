import logging
from typing import List, Optional, Tuple, Union
from django.utils import timezone
from apps.governance.models import GovernanceActionPoint
from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord
from apps.notifications.services.smtp_service import SMTPService
from apps.notifications.services.governance_email_builder import GovernanceEmailBuilder

logger = logging.getLogger("mapar.notifications")


class TaskAssignmentEmailService:
    """
    Handles immediate automated email notifications when one or more tasks are assigned or reassigned.
    Retrieves the recipient strictly from registered user account records.
    Constructs approved PGMS Governance & Action Tracker email layout.
    """

    @classmethod
    def send_assignment_email(
        cls,
        action_point: Union[GovernanceActionPoint, List[GovernanceActionPoint]],
        is_reassignment: bool = False,
    ) -> Tuple[bool, Optional[EmailDeliveryRecord]]:
        """
        Dispatches a detailed assignment alert email to the assigned owner.
        Supports single task or list of tasks assigned to the same user.
        Enforces idempotency, mandatory CC addresses, and database validation.
        """
        if isinstance(action_point, list):
            task_list = action_point
            primary_task = task_list[0] if task_list else None
        else:
            task_list = [action_point]
            primary_task = action_point

        if not primary_task or not primary_task.owner:
            logger.info(
                "Task %s has no registered user owner. Skipping assignment email.",
                getattr(primary_task, "action_id", "N/A"),
            )
            return False, None

        owner = primary_task.owner
        from apps.identity.models import User
        if not owner.is_active or owner.status not in (User.Status.ACTIVE, User.Status.INVITED):
            logger.warning(
                "Task %s owner '%s' is not active/eligible (status: %s). Skipping email alert.",
                primary_task.action_id,
                owner.username,
                owner.status,
            )
            return False, None

        recipient_email = (owner.email or "").strip().lower()
        if not recipient_email or "@" not in recipient_email:
            logger.warning(
                "Task %s owner '%s' does not have a verified email address. Skipping email alert.",
                primary_task.action_id,
                owner.username,
            )
            return False, None

        owner_name = GovernanceEmailBuilder.get_recipient_display_name(owner)

        prefix = "reassignment" if is_reassignment else "assignment"
        if len(task_list) == 1:
            idempotency_key = f"{prefix}:{primary_task.action_id}:{owner.id}"
            action_id_str = primary_task.action_id
        else:
            task_ids_str = "-".join(sorted(t.action_id for t in task_list))
            idempotency_key = f"{prefix}_bulk:{owner.id}:{task_ids_str}"
            action_id_str = ", ".join(t.action_id for t in task_list)[:255]

        # Base URL for secure direct task links (defaults to production PAGMS)
        config = EmailConfiguration.get_solo().get_effective_settings()
        base_url = (config.get("frontend_base_url") or "https://pagms.pratap.tech").rstrip("/")

        # Build approved PGMS Governance & Action Tracker email content
        email_type = "reassignment" if is_reassignment else "assignment"
        subject, html_content, plain_text = GovernanceEmailBuilder.build_email(
            recipient_name=owner_name,
            tasks=task_list,
            email_type=email_type,
            base_url=base_url,
        )

        notification_type = (
            EmailDeliveryRecord.NotificationType.TASK_REASSIGNMENT
            if is_reassignment
            else EmailDeliveryRecord.NotificationType.TASK_ASSIGNMENT
        )

        success, record = SMTPService.send_html_email(
            recipient_email=recipient_email,
            recipient_name=owner_name,
            subject=subject,
            plain_text=plain_text,
            html_content=html_content,
            notification_type=notification_type,
            action_point=primary_task,
            action_id=action_id_str,
            idempotency_key=idempotency_key,
        )

        return success, record
