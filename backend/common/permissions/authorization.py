"""
Central Authorization Engine for MAPAR-v2.
Provides authoritative policy evaluation for:
- Role permissions (WHAT a user can do)
- Access scopes (WHERE a user can do it)
- Effective permissions and accessible navigation modules
"""

from typing import Any, List, Optional, Set
from django.db.models import Q


class AuthorizationService:
    """
    Central authorization entry point.
    Evaluates:
        User + Role + Permissions + Organization Scope -> Effective Access
    """

    @classmethod
    def get_user_hierarchy_scope(cls, user):
        """
        Resolves the 7-tier downward access scope for the user:
        Scope Anchor Node -> Authorized Descendants
        """
        from apps.authorization.permissions.scope_evaluator import HierarchyScopeEvaluator
        return HierarchyScopeEvaluator.resolve_user_scope(user)

    @classmethod
    def require_organization_access(
        cls,
        *,
        user,
        circle_id: Optional[int] = None,
        domain_id: Optional[int] = None,
        department_id: Optional[int] = None,
        team_id: Optional[int] = None,
        target_user: Any = None,
        action: str = "view",
        error_message: str = "Access denied: requested organization resource is outside your authorized scope."
    ):
        """
        Enforces server-side cross-branch isolation. Raises 403 PermissionDenied if out of scope.
        """
        if not user or not user.is_authenticated:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(detail="Authentication required.")

        scope = cls.get_user_hierarchy_scope(user)
        if scope.is_unrestricted:
            return

        from rest_framework.exceptions import PermissionDenied
        if circle_id is not None and not scope.is_circle_allowed(circle_id, action=action):
            raise PermissionDenied(detail=error_message)

        if domain_id is not None and not scope.is_domain_allowed(domain_id, action=action):
            raise PermissionDenied(detail=error_message)

        if department_id is not None and not scope.is_department_allowed(department_id, action=action):
            raise PermissionDenied(detail=error_message)

        if team_id is not None and not scope.is_team_allowed(team_id, action=action):
            raise PermissionDenied(detail=error_message)

        if target_user is not None and not scope.is_user_allowed(target_user, action=action):
            raise PermissionDenied(detail=error_message)

    @classmethod
    def can(cls, user=None, permission: str = "", resource=None, action: str = "view", **kwargs) -> bool:
        if user is None and "user" in kwargs:
            user = kwargs["user"]
        if not permission and "permission" in kwargs:
            permission = kwargs["permission"]
        if resource is None and "hierarchy_context" in kwargs:
            resource = kwargs["hierarchy_context"]
        if not user or not user.is_authenticated:
            return False

        # Super Admin / Superuser has full platform access
        if user.is_superuser or getattr(user, "role", None) == "SUPER_ADMIN":
            return True

        # Check module permission dimension (NO_ACCESS / READ / WRITE)
        if "." in permission:
            mod_code = permission.split(".", 1)[0]
            from apps.authorization.models import UserModulePermission
            ump = UserModulePermission.objects.filter(user=user, module__code=mod_code).first()
            if ump:
                if ump.access_level == UserModulePermission.AccessLevel.NO_ACCESS:
                    return False
                if ump.access_level == UserModulePermission.AccessLevel.READ and action in ("create", "edit", "update", "delete", "manage"):
                    return False

        # Check effective permissions (WHAT the user can do)
        perms = cls.get_user_effective_permissions(user)
        if permission not in perms and "*.*" not in perms:
            return False

        # Check organization scope boundary (WHERE the user can do it)
        if resource is not None:
            scope = cls.get_user_hierarchy_scope(user)
            if not scope.is_unrestricted:
                if isinstance(resource, dict):
                    mc_id = resource.get("main_company_id")
                    sc_id = resource.get("sub_company_id")
                    prj_id = resource.get("project_id")
                    circle_id = resource.get("circle_id")
                    domain_id = resource.get("domain_id")
                    dept_id = resource.get("department_id")
                    team_id = resource.get("sub_department_id") or resource.get("team_id")
                else:
                    mc_id = getattr(resource, "main_company_id", None)
                    if mc_id is None and hasattr(resource, "_meta") and resource._meta.model_name == "maincompany":
                        mc_id = resource.id
                    sc_id = getattr(resource, "sub_company_id", None)
                    if sc_id is None and hasattr(resource, "_meta") and resource._meta.model_name == "subcompany":
                        sc_id = resource.id
                    prj_id = getattr(resource, "project_id", None)
                    if prj_id is None and hasattr(resource, "_meta") and resource._meta.model_name == "project":
                        prj_id = resource.id
                    circle_id = getattr(resource, "circle_id", None)
                    if circle_id is None and hasattr(resource, "_meta") and resource._meta.model_name == "circle":
                        circle_id = resource.id
                    domain_id = getattr(resource, "domain_id", None)
                    if domain_id is None and hasattr(resource, "_meta") and resource._meta.model_name == "domain":
                        domain_id = resource.id
                    dept_id = getattr(resource, "department_id", None)
                    if dept_id is None and hasattr(resource, "_meta") and resource._meta.model_name == "department":
                        dept_id = resource.id
                    team_id = getattr(resource, "sub_department_id", None) or getattr(resource, "team_id", None)
                    if team_id is None and hasattr(resource, "_meta") and resource._meta.model_name == "subdepartment":
                        team_id = resource.id

                # Direct check on main company
                if mc_id is not None and not scope.is_main_company_allowed(mc_id, action=action):
                    return False

                # Direct check on sub company
                if sc_id is not None and not scope.is_sub_company_allowed(sc_id, action=action):
                    return False

                # Direct check on project
                if prj_id is not None and not scope.is_project_allowed(prj_id, action=action):
                    return False

                # Direct check on circle
                if circle_id is not None and not scope.is_circle_allowed(circle_id, action=action):
                    return False

                # Direct check on domain
                if domain_id is not None and not scope.is_domain_allowed(domain_id, action=action):
                    return False

                # Direct check on department
                if dept_id is not None and not scope.is_department_allowed(dept_id, action=action):
                    return False

                # Direct check on sub_department / team
                if team_id is not None and not scope.is_team_allowed(team_id, action=action):
                    return False

                # Direct check on User object
                if hasattr(resource, "username") and hasattr(resource, "date_joined"):
                    if not scope.is_user_allowed(resource, action=action):
                        return False

        return True

    @classmethod
    def require(cls, *, user, permission: str, resource=None, action: str = "view"):
        if not cls.can(user=user, permission=permission, resource=resource, action=action):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(detail=f"Permission denied: {permission}")

    @classmethod
    def get_user_effective_permissions(cls, user) -> List[str]:
        if not user or not user.is_authenticated:
            return []

        from apps.authorization.models import AccessPermission, AccessRolePermission, AccessUserRole, UserModulePermission

        if user.is_superuser or getattr(user, "role", None) == "SUPER_ADMIN":
            try:
                return list(AccessPermission.objects.filter(is_active=True).values_list("code", flat=True))
            except Exception:
                return ["*.*"]

        try:
            # Check user-specific direct module permissions first
            user_module_perms = list(UserModulePermission.objects.filter(user=user).select_related("module"))

            # Get active roles assigned to user
            assigned_role_ids = AccessUserRole.objects.filter(
                user=user,
                role__status="ACTIVE"
            ).values_list("role_id", flat=True)

            if not assigned_role_ids:
                # Fallback to user.role text choice if no AccessUserRole created yet
                from apps.authorization.models import AccessRole
                role_choice = getattr(user, "role", None)
                if role_choice:
                    fallback_role = AccessRole.objects.filter(code=role_choice, status="ACTIVE").first()
                    if fallback_role:
                        assigned_role_ids = [fallback_role.id]

            # Granted permissions from roles
            granted_codes = set(
                AccessRolePermission.objects.filter(
                    role_id__in=assigned_role_ids,
                    is_denied=False,
                    permission__is_active=True
                ).values_list("permission__code", flat=True)
            )

            # Explicitly denied permissions override grants
            denied_codes = set(
                AccessRolePermission.objects.filter(
                    role_id__in=assigned_role_ids,
                    is_denied=True
                ).values_list("permission__code", flat=True)
            )

            base_permissions = granted_codes - denied_codes

            if user_module_perms:
                filtered_perms = set()
                # Apply module dimensions: NO_ACCESS strips all, READ limits to view, WRITE grants view+write
                for p in base_permissions:
                    mod_code = p.split(".", 1)[0] if "." in p else ""
                    act_code = p.split(".", 1)[1] if "." in p else "view"
                    matched_ump = next((ump for ump in user_module_perms if ump.module.code == mod_code), None)
                    if not matched_ump:
                        continue
                    if matched_ump.access_level == UserModulePermission.AccessLevel.NO_ACCESS:
                        continue
                    elif matched_ump.access_level == UserModulePermission.AccessLevel.READ:
                        if act_code in ["view", "export", "read"]:
                            filtered_perms.add(p)
                    elif matched_ump.access_level == UserModulePermission.AccessLevel.WRITE:
                        filtered_perms.add(p)

                # Add baseline permissions for assigned modules according to their configured level
                for ump in user_module_perms:
                    if ump.access_level == UserModulePermission.AccessLevel.READ:
                        filtered_perms.add(f"{ump.module.code}.view")
                    elif ump.access_level == UserModulePermission.AccessLevel.WRITE:
                        filtered_perms.add(f"{ump.module.code}.view")
                        filtered_perms.add(f"{ump.module.code}.create")
                        filtered_perms.add(f"{ump.module.code}.edit")

                return sorted(list(filtered_perms))

            return sorted(list(base_permissions))
        except Exception:
            return []

    @classmethod
    def get_user_circle_ids(cls, user) -> Optional[List[int]]:
        """
        Returns list of allowed circle IDs or None if unrestricted (GLOBAL / CORPORATE / SUPER_ADMIN).
        """
        if not user or not user.is_authenticated:
            return []

        scope = cls.get_user_hierarchy_scope(user)
        if scope.is_unrestricted:
            return None

        return list(scope.circle_ids) if scope.circle_ids is not None else []

    @classmethod
    def get_user_accessible_modules(cls, user) -> List[str]:
        """
        Returns list of module codes (e.g. 'management', 'slides', 'uploads', 'admin', 'organization')
        for which the user possesses at least view permission.
        """
        if not user or not user.is_authenticated:
            return []

        from apps.authorization.models import AccessModule, UserModulePermission

        if user.is_superuser or getattr(user, "role", None) == "SUPER_ADMIN":
            try:
                return list(AccessModule.objects.filter(is_active=True).values_list("code", flat=True))
            except Exception:
                return [
                    "management", "organization", "uploads", "slides",
                    "operations", "workflow", "workforce", "governance",
                    "audit", "documents", "finance", "reports", "kpi", "admin"
                ]

        # If user has explicit UserModulePermission rows, use them directly
        user_module_perms = list(UserModulePermission.objects.filter(user=user).select_related("module"))
        if user_module_perms:
            return sorted([
                ump.module.code for ump in user_module_perms
                if ump.access_level != UserModulePermission.AccessLevel.NO_ACCESS
            ])

        effective_perms = cls.get_user_effective_permissions(user)
        accessible = set()
        for p in effective_perms:
            if "." in p:
                mod_code = p.split(".", 1)[0]
                accessible.add(mod_code)

        return sorted(list(accessible))

