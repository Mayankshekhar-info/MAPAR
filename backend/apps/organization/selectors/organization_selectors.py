"""
Organization Hierarchy Selectors.
All queries strictly fetch data from PostgreSQL.
"""

from typing import Dict, Any, List, Optional
from django.db.models import Q
from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Domain,
    Department,
    SubDepartment,
    HierarchyAuditLog,
)
from apps.organization.constants import HIERARCHY_CONFIG
from apps.identity.models import User


def get_node_hierarchy_context(level: str, obj: Any) -> Dict[str, Any]:
    """
    Returns resolved parent IDs up the 7-tier hierarchy for any node:
    MainCompany -> SubCompany -> Project -> Circle -> Domain -> Department -> Team
    """
    level = level.upper()
    ctx: Dict[str, Any] = {}
    if not obj:
        return ctx

    if level == "MAIN_COMPANY":
        ctx["main_company_id"] = obj.id
    elif level == "SUB_COMPANY":
        ctx["main_company_id"] = getattr(obj, "main_company_id", None)
        ctx["sub_company_id"] = obj.id
    elif level == "PROJECT":
        sc = getattr(obj, "sub_company", None)
        if sc:
            ctx["main_company_id"] = getattr(sc, "main_company_id", None)
        ctx["sub_company_id"] = getattr(obj, "sub_company_id", None)
        ctx["project_id"] = obj.id
    elif level == "CIRCLE":
        prj = getattr(obj, "project", None)
        if prj:
            sc = getattr(prj, "sub_company", None)
            if sc:
                ctx["main_company_id"] = getattr(sc, "main_company_id", None)
            ctx["sub_company_id"] = getattr(prj, "sub_company_id", None)
            ctx["project_id"] = prj.id
        elif getattr(obj, "main_company_id", None):
            ctx["main_company_id"] = obj.main_company_id
        ctx["circle_id"] = obj.id
    elif level == "DOMAIN":
        cir = getattr(obj, "circle", None)
        if cir:
            prj = getattr(cir, "project", None)
            if prj:
                sc = getattr(prj, "sub_company", None)
                if sc:
                    ctx["main_company_id"] = getattr(sc, "main_company_id", None)
                ctx["sub_company_id"] = getattr(prj, "sub_company_id", None)
                ctx["project_id"] = getattr(cir, "project_id", None)
            elif getattr(cir, "main_company_id", None):
                ctx["main_company_id"] = cir.main_company_id
            ctx["circle_id"] = getattr(obj, "circle_id", None)
        ctx["domain_id"] = obj.id
    elif level == "DEPARTMENT":
        dom = getattr(obj, "domain", None)
        if dom:
            cir = getattr(dom, "circle", None)
            if cir:
                prj = getattr(cir, "project", None)
                if prj:
                    sc = getattr(prj, "sub_company", None)
                    if sc:
                        ctx["main_company_id"] = getattr(sc, "main_company_id", None)
                    ctx["sub_company_id"] = getattr(prj, "sub_company_id", None)
                    ctx["project_id"] = getattr(cir, "project_id", None)
                elif getattr(cir, "main_company_id", None):
                    ctx["main_company_id"] = cir.main_company_id
                ctx["circle_id"] = getattr(dom, "circle_id", None)
            ctx["domain_id"] = getattr(obj, "domain_id", None)
        ctx["department_id"] = obj.id
    elif level in ("SUB_DEPARTMENT", "TEAM"):
        dept = getattr(obj, "department", None)
        if dept:
            dom = getattr(dept, "domain", None)
            if dom:
                cir = getattr(dom, "circle", None)
                if cir:
                    prj = getattr(cir, "project", None)
                    if prj:
                        sc = getattr(prj, "sub_company", None)
                        if sc:
                            ctx["main_company_id"] = getattr(sc, "main_company_id", None)
                        ctx["sub_company_id"] = getattr(prj, "sub_company_id", None)
                        ctx["project_id"] = getattr(cir, "project_id", None)
                    elif getattr(cir, "main_company_id", None):
                        ctx["main_company_id"] = cir.main_company_id
                    ctx["circle_id"] = getattr(dom, "circle_id", None)
                ctx["domain_id"] = getattr(dept, "domain_id", None)
            ctx["department_id"] = getattr(obj, "department_id", None)
        ctx["sub_department_id"] = obj.id
        ctx["team_id"] = obj.id
    elif level == "USER":
        subdept = getattr(obj, "sub_department", None)
        if subdept:
            return get_node_hierarchy_context("SUB_DEPARTMENT", subdept)
        cir = getattr(obj, "circle", None)
        if cir:
            return get_node_hierarchy_context("CIRCLE", cir)

    return ctx


