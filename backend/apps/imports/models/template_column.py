from django.db import models
from .template_version import UploadTemplateVersion


class UploadTemplateColumn(models.Model):
    """
    User-defined dynamic column specification for a template version.
    Directly controls dynamic Excel generation and uploaded data validation.
    """
    class DataType(models.TextChoices):
        TEXT = "TEXT", "Text"
        INTEGER = "INTEGER", "Integer"
        DECIMAL = "DECIMAL", "Decimal"
        DATE = "DATE", "Date (YYYY-MM-DD)"
        BOOLEAN = "BOOLEAN", "Boolean (Yes/No, True/False)"
        PERCENTAGE = "PERCENTAGE", "Percentage"
        REFERENCE = "REFERENCE", "Organization Reference (Code)"

    version = models.ForeignKey(UploadTemplateVersion, on_delete=models.CASCADE, related_name="columns")
    name = models.CharField(max_length=100, help_text="Machine-safe field name/key")
    display_label = models.CharField(max_length=150, help_text="Human-readable Excel header label")
    data_type = models.CharField(max_length=30, choices=DataType.choices, default=DataType.TEXT)
    is_required = models.BooleanField(default=False)
    is_unique = models.BooleanField(default=False)
    column_order = models.PositiveIntegerField(default=0)
    default_value = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")
    validation_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Custom validation constraints: min, max, allowed_values, reference_level (e.g. CIRCLE, DOMAIN)"
    )

    class Meta:
        db_table = "imports_uploadtemplatecolumn"
        ordering = ["column_order", "id"]
        unique_together = ("version", "name")
        verbose_name = "Upload Template Column"
        verbose_name_plural = "Upload Template Columns"

    def __str__(self):
        return f"{self.display_label} ({self.data_type}) [Col {self.column_order}]"
