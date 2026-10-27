import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from apps.identity.models import User
from apps.organization.models import MainCompany, SubCompany, Project, Circle
from apps.governance.models import (
    GovernanceActionPoint,
    GovernanceWeeklyUpdate,
    GovernanceEvidence,
    GovernanceBulkOperationLog,
)


@pytest.fixture
def weekly_bulk_setup(db):
    company = MainCompany.objects.create(name="Apex Group", code="APEX")
    sub_co = SubCompany.objects.create(main_company=company, name="Apex Solar", code="ASOL")
    project = Project.objects.create(sub_company=sub_co, name="Solar Alpha", code="SA")
    circle1 = Circle.objects.create(project=project, name="Rajasthan Circle", code="RJ", region="North")
    circle2 = Circle.objects.create(project=project, name="Gujarat Circle", code="GJ", region="West")

    admin_user = User.objects.create_superuser(
        username="admin_wb",
        email="admin_wb@mapar.com",
        password="password123",
        role=User.Role.SUPER_ADMIN,
    )

    owner_user = User.objects.create_user(
        username="owner_wb1",
        email="owner_wb1@mapar.com",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle1,
        first_name="Ramesh",
        last_name="Sharma",
    )

    reviewer_user = User.objects.create_user(
        username="reviewer_wb",
        email="reviewer_wb@mapar.com",
        password="password123",
        role=User.Role.CIRCLE_DOMAIN_MANAGER,
        circle=circle1,
        first_name="Vikas",
        last_name="Mehta",
    )

    action1 = GovernanceActionPoint.objects.create(
        action_id="ACT-00501",
        circle=circle1,
        hierarchy_level="CIRCLE",
        hierarchy_node_id=circle1.id,
        hierarchy_path="Apex Group > Apex Solar > Solar Alpha > Rajasthan Circle",
        function_area="Operations",
        action_point="Inverter maintenance and firmware upgrade",
        key_deliverable="Complete inverter testing",
        owner=owner_user,
        assigned_by=reviewer_user,
        raised_date=timezone.localdate() - timedelta(days=10),
        target_closure_date=timezone.localdate() + timedelta(days=20),
        status=GovernanceActionPoint.Status.WIP,
        priority=GovernanceActionPoint.Priority.HIGH,
        created_by=admin_user,
    )

    action2 = GovernanceActionPoint.objects.create(
        action_id="ACT-00502",
        circle=circle1,
        hierarchy_level="CIRCLE",
        hierarchy_node_id=circle1.id,
        function_area="SCM",
        action_point="Procurement of spare cabling",
        key_deliverable="PO issued",
        owner=owner_user,
        assigned_by=reviewer_user,
        raised_date=timezone.localdate() - timedelta(days=5),
        target_closure_date=timezone.localdate() + timedelta(days=15),
        status=GovernanceActionPoint.Status.OPEN,
        priority=GovernanceActionPoint.Priority.MEDIUM,
        created_by=admin_user,
    )

    return {
        "admin": admin_user,
        "owner": owner_user,
        "reviewer": reviewer_user,
        "circle1": circle1,
        "circle2": circle2,
        "action1": action1,
        "action2": action2,
    }


