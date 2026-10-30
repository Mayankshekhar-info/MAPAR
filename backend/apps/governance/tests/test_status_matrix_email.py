from datetime import date, timedelta
from unittest.mock import patch, MagicMock
import pytest
from rest_framework.test import APIClient
from django.utils import timezone

from apps.identity.models import User
from apps.organization.models import Circle, MainCompany, SubCompany, Project
from apps.governance.models import GovernanceActionPoint
from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord
from apps.notifications.services.status_matrix_email_service import StatusMatrixEmailService


@pytest.fixture
def status_matrix_test_setup(db):
    company = MainCompany.objects.create(name="Matrix Apex", code="MAPEX")
    sub_company = SubCompany.objects.create(name="Matrix Sub", code="MSUB", main_company=company)
    project = Project.objects.create(name="Matrix Project", code="MPROJ", sub_company=sub_company)
    circle1 = Circle.objects.create(name="Circle Central", code="C-CEN", project=project, region="Central")
    circle2 = Circle.objects.create(name="Circle South", code="C-SOU", project=project, region="South")

    admin = User.objects.create_superuser(
        username="admin_matrix",
        email="admin@mapar.matrix",
        password="password123",
        role=User.Role.SUPER_ADMIN,
    )

    viewer = User.objects.create_user(
        username="viewer_user",
        email="viewer@mapar.matrix",
        password="password123",
        role=User.Role.VIEWER,
    )

    owner_1 = User.objects.create_user(
        username="rahul_sharma",
        email="rahul.sharma@mapar.test",
        first_name="Rahul",
        last_name="Sharma",
        role=User.Role.ACTION_OWNER,
    )

    owner_2 = User.objects.create_user(
        username="anita_desai",
        email="anita.desai@mapar.test",
        first_name="Anita",
        last_name="Desai",
        role=User.Role.ACTION_OWNER,
    )

    # User 3 with same normalized email as Owner 1 to test deduplication
    owner_1_duplicate = User.objects.create_user(
        username="rahul_sharma_alias",
        email="  Rahul.Sharma@mapar.test  ",
        first_name="Rahul",
        last_name="Sharma",
        role=User.Role.ACTION_OWNER,
    )

    today = timezone.localdate()

    # Owner 1 Task A (Overdue, High Priority)
    task1 = GovernanceActionPoint.objects.create(
        action_id="ACT-M001",
        circle=circle1,
        action_point="Safety Protocol Review",
        key_deliverable="Updated checklist",
        owner=owner_1,
        raised_date=today - timedelta(days=20),
        target_closure_date=today - timedelta(days=5),
        current_target_date=today - timedelta(days=5),
        status=GovernanceActionPoint.Status.OPEN,
        priority=GovernanceActionPoint.Priority.HIGH,
    )

    # Owner 1 Task B (On Track, Medium Priority)
    task2 = GovernanceActionPoint.objects.create(
        action_id="ACT-M002",
        circle=circle1,
        action_point="Warehouse Inventory Count",
        key_deliverable="Complete audit spreadsheet",
        owner=owner_1,
        raised_date=today - timedelta(days=10),
        target_closure_date=today + timedelta(days=10),
        current_target_date=today + timedelta(days=10),
        status=GovernanceActionPoint.Status.WIP,
        priority=GovernanceActionPoint.Priority.MEDIUM,
    )

    # Owner 1 Alias Task C (Assigned to alias user with same normalized email)
    task3 = GovernanceActionPoint.objects.create(
        action_id="ACT-M003",
        circle=circle1,
        action_point="Vendor Security Audit",
        key_deliverable="Vendor certification",
        owner=owner_1_duplicate,
        raised_date=today - timedelta(days=12),
        target_closure_date=today + timedelta(days=5),
        current_target_date=today + timedelta(days=5),
        status=GovernanceActionPoint.Status.WIP,
        priority=GovernanceActionPoint.Priority.LOW,
    )

    # Owner 2 Task D (Circle South, Overdue)
    task4 = GovernanceActionPoint.objects.create(
        action_id="ACT-M004",
        circle=circle2,
        action_point="Fleet Inspection Follow-up",
        key_deliverable="Signed vehicle certificates",
        owner=owner_2,
        raised_date=today - timedelta(days=25),
        target_closure_date=today - timedelta(days=2),
        current_target_date=today - timedelta(days=2),
        status=GovernanceActionPoint.Status.OPEN,
        priority=GovernanceActionPoint.Priority.HIGH,
    )

    # Closed Task (should be excluded from reminders)
    task_closed = GovernanceActionPoint.objects.create(
        action_id="ACT-M005",
        circle=circle1,
        action_point="Past Monthly Governance Report",
        owner=owner_1,
        raised_date=today - timedelta(days=40),
        target_closure_date=today - timedelta(days=20),
        current_target_date=today - timedelta(days=20),
        actual_closure_date=today - timedelta(days=15),
        status=GovernanceActionPoint.Status.CLOSED,
        priority=GovernanceActionPoint.Priority.LOW,
    )

    email_config = EmailConfiguration.get_solo()
    email_config.smtp_host = "smtp.test.com"
    email_config.from_email = "alerts@mapar.matrix"
    email_config.is_enabled = True
    email_config.save()

    return {
        "admin": admin,
        "viewer": viewer,
        "owner_1": owner_1,
        "owner_2": owner_2,
        "circle1": circle1,
        "circle2": circle2,
        "tasks": [task1, task2, task3, task4],
    }