def get_hierarchy_summary() -> Dict[str, int]:
    """
    Returns live database counts for all hierarchy levels.
    """
    return {
        "main_companies": MainCompany.objects.count(),
        "sub_companies": SubCompany.objects.count(),
        "projects": Project.objects.count(),
        "circles": Circle.objects.count(),
        "domains": Domain.objects.count(),
        "departments": Department.objects.count(),
        "sub_departments": SubDepartment.objects.count(),
        "teams": SubDepartment.objects.count(),
        "users": User.objects.count(),
    }


def _build_circle_tree(cir, parent_id: str, parent_name: str, scope) -> Optional[Dict[str, Any]]:
    if scope and not scope.is_unrestricted:
        if not scope.is_circle_allowed(cir.id):
            return None

    cir_node = {
        "id": f"cir_{cir.id}",
        "raw_id": cir.id,
        "level": "CIRCLE",
        "name": cir.name,
        "code": cir.code,
        "description": f"Region: {cir.region}" if cir.region else "",
        "status": cir.status,
        "badge": "Circle",
        "badge_color": "cyan",
        "parent_id": parent_id,
        "parent_name": parent_name,
        "children": [],
    }

    for dom in cir.domains.all().order_by("display_order", "name"):
        if scope and not scope.is_unrestricted:
            if not scope.is_domain_allowed(dom.id):
                continue

        dom_node = {
            "id": f"dom_{dom.id}",
            "raw_id": dom.id,
            "level": "DOMAIN",
            "name": dom.name,
            "code": dom.code,
            "description": dom.description,
            "status": dom.status,
            "badge": "Domain",
            "badge_color": "emerald",
            "icon": dom.icon,
            "color": dom.color,
            "parent_id": cir_node["id"],
            "parent_name": cir.name,
            "children": [],
        }

        for dept in dom.departments.all().order_by("display_order", "name"):
            if scope and not scope.is_unrestricted:
                if not scope.is_department_allowed(dept.id):
                    continue

            dept_node = {
                "id": f"dept_{dept.id}",
                "raw_id": dept.id,
                "level": "DEPARTMENT",
                "name": dept.name,
                "code": dept.code,
                "description": dept.description,
                "status": dept.status,
                "badge": "Department",
                "badge_color": "amber",
                "parent_id": dom_node["id"],
                "parent_name": dom.name,
                "children": [],
            }

            for subdept in dept.sub_departments.all().order_by("display_order", "name"):
                if scope and not scope.is_unrestricted:
                    if not scope.is_team_allowed(subdept.id):
                        continue

                subdept_node = {
                    "id": f"subdept_{subdept.id}",
                    "raw_id": subdept.id,
                    "level": "SUB_DEPARTMENT",
                    "name": subdept.name,
                    "code": subdept.code,
                    "description": subdept.description,
                    "status": subdept.status,
                    "badge": "Team",
                    "badge_color": "rose",
                    "parent_id": dept_node["id"],
                    "parent_name": dept.name,
                    "children": [],
                }
                for u in subdept.users.filter(is_active=True).order_by("username"):
                    if scope and not scope.is_unrestricted:
                        if not scope.is_user_allowed(u.id):
                            continue

                    u_node = {
                        "id": f"user_{u.id}",
                        "raw_id": u.id,
                        "level": "USER",
                        "name": u.get_full_name() or u.username,
                        "code": u.username,
                        "description": f"{u.designation} ({u.role})" if u.designation else u.role,
                        "status": u.status,
                        "badge": "User",
                        "badge_color": "teal",
                        "parent_id": subdept_node["id"],
                        "parent_name": subdept.name,
                        "children": [],
                    }
                    subdept_node["children"].append(u_node)

                dept_node["children"].append(subdept_node)

            dom_node["children"].append(dept_node)

        cir_node["children"].append(dom_node)

    return cir_node


