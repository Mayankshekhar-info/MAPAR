export interface SlideHierarchyContext {
  main_company: string | null;
  main_company_code: string | null;
  sub_company: string | null;
  sub_company_code?: string | null;
  project: string | null;
  project_code: string | null;
  circle: string;
  circle_code: string;
  region: string;
  circle_head: string;
  circle_head_email?: string;
  domain: string;
  domain_code: string;
  department?: string | null;
  department_code?: string | null;
  team?: string | null;
  team_code?: string | null;
}

export interface SlideKPICard {
  id: number;
  kpi_id: number;
  code: string;
  name: string;
  definition: string;
  unit: string;
  direction: string;
  target_value: number;
  actual_value: number;
  variance: number;
  variance_percentage: number | null;
  achievement_percentage: number;
  rag_status: "GREEN" | "AMBER" | "RED";
  trend: "UP" | "DOWN" | "FLAT";
  notes: string;
  is_executive: boolean;
  default_owner: string;
}

export interface SlideGovernanceIssue {
  id: number;
  issue_code: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  rag_status: string;
  root_cause: string;
  corrective_action: string;
  owner_name: string;
  target_date: string | null;
}

export interface SlideGovernanceAction {
  id: number;
  action_code: string;
  management_direction: string;
  rca_issue: string;
  expected_outcome: string;
  accountable_owner: string;
  target_date: string | null;
  status: string;
  progress_percentage: number;
  latest_update: string;
  governance_rag: string;
}

export interface SlideSummary {
  total_kpis: number;
  green_count: number;
  amber_count: number;
  red_count: number;
  total_target: number;
  total_actual: number;
  achievement_percentage: number;
  overall_rag: "GREEN" | "AMBER" | "RED";
  open_issues_count: number;
  open_actions_count: number;
}

export interface SlideItem {
  slide_id: string;
  slide_number: number;
  title: string;
  subtitle: string;
  hierarchy: SlideHierarchyContext;
  summary: SlideSummary;
  kpis: SlideKPICard[];
  issues: SlideGovernanceIssue[];
  actions: SlideGovernanceAction[];
}

export interface SlideDeckSummary {
  total_slides: number;
  total_kpis: number;
  green_count: number;
  amber_count: number;
  red_count: number;
  overall_rag: "GREEN" | "AMBER" | "RED";
}

