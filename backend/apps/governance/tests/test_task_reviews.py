import pytest
from datetime import date
from unittest.mock import patch, MagicMock
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.identity.models import User
from apps.organization.models import Circle, MainCompany, SubCompany, Project
from apps.governance.models import GovernanceActionPoint, GovernanceTaskReview
from apps.notifications.models import EmailDeliveryRecord


@pytest.fixture
def test_setup(db):
    company = MainCompany.objects.create(name="Apex Enterprise", code="APEX")
    sub_company = SubCompany.objects.create(name="Apex Infra", code="AINF", main_company=company)
    project = Project.objects.create(name="Project Prime", code="PRIM", sub_company=sub_company)
    circle = Circle.objects.create(name="Punjab Circle", code="PUN", region="North", project=project)
    other_circle = Circle.objects.create(name="Kerala Circle", code="KER", region="South", project=project)

    admin = User.objects.create_user(
        username="admin_user",
        email="admin@mapar.co.in",
        first_name="Admin",
        last_name="Leader",
        role=User.Role.SUPER_ADMIN,
        is_staff=True,
    )
    admin.set_password("Admin@123")
    admin.save()

    owner = User.objects.create_user(
        username="task_owner",
        email="owner@mapar.co.in",
        first_name="Task",
        last_name="Owner",
        role=User.Role.ACTION_OWNER,
        circle=circle,
    )
    owner.set_password("Owner@123")
    owner.save()

    reviewer = User.objects.create_user(
        username="reviewer_user",
        email="reviewer@mapar.co.in",
        first_name="Authorized",
        last_name="Reviewer",
        role=User.Role.CIRCLE_DOMAIN_MANAGER,
        circle=circle,
    )
    reviewer.set_password("Reviewer@123")
    reviewer.save()

    unauthorized_user = User.objects.create_user(
        username="unauthorized_user",
        email="unauth@mapar.co.in",
        first_name="Other",
        last_name="Person",
        role=User.Role.ACTION_OWNER,
        circle=other_circle,
    )
    unauthorized_user.set_password("Unauth@123")
    unauthorized_user.save()

    action = GovernanceActionPoint.objects.create(
        action_id="ACT-REV-001",
        circle=circle,
        action_point="Safety Valve Pressure Calibration",
        key_deliverable="Calibration certificate and logs",
        owner=owner,
        assigned_by=admin,
        raised_date=date(2026, 10, 1),
        target_closure_date=date(2026, 11, 15),
        current_target_date=date(2026, 11, 15),
        status=GovernanceActionPoint.Status.OPEN,
        priority=GovernanceActionPoint.Priority.HIGH,
        current_progress_percent=30,
        function_area="Operations",
        bucket="Safety Compliance",
    )

    return {
        "admin": admin,
        "owner": owner,
        "reviewer": reviewer,
        "unauthorized_user": unauthorized_user,
        "circle": circle,
        "other_circle": other_circle,
        "action": action,
    }


def test_assign_task_review_success(test_setup):
    """Test authorized user assigns a task to a reviewer with instructions and email alert."""
    admin = test_setup["admin"]
    reviewer = test_setup["reviewer"]
    action = test_setup["action"]

    client = APIClient()
    client.force_authenticate(user=admin)

    with patch("apps.notifications.services.smtp_service.SMTPService.send_html_email") as mock_send:
        mock_send.return_value = (True, MagicMock(id=999, status=EmailDeliveryRecord.Status.SENT))

        url = f"/api/v1/governance/actions/{action.id}/assign-review/"
        payload = {
            "reviewer_id": reviewer.id,
            "instructions": "Please inspect calibration log tolerances and verify physical gauge photo.",
        }
        res = client.post(url, payload, format="json")

        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["success"] is True
        assert res.data["review"]["status"] == "Pending Review"
        assert res.data["review"]["instructions"] == "Please inspect calibration log tolerances and verify physical gauge photo."
        assert res.data["review"]["assigned_reviewer"]["id"] == reviewer.id

        # Database record created
        db_review = GovernanceTaskReview.objects.filter(action_point=action).first()
        assert db_review is not None
        assert db_review.status == GovernanceTaskReview.Status.PENDING_REVIEW
        assert db_review.assigned_reviewer == reviewer
        assert db_review.requested_by == admin

        # Notification dispatched to reviewer
        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args[1]
        assert call_kwargs["recipient_email"] == "reviewer@mapar.co.in"
        assert call_kwargs["notification_type"] == EmailDeliveryRecord.NotificationType.TASK_REVIEW_ASSIGNMENT