def get_hierarchy_tree(user=None) -> List[Dict[str, Any]]:
    """
    Constructs the organization tree:
    Main Company -> Sub Company -> Project -> Circle -> Domain -> Department -> Team -> User
    When user is provided, restricts tree to authorized branch and permitted descendants.
    """
    scope = None
    if user:
        from common.permissions.authorization import AuthorizationService
        scope = AuthorizationService.get_user_hierarchy_scope(user)

    tree: List[Dict[str, Any]] = []

    main_companies = MainCompany.objects.prefetch_related(
        "sub_companies__projects__circles__domains__departments__sub_departments__users",
        "circles__domains__departments__sub_departments__users",
    ).all().order_by("name")

    for mc in main_companies:
        # Check if mc is in scope
        if scope and not scope.is_unrestricted:
            allowed_mc = (scope.main_company_ids or set()) | scope.ancestor_main_company_ids
            if mc.id not in allowed_mc:
                continue

        mc_node = {
            "id": f"main_{mc.id}",
            "raw_id": mc.id,
            "level": "MAIN_COMPANY",
            "name": mc.name,
            "code": mc.code,
            "description": mc.description,
            "status": mc.status,
            "badge": "Main Company",
            "badge_color": "purple",
            "parent_id": None,
            "parent_name": None,
            "children": [],
        }

        for sc in mc.sub_companies.all().order_by("name"):
            if scope and not scope.is_unrestricted:
                allowed_sc = (scope.sub_company_ids or set()) | scope.ancestor_sub_company_ids
                if sc.id not in allowed_sc:
                    continue

            sc_node = {
                "id": f"sub_{sc.id}",
                "raw_id": sc.id,
                "level": "SUB_COMPANY",
                "name": sc.name,
                "code": sc.code,
                "description": sc.description,
                "status": sc.status,
                "badge": "Sub Company",
                "badge_color": "indigo",
                "parent_id": mc_node["id"],
                "parent_name": mc.name,
                "children": [],
            }

            for prj in sc.projects.all().order_by("name"):
                if scope and not scope.is_unrestricted:
                    allowed_prj = (scope.project_ids or set()) | scope.ancestor_project_ids
                    if prj.id not in allowed_prj:
                        continue

                prj_node = {
                    "id": f"prj_{prj.id}",
                    "raw_id": prj.id,
                    "level": "PROJECT",
                    "name": prj.name,
                    "code": prj.code,
                    "description": prj.description,
                    "status": prj.status,
                    "badge": "Project",
                    "badge_color": "blue",
                    "parent_id": sc_node["id"],
                    "parent_name": sc.name,
                    "children": [],
                }

                for cir in prj.circles.all().order_by("name"):
                    cir_node = _build_circle_tree(cir, prj_node["id"], prj.name, scope)
                    if cir_node:
                        prj_node["children"].append(cir_node)

                sc_node["children"].append(prj_node)

            # Direct circles directly under Sub Company
            for cir in sc.direct_circles.filter(project__isnull=True).order_by("name"):
                cir_node = _build_circle_tree(cir, sc_node["id"], sc.name, scope)
                if cir_node:
                    sc_node["children"].append(cir_node)

            mc_node["children"].append(sc_node)

        # Direct circles directly under Main Company (where project is null and sub_company is null)
        for cir in mc.circles.filter(project__isnull=True, sub_company__isnull=True).order_by("name"):
            cir_node = _build_circle_tree(cir, mc_node["id"], mc.name, scope)
            if cir_node:
                mc_node["children"].append(cir_node)

        tree.append(mc_node)

    return tree

