export interface RoleListItem {
  id: number;
  name: string;
  code: string;
  description: string;
  role_type: "SYSTEM" | "CUSTOM";
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "ACTIVE" | "INACTIVE";
  permissions_count: number;
  users_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface PermissionItem {
  id: number;
  code: string;
  name: string;
  description: string;
  action: string;
  risk_level?: string;
  module_code?: string;
}

export interface PermissionMatrixModule {
  module_id: number;
  module_name: string;
  module_code: string;
  description: string;
  icon: string;
  permissions: PermissionItem[];
}

export interface RoleDetail extends RoleListItem {
  granted_permissions: PermissionItem[];
  granted_permission_ids: number[];
  denied_permissions: PermissionItem[];
  denied_permission_ids: number[];
}

export interface CreateRolePayload {
  name: string;
  code: string;
  description?: string;
  risk_level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status?: "ACTIVE" | "INACTIVE";
  permission_ids?: number[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  risk_level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status?: "ACTIVE" | "INACTIVE";
  permission_ids?: number[];
}
