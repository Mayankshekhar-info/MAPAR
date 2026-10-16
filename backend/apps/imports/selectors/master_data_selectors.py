"""
Selectors for Master Data Module.
Authoritative read queries for operational master data records, dynamic columns,
hierarchy cascading, and access scope boundaries.
"""

from typing import Dict, Any, List, Optional
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied, NotFound

from apps.imports.models import (
    UploadTemplate,
    UploadTemplateVersion,
    UploadTemplateColumn,
    ImportBatch,
    ImportStagedRow,
)
from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Department,
)
from apps.dashboard.models import ReportingPeriod
from common.permissions.authorization import AuthorizationService


def get_master_data_meta(user=None) -> Dict[str, Any]:
    """
    Returns metadata for Master Data page:
    - Active templates / datasets
    - Reporting periods
    - Scoped hierarchy options
    """
    templates = list(
        UploadTemplate.objects.filter(status=UploadTemplate.Status.ACTIVE)
        .prefetch_related("versions", "versions__columns")
        .order_by("name")
    )

    templates_data = []
    for tpl in templates:
        latest_ver = tpl.versions.filter(is_active=True).first() or tpl.versions.first()
        cols = []
        if latest_ver:
            cols = [
                {
                    "id": col.id,
                    "name": col.name,
                    "display_label": col.display_label,
                    "data_type": col.data_type,
                    "is_required": col.is_required,
                    "column_order": col.column_order,
                    "validation_rules": col.validation_rules,
                }
                for col in latest_ver.columns.all().order_by("column_order", "id")
            ]
        templates_data.append({
            "id": tpl.id,
            "code": tpl.code,
            "name": tpl.name,
            "description": tpl.description,
            "data_level": tpl.data_level,
            "target_entity": tpl.target_entity,
            "latest_version_id": latest_ver.id if latest_ver else None,
            "columns": cols,
        })

    periods = list(
        ReportingPeriod.objects.all().order_by("-start_date")[:100].values(
            "id", "name", "period_type", "is_current", "is_frozen", "start_date", "end_date"
        )
    )

    # Scoped hierarchy nodes
    scope = AuthorizationService.get_user_hierarchy_scope(user) if user else None

    mc_qs = MainCompany.objects.filter(status="ACTIVE")
    sc_qs = SubCompany.objects.filter(status="ACTIVE")
    prj_qs = Project.objects.filter(status="ACTIVE")
    cir_qs = Circle.objects.filter(is_active=True)
    dept_qs = Department.objects.filter(status="ACTIVE")

    if scope and not scope.is_unrestricted:
        if scope.main_company_ids:
            mc_qs = mc_qs.filter(id__in=scope.main_company_ids)
        if scope.sub_company_ids:
            allowed_sc = (scope.sub_company_ids or set()) | getattr(scope, "ancestor_sub_company_ids", set())
            sc_qs = sc_qs.filter(id__in=allowed_sc)
        if scope.project_ids:
            prj_qs = prj_qs.filter(id__in=scope.project_ids)
        if scope.circle_ids:
            cir_qs = cir_qs.filter(id__in=scope.circle_ids)
        if scope.department_ids:
            dept_qs = dept_qs.filter(id__in=scope.department_ids)

    return {
        "templates": templates_data,
        "reporting_periods": periods,
        "companies": list(mc_qs.values("id", "name", "code").order_by("name")),
        "sub_companies": list(sc_qs.values("id", "name", "code", "main_company_id").order_by("name")),
        "projects": list(prj_qs.values("id", "name", "code", "sub_company_id").order_by("name")),
        "circles": list(cir_qs.values("id", "name", "code", "project_id").order_by("name")),
        "departments": list(dept_qs.values("id", "name", "code").order_by("name")),
    }


