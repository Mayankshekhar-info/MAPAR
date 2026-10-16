from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError

from common.permissions.authorization import AuthorizationService
from apps.authorization.selectors.role_selectors import (
    get_roles_list,
    get_role_detail,
    get_available_permissions_matrix,
)
from apps.authorization.selectors.scope_selectors import (
    get_user_scopes_list,
    get_user_effective_access,
)
from apps.authorization.services.role_service import RoleService
from apps.authorization.services.scope_service import ScopeService
from apps.authorization.api.serializers import (
    CreateRoleSerializer,
    UpdateRoleSerializer,
    AssignScopeSerializer,
    UpdateScopeSerializer,
)


class RoleListView(APIView):
    """
    GET  /api/v1/authorization/roles/ - list enterprise roles
    POST /api/v1/authorization/roles/ - create custom role
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        AuthorizationService.require(user=request.user, permission="admin.view")
        search = request.query_params.get("search")
        role_status = request.query_params.get("status")
        roles = get_roles_list(search=search, status=role_status)
        return Response({"success": True, "count": len(roles), "roles": roles})

    def post(self, request):
        AuthorizationService.require(user=request.user, permission="admin.create")
        serializer = CreateRoleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            role = RoleService.create_role(serializer.validated_data, user=request.user)
            role_detail = get_role_detail(role.id)
            return Response({"success": True, "role": role_detail}, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RoleDetailView(APIView):
    """
    GET    /api/v1/authorization/roles/<id>/ - role details & permissions
    PATCH  /api/v1/authorization/roles/<id>/ - update role
    DELETE /api/v1/authorization/roles/<id>/ - delete role
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        AuthorizationService.require(user=request.user, permission="admin.view")
        detail = get_role_detail(pk)
        if not detail:
            return Response({"success": False, "detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"success": True, "role": detail})

    def patch(self, request, pk):
        AuthorizationService.require(user=request.user, permission="admin.edit")
        serializer = UpdateRoleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            role = RoleService.update_role(pk, serializer.validated_data, user=request.user)
            detail = get_role_detail(role.id)
            return Response({"success": True, "role": detail})
        except ValidationError as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        AuthorizationService.require(user=request.user, permission="admin.delete")
        try:
            RoleService.delete_role(pk, user=request.user)
            return Response({"success": True, "detail": "Role deleted successfully."})
        except ValidationError as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PermissionMatrixView(APIView):
    """
    GET /api/v1/authorization/permissions/matrix/ - dynamic modules & permissions matrix
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        AuthorizationService.require(user=request.user, permission="admin.view")
        matrix = get_available_permissions_matrix()
        return Response({"success": True, "modules": matrix})


class AccessScopeListView(APIView):
    """
    GET  /api/v1/authorization/scopes/ - list assigned scopes
    POST /api/v1/authorization/scopes/ - assign user access scope
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        AuthorizationService.require(user=request.user, permission="admin.view")
        user_id_param = request.query_params.get("user_id")
        user_id = int(user_id_param) if user_id_param and user_id_param.isdigit() else None
        scopes = get_user_scopes_list(user_id=user_id)
        return Response({"success": True, "count": len(scopes), "scopes": scopes})

    def post(self, request):
        AuthorizationService.require(user=request.user, permission="admin.create")
        serializer = AssignScopeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            scope = ScopeService.assign_user_scope(serializer.validated_data, admin_user=request.user)
            user_scopes = get_user_scopes_list(user_id=scope.user_id)
            matched_scope = next((s for s in user_scopes if s["id"] == scope.id), user_scopes[0] if user_scopes else None)
            return Response({"success": True, "scope": matched_scope}, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AccessScopeDetailView(APIView):
    """
    GET    /api/v1/authorization/scopes/<id>/ - get scope details
    PATCH  /api/v1/authorization/scopes/<id>/ - update access scope & permissions
    DELETE /api/v1/authorization/scopes/<id>/ - revoke access scope
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        AuthorizationService.require(user=request.user, permission="admin.view")
        from apps.authorization.models import UserAccessScope
        try:
            scope = UserAccessScope.objects.get(id=pk)
            scopes = get_user_scopes_list(user_id=scope.user_id)
            matched = next((s for s in scopes if s["id"] == pk), None)
            if not matched:
                return Response({"success": False, "detail": "Scope not found."}, status=status.HTTP_404_NOT_FOUND)
            return Response({"success": True, "scope": matched})
        except UserAccessScope.DoesNotExist:
            return Response({"success": False, "detail": "Scope not found."}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        AuthorizationService.require(user=request.user, permission="admin.edit")
        serializer = UpdateScopeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            scope = ScopeService.update_user_scope(pk, serializer.validated_data, admin_user=request.user)
            scopes = get_user_scopes_list(user_id=scope.user_id)
            matched = next((s for s in scopes if s["id"] == pk), None)
            return Response({"success": True, "scope": matched})
        except ValidationError as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        AuthorizationService.require(user=request.user, permission="admin.delete")
        try:
            ScopeService.delete_user_scope(pk, admin_user=request.user)
            return Response({"success": True, "detail": "Access scope revoked successfully."})
        except ValidationError as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UserEffectiveAccessView(APIView):
    """
    GET /api/v1/authorization/users/<id>/effective-access/ - effective permissions & scopes
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        AuthorizationService.require(user=request.user, permission="admin.view")
        data = get_user_effective_access(pk)
        if not data:
            return Response({"success": False, "detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"success": True, "effective_access": data})
