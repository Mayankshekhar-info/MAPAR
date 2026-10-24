export interface FilterOption {
  id: number;
  name: string;
  code?: string;
  region?: string;
  project_id?: number;
  sub_company_id?: number;
  main_company_id?: number;
  circle_id?: number;
  domain_id?: number;
  display_order?: number;
}

export interface ReportingPeriodOption {
  id: number;
  name: string;
  period_type: string;
  is_current: boolean;
  start_date: string;
}

export interface CockpitFiltersData {
  companies: FilterOption[];
  sub_companies: FilterOption[];
  projects: FilterOption[];
  circles: FilterOption[];
  domains: FilterOption[];
  departments: FilterOption[];
  periods: ReportingPeriodOption[];
  statuses: { value: string; label: string }[];
}

export interface CockpitFilterState {
  companyId?: number;
  subCompanyId?: number;
  projectId?: number;
  circleId?: number;
  domainId?: number;
  departmentId?: number;
  periodId?: number;
  status: string;
  search: string;
}

export interface MasterSummaryRow {
  id: string;
  circle_id: number | null;
  circle_name: string;
  circle_code: string;
  circle_region: string;
  domain_id: number | null;
  domain_name: string;
  domain_code: string;
  kpi_count: number;
  target: number;
  actual: number;
  achievement_pct: number;
  green_count: number;
  amber_count: number;
  red_count: number;
  status: "GREEN" | "AMBER" | "RED" | string;
  is_subtotal: boolean;
  is_grand_total: boolean;
}

export interface KPIColumnRuleDetail {
  rule_id: string;
  column_name: string;
  standard_value: number | null;
  calculated_actual: number | null;
  performance_direction: "HIGHER_BETTER" | "LOWER_BETTER" | "EXACT_TARGET" | string;
  variance: number | null;
  variance_percentage: number | null;
  status: "MET" | "NOT_MET" | "PENDING_DATA" | "COLUMN_MISSING" | "ERROR" | "GREEN" | "AMBER" | "RED" | string;
  status_label: string;
}

export interface KPIComparisonDetail {
  comparison_name: string;
  overall_status: string;
  status_label: string;
  rules: KPIColumnRuleDetail[];
}

export interface MasterSummaryResponse {
  period: {
    id: number | null;
    name: string;
    is_current: boolean;
  };
  total_records: number;
  rows: MasterSummaryRow[];
  metrics_summary: {
    total_kpis: number;
    green_kpis: number;
    amber_kpis: number;
    red_kpis: number;
    overall_achievement: number;
    total_comparisons?: number;
    rules_met?: number;
    rules_not_met?: number;
    rules_pending_data?: number;
    rules_config_issue?: number;
    last_calculated_at?: string | null;
    has_data?: boolean;
  };
}

export interface DetailRecord {
  id: number;
  result_id?: number | null;
  kpi_id: number;
  kpi_code: string;
  kpi_name: string;
  kpi_unit: string;
  frequency: string;
  direction: string;
  target: number | null;
  actual: number | null;
  variance_pct: number | null;
  achievement_pct: number | null;
  rag_status: "GREEN" | "AMBER" | "RED" | string;
  trend: "UP" | "DOWN" | "FLAT" | string;
  notes: string;
  domain_name: string;
  circle_name: string;
  comparisons?: KPIComparisonDetail[];
  rules?: KPIColumnRuleDetail[];
  records_considered?: number | null;
  calculated_at?: string | null;
  calculation_status?: string;
  error_message?: string;
  source_dataset_name?: string | null;
  source_dataset_id?: number | null;
}

export interface ContextObservation {
  id: number;
  code: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  rag_status: string;
  root_cause: string;
  corrective_action: string;
  owner: string;
  target_date: string;
  is_repeat: boolean;
}

export interface ContextAction {
  id: number;
  code: string;
  owner: string;
  priority: string;
  status: string;
  progress_pct: number;
  target_date: string;
  latest_update: string;
  rag: string;
  ageing_days: number;
  overdue_days: number;
}

export interface DetailBreakdownResponse {
  context: {
    circle_id: number | null;
    circle_name: string;
    circle_code: string;
    domain_id: number | null;
    domain_name: string;
    domain_code: string;
    period_id: number | null;
    period_name: string;
  };
  total_records: number;
  records: DetailRecord[];
  observations: ContextObservation[];
  actions: ContextAction[];
}

export interface DeepRecordDetail {
  id: number;
  kpi: {
    id: number;
    code: string;
    name: string;
    definition: string;
    calculation_formula: string;
    unit: string;
    direction: string;
    frequency: string;
    risk_category: string;
    priority: string;
    default_owner: string;
    is_executive: boolean;
    domain: {
      id: number;
      name: string;
      code: string;
    };
  };
  hierarchy: {
    circle_id: number;
    circle_name: string;
    circle_code: string;
    circle_region: string;
  };
  period: {
    id: number;
    name: string;
    period_type: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
    is_frozen: boolean;
  };
  performance: {
    target: number | null;
    actual: number | null;
    previous: number | null;
    numerator: number | null;
    denominator: number | null;
    variance_to_target: number | null;
    variance_pct: number | null;
    achievement_pct: number | null;
    rag_status: string;
    trend: string;
    notes: string;
  };
  audit: {
    entered_by: string;
    created_at: string | null;
    updated_at: string | null;
  };
  linked_issues: {
    id: number;
    issue_code: string;
    title: string;
    severity: string;
    status: string;
    rag_status: string;
    root_cause: string;
    corrective_action: string;
    owner_name: string;
    target_date: string;
  }[];
  linked_actions: {
    id: number;
    action_code: string;
    accountable_owner: string;
    priority: string;
    status: string;
    progress_percentage: number;
    target_date: string;
    latest_update: string;
    governance_rag: string;
  }[];
  result_id?: number | null;
  comparisons?: KPIComparisonDetail[];
  staged_records?: Record<string, any>[];
  staged_columns?: string[];
  total_staged_records?: number;
}
