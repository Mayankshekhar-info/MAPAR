
import time as time_module
import sys
from typing import Optional
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.notifications.services.reminder_scheduler_service import ReminderSchedulerService
from apps.notifications.selectors.email_selectors import get_schedule_overview_dto


class Command(BaseCommand):
    help = "Processes automated weekly scheduled email reminders for eligible unclosed governance & audit tasks."

    def add_arguments(self, parser):
        parser.add_argument(
            "--slot",
            type=str,
            default="",
            help="Specific slot to process (e.g. Friday:10:00, Saturday:09:00). If omitted, evaluates all due slots.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force sending even outside standard scheduled slots or permitted window.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate execution without sending actual emails or updating records.",
        )
        parser.add_argument(
            "--daemon",
            action="store_true",
            help="Run continuously as a background worker process, polling for due slots every interval.",
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=30,
            help="Polling interval in seconds when running in --daemon mode (default: 30).",
        )
        parser.add_argument(
            "--status",
            action="store_true",
            help="Display real-time schedule diagnostics, active matrix, and next scheduled execution time.",
        )

    def handle(self, *args, **options):
        slot = options["slot"].strip() or None
        force = options["force"]
        dry_run = options["dry_run"]
        is_daemon = options["daemon"]
        interval = max(5, options["interval"])
        show_status = options["status"]

        # 1. Status diagnostic mode
        if show_status:
            self._print_schedule_status()
            return

        # 2. Continuous daemon mode
        if is_daemon:
            self._run_daemon_loop(interval=interval, dry_run=dry_run)
            return

        # 3. Single execution mode
        self._execute_single_run(slot=slot, force=force, dry_run=dry_run)

    def _execute_single_run(self, slot: Optional[str], force: bool, dry_run: bool):
        current_ist = ReminderSchedulerService.get_current_ist_time()
        ist_str = current_ist.strftime("%Y-%m-%d %H:%M:%S IST")

        self.stdout.write(f"Initiating MAPAR Reminder Scheduler (slot={slot}, force={force}, dry_run={dry_run}, time={ist_str})...")

        # When a specific slot is requested, or when forced without a specific slot:
        if slot or force:
            result = ReminderSchedulerService.process_scheduled_reminders(
                target_slot=slot,
                force=force,
                dry_run=dry_run,
                trigger_source="cli",
            )
            if not result.get("success"):
                if result.get("already_completed"):
                    self.stdout.write(self.style.NOTICE(f"Slot '{result.get('slot')}' was already completed for this cycle."))
                else:
                    self.stdout.write(self.style.WARNING(f"Scheduler skipped: {result.get('reason')}"))
                return

            self.stdout.write(
                self.style.SUCCESS(
                    f"Reminder cycle completed for slot '{result.get('slot')}': "
                    f"{result.get('sent_count')} sent, "
                    f"{result.get('skipped_count')} skipped, "
                    f"{result.get('failed_count')} failed."
                )
            )
        else:
            # Autonomous due slot evaluation (standard minute cron or CLI invocation)
            result = ReminderSchedulerService.process_due_schedules(
                force=False,
                dry_run=dry_run,
                trigger_source="cli",
            )
            due_count = result.get("due_slots_count", 0)
            if due_count == 0:
                next_run_dt, next_slot = ReminderSchedulerService.calculate_next_scheduled_run(current_ist)
                next_info = f" Next scheduled run: {next_slot} ({next_run_dt.strftime('%Y-%m-%d %H:%M:%S IST')})" if next_run_dt else ""
                self.stdout.write(self.style.NOTICE(f"No scheduled reminder slots are currently due for execution at {ist_str}.{next_info}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"Successfully processed {due_count} due slot(s):"))
                for item in result.get("processed_slots", []):
                    s_label = item.get("slot")
                    s_res = item.get("result", {})
                    self.stdout.write(
                        f"  - Slot [{s_label}]: "
                        f"{s_res.get('sent_count', 0)} sent, "
                        f"{s_res.get('skipped_count', 0)} skipped, "
                        f"{s_res.get('failed_count', 0)} failed."
                    )

    def _run_daemon_loop(self, interval: int, dry_run: bool):
        self.stdout.write(
            self.style.SUCCESS(
                f"Starting MAPAR Automated Reminder Worker (polling every {interval}s, dry_run={dry_run})...\n"
                "Press Ctrl+C to terminate cleanly."
            )
        )
        try:
            while True:
                try:
                    res = ReminderSchedulerService.process_due_schedules(
                        dry_run=dry_run,
                        trigger_source="cli_daemon",
                    )
                    due_count = res.get("due_slots_count", 0)
                    if due_count > 0:
                        cur = ReminderSchedulerService.get_current_ist_time().strftime("%H:%M:%S IST")
                        self.stdout.write(self.style.SUCCESS(f"[{cur}] Processed {due_count} due slot(s): {res.get('processed_slots')}"))
                except Exception as loop_err:
                    self.stdout.write(self.style.ERROR(f"Error during schedule polling cycle: {loop_err}"))

                time_module.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write(self.style.NOTICE("\nReceived termination signal. Exiting reminder daemon cleanly."))

    def _print_schedule_status(self):
        dto = get_schedule_overview_dto()
        self.stdout.write(self.style.MIGRATE_HEADING("=== MAPAR / PAGMS Scheduled Email Automation Status ==="))
        self.stdout.write(f"Current IST Time         : {dto.get('current_ist_time')}")
        self.stdout.write(f"Current Day              : {dto.get('current_day')}")
        self.stdout.write(f"Permitted Window         : {'In Window (08:00 - 20:00 IST)' if dto.get('is_within_permitted_window') else 'Outside Sending Window'}")
        self.stdout.write(f"Matching Current Slot    : {dto.get('matching_slot') or 'None'}")
        self.stdout.write(f"Next Scheduled Execution : {dto.get('next_execution_slot')} at {dto.get('next_execution_time')}")
        self.stdout.write(f"Scheduler Status         : {dto.get('scheduler_status')}")
        self.stdout.write(f"Eligible Unclosed Tasks  : {dto.get('eligible_unclosed_tasks')}")
        self.stdout.write(f"Overdue Tasks            : {dto.get('overdue_tasks')}")
        self.stdout.write(f"Past 7 Days Sent         : {dto.get('past_7_days_sent')}")
        self.stdout.write(f"Past 7 Days Failed       : {dto.get('past_7_days_failed')}")

        matrix = dto.get("schedule_matrix", {})
        self.stdout.write("\nConfigured Weekly Matrix:")
        for day, times in matrix.items():
            t_str = ", ".join(times) if times else "(None)"
            self.stdout.write(f"  - {day:10s}: {t_str}")

        last_exec = dto.get("last_execution")
        if last_exec:
            self.stdout.write(f"\nLast Execution Record:")
            self.stdout.write(f"  - Slot Key   : {last_exec.get('slot_key')}")
            self.stdout.write(f"  - Status     : {last_exec.get('status')}")
            self.stdout.write(f"  - Started At : {last_exec.get('started_at')}")
            self.stdout.write(f"  - Completed  : {last_exec.get('completed_at')}")
            self.stdout.write(f"  - Sent Count : {last_exec.get('sent_count')}")
            self.stdout.write(f"  - Trigger    : {last_exec.get('triggered_by')}")
            if last_exec.get("error"):
                self.stdout.write(f"  - Error      : {last_exec.get('error')}")
        else:
            self.stdout.write(f"\nLast Execution Record: None recorded yet.")
