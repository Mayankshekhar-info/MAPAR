import pytest
from unittest.mock import patch, MagicMock
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import date

from apps.identity.models import User
from apps.organization.models import MainCompany, SubCompany, Project, Circle
from apps.governance.models import GovernanceActionPoint
from apps.governance.services.governance_service import GovernanceService


@pytest.fixture
def test_setup(db):
    company = MainCompany.objects.create(name="Apex Enterprise", code="APEX")
    sub_company = SubCompany.objects.create(name="Apex Infra", code="AINF", main_company=company)
    project = Project.objects.create(name="Project Prime", code="PRIM", sub_company=sub_company)
    circle1 = Circle.objects.create(name="Punjab Circle", code="PUN", region="North", project=project)
    circle2 = Circle.objects.create(name="Haryana Circle", code="HAR", region="North", project=project)

    admin = User.objects.create_user(
        username="admin_user",
        email="admin@mapar.co.in",
        first_name="Admin",
        last_name="User",
        role=User.Role.SUPER_ADMIN,
        is_staff=True,
    )

    circle_manager = User.objects.create_user(
        username="circle_mgr",
        email="mgr@mapar.co.in",
        first_name="Circle",
        last_name="Manager",
        role=User.Role.CIRCLE_DOMAIN_MANAGER,
        circle=circle1,
    )

    other_circle_manager = User.objects.create_user(
        username="other_mgr",
        email="otherm@mapar.co.in",
        first_name="Other",
        last_name="Manager",
        role=User.Role.CIRCLE_DOMAIN_MANAGER,
        circle=circle2,
    )

    owner = User.objects.create_user(
        username="owner_user",
        email="owner@mapar.co.in",
        first_name="Task",
        last_name="Owner",
        role=User.Role.ACTION_OWNER,
        circle=circle1,
    )

    viewer = User.objects.create_user(
        username="viewer_user",
        email="viewer@mapar.co.in",
        first_name="Viewer",
        last_name="Only",
        role=User.Role.VIEWER,
        circle=circle1,
    )

    action = GovernanceActionPoint.objects.create(
        circle=circle1,
        hierarchy_level="CIRCLE",
        hierarchy_node_id=circle1.id,
        function_area="Operations",
        bucket="Audit Finding",
        action_point="Original Action Point Text",
        key_deliverable="Original Deliverable",
        owner=owner,
        created_by=admin,
        assigned_by=admin,
        raised_date=date(2026, 1, 10),
        target_closure_date=date(2026, 2, 28),
        status=GovernanceActionPoint.Status.OPEN,
        priority=GovernanceActionPoint.Priority.HIGH,
    )

    return {
        "circle1": circle1,
        "circle2": circle2,
        "admin": admin,
        "circle_manager": circle_manager,
        "other_circle_manager": other_circle_manager,
        "owner": owner,
        "viewer": viewer,
        "action": action,
    }


@pytest.mark.django_db
@patch("apps.notifications.services.smtp_service.SMTPService.send_html_email", return_value=(True, MagicMock()))
@patch("apps.notifications.services.task_assignment_email_service.TaskAssignmentEmailService.send_assignment_email", return_value=True)
def test_authorized_admin_can_edit_task(mock_assign_email, mock_send_email, test_setup):
    """
    Test 1: Authorized Super Admin can edit task fields (action_point, bucket, priority, key_deliverable).
    Verifies that the same database record is updated without creating duplicates.
    """
    admin = test_setup["admin"]
    action = test_setup["action"]
    client = APIClient()
    client.force_authenticate(user=admin)

    url = f"/api/v1/governance/actions/{action.id}/"
    payload = {
        "action_point": "Updated Action Point by Admin",
        "key_deliverable": "Updated Tangible Deliverable",
        "bucket": "Risk Review",
        "priority": "Medium",
    }

    resp = client.patch(url, payload, format="json")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["success"] is True

    # Verify same record persisted in DB
    action.refresh_from_db()
    assert action.action_point == "Updated Action Point by Admin"
    assert action.key_deliverable == "Updated Tangible Deliverable"
    assert action.bucket == "Risk Review"
    assert action.priority == "Medium"
    assert GovernanceActionPoint.objects.filter(id=action.id).count() == 1


