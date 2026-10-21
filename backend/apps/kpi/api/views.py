"""
REST API Views for Universal KPI Module.
Coordinates authentication, authorization, validation, services, and response formatting.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError
from django.db import models

from apps.kpi.selectors.kpi_selectors import KPISelectors
from apps.kpi.services.kpi_definition_service import KPIDefinitionService
from apps.kpi.services.kpi_engine_service import KPIEngineService
from apps.kpi.services.formula_evaluator import SafeFormulaEvaluator
from apps.kpi.models import KPIDefinition, KPICalculationResult, KPICalculationAuditLog
from apps.dashboard.models import ReportingPeriod
from apps.imports.models import ImportStagedRow
from apps.kpi.api.serializers import (
    KPIDefinitionSerializer,
    KPICalculateRequestSerializer,
    KPITestLogicRequestSerializer,
    KPIFormulaValidationSerializer,
    KPIFormulaPreviewSerializer,
    KPICalculationResultSerializer,
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


class KPIPreviewFormulaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = KPIFormulaPreviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        formula = data["formula"]
        dataset_id = data.get("dataset_id")
        input_column = data.get("input_column", "")
        constants = data.get("constants") or {}
        decimal_precision = data.get("decimal_precision", 2)
        input_unit = data.get("input_unit", "")
        output_unit = data.get("output_unit", "")
        limit = min(data.get("limit", 5), 20)

        from apps.imports.models import UploadTemplate, ImportBatch, ImportStagedRow
        from apps.kpi.services.formula_calculation_service import KPIFormulaCalculationService

        available_columns = []
        template = None
        if dataset_id:
            template = UploadTemplate.objects.filter(id=dataset_id).first()
            if template:
                active_ver = template.versions.filter(is_active=True).first() or template.versions.order_by("-version_number").first()
                if active_ver:
                    available_columns = list(active_ver.columns.values_list("name", flat=True))

        val_res = KPIFormulaCalculationService.validate_formula(
            formula=formula,
            available_columns=available_columns if available_columns else None,
            constants=constants,
        )

        if not val_res["is_valid"]:
            return Response({
                "is_valid": False,
                "error": val_res.get("error", "Invalid formula syntax"),
                "detected_variables": val_res.get("detected_variables", []),
                "referenced_columns": val_res.get("referenced_columns", []),
                "has_actual_data": False,
                "samples": [],
            }, status=status.HTTP_200_OK)

        detected_vars = val_res.get("detected_variables", [])
        const_desc = ", ".join([f"{k} = {v}" for k, v in constants.items()]) if constants else "None"
        explanation = (
            f"Formula evaluates `{formula}` using columns {detected_vars}. "
            f"Constants: {const_desc}. "
            f"Result rounded to {decimal_precision} decimal places ({output_unit or 'units'})."
        )

        samples = []
        has_actual_data = False
        if template:
            batch_qs = ImportBatch.objects.filter(
                template_version__template=template,
                status=ImportBatch.Status.COMPLETED if hasattr(ImportBatch, "Status") else "COMPLETED",
            ).order_by("-created_at")
            latest_batch = batch_qs.first()
            if latest_batch:
                staged_rows = list(
                    ImportStagedRow.objects.filter(batch=latest_batch, is_valid=True)
                    .order_by("row_index")[:limit]
                )
                if staged_rows:
                    has_actual_data = True
                    for sr in staged_rows:
                        calc_val, status_code, err_msg = KPIFormulaCalculationService.evaluate_row(
                            row=sr,
                            formula=formula,
                            input_column=input_column,
                            constants=constants,
                            decimal_precision=decimal_precision,
                        )
                        input_vals = {}
                        if sr.raw_data:
                            for col in detected_vars:
                                if col in sr.raw_data:
                                    input_vals[col] = sr.raw_data[col]
                            if input_column and input_column in sr.raw_data and input_column not in input_vals:
                                input_vals[input_column] = sr.raw_data[input_column]

                        samples.append({
                            "row_number": getattr(sr, "row_index", getattr(sr, "row_number", 1)),
                            "inputs": input_vals,
                            "calculated_value": float(calc_val) if calc_val is not None else None,
                            "output_unit": output_unit,
                            "status": status_code,
                            "error": err_msg,
                        })

        return Response({
            "is_valid": True,
            "error": None,
            "explanation": explanation,
            "detected_variables": detected_vars,
            "referenced_columns": val_res.get("referenced_columns", []),
            "has_actual_data": has_actual_data,
            "samples": samples,
            "template_name": template.name if template else None,
            "output_unit": output_unit,
            "decimal_precision": decimal_precision,
        }, status=status.HTTP_200_OK)

