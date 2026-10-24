from typing import List, Dict, Any, Optional
from django.db.models import Count
from apps.authorization.models import AccessRole, AccessModule, AccessPermission, AccessRolePermission


def get_roles_list(search: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns list of enterprise roles with aggregated permission counts and user counts.
    """
    qs = AccessRole.objects.all().prefetch_related("role_permissions", "assigned_users")

    if search:
        search = search.strip()
        qs = qs.filter(name__icontains=search) | qs.filter(code__icontains=search)

    if status:
        qs = qs.filter(status=status.upper())

    roles_data = []
    for role in qs.order_by("role_type", "name"):
        roles_data.append({
            "id": role.id,
            "name": role.name,
            "code": role.code,
            "description": role.description,
            "role_type": role.role_type,
            "risk_level": role.risk_level,
            "status": role.status,
            "permissions_count": role.role_permissions.filter(is_denied=False).count(),
            "users_count": role.assigned_users.count(),
            "created_at": role.created_at.isoformat() if role.created_at else None,
            "updated_at": role.updated_at.isoformat() if role.updated_at else None,
        })

    return roles_data


def get_role_detail(role_id: int) -> Optional[Dict[str, Any]]:
    """
    Returns detailed role information including granted and denied permission IDs.
    """
    try:
        role = AccessRole.objects.prefetch_related("role_permissions__permission").get(id=role_id)
    except AccessRole.DoesNotExist:
        return None

    granted_perms = []
    denied_perms = []
    for rp in role.role_permissions.all():
        perm_data = {
            "id": rp.permission.id,
            "code": rp.permission.code,
            "name": rp.permission.name,
            "module_code": rp.permission.module.code,
            "action": rp.permission.action.code if rp.permission.action else "view",
        }
        if rp.is_denied:
            denied_perms.append(perm_data)
        else:
            granted_perms.append(perm_data)

    return {
        "id": role.id,
        "name": role.name,
        "code": role.code,
        "description": role.description,
        "role_type": role.role_type,
        "risk_level": role.risk_level,
        "status": role.status,
        "permissions_count": len(granted_perms),
        "users_count": role.assigned_users.count(),
        "granted_permissions": granted_perms,
        "granted_permission_ids": [p["id"] for p in granted_perms],
        "denied_permissions": denied_perms,
        "denied_permission_ids": [p["id"] for p in denied_perms],
        "created_at": role.created_at.isoformat() if role.created_at else None,
        "updated_at": role.updated_at.isoformat() if role.updated_at else None,
    }


def get_available_permissions_matrix() -> List[Dict[str, Any]]:
    """
    Returns application modules and their respective permissions for dynamic role creation UI.
    """
    modules = AccessModule.objects.filter(is_active=True).prefetch_related("permissions__action").order_by("sort_order", "name")

    matrix = []
    for mod in modules:
        perms = []
        for p in mod.permissions.filter(is_active=True).order_by("code"):
            perms.append({
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "description": p.description,
                "action": p.action.code if p.action else "view",
                "risk_level": p.risk_level,
            })

        matrix.append({
            "module_id": mod.id,
            "module_name": mod.name,
            "module_code": mod.code,
            "description": mod.description,
            "icon": mod.icon,
            "permissions": perms,
        })

    return matrix
