import os
from django.db import models
from django.conf import settings
from apps.identity.models import User
from apps.governance.models import GovernanceActionPoint


class EmailConfiguration(models.Model):
    """
    Singleton configuration for enterprise SMTP server and automated alerts.
    Credentials can be configured via this model or overridden via environment variables.
    Passphrase/password is stored securely and never returned in API responses.
    """

    class SecurityType(models.TextChoices):
        STARTTLS = "STARTTLS", "STARTTLS (Recommended, Port 587)"
        SSL = "SSL", "SSL/TLS (Port 465)"
        NONE = "NONE", "None / Plaintext (Port 25/Internal)"

    DEFAULT_CC_ADDRESSES = [
        "abhay@pratap.co.in",
        "shakti.singh@pratap.co.in",
    ]

    singleton_id = models.IntegerField(default=1, unique=True, editable=False)
    smtp_host = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="SMTP server host / IP (e.g. smtp.office365.com, smtp.gmail.com)",
    )
    smtp_port = models.PositiveIntegerField(
        default=587,
        help_text="SMTP server port (e.g. 587 for STARTTLS, 465 for SSL, 25 for plain)",
    )
    smtp_username = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="SMTP authentication username / email account",
    )
    smtp_password = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="SMTP password or app-specific password (write-only, never sent to UI)",
    )
    smtp_security = models.CharField(
        max_length=20,
        choices=SecurityType.choices,
        default=SecurityType.STARTTLS,
        help_text="Connection encryption protocol",
    )
    from_email = models.EmailField(
        default="notifications@mapar.co.in",
        help_text="Sender email address displayed in outgoing emails",
    )
    from_name = models.CharField(
        max_length=150,
        default="MAPAR Governance System",
        help_text="Display name for the sender",
    )
    is_enabled = models.BooleanField(
        default=True,
        help_text="Master toggle to enable or disable automated email notifications",
    )
    cc_addresses = models.JSONField(
        default=list,
        blank=True,
        help_text="Centrally configured mandatory CC addresses for all task alerts and reminders",
    )
    frontend_base_url = models.CharField(
        max_length=255,
        default="http://localhost:5185",
        help_text="Base URL for constructing secure direct links to tasks in MAPAR",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "notifications"
        db_table = "notifications_email_configuration"
        verbose_name = "Email & SMTP Configuration"
        verbose_name_plural = "Email & SMTP Configuration"

    def __str__(self):
        return f"SMTP Config: {self.smtp_host or '(Not configured)'}:{self.smtp_port} [Enabled: {self.is_enabled}]"

    @classmethod
    def get_solo(cls) -> "EmailConfiguration":
        """Returns or creates the single active SMTP configuration instance."""
        config, _ = cls.objects.get_or_create(singleton_id=1)
        return config

    def get_effective_cc_list(self) -> list[str]:
        """Returns the mandatory CC addresses, ensuring defaults are present."""
        configured = self.cc_addresses if isinstance(self.cc_addresses, list) else []
        # Ensure central default addresses are always included unless explicitly empty
        merged = []
        for email in configured + self.DEFAULT_CC_ADDRESSES:
            cleaned = email.strip().lower()
            if cleaned and "@" in cleaned and cleaned not in merged:
                merged.append(cleaned)
        return merged or self.DEFAULT_CC_ADDRESSES

    def get_effective_settings(self) -> dict:
        """
        Resolves effective settings by merging DB config with environment variables.
        Environment variables act as fallbacks if DB fields are empty.
        """
        host = self.smtp_host or os.environ.get("SMTP_HOST", "")
        port = self.smtp_port or int(os.environ.get("SMTP_PORT", 587))
        username = self.smtp_username or os.environ.get("SMTP_USER", os.environ.get("SMTP_USERNAME", ""))
        password = self.smtp_password or os.environ.get("SMTP_PASSWORD", "")
        
        if self.smtp_host:
            security = self.smtp_security
        elif os.environ.get("SMTP_USE_SSL", "").lower() in ("true", "1", "yes"):
            security = "SSL"
        elif os.environ.get("SMTP_USE_TLS", "").lower() in ("true", "1", "yes"):
            security = "STARTTLS"
        else:
            security = os.environ.get("SMTP_SECURITY", "STARTTLS")

        if self.smtp_host:
            from_email = self.from_email
            from_name = self.from_name
        else:
            from_email = os.environ.get("SMTP_FROM_EMAIL") or self.from_email or "notifications@mapar.co.in"
            from_name = os.environ.get("SMTP_FROM_NAME") or self.from_name or "PGMS Governance System"
        is_enabled = self.is_enabled if self.smtp_host else os.environ.get("SMTP_ENABLED", "True").lower() in ("true", "1", "yes")
        frontend_url = self.frontend_base_url or os.environ.get("FRONTEND_BASE_URL", "http://localhost:5185")
        timeout = int(os.environ.get("SMTP_TIMEOUT", 15))

        env_shakti_cc = os.environ.get(
            "CC_SHAKTI_SINGH_ENABLED",
            os.environ.get("SMTP_CC_SHAKTI_SINGH_ENABLED", "True"),
        ).strip().lower()
        cc_shakti_singh_enabled = env_shakti_cc not in ("false", "0", "no", "disabled", "off")

        return {
            "host": host.strip(),
            "port": port,
            "username": username.strip(),
            "password": password.strip(),
            "security": security.upper(),
            "from_email": from_email.strip(),
            "from_name": from_name.strip(),
            "is_enabled": is_enabled,
            "frontend_base_url": frontend_url.rstrip("/"),
            "cc_addresses": self.get_effective_cc_list(),
            "has_password": bool(password.strip()),
            "timeout": timeout,
            "cc_shakti_singh_enabled": cc_shakti_singh_enabled,
        }


class EmailDeliveryRecord(models.Model):
    """
    Immutable audit log and delivery tracker for all automated emails and scheduled reminders.
    Enforces idempotency to guarantee no duplicate reminders or assignment alerts are sent.
    Tracks scheduled time, attempts, bounded retries, errors, and delivery timestamps.
    """

    class NotificationType(models.TextChoices):
        TASK_ASSIGNMENT = "TASK_ASSIGNMENT", "Immediate Task Assignment Alert"
        TASK_REASSIGNMENT = "TASK_REASSIGNMENT", "Task Reassignment Alert"
        TASK_REMINDER = "TASK_REMINDER", "Scheduled Weekly Reminder"
        TASK_URGENT_FOLLOWUP = "TASK_URGENT_FOLLOWUP", "Urgent Follow-Up Task Alert"
        STATUS_MATRIX_DIGEST = "STATUS_MATRIX_DIGEST", "Action Status Matrix Consolidated Alert"
        TEST_EMAIL = "TEST_EMAIL", "Admin Connection Test Email"
        PASSWORD_RESET = "PASSWORD_RESET", "Password Reset OTP Verification"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending Dispatch"
        SENT = "SENT", "Successfully Delivered to SMTP Server"
        FAILED = "FAILED", "Failed Permanently"
        RETRYING = "RETRYING", "Temporary Failure (Retrying)"

    idempotency_key = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="Unique key ensuring at-most-once delivery per task, owner, and reminder slot",
    )
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        db_index=True,
    )
    action_point = models.ForeignKey(
        GovernanceActionPoint,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="email_deliveries",
        help_text="Related governance/audit action point",
    )
    action_id = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
        help_text="Canonical Action ID (e.g. ACT-00101) preserved even if action point is purged",
    )
    recipient_email = models.EmailField(
        db_index=True,
        help_text="Verified recipient email from registered user account",
    )
    recipient_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
        help_text="Full display name of the recipient",
    )
    cc_emails = models.JSONField(
        default=list,
        help_text="List of CC email addresses included on this dispatch",
    )
    subject = models.CharField(
        max_length=500,
        help_text="Email subject line",
    )
    body_summary = models.TextField(
        blank=True,
        default="",
        help_text="Summary of email payload (no credentials or sensitive attachments)",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    attempts = models.PositiveIntegerField(
        default=0,
        help_text="Number of SMTP dispatch attempts",
    )
    max_attempts = models.PositiveIntegerField(
        default=3,
        help_text="Maximum retry limit before marking as FAILED",
    )
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Exact timestamp when SMTP server accepted the message",
    )
    error_message = models.TextField(
        blank=True,
        default="",
        help_text="Sanitized error details if dispatch encountered an exception",
    )
    scheduled_slot = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        help_text="Slot identifier for recurring reminders (e.g. 2026-W42:Friday:10:00)",
    )
    triggered_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="triggered_email_deliveries",
        help_text="User who initiated this email dispatch",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "notifications"
        db_table = "notifications_email_delivery_record"
        ordering = ["-created_at"]
        verbose_name = "Email Delivery Record"
        verbose_name_plural = "Email Delivery Records"

    def __str__(self):
        return f"[{self.status}] {self.notification_type} -> {self.recipient_email} ({self.action_id})"
