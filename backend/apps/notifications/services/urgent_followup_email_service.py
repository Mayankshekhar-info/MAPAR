import logging
from typing import Any, Optional, Tuple
from django.utils import timezone
from apps.governance.models import GovernanceActionPoint
from apps.governance.services.governance_service import GovernanceService
from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord
from apps.notifications.services.smtp_service import SMTPService
from apps.notifications.services.governance_email_builder import GovernanceEmailBuilder
from apps.identity.models import User

logger = logging.getLogger("mapar.notifications")


class UrgentFollowUpEmailService:
    """
    Handles immediate, on-demand urgent task follow-up alert emails.
    Dispatches to verified task owner registered email address.
    Logs each attempt to EmailDeliveryRecord with initiating user tracking.
    """

    @classmethod
    def send_urgent_followup_email(
        cls,
        action_point: GovernanceActionPoint,
        triggered_by: Optional[User] = None,
        recipient_user: Optional[User] = None,
    ) -> Tuple[bool, str, Optional[EmailDeliveryRecord]]:
        """
        Sends an urgent follow-up task alert email to the action point's owner or a selected application user.
        Returns: (success: bool, message: str, record: Optional[EmailDeliveryRecord])
        """
        if triggered_by and getattr(triggered_by, "role", None) == User.Role.ACTION_OWNER:
            logger.warning(
                "Email sending is disabled for Audit & Action Tracker. Urgent follow-up request blocked (triggered_by=%s).",
                getattr(triggered_by, "username", "unknown"),
            )
            return False, "Email sending has been disabled for all Audit & Action Tracker users.", None

        if not action_point:
            return False, "Action point does not exist.", None

        # 1. Refresh latest details from database
        task = (
            GovernanceActionPoint.objects.filter(id=action_point.id)
            .select_related("owner", "circle", "department", "assigned_by", "created_by")
            .first()
        )
        if not task:
            return False, f"Action point #{action_point.id} not found in database.", None

        task.calculate_derived_fields()

        # 2. Identify the target recipient (either manually selected user or assigned task owner)
        if recipient_user:
            target_user = recipient_user
        else:
            owner = task.owner
            if not owner and task.owner_name_override:
                try:
                    owner = GovernanceService.resolve_user_identity(task.owner_name_override)
                except Exception:
                    owner = None

            if not owner:
                return (
                    False,
                    f"Action item '{task.action_id}' has no assigned owner. Please assign an owner or select a recipient user before sending an email alert.",
                    None,
                )
            target_user = owner

        recipient_email = (target_user.email or "").strip().lower()
        target_display = GovernanceEmailBuilder.get_recipient_display_name(target_user)
        if not target_user.is_active or target_user.status not in (User.Status.ACTIVE, User.Status.INVITED):
            return (
                False,
                f"Recipient '{target_display}' is not an active or eligible application user account.",
                None,
            )

        if not recipient_email or "@" not in recipient_email:
            return (
                False,
                f"Recipient '{target_display}' does not have a registered email address in MAPAR. Please update the user's profile.",
                None,
            )

        recipient_name = target_display

        # 3. Prevent duplicate accidental sends within a short window (15 seconds)
        # while allowing intentional repeat reminders later
        now = timezone.now()
        recent_cutoff = now - timezone.timedelta(seconds=15)
        recent_sent = EmailDeliveryRecord.objects.filter(
            action_id=task.action_id,
            recipient_email=recipient_email,
            notification_type=EmailDeliveryRecord.NotificationType.TASK_URGENT_FOLLOWUP,
            status=EmailDeliveryRecord.Status.SENT,
            sent_at__gte=recent_cutoff,
        ).first()

        if recent_sent:
            return (
                False,
                f"An urgent follow-up email for {task.action_id} was already sent to {recipient_email} just now. Please wait a few moments before sending another.",
                recent_sent,
            )

        # Unique idempotency key per dispatch
        idempotency_key = f"urgent_followup:{task.action_id}:{target_user.id}:{now.strftime('%Y%m%d%H%M%S%f')}"

        # 4. Resolve base url and initiator display name
        config = EmailConfiguration.get_solo().get_effective_settings()
        base_url = (config.get("frontend_base_url") or "https://pagms.pratap.tech").rstrip("/")
        initiator_name = (
            (triggered_by.get_full_name() or triggered_by.username)
            if triggered_by
            else None
        )

        # 5. Build approved PGMS Governance & Action Tracker email content
        subject, html_content, plain_text = GovernanceEmailBuilder.build_email(
            recipient_name=recipient_name,
            tasks=task,
            email_type="urgent_followup",
            base_url=base_url,
            initiator_name=initiator_name,
        )

        success, record = SMTPService.send_html_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=subject,
            plain_text=plain_text,
            html_content=html_content,
            notification_type=EmailDeliveryRecord.NotificationType.TASK_URGENT_FOLLOWUP,
            action_point=task,
            action_id=task.action_id,
            idempotency_key=idempotency_key,
            triggered_by=triggered_by,
        )

        if success:
            msg = f"Urgent follow-up alert successfully sent to {recipient_name} ({recipient_email})."
            return True, msg, record
        else:
            err = record.error_message if record else "SMTP delivery failed."
            return False, f"Failed to deliver email to {recipient_email}: {err}", record
