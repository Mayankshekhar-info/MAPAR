from rest_framework import serializers


class FilterOptionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    code = serializers.CharField(required=False)


class MasterSummaryRowSerializer(serializers.Serializer):
    id = serializers.CharField()
    circle_id = serializers.IntegerField(allow_null=True)
    circle_name = serializers.CharField()
    circle_code = serializers.CharField()
    circle_region = serializers.CharField()
    domain_id = serializers.IntegerField(allow_null=True)
    domain_name = serializers.CharField()
    domain_code = serializers.CharField()
    kpi_count = serializers.IntegerField()
    target = serializers.FloatField()
    actual = serializers.FloatField()
    achievement_pct = serializers.FloatField()
    green_count = serializers.IntegerField()
    amber_count = serializers.IntegerField()
    red_count = serializers.IntegerField()
    status = serializers.CharField()
    is_subtotal = serializers.BooleanField()
    is_grand_total = serializers.BooleanField()
