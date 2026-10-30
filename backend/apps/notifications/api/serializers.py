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


class UpdateWeeklyScheduleSerializer(serializers.Serializer):
    VALID_DAYS = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ]

    schedule = serializers.DictField(
        child=serializers.ListField(
            child=serializers.CharField(),
            allow_empty=True,
        ),
        required=True,
    )

    def validate_schedule(self, value):
        import re
        time_pattern = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
        validated = {}

        for day, times in value.items():
            normalized_day = day.strip().capitalize()
            # Match against case-insensitive valid day names
            matched_day = None
            for vd in self.VALID_DAYS:
                if vd.lower() == normalized_day.lower():
                    matched_day = vd
                    break

            if not matched_day:
                raise serializers.ValidationError(f"Invalid day: '{day}'. Must be one of {self.VALID_DAYS}.")

            cleaned_times = []
            for t in times:
                t_str = str(t).strip()
                # Accept HH:MM
                if not time_pattern.match(t_str):
                    raise serializers.ValidationError(
                        f"Invalid time format for {matched_day}: '{t_str}'. Expected HH:MM in 24-hour format."
                    )
                if t_str in cleaned_times:
                    raise serializers.ValidationError(
                        f"Duplicate time slot '{t_str}' specified for {matched_day}."
                    )
                cleaned_times.append(t_str)

            cleaned_times.sort()
            validated[matched_day] = cleaned_times

        return validated
