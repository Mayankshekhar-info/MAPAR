import os
import mimetypes
from django.http import HttpResponse, FileResponse, Http404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.core.paginator import Paginator

from apps.identity.models import User
from apps.governance.models import (
    GovernanceActionPoint,
    GovernanceEvidence,
    GovernanceWeeklyUpdate,
    GovernanceTargetRevisionRequest,
)
from apps.governance.selectors.governance_selectors import (
    get_governance_actions,
    get_governance_metadata,
    get_governance_summary_metrics,
    get_target_revision_history,
    get_action_evidence_list,
    get_user_evidence_list,
    get_task_weekly_updates,
    get_task_full_detail,
    get_eligible_users_for_hierarchy_node,
    get_governance_revision_requests,
    apply_governance_scope,
)
from apps.governance.services.governance_service import GovernanceService
from apps.governance.services.governance_evidence_service import GovernanceEvidenceService
from apps.governance.services.governance_weekly_update_service import GovernanceWeeklyUpdateService
from apps.governance.services.governance_excel_service import GovernanceExcelService
from apps.governance.api.serializers import (
    GovernanceActionPointSerializer,
    GovernanceTargetRevisionSerializer,
    GovernanceEvidenceSerializer,
    GovernanceWeeklyUpdateSerializer,
    ReviseTargetSerializer,
    ReviewEvidenceSerializer,
    GovernanceActionBulkUpdateSerializer,
    GovernanceWeeklyBulkSubmitSerializer,
    GovernanceEvidenceBulkReviewSerializer,
    GovernanceTargetRevisionRequestSerializer,
    CreateTargetRevisionRequestSerializer,
    ReviewTargetRevisionRequestSerializer,
    GovernanceTaskReviewSerializer,
    AssignTaskReviewSerializer,
    UpdateTaskReviewSerializer,
    SubmitForVerificationSerializer,
    VerifyReviewSerializer,
    ApproveReviewSerializer,
    SubmitReviewSerializer,
)




