export interface UserListItem {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  role_name: string;
  status: "ACTIVE" | "INACTIVE" | "LOCKED" | "SUSPENDED" | "INVITED";
  is_active: boolean;
  circle_id: number | null;
  circle_name: string | null;
  circle_code: string | null;
  sub_department_id?: number | null;
  sub_department_name?: string | null;
  team_id?: number | null;
  team_name?: string | null;
  organization_scope: string | null;
  hierarchy_context?: Record<string, any>;
  department: string;
  designation: string;
  date_joined: string | null;
  last_login: string | null;
}

export interface UsersListResponse {
  success: boolean;
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: UserListItem[];
}

export interface UserRoleBinding {
  id: number;
  code: string;
  name: string;
  is_primary: boolean;
  risk_level: string;
}

export interface OrganizationScopeItem {
  id?: number;
  user_id?: number;
  main_company_id?: number | null;
  main_company_name?: string | null;
  sub_company_id?: number | null;
  sub_company_name?: string | null;
  project_id?: number | null;
  project_name?: string | null;
  circle_id?: number | null;
  circle_name?: string | null;
  domain_id?: number | null;
  domain_name?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  sub_department_id?: number | null;
  sub_department_name?: string | null;
  team_id?: number | null;
  team_name?: string | null;
  hierarchy_breadcrumb?: string;
  anchor_level?: string;
  can_view?: boolean;
  can_manage?: boolean;
  can_create?: boolean;
  can_update?: boolean;
  can_delete?: boolean;
  actions?: string[];
  created_at?: string | null;
  updated_at?: string | null;
}

export type ModuleAccessLevel = "NO_ACCESS" | "READ" | "WRITE";

export interface UserModulePermissionItem {
  module_id: number;
  module_code: string;
  module_name?: string;
  description?: string;
  icon?: string;
  route_name?: string;
  access_level: ModuleAccessLevel;
}

export interface ModuleCatalogItem {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  route_name: string;
  sort_order: number;
  supported_levels: { level: ModuleAccessLevel; label: string }[];
}

export interface UserDetail extends UserListItem {
  is_staff: boolean;
  is_superuser: boolean;
  phone: string;
  employee_id: string | null;
  roles: UserRoleBinding[];
  scopes?: OrganizationScopeItem[];
  module_permissions?: UserModulePermissionItem[];
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  role_id?: number;
  circle_id?: number | null;
  sub_department_id?: number | null;
  team_id?: number | null;
  department?: string;
  designation?: string;
  phone?: string;
  employee_id?: string | null;
  status?: string;
  scopes?: OrganizationScopeItem[];
  module_permissions?: UserModulePermissionItem[];
}

export interface UpdateUserPayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  role_id?: number;
  circle_id?: number | null;
  sub_department_id?: number | null;
  team_id?: number | null;
  department?: string;
  designation?: string;
  phone?: string;
  employee_id?: string | null;
  status?: string;
  password?: string;
  scopes?: OrganizationScopeItem[];
  module_permissions?: UserModulePermissionItem[];
}