@pytest.mark.django_db
def test_weekly_update_submission_and_duplicate_prevention(weekly_bulk_setup):
    client = APIClient()
    owner = weekly_bulk_setup["owner"]
    action1 = weekly_bulk_setup["action1"]
    client.force_authenticate(user=owner)

    # 1. First submission for 2026-W42
    resp = client.post(
        f"/api/v1/governance/actions/{action1.id}/weekly-updates/",
        {
            "reporting_week": "2026-W42",
            "work_completed": "Completed initial inspection of all inverters in Block A.",
            "progress_percent": 35,
            "achievements": "Tested 12 inverter units.",
            "blockers": "Rain delayed field testing on Tuesday.",
            "next_week_plan": "Proceed to Block B inspection.",
            "status": "WIP",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["success"] is True
    assert resp.data["weekly_update"]["progress_percent"] == 35

    # Check parent action point updated
    action1.refresh_from_db()
    assert action1.current_progress_percent == 35
    assert "2026-W42" in action1.last_update

    # 2. Subsequent submission in same week should succeed as separate entry (revision #2)
    dup_resp = client.post(
        f"/api/v1/governance/actions/{action1.id}/weekly-updates/",
        {
            "reporting_week": "2026-W42",
            "work_completed": "Second update in same week: Completed Block A and started Block B early.",
            "progress_percent": 50,
        },
        format="json",
    )
    assert dup_resp.status_code == 201
    assert dup_resp.data["weekly_update"]["progress_percent"] == 50
    assert dup_resp.data["weekly_update"]["revision_number"] == 2
    assert dup_resp.data["weekly_update"]["previous_progress_percent"] == 35

    # Check both updates exist separately
    assert GovernanceWeeklyUpdate.objects.filter(action_point=action1).count() == 2

    action1.refresh_from_db()
    assert action1.current_progress_percent == 50


@pytest.mark.django_db
def test_action_full_detail_endpoint(weekly_bulk_setup):
    client = APIClient()
    owner = weekly_bulk_setup["owner"]
    action1 = weekly_bulk_setup["action1"]
    client.force_authenticate(user=owner)

    # Add a weekly update first
    GovernanceWeeklyUpdate.objects.create(
        action_point=action1,
        reporting_week="2026-W41",
        work_completed="Preparation and documentation.",
        progress_percent=20,
        submitted_by=owner,
    )

    resp = client.get(f"/api/v1/governance/actions/{action1.id}/full-detail/")
    assert resp.status_code == 200
    assert resp.data["success"] is True
    assert resp.data["action"]["action_id"] == "ACT-00501"
    assert "Rajasthan Circle" in resp.data["resolved_hierarchy_path"]
    assert len(resp.data["weekly_updates"]) == 1
    assert len(resp.data["progress_trend"]) == 1
    assert resp.data["progress_trend"][0]["progress_percent"] == 20


@pytest.mark.django_db
def test_bulk_action_update(weekly_bulk_setup):
    client = APIClient()
    admin = weekly_bulk_setup["admin"]
    action1 = weekly_bulk_setup["action1"]
    action2 = weekly_bulk_setup["action2"]
    client.force_authenticate(user=admin)

    resp = client.post(
        "/api/v1/governance/actions/bulk-update/",
        {
            "task_ids": [action1.id, action2.id, 999999],
            "status": "WIP",
            "priority": "High",
        },
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["success"] is True
    bulk_result = resp.data["bulk_result"]
    assert bulk_result["total"] == 3
    assert bulk_result["successful_count"] == 2
    assert bulk_result["failed_count"] == 1

    action2.refresh_from_db()
    assert action2.status == GovernanceActionPoint.Status.WIP
    assert action2.priority == GovernanceActionPoint.Priority.HIGH

    # Check audit log created
    assert GovernanceBulkOperationLog.objects.filter(
        operation_type=GovernanceBulkOperationLog.OperationType.ACTION_BULK_UPDATE
    ).exists()


@pytest.mark.django_db
def test_bulk_weekly_submit(weekly_bulk_setup):
    client = APIClient()
    owner = weekly_bulk_setup["owner"]
    action1 = weekly_bulk_setup["action1"]
    action2 = weekly_bulk_setup["action2"]
    client.force_authenticate(user=owner)

    resp = client.post(
        "/api/v1/governance/weekly-updates/bulk-submit/",
        {
            "task_ids": [action1.id, action2.id],
            "reporting_week": "2026-W40",
            "work_completed": "Standard operational sprint review and field checks.",
            "progress_percent": 15,
            "status": "WIP",
        },
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["success"] is True
    bulk_result = resp.data["bulk_result"]
    assert bulk_result["successful_count"] == 2
    assert bulk_result["failed_count"] == 0

    assert GovernanceWeeklyUpdate.objects.filter(reporting_week="2026-W40").count() == 2


@pytest.mark.django_db
def test_hierarchy_users_endpoint(weekly_bulk_setup):
    client = APIClient()
    owner = weekly_bulk_setup["owner"]
    circle1 = weekly_bulk_setup["circle1"]
    client.force_authenticate(user=owner)

    resp = client.get(f"/api/v1/governance/hierarchy-users/?level=CIRCLE&node_id={circle1.id}")
    assert resp.status_code == 200
    assert resp.data["success"] is True
    usernames = [u["username"] for u in resp.data["users"]]
    assert "owner_wb1" in usernames


@pytest.mark.django_db
def test_weekly_template_download(weekly_bulk_setup):
    client = APIClient()
    owner = weekly_bulk_setup["owner"]
    client.force_authenticate(user=owner)

    resp = client.get("/api/v1/governance/weekly-updates/template/")
    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "MAPAR_Weekly_Progress_Template.xlsx" in resp["Content-Disposition"]

    import openpyxl
    import io
    wb = openpyxl.load_workbook(io.BytesIO(resp.content))
    ws = wb.active
    assert ws is not None
    # First row headers
    assert ws.cell(row=1, column=1).value == "Task ID"
    assert ws.cell(row=1, column=5).value == "Work Completed"
    # Row 2 contains pre-populated assigned task ACT-00501
    assert ws.cell(row=2, column=1).value == "ACT-00501"


@pytest.mark.django_db
def test_weekly_excel_upload_and_strict_access_control(weekly_bulk_setup):
    import io
    import openpyxl
    from django.core.files.uploadedfile import SimpleUploadedFile

    client = APIClient()
    owner = weekly_bulk_setup["owner"]
    circle2 = weekly_bulk_setup["circle2"]

    # Create another user and task belonging to User B
    user_b = User.objects.create_user(
        username="user_b",
        email="user_b@mapar.com",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle2,
    )
    unauthorized_action = GovernanceActionPoint.objects.create(
        action_id="ACT-00999",
        circle=circle2,
        function_area="SCM",
        action_point="Procurement of spare panels",
        key_deliverable="PO issued",
        owner=user_b,
        target_closure_date=timezone.localdate() + timedelta(days=15),
        status=GovernanceActionPoint.Status.WIP,
        priority=GovernanceActionPoint.Priority.LOW,
    )

    # Build Excel with 2 rows: 1 authorized (ACT-00501), 1 unauthorized (ACT-00999)
    wb = openpyxl.Workbook()
    ws = wb.active
    assert ws is not None
    headers = [
        "Task ID", "Task Title", "Week Start", "Week End", "Work Completed",
        "Progress %", "Status", "Blockers", "Next Week Plan", "Actual Closure", "Remarks"
    ]
    for c, h in enumerate(headers, 1):
        ws.cell(row=1, column=c, value=h)

    # Row 2: Authorized
    ws.cell(row=2, column=1, value="ACT-00501")
    ws.cell(row=2, column=2, value="Inverter maintenance")
    ws.cell(row=2, column=3, value="2026-10-19")
    ws.cell(row=2, column=4, value="2026-10-25")
    ws.cell(row=2, column=5, value="Replaced faulty DC cabling.")
    ws.cell(row=2, column=6, value=65)
    ws.cell(row=2, column=7, value="WIP")

    # Row 3: Unauthorized (belongs to user_b)
    ws.cell(row=3, column=1, value="ACT-00999")
    ws.cell(row=3, column=2, value="Procurement of spare panels")
    ws.cell(row=3, column=3, value="2026-10-19")
    ws.cell(row=3, column=4, value="2026-10-25")
    ws.cell(row=3, column=5, value="Attempting unauthorized update.")
    ws.cell(row=3, column=6, value=100)
    ws.cell(row=3, column=7, value="Closed")

    excel_file = io.BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    # User A (owner) uploads this file
    client.force_authenticate(user=owner)
    upload_file = SimpleUploadedFile(
        "weekly_updates.xlsx",
        excel_file.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

    # Test Preview endpoint
    preview_resp = client.post(
        "/api/v1/governance/weekly-updates/preview-excel/",
        {"file": upload_file},
        format="multipart",
    )
    assert preview_resp.status_code == 200
    assert preview_resp.data["success"] is True
    preview = preview_resp.data["preview"]
    assert preview["total_rows"] == 2
    assert preview["valid_rows_count"] == 1
    assert preview["invalid_rows_count"] == 1
    # Check unauthorized error on Row 3
    assert any("Unauthorized" in err for err in preview["rows"][1]["errors"])

    # Test Upload endpoint
    upload_file.seek(0)
    upload_resp = client.post(
        "/api/v1/governance/weekly-updates/upload-excel/",
        {"file": upload_file},
        format="multipart",
    )
    assert upload_resp.status_code == 200
    assert upload_resp.data["success"] is True
    import_result = upload_resp.data["import_result"]
    assert import_result["total"] == 2
    assert import_result["successful_count"] == 1
    assert import_result["failed_count"] == 1

    # Verify User A's task was updated
    assert GovernanceWeeklyUpdate.objects.filter(action_point__action_id="ACT-00501").count() == 1
    # Verify User B's task was NOT updated
    assert GovernanceWeeklyUpdate.objects.filter(action_point__action_id="ACT-00999").count() == 0

    # Test error report export endpoint
    error_report = import_result["error_report"]
    assert len(error_report) == 1
    report_resp = client.post(
        "/api/v1/governance/weekly-updates/export-error-report/",
        {"error_report": error_report},
        format="json",
    )
    assert report_resp.status_code == 200
    assert "Weekly_Updates_Error_Report.xlsx" in report_resp["Content-Disposition"]


@pytest.mark.django_db
def test_weekly_update_closure_blocked_without_accepted_evidence(weekly_bulk_setup):
    """
    Verifies that submit_weekly_update rejects setting Status.CLOSED if evidence is required and unaccepted.
    """
    from django.core.exceptions import ValidationError
    from apps.governance.services.governance_weekly_update_service import GovernanceWeeklyUpdateService

    action1 = weekly_bulk_setup["action1"]
    action1.evidence_required = True
    action1.evidence_status = GovernanceActionPoint.EvidenceStatus.NOT_SUBMITTED
    action1.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.APPROVED
    action1.save()

    owner = weekly_bulk_setup["owner"]

    with pytest.raises(ValidationError) as exc:
        GovernanceWeeklyUpdateService.submit_weekly_update(
            action_point=action1,
            data={
                "reporting_week": "2026-W45",
                "work_completed": "All actions completed",
                "progress_percent": 100,
                "status": GovernanceActionPoint.Status.CLOSED,
            },
            user=owner,
        )
    assert "Task cannot be marked Closed until required evidence has been submitted and Accepted" in str(exc.value)


@pytest.mark.django_db
def test_summary_metrics_owner_and_my_progress_metrics(weekly_bulk_setup):
    """
    Verifies that get_governance_summary_metrics computes owner_distribution, my_progress_metrics,
    and closure_performance accurately from database records.
    """
    from apps.governance.selectors.governance_selectors import get_governance_summary_metrics

    owner = weekly_bulk_setup["owner"]
    metrics = get_governance_summary_metrics(owner)

    assert "owner_distribution" in metrics
    assert "my_progress_metrics" in metrics
    assert "closure_performance" in metrics

    # Owner workload checks (action1 is WIP, action2 is Open)
    my_progress = metrics["my_progress_metrics"]
    assert my_progress["total"] == 2
    assert my_progress["open"] == 1
    assert my_progress["wip"] == 1

    # Verify owner_distribution lists owner_wb1 with correct stats
    owner_dist = metrics["owner_distribution"]
    assert len(owner_dist) >= 1
    found_owner = next((o for o in owner_dist if o["username"] == "owner_wb1"), None)
    assert found_owner is not None
    assert found_owner["total"] == 2
    assert found_owner["open"] == 1
    assert found_owner["wip"] == 1



