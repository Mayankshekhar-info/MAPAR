export type CalculationType =
  | "SIMPLE_AGGREGATE"
  | "FORMULA"
  | "RATIO"
  | "PERCENTAGE"
  | "ACHIEVEMENT_PCT"
  | "VARIANCE"
  | "DERIVED"
  | "CONDITIONAL";

export type AggregationMethod =
  | "SUM"
  | "AVG"
  | "COUNT"
  | "COUNT_DISTINCT"
  | "MIN"
  | "MAX"
  | "LATEST";

export type DirectionType = "HIGHER_BETTER" | "LOWER_BETTER" | "NEUTRAL";

export type HierarchyLevelType =
  | "MAIN_COMPANY"
  | "SUB_COMPANY"
  | "PROJECT"
  | "CIRCLE"
  | "DOMAIN"
  | "DEPARTMENT"
  | "SUB_DEPARTMENT";

export type ComparisonMethodType =
  | "NONE"
  | "TARGET"
  | "PREVIOUS_PERIOD"
  | "YEAR_OVER_YEAR";

export type RAGStatusType = "GREEN" | "AMBER" | "RED" | "NEUTRAL" | "UNKNOWN";

export interface KPIParameter {
  id?: number;
  name: string;
  label: string;
  source_column: string;
  aggregation: AggregationMethod;
  default_value?: number | null;
}

export interface KPIFilter {
  id?: number;
  field_name: string;
  operator:
    | "EQUALS"
    | "NOT_EQUALS"
    | "GREATER_THAN"
    | "LESS_THAN"
    | "GREATER_EQUAL"
    | "LESS_EQUAL"
    | "CONTAINS"
    | "STARTS_WITH"
    | "ENDS_WITH"
    | "IN"
    | "IS_EMPTY"
    | "IS_NOT_EMPTY";
  value: string;
  conjunction?: "AND" | "OR";
}

export interface KPIDependency {
  id?: number;
  depends_on: number;
  depends_on_code?: string;
  depends_on_name?: string;
  parameter_name: string;
}

export type VisualizationType = "CARD" | "PROGRESS" | "GAUGE" | "FUNNEL" | "METRIC_STAT";

export interface KPIFunnelBreakdown {
  total_uploaded_records: number;
  organization_scope_records: number;
  reporting_period_records: number;
  kpi_filtered_records: number;
  parameter_values?: Record<string, number>;
  calculated_value?: number | null;
  target_value?: number | null;
  achievement_percentage?: number | null;
  rag_status?: RAGStatusType;
  status?: string;
  unit?: string;
  visualization_type?: VisualizationType;
  organization_scope?: string;
  reporting_period?: string;
  source_dataset_name?: string;
  comparisons?: any[];
  [key: string]: any;
}

export type PerformanceDirection = "HIGHER_BETTER" | "LOWER_BETTER" | "EXACT_TARGET";

export type ActualDataSourceType = "UPLOAD" | "MANUAL";

export interface KPIActualDataSourceConfig {
  source_type: ActualDataSourceType;
  dataset_id?: number | null;
  dataset_name?: string;
  metric_field?: string;
  aggregation: "SUM" | "AVG" | "COUNT" | "COUNT_DISTINCT" | "MIN" | "MAX";
  org_field?: string;
  date_field?: string | null;
  period_behavior?: "MATCH_PERIOD" | "ALL_RECORDS";
}

export interface KPIComparisonRule {
  id: string;
  achieved_data_column: string;
  standard_value: number | string | null;
  target_value?: number | string | null;
  performance_direction: PerformanceDirection;
  unit?: string;
  aggregation?: "SUM" | "AVG" | "COUNT" | "COUNT_DISTINCT" | "MIN" | "MAX" | "LATEST";
  calculated_actual?: number | string | null;
  calculated_variance?: number | null;
  achievement_percentage?: number | null;
  performance_status?: string;
  calculation_status?: string;
  error_message?: string;
  status_label?: string;
}

