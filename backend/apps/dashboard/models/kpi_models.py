from django.db import models
from apps.organization.models import Circle, Domain, MainCompany, SubCompany, Project, Department
from apps.identity.models import User


class ReportingPeriod(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(unique=True, max_length=100)
    period_type = models.CharField(max_length=20)
    start_date = models.DateField()
    end_date = models.DateField()
    freeze_at = models.DateTimeField(null=True, blank=True)
    is_frozen = models.BooleanField(default=False)
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "organization_reportingperiod"
        ordering = ["-start_date"]

    def __str__(self):
        return self.name


class KPI(models.Model):
    id = models.BigAutoField(primary_key=True)
    code = models.CharField(unique=True, max_length=50)
    name = models.CharField(max_length=200)
    definition = models.TextField(blank=True, default="")
    calculation_formula = models.TextField(blank=True, default="")
    unit = models.CharField(max_length=50, blank=True, default="")
    direction = models.CharField(max_length=20, default="HIGHER_BETTER")
    frequency = models.CharField(max_length=20, default="MONTHLY")
    risk_category = models.CharField(max_length=100, blank=True, default="")
    priority = models.CharField(max_length=20, default="MEDIUM")
    default_owner = models.CharField(max_length=100, blank=True, default="")
    is_executive = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)
    domain = models.ForeignKey(Domain, on_delete=models.DO_NOTHING, related_name="kpis")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "kpis_kpi"
        ordering = ["display_order", "code"]

    def __str__(self):
        return f"{self.code} - {self.name}"


class KPIValue(models.Model):
    id = models.BigAutoField(primary_key=True)
    kpi = models.ForeignKey(KPI, on_delete=models.DO_NOTHING, related_name="values")
    circle = models.ForeignKey(Circle, on_delete=models.DO_NOTHING, related_name="kpi_values")
    period = models.ForeignKey(ReportingPeriod, on_delete=models.DO_NOTHING, related_name="kpi_values")
    actual_value = models.DecimalField(max_digits=15, decimal_places=2)
    target_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    previous_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    numerator_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    denominator_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    variance_to_target = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    variance_percentage = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    rag_status = models.CharField(max_length=20, default="GREEN")
    trend = models.CharField(max_length=20, default="FLAT")
    notes = models.TextField(blank=True, default="")
    entered_by = models.ForeignKey(User, on_delete=models.DO_NOTHING, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "kpis_kpivalue"
        unique_together = (("kpi", "circle", "period"),)
        ordering = ["kpi__display_order", "kpi__code"]

    def __str__(self):
        return f"{self.kpi.code} ({self.circle.name}) - {self.actual_value}"


class GovernanceIssue(models.Model):
    id = models.BigAutoField(primary_key=True)
    issue_code = models.CharField(unique=True, max_length=50)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    severity = models.CharField(max_length=20, default="MEDIUM")
    status = models.CharField(max_length=30, default="OPEN")
    rag_status = models.CharField(max_length=10, default="AMBER")
    escalation_level = models.CharField(max_length=30, default="LEVEL_1")
    root_cause = models.TextField(blank=True, default="")
    corrective_action = models.TextField(blank=True, default="")
    preventive_action = models.TextField(blank=True, default="")
    owner_name = models.CharField(max_length=100, blank=True, default="")
    target_date = models.DateField()
    closure_date = models.DateField(null=True, blank=True)
    is_repeat = models.BooleanField(default=False)
    circle = models.ForeignKey(Circle, on_delete=models.DO_NOTHING, related_name="governance_issues")
    domain = models.ForeignKey(Domain, on_delete=models.DO_NOTHING, related_name="governance_issues")
    kpi = models.ForeignKey(KPI, on_delete=models.DO_NOTHING, null=True, blank=True, related_name="issues")
    created_by = models.ForeignKey(User, on_delete=models.DO_NOTHING, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "governance_issue"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.issue_code} - {self.title}"


class GovernanceActionItem(models.Model):
    id = models.BigAutoField(primary_key=True)
    action_code = models.CharField(unique=True, max_length=50)
    source = models.CharField(max_length=100, blank=True, default="")
    review_date = models.DateField()
    management_direction = models.TextField(blank=True, default="")
    rca_issue = models.TextField(blank=True, default="")
    expected_outcome = models.TextField(blank=True, default="")
    accountable_owner = models.CharField(max_length=100)
    supporting_owner = models.CharField(max_length=100, blank=True, default="")
    priority = models.CharField(max_length=20, default="MEDIUM")
    action_date = models.DateField()
    target_date = models.DateField()
    status = models.CharField(max_length=30, default="IN_PROGRESS")
    progress_percentage = models.IntegerField(default=0)
    latest_update = models.TextField(blank=True, default="")
    dependency = models.TextField(blank=True, default="")
    last_update_date = models.DateField(null=True, blank=True)
    ageing_days = models.IntegerField(default=0)
    overdue_days = models.IntegerField(default=0)
    governance_rag = models.CharField(max_length=10, default="AMBER")
    escalation_level = models.CharField(max_length=50, blank=True, default="")
    closure_date = models.DateField(null=True, blank=True)
    closure_remarks = models.TextField(blank=True, default="")
    circle = models.ForeignKey(Circle, on_delete=models.DO_NOTHING, null=True, blank=True, related_name="action_items")
    domain = models.ForeignKey(Domain, on_delete=models.DO_NOTHING, related_name="action_items")
    kpi = models.ForeignKey(KPI, on_delete=models.DO_NOTHING, null=True, blank=True, related_name="action_items")
    issue = models.ForeignKey(GovernanceIssue, on_delete=models.DO_NOTHING, null=True, blank=True, related_name="actions")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "governance_actionitem"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action_code} - {self.accountable_owner}"
