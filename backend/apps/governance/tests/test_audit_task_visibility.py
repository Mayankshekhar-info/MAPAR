import pytest
from rest_framework.test import APIClient
from django.utils import timezone
from apps.identity.models import User
from apps.organization.models import Circle
from apps.governance.models import GovernanceActionPoint, GovernanceTaskReview
from apps.governance.selectors.governance_selectors import (
    get_governance_actions,
    get_governance_summary_metrics,
)


@pytest.fixture
def visibility_setup(db):
    circle = Circle.objects.create(name="Punjab Circle", code="PB", region="North")

    # User A: Action Owner with 5 tasks
    user_a = User.objects.create_user(
        username="user_a",
        email="user_a@telecrats.in",
        first_name="User",
        last_name="Alpha",
        role=User.Role.ACTION_OWNER,
        circle=circle,
    )

    # User B: Action Owner with 2 tasks in the SAME circle
    user_b = User.objects.create_user(
        username="user_b",
        email="user_b@telecrats.in",
        first_name="User",
        last_name="Bravo",
        role=User.Role.ACTION_OWNER,
        circle=circle,
    )

    # User C: Action Owner with 0 tasks
    user_c = User.objects.create_user(
        username="user_c",
        email="user_c@telecrats.in",
        first_name="User",
        last_name="Charlie",
        role=User.Role.ACTION_OWNER,
        circle=circle,
    )

    today = timezone.localdate()

    # User A Tasks: 5 tasks
    # 1: Open, High priority, due in 4 days (upcoming/due soon)
    # 2: WIP, Medium priority, overdue by 2 days
    # 3: Closed
    # 4: Open, due in 20 days
    # 5: WIP, due in 15 days
    a_tasks = [
        GovernanceActionPoint.objects.create(
            action_id="ACT-PB-A01",
            circle=circle,
            owner=user_a,
            action_point="User A Task 1 - Open Due Soon",
            status=GovernanceActionPoint.Status.OPEN,
            priority=GovernanceActionPoint.Priority.HIGH,
            target_closure_date=today + timezone.timedelta(days=4),
            current_target_date=today + timezone.timedelta(days=4),
        ),
        GovernanceActionPoint.objects.create(
            action_id="ACT-PB-A02",
            circle=circle,
            owner=user_a,
            action_point="User A Task 2 - Overdue WIP",
            status=GovernanceActionPoint.Status.WIP,
            priority=GovernanceActionPoint.Priority.MEDIUM,
            target_closure_date=today - timezone.timedelta(days=2),
            current_target_date=today - timezone.timedelta(days=2),
        ),
        GovernanceActionPoint.objects.create(
            action_id="ACT-PB-A03",
            circle=circle,
            owner=user_a,
            action_point="User A Task 3 - Closed",
            status=GovernanceActionPoint.Status.CLOSED,
            priority=GovernanceActionPoint.Priority.LOW,
            target_closure_date=today - timezone.timedelta(days=10),
            current_target_date=today - timezone.timedelta(days=10),
        ),
        GovernanceActionPoint.objects.create(
            action_id="ACT-PB-A04",
            circle=circle,
            owner=user_a,
            action_point="User A Task 4 - Open Normal",
            status=GovernanceActionPoint.Status.OPEN,
            priority=GovernanceActionPoint.Priority.MEDIUM,
            target_closure_date=today + timezone.timedelta(days=20),
            current_target_date=today + timezone.timedelta(days=20),
        ),
        GovernanceActionPoint.objects.create(
            action_id="ACT-PB-A05",
            circle=circle,
            owner=user_a,
            action_point="User A Task 5 - WIP Normal",
            status=GovernanceActionPoint.Status.WIP,
            priority=GovernanceActionPoint.Priority.HIGH,
            target_closure_date=today + timezone.timedelta(days=15),
            current_target_date=today + timezone.timedelta(days=15),
        ),
    ]

    # User B Tasks: 2 tasks
    b_tasks = [
        GovernanceActionPoint.objects.create(
            action_id="ACT-PB-B01",
            circle=circle,
            owner=user_b,
            action_point="User B Task 1 - Open",
            status=GovernanceActionPoint.Status.OPEN,
            priority=GovernanceActionPoint.Priority.HIGH,
            target_closure_date=today + timezone.timedelta(days=5),
            current_target_date=today + timezone.timedelta(days=5),
        ),
        GovernanceActionPoint.objects.create(
            action_id="ACT-PB-B02",
            circle=circle,
            owner=user_b,
            action_point="User B Task 2 - Closed",
            status=GovernanceActionPoint.Status.CLOSED,
            priority=GovernanceActionPoint.Priority.LOW,
            target_closure_date=today - timezone.timedelta(days=5),
            current_target_date=today - timezone.timedelta(days=5),
        ),
    ]

    return {
        "circle": circle,
        "user_a": user_a,
        "user_b": user_b,
        "user_c": user_c,
        "a_tasks": a_tasks,
        "b_tasks": b_tasks,
    }


