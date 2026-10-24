"""
Slide Table Business Logic Service.
Provides:
1. get_master_table: Grouped enterprise operational matrix with required/target,
   available/actual, gap, achievement %, subtotal rows, and grand totals.
2. get_record_detail: Deep entity detail with complete organizational hierarchy,
   reporting period status, audit logs, entered_by metadata, RCA issues, and actions.
All values are strictly dynamic from live database records. NO HARDCODING.
"""

from typing import List, Dict, Any, Optional
from decimal import Decimal

from apps.dashboard.models import (
    KPI,
    KPIValue,
    ReportingPeriod,
    GovernanceIssue,
    GovernanceActionItem,
)
from apps.organization.models import Circle, Domain, HierarchyAuditLog
from apps.dashboard.selectors.cockpit_selectors import (
    get_scoped_kpi_values,
    get_user_circle_ids,
)


class SlideTableService:

    @classmethod
    def get_master_table(
        cls,
        user=None,
        company_id: Optional[int] = None,
        project_id: Optional[int] = None,
        circle_id: Optional[int] = None,
        domain_id: Optional[int] = None,
        department_id: Optional[int] = None,
        period_id: Optional[int] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Builds dynamic grouped operational master table from authorized database records.
        """
        qs = get_scoped_kpi_values(
            user=user,
            company_id=company_id,
            project_id=project_id,
            circle_id=circle_id,
            domain_id=domain_id,
            department_id=department_id,
            period_id=period_id,
            status=status,
            search=search,
        )

        active_period = None
        if period_id:
            active_period = ReportingPeriod.objects.filter(id=period_id).first()
        if not active_period:
            active_period = (
                ReportingPeriod.objects.filter(is_current=True).first()
                or ReportingPeriod.objects.first()
            )

        period_info = {
            "id": active_period.id if active_period else None,
            "name": active_period.name if active_period else "Current Cycle",
            "is_frozen": active_period.is_frozen if active_period else False,
            "start_date": active_period.start_date.isoformat() if active_period and active_period.start_date else None,
            "end_date": active_period.end_date.isoformat() if active_period and active_period.end_date else None,
        }

        # Group records by Circle
        grouped_by_circle: Dict[int, List[KPIValue]] = {}
        circles_map: Dict[int, Circle] = {}

        for val in qs:
            c_id = val.circle_id
            circles_map[c_id] = val.circle
            if c_id not in grouped_by_circle:
                grouped_by_circle[c_id] = []
            grouped_by_circle[c_id].append(val)

        sorted_circle_ids = sorted(grouped_by_circle.keys(), key=lambda cid: circles_map[cid].name)

        table_rows: List[Dict[str, Any]] = []
        grand_total_required = Decimal("0.00")
        grand_total_available = Decimal("0.00")
        grand_total_gap = Decimal("0.00")
        grand_record_count = 0
        grand_green = 0
        grand_amber = 0
        grand_red = 0

        for c_id in sorted_circle_ids:
            circle = circles_map[c_id]
            records = grouped_by_circle[c_id]

            # Circle subtotal accumulators
            subtotal_required = Decimal("0.00")
            subtotal_available = Decimal("0.00")
            subtotal_gap = Decimal("0.00")
            subtotal_green = 0
            subtotal_amber = 0
            subtotal_red = 0

            # Sort records within circle by domain display order and code
            sorted_records = sorted(
                records,
                key=lambda r: (r.kpi.domain.display_order, r.kpi.domain.name, r.kpi.display_order, r.kpi.code)
            )

            for rec in sorted_records:
                req_val = rec.target_value or Decimal("0.00")
                avail_val = rec.actual_value or Decimal("0.00")
                gap_val = req_val - avail_val

                subtotal_required += req_val
                subtotal_available += avail_val
                subtotal_gap += gap_val

                grand_total_required += req_val
                grand_total_available += avail_val
                grand_total_gap += gap_val
                grand_record_count += 1

                rag = (rec.rag_status or "GREEN").upper()
                if rag == "GREEN":
                    subtotal_green += 1
                    grand_green += 1
                elif rag == "AMBER":
                    subtotal_amber += 1
                    grand_amber += 1
                else:
                    subtotal_red += 1
                    grand_red += 1

                if req_val > 0:
                    ach_pct = float(round((avail_val / req_val) * Decimal("100.00"), 1))
                else:
                    ach_pct = 100.0 if avail_val >= req_val else 0.0

                table_rows.append({
                    "id": rec.id,
                    "row_type": "data",
                    "circle_id": circle.id,
                    "circle_name": circle.name,
                    "circle_code": circle.code,
                    "region": circle.region,
                    "domain_id": rec.kpi.domain.id,
                    "domain_name": rec.kpi.domain.name,
                    "domain_code": rec.kpi.domain.code,
                    "resource_code": rec.kpi.code,
                    "resource_name": rec.kpi.name,
                    "required": float(req_val),
                    "available": float(avail_val),
                    "gap": float(gap_val),
                    "achievement_percentage": ach_pct,
                    "rag_status": rag,
                    "trend": rec.trend or "FLAT",
                    "unit": rec.kpi.unit or "",
                    "default_owner": rec.kpi.default_owner or "",
                    "is_executive": rec.kpi.is_executive,
                    "is_clickable": True,
                })

            # Subtotal Row for Circle
            sub_ach_pct = (
                float(round((subtotal_available / subtotal_required) * Decimal("100.00"), 1))
                if subtotal_required > 0
                else 100.0
            )
            sub_rag = "RED" if subtotal_red > 0 else ("AMBER" if subtotal_amber > 0 else "GREEN")

            table_rows.append({
                "id": f"subtotal-{circle.id}",
                "row_type": "subtotal",
                "circle_id": circle.id,
                "circle_name": f"Total {circle.name}",
                "circle_code": circle.code,
                "region": circle.region,
                "domain_name": f"{len(records)} Operational Records",
                "resource_name": f"Subtotal ({circle.name})",
                "required": float(subtotal_required),
                "available": float(subtotal_available),
                "gap": float(subtotal_gap),
                "achievement_percentage": sub_ach_pct,
                "rag_status": sub_rag,
                "green_count": subtotal_green,
                "amber_count": subtotal_amber,
                "red_count": subtotal_red,
                "record_count": len(records),
                "is_clickable": False,
            })

        # Grand Total Row
        grand_ach_pct = (
            float(round((grand_total_available / grand_total_required) * Decimal("100.00"), 1))
            if grand_total_required > 0
            else 100.0
        )
        grand_rag = "RED" if grand_red > 0 else ("AMBER" if grand_amber > 0 else "GREEN")

        grand_total_row = {
            "id": "grand-total",
            "row_type": "grand_total",
            "circle_name": "GRAND TOTAL OPERATIONAL RESOURCES",
            "required": float(grand_total_required),
            "available": float(grand_total_available),
            "gap": float(grand_total_gap),
            "achievement_percentage": grand_ach_pct,
            "rag_status": grand_rag,
            "green_count": grand_green,
            "amber_count": grand_amber,
            "red_count": grand_red,
            "record_count": grand_record_count,
            "is_clickable": False,
        }

        return {
            "period": period_info,
            "summary": {
                "total_circles": len(sorted_circle_ids),
                "total_records": grand_record_count,
                "total_required": float(grand_total_required),
                "total_available": float(grand_total_available),
                "total_gap": float(grand_total_gap),
                "achievement_percentage": grand_ach_pct,
                "overall_rag": grand_rag,
                "green_count": grand_green,
                "amber_count": grand_amber,
                "red_count": grand_red,
            },
            "rows": table_rows,
            "grand_total": grand_total_row,
        }

    @classmethod
    def get_record_detail(cls, record_id: int, user=None) -> Optional[Dict[str, Any]]:
        """
        Retrieves complete context, hierarchy, metrics, audit trail,
        and governance actions for a selected operational record.
        Enforces user circle scope authorization.
        """
        record = (
            KPIValue.objects.select_related(
                "kpi",
                "kpi__domain",
                "circle",
                "circle__project",
                "circle__project__sub_company",
                "circle__project__sub_company__main_company",
                "period",
                "entered_by",
            )
            .filter(id=record_id)
            .first()
        )

        if not record:
            return None

        # Verify scoped authorization
        allowed_circles = get_user_circle_ids(user)
        if allowed_circles is not None and record.circle_id not in allowed_circles:
            return None

        circle = record.circle
        project = circle.project
        sub_company = project.sub_company if project else None
        main_company = sub_company.main_company if sub_company else None
        domain = record.kpi.domain
        kpi = record.kpi
        period = record.period

        req = record.target_value or Decimal("0.00")
        avail = record.actual_value or Decimal("0.00")
        gap = req - avail
        ach_pct = float(round((avail / req) * Decimal("100.00"), 1)) if req > 0 else (100.0 if avail >= req else 0.0)

        # Tier 6 & 7: Department and Team / SubDepartment
        dept_obj = domain.departments.filter(is_active=True).first() if domain else None
        team_obj = dept_obj.sub_departments.filter(is_active=True).first() if dept_obj else None

        # Hierarchy Context
        hierarchy_context = {
            "main_company": main_company.name if main_company else None,
            "main_company_code": main_company.code if main_company else None,
            "sub_company": sub_company.name if sub_company else None,
            "sub_company_code": sub_company.code if sub_company else None,
            "project": project.name if project else None,
            "project_code": project.code if project else None,
            "circle": circle.name,
            "circle_code": circle.code,
            "region": circle.region,
            "circle_head": circle.head_name or "N/A",
            "circle_head_email": circle.head_email or "N/A",
            "domain": domain.name,
            "domain_code": domain.code,
            "department": dept_obj.name if dept_obj else None,
            "department_code": dept_obj.code if dept_obj else None,
            "team": team_obj.name if team_obj else None,
            "team_code": team_obj.code if team_obj else None,
        }

        # Operational Metrics
        metrics = {
            "required": float(req),
            "available": float(avail),
            "gap": float(gap),
            "achievement_percentage": ach_pct,
            "rag_status": (record.rag_status or "GREEN").upper(),
            "trend": record.trend or "FLAT",
            "variance": float(record.variance_to_target) if record.variance_to_target is not None else float(avail - req),
            "variance_percentage": float(record.variance_percentage) if record.variance_percentage is not None else None,
            "unit": kpi.unit or "",
            "direction": kpi.direction,
            "notes": record.notes or "",
        }

        # Source / Cycle info
        source_info = {
            "period_id": period.id if period else None,
            "period_name": period.name if period else "Current Period",
            "is_frozen": period.is_frozen if period else False,
            "is_current": period.is_current if period else False,
            "start_date": period.start_date.isoformat() if period and period.start_date else None,
            "end_date": period.end_date.isoformat() if period and period.end_date else None,
            "created_at": record.created_at.isoformat() if record.created_at else None,
            "updated_at": record.updated_at.isoformat() if record.updated_at else None,
            "entered_by": {
                "id": record.entered_by.id if record.entered_by else None,
                "name": f"{record.entered_by.first_name} {record.entered_by.last_name}".strip() or record.entered_by.username if record.entered_by else "System Ingestion Pipeline",
                "email": record.entered_by.email if record.entered_by else "",
            },
        }

        # Audit Logs from HierarchyAuditLog for this Circle
        audit_qs = HierarchyAuditLog.objects.filter(
            object_id=str(circle.id)
        ).select_related("user").order_by("-timestamp")[:10]

        audit_history = []
        for log in audit_qs:
            audit_history.append({
                "id": log.id,
                "action": log.action,
                "level": log.level,
                "object_repr": log.object_repr,
                "details": log.details,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "user": log.user.username if log.user else "System",
            })

        # Linked Governance Issues / Root Causes for this Circle + Domain
        try:
            issues_qs = GovernanceIssue.objects.filter(
                circle_id=circle.id,
                domain_id=domain.id,
            ).order_by("-created_at")[:5]

            issues = [
                {
                    "id": iss.id,
                    "issue_code": iss.issue_code,
                    "title": iss.title,
                    "description": iss.description,
                    "severity": iss.severity,
                    "status": iss.status,
                    "rag_status": iss.rag_status,
                    "root_cause": iss.root_cause,
                    "corrective_action": iss.corrective_action,
                    "owner_name": iss.owner_name,
                    "target_date": iss.target_date.isoformat() if iss.target_date else None,
                }
                for iss in issues_qs
            ]
        except Exception:
            issues = []

        # Linked Corrective Actions
        try:
            actions_qs = GovernanceActionItem.objects.filter(
                circle_id=circle.id,
                domain_id=domain.id,
            ).order_by("-created_at")[:5]

            actions = [
                {
                    "id": act.id,
                    "action_code": act.action_code,
                    "management_direction": act.management_direction,
                    "rca_issue": act.rca_issue,
                    "expected_outcome": act.expected_outcome,
                    "accountable_owner": act.accountable_owner,
                    "target_date": act.target_date.isoformat() if act.target_date else None,
                    "status": act.status,
                    "progress_percentage": act.progress_percentage,
                    "latest_update": act.latest_update,
                    "governance_rag": act.governance_rag,
                }
                for act in actions_qs
            ]
        except Exception:
            actions = []

        # Related Records in Same Circle
        related_qs = KPIValue.objects.filter(
            circle_id=circle.id,
            period_id=record.period_id,
        ).exclude(id=record.id).select_related("kpi")[:5]

        related_records = [
            {
                "id": rel.id,
                "code": rel.kpi.code,
                "name": rel.kpi.name,
                "target": float(rel.target_value or 0),
                "actual": float(rel.actual_value or 0),
                "rag_status": (rel.rag_status or "GREEN").upper(),
            }
            for rel in related_qs
        ]

        # Upload Batch Provenance (if imported via Uploads pipeline)
        upload_provenance = None
        if record.notes and "Uploads Batch" in record.notes:
            import re
            batch_match = re.search(r"Uploads Batch ([a-zA-Z0-9_-]+)", record.notes)
            if batch_match:
                batch_id_str = batch_match.group(1)
                try:
                    from apps.imports.models import ImportBatch
                    batch = (
                        ImportBatch.objects.filter(batch_id=batch_id_str)
                        .select_related("template", "template_version", "uploaded_by")
                        .first()
                    )
                    if batch:
                        upload_provenance = {
                            "batch_id": batch.batch_id,
                            "template_name": batch.template.name if batch.template else "Standard Template",
                            "template_code": batch.template.code if batch.template else "",
                            "version": batch.template_version.version_number if batch.template_version else 1,
                            "original_filename": batch.original_filename,
                            "uploaded_by": batch.uploaded_by.username if batch.uploaded_by else "System",
                            "uploaded_at": batch.uploaded_at.isoformat() if batch.uploaded_at else None,
                            "status": batch.status,
                            "total_rows": batch.total_rows,
                            "imported_rows": batch.imported_rows,
                        }
                except Exception:
                    upload_provenance = None

        from apps.kpi.models import KPICalculationResult, KPIDefinition
        from apps.kpi.services.kpi_engine_service import KPIEngineService
        from apps.imports.models import ImportStagedRow

        # Fetch matching calculation result for multi-rule breakdown & staged rows
        kres = KPICalculationResult.objects.select_related("kpi", "reporting_period").filter(
            kpi__code=kpi.code,
            hierarchy_level="CIRCLE",
            hierarchy_id=circle.id,
            reporting_period=period,
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

            matched_ids = lineage.get("matched_row_ids", [])
            if matched_ids:
                staged_rows_qs = ImportStagedRow.objects.filter(id__in=matched_ids)
                total_staged_count = staged_rows_qs.count()
                for r in staged_rows_qs[:100]:
                    staged_rows_preview.append(r.raw_data)
            elif kres.kpi.source_dataset:
                refined = KPIEngineService.get_refined_records(
                    kpi=kres.kpi,
                    period=period,
                    hierarchy_level="CIRCLE",
                    hierarchy_id=circle.id,
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

        return {
            "record_id": record.id,
            "resource": {
                "id": kpi.id,
                "code": kpi.code,
                "name": kpi.name,
                "definition": kpi.definition,
                "calculation_formula": kpi.calculation_formula,
                "unit": kpi.unit or "",
                "direction": kpi.direction,
                "frequency": kpi.frequency,
                "priority": kpi.priority,
                "default_owner": kpi.default_owner or "",
                "is_executive": kpi.is_executive,
            },
            "hierarchy": hierarchy_context,
            "metrics": metrics,
            "source": source_info,
            "audit_history": audit_history,
            "issues": issues,
            "actions": actions,
            "related_records": related_records,
            "upload_provenance": upload_provenance,
            "comparisons": comparisons_list,
            "staged_records": staged_rows_preview,
            "staged_columns": dataset_columns,
            "total_staged_records": total_staged_count,
        }
