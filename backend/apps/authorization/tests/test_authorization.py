from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db import connection

from apps.authorization.models import (
    AccessModule,
    AccessPermission,
    AccessRole,
    AccessRolePermission,
    AccessUserRole,
    UserAccessScope,
    UserAccessScopeCircle,
)
from apps.authorization.services.role_service import RoleService
from apps.authorization.services.scope_service import ScopeService
from apps.authorization.selectors.role_selectors import get_roles_list, get_role_detail, get_available_permissions_matrix
from apps.authorization.selectors.scope_selectors import get_user_scopes_list, get_user_effective_access
from apps.organization.models import MainCompany, SubCompany, Project, Circle
from common.permissions.authorization import AuthorizationService

User = get_user_model()


class AuthorizationEngineTestCase(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="super_admin",
            email="admin@mapar.test",
            password="adminpassword123",
        )
        self.user = User.objects.create_user(
            username="test_user",
            email="user@mapar.test",
            password="userpassword123",
            role="VIEWER",
        )

        self.company = MainCompany.objects.create(name="Apex Enterprise", code="APEX")
        self.sub_company = SubCompany.objects.create(main_company=self.company, name="Apex Energy", code="APEX_ENG")
        self.project = Project.objects.create(sub_company=self.sub_company, name="Solar Alpha", code="PRJ_SOLAR")
        self.circle = Circle.objects.create(project=self.project, name="North Circle", code="CIRC_NORTH")

        self.mod = AccessModule.objects.create(
            name="Management Cockpit",
            code="management",
            is_active=True,
            sort_order=1,
        )
        self.perm_view = AccessPermission.objects.create(
            module=self.mod,
            name="View Cockpit",
            code="management.view",
            is_active=True,
        )
        self.perm_export = AccessPermission.objects.create(
            module=self.mod,
            name="Export Cockpit",
            code="management.export",
            is_active=True,
        )

    def test_role_creation_and_permission_binding(self):
        role_data = {
            "name": "Operations Auditor",
            "code": "OPS_AUDITOR",
            "description": "Reviews operational data and exports reports",
            "risk_level": "LOW",
            "status": "ACTIVE",
            "permission_ids": [self.perm_view.id, self.perm_export.id],
        }
        role = RoleService.create_role(role_data, user=self.admin)
        self.assertIsNotNone(role.id)
        self.assertEqual(role.code, "OPS_AUDITOR")
        self.assertEqual(role.role_permissions.count(), 2)

        # Check detail
        detail = get_role_detail(role.id)
        self.assertEqual(detail["permissions_count"], 2)
        self.assertIn(self.perm_view.id, detail["granted_permission_ids"])

    def test_scope_assignment_and_effective_access(self):
        role = RoleService.create_role({
            "name": "Circle Viewer",
            "code": "CIRC_VIEWER",
            "permission_ids": [self.perm_view.id],
        }, user=self.admin)

        AccessUserRole.objects.create(user=self.user, role=role, is_primary=True)

        # Assign scope
        scope = ScopeService.assign_user_scope({
            "user_id": self.user.id,
            "scope_type": "CIRCLE",
            "circle_ids": [self.circle.id],
        }, admin_user=self.admin)

        self.assertIsNotNone(scope.id)

        # Evaluate authorization
        can_view = AuthorizationService.can(user=self.user, permission="management.view")
        self.assertTrue(can_view)

        can_export = AuthorizationService.can(user=self.user, permission="management.export")
        self.assertFalse(can_export)

        # Circle scope check
        allowed_circles = AuthorizationService.get_user_circle_ids(self.user)
        self.assertIn(self.circle.id, allowed_circles)

        # Effective access summary
        eff = get_user_effective_access(self.user.id)
        self.assertIn("management.view", eff["effective_permissions"])
        self.assertEqual(eff["scope_restriction"], "RESTRICTED")
        self.assertEqual(len(eff["allowed_circles"]), 1)
