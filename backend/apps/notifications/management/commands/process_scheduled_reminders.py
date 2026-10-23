from django.core.management.base import BaseCommand
from apps.notifications.services.reminder_scheduler_service import ReminderSchedulerService


class Command(BaseCommand):
    help = "Processes weekly scheduled email reminders for eligible unclosed governance & audit tasks."

    def add_arguments(self, parser):
        parser.add_argument(
            "--slot",
            type=str,
            default="",
            help="Specific slot to process (e.g. Friday:10:00, Saturday:09:00). Default auto-resolves from current IST time.",
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

    def handle(self, *args, **options):
        slot = options["slot"].strip() or None
        force = options["force"]
        dry_run = options["dry_run"]

        self.stdout.write(f"Initiating MAPAR Reminder Scheduler (slot={slot}, force={force}, dry_run={dry_run})...")

        result = ReminderSchedulerService.process_scheduled_reminders(
            target_slot=slot,
            force=force,
            dry_run=dry_run,
        )

        if not result.get("success"):
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
