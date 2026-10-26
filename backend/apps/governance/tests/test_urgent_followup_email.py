from datetime import date, timedelta
from unittest.mock import patch, MagicMock
import pytest
from rest_framework.test import APIClient
from django.utils import timezone

from apps.identity.models import User
from apps.organization.models import Circle, MainCompany, SubCompany, Project
from apps.governance.models import GovernanceActionPoint
from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord


@pytest.fixture
def test_setup(db):
    company = MainCompany.objects.create(name="Apex Global", code="APEX")
    sub_company = SubCompany.objects.create(name="Apex North", code="APEX-N", main_company=company)
    project = Project.objects.create(name="Project Prime", code="PRIME", sub_company=sub_company)
    circle = Circle.objects.create(name="Circle Delhi", code="DEL", project=project, region="North")
    circle_other = Circle.objects.create(name="Circle Mumbai", code="MUM", project=project, region="West")

    admin = User.objects.create_superuser(
        username="admin_test",
        email="admin@mapar.test",
        password="password123",
        role=User.Role.SUPER_ADMIN,
    )

    owner_user = User.objects.create_user(
        username="rahul_owner",
        email="rahul.owner@mapar.test",
        password="password123",
        first_name="Rahul",
        last_name="Verma",
        role=User.Role.ACTION_OWNER,
    )

    owner_no_email = User.objects.create_user(
        username="suresh_no_email",
        email="",
        password="password123",
        first_name="Suresh",
        last_name="Kumar",
        role=User.Role.ACTION_OWNER,
    )

    action_valid = GovernanceActionPoint.objects.create(
        action_id="ACT-99001",
        circle=circle,
        action_point="Perform urgent quarterly supplier compliance audit",
        key_deliverable="Complete audit report signed by lead",
        owner=owner_user,
        raised_date=timezone.localdate() - timedelta(days=20),
        target_closure_date=timezone.localdate() - timedelta(days=5),
        current_target_date=timezone.localdate() - timedelta(days=5),
        status=GovernanceActionPoint.Status.OPEN,
        priority=GovernanceActionPoint.Priority.HIGH,
    )

    action_no_email = GovernanceActionPoint.objects.create(
        action_id="ACT-99002",
        circle=circle,
        action_point="Urgent server vulnerability patching",
        owner=owner_no_email,
        raised_date=timezone.localdate() - timedelta(days=10),
        target_closure_date=timezone.localdate() - timedelta(days=2),
        current_target_date=timezone.localdate() - timedelta(days=2),
        status=GovernanceActionPoint.Status.WIP,
        priority=GovernanceActionPoint.Priority.HIGH,
    )

    # Configure SMTP singleton
    email_config = EmailConfiguration.get_solo()
    email_config.smtp_host = "smtp.test.com"
    email_config.from_email = "alerts@mapar.test"
    email_config.is_enabled = True
    email_config.save()

    return {
        "admin": admin,
        "owner": owner_user,
        "owner_no_email": owner_no_email,
        "circle": circle,
        "circle_other": circle_other,
        "action_valid": action_valid,
        "action_no_email": action_no_email,
    }


