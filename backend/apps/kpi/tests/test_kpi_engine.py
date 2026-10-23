import pytest
import datetime
from decimal import Decimal
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
    KPIFilter,
    KPIDependency,
    KPICalculationResult,
)
from apps.kpi.services.formula_evaluator import (
    SafeFormulaEvaluator,
    SafeFormulaError,
    DivisionByZeroError,
)
from apps.kpi.services.kpi_engine_service import KPIEngineService
from apps.kpi.services.kpi_definition_service import KPIDefinitionService
from apps.kpi.services.kpi_recalculation_service import KPIRecalculationService


@pytest.mark.django_db
class TestSafeFormulaEvaluator:
    def test_basic_arithmetic(self):
        context = {"actual": Decimal("85"), "target": Decimal("100")}
        res = SafeFormulaEvaluator.evaluate("(actual / target) * 100", context)
        assert res == Decimal("85")

    def test_safe_functions(self):
        context = {"x": Decimal("-42.678"), "y": Decimal("10")}
        res = SafeFormulaEvaluator.evaluate("round(abs(x), 2)", context)
        assert res == Decimal("42.68")

        res2 = SafeFormulaEvaluator.evaluate("if_else(y > 5, 100, 0)", context)
        assert res2 == Decimal("100")

    def test_division_by_zero_handling(self):
        context = {"x": Decimal("100"), "zero": Decimal("0")}
        with pytest.raises(DivisionByZeroError):
            SafeFormulaEvaluator.evaluate("x / zero", context)

    def test_disallow_arbitrary_code_and_attributes(self):
        is_valid, err, _ = SafeFormulaEvaluator.validate_syntax("__import__('os').system('ls')")
        assert not is_valid

        is_valid, err, _ = SafeFormulaEvaluator.validate_syntax("x.__class__")
        assert not is_valid


@pytest.mark.django_db
class TestKPIDefinitionAndCycleDetection:
    def test_create_and_duplicate_kpi(self):
        domain = Domain.objects.first()
        kpi = KPIDefinitionService.create_definition({
            "code": "TEST_KPI_AVAIL",
            "name": "Tower Availability",
            "calculation_type": KPIDefinition.CalculationType.FORMULA,
            "formula_expression": "(uptime / total_time) * 100",
            "unit": "%",
            "parameters": [
                {"name": "uptime", "source_column": "uptime_hours", "aggregation": "SUM"},
                {"name": "total_time", "source_column": "total_hours", "aggregation": "SUM"},
            ],
            "filters": [
                {"field_name": "status", "operator": "EQUALS", "value": "ACTIVE"}
            ]
        })
        assert kpi.id is not None
        assert kpi.parameters.count() == 2
        assert kpi.filters.count() == 1

        # Duplicate
        dup = KPIDefinitionService.duplicate_definition(kpi)
        assert dup.id != kpi.id
        assert dup.code.startswith("TEST_KPI_AVAIL_COPY")
        assert dup.parameters.count() == 2

    def test_dependency_cycle_detection(self):
        kpi_a = KPIDefinition.objects.create(code="KPI_A", name="KPI A")
        kpi_b = KPIDefinition.objects.create(code="KPI_B", name="KPI B")

        KPIDependency.objects.create(kpi=kpi_b, depends_on=kpi_a, parameter_name="val_a")

        # Try to make KPI A depend on KPI B -> Cycle
        with pytest.raises(Exception):
            KPIDefinitionService.update_definition(kpi_a, {
                "dependencies": [{"depends_on_id": kpi_b.id, "parameter_name": "val_b"}]
            })


