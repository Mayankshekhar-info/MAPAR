from typing import Dict, Any, List, Optional
from django.db import transaction
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from apps.authorization.models import (
    AccessModule,
    AccessPermissionAction,
    AccessPermission,
    UserModulePermission,
)
from apps.organization.models import HierarchyAuditLog

User = get_user_model()


# Canonical MAPAR Application Modules Definition aligned with frontend navigation
MAPAR_APPLICATION_MODULES = [
    {
        "code": "management",
        "name": "Management Cockpit",
        "description": "Unified corporate performance cockpit and universal KPIs",
        "icon": "Dashboard",
        "route_name": "/",
        "sort_order": 1,
    },
    {
        "code": "organization",
        "name": "Organization & Circles",
        "description": "Enterprise hierarchy across Circles, Companies, and Domains",
        "icon": "AccountTree",
        "route_name": "/organization",
        "sort_order": 2,
    },
    {
        "code": "uploads",
        "name": "Uploads",
        "description": "Dynamic template builder, Excel import, validation, and batch history",
        "icon": "CloudUpload",
        "route_name": "/uploads",
        "sort_order": 3,
    },
    {
        "code": "slides",
        "name": "Slide View",
        "description": "Executive presentation decks and monthly review decks",
        "icon": "Slideshow",
        "route_name": "/slides",
        "sort_order": 4,
    },
    {
        "code": "operations",
        "name": "Operations Control",
        "description": "Operational throughput, SLAs, and domain KPIs",
        "icon": "Speed",
        "route_name": "/operations",
        "sort_order": 5,
    },
    {
        "code": "workflow",
        "name": "Workflow & Monthly Cycles",
        "description": "Monthly data submission, review, and executive sign-off cycles",
        "icon": "SyncAlt",
        "route_name": "/workflow",
        "sort_order": 6,
    },
    {
        "code": "workforce",
        "name": "Workforce & Headcount",
        "description": "Organizational headcount, capacity, and productivity",
        "icon": "People",
        "route_name": "/workforce",
        "sort_order": 7,
    },
    {
        "code": "governance",
        "name": "Governance and Action",
        "description": "Governance compliance scores, risk matrices, and escalations",
        "icon": "Shield",
        "route_name": "/governance",
        "sort_order": 8,
    },
    {
        "code": "audit",
        "name": "Audit & Action Owners",
        "description": "Immutable change logs, remediation items, and action items",
        "icon": "FactCheck",
        "route_name": "/audit",
        "sort_order": 9,
    },
    {
        "code": "documents",
        "name": "Evidence Documents",
        "description": "Audited monthly review packages, board docs, and evidence",
        "icon": "FolderShared",
        "route_name": "/documents",
        "sort_order": 10,
    },
    {
        "code": "finance",
        "name": "Finance & Cost",
        "description": "Cost management, budgets, operational expense actuals",
        "icon": "MonetizationOn",
        "route_name": "/finance",
        "sort_order": 11,
    },
    {
        "code": "reports",
        "name": "Reporting & Exports",
        "description": "Executive PDF packages, Excel exports, and slide generators",
        "icon": "Assessment",
        "route_name": "/reporting",
        "sort_order": 12,
    },
    {
        "code": "kpi",
        "name": "Universal KPI Registry",
        "description": "Standardized definitions for 55 universal operational KPIs",
        "icon": "Tune",
        "route_name": "/kpi",
        "sort_order": 13,
    },
    {
        "code": "admin",
        "name": "Administration",
        "description": "Enterprise users, roles, permissions, and security controls",
        "icon": "AdminPanelSettings",
        "route_name": "/users",
        "sort_order": 14,
    },
]


class AccessModuleService:
    """
    Ensures baseline application modules and permissions exist in database.
    Dynamically mirrors MAPAR application structure.
    """

    @classmethod
    def ensure_application_modules(cls) -> List[AccessModule]:
        # Ensure standard action taxonomy exists
        actions_map = {
            "view": ("View / Read", "Read-only access to view records and dashboards", 1),
            "create": ("Create / Add", "Ability to create new records or submissions", 2),
            "edit": ("Edit / Update", "Ability to modify existing records and progress", 3),
            "delete": ("Delete", "Ability to remove records", 4),
            "export": ("Export / Download", "Ability to export reports and Excel templates", 5),
            "manage": ("Manage / Administer", "Administrative configuration rights", 6),
        }
        action_objs = {}
        for code, (name, desc, sort) in actions_map.items():
            act, _ = AccessPermissionAction.objects.get_or_create(
                code=code,
                defaults={"name": name, "description": desc, "sort_order": sort, "is_active": True}
            )
            action_objs[code] = act

        module_objs = []
        for mod_meta in MAPAR_APPLICATION_MODULES:
            mod, _ = AccessModule.objects.get_or_create(
                code=mod_meta["code"],
                defaults={
                    "name": mod_meta["name"],
                    "description": mod_meta["description"],
                    "icon": mod_meta["icon"],
                    "route_name": mod_meta["route_name"],
                    "sort_order": mod_meta["sort_order"],
                    "is_active": True,
                }
            )
            module_objs.append(mod)

            # Ensure baseline view & write permissions exist for every module
            actions_to_create = ["view", "create", "edit", "export"]
            if mod.code in ["admin", "uploads"]:
                actions_to_create.extend(["delete", "manage"])

            for act_code in actions_to_create:
                perm_code = f"{mod.code}.{act_code}"
                AccessPermission.objects.get_or_create(
                    code=perm_code,
                    defaults={
                        "name": f"{action_objs[act_code].name} {mod.name}",
                        "module": mod,
                        "action": action_objs[act_code],
                        "risk_level": "HIGH" if act_code in ["delete", "manage"] else "LOW",
                        "is_active": True,
                    }
                )

        return module_objs


