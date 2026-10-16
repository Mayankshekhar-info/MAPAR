from django.db import models
from django.core.serializers.json import DjangoJSONEncoder
from .import_batch import ImportBatch


class ImportStagedRow(models.Model):
    """
    Intermediate staged data row parsed from the uploaded Excel file.
    Allows pre-commit inspection, row-by-row isolation, and transactional batch commits.
    """
    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name="staged_rows")
    row_index = models.PositiveIntegerField(help_text="Excel row index (2, 3, 4...)")
    raw_data = models.JSONField(default=dict, encoder=DjangoJSONEncoder, help_text="Parsed key-value map for this row")
    is_valid = models.BooleanField(default=True, db_index=True)
    validation_errors = models.JSONField(default=list, encoder=DjangoJSONEncoder, blank=True)
    is_imported = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "imports_importstagedrow"
        ordering = ["batch", "row_index"]
        unique_together = ("batch", "row_index")
        verbose_name = "Import Staged Row"
        verbose_name_plural = "Import Staged Rows"

    def __str__(self):
        return f"Batch {self.batch.batch_id} - Row #{self.row_index} ({'VALID' if self.is_valid else 'INVALID'})"