@pytest.mark.django_db
def test_status_matrix_email_preview_deduplication(status_matrix_test_setup):
    """Verifies that preview groups by normalized email so duplicate accounts merge into one recipient."""
    admin = status_matrix_test_setup["admin"]
    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.get("/api/v1/governance/status-matrix/email-preview/")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    # 4 active tasks across 2 distinct email addresses (rahul.sharma@mapar.test and anita.desai@mapar.test)
    assert data["distinct_recipients_count"] == 2
    assert data["total_tasks_count"] == 4

    recipients_by_email = {r["recipient_email"]: r for r in data["recipients"]}
    assert "rahul.sharma@mapar.test" in recipients_by_email
    assert "anita.desai@mapar.test" in recipients_by_email

    # Rahul Sharma has 3 consolidated tasks (ACT-M001, ACT-M002, ACT-M003)
    rahul_info = recipients_by_email["rahul.sharma@mapar.test"]
    assert rahul_info["task_count"] == 3
    assert "ACT-M001" in rahul_info["action_ids"]
    assert "ACT-M002" in rahul_info["action_ids"]
    assert "ACT-M003" in rahul_info["action_ids"]
    assert rahul_info["overdue_count"] == 1
    assert rahul_info["high_priority_count"] == 1


@pytest.mark.django_db
def test_status_matrix_sends_one_consolidated_email_per_user(status_matrix_test_setup):
    """
    Verifies that when Send Mail is triggered:
    - Exactly 1 email is sent per distinct recipient (2 emails total, NOT 4).
    - Rahul Sharma's email contains all 3 of his assigned tasks.
    - Summary counts (Total: 3, Overdue: 1, High: 1) match his specific tasks.
    """
    admin = status_matrix_test_setup["admin"]
    client = APIClient()
    client.force_authenticate(user=admin)

    with patch("apps.notifications.services.smtp_service.SMTPService.send_html_email") as mock_send:
        mock_send.return_value = (True, MagicMock(status=EmailDeliveryRecord.Status.SENT, error_message=""))

        response = client.post("/api/v1/governance/status-matrix/send-emails/", {})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["total_recipients"] == 2
        assert data["total_tasks"] == 4
        assert data["sent_count"] == 2
        assert data["failed_count"] == 0

        # Verify exactly 2 send_html_email calls were made (1 per distinct email recipient)
        assert mock_send.call_count == 2

        # Inspect calls
        calls = mock_send.call_args_list
        sent_emails = [c.kwargs["recipient_email"] for c in calls]
        assert "rahul.sharma@mapar.test" in sent_emails
        assert "anita.desai@mapar.test" in sent_emails

        # Verify Rahul's consolidated email content
        rahul_call = [c for c in calls if c.kwargs["recipient_email"] == "rahul.sharma@mapar.test"][0]
        html_content = rahul_call.kwargs["html_content"]
        assert "ACT-M001" in html_content
        assert "ACT-M002" in html_content
        assert "ACT-M003" in html_content
        # Ensure Anita's task is NOT in Rahul's email
        assert "ACT-M004" not in html_content
        # Summary counts
        assert ">3</div>" in html_content  # Total Tasks: 3


@pytest.mark.django_db
def test_status_matrix_controlled_test_override(status_matrix_test_setup):
    """Verifies that override_recipient_email safely routes all emails to the specified controlled test account."""
    admin = status_matrix_test_setup["admin"]
    User.objects.create_user(
        username="controlled_test_user",
        email="test.controlled@pratap.co.in",
        first_name="Controlled",
        last_name="Test",
    )
    client = APIClient()
    client.force_authenticate(user=admin)

    with patch("apps.notifications.services.smtp_service.SMTPService.send_html_email") as mock_send:
        mock_send.return_value = (True, MagicMock(status=EmailDeliveryRecord.Status.SENT, error_message=""))

        response = client.post("/api/v1/governance/status-matrix/send-emails/", {
            "override_recipient_email": "test.controlled@pratap.co.in"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        calls = mock_send.call_args_list
        # All calls routed to the controlled address
        for c in calls:
            assert c.kwargs["recipient_email"] == "test.controlled@pratap.co.in"


@pytest.mark.django_db
def test_viewer_cannot_send_status_matrix_emails(status_matrix_test_setup):
    """Verifies that read-only viewers are forbidden from triggering status matrix bulk emails."""
    viewer = status_matrix_test_setup["viewer"]
    client = APIClient()
    client.force_authenticate(user=viewer)

    response = client.post("/api/v1/governance/status-matrix/send-emails/", {})
    assert response.status_code == 403
    assert "Viewers do not have permission" in response.json()["message"]
