"""
Organization Hierarchy Services.
Encapsulates all business logic, validation, relationship integrity, and audit logging.
"""

from typing import Dict, Any, Optional
from django.core.exceptions import ValidationError
from django.db import transaction
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


class OrganizationHierarchyService:

    @classmethod
    def log_audit(
        cls,
        action: str,
        level: str,
        obj: Any,
        user=None,
        details: Optional[Dict[str, Any]] = None,
        request=None
    ) -> HierarchyAuditLog:
        """Helper to create a structured audit log entry."""
        ip = None
        if request:
            ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get("REMOTE_ADDR")

        return HierarchyAuditLog.objects.create(
            user=user if (user and user.is_authenticated) else None,
            action=action,
            level=level,
            object_id=str(getattr(obj, "id", "")),
            object_repr=str(obj),
            details=details or {},
            ip_address=ip,
        )

    @classmethod
    @transaction.atomic
    def create_node(
        cls,
        level: str,
        name: str,
        code: str,
        description: str = "",
        parent_id: Optional[int] = None,
        extra_fields: Optional[Dict[str, Any]] = None,
        user=None,
        request=None
    ) -> Dict[str, Any]:
        """
        Creates a hierarchy node enforcing parent-child rules.
        """
        level = level.upper()
        cfg = HIERARCHY_CONFIG.get(level)
        if not cfg:
            raise ValidationError(f"Invalid hierarchy level '{level}'.")

        name = (name or "").strip()
        code = (code or "").strip().upper()
        description = (description or "").strip()
        extra_fields = extra_fields or {}

        if not name or not code:
            raise ValidationError("Name and Code are mandatory fields.")

        # Validate parent requirement
        expected_parent_level = str(cfg.get("parent_level") or "")
        if expected_parent_level and not parent_id:
            parent_title = HIERARCHY_CONFIG.get(expected_parent_level, {}).get("name", expected_parent_level)
            raise ValidationError(f"{cfg['name']} must belong to a valid {parent_title}.")

        obj = None

        if level == "MAIN_COMPANY":
            if MainCompany.objects.filter(code=code).exists():
                raise ValidationError(f"Main Company with code '{code}' already exists.")
            obj = MainCompany.objects.create(
                name=name,
                code=code,
                description=description,
                status="ACTIVE",
            )

        elif level == "SUB_COMPANY":
            parent = MainCompany.objects.filter(id=parent_id).first()
            if not parent:
                raise ValidationError(f"Selected Main Company (ID {parent_id}) does not exist.")
            if SubCompany.objects.filter(main_company=parent, code=code).exists():
                raise ValidationError(f"Sub Company with code '{code}' already exists under {parent.name}.")
            obj = SubCompany.objects.create(
                main_company=parent,
                name=name,
                code=code,
                description=description,
                status="ACTIVE",
            )

        elif level == "PROJECT":
            parent = SubCompany.objects.filter(id=parent_id).first()
            if not parent:
                raise ValidationError(f"Selected Sub Company (ID {parent_id}) does not exist.")
            if Project.objects.filter(sub_company=parent, code=code).exists():
                raise ValidationError(f"Project with code '{code}' already exists under {parent.name}.")
            obj = Project.objects.create(
                sub_company=parent,
                name=name,
                code=code,
                description=description,
                status="ACTIVE",
            )

        elif level == "CIRCLE":
            parent_level = (extra_fields or {}).get("parent_level") or (extra_fields or {}).get("parent_type")
            main_co = None
            sub_co = None
            project = None

            if parent_level == "MAIN_COMPANY":
                main_co = MainCompany.objects.filter(id=parent_id).first()
                if not main_co:
                    raise ValidationError(f"Selected Main Company (ID {parent_id}) does not exist.")
            elif parent_level == "SUB_COMPANY":
                sub_co = SubCompany.objects.filter(id=parent_id).first()
                if not sub_co:
                    raise ValidationError(f"Selected Sub Company (ID {parent_id}) does not exist.")
            elif parent_level == "PROJECT":
                project = Project.objects.filter(id=parent_id).first()
                if not project:
                    raise ValidationError(f"Selected Project (ID {parent_id}) does not exist.")
            else:
                project = Project.objects.filter(id=parent_id).first()
                if not project:
                    sub_co = SubCompany.objects.filter(id=parent_id).first()
                if not project and not sub_co:
                    main_co = MainCompany.objects.filter(id=parent_id).first()

            if not project and not sub_co and not main_co:
                raise ValidationError(f"Selected parent Project, Sub Company, or Main Company (ID {parent_id}) does not exist.")

            if project:
                if Circle.objects.filter(project=project, code=code).exists():
                    raise ValidationError(f"Circle with code '{code}' already exists under Project {project.name}.")
            elif sub_co:
                if Circle.objects.filter(sub_company=sub_co, code=code).exists():
                    raise ValidationError(f"Circle with code '{code}' already exists under Sub Company {sub_co.name}.")
            elif main_co:
                if Circle.objects.filter(main_company=main_co, code=code).exists():
                    raise ValidationError(f"Circle with code '{code}' already exists under Main Company {main_co.name}.")

            region = extra_fields.get("region", "North")
            head_name = extra_fields.get("head_name", "")
            head_email = extra_fields.get("head_email", "")
            obj = Circle.objects.create(
                main_company=main_co,
                sub_company=sub_co,
                project=project,
                name=name,
                code=code,
                region=region,
                head_name=head_name,
                head_email=head_email,
                status="ACTIVE",
            )

        elif level == "DOMAIN":
            parent = Circle.objects.filter(id=parent_id).first()
            if not parent:
                raise ValidationError(f"Selected Circle (ID {parent_id}) does not exist.")
            if Domain.objects.filter(circle=parent, code=code).exists():
                raise ValidationError(f"Domain with code '{code}' already exists under {parent.name}.")
            icon = extra_fields.get("icon", "layers")
            color = extra_fields.get("color", "blue")
            obj = Domain.objects.create(
                circle=parent,
                name=name,
                code=code,
                description=description,
                icon=icon,
                color=color,
                status="ACTIVE",
            )

        elif level == "DEPARTMENT":
            parent = Domain.objects.filter(id=parent_id).first()
            if not parent:
                raise ValidationError(f"Selected Domain (ID {parent_id}) does not exist.")
            if Department.objects.filter(domain=parent, code=code).exists():
                raise ValidationError(f"Department with code '{code}' already exists under {parent.name}.")
            obj = Department.objects.create(
                domain=parent,
                name=name,
                code=code,
                description=description,
                status="ACTIVE",
            )

        elif level in ("SUB_DEPARTMENT", "TEAM"):
            parent = Department.objects.filter(id=parent_id).first()
            if not parent:
                raise ValidationError(f"Selected Department (ID {parent_id}) does not exist.")
            if SubDepartment.objects.filter(department=parent, code=code).exists():
                raise ValidationError(f"Team / Sub-Department with code '{code}' already exists under {parent.name}.")
            obj = SubDepartment.objects.create(
                department=parent,
                name=name,
                code=code,
                description=description,
                status="ACTIVE",
            )

        if obj is None:
            raise ValidationError(f"Failed to create {cfg['name']}: unsupported level.")

        cls.log_audit(
            action="CREATE",
            level=level,
            obj=obj,
            user=user,
            details={"name": name, "code": code, "parent_id": parent_id},
            request=request,
        )

        return {
            "id": obj.id,
            "level": level,
            "name": obj.name,
            "code": obj.code,
            "description": getattr(obj, "description", ""),
            "status": obj.status,
            "parent_id": parent_id,
        }

    @classmethod
    @transaction.atomic
    def update_node(
        cls,
        level: str,
        node_id: int,
        name: str,
        code: str,
        description: str = "",
        status: str = "ACTIVE",
        parent_id: Optional[int] = None,
        user=None,
        request=None
    ) -> Dict[str, Any]:
        """
        Updates an existing hierarchy node, optionally reassigning its parent.
        """
        level = level.upper()
        cfg = HIERARCHY_CONFIG.get(level)
        if not cfg:
            raise ValidationError(f"Invalid hierarchy level '{level}'.")

        name = (name or "").strip()
        code = (code or "").strip().upper()
        description = (description or "").strip()
        status = status.upper() if status in ["ACTIVE", "INACTIVE"] else "ACTIVE"

        if not name or not code:
            raise ValidationError("Name and Code are mandatory fields.")

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
            raise ValidationError(f"Invalid hierarchy level '{level}'.")

        obj: Any = model.objects.filter(id=node_id).first()
        if not obj:
            raise ValidationError(f"{cfg['name']} with ID {node_id} does not exist.")

        # Reassign parent if parent_id is explicitly provided
        parent_changed = False
        if parent_id is not None:
            if level == "SUB_COMPANY":
                new_parent = MainCompany.objects.filter(id=parent_id).first()
                if not new_parent:
                    raise ValidationError(f"Main Company with ID {parent_id} does not exist.")
                if obj.main_company_id != parent_id:
                    obj.main_company = new_parent
                    parent_changed = True
            elif level == "PROJECT":
                new_parent = SubCompany.objects.filter(id=parent_id).first()
                if not new_parent:
                    raise ValidationError(f"Sub Company with ID {parent_id} does not exist.")
                if obj.sub_company_id != parent_id:
                    obj.sub_company = new_parent
                    parent_changed = True
            elif level == "CIRCLE":
                new_project = Project.objects.filter(id=parent_id).first()
                new_sub_co = None
                new_main_co = None
                if not new_project:
                    new_sub_co = SubCompany.objects.filter(id=parent_id).first()
                if not new_project and not new_sub_co:
                    new_main_co = MainCompany.objects.filter(id=parent_id).first()
                if not new_project and not new_sub_co and not new_main_co:
                    raise ValidationError(f"Project, Sub Company, or Main Company with ID {parent_id} does not exist.")
                if new_project:
                    if obj.project_id != parent_id or obj.sub_company_id is not None or obj.main_company_id is not None:
                        obj.project = new_project
                        obj.sub_company = None
                        obj.main_company = None
                        parent_changed = True
                elif new_sub_co:
                    if obj.sub_company_id != parent_id or obj.project_id is not None or obj.main_company_id is not None:
                        obj.sub_company = new_sub_co
                        obj.project = None
                        obj.main_company = None
                        parent_changed = True
                elif new_main_co:
                    if obj.main_company_id != parent_id or obj.project_id is not None or obj.sub_company_id is not None:
                        obj.main_company = new_main_co
                        obj.sub_company = None
                        obj.project = None
                        parent_changed = True
            elif level == "DOMAIN":
                new_parent = Circle.objects.filter(id=parent_id).first()
                if not new_parent:
                    raise ValidationError(f"Circle with ID {parent_id} does not exist.")
                if obj.circle_id != parent_id:
                    obj.circle = new_parent
                    parent_changed = True
            elif level == "DEPARTMENT":
                new_parent = Domain.objects.filter(id=parent_id).first()
                if not new_parent:
                    raise ValidationError(f"Domain with ID {parent_id} does not exist.")
                if obj.domain_id != parent_id:
                    obj.domain = new_parent
                    parent_changed = True
            elif level in ("SUB_DEPARTMENT", "TEAM"):
                new_parent = Department.objects.filter(id=parent_id).first()
                if not new_parent:
                    raise ValidationError(f"Department with ID {parent_id} does not exist.")
                if obj.department_id != parent_id:
                    obj.department = new_parent
                    parent_changed = True

        # Check duplicate code within same scope
        if level == "MAIN_COMPANY":
            if MainCompany.objects.filter(code=code).exclude(id=node_id).exists():
                raise ValidationError(f"Another Main Company with code '{code}' already exists.")
        elif level == "SUB_COMPANY":
            if SubCompany.objects.filter(main_company=obj.main_company, code=code).exclude(id=node_id).exists():
                raise ValidationError(f"Another Sub Company with code '{code}' exists under this Main Company.")
        elif level == "PROJECT":
            if Project.objects.filter(sub_company=obj.sub_company, code=code).exclude(id=node_id).exists():
                raise ValidationError(f"Another Project with code '{code}' exists under this Sub Company.")
        elif level == "CIRCLE":
            if obj.project and Circle.objects.filter(project=obj.project, code=code).exclude(id=node_id).exists():
                raise ValidationError(f"Another Circle with code '{code}' exists under this Project.")
            elif obj.main_company and Circle.objects.filter(main_company=obj.main_company, code=code).exclude(id=node_id).exists():
                raise ValidationError(f"Another Circle with code '{code}' exists under this Main Company.")
        elif level == "DOMAIN":
            if obj.circle and Domain.objects.filter(circle=obj.circle, code=code).exclude(id=node_id).exists():
                raise ValidationError(f"Another Domain with code '{code}' exists under this Circle.")
        elif level == "DEPARTMENT":
            if Department.objects.filter(domain=obj.domain, code=code).exclude(id=node_id).exists():
                raise ValidationError(f"Another Department with code '{code}' exists under this Domain.")
        elif level in ("SUB_DEPARTMENT", "TEAM"):
            if SubDepartment.objects.filter(department=obj.department, code=code).exclude(id=node_id).exists():
                raise ValidationError(f"Another Team with code '{code}' exists under this Department.")

        old_data = {"name": obj.name, "code": obj.code, "status": obj.status}
        obj.name = name
        obj.code = code
        obj.status = status
        if hasattr(obj, "description"):
            obj.description = description
        obj.save()

        cls.log_audit(
            action="UPDATE",
            level=level,
            obj=obj,
            user=user,
            details={
                "old": old_data,
                "new": {"name": name, "code": code, "status": status},
                "parent_changed": parent_changed,
                "parent_id": parent_id if parent_changed else getattr(obj, "parent_id", None),
            },
            request=request,
        )

        return {
            "id": obj.id,
            "level": level,
            "name": obj.name,
            "code": obj.code,
            "description": getattr(obj, "description", ""),
            "status": obj.status,
        }

    @classmethod
    @transaction.atomic
    def delete_node(
        cls,
        level: str,
        node_id: int,
        user=None,
        request=None
    ) -> Dict[str, Any]:
        """
        Deletes a hierarchy node only if it has zero child elements.
        Enforces Section 26: prevent deletion if node has children.
        """
        level = level.upper()
        cfg = HIERARCHY_CONFIG.get(level)
        if not cfg:
            raise ValidationError(f"Invalid hierarchy level '{level}'.")

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
            raise ValidationError(f"Invalid hierarchy level '{level}'.")

        obj: Any = model.objects.filter(id=node_id).first()
        if not obj:
            raise ValidationError(f"{cfg['name']} with ID {node_id} does not exist.")

        # Check for children
        if level == "MAIN_COMPANY":
            sc_count = obj.sub_companies.count()
            cir_count = obj.circles.count()
            if sc_count > 0 or cir_count > 0:
                parts = []
                if sc_count > 0:
                    parts.append(f"{sc_count} sub companies")
                if cir_count > 0:
                    parts.append(f"{cir_count} direct circles")
                raise ValidationError(
                    f"Cannot delete '{obj.name}'. It contains {', '.join(parts)}. "
                    f"Please delete or reassign child nodes first."
                )

        child_attr = {
            "MAIN_COMPANY": "sub_companies",
            "SUB_COMPANY": "projects",
            "PROJECT": "circles",
            "CIRCLE": "domains",
            "DOMAIN": "departments",
            "DEPARTMENT": "sub_departments",
            "SUB_DEPARTMENT": "users",
            "TEAM": "users",
        }.get(level)

        if child_attr and hasattr(obj, child_attr):
            child_count = getattr(obj, child_attr).count()
            if child_count > 0:
                child_level_val = str(cfg.get("child_level") or "")
                child_title = HIERARCHY_CONFIG.get(child_level_val, {}).get("plural_name", "children") if child_level_val else "children"
                raise ValidationError(
                    f"Cannot delete '{obj.name}'. It contains {child_count} child {child_title}. "
                    f"Please delete or reassign child nodes first."
                )

        obj_repr = str(obj)
        obj_id = obj.id
        obj.delete()

        cls.log_audit(
            action="DELETE",
            level=level,
            obj=None,
            user=user,
            details={"deleted_id": obj_id, "deleted_repr": obj_repr},
            request=request,
        )

        return {"success": True, "message": f"{cfg['name']} '{obj_repr}' deleted successfully."}
