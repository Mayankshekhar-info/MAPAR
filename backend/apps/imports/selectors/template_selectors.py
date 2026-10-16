"""
Template Database Selectors for Uploads Module.
Pure read/retrieval operations following MAPAR architectural guidelines.
"""

from typing import Optional, List, Dict, Any
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from apps.imports.models import (
    UploadTemplate,
    UploadTemplateVersion,
    UploadTemplateColumn,
)


def list_templates(status: Optional[str] = None, search: Optional[str] = None):
    """
    Returns templates with latest version metadata, column count, and batch count.
    """
    qs = UploadTemplate.objects.all().prefetch_related("versions", "versions__columns").select_related("created_by")
    
    if status and status != "ALL":
        qs = qs.filter(status=status)
        
    if search:
        search = search.strip()
        qs = qs.filter(
            Q(name__icontains=search) |
            Q(code__icontains=search) |
            Q(description__icontains=search) |
            Q(data_level__icontains=search)
        )
        
    return qs.order_by("-created_at")


def get_template_by_id(template_id: int) -> UploadTemplate:
    """
    Retrieves a single template with all versions and columns prefetched.
    """
    return get_object_or_404(
        UploadTemplate.objects.prefetch_related("versions", "versions__columns").select_related("created_by"),
        pk=template_id
    )


def get_latest_template_version(template_id: int) -> Optional[UploadTemplateVersion]:
    """
    Returns the latest active version for a given template.
    """
    return (
        UploadTemplateVersion.objects.filter(template_id=template_id, is_active=True)
        .prefetch_related("columns")
        .order_by("-version_number")
        .first()
    )


def get_template_version_by_id(version_id: int) -> UploadTemplateVersion:
    """
    Returns a specific template version with its ordered columns.
    """
    return get_object_or_404(
        UploadTemplateVersion.objects.select_related("template", "created_by").prefetch_related("columns"),
        pk=version_id
    )


def get_hierarchy_levels() -> List[Dict[str, str]]:
    """
    Returns valid organization hierarchy levels based on MAPAR-v2 organization architecture.
    """
    return [
        {"key": "MAIN_COMPANY", "label": "Main Company Level"},
        {"key": "SUB_COMPANY", "label": "Sub-Company Level"},
        {"key": "PROJECT", "label": "Project Level"},
        {"key": "CIRCLE", "label": "Circle Level (Operational)"},
        {"key": "DOMAIN", "label": "Domain Governance Level"},
        {"key": "DEPARTMENT", "label": "Department Level"},
        {"key": "SUB_DEPARTMENT", "label": "Sub-Department / Team Level"},
    ]