def test_unauthorized_user_cannot_assign_review_outside_scope(test_setup):
    """User outside organizational scope cannot assign review for this task."""
    unauthorized_user = test_setup["unauthorized_user"]
    reviewer = test_setup["reviewer"]
    action = test_setup["action"]

    client = APIClient()
    client.force_authenticate(user=unauthorized_user)

    url = f"/api/v1/governance/actions/{action.id}/assign-review/"
    res = client.post(url, {"reviewer_id": reviewer.id}, format="json")
    assert res.status_code == status.HTTP_403_FORBIDDEN


def test_reviewer_workflow_and_original_task_status_unaffected(test_setup):
    """Reviewer submits review updates: In Review -> Reviewed. Original task status remains untouched."""
    admin = test_setup["admin"]
    reviewer = test_setup["reviewer"]
    action = test_setup["action"]

    review = GovernanceTaskReview.objects.create(
        action_point=action,
        assigned_reviewer=reviewer,
        requested_by=admin,
        instructions="Perform checklist review.",
        status=GovernanceTaskReview.Status.PENDING_REVIEW,
    )

    client = APIClient()
    client.force_authenticate(user=reviewer)

    # Transition 1: In Review
    url = f"/api/v1/governance/actions/{action.id}/reviews/{review.id}/"
    res1 = client.patch(url, {"status": "In Review", "review_notes": "Preliminary check underway."}, format="json")
    assert res1.status_code == status.HTTP_200_OK
    assert res1.data["review"]["status"] == "In Review"

    # Transition 2: Reviewed
    res2 = client.patch(
        url,
        {
            "status": "Reviewed",
            "review_notes": "All calibration tolerances verified within +/-0.5% margin. Approved.",
        },
        format="json",
    )
    assert res2.status_code == status.HTTP_200_OK
    assert res2.data["review"]["status"] == "Reviewed"
    assert res2.data["review"]["submitted_by"]["id"] == reviewer.id

    review.refresh_from_db()
    assert review.status == GovernanceTaskReview.Status.REVIEWED
    assert review.submitted_by == reviewer
    assert review.submitted_at is not None

    # CRITICAL: Core task status and progress percent MUST remain unchanged
    action.refresh_from_db()
    assert action.status == GovernanceActionPoint.Status.OPEN
    assert action.current_progress_percent == 30


def test_non_reviewer_cannot_submit_or_modify_another_review(test_setup):
    """Unauthorized user cannot submit review notes for a review assigned to someone else."""
    admin = test_setup["admin"]
    reviewer = test_setup["reviewer"]
    unauthorized_user = test_setup["unauthorized_user"]
    action = test_setup["action"]

    review = GovernanceTaskReview.objects.create(
        action_point=action,
        assigned_reviewer=reviewer,
        requested_by=admin,
        status=GovernanceTaskReview.Status.PENDING_REVIEW,
    )

    client = APIClient()
    client.force_authenticate(user=unauthorized_user)

    url = f"/api/v1/governance/actions/{action.id}/reviews/{review.id}/"
    res = client.patch(url, {"status": "Reviewed", "review_notes": "Unauthorized note."}, format="json")
    assert res.status_code == status.HTTP_403_FORBIDDEN


