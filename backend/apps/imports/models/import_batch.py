from typing import Optional, Any
from django.db import models
from django.conf import settings
from .template_version import UploadTemplateVersion


class ImportBatch(models.Model):
    circle_id: Optional[int]
    reporting_period_id: Optional[int]
    staged_rows: Any
    validation_errors: Any
    """
    Immutable import audit batch tracking an uploaded file, validation metrics, and commit status.
    """
    class Status(models.TextChoices):
        UPLOADED = "UPLOADED", "Uploaded"
        VALIDATING = "VALIDATING", "Validating"
        VALIDATED = "VALIDATED", "Validated (Pending Commit)"
        REVIEW_REQUIRED = "REVIEW_REQUIRED", "Review Required"
        COMMITTING = "COMMITTING", "Committing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Validation Failed"
        REJECTED = "REJECTED", "Rejected by User"

    batch_id = models.CharField(max_length=100, unique=True, db_index=True)
    template_version = models.ForeignKey(UploadTemplateVersion, on_delete=models.PROTECT, related_name="batches")
    reporting_period = models.ForeignKey(
        "dashboard.ReportingPeriod",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_batches",
        db_constraint=False,
    )
    company = models.ForeignKey(
        "organization.MainCompany",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_batches",
    )
    sub_company = models.ForeignKey(
        "organization.SubCompany",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_batches",
    )
    project = models.ForeignKey(
        "organization.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_batches",
    )
    circle = models.ForeignKey(
        "organization.Circle",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_batches",
    )
    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_batches",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_batches"
    )
    original_filename = models.CharField(max_length=255)
    stored_file_path = models.CharField(max_length=500, blank=True, default="")
    file_size_bytes = models.BigIntegerField(default=0)
    file_hash = models.CharField(max_length=64, blank=True, default="", db_index=True, help_text="SHA-256 hash of uploaded file")
    
    total_rows = models.IntegerField(default=0)
    valid_rows = models.IntegerField(default=0)
    error_rows = models.IntegerField(default=0)
    duplicate_rows_count = models.IntegerField(default=0, help_text="Count of detected duplicate records")
    duplicate_handling = models.CharField(
        max_length=20,
        choices=[("ERROR", "Flag as Error"), ("SKIP", "Skip Duplicates"), ("CORRECT", "Correct / Overwrite Existing")],
        default="ERROR"
    )
    auto_committed = models.BooleanField(default=False, help_text="True if batch was automatically committed after passing all validation rules")
    
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.UPLOADED, db_index=True)
    summary_notes = models.TextField(blank=True, default="")
    applied_kpi = models.ForeignKey(
        "kpi.KPIDefinition",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_batches",
        db_constraint=False,
    )
    kpi_execution_status = models.CharField(
        max_length=30,
        blank=True,
        default="",
        help_text="KPI calculation status: SUCCESS, NO_DATA, ERROR, etc."
    )
    kpi_result_summary = models.JSONField(
        default=dict,
        blank=True,
        help_text="Calculated KPI result, records matched, grouped results"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "imports_importbatch"
        ordering = ["-created_at"]
        verbose_name = "Import Batch"
        verbose_name_plural = "Import Batches"

    def __str__(self):
        return f"{self.batch_id} - {self.template_version} [{self.status}]"

    @property
    def template(self):
        return self.template_version.template if self.template_version else None

    @property
    def uploaded_at(self):
        return self.created_at

    @property
    def imported_rows(self) -> int:
        return self.valid_rows

