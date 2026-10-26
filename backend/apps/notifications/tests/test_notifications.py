from datetime import date, timedelta
from unittest.mock import patch, MagicMock
from zoneinfo import ZoneInfo
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.models import User
from apps.organization.models import Circle
from apps.governance.models import GovernanceActionPoint
from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord
from apps.notifications.services.smtp_service import SMTPService
from apps.notifications.services.task_assignment_email_service import TaskAssignmentEmailService
from apps.notifications.services.reminder_scheduler_service import ReminderSchedulerService, SCHEDULE_SLOTS

IST_TZ = ZoneInfo("Asia/Kolkata")


@pytest.fixture
def circle():
    return Circle.objects.create(name="Central Operations Circle", code="COC-01")


@pytest.fixture
def superuser(circle):
    return User.objects.create_superuser(
        username="admin_user",
        email="admin@mapar.co.in",
        password="adminpassword123",
        role=User.Role.SUPER_ADMIN,
        circle=circle,
    )


@pytest.fixture
def action_owner(circle):
    return User.objects.create_user(
        username="john_doe",
        email="john.doe@pratap.co.in",
        first_name="John",
        last_name="Doe",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle,
    )


@pytest.fixture
def new_owner(circle):
    return User.objects.create_user(
        username="jane_smith",
        email="jane.smith@pratap.co.in",
        first_name="Jane",
        last_name="Smith",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle,
    )


@pytest.fixture
def action_point(circle, superuser, action_owner):
    return GovernanceActionPoint.objects.create(
        action_id="ACT-00999",
        circle=circle,
        function_area="Operations",
        action_point="Deploy Automated Email Notification Pipeline",
        key_deliverable="Complete SMTP integration and scheduled reminder scheduler",
        owner=action_owner,
        assigned_by=superuser,
        raised_date=date(2026, 10, 20),
        target_closure_date=date(2026, 10, 31),
        current_target_date=date(2026, 10, 31),
        status=GovernanceActionPoint.Status.OPEN,
        priority=GovernanceActionPoint.Priority.HIGH,
        evidence_required=True,
        last_update="Awaiting testing and deployment",
        created_by=superuser,
    )


@pytest.mark.django_db
class TestEmailConfigurationAndModels:
    def test_email_configuration_singleton_and_defaults(self, monkeypatch):
        monkeypatch.delenv("SMTP_PASSWORD", raising=False)
        monkeypatch.delenv("SMTP_HOST", raising=False)
        config = EmailConfiguration.get_solo()
        assert config.singleton_id == 1
        effective = config.get_effective_settings()
        assert "abhay@pratap.co.in" in effective["cc_addresses"]
        assert "shakti.singh@pratap.co.in" in effective["cc_addresses"]
        assert effective["has_password"] is False

    def test_idempotency_prevents_duplicate_records(self, action_point):
        key = "test_key_123"
        rec1, created1 = EmailDeliveryRecord.objects.get_or_create(
            idempotency_key=key,
            defaults={
                "notification_type": EmailDeliveryRecord.NotificationType.TASK_ASSIGNMENT,
                "recipient_email": "test@mapar.co.in",
                "subject": "Test Subject",
            },
        )
        assert created1 is True

        rec2, created2 = EmailDeliveryRecord.objects.get_or_create(
            idempotency_key=key,
            defaults={
                "notification_type": EmailDeliveryRecord.NotificationType.TASK_ASSIGNMENT,
                "recipient_email": "test@mapar.co.in",
                "subject": "Duplicate Subject",
            },
        )
        assert created2 is False
        assert rec1.id == rec2.id


