from typing import Any
from django.db import models
from django.conf import settings


class UploadTemplate(models.Model):
    versions: Any
    """
    User-configurable data ingestion template.
    Defines the data level, business target, status, and metadata.
    """
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACTIVE = "ACTIVE", "Active"
        ARCHIVED = "ARCHIVED", "Archived"

    name = models.CharField(max_length=200, unique=True, db_index=True)
    code = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(blank=True, default="")
    data_level = models.CharField(
        max_length=50,
        default="CIRCLE",
        help_text="Hierarchy tier (e.g. MAIN_COMPANY, SUB_COMPANY, PROJECT, CIRCLE, DOMAIN, DEPARTMENT, SUB_DEPARTMENT)"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    target_entity = models.CharField(max_length=100, default="KPI_VALUES", help_text="Target MAPAR data domain")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_upload_templates")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "imports_uploadtemplate"
        ordering = ["-created_at"]
        verbose_name = "Upload Template"
        verbose_name_plural = "Upload Templates"

    def __str__(self):
        return f"{self.name} [{self.data_level}]"