def get_cascading_options(
    level: str,
    parent_id: Optional[int] = None,
    user=None,
    company_id: Optional[int] = None,
    sub_company_id: Optional[int] = None,
    project_id: Optional[int] = None,
    parent_level: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Returns valid dropdown options for a given level, filtered by parent_id, company_id,
    sub_company_id, project_id, parent_level, and user's authorization scope.
    Guarantees strict hierarchical separation of Main Company, Sub Company, and Project circles.
    """
    level = level.upper()
    if parent_level:
        parent_level = parent_level.upper()
    scope = None
    if user:
        from common.permissions.authorization import AuthorizationService
        scope = AuthorizationService.get_user_hierarchy_scope(user)

    if level == "MAIN_COMPANY":
        qs = MainCompany.objects.filter(status="ACTIVE")
        if scope and not scope.is_unrestricted:
            allowed = (scope.main_company_ids or set()) | scope.ancestor_main_company_ids
            qs = qs.filter(id__in=allowed)
        return [{"id": o.id, "name": o.name, "code": o.code} for o in qs.order_by("name")]

    elif level == "SUB_COMPANY":
        qs = SubCompany.objects.filter(status="ACTIVE")
        target_mc = company_id or (parent_id if parent_level in (None, "MAIN_COMPANY") else None)
        if target_mc:
            qs = qs.filter(main_company_id=target_mc)
        if scope and not scope.is_unrestricted:
            allowed = (scope.sub_company_ids or set()) | scope.ancestor_sub_company_ids
            qs = qs.filter(id__in=allowed)
        return [{"id": o.id, "name": o.name, "code": o.code, "parent_id": o.main_company_id} for o in qs.order_by("name")]

    elif level == "PROJECT":
        qs = Project.objects.filter(status="ACTIVE")
        target_sc = sub_company_id or (parent_id if parent_level in (None, "SUB_COMPANY") else None)
        if target_sc:
            qs = qs.filter(sub_company_id=target_sc)
        elif company_id:
            qs = qs.filter(sub_company__main_company_id=company_id)
        if scope and not scope.is_unrestricted:
            allowed = (scope.project_ids or set()) | scope.ancestor_project_ids
            qs = qs.filter(id__in=allowed)
        return [{"id": o.id, "name": o.name, "code": o.code, "parent_id": o.sub_company_id} for o in qs.order_by("name")]

    elif level == "CIRCLE":
        qs = Circle.objects.filter(status="ACTIVE")
        if project_id or (parent_level == "PROJECT" and parent_id):
            target_prj = project_id or parent_id
            qs = qs.filter(project_id=target_prj)
        elif sub_company_id or (parent_level == "SUB_COMPANY" and parent_id):
            target_sc = sub_company_id or parent_id
            qs = qs.filter(Q(sub_company_id=target_sc) | Q(project__sub_company_id=target_sc))
        elif company_id or (parent_level == "MAIN_COMPANY" and parent_id):
            target_mc = company_id or parent_id
            # STRICT: direct Main Company circles only
            qs = qs.filter(main_company_id=target_mc, project__isnull=True, sub_company__isnull=True)
        elif parent_id:
            # Safely determine parent type without arbitrary collision
            if Project.objects.filter(id=parent_id).exists():
                qs = qs.filter(project_id=parent_id)
            elif SubCompany.objects.filter(id=parent_id).exists():
                qs = qs.filter(Q(sub_company_id=parent_id) | Q(project__sub_company_id=parent_id))
            elif MainCompany.objects.filter(id=parent_id).exists():
                qs = qs.filter(main_company_id=parent_id, project__isnull=True, sub_company__isnull=True)
            else:
                qs = qs.none()

        if scope and not scope.is_unrestricted:
            allowed = scope.circle_ids or set()
            qs = qs.filter(id__in=allowed)

        return [
            {
                "id": o.id,
                "name": o.name,
                "code": o.code,
                "region": o.region,
                "parent_id": o.project_id or o.sub_company_id or o.main_company_id,
                "parent_type": (
                    "PROJECT" if o.project_id
                    else "SUB_COMPANY" if o.sub_company_id
                    else "MAIN_COMPANY" if o.main_company_id
                    else None
                ),
                "parent_name": (
                    o.project.name if o.project
                    else o.sub_company.name if o.sub_company
                    else o.main_company.name if o.main_company
                    else None
                ),
                "project_name": o.project.name if o.project else None,
                "project_id": o.project_id,
                "sub_company_name": (
                    o.project.sub_company.name if o.project and o.project.sub_company
                    else o.sub_company.name if o.sub_company
                    else None
                ),
                "sub_company_id": (
                    o.project.sub_company_id if o.project
                    else o.sub_company_id
                ),
                "main_company_name": (
                    o.project.sub_company.main_company.name if o.project and o.project.sub_company and o.project.sub_company.main_company
                    else o.sub_company.main_company.name if o.sub_company and o.sub_company.main_company
                    else o.main_company.name if o.main_company
                    else None
                ),
                "main_company_id": (
                    o.project.sub_company.main_company_id if o.project and o.project.sub_company
                    else o.sub_company.main_company_id if o.sub_company
                    else o.main_company_id
                ),
                "is_direct": bool(o.main_company_id and not o.project_id and not o.sub_company_id),
            }
            for o in qs.select_related(
                "project",
                "project__sub_company",
                "project__sub_company__main_company",
                "sub_company",
                "sub_company__main_company",
                "main_company"
            ).order_by("name")
        ]

    elif level == "DOMAIN":
        qs = Domain.objects.filter(status="ACTIVE")
        if parent_id:
            qs = qs.filter(Q(circle_id=parent_id) | Q(circle_id__isnull=True))
        if scope and not scope.is_unrestricted:
            allowed = scope.domain_ids or set()
            qs = qs.filter(id__in=allowed)
        return [{"id": o.id, "name": o.name, "code": o.code, "parent_id": o.circle_id} for o in qs.order_by("display_order", "name")]

    elif level == "DEPARTMENT":
        qs = Department.objects.filter(status="ACTIVE")
        if parent_id:
            qs = qs.filter(domain_id=parent_id)
        if scope and not scope.is_unrestricted:
            allowed = scope.department_ids or set()
            qs = qs.filter(id__in=allowed)
        return [{"id": o.id, "name": o.name, "code": o.code, "parent_id": o.domain_id} for o in qs.order_by("display_order", "name")]

    elif level in ("SUB_DEPARTMENT", "TEAM"):
        qs = SubDepartment.objects.filter(status="ACTIVE")
        if parent_id:
            qs = qs.filter(department_id=parent_id)
        if scope and not scope.is_unrestricted:
            allowed = scope.team_ids or set()
            qs = qs.filter(id__in=allowed)
        return [{"id": o.id, "name": o.name, "code": o.code, "parent_id": o.department_id} for o in qs.order_by("display_order", "name")]

    elif level == "USER":
        qs = User.objects.filter(is_active=True)
        if parent_id:
            qs = qs.filter(sub_department_id=parent_id)
        if scope and not scope.is_unrestricted:
            allowed = scope.user_ids or set()
            qs = qs.filter(id__in=allowed)
        return [{"id": o.id, "name": o.get_full_name() or o.username, "code": o.username, "parent_id": getattr(o, "sub_department_id", None)} for o in qs.order_by("username")]

    return []


def get_node_details(level: str, node_id: int, user=None) -> Optional[Dict[str, Any]]:
    """
    Returns full metadata, direct children, parent, hierarchy_context, and audit history for a single node.
    Enforces user authorization scope.
    """
    level = level.upper()
    cfg = HIERARCHY_CONFIG.get(level)
    if not cfg:
        return None

    scope = None
    if user:
        from common.permissions.authorization import AuthorizationService
        scope = AuthorizationService.get_user_hierarchy_scope(user)
        if not scope.is_unrestricted:
            if level == "CIRCLE" and not scope.is_circle_allowed(node_id):
                return None
            elif level == "DOMAIN" and not scope.is_domain_allowed(node_id):
                return None
            elif level == "DEPARTMENT" and not scope.is_department_allowed(node_id):
                return None
            elif level in ("SUB_DEPARTMENT", "TEAM") and not scope.is_team_allowed(node_id):
                return None
            elif level == "USER" and not scope.is_user_allowed(node_id):
                return None
            elif level == "MAIN_COMPANY":
                allowed = (scope.main_company_ids or set()) | scope.ancestor_main_company_ids
                if node_id not in allowed:
                    return None
            elif level == "SUB_COMPANY":
                allowed = (scope.sub_company_ids or set()) | scope.ancestor_sub_company_ids
                if node_id not in allowed:
                    return None
            elif level == "PROJECT":
                allowed = (scope.project_ids or set()) | scope.ancestor_project_ids
                if node_id not in allowed:
                    return None

    if level == "USER":
        try:
            u = User.objects.select_related(
                "sub_department__department__domain__circle__project__sub_company__main_company",
                "circle__project__sub_company__main_company"
            ).get(id=node_id)
        except User.DoesNotExist:
            return None

        parent_info = None
        if u.sub_department:
            parent_info = {
                "level": "SUB_DEPARTMENT",
                "id": u.sub_department.id,
                "name": u.sub_department.name,
                "code": u.sub_department.code,
            }
        elif u.circle:
            parent_info = {
                "level": "CIRCLE",
                "id": u.circle.id,
                "name": u.circle.name,
                "code": u.circle.code,
            }

        return {
            "id": u.id,
            "level": "USER",
            "name": u.get_full_name() or u.username,
            "code": u.username,
            "description": f"Role: {u.role} | Designation: {u.designation or 'N/A'} | Email: {u.email}",
            "status": u.status,
            "created_at": getattr(u, "date_joined", None),
            "updated_at": None,
            "config": HIERARCHY_CONFIG["USER"],
            "parent": parent_info,
            "children": [],
            "children_count": 0,
            "allowed_child_level": None,
            "audits": [],
            "hierarchy_context": get_node_hierarchy_context("USER", u),
            "user_data": {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": u.role,
                "designation": u.designation,
                "department": u.department,
                "status": u.status,
            }
        }

    model_map = {
        "MAIN_COMPANY": MainCompany,
        "SUB_COMPANY": SubCompany,
        "PROJECT": Project,
        "CIRCLE": Circle,
        "DOMAIN": Domain,
        "DEPARTMENT": Department,
        "SUB_DEPARTMENT": SubDepartment,
        "TEAM": SubDepartment,
    }

    model = model_map.get(level)
    if not model:
        return None

    try:
        obj: Any = model.objects.get(id=node_id)
    except model.DoesNotExist:
        return None

    parent_info = None
    if level == "CIRCLE":
        if getattr(obj, "project", None):
            parent_info = {
                "level": "PROJECT",
                "id": obj.project.id,
                "name": obj.project.name,
                "code": obj.project.code,
            }
        elif getattr(obj, "main_company", None):
            parent_info = {
                "level": "MAIN_COMPANY",
                "id": obj.main_company.id,
                "name": obj.main_company.name,
                "code": obj.main_company.code,
            }
    elif cfg["parent_level"]:
        parent_attr = {
            "SUB_COMPANY": "main_company",
            "PROJECT": "sub_company",
            "DOMAIN": "circle",
            "DEPARTMENT": "domain",
            "SUB_DEPARTMENT": "department",
            "TEAM": "department",
        }.get(level)

        if parent_attr:
            p_obj = getattr(obj, parent_attr, None)
            if p_obj:
                parent_info = {
                    "level": cfg["parent_level"],
                    "id": p_obj.id,
                    "name": p_obj.name,
                    "code": p_obj.code,
                }

    # Direct children (filtered by scope)
    children = []
    if level == "MAIN_COMPANY":
        sc_qs = obj.sub_companies.all().order_by("name")
        cir_qs = obj.circles.filter(project__isnull=True, sub_company__isnull=True).order_by("name")
        if scope and not scope.is_unrestricted:
            allowed_sc = (scope.sub_company_ids or set()) | scope.ancestor_sub_company_ids
            sc_qs = sc_qs.filter(id__in=allowed_sc)
            cir_qs = scope.filter_circles(cir_qs)

        children = [
            {
                "id": c.id,
                "name": c.name,
                "code": c.code,
                "status": c.status,
                "level": "SUB_COMPANY",
            }
            for c in sc_qs
        ] + [
            {
                "id": c.id,
                "name": c.name,
                "code": c.code,
                "status": c.status,
                "level": "CIRCLE",
            }
            for c in cir_qs
        ]
    elif level == "SUB_COMPANY":
        p_qs = obj.projects.all().order_by("name")
        cir_qs = obj.direct_circles.filter(project__isnull=True).order_by("name")
        if scope and not scope.is_unrestricted:
            allowed_p = (scope.project_ids or set()) | scope.ancestor_project_ids
            p_qs = p_qs.filter(id__in=allowed_p)
            cir_qs = scope.filter_circles(cir_qs)

        children = [
            {
                "id": p.id,
                "name": p.name,
                "code": p.code,
                "status": p.status,
                "level": "PROJECT",
            }
            for p in p_qs
        ] + [
            {
                "id": c.id,
                "name": c.name,
                "code": c.code,
                "status": c.status,
                "level": "CIRCLE",
            }
            for c in cir_qs
        ]
    elif cfg["child_level"]:
        if level in ("SUB_DEPARTMENT", "TEAM"):
            user_qs = obj.users.all().order_by("username")
            if scope and not scope.is_unrestricted:
                user_qs = scope.filter_users(user_qs)
            children = [
                {
                    "id": u.id,
                    "name": u.get_full_name() or u.username,
                    "code": u.username,
                    "status": u.status,
                    "level": "USER",
                    "email": u.email,
                    "role": u.role,
                    "designation": u.designation,
                }
                for u in user_qs
            ]
        else:
            child_attr = {
                "PROJECT": "circles",
                "CIRCLE": "domains",
                "DOMAIN": "departments",
                "DEPARTMENT": "sub_departments",
            }.get(level)

            if child_attr and hasattr(obj, child_attr):
                child_qs = getattr(obj, child_attr).all().order_by("name")
                if scope and not scope.is_unrestricted:
                    if cfg["child_level"] == "CIRCLE":
                        child_qs = scope.filter_circles(child_qs)
                    elif cfg["child_level"] == "DOMAIN":
                        child_qs = scope.filter_domains(child_qs)
                    elif cfg["child_level"] == "DEPARTMENT":
                        child_qs = scope.filter_departments(child_qs)
                    elif cfg["child_level"] in ("SUB_DEPARTMENT", "TEAM"):
                        child_qs = scope.filter_teams(child_qs)

                children = [
                    {
                        "id": c.id,
                        "name": c.name,
                        "code": c.code,
                        "status": c.status,
                        "level": cfg["child_level"],
                    }
                    for c in child_qs
                ]

    # Hierarchy summary for MAIN_COMPANY, SUB_COMPANY, and PROJECT
    hierarchy_summary = None
    if level == "MAIN_COMPANY":
        sc_qs = obj.sub_companies.filter(status="ACTIVE").order_by("name")
        p_qs = Project.objects.filter(sub_company__main_company_id=obj.id, status="ACTIVE").select_related("sub_company").order_by("name")
        direct_cir_qs = Circle.objects.filter(
            main_company_id=obj.id,
            project__isnull=True,
            sub_company__isnull=True,
            status="ACTIVE"
        ).order_by("name")
        sub_co_cir_qs = Circle.objects.filter(
            Q(project__sub_company__main_company_id=obj.id) | Q(sub_company__main_company_id=obj.id),
            status="ACTIVE"
        ).select_related("project", "project__sub_company", "sub_company").order_by("name")

        if scope and not scope.is_unrestricted:
            allowed_sc = (scope.sub_company_ids or set()) | scope.ancestor_sub_company_ids
            sc_qs = sc_qs.filter(id__in=allowed_sc)
            allowed_p = (scope.project_ids or set()) | scope.ancestor_project_ids
            p_qs = p_qs.filter(id__in=allowed_p)
            direct_cir_qs = scope.filter_circles(direct_cir_qs)
            sub_co_cir_qs = scope.filter_circles(sub_co_cir_qs)

        sc_list = []
        for s in sc_qs:
            sc_projs = p_qs.filter(sub_company_id=s.id)
            sc_circs = sub_co_cir_qs.filter(Q(sub_company_id=s.id) | Q(project__sub_company_id=s.id))
            sc_list.append({
                "id": s.id,
                "name": s.name,
                "code": s.code,
                "status": s.status,
                "projects_count": sc_projs.count(),
                "circles_count": sc_circs.count(),
            })

        p_list = [{
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "sub_company_id": p.sub_company_id,
            "sub_company_name": p.sub_company.name,
            "status": p.status,
            "circles_count": sub_co_cir_qs.filter(project_id=p.id).count(),
        } for p in p_qs]

        direct_c_list = [{
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "region": c.region,
            "parent_id": obj.id,
            "parent_type": "MAIN_COMPANY",
            "parent_name": obj.name,
            "project_name": None,
            "is_direct": True,
            "status": c.status,
        } for c in direct_cir_qs]

        sub_co_c_list = [{
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "region": c.region,
            "parent_id": c.project_id or c.sub_company_id,
            "parent_type": "PROJECT" if c.project_id else "SUB_COMPANY",
            "parent_name": c.project.name if c.project else c.sub_company.name if c.sub_company else None,
            "project_id": c.project_id,
            "project_name": c.project.name if c.project else None,
            "sub_company_id": c.project.sub_company_id if c.project else c.sub_company_id,
            "sub_company_name": c.project.sub_company.name if c.project else c.sub_company.name if c.sub_company else None,
            "is_direct": False,
            "status": c.status,
        } for c in sub_co_cir_qs]

        hierarchy_summary = {
            "level": "MAIN_COMPANY",
            "company_name": obj.name,
            "company_code": obj.code,
            "sub_companies_count": len(sc_list),
            "projects_count": len(p_list),
            "circles_count": len(direct_c_list),
            "direct_circles_count": len(direct_c_list),
            "sub_company_circles_count": len(sub_co_c_list),
            "total_descendant_circles_count": len(direct_c_list) + len(sub_co_c_list),
            "sub_companies": sc_list,
            "projects": p_list,
            "circles": direct_c_list,
            "direct_circles": direct_c_list,
            "sub_company_circles": sub_co_c_list,
        }
    elif level == "SUB_COMPANY":
        p_qs = obj.projects.filter(status="ACTIVE").order_by("name")
        direct_cir_qs = Circle.objects.filter(sub_company_id=obj.id, project__isnull=True, status="ACTIVE").order_by("name")
        proj_cir_qs = Circle.objects.filter(project__sub_company_id=obj.id, status="ACTIVE").select_related("project").order_by("name")

        if scope and not scope.is_unrestricted:
            allowed_p = (scope.project_ids or set()) | scope.ancestor_project_ids
            p_qs = p_qs.filter(id__in=allowed_p)
            direct_cir_qs = scope.filter_circles(direct_cir_qs)
            proj_cir_qs = scope.filter_circles(proj_cir_qs)

        p_list = [{
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "status": p.status,
            "circles_count": proj_cir_qs.filter(project_id=p.id).count(),
        } for p in p_qs]

        direct_c_list = [{
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "region": c.region,
            "parent_id": obj.id,
            "parent_type": "SUB_COMPANY",
            "parent_name": obj.name,
            "project_name": None,
            "is_direct": True,
            "status": c.status,
        } for c in direct_cir_qs]

        proj_c_list = [{
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "region": c.region,
            "parent_id": c.project_id,
            "parent_type": "PROJECT",
            "parent_name": c.project.name if c.project else None,
            "project_id": c.project_id,
            "project_name": c.project.name if c.project else None,
            "is_direct": False,
            "status": c.status,
        } for c in proj_cir_qs]

        all_sub_c_list = direct_c_list + proj_c_list

        hierarchy_summary = {
            "level": "SUB_COMPANY",
            "company_name": obj.name,
            "company_code": obj.code,
            "main_company": {
                "id": obj.main_company.id,
                "name": obj.main_company.name,
                "code": obj.main_company.code,
            } if getattr(obj, "main_company", None) else None,
            "projects_count": len(p_list),
            "circles_count": len(all_sub_c_list),
            "direct_circles_count": len(direct_c_list),
            "project_circles_count": len(proj_c_list),
            "projects": p_list,
            "circles": all_sub_c_list,
            "direct_circles": direct_c_list,
            "project_circles": proj_c_list,
        }
    elif level == "PROJECT":
        cir_qs = obj.circles.filter(status="ACTIVE").order_by("name")
        if scope and not scope.is_unrestricted:
            cir_qs = scope.filter_circles(cir_qs)

        c_list = [{
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "region": c.region,
            "parent_id": obj.id,
            "parent_type": "PROJECT",
            "parent_name": obj.name,
            "project_name": obj.name,
            "is_direct": True,
            "status": c.status,
        } for c in cir_qs]

        hierarchy_summary = {
            "level": "PROJECT",
            "project_name": obj.name,
            "project_code": obj.code,
            "sub_company": {
                "id": obj.sub_company.id,
                "name": obj.sub_company.name,
                "code": obj.sub_company.code,
            } if getattr(obj, "sub_company", None) else None,
            "circles_count": len(c_list),
            "circles": c_list,
        }

    # Audit history for this node
    audits = HierarchyAuditLog.objects.filter(
        level__in=[level, "SUB_DEPARTMENT" if level == "TEAM" else level],
        object_id=str(node_id)
    ).order_by("-timestamp")[:10]

    return {
        "id": obj.id,
        "level": level,
        "name": obj.name,
        "code": obj.code,
        "description": getattr(obj, "description", ""),
        "status": getattr(obj, "status", "ACTIVE"),
        "created_at": getattr(obj, "created_at", None),
        "updated_at": getattr(obj, "updated_at", None),
        "config": cfg,
        "parent": parent_info,
        "children": children,
        "children_count": len(children),
        "allowed_child_level": cfg["child_level"],
        "hierarchy_context": get_node_hierarchy_context(level, obj),
        "hierarchy_summary": hierarchy_summary,
        "audits": [
            {
                "action": a.action,
                "timestamp": a.timestamp,
                "user": a.user.username if a.user else "System",
                "details": a.details,
            }
            for a in audits
        ],
    }


def search_hierarchy(query: str, user=None) -> List[Dict[str, Any]]:
    """
    Searches across hierarchy entities matching query in name or code, filtered by user scope.
    """
    if not query or len(query.strip()) < 2:
        return []

    q = query.strip()
    scope = None
    if user:
        from common.permissions.authorization import AuthorizationService
        scope = AuthorizationService.get_user_hierarchy_scope(user)

    results = []

    mc_qs = MainCompany.objects.filter(Q(name__icontains=q) | Q(code__icontains=q))
    if scope and not scope.is_unrestricted:
        allowed = (scope.main_company_ids or set()) | scope.ancestor_main_company_ids
        mc_qs = mc_qs.filter(id__in=allowed)
    for mc in mc_qs[:5]:
        results.append({"id": mc.id, "name": mc.name, "code": mc.code, "level": "MAIN_COMPANY", "badge": "Main Company"})

    sc_qs = SubCompany.objects.filter(Q(name__icontains=q) | Q(code__icontains=q))
    if scope and not scope.is_unrestricted:
        allowed = (scope.sub_company_ids or set()) | scope.ancestor_sub_company_ids
        sc_qs = sc_qs.filter(id__in=allowed)
    for sc in sc_qs[:5]:
        results.append({"id": sc.id, "name": sc.name, "code": sc.code, "level": "SUB_COMPANY", "badge": "Sub Company", "parent": sc.main_company.name})

    prj_qs = Project.objects.filter(Q(name__icontains=q) | Q(code__icontains=q))
    if scope and not scope.is_unrestricted:
        allowed = (scope.project_ids or set()) | scope.ancestor_project_ids
        prj_qs = prj_qs.filter(id__in=allowed)
    for prj in prj_qs[:5]:
        results.append({"id": prj.id, "name": prj.name, "code": prj.code, "level": "PROJECT", "badge": "Project", "parent": prj.sub_company.name})

    cir_qs = Circle.objects.filter(Q(name__icontains=q) | Q(code__icontains=q))
    if scope and not scope.is_unrestricted:
        cir_qs = scope.filter_circles(cir_qs)
    for cir in cir_qs[:5]:
        results.append({"id": cir.id, "name": cir.name, "code": cir.code, "level": "CIRCLE", "badge": "Circle", "parent": cir.project.name if cir.project else ""})

    dom_qs = Domain.objects.filter(Q(name__icontains=q) | Q(code__icontains=q))
    if scope and not scope.is_unrestricted:
        dom_qs = scope.filter_domains(dom_qs)
    for dom in dom_qs[:5]:
        results.append({"id": dom.id, "name": dom.name, "code": dom.code, "level": "DOMAIN", "badge": "Domain", "parent": dom.circle.name if dom.circle else ""})

    dept_qs = Department.objects.filter(Q(name__icontains=q) | Q(code__icontains=q))
    if scope and not scope.is_unrestricted:
        dept_qs = scope.filter_departments(dept_qs)
    for dept in dept_qs[:5]:
        results.append({"id": dept.id, "name": dept.name, "code": dept.code, "level": "DEPARTMENT", "badge": "Department", "parent": dept.domain.name if dept.domain else ""})

    subdept_qs = SubDepartment.objects.filter(Q(name__icontains=q) | Q(code__icontains=q))
    if scope and not scope.is_unrestricted:
        subdept_qs = scope.filter_teams(subdept_qs)
    for subdept in subdept_qs[:5]:
        results.append({"id": subdept.id, "name": subdept.name, "code": subdept.code, "level": "SUB_DEPARTMENT", "badge": "Team", "parent": subdept.department.name if subdept.department else ""})

    u_qs = User.objects.filter(Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(email__icontains=q))
    if scope and not scope.is_unrestricted:
        u_qs = scope.filter_users(u_qs)
    for u in u_qs[:5]:
        results.append({
            "id": u.id,
            "name": u.get_full_name() or u.username,
            "code": u.username,
            "level": "USER",
            "badge": "User",
            "parent": u.sub_department.name if u.sub_department else (u.circle.name if u.circle else "")
        })

    return results

