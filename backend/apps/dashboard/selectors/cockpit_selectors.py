"""
Cockpit Database Selectors.
Encapsulates all database reads, scoped authorization, filtering, and aggregation queries.
"""

from typing import List, Dict, Any, Optional
from decimal import Decimal
from django.db.models import Q
from django.db import connection

from apps.dashboard.models import (
    KPI,
    KPIValue,
    ReportingPeriod,
    GovernanceIssue,
    GovernanceActionItem,
)
from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Domain,
    Department,
)


def get_user_circle_ids(user) -> Optional[List[int]]:
    """
    Returns list of circle IDs accessible by the user, or None if user has unrestricted access.
    Delegates to central AuthorizationService.
    """
    if user is None:
        return None
    if not user.is_authenticated:
        return []

    from common.permissions.authorization import AuthorizationService
    return AuthorizationService.get_user_circle_ids(user)


def get_filter_options(user=None) -> Dict[str, Any]:
    """
    Returns dynamic filter options from live database records, strictly filtered by user's authorization scope.
    """
    scope = None
    if user:
        from common.permissions.authorization import AuthorizationService
        scope = AuthorizationService.get_user_hierarchy_scope(user)

    comp_qs = MainCompany.objects.filter(status="ACTIVE")
    if scope and not scope.is_unrestricted:
        allowed_mc = (scope.main_company_ids or set()) | scope.ancestor_main_company_ids
        comp_qs = comp_qs.filter(id__in=allowed_mc)
    companies = list(comp_qs.values("id", "name", "code").order_by("name"))

    sub_qs = SubCompany.objects.filter(status="ACTIVE")
    if scope and not scope.is_unrestricted:
        allowed_sc = (scope.sub_company_ids or set()) | scope.ancestor_sub_company_ids
        sub_qs = sub_qs.filter(id__in=allowed_sc)
    sub_companies = list(sub_qs.values("id", "name", "code", "main_company_id").order_by("name"))

    prj_qs = Project.objects.filter(status="ACTIVE")
    if scope and not scope.is_unrestricted:
        allowed_prj = (scope.project_ids or set()) | scope.ancestor_project_ids
        prj_qs = prj_qs.filter(id__in=allowed_prj)
    projects = list(prj_qs.values("id", "name", "code", "sub_company_id").order_by("name"))

    circles_qs = Circle.objects.filter(is_active=True)
    if scope and not scope.is_unrestricted:
        circles_qs = scope.filter_circles(circles_qs)
    circles = list(circles_qs.values("id", "name", "code", "region", "project_id").order_by("name"))

    domains_qs = Domain.objects.filter(is_active=True)
    if scope and not scope.is_unrestricted:
        domains_qs = scope.filter_domains(domains_qs)
    domains = list(domains_qs.values("id", "name", "code", "display_order", "circle_id").order_by("display_order", "name"))

    depts_qs = Department.objects.filter(status="ACTIVE")
    if scope and not scope.is_unrestricted:
        depts_qs = scope.filter_departments(depts_qs)
    departments = list(depts_qs.values("id", "name", "code", "domain_id").order_by("display_order", "name"))

    try:
        periods = list(
            ReportingPeriod.objects.all().values("id", "name", "period_type", "is_current", "start_date").order_by("-start_date")
        )
    except Exception:
        periods = []

    statuses = [
        {"value": "ALL", "label": "All Statuses"},
        {"value": "GREEN", "label": "Optimal (Green)"},
        {"value": "AMBER", "label": "Warning (Amber)"},
        {"value": "RED", "label": "Critical (Red)"},
    ]

    return {
        "companies": companies,
        "sub_companies": sub_companies,
        "projects": projects,
        "circles": circles,
        "domains": domains,
        "departments": departments,
        "periods": periods,
        "statuses": statuses,
    }


def get_scoped_kpi_values(
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
):
    """
    Returns filtered KPIValue queryset honoring organization scope.
    """
    qs = KPIValue.objects.select_related("kpi", "circle", "period", "kpi__domain")

    if user:
        from common.permissions.authorization import AuthorizationService
        scope = AuthorizationService.get_user_hierarchy_scope(user)
        if not scope.is_unrestricted:
            if scope.circle_ids is not None:
                qs = qs.filter(circle_id__in=scope.circle_ids)
            if scope.domain_ids is not None:
                qs = qs.filter(kpi__domain_id__in=scope.domain_ids)

    # Filter by period (default to current if not specified)
    if period_id:
        qs = qs.filter(period_id=period_id)
    else:
        # If no period is specified, choose is_current or latest
        current_period = ReportingPeriod.objects.filter(is_current=True).first()
        if current_period:
            qs = qs.filter(period_id=current_period.id)

    if circle_id:
        qs = qs.filter(circle_id=circle_id)
    elif project_id:
        qs = qs.filter(circle__project_id=project_id)
    elif sub_company_id:
        qs = qs.filter(circle__project__sub_company_id=sub_company_id)
    elif company_id:
        qs = qs.filter(
            Q(circle__project__sub_company__main_company_id=company_id) |
            Q(circle__project__sub_company_id__in=SubCompany.objects.filter(main_company_id=company_id).values_list("id", flat=True))
        )

    if domain_id:
        qs = qs.filter(kpi__domain_id=domain_id)
    if department_id:
        qs = qs.filter(kpi__domain__departments__id=department_id)

    if status and status.upper() != "ALL":
        qs = qs.filter(rag_status=status.upper())

    if search:
        s = search.strip()
        qs = qs.filter(
            Q(kpi__name__icontains=s) |
            Q(kpi__code__icontains=s) |
            Q(circle__name__icontains=s) |
            Q(kpi__domain__name__icontains=s) |
            Q(notes__icontains=s)
        )

    return qs.order_by("circle__name", "kpi__domain__display_order", "kpi__display_order", "kpi__code")
