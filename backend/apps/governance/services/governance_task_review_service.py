import logging
from typing import Optional, Tuple, Dict, Any
from django.db import transaction
from django.core.exceptions import ValidationError, PermissionDenied
from django.utils import timezone

from apps.governance.models import GovernanceActionPoint, GovernanceTaskReview
from apps.identity.models import User
from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord
from apps.notifications.services.smtp_service import SMTPService
from apps.notifications.services.governance_email_builder import GovernanceEmailBuilder

logger = logging.getLogger("mapar.governance")


class GovernanceTaskReviewService:
    """
    Business service layer managing Task Review assignments, verification submissions,
    reviewer verification decisions, approver sign-offs, audit records, and automated notifications.
    Strictly preserves separation of duties and gates task closure until verified and approved.
    """

    @classmethod
    def can_assign_review(cls, action_point: GovernanceActionPoint, user: User) -> bool:
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or getattr(user, "is_superadmin", False):
            return True
        if user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT, User.Role.CORPORATE_DOMAIN_LEAD]:
            return True
        # Assigned reviewer CANNOT assign or reassign tasks
        if action_point.assigned_reviewer_id and action_point.assigned_reviewer_id == user.id:
            return False
        active_rev = action_point.task_reviews.order_by("-assigned_at").first()
        if active_rev and active_rev.assigned_reviewer_id == user.id:
            return False
        # Assigner / delegator of the action point
        if action_point.assigned_by_id == user.id or action_point.created_by_id == user.id:
            return True
        user_circle_id = getattr(user, "circle_id", None) or (user.circle.id if getattr(user, "circle", None) else None)
        from common.permissions.authorization import AuthorizationService
        scope = AuthorizationService.get_user_hierarchy_scope(user)
        is_in_circle = bool(
            (user_circle_id and user_circle_id == action_point.circle_id)
            or (scope.circle_ids and action_point.circle_id in scope.circle_ids)
        )
        if is_in_circle and user.role == User.Role.CIRCLE_DOMAIN_MANAGER:
            return True
        return False

    @classmethod
    def can_submit_for_verification(cls, action_point: GovernanceActionPoint, user: User) -> bool:
        if not user or not user.is_authenticated:
            return False
        if action_point.status == GovernanceActionPoint.Status.CLOSED:
            return False
        if user.is_superuser or getattr(user, "is_superadmin", False):
            return True
        if user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT]:
            return True
        return bool(action_point.owner_id == user.id or action_point.assigned_by_id == user.id)

    @classmethod
    def can_verify_review(cls, action_point: GovernanceActionPoint, user: User) -> bool:
        if not user or not user.is_authenticated:
            return False
        is_super = user.is_superuser or getattr(user, "is_superadmin", False)
        if is_super:
            return True
        # Original owner cannot verify their own work
        if action_point.owner_id == user.id:
            return False
        # Designated assigned reviewer
        if action_point.assigned_reviewer_id and action_point.assigned_reviewer_id == user.id:
            return True
        # Check active review assignment
        active_review = action_point.task_reviews.order_by("-assigned_at").first()
        if active_review and active_review.assigned_reviewer_id == user.id:
            return True
        return False

    @classmethod
    def can_approve_review(cls, action_point: GovernanceActionPoint, user: User) -> bool:
        if not user or not user.is_authenticated:
            return False
        is_super = user.is_superuser or getattr(user, "is_superadmin", False)
        if is_super:
            return True
        # Reviewer cannot approve their own verification (separation of duties)
        if action_point.assigned_reviewer_id and action_point.assigned_reviewer_id == user.id:
            return False
        # Task owner cannot approve their own task
        if action_point.owner_id == user.id:
            return False
        # Assigner, Management, or Super Admin
        if action_point.assigned_by_id == user.id:
            return True
        if user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT, User.Role.CORPORATE_DOMAIN_LEAD, User.Role.CIRCLE_DOMAIN_MANAGER]:
            return True
        return False

    @classmethod
    def check_can_close_task(cls, action_point: GovernanceActionPoint, user: User):
        """
        Validates whether an action point can be transitioned to Closed.
        TASK CLOSURE GATE:
        1. If review assignment exists or task is in review workflow:
           Review must be submitted, verified, or approved.
        2. If evidence is required, it must be Accepted.
        3. User must be original task owner or superadmin/manager/assigner.
        """
        is_admin_or_manager = (
            user.is_superuser
            or getattr(user, "is_superadmin", False)
            or user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT, User.Role.CORPORATE_DOMAIN_LEAD, User.Role.CIRCLE_DOMAIN_MANAGER]
            or action_point.assigned_by_id == user.id
        )
        # Designated assigned reviewer cannot close the task (separation of duties)
        if action_point.assigned_reviewer_id and action_point.assigned_reviewer_id == user.id:
            raise PermissionDenied("Assigned reviewers cannot close the task.")

        is_owner = (action_point.owner_id == user.id)

        if not (is_owner or is_admin_or_manager):
            raise PermissionDenied("Only the original task owner or an authorized administrator can close this task.")

        # Gate 1: Review & Approval Workflow
        if is_admin_or_manager:
            allowed_closure_review_statuses = [
                GovernanceActionPoint.ReviewWorkflowStatus.APPROVED,
                GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_SUBMITTED,
                GovernanceActionPoint.ReviewWorkflowStatus.NONE,
            ]
        else:
            allowed_closure_review_statuses = [
                GovernanceActionPoint.ReviewWorkflowStatus.APPROVED,
                GovernanceActionPoint.ReviewWorkflowStatus.NONE,
            ]
        if action_point.review_workflow_status not in allowed_closure_review_statuses:
            raise ValidationError({
                "status": "Task closure is not allowed until reviewer verification and final approval are completed."
            })

        # Gate 2: Mandatory Evidence
        if action_point.evidence_required and action_point.evidence_status != GovernanceActionPoint.EvidenceStatus.ACCEPTED:
            raise ValidationError({
                "status": "Task cannot be marked Closed until required evidence has been submitted and Accepted by an authorized reviewer."
            })

    @classmethod
    def assign_review(
        cls,
        action_point: GovernanceActionPoint,
        reviewer: User,
        requested_by: User,
        instructions: str = "",
        base_url: Optional[str] = None,
    ) -> GovernanceTaskReview:
        """
        Creates a formal task review assignment against the specified action point.
        Preserves original task owner, previous reviews in history, and updates review_workflow_status.
        """
        if not action_point:
            raise ValidationError({"action_point": "A valid action point is required."})

        if not reviewer or not getattr(reviewer, "is_active", False):
            raise ValidationError({"reviewer": "A valid, active application user must be selected as the reviewer."})

        if not cls.can_assign_review(action_point, requested_by):
            raise PermissionDenied("Only authorized governance users can assign or reassign tasks for review.")

        with transaction.atomic():
            action_point.assigned_reviewer = reviewer
            action_point.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_ASSIGNED
            action_point.save()

            review = GovernanceTaskReview.objects.create(
                action_point=action_point,
                assigned_reviewer=reviewer,
                requested_by=requested_by,
                instructions=(instructions or "").strip(),
                status=GovernanceTaskReview.Status.PENDING_REVIEW,
                assigned_at=timezone.now(),
            )

        # Dispatch automated email alert to the selected reviewer
        try:
            cls.notify_reviewer(review, base_url=base_url)
        except Exception as exc:
            logger.warning("Failed to dispatch reviewer alert for review #%s: %s", review.id, exc)

        return review

    @classmethod
    def submit_review(
        cls,
        action_point: GovernanceActionPoint,
        user: User,
        findings: str = "",
        recommendations: str = "",
        review_notes: str = "",
    ) -> GovernanceTaskReview:
        """
        Designated reviewer records findings/observations and recommendations,
        and submits the review. Persists findings, recommendations, submitter identity,
        and timestamp. Transitions review_workflow_status to 'Review Submitted'.
        """
        if not user or not user.is_authenticated:
            raise PermissionDenied("Authentication required to submit reviews.")

        is_assigned_reviewer = bool(
            (action_point.assigned_reviewer_id and action_point.assigned_reviewer_id == user.id)
            or action_point.task_reviews.filter(assigned_reviewer=user).exists()
        )
        is_super = user.is_superuser or getattr(user, "is_superadmin", False)

        if not (is_assigned_reviewer or is_super):
            raise PermissionDenied("Only the designated reviewer can submit findings for this task.")

        combined_findings = (findings or review_notes or "").strip()
        if not combined_findings:
            raise ValidationError({"findings": "Findings / Observations are required to submit a review."})

        review = action_point.task_reviews.filter(assigned_reviewer=user).order_by("-assigned_at").first()
        if not review:
            review = action_point.task_reviews.order_by("-assigned_at").first()

        if not review:
            review = GovernanceTaskReview.objects.create(
                action_point=action_point,
                assigned_reviewer=user,
                requested_by=action_point.assigned_by or action_point.owner or user,
                assigned_at=timezone.now(),
            )

        with transaction.atomic():
            review.review_notes = combined_findings
            review.recommendations = (recommendations or "").strip()
            review.status = GovernanceTaskReview.Status.REVIEW_SUBMITTED
            review.reviewer_decision = "Review Submitted"
            review.submitted_by = user
            review.submitted_at = timezone.now()
            review.verified_at = timezone.now()
            review.verified_by = user
            review.save()

            action_point.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.REVIEW_SUBMITTED
            action_point.save()

        return review

    @classmethod
    def submit_for_verification(
        cls,
        action_point: GovernanceActionPoint,
        user: User,
        submission_notes: str = "",
    ) -> GovernanceTaskReview:
        """
        Original task owner submits the task for verification.
        Validates evidence requirement, transitions workflow status to Submitted for Review,
        and logs audit timestamps and submitter notes.
        Task remains Open/WIP and is NOT closed.
        """
        if not cls.can_submit_for_verification(action_point, user):
            raise PermissionDenied("You are not authorized to submit this task for review.")

        if action_point.status == GovernanceActionPoint.Status.CLOSED:
            raise ValidationError({"status": "Closed tasks cannot be submitted for review."})

        with transaction.atomic():
            action_point.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.SUBMITTED_FOR_REVIEW
            action_point.save()

            # Find active review or create a new review record for this submission cycle
            review = action_point.task_reviews.order_by("-assigned_at").first()
            if not review or review.status in [GovernanceTaskReview.Status.VERIFIED, GovernanceTaskReview.Status.APPROVED]:
                review = GovernanceTaskReview.objects.create(
                    action_point=action_point,
                    assigned_reviewer=action_point.assigned_reviewer,
                    requested_by=user,
                    status=GovernanceTaskReview.Status.SUBMITTED_FOR_REVIEW,
                    submission_notes=(submission_notes or "").strip(),
                    submitted_for_verification_at=timezone.now(),
                    submitted_for_verification_by=user,
                    assigned_at=timezone.now(),
                )
            else:
                review.status = GovernanceTaskReview.Status.SUBMITTED_FOR_REVIEW
                review.submission_notes = (submission_notes or "").strip()
                review.submitted_for_verification_at = timezone.now()
                review.submitted_for_verification_by = user
                review.save()

        return review

    @classmethod
    def verify_review(
        cls,
        action_point: GovernanceActionPoint,
        user: User,
        outcome: str,
        review_notes: str = "",
    ) -> GovernanceTaskReview:
        """
        Assigned reviewer verifies work performed and submitted evidence.
        Outcomes:
        - "Verified": Confirms task is ready for final approval (Awaiting Final Approval).
        - "Rework Required": Returns task to original owner for correction.
        """
        if not cls.can_verify_review(action_point, user):
            raise PermissionDenied("Only the designated reviewer can verify this task.")

        clean_outcome = outcome.strip()
        is_verified = clean_outcome.lower() in ["verified", "verify"]
        is_rework = clean_outcome.lower() in ["rework required", "rejected / rework required", "rework", "rejected"]

        if not (is_verified or is_rework):
            raise ValidationError({"outcome": "Verification outcome must be 'Verified' or 'Rework Required'."})

        review = action_point.task_reviews.order_by("-assigned_at").first()
        if not review:
            review = GovernanceTaskReview.objects.create(
                action_point=action_point,
                assigned_reviewer=user,
                requested_by=action_point.owner or user,
                assigned_at=timezone.now(),
            )

        with transaction.atomic():
            if is_verified:
                action_point.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.AWAITING_APPROVAL
                review.status = GovernanceTaskReview.Status.VERIFIED
                review.reviewer_decision = "Verified"
            else:
                action_point.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.REWORK_REQUIRED
                review.status = GovernanceTaskReview.Status.REWORK_REQUIRED
                review.reviewer_decision = "Rework Required"

            review.review_notes = (review_notes or "").strip()
            review.verified_at = timezone.now()
            review.verified_by = user
            review.submitted_by = user
            review.submitted_at = timezone.now()
            review.save()
            action_point.save()

        return review

    @classmethod
    def approve_review(
        cls,
        action_point: GovernanceActionPoint,
        user: User,
        decision: str,
        comments: str = "",
    ) -> GovernanceTaskReview:
        """
        Authorized approver evaluates reviewer verification and decides:
        - "Approved": Authorizes original task owner to close task. Task does NOT automatically close.
        - "Rework Required": Returns task to original owner for corrections.
        """
        if not cls.can_approve_review(action_point, user):
            raise PermissionDenied("You are not authorized to approve or return this task.")

        clean_decision = decision.strip()
        is_approved = clean_decision.lower() in ["approved", "approve"]
        is_rework = clean_decision.lower() in ["rework required", "reject / return for rework", "rejected", "rework"]

        if not (is_approved or is_rework):
            raise ValidationError({"decision": "Approval decision must be 'Approved' or 'Rework Required'."})

        review = action_point.task_reviews.order_by("-assigned_at").first()
        if not review:
            review = GovernanceTaskReview.objects.create(
                action_point=action_point,
                assigned_reviewer=action_point.assigned_reviewer,
                requested_by=user,
                assigned_at=timezone.now(),
            )

        with transaction.atomic():
            if is_approved:
                action_point.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.APPROVED
                review.status = GovernanceTaskReview.Status.APPROVED
                review.approver_decision = "Approved"
            else:
                action_point.review_workflow_status = GovernanceActionPoint.ReviewWorkflowStatus.REWORK_REQUIRED
                review.status = GovernanceTaskReview.Status.REWORK_REQUIRED
                review.approver_decision = "Rework Required"

            review.approver_comments = (comments or "").strip()
            review.approved_at = timezone.now()
            review.approved_by = user
            review.save()
            action_point.save()

        return review

    @classmethod
    def submit_or_update_review(
        cls,
        review: GovernanceTaskReview,
        user: User,
        status: str,
        review_notes: str = "",
    ) -> GovernanceTaskReview:
        """
        Updates review progress notes and status for backward compatibility.
        """
        if not user or not user.is_authenticated:
            raise PermissionDenied("Authentication required to submit or update task reviews.")

        is_assigned_reviewer = bool(review.assigned_reviewer_id and review.assigned_reviewer_id == user.id)
        is_super = user.is_superuser or getattr(user, "is_superadmin", False)

        if not (is_assigned_reviewer or is_super):
            raise PermissionDenied("Only the assigned reviewer can submit notes or update this review.")

        valid_statuses = [choice[0] for choice in GovernanceTaskReview.Status.choices]
        if status not in valid_statuses:
            raise ValidationError({"status": f"Invalid review status. Must be one of: {', '.join(valid_statuses)}"})

        with transaction.atomic():
            review.status = status
            review.review_notes = (review_notes or "").strip()
            if status in [
                GovernanceTaskReview.Status.REVIEWED,
                GovernanceTaskReview.Status.IN_REVIEW,
                GovernanceTaskReview.Status.VERIFIED,
            ]:
                review.submitted_by = user
                review.submitted_at = timezone.now()
            review.save()

        return review

    @classmethod
    def notify_reviewer(
        cls,
        review: GovernanceTaskReview,
        base_url: Optional[str] = None,
    ) -> Tuple[bool, Optional[EmailDeliveryRecord]]:
        """
        Dispatches executive PGMS email alert to the reviewer with task details,
        requester instructions, and a direct link to the task details page.
        """
        reviewer = review.assigned_reviewer
        if not reviewer:
            return False, None

        recipient_email = (reviewer.email or "").strip().lower()
        if not recipient_email or "@" not in recipient_email:
            logger.info("Reviewer '%s' does not have a verified email address. Skipping email alert.", reviewer.username)
            return False, None

        action_point = review.action_point
        config = EmailConfiguration.get_solo().get_effective_settings()
        effective_base_url = (base_url or config.get("frontend_base_url", "http://localhost:5185")).rstrip("/")

        reviewer_name = GovernanceEmailBuilder.get_recipient_display_name(reviewer)
        requester_name = GovernanceEmailBuilder.get_recipient_display_name(review.requested_by, fallback="Team Lead")

        instruction_lead = (
            f"<div style='margin-top: 12px; padding: 12px; background-color: #F8FAFC; border-left: 4px solid #0284C7; font-size: 13px; color: #334155;'>"
            f"<strong>Review Instructions from {requester_name}:</strong><br/>{review.instructions}</div>"
            if review.instructions
            else ""
        )

        subject, html_content, plain_text = GovernanceEmailBuilder.build_email(
            recipient_name=reviewer_name,
            tasks=[action_point],
            email_type="review_assignment",
            subtitle="Task Assigned for Your Formal Review",
            lead_message=f"{requester_name} has assigned governance action item <strong>{action_point.action_id}</strong> for your review.{instruction_lead}",
            base_url=effective_base_url,
            initiator_name=requester_name,
        )

        idempotency_key = f"task_review:{review.id}:{reviewer.id}"

        success, record = SMTPService.send_html_email(
            recipient_email=recipient_email,
            recipient_name=reviewer_name,
            subject=subject,
            plain_text=plain_text,
            html_content=html_content,
            notification_type=EmailDeliveryRecord.NotificationType.TASK_REVIEW_ASSIGNMENT,
            action_point=action_point,
            action_id=action_point.action_id,
            idempotency_key=idempotency_key,
        )

        return success, record
