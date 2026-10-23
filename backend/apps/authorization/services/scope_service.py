from typing import Dict, Any, List, Optional
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.authorization.models import UserAccessScope, UserAccessScopeCircle, UserAccessScopeDomain
from apps.identity.models import User
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
from common.permissions.authorization import AuthorizationService


class ScopeService:
    """
    Business logic and transactional lifecycle management for User Access Scopes.
    Enforces server-side authority, duplicate scope prevention, and hierarchy validation.
    """

    @classmethod
    def _validate_admin_scope_authorization(cls, admin_user, scope_data: Dict[str, Any]):
        """
        Ensures admin_user cannot grant scopes outside of their own downward organizational boundary.
        """
        if not admin_user:
            return
        admin_scope = AuthorizationService.get_user_hierarchy_scope(admin_user)
        if admin_scope.is_unrestricted:
            return

        mc_id = scope_data.get("main_company_id")
        sc_id = scope_data.get("sub_company_id")
        prj_id = scope_data.get("project_id")
        circle_id = scope_data.get("circle_id")
        domain_id = scope_data.get("domain_id")
        dept_id = scope_data.get("department_id")
        team_id = scope_data.get("sub_department_id") or scope_data.get("team_id")

        if mc_id and not admin_scope.is_main_company_allowed(mc_id):
            raise ValidationError({"main_company_id": "Selected Main Company is outside your authorized organizational scope."})
        if sc_id and not admin_scope.is_sub_company_allowed(sc_id):
            raise ValidationError({"sub_company_id": "Selected Sub Company is outside your authorized organizational scope."})
        if prj_id and not admin_scope.is_project_allowed(prj_id):
            raise ValidationError({"project_id": "Selected Project is outside your authorized organizational scope."})
        if circle_id and not admin_scope.is_circle_allowed(circle_id):
            raise ValidationError({"circle_id": "Selected Circle is outside your authorized organizational scope."})
        if domain_id and not admin_scope.is_domain_allowed(domain_id):
            raise ValidationError({"domain_id": "Selected Domain is outside your authorized organizational scope."})
        if dept_id and not admin_scope.is_department_allowed(dept_id):
            raise ValidationError({"department_id": "Selected Department is outside your authorized organizational scope."})
        if team_id and not admin_scope.is_team_allowed(team_id):
            raise ValidationError({"team_id": "Selected Team is outside your authorized organizational scope."})

    @classmethod
    @transaction.atomic
    def create_user_scope(cls, data: Dict[str, Any], admin_user) -> UserAccessScope:
        user_id = data.get("user_id")
        if not user_id:
            raise ValidationError({"user_id": "Target user is required."})

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise ValidationError({"user_id": "User not found."})

        cls._validate_admin_scope_authorization(admin_user, data)

        main_company_id = data.get("main_company_id") or None
        sub_company_id = data.get("sub_company_id") or None
        project_id = data.get("project_id") or None
        circle_id = data.get("circle_id") or None
        domain_id = data.get("domain_id") or None
        department_id = data.get("department_id") or None
        sub_department_id = data.get("sub_department_id") or data.get("team_id") or None

        # Prevent duplicate identical scopes for this user (Requirement 28)
        dup_filter = {
            "user": target_user,
            "main_company_id": main_company_id,
            "sub_company_id": sub_company_id,
            "project_id": project_id,
            "circle_id": circle_id,
            "domain_id": domain_id,
            "department_id": department_id,
            "sub_department_id": sub_department_id,
        }
        if UserAccessScope.objects.filter(**dup_filter).exists():
            raise ValidationError({"detail": "This exact organizational scope is already assigned to this user."})

        # Actions permissions
        can_view = data.get("can_view", True)
        can_manage = data.get("can_manage", False)
        can_create = data.get("can_create", False)
        can_update = data.get("can_update", False)
        can_delete = data.get("can_delete", False)
        actions = data.get("actions") or []
        if isinstance(actions, list) and actions:
            if "view" in actions: can_view = True
            if "manage" in actions: can_manage = True
            if "create" in actions: can_create = True
            if "update" in actions: can_update = True
            if "delete" in actions: can_delete = True
        else:
            # Build actions list from booleans
            actions = []
            if can_view: actions.append("view")
            if can_manage: actions.append("manage")
            if can_create: actions.append("create")
            if can_update: actions.append("update")
            if can_delete: actions.append("delete")

        # Determine scope_type
        scope_type = "CIRCLE"
        if sub_department_id:
            scope_type = "TEAM"
        elif department_id:
            scope_type = "DEPARTMENT"
        elif domain_id:
            scope_type = "DOMAIN"
        elif circle_id:
            scope_type = "CIRCLE"
        elif project_id:
            scope_type = "PROJECT"
        elif sub_company_id:
            scope_type = "COMPANY"
        elif main_company_id:
            scope_type = "COMPANY"

        scope = UserAccessScope.objects.create(
            user=target_user,
            scope_type=scope_type,
            main_company_id=main_company_id,
            sub_company_id=sub_company_id,
            project_id=project_id,
            circle_id=circle_id,
            domain_id=domain_id,
            department_id=department_id,
            sub_department_id=sub_department_id,
            can_view=can_view,
            can_manage=can_manage,
            can_create=can_create,
            can_update=can_update,
            can_delete=can_delete,
            actions=actions,
        )

        # Sync assigned_circles / assigned_domains for backward compatibility
        if circle_id:
            UserAccessScopeCircle.objects.get_or_create(useraccessscope=scope, circle_id=circle_id)
            if not target_user.circle_id:
                target_user.circle_id = circle_id
                target_user.save(update_fields=["circle"])
        if domain_id:
            UserAccessScopeDomain.objects.get_or_create(useraccessscope=scope, domain_id=domain_id)

        HierarchyAuditLog.objects.create(
            action="ASSIGN",
            level="SCOPE",
            object_id=str(scope.id),
            object_repr=f"Access Scope #{scope.id}: {target_user.username} ({scope.hierarchy_breadcrumb})",
            details=f"Assigned scope with actions: {', '.join(actions)}",
            user=admin_user,
        )

        return scope

    @classmethod
    @transaction.atomic
    def update_user_scope(cls, scope_id: int, data: Dict[str, Any], admin_user) -> UserAccessScope:
        try:
            scope = UserAccessScope.objects.select_related("user").get(id=scope_id)
        except UserAccessScope.DoesNotExist:
            raise ValidationError({"detail": "Access scope not found."})

        cls._validate_admin_scope_authorization(admin_user, data)

        if "main_company_id" in data:
            scope.main_company_id = data.get("main_company_id") or None
        if "sub_company_id" in data:
            scope.sub_company_id = data.get("sub_company_id") or None
        if "project_id" in data:
            scope.project_id = data.get("project_id") or None
        if "circle_id" in data:
            scope.circle_id = data.get("circle_id") or None
        if "domain_id" in data:
            scope.domain_id = data.get("domain_id") or None
        if "department_id" in data:
            scope.department_id = data.get("department_id") or None
        if "sub_department_id" in data or "team_id" in data:
            scope.sub_department_id = data.get("sub_department_id") or data.get("team_id") or None

        # Update action permissions
        if "can_view" in data: scope.can_view = data["can_view"]
        if "can_manage" in data: scope.can_manage = data["can_manage"]
        if "can_create" in data: scope.can_create = data["can_create"]
        if "can_update" in data: scope.can_update = data["can_update"]
        if "can_delete" in data: scope.can_delete = data["can_delete"]

        if "actions" in data and isinstance(data["actions"], list):
            scope.actions = data["actions"]
            scope.can_view = "view" in scope.actions
            scope.can_manage = "manage" in scope.actions
            scope.can_create = "create" in scope.actions
            scope.can_update = "update" in scope.actions
            scope.can_delete = "delete" in scope.actions
        else:
            actions = []
            if scope.can_view: actions.append("view")
            if scope.can_manage: actions.append("manage")
            if scope.can_create: actions.append("create")
            if scope.can_update: actions.append("update")
            if scope.can_delete: actions.append("delete")
            scope.actions = actions

        scope.save()

        # Update circles & domains bindings
        UserAccessScopeCircle.objects.filter(useraccessscope=scope).delete()
        if scope.circle_id:
            UserAccessScopeCircle.objects.create(useraccessscope=scope, circle_id=scope.circle_id)

        UserAccessScopeDomain.objects.filter(useraccessscope=scope).delete()
        if scope.domain_id:
            UserAccessScopeDomain.objects.create(useraccessscope=scope, domain_id=scope.domain_id)

        HierarchyAuditLog.objects.create(
            action="UPDATE",
            level="SCOPE",
            object_id=str(scope.id),
            object_repr=f"Access Scope #{scope.id}: {scope.user.username} ({scope.hierarchy_breadcrumb})",
            details=f"Updated scope with actions: {', '.join(scope.actions)}",
            user=admin_user,
        )

        return scope

    @classmethod
    @transaction.atomic
    def assign_user_scope(cls, data: Dict[str, Any], admin_user) -> UserAccessScope:
        """
        Unified scope assignment supporting both direct hierarchy IDs and legacy circle_ids.
        """
        if any(k in data for k in ("main_company_id", "sub_company_id", "project_id", "circle_id", "department_id", "sub_department_id", "team_id")):
            return cls.create_user_scope(data, admin_user)

        user_id = data.get("user_id")
        scope_type = data.get("scope_type", "CIRCLE").upper()
        circle_ids: List[int] = data.get("circle_ids", [])
        domain_ids: List[int] = data.get("domain_ids", [])

        if not user_id:
            raise ValidationError({"user_id": "Target user is required."})

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise ValidationError({"user_id": "User not found."})

        circle_first = circle_ids[0] if circle_ids else None
        domain_first = domain_ids[0] if domain_ids else None

        scope = UserAccessScope.objects.create(
            user=target_user,
            scope_type=scope_type,
            circle_id=circle_first,
            domain_id=domain_first,
            can_view=True,
            can_manage=False,
            actions=["view"],
        )

        if circle_ids:
            for cid in circle_ids:
                UserAccessScopeCircle.objects.get_or_create(useraccessscope=scope, circle_id=cid)
            if not target_user.circle_id:
                target_user.circle_id = circle_first
                target_user.save(update_fields=["circle"])

        if domain_ids:
            for did in domain_ids:
                UserAccessScopeDomain.objects.get_or_create(useraccessscope=scope, domain_id=did)

        HierarchyAuditLog.objects.create(
            action="ASSIGN",
            level="SCOPE",
            object_id=str(scope.id),
            object_repr=f"Access Scope: {target_user.username} ({scope_type})",
            details=f"Assigned scope with {len(circle_ids)} circle(s) and {len(domain_ids)} domain(s).",
            user=admin_user,
        )

        return scope

    @classmethod
    @transaction.atomic
    def delete_user_scope(cls, scope_id: int, admin_user) -> None:
        try:
            scope = UserAccessScope.objects.select_related("user").get(id=scope_id)
        except UserAccessScope.DoesNotExist:
            raise ValidationError({"detail": "Access scope not found."})

        username = scope.user.username
        scope_repr = f"Access Scope #{scope.id} for {username} ({scope.hierarchy_breadcrumb})"

        UserAccessScopeCircle.objects.filter(useraccessscope=scope).delete()
        UserAccessScopeDomain.objects.filter(useraccessscope=scope).delete()
        scope.delete()

        HierarchyAuditLog.objects.create(
            action="DELETE",
            level="SCOPE",
            object_id=str(scope_id),
            object_repr=scope_repr,
            details=f"Deleted access scope for user {username}.",
            user=admin_user,
        )

    @classmethod
    @transaction.atomic
    def sync_user_scopes(cls, user: User, scopes_data: List[Dict[str, Any]], admin_user):
        """
        Synchronizes all access scope cards for a user during user create or edit.
        """
        # Delete existing scopes not in incoming list or replace if provided
        incoming_ids = [s.get("id") for s in scopes_data if s.get("id")]
        UserAccessScope.objects.filter(user=user).exclude(id__in=incoming_ids).delete()

        for s_data in scopes_data:
            s_data_copy = dict(s_data)
            s_data_copy["user_id"] = user.id
            scope_id = s_data_copy.get("id")

            if scope_id:
                try:
                    cls.update_user_scope(scope_id, s_data_copy, admin_user)
                except ValidationError:
                    # If not found or changed, recreate
                    cls.create_user_scope(s_data_copy, admin_user)
            else:
                cls.create_user_scope(s_data_copy, admin_user)

        # Synchronize user primary circle & team with configured scopes
        first_circle_id = next((s.get("circle_id") for s in scopes_data if s.get("circle_id")), None)
        first_team_id = next((s.get("team_id") or s.get("sub_department_id") for s in scopes_data if (s.get("team_id") or s.get("sub_department_id"))), None)
        user.circle_id = first_circle_id
        if first_team_id:
            user.sub_department_id = first_team_id
        user.save(update_fields=["circle", "sub_department"])
