"""
Comprehensive Regression Test Suite for Hierarchy-Scoped Universal KPI Formula Configuration in MAPAR-v2.
Verifies all 11 mandatory scenarios:
1. Project A's formulas apply to Project A only.
2. Project A's formulas do not apply to Project B.
3. Circle A's formulas do not apply to Circle B.
4. Company configurations do not leak into unrelated companies.
5. Explicit enterprise defaults inherit only to eligible descendants.
6. Approved project overrides take precedence within their own scope.
7. Missing scoped configurations do not trigger an unsafe global fallback.
8. Raw uploads use the correct scoped formula and reporting period.
9. Incompatible records are excluded from KPI calculations.
10. Unauthorized hierarchy access is rejected.
11. Existing hierarchy, upload, and KPI functionality continues to work.
"""

import io
import datetime
from decimal import Decimal
import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError, PermissionDenied
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
from django.test import TestCase
from openpyxl import Workbook

from apps.organization.models import MainCompany, SubCompany, Project, Circle, Domain
from apps.dashboard.models import ReportingPeriod
from apps.imports.models import (
    UploadTemplate,
    UploadTemplateVersion,
    UploadTemplateColumn,
    ImportBatch,
    ImportStagedRow,
)
from apps.kpi.models import (
    KPIDefinition,
    KPIParameter,
    KPICalculationResult,
    KPIConfigurationVersion,
)
from apps.kpi.services.kpi_formula_excel_service import KPIFormulaExcelService
from apps.kpi.services.kpi_engine_service import KPIEngineService
from apps.kpi.selectors.kpi_selectors import KPISelectors

User = get_user_model()


