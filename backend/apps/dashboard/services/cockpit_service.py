"""
Cockpit Business Logic & Aggregation Service.
Computes mathematically sound matrix aggregations, subtotals, contextual breakdowns,
and contextual intelligence correlation (KPIs <-> Issues <-> Actions).
"""

from typing import List, Dict, Any, Optional
from decimal import Decimal
import csv
import io

from apps.dashboard.models import (
    KPI,
    KPIValue,
    ReportingPeriod,
    GovernanceIssue,
    GovernanceActionItem,
)
from apps.organization.models import Circle, Domain
from apps.dashboard.selectors.cockpit_selectors import (
    get_scoped_kpi_values,
    get_user_circle_ids,
)


class CockpitService:

    @classmethod
    def get_master_summary(
        cls,
        user=None,
        company_id: Optional[int] = None,
        sub_company_id: Optional[int] = None,
        project_id: Optional[int] = None,
        circle_id: Optional[int] = None,
        domain_id: Optional[int] = None,
        department_id: Optional[int] = None,
        period_id: Optional[int] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generates Operational Summary Matrix with valid subtotals and grand totals.
        """
        qs = get_scoped_kpi_values(
            user=user,
            company_id=company_id,
            sub_company_id=sub_company_id,
            project_id=project_id,
            circle_id=circle_id,
            domain_id=domain_id,
            department_id=department_id,
            period_id=period_id,
            status=status,
            search=search,
        )

        # Active period info
        active_period = None
        if period_id:
            active_period = ReportingPeriod.objects.filter(id=period_id).first()
        if not active_period:
            active_period = ReportingPeriod.objects.filter(is_current=True).first() or ReportingPeriod.objects.first()

        # Group by Circle and Domain
        # Key: (circle_id, domain_id)
        grouped_data: Dict[int, Dict[int, List[KPIValue]]] = {}
        circle_meta: Dict[int, Circle] = {}
        domain_meta: Dict[int, Domain] = {}

        for val in qs:
            c_id = val.circle_id
            d_id = val.kpi.domain_id

            circle_meta[c_id] = val.circle
            domain_meta[d_id] = val.kpi.domain

            if c_id not in grouped_data:
                grouped_data[c_id] = {}
            if d_id not in grouped_data[c_id]:
                grouped_data[c_id][d_id] = []
            grouped_data[c_id][d_id].append(val)

        # Also discover KPICalculationResult data for multi-rule metrics and freshness
        from apps.kpi.models import KPICalculationResult, KPIDefinition
        kpi_results_qs = KPICalculationResult.objects.select_related("kpi", "reporting_period").filter(
            reporting_period=active_period
        )
        if circle_id:
            kpi_results_qs = kpi_results_qs.filter(hierarchy_level="CIRCLE", hierarchy_id=circle_id)
        elif allowed_circles := get_user_circle_ids(user):
            kpi_results_qs = kpi_results_qs.filter(hierarchy_level="CIRCLE", hierarchy_id__in=allowed_circles)

        last_calc_dt = None
        total_rules_count = 0
        total_rules_met = 0
        total_rules_not_met = 0
        total_rules_pending = 0
        total_rules_issues = 0

        # Scan calculation results for multi-rule granular statuses
        for kres in kpi_results_qs:
            if not last_calc_dt or kres.calculated_at > last_calc_dt:
                last_calc_dt = kres.calculated_at
            
            lineage = kres.lineage_info or {}
            fb = lineage.get("funnel_breakdown", {})
            comparisons = fb.get("comparisons", [])
            if comparisons:
                for comp in comparisons:
                    rules = comp.get("rules", [])
                    if rules:
                        for r in rules:
                            total_rules_count += 1
                            rst = (r.get("status") or "").upper()
                            if rst in ["MET", "OPTIMAL", "MEETS_TARGET", "GREEN"]:
                                total_rules_met += 1
                            elif rst in ["NOT_MET", "CRITICAL", "WARNING", "BELOW_TARGET", "RED", "AMBER"]:
                                total_rules_not_met += 1
                            elif rst in ["PENDING_DATA", "NO_DATA"]:
                                total_rules_pending += 1
                            else:
                                total_rules_issues += 1
                    else:
                        total_rules_count += 1
                        cst = (comp.get("overall_status") or kres.rag_status or "").upper()
                        if cst in ["MET", "OPTIMAL", "GREEN"]:
                            total_rules_met += 1
                        elif cst in ["NOT_MET", "RED", "AMBER"]:
                            total_rules_not_met += 1
                        elif cst in ["PENDING_DATA", "NO_DATA"]:
                            total_rules_pending += 1
                        else:
                            total_rules_issues += 1
            else:
                total_rules_count += 1
                rag = (kres.rag_status or "").upper()
                if rag == "GREEN":
                    total_rules_met += 1
                elif rag in ["RED", "AMBER"]:
                    total_rules_not_met += 1
                elif kres.calculation_status == "NO_DATA":
                    total_rules_pending += 1
                else:
                    total_rules_issues += 1

        matrix_rows: List[Dict[str, Any]] = []
        grand_total_target = Decimal("0.00")
        grand_total_actual = Decimal("0.00")
        grand_kpi_count = 0
        grand_green = 0
        grand_amber = 0
        grand_red = 0

        # Sort circles alphabetically
        sorted_circle_ids = sorted(grouped_data.keys(), key=lambda cid: circle_meta[cid].name)

        for c_id in sorted_circle_ids:
            cir = circle_meta[c_id]
            domains_in_circle = grouped_data[c_id]
            sorted_domain_ids = sorted(
                domains_in_circle.keys(),
                key=lambda did: (domain_meta[did].display_order, domain_meta[did].name)
            )

            circle_target = Decimal("0.00")
            circle_actual = Decimal("0.00")
            circle_kpi_count = 0
            circle_green = 0
            circle_amber = 0
            circle_red = 0

            for d_id in sorted_domain_ids:
                dom = domain_meta[d_id]
                kpi_list = domains_in_circle[d_id]

                row_target = Decimal("0.00")
                row_actual = Decimal("0.00")
                row_green = 0
                row_amber = 0
                row_red = 0

                for kv in kpi_list:
                    if kv.target_value is not None:
                        row_target += Decimal(str(kv.target_value))
                    if kv.actual_value is not None:
                        row_actual += Decimal(str(kv.actual_value))

                    rag = (kv.rag_status or "").upper()
                    if rag == "GREEN":
                        row_green += 1
                    elif rag == "AMBER":
                        row_amber += 1
                    elif rag == "RED":
                        row_red += 1

                # Calculate achievement percentage safely
                if row_target > Decimal("0.00"):
                    row_ach = round((row_actual / row_target) * Decimal("100.00"), 1)
                else:
                    row_ach = Decimal("100.00") if row_actual > 0 else Decimal("0.00")

                # Determine overall row RAG status
                if row_red > 0:
                    row_status = "RED"
                elif row_amber > 0:
                    row_status = "AMBER"
                else:
                    row_status = "GREEN"

                matrix_rows.append({
                    "id": f"c{c_id}_d{d_id}",
                    "circle_id": c_id,
                    "circle_name": cir.name,
                    "circle_code": cir.code,
                    "circle_region": cir.region,
                    "domain_id": d_id,
                    "domain_name": dom.name,
                    "domain_code": dom.code,
                    "kpi_count": len(kpi_list),
                    "target": float(row_target),
                    "actual": float(row_actual),
                    "achievement_pct": float(row_ach),
                    "green_count": row_green,
                    "amber_count": row_amber,
                    "red_count": row_red,
                    "status": row_status,
                    "is_subtotal": False,
                    "is_grand_total": False,
                })

                circle_target += row_target
                circle_actual += row_actual
                circle_kpi_count += len(kpi_list)
                circle_green += row_green
                circle_amber += row_amber
                circle_red += row_red

            # Circle Subtotal Row
            if circle_target > Decimal("0.00"):
                cir_ach = round((circle_actual / circle_target) * Decimal("100.00"), 1)
            else:
                cir_ach = Decimal("100.00") if circle_actual > 0 else Decimal("0.00")

            cir_status = "RED" if circle_red > 0 else ("AMBER" if circle_amber > 0 else "GREEN")

            matrix_rows.append({
                "id": f"subtotal_c{c_id}",
                "circle_id": c_id,
                "circle_name": cir.name,
                "circle_code": cir.code,
                "circle_region": cir.region,
                "domain_id": None,
                "domain_name": f"{cir.name} Total",
                "domain_code": "TOTAL",
                "kpi_count": circle_kpi_count,
                "target": float(circle_target),
                "actual": float(circle_actual),
                "achievement_pct": float(cir_ach),
                "green_count": circle_green,
                "amber_count": circle_amber,
                "red_count": circle_red,
                "status": cir_status,
                "is_subtotal": True,
                "is_grand_total": False,
            })

            grand_total_target += circle_target
            grand_total_actual += circle_actual
            grand_kpi_count += circle_kpi_count
            grand_green += circle_green
            grand_amber += circle_amber
            grand_red += circle_red

        # Grand Total Row
        grand_ach = Decimal("0.00")
        if matrix_rows:
            if grand_total_target > Decimal("0.00"):
                grand_ach = round((grand_total_actual / grand_total_target) * Decimal("100.00"), 1)
            else:
                grand_ach = Decimal("100.00") if grand_total_actual > 0 else Decimal("0.00")

            grand_status = "RED" if grand_red > 0 else ("AMBER" if grand_amber > 0 else "GREEN")

            matrix_rows.append({
                "id": "grand_total",
                "circle_id": None,
                "circle_name": "All Circles",
                "circle_code": "ALL",
                "circle_region": "National",
                "domain_id": None,
                "domain_name": "Grand Total",
                "domain_code": "GRAND_TOTAL",
                "kpi_count": grand_kpi_count,
                "target": float(grand_total_target),
                "actual": float(grand_total_actual),
                "achievement_pct": float(grand_ach),
                "green_count": grand_green,
                "amber_count": grand_amber,
                "red_count": grand_red,
                "status": grand_status,
                "is_subtotal": False,
                "is_grand_total": True,
            })

        # Authoritative rule metrics (fallback to grand counts if no calculation results yet)
        effective_rules_count = total_rules_count if total_rules_count > 0 else grand_kpi_count
        effective_rules_met = total_rules_met if total_rules_count > 0 else grand_green
        effective_rules_not_met = total_rules_not_met if total_rules_count > 0 else (grand_amber + grand_red)
        effective_rules_pending = total_rules_pending if total_rules_count > 0 else 0
        effective_rules_issues = total_rules_issues if total_rules_count > 0 else 0

        return {
            "period": {
                "id": active_period.id if active_period else None,
                "name": active_period.name if active_period else "Current Cycle",
                "is_current": active_period.is_current if active_period else True,
            },
            "total_records": len(matrix_rows),
            "rows": matrix_rows,
            "metrics_summary": {
                "total_kpis": grand_kpi_count,
                "green_kpis": grand_green,
                "amber_kpis": grand_amber,
                "red_kpis": grand_red,
                "overall_achievement": float(grand_ach) if matrix_rows else 0.0,
                # Dynamic Multi-Rule & Lineage Executive Statistics
                "total_comparisons": effective_rules_count,
                "rules_met": effective_rules_met,
                "rules_not_met": effective_rules_not_met,
                "rules_pending_data": effective_rules_pending,
                "rules_config_issue": effective_rules_issues,
                "last_calculated_at": last_calc_dt.isoformat() if last_calc_dt else None,
                "has_data": grand_kpi_count > 0 or total_rules_count > 0,
            }
        }

    @classmethod
    def get_detail_breakdown(
        cls,
        circle_id: int,
        domain_id: Optional[int] = None,
        period_id: Optional[int] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        user=None,
    ) -> Dict[str, Any]:
        """
        Retrieves detailed KPI list and contextual observations & actions for selected master row.
        """
        # Validate authorization
        allowed_circles = get_user_circle_ids(user)
        if allowed_circles is not None and circle_id not in allowed_circles:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have authorization to view this circle.")

        cir = Circle.objects.filter(id=circle_id).first()
        dom = Domain.objects.filter(id=domain_id).first() if domain_id else None

        active_period = None
        if period_id:
            active_period = ReportingPeriod.objects.filter(id=period_id).first()
        if not active_period:
            active_period = ReportingPeriod.objects.filter(is_current=True).first() or ReportingPeriod.objects.first()

        # Query KPI values
        qs = get_scoped_kpi_values(
            user=user,
            circle_id=circle_id,
            domain_id=domain_id,
            period_id=active_period.id if active_period else None,
            status=status,
            search=search,
        )

        from apps.kpi.models import KPICalculationResult, KPIDefinition
        from apps.kpi.services.kpi_engine_service import KPIEngineService

        records: List[Dict[str, Any]] = []
        for kv in qs:
            target = float(kv.target_value) if kv.target_value is not None else None
            actual = float(kv.actual_value) if kv.actual_value is not None else None
            variance = float(kv.variance_percentage) if kv.variance_percentage is not None else None

            # Calculate achievement
            ach_pct = None
            if target and target > 0 and actual is not None:
                ach_pct = round((actual / target) * 100.0, 1)

            # Retrieve KPICalculationResult for multi-rule comparison breakdown
            kres = KPICalculationResult.objects.select_related("kpi", "reporting_period").filter(
                kpi__code=kv.kpi.code,
                hierarchy_level="CIRCLE",
                hierarchy_id=circle_id,
                reporting_period=active_period,
            ).first()

            comparisons_list: List[Dict[str, Any]] = []
            rules_list: List[Dict[str, Any]] = []

            if kres and kres.lineage_info:
                fb = kres.lineage_info.get("funnel_breakdown", {})
                raw_comparisons = fb.get("comparisons", [])
                for comp in raw_comparisons:
                    comp_rules = []
                    for r in comp.get("rules", []):
                        std_val = r.get("standard_value")
                        act_val = r.get("calculated_actual")
                        var_val = r.get("variance")
                        var_pct = r.get("variance_percentage")
                        r_dict = {
                            "rule_id": r.get("rule_id"),
                            "column_name": r.get("column_name") or r.get("source_column") or "Excel Column",
                            "standard_value": float(std_val) if std_val is not None else None,
                            "calculated_actual": float(act_val) if act_val is not None else None,
                            "performance_direction": r.get("performance_direction") or "HIGHER_BETTER",
                            "variance": float(var_val) if var_val is not None else None,
                            "variance_percentage": float(var_pct) if var_pct is not None else None,
                            "status": (r.get("status") or "PENDING_DATA").upper(),
                            "status_label": r.get("status_label") or r.get("status") or "Pending Data",
                        }
                        comp_rules.append(r_dict)
                        rules_list.append(r_dict)

                    comparisons_list.append({
                        "comparison_name": comp.get("name") or comp.get("comparison_name") or "Performance Comparison",
                        "overall_status": (comp.get("overall_status") or kres.rag_status or "MET").upper(),
                        "status_label": comp.get("status_label") or comp.get("overall_status") or "Target Met",
                        "rules": comp_rules,
                    })

            # If no stored comparisons, fallback to default rule from kv
            if not rules_list:
                single_rule = {
                    "rule_id": f"rule_kv_{kv.id}",
                    "column_name": kv.kpi.name,
                    "standard_value": target,
                    "calculated_actual": actual,
                    "performance_direction": kv.kpi.direction or "HIGHER_BETTER",
                    "variance": float(kv.variance_to_target) if kv.variance_to_target is not None else None,
                    "variance_percentage": variance,
                    "status": (kv.rag_status or "GREEN").upper(),
                    "status_label": "Meets Target" if (kv.rag_status or "").upper() == "GREEN" else "Action Required",
                }
                rules_list.append(single_rule)
                comparisons_list.append({
                    "comparison_name": kv.kpi.name,
                    "overall_status": (kv.rag_status or "GREEN").upper(),
                    "status_label": "Meets Target" if (kv.rag_status or "").upper() == "GREEN" else "Action Required",
                    "rules": [single_rule],
                })

            records.append({
                "id": kv.id,
                "result_id": kres.id if kres else None,
                "kpi_id": kv.kpi.id,
                "kpi_code": kv.kpi.code,
                "kpi_name": kv.kpi.name,
                "kpi_unit": kv.kpi.unit,
                "frequency": kv.kpi.frequency,
                "direction": kv.kpi.direction,
                "target": target,
                "actual": actual,
                "variance_pct": variance,
                "achievement_pct": ach_pct,
                "rag_status": (kv.rag_status or "GREEN").upper(),
                "trend": (kv.trend or "FLAT").upper(),
                "notes": kv.notes or "",
                "domain_name": kv.kpi.domain.name,
                "circle_name": kv.circle.name,
                "comparisons": comparisons_list,
                "rules": rules_list,
                "records_considered": kres.records_considered if kres else None,
                "calculated_at": kres.calculated_at.isoformat() if kres else (kv.updated_at.isoformat() if kv.updated_at else None),
                "calculation_status": kres.calculation_status if kres else "SUCCESS",
                "error_message": kres.error_message if kres else "",
                "source_dataset_name": kres.kpi.source_dataset.name if (kres and kres.kpi and kres.kpi.source_dataset) else None,
                "source_dataset_id": kres.kpi.source_dataset.id if (kres and kres.kpi and kres.kpi.source_dataset) else None,
            })

        # Fetch Linked Governance Observations / Issues
        issues_qs = GovernanceIssue.objects.filter(circle_id=circle_id)
        if domain_id:
            issues_qs = issues_qs.filter(domain_id=domain_id)

        observations: List[Dict[str, Any]] = []
        for iss in issues_qs[:10]:
            observations.append({
                "id": iss.id,
                "code": iss.issue_code,
                "title": iss.title,
                "description": iss.description,
                "severity": iss.severity,
                "status": iss.status,
                "rag_status": iss.rag_status,
                "root_cause": iss.root_cause,
                "corrective_action": iss.corrective_action,
                "owner": iss.owner_name,
                "target_date": str(iss.target_date) if iss.target_date else "",
                "is_repeat": iss.is_repeat,
            })

        # Fetch Linked Corrective Actions
        actions_qs = GovernanceActionItem.objects.filter(circle_id=circle_id)
        if domain_id:
            actions_qs = actions_qs.filter(domain_id=domain_id)

        actions: List[Dict[str, Any]] = []
        for act in actions_qs[:10]:
            actions.append({
                "id": act.id,
                "code": act.action_code,
                "owner": act.accountable_owner,
                "priority": act.priority,
                "status": act.status,
                "progress_pct": act.progress_percentage,
                "target_date": str(act.target_date) if act.target_date else "",
                "latest_update": act.latest_update,
                "rag": act.governance_rag,
                "ageing_days": act.ageing_days,
                "overdue_days": act.overdue_days,
            })

        # Context Header metadata
        context = {
            "circle_id": cir.id if cir else None,
            "circle_name": cir.name if cir else "Unknown Circle",
            "circle_code": cir.code if cir else "",
            "domain_id": dom.id if dom else None,
            "domain_name": dom.name if dom else "All Domains",
            "domain_code": dom.code if dom else "ALL",
            "period_id": active_period.id if active_period else None,
            "period_name": active_period.name if active_period else "",
        }

        return {
            "context": context,
            "total_records": len(records),
            "records": records,
            "observations": observations,
            "actions": actions,
        }

    @classmethod
    def get_record_detail(cls, kpi_value_id: int, user=None) -> Dict[str, Any]:
        """
        Deep level 3 record inspection with real uploaded staged Excel records and multi-rule comparisons.
        """
        try:
            kv = KPIValue.objects.select_related(
                "kpi", "circle", "period", "kpi__domain", "entered_by"
            ).get(id=kpi_value_id)
        except KPIValue.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("KPI record not found.")

        # Scoped authorization check
        allowed_circles = get_user_circle_ids(user)
        if allowed_circles is not None and kv.circle_id not in allowed_circles:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have authorization to view this record.")

        from apps.kpi.models import KPICalculationResult, KPIDefinition
        from apps.kpi.services.kpi_engine_service import KPIEngineService
        from apps.imports.models import ImportStagedRow

        # Linked calculation result
        kres = KPICalculationResult.objects.select_related("kpi", "reporting_period").filter(
            kpi__code=kv.kpi.code,
            hierarchy_level="CIRCLE",
            hierarchy_id=kv.circle_id,
            reporting_period=kv.period,
        ).first()

        comparisons_list: List[Dict[str, Any]] = []
        staged_rows_preview: List[Dict[str, Any]] = []
        dataset_columns: List[str] = []
        total_staged_count = 0

        if kres:
            lineage = kres.lineage_info or {}
            fb = lineage.get("funnel_breakdown", {})
            for comp in fb.get("comparisons", []):
                comp_rules = []
                for r in comp.get("rules", []):
                    comp_rules.append({
                        "rule_id": r.get("rule_id"),
                        "column_name": r.get("column_name") or r.get("source_column") or "Excel Column",
                        "standard_value": float(r["standard_value"]) if r.get("standard_value") is not None else None,
                        "calculated_actual": float(r["calculated_actual"]) if r.get("calculated_actual") is not None else None,
                        "performance_direction": r.get("performance_direction") or "HIGHER_BETTER",
                        "variance": float(r["variance"]) if r.get("variance") is not None else None,
                        "variance_percentage": float(r["variance_percentage"]) if r.get("variance_percentage") is not None else None,
                        "status": (r.get("status") or "PENDING_DATA").upper(),
                        "status_label": r.get("status_label") or r.get("status") or "Pending Data",
                    })
                comparisons_list.append({
                    "comparison_name": comp.get("name") or comp.get("comparison_name") or "Performance Comparison",
                    "overall_status": (comp.get("overall_status") or kres.rag_status or "MET").upper(),
                    "status_label": comp.get("status_label") or comp.get("overall_status") or "Target Met",
                    "rules": comp_rules,
                })

            # Retrieve real uploaded staged rows
            matched_ids = lineage.get("matched_row_ids", [])
            if matched_ids:
                staged_rows_qs = ImportStagedRow.objects.filter(id__in=matched_ids)
                total_staged_count = staged_rows_qs.count()
                for r in staged_rows_qs[:100]:
                    staged_rows_preview.append(r.raw_data)
            elif kres.kpi.source_dataset:
                refined = KPIEngineService.get_refined_records(
                    kpi=kres.kpi,
                    period=kv.period,
                    hierarchy_level="CIRCLE",
                    hierarchy_id=kv.circle_id,
                    page=1,
                    page_size=100,
                )
                staged_rows_preview = refined.get("records", [])
                dataset_columns = refined.get("columns", [])
                total_staged_count = refined.get("total_records", 0)

            if not dataset_columns and kres.kpi.source_dataset:
                v = kres.kpi.source_dataset.versions.filter(is_active=True).first() or kres.kpi.source_dataset.versions.order_by("-version_number").first()
                if v:
                    dataset_columns = list(v.columns.values_list("name", flat=True))

        if not dataset_columns and staged_rows_preview:
            dataset_columns = list(staged_rows_preview[0].keys())

        # Linked issues for this specific KPI
        linked_issues = list(
            GovernanceIssue.objects.filter(kpi_id=kv.kpi_id, circle_id=kv.circle_id).values(
                "id", "issue_code", "title", "severity", "status", "rag_status",
                "root_cause", "corrective_action", "owner_name", "target_date"
            )
        )

        # Linked actions for this specific KPI
        linked_actions = list(
            GovernanceActionItem.objects.filter(kpi_id=kv.kpi_id, circle_id=kv.circle_id).values(
                "id", "action_code", "accountable_owner", "priority", "status",
                "progress_percentage", "target_date", "latest_update", "governance_rag"
            )
        )

        target = float(kv.target_value) if kv.target_value is not None else None
        actual = float(kv.actual_value) if kv.actual_value is not None else None
        ach_pct = round((actual / target) * 100.0, 1) if (target and target > 0 and actual is not None) else None

        return {
            "id": kv.id,
            "result_id": kres.id if kres else None,
            "kpi": {
                "id": kv.kpi.id,
                "code": kv.kpi.code,
                "name": kv.kpi.name,
                "definition": kv.kpi.definition,
                "calculation_formula": kv.kpi.calculation_formula,
                "unit": kv.kpi.unit,
                "direction": kv.kpi.direction,
                "frequency": kv.kpi.frequency,
                "risk_category": kv.kpi.risk_category,
                "priority": kv.kpi.priority,
                "default_owner": kv.kpi.default_owner,
                "is_executive": kv.kpi.is_executive,
                "domain": {
                    "id": kv.kpi.domain.id,
                    "name": kv.kpi.domain.name,
                    "code": kv.kpi.domain.code,
                }
            },
            "hierarchy": {
                "circle_id": kv.circle.id,
                "circle_name": kv.circle.name,
                "circle_code": kv.circle.code,
                "circle_region": kv.circle.region,
            },
            "period": {
                "id": kv.period.id,
                "name": kv.period.name,
                "period_type": kv.period.period_type,
                "start_date": str(kv.period.start_date),
                "end_date": str(kv.period.end_date),
                "is_current": kv.period.is_current,
                "is_frozen": kv.period.is_frozen,
            },
            "performance": {
                "target": target,
                "actual": actual,
                "previous": float(kv.previous_value) if kv.previous_value is not None else None,
                "numerator": float(kv.numerator_value) if kv.numerator_value is not None else None,
                "denominator": float(kv.denominator_value) if kv.denominator_value is not None else None,
                "variance_to_target": float(kv.variance_to_target) if kv.variance_to_target is not None else None,
                "variance_pct": float(kv.variance_percentage) if kv.variance_percentage is not None else None,
                "achievement_pct": ach_pct,
                "rag_status": (kv.rag_status or "GREEN").upper(),
                "trend": (kv.trend or "FLAT").upper(),
                "notes": kv.notes or "",
            },
            "audit": {
                "entered_by": kv.entered_by.get_full_name() or kv.entered_by.username if kv.entered_by else "System Batch Pipeline",
                "created_at": kv.created_at.isoformat() if kv.created_at else None,
                "updated_at": kv.updated_at.isoformat() if kv.updated_at else None,
            },
            "comparisons": comparisons_list,
            "staged_records": staged_rows_preview,
            "staged_columns": dataset_columns,
            "total_staged_records": total_staged_count,
            "linked_issues": linked_issues,
            "linked_actions": linked_actions,
        }

    @classmethod
    def export_csv(
        cls,
        user=None,
        company_id: Optional[int] = None,
        sub_company_id: Optional[int] = None,
        project_id: Optional[int] = None,
        circle_id: Optional[int] = None,
        domain_id: Optional[int] = None,
        department_id: Optional[int] = None,
        period_id: Optional[int] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> str:
        """
        Exports filtered operational performance records to CSV string.
        """
        qs = get_scoped_kpi_values(
            user=user,
            company_id=company_id,
            sub_company_id=sub_company_id,
            project_id=project_id,
            circle_id=circle_id,
            domain_id=domain_id,
            department_id=department_id,
            period_id=period_id,
            status=status,
            search=search,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Circle",
            "Region",
            "Domain",
            "KPI Code",
            "KPI Name",
            "Unit",
            "Period",
            "Target",
            "Actual",
            "Variance %",
            "RAG Status",
            "Trend",
            "Notes"
        ])

        for kv in qs:
            writer.writerow([
                kv.circle.name,
                kv.circle.region,
                kv.kpi.domain.name,
                kv.kpi.code,
                kv.kpi.name,
                kv.kpi.unit,
                kv.period.name,
                kv.target_value if kv.target_value is not None else "",
                kv.actual_value if kv.actual_value is not None else "",
                kv.variance_percentage if kv.variance_percentage is not None else "",
                kv.rag_status,
                kv.trend,
                kv.notes or "",
            ])

        return output.getvalue()
