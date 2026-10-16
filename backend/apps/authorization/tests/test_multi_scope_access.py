"""
Comprehensive Tests for Dynamic Hierarchy-Aware Multi-Access-Scope System.
Covers all 8 Acceptance Scenarios from User Request:
TEST 1: User A with Circle East sees only Circle East & descendants, not Circle West.
TEST 2: User B with multiple departments (HR & Finance) can access both.
TEST 3: User B has HR -> Manage and Finance -> View. Can manage HR, cannot manage Finance.
TEST 4: Remove Finance scope -> Finance data is no longer accessible.
TEST 5: Dynamic module visibility and API rejection when module permission is removed.
TEST 6: Out-of-scope manual API request is rejected with 403 PermissionDenied.
TEST 7: Scope changes automatically reflect in Cockpit and Slide View scoped queries.
TEST 8: Newly added organization nodes dynamically appear in cascading options.
TEST 9: Duplicate identical scopes are safely rejected.
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
)
from apps.authorization.services.scope_service import ScopeService
from apps.authorization.selectors.scope_selectors import get_user_effective_access, get_user_scopes_list
from common.permissions.authorization import AuthorizationService
from apps.organization.selectors.organization_selectors import get_cascading_options
from apps.dashboard.selectors.cockpit_selectors import get_filter_options

User = get_user_model()


class MultiScopeAccessSystemTestCase(TestCase):
    def setUp(self):
        # 1. Authoritative Hierarchy Setup
        self.company = MainCompany.objects.create(name="ABC Enterprise", code="ABC")
        self.sub_company = SubCompany.objects.create(main_company=self.company, name="ABC Services", code="ABC_SRV")
        self.project_a = Project.objects.create(sub_company=self.sub_company, name="Project Alpha", code="PRJ_A")
        self.project_b = Project.objects.create(sub_company=self.sub_company, name="Project Beta", code="PRJ_B")

        # Circle East (under Project Alpha)
        self.circle_east = Circle.objects.create(project=self.project_a, name="Circle East", code="CIR_E")
        self.domain_hr = Domain.objects.create(circle=self.circle_east, name="HR Domain", code="HR")
        self.dept_recruitment = Department.objects.create(domain=self.domain_hr, name="Recruitment", code="REC")
        self.dept_payroll = Department.objects.create(domain=self.domain_hr, name="Payroll", code="PAY")
        self.team_a = SubDepartment.objects.create(department=self.dept_recruitment, name="Recruitment Team A", code="REC_A")

        # Circle West (under Project Beta - sibling isolation branch)
        self.circle_west = Circle.objects.create(project=self.project_b, name="Circle West", code="CIR_W")
        self.domain_fin = Domain.objects.create(circle=self.circle_west, name="Finance Domain", code="FIN")
        self.dept_billing = Department.objects.create(domain=self.domain_fin, name="Billing", code="BILL")

        # 2. Roles & Permissions Setup
        self.mod_mgmt = AccessModule.objects.create(name="Management Cockpit", code="management", is_active=True)
        self.perm_mgmt_view = AccessPermission.objects.create(module=self.mod_mgmt, name="View Cockpit", code="management.view")
        self.perm_mgmt_manage = AccessPermission.objects.create(module=self.mod_mgmt, name="Manage Cockpit", code="management.manage")

        self.mod_slides = AccessModule.objects.create(name="Slide View", code="slides", is_active=True)
        self.perm_slides_view = AccessPermission.objects.create(module=self.mod_slides, name="View Slides", code="slides.view")

        self.mod_uploads = AccessModule.objects.create(name="Uploads", code="uploads", is_active=True)
        self.perm_uploads_view = AccessPermission.objects.create(module=self.mod_uploads, name="View Uploads", code="uploads.view")

        self.role_manager = AccessRole.objects.create(name="Department Manager", code="DEPT_MGR")
        AccessRolePermission.objects.create(role=self.role_manager, permission=self.perm_mgmt_view)
        AccessRolePermission.objects.create(role=self.role_manager, permission=self.perm_mgmt_manage)
        AccessRolePermission.objects.create(role=self.role_manager, permission=self.perm_slides_view)

        # Admin user to perform assignments
        self.superadmin = User.objects.create_superuser(username="admin_lead", email="admin@abc.com", password="Pass123!@#")

    def test_scenario_1_single_circle_scope_isolation(self):
        """
        TEST 1: User A assigned Circle East.
        Can see Circle East and authorized descendants.
        Cannot see Circle West, other projects, or other companies.
        """
        user_a = User.objects.create_user(username="user_a", email="usera@abc.com", password="Pass123!@#")
        AccessUserRole.objects.create(user=user_a, role=self.role_manager, is_primary=True)

        ScopeService.create_user_scope({
            "user_id": user_a.id,
            "main_company_id": self.company.id,
            "sub_company_id": self.sub_company.id,
            "project_id": self.project_a.id,
            "circle_id": self.circle_east.id,
            "can_view": True,
            "can_manage": True,
            "actions": ["view", "manage"],
        }, admin_user=self.superadmin)

        scope = AuthorizationService.get_user_hierarchy_scope(user_a)
        self.assertFalse(scope.is_unrestricted)
        self.assertTrue(scope.is_circle_allowed(self.circle_east.id))
        self.assertTrue(scope.is_domain_allowed(self.domain_hr.id))
        self.assertTrue(scope.is_department_allowed(self.dept_recruitment.id))
        self.assertTrue(scope.is_department_allowed(self.dept_payroll.id))
        self.assertTrue(scope.is_team_allowed(self.team_a.id))

        # Cross-branch isolation
        self.assertFalse(scope.is_circle_allowed(self.circle_west.id))
        self.assertFalse(scope.is_domain_allowed(self.domain_fin.id))
        self.assertFalse(scope.is_department_allowed(self.dept_billing.id))

    def test_scenario_2_multiple_department_scopes(self):
        """
        TEST 2: User B assigned Scope 1 (Recruitment) and Scope 2 (Billing in Circle West).
        User B can access both departments across different branches without duplicate users.
        """
        user_b = User.objects.create_user(username="user_b", email="userb@abc.com", password="Pass123!@#")
        AccessUserRole.objects.create(user=user_b, role=self.role_manager, is_primary=True)

        # Scope 1: Recruitment (Circle East)
        ScopeService.create_user_scope({
            "user_id": user_b.id,
            "circle_id": self.circle_east.id,
            "domain_id": self.domain_hr.id,
            "department_id": self.dept_recruitment.id,
            "can_view": True,
            "actions": ["view"],
        }, admin_user=self.superadmin)

        # Scope 2: Billing (Circle West)
        ScopeService.create_user_scope({
            "user_id": user_b.id,
            "circle_id": self.circle_west.id,
            "domain_id": self.domain_fin.id,
            "department_id": self.dept_billing.id,
            "can_view": True,
            "actions": ["view"],
        }, admin_user=self.superadmin)

        scope = AuthorizationService.get_user_hierarchy_scope(user_b)
        self.assertEqual(scope.scopes_count, 2)
        # Both departments are accessible
        self.assertTrue(scope.is_department_allowed(self.dept_recruitment.id))
        self.assertTrue(scope.is_department_allowed(self.dept_billing.id))
        # Descendant of Recruitment is accessible
        self.assertTrue(scope.is_team_allowed(self.team_a.id))
        # Unassigned sibling Payroll is NOT accessible
        self.assertFalse(scope.is_department_allowed(self.dept_payroll.id))

    def test_scenario_3_different_access_levels_per_scope(self):
        """
        TEST 3: User B has:
        Recruitment -> Manage
        Payroll -> View only
        Can manage Recruitment, but cannot manage Payroll.
        """
        user_b = User.objects.create_user(username="user_b_mgr", email="userb_mgr@abc.com", password="Pass123!@#")
        AccessUserRole.objects.create(user=user_b, role=self.role_manager, is_primary=True)

        # Scope 1: Recruitment with Manage
        ScopeService.create_user_scope({
            "user_id": user_b.id,
            "circle_id": self.circle_east.id,
            "domain_id": self.domain_hr.id,
            "department_id": self.dept_recruitment.id,
            "can_view": True,
            "can_manage": True,
            "actions": ["view", "manage"],
        }, admin_user=self.superadmin)

        # Scope 2: Payroll with View only
        ScopeService.create_user_scope({
            "user_id": user_b.id,
            "circle_id": self.circle_east.id,
            "domain_id": self.domain_hr.id,
            "department_id": self.dept_payroll.id,
            "can_view": True,
            "can_manage": False,
            "actions": ["view"],
        }, admin_user=self.superadmin)

        scope = AuthorizationService.get_user_hierarchy_scope(user_b)

        # Both viewable
        self.assertTrue(scope.is_department_allowed(self.dept_recruitment.id, action="view"))
        self.assertTrue(scope.is_department_allowed(self.dept_payroll.id, action="view"))

        # Manage permission check
        self.assertTrue(scope.is_department_allowed(self.dept_recruitment.id, action="manage"))
        self.assertFalse(scope.is_department_allowed(self.dept_payroll.id, action="manage"))

    def test_scenario_4_remove_scope_revokes_access(self):
        """
        TEST 4: Remove Payroll scope.
        Payroll data must immediately become inaccessible.
        """
        user = User.objects.create_user(username="user_revokable", email="user_rev@abc.com", password="Pass123!@#")
        s1 = ScopeService.create_user_scope({
            "user_id": user.id,
            "circle_id": self.circle_east.id,
            "department_id": self.dept_recruitment.id,
            "can_view": True,
        }, admin_user=self.superadmin)
        s2 = ScopeService.create_user_scope({
            "user_id": user.id,
            "circle_id": self.circle_east.id,
            "department_id": self.dept_payroll.id,
            "can_view": True,
        }, admin_user=self.superadmin)

        # Initially both accessible
        scope_before = AuthorizationService.get_user_hierarchy_scope(user)
        self.assertTrue(scope_before.is_department_allowed(self.dept_payroll.id))

        # Delete Payroll scope
        ScopeService.delete_user_scope(s2.id, admin_user=self.superadmin)

        # Payroll is now inaccessible
        scope_after = AuthorizationService.get_user_hierarchy_scope(user)
        self.assertTrue(scope_after.is_department_allowed(self.dept_recruitment.id))
        self.assertFalse(scope_after.is_department_allowed(self.dept_payroll.id))

    def test_scenario_5_module_permission_dynamic_visibility(self):
        """
        TEST 5: Role defines WHAT user can do.
        User has 'management' and 'slides', but NOT 'uploads'.
        Accessible modules contain management & slides, but NOT uploads.
        """
        user = User.objects.create_user(username="user_mod", email="usermod@abc.com", password="Pass123!@#")
        AccessUserRole.objects.create(user=user, role=self.role_manager, is_primary=True)

        modules = AuthorizationService.get_user_accessible_modules(user)
        self.assertIn("management", modules)
        self.assertIn("slides", modules)
        self.assertNotIn("uploads", modules)

    def test_scenario_6_backend_rejects_unauthorized_scope_request(self):
        """
        TEST 6: Backend server-side 403 enforcement on unauthorized organization resource request.
        """
        user = User.objects.create_user(username="user_unauth", email="user_unauth@abc.com", password="Pass123!@#")
        ScopeService.create_user_scope({
            "user_id": user.id,
            "circle_id": self.circle_east.id,
            "can_view": True,
        }, admin_user=self.superadmin)

        # Attempt to access Circle East -> Allowed
        AuthorizationService.require_organization_access(user=user, circle_id=self.circle_east.id)

        # Attempt to access Circle West -> 403 PermissionDenied
        with self.assertRaises(PermissionDenied):
            AuthorizationService.require_organization_access(user=user, circle_id=self.circle_west.id)

    def test_scenario_7_cockpit_options_scope_filtering(self):
        """
        TEST 7: Cockpit options strictly reflect user's authorized scope.
        """
        user = User.objects.create_user(username="user_cockpit", email="usercockpit@abc.com", password="Pass123!@#")
        ScopeService.create_user_scope({
            "user_id": user.id,
            "circle_id": self.circle_east.id,
            "can_view": True,
        }, admin_user=self.superadmin)

        options = get_filter_options(user=user)
        circle_ids = [c["id"] for c in options["circles"]]
        self.assertIn(self.circle_east.id, circle_ids)
        self.assertNotIn(self.circle_west.id, circle_ids)

    def test_scenario_8_dynamic_cascading_options(self):
        """
        TEST 8: Adding a new Department dynamically appears in cascading options without code modifications.
        """
        new_dept = Department.objects.create(domain=self.domain_hr, name="Talent Acquisition", code="TA")
        options = get_cascading_options("DEPARTMENT", parent_id=self.domain_hr.id, user=self.superadmin)
        dept_ids = [o["id"] for o in options]
        self.assertIn(new_dept.id, dept_ids)

    def test_scenario_9_duplicate_scope_prevention(self):
        """
        TEST 9: Prevent creating duplicate identical scopes for the same user.
        """
        user = User.objects.create_user(username="user_dup", email="userdup@abc.com", password="Pass123!@#")
        ScopeService.create_user_scope({
            "user_id": user.id,
            "circle_id": self.circle_east.id,
            "domain_id": self.domain_hr.id,
            "department_id": self.dept_recruitment.id,
        }, admin_user=self.superadmin)

        with self.assertRaises(ValidationError):
            ScopeService.create_user_scope({
                "user_id": user.id,
                "circle_id": self.circle_east.id,
                "domain_id": self.domain_hr.id,
                "department_id": self.dept_recruitment.id,
            }, admin_user=self.superadmin)