def list_master_data_records(
    user=None,
    template_id: Optional[int] = None,
    batch_id: Optional[str] = None,
    company_id: Optional[int] = None,
    sub_company_id: Optional[int] = None,
    project_id: Optional[int] = None,
    circle_id: Optional[int] = None,
    department_id: Optional[int] = None,
    period_id: Optional[int] = None,
    search: Optional[str] = None,
    is_valid: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    sort_by: Optional[str] = None,
    sort_order: str = "asc",
) -> Dict[str, Any]:
    """
    Returns filtered, paginated Master Data records (ImportStagedRow)
    along with dynamic column schemas from the template version.
    Enforces downward circle-scoped access control.
    """
    # 1. Determine active batch and template version
    batch_qs = ImportBatch.objects.all().select_related(
        "template_version", "template_version__template", "reporting_period", "company", "sub_company", "project", "circle", "department"
    )

    if batch_id:
        batch_qs = batch_qs.filter(Q(batch_id=batch_id) | Q(id=batch_id if str(batch_id).isdigit() else 0))
    else:
        if template_id:
            batch_qs = batch_qs.filter(template_version__template_id=template_id)
        if company_id:
            batch_qs = batch_qs.filter(company_id=company_id)
        if sub_company_id:
            batch_qs = batch_qs.filter(sub_company_id=sub_company_id)
        if project_id:
            batch_qs = batch_qs.filter(project_id=project_id)
        if circle_id:
            batch_qs = batch_qs.filter(circle_id=circle_id)
        if department_id:
            batch_qs = batch_qs.filter(department_id=department_id)
        if period_id:
            batch_qs = batch_qs.filter(reporting_period_id=period_id)

    # Scoped authorization
    scope = AuthorizationService.get_user_hierarchy_scope(user) if user else None
    if scope and not scope.is_unrestricted:
        if scope.circle_ids:
            batch_qs = batch_qs.filter(Q(circle_id__in=scope.circle_ids) | Q(circle_id__isnull=True))

    latest_batch = batch_qs.first()

    # If no batch found matching explicit filters, check if there is a template
    active_template = None
    active_version = None
    if latest_batch:
        active_version = latest_batch.template_version
        active_template = active_version.template
    elif template_id:
        active_template = UploadTemplate.objects.filter(id=template_id).first()
        if active_template:
            active_version = active_template.versions.filter(is_active=True).first() or active_template.versions.first()

    if not active_version and not latest_batch:
        # Fallback to the first active template
        active_template = UploadTemplate.objects.filter(status=UploadTemplate.Status.ACTIVE).first()
        if active_template:
            active_version = active_template.versions.filter(is_active=True).first() or active_template.versions.first()

    columns: List[Dict[str, Any]] = []
    if active_version:
        columns = [
            {
                "id": col.id,
                "name": col.name,
                "display_label": col.display_label,
                "data_type": col.data_type,
                "is_required": col.is_required,
                "column_order": col.column_order,
                "validation_rules": col.validation_rules,
            }
            for col in active_version.columns.all().order_by("column_order", "id")
        ]

    # Query staged rows
    staged_qs = ImportStagedRow.objects.all().select_related("batch")

    if latest_batch:
        staged_qs = staged_qs.filter(batch=latest_batch)
    elif template_id:
        staged_qs = staged_qs.filter(batch__template_version__template_id=template_id)
    else:
        # If no batches exist yet, return empty list
        if not ImportBatch.objects.exists():
            return {
                "total": 0,
                "limit": limit,
                "offset": offset,
                "columns": columns,
                "records": [],
                "template": {
                    "id": active_template.id if active_template else None,
                    "name": active_template.name if active_template else None,
                    "code": active_template.code if active_template else None,
                } if active_template else None,
                "batch": None,
            }
        staged_qs = staged_qs.filter(batch__in=batch_qs[:10])

    if is_valid is not None:
        staged_qs = staged_qs.filter(is_valid=is_valid)

    # Search across JSON raw_data
    if search:
        search_term = str(search).strip().lower()
        # In SQLite / PostgreSQL, we filter through rows in memory or icontains on JSONField string
        # To be completely database-agnostic and robust:
        matching_ids = []
        for row in staged_qs.iterator():
            val_strs = [str(v).lower() for v in row.raw_data.values() if v is not None]
            if any(search_term in s for s in val_strs):
                matching_ids.append(row.id)
        staged_qs = staged_qs.filter(id__in=matching_ids)

    # Order rows
    if sort_by:
        # Dynamic sort key
        staged_qs = staged_qs.order_by(f"{'-' if sort_order == 'desc' else ''}row_index")
    else:
        staged_qs = staged_qs.order_by("row_index")

    total_count = staged_qs.count()
    rows = list(staged_qs[offset : offset + limit])

    records_data = []
    for r in rows:
        records_data.append({
            "id": r.id,
            "row_index": r.row_index,
            "raw_data": r.raw_data,
            "is_valid": r.is_valid,
            "validation_errors": r.validation_errors,
            "is_imported": r.is_imported,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "batch_id": r.batch.batch_id,
            "batch_status": r.batch.status,
            "reporting_period": r.batch.reporting_period.name if r.batch.reporting_period else None,
            "company": r.batch.company.name if r.batch.company else None,
            "sub_company": r.batch.sub_company.name if r.batch.sub_company else None,
            "project": r.batch.project.name if r.batch.project else None,
            "circle": r.batch.circle.name if r.batch.circle else None,
            "department": r.batch.department.name if r.batch.department else None,
        })

    batch_info = None
    if latest_batch:
        batch_info = {
            "id": latest_batch.id,
            "batch_id": latest_batch.batch_id,
            "status": latest_batch.status,
            "original_filename": latest_batch.original_filename,
            "total_rows": latest_batch.total_rows,
            "valid_rows": latest_batch.valid_rows,
            "error_rows": latest_batch.error_rows,
            "reporting_period": latest_batch.reporting_period.name if latest_batch.reporting_period else None,
            "company": latest_batch.company.name if latest_batch.company else None,
            "sub_company": latest_batch.sub_company.name if latest_batch.sub_company else None,
            "project": latest_batch.project.name if latest_batch.project else None,
            "circle": latest_batch.circle.name if latest_batch.circle else None,
            "department": latest_batch.department.name if latest_batch.department else None,
            "created_at": latest_batch.created_at.isoformat() if latest_batch.created_at else None,
        }

    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "columns": columns,
        "records": records_data,
        "template": {
            "id": active_template.id if active_template else None,
            "name": active_template.name if active_template else None,
            "code": active_template.code if active_template else None,
        } if active_template else None,
        "batch": batch_info,
    }


def get_master_data_record_by_id(record_id: int, user=None) -> ImportStagedRow:
    """
    Retrieves a single Master Data record with scoped authorization.
    """
    row = ImportStagedRow.objects.select_related(
        "batch",
        "batch__template_version",
        "batch__template_version__template",
        "batch__company",
        "batch__circle",
    ).filter(id=record_id).first()

    if not row:
        raise NotFound(f"Master Data record #{record_id} does not exist.")

    scope = AuthorizationService.get_user_hierarchy_scope(user) if user else None
    if scope and not scope.is_unrestricted:
        if row.batch.circle_id and not scope.is_circle_allowed(row.batch.circle_id):
            raise PermissionDenied("Access Denied: You are not authorized to access records for this Circle.")

    return row
