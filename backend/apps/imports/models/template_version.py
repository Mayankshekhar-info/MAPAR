from typing import Any
from django.db import models
from django.conf import settings
from .template import UploadTemplate


class UploadTemplateVersion(models.Model):
    columns: Any
    batches: Any
    """
    Immutable template version representing a specific point-in-time schema definition.
    Preserves historical integrity for previously imported batches.
    """
    template = models.ForeignKey(UploadTemplate, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField(default=1)
    changelog = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_template_versions")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "imports_uploadtemplateversion"
        ordering = ["-version_number"]
        unique_together = ("template", "version_number")
        verbose_name = "Upload Template Version"
        verbose_name_plural = "Upload Template Versions"

    def __str__(self):
        return f"{self.template.name} v{self.version_number}"
