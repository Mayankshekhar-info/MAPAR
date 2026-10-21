from django.db import models
from django.conf import settings
from apps.organization.models import MainCompany, SubCompany, Project, Circle


class KPIConfigurationVersion(models.Model):
    """
    Versioned store for approved KPI formula workbooks.
    Supports enterprise defaults, company-level configurations, project-specific overrides, and circle configurations.
    """
    class ScopeType(models.TextChoices):
        ENTERPRISE = "ENTERPRISE", "Enterprise Default"
        COMPANY = "COMPANY", "Company-Level Override"
        PROJECT = "PROJECT", "Project-Level Override"
        CIRCLE = "CIRCLE", "Circle-Level Override"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PREVIEW = "PREVIEW", "Preview (Pending Approval)"
        ACTIVE = "ACTIVE", "Active / Approved"
        SUPERSEDED = "SUPERSEDED", "Superseded by Newer Version"
        REJECTED = "REJECTED", "Rejected by Admin"

    version_number = models.PositiveIntegerField(default=1, db_index=True)
    name = models.CharField(max_length=200, help_text="Configuration version label or name")
    description = models.TextField(blank=True, default="")
    original_filename = models.CharField(max_length=255)
    stored_file_path = models.CharField(max_length=500, blank=True, default="")
    file_hash = models.CharField(max_length=64, db_index=True, help_text="SHA-256 hash of the uploaded workbook")

    scope_type = models.CharField(
        max_length=30,
        choices=ScopeType.choices,
        default=ScopeType.ENTERPRISE,
        db_index=True,
    )
    company = models.ForeignKey(
        MainCompany,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpi_configurations",
        help_text="Company scope if company-level configuration"
    )
    sub_company = models.ForeignKey(
        SubCompany,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpi_configurations",
        help_text="Sub-company scope if sub-company configuration"
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpi_configurations",
        help_text="Project scope if project-specific override"
    )
    circle = models.ForeignKey(
        Circle,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpi_configurations",
        help_text="Circle scope if circle-specific override"
    )
    hierarchy_level = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Canonical hierarchy level name (e.g. MAIN_COMPANY, SUB_COMPANY, PROJECT, CIRCLE)"
    )
    hierarchy_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="Target hierarchy node primary key ID"
    )
    is_inheritance_allowed = models.BooleanField(
        default=True,
        help_text="Whether descendants are permitted to inherit this configuration"
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    total_kpis = models.IntegerField(default=0)
    activated_kpi_codes = models.JSONField(default=list, blank=True)
    sheet_names = models.JSONField(default=list, blank=True)
    column_mappings = models.JSONField(default=dict, blank=True)
    cleaning_rules = models.JSONField(default=dict, blank=True)
    changelog = models.TextField(blank=True, default="")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_kpi_configurations"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    activated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "kpi_configurationversion"
        ordering = ["-version_number", "-created_at"]
        verbose_name = "KPI Configuration Version"
        verbose_name_plural = "KPI Configuration Versions"

    def __str__(self):
        return f"KPI Config v{self.version_number} - {self.name} [{self.scope_type}] ({self.status})"
