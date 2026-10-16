import { AuthUser } from "../../features/auth/types/auth.types";
import { MAPAR_NAVIGATION_CONFIG } from "./navigation.config";
import { NavigationGroup, NavigationItem, UserRole } from "./navigation.types";

/**
 * Evaluates whether a user is authorized to access a navigation item or group.
 * Super Admin / Superuser has full platform access.
 * Non-admin access is checked dynamically against:
 * 1. user.permissions (e.g. "management.view", "slides.view", "uploads.view")
 * 2. user.accessible_modules (e.g. "management", "slides", "organization", "uploads")
 * 3. fallback to allowedRoles if permissions array is pending
 */
export function isItemAuthorized(
  user: AuthUser | null,
  requiredPermission?: string,
  moduleCode?: string,
  allowedRoles?: UserRole[]
): boolean {
  if (!user) return false;
  if (user.is_superuser || user.role === "SUPER_ADMIN") return true;

  // 1. Dynamic permission check
  if (requiredPermission && user.permissions && user.permissions.length > 0) {
    if (user.permissions.includes(requiredPermission) || user.permissions.includes("*.*")) {
      return true;
    }
  }

  // 2. Dynamic module code check
  if (moduleCode && user.accessible_modules && user.accessible_modules.length > 0) {
    if (user.accessible_modules.includes(moduleCode)) {
      return true;
    }
  }

  // 3. If user permissions are loaded and this item requires a permission/module that is NOT granted, deny
  if (user.permissions && user.permissions.length > 0 && (requiredPermission || moduleCode)) {
    return false;
  }

  // 4. Fallback to allowedRoles if permissions not loaded
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(user.role as UserRole);
}

/**
 * Resolves the visible navigation tree for the authenticated user based on dynamic authorization.
 */
export function resolveNavigation(user: AuthUser | null): NavigationGroup[] {
  const result: NavigationGroup[] = [];

  for (const group of MAPAR_NAVIGATION_CONFIG) {
    // Check group level authorization
    if (!isItemAuthorized(user, group.requiredPermission, group.moduleCode, group.allowedRoles)) {
      continue;
    }

    const items: NavigationItem[] = [];

    for (const item of group.items) {
      if (!isItemAuthorized(user, item.requiredPermission, item.moduleCode, item.allowedRoles)) {
        continue;
      }

      let filteredChildren: NavigationItem[] | undefined = undefined;
      if (item.children) {
        filteredChildren = item.children.filter((child) =>
          isItemAuthorized(user, child.requiredPermission, child.moduleCode, child.allowedRoles)
        );
      }

      items.push({
        ...item,
        children: filteredChildren,
      });
    }

    if (items.length > 0) {
      result.push({
        ...group,
        items,
      });
    }
  }

  return result;
}

/**
 * Finds the matching navigation item for a given pathname.
 */
export function findNavigationItem(pathname: string, groups: NavigationGroup[]): NavigationItem | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.exact ? pathname === item.path : pathname.startsWith(item.path)) {
        if (item.children) {
          const matchedChild = item.children.find((c) => pathname === c.path || pathname.startsWith(c.path));
          if (matchedChild) return matchedChild;
        }
        return item;
      }
    }
  }
  return null;
}

/**
 * Computes breadcrumb items for a given pathname.
 */
export function resolveBreadcrumbs(
  pathname: string,
  groups: NavigationGroup[]
): { label: string; path: string }[] {
  if (pathname === "/") {
    return [{ label: "Management Cockpit", path: "/" }];
  }

  const breadcrumbs: { label: string; path: string }[] = [{ label: "Home", path: "/" }];

  for (const group of groups) {
    for (const item of group.items) {
      if (item.path !== "/" && pathname.startsWith(item.path)) {
        breadcrumbs.push({ label: item.label, path: item.path });
        if (item.children) {
          const child = item.children.find((c) => pathname === c.path);
          if (child) {
            breadcrumbs.push({ label: child.label, path: child.path });
          }
        }
        return breadcrumbs;
      }
    }
  }

  // Fallback for subpaths
  const segments = pathname.split("/").filter(Boolean);
  let currentPath = "";
  segments.forEach((seg) => {
    currentPath += `/${seg}`;
    breadcrumbs.push({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
      path: currentPath,
    });
  });

  return breadcrumbs;
}
