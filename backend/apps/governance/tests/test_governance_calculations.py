import pytest
from datetime import timedelta
from django.utils import timezone

from apps.identity.models import User
from apps.organization.models import MainCompany, SubCompany, Project, Circle
from apps.governance.models import (
    GovernanceActionPoint,
    GovernanceWeeklyUpdate,
)
from apps.governance.selectors.governance_selectors import (
    get_governance_summary_metrics,
    get_governance_actions,
)


@pytest.fixture
def calc_test_setup(db):
    company = MainCompany.objects.create(name="Tata Power", code="TPWR")
    sub_co = SubCompany.objects.create(main_company=company, name="Renewables", code="TPREN")
    project = Project.objects.create(sub_company=sub_co, name="Solar Rajasthan", code="SRJ")
    circle1 = Circle.objects.create(project=project, name="Jodhpur Circle", code="JDH", region="North")
    circle2 = Circle.objects.create(project=project, name="Nagpur Circle", code="NGP", region="West")

    admin = User.objects.create_superuser(
        username="super_calc",
        email="super_calc@mapar.com",
        password="password123",
        role=User.Role.SUPER_ADMIN,
    )

    owner1 = User.objects.create_user(
        username="owner_vikram",
        email="vikram@mapar.com",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle1,
        first_name="Vikram",
        last_name="Singh",
    )

    owner2 = User.objects.create_user(
        username="owner_anita",
        email="anita@mapar.com",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle2,
        first_name="Anita",
        last_name="Deshmukh",
    )

    today = timezone.localdate()

    # 1. Open, raised 3 days ago (0-7d), due in 2 days (due soon / on-track), owner1, circle1
    act1 = GovernanceActionPoint.objects.create(
        action_id="ACT-CALC-001",
        action_point="Inverter safety inspection",
        circle=circle1,
        owner=owner1,
        created_by=admin,
        status=GovernanceActionPoint.Status.OPEN,
        raised_date=today - timedelta(days=3),
        target_closure_date=today + timedelta(days=2),
        current_target_date=today + timedelta(days=2),
        reporting_week="Week 42",
        priority=GovernanceActionPoint.Priority.HIGH,
    )

    # 2. WIP, raised 10 days ago (8-15d), target was 2 days ago (overdue 2d -> 1-3d), owner1, circle1
    act2 = GovernanceActionPoint.objects.create(
        action_id="ACT-CALC-002",
        action_point="Transformer maintenance",
        circle=circle1,
        owner=owner1,
        created_by=admin,
        status=GovernanceActionPoint.Status.WIP,
        raised_date=today - timedelta(days=10),
        target_closure_date=today - timedelta(days=2),
        current_target_date=today - timedelta(days=2),
        reporting_week="Week 42",
        priority=GovernanceActionPoint.Priority.MEDIUM,
        current_progress_percent=50,
    )

    # 3. Open, raised 20 days ago (16-30d), target was 10 days ago (overdue 10d -> 8-15d), owner2, circle2
    act3 = GovernanceActionPoint.objects.create(
        action_id="ACT-CALC-003",
        action_point="Grid sync testing",
        circle=circle2,
        owner=owner2,
        created_by=admin,
        status=GovernanceActionPoint.Status.OPEN,
        raised_date=today - timedelta(days=20),
        target_closure_date=today - timedelta(days=10),
        current_target_date=today - timedelta(days=10),
        reporting_week="Week 43",
        priority=GovernanceActionPoint.Priority.HIGH,
    )

    # 4. WIP, raised 35 days ago (30+d -> escalated), target in 10 days (on track), owner2, circle2
    act4 = GovernanceActionPoint.objects.create(
        action_id="ACT-CALC-004",
        action_point="Substation boundary wall",
        circle=circle2,
        owner=owner2,
        created_by=admin,
        status=GovernanceActionPoint.Status.WIP,
        raised_date=today - timedelta(days=35),
        target_closure_date=today + timedelta(days=10),
        current_target_date=today + timedelta(days=10),
        reporting_week="Week 43",
        priority=GovernanceActionPoint.Priority.LOW,
        current_progress_percent=70,
    )

    # 5. Closed on time: raised 15 days ago, target 5 days ago, closed 6 days ago (<= target)
    act5 = GovernanceActionPoint.objects.create(
        action_id="ACT-CALC-005",
        action_point="Safety harness procurement",
        circle=circle1,
        owner=owner1,
        created_by=admin,
        status=GovernanceActionPoint.Status.CLOSED,
        raised_date=today - timedelta(days=15),
        target_closure_date=today - timedelta(days=5),
        current_target_date=today - timedelta(days=5),
        actual_closure_date=today - timedelta(days=6),
        reporting_week="Week 42",
        priority=GovernanceActionPoint.Priority.MEDIUM,
        current_progress_percent=100,
    )

    # 6. Closed delayed: raised 25 days ago, target 10 days ago, closed 5 days ago (> target)
    act6 = GovernanceActionPoint.objects.create(
        action_id="ACT-CALC-006",
        action_point="Earthing pit renewal",
        circle=circle2,
        owner=owner2,
        created_by=admin,
        status=GovernanceActionPoint.Status.CLOSED,
        raised_date=today - timedelta(days=25),
        target_closure_date=today - timedelta(days=10),
        current_target_date=today - timedelta(days=10),
        actual_closure_date=today - timedelta(days=5),
        reporting_week="Week 43",
        priority=GovernanceActionPoint.Priority.HIGH,
        current_progress_percent=100,
    )

    return {
        "admin": admin,
        "owner1": owner1,
        "owner2": owner2,
        "circle1": circle1,
        "circle2": circle2,
        "actions": [act1, act2, act3, act4, act5, act6],
        "today": today,
    }


