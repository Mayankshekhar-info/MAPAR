export interface SimpleCircle {
  id: number;
  name: string;
  code: string;
  region: string;
}

export interface SimpleUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  circle_id?: number | null;
}

export interface GovernanceTargetRevision {
  id: number;
  revision_number: number;
  previous_target: string;
  revised_target: string;
  revision_date: string;
  revised_by?: SimpleUser | null;
  reason: string;
  approved_by: string;
  created_at: string;
}

export interface GovernanceEvidenceItem {
  id: number;
  action_point: number;
  action_id: string;
  action_point_title: string;
  circle_code?: string;
  version: number;
  reporting_week?: string;
  title: string;
  description: string;
  file_name: string;
  file_size: number;
  file_type: string;
  submitted_by?: SimpleUser | null;
  submitted_at: string;
  status: "Pending Review" | "Accepted" | "Rework Required";
  reviewed_by?: SimpleUser | null;
  reviewed_at?: string | null;
  review_comment: string;
}

export interface GovernanceWeeklyUpdate {
  id: number;
  action_point: number;
  action_id: string;
  action_point_title: string;
  reporting_week: string;
  week_start_date?: string | null;
  week_end_date?: string | null;
  work_completed: string;
  progress_percent: number;
  achievements?: string;
  blockers?: string;
  next_week_plan?: string;
  status: "Open" | "WIP" | "Closed";
  actual_closure_date?: string | null;
  remarks?: string;
  submitted_by?: SimpleUser | null;
  submitted_at: string;
  updated_at: string;
  revision_number: number;
}

export interface GovernanceActionPoint {
  id: number;
  action_id: string;
  circle: SimpleCircle;
  hierarchy_level?: string;
  hierarchy_node_id?: number | null;
  hierarchy_path?: string;
  domain?: any;
  department?: any;
  sub_department?: any;
  function_area: string;
  action_point: string;
  key_deliverable: string;
  owner?: SimpleUser | null;
  owner_name_override?: string;
  assigned_by?: SimpleUser | null;
  raised_date: string;
  target_closure_date: string;
  current_target_date: string;
  revision_count: number;
  status: "Open" | "WIP" | "Closed";
  actual_closure_date?: string | null;
  current_progress_percent?: number;
  ageing_days: number;
  ageing_bucket: "0-7 Days" | "8-15 Days" | "16-30 Days" | "30+ Days";
  weeks_in_review: number;
  reporting_week?: string;
  priority: "High" | "Medium" | "Low";
  is_escalated: boolean;
  is_overdue: boolean;
  evidence_status: "Not Submitted" | "Pending Review" | "Accepted" | "Rework Required";
  evidence_required: boolean;
  last_update: string;
  revisions?: GovernanceTargetRevision[];
  evidence_items?: GovernanceEvidenceItem[];
  created_by?: SimpleUser | null;
  created_at: string;
  updated_at: string;
}

export interface TaskProgressPoint {
  reporting_week: string;
  progress_percent: number;
  status: string;
  submitted_at?: string | null;
}

export interface TaskFullDetailResponse {
  success: boolean;
  action: GovernanceActionPoint;
  resolved_hierarchy_path: string;
  weekly_updates: GovernanceWeeklyUpdate[];
  progress_trend: TaskProgressPoint[];
  revisions: GovernanceTargetRevision[];
  evidence_items: GovernanceEvidenceItem[];
  revision_requests?: GovernanceTargetRevisionRequest[];
  can_review_revision?: boolean;
  can_request_revision?: boolean;
  can_review_evidence?: boolean;
  has_pending_revision?: boolean;
}

export interface CircleDistribution {
  circle__id: number;
  circle__name: string;
  circle__code: string;
  circle__region?: string;
  total: number;
  open: number;
  wip: number;
  closed: number;
  overdue?: number;
  escalated: number;
  completion_rate?: number;
}

export interface OwnerDistribution {
  owner_id: number | null;
  owner_name: string;
  username: string;
  initials?: string;
  total: number;
  open: number;
  wip: number;
  closed: number;
  overdue: number;
  open_on_track?: number;
  overdue_under_7d?: number;
  overdue_over_7d?: number;
  max_days_late?: number;
  is_on_track?: boolean;
  escalated: number;
  evidence_pending: number;
  completion_rate: number;
  avg_progress: number;
}

