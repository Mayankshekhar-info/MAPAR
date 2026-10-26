import logging
import os
import smtplib
import socket
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, make_msgid, formatdate
from typing import Dict, List, Optional, Tuple, Any

from django.utils import timezone
from django.db import transaction

from apps.notifications.models import EmailConfiguration, EmailDeliveryRecord

logger = logging.getLogger("mapar.notifications")


class SMTPService:
    """
    Centralized, secure SMTP client service for MAPAR-v2.
    Handles socket testing, credential resolution, email assembly, bounded retries,
    and audit logging to EmailDeliveryRecord without ever exposing sensitive secrets.
    """

    TARGET_CC_SHAKTI_SINGH = "shakti.singh@pratap.co.in"

    @classmethod
    def is_shakti_singh_cc_enabled(cls, config: Optional[Dict[str, Any]] = None) -> bool:
        """
        Determines whether CC dispatch to shakti.singh@pratap.co.in is enabled.
        Configurable via:
          1. config dict override: config.get("cc_shakti_singh_enabled")
          2. Environment variable: CC_SHAKTI_SINGH_ENABLED / SMTP_CC_SHAKTI_SINGH_ENABLED
        Defaults to True (Enabled) to preserve current production behavior.
        """
        if config and "cc_shakti_singh_enabled" in config:
            val = config["cc_shakti_singh_enabled"]
            if isinstance(val, bool):
                return val
            if isinstance(val, str):
                return val.strip().lower() not in ("false", "0", "no", "disabled", "off")

        env_val = os.environ.get(
            "CC_SHAKTI_SINGH_ENABLED",
            os.environ.get("SMTP_CC_SHAKTI_SINGH_ENABLED", "True"),
        ).strip().lower()
        return env_val not in ("false", "0", "no", "disabled", "off")

    @classmethod
    def get_effective_config(cls, custom_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Returns the active configuration dictionary from DB/env or custom override."""
        if custom_config:
            base = EmailConfiguration.get_solo().get_effective_settings()
            base.update({k: v for k, v in custom_config.items() if v is not None})
            return base
        return EmailConfiguration.get_solo().get_effective_settings()

    @classmethod
    def test_connection(cls, custom_config: Optional[Dict[str, Any]] = None) -> Tuple[bool, str]:
        """
        Validates SMTP server connectivity, handshake, encryption, and authentication.
        Safe for admin verification before saving or enabling email notifications.
        """
        config = cls.get_effective_config(custom_config)
        host = config.get("host")
        port = config.get("port") or 587
        username = config.get("username")
        password = config.get("password")
        security = config.get("security", "STARTTLS")

        if not host:
            return False, "SMTP Host is required to test connection."

        try:
            logger.info("Testing SMTP connection to %s:%s with %s", host, port, security)
            timeout = 12

            if security == "SSL":
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(host=host, port=port, timeout=timeout, context=context)
            else:
                server = smtplib.SMTP(host=host, port=port, timeout=timeout)

            with server:
                server.ehlo()
                if security == "STARTTLS":
                    if not server.has_extn("STARTTLS"):
                        return False, f"Server at {host}:{port} does not support STARTTLS. Please select SSL or None."
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                    server.ehlo()

                if username:
                    if not password:
                        return False, f"Username '{username}' provided without a password."
                    server.login(username, password)

            return True, f"Successfully connected to SMTP server {host}:{port} and verified credentials."

        except socket.timeout:
            return False, f"Connection timed out while connecting to {host}:{port}."
        except socket.gaierror as e:
            return False, f"Could not resolve SMTP server address '{host}': {e}"
        except ConnectionRefusedError:
            return False, f"Connection refused by {host}:{port}. Please check port and firewall settings."
        except smtplib.SMTPAuthenticationError as e:
            # Avoid logging the password
            return False, f"SMTP Authentication failed for user '{username}'. Please verify credentials or app password."
        except Exception as e:
            return False, f"SMTP Connection error: {str(e)}"

    @classmethod
    def send_test_email(
        cls,
        recipient_email: str,
        custom_config: Optional[Dict[str, Any]] = None,
        recipient_name: str = "MAPAR Administrator",
    ) -> Tuple[bool, str]:
        """Dispatches an immediate verified test email to validate end-to-end delivery."""
        if not recipient_email or "@" not in recipient_email:
            return False, "A valid recipient email address is required for sending a test email."

        config = cls.get_effective_config(custom_config)
        subject = "[MAPAR] SMTP Configuration Test Email"
        timestamp_str = timezone.localtime(timezone.now()).strftime("%Y-%m-%d %H:%M:%S IST")

        plain_text = f"""Hello {recipient_name},

This is an automated test message from the MAPAR Governance System.
Your SMTP server configuration has been successfully verified!

Server Host: {config.get('host')}
Server Port: {config.get('port')}
Encryption: {config.get('security')}
Sender: {config.get('from_name')} <{config.get('from_email')}>
Time Sent: {timestamp_str}

If you received this message, MAPAR automatic task assignment alerts and recurring scheduled reminders are ready to operate.
"""

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; color: #1e293b; padding: 20px; }}
    .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ background: #1e3a8a; padding: 24px; color: #ffffff; }}
    .content {{ padding: 24px; font-size: 14px; line-height: 1.6; }}
    .badge {{ display: inline-block; padding: 4px 10px; background: #dbeafe; color: #1e40af; border-radius: 4px; font-weight: 600; font-size: 12px; }}
    .info-table {{ width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 16px; font-size: 13px; }}
    .info-table td {{ padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }}
    .info-table td.label {{ color: #64748b; font-weight: 600; width: 35%; }}
    .footer {{ background: #f8fafc; padding: 16px 24px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0; font-size: 20px; font-weight: 600;">MAPAR Governance & Risk</h2>
      <p style="margin:4px 0 0 0; opacity: 0.85; font-size: 13px;">System Alert Service</p>
    </div>
    <div class="content">
      <p>Hello <strong>{recipient_name}</strong>,</p>
      <p>This is a verification email confirming that your MAPAR SMTP server configuration is operational.</p>
      <span class="badge">SMTP Handshake Verified</span>
      <table class="info-table">
        <tr><td class="label">SMTP Host:</td><td>{config.get('host')}</td></tr>
        <tr><td class="label">Port:</td><td>{config.get('port')}</td></tr>
        <tr><td class="label">Encryption:</td><td>{config.get('security')}</td></tr>
        <tr><td class="label">Sender Address:</td><td>{config.get('from_email')}</td></tr>
        <tr><td class="label">Timestamp:</td><td>{timestamp_str}</td></tr>
      </table>
      <p style="color: #475569; font-size: 13px;">Automatic task assignment notifications and scheduled weekend reminders are active.</p>
    </div>
    <div class="footer">
      MAPAR Enterprise Performance & Governance System &bull; Confidential &copy; {timezone.now().year}
    </div>
  </div>
</body>
</html>"""

        idempotency_key = f"test_email:{timezone.now().timestamp()}:{recipient_email}"
        success, record = cls.send_html_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=subject,
            plain_text=plain_text,
            html_content=html_content,
            notification_type=EmailDeliveryRecord.NotificationType.TEST_EMAIL,
            idempotency_key=idempotency_key,
            custom_config=custom_config,
            skip_cc=True,  # Test emails go directly to requested admin
        )

        if success:
            return True, f"Test email successfully dispatched to {recipient_email}."
        else:
            return False, f"Failed to send test email: {record.error_message}"

    @classmethod
    def send_html_email(
        cls,
        recipient_email: str,
        subject: str,
        plain_text: str,
        html_content: str,
        recipient_name: str = "",
        cc_list: Optional[List[str]] = None,
        notification_type: str = EmailDeliveryRecord.NotificationType.TASK_ASSIGNMENT,
        action_point: Optional[Any] = None,
        action_id: str = "",
        scheduled_slot: str = "",
        idempotency_key: Optional[str] = None,
        custom_config: Optional[Dict[str, Any]] = None,
        skip_cc: bool = False,
        triggered_by: Optional[Any] = None,
    ) -> Tuple[bool, EmailDeliveryRecord]:
        """
        Sends an email via SMTP and records delivery status in EmailDeliveryRecord.
        Guarantees idempotency and mandatory CC address inclusion.
        Returns (success: bool, delivery_record).
        """
        config = cls.get_effective_config(custom_config)
        clean_recipient = recipient_email.strip().lower()
        effective_action_id = action_id or (action_point.action_id if action_point else "")

        # Always enforce mandatory CC addresses unless explicit test email
        if skip_cc:
            effective_cc: List[str] = []
        else:
            effective_cc = list(config.get("cc_addresses", []))
            if cc_list:
                for c in cc_list:
                    c_clean = c.strip().lower()
                    if c_clean and c_clean not in effective_cc:
                        effective_cc.append(c_clean)

        # Central CC filter: Temporarily exclude shakti.singh@pratap.co.in when switch is disabled
        if not cls.is_shakti_singh_cc_enabled(config):
            effective_cc = [
                c for c in effective_cc
                if c.strip().lower() != cls.TARGET_CC_SHAKTI_SINGH.lower()
            ]

        # Generate idempotency key if not provided
        if not idempotency_key:
            idempotency_key = f"{notification_type}:{effective_action_id}:{clean_recipient}:{timezone.now().strftime('%Y%m%d%H%M')}"

        # Check existing delivery record
        with transaction.atomic():
            record, created = EmailDeliveryRecord.objects.get_or_create(
                idempotency_key=idempotency_key,
                defaults={
                    "notification_type": notification_type,
                    "action_point": action_point,
                    "action_id": effective_action_id,
                    "recipient_email": clean_recipient,
                    "recipient_name": recipient_name,
                    "cc_emails": effective_cc,
                    "subject": subject,
                    "body_summary": plain_text[:300],
                    "scheduled_slot": scheduled_slot,
                    "status": EmailDeliveryRecord.Status.PENDING,
                    "triggered_by": triggered_by,
                },
            )

            if not created and triggered_by and not record.triggered_by:
                record.triggered_by = triggered_by
                record.save(update_fields=["triggered_by", "updated_at"])

            # If already successfully delivered, do not duplicate
            if not created and record.status == EmailDeliveryRecord.Status.SENT:
                logger.info("Email with idempotency_key %s was already sent. Skipping duplicate.", idempotency_key)
                return True, record

        # Check master enabled toggle
        if not config.get("is_enabled", True):
            record.status = EmailDeliveryRecord.Status.FAILED
            record.error_message = "Email notifications are globally disabled in MAPAR System Configuration."
            record.save(update_fields=["status", "error_message", "updated_at"])
            logger.warning("Notification cancelled: email system is disabled.")
            return False, record

        host = config.get("host")
        port = config.get("port") or 587
        username = config.get("username")
        password = config.get("password")
        security = config.get("security", "STARTTLS")
        from_email = config.get("from_email") or "notifications@mapar.co.in"
        from_name = config.get("from_name") or "MAPAR Governance System"

        if not host:
            record.status = EmailDeliveryRecord.Status.FAILED
            record.error_message = "SMTP host not configured. Please configure SMTP in Administration > System Alerts."
            record.save(update_fields=["status", "error_message", "updated_at"])
            return False, record

        # Assemble MIME message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = formataddr((from_name, from_email))
        msg["To"] = formataddr((recipient_name, clean_recipient)) if recipient_name else clean_recipient
        if effective_cc:
            msg["Cc"] = ", ".join(effective_cc)
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain="mapar.co.in")

        part_plain = MIMEText(plain_text, "plain", "utf-8")
        part_html = MIMEText(html_content, "html", "utf-8")
        msg.attach(part_plain)
        msg.attach(part_html)

        all_recipients = [clean_recipient] + [c for c in effective_cc if c != clean_recipient]

        record.attempts += 1
        record.last_attempt_at = timezone.now()

        try:
            timeout = 15
            if security == "SSL":
                ctx = ssl.create_default_context()
                server = smtplib.SMTP_SSL(host=host, port=port, timeout=timeout, context=ctx)
            else:
                server = smtplib.SMTP(host=host, port=port, timeout=timeout)

            with server:
                server.ehlo()
                if security == "STARTTLS" and server.has_extn("STARTTLS"):
                    ctx = ssl.create_default_context()
                    server.starttls(context=ctx)
                    server.ehlo()

                if username and password:
                    server.login(username, password)

                server.sendmail(from_email, all_recipients, msg.as_string())

            record.status = EmailDeliveryRecord.Status.SENT
            record.sent_at = timezone.now()
            record.error_message = ""
            record.save(update_fields=["status", "attempts", "last_attempt_at", "sent_at", "error_message", "updated_at"])
            logger.info("Successfully sent email [%s] to %s (CC: %s)", subject, clean_recipient, effective_cc)
            return True, record

        except Exception as e:
            # Sanitize error message to prevent password leakage
            raw_err = str(e)
            if password and password in raw_err:
                raw_err = raw_err.replace(password, "******")

            if record.attempts < record.max_attempts:
                record.status = EmailDeliveryRecord.Status.RETRYING
            else:
                record.status = EmailDeliveryRecord.Status.FAILED

            record.error_message = raw_err
            record.save(update_fields=["status", "attempts", "last_attempt_at", "error_message", "updated_at"])
            logger.error("Failed to deliver email [%s] to %s: %s", subject, clean_recipient, raw_err)
            return False, record