class GovernanceActionPointListView(APIView):
    """
    GET  /api/v1/governance/actions/ - Filtered, paginated list of governance action points
    POST /api/v1/governance/actions/ - Create a new action point
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        circle_id_param = request.query_params.get("circle_id")
        circle_id = int(circle_id_param) if circle_id_param and circle_id_param.isdigit() else None

        owner_id_param = request.query_params.get("owner_id")
        owner_id = int(owner_id_param) if owner_id_param and owner_id_param.isdigit() else None

        filters = {
            "search": request.query_params.get("search"),
            "circle_id": circle_id,
            "owner_id": owner_id,
            "status": request.query_params.get("status"),
            "evidence_status": request.query_params.get("evidence_status"),
            "view_mode": request.query_params.get("view_mode"),
            "priority": request.query_params.get("priority"),
            "function_area": request.query_params.get("function_area"),
            "is_escalated": request.query_params.get("is_escalated"),
            "is_overdue": request.query_params.get("is_overdue"),
            "ageing_bucket": request.query_params.get("ageing_bucket"),
            "is_due_soon": request.query_params.get("is_due_soon"),
            "reporting_week": request.query_params.get("reporting_week"),
            "bucket": request.query_params.get("bucket"),
            "start_date": request.query_params.get("start_date"),
            "end_date": request.query_params.get("end_date"),
            "hierarchy_level": request.query_params.get("hierarchy_level"),
            "hierarchy_node_id": request.query_params.get("hierarchy_node_id"),
            "owner_name": request.query_params.get("owner_name"),
            "ordering": request.query_params.get("ordering", "-raised_date"),
            "mode": request.query_params.get("mode"),
        }

        qs = get_governance_actions(filters, request.user)

        page_number = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 25))

        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page_number)

        serializer = GovernanceActionPointSerializer(page_obj.object_list, many=True)

        return Response({
            "success": True,
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page_number,
            "page_size": page_size,
            "results": serializer.data,
        })

    def post(self, request):
        serializer = GovernanceActionPointSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validated_data = dict(serializer.validated_data)
            action_data = {
                "circle_id": validated_data["circle"].id,
                "hierarchy_level": validated_data.get("hierarchy_level") or request.data.get("hierarchy_level", "CIRCLE"),
                "hierarchy_node_id": validated_data.get("hierarchy_node_id") or request.data.get("hierarchy_node_id"),
                "hierarchy_path": validated_data.get("hierarchy_path") or request.data.get("hierarchy_path", ""),
                "domain_id": request.data.get("domain_id"),
                "department_id": request.data.get("department_id"),
                "sub_department_id": request.data.get("sub_department_id"),
                "function_area": validated_data.get("function_area", "Operations"),
                "bucket": validated_data.get("bucket") or request.data.get("bucket", ""),
                "action_point": validated_data["action_point"],
                "key_deliverable": validated_data.get("key_deliverable", ""),
                "owner_id": validated_data["owner"].id if validated_data.get("owner") else None,
                "owner_name_override": validated_data.get("owner_name_override", ""),
                "raised_date": validated_data.get("raised_date"),
                "target_closure_date": validated_data["target_closure_date"],
                "status": validated_data.get("status", GovernanceActionPoint.Status.OPEN),
                "priority": validated_data.get("priority", GovernanceActionPoint.Priority.MEDIUM),
                "actual_closure_date": validated_data.get("actual_closure_date"),
                "evidence_required": request.data.get("evidence_required", True),
                "last_update": validated_data.get("last_update", ""),
            }
            action_point = GovernanceService.create_action_point(action_data, request.user)
            out_serializer = GovernanceActionPointSerializer(action_point)
            return Response({"success": True, "action": out_serializer.data}, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GovernanceActionPointDetailView(APIView):
    """
    GET    /api/v1/governance/actions/<id>/ - Action point details
    PATCH  /api/v1/governance/actions/<id>/ - Update action point (owner or admin)
    DELETE /api/v1/governance/actions/<id>/ - Delete action point (admin only)
    """
    permission_classes = [IsAuthenticated]

    def _get_action(self, action_id, user):
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
        action = qs.filter(id=action_id).first()
        if not action:
            raise PermissionDenied("Action point not found or outside authorized scope.")
        return action

    def get(self, request, pk):
        action = self._get_action(pk, request.user)
        serializer = GovernanceActionPointSerializer(action)
        return Response({"success": True, "action": serializer.data})

    def patch(self, request, pk):
        if "current_target_date" in request.data or "target_closure_date" in request.data:
            return Response(
                {"success": False, "errors": "Target dates cannot be modified directly via task update. Please submit a revision request."},
                status=status.HTTP_403_FORBIDDEN,
            )

        action = self._get_action(pk, request.user)
        if not GovernanceService.can_edit_task(action, request.user):
            return Response(
                {"success": False, "errors": "You do not have permission to edit this action point."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = GovernanceActionPointSerializer(action, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            update_data = {}
            vd = serializer.validated_data
            if "status" in vd:
                update_data["status"] = vd["status"]
            if "actual_closure_date" in vd:
                update_data["actual_closure_date"] = vd["actual_closure_date"]
            if "last_update" in vd:
                update_data["last_update"] = vd["last_update"]
            if "circle" in vd:
                update_data["circle_id"] = vd["circle"].id
            if "owner" in vd:
                update_data["owner_id"] = vd["owner"].id if vd["owner"] else None
            if "function_area" in vd:
                update_data["function_area"] = vd["function_area"]
            if "action_point" in vd:
                update_data["action_point"] = vd["action_point"]
            if "key_deliverable" in vd:
                update_data["key_deliverable"] = vd["key_deliverable"]
            if "priority" in vd:
                update_data["priority"] = vd["priority"]
            if "raised_date" in vd:
                update_data["raised_date"] = vd["raised_date"]
            if "owner_name_override" in vd:
                update_data["owner_name_override"] = vd["owner_name_override"]
            if "bucket" in vd:
                update_data["bucket"] = vd["bucket"]
            elif "bucket" in request.data:
                update_data["bucket"] = request.data["bucket"]
            if "evidence_required" in request.data:
                update_data["evidence_required"] = request.data["evidence_required"]

            updated_action = GovernanceService.update_action_point(action, update_data, request.user)
            out_serializer = GovernanceActionPointSerializer(updated_action)
            return Response({"success": True, "action": out_serializer.data})
        except PermissionDenied as pe:
            return Response({"success": False, "errors": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except (ValidationError, DjangoValidationError) as e:
            msg = e.message_dict if hasattr(e, "message_dict") else str(e)
            return Response({"success": False, "errors": msg}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        action = self._get_action(pk, request.user)
        if not (request.user.is_superuser or getattr(request.user, "is_superadmin", False) or request.user.role == "SUPER_ADMIN"):
            return Response({"success": False, "errors": "Only Super Admins can delete action points."}, status=status.HTTP_403_FORBIDDEN)
        action.delete()
        return Response({"success": True, "message": "Action point deleted successfully."})


class GovernanceEvidenceUploadView(APIView):
    """
    POST /api/v1/governance/actions/<id>/evidence/
    Uploads supporting evidence proof file for an assigned action point.
    GET  /api/v1/governance/actions/<id>/evidence/
    Returns full evidence submission history for the action point.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_action(self, action_id, user):
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
        action = qs.filter(id=action_id).first()
        if not action:
            raise PermissionDenied("Action point not found or outside authorized scope.")
        return action

    def get(self, request, pk):
        action = self._get_action(pk, request.user)
        evidence_items = get_action_evidence_list(action.id, request.user)
        serializer = GovernanceEvidenceSerializer(evidence_items, many=True)
        return Response({"success": True, "evidence_items": serializer.data})

    def post(self, request, pk):
        action = self._get_action(pk, request.user)
        uploaded_file = request.FILES.get("file") or request.data.get("file")
        if not uploaded_file:
            return Response({"success": False, "errors": {"file": "An evidence file is required."}}, status=status.HTTP_400_BAD_REQUEST)

        title = request.data.get("title", "")
        description = request.data.get("description", "")
        reporting_week = request.data.get("reporting_week", "")

        try:
            evidence = GovernanceEvidenceService.submit_evidence(
                action_point=action,
                uploaded_file=uploaded_file,
                title=title,
                description=description,
                user=request.user,
                reporting_week=reporting_week,
            )
            serializer = GovernanceEvidenceSerializer(evidence)
            return Response({
                "success": True,
                "evidence": serializer.data,
                "message": f"Evidence v{evidence.version} submitted successfully and marked Pending Review.",
            }, status=status.HTTP_201_CREATED)
        except (ValidationError, DjangoValidationError, PermissionDenied) as e:
            msg = e.message_dict if hasattr(e, "message_dict") else str(e)
            return Response({"success": False, "errors": msg}, status=status.HTTP_400_BAD_REQUEST)


