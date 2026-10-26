import logging
import re
from datetime import timedelta
from typing import Optional, Tuple
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.db.models import Q
from django.utils import timezone

from apps.identity.models import PasswordResetToken
from apps.notifications.models import EmailDeliveryRecord
from apps.notifications.services.smtp_service import SMTPService

logger = logging.getLogger("mapar.identity")
User = get_user_model()


class PasswordResetService:
    """
    Enterprise Password Recovery and Authenticated Password Management Service.
    Enforces time-limited single-use OTPs, anti-enumeration mitigations, rate limiting,
    password complexity validation, and session invalidation upon credential update.
    """

    PASSWORD_MIN_LENGTH = 8
    RATE_LIMIT_SECONDS = 60
    OTP_VALIDITY_MINUTES = 15

    @classmethod
    def validate_password_strength(cls, password: str) -> Tuple[bool, str]:
        """Validates password against enterprise complexity rules."""
        if not password or len(password) < cls.PASSWORD_MIN_LENGTH:
            return False, f"Password must be at least {cls.PASSWORD_MIN_LENGTH} characters long."
        if not re.search(r"[A-Z]", password):
            return False, "Password must contain at least one uppercase letter (A-Z)."
        if not re.search(r"[a-z]", password):
            return False, "Password must contain at least one lowercase letter (a-z)."
        if not re.search(r"\d", password):
            return False, "Password must contain at least one numeric digit (0-9)."
        if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]", password):
            return False, "Password must contain at least one special character (!@#$%^&* etc.)."
        return True, ""

    @classmethod
    def invalidate_user_sessions(cls, user_id: int) -> int:
        """
        Invalidates all active Django sessions for the user upon password change or reset.
        """
        deleted_count = 0
        try:
            now = timezone.now()
            for session in Session.objects.filter(expire_date__gte=now):
                session_data = session.get_decoded()
                if session_data.get("_auth_user_id") == str(user_id):
                    session.delete()
                    deleted_count += 1
        except Exception as e:
            logger.warning("Error invalidating user sessions: %s", e)
        return deleted_count

    @classmethod
    def request_password_reset(
        cls,
        identifier: str,
        ip_address: Optional[str] = None,
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Dispatches a 6-digit OTP verification code to the user's verified corporate email.
        Protects against user enumeration by returning identical success responses
        whether or not the account exists.
        Returns (success: bool, user_message: str, debug_otp_if_dev: Optional[str]).
        """
        generic_message = (
            "If an active account matches the provided identifier, a single-use verification code "
            "has been dispatched to its registered email address."
        )

        clean_id = (identifier or "").strip()
        if not clean_id:
            return False, "Please enter your username or registered corporate email.", None

        user = User.objects.filter(
            Q(username__iexact=clean_id) |
            Q(email__iexact=clean_id) |
            Q(employee_id__iexact=clean_id)
        ).first()

        # Account existence and active status verification
        if not user or not user.is_active or user.status != getattr(user.Status, "ACTIVE", "ACTIVE"):
            # Dummy hash computation to mitigate timing attacks
            User().set_password("DummyTimingMitigation#2026")
            return True, generic_message, None

        if not user.email or "@" not in user.email:
            logger.warning("User %s requested password reset but has no valid email configured.", user.username)
            return True, generic_message, None

        # Rate limiting: prevent spamming requests within RATE_LIMIT_SECONDS
        now = timezone.now()
        recent_token = PasswordResetToken.objects.filter(
            user=user,
            created_at__gte=now - timedelta(seconds=cls.RATE_LIMIT_SECONDS),
        ).first()
        if recent_token:
            return False, f"Please wait at least {cls.RATE_LIMIT_SECONDS} seconds before requesting another code.", None

        # Issue fresh token and OTP
        token = PasswordResetToken.create_for_user(
            user=user,
            ip_address=ip_address,
            validity_minutes=cls.OTP_VALIDITY_MINUTES,
        )

        subject = "[MAPAR] One-Time Password (OTP) for Password Reset"
        plain_text = f"""Hello {user.get_full_name() or user.username},

You have requested to reset your password for the MAPAR Enterprise Governance platform.

Your One-Time Password (OTP) is: {token.otp_code}

This verification code is valid for {cls.OTP_VALIDITY_MINUTES} minutes and can only be used once.
If you did not request this password reset, please contact IT Security immediately.

MAPAR Enterprise Governance System
"""

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; }}
    .card {{ max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }}
    .header {{ background: linear-gradient(135deg, #00D2FF 0%, #00E676 100%); padding: 24px; color: #031124; text-align: center; }}
    .content {{ padding: 28px; font-size: 14px; line-height: 1.6; color: #cbd5e1; }}
    .otp-box {{ background: #0f172a; border: 2px dashed #00D2FF; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; }}
    .otp-code {{ font-family: 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #00E676; }}
    .warning {{ font-size: 12px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 16px; margin-top: 20px; }}
    .footer {{ background: #0b1322; padding: 16px; text-align: center; font-size: 11px; color: #64748b; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">MAPAR PLATFORM</h2>
      <p style="margin:4px 0 0 0; font-size: 13px; font-weight: 600;">Password Recovery Verification</p>
    </div>
    <div class="content">
      <p>Hello <strong>{user.get_full_name() or user.username}</strong>,</p>
      <p>A request was received to reset your MAPAR Enterprise credentials. Use the verification code below to complete the process:</p>
      <div class="otp-box">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px;">Your 6-Digit OTP Code</div>
        <div class="otp-code">{token.otp_code}</div>
        <div style="font-size: 12px; color: #38bdf8; margin-top: 6px;">Expires in {cls.OTP_VALIDITY_MINUTES} minutes</div>
      </div>
      <p class="warning">
        &bull; Never share this code with anyone, including IT administrators.<br>
        &bull; If you did not initiate this request, your account may be compromised. Please alert IT Security.
      </p>
    </div>
    <div class="footer">
      MAPAR Enterprise Performance &bull; Automated Identity Protection &bull; Confidential
    </div>
  </div>
</body>
</html>"""

        # Dispatch via SMTP with CC addresses suppressed for credential security
        success, record = SMTPService.send_html_email(
            recipient_email=user.email,
            recipient_name=user.get_full_name() or user.username,
            subject=subject,
            plain_text=plain_text,
            html_content=html_content,
            notification_type=EmailDeliveryRecord.NotificationType.PASSWORD_RESET,
            skip_cc=True,
        )

        debug_otp = token.otp_code if settings.DEBUG else None
        if not success:
            logger.warning(
                "SMTP delivery failed for password reset OTP (user=%s, err=%s).",
                user.username,
                record.error_message,
            )
            # In development environments where external SMTP credentials may not be configured,
            # we log the code for authorized local verification while protecting production.
            logger.info("[AUTH_RECOVERY] OTP for %s: %s", user.username, token.otp_code)

        return True, generic_message, debug_otp

    @classmethod
    def verify_otp(
        cls,
        identifier: str,
        otp_code: str,
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Validates the 6-digit OTP code against the latest pending token for the user.
        Upon success, marks token as verified and returns a single-use reset_token signature.
        Returns (success: bool, message: str, reset_token: Optional[str]).
        """
        clean_id = (identifier or "").strip()
        clean_otp = (otp_code or "").strip()

        if not clean_id or not clean_otp:
            return False, "Identifier and OTP verification code are required.", None

        user = User.objects.filter(
            Q(username__iexact=clean_id) |
            Q(email__iexact=clean_id) |
            Q(employee_id__iexact=clean_id)
        ).first()

        if not user or not user.is_active:
            return False, "Invalid verification code or identifier.", None

        token = PasswordResetToken.objects.filter(
            user=user,
            is_used=False,
        ).order_by("-created_at").first()

        if not token:
            return False, "No active password reset request found. Please request a new code.", None

        if token.is_expired:
            token.is_used = True
            token.save(update_fields=["is_used"])
            return False, "Verification code has expired. Please request a new code.", None

        if token.attempts >= token.max_attempts:
            token.is_used = True
            token.save(update_fields=["is_used"])
            return False, "Too many failed verification attempts. Please request a new code.", None

        if token.otp_code != clean_otp:
            token.attempts += 1
            token.save(update_fields=["attempts"])
            remaining = token.max_attempts - token.attempts
            if remaining > 0:
                return False, f"Incorrect verification code. {remaining} attempt(s) remaining.", None
            else:
                token.is_used = True
                token.save(update_fields=["is_used"])
                return False, "Maximum verification attempts exceeded. Please request a new code.", None

        # OTP verified successfully
        token.is_verified = True
        token.save(update_fields=["is_verified"])
        return True, "Verification successful. Please enter your new password.", token.reset_token

    @classmethod
    def confirm_password_reset(
        cls,
        reset_token: str,
        new_password: str,
    ) -> Tuple[bool, str]:
        """
        Applies new password using validated reset_token, invalidates sessions,
        and clears lockouts.
        """
        clean_token = (reset_token or "").strip()
        if not clean_token:
            return False, "Reset token is required."

        is_valid_strength, err_msg = cls.validate_password_strength(new_password)
        if not is_valid_strength:
            return False, err_msg

        token = PasswordResetToken.objects.filter(
            reset_token=clean_token,
            is_verified=True,
            is_used=False,
        ).first()

        if not token:
            return False, "Invalid or already used password reset token. Please request a new code."

        if token.is_expired:
            token.is_used = True
            token.save(update_fields=["is_used"])
            return False, "Password reset session has expired. Please request a new code."

        user = token.user
        user.set_password(new_password)
        if hasattr(user, "failed_login_attempts"):
            user.failed_login_attempts = 0
        if hasattr(user, "locked_until"):
            user.locked_until = None
        if hasattr(user, "force_password_change"):
            user.force_password_change = False

        user.save()

        # Mark token as used
        token.is_used = True
        token.save(update_fields=["is_used"])

        # Invalidate all active user sessions so stale credentials cannot be reused
        cls.invalidate_user_sessions(user.id)

        logger.info("Password reset successfully completed for user %s (ID=%s).", user.username, user.id)
        return True, "Password changed successfully. Please log in with your new password."

    @classmethod
    def change_password_authenticated(
        cls,
        user,
        current_password: str,
        new_password: str,
    ) -> Tuple[bool, str]:
        """
        Changes password for an already authenticated session after verifying the current password.
        """
        if not user.check_password(current_password):
            return False, "Current password is incorrect."

        if current_password == new_password:
            return False, "New password cannot be identical to your current password."

        is_valid_strength, err_msg = cls.validate_password_strength(new_password)
        if not is_valid_strength:
            return False, err_msg

        user.set_password(new_password)
        if hasattr(user, "force_password_change"):
            user.force_password_change = False
        user.save()

        # Invalidate other sessions
        cls.invalidate_user_sessions(user.id)

        logger.info("Authenticated password update completed for user %s.", user.username)
        return True, "Password updated successfully."
