export type HierarchyLevel =
  | "MAIN_COMPANY"
  | "SUB_COMPANY"
  | "PROJECT"
  | "CIRCLE"
  | "DOMAIN"
  | "DEPARTMENT"
  | "SUB_DEPARTMENT"
  | "TEAM"
  | "USER";

export interface HierarchyLevelConfig {
  level: HierarchyLevel;
  name: string;
  plural_name: string;
  parent_level: HierarchyLevel | null;
  child_level: HierarchyLevel | null;
  badge_color: "purple" | "indigo" | "blue" | "cyan" | "emerald" | "amber" | "rose" | "teal";
  icon: string;
  can_create_root: boolean;
}

export interface HierarchyNode {
  id: string;
  raw_id: number;
  level: HierarchyLevel;
  name: string;
  code: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  badge: string;
  badge_color: string;
  icon?: string;
  color?: string;
  parent_id: string | null;
  parent_name: string | null;
  children: HierarchyNode[];
}

export interface HierarchySummary {
  main_companies: number;
  sub_companies: number;
  projects: number;
  circles: number;
  domains: number;
  departments: number;
  sub_departments: number;
  teams?: number;
  users?: number;
}

export interface NodeAuditEntry {
  action: string;
  timestamp: string;
  user: string;
  details: Record<string, any>;
}

export interface NodeDetailChild {
  id: number;
  name: string;
  code: string;
  status: string;
  level: HierarchyLevel;
}

export interface NodeDetail {
  id: number;
  level: HierarchyLevel;
  name: string;
  code: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  created_at: string | null;
  updated_at: string | null;
  parent: {
    level: HierarchyLevel;
    id: number;
    name: string;
    code: string;
  } | null;
  children: NodeDetailChild[];
  children_count: number;
  allowed_child_level: HierarchyLevel | null;
  hierarchy_context?: Record<string, any>;
  hierarchy_summary?: Record<string, any> | null;
  audits: NodeAuditEntry[];
}


export interface CreateNodePayload {
  level: HierarchyLevel;
  name: string;
  code: string;
  description?: string;
  parent_id?: number | null;
  extra_fields?: Record<string, any>;
}

export interface UpdateNodePayload {
  level: HierarchyLevel;
  name: string;
  code: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  parent_id?: number | null;
}

export interface CascadingOption {
  id: number;
  name: string;
  code: string;
  parent_id?: number;
  parent_type?: string;
  parent_name?: string;
  region?: string;
  project_id?: number;
  project_name?: string;
  sub_company_id?: number;
  sub_company_name?: string;
  main_company_id?: number;
  main_company_name?: string;
  is_direct?: boolean;
}

export interface HierarchySearchResult {
  id: number;
  name: string;
  code: string;
  level: HierarchyLevel;
  badge: string;
  parent?: string;
}
