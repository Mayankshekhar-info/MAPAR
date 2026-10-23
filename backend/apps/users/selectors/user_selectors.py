from typing import Dict, Any, Optional
from django.db.models import Q
from apps.identity.models import User
from apps.authorization.models import AccessUserRole
from apps.authorization.selectors.scope_selectors import get_user_scopes_list
from apps.authorization.services.module_permission_service import ModulePermissionService
from apps.organization.selectors.organization_selectors import get_node_hierarchy_context


def _format_user_scope(u: User) -> Optional[str]:
    scopes = list(u.access_scopes.all())
    if len(scopes) > 1:
        first_two = [s.hierarchy_breadcrumb for s in scopes[:2] if s.hierarchy_breadcrumb]
        extra = f" (+{len(scopes) - 2} more)" if len(scopes) > 2 else ""
        return " | ".join(first_two) + extra
    elif len(scopes) == 1 and scopes[0].hierarchy_breadcrumb:
        return scopes[0].hierarchy_breadcrumb

    if u.sub_department:
        sd = u.sub_department
        dept = getattr(sd, "department", None)
        dom = getattr(dept, "domain", None) if dept else None
        cir = getattr(dom, "circle", None) if dom else None
        prj = getattr(cir, "project", None) if cir else None
        sub = getattr(prj, "sub_company", None) if prj else None
        main = getattr(sub, "main_company", None) if sub else None
        parts = []
        if main: parts.append(main.name)
        if sub: parts.append(sub.name)
        if prj: parts.append(prj.name)
        if cir: parts.append(cir.name)
        if dom: parts.append(dom.name)
        if dept: parts.append(dept.name)
        parts.append(sd.name)
        return " → ".join(parts)
    elif u.circle:
        prj = getattr(u.circle, "project", None)
        sub = getattr(prj, "sub_company", None) if prj else None
        main = getattr(sub, "main_company", None) if sub else None
        parts = []
        if main: parts.append(main.name)
        if sub: parts.append(sub.name)
        if prj: parts.append(prj.name)
        parts.append(u.circle.name)
        return " → ".join(parts)
    return None


def get_users_list(
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    circle_id: Optional[int] = None,
    sub_department_id: Optional[int] = None,
    team_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    request_user=None,
) -> Dict[str, Any]:
    """
    Returns filtered and paginated list of enterprise users with role and organization hierarchy details.
    Restricted to request_user's authorized downward organization scope.
    """
    qs = User.objects.select_related(
        "sub_department__department__domain__circle__project__sub_company__main_company",
        "circle__project__sub_company__main_company",
    ).prefetch_related(
        "user_roles__role"
    ).order_by("-date_joined")

    # Scope enforcement
    if request_user:
        from common.permissions.authorization import AuthorizationService
        scope = AuthorizationService.get_user_hierarchy_scope(request_user)
        if not scope.is_unrestricted:
            qs = scope.filter_users(qs)

    if search:
        search = search.strip()
        qs = qs.filter(
            Q(username__icontains=search)
            | Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(email__icontains=search)
        )

    if role:
        qs = qs.filter(
            Q(role=role) | Q(user_roles__role__code=role)
        ).distinct()

    if status:
        qs = qs.filter(status=status.upper())

    if circle_id:
        qs = qs.filter(Q(circle_id=circle_id) | Q(sub_department__department__domain__circle_id=circle_id))

    target_team = sub_department_id or team_id
    if target_team:
        qs = qs.filter(sub_department_id=target_team)

    total_count = qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    page_users = qs[start:end]

    results = []
    for u in page_users:
        # Determine primary role
        primary_ur = u.user_roles.filter(is_primary=True).first() or u.user_roles.first()
        role_code = primary_ur.role.code if primary_ur else u.role
        role_name = primary_ur.role.name if primary_ur else u.role_title

        org_scope = _format_user_scope(u)

        results.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "full_name": u.get_full_name() or u.username,
            "role": role_code,
            "role_name": role_name,
            "status": u.status,
            "is_active": u.is_active,
            "circle_id": u.circle_id,
            "circle_name": u.circle.name if u.circle else None,
            "circle_code": u.circle.code if u.circle else None,
            "sub_department_id": u.sub_department_id,
            "sub_department_name": u.sub_department.name if u.sub_department else None,
            "team_id": u.sub_department_id,
            "team_name": u.sub_department.name if u.sub_department else None,
            "department": u.sub_department.department.name if (u.sub_department and u.sub_department.department) else u.department,
            "organization_scope": org_scope,
            "hierarchy_context": get_node_hierarchy_context("USER", u),
            "designation": u.designation,
            "date_joined": u.date_joined.isoformat() if u.date_joined else None,
            "last_login": u.last_login.isoformat() if u.last_login else None,
        })

    return {
        "count": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size if page_size > 0 else 1,
        "results": results,
    }


def get_user_detail(user_id: int, request_user=None) -> Optional[Dict[str, Any]]:
    """
    Returns full user account details including roles, organization hierarchy, and metadata.
    Enforces authorization scope when request_user is supplied.
    """
    if request_user:
        from common.permissions.authorization import AuthorizationService
        scope = AuthorizationService.get_user_hierarchy_scope(request_user)
        if not scope.is_user_allowed(user_id):
            return None

    try:
        u = User.objects.select_related(
            "sub_department__department__domain__circle__project__sub_company__main_company",
            "circle__project__sub_company__main_company",
        ).prefetch_related(
            "user_roles__role",
            "access_scopes__assigned_circles__circle",
        ).get(id=user_id)
    except User.DoesNotExist:
        return None

    # Roles
    roles = []
    for ur in u.user_roles.all():
        roles.append({
            "id": ur.role.id,
            "code": ur.role.code,
            "name": ur.role.name,
            "is_primary": ur.is_primary,
            "risk_level": ur.role.risk_level,
        })

    org_scope = _format_user_scope(u)

    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "full_name": u.get_full_name() or u.username,
        "status": u.status,
        "is_active": u.is_active,
        "is_staff": u.is_staff,
        "is_superuser": u.is_superuser,
        "role": u.role,
        "role_name": u.role_title,
        "roles": roles,
        "circle_id": u.circle_id,
        "circle_name": u.circle.name if u.circle else None,
        "circle_code": u.circle.code if u.circle else None,
        "sub_department_id": u.sub_department_id,
        "sub_department_name": u.sub_department.name if u.sub_department else None,
        "team_id": u.sub_department_id,
        "team_name": u.sub_department.name if u.sub_department else None,
        "department": u.sub_department.department.name if (u.sub_department and u.sub_department.department) else u.department,
        "organization_scope": org_scope,
        "hierarchy_context": get_node_hierarchy_context("USER", u),
        "scopes": get_user_scopes_list(user_id=u.id),
        "module_permissions": ModulePermissionService.get_user_module_permissions(u),
        "designation": u.designation,
        "phone": u.phone,
        "employee_id": u.employee_id,
        "date_joined": u.date_joined.isoformat() if u.date_joined else None,
        "last_login": u.last_login.isoformat() if u.last_login else None,
    }

