"""
KPI Synchronization Service.
Bridges canonical MAPAR datasets, existing 55 Universal KPIs from kpis_kpi,
and live operational KPIValues into the dynamic KPIDefinition and KPICalculationResult engine.
"""

from decimal import Decimal
from django.db import transaction
from apps.dashboard.models import KPI, KPIValue, ReportingPeriod
from apps.organization.models import Circle, Domain
from apps.imports.models import UploadTemplate, UploadTemplateVersion, UploadTemplateColumn
from apps.kpi.models import (
    KPIDefinition,
    KPIParameter,
    KPICalculationResult,
)


class KPISyncService:
    @classmethod
    def sync_canonical_datasets(cls):
        """
        Ensures standard MAPAR data sources exist as discoverable templates with typed columns.
        """
        # 1. Operational KPI Ingestion Dataset
        ops_tpl, _ = UploadTemplate.objects.get_or_create(
            code="DS_KPI_OPS",
            defaults={
                "name": "Universal Operational Metrics",
                "description": "Daily/Monthly Operational KPI Ingestion Dataset covering Network, Field, and Circle operations.",
                "data_level": "CIRCLE",
                "target_entity": "KPI_VALUES",
                "status": UploadTemplate.Status.ACTIVE,
            }
        )
        ops_ver, _ = UploadTemplateVersion.objects.get_or_create(
            template=ops_tpl,
            version_number=1,
            defaults={"is_active": True}
        )
        ops_cols = [
            ("circle", "Circle Code / Name", "REFERENCE", True, 1),
            ("kpi_code", "KPI Code", "TEXT", True, 2),
            ("actual_value", "Actual Value", "DECIMAL", True, 3),
            ("target_value", "Target Value", "DECIMAL", False, 4),
            ("variance_to_target", "Variance to Target", "DECIMAL", False, 5),
            ("rag_status", "RAG Status (GREEN/AMBER/RED)", "TEXT", False, 6),
            ("trend", "Trend (UP/DOWN/FLAT)", "TEXT", False, 7),
        ]
        for col_name, label, dtype, req, order in ops_cols:
            UploadTemplateColumn.objects.get_or_create(
                version=ops_ver,
                name=col_name,
                defaults={
                    "display_label": label,
                    "data_type": dtype,
                    "is_required": req,
                    "column_order": order,
                }
            )

        # 2. Governance & Action Items Dataset
        gov_tpl, _ = UploadTemplate.objects.get_or_create(
            code="DS_GOVERNANCE",
            defaults={
                "name": "Governance & Action Tracking",
                "description": "Issues, escalated action items, closure statuses, and root-cause trackers.",
                "data_level": "CIRCLE",
                "target_entity": "GOVERNANCE",
                "status": UploadTemplate.Status.ACTIVE,
            }
        )
        gov_ver, _ = UploadTemplateVersion.objects.get_or_create(
            template=gov_tpl,
            version_number=1,
            defaults={"is_active": True}
        )
        gov_cols = [
            ("circle", "Circle", "REFERENCE", True, 1),
            ("action_code", "Action Item Code", "TEXT", True, 2),
            ("accountable_owner", "Accountable Owner", "TEXT", True, 3),
            ("status", "Status (OPEN/IN_PROGRESS/CLOSED)", "TEXT", True, 4),
            ("progress_percentage", "Progress %", "PERCENTAGE", False, 5),
            ("overdue_days", "Overdue Days", "INTEGER", False, 6),
            ("governance_rag", "Governance RAG", "TEXT", False, 7),
        ]
        for col_name, label, dtype, req, order in gov_cols:
            UploadTemplateColumn.objects.get_or_create(
                version=gov_ver,
                name=col_name,
                defaults={
                    "display_label": label,
                    "data_type": dtype,
                    "is_required": req,
                    "column_order": order,
                }
            )

        # 3. People & Workforce Roster
        wf_tpl, _ = UploadTemplate.objects.get_or_create(
            code="DS_WORKFORCE",
            defaults={
                "name": "People & Workforce Operations",
                "description": "Headcount deployment, vacancies, required staffing, and resource gap analytics.",
                "data_level": "CIRCLE",
                "target_entity": "WORKFORCE",
                "status": UploadTemplate.Status.ACTIVE,
            }
        )
        wf_ver, _ = UploadTemplateVersion.objects.get_or_create(
            template=wf_tpl,
            version_number=1,
            defaults={"is_active": True}
        )
        wf_cols = [
            ("circle", "Circle", "REFERENCE", True, 1),
            ("department", "Department", "TEXT", False, 2),
            ("required_headcount", "Required Headcount", "INTEGER", True, 3),
            ("deployed_headcount", "Deployed Headcount", "INTEGER", True, 4),
            ("resource_gap", "Resource Gap", "INTEGER", False, 5),
            ("open_positions", "Open Positions", "INTEGER", False, 6),
        ]
        for col_name, label, dtype, req, order in wf_cols:
            UploadTemplateColumn.objects.get_or_create(
                version=wf_ver,
                name=col_name,
                defaults={
                    "display_label": label,
                    "data_type": dtype,
                    "is_required": req,
                    "column_order": order,
                }
            )

        return ops_tpl

    @classmethod
    def sync_universal_kpis(cls) -> int:
        """
        Synchronizes all 55 Universal KPIs from kpis_kpi into KPIDefinition.
        Preserves definitions, domains, formulas, units, and directions.
        """
        cls.sync_canonical_datasets()
        ops_dataset = UploadTemplate.objects.filter(code="DS_KPI_OPS").first()

        synced_count = 0
        legacy_kpis = list(KPI.objects.select_related("domain").all())

        with transaction.atomic():
            for legacy in legacy_kpis:
                # Detect appropriate CalculationType
                raw_formula = (legacy.calculation_formula or "").strip()
                cleaned_formula = (
                    raw_formula.replace("\xd7", "*")
                    .replace("\xf7", "/")
                    .replace("\u2212", "-")
                )

                unit_str = (legacy.unit or "Units").strip()
                calc_type = KPIDefinition.CalculationType.SIMPLE_AGGREGATE
                if "%" in unit_str or "Adherence %" in legacy.name or "Availability %" in legacy.name or "Closure %" in legacy.name:
                    calc_type = KPIDefinition.CalculationType.ACHIEVEMENT_PCT
                elif "Count" in legacy.name or "Cases" in legacy.name:
                    calc_type = KPIDefinition.CalculationType.SIMPLE_AGGREGATE
                elif "Gap" in legacy.name:
                    calc_type = KPIDefinition.CalculationType.VARIANCE

                kpi_def, created = KPIDefinition.objects.update_or_create(
                    code=legacy.code,
                    config_version__isnull=True,
                    defaults={
                        "name": legacy.name,
                        "description": legacy.definition or legacy.name,
                        "domain": legacy.domain,
                        "hierarchy_level": "CIRCLE",
                        "scope_type": "ENTERPRISE",
                        "is_inheritance_allowed": True,
                        "company": None,
                        "project": None,
                        "circle": None,
                        "calculation_type": calc_type,
                        "source_dataset": ops_dataset,
                        "formula_expression": cleaned_formula,
                        "aggregation_method": "AVG" if "%" in unit_str else "SUM",
                        "unit": unit_str,
                        "decimal_precision": 2,
                        "direction": legacy.direction or "HIGHER_BETTER",
                        "threshold_green": Decimal("95.00"),
                        "threshold_amber": Decimal("80.00"),
                        "is_active": legacy.is_active,
                        "is_executive": legacy.is_executive,
                        "display_order": legacy.display_order,
                    }
                )

                # Ensure default parameters exist
                if not kpi_def.parameters.exists():
                    KPIParameter.objects.create(
                        kpi=kpi_def,
                        name="actual",
                        label="Actual Value",
                        source_column="actual_value",
                        aggregation="AVG" if "%" in unit_str else "SUM",
                    )
                    KPIParameter.objects.create(
                        kpi=kpi_def,
                        name="target",
                        label="Target Value",
                        source_column="target_value",
                        aggregation="AVG" if "%" in unit_str else "SUM",
                    )

                synced_count += 1

        return synced_count

    @classmethod
    def sync_existing_kpi_values(cls) -> int:
        """
        Synchronizes existing KPIValue records into KPICalculationResult.
        Ensures dashboard cards immediately reflect live historical values.
        """
        synced_count = 0
        legacy_values = list(
            KPIValue.objects.select_related("kpi", "circle", "period").all()
        )

        with transaction.atomic():
            for val in legacy_values:
                kpi_def = KPIDefinition.objects.filter(code=val.kpi.code).first()
                if not kpi_def:
                    continue

                ach_pct = val.variance_percentage
                if val.target_value and val.target_value > 0 and val.actual_value:
                    ach_pct = round((val.actual_value / val.target_value) * Decimal("100.00"), 2)

                KPICalculationResult.objects.update_or_create(
                    kpi=kpi_def,
                    reporting_period=val.period,
                    hierarchy_level="CIRCLE",
                    hierarchy_id=val.circle_id,
                    defaults={
                        "hierarchy_name": val.circle.name,
                        "calculated_value": val.actual_value,
                        "target_value": val.target_value,
                        "variance_to_target": val.variance_to_target,
                        "variance_percentage": val.variance_percentage,
                        "achievement_percentage": ach_pct,
                        "rag_status": val.rag_status,
                        "records_considered": 1,
                        "records_excluded": 0,
                        "calculation_status": "SUCCESS",
                        "lineage_info": {
                            "source": "kpis_kpivalue",
                            "legacy_kpi_id": val.kpi_id,
                            "notes": val.notes,
                        },
                    }
                )
                synced_count += 1

        return synced_count

    @classmethod
    def run_full_sync(cls):
        cls.sync_canonical_datasets()
        kpi_count = cls.sync_universal_kpis()
        val_count = cls.sync_existing_kpi_values()
        return {
            "kpis_synced": kpi_count,
            "values_synced": val_count,
        }
