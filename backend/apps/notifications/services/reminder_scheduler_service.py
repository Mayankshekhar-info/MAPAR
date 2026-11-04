import logging
from datetime import datetime, time
from typing import Any, Dict, List, Optional, Tuple, Union
from zoneinfo import ZoneInfo

from django.db import IntegrityError, transaction
from django.utils import timezone
from apps.identity.models import User
from apps.governance.models import GovernanceActionPoint
from apps.notifications.models import (
    EmailConfiguration,
    EmailDeliveryRecord,
    ScheduledSlotExecution,
)
from apps.notifications.services.smtp_service import SMTPService
from apps.notifications.services.governance_email_builder import GovernanceEmailBuilder

logger = logging.getLogger("mapar.notifications")

IST_TZ = ZoneInfo("Asia/Kolkata")

# Fallback recurring reminder schedule specification:
DEFAULT_SCHEDULE_SLOTS = EmailConfiguration.DEFAULT_REMINDER_SCHEDULE
SCHEDULE_SLOTS = DEFAULT_SCHEDULE_SLOTS


class ReminderSchedulerService:
    """
    Evaluates and dispatches weekly recurring email reminders for all unclosed action points.
    Strictly follows the Asia/Kolkata scheduled reminder matrix.
    Enforces atomic database state checks, closure respect, reassignment redirection, and idempotency.
    Uses approved PGMS Governance & Action Tracker email templates.
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
    def get_configured_schedule(cls) -> Dict[str, List[str]]:
        """Dynamically retrieves the configured weekly reminder schedule from EmailConfiguration."""
        try:
            config = EmailConfiguration.get_solo()
            return config.get_reminder_schedule()
        except Exception as exc:
            logger.warning("Failed to fetch dynamic reminder schedule, falling back to default: %s", exc)
            return EmailConfiguration.DEFAULT_REMINDER_SCHEDULE

    @classmethod
    def get_all_slot_labels(cls) -> List[str]:
        """Returns all currently configured slots as Day:HH:MM labels (e.g. ['Friday:10:00', ...])."""
        schedule = cls.get_configured_schedule()
        slots = []
        for day, times in schedule.items():
            if isinstance(times, list):
                for t in times:
                    slots.append(f"{day}:{t}")
        return slots

    @classmethod
    def update_weekly_schedule(cls, schedule_data: Dict[str, List[str]]) -> Dict[str, List[str]]:
        """
        Persists the updated weekly reminder schedule to EmailConfiguration singleton.
        Ensures persistence across server restarts and eliminates outdated scheduled slots.
        """
        with transaction.atomic():
            config = EmailConfiguration.get_solo()
            config.reminder_schedule = schedule_data
            config.save(update_fields=["reminder_schedule", "updated_at"])
            logger.info("Successfully saved updated weekly reminder schedule: %s", schedule_data)
            return config.get_reminder_schedule()

    @classmethod
    def calculate_next_scheduled_run(
        cls,
        dt: Optional[datetime] = None,
    ) -> Tuple[Optional[datetime], Optional[str]]:
        """
        Chronologically scans ahead to find the very next upcoming scheduled reminder slot in Asia/Kolkata timezone.
        Returns: (next_run_datetime, next_slot_label) e.g. (2026-11-06 10:00:00+05:30, 'Friday:10:00')
        """
        current_ist = dt or cls.get_current_ist_time()
        schedule = cls.get_configured_schedule()
        if not schedule:
            return None, None

        candidates: List[Tuple[datetime, str]] = []
        # Check from today across the next 8 days to guarantee finding the upcoming occurrence
        for day_offset in range(8):
            check_date = current_ist.date() + timezone.timedelta(days=day_offset)
            day_name = check_date.strftime("%A")
            times = schedule.get(day_name, [])
            if not isinstance(times, list):
                continue

            for t_str in times:
                try:
                    parts = t_str.split(":")
                    hour, minute = int(parts[0]), int(parts[1])
                    slot_dt = datetime.combine(check_date, time(hour, minute), tzinfo=IST_TZ)
                    if slot_dt > current_ist:
                        candidates.append((slot_dt, f"{day_name}:{t_str}"))
                except Exception:
                    continue

        if not candidates:
            return None, None

        candidates.sort(key=lambda x: x[0])
        return candidates[0]

    @classmethod
    def get_due_slots(
        cls,
        dt: Optional[datetime] = None,
        grace_minutes: int = 60,
    ) -> List[Dict[str, Any]]:
        """
        Calculates all configured slots that are due for execution at the given IST time.
        Rules:
        - Never executes before configured slot time (current_time >= slot_time).
        - Strictly within permitted 8 AM - 8 PM IST window.
        - Checks ScheduledSlotExecution to ensure slot has not already completed.
        - Allows up to grace_minutes after slot_time for delayed workers or server restarts.
        """
        current_ist = dt or cls.get_current_ist_time()
        if not cls.is_within_permitted_window(current_ist):
            return []

        day_name = current_ist.strftime("%A")
        schedule = cls.get_configured_schedule()
        if day_name not in schedule:
            return []

        configured_times = schedule.get(day_name, [])
        iso_year, iso_week, _ = current_ist.isocalendar()
        due_slots = []

        for slot_time_str in configured_times:
            try:
                parts = slot_time_str.split(":")
                hour, minute = int(parts[0]), int(parts[1])
                slot_time = current_ist.replace(hour=hour, minute=minute, second=0, microsecond=0)
                # Slot has arrived and is not in the future
                if current_ist >= slot_time:
                    diff_seconds = (current_ist - slot_time).total_seconds()
                    if diff_seconds <= (grace_minutes * 60):
                        slot_label = f"{day_name}:{slot_time_str}"
                        slot_key = f"{iso_year}-W{iso_week:02d}:{slot_label}"
                        # Check if already completed or actively locked
                        is_completed = ScheduledSlotExecution.objects.filter(
                            slot_key=slot_key,
                            status=ScheduledSlotExecution.Status.COMPLETED,
                        ).exists()
                        if not is_completed:
                            due_slots.append({
                                "slot_label": slot_label,
                                "slot_key": slot_key,
                                "slot_time": slot_time,
                                "elapsed_seconds": diff_seconds,
                            })
            except Exception as exc:
                logger.error("Error evaluating slot %s on %s: %s", slot_time_str, day_name, exc)
                continue

        return due_slots

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

        schedule = cls.get_configured_schedule()
        if day_name not in schedule:
            return None

        configured_times = schedule.get(day_name, [])
        for slot_time_str in configured_times:
            try:
                hour, minute = map(int, slot_time_str.split(":"))
                slot_time = current.replace(hour=hour, minute=minute, second=0, microsecond=0)
                diff_seconds = abs((current - slot_time).total_seconds())
                if diff_seconds <= (tolerance_minutes * 60):
                    return f"{day_name}:{slot_time_str}"
            except Exception:
                continue

        return None

    @classmethod
    def process_due_schedules(
        cls,
        current_dt: Optional[datetime] = None,
        force: bool = False,
        dry_run: bool = False,
        trigger_source: str = "auto",
    ) -> Dict[str, Any]:
        """
        Autonomous evaluator called by the daemon, Celery Beat, or system cron.
        Finds all currently due slots and processes them atomically.
        """
        due_slots = cls.get_due_slots(current_dt)
        if not due_slots:
            return {
                "success": True,
                "due_slots_count": 0,
                "processed_slots": [],
                "message": "No scheduled reminder slots are currently due for execution.",
            }

        processed = []
        for due in due_slots:
            slot_label = due["slot_label"]
            logger.info("Executing due scheduled slot: %s (trigger=%s)...", slot_label, trigger_source)
            res = cls.process_scheduled_reminders(
                target_slot=slot_label,
                force=force,
                dry_run=dry_run,
                trigger_source=trigger_source,
            )
            processed.append({
                "slot": slot_label,
                "result": res,
            })

        return {
            "success": True,
            "due_slots_count": len(due_slots),
            "processed_slots": processed,
        }

    @classmethod
    def get_eligible_unclosed_tasks(cls) -> List[GovernanceActionPoint]:
        """
        Retrieves all currently active tasks eligible for reminders:
        - Must not be Closed (Status != CLOSED)
        - Must have a linked registered, active, eligible user account owner with an active email address
        Note: 100% progress or evidence upload alone is NOT considered closed.
        """
        tasks = (
            GovernanceActionPoint.objects.exclude(status=GovernanceActionPoint.Status.CLOSED)
            .filter(
                owner__isnull=False,
                owner__is_active=True,
                owner__status__in=[User.Status.ACTIVE, User.Status.INVITED],
            )
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
        trigger_source: str = "manual",
        execution_record: Optional[ScheduledSlotExecution] = None,
    ) -> Dict[str, Any]:
        """
        Primary execution entry point for the reminder scheduler.
        Groups unclosed eligible tasks by assigned owner so users receive consolidated notifications.
        Enforces atomic slot locking and idempotency across multi-process workers.
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

            # Enforce that active_slot is currently configured in the active weekly schedule
            all_slots = cls.get_all_slot_labels()
            if active_slot not in all_slots:
                msg = f"Slot '{active_slot}' is no longer active in the configured reminder schedule."
                logger.info(msg)
                return {"success": False, "reason": msg, "total_processed": 0}

        effective_slot_label = active_slot or f"Manual_{current_ist.strftime('%A_%H:%M')}"
        iso_year, iso_week, _ = current_ist.isocalendar()
        slot_key = f"{iso_year}-W{iso_week:02d}:{effective_slot_label}"

        # Atomic Distributed Concurrency Lock using ScheduledSlotExecution
        slot_execution = execution_record
        if not dry_run and not slot_execution:
            try:
                with transaction.atomic():
                    slot_execution = ScheduledSlotExecution.objects.create(
                        slot_key=slot_key,
                        status=ScheduledSlotExecution.Status.PROCESSING,
                        triggered_by=trigger_source,
                    )
            except IntegrityError:
                # Slot has already been claimed or executed by another concurrent worker / daemon
                existing = ScheduledSlotExecution.objects.filter(slot_key=slot_key).first()
                if existing and existing.status == ScheduledSlotExecution.Status.COMPLETED and not force:
                    msg = f"Slot '{slot_key}' has already been successfully executed for this cycle."
                    logger.info(msg)
                    return {
                        "success": True,
                        "slot": slot_key,
                        "already_completed": True,
                        "reason": msg,
                        "sent_count": existing.sent_count,
                    }
                elif existing and existing.status == ScheduledSlotExecution.Status.PROCESSING and not force:
                    # Check if stuck for more than 15 minutes
                    age_seconds = (timezone.now() - existing.started_at).total_seconds()
                    if age_seconds < 900:
                        msg = f"Slot '{slot_key}' is actively being processed by another worker."
                        logger.info(msg)
                        return {
                            "success": False,
                            "slot": slot_key,
                            "in_progress": True,
                            "reason": msg,
                            "sent_count": 0,
                        }
                    else:
                        slot_execution = existing
                        slot_execution.started_at = timezone.now()
                        slot_execution.status = ScheduledSlotExecution.Status.PROCESSING
                        slot_execution.save(update_fields=["started_at", "status"])
                else:
                    slot_execution = existing

        tasks = cls.get_eligible_unclosed_tasks()
        logger.info(
            "Executing reminder scheduler for slot '%s'. Found %d unclosed eligible tasks.",
            slot_key,
            len(tasks),
        )

        config = EmailConfiguration.get_solo().get_effective_settings()
        base_url = (config.get("frontend_base_url") or "https://pagms.pratap.tech").rstrip("/")

        sent_count = 0
        skipped_count = 0
        failed_count = 0
        results_log = []

        # Group fresh tasks by owner so each recipient receives a consolidated email containing all their assigned tasks
        owner_tasks_map: Dict[int, Dict[str, Any]] = {}
        for task in tasks:
            fresh_task = (
                GovernanceActionPoint.objects.filter(id=task.id)
                .select_related("owner", "circle", "department", "assigned_by", "created_by")
                .first()
            )
            if not fresh_task:
                skipped_count += 1
                continue

            if fresh_task.status == GovernanceActionPoint.Status.CLOSED:
                logger.info("Task %s is closed. Skipping reminder.", fresh_task.action_id)
                skipped_count += 1
                continue

            current_owner = fresh_task.owner
            if not current_owner or not current_owner.email:
                logger.info("Task %s has no valid owner email. Skipping.", fresh_task.action_id)
                skipped_count += 1
                continue

            if current_owner.id not in owner_tasks_map:
                owner_tasks_map[current_owner.id] = {
                    "owner": current_owner,
                    "tasks": [],
                }
            owner_tasks_map[current_owner.id]["tasks"].append(fresh_task)

        for owner_id, group in owner_tasks_map.items():
            current_owner = group["owner"]
            owner_tasks = group["tasks"]
            recipient_email = current_owner.email.strip().lower()

            if len(owner_tasks) == 1:
                idempotency_key = f"reminder:{owner_tasks[0].action_id}:{current_owner.id}:{slot_key}"
                action_id_log = owner_tasks[0].action_id
            else:
                task_ids_str = "-".join(sorted(t.action_id for t in owner_tasks))
                idempotency_key = f"reminder_digest:{current_owner.id}:{task_ids_str}:{slot_key}"
                action_id_log = ", ".join(t.action_id for t in owner_tasks)

            already_sent = EmailDeliveryRecord.objects.filter(
                idempotency_key=idempotency_key,
                status=EmailDeliveryRecord.Status.SENT,
            ).exists()

            if already_sent:
                logger.info("Reminder %s already delivered. Skipping.", idempotency_key)
                skipped_count += len(owner_tasks)
                continue

            if dry_run:
                sent_count += 1
                results_log.append({
                    "action_id": action_id_log,
                    "recipient": recipient_email,
                    "status": "DRY_RUN",
                    "slot": slot_key,
                    "tasks_count": len(owner_tasks),
                })
                continue

            success, record = cls._send_task_reminder(
                tasks=owner_tasks,
                owner=current_owner,
                recipient_email=recipient_email,
                slot_key=slot_key,
                idempotency_key=idempotency_key,
                base_url=base_url,
            )

            if success:
                sent_count += 1
                results_log.append({
                    "action_id": action_id_log,
                    "recipient": recipient_email,
                    "status": "SENT",
                    "tasks_count": len(owner_tasks),
                })
            else:
                failed_count += 1
                results_log.append({
                    "action_id": action_id_log,
                    "recipient": recipient_email,
                    "status": "FAILED",
                    "error": record.error_message if record else "Unknown failure",
                    "tasks_count": len(owner_tasks),
                })

        # Update slot execution record upon completion
        if slot_execution and not dry_run:
            slot_execution.completed_at = timezone.now()
            slot_execution.sent_count = sent_count
            slot_execution.skipped_count = skipped_count
            slot_execution.failed_count = failed_count
            slot_execution.status = (
                ScheduledSlotExecution.Status.COMPLETED
                if failed_count == 0
                else ScheduledSlotExecution.Status.FAILED
            )
            slot_execution.save(update_fields=[
                "completed_at",
                "sent_count",
                "skipped_count",
                "failed_count",
                "status",
            ])

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
        tasks: Optional[Union[GovernanceActionPoint, List[GovernanceActionPoint]]] = None,
        owner: Any = None,
        recipient_email: str = "",
        slot_key: str = "",
        idempotency_key: str = "",
        base_url: str = "",
        task: Optional[GovernanceActionPoint] = None,
    ) -> Tuple[bool, Optional[EmailDeliveryRecord]]:
        """Constructs and delivers an approved PGMS reminder email for single or multiple tasks."""
        resolved = tasks if tasks is not None else task
        if isinstance(resolved, GovernanceActionPoint):
            task_list = [resolved]
        elif resolved:
            task_list = list(resolved)
        else:
            task_list = []

        if not task_list or not owner or not owner.is_active or owner.status not in (User.Status.ACTIVE, User.Status.INVITED):
            return False, None

        owner_name = GovernanceEmailBuilder.get_recipient_display_name(owner)
        config = EmailConfiguration.get_solo().get_effective_settings()
        effective_base_url = (base_url or config.get("frontend_base_url") or "https://pagms.pratap.tech").rstrip("/")

        subject, html_content, plain_text = GovernanceEmailBuilder.build_email(
            recipient_name=owner_name,
            tasks=task_list,
            email_type="reminder",
            base_url=effective_base_url,
        )

        primary_task = task_list[0]
        action_id_str = (
            primary_task.action_id
            if len(task_list) == 1
            else ", ".join(t.action_id for t in task_list)[:255]
        )

        return SMTPService.send_html_email(
            recipient_email=recipient_email,
            recipient_name=owner_name,
            subject=subject,
            plain_text=plain_text,
            html_content=html_content,
            notification_type=EmailDeliveryRecord.NotificationType.TASK_REMINDER,
            action_point=primary_task,
            action_id=action_id_str,
            scheduled_slot=slot_key,
            idempotency_key=idempotency_key,
        )
