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
    def can(cls, *, user, permission: str, resource=None, action: str = "view") -> bool:
        if not user or not user.is_authenticated:
            return False

        # Super Admin / Superuser has full platform access
        if user.is_superuser or getattr(user, "role", None) == "SUPER_ADMIN":
            return True

        # Check effective permissions (WHAT the user can do)
        perms = cls.get_user_effective_permissions(user)
        if permission not in perms and "*.*" not in perms:
            return False

        # Check organization scope boundary (WHERE the user can do it)
        if resource is not None:
            scope = cls.get_user_hierarchy_scope(user)
            if not scope.is_unrestricted:
                # Direct check on circle
                circle_id = getattr(resource, "circle_id", None)
                if circle_id is not None and not scope.is_circle_allowed(circle_id, action=action):
                    return False

                # Direct check on domain
                domain_id = getattr(resource, "domain_id", None)
                if domain_id is not None and not scope.is_domain_allowed(domain_id, action=action):
                    return False

                # Direct check on department
                dept_id = getattr(resource, "department_id", None)
                if dept_id is not None and not scope.is_department_allowed(dept_id, action=action):
                    return False

                # Direct check on sub_department / team
                team_id = getattr(resource, "sub_department_id", None) or getattr(resource, "team_id", None)
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

        from apps.authorization.models import AccessPermission, AccessRolePermission, AccessUserRole

        if user.is_superuser or getattr(user, "role", None) == "SUPER_ADMIN":
            try:
                return list(AccessPermission.objects.filter(is_active=True).values_list("code", flat=True))
            except Exception:
                return ["*.*"]

        try:
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

            if not assigned_role_ids:
                return []

            # Granted permissions
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

            return sorted(list(granted_codes - denied_codes))
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

        from apps.authorization.models import AccessModule

        if user.is_superuser or getattr(user, "role", None) == "SUPER_ADMIN":
            try:
                return list(AccessModule.objects.filter(is_active=True).values_list("code", flat=True))
            except Exception:
                return [
                    "management", "organization", "uploads", "slides",
                    "operations", "workflow", "workforce", "governance",
                    "audit", "documents", "finance", "reporting", "kpi", "admin"
                ]

        effective_perms = cls.get_user_effective_permissions(user)
        accessible = set()
        for p in effective_perms:
            if "." in p:
                mod_code = p.split(".", 1)[0]
                accessible.add(mod_code)

        return sorted(list(accessible))