@pytest.mark.django_db
@patch("apps.notifications.services.smtp_service.SMTPService.send_html_email", return_value=(True, MagicMock()))
def test_circle_manager_can_edit_task_within_circle(mock_send_email, test_setup):
    """
    Test 2: Circle Domain Manager in the same circle can edit task fields.
    """
    manager = test_setup["circle_manager"]
    action = test_setup["action"]
    client = APIClient()
    client.force_authenticate(user=manager)

    url = f"/api/v1/governance/actions/{action.id}/"
    payload = {
        "action_point": "Updated by Circle Manager",
        "last_update": "Circle review completed on schedule",
    }

    resp = client.patch(url, payload, format="json")
    assert resp.status_code == status.HTTP_200_OK

    action.refresh_from_db()
    assert action.action_point == "Updated by Circle Manager"
    assert action.last_update == "Circle review completed on schedule"


@pytest.mark.django_db
@patch("apps.notifications.services.smtp_service.SMTPService.send_html_email", return_value=(True, MagicMock()))
def test_unauthorized_other_circle_manager_rejected(mock_send_email, test_setup):
    """
    Test 3: Circle Domain Manager from a different circle is rejected.
    """
    other_manager = test_setup["other_circle_manager"]
    action = test_setup["action"]
    client = APIClient()
    client.force_authenticate(user=other_manager)

    url = f"/api/v1/governance/actions/{action.id}/"
    payload = {"action_point": "Malicious cross-circle edit"}

    resp = client.patch(url, payload, format="json")
    # Should be 403 or 404 (outside scope)
    assert resp.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]


@pytest.mark.django_db
@patch("apps.notifications.services.smtp_service.SMTPService.send_html_email", return_value=(True, MagicMock()))
def test_viewer_role_rejected(mock_send_email, test_setup):
    """
    Test 4: User with VIEWER role is strictly rejected from editing tasks.
    """
    viewer = test_setup["viewer"]
    action = test_setup["action"]
    client = APIClient()
    client.force_authenticate(user=viewer)

    url = f"/api/v1/governance/actions/{action.id}/"
    payload = {"action_point": "Viewer should not edit"}

    resp = client.patch(url, payload, format="json")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
@patch("apps.notifications.services.smtp_service.SMTPService.send_html_email", return_value=(True, MagicMock()))
def test_direct_target_date_modification_blocked(mock_send_email, test_setup):
    """
    Test 5: Directly updating target_closure_date or current_target_date is blocked.
    Target dates can only be revised through the revision request workflow.
    """
    admin = test_setup["admin"]
    action = test_setup["action"]
    client = APIClient()
    client.force_authenticate(user=admin)

    url = f"/api/v1/governance/actions/{action.id}/"
    payload = {
        "target_closure_date": "2026-12-31",
    }

    resp = client.patch(url, payload, format="json")
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert "Target dates cannot be modified directly" in str(resp.data.get("errors", ""))


@pytest.mark.django_db
@patch("apps.notifications.services.smtp_service.SMTPService.send_html_email", return_value=(True, MagicMock()))
def test_full_detail_endpoint_returns_can_edit_task(mock_send_email, test_setup):
    """
    Test 6: Full detail endpoint accurately returns can_edit_task flag.
    - True for admin and circle manager
    - False for viewer
    """
    action = test_setup["action"]
    client = APIClient()

    # Admin check
    client.force_authenticate(user=test_setup["admin"])
    resp_admin = client.get(f"/api/v1/governance/actions/{action.id}/full-detail/")
    assert resp_admin.status_code == status.HTTP_200_OK
    assert resp_admin.data["can_edit_task"] is True

    # Circle manager check
    client.force_authenticate(user=test_setup["circle_manager"])
    resp_mgr = client.get(f"/api/v1/governance/actions/{action.id}/full-detail/")
    assert resp_mgr.status_code == status.HTTP_200_OK
    assert resp_mgr.data["can_edit_task"] is True

    # Viewer check
    client.force_authenticate(user=test_setup["viewer"])
    resp_viewer = client.get(f"/api/v1/governance/actions/{action.id}/full-detail/")
    assert resp_viewer.status_code == status.HTTP_200_OK
    assert resp_viewer.data["can_edit_task"] is False
