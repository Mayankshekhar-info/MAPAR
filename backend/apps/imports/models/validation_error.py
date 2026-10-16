from django.db import models
from .import_batch import ImportBatch


class ImportValidationError(models.Model):
    """
    Granular diagnostic record for each validation failure detected in an import batch.
    Enables user-facing error inspection grids and downloadable error reports.
    """
    class Severity(models.TextChoices):
        ERROR = "ERROR", "Blocking Error"
        WARNING = "WARNING", "Warning"

    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name="validation_errors")
    row_index = models.PositiveIntegerField(db_index=True)
    column_name = models.CharField(max_length=150, db_index=True)
    cell_value = models.TextField(blank=True, default="")
    error_message = models.TextField()
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.ERROR)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "imports_importvalidationerror"
        ordering = ["row_index", "column_name"]
        verbose_name = "Import Validation Error"
        verbose_name_plural = "Import Validation Errors"

    def __str__(self):
        return f"Row {self.row_index} [{self.column_name}]: {self.error_message}"
