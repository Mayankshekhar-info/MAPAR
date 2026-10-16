"""
End-to-End Integration Test Suite for MAPAR-v2:
Template -> Dynamic Excel -> Fill -> Upload -> Authoritative Validation ->
Import Batch -> Organization Hierarchy Resolution -> Management Cockpit ->
Slide View -> Deep Record Detail -> Organization Scope Isolation.
"""

import io
import datetime
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from openpyxl import Workbook, load_workbook

from apps.imports.models import (
    UploadTemplate,
    UploadTemplateVersion,
    UploadTemplateColumn,
    ImportBatch,
    ImportStagedRow,
    ImportValidationError,
    ImportAuditLineage,
)
from apps.imports.services.template_service import TemplateService
from apps.imports.services.excel_generation_service import ExcelGenerationService
from apps.imports.services.upload_validation_service import UploadValidationService
from apps.imports.services.import_execution_service import ImportExecutionService

from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Domain,
    Department,
    HierarchyAuditLog,
)
from apps.dashboard.models import KPI, KPIValue, ReportingPeriod
from apps.dashboard.services.cockpit_service import CockpitService
from apps.dashboard.services.slide_table_service import SlideTableService
from apps.authorization.models import UserAccessScope

User = get_user_model()


class EndToEndUploadCockpitSlideFlowTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Ensure unmanaged dashboard tables exist in sqlite test db
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS organization_reportingperiod (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100) UNIQUE,
                    period_type VARCHAR(20),
                    start_date DATE,
                    end_date DATE,
                    freeze_at DATETIME,
                    is_frozen BOOLEAN DEFAULT 0,
                    is_current BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS kpis_kpi (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code VARCHAR(20) UNIQUE,
                    name VARCHAR(200),
                    definition TEXT DEFAULT '',
                    calculation_formula TEXT DEFAULT '',
                    unit VARCHAR(50) DEFAULT '',
                    direction VARCHAR(20) DEFAULT 'HIGHER_BETTER',
                    frequency VARCHAR(20) DEFAULT 'MONTHLY',
                    risk_category VARCHAR(100) DEFAULT '',
                    priority VARCHAR(20) DEFAULT 'MEDIUM',
                    default_owner VARCHAR(100) DEFAULT '',
                    is_executive BOOLEAN DEFAULT 0,
                    is_active BOOLEAN DEFAULT 1,
                    display_order INTEGER DEFAULT 0,
                    domain_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS kpis_kpivalue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kpi_id INTEGER,
                    circle_id INTEGER,
                    period_id INTEGER,
                    actual_value NUMERIC(15, 2),
                    target_value NUMERIC(15, 2),
                    previous_value NUMERIC(15, 2),
                    numerator_value NUMERIC(15, 2),
                    denominator_value NUMERIC(15, 2),
                    variance_to_target NUMERIC(15, 2),
                    variance_percentage NUMERIC(8, 2),
                    rag_status VARCHAR(20) DEFAULT 'GREEN',
                    trend VARCHAR(20) DEFAULT 'FLAT',
                    notes TEXT DEFAULT '',
                    entered_by_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (kpi_id, circle_id, period_id)
                );
            """)

    def setUp(self):
        # 1. Setup multi-tier organization hierarchy
        self.company = MainCompany.objects.create(name="Apex Enterprise", code="APEX")
        self.sub_company = SubCompany.objects.create(main_company=self.company, name="Apex Renewables", code="APEX_REN")
        self.project_a = Project.objects.create(sub_company=self.sub_company, name="Solar Alpha", code="PRJ_ALPHA")
        self.project_b = Project.objects.create(sub_company=self.sub_company, name="Wind Beta", code="PRJ_BETA")

        self.circle_north = Circle.objects.create(project=self.project_a, name="North Circle", code="CIR_NORTH")
        self.circle_south = Circle.objects.create(project=self.project_b, name="South Circle", code="CIR_SOUTH")

        self.domain_ops = Domain.objects.create(circle=self.circle_north, name="Field Operations", code="DOM_OPS")
        self.domain_south = Domain.objects.create(circle=self.circle_south, name="Turbine Operations", code="DOM_TURB")

        self.dept = Department.objects.create(domain=self.domain_ops, name="Engineering Maintenance", code="DEP_MAINT")

        # 2. Setup users: Authorized for Circle North vs Unauthorized Isolated User
        self.authorized_user = User.objects.create_user(
            username="circle_north_manager",
            email="north_mgr@mapar.test",
            password="testpassword123",
            role="ANALYST",
            circle=self.circle_north,
        )

        self.isolated_user = User.objects.create_user(
            username="circle_south_manager",
            email="south_mgr@mapar.test",
            password="testpassword123",
            role="ANALYST",
            circle=self.circle_south,
        )

        # 3. Setup active reporting period
        self.period = ReportingPeriod.objects.create(
            name="October 2026",
            period_type="MONTHLY",
            start_date=datetime.date(2026, 10, 1),
            end_date=datetime.date(2026, 10, 31),
            is_current=True,
        )

    def test_complete_dynamic_ingestion_cockpit_slide_flow(self):
        """
        Executes and validates the entire 21-step dynamic flow:
        Template Creation -> Dynamic Excel -> Fill Data -> Authoritative Validation ->
        Import Batch -> DB Persistence -> Hierarchy Mapping -> Management Cockpit ->
        Slide View -> Detail Drill-Down -> Scope Enforcement.
        """

        # STEP 1 to 5: Create Template with Dynamic User-Configured Columns
        template_payload = {
            "name": "Resource Operational Roster",
            "description": "Dynamic workforce allocation across circles",
            "data_level": "CIRCLE",
            "target_entity": "KPI_VALUES",
            "columns": [
                {
                    "name": "circle_code",
                    "display_label": "Circle Code",
                    "data_type": "REFERENCE",
                    "is_required": True,
                    "validation_rules": {"reference_level": "CIRCLE"},
                },
                {
                    "name": "resource_category",
                    "display_label": "Resource Category",
                    "data_type": "TEXT",
                    "is_required": True,
                    "is_unique": True,
                },
                {
                    "name": "required_headcount",
                    "display_label": "Required Headcount",
                    "data_type": "INTEGER",
                    "is_required": True,
                },
                {
                    "name": "available_headcount",
                    "display_label": "Available Headcount",
                    "data_type": "INTEGER",
                    "is_required": True,
                },
            ],
        }

        template = TemplateService.create_template(template_payload, user=self.authorized_user)
        self.assertIsNotNone(template.id)
        self.assertEqual(template.name, "Resource Operational Roster")
        self.assertEqual(template.versions.count(), 1)

        v1 = template.versions.first()
        self.assertEqual(v1.version_number, 1)
        self.assertEqual(v1.columns.count(), 4)

        # STEP 6 & 7: Dynamic Excel Generation from exact saved configuration
        excel_buf = ExcelGenerationService.generate_template_workbook(v1)
        self.assertIsNotNone(excel_buf)

        # STEP 8: Inspect generated Excel structure
        wb = load_workbook(excel_buf)
        self.assertIn("Data Entry", wb.sheetnames)
        self.assertIn("Column Guide & Instructions", wb.sheetnames)

        ws = wb["Data Entry"]
        headers = [cell.value for cell in ws[1]]
        self.assertEqual(headers[0], "Circle Code *")
        self.assertEqual(headers[1], "Resource Category *")
        self.assertEqual(headers[2], "Required Headcount *")
        self.assertEqual(headers[3], "Available Headcount *")

        # STEP 9: User fills Excel with real operational values
        fill_wb = Workbook()
        fill_ws = fill_wb.active
        fill_ws.title = "Data Entry"
        fill_ws.append(["Circle Code *", "Resource Category *", "Required Headcount *", "Available Headcount *"])
        # Row 2: 120 required, 100 available -> gap 20 (Amber/Red)
        fill_ws.append(["CIR_NORTH", "Lead Solar Technicians", 120, 100])
        # Row 3: 80 required, 80 available -> gap 0 (Green)
        fill_ws.append(["CIR_NORTH", "Field Safety Inspectors", 80, 80])

        filled_stream = io.BytesIO()
        fill_wb.save(filled_stream)
        filled_stream.seek(0)

        uploaded_file = SimpleUploadedFile(
            "filled_operational_roster.xlsx",
            filled_stream.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        # STEP 10 to 12: Upload Excel and Run Authoritative Server-Side Validation
        batch = UploadValidationService.process_and_validate_upload(
            version=v1,
            uploaded_file=uploaded_file,
            reporting_period_id=self.period.id,
            user=self.authorized_user,
        )

        self.assertIsNotNone(batch.id)
        self.assertEqual(batch.status, ImportBatch.Status.VALIDATED)
        self.assertEqual(batch.total_rows, 2)
        self.assertEqual(batch.valid_rows, 2)
        self.assertEqual(batch.error_rows, 0)
        self.assertEqual(ImportStagedRow.objects.filter(batch=batch, is_valid=True).count(), 2)

        # STEP 13 & 14: Transactional Commit Batch into Live MAPAR Architecture
        commit_res = ImportExecutionService.commit_batch(batch, user=self.authorized_user)
        self.assertTrue(commit_res["success"])
        self.assertEqual(commit_res["committed_rows"], 2)

        batch.refresh_from_db()
        self.assertEqual(batch.status, ImportBatch.Status.COMPLETED)

        # Verify Staged Rows marked imported
        self.assertEqual(ImportStagedRow.objects.filter(batch=batch, is_imported=True).count(), 2)

        # Verify Audit Lineage Logged
        self.assertTrue(ImportAuditLineage.objects.filter(batch=batch, action="BATCH_COMMITTED").exists())

        # STEP 15: Verify Ingestion into Live MAPAR KPIValue Data Layer
        kpi_values = KPIValue.objects.filter(circle=self.circle_north, period=self.period)
        self.assertEqual(kpi_values.count(), 2)

        kpi_names = [kv.kpi.name for kv in kpi_values]
        self.assertIn("Lead Solar Technicians", kpi_names)
        self.assertIn("Field Safety Inspectors", kpi_names)

        # STEP 16 & 17: Query Management Cockpit Matrix (Dynamic hierarchy-aware presentation)
        cockpit_summary = CockpitService.get_master_summary(
            user=self.authorized_user,
            company_id=self.company.id,
            circle_id=self.circle_north.id,
            period_id=self.period.id,
        )
        self.assertIsNotNone(cockpit_summary)
        self.assertEqual(cockpit_summary["metrics_summary"]["total_kpis"], 2)
        self.assertGreater(len(cockpit_summary["rows"]), 0)

        # STEP 18 & 19: Query Slide View (Dynamic Master Operational Table)
        slide_table = SlideTableService.get_master_table(
            user=self.authorized_user,
            circle_id=self.circle_north.id,
            period_id=self.period.id,
        )
        self.assertIsNotNone(slide_table)
        self.assertEqual(slide_table["grand_total"]["record_count"], 2)
        # Total Required: 120 + 80 = 200. Total Available: 100 + 80 = 180. Gap: 20
        self.assertEqual(slide_table["grand_total"]["required"], 200.0)
        self.assertEqual(slide_table["grand_total"]["available"], 180.0)
        self.assertEqual(slide_table["grand_total"]["gap"], 20.0)

        # STEP 20 & 21: Clickable Record Detail Drill-Down
        data_rows = [r for r in slide_table["rows"] if r.get("row_type") == "data"]
        self.assertEqual(len(data_rows), 2)
        target_rec_id = data_rows[0]["id"]

        detail = SlideTableService.get_record_detail(record_id=target_rec_id, user=self.authorized_user)
        self.assertIsNotNone(detail)
        self.assertEqual(detail["hierarchy"]["circle_code"], "CIR_NORTH")
        self.assertEqual(detail["source"]["entered_by"]["id"], self.authorized_user.id)
        self.assertIn(detail["resource"]["name"], ["Lead Solar Technicians", "Field Safety Inspectors"])

        # STEP 22: Enforce Cross-Branch Authorization Isolation
        # Isolated user scoped to South Circle must NOT see North Circle records
        isolated_cockpit = CockpitService.get_master_summary(
            user=self.isolated_user,
            circle_id=self.circle_north.id,
            period_id=self.period.id,
        )
        self.assertEqual(isolated_cockpit["metrics_summary"]["total_kpis"], 0)
        self.assertEqual(len(isolated_cockpit["rows"]), 0)

        isolated_detail = SlideTableService.get_record_detail(record_id=target_rec_id, user=self.isolated_user)
        self.assertIsNone(isolated_detail)