@pytest.mark.django_db
class TestKPIEngineCalculations:
    @pytest.fixture
    def setup_data(self):
        mc = MainCompany.objects.create(name="Enterprise Corp", code="ENT_CORP")
        sc = SubCompany.objects.create(main_company=mc, name="Telecom Subsidiary", code="TELCO_SUB")
        proj = Project.objects.create(sub_company=sc, name="5G Expansion", code="5G_EXP")
        circle_dl = Circle.objects.create(project=proj, name="Delhi", code="DL")
        circle_mum = Circle.objects.create(project=proj, name="Mumbai", code="MUM")

        period = ReportingPeriod.objects.create(
            name="FY2026-Q3",
            period_type="QUARTERLY",
            start_date="2026-10-01",
            end_date="2026-12-31",
            is_current=True,
        )

        template = UploadTemplate.objects.create(
            name="Network Field Operations",
            code="NET_OPS",
            data_level="CIRCLE",
            target_entity="KPI_VALUES",
        )
        version = UploadTemplateVersion.objects.create(
            template=template,
            version_number=1,
            is_active=True,
        )
        UploadTemplateColumn.objects.create(
            version=version,
            name="circle",
            display_label="Circle",
            data_type="TEXT",
        )
        UploadTemplateColumn.objects.create(
            version=version,
            name="sites_up",
            display_label="Sites Up",
            data_type="DECIMAL",
        )
        UploadTemplateColumn.objects.create(
            version=version,
            name="total_sites",
            display_label="Total Sites",
            data_type="DECIMAL",
        )

        batch = ImportBatch.objects.create(
            batch_id="BATCH-TEST-001",
            template_version=version,
            reporting_period=period,
            status=ImportBatch.Status.COMPLETED,
            total_rows=3,
            valid_rows=3,
        )

        ImportStagedRow.objects.create(
            batch=batch,
            row_index=2,
            raw_data={"circle": "DL", "sites_up": 90, "total_sites": 100},
            is_valid=True,
            is_imported=True,
        )
        ImportStagedRow.objects.create(
            batch=batch,
            row_index=3,
            raw_data={"circle": "DL", "sites_up": 95, "total_sites": 100},
            is_valid=True,
            is_imported=True,
        )
        ImportStagedRow.objects.create(
            batch=batch,
            row_index=4,
            raw_data={"circle": "MUM", "sites_up": 80, "total_sites": 100},
            is_valid=True,
            is_imported=True,
        )

        return {
            "main_company": mc,
            "project": proj,
            "circle_dl": circle_dl,
            "circle_mum": circle_mum,
            "period": period,
            "template": template,
            "batch": batch,
        }

    def test_circle_level_kpi_calculation(self, setup_data):
        kpi = KPIDefinitionService.create_definition({
            "code": "SITE_AVAIL_PCT",
            "name": "Site Availability %",
            "calculation_type": KPIDefinition.CalculationType.FORMULA,
            "source_dataset_id": setup_data["template"].id,
            "formula_expression": "(sites_up / total_sites) * 100",
            "unit": "%",
            "target_value": Decimal("90.00"),
            "threshold_green": Decimal("90.00"),
            "threshold_amber": Decimal("80.00"),
            "parameters": [
                {"name": "sites_up", "source_column": "sites_up", "aggregation": "SUM"},
                {"name": "total_sites", "source_column": "total_sites", "aggregation": "SUM"},
            ]
        })

        # Calculate for Delhi: (90 + 95) / (100 + 100) * 100 = 185 / 200 * 100 = 92.5%
        res_dl = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )

        assert res_dl["calculated_value"] == 92.50
        assert res_dl["records_considered"] == 2
        assert res_dl["rag_status"] == "GREEN"

        # Calculate for Mumbai: 80 / 100 * 100 = 80.0%
        res_mum = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_mum"].id,
        )
        assert res_mum["calculated_value"] == 80.00
        assert res_mum["records_considered"] == 1
        assert res_mum["rag_status"] == "AMBER"

    def test_parent_hierarchy_rollup_no_double_counting(self, setup_data):
        kpi = KPIDefinitionService.create_definition({
            "code": "TOTAL_SITES_ROLLUP",
            "name": "Total Active Sites Rollup",
            "calculation_type": KPIDefinition.CalculationType.SIMPLE_AGGREGATE,
            "source_dataset_id": setup_data["template"].id,
            "unit": "Sites",
            "parameters": [
                {"name": "sites", "source_column": "sites_up", "aggregation": "SUM"}
            ]
        })

        # Rollup at Project level: DL (90 + 95) + MUM (80) = 265
        res_proj = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="PROJECT",
            hierarchy_id=setup_data["project"].id,
        )
        assert res_proj["calculated_value"] == 265.0
        assert res_proj["records_considered"] == 3

    def test_automatic_recalculation_on_batch_commit(self, setup_data):
        kpi = KPIDefinitionService.create_definition({
            "code": "AUTO_RECALC_TEST",
            "name": "Auto Recalculation Test",
            "calculation_type": KPIDefinition.CalculationType.SIMPLE_AGGREGATE,
            "source_dataset_id": setup_data["template"].id,
            "parameters": [
                {"name": "sites", "source_column": "sites_up", "aggregation": "SUM"}
            ]
        })

        recalc_res = KPIRecalculationService.recalculate_for_batch(setup_data["batch"])
        assert recalc_res["recalculated_count"] >= 1
        assert "AUTO_RECALC_TEST" in recalc_res["direct_kpis_affected"]

        # Check that result exists in KPICalculationResult
        cached = KPICalculationResult.objects.filter(kpi=kpi, reporting_period=setup_data["period"])
        assert cached.exists()

    def test_kpi_syncs_to_live_kpi_value_for_cockpit_and_slide(self, setup_data):
        from apps.dashboard.models import KPIValue
        from apps.dashboard.services.cockpit_service import CockpitService
        from apps.dashboard.services.slide_table_service import SlideTableService

        kpi = KPIDefinitionService.create_definition({
            "code": "LIVE_SYNC_KPI",
            "name": "Live Sync KPI",
            "calculation_type": KPIDefinition.CalculationType.SIMPLE_AGGREGATE,
            "source_dataset_id": setup_data["template"].id,
            "parameters": [
                {"name": "sites", "source_column": "sites_up", "aggregation": "SUM"}
            ]
        })

        # Calculate for Delhi
        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )
        assert res["calculated_value"] == 185.0

        # Verify live KPIValue exists
        kpi_val = KPIValue.objects.filter(
            kpi__code="LIVE_SYNC_KPI",
            circle=setup_data["circle_dl"],
            period=setup_data["period"],
        ).first()
        assert kpi_val is not None
        assert float(kpi_val.actual_value) == 185.0

        # Verify Cockpit summary reflects this live value
        cockpit_summary = CockpitService.get_master_summary(
            period_id=setup_data["period"].id,
            circle_id=setup_data["circle_dl"].id,
        )
        assert cockpit_summary["total_records"] >= 1
        assert any(r.get("actual") == 185.0 for r in cockpit_summary["rows"])

        # Verify Slide table reflects this live value
        slide_table = SlideTableService.get_master_table(
            period_id=setup_data["period"].id,
            circle_id=setup_data["circle_dl"].id,
        )
        assert slide_table["summary"]["total_available"] >= 185.0

    def test_missing_required_column_reports_clean_error(self, setup_data):
        kpi = KPIDefinitionService.create_definition({
            "code": "MISSING_COL_KPI",
            "name": "Missing Column KPI",
            "calculation_type": KPIDefinition.CalculationType.SIMPLE_AGGREGATE,
            "source_dataset_id": setup_data["template"].id,
            "parameters": [
                {"name": "non_existent", "source_column": "non_existent_column_xyz", "aggregation": "SUM"}
            ]
        })

        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )
        assert res["calculated_value"] is None
        assert res["calculation_status"] == KPICalculationResult.CalculationStatus.ERROR
        assert "non_existent_column_xyz" in res["error_message"]

    def test_record_update_in_master_data_does_not_alter_kpi_results(self, setup_data):
        from apps.imports.services.master_data_service import MasterDataService
        from apps.dashboard.models import KPIValue
        from apps.imports.models import ImportStagedRow

        kpi = KPIDefinitionService.create_definition({
            "code": "RECALC_ON_EDIT_KPI",
            "name": "Recalculation on Edit KPI",
            "calculation_type": KPIDefinition.CalculationType.SIMPLE_AGGREGATE,
            "source_dataset_id": setup_data["template"].id,
            "parameters": [
                {"name": "sites", "source_column": "sites_up", "aggregation": "SUM"}
            ]
        })

        # Initial calculation: DL has 90 + 95 = 185
        init_res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )
        assert init_res["calculated_value"] == 185.0

        row_to_edit = ImportStagedRow.objects.filter(batch=setup_data["batch"]).first()
        assert row_to_edit is not None
        from apps.identity.models import User
        user = User.objects.filter(is_superuser=True).first()
        if not user:
            user = User.objects.create_superuser(username="admin_edit_test", email="admin@test.com", password="password")

        # Edit reference in master data
        MasterDataService.update_record(
            record_id=row_to_edit.id,
            updated_data={"sites_up": 120},
            user=user,
        )

        # Master Data is reference-only: saved KPICalculationResult is NOT automatically modified or overwritten
        saved_kpi_res = KPICalculationResult.objects.get(
            kpi=kpi,
            reporting_period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )
        assert saved_kpi_res.calculated_value is not None
        assert float(saved_kpi_res.calculated_value) == 185.0

    def test_kpi_organization_level_assignment_and_funnel(self, setup_data):
        from apps.kpi.selectors.kpi_selectors import KPISelectors

        # Create a KPI assigned to Project level with FUNNEL visualization type
        kpi = KPIDefinitionService.create_definition({
            "code": "PROJECT_FUNNEL_KPI",
            "name": "Project Funnel KPI",
            "calculation_type": KPIDefinition.CalculationType.SIMPLE_AGGREGATE,
            "source_dataset_id": setup_data["template"].id,
            "hierarchy_level": KPIDefinition.HierarchyLevel.PROJECT,
            "hierarchy_id": setup_data["project"].id,
            "visualization_type": KPIDefinition.VisualizationType.FUNNEL,
            "parameters": [
                {"name": "sites", "source_column": "sites_up", "aggregation": "SUM"}
            ],
            "filters": [
                {"field_name": "total_sites", "operator": "GREATER_THAN", "value": "50"}
            ]
        })

        assert kpi.hierarchy_level == "PROJECT"
        assert kpi.hierarchy_id == setup_data["project"].id
        assert kpi.visualization_type == "FUNNEL"

        # Calculate for Project level (descendant circles = Delhi & Mumbai)
        # Delhi rows: 90 + 95 = 185
        # Mumbai row: 80
        # Total for project = 265
        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="PROJECT",
            hierarchy_id=setup_data["project"].id,
        )

        assert res["calculated_value"] == 265.0
        assert res["visualization_type"] == "FUNNEL"
        assert "funnel_breakdown" in res
        fb = res["funnel_breakdown"]
        assert fb["total_uploaded_records"] >= 3
        assert fb["organization_scope_records"] >= 3
        assert fb["kpi_filtered_records"] >= 3
        assert fb["calculated_value"] == 265.0
        assert fb["visualization_type"] == "FUNNEL"

        # Verify get_dashboard_cards returns visualization_type and funnel_breakdown
        cards = KPISelectors.get_dashboard_cards(
            period_id=setup_data["period"].id,
            hierarchy_level="PROJECT",
            hierarchy_id=setup_data["project"].id,
        )
        assert len(cards) >= 1
        card = next((c for c in cards if c["kpi_code"] == "PROJECT_FUNNEL_KPI"), None)
        assert card is not None
        assert card["visualization_type"] == "FUNNEL"
        assert card["calculated_value"] == 265.0
        assert card["assigned_hierarchy_level"] == "PROJECT"
        assert card["assigned_hierarchy_id"] == setup_data["project"].id
        assert card["funnel_breakdown"] is not None

    def test_kpi_recalculation_with_assigned_organization_scope(self, setup_data):
        # Create a KPI assigned to a Circle
        kpi = KPIDefinitionService.create_definition({
            "code": "ASSIGNED_CIRCLE_KPI",
            "name": "Assigned Circle KPI",
            "calculation_type": KPIDefinition.CalculationType.SIMPLE_AGGREGATE,
            "source_dataset_id": setup_data["template"].id,
            "hierarchy_level": KPIDefinition.HierarchyLevel.CIRCLE,
            "hierarchy_id": setup_data["circle_dl"].id,
            "parameters": [
                {"name": "total_sites", "source_column": "sites_up", "aggregation": "SUM"}
            ]
        })

        # Trigger batch recalculation
        recalc_out = KPIRecalculationService.recalculate_for_batch(batch=setup_data["batch"])
        assert recalc_out["recalculated_count"] >= 1
        assert "ASSIGNED_CIRCLE_KPI" in recalc_out["direct_kpis_affected"]

        # Verify calculation result was saved for circle_dl
        res = KPICalculationResult.objects.filter(
            kpi=kpi,
            reporting_period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        ).first()
        assert res is not None
        assert res.calculated_value is not None
        assert float(res.calculated_value) == 185.0

    def test_kpi_filter_extended_operators_and_refined_dataset(self, setup_data):
        # Create KPI with STARTS_WITH and GREATER_EQUAL filters
        kpi = KPIDefinitionService.create_definition({
            "code": "REFINED_FILTER_KPI",
            "name": "Refined Filter Metric",
            "calculation_type": KPIDefinition.CalculationType.SIMPLE_AGGREGATE,
            "source_dataset_id": setup_data["template"].id,
            "parameters": [
                {"name": "sites", "source_column": "sites_up", "aggregation": "SUM"}
            ],
            "filters": [
                {"field_name": "circle", "operator": "STARTS_WITH", "value": "D"},
                {"field_name": "sites_up", "operator": "GREATER_EQUAL", "value": "92"},
            ]
        })

        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="PROJECT",
            hierarchy_id=setup_data["project"].id,
        )

        # DL row 1 (90) excluded (< 92), MUM row 3 (80) excluded (not D).
        # DL row 2 (95) included (starts with D and 95 >= 92).
        assert res["records_considered"] == 1
        assert res["calculated_value"] == 95.0
        assert res["refined_records_count"] == 1
        assert len(res["refined_records_preview"]) == 1
        assert res["refined_records_preview"][0]["sites_up"] == 95

        # Test get_refined_records method
        refined_data = KPIEngineService.get_refined_records(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="PROJECT",
            hierarchy_id=setup_data["project"].id,
            page=1,
            page_size=10,
        )
        assert refined_data["total_records"] == 1
        assert len(refined_data["records"]) == 1
        assert refined_data["records"][0]["sites_up"] == 95
        assert len(refined_data["applied_filters"]) == 2

    def test_kpi_refined_records_api(self, setup_data):
        from rest_framework.test import APIClient
        client = APIClient()

        kpi = KPIDefinitionService.create_definition({
            "code": "API_REFINED_KPI",
            "name": "API Refined Records KPI",
            "calculation_type": KPIDefinition.CalculationType.SIMPLE_AGGREGATE,
            "source_dataset_id": setup_data["template"].id,
            "parameters": [
                {"name": "total", "source_column": "sites_up", "aggregation": "SUM"}
            ],
            "filters": [
                {"field_name": "circle", "operator": "EQUALS", "value": "DL"},
            ]
        })

        res_dict = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="PROJECT",
            hierarchy_id=setup_data["project"].id,
        )

        res_id = res_dict["result_id"]

        from django.contrib.auth import get_user_model
        User = get_user_model()
        user, _ = User.objects.get_or_create(username="kpi_tester", defaults={"is_superuser": True})

        # Call refined records endpoint
        client.force_authenticate(user=user)
        response = client.get(f"/api/v1/kpi/results/{res_id}/records/")
        assert response.status_code == 200
        data = response.json()
        assert data["result_id"] == res_id
        assert data["total_records"] == 2
        assert len(data["records"]) == 2
        assert "sites_up" in data["columns"]

        # Call diagnostics endpoint (should now include refined_records)
        diag_resp = client.get(f"/api/v1/kpi/results/{res_id}/diagnostics/")
        assert diag_resp.status_code == 200
        diag_data = diag_resp.json()
        assert "refined_records" in diag_data
        assert len(diag_data["refined_records"]) == 2
        assert "total_refined_records" in diag_data
        assert diag_data["total_refined_records"] == 2

    def test_independent_target_vs_achievement_higher_is_better(self, setup_data):
        """
        Example A: Uptime
        Target: 98.8, Actual: 96.0, Direction: Higher is better
        Expected: Variance -2.8, Status: Below Target
        """
        from apps.kpi.api.serializers import KPIDefinitionSerializer
        kpi_data = {
            "code": "UPTIME_KPI_TEST",
            "name": "Network Uptime",
            "description": "Measures overall network availability against 98.8% target",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "unit": "%",
            "comparisons": [
                {
                    "id": "comp_uptime_1",
                    "name": "Uptime",
                    "metric_label": "Network Availability",
                    "unit": "%",
                    "target_value": 98.8,
                    "actual_value": 96.0,
                    "performance_direction": "HIGHER_BETTER",
                    "warning_threshold": 95.0,
                    "critical_threshold": 90.0,
                    "display_color": "#0284C7",
                    "is_enabled": True,
                    "is_manual": True,
                }
            ],
            "performance_colors": {
                "meets_target": "#10B981",
                "below_target": "#EF4444",
                "exceeded_limit": "#8B5CF6",
                "warning": "#F59E0B",
                "critical": "#DC2626",
            },
            "visualization_style": "COMPARISON",
            "is_active": True,
        }

        serializer = KPIDefinitionSerializer(data=kpi_data)
        assert serializer.is_valid(), serializer.errors
        kpi = KPIDefinitionService.create_definition(serializer.validated_data)

        # Evaluate via KPIEngineService
        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )

        assert res["status"] == "SUCCESS"
        assert res["calculated_value"] == 96.0
        assert res["target_value"] == 98.8
        assert res["variance_to_target"] == -2.8
        # Since warning_threshold is 95.0 and actual is 96.0 >= 95.0, it is AMBER (Warning)
        assert res["rag_status"] == "AMBER"
        assert "comparisons" in res["funnel_breakdown"]
        comp = res["funnel_breakdown"]["comparisons"][0]
        assert comp["calculated_variance"] == -2.8
        assert comp["performance_status"] == "BELOW_TARGET"

    def test_independent_target_vs_achievement_lower_is_better(self, setup_data):
        """
        Example B: Down-time
        Target: 60, Actual: 70, Direction: Lower is better
        Expected: Variance +10, Status: Exceeded Limit / Below Target
        """
        kpi = KPIDefinitionService.create_definition({
            "code": "DOWNTIME_KPI_TEST",
            "name": "Network Outage Down-time",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "unit": "minutes",
            "presentation_config": {
                "comparisons": [
                    {
                        "id": "comp_dt_1",
                        "name": "Down-time",
                        "metric_label": "Outage Minutes",
                        "unit": "minutes",
                        "target_value": 60.0,
                        "actual_value": 70.0,
                        "performance_direction": "LOWER_BETTER",
                        "display_color": "#F43F5E",
                        "is_enabled": True,
                        "is_manual": True,
                    }
                ],
                "visualization_style": "VARIANCE",
            },
            "is_active": True,
        })

        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )

        assert res["status"] == "SUCCESS"
        assert res["calculated_value"] == 70.0
        assert res["target_value"] == 60.0
        assert res["variance_to_target"] == 10.0
        assert res["rag_status"] == "RED"
        comp = res["funnel_breakdown"]["comparisons"][0]
        assert comp["calculated_variance"] == 10.0
        assert comp["performance_status"] == "EXCEEDED_LIMIT"

    def test_independent_target_vs_achievement_exact_target(self, setup_data):
        """
        Example C: Exact Target
        Target: 100, Actual: 85 -> Variance -15, Does Not Match Target (RED)
        When Target: 100, Actual: 100 -> Variance 0, Meets Target (GREEN)
        """
        kpi = KPIDefinitionService.create_definition({
            "code": "SITES_TARGET_KPI_TEST",
            "name": "Sites Meeting Target",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "unit": "count",
            "presentation_config": {
                "comparisons": [
                    {
                        "id": "comp_sites_1",
                        "name": "Sites Meeting Target",
                        "metric_label": "Completed Sites Count",
                        "unit": "count",
                        "target_value": 100.0,
                        "actual_value": 85.0,
                        "performance_direction": "EXACT_TARGET",
                        "is_enabled": True,
                        "is_manual": True,
                    }
                ]
            },
            "is_active": True,
        })

        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )
        assert res["status"] == "SUCCESS"
        assert res["calculated_value"] == 85.0
        assert res["target_value"] == 100.0
        assert res["variance_to_target"] == -15.0
        assert res["rag_status"] == "RED"
        comp = res["funnel_breakdown"]["comparisons"][0]
        assert comp["performance_status"] == "DOES_NOT_MATCH"

        # Update actual value to 100 and re-evaluate
        kpi.presentation_config["comparisons"][0]["actual_value"] = 100.0
        kpi.save()

        res_matched = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )
        assert res_matched["calculated_value"] == 100.0
        assert res_matched["variance_to_target"] == 0.0
        assert res_matched["rag_status"] == "GREEN"
        assert res_matched["funnel_breakdown"]["comparisons"][0]["performance_status"] == "MEETS_TARGET"

    def test_data_driven_target_vs_actual_from_uploaded_dataset(self, setup_data):
        """
        User configures Target (92.0) and specifies Actual Data Source (template, metric_field='sites_up', aggregation='AVG').
        Actual achievement is derived automatically from real staged records for the circle and period.
        """
        kpi = KPIDefinitionService.create_definition({
            "code": "DATA_DRIVEN_SITES_UP",
            "name": "Data-Driven Sites Up Average",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "unit": "sites",
            "presentation_config": {
                "comparisons": [
                    {
                        "id": "comp_dd_1",
                        "name": "Average Sites Up",
                        "metric_label": "Sites Up",
                        "unit": "sites",
                        "target_value": 92.0,
                        "performance_direction": "HIGHER_BETTER",
                        "warning_threshold": 85.0,
                        "critical_threshold": 75.0,
                        "display_color": "#10B981",
                        "is_enabled": True,
                        "data_source": {
                            "source_type": "UPLOAD",
                            "dataset_id": setup_data["template"].id,
                            "metric_field": "sites_up",
                            "aggregation": "AVG",
                            "period_behavior": "MATCH_PERIOD",
                        },
                    }
                ]
            },
            "is_active": True,
        })

        # Calculate for Delhi: DL records have sites_up 90 and 95 -> AVG = 92.5
        res_dl = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )

        assert res_dl["status"] == "SUCCESS"
        assert res_dl["calculated_value"] == 92.5
        assert res_dl["target_value"] == 92.0
        assert res_dl["variance_to_target"] == 0.5
        assert res_dl["rag_status"] == "GREEN"
        comp_dl = res_dl["funnel_breakdown"]["comparisons"][0]
        assert comp_dl["performance_status"] == "MEETS_TARGET"
        assert comp_dl["is_manual"] is False
        assert comp_dl["dataset_name"] == setup_data["template"].name
        assert comp_dl["records_considered"] == 2

        # Calculate for Mumbai: MUM record has sites_up 80 -> AVG = 80.0
        res_mum = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_mum"].id,
        )
        assert res_mum["status"] == "SUCCESS"
        assert res_mum["calculated_value"] == 80.0
        assert res_mum["variance_to_target"] == -12.0
        # 80.0 is < target 92.0 but < warning 85.0 and >= critical 75.0 -> RED status Below Target
        assert res_mum["rag_status"] == "RED"
        comp_mum = res_mum["funnel_breakdown"]["comparisons"][0]
        assert comp_mum["performance_status"] == "BELOW_TARGET"
        assert comp_mum["records_considered"] == 1

    def test_data_driven_target_vs_actual_lower_is_better(self, setup_data):
        """
        Lower is better test with uploaded data.
        Target max limit: 85.0. DL actual: 92.5.
        Variance: +7.5 -> Exceeded Limit.
        """
        kpi = KPIDefinitionService.create_definition({
            "code": "DATA_DRIVEN_LOWER_BETTER",
            "name": "Limit Test",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "unit": "sites",
            "presentation_config": {
                "comparisons": [
                    {
                        "id": "comp_lb_1",
                        "name": "Sites Limit",
                        "metric_label": "Sites Up",
                        "unit": "sites",
                        "target_value": 85.0,
                        "performance_direction": "LOWER_BETTER",
                        "is_enabled": True,
                        "data_source": {
                            "source_type": "UPLOAD",
                            "dataset_id": setup_data["template"].id,
                            "metric_field": "sites_up",
                            "aggregation": "AVG",
                        },
                    }
                ]
            },
            "is_active": True,
        })

        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )

        assert res["status"] == "SUCCESS"
        assert res["calculated_value"] == 92.5
        assert res["target_value"] == 85.0
        assert res["variance_to_target"] == 7.5
        assert res["rag_status"] == "RED"
        comp = res["funnel_breakdown"]["comparisons"][0]
        assert comp["performance_status"] == "EXCEEDED_LIMIT"

    def test_data_driven_no_data_and_invalid_field(self, setup_data):
        """
        Tests genuine empty state (NO_DATA) when period has no uploads,
        and CONFIG_INVALID when field does not exist.
        """
        from apps.dashboard.models import ReportingPeriod
        future_period = ReportingPeriod.objects.create(
            name="Monthly: November 2026",
            period_type="MONTHLY",
            start_date=datetime.date(2026, 11, 1),
            end_date=datetime.date(2026, 11, 30),
            freeze_at=datetime.datetime(2026, 11, 30, 23, 59, 59, tzinfo=datetime.timezone.utc),
        )

        # 1. No data for future period
        kpi_no_data = KPIDefinitionService.create_definition({
            "code": "DATA_DRIVEN_NO_DATA",
            "name": "Empty Test",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "presentation_config": {
                "comparisons": [
                    {
                        "id": "comp_nd_1",
                        "name": "Empty Test",
                        "target_value": 90.0,
                        "performance_direction": "HIGHER_BETTER",
                        "is_enabled": True,
                        "data_source": {
                            "source_type": "UPLOAD",
                            "dataset_id": setup_data["template"].id,
                            "metric_field": "sites_up",
                            "aggregation": "SUM",
                        },
                    }
                ]
            },
            "is_active": True,
        })

        res_nd = KPIEngineService.calculate_kpi(
            kpi=kpi_no_data,
            period=future_period,
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )
        assert res_nd["status"] == "NO_DATA"
        assert res_nd["calculated_value"] is None
        assert res_nd["funnel_breakdown"]["comparisons"][0]["performance_status"] == "NO_DATA"

        # 2. Invalid field
        kpi_invalid_field = KPIDefinitionService.create_definition({
            "code": "DATA_DRIVEN_INVALID_FIELD",
            "name": "Invalid Field Test",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "presentation_config": {
                "comparisons": [
                    {
                        "id": "comp_inv_1",
                        "name": "Bad Field",
                        "target_value": 90.0,
                        "performance_direction": "HIGHER_BETTER",
                        "is_enabled": True,
                        "data_source": {
                            "source_type": "UPLOAD",
                            "dataset_id": setup_data["template"].id,
                            "metric_field": "non_existent_column_xyz",
                            "aggregation": "SUM",
                        },
                    }
                ]
            },
            "is_active": True,
        })

        res_inv = KPIEngineService.calculate_kpi(
            kpi=kpi_invalid_field,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )
        assert res_inv["status"] == "ERROR"
        assert res_inv["calculated_value"] is None
        assert res_inv["funnel_breakdown"]["comparisons"][0]["performance_status"] == "CONFIG_INVALID"


