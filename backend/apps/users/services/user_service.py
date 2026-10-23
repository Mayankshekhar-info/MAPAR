from typing import Dict, Any
from django.db import transaction
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password

from apps.identity.models import User
from apps.authorization.models import AccessRole, AccessUserRole, UserAccessScope, UserAccessScopeCircle
from apps.organization.models import Circle, HierarchyAuditLog, SubDepartment
from common.permissions.authorization import AuthorizationService


class UserService:
    """
    Business logic and transactional lifecycle management for User Accounts.
    """

    @classmethod
    @transaction.atomic
    def create_user(cls, data: Dict[str, Any], admin_user) -> User:
        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password")
        first_name = (data.get("first_name") or "").strip()
        last_name = (data.get("last_name") or "").strip()
        role_code = data.get("role", "VIEWER")
        role_id = data.get("role_id")
        circle_id = data.get("circle_id")
        sub_dept_id = data.get("sub_department_id") or data.get("team_id")
        department = (data.get("department") or "").strip()
        designation = (data.get("designation") or "").strip()
        phone = (data.get("phone") or "").strip()
        employee_id = (data.get("employee_id") or "").strip() or None
        status = data.get("status", "ACTIVE")

        if not username:
            raise ValidationError({"username": "Username is required."})
        if not email:
            raise ValidationError({"email": "Email address is required."})
        if not password:
            raise ValidationError({"password": "Password is required."})

        if User.objects.filter(username=username).exists():
            raise ValidationError({"username": f"User with username '{username}' already exists."})

        if User.objects.filter(email=email).exists():
            raise ValidationError({"email": f"User with email '{email}' already exists."})

        # Resolve sub_department (team) if provided
        circle = None
        sub_dept = None
        if sub_dept_id:

            try:
                sub_dept = SubDepartment.objects.select_related(
                    "department__domain__circle__project__sub_company__main_company"
                ).get(id=sub_dept_id)
                # Auto-infer circle and department if not explicitly given
                if not circle_id and sub_dept.department and sub_dept.department.domain and sub_dept.department.domain.circle:
                    circle = sub_dept.department.domain.circle
                if not department and sub_dept.department:
                    department = sub_dept.department.name
            except Exception:
                raise ValidationError({"sub_department_id": "Selected Team does not exist."})

        # Validate circle if provided or resolved
        if circle_id and not circle:
            try:
                circle = Circle.objects.get(id=circle_id)
            except Circle.DoesNotExist:
                raise ValidationError({"circle_id": "Selected Circle does not exist."})

        # Server-side Scope Enforcement: Admin cannot assign users outside their own downward scope
        if admin_user:
            admin_scope = AuthorizationService.get_user_hierarchy_scope(admin_user)
            if not admin_scope.is_unrestricted:
                if circle and not admin_scope.is_circle_allowed(circle.id):
                    raise ValidationError({"circle_id": f"Cannot assign user to circle '{circle.name}'. It is outside your authorized scope."})
                if sub_dept and not admin_scope.is_team_allowed(sub_dept.id):
                    raise ValidationError({"sub_department_id": f"Cannot assign user to team '{sub_dept.name}'. It is outside your authorized scope."})
                if circle_id and not admin_scope.is_circle_allowed(circle_id):
                    raise ValidationError({"circle_id": "Selected Circle is outside your authorized scope."})

        # Create user using Django auth
        is_active = (status == "ACTIVE")
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=role_code,
            circle=circle,
            sub_department=sub_dept,
            department=department,
            designation=designation,
            phone=phone,
            employee_id=employee_id,
            status=status,
            is_active=is_active,
        )

        # Resolve role in AccessRole
        access_role = None
        if role_id:
            access_role = AccessRole.objects.filter(id=role_id, status="ACTIVE").first()
        elif role_code:
            access_role = AccessRole.objects.filter(code=role_code, status="ACTIVE").first()

        if access_role:
            AccessUserRole.objects.create(
                user=user,
                role=access_role,
                is_primary=True,
                assigned_by=admin_user,
            )

        # Module Access Permissions Dimension
        module_perms_data = data.get("module_permissions")
        if module_perms_data:
            from apps.authorization.services.module_permission_service import ModulePermissionService
            ModulePermissionService.sync_user_module_permissions(user, module_perms_data, admin_user)

        # Multi-Scope Assignment Support (Requirement 3, 4, 15)
        scopes_list = data.get("scopes") or []
        if scopes_list:
            from apps.authorization.services.scope_service import ScopeService
            ScopeService.sync_user_scopes(user, scopes_list, admin_user)
        elif sub_dept:
            scope = UserAccessScope.objects.create(
                user=user,
                scope_type=UserAccessScope.ScopeType.TEAM,
                sub_department=sub_dept,
                circle=circle,
                can_view=True,
                can_manage=False,
                actions=["view"],
            )
            if circle:
                UserAccessScopeCircle.objects.create(
                    useraccessscope=scope,
                    circle=circle,
                )
        elif circle:
            scope = UserAccessScope.objects.create(
                user=user,
                scope_type=UserAccessScope.ScopeType.CIRCLE,
                circle=circle,
                can_view=True,
                can_manage=False,
                actions=["view"],
            )
            UserAccessScopeCircle.objects.create(
                useraccessscope=scope,
                circle=circle,
            )

        team_info = f", team: {sub_dept.name}" if sub_dept else ""
        HierarchyAuditLog.objects.create(
            action="CREATE",
            level="USER",
            object_id=str(user.id),
            object_repr=f"User: {user.username} ({user.email})",
            details=f"Created user with role {access_role.name if access_role else role_code}{team_info} and circle {circle.name if circle else 'None'}.",
            user=admin_user,
        )

        return user


    @classmethod
    @transaction.atomic
    def update_user(cls, user_id: int, data: Dict[str, Any], admin_user) -> User:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise ValidationError({"detail": "User not found."})

        # Server-side Scope Enforcement: Admin cannot edit users outside their own scope
        if admin_user:
            from common.permissions.authorization import AuthorizationService
            admin_scope = AuthorizationService.get_user_hierarchy_scope(admin_user)
            if not admin_scope.is_unrestricted and not admin_scope.is_user_allowed(user.id):
                raise ValidationError({"detail": "Permission denied: target user is outside your authorized scope."})

        first_name = data.get("first_name")
        last_name = data.get("last_name")
        email = data.get("email")
        role_code = data.get("role")
        role_id = data.get("role_id")
        circle_id = data.get("circle_id")
        department = data.get("department")
        designation = data.get("designation")
        phone = data.get("phone")
        employee_id = data.get("employee_id")
        status = data.get("status")
        password = data.get("password")

        if email is not None:
            email = email.strip().lower()
            if User.objects.filter(email=email).exclude(id=user.id).exists():
                raise ValidationError({"email": f"Email '{email}' is already in use by another user."})
            user.email = email

        if first_name is not None:
            user.first_name = first_name.strip()
        if last_name is not None:
            user.last_name = last_name.strip()
        if department is not None:
            user.department = department.strip()
        if designation is not None:
            user.designation = designation.strip()
        if phone is not None:
            user.phone = phone.strip()
        if employee_id is not None:
            user.employee_id = employee_id.strip() or None

        if status is not None:
            user.status = status
            user.is_active = (status == "ACTIVE")

        # Update sub_department (team)
        if "sub_department_id" in data or "team_id" in data:
            sub_dept_id = data.get("sub_department_id") or data.get("team_id")
            if sub_dept_id:
                try:
                    sub_dept = SubDepartment.objects.select_related(
                        "department__domain__circle"
                    ).get(id=sub_dept_id)
                    if admin_user:
                        admin_scope = AuthorizationService.get_user_hierarchy_scope(admin_user)
                        if not admin_scope.is_unrestricted and not admin_scope.is_team_allowed(sub_dept.id):
                            raise ValidationError({"sub_department_id": "Selected Team is outside your authorized scope."})
                    user.sub_department = sub_dept
                    if not user.circle and sub_dept.department and sub_dept.department.domain:
                        user.circle = sub_dept.department.domain.circle
                except SubDepartment.DoesNotExist:
                    raise ValidationError({"sub_department_id": "Selected Team does not exist."})
            else:
                user.sub_department = None

        # Update circle
        if "circle_id" in data:
            if circle_id:
                try:
                    circle = Circle.objects.get(id=circle_id)
                    if admin_user:
                        admin_scope = AuthorizationService.get_user_hierarchy_scope(admin_user)
                        if not admin_scope.is_unrestricted and not admin_scope.is_circle_allowed(circle.id):
                            raise ValidationError({"circle_id": "Selected Circle is outside your authorized scope."})
                    user.circle = circle
                    # Also sync or update default UserAccessScope
                    scope, _ = UserAccessScope.objects.get_or_create(
                        user=user,
                        defaults={"scope_type": UserAccessScope.ScopeType.CIRCLE},
                    )
                    UserAccessScopeCircle.objects.get_or_create(useraccessscope=scope, circle=circle)
                except Circle.DoesNotExist:
                    raise ValidationError({"circle_id": "Selected Circle does not exist."})
            else:
                user.circle = None

        if role_code is not None:
            user.role = role_code

        # Update role mapping
        if role_id is not None or role_code is not None:
            access_role = None
            if role_id:
                access_role = AccessRole.objects.filter(id=role_id, status="ACTIVE").first()
            elif role_code:
                access_role = AccessRole.objects.filter(code=role_code, status="ACTIVE").first()

            if access_role:
                AccessUserRole.objects.filter(user=user).delete()
                AccessUserRole.objects.create(
                    user=user,
                    role=access_role,
                    is_primary=True,
                    assigned_by=admin_user,
                )

        if password:
            user.set_password(password)

        user.save()

        # Multi-Scope Assignment Synchronization (Requirement 15)
        if "scopes" in data and isinstance(data["scopes"], list):
            from apps.authorization.services.scope_service import ScopeService
            ScopeService.sync_user_scopes(user, data["scopes"], admin_user)

        # Module Access Permissions Synchronization
        if "module_permissions" in data and isinstance(data["module_permissions"], list):
            from apps.authorization.services.module_permission_service import ModulePermissionService
            ModulePermissionService.sync_user_module_permissions(user, data["module_permissions"], admin_user)

        HierarchyAuditLog.objects.create(
            action="UPDATE",
            level="USER",
            object_id=str(user.id),
            object_repr=f"User: {user.username} ({user.email})",
            details="Updated user profile and credentials.",
            user=admin_user,
        )

        return user

    @classmethod
    @transaction.atomic
    def toggle_user_status(cls, user_id: int, admin_user) -> User:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise ValidationError({"detail": "User not found."})

        if user.id == admin_user.id:
            raise ValidationError({"detail": "You cannot deactivate your own administrative account."})

        # Server-side Scope Enforcement
        if admin_user:
            admin_scope = AuthorizationService.get_user_hierarchy_scope(admin_user)
            if not admin_scope.is_unrestricted and not admin_scope.is_user_allowed(user.id):
                raise ValidationError({"detail": "Permission denied: target user is outside your authorized scope."})

        new_active = not user.is_active
        user.is_active = new_active
        user.status = "ACTIVE" if new_active else "INACTIVE"
        user.save(update_fields=["is_active", "status"])

        HierarchyAuditLog.objects.create(
            action="UPDATE",
            level="USER",
            object_id=str(user.id),
            object_repr=f"User: {user.username}",
            details=f"Toggled user status to {user.status}.",
            user=admin_user,
        )

        return user
