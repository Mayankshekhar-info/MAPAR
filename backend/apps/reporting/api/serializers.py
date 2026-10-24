from rest_framework import serializers
from apps.dashboard.models import ReportingPeriod


class ReportingPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportingPeriod
        fields = [
            "id",
            "name",
            "period_type",
            "start_date",
            "end_date",
            "is_frozen",
            "is_current",
            "created_at",
        ]


class PeriodResolveRequestSerializer(serializers.Serializer):
    period_id = serializers.IntegerField(required=False, allow_null=True)
    period_type = serializers.CharField(required=False, default="CUSTOM")
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    period_name = serializers.CharField(required=False, allow_blank=True)
