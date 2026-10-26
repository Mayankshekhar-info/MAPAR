from datetime import date
from typing import Any, Dict, Optional
from django.db import transaction
from django.core.exceptions import ValidationError, PermissionDenied
from django.utils import timezone

from apps.governance.models import (
    GovernanceActionPoint,
    GovernanceTargetRevision,
    GovernanceTargetRevisionRequest,
)
from apps.organization.models import Circle
from apps.identity.models import User


class GovernanceService:
    @classmethod
    def resolve_user_identity(cls, user_input: Any) -> Optional[User]:
        """
        Resolves a user representation (database PK integer, string ID, username, or email)
        to the canonical User model instance.
        Ensures consistent, case-insensitive, whitespace-trimmed lookup against existing User Accounts.
        """
        if user_input is None or user_input == "" or user_input == 0:
            return None

        if isinstance(user_input, User):
            return user_input

        # 1. Integer PK or numeric string ID
        if isinstance(user_input, int) or (isinstance(user_input, str) and user_input.strip().isdigit()):
            pk = int(user_input)
            user_by_id = User.objects.filter(id=pk, is_active=True).first()
            if user_by_id:
                return user_by_id

        raw = str(user_input).strip()
        if not raw:
            return None

        # 2. Email lookup (case-insensitive & whitespace trimmed)
        if "@" in raw:
            email_normalized = raw.lower()
            user_by_email = User.objects.filter(email__iexact=email_normalized, is_active=True).first()
            if user_by_email:
                return user_by_email

        # 3. Username lookup (case-insensitive)
        user_by_username = User.objects.filter(username__iexact=raw, is_active=True).first()
        if user_by_username:
            return user_by_username

        # 4. Full name lookup
        from django.db.models import Value
        from django.db.models.functions import Concat
        user_by_name = (
            User.objects.annotate(full_name=Concat("first_name", Value(" "), "last_name"))
            .filter(full_name__iexact=raw, is_active=True)
            .first()
        )
        if user_by_name:
            return user_by_name

        # 5. Regex extraction for embedded emails (e.g. "Name <email@dom.com>" or "Name (email@dom.com)")
        import re
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', raw)
        if email_match:
            extracted_email = email_match.group(0).lower()
            user_by_extracted = User.objects.filter(email__iexact=extracted_email, is_active=True).first()
            if user_by_extracted:
                return user_by_extracted

        # 6. Regex extraction for embedded ID (e.g. "ID: #12" or "#12")
        id_match = re.search(r'(?:id[:\s#]+|#)(\d+)', raw, re.IGNORECASE)
        if id_match:
            user_by_extracted_id = User.objects.filter(id=int(id_match.group(1)), is_active=True).first()
            if user_by_extracted_id:
                return user_by_extracted_id

        raise ValidationError({
            "owner": f"User '{raw}' not found. Please provide a valid User ID, username, or registered corporate email."
        })

    @staticmethod
    def generate_next_action_id() -> str:
        """
        Generates canonical sequential ID: ACT-00001, ACT-00002...
        """
        last_action = GovernanceActionPoint.objects.order_by("-id").first()
        if not last_action:
            return "ACT-00001"
        return f"ACT-{last_action.id + 1:05d}"

    @classmethod
    def create_action_point(cls, data: Dict[str, Any], user: User) -> GovernanceActionPoint:
        """
        Creates a new governance action point.
        """
        circle_id = data.get("circle_id")
        if not circle_id:
            raise ValidationError({"circle_id": "Circle is required."})

        try:
            circle = Circle.objects.get(id=circle_id)
        except Circle.DoesNotExist:
            raise ValidationError({"circle_id": "Specified Circle does not exist."})

        raw_owner = data.get("owner") if "owner" in data else data.get("owner_id", data.get("assignee"))
        owner = cls.resolve_user_identity(raw_owner) if raw_owner else None

        raised_date = data.get("raised_date") or timezone.localdate()
        target_closure_date = data.get("target_closure_date")
        if not target_closure_date:
            raise ValidationError({"target_closure_date": "Target closure date is required."})

        action_id = data.get("action_id") or cls.generate_next_action_id()

        # Check unique action_id
        if GovernanceActionPoint.objects.filter(action_id=action_id).exists():
            action_id = cls.generate_next_action_id()

        with transaction.atomic():
            action_point = GovernanceActionPoint(
                action_id=action_id,
                circle=circle,
                hierarchy_level=data.get("hierarchy_level") or "CIRCLE",
                hierarchy_node_id=data.get("hierarchy_node_id"),
                hierarchy_path=data.get("hierarchy_path") or "",
                domain_id=data.get("domain_id"),
                department_id=data.get("department_id"),
                sub_department_id=data.get("sub_department_id"),
                function_area=data.get("function_area", "Operations"),
                action_point=data.get("action_point", "").strip(),
                key_deliverable=data.get("key_deliverable", "").strip(),
                owner=owner,
                owner_name_override=data.get("owner_name_override", ""),
                assigned_by=user,
                raised_date=raised_date,
                target_closure_date=target_closure_date,
                current_target_date=target_closure_date,
                revision_count=0,
                status=data.get("status", GovernanceActionPoint.Status.OPEN),
                actual_closure_date=data.get("actual_closure_date"),
                priority=data.get("priority", GovernanceActionPoint.Priority.MEDIUM),
                bucket=str(data.get("bucket", "")).strip() if data.get("bucket") else "",
                evidence_required=data.get("evidence_required", True),
                last_update=data.get("last_update", "").strip(),
                created_by=user,
            )
            action_point.save()

            if action_point.owner_id:
                from apps.notifications.services.task_assignment_email_service import TaskAssignmentEmailService
                ap_id = action_point.id
                transaction.on_commit(lambda: TaskAssignmentEmailService.send_assignment_email(
                    GovernanceActionPoint.objects.select_related("owner", "circle", "department", "assigned_by").get(id=ap_id),
                    is_reassignment=False,
                ))

        return action_point


    @classmethod
    def update_action_point(cls, action_point: GovernanceActionPoint, data: Dict[str, Any], user: User) -> GovernanceActionPoint:
        """
        Updates an action point with scoped permission checks.
        - Assigned owner can update: status, last_update, actual_closure_date.
        - Admin / assigner / managers can update all fields (circle, owner, priority, dates).
        """
        is_admin_or_manager = (
            user.is_superuser
            or getattr(user, "is_superadmin", False)
            or user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT, User.Role.CORPORATE_DOMAIN_LEAD, User.Role.CIRCLE_DOMAIN_MANAGER]
            or action_point.created_by_id == user.id
            or action_point.assigned_by_id == user.id
        )

        is_assigned_owner = (action_point.owner_id == user.id)

        if not is_admin_or_manager and not is_assigned_owner:
            raise PermissionDenied("You do not have permission to update this action point.")

        if "target_closure_date" in data or "current_target_date" in data:
            raise PermissionDenied("Target dates cannot be modified directly via task update. Please submit a revision request.")

        with transaction.atomic():
            # Allowed for assigned owners and admins
            if "status" in data:
                old_status = action_point.status
                new_status = data["status"]
                if new_status == GovernanceActionPoint.Status.CLOSED:
                    from apps.governance.services.governance_evidence_service import GovernanceEvidenceService
                    GovernanceEvidenceService.check_can_close_task(action_point, user)
                action_point.status = new_status
                if new_status == GovernanceActionPoint.Status.CLOSED and not action_point.actual_closure_date:
                    action_point.actual_closure_date = data.get("actual_closure_date") or timezone.localdate()
                elif new_status != GovernanceActionPoint.Status.CLOSED and old_status == GovernanceActionPoint.Status.CLOSED:
                    action_point.actual_closure_date = None

            if "actual_closure_date" in data:
                action_point.actual_closure_date = data["actual_closure_date"]

            if "last_update" in data:
                action_point.last_update = data["last_update"]

            # Admin & Manager only fields
            if is_admin_or_manager:
                if "circle_id" in data and data["circle_id"]:
                    action_point.circle_id = data["circle_id"]

                if "function_area" in data and data["function_area"]:
                    action_point.function_area = data["function_area"]

                if "action_point" in data and data["action_point"]:
                    action_point.action_point = data["action_point"]

                if "key_deliverable" in data:
                    action_point.key_deliverable = data["key_deliverable"]

                is_reassignment = False
                if "owner" in data or "owner_id" in data or "assignee" in data:
                    raw_owner = data.get("owner") if "owner" in data else data.get("owner_id", data.get("assignee"))
                    if raw_owner is None or raw_owner == "" or raw_owner == 0:
                        action_point.owner = None
                    else:
                        new_owner = cls.resolve_user_identity(raw_owner)
                        if action_point.owner_id != getattr(new_owner, "id", None):
                            action_point.owner = new_owner
                            action_point.assigned_by = user
                            is_reassignment = True

                if "priority" in data and data["priority"]:
                    action_point.priority = data["priority"]

                if "raised_date" in data and data["raised_date"]:
                    action_point.raised_date = data["raised_date"]

                if "owner_name_override" in data:
                    action_point.owner_name_override = data["owner_name_override"]

                if "bucket" in data:
                    action_point.bucket = str(data["bucket"]).strip() if data["bucket"] is not None else ""

            action_point.save()

            if is_admin_or_manager and locals().get("is_reassignment") and action_point.owner_id:
                from apps.notifications.services.task_assignment_email_service import TaskAssignmentEmailService
                ap_id = action_point.id
                transaction.on_commit(lambda: TaskAssignmentEmailService.send_assignment_email(
                    GovernanceActionPoint.objects.select_related("owner", "circle", "department", "assigned_by").get(id=ap_id),
                    is_reassignment=True,
                ))

        return action_point

    @classmethod
    def can_request_target_revision(cls, action_point: GovernanceActionPoint, user: User) -> bool:
        """
        Determines whether the user is authorized to submit a target date revision request.
        Assigned owners, assigners, circle managers, and governance admins are authorized.
        """
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
        if user.role in [User.Role.CIRCLE_DOMAIN_MANAGER, User.Role.CIRCLE_DATA_ENTRY] and user_circle_id == action_point.circle_id:
            return True
        return False

    @classmethod
    def can_review_target_revision(cls, action_point: GovernanceActionPoint, user: User) -> bool:
        """
        Determines whether the user has governance authority to approve or reject revision requests.
        Strictly restricted to authorized governance reviewers/admins (not ordinary assignees).
        """
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or getattr(user, "is_superadmin", False):
            return True
        if user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT, User.Role.CORPORATE_DOMAIN_LEAD]:
            return True
        if action_point.assigned_by_id == user.id:
            return True
        user_circle_id = getattr(user, "circle_id", None) or (user.circle.id if getattr(user, "circle", None) else None)
        if user.role == User.Role.CIRCLE_DOMAIN_MANAGER and user_circle_id == action_point.circle_id:
            return True
        return False

    @classmethod
    def submit_target_revision_request(
        cls,
        action_point: GovernanceActionPoint,
        requested_target_date: date,
        reason: str,
        user: User,
    ) -> GovernanceTargetRevisionRequest:
        """
        Submits a formal request for a target date extension.
        Enforces validation rules:
        - Requester must be authorized for this action point.
        - Requested date must be provided and different from current target.
        - Reason is mandatory.
        - Blocks duplicate pending requests for the same task.
        - DOES NOT alter the active target date of the task.
        """
        if not cls.can_request_target_revision(action_point, user):
            raise PermissionDenied("You are not authorized to request a target date revision for this task.")

        if not requested_target_date:
            raise ValidationError({"requested_target_date": "Requested target date is required."})

        if action_point.current_target_date == requested_target_date:
            raise ValidationError({"requested_target_date": "Requested target date must be different from current target date."})

        cleaned_reason = reason.strip() if reason else ""
        if not cleaned_reason:
            raise ValidationError({"reason": "A mandatory reason for the target date revision is required."})

        # Check for existing pending request
        if action_point.revision_requests.filter(status=GovernanceTargetRevisionRequest.Status.PENDING).exists():
            raise ValidationError({"requested_target_date": "A revision request is already pending review for this task."})

        with transaction.atomic():
            request_item = GovernanceTargetRevisionRequest.objects.create(
                action_point=action_point,
                requested_by=user,
                original_target_date=action_point.target_closure_date,
                current_target_date=action_point.current_target_date,
                requested_target_date=requested_target_date,
                reason=cleaned_reason,
                status=GovernanceTargetRevisionRequest.Status.PENDING,
                requested_at=timezone.now(),
            )

        return request_item

    @classmethod
    def review_target_revision_request(
        cls,
        request_item: GovernanceTargetRevisionRequest,
        decision: str,
        reviewer_comment: str,
        user: User,
    ) -> GovernanceTargetRevisionRequest:
        """
        Processes a target date revision request (Approve or Reject).
        Enforces:
        - Reviewer must be an authorized Governance reviewer within organization scope.
        - Strict separation of duties: Reviewer CANNOT be the requester.
        - On approval: updates active current_target_date and creates a GovernanceTargetRevision record.
        - On rejection: leaves task dates unchanged and records rejection reason.
        """
        action_point = request_item.action_point

        if not cls.can_review_target_revision(action_point, user):
            raise PermissionDenied("You are not authorized to review date revision requests for this task.")

        # Strict separation: requester cannot review/approve their own request
        if request_item.requested_by_id == user.id:
            raise PermissionDenied("You cannot approve or reject your own target date revision request.")

        normalized_decision = decision.strip().capitalize()
        if normalized_decision not in [GovernanceTargetRevisionRequest.Status.APPROVED, GovernanceTargetRevisionRequest.Status.REJECTED]:
            raise ValidationError({"decision": "Review decision must be 'Approved' or 'Rejected'."})

        if request_item.status != GovernanceTargetRevisionRequest.Status.PENDING:
            raise ValidationError({"status": f"This request has already been {request_item.status.lower()}."})

        with transaction.atomic():
            if normalized_decision == GovernanceTargetRevisionRequest.Status.APPROVED:
                revision_number = action_point.revision_count + 1
                previous_target = action_point.current_target_date

                # Record in permanent audit history
                GovernanceTargetRevision.objects.create(
                    action_point=action_point,
                    revision_number=revision_number,
                    previous_target=previous_target,
                    revised_target=request_item.requested_target_date,
                    revision_date=timezone.localdate(),
                    revised_by=user,
                    reason=request_item.reason,
                    approved_by=user.get_full_name() or user.username,
                )

                # Update effective target closure date
                action_point.current_target_date = request_item.requested_target_date
                action_point.revision_count = revision_number
                action_point.save()

                request_item.status = GovernanceTargetRevisionRequest.Status.APPROVED
            else:
                request_item.status = GovernanceTargetRevisionRequest.Status.REJECTED

            request_item.reviewed_by = user
            request_item.reviewed_at = timezone.now()
            request_item.reviewer_comment = (reviewer_comment or "").strip()
            request_item.save()

        return request_item

    @classmethod
    def revise_target_date(
        cls,
        action_point: GovernanceActionPoint,
        new_target_date: date,
        revised_by: User,
        reason: str = "",
        approved_by: str = "",
    ) -> GovernanceTargetRevision:
        """
        Revises the current target date while preserving previous target in history.
        Enforces governance reviewer authorization. Ordinary assignees cannot call directly.
        """
        if not cls.can_review_target_revision(action_point, revised_by):
            raise PermissionDenied("Direct target date revision is restricted to authorized Governance reviewers. Assignees must submit a revision request.")

        if not new_target_date:
            raise ValidationError({"new_target_date": "Revised target date is required."})

        if action_point.current_target_date == new_target_date:
            raise ValidationError({"new_target_date": "Revised target date must be different from current target date."})

        with transaction.atomic():
            previous_target = action_point.current_target_date
            revision_number = action_point.revision_count + 1

            revision = GovernanceTargetRevision.objects.create(
                action_point=action_point,
                revision_number=revision_number,
                previous_target=previous_target,
                revised_target=new_target_date,
                revision_date=timezone.localdate(),
                revised_by=revised_by,
                reason=reason.strip(),
                approved_by=approved_by.strip(),
            )

            action_point.current_target_date = new_target_date
            action_point.revision_count = revision_number
            action_point.save()

        return revision

    @classmethod
    def bulk_update_actions(
        cls,
        task_ids: list,
        updates: Dict[str, Any],
        user: User,
    ) -> Dict[str, Any]:
        """
        Applies bulk updates across selected action points.
        Validates every record individually and records a traceable bulk audit log.
        Supported bulk fields: owner_id, status, priority, target_closure_date.
        """
        from apps.governance.models import GovernanceBulkOperationLog

        results = []
        success_count = 0
        failure_count = 0

        for task_id in task_ids:
            try:
                action_point = GovernanceActionPoint.objects.get(id=task_id)
            except GovernanceActionPoint.DoesNotExist:
                results.append({
                    "task_id": task_id,
                    "success": False,
                    "error": f"Task #{task_id} not found."
                })
                failure_count += 1
                continue

            try:
                task_updates = dict(updates)
                target_date = task_updates.pop("target_closure_date", None)
                if target_date:
                    if not cls.can_review_target_revision(action_point, user):
                        raise PermissionDenied("Only authorized governance managers can directly revise target dates in bulk.")
                    if isinstance(target_date, str):
                        from datetime import datetime
                        target_date_val = datetime.strptime(target_date, "%Y-%m-%d").date()
                    else:
                        target_date_val = target_date
                    if target_date_val != action_point.current_target_date:
                        cls.revise_target_date(
                            action_point=action_point,
                            new_target_date=target_date_val,
                            revised_by=user,
                            reason="Bulk target date revision",
                            approved_by=f"{user.get_full_name()} ({user.username})",
                        )
                if task_updates:
                    cls.update_action_point(action_point, task_updates, user)
                results.append({
                    "task_id": task_id,
                    "action_id": action_point.action_id,
                    "success": True,
                    "updated_fields": list(updates.keys()),
                })
                success_count += 1
            except (ValidationError, PermissionDenied) as e:
                err_msg = e.message_dict if hasattr(e, "message_dict") else str(e)
                results.append({
                    "task_id": task_id,
                    "action_id": action_point.action_id,
                    "success": False,
                    "error": err_msg,
                })
                failure_count += 1
            except Exception as e:
                results.append({
                    "task_id": task_id,
                    "action_id": action_point.action_id,
                    "success": False,
                    "error": str(e),
                })
                failure_count += 1

        GovernanceBulkOperationLog.objects.create(
            operation_type=GovernanceBulkOperationLog.OperationType.ACTION_BULK_UPDATE,
            user=user,
            total_selected=len(task_ids),
            successful_count=success_count,
            failed_count=failure_count,
            details={"updates_applied": updates, "results_summary": results[:50]},
        )

        return {
            "total": len(task_ids),
            "successful_count": success_count,
            "failed_count": failure_count,
            "results": results,
        }

