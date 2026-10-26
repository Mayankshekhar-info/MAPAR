import os
from typing import Optional
from django.db import transaction
from django.core.exceptions import ValidationError, PermissionDenied
from django.utils import timezone
from django.core.files.uploadedfile import UploadedFile

from apps.governance.models import GovernanceActionPoint, GovernanceEvidence
from apps.identity.models import User


class GovernanceEvidenceService:
    ALLOWED_EXTENSIONS = {
        ".pdf", ".xlsx", ".xls", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".csv", ".txt", ".zip"
    }
    MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

    @classmethod
    def validate_file(cls, uploaded_file: UploadedFile):
        if not uploaded_file:
            raise ValidationError({"file": "An evidence file is required."})

        name = uploaded_file.name or ""
        ext = os.path.splitext(name)[1].lower()
        if ext not in cls.ALLOWED_EXTENSIONS:
            allowed_list = ", ".join(sorted(cls.ALLOWED_EXTENSIONS))
            raise ValidationError({
                "file": f"File type '{ext}' is not permitted. Supported file types: {allowed_list}"
            })

        file_size = uploaded_file.size or 0
        if file_size > cls.MAX_FILE_SIZE:
            raise ValidationError({
                "file": f"File size ({file_size / (1024 * 1024):.1f} MB) exceeds maximum allowed limit of 25 MB."
            })

    @classmethod
    def can_submit_evidence(cls, action_point: GovernanceActionPoint, user: User) -> bool:
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or getattr(user, "is_superadmin", False):
            return True
        if user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT, User.Role.CORPORATE_DOMAIN_LEAD]:
            return True
        if action_point.owner_id == user.id:
            return True
        if action_point.assigned_by_id == user.id:
            return True

        user_circle_id = getattr(user, "circle_id", None) or (user.circle.id if getattr(user, "circle", None) else None)
        from common.permissions.authorization import AuthorizationService
        scope = AuthorizationService.get_user_hierarchy_scope(user)
        in_user_scope = (
            (user_circle_id and user_circle_id == action_point.circle_id)
            or (scope.circle_ids and action_point.circle_id in scope.circle_ids)
        )
        if in_user_scope:
            return True
        return False

    @classmethod
    def can_review_evidence(cls, action_point: GovernanceActionPoint, user: User) -> bool:
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or getattr(user, "is_superadmin", False):
            return True
        if user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT, User.Role.CORPORATE_DOMAIN_LEAD]:
            return True
        if action_point.assigned_by_id == user.id:
            return True

        user_circle_id = getattr(user, "circle_id", None) or (user.circle.id if getattr(user, "circle", None) else None)
        from common.permissions.authorization import AuthorizationService
        scope = AuthorizationService.get_user_hierarchy_scope(user)
        in_user_scope = (
            (user_circle_id and user_circle_id == action_point.circle_id)
            or (scope.circle_ids and action_point.circle_id in scope.circle_ids)
        )
        if in_user_scope and getattr(user, "role", "") not in [User.Role.ACTION_OWNER, User.Role.VIEWER]:
            return True
        return False

    @classmethod
    def submit_evidence(
        cls,
        action_point: GovernanceActionPoint,
        uploaded_file: UploadedFile,
        title: str,
        description: str,
        user: User,
        reporting_week: str = "",
    ) -> GovernanceEvidence:
        """
        Submits new or resubmitted proof file against an action point.
        Preserves submission history and increments version index.
        """
        if not cls.can_submit_evidence(action_point, user):
            raise PermissionDenied("You are not authorized to submit evidence for this action point.")

        cls.validate_file(uploaded_file)

        orig_name = os.path.basename(uploaded_file.name or "evidence")
        from django.utils.text import get_valid_filename
        clean_name = get_valid_filename(orig_name)
        if not clean_name:
            clean_name = f"evidence_{int(timezone.now().timestamp())}.dat"

        file_size = uploaded_file.size or 0
        if file_size <= 0:
            raise ValidationError({"file": "Uploaded file is empty (0 bytes)."})

        if not title or not title.strip():
            title = os.path.splitext(clean_name)[0]

        uploaded_file.name = clean_name
        created_file_path = None

        try:
            with transaction.atomic():
                latest_item = action_point.evidence_items.order_by("-version").first()
                version = (latest_item.version + 1) if latest_item else 1

                evidence = GovernanceEvidence.objects.create(
                    action_point=action_point,
                    version=version,
                    reporting_week=reporting_week.strip() if reporting_week else "",
                    title=title.strip(),
                    description=description.strip() if description else "",
                    file=uploaded_file,
                    file_name=clean_name,
                    file_size=file_size,
                    file_type=getattr(uploaded_file, "content_type", "") or "",
                    submitted_by=user,
                    status=GovernanceEvidence.Status.PENDING_REVIEW,
                )
                created_file_path = evidence.file.name

                # Verify file was written to centralized storage
                if not evidence.file.storage.exists(evidence.file.name):
                    raise ValidationError({"file": "Storage provider failed to persist file content."})

                # Update parent action point evidence status
                action_point.evidence_status = GovernanceActionPoint.EvidenceStatus.PENDING_REVIEW
                # If item was Open and evidence is submitted, optionally set WIP
                if action_point.status == GovernanceActionPoint.Status.OPEN:
                    action_point.status = GovernanceActionPoint.Status.WIP
                action_point.save()

            return evidence
        except Exception:
            # Clean up orphaned storage file if database transaction or verification fails
            if created_file_path:
                try:
                    from django.core.files.storage import default_storage
                    if default_storage.exists(created_file_path):
                        default_storage.delete(created_file_path)
                except Exception:
                    pass
            raise

    @classmethod
    def review_evidence(
        cls,
        evidence: GovernanceEvidence,
        decision: str,
        review_comment: str,
        user: User,
    ) -> GovernanceEvidence:
        """
        Reviews an evidence submission (Accept or Rework Required).
        Enforces that users cannot approve their own submitted evidence unless Super Admin.
        """
        action_point = evidence.action_point

        if not cls.can_review_evidence(action_point, user):
            raise PermissionDenied("You are not authorized to review evidence for this action point.")

        # Strict separation of duties: An uploader must never review/approve/reject their own document
        if evidence.submitted_by_id == user.id:
            raise PermissionDenied("An uploader cannot approve, verify, or review their own uploaded document.")

        normalized_decision = decision.strip()
        if normalized_decision not in [GovernanceEvidence.Status.ACCEPTED, GovernanceEvidence.Status.REWORK_REQUIRED]:
            raise ValidationError({"decision": "Review decision must be 'Accepted' or 'Rework Required'."})

        with transaction.atomic():
            evidence.status = normalized_decision
            evidence.reviewed_by = user
            evidence.reviewed_at = timezone.now()
            evidence.review_comment = review_comment.strip() if review_comment else ""
            evidence.save()

            # Update parent action item evidence status
            if normalized_decision == GovernanceEvidence.Status.ACCEPTED:
                action_point.evidence_status = GovernanceActionPoint.EvidenceStatus.ACCEPTED
            else:
                action_point.evidence_status = GovernanceActionPoint.EvidenceStatus.REWORK_REQUIRED
            action_point.save()

        return evidence

    @classmethod
    def check_can_close_task(cls, action_point: GovernanceActionPoint, user: User):
        """
        Validates whether an action point can be transitioned to Closed.
        If evidence is required, it must be Accepted by an authorized reviewer.
        """
        if not action_point.evidence_required:
            return

        is_admin_or_manager = (
            user.is_superuser
            or getattr(user, "is_superadmin", False)
            or user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT]
        )

        if action_point.evidence_status != GovernanceActionPoint.EvidenceStatus.ACCEPTED:
            if not is_admin_or_manager:
                raise ValidationError({
                    "status": "Task cannot be marked Closed until required evidence has been submitted and Accepted by an authorized reviewer."
                })

    @classmethod
    def bulk_review_evidence(
        cls,
        evidence_ids: list,
        decision: str,
        review_comment: str,
        user: User,
    ) -> dict:
        """
        Bulk reviews selected evidence submissions (Accept or Request Rework).
        Validates self-approval restriction and reviewer authority per record.
        Records an audit log entry.
        """
        from apps.governance.models import GovernanceBulkOperationLog

        results = []
        success_count = 0
        failure_count = 0

        for ev_id in evidence_ids:
            try:
                evidence = GovernanceEvidence.objects.select_related("action_point").get(id=ev_id)
            except GovernanceEvidence.DoesNotExist:
                results.append({
                    "evidence_id": ev_id,
                    "success": False,
                    "error": f"Evidence #{ev_id} not found."
                })
                failure_count += 1
                continue

            try:
                reviewed_item = cls.review_evidence(
                    evidence=evidence,
                    decision=decision,
                    review_comment=review_comment,
                    user=user,
                )
                results.append({
                    "evidence_id": ev_id,
                    "action_id": reviewed_item.action_point.action_id,
                    "success": True,
                    "decision": reviewed_item.status,
                })
                success_count += 1
            except (ValidationError, PermissionDenied) as e:
                err_msg = e.message_dict if hasattr(e, "message_dict") else str(e)
                results.append({
                    "evidence_id": ev_id,
                    "action_id": evidence.action_point.action_id,
                    "success": False,
                    "error": err_msg,
                })
                failure_count += 1
            except Exception as e:
                results.append({
                    "evidence_id": ev_id,
                    "action_id": evidence.action_point.action_id,
                    "success": False,
                    "error": str(e),
                })
                failure_count += 1

        GovernanceBulkOperationLog.objects.create(
            operation_type=GovernanceBulkOperationLog.OperationType.EVIDENCE_BULK_REVIEW,
            user=user,
            total_selected=len(evidence_ids),
            successful_count=success_count,
            failed_count=failure_count,
            details={
                "decision": decision,
                "review_comment": review_comment,
                "results_summary": results[:50],
            },
        )

        return {
            "total": len(evidence_ids),
            "successful_count": success_count,
            "failed_count": failure_count,
            "results": results,
        }

    @classmethod
    def delete_evidence(cls, evidence: GovernanceEvidence, user: User) -> bool:
        """
        Safely deletes an evidence document and removes its file from centralized storage.
        Restricted to Super Admin or Management.
        Re-evaluates parent task evidence status.
        """
        if not (
            user.is_superuser
            or getattr(user, "is_superadmin", False)
            or user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT]
        ):
            raise PermissionDenied("Only Super Admins or Management can delete evidence records.")

        action_point = evidence.action_point
        file_storage_name = evidence.file.name if evidence.file else None

        with transaction.atomic():
            evidence.delete()

            # Re-evaluate parent task evidence_status
            remaining = action_point.evidence_items.order_by("-version").first()
            if remaining:
                action_point.evidence_status = remaining.status
            else:
                action_point.evidence_status = GovernanceActionPoint.EvidenceStatus.NOT_SUBMITTED
            action_point.save()

        # Delete file from storage after successful database commit
        if file_storage_name:
            try:
                from django.core.files.storage import default_storage
                if default_storage.exists(file_storage_name):
                    default_storage.delete(file_storage_name)
            except Exception:
                pass

        return True

