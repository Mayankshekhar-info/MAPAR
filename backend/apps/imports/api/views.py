"""
REST API Views for Uploads Module.
Thin coordination layer: Authentication -> Scoped Authorization -> Serializer -> Service/Selector -> Response.
"""

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.core.exceptions import ValidationError

from apps.imports.selectors.template_selectors import (
    list_templates,
    get_template_by_id,
    get_latest_template_version,
    get_template_version_by_id,
    get_hierarchy_levels,
)
from apps.imports.selectors.batch_selectors import (
    list_batches,
    get_batch_by_identifier,
    get_batch_errors,
    get_batch_lineage,
    get_batch_staged_rows,
)
from apps.imports.services.template_service import TemplateService
from apps.imports.services.excel_generation_service import ExcelGenerationService
from apps.imports.services.upload_validation_service import UploadValidationService
from apps.imports.services.import_execution_service import ImportExecutionService
from apps.imports.api.serializers import (
    UploadTemplateListSerializer,
    UploadTemplateDetailSerializer,
    UploadTemplateVersionSerializer,
    CreateTemplateSerializer,
    CreateVersionSerializer,
    UpdateVersionSerializer,
    ImportBatchListSerializer,
    ImportBatchDetailSerializer,
    ImportValidationErrorSerializer,
)
from apps.dashboard.models import ReportingPeriod
from apps.imports.models import ImportBatch, UploadTemplateColumn


