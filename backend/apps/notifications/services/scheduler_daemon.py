import logging
import threading
import atexit
from typing import Optional

logger = logging.getLogger("mapar.notifications.daemon")


class ScheduledReminderDaemon:
    """
    In-process autonomous scheduler daemon.
    Runs as a robust, non-blocking background thread within the Django application process.
    Guarantees that scheduled reminder emails execute automatically at their configured date and time
    without requiring manual intervention or separate external daemon processes.
    Coordinates safely with Celery Beat and multi-process deployments via database-level atomic locking.
    """

    _thread: Optional[threading.Thread] = None
    _stop_event = threading.Event()
    _lock = threading.Lock()
    _is_running = False

    @classmethod
    def is_running(cls) -> bool:
        """Returns True if the background scheduler thread is active and alive."""
        return cls._is_running and cls._thread is not None and cls._thread.is_alive()

    @classmethod
    def start(cls, poll_interval_seconds: int = 30):
        """
        Starts the background scheduler thread if not already running.
        Default poll interval is 30 seconds to catch configured slots precisely on time.
        """
        with cls._lock:
            if cls.is_running():
                logger.debug("ScheduledReminderDaemon is already running.")
                return

            cls._stop_event.clear()
            cls._is_running = True

            cls._thread = threading.Thread(
                target=cls._run_loop,
                args=(poll_interval_seconds,),
                name="MAPAR-ScheduledReminderDaemon",
                daemon=True,
            )
            cls._thread.start()
            logger.info(
                "ScheduledReminderDaemon started successfully (poll_interval=%ds, thread_ident=%s).",
                poll_interval_seconds,
                cls._thread.ident,
            )

            # Register graceful process exit hook
            try:
                atexit.register(cls.stop)
            except Exception:
                pass

    @classmethod
    def stop(cls):
        """Signals the background scheduler thread to gracefully terminate."""
        with cls._lock:
            if not cls._is_running:
                return

            logger.info("Stopping ScheduledReminderDaemon...")
            cls._is_running = False
            cls._stop_event.set()
            if cls._thread and cls._thread.is_alive():
                cls._thread.join(timeout=3)
            cls._thread = None
            logger.info("ScheduledReminderDaemon stopped.")

    @classmethod
    def _run_loop(cls, poll_interval_seconds: int):
        """Continuous execution loop evaluating due schedules every poll_interval_seconds."""
        from django.db import connection
        from apps.notifications.services.reminder_scheduler_service import ReminderSchedulerService

        logger.info("ScheduledReminderDaemon run loop initialized.")
        while not cls._stop_event.is_set():
            # Wait for interval or stop event
            if cls._stop_event.wait(timeout=poll_interval_seconds):
                break

            try:
                # Maintain database connection health across thread wakeups
                connection.close_if_unusable_or_obsolete()
                res = ReminderSchedulerService.process_due_schedules(trigger_source="in_process_daemon")
                if res.get("due_slots_count", 0) > 0:
                    logger.info("ScheduledReminderDaemon processed due slots: %s", res)
            except Exception as exc:
                logger.error("Exception in ScheduledReminderDaemon loop: %s", exc, exc_info=True)
            finally:
                try:
                    connection.close_if_unusable_or_obsolete()
                except Exception:
                    pass

        logger.info("ScheduledReminderDaemon run loop terminated.")

