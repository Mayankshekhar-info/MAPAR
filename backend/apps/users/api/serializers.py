from rest_framework import serializers


class CreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(max_length=128, required=True, write_only=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    role = serializers.CharField(max_length=50, required=False, default="VIEWER")
    role_id = serializers.IntegerField(required=False, allow_null=True)
    circle_id = serializers.IntegerField(required=False, allow_null=True)
    sub_department_id = serializers.IntegerField(required=False, allow_null=True)
    team_id = serializers.IntegerField(required=False, allow_null=True)
    department = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    designation = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    employee_id = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True, default=None)
    status = serializers.ChoiceField(choices=["ACTIVE", "INACTIVE", "INVITED"], default="ACTIVE")
    scopes = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class UpdateUserSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False)
    role = serializers.CharField(max_length=50, required=False)
    role_id = serializers.IntegerField(required=False, allow_null=True)
    circle_id = serializers.IntegerField(required=False, allow_null=True)
    sub_department_id = serializers.IntegerField(required=False, allow_null=True)
    team_id = serializers.IntegerField(required=False, allow_null=True)
    department = serializers.CharField(max_length=100, required=False, allow_blank=True)
    designation = serializers.CharField(max_length=100, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    employee_id = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)
    status = serializers.ChoiceField(choices=["ACTIVE", "INACTIVE", "LOCKED", "SUSPENDED"], required=False)
    password = serializers.CharField(max_length=128, required=False, allow_blank=True, write_only=True)
    scopes = serializers.ListField(child=serializers.DictField(), required=False)

