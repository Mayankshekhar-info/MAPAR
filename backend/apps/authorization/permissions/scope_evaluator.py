"""
Dynamic Hierarchy-Aware Scope Evaluator for MAPAR-v2.
Encapsulates 7-tier downward scope inheritance:
Main Company -> Sub Company -> Project -> Circle -> Domain -> Department -> Team -> Users

Calculates effective access boundaries:
User -> Role (Permissions) -> Organization Scope (Anchor Node) -> Authorized Descendants
Enforces strict sibling isolation and cross-branch protection.
"""

from dataclasses import dataclass, field
from typing import Set, Optional, Dict, Any, List
from django.db.models import Q, QuerySet


@dataclass
class UserHierarchyScope:
    """
    Resolved organizational access boundary for an authenticated user.
    Supports single or multiple organization scopes with granular actions.
    """
    is_unrestricted: bool
    scope_level: Optional[str] = None  # MAIN_COMPANY, SUB_COMPANY, PROJECT, CIRCLE, DOMAIN, DEPARTMENT, TEAM, MULTI_SCOPE, None
    anchor_id: Optional[int] = None
    anchor_name: Optional[str] = None
    scopes_count: int = 1
    
    # Authorized ID sets (None if is_unrestricted is True, otherwise Set[int])
    main_company_ids: Optional[Set[int]] = None
    sub_company_ids: Optional[Set[int]] = None
    project_ids: Optional[Set[int]] = None
    circle_ids: Optional[Set[int]] = None
    domain_ids: Optional[Set[int]] = None
    department_ids: Optional[Set[int]] = None
    team_ids: Optional[Set[int]] = None  # sub_department_ids
    user_ids: Optional[Set[int]] = None

    # Manageable ID sets (subsets where user has manage / create / update / delete rights)
    manageable_main_company_ids: Set[int] = field(default_factory=set)
    manageable_sub_company_ids: Set[int] = field(default_factory=set)
    manageable_project_ids: Set[int] = field(default_factory=set)
    manageable_circle_ids: Set[int] = field(default_factory=set)
    manageable_domain_ids: Set[int] = field(default_factory=set)
    manageable_department_ids: Set[int] = field(default_factory=set)
    manageable_team_ids: Set[int] = field(default_factory=set)
    manageable_user_ids: Set[int] = field(default_factory=set)

    # Ancestor context for minimal breadcrumbs/navigation (IDs of parent chain above anchor)
    ancestor_main_company_ids: Set[int] = field(default_factory=set)
    ancestor_sub_company_ids: Set[int] = field(default_factory=set)
    ancestor_project_ids: Set[int] = field(default_factory=set)
    ancestor_circle_ids: Set[int] = field(default_factory=set)
    ancestor_domain_ids: Set[int] = field(default_factory=set)
    ancestor_department_ids: Set[int] = field(default_factory=set)

    def is_main_company_allowed(self, mc_id: Optional[int], action: str = "view") -> bool:
        if self.is_unrestricted:
            return True
        if mc_id is None:
            return False
        if action in ("manage", "edit", "create", "update", "delete"):
            return mc_id in self.manageable_main_company_ids
        return (self.main_company_ids is not None and mc_id in self.main_company_ids) or mc_id in self.ancestor_main_company_ids

    def is_sub_company_allowed(self, sc_id: Optional[int], action: str = "view") -> bool:
        if self.is_unrestricted:
            return True
        if sc_id is None:
            return False
        if action in ("manage", "edit", "create", "update", "delete"):
            return sc_id in self.manageable_sub_company_ids
        return (self.sub_company_ids is not None and sc_id in self.sub_company_ids) or sc_id in self.ancestor_sub_company_ids

    def is_project_allowed(self, prj_id: Optional[int], action: str = "view") -> bool:
        if self.is_unrestricted:
            return True
        if prj_id is None:
            return False
        if action in ("manage", "edit", "create", "update", "delete"):
            return prj_id in self.manageable_project_ids
        return (self.project_ids is not None and prj_id in self.project_ids) or prj_id in self.ancestor_project_ids

    def is_circle_allowed(self, circle_id: Optional[int], action: str = "view") -> bool:
        if self.is_unrestricted:
            return True
        if circle_id is None:
            return False
        if action in ("manage", "edit", "create", "update", "delete"):
            return circle_id in self.manageable_circle_ids
        return self.circle_ids is not None and circle_id in self.circle_ids

    def is_domain_allowed(self, domain_id: Optional[int], action: str = "view") -> bool:
        if self.is_unrestricted:
            return True
        if domain_id is None:
            return False
        if action in ("manage", "edit", "create", "update", "delete"):
            return domain_id in self.manageable_domain_ids
        return self.domain_ids is not None and domain_id in self.domain_ids

    def is_department_allowed(self, department_id: Optional[int], action: str = "view") -> bool:
        if self.is_unrestricted:
            return True
        if department_id is None:
            return False
        if action in ("manage", "edit", "create", "update", "delete"):
            return department_id in self.manageable_department_ids
        return self.department_ids is not None and department_id in self.department_ids

    def is_team_allowed(self, team_id: Optional[int], action: str = "view") -> bool:
        if self.is_unrestricted:
            return True
        if team_id is None:
            return False
        if action in ("manage", "edit", "create", "update", "delete"):
            return team_id in self.manageable_team_ids
        return self.team_ids is not None and team_id in self.team_ids

    def is_user_allowed(self, user_obj_or_id: Any, action: str = "view") -> bool:
        if self.is_unrestricted:
            return True
        if user_obj_or_id is None:
            return False
        uid = user_obj_or_id.id if hasattr(user_obj_or_id, "id") else int(user_obj_or_id)
        if action in ("manage", "edit", "create", "update", "delete"):
            return uid in self.manageable_user_ids or uid in (self.user_ids or set())
        return self.user_ids is not None and uid in self.user_ids

    def filter_users(self, qs: QuerySet) -> QuerySet:
        if self.is_unrestricted:
            return qs
        if self.user_ids is None or len(self.user_ids) == 0:
            return qs.none()
        return qs.filter(id__in=self.user_ids)

    def filter_circles(self, qs: QuerySet) -> QuerySet:
        if self.is_unrestricted:
            return qs
        if self.circle_ids is None or len(self.circle_ids) == 0:
            return qs.none()
        return qs.filter(id__in=self.circle_ids)

    def filter_domains(self, qs: QuerySet) -> QuerySet:
        if self.is_unrestricted:
            return qs
        if self.domain_ids is None or len(self.domain_ids) == 0:
            return qs.none()
        return qs.filter(id__in=self.domain_ids)

    def filter_departments(self, qs: QuerySet) -> QuerySet:
        if self.is_unrestricted:
            return qs
        if self.department_ids is None or len(self.department_ids) == 0:
            return qs.none()
        return qs.filter(id__in=self.department_ids)

    def filter_teams(self, qs: QuerySet) -> QuerySet:
        if self.is_unrestricted:
            return qs
        if self.team_ids is None or len(self.team_ids) == 0:
            return qs.none()
        return qs.filter(id__in=self.team_ids)


