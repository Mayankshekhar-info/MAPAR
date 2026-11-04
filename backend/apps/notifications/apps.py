import sys
import os
import logging
from django.apps import AppConfig

logger = logging.getLogger("mapar.notifications")


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.notifications"

    def ready(self):
        """
        Initializes the in-process autonomous reminder scheduler daemon on application startup.
        Ensures scheduled reminder emails automatically trigger on time without manual intervention.
        Safely avoids starting during migrations, tests, or management commands.
        """
        # Allow explicit disable via environment variable if requested
        if os.environ.get("DISABLE_REMINDER_DAEMON", "").lower() in ("true", "1", "yes"):
            logger.info("Reminder scheduler daemon explicitly disabled via DISABLE_REMINDER_DAEMON.")
            return

        cmd = " ".join(sys.argv).lower()
        skip_commands = [
            "migrate",
            "makemigrations",
            "collectstatic",
            "test",
            "pytest",
            "check",
            "shell",
            "createsuperuser",
            "dumpdata",
            "loaddata",
            "inspectdb",
        ]
        if any(sc in cmd for sc in skip_commands):
            return

        try:
            from apps.notifications.services.scheduler_daemon import ScheduledReminderDaemon
            ScheduledReminderDaemon.start(poll_interval_seconds=30)
        except Exception as exc:
            logger.warning("Could not automatically initialize ScheduledReminderDaemon: %s", exc)