export interface SlidePeriodInfo {
  id: number | null;
  name: string;
  is_frozen: boolean;
  is_current?: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface SlideDeckResponse {
  period: SlidePeriodInfo;
  deck_summary: SlideDeckSummary;
  slides: SlideItem[];
}

export interface SlideFilterState {
  companyId?: number;
  projectId?: number;
  circleId?: number;
  domainId?: number;
  periodId?: number;
  status: string;
  search: string;
}

// ==========================================
// Master Table Matrix Contracts
// ==========================================

export interface SlideMasterRowData {
  id: number | string;
  row_type: "data" | "subtotal" | "grand_total";
  circle_id?: number;
  circle_name: string;
  circle_code?: string;
  region?: string;
  domain_id?: number;
  domain_name?: string;
  domain_code?: string;
  resource_code?: string;
  resource_name: string;
  required: number;
  available: number;
  gap: number;
  achievement_percentage: number;
  rag_status: "GREEN" | "AMBER" | "RED";
  trend?: "UP" | "DOWN" | "FLAT";
  unit?: string;
  default_owner?: string;
  is_executive?: boolean;
  green_count?: number;
  amber_count?: number;
  red_count?: number;
  record_count?: number;
  is_clickable: boolean;
}


export interface SlideMasterSummary {
  total_circles: number;
  total_records: number;
  total_required: number;
  total_available: number;
  total_gap: number;
  achievement_percentage: number;
  overall_rag: "GREEN" | "AMBER" | "RED";
  green_count: number;
  amber_count: number;
  red_count: number;
}

export interface SlideMasterTableResponse {
  period: SlidePeriodInfo;
  summary: SlideMasterSummary;
  rows: SlideMasterRowData[];
  grand_total: SlideMasterRowData;
}

// ==========================================
// Deep Detail Page Contracts
// ==========================================

export interface SlideDetailAuditEntry {
  id: number;
  action: string;
  level: string;
  object_repr: string;
  details: Record<string, unknown>;
  timestamp: string | null;
  user: string;
}

export interface SlideDetailRelatedRecord {
  id: number;
  code: string;
  name: string;
  target: number;
  actual: number;
  rag_status: "GREEN" | "AMBER" | "RED";
}

export interface SlideDetailResource {
  id: number;
  code: string;
  name: string;
  definition: string;
  calculation_formula: string;
  unit: string;
  direction: string;
  frequency: string;
  priority: string;
  default_owner: string;
  is_executive: boolean;
}

export interface SlideDetailMetrics {
  required: number;
  available: number;
  gap: number;
  achievement_percentage: number;
  rag_status: "GREEN" | "AMBER" | "RED";
  trend: "UP" | "DOWN" | "FLAT";
  variance: number;
  variance_percentage: number | null;
  unit: string;
  direction: string;
  notes: string;
}

export interface SlideDetailSource {
  period_id: number | null;
  period_name: string;
  is_frozen: boolean;
  is_current: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  entered_by: {
    id: number | null;
    name: string;
    email: string;
  };
}

export interface SlideUploadProvenance {
  batch_id: string;
  template_name: string;
  template_code: string;
  version: number;
  original_filename: string;
  uploaded_by: string;
  uploaded_at: string | null;
  status: string;
  total_rows: number;
  imported_rows: number;
}

export interface SlideDetailData {
  record_id: number;
  resource: SlideDetailResource;
  hierarchy: SlideHierarchyContext;
  metrics: SlideDetailMetrics;
  source: SlideDetailSource;
  audit_history: SlideDetailAuditEntry[];
  issues: SlideGovernanceIssue[];
  actions: SlideGovernanceAction[];
  related_records: SlideDetailRelatedRecord[];
  upload_provenance?: SlideUploadProvenance | null;
  comparisons?: {
    comparison_name: string;
    overall_status: string;
    status_label: string;
    rules: {
      rule_id: string;
      column_name: string;
      standard_value: number | null;
      calculated_actual: number | null;
      performance_direction: string;
      variance: number | null;
      variance_percentage: number | null;
      status: string;
      status_label: string;
    }[];
  }[];
  staged_records?: Record<string, any>[];
  staged_columns?: string[];
  total_staged_records?: number;
}

// -------------------------------------------------------------
// Drill-Down Slide View Types (8-Tier Organization Hierarchy)
// -------------------------------------------------------------

export interface SlideBreadcrumbItem {
  level: string;
  id: number;
  name: string;
  code: string;
}

export interface SlideKPISummary {
  total: number;
  green: number;
  amber: number;
  red: number;
}

export interface SlideChildNode {
  id: number;
  name: string;
  code: string;
  status: string;
  level: string;
  child_level?: string;
  description?: string;
  child_count: number;
  record_count: number;
  kpi_summary: SlideKPISummary;
}

export interface SlideOperationalRecord {
  id: number;
  kpi_id: number;
  kpi_name: string;
  kpi_code: string;
  circle_id: number;
  circle_name: string;
  domain_name: string;
  actual_value: number;
  target_value: number | null;
  variance: number | null;
  variance_percentage: number | null;
  rag_status: "GREEN" | "AMBER" | "RED";
  trend: string;
  unit: string;
  notes: string;
  entered_by: string;
}

export interface SlideUploadedBatch {
  id: number;
  batch_id: string;
  template_name: string;
  original_filename: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  uploaded_by: string;
  created_at: string;
}

export interface SlideHierarchyNodeMetadata {
  id: number;
  name: string;
  code: string;
  description?: string;
  status: string;
  level: string;
  badge: string;
  badge_color: string;
}

export interface SlidePeriodInfo {
  id: number | null;
  name: string;
  is_frozen: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface SlidePeriodOption {
  id: number;
  name: string;
  is_current: boolean;
  is_frozen?: boolean;
  period_type: string;
}

export interface SlideHierarchyRootResponse {
  level: string;
  level_name: string;
  nodes: SlideChildNode[];
  summary: {
    total_companies: number;
    total_records: number;
    green_count: number;
    amber_count: number;
    red_count: number;
  };
  period: SlidePeriodInfo;
  periods: SlidePeriodOption[];
}

export interface SlideHierarchyNodeResponse {
  node: SlideHierarchyNodeMetadata;
  breadcrumbs: SlideBreadcrumbItem[];
  parent: SlideBreadcrumbItem | null;
  children: SlideChildNode[];
  child_level: string;
  operational_data: SlideOperationalRecord[];
  uploaded_batches: SlideUploadedBatch[];
  summary: {
    total_records: number;
    green_count: number;
    amber_count: number;
    red_count: number;
    child_count: number;
  };
  period: SlidePeriodInfo;
  periods: SlidePeriodOption[];
}
