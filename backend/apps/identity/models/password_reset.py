import os
import secrets
from datetime import timedelta
from django.conf import settings
from django.db import models
from django.utils import timezone


class PasswordResetToken(models.Model):
    """
    Secure, single-use, time-limited OTP and reset token for account password recovery.
    Prevents brute-force via bounded attempt limits, automatic expiration, and single-use invalidation.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_resets",
    )
    otp_code = models.CharField(max_length=6, db_index=True)
    reset_token = models.CharField(max_length=64, unique=True, db_index=True)
    is_verified = models.BooleanField(default=False)
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "accounts_password_reset"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_used", "expires_at"]),
        ]

    def __str__(self):
        return f"ResetToken(user={self.user.username}, verified={self.is_verified}, used={self.is_used})"

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @property
    def is_valid(self) -> bool:
        return not self.is_used and not self.is_expired and self.attempts < self.max_attempts

    @classmethod
    def generate_otp(cls) -> str:
        """Generates a cryptographically secure 6-digit numeric OTP."""
        return f"{secrets.randbelow(900000) + 100000}"

    @classmethod
    def generate_token(cls) -> str:
        """Generates a high-entropy URL-safe hex reset token."""
        return secrets.token_hex(32)

    @classmethod
    def create_for_user(cls, user, ip_address: str | None = None, validity_minutes: int = 15):
        """
        Invalidates any pending unused tokens for this user and issues a fresh one.
        """
        # Invalidate previous unverified tokens for this user
        cls.objects.filter(user=user, is_used=False).update(is_used=True)

        now = timezone.now()
        token = cls.objects.create(
            user=user,
            otp_code=cls.generate_otp(),
            reset_token=cls.generate_token(),
            expires_at=now + timedelta(minutes=validity_minutes),
            ip_address=ip_address,
        )
        return token