class GovernanceEvidenceReviewView(APIView):
    """
    POST /api/v1/governance/evidence/<id>/review/
    Authorized manager reviews evidence item (Accept or Rework Required).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        evidence = GovernanceEvidence.objects.select_related("action_point").filter(id=pk).first()
        if not evidence:
            return Response({"success": False, "errors": "Evidence record not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReviewEvidenceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            reviewed = GovernanceEvidenceService.review_evidence(
                evidence=evidence,
                decision=serializer.validated_data["decision"],
                review_comment=serializer.validated_data.get("review_comment", ""),
                user=request.user,
            )
            out_serializer = GovernanceEvidenceSerializer(reviewed)
            return Response({
                "success": True,
                "evidence": out_serializer.data,
                "message": f"Evidence has been marked {reviewed.status}.",
            })
        except (ValidationError, DjangoValidationError, PermissionDenied) as e:
            msg = e.message_dict if hasattr(e, "message_dict") else str(e)
            return Response({"success": False, "errors": msg}, status=status.HTTP_400_BAD_REQUEST)


class GovernanceEvidenceDownloadView(APIView):
    """
    GET    /api/v1/governance/evidence/<id>/download/
           Secure file streaming/preview for authorized users only.
    DELETE /api/v1/governance/evidence/<id>/download/
           Controlled deletion of evidence record and centralized storage file (Super Admin/Management).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        evidence = GovernanceEvidence.objects.select_related("action_point", "action_point__circle").filter(id=pk).first()
        if not evidence or not evidence.file or not evidence.file.name:
            raise Http404("Evidence record or file reference not found.")

        # Centralized storage verification: ensure file physically exists in storage provider
        if not evidence.file.storage.exists(evidence.file.name):
            raise Http404(f"Evidence file '{evidence.file_name}' could not be located in centralized storage.")

        # Scoped authorization check:
        user = request.user
        is_super = (
            user.is_superuser
            or getattr(user, "is_superadmin", False)
            or user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT]
        )
        is_uploader = (evidence.submitted_by_id == user.id)
        action = evidence.action_point
        is_task_actor = (
            action.owner_id == user.id
            or action.created_by_id == user.id
            or action.assigned_by_id == user.id
        )
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
        in_scope = qs.filter(id=action.id).exists()

        if not (is_super or is_uploader or is_task_actor or in_scope):
            raise PermissionDenied("You do not have permission to access or download this evidence file.")

        try:
            file_handle = evidence.file.open("rb")
            content_type, _ = mimetypes.guess_type(evidence.file_name)
            if not content_type:
                content_type = evidence.file_type or "application/octet-stream"

            is_inline = request.query_params.get("inline") in ["1", "true", "True"]
            disposition = "inline" if is_inline else "attachment"
            safe_name = os.path.basename(evidence.file_name)

            response = FileResponse(file_handle, content_type=content_type)
            response["Content-Disposition"] = f'{disposition}; filename="{safe_name}"'
            return response
        except Exception as e:
            raise Http404(f"Error streaming evidence file from centralized storage: {str(e)}")

    def delete(self, request, pk):
        evidence = GovernanceEvidence.objects.select_related("action_point").filter(id=pk).first()
        if not evidence:
            return Response({"success": False, "errors": "Evidence record not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            GovernanceEvidenceService.delete_evidence(evidence, request.user)
            return Response({
                "success": True,
                "message": f"Evidence record #{pk} and storage file deleted successfully.",
            })
        except PermissionDenied as e:
            return Response({"success": False, "errors": str(e)}, status=status.HTTP_403_FORBIDDEN)


class GovernanceMyEvidenceListView(APIView):
    """
    GET /api/v1/governance/my-evidence/
    Returns list of all evidence items submitted by the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        search = request.query_params.get("search")
        evidence_qs = get_user_evidence_list(request.user, search=search)

        page_number = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 25))

        paginator = Paginator(evidence_qs, page_size)
        page_obj = paginator.get_page(page_number)

        serializer = GovernanceEvidenceSerializer(page_obj.object_list, many=True)

        return Response({
            "success": True,
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page_number,
            "page_size": page_size,
            "results": serializer.data,
        })


class GovernanceReviseTargetView(APIView):
    """
    POST /api/v1/governance/actions/<id>/revise-target/
    Records target revision, creates audit history entry, and updates current target.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), request.user)
        action = qs.filter(id=pk).first()
        if not action:
            return Response({"success": False, "errors": "Action point not found or outside scope."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReviseTargetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            revision = GovernanceService.revise_target_date(
                action_point=action,
                new_target_date=serializer.validated_data["new_target_date"],
                revised_by=request.user,
                reason=serializer.validated_data.get("reason", ""),
                approved_by=serializer.validated_data.get("approved_by", ""),
            )
            action.refresh_from_db()
            return Response({
                "success": True,
                "revision": GovernanceTargetRevisionSerializer(revision).data,
                "action": GovernanceActionPointSerializer(action).data,
            })
        except (ValidationError, DjangoValidationError) as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as e:
            return Response({"success": False, "errors": str(e)}, status=status.HTTP_403_FORBIDDEN)


class GovernanceRevisionHistoryView(APIView):
    """
    GET /api/v1/governance/actions/<id>/revisions/
    Returns target revision history list for an action point.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        revisions = get_target_revision_history(pk, request.user)
        if revisions is None:
            return Response({"success": False, "errors": "Action point not found or outside scope."}, status=status.HTTP_404_NOT_FOUND)
        serializer = GovernanceTargetRevisionSerializer(revisions, many=True)
        return Response({"success": True, "revisions": serializer.data})


class GovernanceActionRevisionRequestListView(APIView):
    """
    GET  /api/v1/governance/actions/<id>/revision-requests/
    Returns all target date revision requests submitted for this action point.
    POST /api/v1/governance/actions/<id>/revision-requests/
    Submits a formal request to revise the target closure date.
    Preserves existing active dates and prevents duplicate pending requests.
    """
    permission_classes = [IsAuthenticated]

    def _get_action(self, action_id, user):
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
        action = qs.filter(id=action_id).first()
        if not action:
            raise PermissionDenied("Action point not found or outside authorized scope.")
        return action

    def get(self, request, pk):
        action = self._get_action(pk, request.user)
        requests_qs = action.revision_requests.select_related("requested_by", "reviewed_by").order_by("-requested_at")
        serializer = GovernanceTargetRevisionRequestSerializer(requests_qs, many=True)
        return Response({"success": True, "revision_requests": serializer.data})

    def post(self, request, pk):
        action = self._get_action(pk, request.user)
        serializer = CreateTargetRevisionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            req_item = GovernanceService.submit_target_revision_request(
                action_point=action,
                requested_target_date=serializer.validated_data["requested_target_date"],
                reason=serializer.validated_data["reason"],
                user=request.user,
            )
            out_serializer = GovernanceTargetRevisionRequestSerializer(req_item)
            return Response({
                "success": True,
                "revision_request": out_serializer.data,
                "message": "Target date revision request submitted successfully and is pending Governance review.",
            }, status=status.HTTP_201_CREATED)
        except (ValidationError, DjangoValidationError) as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as e:
            return Response({"success": False, "errors": str(e)}, status=status.HTTP_403_FORBIDDEN)


class GovernanceRevisionRequestListView(APIView):
    """
    GET /api/v1/governance/revision-requests/
    Lists all target date revision requests within the user's organization scope.
    Used by Governance & Risk reviewers to track and process pending extension requests.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = get_governance_revision_requests(request.query_params, request.user)
        serializer = GovernanceTargetRevisionRequestSerializer(data["results"], many=True)
        return Response({
            "success": True,
            "count": data["count"],
            "pending_count": data["pending_count"],
            "page": data["page"],
            "page_size": data["page_size"],
            "results": serializer.data,
        })


class GovernanceRevisionRequestReviewView(APIView):
    """
    POST /api/v1/governance/revision-requests/<id>/review/
    Processes an approval or rejection for a target date revision request.
    Strictly enforces that the reviewer cannot be the requester.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        scoped_actions = apply_governance_scope(GovernanceActionPoint.objects.all(), request.user)
        req_item = GovernanceTargetRevisionRequest.objects.select_related("action_point").filter(
            id=pk, action_point__in=scoped_actions
        ).first()
        if not req_item:
            return Response({"success": False, "errors": "Revision request not found or outside authorized scope."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReviewTargetRevisionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            reviewed = GovernanceService.review_target_revision_request(
                request_item=req_item,
                decision=serializer.validated_data["decision"],
                reviewer_comment=serializer.validated_data.get("reviewer_comment", ""),
                user=request.user,
            )
            out_serializer = GovernanceTargetRevisionRequestSerializer(reviewed)
            return Response({
                "success": True,
                "revision_request": out_serializer.data,
                "message": f"Target date revision request has been {reviewed.status.lower()} successfully.",
            })
        except (ValidationError, DjangoValidationError) as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as e:
            return Response({"success": False, "errors": str(e)}, status=status.HTTP_403_FORBIDDEN)



class GovernanceMetricsView(APIView):
    """
    GET /api/v1/governance/metrics/
    Computes dashboard summary metrics from live database records.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        circle_id_param = request.query_params.get("circle_id")
        circle_id = int(circle_id_param) if circle_id_param and circle_id_param.isdigit() else None
        reporting_week = request.query_params.get("reporting_week")
        mode = request.query_params.get("mode")
        metrics = get_governance_summary_metrics(
            request.user, circle_id=circle_id, reporting_week=reporting_week, mode=mode
        )
        return Response({"success": True, "metrics": metrics})


class GovernanceMetadataView(APIView):
    """
    GET /api/v1/governance/meta/
    Returns circles, assignable users, and choices for filters and forms.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        meta = get_governance_metadata(request.user)
        return Response({"success": True, "metadata": meta})


class GovernanceExcelTemplateView(APIView):
    """
    GET /api/v1/governance/excel/template/
    Generates and returns standard Excel template with dropdowns and validations.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        output = GovernanceExcelService.generate_template()
        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="Governance_Action_Tracking_Template.xlsx"'
        return response


class GovernanceExcelExportView(APIView):
    """
    GET /api/v1/governance/excel/export/
    Exports scoped actions and revisions into the canonical multi-sheet 'Governance & Action Tracking.xlsx' workbook.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        circle_id_param = request.query_params.get("circle_id")
        circle_id = int(circle_id_param) if circle_id_param and circle_id_param.isdigit() else None

        owner_id_param = request.query_params.get("owner_id")
        owner_id = int(owner_id_param) if owner_id_param and owner_id_param.isdigit() else None

        filters = {
            "search": request.query_params.get("search"),
            "circle_id": circle_id,
            "owner_id": owner_id,
            "status": request.query_params.get("status"),
            "evidence_status": request.query_params.get("evidence_status"),
            "view_mode": request.query_params.get("view_mode"),
            "priority": request.query_params.get("priority"),
            "function_area": request.query_params.get("function_area"),
            "is_escalated": request.query_params.get("is_escalated"),
            "is_overdue": request.query_params.get("is_overdue"),
            "ageing_bucket": request.query_params.get("ageing_bucket"),
            "is_due_soon": request.query_params.get("is_due_soon"),
            "reporting_week": request.query_params.get("reporting_week"),
            "start_date": request.query_params.get("start_date"),
            "end_date": request.query_params.get("end_date"),
            "hierarchy_level": request.query_params.get("hierarchy_level"),
            "hierarchy_node_id": request.query_params.get("hierarchy_node_id"),
        }
        output = GovernanceExcelService.export_governance_workbook(request.user, filters)
        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="Governance & Action Tracking.xlsx"'
        return response


class GovernanceExcelUploadView(APIView):
    """
    POST /api/v1/governance/excel/upload/
    Uploads and validates completed Excel sheet, saves valid records, returns row errors.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"success": False, "errors": "No file uploaded. Please upload an Excel (.xlsx) file."}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.endswith((".xlsx", ".xls")):
            return Response({"success": False, "errors": "Invalid file format. Please upload an Excel (.xlsx) file."}, status=status.HTTP_400_BAD_REQUEST)

        default_week = request.data.get("reporting_week") or request.query_params.get("reporting_week")
        result = GovernanceExcelService.import_excel(file_obj, request.user, default_reporting_week=default_week)
        if not result["success"]:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)


