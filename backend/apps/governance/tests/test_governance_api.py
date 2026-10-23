import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from apps.identity.models import User
from apps.organization.models import MainCompany, SubCompany, Project, Circle
from apps.governance.models import GovernanceActionPoint, GovernanceTargetRevision


@pytest.fixture
def auth_setup(db):
    company = MainCompany.objects.create(name="Apex Group", code="APEX")
    sub_co = SubCompany.objects.create(main_company=company, name="Apex Solar", code="ASOL")
    project = Project.objects.create(sub_company=sub_co, name="Solar Project Alpha", code="SPA")
    circle1 = Circle.objects.create(project=project, name="Rajasthan Circle", code="RJ", region="North")
    circle2 = Circle.objects.create(project=project, name="Maharashtra Circle", code="MH", region="West")

    admin_user = User.objects.create_superuser(
        username="admin_gov",
        email="admin_gov@mapar.com",
        password="password123",
        role=User.Role.SUPER_ADMIN,
    )

    owner_user = User.objects.create_user(
        username="action_owner1",
        email="owner1@mapar.com",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle1,
        first_name="Rajesh",
        last_name="Kumar",
    )

    other_user = User.objects.create_user(
        username="other_owner",
        email="other@mapar.com",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle2,
        first_name="Amit",
        last_name="Sharma",
    )

    return {
        "admin": admin_user,
        "owner": owner_user,
        "other": other_user,
        "circle1": circle1,
        "circle2": circle2,
    }


@pytest.mark.django_db
def test_create_and_list_action_point(auth_setup):
    client = APIClient()
    client.force_authenticate(user=auth_setup["admin"])

    today = timezone.localdate()
    target_date = today + timedelta(days=14)

    payload = {
        "circle_id": auth_setup["circle1"].id,
        "function_area": "Operations",
        "action_point": "Verify site contractor audit filings",
        "key_deliverable": "100% sign-offs obtained",
        "owner_id": auth_setup["owner"].id,
        "raised_date": today.strftime("%Y-%m-%d"),
        "target_closure_date": target_date.strftime("%Y-%m-%d"),
        "status": "Open",
        "priority": "High",
    }

    res = client.post("/api/v1/governance/actions/", payload, format="json")
    assert res.status_code == 201
    action_data = res.json()["action"]
    assert action_data["action_id"].startswith("ACT-")
    assert action_data["circle"]["code"] == "RJ"
    assert action_data["owner"]["username"] == "action_owner1"
    assert action_data["revision_count"] == 0
    assert action_data["ageing_days"] == 0
    assert action_data["ageing_bucket"] == "0-7 Days"
    assert action_data["is_escalated"] is False

    # List as admin
    list_res = client.get("/api/v1/governance/actions/")
    assert list_res.status_code == 200
    assert list_res.json()["count"] == 1


@pytest.mark.django_db
def test_scoped_owner_access(auth_setup):
    admin_client = APIClient()
    admin_client.force_authenticate(user=auth_setup["admin"])

    today = timezone.localdate()
    # Create action for owner1
    res1 = admin_client.post("/api/v1/governance/actions/", {
        "circle_id": auth_setup["circle1"].id,
        "function_area": "SCM",
        "action_point": "Procure replacement inverters",
        "owner_id": auth_setup["owner"].id,
        "target_closure_date": (today + timedelta(days=10)).strftime("%Y-%m-%d"),
    }, format="json")
    assert res1.status_code == 201

    # Create action for other_user in circle2
    res2 = admin_client.post("/api/v1/governance/actions/", {
        "circle_id": auth_setup["circle2"].id,
        "function_area": "Finance",
        "action_point": "Quarterly reconciliations for MH",
        "owner_id": auth_setup["other"].id,
        "target_closure_date": (today + timedelta(days=10)).strftime("%Y-%m-%d"),
    }, format="json")
    assert res2.status_code == 201

    # Owner 1 logs in
    owner_client = APIClient()
    owner_client.force_authenticate(user=auth_setup["owner"])

    owner_res = owner_client.get("/api/v1/governance/actions/")
    assert owner_res.status_code == 200
    # Should see action in their circle / assigned to them (action 1), but NOT action 2 (circle2)
    results = owner_res.json()["results"]
    assert len(results) == 1
    assert results[0]["action_point"] == "Procure replacement inverters"


