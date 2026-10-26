from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class LoginRequestSerializer(serializers.Serializer):
    username = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    password = serializers.CharField(required=True, write_only=True, style={"input_type": "password"})
    remember_me = serializers.BooleanField(required=False, default=False)


class PasswordResetRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
        help_text="Registered username, email address, or employee ID",
    )


class PasswordResetVerifySerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    otp_code = serializers.CharField(required=True, min_length=6, max_length=6, trim_whitespace=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    reset_token = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs


class UserSummarySerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    role_name = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    accessible_modules = serializers.SerializerMethodField()
    effective_circles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "name",
            "role",
            "role_name",
            "status",
            "circle_id",
            "is_staff",
            "is_superuser",
            "permissions",
            "accessible_modules",
            "effective_circles",
        ]
        read_only_fields = fields

    def get_name(self, obj) -> str:
        full_name = obj.get_full_name()
        return full_name if full_name else obj.username

    def get_role(self, obj) -> str:
        primary_ur = obj.user_roles.filter(is_primary=True).first() if hasattr(obj, "user_roles") else None
        if primary_ur and hasattr(primary_ur, "role"):
            return primary_ur.role.code
        return getattr(obj, "role", "VIEWER")

    def get_role_name(self, obj) -> str:
        primary_ur = obj.user_roles.filter(is_primary=True).first() if hasattr(obj, "user_roles") else None
        if primary_ur and hasattr(primary_ur, "role"):
            return primary_ur.role.name
        role_val = getattr(obj, "role", "VIEWER")
        return role_val.replace("_", " ").title()

    def get_permissions(self, obj) -> list:
        from common.permissions.authorization import AuthorizationService
        return AuthorizationService.get_user_effective_permissions(obj)

    def get_accessible_modules(self, obj) -> list:
        from common.permissions.authorization import AuthorizationService
        return AuthorizationService.get_user_accessible_modules(obj)

    def get_effective_circles(self, obj):
        from common.permissions.authorization import AuthorizationService
        return AuthorizationService.get_user_circle_ids(obj)
