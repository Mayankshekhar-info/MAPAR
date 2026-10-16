import { ReactNode } from "react";

export type UserRole =
  | "SUPER_ADMIN"
  | "MANAGEMENT"
  | "CORPORATE_DOMAIN_LEAD"
  | "CIRCLE_DOMAIN_MANAGER"
  | "CIRCLE_DATA_ENTRY"
  | "ACTION_OWNER"
  | "VIEWER";

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  iconName: string;
  badge?: string | number;
  description?: string;
  allowedRoles?: UserRole[];
  requiredPermission?: string;
  moduleCode?: string;
  children?: NavigationItem[];
  exact?: boolean;
}

export interface NavigationGroup {
  id: string;
  title: string;
  items: NavigationItem[];
  allowedRoles?: UserRole[];
  requiredPermission?: string;
  moduleCode?: string;
}

export interface NavigationContextState {
  currentModule: NavigationItem | null;
  breadcrumbs: { label: string; path: string }[];
}