@pytest.mark.django_db
def test_target_revision_flow(auth_setup):
    client = APIClient()
    client.force_authenticate(user=auth_setup["admin"])

    today = timezone.localdate()
    initial_target = today + timedelta(days=7)
    res = client.post("/api/v1/governance/actions/", {
        "circle_id": auth_setup["circle1"].id,
        "function_area": "IT/Systems",
        "action_point": "Deploy firmware update v2",
        "owner_id": auth_setup["owner"].id,
        "target_closure_date": initial_target.strftime("%Y-%m-%d"),
    }, format="json")
    action_id = res.json()["action"]["id"]

    new_target = today + timedelta(days=21)
    rev_res = client.post(f"/api/v1/governance/actions/{action_id}/revise-target/", {
        "new_target_date": new_target.strftime("%Y-%m-%d"),
        "reason": "OEM shipment delayed by 2 weeks",
        "approved_by": "VP Operations",
    }, format="json")
    assert rev_res.status_code == 200
    rev_data = rev_res.json()["revision"]
    assert rev_data["revision_number"] == 1
    assert rev_data["previous_target"] == initial_target.strftime("%Y-%m-%d")
    assert rev_data["revised_target"] == new_target.strftime("%Y-%m-%d")

    # Check updated action
    updated_action = rev_res.json()["action"]
    assert updated_action["revision_count"] == 1
    assert updated_action["current_target_date"] == new_target.strftime("%Y-%m-%d")


@pytest.mark.django_db
def test_metrics_endpoint(auth_setup):
    client = APIClient()
    client.force_authenticate(user=auth_setup["admin"])

    today = timezone.localdate()
    # Create an overdue item
    past_date = today - timedelta(days=40)
    past_target = today - timedelta(days=5)

    action = GovernanceActionPoint(
        action_id="ACT-9999",
        circle=auth_setup["circle1"],
        function_area="Operations",
        action_point="Old overdue item",
        raised_date=past_date,
        target_closure_date=past_target,
        current_target_date=past_target,
        status="Open",
        priority="High",
    )
    action.save()

    res = client.get("/api/v1/governance/metrics/")
    assert res.status_code == 200
    metrics = res.json()["metrics"]
    assert metrics["total_actions"] >= 1
    assert metrics["open_count"] >= 1
    assert metrics["overdue_count"] >= 1
    assert metrics["escalated_count"] >= 1 # Ageing > 30 and Open -> escalated
    assert metrics["bucket_counts"]["30+ Days"] >= 1


@pytest.mark.django_db
def test_template_download(auth_setup):
    client = APIClient()
    client.force_authenticate(user=auth_setup["admin"])

    res = client.get("/api/v1/governance/excel/template/")
    assert res.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in res["Content-Type"]
    assert len(res.content) > 1000


@pytest.mark.django_db
def test_task_assignment_by_id_email_and_username(auth_setup):
    """
    Verifies that assigning a task using integer User ID, case-insensitive email,
    or case-insensitive username correctly resolves to the canonical User record.
    """
    client = APIClient()
    client.force_authenticate(user=auth_setup["admin"])
    today = timezone.localdate()

    # Case 1: Assign via integer User ID
    res1 = client.post("/api/v1/governance/actions/", {
        "circle_id": auth_setup["circle1"].id,
        "action_point": "Task via User ID",
        "owner_id": auth_setup["owner"].id,
        "target_closure_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
    }, format="json")
    assert res1.status_code == 201
    assert res1.json()["action"]["owner"]["id"] == auth_setup["owner"].id
    assert res1.json()["action"]["owner"]["email"] == "owner1@mapar.com"

    # Case 2: Assign via case-insensitive registered email with whitespace
    res2 = client.post("/api/v1/governance/actions/", {
        "circle_id": auth_setup["circle1"].id,
        "action_point": "Task via Email Address",
        "owner_id": "   OWNER1@MAPAR.COM   ",
        "target_closure_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
    }, format="json")
    assert res2.status_code == 201
    assert res2.json()["action"]["owner"]["id"] == auth_setup["owner"].id
    assert res2.json()["action"]["owner"]["username"] == "action_owner1"

    # Case 3: Assign via case-insensitive username
    res3 = client.post("/api/v1/governance/actions/", {
        "circle_id": auth_setup["circle1"].id,
        "action_point": "Task via Username",
        "owner": "Action_Owner1",
        "target_closure_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
    }, format="json")
    assert res3.status_code == 201
    assert res3.json()["action"]["owner"]["id"] == auth_setup["owner"].id


