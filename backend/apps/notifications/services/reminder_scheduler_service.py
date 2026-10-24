import logging
from datetime import datetime, time
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from django.utils import timezone
from apps.governance.models import GovernanceActionPoint, GovernanceWeeklyUpdate
from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord
from apps.notifications.services.smtp_service import SMTPService

logger = logging.getLogger("mapar.notifications")

IST_TZ = ZoneInfo("Asia/Kolkata")

# Exact recurring reminder schedule specification:
# Day: Friday (1), Saturday (3), Sunday (4)
# Permitted window: 08:00 to 20:00 IST
SCHEDULE_SLOTS = {
    "Friday": ["10:00"],
    "Saturday": ["09:00", "13:00", "17:00"],
    "Sunday": ["09:00", "12:00", "15:00", "18:00"],
}


class ReminderSchedulerService:
    """
    Evaluates and dispatches weekly recurring email reminders for all unclosed action points.
    Strictly follows the Asia/Kolkata Friday/Saturday/Sunday reminder matrix.
    Enforces atomic database state checks, closure respect, reassignment redirection, and idempotency.
    """

    @classmethod
    def get_current_ist_time(cls) -> datetime:
        """Returns the current time explicitly converted to Asia/Kolkata timezone."""
        return timezone.now().astimezone(IST_TZ)

    @classmethod
    def is_within_permitted_window(cls, dt: Optional[datetime] = None) -> bool:
        """Confirms that current IST time is strictly within the permitted 8:00 AM - 8:00 PM window."""
        current = dt or cls.get_current_ist_time()
        start = time(8, 0)
        end = time(20, 0)
        return start <= current.time() <= end

    @classmethod
    def resolve_matching_slot(
        cls,
        dt: Optional[datetime] = None,
        tolerance_minutes: int = 45,
    ) -> Optional[str]:
        """
        Determines if the specified IST datetime aligns with a configured reminder slot.
        Returns a canonical slot string like 'Friday:10:00', or None if outside scheduled slots.
        """
        current = dt or cls.get_current_ist_time()
        day_name = current.strftime("%A")

        if day_name not in SCHEDULE_SLOTS:
            return None

        configured_times = SCHEDULE_SLOTS[day_name]
        for slot_time_str in configured_times:
            hour, minute = map(int, slot_time_str.split(":"))
            slot_time = current.replace(hour=hour, minute=minute, second=0, microsecond=0)
            diff_seconds = abs((current - slot_time).total_seconds())
            if diff_seconds <= (tolerance_minutes * 60):
                return f"{day_name}:{slot_time_str}"

        return None

    @classmethod
    def get_eligible_unclosed_tasks(cls) -> List[GovernanceActionPoint]:
        """
        Retrieves all currently active tasks eligible for reminders:
        - Must not be Closed (Status != CLOSED)
        - Must have a linked registered user account owner with an active email address
        Note: 100% progress or evidence upload alone is NOT considered closed.
        """
        tasks = (
            GovernanceActionPoint.objects.exclude(status=GovernanceActionPoint.Status.CLOSED)
            .filter(owner__isnull=False)
            .exclude(owner__email="")
            .select_related("owner", "circle", "department", "assigned_by", "created_by")
            .prefetch_related("weekly_updates")
            .order_by("current_target_date", "id")
        )
        return list(tasks)

    @classmethod
    def process_scheduled_reminders(
        cls,
        target_slot: Optional[str] = None,
        force: bool = False,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """
        Primary execution entry point for the reminder scheduler.
        Called by Celery Beat periodic task or the Django management command.
        """
        current_ist = cls.get_current_ist_time()
        active_slot = target_slot or cls.resolve_matching_slot(current_ist)

        if not force:
            if not cls.is_within_permitted_window(current_ist):
                msg = f"Current IST time ({current_ist.strftime('%H:%M')}) is outside the permitted 8:00 AM - 8:00 PM IST window."
                logger.info(msg)
                return {"success": False, "reason": msg, "total_processed": 0}

            if not active_slot:
                msg = f"Current day ({current_ist.strftime('%A %H:%M IST')}) does not match any scheduled reminder slot."
                logger.info(msg)
                return {"success": False, "reason": msg, "total_processed": 0}

        effective_slot_label = active_slot or f"Manual_{current_ist.strftime('%A_%H:%M')}"
        iso_year, iso_week, _ = current_ist.isocalendar()
        slot_key = f"{iso_year}-W{iso_week:02d}:{effective_slot_label}"

        tasks = cls.get_eligible_unclosed_tasks()
        logger.info(
            "Executing reminder scheduler for slot '%s'. Found %d unclosed eligible tasks.",
            slot_key,
            len(tasks),
        )

        config = EmailConfiguration.get_solo().get_effective_settings()
        base_url = config.get("frontend_base_url", "http://localhost:5185")

        sent_count = 0
        skipped_count = 0
        failed_count = 0
        results_log = []

        for task in tasks:
            # 1. Re-query latest task state directly from database immediately before dispatch
            fresh_task = GovernanceActionPoint.objects.filter(id=task.id).select_related("owner").first()
            if not fresh_task:
                skipped_count += 1
                continue

            # 2. Rule: If task is closed, stop all future reminders
            if fresh_task.status == GovernanceActionPoint.Status.CLOSED:
                logger.info("Task %s is closed. Skipping reminder.", fresh_task.action_id)
                skipped_count += 1
                continue

            # 3. Rule: Current recipient must be the authorized assignee
            current_owner = fresh_task.owner
            if not current_owner or not current_owner.email:
                logger.info("Task %s has no valid owner email. Skipping.", fresh_task.action_id)
                skipped_count += 1
                continue

            recipient_email = current_owner.email.strip().lower()

            # 4. Rule: Unique idempotency key per task, owner, and reminder slot
            idempotency_key = f"reminder:{fresh_task.action_id}:{current_owner.id}:{slot_key}"

            # 5. Check if this specific reminder has already been successfully sent
            already_sent = EmailDeliveryRecord.objects.filter(
                idempotency_key=idempotency_key,
                status=EmailDeliveryRecord.Status.SENT,
            ).exists()

            if already_sent:
                logger.info("Reminder %s already delivered. Skipping.", idempotency_key)
                skipped_count += 1
                continue

            if dry_run:
                sent_count += 1
                results_log.append({
                    "action_id": fresh_task.action_id,
                    "recipient": recipient_email,
                    "status": "DRY_RUN",
                    "slot": slot_key,
                })
                continue

            # 6. Format reminder content from fresh saved database state
            success, record = cls._send_task_reminder(
                task=fresh_task,
                owner=current_owner,
                recipient_email=recipient_email,
                slot_key=slot_key,
                idempotency_key=idempotency_key,
                base_url=base_url,
            )

            if success:
                sent_count += 1
                results_log.append({
                    "action_id": fresh_task.action_id,
                    "recipient": recipient_email,
                    "status": "SENT",
                })
            else:
                failed_count += 1
                results_log.append({
                    "action_id": fresh_task.action_id,
                    "recipient": recipient_email,
                    "status": "FAILED",
                    "error": record.error_message if record else "Unknown failure",
                })

        return {
            "success": True,
            "slot": slot_key,
            "total_candidates": len(tasks),
            "sent_count": sent_count,
            "skipped_count": skipped_count,
            "failed_count": failed_count,
            "details": results_log[:100],
        }

    @classmethod
    def _send_task_reminder(
        cls,
        task: GovernanceActionPoint,
        owner: Any,
        recipient_email: str,
        slot_key: str,
        idempotency_key: str,
        base_url: str,
    ) -> Tuple[bool, Optional[EmailDeliveryRecord]]:
        """Constructs and delivers a single reminder email."""
        # Calculate derived fields (overdue, days remaining, etc.)
        task.calculate_derived_fields()

        owner_name = owner.get_full_name() or owner.username
        today = timezone.localdate()
        target_date = task.current_target_date or task.target_closure_date

        target_date_str = target_date.strftime("%d %b %Y") if target_date else "Not Specified"

        # Days overdue or days remaining
        is_overdue = task.is_overdue
        if target_date:
            days_diff = (target_date - today).days
            if is_overdue or days_diff < 0:
                timeline_badge = f"OVERDUE by {abs(days_diff)} day(s)"
                timeline_color = "#dc2626"
                timeline_status_label = f"Overdue by {abs(days_diff)} days"
            elif days_diff == 0:
                timeline_badge = "DUE TODAY"
                timeline_color = "#ea580c"
                timeline_status_label = "Due today"
            else:
                timeline_badge = f"{days_diff} days remaining"
                timeline_color = "#0284c7"
                timeline_status_label = f"{days_diff} days remaining"
        else:
            timeline_badge = "Target date pending"
            timeline_color = "#64748b"
            timeline_status_label = "Target date pending"

        # Latest progress update summary
        latest_update = (
            GovernanceWeeklyUpdate.objects.filter(action_point=task)
            .order_by("-submitted_at")
            .first()
        )

        last_update_date_str = "None recorded yet"
        last_progress_summary = "No weekly progress update submitted yet. Please log your progress."
        outstanding_steps = task.last_update.strip() or "Please update deliverables and submit progress in MAPAR."

        if latest_update:
            last_update_date_str = latest_update.submitted_at.strftime("%d %b %Y (%H:%M IST)")
            parts = []
            if latest_update.work_completed:
                parts.append(f"Work Completed: {latest_update.work_completed.strip()}")
            if latest_update.achievements:
                parts.append(f"Achievements: {latest_update.achievements.strip()}")
            if latest_update.blockers:
                parts.append(f"Blockers: {latest_update.blockers.strip()}")
            if latest_update.next_week_plan:
                parts.append(f"Next Steps: {latest_update.next_week_plan.strip()}")
            if parts:
                last_progress_summary = "\n".join(parts)
            if latest_update.next_week_plan:
                outstanding_steps = latest_update.next_week_plan.strip()

        task_url = f"{base_url}/governance/tasks/{task.id}"
        action_title_short = (task.action_point or "Task").replace("\n", " ").strip()[:65]

        # Subject line
        if is_overdue:
            subject = f"[MAPAR Reminder] OVERDUE Action Required — {task.action_id} — {action_title_short}"
        else:
            subject = f"[MAPAR Reminder] Action Required — {task.action_id} — {action_title_short}"

        plain_text = f"""Hello {owner_name},

This is an automated reminder regarding your assigned governance action point.

ACTION REQUIRED:
--------------------------------------------------
Action ID:              {task.action_id}
Task Title:             {task.action_point}
Status:                 {task.status}
Reported Progress:      {task.current_progress_percent}%
Target Closure Date:    {target_date_str} ({timeline_status_label})
Evidence Status:        {task.evidence_status}

LATEST PROGRESS UPDATE:
Date: {last_update_date_str}
{last_progress_summary}

OUTSTANDING NEXT STEPS:
{outstanding_steps}

UPDATE PROGRESS IN MAPAR:
{task_url}

Please submit your weekly progress update and upload any required evidence.
"""

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; padding: 24px; margin: 0; }}
    .container {{ max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1; overflow: hidden; }}
    .header {{ background: #0f172a; padding: 22px 24px; color: #ffffff; }}
    .header h1 {{ margin: 0; font-size: 18px; font-weight: 600; }}
    .header p {{ margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; }}
    .body {{ padding: 24px; font-size: 14px; line-height: 1.6; }}
    .status-banner {{ padding: 12px 16px; border-radius: 6px; margin: 16px 0; font-weight: 600; font-size: 13px; }}
    .task-hero {{ background: #f8fafc; border-left: 4px solid {timeline_color}; padding: 14px 18px; margin: 14px 0 18px 0; border-radius: 0 6px 6px 0; }}
    .action-id {{ font-size: 12px; font-weight: 700; color: #2563eb; text-transform: uppercase; }}
    .task-title {{ font-size: 16px; font-weight: 600; color: #0f172a; margin-top: 4px; }}
    .progress-bar-bg {{ background: #e2e8f0; border-radius: 6px; height: 10px; width: 100%; overflow: hidden; margin-top: 6px; }}
    .progress-bar-fill {{ background: #2563eb; height: 100%; }}
    .grid-table {{ width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }}
    .grid-table td {{ padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }}
    .grid-table td.label {{ color: #64748b; font-weight: 600; width: 34%; }}
    .grid-table td.val {{ color: #0f172a; font-weight: 500; }}
    .section-title {{ font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 20px; margin-bottom: 6px; }}
    .section-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; font-size: 13px; color: #334155; white-space: pre-line; }}
    .button-container {{ text-align: center; margin: 26px 0 14px 0; }}
    .btn {{ display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; text-decoration: none; }}
    .footer {{ background: #f8fafc; padding: 18px 24px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MAPAR &bull; Governance & Action Tracking</h1>
      <p>Scheduled Action Point Reminder</p>
    </div>
    <div class="body">
      <p>Hello <strong>{owner_name}</strong>,</p>
      <p>This is a scheduled reminder regarding your pending action item. Please review progress and ensure deliverables are on track.</p>

      <div class="status-banner" style="background: {'#fee2e2' if is_overdue else '#e0f2fe'}; color: {timeline_color};">
        {timeline_badge} &bull; Target Closure Date: {target_date_str}
      </div>

      <div class="task-hero">
        <div class="action-id">{task.action_id}</div>
        <div class="task-title">{task.action_point}</div>
      </div>

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #475569;">
          <span>Current Progress</span>
          <span>{task.current_progress_percent}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: {min(100, task.current_progress_percent)}%;"></div>
        </div>
      </div>

      <table class="grid-table">
        <tr>
          <td class="label">Current Status:</td>
          <td class="val"><strong>{task.status}</strong></td>
        </tr>
        <tr>
          <td class="label">Priority:</td>
          <td class="val">{task.priority}</td>
        </tr>
        <tr>
          <td class="label">Evidence Review:</td>
          <td class="val">{task.evidence_status}</td>
        </tr>
        <tr>
          <td class="label">Last Progress Update:</td>
          <td class="val">{last_update_date_str}</td>
        </tr>
      </table>

      <div class="section-title">Latest Progress Summary</div>
      <div class="section-box">{last_progress_summary}</div>

      <div class="section-title">Outstanding Next Steps</div>
      <div class="section-box">{outstanding_steps}</div>

      <div class="button-container">
        <a href="{task_url}" class="btn">Update Weekly Progress in MAPAR &rarr;</a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        Direct link: <a href="{task_url}" style="color: #2563eb;">{task_url}</a>
      </p>
    </div>
    <div class="footer">
      Scheduled reminder matrix: Friday 10:00 AM IST &bull; Saturday 9:00 AM, 1:00 PM, 5:00 PM IST &bull; Sunday 9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM IST.<br>
      Mandatory CC: abhay@pratap.co.in, shakti.singh@pratap.co.in
    </div>
  </div>
</body>
</html>"""

        return SMTPService.send_html_email(
            recipient_email=recipient_email,
            recipient_name=owner_name,
            subject=subject,
            plain_text=plain_text,
            html_content=html_content,
            notification_type=EmailDeliveryRecord.NotificationType.TASK_REMINDER,
            action_point=task,
            action_id=task.action_id,
            scheduled_slot=slot_key,
            idempotency_key=idempotency_key,
        )
