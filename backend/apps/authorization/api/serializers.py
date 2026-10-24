from rest_framework import serializers


class CreateRoleSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=True)
    code = serializers.CharField(max_length=50, required=True)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    risk_level = serializers.ChoiceField(choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"], default="MEDIUM")
    status = serializers.ChoiceField(choices=["ACTIVE", "INACTIVE"], default="ACTIVE")
    permission_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)


class UpdateRoleSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    risk_level = serializers.ChoiceField(choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"], required=False)
    status = serializers.ChoiceField(choices=["ACTIVE", "INACTIVE"], required=False)
    permission_ids = serializers.ListField(child=serializers.IntegerField(), required=False)


class AssignScopeSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=True)
    scope_type = serializers.ChoiceField(
        choices=["GLOBAL", "CORPORATE", "COMPANY", "PROJECT", "CIRCLE", "DOMAIN", "DEPARTMENT", "TEAM"],
        required=False,
        default="CIRCLE"
    )
    main_company_id = serializers.IntegerField(required=False, allow_null=True)
    sub_company_id = serializers.IntegerField(required=False, allow_null=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    circle_id = serializers.IntegerField(required=False, allow_null=True)
    domain_id = serializers.IntegerField(required=False, allow_null=True)
    department_id = serializers.IntegerField(required=False, allow_null=True)
    sub_department_id = serializers.IntegerField(required=False, allow_null=True)
    team_id = serializers.IntegerField(required=False, allow_null=True)
    can_view = serializers.BooleanField(required=False, default=True)
    can_manage = serializers.BooleanField(required=False, default=False)
    can_create = serializers.BooleanField(required=False, default=False)
    can_update = serializers.BooleanField(required=False, default=False)
    can_delete = serializers.BooleanField(required=False, default=False)
    actions = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    circle_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    domain_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)


class UpdateScopeSerializer(serializers.Serializer):
    main_company_id = serializers.IntegerField(required=False, allow_null=True)
    sub_company_id = serializers.IntegerField(required=False, allow_null=True)
    project_id = serializers.IntegerField(required=False, allow_null=True)
    circle_id = serializers.IntegerField(required=False, allow_null=True)
    domain_id = serializers.IntegerField(required=False, allow_null=True)
    department_id = serializers.IntegerField(required=False, allow_null=True)
    sub_department_id = serializers.IntegerField(required=False, allow_null=True)
    team_id = serializers.IntegerField(required=False, allow_null=True)
    can_view = serializers.BooleanField(required=False)
    can_manage = serializers.BooleanField(required=False)
    can_create = serializers.BooleanField(required=False)
    can_update = serializers.BooleanField(required=False)
    can_delete = serializers.BooleanField(required=False)
    actions = serializers.ListField(child=serializers.CharField(), required=False)
