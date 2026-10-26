from rest_framework import serializers
from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord


class SMTPConfigurationSerializer(serializers.Serializer):
    smtp_host = serializers.CharField(allow_blank=True)
    smtp_port = serializers.IntegerField(min_value=1, max_value=65535)
    smtp_username = serializers.CharField(allow_blank=True)
    has_password = serializers.BooleanField(read_only=True)
    masked_password = serializers.CharField(read_only=True)
    smtp_security = serializers.ChoiceField(choices=EmailConfiguration.SecurityType.choices)
    from_email = serializers.EmailField()
    from_name = serializers.CharField(max_length=150)
    is_enabled = serializers.BooleanField()
    cc_addresses = serializers.ListField(child=serializers.EmailField(), allow_empty=True)
    frontend_base_url = serializers.CharField(max_length=255)
    updated_at = serializers.DateTimeField(read_only=True, allow_null=True)


class UpdateSMTPConfigurationSerializer(serializers.Serializer):
    smtp_host = serializers.CharField(required=False, allow_blank=True)
    smtp_port = serializers.IntegerField(required=False, min_value=1, max_value=65535)
    smtp_username = serializers.CharField(required=False, allow_blank=True)
    smtp_password = serializers.CharField(required=False, allow_blank=True, write_only=True)
    smtp_security = serializers.ChoiceField(required=False, choices=EmailConfiguration.SecurityType.choices)
    from_email = serializers.EmailField(required=False)
    from_name = serializers.CharField(required=False, max_length=150)
    is_enabled = serializers.BooleanField(required=False)
    cc_addresses = serializers.ListField(child=serializers.EmailField(), required=False, allow_empty=True)
    frontend_base_url = serializers.CharField(required=False, max_length=255)


class TestConnectionSerializer(serializers.Serializer):
    smtp_host = serializers.CharField(required=False, allow_blank=True)
    smtp_port = serializers.IntegerField(required=False, min_value=1, max_value=65535)
    smtp_username = serializers.CharField(required=False, allow_blank=True)
    smtp_password = serializers.CharField(required=False, allow_blank=True, write_only=True)
    smtp_security = serializers.ChoiceField(required=False, choices=EmailConfiguration.SecurityType.choices)


class SendTestEmailSerializer(serializers.Serializer):
    recipient_email = serializers.EmailField(required=True)
    recipient_name = serializers.CharField(required=False, default="MAPAR Administrator", max_length=150)


class EmailDeliveryRecordSerializer(serializers.ModelSerializer):
    triggered_by_username = serializers.SerializerMethodField()

    class Meta:
        model = EmailDeliveryRecord
        fields = [
            "id",
            "idempotency_key",
            "notification_type",
            "action_id",
            "recipient_email",
            "recipient_name",
            "cc_emails",
            "subject",
            "body_summary",
            "status",
            "attempts",
            "max_attempts",
            "last_attempt_at",
            "sent_at",
            "error_message",
            "scheduled_slot",
            "triggered_by",
            "triggered_by_username",
            "created_at",
        ]

    def get_triggered_by_username(self, obj):
        if obj.triggered_by:
            return obj.triggered_by.username
        return ""


class TriggerRemindersSerializer(serializers.Serializer):
    slot = serializers.CharField(required=False, allow_blank=True, default="")
    force = serializers.BooleanField(required=False, default=False)
    dry_run = serializers.BooleanField(required=False, default=False)