class HierarchyScopeEvaluator:
    """
    Computes effective downward hierarchy boundary for any user.
    Purely database-backed, zero hard-coded roles or organization IDs.
    Supports one or multiple organization scopes with downward inheritance and sibling isolation.
    """

    @classmethod
    def _traverse_downward(cls, anchor_level: str, anchor_id: int):
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

        main_company_ids: Set[int] = set()
        sub_company_ids: Set[int] = set()
        project_ids: Set[int] = set()
        circle_ids: Set[int] = set()
        domain_ids: Set[int] = set()
        department_ids: Set[int] = set()
        team_ids: Set[int] = set()
        user_ids: Set[int] = set()

        ancestor_main: Set[int] = set()
        ancestor_sub: Set[int] = set()
        ancestor_prj: Set[int] = set()
        ancestor_cir: Set[int] = set()
        ancestor_dom: Set[int] = set()
        ancestor_dept: Set[int] = set()

        if anchor_level == "MAIN_COMPANY":
            main_company_ids.add(anchor_id)
            sub_company_ids.update(SubCompany.objects.filter(main_company_id=anchor_id).values_list("id", flat=True))
            project_ids.update(Project.objects.filter(sub_company__main_company_id=anchor_id).values_list("id", flat=True))
            circle_ids.update(Circle.objects.filter(
                Q(project__sub_company__main_company_id=anchor_id) | Q(main_company_id=anchor_id)
            ).values_list("id", flat=True))
            domain_ids.update(Domain.objects.filter(
                Q(circle__project__sub_company__main_company_id=anchor_id)
                | Q(circle__main_company_id=anchor_id)
                | Q(circle_id__isnull=True)
            ).values_list("id", flat=True))
            department_ids.update(Department.objects.filter(domain_id__in=domain_ids).values_list("id", flat=True))
            team_ids.update(SubDepartment.objects.filter(department_id__in=department_ids).values_list("id", flat=True))
            user_ids.update(User.objects.filter(
                Q(sub_department_id__in=team_ids)
                | Q(circle_id__in=circle_ids)
            ).values_list("id", flat=True))

        elif anchor_level == "SUB_COMPANY":
            sc = SubCompany.objects.filter(id=anchor_id).first()
            if sc:
                ancestor_main.add(sc.main_company_id)
            sub_company_ids.add(anchor_id)
            project_ids.update(Project.objects.filter(sub_company_id=anchor_id).values_list("id", flat=True))
            circle_ids.update(Circle.objects.filter(project__sub_company_id=anchor_id).values_list("id", flat=True))
            domain_ids.update(Domain.objects.filter(
                Q(circle__project__sub_company_id=anchor_id) | Q(circle_id__isnull=True)
            ).values_list("id", flat=True))
            department_ids.update(Department.objects.filter(domain_id__in=domain_ids).values_list("id", flat=True))
            team_ids.update(SubDepartment.objects.filter(department_id__in=department_ids).values_list("id", flat=True))
            user_ids.update(User.objects.filter(
                Q(sub_department_id__in=team_ids)
                | Q(circle_id__in=circle_ids)
            ).values_list("id", flat=True))

        elif anchor_level == "PROJECT":
            prj = Project.objects.select_related("sub_company").filter(id=anchor_id).first()
            if prj:
                ancestor_sub.add(prj.sub_company_id)
                if prj.sub_company:
                    ancestor_main.add(prj.sub_company.main_company_id)
            project_ids.add(anchor_id)
            circle_ids.update(Circle.objects.filter(project_id=anchor_id).values_list("id", flat=True))
            domain_ids.update(Domain.objects.filter(
                Q(circle__project_id=anchor_id) | Q(circle_id__isnull=True)
            ).values_list("id", flat=True))
            department_ids.update(Department.objects.filter(domain_id__in=domain_ids).values_list("id", flat=True))
            team_ids.update(SubDepartment.objects.filter(department_id__in=department_ids).values_list("id", flat=True))
            user_ids.update(User.objects.filter(
                Q(sub_department_id__in=team_ids)
                | Q(circle_id__in=circle_ids)
            ).values_list("id", flat=True))

        elif anchor_level == "CIRCLE":
            cir = Circle.objects.select_related("project__sub_company", "main_company").filter(id=anchor_id).first()
            if cir:
                if cir.project and cir.project_id is not None:
                    ancestor_prj.add(cir.project_id)
                    sub_co = cir.project.sub_company
                    if sub_co and cir.project.sub_company_id is not None:
                        ancestor_sub.add(cir.project.sub_company_id)
                        if sub_co.main_company_id is not None:
                            ancestor_main.add(sub_co.main_company_id)
                elif cir.main_company_id is not None:
                    ancestor_main.add(cir.main_company_id)
            circle_ids.add(anchor_id)
            domain_ids.update(Domain.objects.filter(
                Q(circle_id=anchor_id) | Q(circle_id__isnull=True)
            ).values_list("id", flat=True))
            department_ids.update(Department.objects.filter(domain_id__in=domain_ids).values_list("id", flat=True))
            team_ids.update(SubDepartment.objects.filter(department_id__in=department_ids).values_list("id", flat=True))
            user_ids.update(User.objects.filter(
                Q(sub_department_id__in=team_ids)
                | Q(circle_id=anchor_id)
            ).values_list("id", flat=True))

        elif anchor_level == "DOMAIN":
            dom = Domain.objects.select_related("circle__project__sub_company", "circle__main_company").filter(id=anchor_id).first()
            if dom and dom.circle and dom.circle_id is not None:
                ancestor_cir.add(dom.circle_id)
                prj = dom.circle.project
                if prj and dom.circle.project_id is not None:
                    ancestor_prj.add(dom.circle.project_id)
                    sub_co = prj.sub_company
                    if sub_co and prj.sub_company_id is not None:
                        ancestor_sub.add(prj.sub_company_id)
                        if sub_co.main_company_id is not None:
                            ancestor_main.add(sub_co.main_company_id)
                elif dom.circle.main_company_id is not None:
                    ancestor_main.add(dom.circle.main_company_id)
            domain_ids.add(anchor_id)
            department_ids.update(Department.objects.filter(domain_id=anchor_id).values_list("id", flat=True))
            team_ids.update(SubDepartment.objects.filter(department__domain_id=anchor_id).values_list("id", flat=True))
            user_ids.update(User.objects.filter(
                sub_department__department__domain_id=anchor_id
            ).values_list("id", flat=True))

        elif anchor_level == "DEPARTMENT":
            dept = Department.objects.select_related("domain__circle__project__sub_company", "domain__circle__main_company").filter(id=anchor_id).first()
            if dept and dept.domain and dept.domain_id is not None:
                ancestor_dom.add(dept.domain_id)
                cir = dept.domain.circle
                if cir and dept.domain.circle_id is not None:
                    ancestor_cir.add(dept.domain.circle_id)
                    prj = cir.project
                    if prj and cir.project_id is not None:
                        ancestor_prj.add(cir.project_id)
                        sub_co = prj.sub_company
                        if sub_co and prj.sub_company_id is not None:
                            ancestor_sub.add(prj.sub_company_id)
                            if sub_co.main_company_id is not None:
                                ancestor_main.add(sub_co.main_company_id)
                    elif cir.main_company_id is not None:
                        ancestor_main.add(cir.main_company_id)
            department_ids.add(anchor_id)
            team_ids.update(SubDepartment.objects.filter(department_id=anchor_id).values_list("id", flat=True))
            user_ids.update(User.objects.filter(
                sub_department__department_id=anchor_id
            ).values_list("id", flat=True))

        elif anchor_level in ("TEAM", "SUB_DEPARTMENT"):
            sd = SubDepartment.objects.select_related("department__domain__circle__project__sub_company", "department__domain__circle__main_company").filter(id=anchor_id).first()
            if sd and sd.department and sd.department_id is not None:
                ancestor_dept.add(sd.department_id)
                dept_obj = sd.department
                dom = dept_obj.domain
                if dom and dept_obj.domain_id is not None:
                    ancestor_dom.add(dept_obj.domain_id)
                    cir = dom.circle
                    if cir and dom.circle_id is not None:
                        ancestor_cir.add(dom.circle_id)
                        prj = cir.project
                        if prj and cir.project_id is not None:
                            ancestor_prj.add(cir.project_id)
                            sub_co = prj.sub_company
                            if sub_co and prj.sub_company_id is not None:
                                ancestor_sub.add(prj.sub_company_id)
                                if sub_co.main_company_id is not None:
                                    ancestor_main.add(sub_co.main_company_id)
                        elif cir.main_company_id is not None:
                            ancestor_main.add(cir.main_company_id)
            team_ids.add(anchor_id)
            user_ids.update(User.objects.filter(sub_department_id=anchor_id).values_list("id", flat=True))

        return {
            "main_companies": main_company_ids,
            "sub_companies": sub_company_ids,
            "projects": project_ids,
            "circles": circle_ids,
            "domains": domain_ids,
            "departments": department_ids,
            "teams": team_ids,
            "users": user_ids,
            "ancestor_main": ancestor_main,
            "ancestor_sub": ancestor_sub,
            "ancestor_prj": ancestor_prj,
            "ancestor_cir": ancestor_cir,
            "ancestor_dom": ancestor_dom,
            "ancestor_dept": ancestor_dept,
        }

    @classmethod
    def resolve_user_scope(cls, user) -> UserHierarchyScope:
        if not user or not user.is_authenticated:
            return UserHierarchyScope(
                is_unrestricted=False,
                main_company_ids=set(),
                sub_company_ids=set(),
                project_ids=set(),
                circle_ids=set(),
                domain_ids=set(),
                department_ids=set(),
                team_ids=set(),
                user_ids=set(),
            )

        # 1. Check Unrestricted / Corporate Global Access
        if getattr(user, "is_superuser", False) or getattr(user, "is_superadmin", False):
            return UserHierarchyScope(is_unrestricted=True)

        if getattr(user, "role", None) == "SUPER_ADMIN":
            return UserHierarchyScope(is_unrestricted=True)

        from apps.authorization.models import UserAccessScope, UserAccessScopeCircle, UserAccessScopeDomain
        from apps.identity.models import User

        # Check explicit UserAccessScopes
        scopes = UserAccessScope.objects.filter(user=user).select_related(
            "main_company", "sub_company", "project", "circle", "domain", "department", "sub_department"
        ).prefetch_related("assigned_circles", "assigned_domains")

        for s in scopes:
            if s.scope_type in ("GLOBAL", "CORPORATE"):
                return UserHierarchyScope(is_unrestricted=True)

        # Collect all anchors across assigned scopes
        anchors_info: List[Dict[str, Any]] = []

        for s in scopes:
            anchor_lvl = None
            anchor_i = None
            anchor_nm = None

            sd_id = getattr(s, "sub_department_id", None)
            dept_id = getattr(s, "department_id", None)
            dom_id = getattr(s, "domain_id", None)
            cir_id = getattr(s, "circle_id", None)
            prj_id = getattr(s, "project_id", None)
            sub_id = getattr(s, "sub_company_id", None)
            mc_id = getattr(s, "main_company_id", None)

            is_manageable = s.can_manage or s.can_create or s.can_update or ("manage" in (s.actions or []))
            if sd_id:
                anchors_info.append({
                    "scope": s,
                    "level": "TEAM",
                    "id": sd_id,
                    "name": s.sub_department.name if getattr(s, "sub_department", None) else f"Team {sd_id}",
                    "is_manageable": is_manageable,
                })
            elif dept_id:
                anchors_info.append({
                    "scope": s,
                    "level": "DEPARTMENT",
                    "id": dept_id,
                    "name": s.department.name if getattr(s, "department", None) else f"Dept {dept_id}",
                    "is_manageable": is_manageable,
                })
            elif dom_id:
                anchors_info.append({
                    "scope": s,
                    "level": "DOMAIN",
                    "id": dom_id,
                    "name": s.domain.name if getattr(s, "domain", None) else f"Domain {dom_id}",
                    "is_manageable": is_manageable,
                })
            elif cir_id:
                anchors_info.append({
                    "scope": s,
                    "level": "CIRCLE",
                    "id": cir_id,
                    "name": s.circle.name if getattr(s, "circle", None) else f"Circle {cir_id}",
                    "is_manageable": is_manageable,
                })
            elif prj_id:
                anchors_info.append({
                    "scope": s,
                    "level": "PROJECT",
                    "id": prj_id,
                    "name": s.project.name if getattr(s, "project", None) else f"Project {prj_id}",
                    "is_manageable": is_manageable,
                })
            elif sub_id:
                anchors_info.append({
                    "scope": s,
                    "level": "SUB_COMPANY",
                    "id": sub_id,
                    "name": s.sub_company.name if getattr(s, "sub_company", None) else f"SubCompany {sub_id}",
                    "is_manageable": is_manageable,
                })
            elif mc_id:
                anchors_info.append({
                    "scope": s,
                    "level": "MAIN_COMPANY",
                    "id": mc_id,
                    "name": s.main_company.name if getattr(s, "main_company", None) else f"MainCompany {mc_id}",
                    "is_manageable": is_manageable,
                })

            # Support multiple assigned circles within circle-level scope
            if not sd_id and not dept_id and not dom_id:
                for assigned_cir in s.assigned_circles.all():
                    c_item_id = getattr(assigned_cir, "circle_id", None)
                    if c_item_id and not any(a["level"] == "CIRCLE" and a["id"] == c_item_id for a in anchors_info):
                        anchors_info.append({
                            "scope": s,
                            "level": "CIRCLE",
                            "id": c_item_id,
                            "name": assigned_cir.circle.name if getattr(assigned_cir, "circle", None) else f"Circle {c_item_id}",
                            "is_manageable": is_manageable,
                        })

            # Support multiple assigned domains within domain-level scope
            if not sd_id and not dept_id:
                for assigned_dom in s.assigned_domains.all():
                    d_item_id = getattr(assigned_dom, "domain_id", None)
                    if d_item_id and not any(a["level"] == "DOMAIN" and a["id"] == d_item_id for a in anchors_info):
                        anchors_info.append({
                            "scope": s,
                            "level": "DOMAIN",
                            "id": d_item_id,
                            "name": assigned_dom.domain.name if getattr(assigned_dom, "domain", None) else f"Domain {d_item_id}",
                            "is_manageable": is_manageable,
                        })

        # Fallback to direct user account hierarchy fields if no UserAccessScope
        if not anchors_info:
            if getattr(user, "sub_department_id", None):
                anchors_info.append({
                    "scope": None,
                    "level": "TEAM",
                    "id": user.sub_department_id,
                    "name": user.sub_department.name if user.sub_department else f"Team {user.sub_department_id}",
                    "is_manageable": True,
                })
            elif getattr(user, "circle_id", None):
                anchors_info.append({
                    "scope": None,
                    "level": "CIRCLE",
                    "id": user.circle_id,
                    "name": user.circle.name if user.circle else f"Circle {user.circle_id}",
                    "is_manageable": True,
                })

        # If user has no organization anchor assigned, they have no organization access
        if not anchors_info:
            return UserHierarchyScope(
                is_unrestricted=False,
                main_company_ids=set(),
                sub_company_ids=set(),
                project_ids=set(),
                circle_ids=set(),
                domain_ids=set(),
                department_ids=set(),
                team_ids=set(),
                user_ids=set(),
            )

        # 2. Downward Descendant Resolution & Union across all scopes
        total_main_company_ids: Set[int] = set()
        total_sub_company_ids: Set[int] = set()
        total_project_ids: Set[int] = set()
        total_circle_ids: Set[int] = set()
        total_domain_ids: Set[int] = set()
        total_department_ids: Set[int] = set()
        total_team_ids: Set[int] = set()
        total_user_ids: Set[int] = set()

        manageable_circles: Set[int] = set()
        manageable_domains: Set[int] = set()
        manageable_departments: Set[int] = set()
        manageable_teams: Set[int] = set()
        manageable_users: Set[int] = set()

        ancestor_main: Set[int] = set()
        ancestor_sub: Set[int] = set()
        ancestor_prj: Set[int] = set()
        ancestor_cir: Set[int] = set()
        ancestor_dom: Set[int] = set()
        ancestor_dept: Set[int] = set()

        for a in anchors_info:
            desc = cls._traverse_downward(a["level"], a["id"])
            total_main_company_ids.update(desc["main_companies"])
            total_sub_company_ids.update(desc["sub_companies"])
            total_project_ids.update(desc["projects"])
            total_circle_ids.update(desc["circles"])
            total_domain_ids.update(desc["domains"])
            total_department_ids.update(desc["departments"])
            total_team_ids.update(desc["teams"])
            total_user_ids.update(desc["users"])

            ancestor_main.update(desc["ancestor_main"])
            ancestor_sub.update(desc["ancestor_sub"])
            ancestor_prj.update(desc["ancestor_prj"])
            ancestor_cir.update(desc["ancestor_cir"])
            ancestor_dom.update(desc["ancestor_dom"])
            ancestor_dept.update(desc["ancestor_dept"])

            if a.get("is_manageable", False):
                manageable_circles.update(desc["circles"])
                manageable_domains.update(desc["domains"])
                manageable_departments.update(desc["departments"])
                manageable_teams.update(desc["teams"])
                manageable_users.update(desc["users"])

        # Always ensure user can see themselves
        total_user_ids.add(user.id)

        first_anchor = anchors_info[0]
        if len(anchors_info) == 1:
            scope_lvl = first_anchor["level"]
            anchor_i = first_anchor["id"]
            anchor_nm = first_anchor["name"]
        else:
            scope_lvl = "MULTI_SCOPE"
            anchor_i = None
            anchor_nm = f"{len(anchors_info)} Assigned Scopes"

        return UserHierarchyScope(
            is_unrestricted=False,
            scope_level=scope_lvl,
            anchor_id=anchor_i,
            anchor_name=anchor_nm,
            scopes_count=len(scopes) if scopes else len(anchors_info),
            main_company_ids=total_main_company_ids,
            sub_company_ids=total_sub_company_ids,
            project_ids=total_project_ids,
            circle_ids=total_circle_ids,
            domain_ids=total_domain_ids,
            department_ids=total_department_ids,
            team_ids=total_team_ids,
            user_ids=total_user_ids,
            manageable_circle_ids=manageable_circles,
            manageable_domain_ids=manageable_domains,
            manageable_department_ids=manageable_departments,
            manageable_team_ids=manageable_teams,
            manageable_user_ids=manageable_users,
            ancestor_main_company_ids=ancestor_main,
            ancestor_sub_company_ids=ancestor_sub,
            ancestor_project_ids=ancestor_prj,
            ancestor_circle_ids=ancestor_cir,
            ancestor_domain_ids=ancestor_dom,
            ancestor_department_ids=ancestor_dept,
        )
