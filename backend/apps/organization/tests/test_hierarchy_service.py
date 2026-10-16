from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Domain,
    Department,
    SubDepartment,
    HierarchyAuditLog,
)
from apps.organization.services.organization_service import OrganizationHierarchyService
from apps.organization.selectors.organization_selectors import (
    get_hierarchy_summary,
    get_hierarchy_tree,
    get_node_details,
    get_cascading_options,
)

User = get_user_model()


class OrganizationHierarchyTests(TestCase):

    def test_full_hierarchy_lifecycle(self):
        # 1. Create Main Company
        main_co = OrganizationHierarchyService.create_node(
            level="MAIN_COMPANY",
            name="Telecrats Global Holding",
            code="TC_HOLDING",
            description="Enterprise parent corporation",
        )
        self.assertIsNotNone(main_co["id"])
        self.assertEqual(main_co["level"], "MAIN_COMPANY")

        # 2. Create Sub Company under Main Company
        sub_co = OrganizationHierarchyService.create_node(
            level="SUB_COMPANY",
            name="Telecrats Infra Private Limited",
            code="TC_INFRA",
            parent_id=main_co["id"],
        )
        self.assertIsNotNone(sub_co["id"])
        self.assertEqual(sub_co["parent_id"], main_co["id"])

        # 3. Create Project under Sub Company
        prj = OrganizationHierarchyService.create_node(
            level="PROJECT",
            name="National Optical Fiber Expansion",
            code="PRJ_NOFN",
            parent_id=sub_co["id"],
        )
        self.assertIsNotNone(prj["id"])

        # 4. Create Circle under Project
        cir = OrganizationHierarchyService.create_node(
            level="CIRCLE",
            name="Rajasthan Circle",
            code="RJ_NORTH",
            parent_id=prj["id"],
            extra_fields={"region": "North"},
        )
        self.assertIsNotNone(cir["id"])

        # 5. Create Domain under Circle
        dom = OrganizationHierarchyService.create_node(
            level="DOMAIN",
            name="Operations & Maintenance",
            code="OM_DOMAIN",
            parent_id=cir["id"],
        )
        self.assertIsNotNone(dom["id"])

        # 6. Create Department under Domain
        dept = OrganizationHierarchyService.create_node(
            level="DEPARTMENT",
            name="Field Engineering",
            code="FIELD_ENG",
            parent_id=dom["id"],
        )
        self.assertIsNotNone(dept["id"])

        # 7. Create Sub Department under Department
        subdept = OrganizationHierarchyService.create_node(
            level="SUB_DEPARTMENT",
            name="Fiber Splicing & Testing Unit",
            code="SPLICING_UNIT",
            parent_id=dept["id"],
        )
        self.assertIsNotNone(subdept["id"])

        # Verify dynamic counts from DB
        summary = get_hierarchy_summary()
        self.assertGreaterEqual(summary["main_companies"], 1)
        self.assertGreaterEqual(summary["sub_companies"], 1)
        self.assertGreaterEqual(summary["projects"], 1)
        self.assertGreaterEqual(summary["departments"], 1)
        self.assertGreaterEqual(summary["sub_departments"], 1)

        # Verify tree hierarchy nesting
        tree = get_hierarchy_tree()
        found_main = next((m for m in tree if m["code"] == "TC_HOLDING"), None)
        self.assertIsNotNone(found_main)
        found_sub = next((s for s in found_main["children"] if s["code"] == "TC_INFRA"), None)
        self.assertIsNotNone(found_sub)
        found_prj = next((p for p in found_sub["children"] if p["code"] == "PRJ_NOFN"), None)
        self.assertIsNotNone(found_prj)
        found_cir = next((c for c in found_prj["children"] if c["code"] == "RJ_NORTH"), None)
        self.assertIsNotNone(found_cir)
        found_dom = next((d for d in found_cir["children"] if d["code"] == "OM_DOMAIN"), None)
        self.assertIsNotNone(found_dom)
        found_dept = next((dp for dp in found_dom["children"] if dp["code"] == "FIELD_ENG"), None)
        self.assertIsNotNone(found_dept)
        found_subdept = next((sdp for sdp in found_dept["children"] if sdp["code"] == "SPLICING_UNIT"), None)
        self.assertIsNotNone(found_subdept)

        # Verify node details inspector
        details = get_node_details("DEPARTMENT", dept["id"])
        self.assertEqual(details["name"], "Field Engineering")
        self.assertEqual(details["parent"]["name"], "Operations & Maintenance")
        self.assertEqual(details["children_count"], 1)
        self.assertEqual(details["allowed_child_level"], "SUB_DEPARTMENT")

        # Verify audit logs generated
        self.assertTrue(HierarchyAuditLog.objects.filter(level="SUB_DEPARTMENT", object_id=str(subdept["id"])).exists())

    def test_invalid_parent_rejection(self):
        # Sub Company without parent must fail
        with self.assertRaises(ValidationError):
            OrganizationHierarchyService.create_node(
                level="SUB_COMPANY",
                name="Orphan Sub Company",
                code="ORPHAN_SUB",
                parent_id=None,
            )

        # Project under nonexistent parent must fail
        with self.assertRaises(ValidationError):
            OrganizationHierarchyService.create_node(
                level="PROJECT",
                name="Invalid Project",
                code="INV_PRJ",
                parent_id=999999,
            )

    def test_delete_protection_with_children(self):
        main_co = OrganizationHierarchyService.create_node(
            level="MAIN_COMPANY",
            name="Parent Corp",
            code="PARENT_CORP",
        )
        sub_co = OrganizationHierarchyService.create_node(
            level="SUB_COMPANY",
            name="Child Sub Corp",
            code="CHILD_SUB",
            parent_id=main_co["id"],
        )

        # Attempting to delete Parent Corp while Child Sub Corp exists must raise ValidationError
        with self.assertRaises(ValidationError):
            OrganizationHierarchyService.delete_node("MAIN_COMPANY", main_co["id"])

        # After deleting the child, deleting parent succeeds
        OrganizationHierarchyService.delete_node("SUB_COMPANY", sub_co["id"])
        del_res = OrganizationHierarchyService.delete_node("MAIN_COMPANY", main_co["id"])
        self.assertTrue(del_res["success"])

    def test_team_user_hierarchy_and_protection(self):
        # 1. Build hierarchy up to Team
        main_co = OrganizationHierarchyService.create_node(
            level="MAIN_COMPANY",
            name="Apex Telecoms",
            code="APEX_TEL",
        )
        sub_co = OrganizationHierarchyService.create_node(
            level="SUB_COMPANY",
            name="Apex Networks",
            code="APEX_NET",
            parent_id=main_co["id"],
        )
        prj = OrganizationHierarchyService.create_node(
            level="PROJECT",
            name="5G Fiber Rollout",
            code="PRJ_5G",
            parent_id=sub_co["id"],
        )
        cir = OrganizationHierarchyService.create_node(
            level="CIRCLE",
            name="Mumbai Metro",
            code="MUM_METRO",
            parent_id=prj["id"],
        )
        dom = OrganizationHierarchyService.create_node(
            level="DOMAIN",
            name="Infrastructure Maintenance",
            code="INFRA_MAINT",
            parent_id=cir["id"],
        )
        dept = OrganizationHierarchyService.create_node(
            level="DEPARTMENT",
            name="Field Operations",
            code="FIELD_OPS",
            parent_id=dom["id"],
        )
        team = OrganizationHierarchyService.create_node(
            level="TEAM",
            name="Alpha Quick Response Unit",
            code="TEAM_ALPHA",
            parent_id=dept["id"],
        )
        self.assertIsNotNone(team["id"])

        # 2. Check Team details before users
        team_detail = get_node_details("TEAM", team["id"])
        self.assertEqual(team_detail["name"], "Alpha Quick Response Unit")
        self.assertEqual(team_detail["parent"]["name"], "Field Operations")
        self.assertEqual(team_detail["children_count"], 0)
        self.assertEqual(team_detail["allowed_child_level"], "USER")
        self.assertIn("hierarchy_context", team_detail)
        self.assertEqual(team_detail["hierarchy_context"]["main_company_id"], main_co["id"])
        self.assertEqual(team_detail["hierarchy_context"]["circle_id"], cir["id"])
        self.assertEqual(team_detail["hierarchy_context"]["department_id"], dept["id"])
        self.assertEqual(team_detail["hierarchy_context"]["sub_department_id"], team["id"])

        # 3. Assign user to Team using UserService
        from apps.users.services.user_service import UserService
        admin = User.objects.create_superuser(username="admin_test", email="admin@test.com", password="password123")
        created_user = UserService.create_user({
            "username": "rahul_field",
            "email": "rahul.field@test.com",
            "password": "SecurePassword123!",
            "first_name": "Rahul",
            "last_name": "Sharma",
            "team_id": team["id"],
        }, admin_user=admin)

        self.assertEqual(created_user.sub_department_id, team["id"])
        self.assertEqual(created_user.circle_id, cir["id"])

        # 4. Check Team details after user assigned
        team_detail_after = get_node_details("TEAM", team["id"])
        self.assertEqual(team_detail_after["children_count"], 1)
        self.assertEqual(len(team_detail_after["children"]), 1)
        user_child = team_detail_after["children"][0]
        self.assertEqual(user_child["code"], "rahul_field")
        self.assertEqual(user_child["level"], "USER")

        # 5. Check user details formatting full breadcrumb
        from apps.users.selectors.user_selectors import get_user_detail
        u_detail = get_user_detail(created_user.id)
        self.assertIsNotNone(u_detail)
        self.assertEqual(u_detail["team_id"], team["id"])
        self.assertEqual(u_detail["team_name"], "Alpha Quick Response Unit")
        self.assertIn("Apex Telecoms → Apex Networks → 5G Fiber Rollout → Mumbai Metro → Infrastructure Maintenance → Field Operations → Alpha Quick Response Unit", u_detail["organization_scope"])

        # 6. Try deleting Team while user is assigned (must fail with ValidationError)
        with self.assertRaises(ValidationError):
            OrganizationHierarchyService.delete_node("TEAM", team["id"])

        # 7. Unassign user and delete team
        created_user.sub_department = None
        created_user.save()

        del_res = OrganizationHierarchyService.delete_node("TEAM", team["id"])
        self.assertTrue(del_res["success"])

    def test_cascading_options_down_to_team(self):
        main_co = OrganizationHierarchyService.create_node(level="MAIN_COMPANY", name="Co X", code="CO_X")
        sub_co = OrganizationHierarchyService.create_node(level="SUB_COMPANY", name="Sub X", code="SUB_X", parent_id=main_co["id"])
        prj = OrganizationHierarchyService.create_node(level="PROJECT", name="Prj X", code="PRJ_X", parent_id=sub_co["id"])
        cir = OrganizationHierarchyService.create_node(level="CIRCLE", name="Cir X", code="CIR_X", parent_id=prj["id"])
        dom = OrganizationHierarchyService.create_node(level="DOMAIN", name="Dom X", code="DOM_X", parent_id=cir["id"])
        dept = OrganizationHierarchyService.create_node(level="DEPARTMENT", name="Dept X", code="DEPT_X", parent_id=dom["id"])
        team = OrganizationHierarchyService.create_node(level="TEAM", name="Team X", code="TEAM_X", parent_id=dept["id"])

        # Test cascading options from DEPARTMENT -> SUB_DEPARTMENT
        team_opts = get_cascading_options("SUB_DEPARTMENT", parent_id=dept["id"])
        self.assertEqual(len(team_opts), 1)
        self.assertEqual(team_opts[0]["name"], "Team X")

    def test_parent_reassignment(self):
        """Verify reassigning a node's parent via update_node works atomically."""
        main_co = OrganizationHierarchyService.create_node(level="MAIN_COMPANY", name="Parent Holding", code="PH_HOLD")
        sub_co = OrganizationHierarchyService.create_node(level="SUB_COMPANY", name="Sub Holding", code="SH_SUB", parent_id=main_co["id"])
        prj1 = OrganizationHierarchyService.create_node(level="PROJECT", name="Project Alpha", code="PRJ_ALPHA", parent_id=sub_co["id"])
        prj2 = OrganizationHierarchyService.create_node(level="PROJECT", name="Project Beta", code="PRJ_BETA", parent_id=sub_co["id"])

        cir = OrganizationHierarchyService.create_node(level="CIRCLE", name="East Circle", code="CIR_EAST", parent_id=prj1["id"])
        self.assertEqual(Circle.objects.get(id=cir["id"]).project_id, prj1["id"])

        # Reassign to Project Beta
        updated = OrganizationHierarchyService.update_node(
            level="CIRCLE",
            node_id=cir["id"],
            name="East Circle",
            code="CIR_EAST",
            parent_id=prj2["id"],
        )
        self.assertEqual(Circle.objects.get(id=cir["id"]).project_id, prj2["id"])

    def test_tree_preserves_empty_parents(self):
        """Verify hierarchy tree preserves parents even if they have no child nodes."""
        empty_co = OrganizationHierarchyService.create_node(level="MAIN_COMPANY", name="Empty Parent", code="EMPTY_P")
        tree = get_hierarchy_tree()
        matching = [n for n in tree if n["raw_id"] == empty_co["id"]]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0]["children"], [])


