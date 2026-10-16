from typing import List, Dict, Any, Optional
from apps.authorization.models import UserAccessScope, AccessUserRole, AccessRole
from apps.identity.models import User
from apps.organization.models import Circle, Domain, Department, SubDepartment
from common.permissions.authorization import AuthorizationService


def get_user_scopes_list(user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Returns list of assigned access scopes across all users or for a specific user,
    with complete 7-tier cascading hierarchy breadcrumbs and action permissions.
    """
    qs = UserAccessScope.objects.select_related(
        "user",
        "main_company",
        "sub_company",
        "project",
        "circle",
        "domain",
        "department",
        "sub_department",
    ).prefetch_related(
        "assigned_circles__circle__project__sub_company__main_company",
        "assigned_domains__domain__circle",
    )

    if user_id:
        qs = qs.filter(user_id=user_id)

    scopes_data = []
    for s in qs.order_by("id"):
        # Resolve primary role
        primary_user_role = AccessUserRole.objects.filter(user=s.user, is_primary=True).select_related("role").first()
        role_name = primary_user_role.role.name if primary_user_role else s.user.role_title

        # Build circles breadcrumbs (legacy / fallback)
        circles_info = []
        for ac in s.assigned_circles.all():
            c = ac.circle
            prj = c.project
            sub = prj.sub_company if prj else None
            main = sub.main_company if sub else None
            hierarchy_label = f"{main.name} → {prj.name} → {c.name}" if main and prj else c.name

            circles_info.append({
                "circle_id": c.id,
                "circle_name": c.name,
                "circle_code": c.code,
                "region": c.region,
                "hierarchy_breadcrumb": hierarchy_label,
            })

        # Build domains breadcrumbs (legacy / fallback)
        domains_info = []
        for ad in s.assigned_domains.all():
            d = ad.domain
            domains_info.append({
                "domain_id": d.id,
                "domain_name": d.name,
                "domain_code": d.code,
                "circle_name": d.circle.name if d.circle else None,
            })

        # If s.circle was directly assigned and circles_info is empty, populate it
        if s.circle and not circles_info:
            c = s.circle
            prj = c.project
            sub = prj.sub_company if prj else None
            main = sub.main_company if sub else None
            hierarchy_label = f"{main.name} → {prj.name} → {c.name}" if main and prj else c.name
            circles_info.append({
                "circle_id": c.id,
                "circle_name": c.name,
                "circle_code": c.code,
                "region": c.region,
                "hierarchy_breadcrumb": hierarchy_label,
            })

        if s.domain and not domains_info:
            domains_info.append({
                "domain_id": s.domain.id,
                "domain_name": s.domain.name,
                "domain_code": s.domain.code,
                "circle_name": s.domain.circle.name if s.domain.circle else None,
            })

        actions = s.actions or []
        if not actions:
            if s.can_view: actions.append("view")
            if s.can_manage: actions.append("manage")
            if s.can_create: actions.append("create")
            if s.can_update: actions.append("update")
            if s.can_delete: actions.append("delete")

        scopes_data.append({
            "id": s.id,
            "user_id": s.user.id,
            "username": s.user.username,
            "full_name": s.user.get_full_name() or s.user.username,
            "email": s.user.email,
            "role_name": role_name,
            "scope_type": s.scope_type,
            "scope_type_display": s.get_scope_type_display(),
            "anchor_level": s.anchor_level,
            "hierarchy_breadcrumb": s.hierarchy_breadcrumb,
            "main_company_id": s.main_company_id,
            "main_company_name": s.main_company.name if s.main_company else None,
            "sub_company_id": s.sub_company_id,
            "sub_company_name": s.sub_company.name if s.sub_company else None,
            "project_id": s.project_id,
            "project_name": s.project.name if s.project else None,
            "circle_id": s.circle_id,
            "circle_name": s.circle.name if s.circle else None,
            "domain_id": s.domain_id,
            "domain_name": s.domain.name if s.domain else None,
            "department_id": s.department_id,
            "department_name": s.department.name if s.department else None,
            "sub_department_id": s.sub_department_id,
            "sub_department_name": s.sub_department.name if s.sub_department else None,
            "team_id": s.sub_department_id,
            "team_name": s.sub_department.name if s.sub_department else None,
            "can_view": s.can_view,
            "can_manage": s.can_manage,
            "can_create": s.can_create,
            "can_update": s.can_update,
            "can_delete": s.can_delete,
            "actions": actions,
            "circles_count": len(circles_info),
            "circles": circles_info,
            "domains": domains_info,
            "is_active": s.user.is_active,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        })

    return scopes_data


def get_user_effective_access(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Computes complete effective access:
        USER + ROLE + SCOPE(s) + PERMISSIONS + ACTIONS -> EFFECTIVE ACCESS
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None

    # Roles
    user_roles = AccessUserRole.objects.filter(user=user).select_related("role")
    roles_list = [{
        "id": ur.role.id,
        "name": ur.role.name,
        "code": ur.role.code,
        "is_primary": ur.is_primary,
    } for ur in user_roles]

    # Effective permissions and accessible navigation modules (WHAT)
    perms = AuthorizationService.get_user_effective_permissions(user)
    modules = AuthorizationService.get_user_accessible_modules(user)

    # Scopes evaluation (WHERE and HOW)
    scope = AuthorizationService.get_user_hierarchy_scope(user)
    assigned_scopes = get_user_scopes_list(user_id=user.id)

    # Resolve allowed circle objects
    circle_objects = []
    if not scope.is_unrestricted and scope.circle_ids is not None:
        cq = Circle.objects.filter(id__in=scope.circle_ids).select_related(
            "project__sub_company__main_company"
        )
        for c in cq:
            prj = c.project
            sub = prj.sub_company if prj else None
            main = sub.main_company if sub else None
            hierarchy_label = f"{main.name} → {prj.name} → {c.name}" if main and prj else c.name
            circle_objects.append({
                "id": c.id,
                "name": c.name,
                "code": c.code,
                "region": c.region,
                "breadcrumb": hierarchy_label,
                "can_manage": c.id in scope.manageable_circle_ids,
            })

    # Resolve allowed department objects
    department_objects = []
    if not scope.is_unrestricted and scope.department_ids is not None:
        dq = Department.objects.filter(id__in=scope.department_ids).select_related("domain__circle")
        for d in dq:
            department_objects.append({
                "id": d.id,
                "name": d.name,
                "code": d.code,
                "domain_name": d.domain.name if d.domain else None,
                "circle_name": d.domain.circle.name if d.domain and d.domain.circle else None,
                "can_manage": d.id in scope.manageable_department_ids,
            })

    # Resolve allowed teams
    team_objects = []
    if not scope.is_unrestricted and scope.team_ids is not None:
        tq = SubDepartment.objects.filter(id__in=scope.team_ids).select_related("department__domain")
        for t in tq:
            team_objects.append({
                "id": t.id,
                "name": t.name,
                "code": t.code,
                "department_name": t.department.name if t.department else None,
                "can_manage": t.id in scope.manageable_team_ids,
            })

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.get_full_name() or user.username,
            "email": user.email,
            "status": user.status,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
        },
        "roles": roles_list,
        "scopes": assigned_scopes,
        "effective_permissions": perms,
        "accessible_modules": modules,
        "scope_restriction": "UNRESTRICTED" if scope.is_unrestricted else "RESTRICTED",
        "scopes_count": len(assigned_scopes),
        "allowed_circles": circle_objects,
        "allowed_departments": department_objects,
        "allowed_teams": team_objects,
    }