class ModulePermissionService:
    """
    Manages user-level module access dimensions (NO_ACCESS, READ, WRITE).
    """

    @classmethod
    def get_modules_catalog(cls, user=None) -> List[Dict[str, Any]]:
        """
        Returns full list of application modules with submodules/routes for permission assignment.
        """
        AccessModuleService.ensure_application_modules()
        modules = AccessModule.objects.filter(is_active=True).order_by("sort_order", "id")

        catalog = []
        for mod in modules:
            catalog.append({
                "id": mod.id,
                "code": mod.code,
                "name": mod.name,
                "description": mod.description,
                "icon": mod.icon,
                "route_name": mod.route_name,
                "sort_order": mod.sort_order,
                "supported_levels": [
                    {"level": UserModulePermission.AccessLevel.NO_ACCESS, "label": "No Access"},
                    {"level": UserModulePermission.AccessLevel.READ, "label": "Read Only"},
                    {"level": UserModulePermission.AccessLevel.WRITE, "label": "Read & Write"},
                ],
            })
        return catalog

    @classmethod
    def get_user_module_permissions(cls, user: User) -> List[Dict[str, Any]]:
        """
        Returns all application modules along with the user's assigned access level.
        Defaults to READ if granted by role, or NO_ACCESS if not granted.
        """
        catalog = cls.get_modules_catalog(user)
        user_perms_map = {
            ump.module_id: ump.access_level
            for ump in UserModulePermission.objects.filter(user=user)
        }

        # Check user's role-based fallback if no explicit UserModulePermission rows exist
        has_explicit = bool(user_perms_map)

        results = []
        for mod in catalog:
            if has_explicit:
                access_level = user_perms_map.get(mod["id"], UserModulePermission.AccessLevel.NO_ACCESS)
            else:
                # If user is superuser, default WRITE. Otherwise default READ for basic visibility
                if getattr(user, "is_superuser", False) or getattr(user, "role", None) == "SUPER_ADMIN":
                    access_level = UserModulePermission.AccessLevel.WRITE
                else:
                    access_level = UserModulePermission.AccessLevel.READ

            results.append({
                "module_id": mod["id"],
                "module_code": mod["code"],
                "module_name": mod["name"],
                "description": mod["description"],
                "icon": mod["icon"],
                "route_name": mod["route_name"],
                "access_level": access_level,
            })
        return results

    @classmethod
    @transaction.atomic
    def sync_user_module_permissions(
        cls,
        user: User,
        permissions_data: List[Dict[str, Any]],
        admin_user: Optional[User] = None,
    ) -> None:
        """
        Synchronizes direct module permissions for a user.
        permissions_data: list of dicts with {"module_id": int or "module_code": str, "access_level": "NO_ACCESS"|"READ"|"WRITE"}
        """
        if not permissions_data:
            return

        AccessModuleService.ensure_application_modules()
        all_modules = {m.id: m for m in AccessModule.objects.filter(is_active=True)}
        code_to_mod = {m.code: m for m in all_modules.values()}

        # Privilege escalation check: non-super admin cannot grant admin module if they don't have it
        if admin_user and not (getattr(admin_user, "is_superuser", False) or getattr(admin_user, "role", None) == "SUPER_ADMIN"):
            from common.permissions.authorization import AuthorizationService
            admin_mods = AuthorizationService.get_user_accessible_modules(admin_user)
            for p in permissions_data:
                m_code = p.get("module_code")
                m_id = p.get("module_id")
                target_code = m_code or (all_modules[m_id].code if m_id in all_modules else None)
                if target_code == "admin" and "admin" not in admin_mods:
                    raise ValidationError({"module_permissions": "You cannot grant administrative permissions."})

        UserModulePermission.objects.filter(user=user).delete()

        created_objs = []
        for item in permissions_data:
            mod = None
            if "module_id" in item and item["module_id"] in all_modules:
                mod = all_modules[item["module_id"]]
            elif "module_code" in item and item["module_code"] in code_to_mod:
                mod = code_to_mod[item["module_code"]]

            if not mod:
                continue

            lvl = str(item.get("access_level") or "").upper()
            if lvl not in [
                UserModulePermission.AccessLevel.NO_ACCESS,
                UserModulePermission.AccessLevel.READ,
                UserModulePermission.AccessLevel.WRITE,
            ]:
                lvl = UserModulePermission.AccessLevel.READ

            created_objs.append(
                UserModulePermission(
                    user=user,
                    module=mod,
                    access_level=lvl,
                )
            )

        if created_objs:
            UserModulePermission.objects.bulk_create(created_objs)

        if admin_user:
            summary = ", ".join(f"{obj.module.code}={obj.access_level}" for obj in created_objs[:10])
            user_identifier = getattr(user, "username", str(user.id))
            HierarchyAuditLog.objects.create(
                action="ASSIGN",
                level="USER",
                object_id=str(user.id),
                object_repr=f"User: {user_identifier}",
                details=f"Updated module permissions ({len(created_objs)} modules): {summary}",
                user=admin_user,
            )
