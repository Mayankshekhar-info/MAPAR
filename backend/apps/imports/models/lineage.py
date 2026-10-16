from django.db import models
from django.conf import settings
from .import_batch import ImportBatch
from .template_version import UploadTemplateVersion


class ImportAuditLineage(models.Model):
    """
    Data lineage and audit record for every action performed on an import batch.
    Connects template version, original file, batch execution, user, and records affected.
    """
    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name="lineage_events")
    template_version = models.ForeignKey(UploadTemplateVersion, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100, db_index=True)
    records_affected = models.IntegerField(default=0)
    details = models.JSONField(default=dict, blank=True)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "imports_importauditlineage"
        ordering = ["-created_at"]
        verbose_name = "Import Audit Lineage"
        verbose_name_plural = "Import Audit Lineages"

    def __str__(self):
        return f"{self.action} on Batch {self.batch.batch_id} by {self.performed_by}"
