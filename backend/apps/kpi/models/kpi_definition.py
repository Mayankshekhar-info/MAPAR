from django.db import models
from django.conf import settings
from apps.organization.models import Domain, MainCompany, Project, Circle
from .kpi_config_version import KPIConfigurationVersion


class KPIDefinition(models.Model):
    """
    Universal Configurable KPI Definition.
    Enables users to configure arbitrary metrics, source datasets, fields,
    safe expression formulas, aggregations, hierarchy targets, and status rules.
    """
    class CalculationType(models.TextChoices):
        SIMPLE_AGGREGATE = "SIMPLE_AGGREGATE", "Simple Aggregate (Sum, Avg, Count, Min, Max)"
        FORMULA = "FORMULA", "Custom Expression Formula"
        RATIO = "RATIO", "Ratio (Numerator / Denominator)"
        PERCENTAGE = "PERCENTAGE", "Percentage ((Numerator / Denominator) * 100)"
        ACHIEVEMENT_PCT = "ACHIEVEMENT_PCT", "Target Achievement % ((Actual / Target) * 100)"
        VARIANCE = "VARIANCE", "Variance / Gap (Actual - Target or Required - Available)"
        DERIVED = "DERIVED", "Derived (Computed from other KPIs)"
        CONDITIONAL = "CONDITIONAL", "Conditional Evaluation"

    class AggregationMethod(models.TextChoices):
        SUM = "SUM", "Sum"
        AVG = "AVG", "Average"
        COUNT = "COUNT", "Count"
        COUNT_DISTINCT = "COUNT_DISTINCT", "Count Distinct"
        MIN = "MIN", "Minimum"
        MAX = "MAX", "Maximum"
        LATEST = "LATEST", "Latest Recorded Value"

    class Direction(models.TextChoices):
        HIGHER_BETTER = "HIGHER_BETTER", "Higher is Better"
        LOWER_BETTER = "LOWER_BETTER", "Lower is Better"
        NEUTRAL = "NEUTRAL", "Neutral / Informational"

    class HierarchyLevel(models.TextChoices):
        MAIN_COMPANY = "MAIN_COMPANY", "Main Company"
        SUB_COMPANY = "SUB_COMPANY", "Sub Company"
        PROJECT = "PROJECT", "Project"
        CIRCLE = "CIRCLE", "Circle"
        DOMAIN = "DOMAIN", "Domain"
        DEPARTMENT = "DEPARTMENT", "Department"
        SUB_DEPARTMENT = "SUB_DEPARTMENT", "Sub Department"

    class ComparisonMethod(models.TextChoices):
        NONE = "NONE", "No Comparison"
        TARGET = "TARGET", "Versus Target"
        PREVIOUS_PERIOD = "PREVIOUS_PERIOD", "Versus Previous Period"
        YEAR_OVER_YEAR = "YEAR_OVER_YEAR", "Year over Year"

    class VisualizationType(models.TextChoices):
        CARD = "CARD", "Standard KPI Card"
        PROGRESS = "PROGRESS", "Progress Tracker"
        GAUGE = "GAUGE", "Gauge Meter"
        FUNNEL = "FUNNEL", "Funnel Breakdown"
        METRIC_STAT = "METRIC_STAT", "Compact Metric Stat"

    code = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=200, db_index=True)
    description = models.TextField(blank=True, default="")
    domain = models.ForeignKey(
        Domain,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="configured_kpis"
    )
    scope_type = models.CharField(
        max_length=30,
        choices=KPIConfigurationVersion.ScopeType.choices,
        default=KPIConfigurationVersion.ScopeType.ENTERPRISE,
        db_index=True,
    )
    hierarchy_level = models.CharField(
        max_length=50,
        choices=HierarchyLevel.choices,
        default=HierarchyLevel.CIRCLE,
        db_index=True
    )
    hierarchy_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Target organization node ID (e.g. Circle ID, Project ID, Company ID). None means dynamic viewer scope."
    )
    config_version = models.ForeignKey(
        "kpi.KPIConfigurationVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpi_definitions",
        help_text="Originating approved configuration version"
    )
    company = models.ForeignKey(
        MainCompany,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scoped_kpi_definitions",
        help_text="Company-specific override scope if applicable"
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scoped_kpi_definitions",
        help_text="Project-specific override scope if applicable"
    )
    circle = models.ForeignKey(
        Circle,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scoped_kpi_definitions",
        help_text="Circle-specific override scope if applicable"
    )
    is_inheritance_allowed = models.BooleanField(
        default=True,
        help_text="Whether child hierarchy nodes are permitted to inherit this definition if they lack an explicit override"
    )
    cleaning_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Deterministic cleaning and normalization rules for raw data associated with this KPI"
    )
    visualization_type = models.CharField(
        max_length=50,
        choices=VisualizationType.choices,
        default=VisualizationType.CARD,
        db_index=True
    )
    calculation_type = models.CharField(
        max_length=30,
        choices=CalculationType.choices,
        default=CalculationType.SIMPLE_AGGREGATE,
        db_index=True
    )
    source_dataset = models.ForeignKey(
        "imports.UploadTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpi_definitions"
    )
    formula_expression = models.TextField(
        blank=True,
        default="",
        help_text="Safe arithmetic expression with allowed variables and functions, e.g. '(actual / target) * 100'"
    )
    logic_expression = models.TextField(
        blank=True,
        default="",
        help_text="Human-readable business logic expression e.g. 'FILTER records WHERE [circle] = \"DL\" CALCULATE (SUM([sites_up]) / SUM([total_sites])) * 100'"
    )
    aggregation_method = models.CharField(
        max_length=30,
        choices=AggregationMethod.choices,
        default=AggregationMethod.SUM
    )
    unit = models.CharField(max_length=50, blank=True, default="Units")
    decimal_precision = models.PositiveSmallIntegerField(default=2)
    direction = models.CharField(
        max_length=20,
        choices=Direction.choices,
        default=Direction.HIGHER_BETTER
    )
    target_value = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    target_field = models.CharField(max_length=100, blank=True, default="", help_text="Dynamic field for row/node target")
    comparison_method = models.CharField(
        max_length=30,
        choices=ComparisonMethod.choices,
        default=ComparisonMethod.TARGET
    )
    threshold_green = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Achievement % for GREEN status (e.g. 95)"
    )
    threshold_amber = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Achievement % for AMBER status (e.g. 80)"
    )
    natural_language_rule = models.TextField(
        blank=True,
        default="",
        help_text="Plain English business rule as entered by the user"
    )
    presentation_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Custom presentation configuration: multi-column colors, groupings, and visual overrides"
    )
    is_active = models.BooleanField(default=True, db_index=True)
    is_executive = models.BooleanField(default=False)
    display_order = models.IntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_kpi_definitions"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "kpi_kpidefinition"
        ordering = ["display_order", "code"]
        verbose_name = "KPI Definition"
        verbose_name_plural = "KPI Definitions"
        unique_together = (("code", "config_version"),)

    def __str__(self):
        return f"{self.code} - {self.name} [{self.calculation_type}]"


