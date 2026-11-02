import pytest
from unittest.mock import patch, MagicMock
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import date

from apps.identity.models import User
from apps.organization.models import MainCompany, SubCompany, Project, Circle
from apps.governance.models import (
    GovernanceActionPoint,
    GovernanceTargetRevision,
    GovernanceWeeklyUpdate,
    GovernanceEvidence,
    GovernanceTaskReview,
)
from apps.governance.services.governance_service import GovernanceService
from apps.notifications.models import EmailDeliveryRecord


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
        first_name="Read",
        last_name="Only",
        role=User.Role.VIEWER,
        circle=circle1,
    )

    with patch("apps.notifications.services.task_assignment_email_service.TaskAssignmentEmailService.send_assignment_email"):
        action = GovernanceActionPoint.objects.create(
            action_id="ACT-00501",
            circle=circle1,
            hierarchy_level="CIRCLE",
            hierarchy_node_id=circle1.id,
            action_point="Upgrade telecom site power system",
            key_deliverable="Install lithium battery bank",
            owner=owner,
            assigned_by=circle_manager,
            created_by=circle_manager,
            raised_date=date(2026, 1, 15),
            target_closure_date=date(2026, 3, 31),
            current_target_date=date(2026, 3, 31),
            status=GovernanceActionPoint.Status.WIP,
            current_progress_percent=40,
        )

        # Attach revision, weekly update, evidence, review, and delivery log
        rev = GovernanceTargetRevision.objects.create(
            action_point=action,
            revision_number=1,
            previous_target=date(2026, 3, 31),
            revised_target=date(2026, 4, 15),
            reason="Supply delay",
            revised_by=circle_manager,
        )

        upd = GovernanceWeeklyUpdate.objects.create(
            action_point=action,
            reporting_week="Week 12",
            progress_percent=40,
            status=GovernanceActionPoint.Status.WIP,
            submitted_by=owner,
        )

        evi = GovernanceEvidence.objects.create(
            action_point=action,
            title="Battery PO",
            file_name="po.pdf",
            submitted_by=owner,
        )

        rev_review = GovernanceTaskReview.objects.create(
            action_point=action,
            assigned_reviewer=admin,
            status=GovernanceTaskReview.Status.PENDING_REVIEW,
        )

        delivery = EmailDeliveryRecord.objects.create(
            action_point=action,
            action_id=action.action_id,
            recipient_email=owner.email,
            subject="Task Assigned",
            status=EmailDeliveryRecord.Status.SENT,
        )

    return {
        "admin": admin,
        "circle_manager": circle_manager,
        "other_circle_manager": other_circle_manager,
        "owner": owner,
        "viewer": viewer,
        "action": action,
        "delivery": delivery,
    }


@pytest.mark.django_db
def test_super_admin_can_delete_task(test_setup):
    client = APIClient()
    client.force_authenticate(user=test_setup["admin"])

    action_id = test_setup["action"].id
    res = client.delete(f"/api/v1/governance/actions/{action_id}/")
    assert res.status_code == status.HTTP_200_OK
    assert res.data["success"] is True

    # Confirm action point is permanently deleted
    assert not GovernanceActionPoint.objects.filter(id=action_id).exists()
    # Confirm cascade deletion of related child records
    assert not GovernanceTargetRevision.objects.filter(action_point_id=action_id).exists()
    assert not GovernanceWeeklyUpdate.objects.filter(action_point_id=action_id).exists()
    assert not GovernanceEvidence.objects.filter(action_point_id=action_id).exists()
    assert not GovernanceTaskReview.objects.filter(action_point_id=action_id).exists()

    # Confirm EmailDeliveryRecord is retained with null action_point and intact action_id string
    test_setup["delivery"].refresh_from_db()
    assert test_setup["delivery"].action_point is None
    assert test_setup["delivery"].action_id == "ACT-00501"


@pytest.mark.django_db
def test_circle_manager_can_delete_task_in_their_circle(test_setup):
    client = APIClient()
    client.force_authenticate(user=test_setup["circle_manager"])

    action_id = test_setup["action"].id
    res = client.delete(f"/api/v1/governance/actions/{action_id}/")
    assert res.status_code == status.HTTP_200_OK
    assert res.data["success"] is True
    assert not GovernanceActionPoint.objects.filter(id=action_id).exists()


@pytest.mark.django_db
def test_other_circle_manager_cannot_delete_task(test_setup):
    client = APIClient()
    client.force_authenticate(user=test_setup["other_circle_manager"])

    action_id = test_setup["action"].id
    res = client.delete(f"/api/v1/governance/actions/{action_id}/")
    assert res.status_code == status.HTTP_403_FORBIDDEN
    assert GovernanceActionPoint.objects.filter(id=action_id).exists()


@pytest.mark.django_db
def test_action_owner_cannot_delete_task(test_setup):
    client = APIClient()
    client.force_authenticate(user=test_setup["owner"])

    action_id = test_setup["action"].id
    res = client.delete(f"/api/v1/governance/actions/{action_id}/")
    assert res.status_code == status.HTTP_403_FORBIDDEN
    assert GovernanceActionPoint.objects.filter(id=action_id).exists()


@pytest.mark.django_db
def test_viewer_cannot_delete_task(test_setup):
    client = APIClient()
    client.force_authenticate(user=test_setup["viewer"])

    action_id = test_setup["action"].id
    res = client.delete(f"/api/v1/governance/actions/{action_id}/")
    assert res.status_code == status.HTTP_403_FORBIDDEN
    assert GovernanceActionPoint.objects.filter(id=action_id).exists()


@pytest.mark.django_db
def test_delete_prohibited_in_audit_mode(test_setup):
    client = APIClient()
    client.force_authenticate(user=test_setup["admin"])

    action_id = test_setup["action"].id
    # Attempt delete with mode=audit
    res = client.delete(f"/api/v1/governance/actions/{action_id}/?mode=audit")
    assert res.status_code == status.HTTP_403_FORBIDDEN
    assert "Audit & Action Owner" in res.data["errors"]
    assert GovernanceActionPoint.objects.filter(id=action_id).exists()


@pytest.mark.django_db
def test_can_delete_task_helper(test_setup):
    action = test_setup["action"]
    admin = test_setup["admin"]
    mgr = test_setup["circle_manager"]
    other_mgr = test_setup["other_circle_manager"]
    owner = test_setup["owner"]
    viewer = test_setup["viewer"]

    assert GovernanceService.can_delete_task(action, admin) is True
    assert GovernanceService.can_delete_task(action, mgr) is True
    assert GovernanceService.can_delete_task(action, other_mgr) is False
    assert GovernanceService.can_delete_task(action, owner) is False
    assert GovernanceService.can_delete_task(action, viewer) is False

    # In audit mode, even admin is rejected
    assert GovernanceService.can_delete_task(action, admin, mode="audit") is False