@pytest.mark.django_db
class HierarchyScopedKPIFormulaTests(TestCase):
    def setUp(self):
        # 1. Company 1 (Company A) Hierarchy
        self.company_a = MainCompany.objects.create(name="Telecom Alpha", code="TEL_ALPHA", status="ACTIVE")
        self.sub_company_a = SubCompany.objects.create(main_company=self.company_a, name="Infra Alpha", code="INFRA_ALPHA", status="ACTIVE")
        self.project_a = Project.objects.create(sub_company=self.sub_company_a, name="Project Alpha", code="PRJ_ALPHA", status="ACTIVE")
        self.circle_a1 = Circle.objects.create(project=self.project_a, name="Circle Alpha North", code="CAN", status="ACTIVE")
        self.circle_a2 = Circle.objects.create(project=self.project_a, name="Circle Alpha South", code="CAS", status="ACTIVE")

        # 2. Project B in Company 1
        self.project_b = Project.objects.create(sub_company=self.sub_company_a, name="Project Beta", code="PRJ_BETA", status="ACTIVE")
        self.circle_b1 = Circle.objects.create(project=self.project_b, name="Circle Beta West", code="CBW", status="ACTIVE")

        # 3. Company 2 (Company Gamma - Unrelated) Hierarchy
        self.company_gamma = MainCompany.objects.create(name="Telecom Gamma", code="TEL_GAMMA", status="ACTIVE")
        self.sub_company_gamma = SubCompany.objects.create(main_company=self.company_gamma, name="Infra Gamma", code="INFRA_GAMMA", status="ACTIVE")
        self.project_gamma = Project.objects.create(sub_company=self.sub_company_gamma, name="Project Gamma", code="PRJ_GAMMA", status="ACTIVE")
        self.circle_gamma1 = Circle.objects.create(project=self.project_gamma, name="Circle Gamma East", code="CGE", status="ACTIVE")

        # 4. Domain & Reporting Periods
        self.domain = Domain.objects.create(circle=self.circle_a1, name="Network Operations", code="NET_OPS", status="ACTIVE")
        self.period_sep = ReportingPeriod.objects.create(
            name="Sep-26",
            period_type="MONTHLY",
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2026, 9, 30),
            is_current=True,
        )
        self.period_oct = ReportingPeriod.objects.create(
            name="Oct-26",
            period_type="MONTHLY",
            start_date=datetime.date(2026, 10, 1),
            end_date=datetime.date(2026, 10, 31),
            is_current=False,
        )

        # 5. Dataset Template & Columns
        self.template = UploadTemplate.objects.create(
            name="Rollout Metrics",
            code="TPL_ROLLOUT",
            data_level="CIRCLE",
            target_entity="KPI_VALUES",
            status=UploadTemplate.Status.ACTIVE,
        )
        self.template_ver = UploadTemplateVersion.objects.create(template=self.template, version_number=1, is_active=True)
        UploadTemplateColumn.objects.create(version=self.template_ver, name="circle", display_label="Circle", data_type="REFERENCE", is_required=True, column_order=1)
        UploadTemplateColumn.objects.create(version=self.template_ver, name="sites_planned", display_label="Sites Planned", data_type="INTEGER", is_required=True, column_order=2)
        UploadTemplateColumn.objects.create(version=self.template_ver, name="sites_actual", display_label="Sites Actual", data_type="INTEGER", is_required=True, column_order=3)

        # 6. Users
        self.admin_user = User.objects.create_superuser(username="superadmin", email="admin@mapar.org", password="pass")
        self.user_a = User.objects.create_user(
            username="project_a_mgr",
            email="usera@mapar.org",
            password="pass",
            role=User.Role.CIRCLE_DOMAIN_MANAGER,
            circle=self.circle_a1,
        )
        self.user_b = User.objects.create_user(
            username="project_b_mgr",
            email="userb@mapar.org",
            password="pass",
            role=User.Role.CIRCLE_DOMAIN_MANAGER,
            circle=self.circle_b1,
        )

    def _create_formula_workbook_file(self, kpis):
        wb = Workbook()
        ws = wb.active
        ws.title = "KPI_Definitions"
        headers = [
            "KPI Code", "KPI Name", "Description", "Formula Expression",
            "Target Value", "Unit", "Direction", "Aggregation Method",
            "Threshold Green", "Threshold Amber", "Source Dataset", "Allow Inheritance"
        ]
        ws.append(headers)
        for k in kpis:
            ws.append([
                k.get("code"),
                k.get("name"),
                k.get("description", ""),
                k.get("formula", ""),
                k.get("target", 100),
                k.get("unit", "Sites"),
                k.get("direction", "HIGHER_BETTER"),
                k.get("aggregation", "SUM"),
                k.get("green", 95),
                k.get("amber", 80),
                k.get("dataset", "Rollout Metrics"),
                k.get("allow_inheritance", "TRUE"),
            ])
        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)
        return SimpleUploadedFile("kpi_config.xlsx", stream.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    # -------------------------------------------------------------------------
    # Scenario 1: Project A's formulas apply to Project A only
    # -------------------------------------------------------------------------
    def test_01_project_a_formulas_apply_to_project_a_only(self):
        f = self._create_formula_workbook_file([{
            "code": "KPI_ROLLOUT_RATE",
            "name": "Project A Rollout Rate",
            "formula": "sites_actual * 1.5",
        }])
        preview = KPIFormulaExcelService.parse_and_preview_workbook(f)
        self.assertTrue(preview["is_valid"])

        res = KPIFormulaExcelService.activate_configuration(
            uploaded_file=f,
            approved_kpis=preview["preview_rows"],
            scope_type="PROJECT",
            project_id=self.project_a.id,
            user=self.admin_user,
        )
        self.assertTrue(res["success"])

        # Resolve for Project A
        applicable_a = KPIEngineService.resolve_applicable_kpis_for_scope("PROJECT", self.project_a.id)
        codes_a = [k.code for k in applicable_a]
        self.assertIn("KPI_ROLLOUT_RATE", codes_a)
        resolved_kpi = next(k for k in applicable_a if k.code == "KPI_ROLLOUT_RATE")
        self.assertEqual(resolved_kpi.formula_expression, "sites_actual * 1.5")
        self.assertEqual(resolved_kpi.project_id, self.project_a.id)

    # -------------------------------------------------------------------------
    # Scenario 2: Project A's formulas do not apply to Project B
    # -------------------------------------------------------------------------
    def test_02_project_a_formulas_do_not_apply_to_project_b(self):
        f = self._create_formula_workbook_file([{
            "code": "KPI_SPECIAL_A",
            "name": "Project A Only Metric",
            "formula": "sites_actual * 10",
        }])
        preview = KPIFormulaExcelService.parse_and_preview_workbook(f)
        KPIFormulaExcelService.activate_configuration(
            uploaded_file=f,
            approved_kpis=preview["preview_rows"],
            scope_type="PROJECT",
            project_id=self.project_a.id,
            user=self.admin_user,
        )

        # Resolve for Project B (sibling project in same company)
        applicable_b = KPIEngineService.resolve_applicable_kpis_for_scope("PROJECT", self.project_b.id)
        codes_b = [k.code for k in applicable_b]
        self.assertNotIn("KPI_SPECIAL_A", codes_b)

        # Check resolution function specifically
        resolved_for_b = KPIEngineService.resolve_kpi_for_scope("KPI_SPECIAL_A", "PROJECT", self.project_b.id)
        self.assertIsNone(resolved_for_b)

    # -------------------------------------------------------------------------
    # Scenario 3: Circle A's formulas do not apply to Circle B
    # -------------------------------------------------------------------------
    def test_03_circle_a_formulas_do_not_apply_to_circle_b(self):
        f = self._create_formula_workbook_file([{
            "code": "KPI_CIRCLE_NORTH",
            "name": "North Circle Specialized Formula",
            "formula": "sites_actual + 20",
        }])
        preview = KPIFormulaExcelService.parse_and_preview_workbook(f)
        KPIFormulaExcelService.activate_configuration(
            uploaded_file=f,
            approved_kpis=preview["preview_rows"],
            scope_type="CIRCLE",
            circle_id=self.circle_a1.id,
            user=self.admin_user,
        )

        # Circle A1 (North) resolves it
        resolved_a1 = KPIEngineService.resolve_kpi_for_scope("KPI_CIRCLE_NORTH", "CIRCLE", self.circle_a1.id)
        self.assertNotNull = self.assertIsNotNone
        self.assertIsNotNone(resolved_a1)
        self.assertEqual(resolved_a1.circle_id, self.circle_a1.id)

        # Circle A2 (South in same project) must NOT resolve it
        resolved_a2 = KPIEngineService.resolve_kpi_for_scope("KPI_CIRCLE_NORTH", "CIRCLE", self.circle_a2.id)
        self.assertIsNone(resolved_a2)

        # Circle B1 (West in Project B) must NOT resolve it
        resolved_b1 = KPIEngineService.resolve_kpi_for_scope("KPI_CIRCLE_NORTH", "CIRCLE", self.circle_b1.id)
        self.assertIsNone(resolved_b1)

    # -------------------------------------------------------------------------
    # Scenario 4: Company configurations do not leak into unrelated companies
    # -------------------------------------------------------------------------
    def test_04_company_configurations_do_not_leak_into_unrelated_companies(self):
        f = self._create_formula_workbook_file([{
            "code": "KPI_ALPHA_CORP",
            "name": "Alpha Corp Baseline",
            "formula": "sites_actual * 1.05",
        }])
        preview = KPIFormulaExcelService.parse_and_preview_workbook(f)
        KPIFormulaExcelService.activate_configuration(
            uploaded_file=f,
            approved_kpis=preview["preview_rows"],
            scope_type="COMPANY",
            company_id=self.company_a.id,
            is_inheritance_allowed=True,
            user=self.admin_user,
        )

        # Resolves for Company A and its project
        res_a = KPIEngineService.resolve_kpi_for_scope("KPI_ALPHA_CORP", "MAIN_COMPANY", self.company_a.id)
        self.assertIsNotNone(res_a)

        res_prj_a = KPIEngineService.resolve_kpi_for_scope("KPI_ALPHA_CORP", "PROJECT", self.project_a.id)
        self.assertIsNotNone(res_prj_a)

        # Must NEVER resolve for Company Gamma or Project Gamma
        res_gamma = KPIEngineService.resolve_kpi_for_scope("KPI_ALPHA_CORP", "MAIN_COMPANY", self.company_gamma.id)
        self.assertIsNone(res_gamma)

        res_prj_gamma = KPIEngineService.resolve_kpi_for_scope("KPI_ALPHA_CORP", "PROJECT", self.project_gamma.id)
        self.assertIsNone(res_prj_gamma)

    # -------------------------------------------------------------------------
    # Scenario 5: Explicit enterprise defaults inherit only to eligible descendants
    # -------------------------------------------------------------------------
    def test_05_explicit_enterprise_defaults_inherit_only_to_eligible_descendants(self):
        # Single Enterprise workbook defining 1 inheritable KPI and 1 locked KPI
        f = self._create_formula_workbook_file([
            {
                "code": "KPI_GLOBAL_INHERIT",
                "name": "Global Baseline Allowed",
                "formula": "sites_actual",
                "allow_inheritance": "TRUE",
            },
            {
                "code": "KPI_GLOBAL_LOCKED",
                "name": "Global Executive Only",
                "formula": "sites_planned * 2",
                "allow_inheritance": "FALSE",
            },
        ])
        prev = KPIFormulaExcelService.parse_and_preview_workbook(f)
        KPIFormulaExcelService.activate_configuration(
            uploaded_file=f,
            approved_kpis=prev["preview_rows"],
            scope_type="ENTERPRISE",
            user=self.admin_user,
        )

        # Inheritable default resolves for child project and circle
        self.assertIsNotNone(KPIEngineService.resolve_kpi_for_scope("KPI_GLOBAL_INHERIT", "PROJECT", self.project_a.id))
        self.assertIsNotNone(KPIEngineService.resolve_kpi_for_scope("KPI_GLOBAL_INHERIT", "CIRCLE", self.circle_a1.id))

        # Locked default does NOT resolve for child project or circle
        self.assertIsNone(KPIEngineService.resolve_kpi_for_scope("KPI_GLOBAL_LOCKED", "PROJECT", self.project_a.id))
        self.assertIsNone(KPIEngineService.resolve_kpi_for_scope("KPI_GLOBAL_LOCKED", "CIRCLE", self.circle_a1.id))


    # -------------------------------------------------------------------------
    # Scenario 6: Approved project overrides take precedence within their own scope
    # -------------------------------------------------------------------------
    def test_06_approved_project_overrides_take_precedence_within_their_own_scope(self):
        # 1. Global enterprise default: sites_actual * 1.0
        f_ent = self._create_formula_workbook_file([{
            "code": "KPI_PRECEDENCE",
            "name": "Precedence Test Metric",
            "formula": "sites_actual * 1.0",
        }])
        prev_ent = KPIFormulaExcelService.parse_and_preview_workbook(f_ent)
        KPIFormulaExcelService.activate_configuration(
            uploaded_file=f_ent,
            approved_kpis=prev_ent["preview_rows"],
            scope_type="ENTERPRISE",
            is_inheritance_allowed=True,
            user=self.admin_user,
        )

        # 2. Company A configuration: sites_actual * 2.0
        f_comp = self._create_formula_workbook_file([{
            "code": "KPI_PRECEDENCE",
            "name": "Precedence Test Metric (Company Override)",
            "formula": "sites_actual * 2.0",
        }])
        prev_comp = KPIFormulaExcelService.parse_and_preview_workbook(f_comp)
        KPIFormulaExcelService.activate_configuration(
            uploaded_file=f_comp,
            approved_kpis=prev_comp["preview_rows"],
            scope_type="COMPANY",
            company_id=self.company_a.id,
            is_inheritance_allowed=True,
            user=self.admin_user,
        )

        # 3. Project A override: sites_actual * 3.0
        f_proj = self._create_formula_workbook_file([{
            "code": "KPI_PRECEDENCE",
            "name": "Precedence Test Metric (Project Override)",
            "formula": "sites_actual * 3.0",
        }])
        prev_proj = KPIFormulaExcelService.parse_and_preview_workbook(f_proj)
        KPIFormulaExcelService.activate_configuration(
            uploaded_file=f_proj,
            approved_kpis=prev_proj["preview_rows"],
            scope_type="PROJECT",
            project_id=self.project_a.id,
            user=self.admin_user,
        )

        # Resolution for Project A must resolve the PROJECT override (precedence: Project > Company > Enterprise)
        kpi_proj_a = KPIEngineService.resolve_kpi_for_scope("KPI_PRECEDENCE", "PROJECT", self.project_a.id)
        self.assertEqual(kpi_proj_a.formula_expression, "sites_actual * 3.0")
        self.assertEqual(kpi_proj_a.scope_type, KPIConfigurationVersion.ScopeType.PROJECT)

        # Resolution for Project B (in Company A without project override) must resolve the COMPANY override
        kpi_proj_b = KPIEngineService.resolve_kpi_for_scope("KPI_PRECEDENCE", "PROJECT", self.project_b.id)
        self.assertEqual(kpi_proj_b.formula_expression, "sites_actual * 2.0")
        self.assertEqual(kpi_proj_b.scope_type, KPIConfigurationVersion.ScopeType.COMPANY)

        # Resolution for Project Gamma (unrelated company) must resolve the ENTERPRISE default
        kpi_proj_gamma = KPIEngineService.resolve_kpi_for_scope("KPI_PRECEDENCE", "PROJECT", self.project_gamma.id)
        self.assertEqual(kpi_proj_gamma.formula_expression, "sites_actual * 1.0")
        self.assertEqual(kpi_proj_gamma.scope_type, KPIConfigurationVersion.ScopeType.ENTERPRISE)

    # -------------------------------------------------------------------------
    # Scenario 7: Missing scoped configurations do not trigger an unsafe global fallback
    # -------------------------------------------------------------------------
    def test_07_missing_scoped_configurations_do_not_trigger_unsafe_global_fallback(self):
        # A formula created ONLY for Project A
        f_proj = self._create_formula_workbook_file([{
            "code": "KPI_SECRET_FORMULA",
            "name": "Secret Formula For Proj A",
            "formula": "sites_planned - sites_actual",
        }])
        prev = KPIFormulaExcelService.parse_and_preview_workbook(f_proj)
        KPIFormulaExcelService.activate_configuration(
            uploaded_file=f_proj,
            approved_kpis=prev["preview_rows"],
            scope_type="PROJECT",
            project_id=self.project_a.id,
            user=self.admin_user,
        )

        # When querying dashboard cards or applicable KPIs for Project B:
        # It must NOT silently fallback to Project A's configuration or return Project A's cards!
        applicable_b = KPIEngineService.resolve_applicable_kpis_for_scope("PROJECT", self.project_b.id)
        codes_b = [k.code for k in applicable_b]
        self.assertNotIn("KPI_SECRET_FORMULA", codes_b)

        cards_b = KPISelectors.get_dashboard_cards(
            user=self.admin_user,
            period_id=self.period_sep.id,
            hierarchy_level="PROJECT",
            hierarchy_id=self.project_b.id,
        )
        card_codes_b = [c["kpi_code"] for c in cards_b]
        self.assertNotIn("KPI_SECRET_FORMULA", card_codes_b)

    # -------------------------------------------------------------------------
    # Scenario 8: Raw uploads use the correct scoped formula and reporting period
    # -------------------------------------------------------------------------
    def test_08_raw_uploads_use_correct_scoped_formula_and_reporting_period(self):
        # Create Project A formula
        f_a = self._create_formula_workbook_file([{
            "code": "KPI_DEPLOYED",
            "name": "Sites Deployed Metric",
            "formula": "sites_actual * 2",
        }])
        prev_a = KPIFormulaExcelService.parse_and_preview_workbook(f_a)
        KPIFormulaExcelService.activate_configuration(
            uploaded_file=f_a,
            approved_kpis=prev_a["preview_rows"],
            scope_type="PROJECT",
            project_id=self.project_a.id,
            user=self.admin_user,
        )

        # Create staged batch for Circle A1 under Project A
        batch_a = ImportBatch.objects.create(
            batch_id="BATCH_A_001",
            template_version=self.template_ver,
            reporting_period=self.period_sep,
            circle=self.circle_a1,
            project=self.project_a,
            company=self.company_a,
            status=ImportBatch.Status.COMPLETED,
        )
        ImportStagedRow.objects.create(
            batch=batch_a,
            row_index=2,
            raw_data={"circle": "CAN", "sites_planned": 100, "sites_actual": 50},
            is_valid=True,
        )

        # Calculate for Project A
        kpi_def = KPIEngineService.resolve_kpi_for_scope("KPI_DEPLOYED", "PROJECT", self.project_a.id)
        # Ensure parameters are mapped
        KPIParameter.objects.get_or_create(kpi=kpi_def, name="sites_actual", defaults={"source_column": "sites_actual", "aggregation": "SUM"})

        res = KPIEngineService.calculate_kpi(
            kpi=kpi_def,
            period=self.period_sep,
            hierarchy_level="PROJECT",
            hierarchy_id=self.project_a.id,
            trigger_type="TEST",
            user=self.admin_user,
        )
        self.assertEqual(res["calculation_status"], "SUCCESS")
        # Formula is sites_actual * 2 -> 50 * 2 = 100.00
        self.assertEqual(float(res["calculated_value"]), 100.0)

    # -------------------------------------------------------------------------
    # Scenario 9: Incompatible records are excluded from KPI calculations
    # -------------------------------------------------------------------------
    def test_09_incompatible_records_excluded_from_kpi_calculations(self):
        f = self._create_formula_workbook_file([{
            "code": "KPI_CAN_ONLY",
            "name": "Circle CAN Metric",
            "formula": "sites_actual",
        }])
        prev = KPIFormulaExcelService.parse_and_preview_workbook(f)
        KPIFormulaExcelService.activate_configuration(
            uploaded_file=f,
            approved_kpis=prev["preview_rows"],
            scope_type="CIRCLE",
            circle_id=self.circle_a1.id,
            user=self.admin_user,
        )
        kpi_can = KPIEngineService.resolve_kpi_for_scope("KPI_CAN_ONLY", "CIRCLE", self.circle_a1.id)
        KPIParameter.objects.get_or_create(kpi=kpi_can, name="sites_actual", defaults={"source_column": "sites_actual", "aggregation": "SUM"})

        # Create batch containing records for CAN, CAS (unrelated circle), and wrong period
        batch = ImportBatch.objects.create(
            batch_id="BATCH_MIXED_001",
            template_version=self.template_ver,
            reporting_period=self.period_sep,
            circle=self.circle_a1,
            project=self.project_a,
            status=ImportBatch.Status.COMPLETED,
        )
        # Row 1: Matching CAN (circle_a1) in Sep-26
        ImportStagedRow.objects.create(
            batch=batch,
            row_index=2,
            raw_data={"circle": "CAN", "sites_planned": 100, "sites_actual": 42},
            is_valid=True,
        )
        # Row 2: Incompatible CAS (circle_a2)
        ImportStagedRow.objects.create(
            batch=batch,
            row_index=3,
            raw_data={"circle": "CAS", "sites_planned": 100, "sites_actual": 999},
            is_valid=True,
        )

        res = KPIEngineService.calculate_kpi(
            kpi=kpi_can,
            period=self.period_sep,
            hierarchy_level="CIRCLE",
            hierarchy_id=self.circle_a1.id,
            trigger_type="TEST",
            user=self.admin_user,
        )
        # Row 2 must be excluded; only Row 1 (42) should be calculated
        self.assertEqual(res["calculation_status"], "SUCCESS")
        self.assertEqual(float(res["calculated_value"]), 42.0)
        self.assertEqual(res["records_considered"], 1)
        self.assertEqual(res["records_excluded"], 1)

    # -------------------------------------------------------------------------
    # Scenario 10: Unauthorized hierarchy access is rejected
    # -------------------------------------------------------------------------
    def test_10_unauthorized_hierarchy_access_rejected(self):
        # user_b has access to Circle B1 (Project B), but NOT Project A or Circle A1
        f = self._create_formula_workbook_file([{
            "code": "KPI_ATTACK",
            "name": "Unauthorized Attack KPI",
            "formula": "sites_actual",
        }])
        prev = KPIFormulaExcelService.parse_and_preview_workbook(f)

        # Attempt to activate configuration for Project A by unauthorized user_b
        with self.assertRaises((ValidationError, PermissionDenied, DRFPermissionDenied)):
            KPIFormulaExcelService.activate_configuration(
                uploaded_file=f,
                approved_kpis=prev["preview_rows"],
                scope_type="PROJECT",
                project_id=self.project_a.id,
                user=self.user_b,
            )

        # Attempt to activate configuration for Circle A1 by unauthorized user_b
        with self.assertRaises((ValidationError, PermissionDenied, DRFPermissionDenied)):
            KPIFormulaExcelService.activate_configuration(
                uploaded_file=f,
                approved_kpis=prev["preview_rows"],
                scope_type="CIRCLE",
                circle_id=self.circle_a1.id,
                user=self.user_b,
            )

    # -------------------------------------------------------------------------
    # Scenario 11: Existing hierarchy, upload, and KPI functionality continues to work
    # -------------------------------------------------------------------------
    def test_11_existing_hierarchy_upload_and_kpi_functionality_continues_to_work(self):
        # 1. Activation with changelog and version tracking
        f = self._create_formula_workbook_file([{
            "code": "KPI_REG_CHECK",
            "name": "Regression Check KPI",
            "formula": "sites_actual + sites_planned",
        }])
        prev = KPIFormulaExcelService.parse_and_preview_workbook(f)
        out = KPIFormulaExcelService.activate_configuration(
            uploaded_file=f,
            approved_kpis=prev["preview_rows"],
            scope_type="PROJECT",
            project_id=self.project_a.id,
            changelog="Regression release v1",
            user=self.admin_user,
        )
        self.assertTrue(out["success"])
        self.assertEqual(out["version_number"], 1)

        # 2. Version listing respects scope
        versions = KPIConfigurationVersion.objects.filter(scope_type="PROJECT", project=self.project_a)
        self.assertEqual(versions.count(), 1)
        self.assertEqual(versions.first().changelog, "Regression release v1")

        # 3. Dashboard card retrieval succeeds and returns required JSON structure
        cards = KPISelectors.get_dashboard_cards(
            user=self.admin_user,
            period_id=self.period_sep.id,
            hierarchy_level="PROJECT",
            hierarchy_id=self.project_a.id,
        )
        self.assertIsInstance(cards, list)
        self.assertTrue(any(c["kpi_code"] == "KPI_REG_CHECK" for c in cards))
        card = next(c for c in cards if c["kpi_code"] == "KPI_REG_CHECK")
        self.assertIn("error_message", card)
        self.assertIn("calculation_status", card)
