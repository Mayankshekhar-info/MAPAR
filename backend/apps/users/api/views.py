from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError

from common.permissions.authorization import AuthorizationService
from apps.users.selectors.user_selectors import get_users_list, get_user_detail
from apps.users.services.user_service import UserService
from apps.users.api.serializers import CreateUserSerializer, UpdateUserSerializer


class UserListView(APIView):
    """
    GET  /api/v1/users/ - paginated, searchable list of enterprise users
    POST /api/v1/users/ - create user account with role and hierarchy scope
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        AuthorizationService.require(user=request.user, permission="admin.view")
        search = request.query_params.get("search")
        role = request.query_params.get("role")
        user_status = request.query_params.get("status")
        circle_id_param = request.query_params.get("circle_id")
        circle_id = int(circle_id_param) if circle_id_param and circle_id_param.isdigit() else None
        team_id_param = request.query_params.get("team_id") or request.query_params.get("sub_department_id")
        team_id = int(team_id_param) if team_id_param and team_id_param.isdigit() else None

        page_param = request.query_params.get("page", "1")
        page = int(page_param) if page_param.isdigit() else 1
        page_size_param = request.query_params.get("page_size", "20")
        page_size = int(page_size_param) if page_size_param.isdigit() else 20

        data = get_users_list(
            search=search,
            role=role,
            status=user_status,
            circle_id=circle_id,
            team_id=team_id,
            page=page,
            page_size=page_size,
            request_user=request.user,
        )
        return Response({"success": True, **data})


    def post(self, request):
        AuthorizationService.require(user=request.user, permission="admin.create")
        serializer = CreateUserSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = UserService.create_user(serializer.validated_data, admin_user=request.user)
            user_detail = get_user_detail(user.id, request_user=request.user)
            return Response({"success": True, "user": user_detail}, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UserDetailView(APIView):
    """
    GET   /api/v1/users/<id>/ - user account details & assigned scopes
    PATCH /api/v1/users/<id>/ - update user account
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        AuthorizationService.require(user=request.user, permission="admin.view")
        detail = get_user_detail(pk, request_user=request.user)
        if not detail:
            return Response({"success": False, "detail": "User not found or access denied for this organization scope."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"success": True, "user": detail})

    def patch(self, request, pk):
        AuthorizationService.require(user=request.user, permission="admin.edit")
        serializer = UpdateUserSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = UserService.update_user(pk, serializer.validated_data, admin_user=request.user)
            detail = get_user_detail(user.id, request_user=request.user)
            return Response({"success": True, "user": detail})
        except ValidationError as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UserStatusToggleView(APIView):
    """
    POST /api/v1/users/<id>/toggle-status/ - toggle activate / deactivate
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        AuthorizationService.require(user=request.user, permission="admin.edit")
        try:
            user = UserService.toggle_user_status(pk, admin_user=request.user)
            return Response({
                "success": True,
                "is_active": user.is_active,
                "status": user.status,
                "detail": f"User account has been {'activated' if user.is_active else 'deactivated'}."
            })
        except ValidationError as e:
            return Response({"success": False, "errors": e.message_dict if hasattr(e, "message_dict") else str(e)}, status=status.HTTP_400_BAD_REQUEST)