@pytest.mark.django_db
def test_task_assignment_invalid_user_raises_validation_error(auth_setup):
    """
    Verifies that invalid or non-existent user inputs return a clear 400 Bad Request error.
    """
    client = APIClient()
    client.force_authenticate(user=auth_setup["admin"])
    today = timezone.localdate()

    # Invalid email
    res1 = client.post("/api/v1/governance/actions/", {
        "circle_id": auth_setup["circle1"].id,
        "action_point": "Task with invalid user email",
        "owner_id": "nonexistent.user@randomdomain.xyz",
        "target_closure_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
    }, format="json")
    assert res1.status_code == 400
    assert "owner_id" in res1.json()["errors"]

    # Invalid numeric user ID
    res2 = client.post("/api/v1/governance/actions/", {
        "circle_id": auth_setup["circle1"].id,
        "action_point": "Task with invalid numeric ID",
        "owner_id": 999999,
        "target_closure_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
    }, format="json")
    assert res2.status_code == 400
    assert "owner_id" in res2.json()["errors"]


@pytest.mark.django_db
def test_audit_owners_tab_visibility_and_scoping(auth_setup):
    """
    Verifies that assigned tasks appear in the Audit & Action Owners tab (view_mode=my_tasks),
    persist correctly, and are restricted from unrelated out-of-scope users.
    """
    admin_client = APIClient()
    admin_client.force_authenticate(user=auth_setup["admin"])
    today = timezone.localdate()

    # Create task assigned to owner1 via their email
    create_res = admin_client.post("/api/v1/governance/actions/", {
        "circle_id": auth_setup["circle1"].id,
        "action_point": "Critical Safety Audit Task",
        "owner_id": "owner1@mapar.com",
        "target_closure_date": (today + timedelta(days=5)).strftime("%Y-%m-%d"),
    }, format="json")
    assert create_res.status_code == 201
    task_id = create_res.json()["action"]["id"]

    # 1. Assigned user logs in and queries Audit & Action Owners tab (view_mode=my_tasks)
    owner_client = APIClient()
    owner_client.force_authenticate(user=auth_setup["owner"])

    audit_res = owner_client.get("/api/v1/governance/actions/?view_mode=my_tasks")
    assert audit_res.status_code == 200
    owner_tasks = audit_res.json()["results"]
    assert len(owner_tasks) == 1
    assert owner_tasks[0]["id"] == task_id
    assert owner_tasks[0]["action_point"] == "Critical Safety Audit Task"
    assert owner_tasks[0]["owner"]["id"] == auth_setup["owner"].id

    # 2. Detail view accessible to assigned owner
    detail_res = owner_client.get(f"/api/v1/governance/actions/{task_id}/")
    assert detail_res.status_code == 200
    assert detail_res.json()["action"]["id"] == task_id

    # 3. Another user in a different circle (other_owner in circle2) logs in
    other_client = APIClient()
    other_client.force_authenticate(user=auth_setup["other"])

    other_audit_res = other_client.get("/api/v1/governance/actions/?view_mode=my_tasks")
    assert other_audit_res.status_code == 200
    assert len(other_audit_res.json()["results"]) == 0

    # Unrelated user cannot view restricted task details
    other_detail_res = other_client.get(f"/api/v1/governance/actions/{task_id}/")
    assert other_detail_res.status_code == 403


@pytest.mark.django_db
def test_reassignment_updates_audit_visibility(auth_setup):
    """
    Verifies that reassigning a task dynamically updates visibility in the Audit tab:
    previous owner no longer sees it in my_tasks, new owner immediately sees it.
    """
    admin_client = APIClient()
    admin_client.force_authenticate(user=auth_setup["admin"])
    today = timezone.localdate()

    # Initially assigned to owner1
    res = admin_client.post("/api/v1/governance/actions/", {
        "circle_id": auth_setup["circle1"].id,
        "action_point": "Asset Verification Project",
        "owner_id": auth_setup["owner"].id,
        "target_closure_date": (today + timedelta(days=12)).strftime("%Y-%m-%d"),
    }, format="json")
    assert res.status_code == 201
    task_id = res.json()["action"]["id"]

    # Reassign to other_owner via username
    patch_res = admin_client.patch(f"/api/v1/governance/actions/{task_id}/", {
        "owner_id": "other_owner",
    }, format="json")
    assert patch_res.status_code == 200
    assert patch_res.json()["action"]["owner"]["id"] == auth_setup["other"].id

    # Owner 1 checks my_tasks -> Should be 0
    owner_client = APIClient()
    owner_client.force_authenticate(user=auth_setup["owner"])
    owner_res = owner_client.get("/api/v1/governance/actions/?view_mode=my_tasks")
    assert len(owner_res.json()["results"]) == 0

    # New owner checks my_tasks -> Should see the task
    other_client = APIClient()
    other_client.force_authenticate(user=auth_setup["other"])
    other_res = other_client.get("/api/v1/governance/actions/?view_mode=my_tasks")
    assert len(other_res.json()["results"]) == 1
    assert other_res.json()["results"][0]["id"] == task_id
