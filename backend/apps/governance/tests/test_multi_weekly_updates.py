import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from apps.identity.models import User
from apps.organization.models import MainCompany, SubCompany, Project, Circle
from apps.governance.models import GovernanceActionPoint, GovernanceWeeklyUpdate


@pytest.fixture
def multi_update_setup(db):
    company = MainCompany.objects.create(name="Apex Group", code="APEX")
    sub_co = SubCompany.objects.create(main_company=company, name="Apex Solar", code="ASOL")
    project = Project.objects.create(sub_company=sub_co, name="Solar Alpha", code="SA")
    circle1 = Circle.objects.create(project=project, name="Rajasthan Circle", code="RJ", region="North")
    circle2 = Circle.objects.create(project=project, name="Gujarat Circle", code="GJ", region="West")

    admin_user = User.objects.create_superuser(
        username="admin_multi",
        email="admin_multi@mapar.com",
        password="password123",
        role=User.Role.SUPER_ADMIN,
    )

    owner_user = User.objects.create_user(
        username="owner_multi1",
        email="owner_multi1@mapar.com",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle1,
        first_name="Sunil",
        last_name="Yadav",
    )

    unauthorized_user = User.objects.create_user(
        username="unauthorized_owner",
        email="unauth@mapar.com",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle2,
        first_name="Ravi",
        last_name="Kumar",
    )

    today = timezone.now().date()
    action = GovernanceActionPoint.objects.create(
        action_id="ACT-00999",
        circle=circle1,
        hierarchy_level="CIRCLE",
        hierarchy_node_id=circle1.id,
        hierarchy_path="Apex Group > Apex Solar > Solar Alpha > Rajasthan Circle",
        function_area="Engineering",
        action_point="Commissioning solar panel string monitoring sensors",
        key_deliverable="Sensor readings connected to SCADA",
        owner=owner_user,
        assigned_by=admin_user,
        created_by=admin_user,
        raised_date=today - timedelta(days=14),
        target_closure_date=today + timedelta(days=14),
        current_target_date=today + timedelta(days=14),
        status=GovernanceActionPoint.Status.OPEN,
        current_progress_percent=0,
    )

    return {
        "admin": admin_user,
        "owner": owner_user,
        "unauthorized": unauthorized_user,
        "circle": circle1,
        "action": action,
    }


