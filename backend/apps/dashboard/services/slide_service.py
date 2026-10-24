"""
Slide View Business Logic & Deck Presentation Service.
Transforms scoped, authorized operational data, KPIs, and governance actions
into structured executive presentation slides dynamically.
NO hardcoding of companies, circles, KPIs, or values.
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
from apps.organization.models import Circle, Domain, MainCompany, Project
from apps.dashboard.selectors.cockpit_selectors import (
    get_scoped_kpi_values,
    get_user_circle_ids,
)


class SlideService:
    @classmethod
    def get_slide_deck(
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
        Builds dynamic slide deck from authorized database records.
        Each slide represents a scoped operational governance unit (Circle + Domain).
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

        # Active period info
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
            "name": active_period.name if active_period else "Current Period",
            "is_frozen": active_period.is_frozen if active_period else False,
            "start_date": active_period.start_date.isoformat() if active_period and active_period.start_date else None,
            "end_date": active_period.end_date.isoformat() if active_period and active_period.end_date else None,
        }

        # Group operational KPI values by (Circle, Domain)
        # Key: (circle_id, domain_id)
        grouped_slides: Dict[tuple, List[KPIValue]] = {}
        circles_map: Dict[int, Circle] = {}
        domains_map: Dict[int, Domain] = {}

        for val in qs:
            c_id = val.circle_id
            d_id = val.kpi.domain_id

            circles_map[c_id] = val.circle
            domains_map[d_id] = val.kpi.domain

            group_key = (c_id, d_id)
            if group_key not in grouped_slides:
                grouped_slides[group_key] = []
            grouped_slides[group_key].append(val)

        # Fetch linked governance issues and action items for scoped circles
        scoped_circle_ids = list(circles_map.keys())
        issues_qs = GovernanceIssue.objects.filter(circle_id__in=scoped_circle_ids)
        actions_qs = GovernanceActionItem.objects.filter(circle_id__in=scoped_circle_ids)

        if status and status.upper() != "ALL":
            issues_qs = issues_qs.filter(rag_status=status.upper())
            actions_qs = actions_qs.filter(governance_rag=status.upper())

        issues_by_circle_domain: Dict[tuple, List[Dict[str, Any]]] = {}
        for issue in issues_qs:
            key = (issue.circle_id, issue.domain_id)
            if key not in issues_by_circle_domain:
                issues_by_circle_domain[key] = []
            issues_by_circle_domain[key].append({
                "id": issue.id,
                "issue_code": issue.issue_code,
                "title": issue.title,
                "description": issue.description,
                "severity": issue.severity,
                "status": issue.status,
                "rag_status": issue.rag_status,
                "root_cause": issue.root_cause,
                "corrective_action": issue.corrective_action,
                "owner_name": issue.owner_name,
                "target_date": issue.target_date.isoformat() if issue.target_date else None,
            })

        actions_by_circle_domain: Dict[tuple, List[Dict[str, Any]]] = {}
        for action in actions_qs:
            key = (action.circle_id, action.domain_id)
            if key not in actions_by_circle_domain:
                actions_by_circle_domain[key] = []
            actions_by_circle_domain[key].append({
                "id": action.id,
                "action_code": action.action_code,
                "management_direction": action.management_direction,
                "rca_issue": action.rca_issue,
                "expected_outcome": action.expected_outcome,
                "accountable_owner": action.accountable_owner,
                "target_date": action.target_date.isoformat() if action.target_date else None,
                "status": action.status,
                "progress_percentage": action.progress_percentage,
                "latest_update": action.latest_update,
                "governance_rag": action.governance_rag,
            })

        # Assemble slides in consistent hierarchical order
        # Circle -> Domain display order
        slides: List[Dict[str, Any]] = []

        sorted_keys = sorted(
            grouped_slides.keys(),
            key=lambda k: (
                circles_map[k[0]].name,
                domains_map[k[1]].display_order,
                domains_map[k[1]].name,
            ),
        )

        slide_number = 1
        total_kpis_count = 0
        total_green = 0
        total_amber = 0
        total_red = 0

        for c_id, d_id in sorted_keys:
            circle = circles_map[c_id]
            domain = domains_map[d_id]
            kpi_values = grouped_slides[(c_id, d_id)]

            # Contextual hierarchy chain
            project = circle.project
            sub_company = project.sub_company if project else None
            main_company = sub_company.main_company if sub_company else None

            hierarchy_context = {
                "main_company": main_company.name if main_company else None,
                "main_company_code": main_company.code if main_company else None,
                "sub_company": sub_company.name if sub_company else None,
                "project": project.name if project else None,
                "project_code": project.code if project else None,
                "circle": circle.name,
                "circle_code": circle.code,
                "region": circle.region,
                "circle_head": circle.head_name or "N/A",
                "domain": domain.name,
                "domain_code": domain.code,
            }

            # KPIs processing
            kpi_cards = []
            slide_target_sum = Decimal("0.00")
            slide_actual_sum = Decimal("0.00")
            slide_green = 0
            slide_amber = 0
            slide_red = 0

            for kv in sorted(kpi_values, key=lambda v: (v.kpi.display_order, v.kpi.code)):
                t_val = kv.target_value or Decimal("0.00")
                a_val = kv.actual_value or Decimal("0.00")
                slide_target_sum += t_val
                slide_actual_sum += a_val

                rag = (kv.rag_status or "GREEN").upper()
                if rag == "GREEN":
                    slide_green += 1
                    total_green += 1
                elif rag == "AMBER":
                    slide_amber += 1
                    total_amber += 1
                else:
                    slide_red += 1
                    total_red += 1

                total_kpis_count += 1

                # Achievement calculation
                if t_val > 0:
                    ach_pct = float(round((a_val / t_val) * Decimal("100.00"), 1))
                else:
                    ach_pct = 100.0 if a_val >= t_val else 0.0

                kpi_cards.append({
                    "id": kv.id,
                    "kpi_id": kv.kpi.id,
                    "code": kv.kpi.code,
                    "name": kv.kpi.name,
                    "definition": kv.kpi.definition,
                    "unit": kv.kpi.unit or "",
                    "direction": kv.kpi.direction,
                    "target_value": float(t_val),
                    "actual_value": float(a_val),
                    "variance": float(kv.variance_to_target) if kv.variance_to_target is not None else float(a_val - t_val),
                    "variance_percentage": float(kv.variance_percentage) if kv.variance_percentage is not None else None,
                    "achievement_percentage": ach_pct,
                    "rag_status": rag,
                    "trend": kv.trend or "FLAT",
                    "notes": kv.notes or "",
                    "is_executive": kv.kpi.is_executive,
                    "default_owner": kv.kpi.default_owner or "",
                })

            # Calculate slide overall health
            total_slide_kpis = len(kpi_cards)
            if slide_red > 0:
                slide_overall_rag = "RED"
            elif slide_amber > 0:
                slide_overall_rag = "AMBER"
            else:
                slide_overall_rag = "GREEN"

            slide_ach_pct = (
                float(round((slide_actual_sum / slide_target_sum) * Decimal("100.00"), 1))
                if slide_target_sum > 0
                else 100.0
            )

            # Linked issues & actions
            slide_issues = issues_by_circle_domain.get((c_id, d_id), [])
            slide_actions = actions_by_circle_domain.get((c_id, d_id), [])

            slides.append({
                "slide_id": f"slide-{c_id}-{d_id}",
                "slide_number": slide_number,
                "title": f"{circle.name} — {domain.name}",
                "subtitle": f"{hierarchy_context['project'] or 'Enterprise'} / {hierarchy_context['region']} Region",
                "hierarchy": hierarchy_context,
                "summary": {
                    "total_kpis": total_slide_kpis,
                    "green_count": slide_green,
                    "amber_count": slide_amber,
                    "red_count": slide_red,
                    "total_target": float(slide_target_sum),
                    "total_actual": float(slide_actual_sum),
                    "achievement_percentage": slide_ach_pct,
                    "overall_rag": slide_overall_rag,
                    "open_issues_count": len(slide_issues),
                    "open_actions_count": len(slide_actions),
                },
                "kpis": kpi_cards,
                "issues": slide_issues,
                "actions": slide_actions,
            })
            slide_number += 1

        overall_deck_rag = "GREEN"
        if total_red > 0:
            overall_deck_rag = "RED"
        elif total_amber > 0:
            overall_deck_rag = "AMBER"

        return {
            "period": period_info,
            "deck_summary": {
                "total_slides": len(slides),
                "total_kpis": total_kpis_count,
                "green_count": total_green,
                "amber_count": total_amber,
                "red_count": total_red,
                "overall_rag": overall_deck_rag,
            },
            "slides": slides,
        }