def test_review_history_retention_across_subsequent_reviews(test_setup):
    """Preserves full history when another review cycle is initiated."""
    admin = test_setup["admin"]
    reviewer = test_setup["reviewer"]
    action = test_setup["action"]

    # First completed review
    r1 = GovernanceTaskReview.objects.create(
        action_point=action,
        assigned_reviewer=reviewer,
        requested_by=admin,
        instructions="First review cycle",
        status=GovernanceTaskReview.Status.REVIEWED,
        review_notes="Initial comments: needs re-check next week.",
        submitted_by=reviewer,
        submitted_at=timezone.now(),
    )

    # Second review cycle requested
    r2 = GovernanceTaskReview.objects.create(
        action_point=action,
        assigned_reviewer=reviewer,
        requested_by=admin,
        instructions="Follow-up review cycle",
        status=GovernanceTaskReview.Status.PENDING_REVIEW,
    )

    client = APIClient()
    client.force_authenticate(user=admin)

    url = f"/api/v1/governance/actions/{action.id}/reviews/"
    res = client.get(url)
    assert res.status_code == status.HTTP_200_OK
    assert len(res.data["reviews"]) == 2
    ids = [r["id"] for r in res.data["reviews"]]
    assert r2.id in ids
    assert r1.id in ids


def test_full_detail_includes_task_reviews_and_permission_flags(test_setup):
    """Dedicated task detail endpoint returns task reviews, active review, and can_submit_review flag."""
    admin = test_setup["admin"]
    reviewer = test_setup["reviewer"]
    action = test_setup["action"]

    review = GovernanceTaskReview.objects.create(
        action_point=action,
        assigned_reviewer=reviewer,
        requested_by=admin,
        instructions="Full detail inspection",
        status=GovernanceTaskReview.Status.PENDING_REVIEW,
    )

    # Authenticate as the assigned reviewer
    client = APIClient()
    client.force_authenticate(user=reviewer)

    url = f"/api/v1/governance/actions/{action.id}/full-detail/"
    res = client.get(url)
    assert res.status_code == status.HTTP_200_OK
    assert "task_reviews" in res.data
    assert len(res.data["task_reviews"]) == 1
    assert res.data["active_review"]["id"] == review.id
    assert res.data["can_submit_review"] is True
    assert res.data["can_assign_review"] is False


def test_task_closure_blocked_until_verification_and_approval(test_setup):
    """
    CRITICAL BUSINESS RULE:
    Task closure is strictly blocked in backend when attempted before reviewer verification and final approval.
    """
    owner = test_setup["owner"]
    action = test_setup["action"]
    action.evidence_required = False  # Isolate approval gate
    action.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_ASSIGNED
    action.save()

    client = APIClient()
    client.force_authenticate(user=owner)

    url = f"/api/v1/governance/actions/{action.id}/"
    res = client.patch(url, {"status": "Closed"}, format="json")

    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "Task closure is not allowed until reviewer verification and final approval are completed." in str(res.data)

    action.refresh_from_db()
    assert action.status != GovernanceActionPoint.Status.CLOSED


