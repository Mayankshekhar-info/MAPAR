import { useAuth } from "../../auth";

export interface UploadPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canCommit: boolean;
  isViewOnly: boolean;
  canManage: boolean;
}

export function useUploadPermissions(): UploadPermissions {
  const { user } = useAuth();

  if (!user) {
    return {
      canView: false,
      canCreate: false,
      canEdit: false,
      canCommit: false,
      isViewOnly: true,
      canManage: false,
    };
  }

  // Superuser or SUPER_ADMIN has complete access across all domains
  if (user.is_superuser || user.role === "SUPER_ADMIN") {
    return {
      canView: true,
      canCreate: true,
      canEdit: true,
      canCommit: true,
      isViewOnly: false,
      canManage: true,
    };
  }

  const perms = user.permissions || [];
  const hasWildcard = perms.includes("*.*");
  const hasManagePerm =
    hasWildcard ||
    perms.some((p) =>
      ["uploads.create", "uploads.edit", "uploads.manage"].includes(p)
    );
  const hasViewPerm =
    hasWildcard || hasManagePerm || perms.includes("uploads.view");

  // If user has admin role fallback
  const isSysAdmin = user.role === "SYS_ADMIN";
  const canManage = hasManagePerm || isSysAdmin;
  const canView = hasViewPerm || isSysAdmin;
  const isViewOnly = !canManage;

  return {
    canView,
    canCreate: canManage,
    canEdit: canManage,
    canCommit: canManage,
    isViewOnly,
    canManage,
  };
}