@pytest.mark.django_db
class TestTaskAssignmentEmails:
    @patch("apps.notifications.services.smtp_service.SMTPService.send_html_email")
    def test_assignment_email_triggered_with_details_and_mandatory_ccs(self, mock_send, action_point):
        mock_send.return_value = (True, MagicMock(status=EmailDeliveryRecord.Status.SENT))

        success, _ = TaskAssignmentEmailService.send_assignment_email(action_point, is_reassignment=False)
        assert success is True
        assert mock_send.called

        _, kwargs = mock_send.call_args
        assert kwargs["recipient_email"] == "john.doe@pratap.co.in"
        assert any(p in kwargs["subject"] for p in ["[PAGMS] New Task Assigned — ACT-00999", "[PGMS] New Task Assigned — ACT-00999"])
        assert "ACT-00999" in kwargs["plain_text"]
        assert "Deploy Automated Email Notification Pipeline" in kwargs["plain_text"]
        assert "Central Operations Circle" in kwargs["plain_text"]
        assert "http://localhost:5185/governance/tasks/" in kwargs["plain_text"]
        # Check approved PAGMS branding & greeting
        assert "PAGMS" in kwargs["html_content"] or "PGMS" in kwargs["html_content"]
        assert "Governance &amp; Action Tracker" in kwargs["html_content"]
        assert "John Doe" in kwargs["html_content"] and "Dear " in kwargs["html_content"]
        assert "Governance &amp; Action Tracking" in kwargs["html_content"]

    @patch("apps.notifications.services.smtp_service.SMTPService.send_html_email")
    def test_reassignment_email_triggered(self, mock_send, action_point, new_owner):
        action_point.owner = new_owner
        action_point.save()

        mock_send.return_value = (True, MagicMock(status=EmailDeliveryRecord.Status.SENT))
        success, _ = TaskAssignmentEmailService.send_assignment_email(action_point, is_reassignment=True)

        assert success is True
        _, kwargs = mock_send.call_args
        assert kwargs["recipient_email"] == "jane.smith@pratap.co.in"
        assert any(p in kwargs["subject"] for p in ["[PAGMS] Task Reassigned — ACT-00999", "[PGMS] Task Reassigned — ACT-00999"])
        assert "Jane Smith" in kwargs["html_content"] and "Dear " in kwargs["html_content"]


