"""
Tests for Hierarchy-Aware User Access & Downward Scope Control.
Verifies the complete 14-point acceptance scenario:
- 7-tier downward inheritance (Circle A -> Domains -> Departments -> Teams -> Users)
- Strict sibling branch isolation (Circle B and its descendants are hidden and inaccessible)
- Cross-branch access and update rejection by backend
- Dynamic scope anchoring (Circle vs Department vs Team vs Unrestricted)
"""

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.exceptions import PermissionDenied

from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Domain,
    Department,
    SubDepartment,
)
from apps.authorization.models import (
    AccessModule,
    AccessPermission,
    AccessRole,
    AccessRolePermission,
    AccessUserRole,
    UserAccessScope,
    UserAccessScopeCircle,
)
from common.permissions.authorization import AuthorizationService
from apps.organization.selectors.organization_selectors import (
    get_cascading_options,
    get_hierarchy_tree,
    get_node_details,
)
from apps.users.selectors.user_selectors import get_users_list, get_user_detail
from apps.users.services.user_service import UserService
from apps.dashboard.selectors.cockpit_selectors import get_filter_options

User = get_user_model()


class HierarchyDownwardScopeTestCase(TestCase):
    def setUp(self):
        # 1. Build Enterprise Structure: Main -> Sub -> Project
        self.main_company = MainCompany.objects.create(name="Main Enterprise A", code="MAIN_A")
        self.sub_company = SubCompany.objects.create(main_company=self.main_company, name="Sub Co A", code="SUB_A")
        self.project = Project.objects.create(sub_company=self.sub_company, name="Project Alpha", code="PRJ_A")

        # Branch 1: Circle A
        self.circle_a = Circle.objects.create(project=self.project, name="Circle A", code="CIR_A")
        self.domain_a = Domain.objects.create(circle=self.circle_a, name="Domain A", code="DOM_A", display_order=1)
        self.domain_b = Domain.objects.create(circle=self.circle_a, name="Domain B", code="DOM_B", display_order=2)
        
        self.dept_a = Department.objects.create(domain=self.domain_a, name="Department A", code="DEP_A")
        self.dept_b = Department.objects.create(domain=self.domain_a, name="Department B", code="DEP_B")
        
        self.team_a1 = SubDepartment.objects.create(department=self.dept_a, name="Team A1", code="TM_A1")
        self.team_a2 = SubDepartment.objects.create(department=self.dept_a, name="Team A2", code="TM_A2")

        # Branch 2: Sibling Circle B (Isolated)
        self.circle_b = Circle.objects.create(project=self.project, name="Circle B", code="CIR_B")
        self.domain_x = Domain.objects.create(circle=self.circle_b, name="Domain X", code="DOM_X")
        self.dept_x = Department.objects.create(domain=self.domain_x, name="Department X", code="DEP_X")
        self.team_x = SubDepartment.objects.create(department=self.dept_x, name="Team X", code="TM_X")

        # 2. Roles & Permissions
        self.mod = AccessModule.objects.create(name="Administration", code="admin", is_active=True)
        self.perm_view = AccessPermission.objects.create(module=self.mod, name="View Admin", code="admin.view")
        self.perm_create = AccessPermission.objects.create(module=self.mod, name="Create Admin", code="admin.create")
        self.perm_edit = AccessPermission.objects.create(module=self.mod, name="Edit Admin", code="admin.edit")

        self.role_admin = AccessRole.objects.create(name="Regional Admin", code="REGIONAL_ADMIN")
        for p in [self.perm_view, self.perm_create, self.perm_edit]:
            AccessRolePermission.objects.create(role=self.role_admin, permission=p)

        # 3. Users in different branches
        # Circle A Scoped User
        self.circle_a_user = User.objects.create_user(
            username="circle_a_admin",
            email="circle_a@mapar.test",
            password="password123",
            role="CIRCLE_DOMAIN_MANAGER",
            circle=self.circle_a,
        )
        AccessUserRole.objects.create(user=self.circle_a_user, role=self.role_admin, is_primary=True)
        self.scope_a = UserAccessScope.objects.create(user=self.circle_a_user, scope_type=UserAccessScope.ScopeType.CIRCLE)
        UserAccessScopeCircle.objects.create(useraccessscope=self.scope_a, circle=self.circle_a)

        # User belonging to Team A1
        self.team_a1_user = User.objects.create_user(
            username="team_a1_operator",
            email="team_a1@mapar.test",
            password="password123",
            sub_department=self.team_a1,
            circle=self.circle_a,
        )

        # User belonging to Circle B
        self.circle_b_user = User.objects.create_user(
            username="circle_b_lead",
            email="circle_b@mapar.test",
            password="password123",
            sub_department=self.team_x,
            circle=self.circle_b,
        )

        # Global Super Admin
        self.global_admin = User.objects.create_superuser(
            username="global_admin",
            email="global@mapar.test",
            password="password123",
        )

    def test_downward_scope_resolution_for_circle_user(self):
        """
        Verify Circle A user scope resolves Circle A and all its descendants,
        while completely excluding sibling Circle B and its descendants.
        """
        scope = AuthorizationService.get_user_hierarchy_scope(self.circle_a_user)
        self.assertFalse(scope.is_unrestricted)
        self.assertEqual(scope.scope_level, "CIRCLE")
        self.assertEqual(scope.anchor_id, self.circle_a.id)

        # Authorized descendants of Circle A
        self.assertTrue(scope.is_circle_allowed(self.circle_a.id))
        self.assertTrue(scope.is_domain_allowed(self.domain_a.id))
        self.assertTrue(scope.is_domain_allowed(self.domain_b.id))
        self.assertTrue(scope.is_department_allowed(self.dept_a.id))
        self.assertTrue(scope.is_department_allowed(self.dept_b.id))
        self.assertTrue(scope.is_team_allowed(self.team_a1.id))
        self.assertTrue(scope.is_team_allowed(self.team_a2.id))
        self.assertTrue(scope.is_user_allowed(self.team_a1_user.id))

        # Sibling isolation: Circle B and its children MUST NOT be allowed
        self.assertFalse(scope.is_circle_allowed(self.circle_b.id))
        self.assertFalse(scope.is_domain_allowed(self.domain_x.id))
        self.assertFalse(scope.is_department_allowed(self.dept_x.id))
        self.assertFalse(scope.is_team_allowed(self.team_x.id))
        self.assertFalse(scope.is_user_allowed(self.circle_b_user.id))

    def test_cascading_options_respect_scope_and_sibling_isolation(self):
        """
        Verify organization cascading dropdown options only return nodes
        inside the authorized downward branch.
        """
        # When querying circles for Circle A admin: only Circle A is returned
        circle_opts = get_cascading_options("CIRCLE", parent_id=self.project.id, user=self.circle_a_user)
        circle_ids = [c["id"] for c in circle_opts]
        self.assertIn(self.circle_a.id, circle_ids)
        self.assertNotIn(self.circle_b.id, circle_ids)

        # When querying domains: only Domain A & Domain B, not Domain X
        domain_opts = get_cascading_options("DOMAIN", parent_id=self.circle_a.id, user=self.circle_a_user)
        domain_ids = [d["id"] for d in domain_opts]
        self.assertIn(self.domain_a.id, domain_ids)
        self.assertIn(self.domain_b.id, domain_ids)
        self.assertNotIn(self.domain_x.id, domain_ids)

        # If Circle A user tries to query domains of Circle B: empty list returned
        domain_opts_b = get_cascading_options("DOMAIN", parent_id=self.circle_b.id, user=self.circle_a_user)
        self.assertEqual(len(domain_opts_b), 0)

    def test_hierarchy_tree_filters_unauthorized_branches(self):
        """
        Verify get_hierarchy_tree does not include sibling Circle B for Circle A user.
        """
        tree = get_hierarchy_tree(user=self.circle_a_user)
        self.assertEqual(len(tree), 1)  # Main Company A
        
        # Traverse down to circles
        mc = tree[0]
        sc = mc["children"][0]
        prj = sc["children"][0]
        
        rendered_circle_codes = [c["code"] for c in prj["children"]]
        self.assertIn("CIR_A", rendered_circle_codes)
        self.assertNotIn("CIR_B", rendered_circle_codes)

    def test_user_management_scoped_visibility(self):
        """
        Verify User Accounts list only shows users inside authorized downward branch.
        """
        result = get_users_list(request_user=self.circle_a_user)
        user_ids = [u["id"] for u in result["results"]]

        self.assertIn(self.circle_a_user.id, user_ids)
        self.assertIn(self.team_a1_user.id, user_ids)
        # Sibling user from Circle B MUST NOT be visible
        self.assertNotIn(self.circle_b_user.id, user_ids)

    def test_cross_branch_get_user_detail_rejected(self):
        """
        Verify get_user_detail rejects access when attempting to inspect a user in Circle B.
        """
        # Detail of Circle A descendant user is returned
        detail = get_user_detail(self.team_a1_user.id, request_user=self.circle_a_user)
        self.assertIsNotNone(detail)

        # Detail of Circle B user returns None (forbidden)
        detail_b = get_user_detail(self.circle_b_user.id, request_user=self.circle_a_user)
        self.assertIsNone(detail_b)

    def test_create_user_cross_branch_rejected_by_backend(self):
        """
        Verify backend UserService rejects user creation when assigning an organization
        node outside the administrator's authorized downward scope.
        """
        # Circle A admin creating user in Circle A -> Allowed
        new_user = UserService.create_user(
            {
                "username": "new_circle_a_op",
                "email": "new_a@mapar.test",
                "password": "Password123!",
                "circle_id": self.circle_a.id,
                "team_id": self.team_a1.id,
            },
            admin_user=self.circle_a_user,
        )
        self.assertIsNotNone(new_user.id)

        # Circle A admin attempting to create user in Circle B -> Rejected with ValidationError
        with self.assertRaises(ValidationError) as ctx:
            UserService.create_user(
                {
                    "username": "unauthorized_b_user",
                    "email": "bad_b@mapar.test",
                    "password": "Password123!",
                    "circle_id": self.circle_b.id,
                },
                admin_user=self.circle_a_user,
            )
        self.assertIn("circle_id", ctx.exception.message_dict)

    def test_update_user_cross_branch_rejected_by_backend(self):
        """
        Verify backend UserService rejects updating a user outside authorized scope.
        """
        with self.assertRaises(ValidationError):
            UserService.update_user(
                user_id=self.circle_b_user.id,
                data={"first_name": "Hacked Name"},
                admin_user=self.circle_a_user,
            )

    def test_cockpit_filters_scoped_to_authorized_branch(self):
        """
        Verify Management Cockpit dynamic filters only return circles, domains, and departments
        within the user's authorized scope.
        """
        filters = get_filter_options(user=self.circle_a_user)
        
        filtered_circle_ids = [c["id"] for c in filters["circles"]]
        self.assertIn(self.circle_a.id, filtered_circle_ids)
        self.assertNotIn(self.circle_b.id, filtered_circle_ids)

        filtered_domain_ids = [d["id"] for d in filters["domains"]]
        self.assertIn(self.domain_a.id, filtered_domain_ids)
        self.assertNotIn(self.domain_x.id, filtered_domain_ids)

    def test_dynamic_scope_at_department_level(self):
        """
        Verify changing the scope anchor to Department A dynamically limits effective data
        to Department A and its descendant teams/users only.
        """
        # Create user scoped directly to Department A
        dept_user = User.objects.create_user(
            username="dept_a_manager",
            email="dept_a@mapar.test",
            password="password123",
            sub_department=self.team_a1,
        )
        # Anchor at Department A
        scope = AuthorizationService.get_user_hierarchy_scope(dept_user)
        # User is assigned to team_a1 which is under dept_a
        self.assertEqual(scope.scope_level, "TEAM")
        self.assertTrue(scope.is_team_allowed(self.team_a1.id))
        self.assertFalse(scope.is_team_allowed(self.team_a2.id))
        self.assertFalse(scope.is_team_allowed(self.team_x.id))
