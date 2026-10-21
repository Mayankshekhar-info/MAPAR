"""
Automated Backend & Integration Test Suite for MAPAR Universal KPI Excel Engine.
Covers:
1. Admin KPI Formula Excel Upload, Parsing, AST Safety & Validation Preview.
2. Approved Configuration Activation with Scope (Enterprise, Company, Project) & Version History.
3. Raw Data Excel Upload with Deterministic Cleaning (Trimming, Dates, Numbers, Ranges).
4. Duplicate Detection (File SHA-256 and Business Key Records with SKIP and CORRECT modes).
5. Validation Error Handling: Marking Batch as REVIEW_REQUIRED with No Partial Publication.
6. Auto-commit on 100% Valid Batches & Automatic KPI Calculation.
7. Multi-tier Hierarchy Aggregation (Circle -> Project -> Company).
8. Scoped Organization Authorization Enforcement.
"""

import io
import datetime
from decimal import Decimal
import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
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
from apps.kpi.services.formula_evaluator import SafeFormulaEvaluator, SafeFormulaError
from apps.kpi.services.kpi_formula_excel_service import KPIFormulaExcelService
from apps.kpi.services.kpi_engine_service import KPIEngineService
from apps.imports.services.data_cleaning_service import DataCleaningService
from apps.imports.services.upload_validation_service import UploadValidationService
from apps.imports.services.import_execution_service import ImportExecutionService

User = get_user_model()