def test_status_and_total_counts(calc_test_setup):
    admin = calc_test_setup["admin"]
    metrics = get_governance_summary_metrics(user=admin)

    assert metrics["total_actions"] == 6
    assert metrics["open_count"] == 2  # act1, act3
    assert metrics["wip_count"] == 2   # act2, act4
    assert metrics["closed_count"] == 2 # act5, act6
    assert metrics["status_counts"]["Open"] == 2
    assert metrics["status_counts"]["WIP"] == 2
    assert metrics["status_counts"]["Closed"] == 2
    assert metrics["completion_rate"] == round(2 / 6 * 100, 1)


def test_overdue_cross_screen_agreement(calc_test_setup):
    """
    Verifies that overdue_count matches across:
    - Top metric card
    - Circle distribution sum
    - Owner distribution sum
    - Table query when filtered by is_overdue=True
    """
    admin = calc_test_setup["admin"]
    metrics = get_governance_summary_metrics(user=admin)

    # Overdue tasks are act2 (WIP, target -2d) and act3 (OPEN, target -10d)
    assert metrics["overdue_count"] == 2

    # Check circle distribution sum
    circle_overdue_sum = sum(c["overdue"] for c in metrics["circle_distribution"])
    assert circle_overdue_sum == metrics["overdue_count"] == 2

    # Check owner distribution sum
    owner_overdue_sum = sum(o["overdue"] for o in metrics["owner_distribution"])
    assert owner_overdue_sum == metrics["overdue_count"] == 2

    # Check table query filter
    overdue_actions = get_governance_actions(filters={"is_overdue": True}, user=admin)
    assert overdue_actions.count() == 2
    overdue_ids = set(overdue_actions.values_list("action_id", flat=True))
    assert overdue_ids == {"ACT-CALC-002", "ACT-CALC-003"}

    # Check not overdue filter
    not_overdue_actions = get_governance_actions(filters={"is_overdue": False}, user=admin)
    assert not_overdue_actions.count() == 4


def test_ageing_buckets_consistency(calc_test_setup):
    """
    Verifies that ageing buckets sum to active items (open + wip),
    and table filter by ageing_bucket matches the bucket counts.
    """
    admin = calc_test_setup["admin"]
    metrics = get_governance_summary_metrics(user=admin)

    bucket_counts = metrics["bucket_counts"]
    # 0-7d: act1 (3d ago) -> 1
    # 8-15d: act2 (10d ago) -> 1
    # 16-30d: act3 (20d ago) -> 1
    # 30+d: act4 (35d ago) -> 1
    assert bucket_counts["0-7 Days"] == 1
    assert bucket_counts["8-15 Days"] == 1
    assert bucket_counts["16-30 Days"] == 1
    assert bucket_counts["30+ Days"] == 1

    total_active = metrics["open_count"] + metrics["wip_count"]
    assert sum(bucket_counts.values()) == total_active == 4

    # Table query matches each bucket
    assert get_governance_actions(filters={"ageing_bucket": "0-7 Days"}, user=admin).count() == 1
    assert get_governance_actions(filters={"ageing_bucket": "8-15 Days"}, user=admin).count() == 1
    assert get_governance_actions(filters={"ageing_bucket": "16-30 Days"}, user=admin).count() == 1
    assert get_governance_actions(filters={"ageing_bucket": "30+ Days"}, user=admin).count() == 1


