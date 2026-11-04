import pytest
from datetime import datetime, time, timedelta
from unittest.mock import patch, MagicMock
from zoneinfo import ZoneInfo
from django.utils import timezone

from apps.identity.models import User
from apps.organization.models import Circle
from apps.governance.models import GovernanceActionPoint
from apps.notifications.models import (
    EmailConfiguration,
    EmailDeliveryRecord,
    ScheduledSlotExecution,
)
from apps.notifications.services.reminder_scheduler_service import ReminderSchedulerService
from apps.notifications.services.scheduler_daemon import ScheduledReminderDaemon
from apps.notifications.selectors.email_selectors import get_schedule_overview_dto
from apps.notifications.services.smtp_service import SMTPService

IST_TZ = ZoneInfo("Asia/Kolkata")


@pytest.fixture
def circle(db):
    return Circle.objects.create(name="Punjab Operations Circle", code="PB-01")


@pytest.fixture
def test_setup(db, circle):
    admin = User.objects.create_user(
        username="admin_schedule_tester",
        email="admin.tester@pratap.co.in",
        role=User.Role.SUPER_ADMIN,
        circle=circle,
    )

    owner = User.objects.create_user(
        username="vikram_aditya",
        email="vikram.aditya@pratap.co.in",
        first_name="Vikram",
        last_name="Aditya",
        role=User.Role.ACTION_OWNER,
        circle=circle,
    )

    task1 = GovernanceActionPoint.objects.create(
        action_id="ACT-PB-801",
        circle=circle,
        owner=owner,
        action_point="Perform quarterly transformer maintenance",
        status=GovernanceActionPoint.Status.OPEN,
        priority=GovernanceActionPoint.Priority.HIGH,
        target_closure_date=timezone.localdate() + timedelta(days=5),
        current_target_date=timezone.localdate() + timedelta(days=5),
    )

    task2 = GovernanceActionPoint.objects.create(
        action_id="ACT-PB-802",
        circle=circle,
        owner=owner,
        action_point="Upgrade backup lithium battery bank",
        status=GovernanceActionPoint.Status.WIP,
        priority=GovernanceActionPoint.Priority.MEDIUM,
        target_closure_date=timezone.localdate() - timedelta(days=2),
        current_target_date=timezone.localdate() - timedelta(days=2),
    )

    return {
        "admin": admin,
        "owner": owner,
        "circle": circle,
        "task1": task1,
        "task2": task2,
    }