def test_full_review_verification_approval_and_closure_lifecycle(test_setup):
    """
    End-to-End Workflow:
    1. Assign Reviewer
    2. Owner Submits for Verification -> Status becomes Submitted for Review, task remains Open
    3. Assigned Reviewer Verifies -> Outcome 'Verified', status becomes Awaiting Final Approval
    4. Reviewer cannot close task or approve their own review
    5. Approver Approves -> Status becomes Approved, task remains Open (not auto-closed)
    6. Owner closes the task -> Closure now allowed, status becomes Closed
    """
    admin = test_setup["admin"]
    owner = test_setup["owner"]
    reviewer = test_setup["reviewer"]
    action = test_setup["action"]
    action.evidence_required = False
    action.save()

    # Step 1: Assign Reviewer
    admin_client = APIClient()
    admin_client.force_authenticate(user=admin)
    with patch("apps.notifications.services.smtp_service.SMTPService.send_html_email") as mock_send:
        mock_send.return_value = (True, MagicMock(id=1, status=EmailDeliveryRecord.Status.SENT))
        assign_res = admin_client.post(
            f"/api/v1/governance/actions/{action.id}/assign-review/",
            {"reviewer_id": reviewer.id, "instructions": "Inspect documentation and verify logs."},
            format="json",
        )
        assert assign_res.status_code == status.HTTP_201_CREATED

    action.refresh_from_db()
    assert action.assigned_reviewer == reviewer
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_ASSIGNED

    # Step 2: Task Owner Submits for Verification
    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)
    submit_res = owner_client.post(
        f"/api/v1/governance/actions/{action.id}/submit-for-review/",
        {"submission_notes": "Completed valve calibration and uploaded logs."},
        format="json",
    )
    assert submit_res.status_code == status.HTTP_200_OK
    assert submit_res.data["review"]["status"] == "Submitted for Review"
    assert submit_res.data["action"]["review_workflow_status"] == "Submitted for Review"

    action.refresh_from_db()
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.SUBMITTED_FOR_REVIEW
    assert action.status == GovernanceActionPoint.Status.OPEN  # Must NOT be closed!

    # Verify closure is still blocked
    close_attempt1 = owner_client.patch(f"/api/v1/governance/actions/{action.id}/", {"status": "Closed"}, format="json")
    assert close_attempt1.status_code == status.HTTP_400_BAD_REQUEST

    # Step 3: Reviewer verifies the task
    reviewer_client = APIClient()
    reviewer_client.force_authenticate(user=reviewer)
    verify_res = reviewer_client.post(
        f"/api/v1/governance/actions/{action.id}/verify-review/",
        {"outcome": "Verified", "review_notes": "Gauge tolerances and logs verified on-site."},
        format="json",
    )
    assert verify_res.status_code == status.HTTP_200_OK
    assert verify_res.data["review"]["reviewer_decision"] == "Verified"

    action.refresh_from_db()
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.AWAITING_APPROVAL

    # Step 4: Separation of duties checks:
    # Reviewer cannot approve their own review
    rev_approve_attempt = reviewer_client.post(
        f"/api/v1/governance/actions/{action.id}/approve-review/",
        {"decision": "Approved", "comments": "Self-approval"},
        format="json",
    )
    assert rev_approve_attempt.status_code == status.HTTP_403_FORBIDDEN

    # Closure is still blocked before final approval
    close_attempt2 = owner_client.patch(f"/api/v1/governance/actions/{action.id}/", {"status": "Closed"}, format="json")
    assert close_attempt2.status_code == status.HTTP_400_BAD_REQUEST

    # Step 5: Authorized approver approves the review
    approve_res = admin_client.post(
        f"/api/v1/governance/actions/{action.id}/approve-review/",
        {"decision": "Approved", "comments": "Verified compliant with engineering standards."},
        format="json",
    )
    assert approve_res.status_code == status.HTTP_200_OK
    assert approve_res.data["review"]["approver_decision"] == "Approved"

    action.refresh_from_db()
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.APPROVED
    assert action.status == GovernanceActionPoint.Status.OPEN  # Must not auto-close!

    # Step 6: Original task owner closes the task
    close_res = owner_client.patch(f"/api/v1/governance/actions/{action.id}/", {"status": "Closed"}, format="json")
    assert close_res.status_code == status.HTTP_200_OK
    action.refresh_from_db()
    assert action.status == GovernanceActionPoint.Status.CLOSED
    assert action.actual_closure_date is not None