@pytest.mark.django_db
class TestMultipleWeeklyTaskUpdates:
    def test_submit_three_updates_same_week_saved_separately(self, multi_update_setup):
        """
        Verify that a task owner can submit three sequential updates for the same task
        in the exact same reporting week, and all three are saved separately with full history.
        """
        client = APIClient()
        owner = multi_update_setup["owner"]
        action = multi_update_setup["action"]
        client.force_authenticate(user=owner)

        reporting_week = "2026-W43"

        # Update 1: 25% progress
        resp1 = client.post(
            f"/api/v1/governance/actions/{action.id}/weekly-updates/",
            {
                "reporting_week": reporting_week,
                "progress_percent": 25,
                "work_completed": "First pass: installed 10 sensors on string A",
                "status": "WIP",
                "achievements": "10 units online",
            },
            format="json",
        )
        assert resp1.status_code == 201, resp1.data
        assert resp1.data["success"] is True

        # Update 2: 60% progress (same week)
        resp2 = client.post(
            f"/api/v1/governance/actions/{action.id}/weekly-updates/",
            {
                "reporting_week": reporting_week,
                "progress_percent": 60,
                "work_completed": "Second pass: installed 15 more sensors on string B",
                "status": "WIP",
                "achievements": "Total 25 units online",
            },
            format="json",
        )
        assert resp2.status_code == 201, resp2.data
        assert resp2.data["success"] is True

        # Update 3: 85% progress (same week)
        resp3 = client.post(
            f"/api/v1/governance/actions/{action.id}/weekly-updates/",
            {
                "reporting_week": reporting_week,
                "progress_percent": 85,
                "work_completed": "Third pass: calibrations done, SCADA integration initiated",
                "status": "WIP",
                "next_week_plan": "Final sign-off and wrap up",
            },
            format="json",
        )
        assert resp3.status_code == 201, resp3.data
        assert resp3.data["success"] is True

        # Verify DB records
        updates = GovernanceWeeklyUpdate.objects.filter(action_point=action).order_by("submitted_at", "id")
        assert updates.count() == 3, f"Expected 3 records, found {updates.count()}"

        u1, u2, u3 = updates[0], updates[1], updates[2]

        # Verify revision numbers within the week
        assert u1.revision_number == 1
        assert u2.revision_number == 2
        assert u3.revision_number == 3

        # Verify update sequences
        assert u1.update_sequence == 1
        assert u2.update_sequence == 2
        assert u3.update_sequence == 3

        # Verify previous progress tracking
        assert u1.previous_progress_percent == 0
        assert u1.previous_status == "Open"
        assert u1.progress_percent == 25

        assert u2.previous_progress_percent == 25
        assert u2.previous_status == "WIP"
        assert u2.progress_percent == 60

        assert u3.previous_progress_percent == 60
        assert u3.previous_status == "WIP"
        assert u3.progress_percent == 85

        # Verify user identity & server timestamps
        for u in [u1, u2, u3]:
            assert u.submitted_by == owner
            assert u.submitted_at is not None

        # Verify action point state synchronized to latest update
        action.refresh_from_db()
        assert action.current_progress_percent == 85
        assert action.status == GovernanceActionPoint.Status.WIP
        assert "[2026-W43 #3]" in action.last_update

    def test_governance_logs_endpoints_display_all_records(self, multi_update_setup):
        """
        Verify that both weekly-updates and full-detail endpoints return all updates
        in proper sequence with previous values and current state preserved.
        """
        client = APIClient()
        owner = multi_update_setup["owner"]
        action = multi_update_setup["action"]
        client.force_authenticate(user=owner)

        reporting_week = "2026-W43"
        client.post(
            f"/api/v1/governance/actions/{action.id}/weekly-updates/",
            {"reporting_week": reporting_week, "progress_percent": 20, "work_completed": "Step 1", "status": "WIP"},
            format="json",
        )
        client.post(
            f"/api/v1/governance/actions/{action.id}/weekly-updates/",
            {"reporting_week": reporting_week, "progress_percent": 50, "work_completed": "Step 2", "status": "WIP"},
            format="json",
        )
        client.post(
            f"/api/v1/governance/actions/{action.id}/weekly-updates/",
            {"reporting_week": reporting_week, "progress_percent": 80, "work_completed": "Step 3", "status": "WIP"},
            format="json",
        )

        # 1. Test weekly-updates endpoint
        resp = client.get(f"/api/v1/governance/actions/{action.id}/weekly-updates/")
        assert resp.status_code == 200
        logs = resp.data["weekly_updates"] if "weekly_updates" in resp.data else (resp.data.get("results") or resp.data)
        assert len(logs) == 3
        assert logs[0]["revision_number"] == 1
        assert logs[0]["progress_percent"] == 20
        assert logs[1]["revision_number"] == 2
        assert logs[1]["previous_progress_percent"] == 20
        assert logs[1]["progress_percent"] == 50
        assert logs[2]["revision_number"] == 3
        assert logs[2]["previous_progress_percent"] == 50
        assert logs[2]["progress_percent"] == 80

        # 2. Test full-detail endpoint
        resp_detail = client.get(f"/api/v1/governance/actions/{action.id}/full-detail/")
        assert resp_detail.status_code == 200
        data = resp_detail.data
        assert data["success"] is True
        assert len(data["weekly_updates"]) == 3
        assert data["action"]["current_progress_percent"] == 80
        assert len(data["progress_trend"]) == 3
        assert data["progress_trend"][2]["progress_percent"] == 80

    def test_updates_across_multiple_weeks(self, multi_update_setup):
        """
        Verify that updates across subsequent weeks maintain overall sequence
        and reset revision_number per week.
        """
        client = APIClient()
        owner = multi_update_setup["owner"]
        action = multi_update_setup["action"]
        client.force_authenticate(user=owner)

        # Two updates in W43
        client.post(
            f"/api/v1/governance/actions/{action.id}/weekly-updates/",
            {"reporting_week": "2026-W43", "progress_percent": 30, "work_completed": "W43 Part 1", "status": "WIP"},
            format="json",
        )
        client.post(
            f"/api/v1/governance/actions/{action.id}/weekly-updates/",
            {"reporting_week": "2026-W43", "progress_percent": 50, "work_completed": "W43 Part 2", "status": "WIP"},
            format="json",
        )

        # One update in W44
        client.post(
            f"/api/v1/governance/actions/{action.id}/weekly-updates/",
            {"reporting_week": "2026-W44", "progress_percent": 75, "work_completed": "W44 Part 1", "status": "WIP"},
            format="json",
        )

        updates = GovernanceWeeklyUpdate.objects.filter(action_point=action).order_by("submitted_at", "id")
        assert updates.count() == 3

        w44_update = updates[2]
        assert w44_update.reporting_week == "2026-W44"
        assert w44_update.revision_number == 1
        assert w44_update.update_sequence == 3
        assert w44_update.previous_progress_percent == 50
        assert w44_update.progress_percent == 75

    def test_unauthorized_user_cannot_update_task(self, multi_update_setup):
        """
        Confirm that permissions are strictly enforced on the backend: an unauthorized
        user cannot submit weekly updates to another user's task.
        """
        client = APIClient()
        unauthorized = multi_update_setup["unauthorized"]
        action = multi_update_setup["action"]
        client.force_authenticate(user=unauthorized)

        resp = client.post(
            f"/api/v1/governance/actions/{action.id}/weekly-updates/",
            {"reporting_week": "2026-W43", "progress_percent": 50, "work_completed": "Hacked update", "status": "WIP"},
            format="json",
        )
        assert resp.status_code in [403, 404]
        assert GovernanceWeeklyUpdate.objects.filter(action_point=action).count() == 0

    def test_weekly_update_with_string_dates_and_closure(self, multi_update_setup):
        """
        Verify that posting string dates (like actual_closure_date, week_start_date, week_end_date)
        does not cause a TypeError: unsupported operand type(s) for -: 'str' and 'datetime.date'.
        """
        client = APIClient()
        owner = multi_update_setup["owner"]
        action = multi_update_setup["action"]
        action.evidence_required = False
        action.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.APPROVED
        action.save()
        client.force_authenticate(user=owner)

        resp = client.post(
            f"/api/v1/governance/actions/{action.id}/weekly-updates/",
            {
                "reporting_week": "2026-W44",
                "progress_percent": 100,
                "work_completed": "Work fully completed and closed.",
                "status": "Closed",
                "week_start_date": "2026-10-19",
                "week_end_date": "2026-10-25",
                "actual_closure_date": "2026-10-25",
            },
            format="json",
        )
        assert resp.status_code == 201, resp.data
        assert resp.data["success"] is True

        action.refresh_from_db()
        assert action.status == "Closed"
        assert str(action.actual_closure_date) == "2026-10-25"
        assert action.ageing_days >= 0

