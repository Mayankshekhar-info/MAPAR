"""
Acceptance Test Suite: Odisha Circle CBH Role and Organization Scopes Only.
Tests the exact scenario specified by the user:
1. User with CBH role assigned in Enterprise Roles.
2. Configured in Access Scopes with Odisha Circle.
3. User sees authorized data belonging to Odisha Circle and permitted descendants.
4. User cannot see sibling circles (e.g. Rajasthan, Maharashtra).
5. Tests Sub Company scope, Project scope, and multiple node assignments.
6. Ensures direct record lookups and querysets enforce the scope boundary.
7. Ensures saving scope updates and persists correctly.
"""

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.identity.models import User
from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Domain,
    Department,
    SubDepartment,
)
from apps.authorization.models import AccessRole, UserAccessScope
from apps.authorization.services.scope_service import ScopeService
from apps.authorization.services.module_permission_service import AccessModuleService
from apps.users.services.user_service import UserService
from apps.users.selectors.user_selectors import get_user_detail
from apps.governance.models import GovernanceActionPoint
from apps.governance.selectors.governance_selectors import get_governance_actions
from apps.organization.selectors.organization_selectors import get_cascading_options, get_node_details
from common.permissions.authorization import AuthorizationService


class OdishaCircleCBHAcceptanceTestCase(TestCase):
    def setUp(self):
        # 1. Modules catalog
        AccessModuleService.ensure_application_modules()

        # 2. Main Company & Sub Companies
        self.company = MainCompany.objects.create(name="Apex Enterprise", code="APEX")
        self.sub_company_telecom = SubCompany.objects.create(
            main_company=self.company, name="Apex Telecom", code="APEX_TEL"
        )
        self.sub_company_energy = SubCompany.objects.create(
            main_company=self.company, name="Apex Energy", code="APEX_NRG"
        )

        # 3. Projects
        self.project_4g = Project.objects.create(
            sub_company=self.sub_company_telecom, name="4G Expansion", code="PRJ_4G"
        )
        self.project_solar = Project.objects.create(
            sub_company=self.sub_company_energy, name="Solar Field", code="PRJ_SOLAR"
        )

        # 4. Circles: Apex Direct Circle (Main Company), Odisha Circle (Target), Rajasthan Circle, Maharashtra Circle (Siblings)
        self.circle_apex_direct = Circle.objects.create(
            main_company=self.company, name="Apex Corporate Circle", code="APEX_CORP", region="North"
        )
        self.circle_odisha = Circle.objects.create(
            project=self.project_4g, name="Odisha Circle", code="OD_CIR", region="East"
        )
        self.circle_rajasthan = Circle.objects.create(
            project=self.project_4g, name="Rajasthan Circle", code="RJ_CIR", region="North"
        )
        self.circle_maharashtra = Circle.objects.create(
            project=self.project_4g, name="Maharashtra Circle", code="MH_CIR", region="West"
        )

        # 5. Domains & Departments under Odisha Circle
        self.domain_od_ops = Domain.objects.create(
            circle=self.circle_odisha, name="Network Operations", code="OD_OPS"
        )
        self.dept_od_rf = Department.objects.create(
            domain=self.domain_od_ops, name="RF Optimization", code="OD_RF"
        )
        self.team_od_field = SubDepartment.objects.create(
            department=self.dept_od_rf, name="Field Unit Alpha", code="OD_FLD_A"
        )

        # 6. Domains & Departments under Sibling Circle (Rajasthan)
        self.domain_rj_ops = Domain.objects.create(
            circle=self.circle_rajasthan, name="Network Operations", code="RJ_OPS"
        )
        self.dept_rj_rf = Department.objects.create(
            domain=self.domain_rj_ops, name="RF Optimization", code="RJ_RF"
        )

        # 7. Enterprise Roles & Permissions
        self.cbh_role, _ = AccessRole.objects.get_or_create(
            code="CBH",
            defaults={"name": "Circle Business Head", "description": "Circle Business Head role"}
        )
        from apps.authorization.models import AccessPermission, AccessRolePermission
        self.perm_view, _ = AccessPermission.objects.get_or_create(
            code="governance.view",
            defaults={"name": "View Governance", "module": "governance", "action": "view"}
        )
        self.perm_create, _ = AccessPermission.objects.get_or_create(
            code="governance.create",
            defaults={"name": "Create Governance", "module": "governance", "action": "create"}
        )
        AccessRolePermission.objects.get_or_create(role=self.cbh_role, permission=self.perm_view)
        AccessRolePermission.objects.get_or_create(role=self.cbh_role, permission=self.perm_create)

        # 8. Superadmin user for making management calls
        self.admin_user = User.objects.create_superuser("admin_super", "admin@apex.test", "AdminPass123!")

        # 9. Sample records in Odisha, Rajasthan, and Maharashtra
        today = timezone.now().date()
        self.odisha_action = GovernanceActionPoint.objects.create(
            action_id="ACT-OD-001",
            circle=self.circle_odisha,
            action_point="Upgrade Bhubaneswar Sites",
            target_closure_date=today,
            hierarchy_level="CIRCLE",
            status=GovernanceActionPoint.Status.OPEN,
            priority=GovernanceActionPoint.Priority.HIGH,
        )
        self.rajasthan_action = GovernanceActionPoint.objects.create(
            action_id="ACT-RJ-001",
            circle=self.circle_rajasthan,
            action_point="Deploy Jaipur Routers",
            target_closure_date=today,
            hierarchy_level="CIRCLE",
            status=GovernanceActionPoint.Status.OPEN,
            priority=GovernanceActionPoint.Priority.HIGH,
        )
        self.maharashtra_action = GovernanceActionPoint.objects.create(
            action_id="ACT-MH-001",
            circle=self.circle_maharashtra,
            action_point="Audit Pune Core",
            target_closure_date=today,
            hierarchy_level="CIRCLE",
            status=GovernanceActionPoint.Status.OPEN,
            priority=GovernanceActionPoint.Priority.HIGH,
        )

    def test_odisha_circle_cbh_exact_scenario(self):
        """
        Verify:
        - User created in User Accounts with CBH role.
        - Assigned Odisha Circle scope in Access Scopes.
        - User sees only Odisha Circle records.
        - User CANNOT see Rajasthan or Maharashtra records.
        - Sibling circles and cross-branch data are strictly blocked.
        """
        # Step 1: Create user in User Accounts
        user = UserService.create_user(
            data={
                "username": "odisha_cbh_lead",
                "email": "cbh.odisha@apex.test",
                "first_name": "Priyanka",
                "last_name": "Mohanty",
                "password": "SecurePassword123!",
                "role": "CBH",
                "role_id": self.cbh_role.id,
            },
            admin_user=self.admin_user,
        )

        # Before scope is configured, user has no organization access
        initial_scope = AuthorizationService.get_user_hierarchy_scope(user)
        self.assertFalse(initial_scope.is_unrestricted)
        self.assertEqual(len(initial_scope.circle_ids or set()), 0)

        # Step 2: In Access Scopes, assign Odisha Circle scope
        ScopeService.sync_user_scopes(
            user=user,
            scopes_data=[
                {
                    "main_company_id": self.company.id,
                    "sub_company_id": self.sub_company_telecom.id,
                    "project_id": self.project_4g.id,
                    "circle_id": self.circle_odisha.id,
                    "can_view": True,
                    "can_manage": True,
                    "actions": ["view", "manage", "create", "update"],
                }
            ],
            admin_user=self.admin_user,
        )

        # Step 3: Reopen user detail and verify persisted scope
        detail = get_user_detail(user.id)
        self.assertIsNotNone(detail)
        self.assertEqual(len(detail["scopes"]), 1)
        scope_entry = detail["scopes"][0]
        self.assertEqual(scope_entry["circle_id"], self.circle_odisha.id)
        self.assertEqual(scope_entry["circle_name"], "Odisha Circle")
        self.assertEqual(scope_entry["anchor_level"], "CIRCLE")
        self.assertIn("Odisha Circle", scope_entry["hierarchy_breadcrumb"])

        # Step 4: Verify Hierarchy Scope resolution
        scope = AuthorizationService.get_user_hierarchy_scope(user)
        self.assertFalse(scope.is_unrestricted)
        circle_ids = scope.circle_ids or set()
        domain_ids = scope.domain_ids or set()
        dept_ids = scope.department_ids or set()
        team_ids = scope.team_ids or set()

        self.assertIn(self.circle_odisha.id, circle_ids)
        self.assertNotIn(self.circle_rajasthan.id, circle_ids)
        self.assertNotIn(self.circle_maharashtra.id, circle_ids)

        # Permitted descendants (Domain, Department, Team under Odisha) are accessible
        self.assertIn(self.domain_od_ops.id, domain_ids)
        self.assertIn(self.dept_od_rf.id, dept_ids)
        self.assertIn(self.team_od_field.id, team_ids)

        # Sibling descendants (Domain, Department under Rajasthan) are NOT accessible
        self.assertNotIn(self.domain_rj_ops.id, domain_ids)
        self.assertNotIn(self.dept_rj_rf.id, dept_ids)

        # Step 5: Queryset filtering: Governance Action Points
        visible_actions = get_governance_actions({}, user=user)
        visible_ids = [a.id for a in visible_actions]
        self.assertIn(self.odisha_action.id, visible_ids)
        self.assertNotIn(self.rajasthan_action.id, visible_ids)
        self.assertNotIn(self.maharashtra_action.id, visible_ids)

        # Step 6: Direct record access check via AuthorizationService.can
        self.assertTrue(
            AuthorizationService.can(
                user=user,
                permission="governance.view",
                resource=self.odisha_action,
                action="view",
            )
        )
        self.assertFalse(
            AuthorizationService.can(
                user=user,
                permission="governance.view",
                resource=self.rajasthan_action,
                action="view",
            )
        )
        self.assertFalse(
            AuthorizationService.can(
                user=user,
                permission="governance.view",
                resource=self.maharashtra_action,
                action="view",
            )
        )

    def test_sub_company_scope_limits_to_sub_company_branch(self):
        """
        Verify that assigning a Sub Company scope allows all descendants beneath that Sub Company,
        while completely blocking access to sibling Sub Companies.
        """
        user = UserService.create_user(
            data={
                "username": "energy_manager",
                "email": "energy@apex.test",
                "password": "SecurePassword123!",
                "role": "CBH",
                "role_id": self.cbh_role.id,
            },
            admin_user=self.admin_user,
        )

        ScopeService.sync_user_scopes(
            user=user,
            scopes_data=[
                {
                    "main_company_id": self.company.id,
                    "sub_company_id": self.sub_company_energy.id,
                    "can_view": True,
                    "actions": ["view"],
                }
            ],
            admin_user=self.admin_user,
        )

        scope = AuthorizationService.get_user_hierarchy_scope(user)
        self.assertFalse(scope.is_unrestricted)
        sub_co_ids = scope.sub_company_ids or set()
        project_ids = scope.project_ids or set()
        self.assertIn(self.sub_company_energy.id, sub_co_ids)
        self.assertIn(self.project_solar.id, project_ids)

        # Telecom SubCompany and its projects/circles are blocked
        self.assertNotIn(self.sub_company_telecom.id, sub_co_ids)
        self.assertNotIn(self.project_4g.id, project_ids)
        self.assertNotIn(self.circle_odisha.id, scope.circle_ids or set())

    def test_multiple_circle_scope_assignment(self):
        """
        Verify that assigning multiple specific circles (Odisha + Rajasthan) grants access to both,
        without granting access to sibling circles (Maharashtra) or entire company.
        """
        user = UserService.create_user(
            data={
                "username": "regional_lead",
                "email": "regional@apex.test",
                "password": "SecurePassword123!",
                "role": "CBH",
                "role_id": self.cbh_role.id,
            },
            admin_user=self.admin_user,
        )

        ScopeService.sync_user_scopes(
            user=user,
            scopes_data=[
                {
                    "main_company_id": self.company.id,
                    "project_id": self.project_4g.id,
                    "circle_id": self.circle_odisha.id,
                    "actions": ["view"],
                },
                {
                    "main_company_id": self.company.id,
                    "project_id": self.project_4g.id,
                    "circle_id": self.circle_rajasthan.id,
                    "actions": ["view"],
                },
            ],
            admin_user=self.admin_user,
        )

        scope = AuthorizationService.get_user_hierarchy_scope(user)
        circle_ids = scope.circle_ids or set()
        self.assertIn(self.circle_odisha.id, circle_ids)
        self.assertIn(self.circle_rajasthan.id, circle_ids)
        self.assertNotIn(self.circle_maharashtra.id, circle_ids)

        # Queryset returns both Odisha and Rajasthan actions, but not Maharashtra
        actions = get_governance_actions({}, user=user)
        action_ids = [a.id for a in actions]
        self.assertIn(self.odisha_action.id, action_ids)
        self.assertIn(self.rajasthan_action.id, action_ids)
        self.assertNotIn(self.maharashtra_action.id, action_ids)

    def test_individual_circle_removal_preserves_other_assignments(self):
        """
        Verify that when a user has multiple circles assigned, removing one individual circle:
        1. Deletes only that circle's scope from the database.
        2. Preserves the user's other assigned circles intact.
        3. Immediately stops access to the removed circle while maintaining access to the remaining circle.
        4. Keeps unassigned circles strictly blocked.
        """
        user = UserService.create_user(
            data={
                "username": "multi_circle_user",
                "email": "multi@apex.test",
                "password": "SecurePassword123!",
                "role": "CBH",
                "role_id": self.cbh_role.id,
            },
            admin_user=self.admin_user,
        )

        # 1. Assign both Odisha Circle and Rajasthan Circle
        ScopeService.sync_user_scopes(
            user=user,
            scopes_data=[
                {
                    "main_company_id": self.company.id,
                    "project_id": self.project_4g.id,
                    "circle_id": self.circle_odisha.id,
                    "actions": ["view"],
                },
                {
                    "main_company_id": self.company.id,
                    "project_id": self.project_4g.id,
                    "circle_id": self.circle_rajasthan.id,
                    "actions": ["view"],
                },
            ],
            admin_user=self.admin_user,
        )

        user_scopes = UserAccessScope.objects.filter(user=user)
        self.assertEqual(user_scopes.count(), 2)

        # 2. Simulate user editing scopes: remove Odisha Circle, keep only Rajasthan Circle
        rajasthan_scope_obj = user_scopes.filter(circle_id=self.circle_rajasthan.id).first()
        self.assertIsNotNone(rajasthan_scope_obj)

        UserService.update_user(
            user_id=user.id,
            data={
                "scopes": [
                    {
                        "id": rajasthan_scope_obj.id,
                        "main_company_id": self.company.id,
                        "project_id": self.project_4g.id,
                        "circle_id": self.circle_rajasthan.id,
                        "actions": ["view"],
                    }
                ]
            },
            admin_user=self.admin_user,
        )

        # 3. Database check: only 1 scope remains in DB (Rajasthan)
        remaining_scopes = UserAccessScope.objects.filter(user=user)
        self.assertEqual(remaining_scopes.count(), 1)
        remaining_scope = remaining_scopes.first()
        self.assertIsNotNone(remaining_scope)
        self.assertEqual(getattr(remaining_scope, "circle_id", None), self.circle_rajasthan.id)

        # 4. Scope evaluator check: Odisha is now blocked, Rajasthan is allowed, Maharashtra remains blocked
        scope = AuthorizationService.get_user_hierarchy_scope(user)
        scope_circles = scope.circle_ids or set()
        self.assertIn(self.circle_rajasthan.id, scope_circles)
        self.assertNotIn(self.circle_odisha.id, scope_circles)
        self.assertNotIn(self.circle_maharashtra.id, scope_circles)

        # 5. Queryset check: user can only see Rajasthan records
        actions = get_governance_actions({}, user=user)
        action_ids = [a.id for a in actions]
        self.assertIn(self.rajasthan_action.id, action_ids)
        self.assertNotIn(self.odisha_action.id, action_ids)
        self.assertNotIn(self.maharashtra_action.id, action_ids)

    def test_main_and_sub_company_hierarchy_details(self):
        """
        Verify that selecting Main Company or Sub Company returns complete, accurate
        hierarchy summary and descendant details without mixing data from unrelated entities.
        """
        # Test Main Company details
        mc_details = get_node_details("MAIN_COMPANY", self.company.id)
        self.assertIsNotNone(mc_details)
        self.assertEqual(mc_details["name"], "Apex Enterprise")
        summary = mc_details.get("hierarchy_summary")
        self.assertIsNotNone(summary)
        self.assertEqual(summary["level"], "MAIN_COMPANY")
        self.assertEqual(summary["sub_companies_count"], 2)
        self.assertEqual(summary["projects_count"], 2)
        self.assertEqual(summary["direct_circles_count"], 1)
        self.assertEqual(summary["circles_count"], 1)
        self.assertEqual(summary["sub_company_circles_count"], 3)
        self.assertEqual(summary["total_descendant_circles_count"], 4)
        direct_codes = [c["code"] for c in summary["circles"]]
        self.assertIn("APEX_CORP", direct_codes)
        sub_co_codes = [c["code"] for c in summary["sub_company_circles"]]
        self.assertIn("OD_CIR", sub_co_codes)
        self.assertIn("RJ_CIR", sub_co_codes)
        self.assertIn("MH_CIR", sub_co_codes)

        # Test Sub Company details
        sc_details = get_node_details("SUB_COMPANY", self.sub_company_telecom.id)
        self.assertIsNotNone(sc_details)
        self.assertEqual(sc_details["name"], "Apex Telecom")
        sc_summary = sc_details.get("hierarchy_summary")
        self.assertIsNotNone(sc_summary)
        self.assertEqual(sc_summary["level"], "SUB_COMPANY")
        self.assertEqual(sc_summary["main_company"]["id"], self.company.id)
        self.assertEqual(sc_summary["projects_count"], 1)
        self.assertEqual(sc_summary["circles_count"], 3)
        self.assertEqual(sc_summary["projects"][0]["code"], "PRJ_4G")

    def test_cascading_options_strictly_isolates_by_company_and_sub_company(self):
        """
        Verify that passing company_id or sub_company_id to get_cascading_options
        strictly filters options to only those belonging to that company/sub-company.
        """
        # Create an unrelated second company with its own direct circle, sub company, project, and circle
        beta_co = MainCompany.objects.create(name="Beta Industries", code="BETA")
        beta_direct_cir = Circle.objects.create(main_company=beta_co, name="Beta Direct Circle", code="BETA_DIR")
        beta_sub = SubCompany.objects.create(main_company=beta_co, name="Beta Infra", code="BETA_INFRA")
        beta_prj = Project.objects.create(sub_company=beta_sub, name="Beta Grid", code="BETA_GRID")
        beta_cir = Circle.objects.create(project=beta_prj, name="Beta Circle", code="BETA_CIR")

        # 1. Query circles filtering by Apex Enterprise (self.company) - returns only direct circles
        apex_circles = get_cascading_options("CIRCLE", company_id=self.company.id)
        apex_circle_ids = [c["id"] for c in apex_circles]
        self.assertIn(self.circle_apex_direct.id, apex_circle_ids)
        self.assertNotIn(beta_direct_cir.id, apex_circle_ids)
        self.assertNotIn(beta_cir.id, apex_circle_ids)
        self.assertNotIn(self.circle_odisha.id, apex_circle_ids)

        # 2. Query circles filtering by Beta Industries
        beta_circles = get_cascading_options("CIRCLE", company_id=beta_co.id)
        beta_circle_ids = [c["id"] for c in beta_circles]
        self.assertIn(beta_direct_cir.id, beta_circle_ids)
        self.assertNotIn(self.circle_apex_direct.id, beta_circle_ids)
        self.assertNotIn(self.circle_odisha.id, beta_circle_ids)

        # 3. Query circles filtering by Sub Company Telecom
        telecom_circles = get_cascading_options("CIRCLE", sub_company_id=self.sub_company_telecom.id)
        telecom_circle_ids = [c["id"] for c in telecom_circles]
        self.assertIn(self.circle_odisha.id, telecom_circle_ids)
        self.assertIn(self.circle_rajasthan.id, telecom_circle_ids)
        self.assertIn(self.circle_maharashtra.id, telecom_circle_ids)
        self.assertNotIn(beta_cir.id, telecom_circle_ids)
        self.assertNotIn(self.circle_apex_direct.id, telecom_circle_ids)

