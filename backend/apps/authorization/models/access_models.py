from django.db import models
from django.conf import settings


class AccessPermissionAction(models.Model):
    """Action taxonomy (view, create, edit, delete, export, etc.)."""
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    category = models.CharField(max_length=50, blank=True, default="")
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "access_permissionaction"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class AccessModule(models.Model):
    """Application module registered in the authorization system."""
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    icon = models.CharField(max_length=50, blank=True, default="")
    route_name = models.CharField(max_length=200, blank=True, default="")
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    parent = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="sub_modules")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "access_module"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class AccessPermission(models.Model):
    """Granular action permission within a module."""
    module = models.ForeignKey(AccessModule, on_delete=models.CASCADE, related_name="permissions")
    action = models.ForeignKey(AccessPermissionAction, on_delete=models.CASCADE, null=True, blank=True, related_name="permissions")
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    risk_level = models.CharField(max_length=20, default="LOW")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "access_permission"
        ordering = ["module__sort_order", "code"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class AccessRole(models.Model):
    """Enterprise Role grouping permissions."""
    class RoleType(models.TextChoices):
        SYSTEM = "SYSTEM", "System Defined"
        CUSTOM = "CUSTOM", "Custom Defined"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    class RiskLevel(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, default="")
    role_type = models.CharField(max_length=20, choices=RoleType.choices, default=RoleType.CUSTOM)
    risk_level = models.CharField(max_length=20, choices=RiskLevel.choices, default=RiskLevel.MEDIUM)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    parent_role = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="sub_roles")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_roles")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "access_role"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class AccessRolePermission(models.Model):
    """Binding between a Role and a Permission."""
    role = models.ForeignKey(AccessRole, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(AccessPermission, on_delete=models.CASCADE, related_name="role_bindings")
    is_denied = models.BooleanField(default=False)

    class Meta:
        db_table = "access_rolepermission"
        unique_together = ("role", "permission")

    def __str__(self):
        return f"{self.role.code} -> {self.permission.code}"


class AccessUserRole(models.Model):
    """Assignment of an Enterprise Role to a User."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_roles")
    role = models.ForeignKey(AccessRole, on_delete=models.CASCADE, related_name="assigned_users")
    is_primary = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="role_assignments_made")

    class Meta:
        db_table = "access_userrole"
        unique_together = ("user", "role")

    def __str__(self):
        return f"{self.user.username} -> {self.role.name}"


class UserAccessScope(models.Model):
    """Where a user can access data in the organizational hierarchy."""
    class ScopeType(models.TextChoices):
        GLOBAL = "GLOBAL", "Global (All Organizations)"
        CORPORATE = "CORPORATE", "Corporate Level"
        COMPANY = "COMPANY", "Main / Sub Company"
        PROJECT = "PROJECT", "Project Level"
        CIRCLE = "CIRCLE", "Circle Level"
        DOMAIN = "DOMAIN", "Domain Level"
        DEPARTMENT = "DEPARTMENT", "Department Level"
        TEAM = "TEAM", "Team / Sub-Department Level"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="access_scopes")
    scope_type = models.CharField(max_length=20, choices=ScopeType.choices, default=ScopeType.CIRCLE)

    # 7-Tier Cascading Hierarchy Foreign Keys
    main_company = models.ForeignKey(
        "organization.MainCompany",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_scopes",
    )
    sub_company = models.ForeignKey(
        "organization.SubCompany",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_scopes",
    )
    project = models.ForeignKey(
        "organization.Project",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_scopes",
    )
    circle = models.ForeignKey(
        "organization.Circle",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_scopes",
    )
    domain = models.ForeignKey(
        "organization.Domain",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_scopes",
    )
    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_scopes",
    )
    sub_department = models.ForeignKey(
        "organization.SubDepartment",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_scopes",
    )

    # Granular Action Permissions for this Scope
    can_view = models.BooleanField(default=True)
    can_manage = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_update = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    actions = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "access_useraccessscope"
        ordering = ["id"]

    def __str__(self):
        return f"{self.user.username} ({self.hierarchy_breadcrumb})"

    @property
    def anchor_level(self) -> str:
        if getattr(self, "sub_department_id", None):
            return "TEAM"
        if getattr(self, "department_id", None):
            return "DEPARTMENT"
        if getattr(self, "domain_id", None):
            return "DOMAIN"
        if getattr(self, "circle_id", None):
            return "CIRCLE"
        if getattr(self, "project_id", None):
            return "PROJECT"
        if getattr(self, "sub_company_id", None):
            return "SUB_COMPANY"
        if getattr(self, "main_company_id", None):
            return "MAIN_COMPANY"
        return self.scope_type

    @property
    def hierarchy_breadcrumb(self) -> str:
        parts = []
        mc = self.main_company
        sc = self.sub_company
        prj = self.project
        cir = self.circle
        dom = self.domain
        dept = self.department
        sd = self.sub_department

        if sd and not dept:
            dept = getattr(sd, "department", None)
        if dept and not dom:
            dom = getattr(dept, "domain", None)
        if dom and not cir:
            cir = getattr(dom, "circle", None)
        if cir and not prj:
            prj = getattr(cir, "project", None)
        if prj and not sc:
            sc = getattr(prj, "sub_company", None)
        if sc and not mc:
            mc = getattr(sc, "main_company", None)

        if mc: parts.append(mc.name)
        if sc: parts.append(sc.name)
        if prj: parts.append(prj.name)
        if cir: parts.append(cir.name)
        if dom: parts.append(dom.name)
        if dept: parts.append(dept.name)
        if sd: parts.append(sd.name)
        return " → ".join(parts) if parts else self.get_scope_type_display()


class UserAccessScopeCircle(models.Model):
    """Assigned circle within a user access scope."""
    useraccessscope = models.ForeignKey(UserAccessScope, on_delete=models.CASCADE, related_name="assigned_circles")
    circle = models.ForeignKey("organization.Circle", on_delete=models.CASCADE, related_name="scope_assignments")

    class Meta:
        db_table = "access_useraccessscope_assigned_circles"
        unique_together = ("useraccessscope", "circle")

    def __str__(self):
        c_id = getattr(self, "circle_id", None)
        return f"Scope {self.useraccessscope_id} -> Circle {c_id}"


class UserAccessScopeDomain(models.Model):
    """Assigned domain within a user access scope."""
    useraccessscope = models.ForeignKey(UserAccessScope, on_delete=models.CASCADE, related_name="assigned_domains")
    domain = models.ForeignKey("organization.Domain", on_delete=models.CASCADE, related_name="scope_assignments")

    class Meta:
        db_table = "access_useraccessscope_assigned_domains"
        unique_together = ("useraccessscope", "domain")

    def __str__(self):
        d_id = getattr(self, "domain_id", None)
        return f"Scope {self.useraccessscope_id} -> Domain {d_id}"
