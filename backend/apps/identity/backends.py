from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q


class EmailOrUsernameModelBackend(ModelBackend):
    """
    Native MAPAR Enterprise Authentication Backend.
    Supports authentication via:
    1. Username (case-insensitive)
    2. Corporate Email address (case-insensitive)
    3. Employee ID (case-insensitive, if present)

    Validates password securely against stored hash.
    Returns user instance upon successful password check so that the API layer
    can inspect account status (ACTIVE vs INVITED, INACTIVE, LOCKED, SUSPENDED)
    and return appropriate HTTP 403 status and message rather than false 401.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        if username is None:
            username = kwargs.get(UserModel.USERNAME_FIELD)

        if not username or password is None:
            return None

        identifier = str(username).strip()
        if not identifier:
            return None

        # Case-insensitive lookup matching username, email, or employee_id
        user = UserModel.objects.filter(
            Q(username__iexact=identifier) |
            Q(email__iexact=identifier) |
            Q(employee_id__iexact=identifier)
        ).order_by("id").first()

        if user is None:
            # Mitigate timing attacks by computing password hash on dummy user
            UserModel().set_password(password)
            return None

        # Verify password securely
        if not user.check_password(password):
            if hasattr(user, "failed_login_attempts"):
                user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
                user.save(update_fields=["failed_login_attempts"])
            return None

        return user

    def user_can_authenticate(self, user):
        """
        Allow user model through password verification so LoginView can inspect
        account status and return informative 403 responses instead of 401.
        """
        return True

    def get_user(self, user_id):
        UserModel = get_user_model()
        try:
            user = UserModel._default_manager.get(pk=user_id)
        except UserModel.DoesNotExist:
            return None
        return user if getattr(user, "is_active", True) else None
