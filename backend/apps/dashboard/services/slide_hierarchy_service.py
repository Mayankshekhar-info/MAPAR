"""
Slide Hierarchy Service.
Powers the 8-tier hierarchical drill-down for Slide View:
Main Company -> Sub Company -> Project -> Circle -> Domain -> Department -> Team -> Users/Records.

Strictly dynamic, database-backed, zero hardcoding.
Enforces downward access scope boundaries at every level.
"""

from typing import Dict, Any, List, Optional
from decimal import Decimal
from django.db.models import Q, Count
from rest_framework.exceptions import PermissionDenied, NotFound

from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Domain,
    Department,
    SubDepartment,
)
from apps.identity.models import User
from apps.dashboard.models import (
    KPI,
    KPIValue,
    ReportingPeriod,
)
from apps.imports.models import ImportBatch
from apps.dashboard.selectors.cockpit_selectors import get_scoped_kpi_values
from common.permissions.authorization import AuthorizationService


class SlideHierarchyService:

    @classmethod
    def _resolve_period(
        cls, period_id: Optional[int] = None
    ) -> tuple[Optional[ReportingPeriod], List[Dict[str, Any]], Dict[str, Any]]:
        all_periods = list(
            ReportingPeriod.objects.all().values("id", "name", "period_type", "is_current", "is_frozen", "start_date").order_by("-start_date")
        )
        active_period = None
        if period_id:
            active_period = ReportingPeriod.objects.filter(id=period_id).first()
        if not active_period:
            active_period = ReportingPeriod.objects.filter(is_current=True).first() or ReportingPeriod.objects.first()

        period_data = {
            "id": active_period.id if active_period else None,
            "name": active_period.name if active_period else "Current Reporting Cycle",
            "is_frozen": active_period.is_frozen if active_period else False,
            "start_date": active_period.start_date.isoformat() if active_period and active_period.start_date else None,
            "end_date": active_period.end_date.isoformat() if active_period and active_period.end_date else None,
        } if active_period else {
            "id": None,
            "name": "Current Cycle",
            "is_frozen": False,
            "start_date": None,
            "end_date": None,
        }

        return active_period, all_periods, period_data

    @classmethod
    def get_root_level_data(cls, user, period_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Level 1: Returns all authorized Main Companies for the user.
        Includes direct child counts, operational records, and KPI RAG summary.
        """
        active_period, all_periods, period_data = cls._resolve_period(period_id)
        scope = AuthorizationService.get_user_hierarchy_scope(user)

        mc_qs = MainCompany.objects.filter(status="ACTIVE")
        if not scope.is_unrestricted:
            allowed_mc = (scope.main_company_ids or set()) | scope.ancestor_main_company_ids
            mc_qs = mc_qs.filter(id__in=allowed_mc)

        nodes: List[Dict[str, Any]] = []
        total_records_all = 0
        green_all = 0
        amber_all = 0
        red_all = 0

        for mc in mc_qs.order_by("name"):
            # Child sub-companies count
            sub_qs = mc.sub_companies.filter(status="ACTIVE")
            if not scope.is_unrestricted:
                allowed_sc = (scope.sub_company_ids or set()) | scope.ancestor_sub_company_ids
                sub_qs = sub_qs.filter(id__in=allowed_sc)
            child_count = sub_qs.count()

            # KPI operational values under this main company
            kpi_qs = get_scoped_kpi_values(
                user=user,
                company_id=mc.id,
                period_id=active_period.id if active_period else None,
            )
            rec_count = kpi_qs.count()
            green_count = kpi_qs.filter(rag_status="GREEN").count()
            amber_count = kpi_qs.filter(rag_status="AMBER").count()
            red_count = kpi_qs.filter(rag_status="RED").count()

            total_records_all += rec_count
            green_all += green_count
            amber_all += amber_count
            red_all += red_count

            nodes.append({
                "id": mc.id,
                "name": mc.name,
                "code": mc.code,
                "status": mc.status,
                "description": mc.description,
                "level": "MAIN_COMPANY",
                "child_level": "SUB_COMPANY",
                "child_count": child_count,
                "record_count": rec_count,
                "kpi_summary": {
                    "total": rec_count,
                    "green": green_count,
                    "amber": amber_count,
                    "red": red_count,
                },
            })

        return {
            "level": "MAIN_COMPANY",
            "level_name": "Main Company",
            "nodes": nodes,
            "summary": {
                "total_companies": len(nodes),
                "total_records": total_records_all,
                "green_count": green_all,
                "amber_count": amber_all,
                "red_count": red_all,
            },
            "period": period_data,
            "periods": all_periods,
        }

    @classmethod
    def get_node_level_data(
        cls,
        level: str,
        node_id: int,
        user,
        period_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Levels 2-8: Dynamic drill-down data for a single node.
        Returns node details, full ancestor breadcrumbs, direct children,
        relevant operational data (KPIValues), and uploaded batches.
        """
        norm_level = level.upper().replace("-", "_")
        if norm_level == "TEAM":
            norm_level = "SUB_DEPARTMENT"

        active_period, all_periods, period_data = cls._resolve_period(period_id)
        scope = AuthorizationService.get_user_hierarchy_scope(user)

        # Enforce server-side scoped authorization
        if not scope.is_unrestricted:
            if norm_level == "MAIN_COMPANY":
                allowed = (scope.main_company_ids or set()) | scope.ancestor_main_company_ids
                if node_id not in allowed:
                    raise PermissionDenied("Access denied: Main Company is outside your authorized scope.")
            elif norm_level == "SUB_COMPANY":
                allowed = (scope.sub_company_ids or set()) | scope.ancestor_sub_company_ids
                if node_id not in allowed:
                    raise PermissionDenied("Access denied: Sub Company is outside your authorized scope.")
            elif norm_level == "PROJECT":
                allowed = (scope.project_ids or set()) | scope.ancestor_project_ids
                if node_id not in allowed:
                    raise PermissionDenied("Access denied: Project is outside your authorized scope.")
            elif norm_level == "CIRCLE" and not scope.is_circle_allowed(node_id):
                raise PermissionDenied("Access denied: Circle is outside your authorized scope.")
            elif norm_level == "DOMAIN" and not scope.is_domain_allowed(node_id):
                raise PermissionDenied("Access denied: Domain is outside your authorized scope.")
            elif norm_level == "DEPARTMENT" and not scope.is_department_allowed(node_id):
                raise PermissionDenied("Access denied: Department is outside your authorized scope.")
            elif norm_level == "SUB_DEPARTMENT" and not scope.is_team_allowed(node_id):
                raise PermissionDenied("Access denied: Team is outside your authorized scope.")
            elif norm_level == "USER" and not scope.is_user_allowed(node_id):
                raise PermissionDenied("Access denied: User is outside your authorized scope.")

        # Resolve entity object and full ancestor breadcrumbs
        breadcrumbs: List[Dict[str, Any]] = [
            {"level": "ROOT", "id": 0, "name": "Slide View", "code": "SLIDES"}
        ]
        node_dict: Dict[str, Any] = {}
        children: List[Dict[str, Any]] = []
        child_level_name = ""

        # Filter parameters for operational KPI values
        filter_kwargs: Dict[str, Any] = {
            "user": user,
            "period_id": active_period.id if active_period else None,
        }
        associated_circle_ids: List[int] = []

        if norm_level == "MAIN_COMPANY":
            try:
                mc = MainCompany.objects.get(id=node_id)
            except MainCompany.DoesNotExist:
                raise NotFound("Main Company not found.")

            node_dict = {
                "id": mc.id,
                "name": mc.name,
                "code": mc.code,
                "description": mc.description,
                "status": mc.status,
                "level": "MAIN_COMPANY",
                "badge": "Main Company",
                "badge_color": "purple",
            }
            breadcrumbs.append({"level": "MAIN_COMPANY", "id": mc.id, "name": mc.name, "code": mc.code})

            filter_kwargs["company_id"] = mc.id
            associated_circle_ids = list(
                Circle.objects.filter(project__sub_company__main_company=mc).values_list("id", flat=True)
            )

            # Direct children: Sub Companies
            sub_qs = mc.sub_companies.filter(status="ACTIVE")
            if not scope.is_unrestricted:
                allowed_sc = (scope.sub_company_ids or set()) | scope.ancestor_sub_company_ids
                sub_qs = sub_qs.filter(id__in=allowed_sc)
            child_level_name = "SUB_COMPANY"

            for sc in sub_qs.order_by("name"):
                prjs = sc.projects.filter(status="ACTIVE")
                if not scope.is_unrestricted:
                    allowed_prj = (scope.project_ids or set()) | scope.ancestor_project_ids
                    prjs = prjs.filter(id__in=allowed_prj)
                sub_kpis = get_scoped_kpi_values(user=user, sub_company_id=sc.id, period_id=active_period.id if active_period else None)
                tot = sub_kpis.count()
                children.append({
                    "id": sc.id,
                    "name": sc.name,
                    "code": sc.code,
                    "status": sc.status,
                    "level": "SUB_COMPANY",
                    "child_count": prjs.count(),
                    "record_count": tot,
                    "kpi_summary": {
                        "total": tot,
                        "green": sub_kpis.filter(rag_status="GREEN").count(),
                        "amber": sub_kpis.filter(rag_status="AMBER").count(),
                        "red": sub_kpis.filter(rag_status="RED").count(),
                    },
                })

        elif norm_level == "SUB_COMPANY":
            try:
                sc = SubCompany.objects.select_related("main_company").get(id=node_id)
            except SubCompany.DoesNotExist:
                raise NotFound("Sub Company not found.")

            mc = sc.main_company
            node_dict = {
                "id": sc.id,
                "name": sc.name,
                "code": sc.code,
                "description": sc.description,
                "status": sc.status,
                "level": "SUB_COMPANY",
                "badge": "Sub Company",
                "badge_color": "indigo",
            }
            breadcrumbs.append({"level": "MAIN_COMPANY", "id": mc.id, "name": mc.name, "code": mc.code})
            breadcrumbs.append({"level": "SUB_COMPANY", "id": sc.id, "name": sc.name, "code": sc.code})

            filter_kwargs["sub_company_id"] = sc.id
            associated_circle_ids = list(
                Circle.objects.filter(project__sub_company=sc).values_list("id", flat=True)
            )

            # Direct children: Projects
            prj_qs = sc.projects.filter(status="ACTIVE")
            if not scope.is_unrestricted:
                allowed_prj = (scope.project_ids or set()) | scope.ancestor_project_ids
                prj_qs = prj_qs.filter(id__in=allowed_prj)
            child_level_name = "PROJECT"

            for prj in prj_qs.order_by("name"):
                circles = prj.circles.filter(is_active=True)
                if not scope.is_unrestricted:
                    circles = scope.filter_circles(circles)
                prj_kpis = get_scoped_kpi_values(user=user, project_id=prj.id, period_id=active_period.id if active_period else None)
                tot = prj_kpis.count()
                children.append({
                    "id": prj.id,
                    "name": prj.name,
                    "code": prj.code,
                    "status": prj.status,
                    "level": "PROJECT",
                    "child_count": circles.count(),
                    "record_count": tot,
                    "kpi_summary": {
                        "total": tot,
                        "green": prj_kpis.filter(rag_status="GREEN").count(),
                        "amber": prj_kpis.filter(rag_status="AMBER").count(),
                        "red": prj_kpis.filter(rag_status="RED").count(),
                    },
                })

        elif norm_level == "PROJECT":
            try:
                prj = Project.objects.select_related("sub_company__main_company").get(id=node_id)
            except Project.DoesNotExist:
                raise NotFound("Project not found.")

            sc = prj.sub_company
            mc = sc.main_company
            node_dict = {
                "id": prj.id,
                "name": prj.name,
                "code": prj.code,
                "description": prj.description,
                "status": prj.status,
                "level": "PROJECT",
                "badge": "Project",
                "badge_color": "blue",
            }
            breadcrumbs.append({"level": "MAIN_COMPANY", "id": mc.id, "name": mc.name, "code": mc.code})
            breadcrumbs.append({"level": "SUB_COMPANY", "id": sc.id, "name": sc.name, "code": sc.code})
            breadcrumbs.append({"level": "PROJECT", "id": prj.id, "name": prj.name, "code": prj.code})

            filter_kwargs["project_id"] = prj.id
            associated_circle_ids = list(prj.circles.values_list("id", flat=True))

            # Direct children: Circles
            cir_qs = prj.circles.filter(is_active=True)
            if not scope.is_unrestricted:
                cir_qs = scope.filter_circles(cir_qs)
            child_level_name = "CIRCLE"

            for cir in cir_qs.order_by("name"):
                doms = cir.domains.filter(is_active=True)
                if not scope.is_unrestricted:
                    doms = scope.filter_domains(doms)
                cir_kpis = get_scoped_kpi_values(user=user, circle_id=cir.id, period_id=active_period.id if active_period else None)
                tot = cir_kpis.count()
                children.append({
                    "id": cir.id,
                    "name": cir.name,
                    "code": cir.code,
                    "status": cir.status,
                    "level": "CIRCLE",
                    "child_count": doms.count(),
                    "record_count": tot,
                    "kpi_summary": {
                        "total": tot,
                        "green": cir_kpis.filter(rag_status="GREEN").count(),
                        "amber": cir_kpis.filter(rag_status="AMBER").count(),
                        "red": cir_kpis.filter(rag_status="RED").count(),
                    },
                })

        elif norm_level == "CIRCLE":
            try:
                cir = Circle.objects.select_related("project__sub_company__main_company").get(id=node_id)
            except Circle.DoesNotExist:
                raise NotFound("Circle not found.")

            prj = cir.project
            sc = prj.sub_company if prj else None
            mc = sc.main_company if sc else None

            node_dict = {
                "id": cir.id,
                "name": cir.name,
                "code": cir.code,
                "description": f"Region: {cir.region} | Lead: {cir.head_name or 'N/A'}",
                "status": cir.status,
                "level": "CIRCLE",
                "badge": "Circle",
                "badge_color": "cyan",
            }
            if mc:
                breadcrumbs.append({"level": "MAIN_COMPANY", "id": mc.id, "name": mc.name, "code": mc.code})
            if sc:
                breadcrumbs.append({"level": "SUB_COMPANY", "id": sc.id, "name": sc.name, "code": sc.code})
            if prj:
                breadcrumbs.append({"level": "PROJECT", "id": prj.id, "name": prj.name, "code": prj.code})
            breadcrumbs.append({"level": "CIRCLE", "id": cir.id, "name": cir.name, "code": cir.code})

            filter_kwargs["circle_id"] = cir.id
            associated_circle_ids = [cir.id]

            # Direct children: Domains
            if cir.domains.filter(is_active=True).exists():
                dom_qs = cir.domains.filter(is_active=True)
            else:
                dom_qs = Domain.objects.filter(
                    Q(circle_id=cir.id) | Q(circle_id__isnull=True),
                    is_active=True
                )
            if not scope.is_unrestricted:
                dom_qs = scope.filter_domains(dom_qs)
            child_level_name = "DOMAIN"

            for dom in dom_qs.order_by("display_order", "name"):
                depts = dom.departments.filter(status="ACTIVE")
                if not scope.is_unrestricted:
                    depts = scope.filter_departments(depts)
                dom_kpis = get_scoped_kpi_values(user=user, circle_id=cir.id, domain_id=dom.id, period_id=active_period.id if active_period else None)
                tot = dom_kpis.count()
                children.append({
                    "id": dom.id,
                    "name": dom.name,
                    "code": dom.code,
                    "status": dom.status,
                    "level": "DOMAIN",
                    "child_count": depts.count(),
                    "record_count": tot,
                    "kpi_summary": {
                        "total": tot,
                        "green": dom_kpis.filter(rag_status="GREEN").count(),
                        "amber": dom_kpis.filter(rag_status="AMBER").count(),
                        "red": dom_kpis.filter(rag_status="RED").count(),
                    },
                })

        elif norm_level == "DOMAIN":
            try:
                dom = Domain.objects.select_related("circle__project__sub_company__main_company").get(id=node_id)
            except Domain.DoesNotExist:
                raise NotFound("Domain not found.")

            cir = dom.circle
            prj = cir.project if cir else None
            sc = prj.sub_company if prj else None
            mc = sc.main_company if sc else None

            node_dict = {
                "id": dom.id,
                "name": dom.name,
                "code": dom.code,
                "description": dom.description,
                "status": dom.status,
                "level": "DOMAIN",
                "badge": "Domain",
                "badge_color": "emerald",
            }
            if mc:
                breadcrumbs.append({"level": "MAIN_COMPANY", "id": mc.id, "name": mc.name, "code": mc.code})
            if sc:
                breadcrumbs.append({"level": "SUB_COMPANY", "id": sc.id, "name": sc.name, "code": sc.code})
            if prj:
                breadcrumbs.append({"level": "PROJECT", "id": prj.id, "name": prj.name, "code": prj.code})
            if cir:
                breadcrumbs.append({"level": "CIRCLE", "id": cir.id, "name": cir.name, "code": cir.code})
                associated_circle_ids = [cir.id]
                filter_kwargs["circle_id"] = cir.id
            breadcrumbs.append({"level": "DOMAIN", "id": dom.id, "name": dom.name, "code": dom.code})

            filter_kwargs["domain_id"] = dom.id

            # Direct children: Departments
            dept_qs = dom.departments.filter(status="ACTIVE")
            if not scope.is_unrestricted:
                dept_qs = scope.filter_departments(dept_qs)
            child_level_name = "DEPARTMENT"

            for dept in dept_qs.order_by("display_order", "name"):
                teams = dept.sub_departments.filter(status="ACTIVE")
                if not scope.is_unrestricted:
                    teams = scope.filter_teams(teams)
                children.append({
                    "id": dept.id,
                    "name": dept.name,
                    "code": dept.code,
                    "status": dept.status,
                    "level": "DEPARTMENT",
                    "child_count": teams.count(),
                    "record_count": 0,
                    "kpi_summary": {"total": 0, "green": 0, "amber": 0, "red": 0},
                })

        elif norm_level == "DEPARTMENT":
            try:
                dept = Department.objects.select_related("domain__circle__project__sub_company__main_company").get(id=node_id)
            except Department.DoesNotExist:
                raise NotFound("Department not found.")

            dom = dept.domain
            cir = dom.circle if dom else None
            prj = cir.project if cir else None
            sc = prj.sub_company if prj else None
            mc = sc.main_company if sc else None

            node_dict = {
                "id": dept.id,
                "name": dept.name,
                "code": dept.code,
                "description": dept.description,
                "status": dept.status,
                "level": "DEPARTMENT",
                "badge": "Department",
                "badge_color": "amber",
            }
            if mc:
                breadcrumbs.append({"level": "MAIN_COMPANY", "id": mc.id, "name": mc.name, "code": mc.code})
            if sc:
                breadcrumbs.append({"level": "SUB_COMPANY", "id": sc.id, "name": sc.name, "code": sc.code})
            if prj:
                breadcrumbs.append({"level": "PROJECT", "id": prj.id, "name": prj.name, "code": prj.code})
            if cir:
                breadcrumbs.append({"level": "CIRCLE", "id": cir.id, "name": cir.name, "code": cir.code})
                associated_circle_ids = [cir.id]
                filter_kwargs["circle_id"] = cir.id
            if dom:
                breadcrumbs.append({"level": "DOMAIN", "id": dom.id, "name": dom.name, "code": dom.code})
                filter_kwargs["domain_id"] = dom.id
            breadcrumbs.append({"level": "DEPARTMENT", "id": dept.id, "name": dept.name, "code": dept.code})

            # Direct children: Teams / SubDepartments
            team_qs = dept.sub_departments.filter(status="ACTIVE")
            if not scope.is_unrestricted:
                team_qs = scope.filter_teams(team_qs)
            child_level_name = "SUB_DEPARTMENT"

            for team in team_qs.order_by("display_order", "name"):
                users_cnt = User.objects.filter(sub_department=team, is_active=True).count()
                children.append({
                    "id": team.id,
                    "name": team.name,
                    "code": team.code,
                    "status": team.status,
                    "level": "SUB_DEPARTMENT",
                    "child_count": users_cnt,
                    "record_count": 0,
                    "kpi_summary": {"total": 0, "green": 0, "amber": 0, "red": 0},
                })

        elif norm_level == "SUB_DEPARTMENT":
            try:
                team = SubDepartment.objects.select_related(
                    "department__domain__circle__project__sub_company__main_company"
                ).get(id=node_id)
            except SubDepartment.DoesNotExist:
                raise NotFound("Team / Sub-Department not found.")

            dept = team.department
            dom = dept.domain if dept else None
            cir = dom.circle if dom else None
            prj = cir.project if cir else None
            sc = prj.sub_company if prj else None
            mc = sc.main_company if sc else None

            node_dict = {
                "id": team.id,
                "name": team.name,
                "code": team.code,
                "description": team.description,
                "status": team.status,
                "level": "SUB_DEPARTMENT",
                "badge": "Team",
                "badge_color": "rose",
            }
            if mc:
                breadcrumbs.append({"level": "MAIN_COMPANY", "id": mc.id, "name": mc.name, "code": mc.code})
            if sc:
                breadcrumbs.append({"level": "SUB_COMPANY", "id": sc.id, "name": sc.name, "code": sc.code})
            if prj:
                breadcrumbs.append({"level": "PROJECT", "id": prj.id, "name": prj.name, "code": prj.code})
            if cir:
                breadcrumbs.append({"level": "CIRCLE", "id": cir.id, "name": cir.name, "code": cir.code})
                associated_circle_ids = [cir.id]
                filter_kwargs["circle_id"] = cir.id
            if dom:
                breadcrumbs.append({"level": "DOMAIN", "id": dom.id, "name": dom.name, "code": dom.code})
                filter_kwargs["domain_id"] = dom.id
            if dept:
                breadcrumbs.append({"level": "DEPARTMENT", "id": dept.id, "name": dept.name, "code": dept.code})
            breadcrumbs.append({"level": "SUB_DEPARTMENT", "id": team.id, "name": team.name, "code": team.code})

            # Direct children: Users
            user_qs = User.objects.filter(sub_department=team, is_active=True)
            if not scope.is_unrestricted:
                user_qs = scope.filter_users(user_qs)
            child_level_name = "USER"

            for u in user_qs.order_by("username"):
                children.append({
                    "id": u.id,
                    "name": u.get_full_name() or u.username,
                    "code": u.username,
                    "status": u.status,
                    "level": "USER",
                    "description": f"{u.designation} ({u.role})" if u.designation else u.role,
                    "child_count": 0,
                    "record_count": 0,
                    "kpi_summary": {"total": 0, "green": 0, "amber": 0, "red": 0},
                })

        elif norm_level == "USER":
            try:
                u = User.objects.select_related(
                    "sub_department__department__domain__circle__project__sub_company__main_company",
                    "circle__project__sub_company__main_company",
                ).get(id=node_id)
            except User.DoesNotExist:
                raise NotFound("User not found.")

            team = u.sub_department
            dept = team.department if team else None
            dom = dept.domain if dept else None
            cir = dom.circle if dom else u.circle
            prj = cir.project if cir else None
            sc = prj.sub_company if prj else None
            mc = sc.main_company if sc else None

            node_dict = {
                "id": u.id,
                "name": u.get_full_name() or u.username,
                "code": u.username,
                "description": f"Role: {u.role} | Designation: {u.designation or 'N/A'} | Email: {u.email}",
                "status": u.status,
                "level": "USER",
                "badge": "User",
                "badge_color": "teal",
            }
            if mc:
                breadcrumbs.append({"level": "MAIN_COMPANY", "id": mc.id, "name": mc.name, "code": mc.code})
            if sc:
                breadcrumbs.append({"level": "SUB_COMPANY", "id": sc.id, "name": sc.name, "code": sc.code})
            if prj:
                breadcrumbs.append({"level": "PROJECT", "id": prj.id, "name": prj.name, "code": prj.code})
            if cir:
                breadcrumbs.append({"level": "CIRCLE", "id": cir.id, "name": cir.name, "code": cir.code})
                associated_circle_ids = [cir.id]
                filter_kwargs["circle_id"] = cir.id
            if dom:
                breadcrumbs.append({"level": "DOMAIN", "id": dom.id, "name": dom.name, "code": dom.code})
            if dept:
                breadcrumbs.append({"level": "DEPARTMENT", "id": dept.id, "name": dept.name, "code": dept.code})
            if team:
                breadcrumbs.append({"level": "SUB_DEPARTMENT", "id": team.id, "name": team.name, "code": team.code})
            breadcrumbs.append({"level": "USER", "id": u.id, "name": u.get_full_name() or u.username, "code": u.username})
            child_level_name = ""

        # Fetch relevant operational KPI values
        kpi_qs = get_scoped_kpi_values(**filter_kwargs)
        operational_records: List[Dict[str, Any]] = []

        for val in kpi_qs:
            operational_records.append({
                "id": val.id,
                "kpi_id": val.kpi_id,
                "kpi_name": val.kpi.name,
                "kpi_code": val.kpi.code,
                "circle_id": val.circle_id,
                "circle_name": val.circle.name,
                "domain_name": val.kpi.domain.name if val.kpi.domain else "General",
                "actual_value": float(val.actual_value) if val.actual_value is not None else 0.0,
                "target_value": float(val.target_value) if val.target_value is not None else None,
                "variance": float(val.variance_to_target) if val.variance_to_target is not None else None,
                "variance_percentage": float(val.variance_percentage) if val.variance_percentage is not None else None,
                "rag_status": val.rag_status,
                "trend": val.trend,
                "unit": val.kpi.unit,
                "notes": val.notes,
                "entered_by": val.entered_by.get_full_name() if val.entered_by else "System/Import",
            })

        # Fetch uploaded batch records relevant to this branch's circles or period
        batch_qs = ImportBatch.objects.select_related("template_version__template", "uploaded_by")
        if active_period:
            batch_qs = batch_qs.filter(reporting_period=active_period)
        uploaded_batches = [
            {
                "id": b.id,
                "batch_id": b.batch_id,
                "template_name": b.template_version.template.name if b.template_version else "Standard",
                "original_filename": b.original_filename,
                "status": b.status,
                "total_rows": b.total_rows,
                "valid_rows": b.valid_rows,
                "error_rows": b.error_rows,
                "uploaded_by": b.uploaded_by.get_full_name() or b.uploaded_by.username if b.uploaded_by else "System",
                "created_at": b.created_at.isoformat(),
            }
            for b in batch_qs.order_by("-created_at")[:10]
        ]

        # Calculate metrics summary
        rec_count = len(operational_records)
        green_cnt = sum(1 for r in operational_records if r["rag_status"] == "GREEN")
        amber_cnt = sum(1 for r in operational_records if r["rag_status"] == "AMBER")
        red_cnt = sum(1 for r in operational_records if r["rag_status"] == "RED")

        # Immediate parent (second to last item in breadcrumbs)
        parent_info = breadcrumbs[-2] if len(breadcrumbs) >= 2 else None

        return {
            "node": node_dict,
            "breadcrumbs": breadcrumbs,
            "parent": parent_info,
            "children": children,
            "child_level": child_level_name,
            "operational_data": operational_records,
            "uploaded_batches": uploaded_batches,
            "summary": {
                "total_records": rec_count,
                "green_count": green_cnt,
                "amber_count": amber_cnt,
                "red_count": red_cnt,
                "child_count": len(children),
            },
            "period": period_data,
            "periods": all_periods,
        }