@pytest.mark.django_db
class TestPerformanceTargetsAndComparisonColumnMapping(TestKPIEngineCalculations):
    @pytest.fixture
    def excel_upload_data(self, setup_data):
        template = UploadTemplate.objects.create(
            name="Network Uptime Log Template",
            code="NETWORK_UPTIME_LOG_TPL",
            description="Authoritative Excel template for network uptime tracking",
            data_level="CIRCLE",
            target_entity="KPI_VALUES",
        )
        version = UploadTemplateVersion.objects.create(
            template=template,
            version_number=1,
            is_active=True,
        )
        col_uptime = UploadTemplateColumn.objects.create(
            version=version,
            name="13_oct_26_uptime",
            display_label="13-Oct-26 uptime",
            column_order=0,
            data_type="DECIMAL",
            is_required=True,
        )
        col_om = UploadTemplateColumn.objects.create(
            version=version,
            name="om_status",
            display_label="O&M Status",
            column_order=1,
            data_type="INTEGER",
            is_required=True,
        )

        batch = ImportBatch.objects.create(
            batch_id="BATCH-TEST-UPTIME-01",
            template_version=version,
            reporting_period=setup_data["period"],
            status=ImportBatch.Status.COMPLETED,
            total_rows=2,
            valid_rows=2,
        )

        ImportStagedRow.objects.create(
            batch=batch,
            row_index=2,
            raw_data={
                "circle": "DL",
                "13-Oct-26 uptime": "99.2",
                "13_oct_26_uptime": "99.2",
                "13-Oct-26 outage min": "45",
                "13_oct_26_outage_min": "45",
                "O&M Status": "10",
                "om_status": "10",
            },
            is_valid=True,
        )
        ImportStagedRow.objects.create(
            batch=batch,
            row_index=3,
            raw_data={
                "circle": "DL",
                "13-Oct-26 uptime": "98.8",
                "13_oct_26_uptime": "98.8",
                "13-Oct-26 outage min": "45",
                "13_oct_26_outage_min": "45",
                "O&M Status": "20",
                "om_status": "20",
            },
            is_valid=True,
        )

        return {
            "template": template,
            "version": version,
            "col_uptime": col_uptime,
            "col_om": col_om,
            "batch": batch,
        }

    def test_comparison_four_fields_excel_column_detection_and_achievement(self, setup_data, excel_upload_data):
        kpi_data = {
            "code": "KPI_UPTIME_EXCEL_COL",
            "name": "Network Uptime Comparison KPI",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "presentation_config": {
                "comparisons": [
                    {
                        "id": "comp_uptime_1",
                        "name": "Uptime SLA Check",
                        "standard_value": 98.5,
                        "target_value": 98.5,
                        "performance_direction": "HIGHER_BETTER",
                        "achieved_data_column": "13-Oct-26 uptime",
                        "is_enabled": True,
                        "data_source": {
                            "source_type": "UPLOAD",
                            "dataset_id": excel_upload_data["template"].id,
                            "metric_field": "13-Oct-26 uptime",
                            "aggregation": "AVG",
                        },
                    }
                ]
            },
            "is_active": True,
        }

        kpi = KPIDefinitionService.create_definition(kpi_data)
        assert kpi.id is not None

        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )

        assert res["status"] == "SUCCESS"
        assert res["calculated_value"] == pytest.approx(Decimal("99.0"), abs=Decimal("0.001"))
        comp_res = res["funnel_breakdown"]["comparisons"][0]
        assert comp_res["actual_value"] == pytest.approx(99.0, abs=0.001)
        assert comp_res["target_value"] == 98.5
        assert comp_res["performance_status"] == "MEETS_TARGET"

    def test_switching_column_to_om_status(self, setup_data, excel_upload_data):
        kpi_data = {
            "code": "KPI_OM_STATUS_COL",
            "name": "O&M Status Comparison KPI",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "presentation_config": {
                "comparisons": [
                    {
                        "id": "comp_om_1",
                        "name": "O&M Status Check",
                        "standard_value": 18.0,
                        "target_value": 18.0,
                        "performance_direction": "LOWER_BETTER",
                        "achieved_data_column": "O&M Status",
                        "is_enabled": True,
                        "data_source": {
                            "source_type": "UPLOAD",
                            "dataset_id": excel_upload_data["template"].id,
                            "metric_field": "O&M Status",
                            "aggregation": "AVG",
                        },
                    }
                ]
            },
            "is_active": True,
        }

        kpi = KPIDefinitionService.create_definition(kpi_data)
        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )

        assert res["status"] == "SUCCESS"
        assert res["calculated_value"] == pytest.approx(Decimal("15.0"), abs=Decimal("0.001"))
        comp_res = res["funnel_breakdown"]["comparisons"][0]
        assert comp_res["actual_value"] == pytest.approx(15.0, abs=0.001)
        assert comp_res["performance_status"] == "MEETS_TARGET"

    def test_non_existent_column_produces_config_invalid_without_substituting(self, setup_data, excel_upload_data):
        kpi_data = {
            "code": "KPI_MISSING_COL_TEST",
            "name": "Missing Column Test KPI",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "presentation_config": {
                "comparisons": [
                    {
                        "id": "comp_missing_1",
                        "name": "Missing Column Comparison",
                        "standard_value": 100.0,
                        "target_value": 100.0,
                        "performance_direction": "HIGHER_BETTER",
                        "achieved_data_column": "Non Existent Column 999",
                        "is_enabled": True,
                        "data_source": {
                            "source_type": "UPLOAD",
                            "dataset_id": excel_upload_data["template"].id,
                            "metric_field": "Non Existent Column 999",
                            "aggregation": "AVG",
                        },
                    }
                ]
            },
            "is_active": True,
        }

        kpi = KPIDefinitionService.create_definition(kpi_data)
        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )

        assert res["status"] == "ERROR"
        assert res["calculated_value"] is None
        comp_res = res["funnel_breakdown"]["comparisons"][0]
        assert comp_res["performance_status"] == "CONFIG_INVALID"
        assert "not found" in comp_res["error"]

    def test_multiple_column_rules_under_single_comparison_all_met(self, setup_data, excel_upload_data):
        """
        Verify that multiple column rules can be defined under one comparison,
        each rule is evaluated independently against its own Excel column,
        and the overall status is MET when all rules are met.
        """
        kpi_data = {
            "code": "KPI_MULTI_RULE_ALL_MET",
            "name": "Site Performance Multi-Rule",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "presentation_config": {
                "comparisons": [
                    {
                        "id": "comp_site_perf_1",
                        "name": "Site Performance",
                        "is_enabled": True,
                        "data_source": {
                            "source_type": "UPLOAD",
                            "dataset_id": excel_upload_data["template"].id,
                            "metric_field": "13-Oct-26 uptime",
                            "aggregation": "AVG",
                        },
                        "rules": [
                            {
                                "id": "rule_uptime",
                                "achieved_data_column": "13-Oct-26 uptime",
                                "standard_value": 98.8,
                                "performance_direction": "HIGHER_BETTER",
                                "unit": "%",
                                "aggregation": "AVG",
                            },
                            {
                                "id": "rule_outage",
                                "achieved_data_column": "13-Oct-26 outage min",
                                "standard_value": 60.0,
                                "performance_direction": "LOWER_BETTER",
                                "unit": "min",
                                "aggregation": "AVG",
                            },
                            {
                                "id": "rule_om",
                                "achieved_data_column": "O&M Status",
                                "standard_value": 15.0,
                                "performance_direction": "EXACT_TARGET",
                                "unit": "count",
                                "aggregation": "AVG",
                            },
                        ],
                    }
                ]
            },
            "is_active": True,
        }

        kpi = KPIDefinitionService.create_definition(kpi_data)
        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )

        assert res["status"] == "SUCCESS"
        comp_res = res["funnel_breakdown"]["comparisons"][0]
        assert comp_res["name"] == "Site Performance"
        assert comp_res["overall_status"] == "MET"
        assert comp_res["overall_status_label"] == "Met"
        assert comp_res["performance_status"] == "MEETS_TARGET"

        rules = comp_res["rules"]
        assert len(rules) == 3

        # Rule 1: uptime (99.0 >= 98.8)
        assert rules[0]["achieved_data_column"] == "13-Oct-26 uptime"
        assert rules[0]["calculated_actual"] == pytest.approx(99.0, abs=0.01)
        assert rules[0]["performance_status"] == "MEETS_TARGET"
        assert rules[0]["status_label"] == "Met"

        # Rule 2: outage min (45.0 <= 60.0)
        assert rules[1]["achieved_data_column"] == "13-Oct-26 outage min"
        assert rules[1]["calculated_actual"] == pytest.approx(45.0, abs=0.01)
        assert rules[1]["performance_status"] == "MEETS_TARGET"
        assert rules[1]["status_label"] == "Met"

        # Rule 3: O&M Status (AVG(10, 20) = 15.0 == 15.0)
        assert rules[2]["achieved_data_column"] == "O&M Status"
        assert rules[2]["calculated_actual"] == pytest.approx(15.0, abs=0.01)
        assert rules[2]["performance_status"] == "MEETS_TARGET"
        assert rules[2]["status_label"] == "Met"

    def test_multiple_column_rules_under_single_comparison_one_fails(self, setup_data, excel_upload_data):
        """
        Verify that when one rule fails (e.g. outage min is 45.0 which exceeds standard 40.0),
        its rule status is Not Met / EXCEEDED_LIMIT, and the overall status is NOT_MET.
        """
        kpi_data = {
            "code": "KPI_MULTI_RULE_ONE_FAILS",
            "name": "Site Performance Multi-Rule Fail",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "presentation_config": {
                "comparisons": [
                    {
                        "id": "comp_site_perf_fail",
                        "name": "Site Performance",
                        "is_enabled": True,
                        "data_source": {
                            "source_type": "UPLOAD",
                            "dataset_id": excel_upload_data["template"].id,
                            "metric_field": "13-Oct-26 uptime",
                            "aggregation": "AVG",
                        },
                        "rules": [
                            {
                                "id": "rule_uptime",
                                "achieved_data_column": "13-Oct-26 uptime",
                                "standard_value": 98.8,
                                "performance_direction": "HIGHER_BETTER",
                            },
                            {
                                "id": "rule_outage",
                                "achieved_data_column": "13-Oct-26 outage min",
                                "standard_value": 40.0,  # 45.0 will exceed 40.0
                                "performance_direction": "LOWER_BETTER",
                            },
                        ],
                    }
                ]
            },
            "is_active": True,
        }

        kpi = KPIDefinitionService.create_definition(kpi_data)
        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )

        assert res["status"] == "SUCCESS"
        comp_res = res["funnel_breakdown"]["comparisons"][0]
        assert comp_res["overall_status"] == "NOT_MET"
        assert comp_res["overall_status_label"] == "Not Met"
        assert comp_res["performance_status"] == "BELOW_TARGET"

        rules = comp_res["rules"]
        assert rules[0]["performance_status"] == "MEETS_TARGET"
        assert rules[0]["status_label"] == "Met"
        assert rules[1]["performance_status"] == "EXCEEDED_LIMIT"
        assert rules[1]["status_label"] == "Not Met"

    def test_multiple_column_rules_one_column_missing_flags_config_invalid(self, setup_data, excel_upload_data):
        """
        Verify that if any configured column is missing from uploads,
        that rule is marked Column Missing (CONFIG_INVALID), and the overall
        comparison status is CONFIG_INVALID without guessing.
        """
        kpi_data = {
            "code": "KPI_MULTI_RULE_COL_MISSING",
            "name": "Site Performance Multi-Rule Missing",
            "hierarchy_level": "CIRCLE",
            "hierarchy_id": setup_data["circle_dl"].id,
            "presentation_config": {
                "comparisons": [
                    {
                        "id": "comp_site_perf_missing",
                        "name": "Site Performance",
                        "is_enabled": True,
                        "data_source": {
                            "source_type": "UPLOAD",
                            "dataset_id": excel_upload_data["template"].id,
                            "metric_field": "13-Oct-26 uptime",
                            "aggregation": "AVG",
                        },
                        "rules": [
                            {
                                "id": "rule_uptime",
                                "achieved_data_column": "13-Oct-26 uptime",
                                "standard_value": 98.8,
                                "performance_direction": "HIGHER_BETTER",
                            },
                            {
                                "id": "rule_missing",
                                "achieved_data_column": "Non_Existent_Column_ABC",
                                "standard_value": 50.0,
                                "performance_direction": "HIGHER_BETTER",
                            },
                        ],
                    }
                ]
            },
            "is_active": True,
        }

        kpi = KPIDefinitionService.create_definition(kpi_data)
        res = KPIEngineService.calculate_kpi(
            kpi=kpi,
            period=setup_data["period"],
            hierarchy_level="CIRCLE",
            hierarchy_id=setup_data["circle_dl"].id,
        )

        comp_res = res["funnel_breakdown"]["comparisons"][0]
        assert comp_res["overall_status"] == "CONFIG_INVALID"
        assert comp_res["overall_status_label"] == "Column Missing"
        assert comp_res["performance_status"] == "CONFIG_INVALID"

        rules = comp_res["rules"]
        assert rules[0]["performance_status"] == "MEETS_TARGET"
        assert rules[1]["performance_status"] == "CONFIG_INVALID"
        assert rules[1]["status_label"] == "Column Missing"






