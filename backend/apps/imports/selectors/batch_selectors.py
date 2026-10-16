"""
Import Batch Database Selectors for Uploads Module.
Pure read/retrieval operations following MAPAR architectural guidelines.
"""

from typing import Optional, List, Dict, Any
from django.db.models import Q
from django.shortcuts import get_object_or_404
from apps.imports.models import (
    ImportBatch,
    ImportValidationError,
    ImportStagedRow,
    ImportAuditLineage,
)
from apps.dashboard.selectors.cockpit_selectors import get_user_circle_ids


def list_batches(
    template_id: Optional[int] = None,
    status: Optional[str] = None,
    reporting_period_id: Optional[int] = None,
    search: Optional[str] = None,
    user=None,
):
    """
    Returns import batches filtered by criteria and scoped by user permissions.
    """
    qs = (
        ImportBatch.objects.all()
        .select_related("template_version__template", "reporting_period", "uploaded_by")
        .order_by("-created_at")
    )

    if template_id:
        qs = qs.filter(template_version__template_id=template_id)

    if status and status != "ALL":
        qs = qs.filter(status=status)

    if reporting_period_id:
        qs = qs.filter(reporting_period_id=reporting_period_id)

    if search:
        search = search.strip()
        qs = qs.filter(
            Q(batch_id__icontains=search) |
            Q(original_filename__icontains=search) |
            Q(template_version__template__name__icontains=search)
        )

    return qs


def get_batch_by_identifier(batch_identifier: str) -> ImportBatch:
    """
    Retrieves a single batch by primary key or unique batch_id string.
    """
    if batch_identifier.isdigit():
        return get_object_or_404(
            ImportBatch.objects.select_related(
                "template_version__template",
                "reporting_period",
                "uploaded_by"
            ),
            pk=int(batch_identifier)
        )
    return get_object_or_404(
        ImportBatch.objects.select_related(
            "template_version__template",
            "reporting_period",
            "uploaded_by"
        ),
        batch_id=batch_identifier
    )


def get_batch_errors(batch_id_or_pk: str, limit: int = 100, offset: int = 0):
    """
    Returns paginated validation errors for a specific batch.
    """
    batch = get_batch_by_identifier(batch_id_or_pk)
    qs = ImportValidationError.objects.filter(batch=batch).order_by("row_index", "column_name")
    total_count = qs.count()
    errors = qs[offset : offset + limit]
    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "errors": errors,
    }


def get_batch_lineage(batch_id_or_pk: str) -> List[ImportAuditLineage]:
    """
    Returns ordered lineage audit events for a batch.
    """
    batch = get_batch_by_identifier(batch_id_or_pk)
    return list(
        ImportAuditLineage.objects.filter(batch=batch)
        .select_related("performed_by", "template_version")
        .order_by("created_at")
    )


def get_batch_staged_rows(batch_id_or_pk: str, limit: int = 50, offset: int = 0):
    """
    Returns paginated staged rows for inspection.
    """
    batch = get_batch_by_identifier(batch_id_or_pk)
    qs = ImportStagedRow.objects.filter(batch=batch).order_by("row_index")
    total = qs.count()
    rows = qs[offset : offset + limit]
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "rows": rows,
    }
