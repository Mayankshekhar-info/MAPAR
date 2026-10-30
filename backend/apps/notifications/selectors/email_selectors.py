from typing import Any, Dict, Optional
from django.db.models import Count, Q
from django.utils import timezone

from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord
from apps.notifications.services.reminder_scheduler_service import ReminderSchedulerService, SCHEDULE_SLOTS
from apps.governance.models import GovernanceActionPoint


def get_smtp_configuration_dto() -> Dict[str, Any]:
    """Retrieves the active SMTP configuration with password safely masked."""
    config_obj = EmailConfiguration.get_solo()
    settings = config_obj.get_effective_settings()

    return {
        "smtp_host": settings["host"],
        "smtp_port": settings["port"],
        "smtp_username": settings["username"],
        "has_password": settings["has_password"],
        "masked_password": "••••••••" if settings["has_password"] else "",
        "smtp_security": settings["security"],
        "from_email": settings["from_email"],
        "from_name": settings["from_name"],
        "is_enabled": settings["is_enabled"],
        "cc_addresses": settings["cc_addresses"],
        "frontend_base_url": settings["frontend_base_url"],
        "updated_at": config_obj.updated_at.isoformat() if config_obj.updated_at else None,
    }


def get_delivery_logs_queryset(
    status: Optional[str] = None,
    notification_type: Optional[str] = None,
    action_id: Optional[str] = None,
    search: Optional[str] = None,
):
    """Returns filtered queryset for email delivery audit logs."""
    qs = EmailDeliveryRecord.objects.all().order_by("-created_at")

    if status:
        qs = qs.filter(status=status)
    if notification_type:
        qs = qs.filter(notification_type=notification_type)
    if action_id:
        qs = qs.filter(action_id__icontains=action_id.strip())
    if search:
        s = search.strip()
        qs = qs.filter(
            Q(recipient_email__icontains=s)
            | Q(recipient_name__icontains=s)
            | Q(subject__icontains=s)
            | Q(action_id__icontains=s)
        )

    return qs


def get_schedule_overview_dto() -> Dict[str, Any]:
    """Provides real-time metrics for the automated reminder schedule and unclosed tasks."""
    current_ist = ReminderSchedulerService.get_current_ist_time()
    day_name = current_ist.strftime("%A")

    unclosed_tasks_count = (
        GovernanceActionPoint.objects.exclude(status=GovernanceActionPoint.Status.CLOSED)
        .filter(owner__isnull=False)
        .exclude(owner__email="")
        .count()
    )

    overdue_count = (
        GovernanceActionPoint.objects.exclude(status=GovernanceActionPoint.Status.CLOSED)
        .filter(owner__isnull=False)
        .exclude(owner__email="")
        .filter(current_target_date__lt=timezone.localdate())
        .count()
    )

    # Delivery stats for current week
    today = timezone.localdate()
    stats = EmailDeliveryRecord.objects.filter(
        created_at__date__gte=today - timezone.timedelta(days=7)
    ).aggregate(
        total_sent=Count("id", filter=Q(status=EmailDeliveryRecord.Status.SENT)),
        total_failed=Count("id", filter=Q(status=EmailDeliveryRecord.Status.FAILED)),
        total_retrying=Count("id", filter=Q(status=EmailDeliveryRecord.Status.RETRYING)),
    )

    matching_slot = ReminderSchedulerService.resolve_matching_slot(current_ist)

    return {
        "current_ist_time": current_ist.strftime("%Y-%m-%d %H:%M:%S IST"),
        "current_day": day_name,
        "is_within_permitted_window": ReminderSchedulerService.is_within_permitted_window(current_ist),
        "matching_slot": matching_slot,
        "schedule_matrix": ReminderSchedulerService.get_configured_schedule(),
        "eligible_unclosed_tasks": unclosed_tasks_count,
        "overdue_tasks": overdue_count,
        "past_7_days_sent": stats["total_sent"] or 0,
        "past_7_days_failed": stats["total_failed"] or 0,
        "past_7_days_retrying": stats["total_retrying"] or 0,
    }
