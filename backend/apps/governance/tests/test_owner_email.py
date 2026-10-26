import pytest
from unittest.mock import patch
from django.utils import timezone
from apps.identity.models import User
from apps.organization.models import Circle
from apps.governance.models import GovernanceActionPoint
from apps.notifications.services.status_matrix_email_service import StatusMatrixEmailService
from apps.notifications.models import EmailDeliveryRecord


@pytest.fixture
def test_setup(db):
    circle = Circle.objects.create(name="Punjab Circle", code="PB", region="North")

    admin = User.objects.create_user(
        username="admin_user",
        email="admin@mapar.co.in",
        first_name="Admin",
        last_name="System",
        role=User.Role.SUPER_ADMIN,
        circle=circle,
    )

    owner = User.objects.create_user(
        username="rajveer_singh",
        email="rajveer.singh@pratap.co.in",
        first_name="Rajveer",
        last_name="Singh",
        role=User.Role.ACTION_OWNER,
        circle=circle,
    )

    # 1. Open task (eligible)
    act1 = GovernanceActionPoint.objects.create(
        action_id="ACT-PB-001",
        circle=circle,
        owner=owner,
        action_point="Safety Inspection Phase 1",
        status=GovernanceActionPoint.Status.OPEN,
        priority=GovernanceActionPoint.Priority.HIGH,
        target_closure_date=timezone.localdate() + timezone.timedelta(days=7),
    )

    # 2. WIP task (eligible, overdue)
    act2 = GovernanceActionPoint.objects.create(
        action_id="ACT-PB-002",
        circle=circle,
        owner=owner,
        action_point="Safety Inspection Phase 2",
        status=GovernanceActionPoint.Status.WIP,
        priority=GovernanceActionPoint.Priority.MEDIUM,
        target_closure_date=timezone.localdate() - timezone.timedelta(days=3),
    )

    # 3. Closed task (MUST BE EXCLUDED)
    act3 = GovernanceActionPoint.objects.create(
        action_id="ACT-PB-003",
        circle=circle,
        owner=owner,
        action_point="Safety Inspection Phase 3",
        status=GovernanceActionPoint.Status.CLOSED,
        priority=GovernanceActionPoint.Priority.HIGH,
        target_closure_date=timezone.localdate() - timezone.timedelta(days=10),
    )

    return {
        "admin": admin,
        "owner": owner,
        "circle": circle,
        "act1": act1,
        "act2": act2,
        "act3": act3,
    }


def test_scoped_owner_tasks_excludes_closed(test_setup):
    """
    CRITICAL REQUIREMENT: Verify closed tasks are strictly excluded from owner tasks.
    """
    admin = test_setup["admin"]
    owner = test_setup["owner"]

    tasks = StatusMatrixEmailService.get_scoped_owner_tasks(admin, owner_id=owner.id)

    # Exactly 2 tasks (act1, act2) - act3 is Closed and MUST be excluded
    assert len(tasks) == 2
    action_ids = [t.action_id for t in tasks]
    assert "ACT-PB-001" in action_ids
    assert "ACT-PB-002" in action_ids
    assert "ACT-PB-003" not in action_ids


def test_owner_email_preview_mixed_tasks(test_setup):
    """
    Verifies pre-send preview returns accurate recipient email and counts,
    and reflects closed task exclusion.
    """
    admin = test_setup["admin"]
    owner = test_setup["owner"]

    preview = StatusMatrixEmailService.get_owner_email_preview(admin, owner_id=owner.id)

    assert preview["recipient_email"] == "rajveer.singh@pratap.co.in"
    assert preview["recipient_name"] == "Rajveer Singh"
    assert preview["eligible_tasks_count"] == 2
    assert preview["total_assigned_count"] == 3
    assert preview["closed_excluded_count"] == 1
    assert preview["overdue_count"] == 1
    assert preview["high_priority_count"] == 1
    assert preview["has_eligible_tasks"] is True
    assert preview["no_eligible_reason"] is None


def test_owner_with_only_closed_tasks_excluded(db, test_setup):
    """
    CRITICAL REQUIREMENT: If every task assigned to the owner is Closed,
    do not send an email and display a clear explanation.
    """
    circle = test_setup["circle"]
    admin = test_setup["admin"]

    owner_closed_only = User.objects.create_user(
        username="vikram_aditya",
        email="vikram@pratap.co.in",
        first_name="Vikram",
        last_name="Aditya",
        role=User.Role.ACTION_OWNER,
        circle=circle,
    )

    # Assign only 2 closed tasks
    GovernanceActionPoint.objects.create(
        action_id="ACT-PB-098",
        circle=circle,
        owner=owner_closed_only,
        action_point="Completed Audit Task A",
        status=GovernanceActionPoint.Status.CLOSED,
        target_closure_date=timezone.localdate() - timezone.timedelta(days=20),
    )
    GovernanceActionPoint.objects.create(
        action_id="ACT-PB-099",
        circle=circle,
        owner=owner_closed_only,
        action_point="Completed Audit Task B",
        status=GovernanceActionPoint.Status.CLOSED,
        target_closure_date=timezone.localdate() - timezone.timedelta(days=15),
    )

    preview = StatusMatrixEmailService.get_owner_email_preview(admin, owner_id=owner_closed_only.id)
    assert preview["eligible_tasks_count"] == 0
    assert preview["total_assigned_count"] == 2
    assert preview["closed_excluded_count"] == 2
    assert preview["has_eligible_tasks"] is False
    assert "All 2 assigned tasks are Closed" in preview["no_eligible_reason"]

    # Attempt send should fail safely without sending
    result = StatusMatrixEmailService.send_owner_consolidated_email(admin, owner_id=owner_closed_only.id)
    assert result["success"] is False
    assert result["sent"] is False
    assert "All 2 assigned tasks are Closed" in result["message"]


def test_send_owner_consolidated_email_success(test_setup):
    """
    Verifies sending 1 consolidated email for the eligible tasks of that specific owner.
    """
    admin = test_setup["admin"]
    owner = test_setup["owner"]

    with patch("apps.notifications.services.smtp_service.SMTPService.send_html_email") as mock_send:
        # Mock successful delivery
        def mock_delivery(**kwargs):
            rec = EmailDeliveryRecord.objects.create(
                recipient_email=kwargs.get("recipient_email", "rajveer.singh@pratap.co.in"),
                subject=kwargs.get("subject", "Test Subject"),
                status=EmailDeliveryRecord.Status.SENT,
                notification_type=EmailDeliveryRecord.NotificationType.STATUS_MATRIX_DIGEST,
            )
            return (True, rec)

        mock_send.side_effect = mock_delivery

        result = StatusMatrixEmailService.send_owner_consolidated_email(admin, owner_id=owner.id)

        assert result["success"] is True
        assert result["sent"] is True
        assert result["task_count"] == 2
        assert "ACT-PB-001" in result["action_ids"]
        assert "ACT-PB-002" in result["action_ids"]
        assert "ACT-PB-003" not in result["action_ids"]

        # Ensure SMTPService was called once (consolidated email)
        assert mock_send.call_count == 1
        call_kwargs = mock_send.call_args[1]
        assert call_kwargs["recipient_email"] == "rajveer.singh@pratap.co.in"
        assert "ACT-PB-001" in call_kwargs["action_id"]
        assert "ACT-PB-002" in call_kwargs["action_id"]
