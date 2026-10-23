from django.core.management.base import BaseCommand
from apps.notifications.services.smtp_service import SMTPService


class Command(BaseCommand):
    help = "Tests connectivity and authentication to the configured SMTP email server."

    def add_arguments(self, parser):
        parser.add_argument(
            "--send-to",
            type=str,
            default="",
            help="Optional recipient email address to send a live test message to.",
        )

    def handle(self, *args, **options):
        send_to = options["send_to"].strip()

        self.stdout.write("Testing SMTP connection...")
        success, message = SMTPService.test_connection()

        if success:
            self.stdout.write(self.style.SUCCESS(f"PASS: {message}"))
            if send_to:
                self.stdout.write(f"Sending test email to {send_to}...")
                email_success, email_msg = SMTPService.send_test_email(recipient_email=send_to)
                if email_success:
                    self.stdout.write(self.style.SUCCESS(f"PASS: {email_msg}"))
                else:
                    self.stdout.write(self.style.ERROR(f"FAIL: {email_msg}"))
        else:
            self.stdout.write(self.style.ERROR(f"FAIL: {message}"))