@pytest.mark.django_db
class TestReminderScheduler:
    def test_schedule_matrix_has_exact_required_slots(self):
        assert SCHEDULE_SLOTS["Friday"] == ["10:00"]
        assert SCHEDULE_SLOTS["Saturday"] == ["09:00", "17:00"]
        assert SCHEDULE_SLOTS["Sunday"] == ["09:00", "13:00", "17:00"]
        assert len(SCHEDULE_SLOTS["Friday"]) == 1
        assert len(SCHEDULE_SLOTS["Saturday"]) == 2
        assert len(SCHEDULE_SLOTS["Sunday"]) == 3

    def test_permitted_window_check(self):
        # 10:00 AM IST is within permitted window (8am - 8pm)
        dt_in_window = timezone.datetime(2026, 10, 24, 10, 0, tzinfo=IST_TZ)
        assert ReminderSchedulerService.is_within_permitted_window(dt_in_window) is True

        # 07:30 AM IST is before 8:00 AM
        dt_too_early = timezone.datetime(2026, 10, 24, 7, 30, tzinfo=IST_TZ)
        assert ReminderSchedulerService.is_within_permitted_window(dt_too_early) is False

        # 09:30 PM IST is after 8:00 PM
        dt_too_late = timezone.datetime(2026, 10, 24, 21, 30, tzinfo=IST_TZ)
        assert ReminderSchedulerService.is_within_permitted_window(dt_too_late) is False

    @patch("apps.notifications.services.smtp_service.SMTPService.send_html_email")
    def test_reminders_stop_when_task_is_closed(self, mock_send, action_point):
        mock_send.return_value = (True, MagicMock(status=EmailDeliveryRecord.Status.SENT))

        # Close the task
        action_point.status = GovernanceActionPoint.Status.CLOSED
        action_point.actual_closure_date = date(2026, 10, 22)
        action_point.save()

        result = ReminderSchedulerService.process_scheduled_reminders(target_slot="Friday:10:00", force=True)
        assert result["sent_count"] == 0
        assert mock_send.call_count == 0

    @patch("apps.notifications.services.smtp_service.SMTPService.send_html_email")
    def test_reminders_continue_if_100_percent_progress_without_closure(self, mock_send, action_point):
        """100% progress alone does not constitute closure in MAPAR workflow."""
        mock_send.return_value = (True, MagicMock(status=EmailDeliveryRecord.Status.SENT))

        action_point.current_progress_percent = 100
        action_point.status = GovernanceActionPoint.Status.WIP
        action_point.save()

        result = ReminderSchedulerService.process_scheduled_reminders(target_slot="Saturday:09:00", force=True)
        assert result["sent_count"] == 1
        assert mock_send.called

    @patch("apps.notifications.services.smtp_service.SMTPService.send_html_email")
    def test_reminder_dispatches_with_overdue_flag(self, mock_send, action_point):
        mock_send.return_value = (True, MagicMock(status=EmailDeliveryRecord.Status.SENT))

        # Set target date in the past
        action_point.current_target_date = date(2026, 10, 10)
        action_point.save()

        result = ReminderSchedulerService.process_scheduled_reminders(target_slot="Sunday:09:00", force=True)
        assert result["sent_count"] == 1
        _, kwargs = mock_send.call_args
        assert "OVERDUE Action Required" in kwargs["subject"]
        assert "overdue" in kwargs["html_content"].lower()
        assert "Governance &amp; Action Tracking" in kwargs["html_content"]

    @patch("apps.notifications.services.smtp_service.SMTPService.send_html_email")
    def test_multi_task_reminder_consolidated_email(self, mock_send, circle, superuser, action_owner, action_point):
        """When multiple unclosed tasks are assigned to the same user, send 1 consolidated email showing all tasks."""
        # Create second task for the same owner
        task2 = GovernanceActionPoint.objects.create(
            action_id="ACT-00888",
            circle=circle,
            function_area="Finance",
            action_point="Quarterly Fiscal Balance Reconciliation",
            key_deliverable="Audited financial sheets",
            owner=action_owner,
            assigned_by=superuser,
            raised_date=date(2026, 10, 15),
            target_closure_date=date(2026, 11, 15),
            current_target_date=date(2026, 11, 15),
            status=GovernanceActionPoint.Status.WIP,
            priority=GovernanceActionPoint.Priority.HIGH,
            bucket="0-30 Days",
        )

        mock_send.return_value = (True, MagicMock(status=EmailDeliveryRecord.Status.SENT))

        result = ReminderSchedulerService.process_scheduled_reminders(target_slot="Sunday:09:00", force=True)
        assert result["sent_count"] == 1  # 1 email sent for the owner containing both tasks
        assert mock_send.call_count == 1

        _, kwargs = mock_send.call_args
        assert kwargs["recipient_email"] == "john.doe@pratap.co.in"
        # Summary counts in HTML
        assert "TOTAL TASKS" in kwargs["html_content"] or "Total Tasks" in kwargs["html_content"]
        assert ">2</div>" in kwargs["html_content"]
        # Both task IDs and titles rendered
        assert "ACT-00999" in kwargs["html_content"]
        assert "ACT-00888" in kwargs["html_content"]
        assert "Quarterly Fiscal Balance Reconciliation" in kwargs["html_content"]
        assert "Deploy Automated Email Notification Pipeline" in kwargs["html_content"]
        # Both direct task links rendered
        assert f"/governance/tasks/{action_point.id}" in kwargs["html_content"]
        assert f"/governance/tasks/{task2.id}" in kwargs["html_content"]
        # Plain text contains both
        assert "ACT-00999" in kwargs["plain_text"]
        assert "ACT-00888" in kwargs["plain_text"]
        assert "Total Tasks:    2" in kwargs["plain_text"]
        # PAGMS branding
        assert "PAGMS" in kwargs["html_content"] or "PGMS" in kwargs["html_content"]
        assert "Governance &amp; Action Tracker" in kwargs["html_content"]
        assert "Governance &amp; Action Tracking" in kwargs["html_content"]


