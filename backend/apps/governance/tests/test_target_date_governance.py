import pytest
from datetime import timedelta
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.identity.models import User
from apps.organization.models import MainCompany, SubCompany, Project, Circle
from apps.governance.models import (
    GovernanceActionPoint,
    GovernanceTargetRevision,
    GovernanceEvidence,
    GovernanceTargetRevisionRequest,
)
from apps.governance.services.governance_service import GovernanceService
from apps.governance.services.governance_evidence_service import GovernanceEvidenceService


@pytest.fixture
def gov_test_setup(db):
    company = MainCompany.objects.create(name="Tata Power", code="TPWR")
    sub_co = SubCompany.objects.create(main_company=company, name="Renewables", code="TPREN")
    project = Project.objects.create(sub_company=sub_co, name="Solar Rajasthan", code="SRJ")
    circle1 = Circle.objects.create(project=project, name="Jodhpur Circle", code="JDH", region="North")
    circle2 = Circle.objects.create(project=project, name="Nagpur Circle", code="NGP", region="West")

    admin = User.objects.create_superuser(
        username="super_gov",
        email="super@mapar.com",
        password="password123",
        role=User.Role.SUPER_ADMIN,
    )

    manager_c1 = User.objects.create_user(
        username="circle_mgr_jdh",
        email="mgr_jdh@mapar.com",
        password="password123",
        role=User.Role.CIRCLE_DOMAIN_MANAGER,
        circle=circle1,
        first_name="Sanjay",
        last_name="Verma",
    )

    manager_c2 = User.objects.create_user(
        username="circle_mgr_ngp",
        email="mgr_ngp@mapar.com",
        password="password123",
        role=User.Role.CIRCLE_DOMAIN_MANAGER,
        circle=circle2,
        first_name="Ramesh",
        last_name="Patil",
    )

    assignee_owner = User.objects.create_user(
        username="assignee_rajesh",
        email="rajesh@mapar.com",
        password="password123",
        role=User.Role.ACTION_OWNER,
        circle=circle1,
        first_name="Rajesh",
        last_name="Meena",
    )

    today = timezone.localdate()
    orig_target = today + timedelta(days=14)

    action = GovernanceActionPoint.objects.create(
        action_id="GOV-TST-001",
        circle=circle1,
        function_area="Operations",
        action_point="Inverter synchronization calibration",
        key_deliverable="Complete 100% calibration certificate",
        owner=assignee_owner,
        assigned_by=manager_c1,
        raised_date=today,
        target_closure_date=orig_target,
        current_target_date=orig_target,
        revision_count=0,
        status=GovernanceActionPoint.Status.OPEN,
        evidence_required=True,
        created_by=admin,
    )

    return {
        "admin": admin,
        "manager_c1": manager_c1,
        "manager_c2": manager_c2,
        "assignee_owner": assignee_owner,
        "circle1": circle1,
        "circle2": circle2,
        "action": action,
        "today": today,
        "orig_target": orig_target,
    }


# Scenario 1 & 2: Assignee cannot directly change Revised Target Date via API (revise-target or PATCH)
@pytest.mark.django_db
def test_assignee_cannot_directly_change_target_date(gov_test_setup):
    client = APIClient()
    assignee = gov_test_setup["assignee_owner"]
    action = gov_test_setup["action"]
    client.force_authenticate(user=assignee)

    new_date = gov_test_setup["orig_target"] + timedelta(days=7)

    # Attempt direct revise-target endpoint
    res_direct = client.post(
        f"/api/v1/governance/actions/{action.id}/revise-target/",
        {"new_target_date": str(new_date), "reason": "Need more time directly"},
        format="json",
    )
    assert res_direct.status_code == 403, f"Expected 403 Forbidden for assignee direct revise, got {res_direct.status_code}"

    # Attempt to bypass via PATCH on action endpoint
    res_patch = client.patch(
        f"/api/v1/governance/actions/{action.id}/",
        {"current_target_date": str(new_date), "target_closure_date": str(new_date)},
        format="json",
    )
    assert res_patch.status_code == 403, f"Expected 403 Forbidden for PATCH date bypass, got {res_patch.status_code}"

    action.refresh_from_db()
    assert action.current_target_date == gov_test_setup["orig_target"]
    assert action.target_closure_date == gov_test_setup["orig_target"]