export interface KPIComparisonItem {
  id: string;
  name: string;
  rules?: KPIComparisonRule[];
  overall_status?: "MET" | "NOT_MET" | "PENDING_DATA" | "CONFIG_INVALID" | string;
  overall_status_label?: string;
  standard_value?: number | string | null;
  target_value: number | string | null;
  performance_direction: PerformanceDirection;
  achieved_data_column?: string;
  metric_label: string;
  unit: string;
  actual_value?: number | string | null;
  warning_threshold?: number | string | null;
  critical_threshold?: number | string | null;
  display_color?: string;
  is_enabled: boolean;
  is_manual?: boolean;
  data_source?: KPIActualDataSourceConfig;
  calculated_actual?: number | null;
  calculated_variance?: number | null;
  achievement_percentage?: number | null;
  performance_status?: string;
  dataset_name?: string;
  reporting_period_name?: string;
  records_considered?: number;
  calculation_status?: string;
  error_message?: string;
  last_calculated_at?: string;
}

export interface KPIPerformanceColors {
  meets_target: string;
  below_target: string;
  exceeded_limit: string;
  warning: string;
  critical: string;
}

export type KPIVisualizationStyle =
  | "CARD"
  | "COMPARISON"
  | "PROGRESS"
  | "VARIANCE"
  | "STATUS"
  | "TABLE";

export interface KPIPresentationConfig {
  column_colors?: Record<string, string>;
  group_by?: string[];
  selected_columns?: string[];
  custom_labels?: Record<string, string>;
  comparisons?: KPIComparisonItem[];
  performance_colors?: KPIPerformanceColors;
  visualization_style?: KPIVisualizationStyle;
  [key: string]: any;
}

