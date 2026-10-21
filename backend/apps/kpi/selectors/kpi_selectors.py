"""
KPI Database Selectors.
Encapsulates read queries, scoped filtering, dynamic metadata discovery, and dashboard aggregations.
"""

from typing import List, Dict, Any, Optional
from django.db.models import Q
from apps.kpi.models import (
    KPIDefinition,
    KPICalculationResult,
    KPICalculationAuditLog,
)
from apps.imports.models import UploadTemplate, UploadTemplateVersion, UploadTemplateColumn
from apps.dashboard.models import ReportingPeriod
from common.permissions.authorization import AuthorizationService


class KPISelectors:
    @classmethod
    def list_kpi_definitions(
        cls,
        user=None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        domain_id: Optional[int] = None,
        hierarchy_level: Optional[str] = None,
    ):
        qs = KPIDefinition.objects.select_related("domain", "source_dataset", "created_by").prefetch_related(
            "parameters", "filters", "dependencies__depends_on"
        ).all()

        if is_active is not None:
            qs = qs.filter(is_active=is_active)

        if domain_id:
            qs = qs.filter(domain_id=domain_id)

        if hierarchy_level:
            qs = qs.filter(hierarchy_level=hierarchy_level.upper())

        if search:
            s = search.strip()
            qs = qs.filter(
                Q(code__icontains=s) |
                Q(name__icontains=s) |
                Q(description__icontains=s) |
                Q(formula_expression__icontains=s)
            )

        return qs.order_by("display_order", "code")

    @classmethod
    def get_kpi_definition_by_id(cls, kpi_id: int) -> Optional[KPIDefinition]:
        return (
            KPIDefinition.objects.select_related("domain", "source_dataset", "created_by")
            .prefetch_related("parameters", "filters", "dependencies__depends_on")
            .filter(id=kpi_id)
            .first()
        )

    @classmethod
    def get_available_datasets(cls, user=None) -> List[Dict[str, Any]]:
        """
        Discovers all valid active UploadTemplates that can be referenced as source datasets.
        """
        templates = UploadTemplate.objects.filter(status=UploadTemplate.Status.ACTIVE).prefetch_related(
            "versions__columns"
        ).order_by("name")

        datasets = []
        for t in templates:
            active_version = t.versions.filter(is_active=True).first() or t.versions.order_by("-version_number").first()
            datasets.append({
                "id": t.id,
                "name": t.name,
                "code": t.code,
                "description": t.description,
                "data_level": t.data_level,
                "target_entity": t.target_entity,
                "active_version_number": active_version.version_number if active_version else 1,
                "column_count": active_version.columns.count() if active_version else 0,
            })
        return datasets

    @classmethod
    def get_dataset_fields(cls, dataset_id: int) -> List[Dict[str, Any]]:
        """
        Discovers column specifications from the active template version.
        """
        template = UploadTemplate.objects.filter(id=dataset_id).first()
        if not template:
            return []

        active_version = template.versions.filter(is_active=True).first() or template.versions.order_by("-version_number").first()
        if not active_version:
            return []

        cols = active_version.columns.all().order_by("column_order", "name")
        return [
            {
                "id": c.id,
                "name": c.name,
                "display_label": c.display_label,
                "data_type": c.data_type,
                "is_required": c.is_required,
                "column_order": c.column_order,
                "validation_rules": c.validation_rules,
            }
            for c in cols
        ]

    @classmethod
    def get_dashboard_cards(
        cls,
        user=None,
        period_id: Optional[int] = None,
        hierarchy_level: Optional[str] = None,
        hierarchy_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves live KPI calculation cards for dashboard display,
        strictly respecting the user's hierarchy scope.
        """
        if not period_id:
            period = ReportingPeriod.objects.filter(is_current=True).first() or ReportingPeriod.objects.first()
            if period:
                period_id = period.id

        if not period_id:
            return []

        period_obj = ReportingPeriod.objects.filter(id=period_id).first()

        cards = []
        if hierarchy_level and hierarchy_id:
            # Enforce authorization
            if user and not user.is_superuser:
                AuthorizationService.require_organization_access(
                    user=user,
                    circle_id=hierarchy_id if hierarchy_level.upper() == "CIRCLE" else None,
                    action="view"
                )

            # Strictly resolve the applicable, approved KPIDefinitions for this hierarchy node
            # (Circle Overrides > Project Overrides > Company Configurations > Enterprise Defaults)
            from apps.kpi.services.kpi_engine_service import KPIEngineService
            applicable_kpis = KPIEngineService.resolve_applicable_kpis_for_scope(
                hierarchy_level=hierarchy_level,
                hierarchy_id=hierarchy_id,
                period=period_obj,
            )

            if not applicable_kpis:
                return []

            target_lvl = hierarchy_level.upper()
            applicable_ids = [k.id for k in applicable_kpis]

            existing_results = {
                res.kpi_id: res
                for res in KPICalculationResult.objects.select_related("kpi", "reporting_period").filter(
                    kpi_id__in=applicable_ids,
                    hierarchy_level=target_lvl,
                    hierarchy_id=hierarchy_id,
                    reporting_period_id=period_id,
                )
            }

            # Auto-evaluate any applicable KPI that does not yet have a result
            if period_obj:
                for kpi_to_calc in applicable_kpis:
                    if kpi_to_calc.id not in existing_results:
                        try:
                            KPIEngineService.calculate_kpi(
                                kpi=kpi_to_calc,
                                period=period_obj,
                                hierarchy_level=target_lvl,
                                hierarchy_id=hierarchy_id,
                                trigger_type="DASHBOARD_VIEW",
                                user=user,
                            )
                            saved = KPICalculationResult.objects.select_related("kpi", "reporting_period").filter(
                                kpi_id=kpi_to_calc.id,
                                hierarchy_level=target_lvl,
                                hierarchy_id=hierarchy_id,
                                reporting_period_id=period_id,
                            ).first()
                            if saved:
                                existing_results[kpi_to_calc.id] = saved
                        except Exception:
                            pass

            # Present results in defined display order for the applicable KPIs
            ordered_results = []
            for kpi in applicable_kpis:
                if kpi.id in existing_results:
                    ordered_results.append(existing_results[kpi.id])
            qs_to_render = ordered_results
        else:
            qs = KPICalculationResult.objects.select_related("kpi", "reporting_period").filter(
                kpi__is_active=True,
                reporting_period_id=period_id,
            )
            if user and not user.is_superuser:
                scope = AuthorizationService.get_user_hierarchy_scope(user)
                if not scope.is_unrestricted and scope.circle_ids:
                    qs = qs.filter(hierarchy_level="CIRCLE", hierarchy_id__in=scope.circle_ids)
            qs_to_render = list(qs.order_by("kpi__display_order", "kpi__code")[:100])

        for res in qs_to_render:
            kpi = res.kpi
            lineage = res.lineage_info or {}
            cards.append({
                "id": res.id,
                "kpi_id": kpi.id,
                "kpi_code": kpi.code,
                "kpi_name": kpi.name,
                "unit": kpi.unit,
                "visualization_type": kpi.visualization_type,
                "calculated_value": float(res.calculated_value) if res.calculated_value is not None else None,
                "target_value": float(res.target_value) if res.target_value is not None else None,
                "variance_to_target": float(res.variance_to_target) if res.variance_to_target is not None else None,
                "variance_percentage": float(res.variance_percentage) if res.variance_percentage is not None else None,
                "achievement_percentage": float(res.achievement_percentage) if res.achievement_percentage is not None else None,
                "rag_status": res.rag_status,
                "hierarchy_level": res.hierarchy_level,
                "hierarchy_id": res.hierarchy_id,
                "hierarchy_name": res.hierarchy_name,
                "calculation_status": res.calculation_status,
                "error_message": res.error_message,
                "records_considered": res.records_considered,
                "calculated_at": res.calculated_at.isoformat(),
                "formula": kpi.formula_expression or kpi.calculation_type,
                "funnel_breakdown": lineage.get("funnel_breakdown"),
                "source_dataset_id": kpi.source_dataset_id,
                "source_dataset_name": kpi.source_dataset.name if kpi.source_dataset else None,
                "assigned_hierarchy_level": kpi.hierarchy_level,
                "assigned_hierarchy_id": kpi.hierarchy_id,
                "parameters": list(kpi.parameters.values("name", "source_column", "aggregation")),
                "filters": list(kpi.filters.values("field_name", "operator", "value")),
            })
        return cards
