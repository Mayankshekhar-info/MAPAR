"""
REST API Views for Master Data Module.
Coordination layer for hierarchy-filtered operational records, schema-driven editing,
Excel uploads with context tagging, and styled Excel exports.
"""

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.core.exceptions import ValidationError

from apps.imports.selectors.master_data_selectors import (
    get_master_data_meta,
    list_master_data_records,
    get_master_data_record_by_id,
)
from apps.imports.services.master_data_service import MasterDataService
from apps.imports.services.upload_validation_service import UploadValidationService
from apps.imports.selectors.template_selectors import (
    get_latest_template_version,
    get_template_version_by_id,
)
from apps.imports.models import ImportBatch
from apps.imports.api.views import check_can_manage_uploads


class MasterDataMetaView(APIView):
    """
    GET /api/v1/master-data/meta/
    Returns active templates, reporting periods, and scoped hierarchy options.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        meta = get_master_data_meta(user=request.user)
        return Response({"success": True, "data": meta})


class MasterDataRecordsView(APIView):
    """
    GET /api/v1/master-data/records/
    Returns filtered, paginated master data records and dynamic column schemas.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        template_id = request.query_params.get("template_id")
        batch_id = request.query_params.get("batch_id")
        company_id = request.query_params.get("company_id")
        sub_company_id = request.query_params.get("sub_company_id")
        project_id = request.query_params.get("project_id")
        circle_id = request.query_params.get("circle_id")
        department_id = request.query_params.get("department_id")
        period_id = request.query_params.get("period_id")
        search = request.query_params.get("search")
        is_valid_str = request.query_params.get("is_valid")
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))
        sort_by = request.query_params.get("sort_by")
        sort_order = request.query_params.get("sort_order", "asc")

        is_valid = None
        if is_valid_str is not None:
            if is_valid_str.lower() in ("true", "1"):
                is_valid = True
            elif is_valid_str.lower() in ("false", "0"):
                is_valid = False

        data = list_master_data_records(
            user=request.user,
            template_id=int(template_id) if template_id and template_id.isdigit() else None,
            batch_id=batch_id,
            company_id=int(company_id) if company_id and company_id.isdigit() else None,
            sub_company_id=int(sub_company_id) if sub_company_id and sub_company_id.isdigit() else None,
            project_id=int(project_id) if project_id and project_id.isdigit() else None,
            circle_id=int(circle_id) if circle_id and circle_id.isdigit() else None,
            department_id=int(department_id) if department_id and department_id.isdigit() else None,
            period_id=int(period_id) if period_id and period_id.isdigit() else None,
            search=search,
            is_valid=is_valid,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        return Response({"success": True, "data": data})


class MasterDataRecordDetailView(APIView):
    """
    GET   /api/v1/master-data/records/<int:pk>/ - Retrieve single record details.
    PATCH /api/v1/master-data/records/<int:pk>/ - Update single record with validation and audit logging.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def get(self, request, pk: int):
        row = get_master_data_record_by_id(pk, user=request.user)
        return Response({
            "success": True,
            "data": {
                "id": row.id,
                "row_index": row.row_index,
                "raw_data": row.raw_data,
                "is_valid": row.is_valid,
                "validation_errors": row.validation_errors,
                "is_imported": row.is_imported,
                "batch_id": row.batch.batch_id,
            }
        })

    def patch(self, request, pk: int):
        raw_data = request.data.get("raw_data", request.data)
        updated = MasterDataService.update_record(
            record_id=pk,
            updated_data=raw_data,
            user=request.user,
        )
        return Response({"success": True, "data": updated})


class MasterDataUploadView(APIView):
    """
    POST /api/v1/master-data/upload/
    Accepts Excel file upload with selected organizational context and import mode.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if not check_can_manage_uploads(request.user):
            return Response(
                {"success": False, "message": "Access Denied: You do not have permission to upload Master Data."},
                status=status.HTTP_403_FORBIDDEN
            )

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"success": False, "message": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        version_id = request.data.get("version_id")
        template_id = request.data.get("template_id")
        company_id = request.data.get("company_id")
        sub_company_id = request.data.get("sub_company_id")
        project_id = request.data.get("project_id")
        circle_id = request.data.get("circle_id")
        department_id = request.data.get("department_id")
        reporting_period_id = request.data.get("reporting_period_id")
        import_mode = request.data.get("import_mode", "append")

        if version_id and str(version_id).isdigit():
            version = get_template_version_by_id(int(version_id))
        elif template_id and str(template_id).isdigit():
            version = get_latest_template_version(int(template_id))
        else:
            return Response({"success": False, "message": "Template ID or Version ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not version:
            return Response({"success": False, "message": "Template version not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            batch = UploadValidationService.process_and_validate_upload(
                version=version,
                uploaded_file=uploaded_file,
                reporting_period_id=reporting_period_id if reporting_period_id and str(reporting_period_id).isdigit() else None,
                user=request.user,
            )

            # Assign hierarchy context
            if company_id and str(company_id).isdigit():
                batch.company_id = int(company_id)
            if sub_company_id and str(sub_company_id).isdigit():
                batch.sub_company_id = int(sub_company_id)
            if project_id and str(project_id).isdigit():
                batch.project_id = int(project_id)
            if circle_id and str(circle_id).isdigit():
                batch.circle_id = int(circle_id)
            if department_id and str(department_id).isdigit():
                batch.department_id = int(department_id)

            # Handle replace mode: mark previous active batches for this context as REJECTED
            if import_mode == "replace":
                prev_batches = ImportBatch.objects.filter(
                    template_version__template=version.template,
                    reporting_period_id=batch.reporting_period_id,
                    circle_id=batch.circle_id,
                ).exclude(id=batch.id)
                prev_batches.update(status=ImportBatch.Status.REJECTED)

            batch.save(update_fields=["company", "sub_company", "project", "circle", "department", "updated_at"])

            return Response({
                "success": True,
                "message": f"Upload processed successfully. {batch.valid_rows} valid rows out of {batch.total_rows} total rows.",
                "batch": {
                    "id": batch.id,
                    "batch_id": batch.batch_id,
                    "status": batch.status,
                    "total_rows": batch.total_rows,
                    "valid_rows": batch.valid_rows,
                    "error_rows": batch.error_rows,
                }
            }, status=status.HTTP_201_CREATED)

        except ValidationError as e:
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "message": f"Upload processing failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MasterDataExportView(APIView):
    """
    GET /api/v1/master-data/export/
    Exports current saved working database records to Excel (.xlsx).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        template_id = request.query_params.get("template_id")
        batch_id = request.query_params.get("batch_id")
        company_id = request.query_params.get("company_id")
        sub_company_id = request.query_params.get("sub_company_id")
        project_id = request.query_params.get("project_id")
        circle_id = request.query_params.get("circle_id")
        department_id = request.query_params.get("department_id")
        period_id = request.query_params.get("period_id")
        search = request.query_params.get("search")

        buffer, filename = MasterDataService.export_master_data_excel(
            user=request.user,
            template_id=int(template_id) if template_id and template_id.isdigit() else None,
            batch_id=batch_id,
            company_id=int(company_id) if company_id and company_id.isdigit() else None,
            sub_company_id=int(sub_company_id) if sub_company_id and sub_company_id.isdigit() else None,
            project_id=int(project_id) if project_id and project_id.isdigit() else None,
            circle_id=int(circle_id) if circle_id and circle_id.isdigit() else None,
            department_id=int(department_id) if department_id and department_id.isdigit() else None,
            period_id=int(period_id) if period_id and period_id.isdigit() else None,
            search=search,
        )

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response
