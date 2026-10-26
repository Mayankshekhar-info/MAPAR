"""
KPI Recalculation Service.
Executes dependency-aware recalculation pipelines triggered automatically
by successful Excel upload batch commits or administrative re-sync requests.
"""

from typing import Dict, Any, List, Set, Optional
from apps.imports.models import ImportBatch, ImportStagedRow
from apps.dashboard.models import ReportingPeriod
from apps.organization.models import Circle
from apps.kpi.models import (
    KPIDefinition,
    KPIDependency,
    KPICalculationResult,
)
from apps.kpi.services.kpi_engine_service import KPIEngineService


class KPIRecalculationService:
    @classmethod
    def recalculate_for_batch(cls, batch: ImportBatch, user=None) -> Dict[str, Any]:
        """
        Triggered immediately following ImportExecutionService.commit_batch().
        Discovers dependent KPI definitions, affected hierarchy nodes, and recalculates results.
        """
        template = batch.template_version.template
        period = batch.reporting_period
        if not period:
            period = ReportingPeriod.objects.filter(is_current=True).first() or ReportingPeriod.objects.first()

        if not period:
            return {"recalculated_kpis": 0, "status": "NO_ACTIVE_REPORTING_PERIOD"}

        # 1. Identify direct KPI definitions referencing this source dataset
        active_kpis = list(KPIDefinition.objects.filter(is_active=True))
        direct_kpis = []
        for k in active_kpis:
            if getattr(k, "source_dataset_id", None) == template.id:
                direct_kpis.append(k)
            else:
                p_comps = (k.presentation_config or {}).get("comparisons", [])
                if any(
                    (c.get("data_source") or {}).get("dataset_id") == template.id
                    for c in p_comps
                ):
                    direct_kpis.append(k)

        if not direct_kpis:
            return {
                "batch_id": batch.batch_id,
                "template": template.name,
                "recalculated_count": 0,
                "message": "No active KPI definitions depend on this uploaded dataset.",
            }

        # 2. Identify derived KPIs depending on direct KPIs
        all_kpis_to_recalc = list(direct_kpis)
        direct_kpi_ids = {k.id for k in direct_kpis}
        derived_kpis = list(
            KPIDefinition.objects.filter(
                is_active=True,
                dependencies__depends_on_id__in=direct_kpi_ids
            ).distinct()
        )
        all_kpis_to_recalc.extend(derived_kpis)

        # 3. Determine target hierarchy nodes from the batch's staged rows
        target_circle_ids: Set[int] = set()
        batch_circle_id = getattr(batch, "circle_id", None) or (batch.circle.id if getattr(batch, "circle", None) else None)
        if batch_circle_id:
            target_circle_ids.add(int(batch_circle_id))

        circle_lookup = KPIEngineService._build_circle_lookup()
        staged_rows = ImportStagedRow.objects.filter(batch=batch, is_valid=True)

        for row in staged_rows.iterator():
            raw = row.raw_data
            for k, v in raw.items():
                if "circle" in k.lower() and v:
                    s_v = str(v).strip().upper()
                    norm_v = KPIEngineService._normalize_circle_token(s_v)
                    if s_v in circle_lookup:
                        target_circle_ids.add(circle_lookup[s_v])
                    elif norm_v in circle_lookup:
                        target_circle_ids.add(circle_lookup[norm_v])

        if not target_circle_ids:
            # Fallback to all active circles
            target_circle_ids = set(Circle.objects.filter(is_active=True).values_list("id", flat=True))

        recalculated_count = 0
        errors = []

        # 4. Execute calculations for each KPI across identified circles and assigned hierarchy nodes
        for kpi in direct_kpis:
            nodes_to_calc = []
            if kpi.hierarchy_id:
                nodes_to_calc.append((kpi.hierarchy_level or "CIRCLE", kpi.hierarchy_id))
            for circle_id in target_circle_ids:
                nodes_to_calc.append(("CIRCLE", circle_id))

            seen_nodes = set()
            for lvl, nid in nodes_to_calc:
                key = (lvl.upper(), nid)
                if key in seen_nodes:
                    continue
                seen_nodes.add(key)
                try:
                    KPIEngineService.calculate_kpi(
                        kpi=kpi,
                        period=period,
                        hierarchy_level=lvl,
                        hierarchy_id=nid,
                        trigger_type="UPLOAD_COMMIT",
                        batch_id=batch.batch_id,
                        user=user,
                    )
                    recalculated_count += 1
                except Exception as ex:
                    errors.append(f"{kpi.code} @ {lvl}:{nid}: {str(ex)}")

        # 5. Execute derived KPIs
        for derived_kpi in derived_kpis:
            nodes_to_calc = []
            if derived_kpi.hierarchy_id:
                nodes_to_calc.append((derived_kpi.hierarchy_level or "CIRCLE", derived_kpi.hierarchy_id))
            for circle_id in target_circle_ids:
                nodes_to_calc.append(("CIRCLE", circle_id))

            seen_nodes = set()
            for lvl, nid in nodes_to_calc:
                key = (lvl.upper(), nid)
                if key in seen_nodes:
                    continue
                seen_nodes.add(key)
                try:
                    KPIEngineService.calculate_kpi(
                        kpi=derived_kpi,
                        period=period,
                        hierarchy_level=lvl,
                        hierarchy_id=nid,
                        trigger_type="UPLOAD_COMMIT",
                        batch_id=batch.batch_id,
                        user=user,
                    )
                    recalculated_count += 1
                except Exception as ex:
                    errors.append(f"{derived_kpi.code} (Derived) @ {lvl}:{nid}: {str(ex)}")

        return {
            "batch_id": batch.batch_id,
            "template": template.name,
            "recalculated_count": recalculated_count,
            "errors": errors,
            "direct_kpis_affected": [k.code for k in direct_kpis],
            "derived_kpis_affected": [k.code for k in derived_kpis],
        }
