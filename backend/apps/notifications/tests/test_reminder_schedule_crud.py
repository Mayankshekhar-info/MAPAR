import pytest
from unittest.mock import patch, MagicMock
from zoneinfo import ZoneInfo
from datetime import datetime
from django.utils import timezone
from rest_framework.test import APIClient
from apps.identity.models import User
from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord
from apps.notifications.services.reminder_scheduler_service import ReminderSchedulerService
from apps.notifications.services.smtp_service import SMTPService

IST_TZ = ZoneInfo("Asia/Kolkata")


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    user = User.objects.create_user(
        username="schedule_admin",
        email="admin@mapar.co.in",
        password="TestPassword123!",
        is_staff=True,
        is_superuser=True,
    )
    return user


@pytest.fixture
def normal_user(db):
    user = User.objects.create_user(
        username="normal_user",
        email="user@mapar.co.in",
        password="TestPassword123!",
        is_staff=False,
        is_superuser=False,
    )
    return user


@pytest.mark.django_db
class TestWeeklyScheduleCRUD:
    """Verifies that the weekly reminder schedule can be retrieved, updated, validated, and applied dynamically."""

    def test_get_schedule_overview_returns_matrix(self, api_client, admin_user):
        api_client.force_authenticate(user=admin_user)
        response = api_client.get("/api/v1/notifications/schedule/")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "schedule_matrix" in data["overview"]
        matrix = data["overview"]["schedule_matrix"]
        assert "Friday" in matrix
        assert "Saturday" in matrix
        assert "Sunday" in matrix

    def test_update_weekly_schedule_persists_to_db(self, api_client, admin_user):
        api_client.force_authenticate(user=admin_user)
        new_schedule = {
            "Friday": ["10:00"],
            "Saturday": ["09:00", "13:00", "17:00"],
            "Sunday": ["09:00", "12:00", "15:00", "18:00"],
            "Monday": ["11:00"],
        }
        response = api_client.put(
            "/api/v1/notifications/schedule/",
            {"schedule": new_schedule},
            format="json",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["overview"]["schedule_matrix"]["Monday"] == ["11:00"]
        assert data["overview"]["schedule_matrix"]["Saturday"] == ["09:00", "13:00", "17:00"]
        assert data["overview"]["schedule_matrix"]["Sunday"] == ["09:00", "12:00", "15:00", "18:00"]

        # Confirm persistence directly from database
        config = EmailConfiguration.get_solo()
        assert config.reminder_schedule["Monday"] == ["11:00"]
        assert config.reminder_schedule["Saturday"] == ["09:00", "13:00", "17:00"]

        # Confirm dynamic reading by ReminderSchedulerService
        active_schedule = ReminderSchedulerService.get_configured_schedule()
        assert active_schedule["Monday"] == ["11:00"]
        all_slots = ReminderSchedulerService.get_all_slot_labels()
        assert "Monday:11:00" in all_slots
        assert "Saturday:13:00" in all_slots

    def test_update_weekly_schedule_validation_duplicate_times(self, api_client, admin_user):
        api_client.force_authenticate(user=admin_user)
        invalid_schedule = {
            "Friday": ["10:00", "10:00"],
        }
        response = api_client.put(
            "/api/v1/notifications/schedule/",
            {"schedule": invalid_schedule},
            format="json",
        )
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "Duplicate time slot" in str(data["errors"])

    def test_update_weekly_schedule_validation_invalid_time_format(self, api_client, admin_user):
        api_client.force_authenticate(user=admin_user)
        invalid_schedule = {
            "Friday": ["25:00"],  # Invalid hour
        }
        response = api_client.put(
            "/api/v1/notifications/schedule/",
            {"schedule": invalid_schedule},
            format="json",
        )
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "Invalid time format" in str(data["errors"])

    def test_update_weekly_schedule_validation_invalid_day(self, api_client, admin_user):
        api_client.force_authenticate(user=admin_user)
        invalid_schedule = {
            "Funday": ["10:00"],
        }
        response = api_client.put(
            "/api/v1/notifications/schedule/",
            {"schedule": invalid_schedule},
            format="json",
        )
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "Invalid day" in str(data["errors"])

    def test_removed_slot_is_not_executed(self, db):
        """Confirm that if a slot was previously scheduled but later removed, scheduler skips it."""
        config = EmailConfiguration.get_solo()
        # Set schedule with ONLY Monday 10:00 AM (Friday and Saturday removed)
        config.reminder_schedule = {"Monday": ["10:00"]}
        config.save()

        # Attempt to run an old removed slot (Friday:10:00) without force
        with patch.object(SMTPService, "send_html_email") as mock_send:
            result = ReminderSchedulerService.process_scheduled_reminders(
                target_slot="Friday:10:00",
                force=False,
            )
            assert result["success"] is False
            assert "no longer active" in result["reason"]
            mock_send.assert_not_called()

    def test_newly_added_custom_slot_matches_dynamically(self, db):
        """Confirm that a newly added custom day/time is resolved by resolve_matching_slot."""
        config = EmailConfiguration.get_solo()
        config.reminder_schedule = {
            "Wednesday": ["14:30"],
        }
        config.save()

        # Check IST Wednesday at 14:30
        wed_time = datetime(2026, 10, 28, 14, 30, tzinfo=IST_TZ)  # Oct 28, 2026 is a Wednesday
        matched = ReminderSchedulerService.resolve_matching_slot(dt=wed_time)
        assert matched == "Wednesday:14:30"

