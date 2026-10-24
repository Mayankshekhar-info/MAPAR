from rest_framework.permissions import BasePermission
from common.permissions.authorization import AuthorizationService


class HasKPIPermission(BasePermission):
    """
    Enforces role-based action permission and organization scope boundary on KPI endpoints.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser or getattr(request.user, "role", None) == "SUPER_ADMIN":
            return True

        method = request.method
        if method in ["GET", "HEAD", "OPTIONS"]:
            return AuthorizationService.can(user=request.user, permission="kpi.view")
        elif method == "POST":
            return AuthorizationService.can(user=request.user, permission="kpi.create")
        elif method in ["PUT", "PATCH"]:
            return AuthorizationService.can(user=request.user, permission="kpi.edit")
        elif method == "DELETE":
            return AuthorizationService.can(user=request.user, permission="kpi.delete")
        return False
