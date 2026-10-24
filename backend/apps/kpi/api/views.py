"""
REST API Views for Universal KPI Module.
Coordinates authentication, authorization, validation, services, and response formatting.
"""

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.core.exceptions import ValidationError

from apps.kpi.selectors.kpi_selectors import KPISelectors
from apps.kpi.services.kpi_definition_service import KPIDefinitionService
from apps.kpi.services.kpi_engine_service import KPIEngineService
from apps.kpi.services.formula_evaluator import SafeFormulaEvaluator
from apps.kpi.services.kpi_formula_excel_service import KPIFormulaExcelService
from apps.kpi.services.kpi_sync_service import KPISyncService
from apps.kpi.models import (
    KPIDefinition,
    KPICalculationResult,
    KPICalculationAuditLog,
    KPIConfigurationVersion,
)
from apps.dashboard.models import ReportingPeriod
from apps.imports.models import ImportStagedRow
from apps.kpi.api.serializers import (
    KPIDefinitionSerializer,
    KPICalculateRequestSerializer,
    KPITestLogicRequestSerializer,
    KPIFormulaValidationSerializer,
    KPICalculationResultSerializer,
    KPIConfigurationVersionSerializer,
    KPIFormulaActivateRequestSerializer,
)
from apps.kpi.permissions.kpi_permissions import HasKPIPermission
from common.permissions.authorization import AuthorizationService


class KPIDefinitionListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasKPIPermission]

    def get(self, request):
        search = request.query_params.get("search")
        is_active = request.query_params.get("is_active")
        domain_id = request.query_params.get("domain_id")
        hierarchy_level = request.query_params.get("hierarchy_level")

        active_bool = None
        if is_active is not None:
            active_bool = is_active.lower() in ["true", "1", "yes"]

        qs = KPISelectors.list_kpi_definitions(
            user=request.user,
            is_active=active_bool,
            search=search,
            domain_id=int(domain_id) if domain_id else None,
            hierarchy_level=hierarchy_level,
        )
        serializer = KPIDefinitionSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = KPIDefinitionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            kpi = KPIDefinitionService.create_definition(data=serializer.validated_data, user=request.user)
            return Response(KPIDefinitionSerializer(kpi).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({"message": f"Failed to create KPI definition: {str(ex)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class KPIDefinitionDetailView(APIView):
    permission_classes = [IsAuthenticated, HasKPIPermission]

    def get(self, request, pk):
        kpi = KPISelectors.get_kpi_definition_by_id(pk)
        if not kpi:
            return Response({"message": "KPI definition not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(KPIDefinitionSerializer(kpi).data)

    def put(self, request, pk):
        kpi = KPISelectors.get_kpi_definition_by_id(pk)
        if not kpi:
            return Response({"message": "KPI definition not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = KPIDefinitionSerializer(kpi, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            updated = KPIDefinitionService.update_definition(kpi, serializer.validated_data, user=request.user)
            return Response(KPIDefinitionSerializer(updated).data)
        except ValidationError as e:
            return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({"message": str(ex)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, pk):
        kpi = KPISelectors.get_kpi_definition_by_id(pk)
        if not kpi:
            return Response({"message": "KPI definition not found."}, status=status.HTTP_404_NOT_FOUND)

        kpi.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class KPIDuplicateView(APIView):
    permission_classes = [IsAuthenticated, HasKPIPermission]

    def post(self, request, pk):
        kpi = KPISelectors.get_kpi_definition_by_id(pk)
        if not kpi:
            return Response({"message": "KPI definition not found."}, status=status.HTTP_404_NOT_FOUND)

        new_kpi = KPIDefinitionService.duplicate_definition(kpi, user=request.user)
        return Response(KPIDefinitionSerializer(new_kpi).data, status=status.HTTP_201_CREATED)


class KPIValidateFormulaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = KPIFormulaValidationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        formula = serializer.validated_data["formula"]
        variables = set(serializer.validated_data.get("variables", []))

        is_valid, error, detected = SafeFormulaEvaluator.validate_syntax(formula, allowed_variables=variables if variables else None)
        return Response({
            "is_valid": is_valid,
            "error": error,
            "detected_variables": sorted(list(detected)),
        })


class KPIDatasetListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        datasets = KPISelectors.get_available_datasets(user=request.user)
        return Response(datasets)


class KPIDatasetFieldListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, dataset_id):
        fields = KPISelectors.get_dataset_fields(dataset_id)
        return Response(fields)


class KPICalculateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        kpi = KPISelectors.get_kpi_definition_by_id(pk)
        if not kpi:
            return Response({"message": "KPI definition not found."}, status=status.HTTP_404_NOT_FOUND)

        req_serializer = KPICalculateRequestSerializer(data=request.data)
        if not req_serializer.is_valid():
            return Response(req_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        period_id = req_serializer.validated_data.get("period_id")
        hierarchy_level = req_serializer.validated_data.get("hierarchy_level") or kpi.hierarchy_level or "CIRCLE"
        hierarchy_id = req_serializer.validated_data.get("hierarchy_id") or kpi.hierarchy_id or 1

        if period_id:
            period = ReportingPeriod.objects.filter(id=period_id).first()
        else:
            period = ReportingPeriod.objects.filter(is_current=True).first() or ReportingPeriod.objects.first()

        if not period:
            return Response({"message": "No active reporting period found."}, status=status.HTTP_400_BAD_REQUEST)

        # Scoped authorization check
        if not request.user.is_superuser:
            AuthorizationService.require_organization_access(
                user=request.user,
                circle_id=hierarchy_id if hierarchy_level.upper() == "CIRCLE" else None,
                action="view",
            )

        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=period,
            hierarchy_level=hierarchy_level,
            hierarchy_id=hierarchy_id,
            trigger_type="ON_DEMAND",
            user=request.user,
        )
        return Response(res)


class KPIDashboardCardListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period_id = request.query_params.get("period_id")
        hierarchy_level = request.query_params.get("hierarchy_level")
        hierarchy_id = request.query_params.get("hierarchy_id")

        cards = KPISelectors.get_dashboard_cards(
            user=request.user,
            period_id=int(period_id) if period_id else None,
            hierarchy_level=hierarchy_level,
            hierarchy_id=int(hierarchy_id) if hierarchy_id else None,
        )
        return Response(cards)


class KPIDiagnosticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, result_id):
        res = KPICalculationResult.objects.select_related("kpi", "reporting_period").filter(id=result_id).first()
        if not res:
            return Response({"message": "KPI result not found."}, status=status.HTTP_404_NOT_FOUND)

        # Scoped authorization check
        if not request.user.is_superuser and res.hierarchy_level == "CIRCLE":
            AuthorizationService.require_organization_access(
                user=request.user,
                circle_id=res.hierarchy_id,
                action="view",
            )

        audits = KPICalculationAuditLog.objects.filter(
            kpi=res.kpi,
            reporting_period=res.reporting_period,
            hierarchy_level=res.hierarchy_level,
            hierarchy_id=res.hierarchy_id,
        ).order_by("-created_at")[:10]

        audit_history = [
            {
                "id": a.id,
                "trigger_type": a.trigger_type,
                "status": a.status,
                "calculated_value": float(a.calculated_value) if a.calculated_value is not None else None,
                "execution_time_ms": a.execution_time_ms,
                "records_considered": a.records_considered,
                "records_excluded": a.records_excluded,
                "diagnostics": a.diagnostics,
                "executed_by": a.executed_by.get_full_name() if a.executed_by else "System",
                "created_at": a.created_at.isoformat(),
            }
            for a in audits
        ]

        matched_row_ids = (res.lineage_info or {}).get("matched_row_ids", [])
        refined_records_preview = []
        if matched_row_ids:
            refined_records_preview = [
                r.raw_data for r in ImportStagedRow.objects.filter(id__in=matched_row_ids[:50])
            ]
        elif res.kpi.source_dataset:
            refined_data = KPIEngineService.get_refined_records(
                kpi=res.kpi,
                period=res.reporting_period,
                hierarchy_level=res.hierarchy_level,
                hierarchy_id=res.hierarchy_id,
                page=1,
                page_size=50,
            )
            refined_records_preview = refined_data.get("records", [])

        dataset_cols = []
        if res.kpi.source_dataset:
            active_version = res.kpi.source_dataset.versions.filter(is_active=True).first() or res.kpi.source_dataset.versions.order_by("-version_number").first()
            if active_version:
                dataset_cols = list(active_version.columns.values_list("name", flat=True))
        if not dataset_cols and refined_records_preview:
            dataset_cols = list(refined_records_preview[0].keys())

        applied_filters = [
            {"field_name": f.field_name, "operator": f.operator, "value": f.value}
            for f in res.kpi.filters.all()
        ]

        return Response({
            "result_id": res.id,
            "kpi_code": res.kpi.code,
            "kpi_name": res.kpi.name,
            "hierarchy_level": res.hierarchy_level,
            "hierarchy_id": res.hierarchy_id,
            "hierarchy_name": res.hierarchy_name,
            "calculated_value": float(res.calculated_value) if res.calculated_value is not None else None,
            "target_value": float(res.target_value) if res.target_value is not None else None,
            "rag_status": res.rag_status,
            "calculation_status": res.calculation_status,
            "error_message": res.error_message,
            "records_considered": res.records_considered,
            "records_excluded": res.records_excluded,
            "calculated_at": res.calculated_at.isoformat(),
            "lineage_info": res.lineage_info,
            "audit_history": audit_history,
            "refined_records": refined_records_preview,
            "refined_columns": dataset_cols,
            "total_refined_records": res.records_considered,
            "applied_filters": applied_filters,
        })


class KPIRefinedRecordsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, result_id):
        res = KPICalculationResult.objects.select_related("kpi", "reporting_period").filter(id=result_id).first()
        if not res:
            return Response({"message": "KPI result not found."}, status=status.HTTP_404_NOT_FOUND)

        # Scoped authorization check
        if not request.user.is_superuser and res.hierarchy_level == "CIRCLE":
            AuthorizationService.require_organization_access(
                user=request.user,
                circle_id=res.hierarchy_id,
                action="view",
            )

        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 25))
        search = request.query_params.get("search")

        data = KPIEngineService.get_refined_records(
            kpi=res.kpi,
            period=res.reporting_period,
            hierarchy_level=res.hierarchy_level,
            hierarchy_id=res.hierarchy_id,
            page=page,
            page_size=page_size,
            search=search,
        )
        data["result_id"] = res.id
        data["kpi_code"] = res.kpi.code
        data["kpi_name"] = res.kpi.name
        data["calculated_value"] = float(res.calculated_value) if res.calculated_value is not None else None
        data["rag_status"] = res.rag_status
        return Response(data)


class KPITestLogicView(APIView):
    """
    Ad-hoc testing and execution endpoint for KPI Logic Builder expressions.
    Allows testing filters, expressions, and calculations against real uploaded staged records
    without persisting or mutating any KPI definitions.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = KPITestLogicRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        dataset_id = data.get("dataset_id")
        natural_language_rule = data.get("natural_language_rule", "")
        logic_expression = data.get("logic_expression", "")
        formula_expression = data.get("formula_expression", "")
        calculation_type = data.get("calculation_type", "formula")
        filters = data.get("filters", [])
        parameters = data.get("parameters", [])
        group_by = data.get("group_by", [])
        presentation_config = data.get("presentation_config", {})
        hierarchy_level = data.get("hierarchy_level") or "CIRCLE"
        hierarchy_id = data.get("hierarchy_id") or 1
        period_id = data.get("period_id")
        unit = data.get("unit", "")

        # Scoped authorization check if hierarchy_level == "CIRCLE"
        if not request.user.is_superuser and hierarchy_level.upper() == "CIRCLE" and hierarchy_id:
            try:
                AuthorizationService.require_organization_access(
                    user=request.user,
                    circle_id=hierarchy_id,
                    action="view",
                )
            except Exception as e:
                return Response({"success": False, "error": str(e), "message": str(e)}, status=status.HTTP_403_FORBIDDEN)

        try:
            result = KPIEngineService.execute_adhoc_logic(
                dataset_id=dataset_id,
                natural_language_rule=natural_language_rule,
                logic_expression=logic_expression,
                formula_expression=formula_expression,
                calculation_type=calculation_type,
                filters=filters,
                parameters=parameters,
                group_by=group_by,
                presentation_config=presentation_config,
                hierarchy_level=hierarchy_level,
                hierarchy_id=hierarchy_id,
                period_id=period_id,
                unit=unit,
                user=request.user,
            )
            return Response(result, status=status.HTTP_200_OK if result.get("success") else status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({"success": False, "error": str(ex), "message": str(ex)}, status=status.HTTP_400_BAD_REQUEST)


class KPIFormulaParseView(APIView):
    """
    POST /api/v1/kpi/configuration/parse/
    Parses and previews an uploaded KPI formula workbook without activating.
    Identifies sheets, columns, validates required fields, formulas (AST sandbox), and duplicate codes.
    """
    permission_classes = [IsAuthenticated, HasKPIPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"success": False, "message": "No Excel file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        target_sheet = request.data.get("target_sheet")
        custom_mapping = None
        mapping_raw = request.data.get("custom_mapping")
        if mapping_raw:
            import json
            try:
                custom_mapping = json.loads(mapping_raw) if isinstance(mapping_raw, str) else mapping_raw
            except Exception:
                pass

        try:
            preview_data = KPIFormulaExcelService.parse_and_preview_workbook(
                uploaded_file=uploaded_file,
                custom_mapping=custom_mapping,
                target_sheet=target_sheet,
            )
            return Response({"success": True, **preview_data})
        except ValidationError as e:
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({"success": False, "message": f"Workbook inspection failed: {str(ex)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class KPIFormulaActivateView(APIView):
    """
    POST /api/v1/kpi/configuration/activate/
    Stores and approves the validated KPI configuration in PostgreSQL with immutable version history.
    Supports Enterprise defaults, Company-level, and Project-specific overrides.
    """
    permission_classes = [IsAuthenticated, HasKPIPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        uploaded_file = request.FILES.get("file")

        approved_kpis = request.data.get("approved_kpis")
        if isinstance(approved_kpis, str):
            import json
            try:
                approved_kpis = json.loads(approved_kpis)
            except Exception:
                approved_kpis = []

        scope_type = request.data.get("scope_type", "ENTERPRISE")
        company_id = request.data.get("company_id")
        project_id = request.data.get("project_id")
        circle_id = request.data.get("circle_id")
        hierarchy_level = request.data.get("hierarchy_level")
        hierarchy_id = request.data.get("hierarchy_id")
        is_inheritance_raw = request.data.get("is_inheritance_allowed", True)
        changelog = request.data.get("changelog", "")

        company_id_int = int(company_id) if company_id and str(company_id).isdigit() else None
        project_id_int = int(project_id) if project_id and str(project_id).isdigit() else None
        circle_id_int = int(circle_id) if circle_id and str(circle_id).isdigit() else None
        hierarchy_id_int = int(hierarchy_id) if hierarchy_id and str(hierarchy_id).isdigit() else None
        is_inheritance_allowed = str(is_inheritance_raw).lower() not in ["false", "0", "no"]

        if not approved_kpis:
            return Response({"success": False, "message": "No approved KPI definitions provided for activation."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = KPIFormulaExcelService.activate_configuration(
                uploaded_file=uploaded_file,
                approved_kpis=approved_kpis,
                scope_type=scope_type,
                company_id=company_id_int,
                project_id=project_id_int,
                circle_id=circle_id_int,
                hierarchy_level=hierarchy_level,
                hierarchy_id=hierarchy_id_int,
                changelog=changelog,
                is_inheritance_allowed=is_inheritance_allowed,
                user=request.user,
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            msg = e.message if hasattr(e, "message") else str(e)
            return Response({"success": False, "message": msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({"success": False, "message": f"Configuration activation failed: {str(ex)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class KPIConfigVersionsView(APIView):
    """
    GET /api/v1/kpi/configuration/versions/
    Returns history of approved KPI formula configuration versions.
    """
    permission_classes = [IsAuthenticated, HasKPIPermission]

    def get(self, request):
        scope_type = request.query_params.get("scope_type")
        company_id = request.query_params.get("company_id")
        project_id = request.query_params.get("project_id")
        circle_id = request.query_params.get("circle_id")

        qs = KPIConfigurationVersion.objects.select_related("company", "project", "circle", "created_by").all()
        if scope_type:
            qs = qs.filter(scope_type=scope_type.upper())
        if company_id and str(company_id).isdigit():
            qs = qs.filter(company_id=int(company_id))
        if project_id and str(project_id).isdigit():
            qs = qs.filter(project_id=int(project_id))
        if circle_id and str(circle_id).isdigit():
            qs = qs.filter(circle_id=int(circle_id))

        serializer = KPIConfigurationVersionSerializer(qs.order_by("-version_number", "-created_at")[:50], many=True)
        return Response({"success": True, "versions": serializer.data})


class KPIFormulaTemplateView(APIView):
    """
    GET /api/v1/kpi/configuration/template/
    Generates and downloads the official starter KPI Formula Excel template workbook.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        buffer = KPIFormulaExcelService.generate_starter_excel_template()
        filename = "MAPAR_KPI_Formula_Configuration_Template.xlsx"

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response


class KPISyncCanonicalView(APIView):
    """
    POST /api/v1/kpi/sync-canonical/
    Admin endpoint to initialize/sync canonical operational datasets and universal KPIs.
    """
    permission_classes = [IsAuthenticated, HasKPIPermission]

    def post(self, request):
        try:
            summary = KPISyncService.run_full_sync()
            return Response({
                "success": True,
                "message": f"Canonical synchronization complete: {summary.get('kpis_synced', 0)} KPIs and {summary.get('values_synced', 0)} values synchronized.",
                **summary,
            })
        except Exception as ex:
            return Response({"success": False, "message": f"Sync failed: {str(ex)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

