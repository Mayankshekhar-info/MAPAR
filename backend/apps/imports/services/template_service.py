"""
Template Management Service for Uploads Module.
Encapsulates all write operations and business validation wrapped in atomic transactions.
"""

import re
from typing import Dict, Any, List
from django.core.exceptions import ValidationError
from django.utils.text import slugify

from common.database.transactions import atomic_operation
from apps.imports.models import (
    UploadTemplate,
    UploadTemplateVersion,
    UploadTemplateColumn,
)
from apps.organization.models import HierarchyAuditLog


class TemplateService:
    @staticmethod
    def _generate_code(name: str) -> str:
        slug = slugify(name).upper().replace("-", "_")
        return re.sub(r"[^A-Z0-9_]", "", slug)[:50]

    @staticmethod
    def validate_columns(columns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Validates column definitions:
        - At least 1 column required
        - Column names must be unique within the template version (auto-disambiguated if duplicate labels exist)
        - Data types must be supported
        """
        if not columns or len(columns) == 0:
            raise ValidationError("A template must contain at least one column definition.")

        seen_names = set()
        validated_columns = []
        valid_data_types = {dt.value for dt in UploadTemplateColumn.DataType}

        for idx, col in enumerate(columns):
            raw_name = str(col.get("name") or "").strip()
            display_label = str(col.get("display_label", ""))
            if not display_label and raw_name:
                display_label = raw_name

            if not raw_name and not display_label:
                raise ValidationError(f"Column at position {idx + 1} has no name or display label.")

            if not raw_name:
                slug_name = slugify(display_label).lower().replace("-", "_")
                raw_name = slug_name if slug_name else f"col_{idx + 1}"
            else:
                slug_name = slugify(raw_name).lower().replace("-", "_")
                raw_name = slug_name if slug_name else f"col_{idx + 1}"

            # Auto-disambiguate internal database column name for repeated display labels
            base_name = raw_name
            counter = 2
            while raw_name in seen_names:
                raw_name = f"{base_name}_{counter}"
                counter += 1
            seen_names.add(raw_name)

            data_type = str(col.get("data_type", UploadTemplateColumn.DataType.TEXT)).upper()
            if data_type not in valid_data_types:
                raise ValidationError(f"Invalid data type '{data_type}' for column '{display_label}'.")

            validated_columns.append({
                "name": raw_name,
                "display_label": display_label,
                "data_type": data_type,
                "is_required": bool(col.get("is_required", False)),
                "is_unique": bool(col.get("is_unique", False)),
                "column_order": col.get("column_order", idx),
                "default_value": str(col.get("default_value", "") or ""),
                "description": str(col.get("description", "") or ""),
                "validation_rules": col.get("validation_rules", {}) or {},
            })

        return validated_columns

    @classmethod
    def create_template(cls, data: Dict[str, Any], user=None) -> UploadTemplate:
        """
        Creates a new template along with its initial Version 1 and column schemas.
        Wrapped in atomic transaction.
        """
        name = data.get("name", "").strip()
        if not name:
            raise ValidationError("Template name is required.")

        code = data.get("code", "").strip() or cls._generate_code(name)
        if UploadTemplate.objects.filter(code=code).exists():
            code = f"{code}_{UploadTemplate.objects.count() + 1}"

        if UploadTemplate.objects.filter(name=name).exists():
            raise ValidationError(f"A template with the name '{name}' already exists.")

        description = data.get("description", "").strip()
        data_level = data.get("data_level", "CIRCLE").upper()
        target_entity = data.get("target_entity", "KPI_VALUES").upper()
        raw_columns = data.get("columns", [])

        validated_columns = cls.validate_columns(raw_columns)

        with atomic_operation():
            template = UploadTemplate.objects.create(
                name=name,
                code=code,
                description=description,
                data_level=data_level,
                status=UploadTemplate.Status.ACTIVE,
                target_entity=target_entity,
                created_by=user,
            )

            version = UploadTemplateVersion.objects.create(
                template=template,
                version_number=1,
                changelog="Initial template schema creation.",
                is_active=True,
                created_by=user,
            )

            columns_to_create = [
                UploadTemplateColumn(
                    version=version,
                    name=c["name"],
                    display_label=c["display_label"],
                    data_type=c["data_type"],
                    is_required=c["is_required"],
                    is_unique=c["is_unique"],
                    column_order=c["column_order"],
                    default_value=c["default_value"],
                    description=c["description"],
                    validation_rules=c["validation_rules"],
                )
                for c in validated_columns
            ]
            UploadTemplateColumn.objects.bulk_create(columns_to_create)

            # Audit log
            HierarchyAuditLog.objects.create(
                user=user if user and user.is_authenticated else None,
                action="CREATE",
                level="TEMPLATE",
                object_id=str(template.id),
                object_repr=f"Template {template.name} ({template.code})",
                details={
                    "data_level": template.data_level,
                    "target_entity": template.target_entity,
                    "columns_count": len(columns_to_create),
                }
            )

        return template

    @classmethod
    def create_new_version(cls, template_id: int, data: Dict[str, Any], user=None) -> UploadTemplateVersion:
        """
        Creates a new immutable version (v2, v3, etc.) for an existing template.
        Historical versions are preserved untouched.
        """
        template = UploadTemplate.objects.get(pk=template_id)
        raw_columns = data.get("columns", [])
        changelog = data.get("changelog", "").strip() or "Updated column schema."
        validated_columns = cls.validate_columns(raw_columns)

        with atomic_operation():
            # Find next version number
            latest_version = template.versions.order_by("-version_number").first()
            next_version_num = (latest_version.version_number + 1) if latest_version else 1

            new_version = UploadTemplateVersion.objects.create(
                template=template,
                version_number=next_version_num,
                changelog=changelog,
                is_active=True,
                created_by=user,
            )

            columns_to_create = [
                UploadTemplateColumn(
                    version=new_version,
                    name=c["name"],
                    display_label=c["display_label"],
                    data_type=c["data_type"],
                    is_required=c["is_required"],
                    is_unique=c["is_unique"],
                    column_order=c["column_order"],
                    default_value=c["default_value"],
                    description=c["description"],
                    validation_rules=c["validation_rules"],
                )
                for c in validated_columns
            ]
            UploadTemplateColumn.objects.bulk_create(columns_to_create)

            HierarchyAuditLog.objects.create(
                user=user if user and user.is_authenticated else None,
                action="UPDATE",
                level="TEMPLATE_VERSION",
                object_id=str(new_version.id),
                object_repr=f"Template {template.name} v{new_version.version_number}",
                details={
                    "version_number": new_version.version_number,
                    "changelog": changelog,
                    "columns_count": len(columns_to_create),
                }
            )

        return new_version

    @classmethod
    def update_version(cls, template_id: int, version_id: int, data: Dict[str, Any], user=None) -> UploadTemplateVersion:
        """
        Updates an existing template version in place without creating a new version.
        Updates column schemas, changelog, and optionally template metadata.
        """
        template = UploadTemplate.objects.get(pk=template_id)
        version = UploadTemplateVersion.objects.get(pk=version_id, template=template)

        with atomic_operation():
            # 1. Optional template-level updates
            if "name" in data and data["name"].strip():
                new_name = data["name"].strip()
                if UploadTemplate.objects.filter(name=new_name).exclude(pk=template_id).exists():
                    raise ValidationError(f"A template with the name '{new_name}' already exists.")
                template.name = new_name

            if "description" in data:
                template.description = data["description"].strip()

            if "data_level" in data and data["data_level"]:
                template.data_level = data["data_level"].upper()

            template.save()

            # 2. Version-level updates
            if "changelog" in data:
                version.changelog = str(data["changelog"] or "").strip()

            if "is_active" in data:
                version.is_active = bool(data["is_active"])

            version.save()

            # 3. Update columns if provided
            raw_columns = data.get("columns")
            if raw_columns is not None:
                validated_columns = cls.validate_columns(raw_columns)
                version.columns.all().delete()
                columns_to_create = [
                    UploadTemplateColumn(
                        version=version,
                        name=c["name"],
                        display_label=c["display_label"],
                        data_type=c["data_type"],
                        is_required=c["is_required"],
                        is_unique=c["is_unique"],
                        column_order=c["column_order"],
                        default_value=c["default_value"],
                        description=c["description"],
                        validation_rules=c["validation_rules"],
                    )
                    for c in validated_columns
                ]
                UploadTemplateColumn.objects.bulk_create(columns_to_create)

            HierarchyAuditLog.objects.create(
                user=user if user and user.is_authenticated else None,
                action="UPDATE",
                level="TEMPLATE_VERSION",
                object_id=str(version.id),
                object_repr=f"Updated Template {template.name} v{version.version_number} (in-place)",
                details={
                    "version_number": version.version_number,
                    "columns_count": len(validated_columns) if raw_columns is not None else version.columns.count(),
                }
            )

        return version

    @classmethod
    def delete_version(cls, template_id: int, version_id: int, user=None) -> Dict[str, Any]:
        """
        Deletes an old or selected template version and only its associated data.
        Does not affect other versions or unrelated data.
        """
        template = UploadTemplate.objects.get(pk=template_id)
        version = UploadTemplateVersion.objects.get(pk=version_id, template=template)

        total_versions = template.versions.count()
        if total_versions <= 1:
            raise ValidationError("Cannot delete the only version of a template. A template must have at least one version.")

        version_number = version.version_number
        is_active = version.is_active

        with atomic_operation():
            # Delete any batches uploaded specifically for this version to avoid PROTECT constraint.
            # Cascades staged rows, validation errors, and audit lineage of this version's batches.
            version.batches.all().delete()

            # Delete the version (cascades its columns)
            version.delete()

            # If the deleted version was active, activate the latest remaining version
            if is_active:
                remaining_latest = template.versions.order_by("-version_number").first()
                if remaining_latest:
                    remaining_latest.is_active = True
                    remaining_latest.save(update_fields=["is_active"])

            HierarchyAuditLog.objects.create(
                user=user if user and user.is_authenticated else None,
                action="DELETE",
                level="TEMPLATE_VERSION",
                object_id=str(version_id),
                object_repr=f"Deleted Template {template.name} v{version_number}",
                details={"template_id": template_id, "version_number": version_number}
            )

        return {
            "success": True,
            "message": f"Version v{version_number} of template '{template.name}' was successfully deleted."
        }

    @classmethod
    def get_affected_kpis(cls, template_id: int) -> List[Dict[str, Any]]:
        """
        Identifies active KPI definitions that reference this template as their source dataset,
        including which columns are mapped to parameters and filters.
        """
        from apps.kpi.models import KPIDefinition
        kpis = KPIDefinition.objects.filter(
            source_dataset_id=template_id,
            is_active=True
        ).prefetch_related("parameters", "filters")

        affected = []
        for k in kpis:
            param_cols = [p.source_column for p in k.parameters.all() if p.source_column]
            filter_cols = [f.field_name for f in k.filters.all() if f.field_name]
            all_used = list(dict.fromkeys(param_cols + filter_cols))

            affected.append({
                "id": k.id,
                "code": k.code,
                "name": k.name,
                "description": k.description,
                "calculation_type": k.calculation_type,
                "used_columns": all_used,
                "parameter_columns": param_cols,
                "filter_columns": filter_cols,
            })
        return affected

    @classmethod
    def update_template(cls, template_id: int, data: Dict[str, Any], user=None) -> UploadTemplate:
        """
        Updates an existing template's metadata and dynamic column configuration.
        Wrapped in atomic transaction.
        Protects historical uploaded data:
        - If historical import batches exist on the active version, branches to a new version (v2, v3).
        - If no batches exist on the active version, updates the version columns in place.
        """
        template = UploadTemplate.objects.get(pk=template_id)

        with atomic_operation():
            # 1. Update Template Metadata
            if "name" in data and data["name"].strip():
                new_name = data["name"].strip()
                if UploadTemplate.objects.filter(name=new_name).exclude(pk=template_id).exists():
                    raise ValidationError(f"A template with the name '{new_name}' already exists.")
                template.name = new_name

            if "description" in data:
                template.description = data["description"].strip()

            if "status" in data and data["status"] in UploadTemplate.Status.values:
                template.status = data["status"]

            if "data_level" in data and data["data_level"]:
                template.data_level = data["data_level"].upper()

            if "target_entity" in data and data["target_entity"]:
                template.target_entity = data["target_entity"].upper()

            template.save()

            # 2. Update Column Schema if provided
            raw_columns = data.get("columns")
            if raw_columns is not None:
                validated_columns = cls.validate_columns(raw_columns)
                latest_version = template.versions.order_by("-version_number").first()
                changelog = str(data.get("changelog") or "Updated template configuration and columns.").strip()

                # If historical batches exist against this version, create a new version to protect historical data
                if latest_version and latest_version.batches.exists():
                    latest_version.is_active = False
                    latest_version.save(update_fields=["is_active"])

                    next_version_num = latest_version.version_number + 1
                    active_version = UploadTemplateVersion.objects.create(
                        template=template,
                        version_number=next_version_num,
                        changelog=changelog,
                        is_active=True,
                        created_by=user,
                    )
                elif latest_version:
                    # Update in-place
                    active_version = latest_version
                    active_version.changelog = changelog
                    active_version.is_active = True
                    active_version.save(update_fields=["changelog", "is_active"])
                    active_version.columns.all().delete()
                else:
                    # Create initial version
                    active_version = UploadTemplateVersion.objects.create(
                        template=template,
                        version_number=1,
                        changelog=changelog,
                        is_active=True,
                        created_by=user,
                    )

                columns_to_create = [
                    UploadTemplateColumn(
                        version=active_version,
                        name=c["name"],
                        display_label=c["display_label"],
                        data_type=c["data_type"],
                        is_required=c["is_required"],
                        is_unique=c["is_unique"],
                        column_order=c["column_order"],
                        default_value=c["default_value"],
                        description=c["description"],
                        validation_rules=c["validation_rules"],
                    )
                    for c in validated_columns
                ]
                UploadTemplateColumn.objects.bulk_create(columns_to_create)

            # Audit Log
            HierarchyAuditLog.objects.create(
                user=user if user and user.is_authenticated else None,
                action="UPDATE",
                level="TEMPLATE",
                object_id=str(template.id),
                object_repr=f"Template {template.name} ({template.code})",
                details={
                    "name": template.name,
                    "data_level": template.data_level,
                    "target_entity": template.target_entity,
                    "status": template.status,
                    "has_column_updates": raw_columns is not None,
                }
            )

        return template