export interface KPIDefinition {
  id: number;
  code: string;
  name: string;
  description: string;
  domain?: number | null;
  domain_name?: string;
  hierarchy_level: HierarchyLevelType;
  hierarchy_id?: number | null;
  hierarchy_node_name?: string;
  visualization_type?: VisualizationType;
  calculation_type: CalculationType;
  source_dataset?: number | null;
  source_dataset_name?: string;
  natural_language_rule?: string;
  logic_expression?: string;
  formula_expression: string;
  presentation_config?: KPIPresentationConfig;
  comparisons?: KPIComparisonItem[];
  performance_colors?: KPIPerformanceColors;
  visualization_style?: KPIVisualizationStyle;
  aggregation_method: AggregationMethod;
  unit: string;
  decimal_precision: number;
  direction: DirectionType;
  target_value?: number | null;
  target_field?: string;
  comparison_method: ComparisonMethodType;
  threshold_green?: number | null;
  threshold_amber?: number | null;
  is_active: boolean;
  is_executive: boolean;
  display_order: number;
  parameters: KPIParameter[];
  filters: KPIFilter[];
  dependencies: KPIDependency[];
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface KPITestLogicPayload {
  dataset_id?: number | null;
  natural_language_rule?: string;
  logic_expression?: string;
  formula_expression?: string;
  calculation_type?: string;
  filters?: Array<{
    field_name: string;
    operator: string;
    value: string;
    conjunction?: "AND" | "OR";
  }>;
  parameters?: Array<{
    name: string;
    label?: string;
    source_column: string;
    aggregation: string;
    default_value?: number | null;
  }>;
  group_by?: string[];
  presentation_config?: Record<string, any>;
  hierarchy_level?: string;
  hierarchy_id?: number | null;
  period_id?: number | null;
  unit?: string;
}

export interface KPITestLogicResult {
  success: boolean;
  is_valid: boolean;
  status: "SUCCESS" | "NO_DATA" | "DIV_ZERO" | "ERROR";
  error?: string | null;
  message?: string | null;
  records_considered: number;
  calculated_value: number | null;
  unit: string;
  columns: string[];
  refined_records_preview: Array<Record<string, any>>;
  parsed_filters: Array<{ field_name: string; operator: string; value: string; conjunction?: string }>;
  parsed_parameters: Array<{ name: string; source_column: string; aggregation: string }>;
  group_by?: string[];
  grouped_results?: Array<{
    group_key: string;
    group_field: string;
    records_count: number;
    calculated_value: number | null;
    metrics: Record<string, number>;
  }>;
  rewritten_formula: string;
  natural_language_summary?: string;
  interpreted_expression?: string;
  presentation_config?: Record<string, any>;
  node_name: string;
  period_name: string;
  dataset_name: string;
}

export type CreateKPIDefinitionPayload = Omit<
  KPIDefinition,
  | "id"
  | "domain_name"
  | "source_dataset_name"
  | "created_by_name"
  | "created_at"
  | "updated_at"
  | "hierarchy_node_name"
>;

export interface DatasetInfo {
  id: number;
  name: string;
  code: string;
  description: string;
  data_level: string;
  target_entity: string;
  active_version_number: number;
  column_count: number;
}

export interface DatasetField {
  id: number;
  name: string;
  display_label: string;
  data_type: "TEXT" | "INTEGER" | "DECIMAL" | "DATE" | "BOOLEAN" | "PERCENTAGE" | "REFERENCE";
  is_required: boolean;
  column_order: number;
  validation_rules?: Record<string, any>;
}

export interface KPIDashboardCardData {
  id: number;
  kpi_id: number;
  kpi_code: string;
  kpi_name: string;
  unit: string;
  visualization_type?: VisualizationType;
  calculated_value: number | null;
  target_value: number | null;
  variance_to_target: number | null;
  variance_percentage: number | null;
  achievement_percentage: number | null;
  rag_status: RAGStatusType;
  hierarchy_level: string;
  hierarchy_id: number;
  hierarchy_name: string;
  calculation_status: "SUCCESS" | "NO_DATA" | "DIV_ZERO" | "ERROR";
  error_message: string;
  records_considered: number;
  calculated_at: string;
  formula: string;
  funnel_breakdown?: KPIFunnelBreakdown | null;
  source_dataset_id?: number | null;
  source_dataset_name?: string | null;
  assigned_hierarchy_level?: string | null;
  assigned_hierarchy_id?: number | null;
  parameters?: Array<{ name: string; source_column: string; aggregation: string }>;
  filters?: Array<{ field_name: string; operator: string; value: string }>;
  presentation_config?: KPIPresentationConfig | null;
  comparisons?: KPIComparisonItem[];
}

export type KPIDashboardCard = KPIDashboardCardData;

export interface KPIDiagnosticsData {
  result_id: number;
  kpi_code: string;
  kpi_name: string;
  hierarchy_level: string;
  hierarchy_id: number;
  hierarchy_name: string;
  calculated_value: number | null;
  target_value: number | null;
  rag_status: RAGStatusType;
  calculation_status: string;
  error_message: string;
  records_considered: number;
  records_excluded: number;
  calculated_at: string;
  lineage_info: Record<string, any>;
  audit_history: Array<{
    id: number;
    trigger_type: string;
    status: string;
    calculated_value: number | null;
    execution_time_ms: number;
    records_considered: number;
    records_excluded: number;
    diagnostics: Record<string, any>;
    executed_by: string;
    created_at: string;
  }>;
  refined_records?: Array<Record<string, any>>;
  refined_columns?: string[];
  total_refined_records?: number;
  applied_filters?: Array<{ field_name: string; operator: string; value: string }>;
}

export interface KPIRefinedRecordsResponse {
  result_id: number;
  kpi_code: string;
  kpi_name: string;
  hierarchy_level: string;
  hierarchy_name: string;
  period_name: string;
  calculated_value: number | null;
  rag_status: RAGStatusType;
  total_records: number;
  page: number;
  page_size: number;
  columns: string[];
  records: Array<Record<string, any>>;
  applied_filters: Array<{ field: string; operator: string; value: string }>;
}