def check_can_manage_uploads(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or getattr(user, "role", None) == "SUPER_ADMIN":
        return True
    from common.permissions.authorization import AuthorizationService
    perms = AuthorizationService.get_user_effective_permissions(user)
    if perms and perms != ["*.*"]:
        has_manage = any(p in perms for p in ["uploads.create", "uploads.edit", "uploads.manage"])
        if not has_manage and "uploads.view" in perms:
            return False
    return True


class UploadsMetaView(APIView):
    """
    GET /api/v1/uploads/meta/
    Returns dynamic metadata for building templates and configuring imports:
    - Hierarchy levels from organization model
    - Supported column data types
    - Active reporting periods
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hierarchy_levels = get_hierarchy_levels()
        data_types = [
            {"key": dt.value, "label": dt.label}
            for dt in UploadTemplateColumn.DataType
        ]
        periods = [
            {
                "id": p.id,
                "name": p.name,
                "period_type": p.period_type,
                "is_current": p.is_current,
                "is_frozen": p.is_frozen,
            }
            for p in ReportingPeriod.objects.all().order_by("-start_date")[:100]
        ]
        return Response({
            "success": True,
            "hierarchy_levels": hierarchy_levels,
            "data_types": data_types,
            "reporting_periods": periods,
        })


class TemplateListView(APIView):
    """
    GET  /api/v1/uploads/templates/ - List configured templates with versions and metrics.
    POST /api/v1/uploads/templates/ - Create a new user-defined template and initial v1 schema.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def get(self, request):
        status_filter = request.query_params.get("status")
        search = request.query_params.get("search")
        templates = list_templates(status=status_filter, search=search)
        serializer = UploadTemplateListSerializer(templates, many=True)
        return Response({"success": True, "templates": serializer.data})

    def post(self, request):
        if not check_can_manage_uploads(request.user):
            return Response(
                {"success": False, "message": "Access Denied: You have view-only access to uploads and cannot create templates."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CreateTemplateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            template = TemplateService.create_template(serializer.validated_data, user=request.user)
            detail_serializer = UploadTemplateDetailSerializer(template)
            return Response({"success": True, "template": detail_serializer.data}, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "message": f"Server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TemplateDetailView(APIView):
    """
    GET /api/v1/uploads/templates/<id>/ - Retrieve template details and all versions.
    PUT /api/v1/uploads/templates/<id>/ - Update template metadata.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, template_id):
        template = get_template_by_id(template_id)
        serializer = UploadTemplateDetailSerializer(template)
        return Response({"success": True, "template": serializer.data})

    def put(self, request, template_id):
        if not check_can_manage_uploads(request.user):
            return Response(
                {"success": False, "message": "Access Denied: You have view-only access to uploads."},
                status=status.HTTP_403_FORBIDDEN
            )
        try:
            template = TemplateService.update_template(template_id, request.data, user=request.user)
            serializer = UploadTemplateDetailSerializer(template)
            return Response({"success": True, "template": serializer.data})
        except ValidationError as e:
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class TemplateVersionCreateView(APIView):
    """
    POST /api/v1/uploads/templates/<id>/version/
    Creates a new template version (v2, v3, etc.) while preserving previous historical versions.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, template_id):
        if not check_can_manage_uploads(request.user):
            return Response(
                {"success": False, "message": "Access Denied: You have view-only access to uploads."},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = CreateVersionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            version = TemplateService.create_new_version(template_id, serializer.validated_data, user=request.user)
            version_serializer = UploadTemplateVersionSerializer(version)
            return Response({"success": True, "version": version_serializer.data}, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class TemplateVersionDetailView(APIView):
    """
    GET    /api/v1/uploads/templates/<template_id>/versions/<version_id>/ - Retrieve version with columns.
    PUT    /api/v1/uploads/templates/<template_id>/versions/<version_id>/ - Edit an existing uploaded version in-place without creating a new version.
    DELETE /api/v1/uploads/templates/<template_id>/versions/<version_id>/ - Delete an old uploaded version and its associated records only.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, template_id, version_id):
        version = get_template_version_by_id(version_id)
        if version.template_id != template_id:
            return Response(
                {"success": False, "message": "Version does not belong to specified template."},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = UploadTemplateVersionSerializer(version)
        return Response({"success": True, "version": serializer.data})

    def put(self, request, template_id, version_id):
        if not check_can_manage_uploads(request.user):
            return Response(
                {"success": False, "message": "Access Denied: You have view-only access to uploads."},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = UpdateVersionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            version = TemplateService.update_version(template_id, version_id, serializer.validated_data, user=request.user)
            version_serializer = UploadTemplateVersionSerializer(version)
            return Response({"success": True, "version": version_serializer.data})
        except ValidationError as e:
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "message": f"Server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, template_id, version_id):
        if not check_can_manage_uploads(request.user):
            return Response(
                {"success": False, "message": "Access Denied: You have view-only access to uploads."},
                status=status.HTTP_403_FORBIDDEN
            )
        try:
            result = TemplateService.delete_version(template_id, version_id, user=request.user)
            return Response(result)
        except ValidationError as e:
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "message": f"Server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TemplateDownloadExcelView(APIView):
    """
    GET /api/v1/uploads/templates/<id>/download/?version_id=<optional>
    Dynamically generates and downloads the formatted .xlsx Excel template workbook.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, template_id):
        version_id = request.query_params.get("version_id")
        if version_id and version_id.isdigit():
            version = get_template_version_by_id(int(version_id))
        else:
            version = get_latest_template_version(template_id)

        if not version:
            return Response({"success": False, "message": "No active version found for this template."}, status=status.HTTP_404_NOT_FOUND)

        clean_param = request.query_params.get("clean")
        clean_only = (clean_param.lower() in ["true", "1"]) if clean_param is not None else None

        buffer = ExcelGenerationService.generate_template_workbook(version, clean_only=clean_only)
        filename = f"{version.template.code}_v{version.version_number}_template.xlsx"

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response


class BatchUploadView(APIView):
    """
    POST /api/v1/uploads/batches/upload/
    Uploads Excel file against a template version.
    Triggers authoritative backend validation: structure, headers, rows, types, uniqueness, hierarchy, and permissions.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if not check_can_manage_uploads(request.user):
            return Response(
                {"success": False, "message": "Access Denied: You have view-only access to uploads and cannot upload files."},
                status=status.HTTP_403_FORBIDDEN
            )
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"success": False, "message": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        version_id = request.data.get("version_id")
        template_id = request.data.get("template_id")
        reporting_period_id = request.data.get("reporting_period_id")
        reporting_period_type = request.data.get("reporting_period_type")
        reporting_date = request.data.get("reporting_date")
        start_date = request.data.get("start_date") or request.data.get("reporting_week_start")
        end_date = request.data.get("end_date") or request.data.get("reporting_week_end")
        kpi_id = request.data.get("kpi_id")
        company_id = request.data.get("company_id")
        sub_company_id = request.data.get("sub_company_id")
        project_id = request.data.get("project_id")
        circle_id = request.data.get("circle_id")
        department_id = request.data.get("department_id")
        duplicate_handling = request.data.get("duplicate_handling", "ERROR")

        if version_id and str(version_id).isdigit():
            version = get_template_version_by_id(int(version_id))
        elif template_id and str(template_id).isdigit():
            version = get_latest_template_version(int(template_id))
        else:
            return Response({"success": False, "message": "Either version_id or template_id must be provided."}, status=status.HTTP_400_BAD_REQUEST)

        if not version:
            return Response({"success": False, "message": "Template version not found."}, status=status.HTTP_404_NOT_FOUND)

        auto_commit_val = request.data.get("auto_commit", True)
        if isinstance(auto_commit_val, str):
            auto_commit = auto_commit_val.strip().lower() in ["true", "1", "yes"]
        else:
            auto_commit = bool(auto_commit_val)

        try:
            batch = UploadValidationService.process_and_validate_upload(
                version=version,
                uploaded_file=uploaded_file,
                reporting_period_id=reporting_period_id,
                reporting_period_type=reporting_period_type,
                reporting_date=reporting_date,
                start_date=start_date,
                end_date=end_date,
                kpi_id=kpi_id,
                company_id=company_id,
                sub_company_id=sub_company_id,
                project_id=project_id,
                circle_id=circle_id,
                department_id=department_id,
                duplicate_handling=duplicate_handling,
                user=request.user,
                auto_commit=auto_commit,
            )
            serializer = ImportBatchDetailSerializer(batch)
            return Response({"success": True, "batch": serializer.data}, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "message": f"Validation failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BatchListView(APIView):
    """
    GET /api/v1/uploads/batches/
    Returns import batches / history with optional filtering.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        template_id = request.query_params.get("template_id")
        status_filter = request.query_params.get("status")
        period_id = request.query_params.get("reporting_period_id")
        search = request.query_params.get("search")

        template_id_int = int(template_id) if template_id and template_id.isdigit() else None
        period_id_int = int(period_id) if period_id and period_id.isdigit() else None

        batches = list_batches(
            template_id=template_id_int,
            status=status_filter,
            reporting_period_id=period_id_int,
            search=search,
            user=request.user,
        )
        serializer = ImportBatchListSerializer(batches, many=True)
        return Response({"success": True, "batches": serializer.data})


class BatchDetailView(APIView):
    """
    GET /api/v1/uploads/batches/<identifier>/
    Retrieves batch summary metrics, status, and lineage events.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier):
        batch = get_batch_by_identifier(identifier)
        serializer = ImportBatchDetailSerializer(batch)
        return Response({"success": True, "batch": serializer.data})


class BatchErrorsView(APIView):
    """
    GET /api/v1/uploads/batches/<identifier>/errors/
    Returns paginated validation errors for grid inspection.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier):
        limit = int(request.query_params.get("limit", 100))
        offset = int(request.query_params.get("offset", 0))
        result = get_batch_errors(identifier, limit=limit, offset=offset)
        serializer = ImportValidationErrorSerializer(result["errors"], many=True)
        return Response({
            "success": True,
            "total": result["total"],
            "limit": result["limit"],
            "offset": result["offset"],
            "errors": serializer.data,
        })


class BatchErrorReportExportView(APIView):
    """
    GET /api/v1/uploads/batches/<identifier>/errors/export/
    Generates and downloads a separate Excel report of all validation errors.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier):
        batch = get_batch_by_identifier(identifier)
        buffer = ImportExecutionService.generate_error_report(batch)
        filename = f"{batch.batch_id}_error_report.xlsx"

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response


class BatchCommitView(APIView):
    """
    POST /api/v1/uploads/batches/<identifier>/commit/
    Executes transactional commit of all valid staged records into MAPAR target models.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, identifier):
        if not check_can_manage_uploads(request.user):
            return Response(
                {"success": False, "message": "Access Denied: You have view-only access to uploads and cannot commit batches."},
                status=status.HTTP_403_FORBIDDEN
            )
        batch = get_batch_by_identifier(identifier)
        try:
            result = ImportExecutionService.commit_batch(batch, user=request.user)
            return Response({"success": True, **result})
        except ValidationError as e:
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "message": f"Commit failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BatchRevalidateView(APIView):
    """
    POST /api/v1/uploads/batches/<identifier>/revalidate/
    Re-evaluates a REVIEW_REQUIRED batch after data corrections or duplicate resolution.
    If all errors are resolved, marks batch as VALIDATED, auto-commits, and triggers KPI recalculation.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, identifier):
        if not check_can_manage_uploads(request.user):
            return Response(
                {"success": False, "message": "Access Denied: You cannot manage batch corrections."},
                status=status.HTTP_403_FORBIDDEN
            )
        batch = get_batch_by_identifier(identifier)
        if batch.status == ImportBatch.Status.COMPLETED:
            return Response({"success": False, "message": "Batch has already been committed."}, status=status.HTTP_400_BAD_REQUEST)

        corrected_rows = request.data.get("corrected_rows", [])
        duplicate_handling = request.data.get("duplicate_handling", batch.duplicate_handling or "ERROR")

        from common.database.transactions import atomic_operation
        with atomic_operation():
            for correction in corrected_rows:
                r_idx = correction.get("row_index")
                new_data = correction.get("raw_data")
                if r_idx and new_data:
                    staged_row = batch.staged_rows.filter(row_index=r_idx).first()
                    if staged_row:
                        staged_row.raw_data = new_data
                        staged_row.save(update_fields=["raw_data"])

            expected_columns = list(batch.template_version.columns.all().order_by("column_order", "id"))
            from apps.imports.services.data_cleaning_service import DataCleaningService
            from apps.imports.models import ImportValidationError
            staged_qs = list(batch.staged_rows.all())
            staged_dicts = [
                {
                    "row_index": r.row_index,
                    "raw_data": r.raw_data,
                    "is_valid": True,
                    "validation_errors": [],
                }
                for r in staged_qs
            ]

            batch.validation_errors.all().delete()
            all_err_objs = []
            valid_count = 0
            err_count = 0

            for item in staged_dicts:
                clean_row, row_errs = DataCleaningService.clean_and_normalize_row(
                    item["row_index"],
                    item["raw_data"],
                    columns=expected_columns,
                )
                item["raw_data"] = clean_row
                item["validation_errors"] = row_errs
                item["is_valid"] = len(row_errs) == 0

            # Deduplication
            business_keys = [c.name for c in expected_columns if c.is_unique]
            staged_dicts, dup_count = DataCleaningService.detect_and_handle_record_duplicates(
                staged_dicts,
                business_key_cols=business_keys,
                duplicate_mode=duplicate_handling,
                user=request.user,
            )

            # Update staged rows and persist errors
            for item in staged_dicts:
                staged_obj = batch.staged_rows.filter(row_index=item["row_index"]).first()
                if staged_obj:
                    staged_obj.raw_data = item["raw_data"]
                    staged_obj.is_valid = item["is_valid"]
                    staged_obj.validation_errors = item["validation_errors"]
                    staged_obj.save(update_fields=["raw_data", "is_valid", "validation_errors"])

                if item["is_valid"]:
                    valid_count += 1
                elif not item.get("is_skipped"):
                    err_count += 1

                for err in item["validation_errors"]:
                    all_err_objs.append(
                        ImportValidationError(
                            batch=batch,
                            row_index=err["row_index"],
                            column_name=err["column_name"],
                            cell_value=err.get("cell_value", ""),
                            error_message=err["error_message"],
                            severity=err.get("severity", "ERROR"),
                        )
                    )

            if all_err_objs:
                ImportValidationError.objects.bulk_create(all_err_objs)

            batch.valid_rows = valid_count
            batch.error_rows = err_count
            batch.duplicate_rows_count = dup_count
            batch.duplicate_handling = duplicate_handling

            if err_count > 0:
                batch.status = ImportBatch.Status.REVIEW_REQUIRED
                batch.summary_notes = f"Revalidation completed with {err_count} remaining errors. Review required before commit."
                batch.save(update_fields=["valid_rows", "error_rows", "duplicate_rows_count", "duplicate_handling", "status", "summary_notes", "updated_at"])
                return Response({
                    "success": False,
                    "batch": ImportBatchDetailSerializer(batch).data,
                    "message": f"Revalidation completed with {err_count} remaining errors. Batch marked as REVIEW_REQUIRED.",
                }, status=status.HTTP_400_BAD_REQUEST)
            else:
                batch.status = ImportBatch.Status.VALIDATED
                batch.summary_notes = f"All {valid_count} rows successfully revalidated and cleaned. Auto-committing."
                batch.save(update_fields=["valid_rows", "error_rows", "duplicate_rows_count", "duplicate_handling", "status", "summary_notes", "updated_at"])

                # Auto-commit clean batch
                commit_res = ImportExecutionService.commit_batch(batch, user=request.user)
                batch.auto_committed = True
                batch.status = ImportBatch.Status.COMPLETED
                batch.save(update_fields=["auto_committed", "status"])

                return Response({
                    "success": True,
                    "batch": ImportBatchDetailSerializer(batch).data,
                    "message": f"Batch successfully revalidated, cleaned, and committed with {valid_count} records.",
                    "commit_result": commit_res,
                })


class TemplateCompatibleKPIsView(APIView):
    """
    GET /api/v1/uploads/templates/<int:template_id>/compatible-kpis/
    Evaluates all active KPIs against the template columns and returns compatibility status.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, template_id):
        from apps.kpi.models import KPIDefinition
        template = get_template_by_id(template_id)
        active_version = (
            template.versions.filter(is_active=True).first()
            or template.versions.order_by("-version_number").first()
        )
        if not active_version:
            return Response({"success": True, "kpis": []})

        version_columns = list(UploadTemplateColumn.objects.filter(version=active_version))
        template_cols = {c.name.strip().upper() for c in version_columns} | {
            c.display_label.strip().upper() for c in version_columns
        }

        kpis = KPIDefinition.objects.filter(is_active=True).prefetch_related("parameters", "filters")
        results = []
        for k in kpis:
            req_cols = set()
            for p in k.parameters.all():
                if p.source_column:
                    req_cols.add(p.source_column.strip())
            for f in k.filters.all():
                if f.field_name:
                    req_cols.add(f.field_name.strip())

            missing = [c for c in req_cols if c.upper() not in template_cols]
            is_compatible = (len(missing) == 0)
            source_ds_id = k.source_dataset.id if k.source_dataset else getattr(k, "source_dataset_id", None)

            results.append({
                "id": k.id,
                "code": k.code,
                "name": k.name,
                "description": k.description,
                "unit": k.unit,
                "hierarchy_level": k.hierarchy_level,
                "calculation_type": k.calculation_type,
                "source_dataset_id": source_ds_id,
                "is_direct_source": (source_ds_id == template.id),
                "is_compatible": is_compatible,
                "required_columns": list(req_cols),
                "missing_columns": missing,
            })

        # Sort: Direct source and compatible first, then compatible, then incompatible
        results.sort(key=lambda x: (not (x["is_direct_source"] and x["is_compatible"]), not x["is_compatible"], x["name"]))
        return Response({"success": True, "kpis": results})


class TemplateAffectedKPIsView(APIView):
    """
    GET /api/v1/uploads/templates/<int:template_id>/affected-kpis/
    Returns list of all active KPIs that depend on this template as their source dataset,
    along with the specific parameter/filter column names they reference.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, template_id):
        kpis = TemplateService.get_affected_kpis(template_id)
        return Response({"success": True, "kpis": kpis})


class BatchProcessKPIView(APIView):

    """
    POST /api/v1/uploads/batches/<str:identifier>/process-kpi/
    Processes an existing batch with a selected KPI.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, identifier):
        if not check_can_manage_uploads(request.user):
            return Response(
                {"success": False, "message": "Access Denied: You cannot process KPIs on uploads."},
                status=status.HTTP_403_FORBIDDEN
            )
        batch = get_batch_by_identifier(identifier)
        kpi_id = request.data.get("kpi_id")
        if not kpi_id:
            return Response({"success": False, "message": "kpi_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.kpi.models import KPIDefinition
        kpi = KPIDefinition.objects.filter(id=kpi_id, is_active=True).first()
        if not kpi:
            return Response({"success": False, "message": f"KPI with ID {kpi_id} not found or inactive."}, status=status.HTTP_404_NOT_FOUND)

        # Enforce hierarchy scope resolution: ensure KPI applies to this batch's node
        batch_circle_id = batch.circle.id if batch.circle else getattr(batch, "circle_id", None)
        batch_project_id = batch.project.id if getattr(batch, "project", None) else getattr(batch, "project_id", None)
        batch_company_id = batch.company.id if batch.company else getattr(batch, "company_id", None)

        if batch_circle_id:
            h_lvl, h_id = "CIRCLE", batch_circle_id
        elif batch_project_id:
            h_lvl, h_id = "PROJECT", batch_project_id
        elif batch_company_id:
            h_lvl, h_id = "MAIN_COMPANY", batch_company_id
        else:
            h_lvl, h_id = "ENTERPRISE", 1

        from apps.kpi.services.kpi_engine_service import KPIEngineService
        resolved_kpi = KPIEngineService.resolve_kpi_for_scope(kpi.code, h_lvl, h_id)
        if not resolved_kpi:
            batch.kpi_execution_status = "COMPATIBILITY_ERROR"
            batch.kpi_result_summary = {
                "status": "COMPATIBILITY_ERROR",
                "kpi_id": kpi.id,
                "kpi_code": kpi.code,
                "kpi_name": kpi.name,
                "message": f"KPI '{kpi.code}' is not authorized or scoped for hierarchy node {h_lvl}:{h_id}.",
            }
            batch.save(update_fields=["kpi_execution_status", "kpi_result_summary"])
            serializer = ImportBatchDetailSerializer(batch)
            return Response({"success": False, "batch": serializer.data, "message": batch.kpi_result_summary["message"]}, status=status.HTTP_400_BAD_REQUEST)

        # Apply the resolved scoped KPI definition
        kpi = resolved_kpi
        batch.applied_kpi = kpi

        # Check compatibility
        version_columns = list(UploadTemplateColumn.objects.filter(version=batch.template_version))
        template_cols = {c.name.strip().upper() for c in version_columns} | {
            c.display_label.strip().upper() for c in version_columns
        }
        missing_cols = []
        for p in kpi.parameters.all():
            if p.source_column and p.source_column.strip().upper() not in template_cols:
                missing_cols.append(p.source_column)
        for f in kpi.filters.all():
            if f.field_name and f.field_name.strip().upper() not in template_cols:
                missing_cols.append(f.field_name)

        if missing_cols:
            batch.kpi_execution_status = "COMPATIBILITY_ERROR"
            batch.kpi_result_summary = {
                "status": "COMPATIBILITY_ERROR",
                "kpi_id": kpi.id,
                "kpi_code": kpi.code,
                "kpi_name": kpi.name,
                "message": f"KPI requires column(s) not found in uploaded dataset: {', '.join(set(missing_cols))}",
                "missing_columns": list(set(missing_cols)),
            }
            batch.save(update_fields=["applied_kpi", "kpi_execution_status", "kpi_result_summary"])
            serializer = ImportBatchDetailSerializer(batch)
            return Response({"success": False, "batch": serializer.data, "message": batch.kpi_result_summary["message"]}, status=status.HTTP_400_BAD_REQUEST)

        # Resolve reporting period
        period = batch.reporting_period
        if not period:
            from apps.reporting.services.period_resolution_service import PeriodResolutionService
            period = PeriodResolutionService.get_active_or_current_period()
        if not period:
            return Response({"success": False, "message": "No active reporting period found for KPI calculation."}, status=status.HTTP_400_BAD_REQUEST)

        # Execute
        batch.kpi_execution_status = "PROCESSING"
        batch.save(update_fields=["applied_kpi", "kpi_execution_status"])
        try:
            from apps.kpi.services.kpi_engine_service import KPIEngineService
            batch_circle_id = batch.circle.id if batch.circle else getattr(batch, "circle_id", None)
            batch_company_id = batch.company.id if batch.company else getattr(batch, "company_id", None)
            target_lvl = kpi.hierarchy_level or ("CIRCLE" if batch_circle_id else "MAIN_COMPANY")
            raw_target_id = kpi.hierarchy_id
            if raw_target_id is None:
                if target_lvl == "CIRCLE" and batch_circle_id is not None:
                    raw_target_id = batch_circle_id
                elif batch_company_id is not None:
                    raw_target_id = batch_company_id
                else:
                    raw_target_id = 1
            target_nid: int = int(raw_target_id)
            calc_res = KPIEngineService.calculate_kpi(
                kpi=kpi,
                period=period,
                hierarchy_level=target_lvl,
                hierarchy_id=target_nid,
                trigger_type="UPLOAD_COMMIT",
                batch_id=batch.batch_id,
                user=request.user,
            )
            batch.kpi_execution_status = "COMPLETED" if calc_res.get("calculation_status") == "SUCCESS" else "FAILED"
            batch.kpi_result_summary = calc_res
            batch.save(update_fields=["kpi_execution_status", "kpi_result_summary"])
            serializer = ImportBatchDetailSerializer(batch)
            return Response({"success": True, "batch": serializer.data, "result": calc_res})
        except Exception as ex:
            batch.kpi_execution_status = "FAILED"
            batch.kpi_result_summary = {
                "status": "FAILED",
                "error": str(ex),
                "kpi_id": kpi.id,
                "kpi_code": kpi.code,
                "kpi_name": kpi.name,
            }
            batch.save(update_fields=["kpi_execution_status", "kpi_result_summary"])
            return Response({"success": False, "message": f"KPI calculation failed: {str(ex)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