def test_rework_flow_from_reviewer_and_approver(test_setup):
    """
    Test rework cycles:
    1. Reviewer rejects -> Rework Required
    2. Owner corrects and resubmits -> Submitted for Review
    3. Reviewer verifies -> Awaiting Final Approval
    4. Approver rejects -> Rework Required
    5. Owner resubmits and passes final approval -> Closed
    """
    admin = test_setup["admin"]
    owner = test_setup["owner"]
    reviewer = test_setup["reviewer"]
    action = test_setup["action"]
    action.evidence_required = False
    action.save()

    # Assign reviewer & owner submits
    admin_client = APIClient()
    admin_client.force_authenticate(user=admin)
    admin_client.post(
        f"/api/v1/governance/actions/{action.id}/assign-review/",
        {"reviewer_id": reviewer.id},
        format="json",
    )

    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)
    owner_client.post(
        f"/api/v1/governance/actions/{action.id}/submit-for-review/",
        {"submission_notes": "Attempt 1"},
        format="json",
    )

    # 1. Reviewer requests rework
    reviewer_client = APIClient()
    reviewer_client.force_authenticate(user=reviewer)
    rework1 = reviewer_client.post(
        f"/api/v1/governance/actions/{action.id}/verify-review/",
        {"outcome": "Rework Required", "review_notes": "Calibration chart illegible, re-upload."},
        format="json",
    )
    assert rework1.status_code == status.HTTP_200_OK
    action.refresh_from_db()
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.REWORK_REQUIRED

    # 2. Owner corrects and resubmits
    resubmit1 = owner_client.post(
        f"/api/v1/governance/actions/{action.id}/submit-for-review/",
        {"submission_notes": "Attempt 2: High-res chart attached."},
        format="json",
    )
    assert resubmit1.status_code == status.HTTP_200_OK
    action.refresh_from_db()
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.SUBMITTED_FOR_REVIEW

    # 3. Reviewer verifies
    verify1 = reviewer_client.post(
        f"/api/v1/governance/actions/{action.id}/verify-review/",
        {"outcome": "Verified", "review_notes": "Chart is clear now."},
        format="json",
    )
    assert verify1.status_code == status.HTTP_200_OK
    action.refresh_from_db()
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.AWAITING_APPROVAL

    # 4. Approver requests rework
    rework2 = admin_client.post(
        f"/api/v1/governance/actions/{action.id}/approve-review/",
        {"decision": "Rework Required", "comments": "Need safety officer counter-signature."},
        format="json",
    )
    assert rework2.status_code == status.HTTP_200_OK
    action.refresh_from_db()
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.REWORK_REQUIRED

    # 5. Owner resubmits and final approval granted
    owner_client.post(
        f"/api/v1/governance/actions/{action.id}/submit-for-review/",
        {"submission_notes": "Attempt 3: Counter-signature obtained."},
        format="json",
    )
    reviewer_client.post(
        f"/api/v1/governance/actions/{action.id}/verify-review/",
        {"outcome": "Verified", "review_notes": "Signature confirmed."},
        format="json",
    )
    admin_client.post(
        f"/api/v1/governance/actions/{action.id}/approve-review/",
        {"decision": "Approved", "comments": "Final approval granted."},
        format="json",
    )

    action.refresh_from_db()
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.APPROVED

    # Now owner can close
    close_res = owner_client.patch(f"/api/v1/governance/actions/{action.id}/", {"status": "Closed"}, format="json")
    assert close_res.status_code == status.HTTP_200_OK
    action.refresh_from_db()
    assert action.status == GovernanceActionPoint.Status.CLOSED


def test_separation_of_duties_strictly_enforced(test_setup):
    """
    Separation of duties:
    - Task owner cannot verify their own task.
    - Task owner cannot approve their own task.
    - Reviewer cannot approve their own review.
    - Reviewer cannot close the task.
    """
    owner = test_setup["owner"]
    reviewer = test_setup["reviewer"]
    action = test_setup["action"]
    action.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.SUBMITTED_FOR_REVIEW
    action.assigned_reviewer = reviewer
    action.save()

    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)

    # 1. Owner cannot verify their own task
    verify_by_owner = owner_client.post(
        f"/api/v1/governance/actions/{action.id}/verify-review/",
        {"outcome": "Verified", "review_notes": "Self verification attempt"},
        format="json",
    )
    assert verify_by_owner.status_code == status.HTTP_403_FORBIDDEN

    # 2. Owner cannot approve their own task
    approve_by_owner = owner_client.post(
        f"/api/v1/governance/actions/{action.id}/approve-review/",
        {"decision": "Approved", "comments": "Self approval attempt"},
        format="json",
    )
    assert approve_by_owner.status_code == status.HTTP_403_FORBIDDEN

    # 3. Reviewer cannot close the task
    reviewer_client = APIClient()
    reviewer_client.force_authenticate(user=reviewer)
    close_by_reviewer = reviewer_client.patch(
        f"/api/v1/governance/actions/{action.id}/",
        {"status": "Closed"},
        format="json",
    )
    assert close_by_reviewer.status_code == status.HTTP_403_FORBIDDEN