@pytest.mark.django_db
def test_send_urgent_followup_unauthenticated(test_setup):
    client = APIClient()
    action = test_setup["action_valid"]
    response = client.post(f"/api/v1/governance/actions/{action.id}/send-email/")
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_send_urgent_followup_success(test_setup):
    client = APIClient()
    admin = test_setup["admin"]
    action = test_setup["action_valid"]
    client.force_authenticate(user=admin)

    with patch("smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_smtp_class.return_value.__enter__.return_value = mock_server

        response = client.post(f"/api/v1/governance/actions/{action.id}/send-email/")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["action_id"] == "ACT-99001"
        assert data["recipient_email"] == "rahul.owner@mapar.test"
        assert "Urgent follow-up alert successfully sent" in data["message"]

        # Verify task status was NOT changed
        action.refresh_from_db()
        assert action.status == GovernanceActionPoint.Status.OPEN

        # Verify audit log in EmailDeliveryRecord
        record = EmailDeliveryRecord.objects.filter(
            action_id="ACT-99001",
            recipient_email="rahul.owner@mapar.test",
            notification_type=EmailDeliveryRecord.NotificationType.TASK_URGENT_FOLLOWUP,
        ).first()
        assert record is not None
        assert record.status == EmailDeliveryRecord.Status.SENT
        assert record.triggered_by == admin
        assert "Action Required: [ACT-99001]" in record.subject


@pytest.mark.django_db
def test_send_urgent_followup_owner_no_email(test_setup):
    client = APIClient()
    admin = test_setup["admin"]
    action = test_setup["action_no_email"]
    client.force_authenticate(user=admin)

    response = client.post(f"/api/v1/governance/actions/{action.id}/send-email/")
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert "does not have a registered email address" in data["message"]


@pytest.mark.django_db
def test_send_urgent_followup_duplicate_prevention(test_setup):
    client = APIClient()
    admin = test_setup["admin"]
    action = test_setup["action_valid"]
    client.force_authenticate(user=admin)

    with patch("smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_smtp_class.return_value.__enter__.return_value = mock_server

        # First send
        res1 = client.post(f"/api/v1/governance/actions/{action.id}/send-email/")
        assert res1.status_code == 200

        # Rapid duplicate send within window
        res2 = client.post(f"/api/v1/governance/actions/{action.id}/send-email/")
        assert res2.status_code == 400
        assert "was already sent" in res2.json()["message"]


@pytest.mark.django_db
def test_send_urgent_followup_to_selected_application_user(test_setup):
    """Verifies that an authorized user can select any application user from the DB and send task details."""
    client = APIClient()
    admin = test_setup["admin"]
    action = test_setup["action_valid"]
    client.force_authenticate(user=admin)

    # Create another application user to be selected
    selected_target = User.objects.create_user(
        username="anand_reviewer",
        email="anand.reviewer@mapar.test",
        password="password123",
        first_name="Anand",
        last_name="Reviewer",
        role=User.Role.MANAGEMENT,
    )

    with patch("smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_smtp_class.return_value = mock_server
        mock_smtp_class.return_value.__enter__.return_value = mock_server

        response = client.post(
            f"/api/v1/governance/actions/{action.id}/send-email/",
            {"recipient_user_id": selected_target.id},
            format="json",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["recipient_email"] == "anand.reviewer@mapar.test"
        assert "Anand Reviewer" in data["recipient_name"]

        # Verify audit record
        record = EmailDeliveryRecord.objects.filter(
            action_id="ACT-99001",
            recipient_email="anand.reviewer@mapar.test",
            notification_type=EmailDeliveryRecord.NotificationType.TASK_URGENT_FOLLOWUP,
        ).first()
        assert record is not None
        assert record.status == EmailDeliveryRecord.Status.SENT
        assert record.triggered_by == admin

        # Verify task data accuracy in email content
        mock_server.sendmail.assert_called_once()
        _, _, email_raw = mock_server.sendmail.call_args[0]
        import email as email_pkg
        msg = email_pkg.message_from_string(email_raw)
        payload_text = ""
        for part in msg.walk():
            if part.get_content_type() in ("text/plain", "text/html"):
                payload_text += part.get_payload(decode=True).decode("utf-8", errors="replace")

        # Action ID
        assert "ACT-99001" in payload_text
        # Assigned owner's name and email in task card
        assert "Rahul Verma" in payload_text
        assert "rahul.owner@mapar.test" in payload_text
        # Action point title
        assert "Perform urgent quarterly supplier compliance audit" in payload_text
        # Key deliverable
        assert "Complete audit report signed by lead" in payload_text
        # Direct task link
        assert f"/governance/tasks/{action.id}" in payload_text


@pytest.mark.django_db
def test_send_urgent_followup_to_invalid_or_inactive_user(test_setup):
    """Verifies that selecting an invalid or inactive user returns a clean error."""
    client = APIClient()
    admin = test_setup["admin"]
    action = test_setup["action_valid"]
    client.force_authenticate(user=admin)

    # Inactive user
    inactive_user = User.objects.create_user(
        username="inactive_emp",
        email="inactive@mapar.test",
        password="password123",
        is_active=False,
    )

    res_inactive = client.post(
        f"/api/v1/governance/actions/{action.id}/send-email/",
        {"recipient_user_id": inactive_user.id},
        format="json",
    )
    assert res_inactive.status_code == 400
    assert "not found or inactive" in res_inactive.json()["message"]

    # Non-existent user ID
    res_nonexistent = client.post(
        f"/api/v1/governance/actions/{action.id}/send-email/",
        {"recipient_user_id": 999999},
        format="json",
    )
    assert res_nonexistent.status_code == 400
    assert "not found or inactive" in res_nonexistent.json()["message"]


@pytest.mark.django_db
def test_send_urgent_followup_unauthorized_scope(test_setup):
    """Verifies that a user cannot send emails for tasks outside their authorized organization scope."""
    client = APIClient()
    action = test_setup["action_valid"]  # Belongs to Circle Delhi

    # User scoped strictly to Circle Mumbai
    circle_other = test_setup["circle_other"]
    mumbai_user = User.objects.create_user(
        username="mumbai_mgr",
        email="mumbai.mgr@mapar.test",
        password="password123",
        role=User.Role.CIRCLE_DOMAIN_MANAGER,
        circle=circle_other,
    )
    client.force_authenticate(user=mumbai_user)

    response = client.post(f"/api/v1/governance/actions/{action.id}/send-email/")
    assert response.status_code in (403, 404)

