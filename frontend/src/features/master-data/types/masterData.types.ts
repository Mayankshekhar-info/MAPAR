export interface MasterDataColumn {
  id: number;
  name: string;
  display_label: string;
  data_type: "TEXT" | "INTEGER" | "DECIMAL" | "DATE" | "BOOLEAN" | "PERCENTAGE" | "REFERENCE";
  is_required: boolean;
  column_order: number;
  validation_rules?: Record<string, any>;
}

export interface MasterDataTemplate {
  id: number;
  code: string;
  name: string;
  description: string;
  data_level: string;
  target_entity: string;
  latest_version_id: number | null;
  columns: MasterDataColumn[];
}

export interface HierarchyOption {
  id: number;
  name: string;
  code: string;
  main_company_id?: number;
  sub_company_id?: number;
  project_id?: number;
}

export interface MasterDataMeta {
  templates: MasterDataTemplate[];
  reporting_periods: Array<{
    id: number;
    name: string;
    period_type: string;
    is_current: boolean;
    is_frozen: boolean;
    start_date: string;
    end_date: string;
  }>;
  companies: HierarchyOption[];
  sub_companies: HierarchyOption[];
  projects: HierarchyOption[];
  circles: HierarchyOption[];
  departments: HierarchyOption[];
}

export interface MasterDataRecord {
  id: number;
  row_index: number;
  raw_data: Record<string, any>;
  is_valid: boolean;
  validation_errors: string[];
  is_imported: boolean;
  created_at: string | null;
  batch_id: string;
  batch_status: string;
  reporting_period: string | null;
  company: string | null;
  sub_company?: string | null;
  project: string | null;
  circle: string | null;
  department: string | null;
}

export interface MasterDataBatchInfo {
  id: number;
  batch_id: string;
  status: string;
  original_filename: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  reporting_period: string | null;
  company: string | null;
  sub_company?: string | null;
  project: string | null;
  circle: string | null;
  department: string | null;
  created_at: string | null;
}

export interface MasterDataRecordsResponse {
  total: number;
  limit: number;
  offset: number;
  columns: MasterDataColumn[];
  records: MasterDataRecord[];
  template: {
    id: number | null;
    name: string | null;
    code: string | null;
  } | null;
  batch: MasterDataBatchInfo | null;
}

export interface MasterDataFilterState {
  companyId: number | null;
  subCompanyId: number | null;
  projectId: number | null;
  circleId: number | null;
  departmentId: number | null;
  periodId: number | null;
  templateId: number | null;
  batchId?: string;
  search: string;
  isValid: boolean | null;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface UploadMasterDataPayload {
  file: File;
  template_id?: number;
  version_id?: number;
  company_id?: number | null;
  sub_company_id?: number | null;
  project_id?: number | null;
  circle_id?: number | null;
  department_id?: number | null;
  reporting_period_id?: number | null;
  import_mode?: "append" | "update_or_create" | "replace";
}
