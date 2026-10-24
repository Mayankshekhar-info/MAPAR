"""
Acceptance Test Suite: CBH Role with Rajasthan Scope & Independent Module Permissions.
Verifies Section 6 of Antigravity Prompt:
1. User sees only explicitly granted modules (governance=WRITE, uploads=READ, organization=NO_ACCESS).
2. Inside granted modules, user sees only authorized Rajasthan records.
3. WRITE on governance allows authorized creates/updates only within Rajasthan.
4. READ on uploads allows view/export, blocks writes.
5. NO_ACCESS on organization blocks any access.
6. Dashboards, queries, and filters enforce Rajasthan scope.
7. Changing user's permissions updates effective access correctly.
"""

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Domain,
    Department,
)
from apps.authorization.models import (
    AccessRole,
    UserModulePermission,
)
from apps.authorization.services.module_permission_service import (
    AccessModuleService,
    ModulePermissionService,
)
from apps.users.services.user_service import UserService
from apps.users.selectors.user_selectors import get_user_detail
from apps.governance.models import GovernanceActionPoint
from apps.governance.selectors.governance_selectors import get_governance_actions
from common.permissions.authorization import AuthorizationService
from apps.identity.models import User


class CBHRajasthanAcceptanceTestCase(TestCase):
    def setUp(self):
        # 1. Seed modules and action taxonomy
        AccessModuleService.ensure_application_modules()

        # 2. Setup Hierarchy with Rajasthan and Maharashtra
        self.company = MainCompany.objects.create(name="Telecom India Ltd", code="TIL")
        self.sub_company = SubCompany.objects.create(main_company=self.company, name="Telecom Infra", code="TIL_INFRA")
        self.project = Project.objects.create(sub_company=self.sub_company, name="BSNL 4G Rollout", code="BSNL_4G")

        # Rajasthan Circle & Hierarchy
        self.circle_rajasthan = Circle.objects.create(
            project=self.project,
            name="Rajasthan",
            code="RAJ"
        )
        self.domain_raj_ops = Domain.objects.create(
            circle=self.circle_rajasthan,
            name="Network Operations",
            code="RAJ_OPS"
        )
        self.dept_raj_rf = Department.objects.create(
            domain=self.domain_raj_ops,
            name="RF Optimization",
            code="RAJ_RF"
        )

        # Maharashtra Circle & Hierarchy (Outside Scope)
        self.circle_maharashtra = Circle.objects.create(
            project=self.project,
            name="Maharashtra",
            code="MAH"
        )
        self.domain_mah_ops = Domain.objects.create(
            circle=self.circle_maharashtra,
            name="Network Operations",
            code="MAH_OPS"
        )
        self.dept_mah_rf = Department.objects.create(
            domain=self.domain_mah_ops,
            name="RF Optimization",
            code="MAH_RF"
        )

        # 3. Existing CBH Role (Circle Business Head)
        self.cbh_role, _ = AccessRole.objects.get_or_create(
            code="CBH",
            defaults={"name": "Circle Business Head", "description": "Circle Business Head"}
        )

        # 4. Create sample tasks in both Circles
        today = timezone.now().date()
        self.raj_task = GovernanceActionPoint.objects.create(
            action_id="ACT-RAJ-001",
            circle=self.circle_rajasthan,
            action_point="Deploy 100 Sites in Jaipur",
            target_closure_date=today,
            hierarchy_level="CIRCLE",
            status=GovernanceActionPoint.Status.OPEN,
            priority=GovernanceActionPoint.Priority.HIGH,
        )
        self.mah_task = GovernanceActionPoint.objects.create(
            action_id="ACT-MAH-001",
            circle=self.circle_maharashtra,
            action_point="Deploy 50 Sites in Pune",
            target_closure_date=today,
            hierarchy_level="CIRCLE",
            status=GovernanceActionPoint.Status.OPEN,
            priority=GovernanceActionPoint.Priority.HIGH,
        )

        self.admin_user = User.objects.create_superuser("admin_test", "admin@mapar.com", "AdminPass123!")

    def test_cbh_rajasthan_full_acceptance_scenario(self):
        """
        Full Acceptance Test:
        - Create CBH user with Rajasthan scope.
        - Configure Module Permissions: governance=WRITE, uploads=READ, organization=NO_ACCESS.
        - Verify isolation, read-only enforcement, no-access enforcement, and scope boundaries.
        """
        # Step 1: Create user through UserService with scopes & module permissions
        user = UserService.create_user(
            data={
                "username": "cbh_rajasthan_user",
                "email": "cbh.rajasthan@mapar.com",
                "first_name": "Ramesh",
                "last_name": "Sharma",
                "password": "StrongPassword123!",
                "role": "CBH",
                "role_id": self.cbh_role.id,
                "scopes": [
                    {
                        "circle_id": self.circle_rajasthan.id,
                        "access_level": "MANAGE",
                    }
                ],
                "module_permissions": [
                    {"module_code": "governance", "access_level": "WRITE"},
                    {"module_code": "uploads", "access_level": "READ"},
                    {"module_code": "organization", "access_level": "NO_ACCESS"},
                ]
            },
            admin_user=self.admin_user
        )

        self.assertIsNotNone(user.id)
        self.assertEqual(user.username, "cbh_rajasthan_user")

        # Step 2: Verify user detail selector returns scopes and module permissions
        detail = get_user_detail(user.id)
        self.assertIsNotNone(detail)
        self.assertEqual(len(detail["scopes"]), 1)
        self.assertEqual(detail["scopes"][0]["circle_id"], self.circle_rajasthan.id)
        self.assertEqual(detail["scopes"][0]["circle_name"], "Rajasthan")

        # Step 3: Verify Accessible Modules (Only granted modules are accessible)
        accessible_modules = AuthorizationService.get_user_accessible_modules(user)
        self.assertIn("governance", accessible_modules)
        self.assertIn("uploads", accessible_modules)
        self.assertNotIn("organization", accessible_modules)

        # Step 4: Verify Hierarchy Scope (Confined to Rajasthan circle)
        user_scope = AuthorizationService.get_user_hierarchy_scope(user)
        self.assertFalse(user_scope.is_unrestricted)
        self.assertIsNotNone(user_scope.circle_ids)
        self.assertEqual(user_scope.circle_ids, {self.circle_rajasthan.id})
        self.assertNotIn(self.circle_maharashtra.id, user_scope.circle_ids or set())

        # Step 5: Verify Data Isolation in Governance Queries
        # User querying tasks should ONLY see Rajasthan task, NOT Maharashtra task
        tasks = get_governance_actions({}, user=user)
        task_ids = [t.id for t in tasks]
        self.assertIn(self.raj_task.id, task_ids)
        self.assertNotIn(self.mah_task.id, task_ids)

        # Step 6: Verify Module Read/Write Logic via AuthorizationService.can()
        # Governance is WRITE -> Allowed to view, create, edit within Rajasthan
        self.assertTrue(
            AuthorizationService.can(
                user, "governance.view",
                hierarchy_context={"circle_id": self.circle_rajasthan.id}
            )
        )
        self.assertTrue(
            AuthorizationService.can(
                user, "governance.create",
                hierarchy_context={"circle_id": self.circle_rajasthan.id}
            )
        )
        self.assertTrue(
            AuthorizationService.can(
                user, "governance.edit",
                hierarchy_context={"circle_id": self.circle_rajasthan.id}
            )
        )

        # Out-of-Scope Write (Maharashtra) is strictly DENIED
        self.assertFalse(
            AuthorizationService.can(
                user, "governance.create",
                hierarchy_context={"circle_id": self.circle_maharashtra.id}
            )
        )
        self.assertFalse(
            AuthorizationService.can(
                user, "governance.view",
                hierarchy_context={"circle_id": self.circle_maharashtra.id}
            )
        )

        # Uploads is READ -> Allowed to view, but CANNOT create or upload
        self.assertTrue(
            AuthorizationService.can(
                user, "uploads.view",
                hierarchy_context={"circle_id": self.circle_rajasthan.id}
            )
        )
        self.assertFalse(
            AuthorizationService.can(
                user, "uploads.create",
                hierarchy_context={"circle_id": self.circle_rajasthan.id}
            )
        )
        self.assertFalse(
            AuthorizationService.can(
                user, "uploads.edit",
                hierarchy_context={"circle_id": self.circle_rajasthan.id}
            )
        )

        # Organization is NO_ACCESS -> Both view and edit are DENIED
        self.assertFalse(
            AuthorizationService.can(
                user, "organization.view",
                hierarchy_context={"circle_id": self.circle_rajasthan.id}
            )
        )
        self.assertFalse(
            AuthorizationService.can(
                user, "organization.edit",
                hierarchy_context={"circle_id": self.circle_rajasthan.id}
            )
        )

        # Step 7: Update user permissions later
        # Grant READ to organization and WRITE to uploads
        updated_user = UserService.update_user(
            user_id=user.id,
            data={
                "module_permissions": [
                    {"module_code": "governance", "access_level": "READ"},
                    {"module_code": "uploads", "access_level": "WRITE"},
                    {"module_code": "organization", "access_level": "READ"},
                ]
            },
            admin_user=self.admin_user
        )

        # Verify updated effective permissions immediately reflect
        updated_modules = AuthorizationService.get_user_accessible_modules(updated_user)
        self.assertIn("organization", updated_modules)
        self.assertIn("uploads", updated_modules)
        self.assertIn("governance", updated_modules)

        # Governance was downgraded to READ -> create/edit is now DENIED
        self.assertFalse(
            AuthorizationService.can(
                updated_user, "governance.create",
                hierarchy_context={"circle_id": self.circle_rajasthan.id}
            )
        )
        # Uploads was upgraded to WRITE -> create is now ALLOWED within Rajasthan
        self.assertTrue(
            AuthorizationService.can(
                updated_user, "uploads.create",
                hierarchy_context={"circle_id": self.circle_rajasthan.id}
            )
        )