@pytest.mark.django_db
def test_user_a_sees_only_own_tasks(visibility_setup):
    """Scenario A: User A has 5 tasks. Must see exactly 5 tasks, none of User B's tasks."""
    user_a = visibility_setup["user_a"]

    # 1. Test via selector with mode="audit"
    qs = get_governance_actions({"mode": "audit", "view_mode": "my_tasks"}, user=user_a)
    assert qs.count() == 5
    action_ids = [act.action_id for act in qs]
    assert set(action_ids) == {"ACT-PB-A01", "ACT-PB-A02", "ACT-PB-A03", "ACT-PB-A04", "ACT-PB-A05"}
    assert "ACT-PB-B01" not in action_ids
    assert "ACT-PB-B02" not in action_ids

    # 2. Test via REST API endpoint /governance/actions/
    client = APIClient()
    client.force_authenticate(user=user_a)
    response = client.get("/api/v1/governance/actions/?mode=audit&view_mode=my_tasks")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 5
    api_ids = [act["action_id"] for act in data["results"]]
    assert set(api_ids) == {"ACT-PB-A01", "ACT-PB-A02", "ACT-PB-A03", "ACT-PB-A04", "ACT-PB-A05"}


@pytest.mark.django_db
def test_user_b_sees_only_own_tasks(visibility_setup):
    """Scenario B: User B has 2 tasks in the same circle. Must see exactly 2 tasks, none of User A's tasks."""
    user_b = visibility_setup["user_b"]

    client = APIClient()
    client.force_authenticate(user=user_b)
    response = client.get("/api/v1/governance/actions/?mode=audit&view_mode=my_tasks")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 2
    api_ids = [act["action_id"] for act in data["results"]]
    assert set(api_ids) == {"ACT-PB-B01", "ACT-PB-B02"}


@pytest.mark.django_db
def test_user_c_sees_zero_tasks(visibility_setup):
    """Scenario C: User C has no assigned tasks. Must see 0 tasks and 0 counts."""
    user_c = visibility_setup["user_c"]

    client = APIClient()
    client.force_authenticate(user=user_c)
    response = client.get("/api/v1/governance/actions/?mode=audit&view_mode=my_tasks")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 0
    assert len(data["results"]) == 0

    # Summary metrics must also be 0
    metrics_res = client.get("/api/v1/governance/metrics/?mode=audit")
    assert metrics_res.status_code == 200
    metrics = metrics_res.json()["metrics"]
    assert metrics["total_actions"] == 0
    assert metrics["open_count"] == 0
    assert metrics["wip_count"] == 0
    assert metrics["closed_count"] == 0
    assert metrics["my_progress_metrics"]["total"] == 0