# Scenario 3 & 4: Target date request appears as Pending; active target date does NOT change before approval
@pytest.mark.django_db
def test_target_date_request_workflow_submission(gov_test_setup):
    client = APIClient()
    assignee = gov_test_setup["assignee_owner"]
    action = gov_test_setup["action"]
    client.force_authenticate(user=assignee)

    requested_date = gov_test_setup["orig_target"] + timedelta(days=10)

    # 1. Submit request without mandatory reason -> should fail with 400
    res_fail = client.post(
        f"/api/v1/governance/actions/{action.id}/revision-requests/",
        {"requested_target_date": str(requested_date), "reason": "   "},
        format="json",
    )
    assert res_fail.status_code == 400

    # 2. Submit valid request
    res_req = client.post(
        f"/api/v1/governance/actions/{action.id}/revision-requests/",
        {"requested_target_date": str(requested_date), "reason": "Vendor delay in sensor procurement"},
        format="json",
    )
    assert res_req.status_code == 201
    req_data = res_req.data["revision_request"]
    assert req_data["status"] == "Pending"
    assert req_data["requested_target_date"] == str(requested_date)
    assert req_data["original_target_date"] == str(gov_test_setup["orig_target"])
    assert req_data["current_target_date"] == str(gov_test_setup["orig_target"])

    # Verify active target date did NOT change
    action.refresh_from_db()
    assert action.current_target_date == gov_test_setup["orig_target"]
    assert action.revision_count == 0

    # 3. Prevent duplicate pending requests for the same task
    res_dup = client.post(
        f"/api/v1/governance/actions/{action.id}/revision-requests/",
        {"requested_target_date": str(requested_date + timedelta(days=2)), "reason": "Second request"},
        format="json",
    )
    assert res_dup.status_code == 400
    assert "already pending" in str(res_dup.data).lower()


# Scenario 5 & 7: Authorized reviewer approves request -> Revised Target Date updates; Original Target Date remains unchanged
@pytest.mark.django_db
def test_approval_updates_revised_target_and_preserves_original(gov_test_setup):
    assignee = gov_test_setup["assignee_owner"]
    manager = gov_test_setup["manager_c1"]
    action = gov_test_setup["action"]

    requested_date = gov_test_setup["orig_target"] + timedelta(days=12)

    # Assignee creates request
    req = GovernanceService.submit_target_revision_request(
        action_point=action,
        requested_target_date=requested_date,
        reason="Severe monsoon flooding on site",
        user=assignee,
    )
    assert req.status == GovernanceTargetRevisionRequest.Status.PENDING

    # Requester attempts to approve their own request -> MUST be rejected (403)
    client_assignee = APIClient()
    client_assignee.force_authenticate(user=assignee)
    res_self = client_assignee.post(
        f"/api/v1/governance/revision-requests/{req.id}/review/",
        {"decision": "Approved", "reviewer_comment": "Self-approving my own request"},
        format="json",
    )
    assert res_self.status_code == 403, "Requester must never be allowed to approve own request"

    # Authorized manager (different user) reviews and approves
    client_mgr = APIClient()
    client_mgr.force_authenticate(user=manager)
    res_approve = client_mgr.post(
        f"/api/v1/governance/revision-requests/{req.id}/review/",
        {"decision": "Approved", "reviewer_comment": "Verified site condition, extension granted"},
        format="json",
    )
    assert res_approve.status_code == 200

    req.refresh_from_db()
    assert req.status == GovernanceTargetRevisionRequest.Status.APPROVED
    assert req.reviewed_by == manager
    assert "Verified site condition" in req.reviewer_comment

    action.refresh_from_db()
    # Revised target updated
    assert action.current_target_date == requested_date
    assert action.revision_count == 1
    # Original target remains UNCHANGED
    assert action.target_closure_date == gov_test_setup["orig_target"]
    # Actual closure date untouched
    assert action.actual_closure_date is None

    # Audit history record created
    history = GovernanceTargetRevision.objects.filter(action_point=action)
    assert history.count() == 1
    rev_record = history.first()
    assert rev_record is not None
    assert rev_record.revised_target == requested_date
    assert rev_record.previous_target == gov_test_setup["orig_target"]


# Scenario 6: Rejection leaves current target date unchanged and records the decision
@pytest.mark.django_db
def test_rejection_leaves_target_date_unchanged(gov_test_setup):
    assignee = gov_test_setup["assignee_owner"]
    manager = gov_test_setup["manager_c1"]
    action = gov_test_setup["action"]

    requested_date = gov_test_setup["orig_target"] + timedelta(days=7)

    req = GovernanceService.submit_target_revision_request(
        action_point=action,
        requested_target_date=requested_date,
        reason="Need extra buffer",
        user=assignee,
    )

    client_mgr = APIClient()
    client_mgr.force_authenticate(user=manager)
    res_reject = client_mgr.post(
        f"/api/v1/governance/revision-requests/{req.id}/review/",
        {"decision": "Rejected", "reviewer_comment": "Buffer request denied, prioritize calibration"},
        format="json",
    )
    assert res_reject.status_code == 200

    req.refresh_from_db()
    assert req.status == GovernanceTargetRevisionRequest.Status.REJECTED
    assert req.reviewed_by == manager

    action.refresh_from_db()
    # Current target remains UNCHANGED
    assert action.current_target_date == gov_test_setup["orig_target"]
    assert action.revision_count == 0

    # User can submit a new request later now that pending request is resolved
    req2 = GovernanceService.submit_target_revision_request(
        action_point=action,
        requested_target_date=requested_date + timedelta(days=1),
        reason="New legitimate reason with backup equipment",
        user=assignee,
    )
    assert req2.status == GovernanceTargetRevisionRequest.Status.PENDING