@pytest.mark.django_db
class TestNotificationAPIs:
    def test_smtp_configuration_api(self, superuser):
        client = APIClient()
        client.force_authenticate(user=superuser)

        # GET
        resp = client.get("/api/v1/notifications/smtp/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "abhay@pratap.co.in" in data["configuration"]["cc_addresses"]
        assert "shakti.singh@pratap.co.in" in data["configuration"]["cc_addresses"]

        # POST update
        payload = {
            "smtp_host": "smtp.company.com",
            "smtp_port": 587,
            "smtp_username": "alerts@company.com",
            "smtp_password": "supersecretpassword123",
            "smtp_security": "STARTTLS",
            "from_email": "notifications@company.com",
            "from_name": "Company MAPAR Alerts",
            "is_enabled": True,
            "cc_addresses": ["custom.cc@company.com"],
        }
        resp = client.post("/api/v1/notifications/smtp/", payload, format="json")
        assert resp.status_code == 200
        data = resp.json()
        assert data["configuration"]["smtp_host"] == "smtp.company.com"
        assert data["configuration"]["has_password"] is True
        # Password must never be returned in plaintext
        assert "supersecretpassword123" not in str(data)

    @patch("apps.notifications.services.smtp_service.SMTPService.test_connection")
    def test_test_connection_api(self, mock_test, superuser):
        mock_test.return_value = (True, "Connection successful")
        client = APIClient()
        client.force_authenticate(user=superuser)

        resp = client.post("/api/v1/notifications/smtp/test-connection/", {"smtp_host": "smtp.test.com"})
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    @patch("apps.notifications.services.smtp_service.SMTPService.send_test_email")
    def test_send_test_email_api(self, mock_send, superuser):
        mock_send.return_value = (True, "Dispatched test email")
        client = APIClient()
        client.force_authenticate(user=superuser)

        resp = client.post("/api/v1/notifications/smtp/send-test/", {"recipient_email": "admin@mapar.co.in"})
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_delivery_logs_api(self, superuser, action_point):
        EmailDeliveryRecord.objects.create(
            idempotency_key="log_test_01",
            notification_type=EmailDeliveryRecord.NotificationType.TASK_ASSIGNMENT,
            action_point=action_point,
            action_id=action_point.action_id,
            recipient_email="john.doe@pratap.co.in",
            subject="Test Assignment",
            status=EmailDeliveryRecord.Status.SENT,
        )

        client = APIClient()
        client.force_authenticate(user=superuser)
        resp = client.get("/api/v1/notifications/logs/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= 1
        assert data["results"][0]["action_id"] == "ACT-00999"

    def test_schedule_overview_api(self, superuser, action_point):
        client = APIClient()
        client.force_authenticate(user=superuser)
        resp = client.get("/api/v1/notifications/schedule/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["overview"]["eligible_unclosed_tasks"] >= 1
        assert "Friday" in data["overview"]["schedule_matrix"]


@pytest.mark.django_db
class TestShaktiSinghCCSwitch:
    """Verifies configurable Enable/Disable switch for shakti.singh@pratap.co.in in CC."""

    def test_default_behavior_is_enabled(self, monkeypatch):
        monkeypatch.delenv("CC_SHAKTI_SINGH_ENABLED", raising=False)
        monkeypatch.delenv("SMTP_CC_SHAKTI_SINGH_ENABLED", raising=False)
        assert SMTPService.is_shakti_singh_cc_enabled() is True

    def test_disabled_via_env_var_excludes_shakti_from_cc(self, monkeypatch):
        monkeypatch.setenv("CC_SHAKTI_SINGH_ENABLED", "False")

        with patch("smtplib.SMTP") as mock_smtp_class:
            mock_server = MagicMock()
            mock_smtp_class.return_value = mock_server
            mock_smtp_class.return_value.__enter__.return_value = mock_server

            success, record = SMTPService.send_html_email(
                recipient_email="recipient_dis@example.com",
                subject="Test Subject Disabled",
                plain_text="Plain body",
                html_content="<p>Html body</p>",
                custom_config={"host": "smtp.test.com"},
                idempotency_key="test_shakti_disabled_env",
            )

            assert success is True
            # Verify shakti.singh is excluded from record.cc_emails
            assert "shakti.singh@pratap.co.in" not in record.cc_emails
            # Verify abhay is still included
            assert "abhay@pratap.co.in" in record.cc_emails

            # Verify actual recipients sent to SMTP server
            sendmail_call = mock_server.sendmail.call_args
            assert sendmail_call is not None
            _, all_recipients, _ = sendmail_call[0]
            assert "recipient_dis@example.com" in all_recipients
            assert "abhay@pratap.co.in" in all_recipients
            assert "shakti.singh@pratap.co.in" not in all_recipients

    def test_enabled_via_env_var_includes_shakti_in_cc(self, monkeypatch):
        monkeypatch.setenv("CC_SHAKTI_SINGH_ENABLED", "True")

        with patch("smtplib.SMTP") as mock_smtp_class:
            mock_server = MagicMock()
            mock_smtp_class.return_value = mock_server
            mock_smtp_class.return_value.__enter__.return_value = mock_server

            success, record = SMTPService.send_html_email(
                recipient_email="recipient_enb@example.com",
                subject="Test Subject Enabled",
                plain_text="Plain body",
                html_content="<p>Html body</p>",
                custom_config={"host": "smtp.test.com"},
                idempotency_key="test_shakti_enabled_env",
            )

            assert success is True
            assert "shakti.singh@pratap.co.in" in record.cc_emails
            assert "abhay@pratap.co.in" in record.cc_emails

            sendmail_call = mock_server.sendmail.call_args
            assert sendmail_call is not None
            _, all_recipients, _ = sendmail_call[0]
            assert "shakti.singh@pratap.co.in" in all_recipients
            assert "abhay@pratap.co.in" in all_recipients

    def test_disabled_via_custom_config_override(self):
        with patch("smtplib.SMTP") as mock_smtp_class:
            mock_server = MagicMock()
            mock_smtp_class.return_value = mock_server
            mock_smtp_class.return_value.__enter__.return_value = mock_server

            success, record = SMTPService.send_html_email(
                recipient_email="recipient_override@example.com",
                subject="Test Subject Override",
                plain_text="Plain body",
                html_content="<p>Html body</p>",
                custom_config={"host": "smtp.test.com", "cc_shakti_singh_enabled": False},
                idempotency_key="test_shakti_override_cfg",
            )

            assert success is True
            assert "shakti.singh@pratap.co.in" not in record.cc_emails
            assert "abhay@pratap.co.in" in record.cc_emails

            sendmail_call = mock_server.sendmail.call_args
            assert sendmail_call is not None
            _, all_recipients, _ = sendmail_call[0]
            assert "shakti.singh@pratap.co.in" not in all_recipients
            assert "abhay@pratap.co.in" in all_recipients

    def test_to_recipient_shakti_is_not_affected_when_cc_disabled(self, monkeypatch):
        """If shakti.singh is the primary To recipient, he must continue receiving emails."""
        monkeypatch.setenv("CC_SHAKTI_SINGH_ENABLED", "False")

        with patch("smtplib.SMTP") as mock_smtp_class:
            mock_server = MagicMock()
            mock_smtp_class.return_value = mock_server
            mock_smtp_class.return_value.__enter__.return_value = mock_server

            success, record = SMTPService.send_html_email(
                recipient_email="shakti.singh@pratap.co.in",
                subject="Direct Task Alert",
                plain_text="Task details",
                html_content="<p>Task details</p>",
                custom_config={"host": "smtp.test.com"},
                idempotency_key="test_shakti_direct_to",
            )

            assert success is True
            assert record.recipient_email == "shakti.singh@pratap.co.in"
            sendmail_call = mock_server.sendmail.call_args
            assert sendmail_call is not None
            _, all_recipients, _ = sendmail_call[0]
            assert "shakti.singh@pratap.co.in" in all_recipients  # As To recipient
            assert "abhay@pratap.co.in" in all_recipients  # In CC

    def test_case_insensitive_and_whitespace_filtering(self, monkeypatch):
        monkeypatch.setenv("CC_SHAKTI_SINGH_ENABLED", "False")

        with patch("smtplib.SMTP") as mock_smtp_class:
            mock_server = MagicMock()
            mock_smtp_class.return_value.__enter__.return_value = mock_server

            success, record = SMTPService.send_html_email(
                recipient_email="recipient_case@example.com",
                subject="Case Test",
                plain_text="Plain",
                html_content="<p>Html</p>",
                cc_list=["  Shakti.Singh@Pratap.CO.IN  ", "other.user@pratap.co.in"],
                custom_config={"host": "smtp.test.com"},
                idempotency_key="test_shakti_case_insensitive",
            )

            assert success is True
            assert "shakti.singh@pratap.co.in" not in record.cc_emails
            assert "other.user@pratap.co.in" in record.cc_emails
            assert "abhay@pratap.co.in" in record.cc_emails

