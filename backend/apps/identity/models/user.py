from django.contrib.auth.models import AbstractUser  # type: ignore
from django.db import models  # type: ignore


class User(AbstractUser):
    """MAPAR native user account mapped to accounts_user."""

    class Role(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
        MANAGEMENT = "MANAGEMENT", "Corporate Management (MD / CXO)"
        CORPORATE_DOMAIN_LEAD = "CORPORATE_DOMAIN_LEAD", "Corporate Domain Lead"
        CIRCLE_DOMAIN_MANAGER = "CIRCLE_DOMAIN_MANAGER", "Circle Validator / Domain Manager"
        CIRCLE_DATA_ENTRY = "CIRCLE_DATA_ENTRY", "Circle Data Entry"
        ACTION_OWNER = "ACTION_OWNER", "Action / Functional Owner"
        VIEWER = "VIEWER", "Viewer (Read-Only)"

    class Status(models.TextChoices):
        INVITED = "INVITED", "Invited"
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"
        LOCKED = "LOCKED", "Locked"
        SUSPENDED = "SUSPENDED", "Suspended"
        EXPIRED = "EXPIRED", "Expired"

    role = models.CharField(max_length=100, choices=Role.choices, default=Role.VIEWER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    employee_id = models.CharField(max_length=50, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True)
    designation = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    is_dark_mode = models.BooleanField(default=False)
    failed_login_attempts = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    force_password_change = models.BooleanField(default=False)
    account_expiry_date = models.DateField(null=True, blank=True)
    mfa_required = models.BooleanField(default=False)
    circle = models.ForeignKey("organization.Circle", on_delete=models.SET_NULL, null=True, blank=True, related_name="users")
    sub_department = models.ForeignKey(
        "organization.SubDepartment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users"
    )

    class Meta:
        db_table = "accounts_user"
        managed = True
        ordering = ["username"]

    @property
    def role_title(self) -> str:
        return self.get_role_display()

    @property
    def is_superadmin(self) -> bool:
        return self.is_superuser or self.role == self.Role.SUPER_ADMIN

    @property
    def team(self):
        return self.sub_department
