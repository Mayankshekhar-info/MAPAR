import io
import pytest
from datetime import timedelta
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from apps.identity.models import User
from apps.organization.models import MainCompany, SubCompany, Project, Circle
from apps.governance.models import GovernanceActionPoint, GovernanceEvidence


@pytest.fixture
def evidence_test_setup(db):
    company = MainCompany.objects.create(name="Apex Group", code="APEX")
    sub_co = SubCompany.objects.create(main_company=company, name="Apex Solar", code="ASOL")
    project = Project.objects.create(sub_company=sub_co, name="Solar Project Alpha", code="SPA")
    circle = Circle.objects.create(project=project, name="Rajasthan Circle", code="RJ", region="North")
    circle2 = Circle.objects.create(project=project, name="Gujarat Circle", code="GJ", region="West")

    admin = User.objects.create_superuser(
        username="admin_ev",
        email="admin_ev@mapar.com",
        password="password123",
        role=User.Role.SUPER_ADMIN,
    )

    manager = User.objects.create_user(
        username="circle_mgr",
        email="mgr@mapar.com",
        password="password123",
        role=User.Role.CIRCLE_DOMAIN_MANAGER,
        circle=circle,
        first_name="Vikram",
        last_name="Singh",
    )

    owner = User.objects.create_user(
        username="task_owner",
        email="owner@mapar.com",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle,
        first_name="Rohan",
        last_name="Sharma",
    )

    unauthorized_user = User.objects.create_user(
        username="other_person",
        email="other@mapar.com",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle2,
        first_name="Pooja",
        last_name="Verma",
    )

    today = timezone.localdate()
    action = GovernanceActionPoint.objects.create(
        action_id="ACT-EV01",
        circle=circle,
        function_area="Operations",
        action_point="Perform quarterly inverter thermal audit",
        key_deliverable="Thermal imaging report signed by site lead",
        owner=owner,
        assigned_by=manager,
        raised_date=today,
        target_closure_date=today + timedelta(days=14),
        current_target_date=today + timedelta(days=14),
        status="Open",
        priority="High",
        evidence_required=True,
    )

    return {
        "admin": admin,
        "manager": manager,
        "owner": owner,
        "unauthorized": unauthorized_user,
        "action": action,
        "circle": circle,
    }


@pytest.mark.django_db
def test_upload_evidence_and_versioning(evidence_test_setup):
    owner_client = APIClient()
    owner_client.force_authenticate(user=evidence_test_setup["owner"])
    action = evidence_test_setup["action"]

    # Upload Version 1
    file_content = b"Mock thermal inspection report content"
    file1 = SimpleUploadedFile("thermal_audit_v1.pdf", file_content, content_type="application/pdf")

    res = owner_client.post(
        f"/api/v1/governance/actions/{action.id}/evidence/",
        {"file": file1, "title": "Quarterly Thermal Report", "description": "Thermal test complete"},
        format="multipart",
    )
    assert res.status_code == 201
    ev_data = res.json()["evidence"]
    assert ev_data["version"] == 1
    assert ev_data["status"] == "Pending Review"
    assert ev_data["file_name"] == "thermal_audit_v1.pdf"

    action.refresh_from_db()
    assert action.evidence_status == "Pending Review"

    # Resubmission -> Upload Version 2
    file2 = SimpleUploadedFile("thermal_audit_v2.pdf", b"Updated audit content", content_type="application/pdf")
    res2 = owner_client.post(
        f"/api/v1/governance/actions/{action.id}/evidence/",
        {"file": file2, "title": "Quarterly Thermal Report v2", "description": "Added additional thermal scans"},
        format="multipart",
    )
    assert res2.status_code == 201
    assert res2.json()["evidence"]["version"] == 2

    # Verify both versions preserved in history
    hist_res = owner_client.get(f"/api/v1/governance/actions/{action.id}/evidence/")
    assert hist_res.status_code == 200
    items = hist_res.json()["evidence_items"]
    assert len(items) == 2
    versions = [i["version"] for i in items]
    assert 1 in versions and 2 in versions


