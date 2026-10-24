/**
 * TypeScript definitions and DTOs for the Uploads module.
 * Fully aligned with the backend DRF API contract.
 */

export type ColumnDataType =
  | "TEXT"
  | "INTEGER"
  | "DECIMAL"
  | "DATE"
  | "BOOLEAN"
  | "PERCENTAGE"
  | "REFERENCE";

export interface ColumnValidationRules {
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  allowed_values?: string[];
  reference_level?: string;
  [key: string]: unknown;
}

export interface UploadTemplateColumn {
  id?: number;
  name: string;
  display_label: string;
  data_type: ColumnDataType;
  is_required: boolean;
  is_unique: boolean;
  column_order: number;
  default_value: string;
  description: string;
  validation_rules: ColumnValidationRules;
}

export interface UploadTemplateVersion {
  id: number;
  version_number: number;
  changelog: string;
  is_active: boolean;
  created_by_name: string;
  created_at: string;
  columns: UploadTemplateColumn[];
}

export interface UploadTemplate {
  id: number;
  name: string;
  code: string;
  description: string;
  data_level: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  target_entity: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  latest_version_id?: number;
  latest_version_number: number;
  columns_count: number;
  batches_count: number;
  file_type?: string;
  versions?: UploadTemplateVersion[];
}

export type BatchStatus =
  | "UPLOADED"
  | "VALIDATING"
  | "VALIDATED"
  | "COMMITTING"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED";

export interface ImportAuditLineage {
  id: number;
  action: string;
  records_affected: number;
  details: Record<string, unknown>;
  performed_by_name: string;
  created_at: string;
}

export interface ImportBatch {
  id: number;
  batch_id: string;
  template_name: string;
  template_id: number;
  template_data_level?: string;
  template_version_number: number;
  reporting_period_id: number | null;
  reporting_period_name: string;
  uploaded_by_name: string;
  original_filename: string;
  file_size_bytes: number;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  status: BatchStatus;
  summary_notes: string;
  applied_kpi_id?: number | null;
  applied_kpi_code?: string;
  applied_kpi_name?: string;
  kpi_execution_status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "COMPATIBILITY_ERROR" | "SKIPPED";
  kpi_result_summary?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
  lineage_events?: ImportAuditLineage[];
}

export interface CompatibleKPI {
  id: number;
  code: string;
  name: string;
  description: string;
  unit: string;
  hierarchy_level: string;
  calculation_type: string;
  source_dataset_id: number | null;
  is_direct_source: boolean;
  is_compatible: boolean;
  required_columns: string[];
  missing_columns: string[];
}


export interface ImportValidationError {
  id: number;
  row_index: number;
  column_name: string;
  cell_value: string;
  error_message: string;
  severity: "ERROR" | "WARNING";
  created_at: string;
}

export interface HierarchyLevelOption {
  key: string;
  label: string;
}

export interface ColumnDataTypeOption {
  key: ColumnDataType;
  label: string;
}

export interface ReportingPeriodOption {
  id: number;
  name: string;
  period_type: string;
  is_current: boolean;
  is_frozen: boolean;
}

export interface UploadsMeta {
  hierarchy_levels: HierarchyLevelOption[];
  data_types: ColumnDataTypeOption[];
  reporting_periods: ReportingPeriodOption[];
}

export interface CreateTemplatePayload {
  name: string;
  code?: string;
  description?: string;
  data_level: string;
  target_entity: string;
  columns: Array<{
    name: string;
    display_label: string;
    data_type: ColumnDataType;
    is_required: boolean;
    is_unique: boolean;
    column_order: number;
    default_value?: string;
    description?: string;
    validation_rules?: ColumnValidationRules;
  }>;
}

export interface CreateVersionPayload {
  changelog?: string;
  columns: Array<{
    name: string;
    display_label: string;
    data_type: ColumnDataType;
    is_required: boolean;
    is_unique: boolean;
    column_order: number;
    default_value?: string;
    description?: string;
    validation_rules?: ColumnValidationRules;
  }>;
}

export interface UpdateVersionPayload {
  name?: string;
  description?: string;
  data_level?: string;
  changelog?: string;
  is_active?: boolean;
  columns?: Array<{
    name: string;
    display_label: string;
    data_type: ColumnDataType;
    is_required: boolean;
    is_unique: boolean;
    column_order: number;
    default_value?: string;
    description?: string;
    validation_rules?: ColumnValidationRules;
  }>;
}