# Scenario 8: User cannot approve or reject their own uploaded document (even admin/owner)
@pytest.mark.django_db
def test_user_cannot_review_own_uploaded_evidence(gov_test_setup):
    admin = gov_test_setup["admin"]
    manager = gov_test_setup["manager_c1"]
    action = gov_test_setup["action"]

    # Manager uploads evidence
    file_content = b"%PDF-1.4 test calibration document"
    uploaded = SimpleUploadedFile("calibration.pdf", file_content, content_type="application/pdf")
    evidence = GovernanceEvidenceService.submit_evidence(
        action_point=action,
        uploaded_file=uploaded,
        title="Calibration Certificate v1",
        description="Signed lab report",
        user=manager,
    )
    assert evidence.status == GovernanceEvidence.Status.PENDING_REVIEW

    # Manager attempts to approve their OWN uploaded evidence -> MUST BE REJECTED
    client_mgr = APIClient()
    client_mgr.force_authenticate(user=manager)
    res_self_review = client_mgr.post(
        f"/api/v1/governance/evidence/{evidence.id}/review/",
        {"decision": "Accepted", "review_comment": "Looks good to me (self-approval)"},
        format="json",
    )
    assert res_self_review.status_code == 400 or res_self_review.status_code == 403
    assert "cannot approve" in str(res_self_review.data).lower() or "uploader" in str(res_self_review.data).lower()

    # Even admin who uploaded cannot review own document
    admin_file = SimpleUploadedFile("admin_proof.pdf", file_content, content_type="application/pdf")
    admin_ev = GovernanceEvidenceService.submit_evidence(
        action_point=action,
        uploaded_file=admin_file,
        title="Admin Proof",
        description="Audit verification",
        user=admin,
    )
    client_admin = APIClient()
    client_admin.force_authenticate(user=admin)
    res_admin_self = client_admin.post(
        f"/api/v1/governance/evidence/{admin_ev.id}/review/",
        {"decision": "Accepted", "review_comment": "Admin self review"},
        format="json",
    )
    assert res_admin_self.status_code in [400, 403]
    assert "uploader" in str(res_admin_self.data).lower() or "cannot approve" in str(res_admin_self.data).lower()


# Scenario 9: A different authorized reviewer can review evidence
@pytest.mark.django_db
def test_different_authorized_reviewer_can_review_evidence(gov_test_setup):
    assignee = gov_test_setup["assignee_owner"]
    manager = gov_test_setup["manager_c1"]
    action = gov_test_setup["action"]

    file_content = b"%PDF-1.4 assignee document"
    uploaded = SimpleUploadedFile("report.pdf", file_content, content_type="application/pdf")
    evidence = GovernanceEvidenceService.submit_evidence(
        action_point=action,
        uploaded_file=uploaded,
        title="Inverter Proof",
        description="Submission by assignee",
        user=assignee,
    )

    client_mgr = APIClient()
    client_mgr.force_authenticate(user=manager)
    res_review = client_mgr.post(
        f"/api/v1/governance/evidence/{evidence.id}/review/",
        {"decision": "Accepted", "review_comment": "Verified and accepted by Circle Manager"},
        format="json",
    )
    assert res_review.status_code == 200
    evidence.refresh_from_db()
    assert evidence.status == GovernanceEvidence.Status.ACCEPTED
    assert evidence.reviewed_by == manager


# Scenario 10: Evidence upload alone does NOT close a task
@pytest.mark.django_db
def test_evidence_upload_does_not_close_task(gov_test_setup):
    assignee = gov_test_setup["assignee_owner"]
    action = gov_test_setup["action"]
    assert action.status == GovernanceActionPoint.Status.OPEN

    file_content = b"%PDF-1.4 report"
    uploaded = SimpleUploadedFile("wip.pdf", file_content, content_type="application/pdf")
    GovernanceEvidenceService.submit_evidence(
        action_point=action,
        uploaded_file=uploaded,
        title="Preliminary doc",
        description="Work started",
        user=assignee,
    )

    action.refresh_from_db()
    # Task should move to WIP or stay Open, NEVER Closed!
    assert action.status != GovernanceActionPoint.Status.CLOSED
    assert action.actual_closure_date is None


# Scenario 11: Unauthorized users cannot review another organization's requests or documents
@pytest.mark.django_db
def test_unauthorized_cross_organization_review_blocked(gov_test_setup):
    manager_c2 = gov_test_setup["manager_c2"]  # Nagpur Circle
    assignee = gov_test_setup["assignee_owner"]
    action = gov_test_setup["action"]  # Jodhpur Circle

    # Request from Circle 1
    req = GovernanceService.submit_target_revision_request(
        action_point=action,
        requested_target_date=gov_test_setup["orig_target"] + timedelta(days=5),
        reason="Circle 1 request",
        user=assignee,
    )

    # Manager from Circle 2 attempts to review
    client_c2 = APIClient()
    client_c2.force_authenticate(user=manager_c2)
    res = client_c2.post(
        f"/api/v1/governance/revision-requests/{req.id}/review/",
        {"decision": "Approved", "reviewer_comment": "Cross circle attempt"},
        format="json",
    )
    assert res.status_code in [403, 404]
