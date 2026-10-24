from django.db import models
from django.conf import settings
from .kpi_definition import KPIDefinition


class KPICalculationAuditLog(models.Model):
    """
    Diagnostic & execution audit log for every calculation run.
    Stores complete operational metadata, record lineage, formula breakdown,
    and exclusion reasons for audit compliance.
    """
    class TriggerType(models.TextChoices):
        UPLOAD_COMMIT = "UPLOAD_COMMIT", "Upload Batch Commit"
        ON_DEMAND = "ON_DEMAND", "On-Demand User Request"
        RECALCULATE_ALL = "RECALCULATE_ALL", "Bulk Recalculation"
        PERIOD_CHANGE = "PERIOD_CHANGE", "Reporting Period Evaluation"

    kpi = models.ForeignKey(KPIDefinition, on_delete=models.CASCADE, related_name="audit_logs")
    reporting_period = models.ForeignKey(
        "dashboard.ReportingPeriod",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpi_audit_logs",
        db_constraint=False
    )
    hierarchy_level = models.CharField(max_length=50, blank=True, default="")
    hierarchy_id = models.IntegerField(null=True, blank=True)
    trigger_type = models.CharField(
        max_length=30,
        choices=TriggerType.choices,
        default=TriggerType.ON_DEMAND,
        db_index=True
    )
    batch = models.ForeignKey(
        "imports.ImportBatch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpi_calculation_audits"
    )
    status = models.CharField(max_length=30, db_index=True)
    calculated_value = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    execution_time_ms = models.FloatField(default=0.0)
    records_considered = models.IntegerField(default=0)
    records_excluded = models.IntegerField(default=0)
    diagnostics = models.JSONField(
        default=dict,
        blank=True,
        help_text="Step-by-step diagnostic breakdown, parameters, errors, and lineage"
    )
    executed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpi_calculation_audits"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "kpi_kpicalculationauditlog"
        ordering = ["-created_at"]
        verbose_name = "KPI Calculation Audit Log"
        verbose_name_plural = "KPI Calculation Audit Logs"

    def __str__(self):
        return f"[{self.created_at}] {self.kpi.code} - {self.trigger_type} ({self.status})"