class KPIParameter(models.Model):
    """
    Maps variable symbols in a formula to specific columns in the source dataset.
    """
    class Aggregation(models.TextChoices):
        SUM = "SUM", "Sum"
        AVG = "AVG", "Average"
        MIN = "MIN", "Minimum"
        MAX = "MAX", "Maximum"
        COUNT = "COUNT", "Count"
        COUNT_DISTINCT = "COUNT_DISTINCT", "Count Distinct"

    kpi = models.ForeignKey(KPIDefinition, on_delete=models.CASCADE, related_name="parameters")
    name = models.CharField(max_length=50, help_text="Formula variable token, e.g. 'actual', 'X', 'headcount'")
    label = models.CharField(max_length=100, blank=True, default="")
    source_column = models.CharField(max_length=100, help_text="Column name matching UploadTemplateColumn.name")
    aggregation = models.CharField(
        max_length=30,
        choices=Aggregation.choices,
        default=Aggregation.SUM
    )
    default_value = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)

    class Meta:
        db_table = "kpi_kpiparameter"
        unique_together = ("kpi", "name")
        verbose_name = "KPI Parameter"
        verbose_name_plural = "KPI Parameters"

    def __str__(self):
        return f"{self.kpi.code} :: {self.name} -> {self.source_column} ({self.aggregation})"


class KPIFilter(models.Model):
    """
    Row-level filtering condition applied before aggregation.
    """
    class Operator(models.TextChoices):
        EQUALS = "EQUALS", "Equals"
        NOT_EQUALS = "NOT_EQUALS", "Not Equals"
        GREATER_THAN = "GREATER_THAN", "Greater Than"
        LESS_THAN = "LESS_THAN", "Less Than"
        GREATER_EQUAL = "GREATER_EQUAL", "Greater Than or Equal"
        LESS_EQUAL = "LESS_EQUAL", "Less Than or Equal"
        CONTAINS = "CONTAINS", "Contains"
        STARTS_WITH = "STARTS_WITH", "Starts With"
        ENDS_WITH = "ENDS_WITH", "Ends With"
        IN = "IN", "In (Comma-separated)"
        IS_EMPTY = "IS_EMPTY", "Is Empty"
        IS_NOT_EMPTY = "IS_NOT_EMPTY", "Is Not Empty"

    kpi = models.ForeignKey(KPIDefinition, on_delete=models.CASCADE, related_name="filters")
    field_name = models.CharField(max_length=100)
    operator = models.CharField(max_length=30, choices=Operator.choices, default=Operator.EQUALS)
    value = models.CharField(max_length=255, blank=True, default="")
    conjunction = models.CharField(max_length=10, choices=[("AND", "AND"), ("OR", "OR")], default="AND")

    class Meta:
        db_table = "kpi_kpifilter"
        verbose_name = "KPI Filter"
        verbose_name_plural = "KPI Filters"

    def __str__(self):
        return f"{self.kpi.code} :: {self.field_name} {self.operator} {self.value}"


class KPIDependency(models.Model):
    """
    Tracks DAG dependencies between derived KPIs and their parent/input KPIs.
    """
    kpi = models.ForeignKey(KPIDefinition, on_delete=models.CASCADE, related_name="dependencies")
    depends_on = models.ForeignKey(KPIDefinition, on_delete=models.CASCADE, related_name="dependent_kpis")
    parameter_name = models.CharField(max_length=50, help_text="Symbol used in child formula representing parent value")

    class Meta:
        db_table = "kpi_kpidependency"
        unique_together = ("kpi", "depends_on", "parameter_name")
        verbose_name = "KPI Dependency"
        verbose_name_plural = "KPI Dependencies"

    def __str__(self):
        return f"{self.kpi.code} depends on {self.depends_on.code} as '{self.parameter_name}'"