@pytest.mark.django_db
def test_user_a_metrics_counts_match_assigned_tasks(visibility_setup):
    """Test that summary metrics accurately match User A's 5 tasks."""
    user_a = visibility_setup["user_a"]

    client = APIClient()
    client.force_authenticate(user=user_a)
    response = client.get("/api/v1/governance/metrics/?mode=audit")
    assert response.status_code == 200
    metrics = response.json()["metrics"]

    # 5 total tasks for User A (2 open, 2 wip, 1 closed)
    assert metrics["total_actions"] == 5
    assert metrics["open_count"] == 2
    assert metrics["wip_count"] == 2
    assert metrics["closed_count"] == 1
    # 1 task is overdue (A02)
    assert metrics["overdue_count"] == 1
    # 1 task is due soon (A01 - due in 4 days)
    assert metrics["upcoming_count"] == 1

    # Personal progress metrics should match top-level exactly in audit mode
    assert metrics["my_progress_metrics"]["total"] == 5
    assert metrics["my_progress_metrics"]["open"] == 2
    assert metrics["my_progress_metrics"]["wip"] == 2
    assert metrics["my_progress_metrics"]["closed"] == 1
    assert metrics["my_progress_metrics"]["overdue"] == 1
    assert metrics["my_progress_metrics"]["upcoming"] == 1


@pytest.mark.django_db
def test_reassignment_updates_visibility_immediately(visibility_setup):
    """Scenario D: Reassigning task owner updates visibility and counts immediately.
    When A01 is reassigned from User A to User B:
    - User A now has 4 tasks
    - User B now has 3 tasks
    """
    user_a = visibility_setup["user_a"]
    user_b = visibility_setup["user_b"]
    a_task1 = visibility_setup["a_tasks"][0]

    # Reassign A01 to User B
    a_task1.owner = user_b
    a_task1.save()

    client_a = APIClient()
    client_a.force_authenticate(user=user_a)
    res_a = client_a.get("/api/v1/governance/actions/?mode=audit&view_mode=my_tasks")
    assert res_a.json()["count"] == 4
    assert a_task1.action_id not in [act["action_id"] for act in res_a.json()["results"]]

    client_b = APIClient()
    client_b.force_authenticate(user=user_b)
    res_b = client_b.get("/api/v1/governance/actions/?mode=audit&view_mode=my_tasks")
    assert res_b.json()["count"] == 3
    assert a_task1.action_id in [act["action_id"] for act in res_b.json()["results"]]


@pytest.mark.django_db
def test_direct_api_tampering_blocked_in_audit_mode(visibility_setup):
    """Scenario F: User B cannot pass owner_id=<user_a.id> or owner_name='User Alpha'
    in audit mode to see User A's tasks."""
    user_a = visibility_setup["user_a"]
    user_b = visibility_setup["user_b"]

    client = APIClient()
    client.force_authenticate(user=user_b)

    # Attempt to query with User A's owner_id
    response = client.get(f"/api/v1/governance/actions/?mode=audit&owner_id={user_a.id}")
    assert response.status_code == 200
    assert response.json()["count"] == 0

    # Attempt to query with User A's name
    response_name = client.get(f"/api/v1/governance/actions/?mode=audit&owner_name={user_a.username}")
    assert response_name.status_code == 200
    assert response_name.json()["count"] == 0


@pytest.mark.django_db
def test_reviewer_assignment_visibility(visibility_setup):
    """Scenario G: When a task is assigned to a reviewer, the reviewer sees it under
    'assigned_to_me' and 'pending_reviews', but other users do not."""
    user_a = visibility_setup["user_a"]
    user_b = visibility_setup["user_b"]
    a_task2 = visibility_setup["a_tasks"][1]

    # Assign user_b as reviewer
    a_task2.assigned_reviewer = user_b
    a_task2.review_workflow_status = "Pending Review"
    a_task2.save()

    client_b = APIClient()
    client_b.force_authenticate(user=user_b)

    # User B checks assigned_to_me
    res = client_b.get("/api/v1/governance/actions/?mode=audit&view_mode=assigned_to_me")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 1
    assert data["results"][0]["action_id"] == "ACT-PB-A02"

    # User B checks pending_reviews
    res_pending = client_b.get("/api/v1/governance/actions/?mode=audit&view_mode=pending_reviews")
    assert res_pending.status_code == 200
    assert res_pending.json()["count"] == 1

    # User A checks assigned_to_me -> should be 0 because User A is the owner, not the reviewer
    client_a = APIClient()
    client_a.force_authenticate(user=user_a)
    res_a = client_a.get("/api/v1/governance/actions/?mode=audit&view_mode=assigned_to_me")
    assert res_a.status_code == 200
    assert res_a.json()["count"] == 0
