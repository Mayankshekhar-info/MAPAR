from typing import Dict, Any, List
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.authorization.models import AccessRole, AccessPermission, AccessRolePermission, AccessUserRole
from apps.organization.models import HierarchyAuditLog


class RoleService:
    """
    Business logic and transactional lifecycle management for Enterprise Roles.
    """

    @classmethod
    @transaction.atomic
    def create_role(cls, data: Dict[str, Any], user) -> AccessRole:
        name = data.get("name", "").strip()
        code = data.get("code", "").strip().upper()
        description = data.get("description", "").strip()
        risk_level = data.get("risk_level", "MEDIUM")
        status = data.get("status", "ACTIVE")
        permission_ids: List[int] = data.get("permission_ids", [])

        if not name:
            raise ValidationError({"name": "Role name is required."})
        if not code:
            raise ValidationError({"code": "Role code is required."})

        if AccessRole.objects.filter(code=code).exists():
            raise ValidationError({"code": f"Role with code '{code}' already exists."})

        role = AccessRole.objects.create(
            name=name,
            code=code,
            description=description,
            role_type=AccessRole.RoleType.CUSTOM,
            risk_level=risk_level,
            status=status,
            created_by=user,
        )

        # Bind selected permissions
        if permission_ids:
            perms = AccessPermission.objects.filter(id__in=permission_ids, is_active=True)
            bindings = [
                AccessRolePermission(role=role, permission=p, is_denied=False)
                for p in perms
            ]
            AccessRolePermission.objects.bulk_create(bindings)

        # Audit log
        HierarchyAuditLog.objects.create(
            action="CREATE",
            level="ROLE",
            object_id=str(role.id),
            object_repr=f"Enterprise Role: {role.name} ({role.code})",
            details=f"Created custom role with {len(permission_ids)} permissions.",
            user=user,
        )

        return role

    @classmethod
    @transaction.atomic
    def update_role(cls, role_id: int, data: Dict[str, Any], user) -> AccessRole:
        try:
            role = AccessRole.objects.get(id=role_id)
        except AccessRole.DoesNotExist:
            raise ValidationError({"detail": "Role not found."})

        name = data.get("name")
        description = data.get("description")
        risk_level = data.get("risk_level")
        status = data.get("status")

        if name is not None:
            name = name.strip()
            if not name:
                raise ValidationError({"name": "Role name cannot be blank."})
            role.name = name

        if description is not None:
            role.description = description.strip()

        if risk_level is not None:
            role.risk_level = risk_level

        if status is not None:
            role.status = status

        role.save()

        # Update permissions if explicitly provided
        if "permission_ids" in data:
            permission_ids = data["permission_ids"]
            AccessRolePermission.objects.filter(role=role).delete()
            if permission_ids:
                perms = AccessPermission.objects.filter(id__in=permission_ids, is_active=True)
                bindings = [
                    AccessRolePermission(role=role, permission=p, is_denied=False)
                    for p in perms
                ]
                AccessRolePermission.objects.bulk_create(bindings)

        # Audit log
        HierarchyAuditLog.objects.create(
            action="UPDATE",
            level="ROLE",
            object_id=str(role.id),
            object_repr=f"Enterprise Role: {role.name} ({role.code})",
            details=f"Updated enterprise role configuration.",
            user=user,
        )

        return role

    @classmethod
    @transaction.atomic
    def delete_role(cls, role_id: int, user) -> None:
        try:
            role = AccessRole.objects.get(id=role_id)
        except AccessRole.DoesNotExist:
            raise ValidationError({"detail": "Role not found."})

        if role.role_type == AccessRole.RoleType.SYSTEM:
            raise ValidationError({"detail": "System-defined roles cannot be deleted."})

        assigned_count = AccessUserRole.objects.filter(role=role).count()
        if assigned_count > 0:
            raise ValidationError({
                "detail": f"Cannot delete role '{role.name}' because {assigned_count} user(s) are actively assigned to it."
            })

        role_name = role.name
        role_code = role.code
        role_id_str = str(role.id)

        AccessRolePermission.objects.filter(role=role).delete()
        role.delete()

        HierarchyAuditLog.objects.create(
            action="DELETE",
            level="ROLE",
            object_id=role_id_str,
            object_repr=f"Enterprise Role: {role_name} ({role_code})",
            details=f"Deleted custom enterprise role.",
            user=user,
        )