export interface MyProgressMetrics {
  total: number;
  open: number;
  wip: number;
  closed: number;
  overdue: number;
  upcoming: number;
  missing_weekly: number;
  completion_rate: number;
  evidence_pending: number;
  evidence_accepted: number;
  evidence_rework: number;
  evidence_not_submitted: number;
}

export interface ClosurePerformance {
  on_time_closed: number;
  delayed_closed: number;
  on_time_rate: number;
}

export interface TimelinePointAction {
  id: number;
  action_id: string;
  title: string;
  owner: string;
  circle: string;
  priority: string;
}

export interface TimelinePoint {
  date: string;
  label: string;
  is_overdue: boolean;
  is_today: boolean;
  count: number;
  actions: TimelinePointAction[];
}

export interface UrgentRiskItem {
  id: number;
  action_id: string;
  action_point: string;
  owner_name: string;
  circle_name: string;
  circle_code?: string;
  status: string;
  priority: string;
  current_target_date: string;
  is_overdue: boolean;
  days_overdue: number;
  progress_percent: number;
  evidence_status: string;
}

export interface GovernanceMetrics {
  total_actions: number;
  open_count: number;
  wip_count: number;
  closed_count: number;
  overdue_count: number;
  high_priority_count: number;
  escalated_count: number;
  upcoming_count: number;
  due_in_3_days_count?: number;
  no_update_7d_count?: number;
  on_track_score?: number;
  avg_days_late?: number;
  max_days_late?: number;
  reporting_week?: string;
  available_weeks?: string[];
  as_of_date?: string;
  executive_insight?: string;
  overdue_ageing_chart?: {
    not_yet_due: number;
    "1-3d": number;
    "4-7d": number;
    "8-15d": number;
    "15+d": number;
  };
  target_timeline?: TimelinePoint[];
  urgent_items?: UrgentRiskItem[];
  completion_rate?: number;
  created_by_me_count?: number;
  my_assigned_count?: number;
  missing_weekly_count?: number;
  pending_evidence_count: number;
  accepted_evidence_count: number;
  rework_evidence_count: number;
  not_submitted_evidence_count: number;
  bucket_counts: {
    "0-7 Days": number;
    "8-15 Days": number;
    "16-30 Days": number;
    "30+ Days": number;
  };
  status_counts: {
    Open: number;
    WIP: number;
    Closed: number;
  };
  evidence_counts: {
    "Not Submitted": number;
    "Pending Review": number;
    "Accepted": number;
    "Rework Required": number;
  };
  priority_counts: {
    High: number;
    Medium: number;
    Low: number;
  };
  circle_distribution: CircleDistribution[];
  owner_distribution?: OwnerDistribution[];
  my_progress_metrics?: MyProgressMetrics;
  closure_performance?: ClosurePerformance;
}

export interface HierarchyLevelOption {
  code: string;
  label: string;
}

export interface GovernanceMetadata {
  circles: SimpleCircle[];
  users: SimpleUser[];
  function_areas: string[];
  statuses: string[];
  priorities: string[];
  evidence_statuses: string[];
  hierarchy_levels?: HierarchyLevelOption[];
  available_weeks?: string[];
}

export interface GovernanceFilterParams {
  search?: string;
  circle_id?: number | null;
  owner_id?: number | null;
  status?: string;
  evidence_status?: string;
  view_mode?: "all" | "my_tasks" | "created_by" | "created_by_me" | "missing_weekly" | "evidence_review" | "revision_requests";
  hierarchy_level?: string;
  hierarchy_node_id?: number | null;
  priority?: string;
  function_area?: string;
  is_escalated?: boolean;
  is_overdue?: boolean;
  is_due_soon?: boolean;
  reporting_week?: string;
  start_date?: string;
  end_date?: string;
  ageing_bucket?: string;
  page?: number;
  page_size?: number;
  ordering?: string;
}

export interface GovernanceListResponse {
  success: boolean;
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  results: GovernanceActionPoint[];
}

export interface CreateActionPayload {
  circle_id: number;
  hierarchy_level?: string;
  hierarchy_node_id?: number | null;
  hierarchy_path?: string;
  domain_id?: number | null;
  department_id?: number | null;
  sub_department_id?: number | null;
  function_area: string;
  action_point: string;
  key_deliverable?: string;
  owner_id?: number | null;
  raised_date?: string;
  target_closure_date: string;
  status?: "Open" | "WIP" | "Closed";
  priority?: "High" | "Medium" | "Low";
  actual_closure_date?: string | null;
  evidence_required?: boolean;
  last_update?: string;
}