@pytest.mark.django_db
def test_evidence_review_and_self_review_prevention(evidence_test_setup):
    owner = evidence_test_setup["owner"]
    manager = evidence_test_setup["manager"]
    action = evidence_test_setup["action"]

    # Create evidence submitted by owner
    file_mock = SimpleUploadedFile("report.pdf", b"test data", content_type="application/pdf")
    evidence = GovernanceEvidence.objects.create(
        action_point=action,
        version=1,
        title="Site Proof",
        file=file_mock,
        file_name="report.pdf",
        file_size=len(b"test data"),
        submitted_by=owner,
        status="Pending Review",
    )

    # 1. Owner tries to approve own evidence -> must be denied
    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)
    self_review_res = owner_client.post(
        f"/api/v1/governance/evidence/{evidence.id}/review/",
        {"decision": "Accepted", "review_comment": "Approving my own task"},
        format="json",
    )
    assert self_review_res.status_code in [403, 400]

    # 2. Manager reviews with Rework Required
    mgr_client = APIClient()
    mgr_client.force_authenticate(user=manager)
    rework_res = mgr_client.post(
        f"/api/v1/governance/evidence/{evidence.id}/review/",
        {"decision": "Rework Required", "review_comment": "Please include inverter temperature log sheet."},
        format="json",
    )
    assert rework_res.status_code == 200
    evidence.refresh_from_db()
    action.refresh_from_db()
    assert evidence.status == "Rework Required"
    assert action.evidence_status == "Rework Required"

    # 3. Manager accepts evidence
    accept_res = mgr_client.post(
        f"/api/v1/governance/evidence/{evidence.id}/review/",
        {"decision": "Accepted", "review_comment": "Report verified and compliant."},
        format="json",
    )
    assert accept_res.status_code == 200
    evidence.refresh_from_db()
    action.refresh_from_db()
    assert evidence.status == "Accepted"
    assert action.evidence_status == "Accepted"


@pytest.mark.django_db
def test_closure_rule_blocked_when_evidence_unaccepted(evidence_test_setup):
    owner_client = APIClient()
    owner_client.force_authenticate(user=evidence_test_setup["owner"])
    action = evidence_test_setup["action"]

    # Try closing task while evidence is Not Submitted -> blocked
    res = owner_client.patch(
        f"/api/v1/governance/actions/{action.id}/",
        {"status": "Closed"},
        format="json",
    )
    assert res.status_code == 400
    assert "evidence" in str(res.json()["errors"]).lower()

    # Now mark evidence accepted
    action.evidence_status = "Accepted"
    action.save()

    # Try closing task again -> success
    res_ok = owner_client.patch(
        f"/api/v1/governance/actions/{action.id}/",
        {"status": "Closed"},
        format="json",
    )
    assert res_ok.status_code == 200
    assert res_ok.json()["action"]["status"] == "Closed"


@pytest.mark.django_db
def test_my_evidence_and_secure_download(evidence_test_setup):
    owner = evidence_test_setup["owner"]
    action = evidence_test_setup["action"]

    file_mock = SimpleUploadedFile("evidence_doc.pdf", b"pdf data content", content_type="application/pdf")
    evidence = GovernanceEvidence.objects.create(
        action_point=action,
        version=1,
        title="Checklist",
        file=file_mock,
        file_name="evidence_doc.pdf",
        file_size=len(b"pdf data content"),
        submitted_by=owner,
        status="Pending Review",
    )

    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)

    # Check My Evidence endpoint
    my_ev_res = owner_client.get("/api/v1/governance/my-evidence/")
    assert my_ev_res.status_code == 200
    results = my_ev_res.json()["results"]
    assert len(results) == 1
    assert results[0]["title"] == "Checklist"

    # Authorized download
    dl_res = owner_client.get(f"/api/v1/governance/evidence/{evidence.id}/download/")
    assert dl_res.status_code == 200
    assert b"pdf data content" in b"".join(dl_res.streaming_content)

    # Unauthorized user download -> 403 Forbidden
    unauth_client = APIClient()
    unauth_client.force_authenticate(user=evidence_test_setup["unauthorized"])
    unauth_res = unauth_client.get(f"/api/v1/governance/evidence/{evidence.id}/download/")
    assert unauth_res.status_code in [403, 404]