def test_closure_gated_by_both_approval_and_mandatory_evidence(test_setup):
    """
    Combined gate test:
    1. Task not approved -> blocked with review workflow message.
    2. Task approved, but required evidence Not Submitted -> blocked with evidence message.
    3. Task approved AND evidence Accepted -> owner closes successfully.
    """
    owner = test_setup["owner"]
    action = test_setup["action"]
    action.evidence_required = True
    action.evidence_status = GovernanceActionPoint.EvidenceStatus.NOT_SUBMITTED
    action.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_ASSIGNED
    action.save()

    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)

    # Step 1: Blocked by review workflow status
    res1 = owner_client.patch(f"/api/v1/governance/actions/{action.id}/", {"status": "Closed"}, format="json")
    assert res1.status_code == status.HTTP_400_BAD_REQUEST
    assert "Task closure is not allowed until reviewer verification and final approval are completed." in str(res1.data)

    # Step 2: Now approve review workflow, but evidence still Not Submitted -> blocked by evidence gate
    action.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.APPROVED
    action.save()
    res2 = owner_client.patch(f"/api/v1/governance/actions/{action.id}/", {"status": "Closed"}, format="json")
    assert res2.status_code == status.HTTP_400_BAD_REQUEST
    assert "evidence" in str(res2.data).lower()

    # Step 3: Now accept evidence -> closure succeeds
    action.evidence_status = GovernanceActionPoint.EvidenceStatus.ACCEPTED
    action.save()
    res3 = owner_client.patch(f"/api/v1/governance/actions/{action.id}/", {"status": "Closed"}, format="json")
    assert res3.status_code == status.HTTP_200_OK
    action.refresh_from_db()
    assert action.status == GovernanceActionPoint.Status.CLOSED