export interface UpdateActionPayload {
  circle_id?: number;
  hierarchy_level?: string;
  hierarchy_node_id?: number | null;
  hierarchy_path?: string;
  function_area?: string;
  action_point?: string;
  key_deliverable?: string;
  owner_id?: number | null;
  raised_date?: string;
  status?: "Open" | "WIP" | "Closed";
  priority?: "High" | "Medium" | "Low";
  actual_closure_date?: string | null;
  evidence_required?: boolean;
  last_update?: string;
}

export interface ReviseTargetPayload {
  new_target_date: string;
  reason: string;
  approved_by?: string;
}

export interface ReviewEvidencePayload {
  decision: "Accepted" | "Rework Required";
  review_comment?: string;
}

export interface SubmitWeeklyUpdatePayload {
  reporting_week: string;
  work_completed: string;
  progress_percent: number;
  achievements?: string;
  blockers?: string;
  next_week_plan?: string;
  status?: "Open" | "WIP" | "Closed";
  actual_closure_date?: string | null;
  remarks?: string;
  allow_revision?: boolean;
}

export interface BulkUpdateActionsPayload {
  task_ids: number[];
  owner_id?: number | null;
  status?: "Open" | "WIP" | "Closed";
  priority?: "High" | "Medium" | "Low";
  target_closure_date?: string;
}

export interface BulkWeeklySubmitPayload {
  task_ids: number[];
  reporting_week: string;
  work_completed: string;
  progress_percent: number;
  achievements?: string;
  blockers?: string;
  next_week_plan?: string;
  status?: "Open" | "WIP" | "Closed";
  allow_revision?: boolean;
}

export interface BulkEvidenceReviewPayload {
  evidence_ids: number[];
  decision: "Accepted" | "Rework Required";
  review_comment?: string;
}

export interface BulkOperationResult {
  total: number;
  successful_count: number;
  failed_count: number;
  results: {
    task_id?: number;
    evidence_id?: number;
    action_id?: string;
    success: boolean;
    error?: any;
    decision?: string;
  }[];
}

export interface ExcelValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ExcelUploadResponse {
  success: boolean;
  total_rows: number;
  created_count: number;
  updated_count: number;
  errors: ExcelValidationError[];
}

export interface MyEvidenceListResponse {
  success: boolean;
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  results: GovernanceEvidenceItem[];
}

export interface WeeklyExcelPreviewRow {
  row_num: number;
  task_id: string;
  task_title: string;
  reporting_week: string;
  week_start_date: string;
  week_end_date: string;
  work_completed: string;
  progress_percent: number;
  status: string;
  blockers: string;
  next_week_plan: string;
  actual_closure_date?: string | null;
  remarks: string;
  already_exists: boolean;
  is_valid: boolean;
  errors: string[];
}

export interface WeeklyExcelPreviewData {
  total_rows: number;
  valid_rows_count: number;
  invalid_rows_count: number;
  rows: WeeklyExcelPreviewRow[];
}

export interface WeeklyExcelUploadResultItem {
  row_num: number;
  task_id: string;
  task_title: string;
  success: boolean;
  update_id?: number;
  reporting_week?: string;
  progress_percent?: number;
  status?: string;
  error?: string;
}

export interface WeeklyExcelErrorReportItem {
  row_num: number;
  task_id: string;
  task_title: string;
  error: string;
  work_completed: string;
}

export interface WeeklyExcelUploadResponse {
  success: boolean;
  total_rows: number;
  successful_count: number;
  failed_count: number;
  results: WeeklyExcelUploadResultItem[];
  error_report: WeeklyExcelErrorReportItem[];
}

export interface GovernanceTargetRevisionRequest {
  id: number;
  action_point: number;
  action_id: string;
  action_point_title: string;
  circle_name: string;
  owner_name: string;
  requested_by: SimpleUser | null;
  original_target_date: string;
  current_target_date: string;
  requested_target_date: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  requested_at: string;
  reviewed_by: SimpleUser | null;
  reviewed_at: string | null;
  reviewer_comment: string;
}

export interface SubmitTargetRevisionRequestPayload {
  requested_target_date: string;
  reason: string;
}

export interface ReviewTargetRevisionRequestPayload {
  decision: "Approved" | "Rejected";
  reviewer_comment?: string;
}

export interface RevisionRequestsListResponse {
  success: boolean;
  count: number;
  pending_count: number;
  page: number;
  page_size: number;
  results: GovernanceTargetRevisionRequest[];
}