class GovernanceActionPointFullDetailView(APIView):
    """
    GET /api/v1/governance/actions/<id>/full-detail/
    Returns full comprehensive details for dedicated Task Detail Page:
    - Complete task metadata
    - Dynamic organization hierarchy path
    - Chronological weekly progress updates timeline
    - Weekly progress trend data points for charting
    - Target revision history
    - Evidence submissions and review history
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        mode = request.query_params.get("mode")
        detail_data = get_task_full_detail(pk, request.user, mode=mode)
        if not detail_data:
            return Response(
                {"success": False, "error": f"Task #{pk} not found or outside authorized scope."},
                status=status.HTTP_404_NOT_FOUND,
            )

        action_serializer = GovernanceActionPointSerializer(detail_data["action"])
        weekly_serializer = GovernanceWeeklyUpdateSerializer(detail_data["weekly_updates"], many=True)
        revisions_serializer = GovernanceTargetRevisionSerializer(detail_data["revisions"], many=True)
        evidence_serializer = GovernanceEvidenceSerializer(detail_data["evidence_items"], many=True)
        revision_requests_serializer = GovernanceTargetRevisionRequestSerializer(detail_data["revision_requests"], many=True)
        task_reviews_serializer = GovernanceTaskReviewSerializer(detail_data.get("task_reviews", []), many=True)
        active_review_serializer = (
            GovernanceTaskReviewSerializer(detail_data["active_review"]).data
            if detail_data.get("active_review")
            else None
        )

        return Response({
            "success": True,
            "action": action_serializer.data,
            "resolved_hierarchy_path": detail_data["resolved_hierarchy_path"],
            "weekly_updates": weekly_serializer.data,
            "progress_trend": detail_data["progress_trend"],
            "revisions": revisions_serializer.data,
            "evidence_items": evidence_serializer.data,
            "revision_requests": revision_requests_serializer.data,
            "task_reviews": task_reviews_serializer.data,
            "active_review": active_review_serializer,
            "can_edit_task": detail_data.get("can_edit_task", False),
            "can_assign_review": detail_data.get("can_assign_review", True),
            "can_submit_for_verification": detail_data.get("can_submit_for_verification", False),
            "can_verify_review": detail_data.get("can_verify_review", False),
            "can_approve_review": detail_data.get("can_approve_review", False),
            "can_close_task": detail_data.get("can_close_task", True),
            "closure_block_reason": detail_data.get("closure_block_reason", None),
            "can_submit_review": detail_data.get("can_submit_review", False),
            "can_review_revision": detail_data["can_review_revision"],
            "can_request_revision": detail_data["can_request_revision"],
            "can_review_evidence": detail_data["can_review_evidence"],
            "has_pending_revision": detail_data["has_pending_revision"],
        })



class GovernanceWeeklyUpdateListView(APIView):
    """
    GET  /api/v1/governance/actions/<id>/weekly-updates/ - List weekly updates for a task
    POST /api/v1/governance/actions/<id>/weekly-updates/ - Submit new or revised weekly update
    """
    permission_classes = [IsAuthenticated]

    def _get_action(self, action_id, user, mode=None):
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), user, mode=mode)
        action = qs.filter(id=action_id).first()
        if not action:
            raise PermissionDenied("Action point not found or outside authorized scope.")
        return action

    def get(self, request, pk):
        mode = request.query_params.get("mode")
        action = self._get_action(pk, request.user, mode=mode)
        updates = get_task_weekly_updates(action.id, request.user, mode=mode)
        serializer = GovernanceWeeklyUpdateSerializer(updates, many=True)
        return Response({"success": True, "weekly_updates": serializer.data})

    def post(self, request, pk):
        action = self._get_action(pk, request.user)
        allow_revision = request.data.get("allow_revision", False)

        try:
            update_obj = GovernanceWeeklyUpdateService.submit_weekly_update(
                action_point=action,
                data=request.data,
                user=request.user,
                allow_revision=allow_revision,
            )
            serializer = GovernanceWeeklyUpdateSerializer(update_obj)
            return Response({"success": True, "weekly_update": serializer.data}, status=status.HTTP_201_CREATED)
        except (ValidationError, DjangoValidationError) as e:
            err_msg = e.message_dict if hasattr(e, "message_dict") else str(e)
            return Response({"success": False, "errors": err_msg}, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as e:
            return Response({"success": False, "errors": str(e)}, status=status.HTTP_403_FORBIDDEN)


class GovernanceWeeklyUpdateDetailView(APIView):
    """
    PATCH /api/v1/governance/weekly-updates/<id>/ - Revise an existing weekly update
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            update_obj = GovernanceWeeklyUpdate.objects.select_related("action_point").get(id=pk)
        except GovernanceWeeklyUpdate.DoesNotExist:
            return Response({"success": False, "error": "Weekly update not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            updated = GovernanceWeeklyUpdateService.submit_weekly_update(
                action_point=update_obj.action_point,
                data={**request.data, "reporting_week": update_obj.reporting_week},
                user=request.user,
                allow_revision=True,
            )
            serializer = GovernanceWeeklyUpdateSerializer(updated)
            return Response({"success": True, "weekly_update": serializer.data})
        except (ValidationError, DjangoValidationError) as e:
            err_msg = e.message_dict if hasattr(e, "message_dict") else str(e)
            return Response({"success": False, "errors": err_msg}, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as e:
            return Response({"success": False, "errors": str(e)}, status=status.HTTP_403_FORBIDDEN)


class GovernanceActionBulkUpdateView(APIView):
    """
    POST /api/v1/governance/actions/bulk-update/
    Bulk updates selected action points (owner, status, priority, target date).
    Validates each record individually and records traceable audit log.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = GovernanceActionBulkUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        task_ids = data.pop("task_ids")
        result = GovernanceService.bulk_update_actions(task_ids, data, request.user)
        return Response({"success": True, "bulk_result": result})


class GovernanceWeeklyBulkSubmitView(APIView):
    """
    POST /api/v1/governance/weekly-updates/bulk-submit/
    Bulk submits or updates weekly progress across selected tasks.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = GovernanceWeeklyBulkSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        task_ids = data.pop("task_ids")
        updates_list = [{"task_id": tid, **data} for tid in task_ids]
        result = GovernanceWeeklyUpdateService.bulk_submit_weekly_updates(updates_list, request.user)
        return Response({"success": True, "bulk_result": result})


class GovernanceEvidenceBulkReviewView(APIView):
    """
    POST /api/v1/governance/evidence/bulk-review/
    Bulk reviews selected evidence submissions (Accept or Request Rework).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = GovernanceEvidenceBulkReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        result = GovernanceEvidenceService.bulk_review_evidence(
            evidence_ids=data["evidence_ids"],
            decision=data["decision"],
            review_comment=data.get("review_comment", ""),
            user=request.user,
        )
        return Response({"success": True, "bulk_result": result})


class GovernanceHierarchyUsersView(APIView):
    """
    GET /api/v1/governance/hierarchy-users/?level=<level>&node_id=<node_id>
    Returns eligible users scoped to the specified organization hierarchy level and node.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        level = request.query_params.get("level")
        node_id_param = request.query_params.get("node_id")
        node_id = int(node_id_param) if node_id_param and node_id_param.isdigit() else None
        search = request.query_params.get("search")

        users = get_eligible_users_for_hierarchy_node(level, node_id, search=search)
        return Response({"success": True, "users": users})


class GovernanceWeeklyTemplateView(APIView):
    """
    GET /api/v1/governance/weekly-updates/template/
    Downloads standard weekly update Excel template pre-populated with user's assigned active tasks.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        output = GovernanceWeeklyUpdateService.generate_weekly_template(request.user)
        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="MAPAR_Weekly_Progress_Template.xlsx"'
        return response


class GovernanceWeeklyExcelPreviewView(APIView):
    """
    POST /api/v1/governance/weekly-updates/preview-excel/
    Parses and validates weekly progress updates from uploaded Excel file before importing.
    Enforces strict task-level access control against the authenticated user.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"success": False, "error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.lower().endswith((".xlsx", ".xlsm")):
            return Response(
                {"success": False, "error": "Invalid file format. Please upload an Excel workbook (.xlsx)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            preview_data = GovernanceWeeklyUpdateService.parse_and_preview_weekly_excel(file_obj, request.user)
            return Response({"success": True, "preview": preview_data})
        except Exception as e:
            return Response({"success": False, "error": f"Failed to parse Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class GovernanceWeeklyExcelUploadView(APIView):
    """
    POST /api/v1/governance/weekly-updates/upload-excel/
    Imports weekly updates from Excel with row-by-row validation, task-level access checks,
    and returns comprehensive breakdown of successful and failed rows.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"success": False, "error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.lower().endswith((".xlsx", ".xlsm")):
            return Response(
                {"success": False, "error": "Invalid file format. Please upload an Excel workbook (.xlsx)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allow_revision_param = request.data.get("allow_revision", False)
        allow_revision = allow_revision_param in [True, "true", "True", "1", 1]

        try:
            result = GovernanceWeeklyUpdateService.import_weekly_excel(
                file_obj,
                request.user,
                allow_revision=allow_revision,
            )
            return Response({"success": True, "import_result": result})
        except Exception as e:
            return Response({"success": False, "error": f"Failed to import Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class GovernanceWeeklyErrorReportExportView(APIView):
    """
    POST /api/v1/governance/weekly-updates/export-error-report/
    Exports downloadable error report for failed rows in weekly Excel upload.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        error_report = request.data.get("error_report", [])
        output = GovernanceWeeklyUpdateService.generate_error_report_file(error_report)
        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="Weekly_Updates_Error_Report.xlsx"'
        return response


def check_audit_email_restriction(user, request=None):
    """
    Blocks email dispatch or preview if:
    1. The request originates from or targets the Audit & Action Tracker module (mode == "audit").
    2. The requesting user is an Action Owner (Audit & Action Tracker auditee).
    Returns (is_restricted: bool, error_response: Response or None)
    """
    if not user or not user.is_authenticated:
        return True, Response(
            {"success": False, "message": "Authentication required."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if request:
        mode = request.query_params.get("mode") or (
            request.data.get("mode") if hasattr(request, "data") and isinstance(request.data, dict) else None
        )
        if mode == "audit":
            return True, Response(
                {"success": False, "message": "Email sending has been disabled for all Audit & Action Tracker users."},
                status=status.HTTP_403_FORBIDDEN,
            )

    if getattr(user, "role", None) == User.Role.ACTION_OWNER:
        return True, Response(
            {"success": False, "message": "Email sending has been disabled for all Audit & Action Tracker users."},
            status=status.HTTP_403_FORBIDDEN,
        )

    return False, None


class GovernanceActionSendEmailView(APIView):
    """
    POST /api/v1/governance/actions/<id>/send-email/
    Triggers an on-demand urgent follow-up alert email to the task owner or any selected application user.
    Email sending is blocked for all users with Audit & Action Tracker access.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        is_restricted, err_resp = check_audit_email_restriction(request.user, request)
        if is_restricted:
            return err_resp

        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), request.user)
        action = qs.filter(id=pk).first()
        if not action:
            return Response(
                {"success": False, "message": "Action point not found or outside authorized scope."},
                status=status.HTTP_404_NOT_FOUND,
            )

        recipient_user_id = request.data.get("recipient_user_id") or request.data.get("recipient_id")
        recipient_user = None
        if recipient_user_id:
            try:
                recipient_user_id = int(recipient_user_id)
                recipient_user = User.objects.filter(id=recipient_user_id, is_active=True).first()
                if not recipient_user:
                    return Response(
                        {"success": False, "message": "Selected recipient user not found or inactive."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except (ValueError, TypeError):
                return Response(
                    {"success": False, "message": "Invalid recipient_user_id."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        from apps.notifications.services.urgent_followup_email_service import UrgentFollowUpEmailService

        success, message, record = UrgentFollowUpEmailService.send_urgent_followup_email(
            action_point=action,
            triggered_by=request.user,
            recipient_user=recipient_user,
        )

        resp_status = status.HTTP_200_OK if success else status.HTTP_400_BAD_REQUEST
        return Response({
            "success": success,
            "message": message,
            "action_id": action.action_id,
            "recipient_email": record.recipient_email if record else "",
            "recipient_name": record.recipient_name if record else "",
            "delivery_status": record.status if record else "FAILED",
        }, status=resp_status)


class GovernanceStatusMatrixEmailPreviewView(APIView):
    """
    GET /api/v1/governance/status-matrix/email-preview/
    Returns distinct recipient counts and task summary before sending bulk emails.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        is_restricted, err_resp = check_audit_email_restriction(request.user, request)
        if is_restricted:
            return err_resp

        from apps.notifications.services.status_matrix_email_service import StatusMatrixEmailService

        reporting_week = request.query_params.get("reporting_week")
        circle_id_param = request.query_params.get("circle_id")
        circle_id = int(circle_id_param) if circle_id_param and circle_id_param.isdigit() else None

        preview = StatusMatrixEmailService.get_matrix_email_preview(
            user=request.user,
            reporting_week=reporting_week,
            circle_id=circle_id,
        )
        return Response({"success": True, **preview})


class GovernanceStatusMatrixSendEmailView(APIView):
    """
    POST /api/v1/governance/status-matrix/send-emails/
    Dispatches 1 consolidated email per eligible Action Owner containing all their assigned tasks.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        is_restricted, err_resp = check_audit_email_restriction(request.user, request)
        if is_restricted:
            return err_resp

        if getattr(request.user, "role", None) == User.Role.VIEWER:
            return Response(
                {"success": False, "message": "Viewers do not have permission to trigger bulk status matrix emails."},
                status=status.HTTP_403_FORBIDDEN,
            )

        from apps.notifications.services.status_matrix_email_service import StatusMatrixEmailService

        reporting_week = request.data.get("reporting_week")
        circle_id = request.data.get("circle_id")
        if circle_id is not None:
            try:
                circle_id = int(circle_id)
            except (ValueError, TypeError):
                circle_id = None

        override_recipient_email = request.data.get("override_recipient_email")
        dry_run = request.data.get("dry_run", False)

        result = StatusMatrixEmailService.send_matrix_consolidated_emails(
            triggered_by=request.user,
            reporting_week=reporting_week,
            circle_id=circle_id,
            override_recipient_email=override_recipient_email,
            dry_run=dry_run,
        )

        resp_status = status.HTTP_200_OK if result["success"] else status.HTTP_400_BAD_REQUEST
        return Response(result, status=resp_status)


class GovernanceOwnerEmailPreviewView(APIView):
    """
    GET /api/v1/governance/owners/<int:owner_id>/email-preview/
    Returns eligible task count, closed exclusion count, and owner recipient info before sending.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, owner_id):
        is_restricted, err_resp = check_audit_email_restriction(request.user, request)
        if is_restricted:
            return err_resp

        from apps.notifications.services.status_matrix_email_service import StatusMatrixEmailService

        owner_name = request.query_params.get("name")
        preview = StatusMatrixEmailService.get_owner_email_preview(
            user=request.user,
            owner_id=owner_id,
            owner_name=owner_name,
        )
        return Response({"success": True, **preview})


class GovernanceOwnerSendEmailView(APIView):
    """
    POST /api/v1/governance/owners/<int:owner_id>/send-email/
    Dispatches 1 consolidated email containing all eligible non-closed tasks for this owner.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, owner_id):
        is_restricted, err_resp = check_audit_email_restriction(request.user, request)
        if is_restricted:
            return err_resp

        if getattr(request.user, "role", None) == User.Role.VIEWER:
            return Response(
                {"success": False, "message": "Viewers do not have permission to trigger action owner emails."},
                status=status.HTTP_403_FORBIDDEN,
            )

        from apps.notifications.services.status_matrix_email_service import StatusMatrixEmailService

        owner_name = request.data.get("owner_name") or request.query_params.get("name")
        override_recipient_email = request.data.get("override_recipient_email")
        dry_run = request.data.get("dry_run", False)

        result = StatusMatrixEmailService.send_owner_consolidated_email(
            triggered_by=request.user,
            owner_id=owner_id,
            owner_name=owner_name,
            override_recipient_email=override_recipient_email,
            dry_run=dry_run,
        )

        resp_status = status.HTTP_200_OK if result["success"] else status.HTTP_400_BAD_REQUEST
        return Response(result, status=resp_status)


class GovernanceActionAssignReviewView(APIView):
    """
    POST /api/v1/governance/actions/<id>/assign-review/
    Assigns an authorized task to a reviewer with optional instructions.
    """
    permission_classes = [IsAuthenticated]

    def _get_action(self, action_id, user):
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
        action = qs.filter(id=action_id).first()
        if not action:
            raise PermissionDenied("Action point not found or outside authorized scope.")
        return action

    def post(self, request, pk):
        action = self._get_action(pk, request.user)
        serializer = AssignTaskReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        reviewer = serializer.validated_data["reviewer_id"]
        instructions = serializer.validated_data.get("instructions", "")

        from apps.governance.services.governance_task_review_service import GovernanceTaskReviewService
        try:
            review = GovernanceTaskReviewService.assign_review(
                action_point=action,
                reviewer=reviewer,
                requested_by=request.user,
                instructions=instructions,
            )
            out_serializer = GovernanceTaskReviewSerializer(review)
            reviewer_name = reviewer.get_full_name() or reviewer.username
            return Response(
                {
                    "success": True,
                    "review": out_serializer.data,
                    "message": f"Task successfully assigned for review to {reviewer_name}.",
                },
                status=status.HTTP_201_CREATED,
            )
        except PermissionDenied as pe:
            return Response({"success": False, "message": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except (ValidationError, DjangoValidationError) as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GovernanceActionReviewUpdateView(APIView):
    """
    PATCH /api/v1/governance/actions/<id>/reviews/<review_id>/
    Allows the designated reviewer to submit or update review notes and status.
    """
    permission_classes = [IsAuthenticated]

    def _get_action(self, action_id, user):
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
        action = qs.filter(id=action_id).first()
        if not action:
            raise PermissionDenied("Action point not found or outside authorized scope.")
        return action

    def patch(self, request, pk, review_id):
        action = self._get_action(pk, request.user)
        review = action.task_reviews.filter(id=review_id).first()
        if not review:
            return Response({"success": False, "message": "Review record not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateTaskReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        status_val = serializer.validated_data["status"]
        review_notes = serializer.validated_data.get("review_notes", "")

        from apps.governance.services.governance_task_review_service import GovernanceTaskReviewService
        try:
            updated_review = GovernanceTaskReviewService.submit_or_update_review(
                review=review,
                user=request.user,
                status=status_val,
                review_notes=review_notes,
            )
            out_serializer = GovernanceTaskReviewSerializer(updated_review)
            return Response({
                "success": True,
                "review": out_serializer.data,
                "message": f"Review updated to '{status_val}' successfully.",
            })
        except PermissionDenied as pe:
            return Response({"success": False, "message": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except (ValidationError, DjangoValidationError) as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GovernanceActionReviewsListView(APIView):
    """
    GET /api/v1/governance/actions/<id>/reviews/
    Returns all review records and history for this task.
    """
    permission_classes = [IsAuthenticated]

    def _get_action(self, action_id, user):
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
        action = qs.filter(id=action_id).first()
        if not action:
            raise PermissionDenied("Action point not found or outside authorized scope.")
        return action

    def get(self, request, pk):
        action = self._get_action(pk, request.user)
        reviews = action.task_reviews.select_related(
            "assigned_reviewer",
            "requested_by",
            "submitted_by",
            "submitted_for_verification_by",
            "verified_by",
            "approved_by",
        ).order_by("-assigned_at")
        serializer = GovernanceTaskReviewSerializer(reviews, many=True)
        return Response({"success": True, "reviews": serializer.data})


class GovernanceActionSubmitForReviewView(APIView):
    """
    POST /api/v1/governance/actions/<id>/submit-for-review/
    Original task owner submits the task for verification.
    """
    permission_classes = [IsAuthenticated]

    def _get_action(self, action_id, user):
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
        action = qs.filter(id=action_id).first()
        if not action:
            raise PermissionDenied("Action point not found or outside authorized scope.")
        return action

    def post(self, request, pk):
        action = self._get_action(pk, request.user)
        serializer = SubmitForVerificationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        submission_notes = serializer.validated_data.get("submission_notes", "")
        from apps.governance.services.governance_task_review_service import GovernanceTaskReviewService
        try:
            review = GovernanceTaskReviewService.submit_for_verification(
                action_point=action,
                user=request.user,
                submission_notes=submission_notes,
            )
            out_serializer = GovernanceTaskReviewSerializer(review)
            action_serializer = GovernanceActionPointSerializer(action)
            return Response({
                "success": True,
                "review": out_serializer.data,
                "action": action_serializer.data,
                "message": "Task submitted for verification successfully.",
            }, status=status.HTTP_200_OK)
        except PermissionDenied as pe:
            return Response({"success": False, "message": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except (ValidationError, DjangoValidationError) as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GovernanceActionVerifyReviewView(APIView):
    """
    POST /api/v1/governance/actions/<id>/verify-review/
    Assigned reviewer submits verification outcome (Verified or Rework Required).
    """
    permission_classes = [IsAuthenticated]

    def _get_action(self, action_id, user):
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
        action = qs.filter(id=action_id).first()
        if not action:
            raise PermissionDenied("Action point not found or outside authorized scope.")
        return action

    def post(self, request, pk):
        action = self._get_action(pk, request.user)
        serializer = VerifyReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        outcome = serializer.validated_data["outcome"]
        review_notes = serializer.validated_data.get("review_notes", "")

        from apps.governance.services.governance_task_review_service import GovernanceTaskReviewService
        try:
            review = GovernanceTaskReviewService.verify_review(
                action_point=action,
                user=request.user,
                outcome=outcome,
                review_notes=review_notes,
            )
            out_serializer = GovernanceTaskReviewSerializer(review)
            action_serializer = GovernanceActionPointSerializer(action)
            return Response({
                "success": True,
                "review": out_serializer.data,
                "action": action_serializer.data,
                "message": f"Review verification submitted as '{outcome}'.",
            }, status=status.HTTP_200_OK)
        except PermissionDenied as pe:
            return Response({"success": False, "message": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except (ValidationError, DjangoValidationError) as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GovernanceActionApproveReviewView(APIView):
    """
    POST /api/v1/governance/actions/<id>/approve-review/
    Authorized approver grants final approval or returns for rework.
    """
    permission_classes = [IsAuthenticated]

    def _get_action(self, action_id, user):
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
        action = qs.filter(id=action_id).first()
        if not action:
            raise PermissionDenied("Action point not found or outside authorized scope.")
        return action

    def post(self, request, pk):
        action = self._get_action(pk, request.user)
        serializer = ApproveReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        decision = serializer.validated_data["decision"]
        comments = serializer.validated_data.get("comments", "")

        from apps.governance.services.governance_task_review_service import GovernanceTaskReviewService
        try:
            review = GovernanceTaskReviewService.approve_review(
                action_point=action,
                user=request.user,
                decision=decision,
                comments=comments,
            )
            out_serializer = GovernanceTaskReviewSerializer(review)
            action_serializer = GovernanceActionPointSerializer(action)
            return Response({
                "success": True,
                "review": out_serializer.data,
                "action": action_serializer.data,
                "message": f"Task approval decision recorded as '{decision}'.",
            }, status=status.HTTP_200_OK)
        except PermissionDenied as pe:
            return Response({"success": False, "message": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except (ValidationError, DjangoValidationError) as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GovernanceActionSubmitReviewView(APIView):
    """
    POST /api/v1/governance/actions/<id>/submit-review/
    Allows the assigned reviewer to submit their Findings / Observations, review notes, and recommendations.
    Persists findings and recommendations, records reviewer identity and timestamp,
    and updates task review_workflow_status to 'Review Submitted'.
    """
    permission_classes = [IsAuthenticated]

    def _get_action(self, action_id, user):
        qs = apply_governance_scope(GovernanceActionPoint.objects.all(), user)
        action = qs.filter(id=action_id).first()
        if not action:
            raise PermissionDenied("Action point not found or outside authorized scope.")
        return action

    def post(self, request, pk):
        action = self._get_action(pk, request.user)
        serializer = SubmitReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        findings = serializer.validated_data["findings"]
        recommendations = serializer.validated_data.get("recommendations", "")
        review_notes = serializer.validated_data.get("review_notes", "")

        from apps.governance.services.governance_task_review_service import GovernanceTaskReviewService
        try:
            review = GovernanceTaskReviewService.submit_review(
                action_point=action,
                user=request.user,
                findings=findings,
                recommendations=recommendations,
                review_notes=review_notes,
            )
            out_serializer = GovernanceTaskReviewSerializer(review)
            action_serializer = GovernanceActionPointSerializer(action)
            return Response({
                "success": True,
                "review": out_serializer.data,
                "action": action_serializer.data,
                "message": "Review findings and recommendations submitted successfully.",
            }, status=status.HTTP_200_OK)
        except PermissionDenied as pe:
            return Response({"success": False, "message": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except (ValidationError, DjangoValidationError) as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)









