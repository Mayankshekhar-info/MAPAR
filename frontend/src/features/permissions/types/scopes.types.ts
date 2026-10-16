export interface ScopeCircleInfo {
  circle_id: number;
  circle_name: string;
  circle_code: string;
  region: string;
  hierarchy_breadcrumb: string;
}

export interface ScopeDomainInfo {
  domain_id: number;
  domain_name: string;
  domain_code: string;
  circle_name?: string;
}

export interface AccessScopeListItem {
  id: number;
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  role_name: string;
  scope_type: "GLOBAL" | "CORPORATE" | "COMPANY" | "PROJECT" | "CIRCLE" | "DOMAIN" | "DEPARTMENT";
  scope_type_display: string;
  circles_count: number;
  circles: ScopeCircleInfo[];
  domains: ScopeDomainInfo[];
  is_active: boolean;
  updated_at: string | null;
}

export interface AssignScopePayload {
  user_id: number;
  scope_type: "GLOBAL" | "CORPORATE" | "COMPANY" | "PROJECT" | "CIRCLE" | "DOMAIN" | "DEPARTMENT";
  circle_ids?: number[];
  domain_ids?: number[];
}
