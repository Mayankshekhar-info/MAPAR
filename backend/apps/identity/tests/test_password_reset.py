import pytest
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.models import PasswordResetToken
from apps.identity.services.password_reset_service import PasswordResetService

User = get_user_model()


@pytest.fixture
def active_user(db):
    user, _ = User.objects.get_or_create(
        username="recovery_user",
        defaults={
            "email": "recovery.test@mapar.telecrats.in",
            "role": User.Role.ACTION_OWNER,
            "status": User.Status.ACTIVE,
            "is_active": True,
        },
    )
    user.set_password("OldPassword123#")
    user.save()
    return user


@pytest.fixture
def admin_user(db):
    user, _ = User.objects.get_or_create(
        username="admin",
        defaults={
            "email": "admin@mapar.com",
            "role": User.Role.SUPER_ADMIN,
            "status": User.Status.ACTIVE,
            "is_active": True,
            "is_staff": True,
            "is_superuser": True,
        },
    )
    user.set_password("admin123")
    user.save()
    return user


@pytest.mark.django_db
def test_password_reset_request_anti_enumeration(active_user):
    """Anti-enumeration: both non-existent and valid users receive indistinguishable 200 responses."""
    client = APIClient()

    # Request for non-existent user
    res_fake = client.post(
        "/api/v1/auth/password-reset/request/",
        {"identifier": "non_existent_user_99999@test.com"},
        format="json",
    )
    assert res_fake.status_code == 200
    assert res_fake.data["success"] is True
    assert "verification code" in res_fake.data["detail"]

    # Request for real user
    res_real = client.post(
        "/api/v1/auth/password-reset/request/",
        {"identifier": active_user.email},
        format="json",
    )
    assert res_real.status_code == 200
    assert res_real.data["success"] is True
    assert "verification code" in res_real.data["detail"]

    # Verify a token record was created in the database
    token = PasswordResetToken.objects.filter(user=active_user, is_used=False).first()
    assert token is not None
    assert len(token.otp_code) == 6
    assert token.is_valid is True


@pytest.mark.django_db
def test_password_reset_request_rate_limiting(active_user):
    """Subsequent requests within 60 seconds are rate-limited."""
    client = APIClient()

    # First request
    res1 = client.post(
        "/api/v1/auth/password-reset/request/",
        {"identifier": active_user.username},
        format="json",
    )
    assert res1.status_code == 200

    # Second immediate request should return 429
    res2 = client.post(
        "/api/v1/auth/password-reset/request/",
        {"identifier": active_user.username},
        format="json",
    )
    assert res2.status_code == 429
    assert "wait" in res2.data["detail"].lower()


@pytest.mark.django_db
def test_password_reset_otp_verification_success_and_failure(active_user):
    """Validates OTP verification behavior including incorrect attempts and bounded attempts."""
    token = PasswordResetToken.create_for_user(active_user, validity_minutes=15)
    client = APIClient()

    # 1. Invalid OTP
    res_bad = client.post(
        "/api/v1/auth/password-reset/verify/",
        {"identifier": active_user.username, "otp_code": "000000"},
        format="json",
    )
    assert res_bad.status_code == 400
    assert "incorrect" in res_bad.data["detail"].lower()

    # Check attempt counter
    token.refresh_from_db()
    assert token.attempts == 1

    # 2. Correct OTP
    res_good = client.post(
        "/api/v1/auth/password-reset/verify/",
        {"identifier": active_user.username, "otp_code": token.otp_code},
        format="json",
    )
    assert res_good.status_code == 200
    assert res_good.data["success"] is True
    assert "reset_token" in res_good.data
    assert res_good.data["reset_token"] == token.reset_token

    token.refresh_from_db()
    assert token.is_verified is True


@pytest.mark.django_db
def test_password_reset_confirm_and_login_flow(active_user):
    """Verifies end-to-end confirmation with new password and subsequent login."""
    token = PasswordResetToken.create_for_user(active_user, validity_minutes=15)
    token.is_verified = True
    token.save()

    client = APIClient()

    # 1. Weak password rejected
    res_weak = client.post(
        "/api/v1/auth/password-reset/confirm/",
        {
            "reset_token": token.reset_token,
            "new_password": "weak",
            "confirm_password": "weak",
        },
        format="json",
    )
    assert res_weak.status_code == 400

    # 2. Mismatched passwords rejected
    res_mismatch = client.post(
        "/api/v1/auth/password-reset/confirm/",
        {
            "reset_token": token.reset_token,
            "new_password": "StrongPassword123#",
            "confirm_password": "DifferentPassword123#",
        },
        format="json",
    )
    assert res_mismatch.status_code == 400

    # 3. Successful password reset
    new_pwd = "NewSecurePassword2026!"
    res_success = client.post(
        "/api/v1/auth/password-reset/confirm/",
        {
            "reset_token": token.reset_token,
            "new_password": new_pwd,
            "confirm_password": new_pwd,
        },
        format="json",
    )
    assert res_success.status_code == 200
    assert res_success.data["success"] is True

    # 4. Token cannot be reused
    res_reuse = client.post(
        "/api/v1/auth/password-reset/confirm/",
        {
            "reset_token": token.reset_token,
            "new_password": "AnotherPassword2026!",
            "confirm_password": "AnotherPassword2026!",
        },
        format="json",
    )
    assert res_reuse.status_code == 400

    # 5. Old password rejected at login
    res_old_login = client.post(
        "/api/v1/auth/login/",
        {"username": active_user.username, "password": "OldPassword123#"},
        format="json",
    )
    assert res_old_login.status_code == 401

    # 6. New password successfully logs in
    res_new_login = client.post(
        "/api/v1/auth/login/",
        {"username": active_user.username, "password": new_pwd},
        format="json",
    )
    assert res_new_login.status_code == 200
    assert res_new_login.data["success"] is True
    assert res_new_login.data["user"]["username"] == active_user.username


@pytest.mark.django_db
def test_authenticated_change_password(active_user):
    """Verifies that an authenticated user can change their password with current password verification."""
    client = APIClient()
    client.force_authenticate(user=active_user)

    # 1. Incorrect current password
    res_bad = client.post(
        "/api/v1/auth/change-password/",
        {
            "current_password": "WrongCurrentPassword123#",
            "new_password": "BrandNewPassword2026!",
            "confirm_password": "BrandNewPassword2026!",
        },
        format="json",
    )
    assert res_bad.status_code == 400
    assert "current password is incorrect" in res_bad.data["detail"].lower()

    # 2. Correct current password, success
    res_ok = client.post(
        "/api/v1/auth/change-password/",
        {
            "current_password": "OldPassword123#",
            "new_password": "BrandNewPassword2026!",
            "confirm_password": "BrandNewPassword2026!",
        },
        format="json",
    )
    assert res_ok.status_code == 200
    assert res_ok.data["success"] is True

    # Verify user record password was updated
    active_user.refresh_from_db()
    assert active_user.check_password("BrandNewPassword2026!") is True