@pytest.mark.django_db
class UniversalKPIExcelEngineTests(TestCase):
    def setUp(self):
        # 1. Organization Hierarchy Setup
        self.company = MainCompany.objects.create(
            name="Alpha Telecom Group",
            code="ALPHA_TEL",
            status="ACTIVE",
        )
        self.sub_company = SubCompany.objects.create(
            main_company=self.company,
            name="Alpha Infra Solutions",
            code="ALPHA_INFRA",
            status="ACTIVE",
        )
        self.project = Project.objects.create(
            sub_company=self.sub_company,
            name="National Rollout 5G",
            code="PRJ_5G",
            status="ACTIVE",
        )
        self.circle_ap = Circle.objects.create(
            project=self.project,
            name="Andhra Pradesh",
            code="AP",
            region="South",
            is_active=True,
        )
        self.circle_dl = Circle.objects.create(
            project=self.project,
            name="Delhi NCR",
            code="DL",
            region="North",
            is_active=True,
        )
        self.domain = Domain.objects.create(
            circle=self.circle_ap,
            name="Operations & Maintenance",
            code="OPS",
            is_active=True,
        )

        # 2. Reporting Period
        self.period = ReportingPeriod.objects.create(
            name="Monthly: October 2026",
            period_type="MONTHLY",
            start_date=datetime.date(2026, 10, 1),
            end_date=datetime.date(2026, 10, 31),
            is_current=True,
        )

        # 3. Users
        self.admin = User.objects.create_superuser(
            username="kpi_admin",
            email="admin@mapar.test",
            password="adminpassword123",
        )
        self.user_ap = User.objects.create_user(
            username="operator_ap",
            email="ap@mapar.test",
            password="userpassword123",
            role=User.Role.CIRCLE_DATA_ENTRY,
        )

        # 4. Standard Operational Dataset Template
        self.template = UploadTemplate.objects.create(
            name="Universal Operational Metrics",
            code="DS_KPI_OPS",
            data_level="CIRCLE",
            target_entity="KPI_VALUES",
            status=UploadTemplate.Status.ACTIVE,
        )
        self.tpl_version = UploadTemplateVersion.objects.create(
            template=self.template,
            version_number=1,
            is_active=True,
        )
        self.col_circle = UploadTemplateColumn.objects.create(
            version=self.tpl_version,
            name="circle",
            display_label="Circle",
            data_type="REFERENCE",
            is_required=True,
            column_order=1,
            validation_rules={"reference_level": "CIRCLE"},
        )
        self.col_site = UploadTemplateColumn.objects.create(
            version=self.tpl_version,
            name="site_id",
            display_label="Site ID",
            data_type="TEXT",
            is_required=True,
            is_unique=True,
            column_order=2,
        )
        self.col_sites_up = UploadTemplateColumn.objects.create(
            version=self.tpl_version,
            name="sites_up",
            display_label="Sites Up",
            data_type="INTEGER",
            is_required=True,
            column_order=3,
        )
        self.col_total_sites = UploadTemplateColumn.objects.create(
            version=self.tpl_version,
            name="total_sites",
            display_label="Total Sites",
            data_type="INTEGER",
            is_required=True,
            column_order=4,
        )
        self.col_outage_min = UploadTemplateColumn.objects.create(
            version=self.tpl_version,
            name="outage_min",
            display_label="Outage Minutes",
            data_type="INTEGER",
            is_required=False,
            column_order=5,
        )

    def _create_kpi_formula_workbook(self, kpi_rows):
        """Helper to build an in-memory KPI formula Excel workbook."""
        wb = Workbook()
        ws = wb.active
        ws.title = "KPI Definitions"
        headers = [
            "KPI Code",
            "KPI Name",
            "Description",
            "Domain",
            "Hierarchy Level",
            "Calculation Type",
            "Aggregation Method",
            "Formula",
            "Unit",
            "Direction",
            "Target Value",
            "Green Threshold %",
            "Amber Threshold %",
            "Source Dataset",
            "Cleaning Rules",
        ]
        ws.append(headers)
        for r in kpi_rows:
            ws.append(r)
        bio = io.BytesIO()
        wb.save(bio)
        bio.seek(0)
        return bio

    def _create_raw_data_workbook(self, data_rows):
        """Helper to build an in-memory raw operational Excel workbook."""
        wb = Workbook()
        ws = wb.active
        ws.title = "Data Entry"
        ws.append(["Circle", "Site ID", "Sites Up", "Total Sites", "Outage Minutes"])
        for r in data_rows:
            ws.append(r)
        bio = io.BytesIO()
        wb.save(bio)
        bio.seek(0)
        return bio

    # --- Test 1: Admin Formula Upload & Safe AST Validation ---
    def test_parse_and_preview_kpi_formula_workbook(self):
        kpi_rows = [
            [
                "KPI_AVAIL_RATE",
                "Site Availability Rate",
                "Percentage of sites operational",
                "Operations & Maintenance",
                "CIRCLE",
                "PERCENTAGE",
                "AVG",
                "(sites_up / total_sites) * 100",
                "%",
                "HIGHER_BETTER",
                98.0,
                95.0,
                90.0,
                "DS_KPI_OPS",
                "TRIM_WHITESPACE",
            ],
            [
                "KPI_TOTAL_OUTAGE",
                "Cumulative Outage Mins",
                "Total downtime in minutes",
                "Operations & Maintenance",
                "CIRCLE",
                "SIMPLE_AGGREGATE",
                "SUM",
                "outage_min",
                "Mins",
                "LOWER_BETTER",
                120.0,
                150.0,
                240.0,
                "DS_KPI_OPS",
                "TRIM_WHITESPACE",
            ],
        ]
        excel_file = self._create_kpi_formula_workbook(kpi_rows)
        upload = SimpleUploadedFile("kpi_config.xlsx", excel_file.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        preview = KPIFormulaExcelService.parse_and_preview_workbook(upload)
        self.assertEqual(preview["total_rows"], 2)
        self.assertEqual(preview["valid_count"], 2)
        self.assertEqual(preview["error_count"], 0)
        self.assertEqual(preview["preview_rows"][0]["code"], "KPI_AVAIL_RATE")
        self.assertEqual(preview["preview_rows"][0]["formula_expression"], "(sites_up / total_sites) * 100")

    def test_formula_ast_safety_blocks_unsafe_expressions(self):
        # Disallow dangerous python commands / macros
        unsafe_rows = [
            [
                "KPI_UNSAFE",
                "Unsafe KPI",
                "Test macro injection",
                "OPS",
                "CIRCLE",
                "FORMULA",
                "SUM",
                "__import__('os').system('ls')",
                "%",
                "HIGHER_BETTER",
                100,
                95,
                80,
                "DS_KPI_OPS",
                "",
            ]
        ]
        excel_file = self._create_kpi_formula_workbook(unsafe_rows)
        upload = SimpleUploadedFile("unsafe.xlsx", excel_file.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        preview = KPIFormulaExcelService.parse_and_preview_workbook(upload)
        self.assertEqual(preview["error_count"], 1)
        self.assertFalse(preview["preview_rows"][0]["is_valid"])
        self.assertTrue(any("unsafe" in e.lower() or "disallowed" in e.lower() for e in preview["preview_rows"][0]["errors"]))

    def test_duplicate_kpi_code_detected_in_workbook(self):
        duplicate_rows = [
            ["KPI_DUP", "Metric 1", "", "OPS", "CIRCLE", "FORMULA", "SUM", "sites_up", "%", "HIGHER_BETTER", 100, 95, 80, "DS_KPI_OPS", ""],
            ["KPI_DUP", "Metric 2", "", "OPS", "CIRCLE", "FORMULA", "SUM", "sites_up", "%", "HIGHER_BETTER", 100, 95, 80, "DS_KPI_OPS", ""],
        ]
        excel_file = self._create_kpi_formula_workbook(duplicate_rows)
        upload = SimpleUploadedFile("dup.xlsx", excel_file.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        preview = KPIFormulaExcelService.parse_and_preview_workbook(upload)
        self.assertEqual(preview["error_count"], 1)
        self.assertTrue(any("duplicate" in e.lower() for e in preview["preview_rows"][1]["errors"]))

    # --- Test 2: Configuration Activation with Versioning & Scopes ---
    def test_activate_configuration_with_enterprise_scope(self):
        kpis_to_activate = [
            {
                "code": "KPI_AVAIL_01",
                "name": "Network Availability %",
                "formula_expression": "(sites_up / total_sites) * 100",
                "calculation_type": "PERCENTAGE",
                "aggregation_method": "AVG",
                "unit": "%",
                "direction": "HIGHER_BETTER",
                "target_value": 98.0,
                "threshold_green": 95.0,
                "threshold_amber": 90.0,
                "hierarchy_level": "CIRCLE",
                "source_dataset": "DS_KPI_OPS",
            }
        ]
        excel_file = self._create_kpi_formula_workbook([["KPI_AVAIL_01", "Network Availability %", "", "OPS", "CIRCLE", "PERCENTAGE", "AVG", "(sites_up / total_sites) * 100", "%", "HIGHER_BETTER", 98.0, 95.0, 90.0, "DS_KPI_OPS", ""]])
        upload = SimpleUploadedFile("kpi_v1.xlsx", excel_file.read())

        result = KPIFormulaExcelService.activate_configuration(
            uploaded_file=upload,
            approved_kpis=kpis_to_activate,
            scope_type="ENTERPRISE",
            changelog="Initial enterprise default universal KPI configuration",
            user=self.admin,
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["version_number"], 1)
        self.assertEqual(result["activated_count"], 1)

        # Verify DB entities
        kpi_obj = KPIDefinition.objects.get(code="KPI_AVAIL_01")
        self.assertEqual(kpi_obj.name, "Network Availability %")
        self.assertIsNotNone(kpi_obj.config_version)
        self.assertEqual(kpi_obj.config_version.version_number, 1)
        self.assertEqual(kpi_obj.config_version.scope_type, KPIConfigurationVersion.ScopeType.ENTERPRISE)
        # Verify formula parameters auto-created
        self.assertTrue(kpi_obj.parameters.filter(name="sites_up").exists())
        self.assertTrue(kpi_obj.parameters.filter(name="total_sites").exists())

    def test_company_and_project_specific_overrides(self):
        # Enterprise default
        KPIFormulaExcelService.activate_configuration(
            uploaded_file=None,
            approved_kpis=[{"code": "KPI_TARGET_TEST", "name": "Global Target", "target_value": 90.0}],
            scope_type="ENTERPRISE",
            user=self.admin,
        )
        # Project override
        KPIFormulaExcelService.activate_configuration(
            uploaded_file=None,
            approved_kpis=[{"code": "KPI_TARGET_TEST", "name": "Project Specific Target", "target_value": 99.0}],
            scope_type="PROJECT",
            project_id=self.project.id,
            user=self.admin,
        )

        kpi_proj = KPIDefinition.objects.get(code="KPI_TARGET_TEST", project=self.project)
        self.assertEqual(kpi_proj.target_value, Decimal("99.0000"))
        self.assertEqual(kpi_proj.project, self.project)

    # --- Test 3: Raw Operational Data Cleaning & Normalization ---
    def test_deterministic_cleaning_whitespace_dates_numbers(self):
        # Raw row with leading whitespace, unstandardized dates and formatted numbers
        raw_row = {
            "Circle": "  ap  ",
            "Site ID": " SITE-101 ",
            "Sites Up": "  95 ",
            "Total Sites": " 100 ",
            "Outage Minutes": " 12.0 ",
        }
        columns = [self.col_circle, self.col_site, self.col_sites_up, self.col_total_sites, self.col_outage_min]
        ref_lookup = {"CIRCLE": {"AP", "DL"}}

        cleaned, errors = DataCleaningService.clean_and_normalize_row(
            row_idx=2,
            raw_row=raw_row,
            columns=columns,
            reference_lookups=ref_lookup,
        )

        self.assertEqual(len(errors), 0)
        self.assertEqual(cleaned["circle"], "AP")
        self.assertEqual(cleaned["site_id"], "SITE-101")
        self.assertEqual(cleaned["sites_up"], 95)
        self.assertEqual(cleaned["total_sites"], 100)
        self.assertEqual(cleaned["outage_min"], 12)

    # --- Test 4: Duplicate Detection (File SHA-256 and Business Key Records) ---
    def test_duplicate_file_detection(self):
        excel_data = self._create_raw_data_workbook([["AP", "SITE-A1", 10, 10, 0]])
        upload1 = SimpleUploadedFile("october_ops.xlsx", excel_data.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        
        batch1 = UploadValidationService.process_and_validate_upload(
            version=self.tpl_version,
            uploaded_file=upload1,
            reporting_period_id=self.period.id,
            user=self.admin,
        )
        self.assertTrue(bool(batch1.file_hash))

        # Re-upload identical file content with ERROR handling
        excel_data.seek(0)
        upload2 = SimpleUploadedFile("october_ops_copy.xlsx", excel_data.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        with self.assertRaises(Exception) as ctx:
            UploadValidationService.process_and_validate_upload(
                version=self.tpl_version,
                uploaded_file=upload2,
                reporting_period_id=self.period.id,
                duplicate_handling="ERROR",
                user=self.admin,
            )
        self.assertIn("Duplicate file detected", str(ctx.exception))

    def test_duplicate_record_handling_skip_mode(self):
        # Two rows with identical unique Site ID
        duplicate_rows = [
            ["AP", "SITE-DUP", 10, 10, 0],
            ["AP", "SITE-DUP", 9, 10, 60],
        ]
        excel_data = self._create_raw_data_workbook(duplicate_rows)
        upload = SimpleUploadedFile("records_dup.xlsx", excel_data.read())

        batch = UploadValidationService.process_and_validate_upload(
            version=self.tpl_version,
            uploaded_file=upload,
            reporting_period_id=self.period.id,
            duplicate_handling="SKIP",
            user=self.admin,
            auto_commit=True,
        )

        self.assertEqual(batch.duplicate_rows_count, 1)
        self.assertEqual(batch.valid_rows, 1)
        self.assertEqual(batch.status, ImportBatch.Status.COMPLETED)  # Auto-committed valid row

    # --- Test 5: Validation Error -> REVIEW_REQUIRED & No Partial Publish ---
    def test_validation_error_marks_review_required_no_partial_publish(self):
        # Row 1 is valid, Row 2 has invalid circle reference and missing required total_sites
        bad_rows = [
            ["AP", "SITE-GOOD", 10, 10, 0],
            ["UNKNOWN_CIRCLE", "SITE-BAD", 5, None, 0],
        ]
        excel_data = self._create_raw_data_workbook(bad_rows)
        upload = SimpleUploadedFile("bad_data.xlsx", excel_data.read())

        batch = UploadValidationService.process_and_validate_upload(
            version=self.tpl_version,
            uploaded_file=upload,
            reporting_period_id=self.period.id,
            user=self.admin,
        )

        self.assertEqual(batch.status, ImportBatch.Status.REVIEW_REQUIRED)
        self.assertEqual(batch.error_rows, 1)
        self.assertFalse(batch.auto_committed)

        # Attempting to commit batch with errors must raise ValidationError (no partial publish)
        with self.assertRaises(Exception) as ctx:
            ImportExecutionService.commit_batch(batch, user=self.admin)
        self.assertIn("REVIEW_REQUIRED", str(ctx.exception))

    # --- Test 6: Auto-Commit & Automatic KPI Calculation Pipeline ---
    def test_auto_commit_and_kpi_calculation(self):
        # Setup KPI definition
        kpi = KPIDefinition.objects.create(
            code="KPI_AVAIL_PCT",
            name="Site Availability %",
            formula_expression="(sites_up / total_sites) * 100",
            calculation_type=KPIDefinition.CalculationType.PERCENTAGE,
            aggregation_method=KPIDefinition.AggregationMethod.AVG,
            unit="%",
            direction=KPIDefinition.Direction.HIGHER_BETTER,
            target_value=Decimal("95.00"),
            threshold_green=Decimal("90.00"),
            threshold_amber=Decimal("80.00"),
            source_dataset=self.template,
            hierarchy_level="CIRCLE",
            is_active=True,
        )
        KPIParameter.objects.create(kpi=kpi, name="sites_up", source_column="sites_up", aggregation="SUM")
        KPIParameter.objects.create(kpi=kpi, name="total_sites", source_column="total_sites", aggregation="SUM")

        # 100% clean valid rows
        clean_rows = [
            ["AP", "SITE-1", 10, 10, 0],
            ["AP", "SITE-2", 9, 10, 30],
        ]
        excel_data = self._create_raw_data_workbook(clean_rows)
        upload = SimpleUploadedFile("valid_ops.xlsx", excel_data.read())

        batch = UploadValidationService.process_and_validate_upload(
            version=self.tpl_version,
            uploaded_file=upload,
            reporting_period_id=self.period.id,
            kpi_id=kpi.id,
            circle_id=self.circle_ap.id,
            user=self.admin,
            auto_commit=True,
        )

        self.assertEqual(batch.status, ImportBatch.Status.COMPLETED)
        self.assertTrue(batch.auto_committed)
        self.assertEqual(batch.valid_rows, 2)
        self.assertEqual(batch.error_rows, 0)

        # Check calculation result was computed and stored in PostgreSQL
        res = KPICalculationResult.objects.filter(
            kpi=kpi,
            reporting_period=self.period,
            hierarchy_level="CIRCLE",
            hierarchy_id=self.circle_ap.id,
        ).first()
        self.assertIsNotNone(res)
        # Sites up: 19, Total sites: 20 -> (19/20)*100 = 95.00%
        self.assertEqual(res.calculated_value, Decimal("95.0000"))
        self.assertEqual(res.rag_status, KPICalculationResult.RAGStatus.GREEN)

    # --- Test 7: Multi-tier Hierarchy Aggregation ---
    def test_multi_tier_hierarchy_aggregation(self):
        kpi = KPIDefinition.objects.create(
            code="KPI_TOTAL_SITES",
            name="Total Operational Sites",
            formula_expression="sites_up",
            calculation_type=KPIDefinition.CalculationType.SIMPLE_AGGREGATE,
            aggregation_method=KPIDefinition.AggregationMethod.SUM,
            unit="Sites",
            direction=KPIDefinition.Direction.HIGHER_BETTER,
            source_dataset=self.template,
            hierarchy_level="PROJECT",
            is_active=True,
        )
        KPIParameter.objects.create(kpi=kpi, name="sites_up", source_column="sites_up", aggregation="SUM")

        # Batch 1 for Circle AP (10 sites)
        excel_ap = self._create_raw_data_workbook([["AP", "SITE-AP-1", 10, 10, 0]])
        upload_ap = SimpleUploadedFile("ap.xlsx", excel_ap.read())
        UploadValidationService.process_and_validate_upload(
            version=self.tpl_version,
            uploaded_file=upload_ap,
            reporting_period_id=self.period.id,
            circle_id=self.circle_ap.id,
            user=self.admin,
        )

        # Batch 2 for Circle DL (25 sites)
        excel_dl = self._create_raw_data_workbook([["DL", "SITE-DL-1", 25, 25, 0]])
        upload_dl = SimpleUploadedFile("dl.xlsx", excel_dl.read())
        UploadValidationService.process_and_validate_upload(
            version=self.tpl_version,
            uploaded_file=upload_dl,
            reporting_period_id=self.period.id,
            circle_id=self.circle_dl.id,
            user=self.admin,
        )

        # Aggregate at Project Level (Rollout 5G)
        calc_project = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=self.period,
            hierarchy_level="PROJECT",
            hierarchy_id=self.project.id,
            user=self.admin,
        )
        # AP (10) + DL (25) = 35 total sites
        self.assertEqual(calc_project["calculated_value"], Decimal("35"))

        # Aggregate at Main Company Level (Alpha Telecom)
        calc_company = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=self.period,
            hierarchy_level="MAIN_COMPANY",
            hierarchy_id=self.company.id,
            user=self.admin,
        )
        self.assertEqual(calc_company["calculated_value"], Decimal("35"))

    # --- Test 8: Template Generation ---
    def test_starter_excel_template_generation(self):
        bio = KPIFormulaExcelService.generate_starter_excel_template()
        self.assertGreater(bio.getbuffer().nbytes, 1000)

    # --- Test 9: Scoped Organization Authorization Enforcement ---
    def test_scoped_organization_authorization_enforcement(self):
        from apps.authorization.models import UserAccessScope
        UserAccessScope.objects.create(
            user=self.user_ap,
            circle=self.circle_ap,
            scope_type="CIRCLE",
        )

        # user_ap attempts to upload data referencing circle DL (outside authorized AP circle scope)
        unauth_rows = [["DL", "SITE-DL-1", 10, 10, 0]]
        excel_data = self._create_raw_data_workbook(unauth_rows)
        upload = SimpleUploadedFile("unauth_circle.xlsx", excel_data.read())

        batch = UploadValidationService.process_and_validate_upload(
            version=self.tpl_version,
            uploaded_file=upload,
            reporting_period_id=self.period.id,
            user=self.user_ap,
        )
        self.assertEqual(batch.status, ImportBatch.Status.REVIEW_REQUIRED)
        self.assertEqual(batch.error_rows, 1)
        self.assertIn("Access Denied", batch.validation_errors.first().error_message)

    # --- Test 10: Unauthorized User Cannot Activate KPI Configuration ---
    def test_unauthorized_user_cannot_activate_kpi_configuration(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user_ap)

        response = client.post("/api/v1/kpi/configuration/activate/", {
            "approved_kpis": [{"code": "KPI_TEST", "name": "Test"}],
            "scope_type": "ENTERPRISE",
        }, format="json")
        self.assertEqual(response.status_code, 403)

