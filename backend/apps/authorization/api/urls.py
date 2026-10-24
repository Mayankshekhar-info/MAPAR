from django.urls import path
from apps.authorization.api.views import (
    RoleListView,
    RoleDetailView,
    PermissionMatrixView,
    AccessScopeListView,
    AccessScopeDetailView,
    UserEffectiveAccessView,
    ModuleCatalogView,
)

urlpatterns = [
    path("modules/", ModuleCatalogView.as_view(), name="auth-module-catalog"),
    path("roles/", RoleListView.as_view(), name="auth-role-list"),
    path("roles/<int:pk>/", RoleDetailView.as_view(), name="auth-role-detail"),
    path("permissions/matrix/", PermissionMatrixView.as_view(), name="auth-permission-matrix"),
    path("scopes/", AccessScopeListView.as_view(), name="auth-scope-list"),
    path("scopes/<int:pk>/", AccessScopeDetailView.as_view(), name="auth-scope-detail"),
    path("users/<int:pk>/effective-access/", UserEffectiveAccessView.as_view(), name="auth-user-effective-access"),
]
