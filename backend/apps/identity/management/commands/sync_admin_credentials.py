import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Safely synchronizes and repairs the existing Admin account credentials while preserving all data and authorization."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            type=str,
            default=None,
            help="Optional password override. Defaults to INITIAL_ADMIN_PASSWORD environment variable or 'admin123'.",
        )
        parser.add_argument(
            "--username",
            type=str,
            default="admin",
            help="Admin username to synchronize (defaults to 'admin').",
        )

    def handle(self, *args, **options):
        username = options["username"]
        password = options["password"] or os.environ.get("INITIAL_ADMIN_PASSWORD", "admin123")

        admin = User.objects.filter(username__iexact=username).first()
        if not admin:
            # Check by role
            admin = User.objects.filter(role=User.Role.SUPER_ADMIN).order_by("id").first()

        if not admin:
            self.stdout.write(self.style.ERROR(f"Admin account '{username}' not found in database."))
            return

        self.stdout.write(f"Found Admin account: ID={admin.id}, Username='{admin.username}', Email='{admin.email}'")

        # Repair status if inactive or locked
        admin.status = User.Status.ACTIVE
        admin.is_active = True
        admin.is_staff = True
        admin.is_superuser = True
        admin.role = User.Role.SUPER_ADMIN
        admin.failed_login_attempts = 0
        admin.locked_until = None
        admin.force_password_change = False

        # Set verified password hash using standard hasher
        admin.set_password(password)
        admin.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully synchronized credentials for admin '{admin.username}' (ID={admin.id}). "
                "Account is ACTIVE, verified, and unlocked."
            )
        )