@pytest.mark.django_db
class TestSchedulerAutomation:
    """
    CRITICAL VERIFICATION: Safe automated test suite with mocked email transport.
    Zero real SMTP calls are ever invoked.
    """

    def test_saved_schedule_loaded_dynamically(self, db):
        """1. A saved schedule in the database is immediately and dynamically loaded by the scheduler."""
        config = EmailConfiguration.get_solo()
        new_matrix = {
            "Monday": ["10:30"],
            "Wednesday": ["14:00"],
            "Friday": ["09:00", "16:00"],
        }
        ReminderSchedulerService.update_weekly_schedule(new_matrix)

        loaded = ReminderSchedulerService.get_configured_schedule()
        assert loaded == new_matrix
        assert "Monday:10:30" in ReminderSchedulerService.get_all_slot_labels()
        assert "Friday:16:00" in ReminderSchedulerService.get_all_slot_labels()

    def test_next_execution_time_calculated_correctly_in_ist(self, db):
        """2 & 3. Verifies next execution time calculation in Asia/Kolkata timezone."""
        config = EmailConfiguration.get_solo()
        config.reminder_schedule = {
            "Wednesday": ["11:00"],
            "Friday": ["10:00"],
            "Saturday": ["09:00"],
        }
        config.save()

        # Simulated time: Wednesday Nov 4, 2026 at 09:30 AM IST (before 11:00 AM)
        simulated_now = datetime(2026, 11, 4, 9, 30, tzinfo=IST_TZ)
        next_dt, next_slot = ReminderSchedulerService.calculate_next_scheduled_run(simulated_now)

        assert next_slot == "Wednesday:11:00"
        assert next_dt.tzinfo == IST_TZ
        assert next_dt.hour == 11
        assert next_dt.minute == 0

        # Simulated time: Wednesday Nov 4, 2026 at 12:00 PM IST (after 11:00 AM)
        simulated_after = datetime(2026, 11, 4, 12, 0, tzinfo=IST_TZ)
        next_dt2, next_slot2 = ReminderSchedulerService.calculate_next_scheduled_run(simulated_after)

        assert next_slot2 == "Friday:10:00"
        assert next_dt2.strftime("%A") == "Friday"
        assert next_dt2.hour == 10

    def test_premature_execution_prevented(self, db, test_setup):
        """
        4. Verifies that a schedule is NEVER executed before its configured time.
        If configured for 10:00 AM, it is NOT due at 09:55 AM.
        """
        config = EmailConfiguration.get_solo()
        config.reminder_schedule = {
            "Friday": ["10:00"],
        }
        config.save()

        # Simulated time: Friday Nov 6, 2026 at 09:55 AM IST (5 minutes before configured time)
        simulated_early = datetime(2026, 11, 6, 9, 55, tzinfo=IST_TZ)

        with patch.object(SMTPService, "send_html_email") as mock_send:
            due_slots = ReminderSchedulerService.get_due_slots(simulated_early)
            assert len(due_slots) == 0

            res = ReminderSchedulerService.process_due_schedules(simulated_early)
            assert res["due_slots_count"] == 0
            assert mock_send.call_count == 0

    def test_due_schedule_detected_and_mocked_delivery_executed(self, db, test_setup):
        """
        5 & 6. Verifies that when simulated time arrives at or slightly after configured time,
        the scheduler automatically picks up the due slot and executes delivery.
        """
        config = EmailConfiguration.get_solo()
        config.reminder_schedule = {
            "Friday": ["10:00"],
        }
        config.save()

        # Simulated time: Friday Nov 6, 2026 at 10:01 AM IST
        simulated_due = datetime(2026, 11, 6, 10, 1, tzinfo=IST_TZ)

        with patch.object(SMTPService, "send_html_email") as mock_send:
            mock_send.return_value = (
                True,
                EmailDeliveryRecord.objects.create(
                    recipient_email="vikram.aditya@pratap.co.in",
                    subject="Mocked Reminder",
                    status=EmailDeliveryRecord.Status.SENT,
                    notification_type=EmailDeliveryRecord.NotificationType.TASK_REMINDER,
                ),
            )

            due_slots = ReminderSchedulerService.get_due_slots(simulated_due)
            assert len(due_slots) == 1
            assert due_slots[0]["slot_label"] == "Friday:10:00"

            res = ReminderSchedulerService.process_due_schedules(simulated_due, trigger_source="daemon_test")
            assert res["success"] is True
            assert res["due_slots_count"] == 1

            # Exactly 1 consolidated email sent to Vikram Aditya
            assert mock_send.call_count == 1
            call_kwargs = mock_send.call_args[1]
            assert call_kwargs["recipient_email"] == "vikram.aditya@pratap.co.in"

            # Check that ScheduledSlotExecution recorded completion
            exec_record = ScheduledSlotExecution.objects.filter(slot_key="2026-W45:Friday:10:00").first()
            assert exec_record is not None
            assert exec_record.status == ScheduledSlotExecution.Status.COMPLETED
            assert exec_record.sent_count == 1
            assert exec_record.failed_count == 0
            assert exec_record.completed_at is not None

    def test_duplicate_execution_prevented_across_concurrent_workers(self, db, test_setup):
        """
        7. Verifies that concurrent attempts to process the exact same slot
        are locked by ScheduledSlotExecution, preventing duplicate sends.
        """
        config = EmailConfiguration.get_solo()
        config.reminder_schedule = {
            "Friday": ["10:00"],
        }
        config.save()

        simulated_due = datetime(2026, 11, 6, 10, 2, tzinfo=IST_TZ)

        with patch.object(SMTPService, "send_html_email") as mock_send:
            mock_send.return_value = (
                True,
                EmailDeliveryRecord.objects.create(
                    recipient_email="vikram.aditya@pratap.co.in",
                    subject="Mocked Reminder",
                    status=EmailDeliveryRecord.Status.SENT,
                    notification_type=EmailDeliveryRecord.NotificationType.TASK_REMINDER,
                ),
            )

            # First worker processes the slot
            res1 = ReminderSchedulerService.process_due_schedules(simulated_due, trigger_source="worker_1")
            assert res1["due_slots_count"] == 1
            assert mock_send.call_count == 1

            # Second worker checks 10 seconds later for the same slot
            simulated_worker2 = datetime(2026, 11, 6, 10, 2, 10, tzinfo=IST_TZ)
            due_worker2 = ReminderSchedulerService.get_due_slots(simulated_worker2)
            # Slot is already marked COMPLETED, so get_due_slots reports 0
            assert len(due_worker2) == 0

            # If worker 2 directly tries to process that slot key
            res2 = ReminderSchedulerService.process_scheduled_reminders(
                target_slot="Friday:10:00",
                trigger_source="worker_2",
            )
            # Must detect already completed and skip without sending duplicate
            assert res2.get("already_completed") is True
            assert mock_send.call_count == 1  # Still exactly 1, no duplicate sent

    def test_failed_jobs_recorded_correctly(self, db, test_setup):
        """8. Verifies that delivery failures are captured in ScheduledSlotExecution and EmailDeliveryRecord."""
        config = EmailConfiguration.get_solo()
        config.reminder_schedule = {
            "Saturday": ["09:00"],
        }
        config.save()

        simulated_sat = datetime(2026, 11, 7, 9, 1, tzinfo=IST_TZ)

        with patch.object(SMTPService, "send_html_email") as mock_send:
            # Simulate SMTP failure
            mock_send.return_value = (
                False,
                EmailDeliveryRecord.objects.create(
                    recipient_email="vikram.aditya@pratap.co.in",
                    subject="Mocked Reminder",
                    status=EmailDeliveryRecord.Status.FAILED,
                    error_message="SMTP Authentication Timeout",
                    notification_type=EmailDeliveryRecord.NotificationType.TASK_REMINDER,
                ),
            )

            res = ReminderSchedulerService.process_due_schedules(simulated_sat, trigger_source="test_fail")
            assert res["due_slots_count"] == 1

            exec_record = ScheduledSlotExecution.objects.filter(slot_key="2026-W45:Saturday:09:00").first()
            assert exec_record is not None
            assert exec_record.status == ScheduledSlotExecution.Status.FAILED
            assert exec_record.failed_count == 1

    def test_application_restart_resilience(self, db, test_setup):
        """
        10. Verifies that an application restart preserves state and resumes scheduling accurately.
        """
        config = EmailConfiguration.get_solo()
        config.reminder_schedule = {
            "Friday": ["10:00"],
            "Saturday": ["09:00"],
        }
        config.save()

        # Simulate Friday slot already completed before server restarted
        ScheduledSlotExecution.objects.create(
            slot_key="2026-W45:Friday:10:00",
            status=ScheduledSlotExecution.Status.COMPLETED,
            sent_count=1,
            completed_at=timezone.now(),
        )

        # Server restarts on Saturday Nov 7, 2026 at 09:05 AM IST
        simulated_restart = datetime(2026, 11, 7, 9, 5, tzinfo=IST_TZ)

        with patch.object(SMTPService, "send_html_email") as mock_send:
            mock_send.return_value = (
                True,
                EmailDeliveryRecord.objects.create(
                    recipient_email="vikram.aditya@pratap.co.in",
                    subject="Mocked Saturday Reminder",
                    status=EmailDeliveryRecord.Status.SENT,
                    notification_type=EmailDeliveryRecord.NotificationType.TASK_REMINDER,
                ),
            )

            # Friday slot is NOT re-sent; Saturday slot IS detected and executed
            due = ReminderSchedulerService.get_due_slots(simulated_restart)
            assert len(due) == 1
            assert due[0]["slot_label"] == "Saturday:09:00"

            res = ReminderSchedulerService.process_due_schedules(simulated_restart, trigger_source="restart_daemon")
            assert res["due_slots_count"] == 1
            assert mock_send.call_count == 1

    def test_scheduler_daemon_start_and_stop(self):
        """Verifies that ScheduledReminderDaemon starts and stops cleanly."""
        assert not ScheduledReminderDaemon.is_running()

        ScheduledReminderDaemon.start(poll_interval_seconds=1)
        assert ScheduledReminderDaemon.is_running()

        ScheduledReminderDaemon.stop()
        assert not ScheduledReminderDaemon.is_running()

    def test_schedule_overview_diagnostics(self, db):
        """Verifies that get_schedule_overview_dto provides clean diagnostic metadata."""
        config = EmailConfiguration.get_solo()
        config.reminder_schedule = {
            "Friday": ["10:00"],
            "Sunday": ["17:00"],
        }
        config.save()

        ScheduledSlotExecution.objects.create(
            slot_key="2026-W44:Friday:10:00",
            status=ScheduledSlotExecution.Status.COMPLETED,
            sent_count=3,
            triggered_by="in_process_daemon",
            completed_at=timezone.now(),
        )

        dto = get_schedule_overview_dto()

        assert dto["timezone"] == "Asia/Kolkata"
        assert dto["scheduler_status"] == "ACTIVE"
        assert dto["next_execution_time"] is not None
        assert dto["next_execution_slot"] is not None
        assert dto["last_execution"] is not None
        assert dto["last_execution"]["slot_key"] == "2026-W44:Friday:10:00"
        assert dto["last_execution"]["status"] == "COMPLETED"
        assert dto["last_execution"]["sent_count"] == 3

