from django.db import models
from .kpi_definition import KPIDefinition


class KPICalculationResult(models.Model):
    """
    Persisted, cached calculation result for a KPI definition evaluated
    at a specific organizational hierarchy node and reporting period.
    """
    class RAGStatus(models.TextChoices):
        GREEN = "GREEN", "Green (Target Met / Healthy)"
        AMBER = "AMBER", "Amber (At Risk / Acceptable)"
        RED = "RED", "Red (Breached / Critical)"
        NEUTRAL = "NEUTRAL", "Neutral / Unclassified"
        UNKNOWN = "UNKNOWN", "Unknown / Calculation Error"

    class CalculationStatus(models.TextChoices):
        SUCCESS = "SUCCESS", "Success"
        NO_DATA = "NO_DATA", "No Relevant Data"
        DIV_ZERO = "DIV_ZERO", "Division by Zero"
        ERROR = "ERROR", "Calculation Error"

    kpi = models.ForeignKey(KPIDefinition, on_delete=models.CASCADE, related_name="results")
    reporting_period = models.ForeignKey(
        "dashboard.ReportingPeriod",
        on_delete=models.CASCADE,
        related_name="kpi_results",
        db_constraint=False
    )
    hierarchy_level = models.CharField(max_length=50, db_index=True)
    hierarchy_id = models.IntegerField(db_index=True)
    hierarchy_name = models.CharField(max_length=200, blank=True, default="")
    
    calculated_value = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    target_value = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    variance_to_target = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    variance_percentage = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    achievement_percentage = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    rag_status = models.CharField(
        max_length=20,
        choices=RAGStatus.choices,
        default=RAGStatus.NEUTRAL,
        db_index=True
    )
    records_considered = models.IntegerField(default=0)
    records_excluded = models.IntegerField(default=0)
    
    calculation_status = models.CharField(
        max_length=30,
        choices=CalculationStatus.choices,
        default=CalculationStatus.SUCCESS,
        db_index=True
    )
    error_message = models.TextField(blank=True, default="")
    lineage_info = models.JSONField(
        default=dict,
        blank=True,
        help_text="Lineage metadata: batch IDs, template versions, parameter sub-values"
    )
    calculated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        db_table = "kpi_kpicalculationresult"
        ordering = ["-calculated_at"]
        unique_together = ("kpi", "reporting_period", "hierarchy_level", "hierarchy_id")
        verbose_name = "KPI Calculation Result"
        verbose_name_plural = "KPI Calculation Results"

    def __str__(self):
        return (
            f"{self.kpi.code} @ {self.hierarchy_level}:{self.hierarchy_id} "
            f"({self.reporting_period}) = {self.calculated_value} [{self.rag_status}]"
        )
