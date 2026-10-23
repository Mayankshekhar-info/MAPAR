from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions.authorization import AuthorizationService
from apps.notifications.models import EmailConfiguration
from apps.notifications.selectors.email_selectors import (
    get_smtp_configuration_dto,
    get_delivery_logs_queryset,
    get_schedule_overview_dto,
)
from apps.notifications.services.smtp_service import SMTPService
from apps.notifications.services.reminder_scheduler_service import ReminderSchedulerService
from apps.notifications.api.serializers import (
    SMTPConfigurationSerializer,
    UpdateSMTPConfigurationSerializer,
    TestConnectionSerializer,
    SendTestEmailSerializer,
    EmailDeliveryRecordSerializer,
    TriggerRemindersSerializer,
)


class NotificationBasePermissionMixin:
    """Helper to enforce scoped administrative permissions."""

    @staticmethod
    def check_admin_view(user):
        if user.is_superuser or getattr(user, "is_superadmin", False):
            return
        AuthorizationService.require(user=user, permission="admin.view")

    @staticmethod
    def check_admin_edit(user):
        if user.is_superuser or getattr(user, "is_superadmin", False):
            return
        AuthorizationService.require(user=user, permission="admin.edit")


class SMTPConfigurationView(APIView, NotificationBasePermissionMixin):
    """
    GET  /api/v1/notifications/smtp/ - Retrieve active SMTP configuration (masked password).
    POST /api/v1/notifications/smtp/ - Update SMTP settings and central CC list.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        self.check_admin_view(request.user)
        dto = get_smtp_configuration_dto()
        return Response({"success": True, "configuration": dto})

    def post(self, request):
        self.check_admin_edit(request.user)
        serializer = UpdateSMTPConfigurationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        config_obj = EmailConfiguration.get_solo()

        if "smtp_host" in data:
            config_obj.smtp_host = data["smtp_host"].strip()
        if "smtp_port" in data:
            config_obj.smtp_port = data["smtp_port"]
        if "smtp_username" in data:
            config_obj.smtp_username = data["smtp_username"].strip()

        # Update password only if a new non-masked password is provided
        raw_password = data.get("smtp_password", "").strip()
        if raw_password and raw_password != "••••••••":
            config_obj.smtp_password = raw_password

        if "smtp_security" in data:
            config_obj.smtp_security = data["smtp_security"]
        if "from_email" in data:
            config_obj.from_email = data["from_email"].strip()
        if "from_name" in data:
            config_obj.from_name = data["from_name"].strip()
        if "is_enabled" in data:
            config_obj.is_enabled = data["is_enabled"]
        if "cc_addresses" in data:
            # Clean and normalize CC list, ensuring mandatory defaults remain
            raw_cc = data["cc_addresses"]
            cleaned_cc = []
            for item in raw_cc:
                c = item.strip().lower()
                if c and "@" in c and c not in cleaned_cc:
                    cleaned_cc.append(c)
            config_obj.cc_addresses = cleaned_cc
        if "frontend_base_url" in data:
            config_obj.frontend_base_url = data["frontend_base_url"].strip().rstrip("/")

        config_obj.save()

        updated_dto = get_smtp_configuration_dto()
        return Response({
            "success": True,
            "message": "SMTP configuration and alert settings saved successfully.",
            "configuration": updated_dto,
        })


class TestConnectionView(APIView, NotificationBasePermissionMixin):
    """
    POST /api/v1/notifications/smtp/test-connection/ - Verify SMTP connectivity & credentials.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        self.check_admin_view(request.user)
        serializer = TestConnectionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        custom_config = None
        data = serializer.validated_data
        if data.get("smtp_host"):
            custom_config = {
                "host": data["smtp_host"].strip(),
                "port": data.get("smtp_port", 587),
                "username": data.get("smtp_username", "").strip(),
                "security": data.get("smtp_security", "STARTTLS"),
            }
            if data.get("smtp_password") and data["smtp_password"] != "••••••••":
                custom_config["password"] = data["smtp_password"].strip()

        success, message = SMTPService.test_connection(custom_config=custom_config)
        return Response({"success": success, "message": message})


class SendTestEmailView(APIView, NotificationBasePermissionMixin):
    """
    POST /api/v1/notifications/smtp/send-test/ - Send an end-to-end verification test email.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        self.check_admin_edit(request.user)
        serializer = SendTestEmailSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        recipient_email = serializer.validated_data["recipient_email"]
        recipient_name = serializer.validated_data.get("recipient_name") or "MAPAR Administrator"

        success, message = SMTPService.send_test_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
        )

        resp_status = status.HTTP_200_OK if success else status.HTTP_400_BAD_REQUEST
        return Response({"success": success, "message": message}, status=resp_status)


class EmailDeliveryLogsView(APIView, NotificationBasePermissionMixin):
    """
    GET /api/v1/notifications/logs/ - Paginated audit trail of email alerts and scheduled reminders.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        self.check_admin_view(request.user)
        status_filter = request.query_params.get("status")
        type_filter = request.query_params.get("notification_type")
        action_id_filter = request.query_params.get("action_id")
        search_filter = request.query_params.get("search")

        queryset = get_delivery_logs_queryset(
            status=status_filter,
            notification_type=type_filter,
            action_id=action_id_filter,
            search=search_filter,
        )

        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(queryset, request)
        serializer = EmailDeliveryRecordSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class ScheduleOverviewView(APIView, NotificationBasePermissionMixin):
    """
    GET /api/v1/notifications/schedule/ - Real-time metrics on reminder schedule and pending tasks.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        self.check_admin_view(request.user)
        dto = get_schedule_overview_dto()
        return Response({"success": True, "overview": dto})


class TriggerRemindersView(APIView, NotificationBasePermissionMixin):
    """
    POST /api/v1/notifications/reminders/trigger/ - Manually execute the scheduled reminder cycle.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        self.check_admin_edit(request.user)
        serializer = TriggerRemindersSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        slot = serializer.validated_data.get("slot") or None
        force = serializer.validated_data.get("force", False)
        dry_run = serializer.validated_data.get("dry_run", False)

        result = ReminderSchedulerService.process_scheduled_reminders(
            target_slot=slot,
            force=force,
            dry_run=dry_run,
        )
        return Response({"success": True, "result": result})