def test_full_governance_to_audit_review_workflow_and_decision(test_setup):
    """
    End-to-End Workflow Verification:
    1. Authorized Governance user assigns task for review to reviewer.
    2. Reviewer sees task under 'assigned_to_me' and 'pending_reviews' view modes in Audit.
    3. Reviewer CANNOT assign or reassign tasks (403 Forbidden).
    4. Reviewer CANNOT close the task (403 Forbidden).
    5. Reviewer submits review findings and recommendations via submit-review endpoint.
    6. Database reflects review_workflow_status = 'Review Submitted' and review record contains findings.
    7. Governance user sees task under 'review_submitted' view mode.
    8. Governance user can return for rework, reassign to another reviewer (preserving history),
       or close task when findings are satisfactory.
    """
    admin = test_setup["admin"]
    reviewer = test_setup["reviewer"]
    owner = test_setup["owner"]
    action = test_setup["action"]
    action.evidence_required = False
    action.save()

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin)

    reviewer_client = APIClient()
    reviewer_client.force_authenticate(user=reviewer)

    # Step 1: Assign for Review from Governance & Action Tracker
    assign_res = admin_client.post(
        f"/api/v1/governance/actions/{action.id}/assign-review/",
        {"reviewer_id": reviewer.id, "instructions": "Verify compliance with ISO safety standards"},
        format="json",
    )
    assert assign_res.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]
    action.refresh_from_db()
    assert action.assigned_reviewer == reviewer
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_ASSIGNED

    # Step 2: Audit reviewer views task in Audit & Action Owner module
    audit_my_res = reviewer_client.get(
        "/api/v1/governance/actions/",
        {"view_mode": "assigned_to_me"},
        format="json",
    )
    assert audit_my_res.status_code == status.HTTP_200_OK
    assert any(item["id"] == action.id for item in audit_my_res.data["results"])

    audit_pending_res = reviewer_client.get(
        "/api/v1/governance/actions/",
        {"view_mode": "pending_reviews"},
        format="json",
    )
    assert audit_pending_res.status_code == status.HTTP_200_OK
    assert any(item["id"] == action.id for item in audit_pending_res.data["results"])

    # Step 3: Strict rule - Reviewer in Audit cannot assign or reassign tasks
    reassign_attempt = reviewer_client.post(
        f"/api/v1/governance/actions/{action.id}/assign-review/",
        {"reviewer_id": owner.id},
        format="json",
    )
    assert reassign_attempt.status_code == status.HTTP_403_FORBIDDEN

    # Step 4: Strict rule - Reviewer in Audit cannot close task
    close_attempt = reviewer_client.patch(
        f"/api/v1/governance/actions/{action.id}/",
        {"status": "Closed"},
        format="json",
    )
    assert close_attempt.status_code == status.HTTP_403_FORBIDDEN

    # Step 5: Reviewer records findings & recommendations and submits review
    submit_res = reviewer_client.post(
        f"/api/v1/governance/actions/{action.id}/submit-review/",
        {
            "findings": "All pressure relief valves tested and documented correctly.",
            "recommendations": "Schedule quarterly recalibration of secondary gauges.",
            "review_notes": "Inspection completed on-site with lead engineer.",
        },
        format="json",
    )
    assert submit_res.status_code == status.HTTP_200_OK
    assert submit_res.data["review"]["status"] == "Review Submitted"
    assert "All pressure relief valves" in submit_res.data["review"]["review_notes"]
    assert "quarterly recalibration" in submit_res.data["review"]["recommendations"]

    # Step 6: Database verification
    action.refresh_from_db()
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_SUBMITTED
    latest_review = action.task_reviews.order_by("-assigned_at").first()
    assert latest_review.status == GovernanceTaskReview.Status.REVIEW_SUBMITTED
    assert latest_review.submitted_by == reviewer
    assert latest_review.submitted_at is not None
    assert latest_review.recommendations == "Schedule quarterly recalibration of secondary gauges."

    # Step 7: Reviewer sees it in submitted_reviews, no longer in pending_reviews
    audit_submitted_res = reviewer_client.get(
        "/api/v1/governance/actions/",
        {"view_mode": "submitted_reviews"},
        format="json",
    )
    assert audit_submitted_res.status_code == status.HTTP_200_OK
    assert any(item["id"] == action.id for item in audit_submitted_res.data["results"])

    audit_pending_res2 = reviewer_client.get(
        "/api/v1/governance/actions/",
        {"view_mode": "pending_reviews"},
        format="json",
    )
    assert audit_pending_res2.status_code == status.HTTP_200_OK
    assert not any(item["id"] == action.id for item in audit_pending_res2.data["results"])

    # Step 8: Governance user sees task in review_submitted tab
    gov_submitted_res = admin_client.get(
        "/api/v1/governance/actions/",
        {"view_mode": "review_submitted"},
        format="json",
    )
    assert gov_submitted_res.status_code == status.HTTP_200_OK
    assert any(item["id"] == action.id for item in gov_submitted_res.data["results"])

    # Step 9: Reassign for review preserves history
    reassign_res = admin_client.post(
        f"/api/v1/governance/actions/{action.id}/assign-review/",
        {"reviewer_id": reviewer.id, "instructions": "Second cycle review"},
        format="json",
    )
    assert reassign_res.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]
    action.refresh_from_db()
    assert action.task_reviews.count() == 2

    # Step 10: Governance decision - close task directly when satisfied
    # Reviewer submits 2nd review
    reviewer_client.post(
        f"/api/v1/governance/actions/{action.id}/submit-review/",
        {"findings": "Final clearance approved.", "recommendations": "None"},
        format="json",
    )
    action.refresh_from_db()
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_SUBMITTED

    close_res = admin_client.patch(
        f"/api/v1/governance/actions/{action.id}/",
        {"status": "Closed"},
        format="json",
    )
    assert close_res.status_code == status.HTTP_200_OK
    action.refresh_from_db()
    assert action.status == GovernanceActionPoint.Status.CLOSED
    assert action.review_workflow_status == GovernanceActionPoint.ReviewWorkflowStatus.APPROVED



