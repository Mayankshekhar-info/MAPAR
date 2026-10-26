from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import LoginRequestSerializer, UserSummarySerializer


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfTokenView(APIView):
    """
    GET /api/v1/auth/csrf/
    Ensures the CSRF cookie is set and returns the token for SPA clients.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        token = get_token(request)
        return Response({"csrfToken": token, "detail": "CSRF cookie set"})


class LoginView(APIView):
    """
    POST /api/v1/auth/login/
    Authenticates user credentials, establishes Django session, and returns user identity.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"detail": "Validation error", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]
        remember_me = serializer.validated_data.get("remember_me", False)

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {"detail": "Invalid username or password"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Account status & activation verification
        status_val = getattr(user, "status", None)
        if not user.is_active or status_val != getattr(user.Status, "ACTIVE", "ACTIVE"):
            if status_val == getattr(user.Status, "INVITED", "INVITED"):
                detail = "Your account is pending activation. Please contact your system administrator."
            elif status_val == getattr(user.Status, "LOCKED", "LOCKED"):
                detail = "Your account has been locked. Please contact your system administrator."
            elif status_val == getattr(user.Status, "SUSPENDED", "SUSPENDED"):
                detail = "Your account has been suspended. Please contact your system administrator."
            else:
                detail = "User account is inactive. Please contact your system administrator."
            return Response(
                {"detail": detail},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Reset failed login attempts on successful authentication
        if hasattr(user, "failed_login_attempts") and user.failed_login_attempts > 0:
            user.failed_login_attempts = 0
            user.save(update_fields=["failed_login_attempts"])

        login(request, user)

        if remember_me:
            # 30 days session
            request.session.set_expiry(30 * 24 * 60 * 60)
        else:
            # Browser session
            request.session.set_expiry(0)

        user_data = UserSummarySerializer(user).data
        return Response({
            "success": True,
            "user": user_data,
        }, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    """
    GET /api/v1/auth/me/
    Returns the authenticated user or 401 if unauthenticated.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_data = UserSummarySerializer(request.user).data
        return Response({
            "is_authenticated": True,
            "user": user_data,
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Terminates the session.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response({"success": True, "detail": "Logged out successfully"}, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    """
    POST /api/v1/auth/password-reset/request/
    Accepts identifier (username/email/employee_id), generates single-use OTP, and dispatches via SMTP.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from .serializers import PasswordResetRequestSerializer
        from apps.identity.services.password_reset_service import PasswordResetService

        serializer = PasswordResetRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"detail": "Validation error", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        identifier = serializer.validated_data["identifier"]
        ip_addr = request.META.get("REMOTE_ADDR")

        success, detail_msg, debug_otp = PasswordResetService.request_password_reset(
            identifier=identifier,
            ip_address=ip_addr,
        )

        resp_data = {"success": success, "detail": detail_msg}
        if debug_otp:
            resp_data["debug_otp"] = debug_otp

        if not success:
            return Response(resp_data, status=status.HTTP_429_TOO_MANY_REQUESTS)

        return Response(resp_data, status=status.HTTP_200_OK)


class PasswordResetVerifyView(APIView):
    """
    POST /api/v1/auth/password-reset/verify/
    Verifies 6-digit OTP code and returns single-use reset token upon success.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from .serializers import PasswordResetVerifySerializer
        from apps.identity.services.password_reset_service import PasswordResetService

        serializer = PasswordResetVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"detail": "Validation error", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        identifier = serializer.validated_data["identifier"]
        otp_code = serializer.validated_data["otp_code"]

        success, detail_msg, reset_token = PasswordResetService.verify_otp(
            identifier=identifier,
            otp_code=otp_code,
        )

        if not success:
            return Response(
                {"success": False, "detail": detail_msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            "success": True,
            "detail": detail_msg,
            "reset_token": reset_token,
        }, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """
    POST /api/v1/auth/password-reset/confirm/
    Updates user password with verified reset token, clears lockouts, and terminates active sessions.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        from .serializers import PasswordResetConfirmSerializer
        from apps.identity.services.password_reset_service import PasswordResetService

        serializer = PasswordResetConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"detail": "Validation error", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reset_token = serializer.validated_data["reset_token"]
        new_password = serializer.validated_data["new_password"]

        success, detail_msg = PasswordResetService.confirm_password_reset(
            reset_token=reset_token,
            new_password=new_password,
        )

        if not success:
            return Response(
                {"success": False, "detail": detail_msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            "success": True,
            "detail": detail_msg,
        }, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    """
    POST /api/v1/auth/change-password/
    Allows authenticated users to change their password by validating their current password.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .serializers import ChangePasswordSerializer
        from apps.identity.services.password_reset_service import PasswordResetService

        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"detail": "Validation error", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_password = serializer.validated_data["current_password"]
        new_password = serializer.validated_data["new_password"]

        success, detail_msg = PasswordResetService.change_password_authenticated(
            user=request.user,
            current_password=current_password,
            new_password=new_password,
        )

        if not success:
            return Response(
                {"success": False, "detail": detail_msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            "success": True,
            "detail": detail_msg,
        }, status=status.HTTP_200_OK)
