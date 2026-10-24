from django.db import models
from django.conf import settings


class MainCompany(models.Model):
    """
    Tier 1: Main Company (Top-Level Enterprise Entity).
    """
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organization_maincompany"
        ordering = ["name"]
        verbose_name = "Main Company"
        verbose_name_plural = "Main Companies"

    def __str__(self):
        return f"{self.name} ({self.code})"


class SubCompany(models.Model):
    """
    Tier 2: Sub Company (Subsidiary Entity).
    Relationship: MainCompany 1 -> N SubCompany
    """
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    main_company = models.ForeignKey(MainCompany, on_delete=models.CASCADE, related_name="sub_companies")
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, db_index=True)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organization_subcompany"
        ordering = ["name"]
        unique_together = ("main_company", "code")
        verbose_name = "Sub Company"
        verbose_name_plural = "Sub Companies"

    def __str__(self):
        return f"{self.main_company.name} → {self.name} ({self.code})"


class Project(models.Model):
    """
    Tier 3: Project (Operational Project / Business Initiative).
    Relationship: SubCompany 1 -> N Project
    """
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    sub_company = models.ForeignKey(SubCompany, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, db_index=True)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organization_project"
        ordering = ["name"]
        unique_together = ("sub_company", "code")
        verbose_name = "Project"
        verbose_name_plural = "Projects"

    def __str__(self):
        return f"{self.sub_company.name} → {self.name} ({self.code})"


class Circle(models.Model):
    """
    Tier 4: Circle (Operational / Regional Circle).
    Relationship: Project 1 -> N Circle
    """
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    main_company = models.ForeignKey(
        MainCompany,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="circles"
    )
    sub_company = models.ForeignKey(
        SubCompany,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="direct_circles"
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name="circles")
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, db_index=True)
    region = models.CharField(max_length=50, blank=True, default="North")
    head_name = models.CharField(max_length=100, blank=True, default="")
    head_email = models.CharField(max_length=100, blank=True, default="")
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def direct_parent(self):
        if self.project_id:
            return self.project
        if self.sub_company_id:
            return self.sub_company
        if self.main_company_id:
            return self.main_company
        return None

    @property
    def parent_level(self):
        if self.project_id:
            return "PROJECT"
        if self.sub_company_id:
            return "SUB_COMPANY"
        if self.main_company_id:
            return "MAIN_COMPANY"
        return None

    class Meta:
        db_table = "organization_circle"
        ordering = ["name"]
        verbose_name = "Circle"
        verbose_name_plural = "Circles"

    def __str__(self):
        return f"{self.name} ({self.code})"


class Domain(models.Model):
    """
    Tier 5: Domain (Functional Governance Domain, e.g. Operations, HR, Finance).
    Relationship: Circle 1 -> N Domain
    """
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    circle = models.ForeignKey(Circle, on_delete=models.CASCADE, null=True, blank=True, related_name="domains")
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, db_index=True)
    description = models.TextField(blank=True, default="")
    icon = models.CharField(max_length=50, default="layers")
    color = models.CharField(max_length=20, default="blue")
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organization_domain"
        ordering = ["display_order", "name"]
        verbose_name = "Domain"
        verbose_name_plural = "Domains"

    def __str__(self):
        return f"{self.name} ({self.code})"


class Department(models.Model):
    """
    Tier 6: Department (Operational Department under Domain).
    Relationship: Domain 1 -> N Department
    """
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    domain = models.ForeignKey(Domain, on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, db_index=True)
    description = models.TextField(blank=True, default="")
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organization_department"
        ordering = ["display_order", "name"]
        unique_together = ("domain", "code")
        verbose_name = "Department"
        verbose_name_plural = "Departments"

    def __str__(self):
        return f"{self.domain.name} → {self.name} ({self.code})"


class SubDepartment(models.Model):
    """
    Tier 7: Sub Department (Specialized unit/team under Department).
    Relationship: Department 1 -> N SubDepartment
    """
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="sub_departments")
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, db_index=True)
    description = models.TextField(blank=True, default="")
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organization_subdepartment"
        ordering = ["display_order", "name"]
        unique_together = ("department", "code")
        verbose_name = "Sub Department"
        verbose_name_plural = "Sub Departments"

    def __str__(self):
        return f"{self.department.name} → {self.name} ({self.code})"


class HierarchyAuditLog(models.Model):
    """
    Tracks all structural CRUD modifications on the organization hierarchy.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="org_audit_logs")
    action = models.CharField(max_length=50)  # CREATE, UPDATE, DELETE, ARCHIVE
    level = models.CharField(max_length=50)   # MAIN_COMPANY, SUB_COMPANY, PROJECT, CIRCLE, DOMAIN, DEPARTMENT, SUB_DEPARTMENT
    object_id = models.CharField(max_length=100)
    object_repr = models.CharField(max_length=250)
    details = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "organization_hierarchyauditlog"
        ordering = ["-timestamp"]
        verbose_name = "Hierarchy Audit Log"
        verbose_name_plural = "Hierarchy Audit Logs"

    def __str__(self):
        return f"[{self.timestamp}] {self.user} - {self.action} on {self.level} ({self.object_repr})"