def test_escalation_rules(calc_test_setup):
    """
    Verifies that active tasks with ageing > 30 days are escalated,
    and match summary count, circle distribution, and table query.
    """
    admin = calc_test_setup["admin"]
    metrics = get_governance_summary_metrics(user=admin)

    # act4 is active (WIP) and raised 35 days ago -> escalated
    assert metrics["escalated_count"] == 1

    circle_escalated_sum = sum(c["escalated"] for c in metrics["circle_distribution"])
    assert circle_escalated_sum == 1

    escalated_qs = get_governance_actions(filters={"is_escalated": True}, user=admin)
    assert escalated_qs.count() == 1
    assert escalated_qs.first().action_id == "ACT-CALC-004"


def test_closure_performance(calc_test_setup):
    """
    Verifies on_time_closed + delayed_closed == closed_count.
    """
    admin = calc_test_setup["admin"]
    metrics = get_governance_summary_metrics(user=admin)

    closure = metrics["closure_performance"]
    assert closure["on_time_closed"] == 1  # act5
    assert closure["delayed_closed"] == 1  # act6
    assert closure["on_time_closed"] + closure["delayed_closed"] == metrics["closed_count"] == 2
    assert closure["on_time_rate"] == 50.0


def test_overdue_ageing_chart_and_on_track_score(calc_test_setup):
    """
    Verifies overdue ageing buckets sum to active items,
    and on_track_score accurately calculates (closed + on_track_open) / total * 100.
    """
    admin = calc_test_setup["admin"]
    metrics = get_governance_summary_metrics(user=admin)

    chart = metrics["overdue_ageing_chart"]
    # active items = 4 (act1: on-track, act2: 2d overdue -> 1-3d, act3: 10d overdue -> 8-15d, act4: on-track)
    assert chart["not_yet_due"] == 2  # act1, act4
    assert chart["1-3d"] == 1         # act2 (2d late)
    assert chart["4-7d"] == 0
    assert chart["8-15d"] == 1        # act3 (10d late)
    assert chart["15+d"] == 0

    total_chart = sum(chart.values())
    assert total_chart == metrics["open_count"] + metrics["wip_count"] == 4

    # On track score: (2 closed + 2 open_on_track) / 6 total = 4/6 = 66.7%
    assert metrics["on_track_score"] == round((2 + 2) / 6 * 100, 1)


def test_reporting_week_scoping(calc_test_setup):
    """
    Verifies that filtering by reporting_week only returns matching tasks
    without mutating underlying dates or calculations.
    """
    admin = calc_test_setup["admin"]

    # Week 42 has act1, act2, act5 (3 tasks)
    w42_actions = get_governance_actions(filters={"reporting_week": "Week 42"}, user=admin)
    assert w42_actions.count() == 3
    w42_ids = set(w42_actions.values_list("action_id", flat=True))
    assert w42_ids == {"ACT-CALC-001", "ACT-CALC-002", "ACT-CALC-005"}

    # Week 43 has act3, act4, act6 (3 tasks)
    w43_actions = get_governance_actions(filters={"reporting_week": "Week 43"}, user=admin)
    assert w43_actions.count() == 3
    w43_ids = set(w43_actions.values_list("action_id", flat=True))
    assert w43_ids == {"ACT-CALC-003", "ACT-CALC-004", "ACT-CALC-006"}


def test_action_owner_scoped_progress_metrics(calc_test_setup):
    """
    Verifies my_progress_metrics for owner1:
    - total = 3 (act1, act2, act5)
    - open = 1 (act1)
    - wip = 1 (act2)
    - closed = 1 (act5)
    - overdue = 1 (act2)
    - completion_rate = 33.3%
    """
    owner1 = calc_test_setup["owner1"]
    metrics = get_governance_summary_metrics(user=owner1)

    my = metrics["my_progress_metrics"]
    assert my["total"] == 3
    assert my["open"] == 1
    assert my["wip"] == 1
    assert my["closed"] == 1
    assert my["overdue"] == 1
    assert my["completion_rate"] == round(1 / 3 * 100, 1)
