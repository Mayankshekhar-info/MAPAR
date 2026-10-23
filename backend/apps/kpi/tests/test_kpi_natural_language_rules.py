import pytest
from typing import Any
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.organization.models import Circle, Domain, MainCompany
from apps.dashboard.models import ReportingPeriod
from apps.imports.models import (
    UploadTemplate,
    UploadTemplateVersion,
    UploadTemplateColumn,
    ImportBatch,
    ImportStagedRow,
)
from apps.kpi.models import KPIDefinition
from apps.kpi.services.kpi_logic_parser import KPILogicParser, KPILogicParseError
from apps.kpi.services.kpi_engine_service import KPIEngineService

User = get_user_model()


@pytest.fixture
def nl_kpi_data(db):
    user_mgr: Any = User.objects
    user = user_mgr.create_user(username="nl_user", password="password123", email="nl@example.com")
    admin = user_mgr.create_superuser(username="nl_admin", password="password123", email="nladmin@example.com")

    company, _ = MainCompany.objects.get_or_create(code="CORP", defaults={"name": "Headquarters Corp"})
    circle_dl, _ = Circle.objects.get_or_create(code="DL", defaults={"name": "Delhi Circle"})
    circle_mum, _ = Circle.objects.get_or_create(code="MUM", defaults={"name": "Mumbai Circle"})
    circle_kol, _ = Circle.objects.get_or_create(code="KOL", defaults={"name": "Kolkata Circle"})
    domain, _ = Domain.objects.get_or_create(code="OPS", defaults={"name": "Network Operations"})

    period, _ = ReportingPeriod.objects.get_or_create(
        name="October 2026",
        defaults={"is_current": True, "start_date": "2026-10-01", "end_date": "2026-10-31"}
    )

    # Pure uploaded template with the 20 telecom columns (zero master data dependency)
    template = UploadTemplate.objects.create(
        code="TELECOM_SITE_UPLOAD",
        name="Telecom Site Operational Upload",
        status=UploadTemplate.Status.ACTIVE,
    )
    version = UploadTemplateVersion.objects.create(
        template=template,
        version_number=1,
        is_active=True,
    )

    columns = [
        ("SL", "INTEGER"),
        ("Entity", "TEXT"),
        ("Site Type", "TEXT"),
        ("Circle Name", "TEXT"),
        ("BSNL Site ID", "TEXT"),
        ("Site Name/Village Name", "TEXT"),
        ("BA", "TEXT"),
        ("OA", "TEXT"),
        ("District", "TEXT"),
        ("Site Commissioning /Hoto Status", "TEXT"),
        ("O&M Status", "TEXT"),
        ("EB Status", "TEXT"),
        ("DG Status", "TEXT"),
        ("Site On Air Status", "TEXT"),
        ("IE Name", "TEXT"),
        ("CI Name", "TEXT"),
        ("O&M Name", "TEXT"),
        ("CBH Name", "TEXT"),
        ("Outage min", "DECIMAL"),
        ("Uptime", "DECIMAL"),
    ]

    for order, (col_name, col_type) in enumerate(columns, start=1):
        UploadTemplateColumn.objects.create(
            version=version,
            name=col_name,
            display_label=col_name,
            data_type=col_type,
            column_order=order,
        )

    batch = ImportBatch.objects.create(
        batch_id="BATCH-NL-2026-001",
        template_version=version,
        uploaded_by=user,
        reporting_period=period,
        status=ImportBatch.Status.COMPLETED,
        total_rows=5,
        valid_rows=5,
    )

    # Row 1: DL, Active, Open, Outage min: 120
    ImportStagedRow.objects.create(
        batch=batch,
        row_index=1,
        is_valid=True,
        is_imported=True,
        raw_data={
            "SL": 1,
            "Circle Name": "DL",
            "BSNL Site ID": "DL001",
            "Site On Air Status": "Active",
            "O&M Status": "Open",
            "Outage min": 120,
            "Uptime": 98.5,
        },
    )

    # Row 2: DL, Active, Open, Outage min: 80
    ImportStagedRow.objects.create(
        batch=batch,
        row_index=2,
        is_valid=True,
        is_imported=True,
        raw_data={
            "SL": 2,
            "Circle Name": "DL",
            "BSNL Site ID": "DL002",
            "Site On Air Status": "Active",
            "O&M Status": "Open",
            "Outage min": 80,
            "Uptime": 99.0,
        },
    )

    # Row 3: DL, Active, Closed (Does NOT match O&M Status filter)
    ImportStagedRow.objects.create(
        batch=batch,
        row_index=3,
        is_valid=True,
        is_imported=True,
        raw_data={
            "SL": 3,
            "Circle Name": "DL",
            "BSNL Site ID": "DL003",
            "Site On Air Status": "Active",
            "O&M Status": "Closed",
            "Outage min": 45,
            "Uptime": 99.5,
        },
    )

    # Row 4: MUM, Active, Open, Outage min: 300
    ImportStagedRow.objects.create(
        batch=batch,
        row_index=4,
        is_valid=True,
        is_imported=True,
        raw_data={
            "SL": 4,
            "Circle Name": "MUM",
            "BSNL Site ID": "MUM001",
            "Site On Air Status": "Active",
            "O&M Status": "Open",
            "Outage min": 300,
            "Uptime": 95.0,
        },
    )

    # Row 5: KOL, Inactive, Open (Does NOT match Site On Air Status filter)
    ImportStagedRow.objects.create(
        batch=batch,
        row_index=5,
        is_valid=True,
        is_imported=True,
        raw_data={
            "SL": 5,
            "Circle Name": "KOL",
            "BSNL Site ID": "KOL001",
            "Site On Air Status": "Inactive",
            "O&M Status": "Open",
            "Outage min": 600,
            "Uptime": 85.0,
        },
    )

    return {
        "user": user,
        "admin": admin,
        "company": company,
        "circle_dl": circle_dl,
        "circle_mum": circle_mum,
        "circle_kol": circle_kol,
        "domain": domain,
        "period": period,
        "template": template,
        "version": version,
        "batch": batch,
    }


@pytest.mark.django_db
class TestKPINaturalLanguageRules:
    """Test suite for Natural-Language Business Rule conversion, execution, and presentation colors."""

    def test_parse_user_exact_example_rule(self, nl_kpi_data):
        """
        Tests the exact user prompt scenario:
        "From the selected uploaded dataset, consider only records where Site On Air Status is Active
        and O&M Status is Open. Group the matching records by Circle Name. Count the matching sites
        and calculate the total outage minutes for each circle."
        """
        rule_text = (
            "From the selected uploaded dataset, consider only records where Site On Air Status is Active "
            "and O&M Status is Open. Group the matching records by Circle Name. Count the matching sites "
            "and calculate the total outage minutes for each circle."
        )

        available_columns = [c.name for c in nl_kpi_data["version"].columns.all()]

        parsed = KPILogicParser.parse_natural_language_rule(
            nl_rule=rule_text,
            available_columns=available_columns,
        )

        assert parsed["is_valid"] is True
        assert len(parsed["filters"]) == 2

        # Verify filters
        filter_fields = [f["field_name"] for f in parsed["filters"]]
        assert "Site On Air Status" in filter_fields
        assert "O&M Status" in filter_fields

        for f in parsed["filters"]:
            if f["field_name"] == "Site On Air Status":
                assert f["operator"] == "EQUALS"
                assert f["value"] == "Active"
            elif f["field_name"] == "O&M Status":
                assert f["operator"] == "EQUALS"
                assert f["value"] == "Open"

        # Verify Grouping
        assert "Circle Name" in parsed["group_by"]

        # Verify Parameters & Formula
        param_cols = [p["source_column"] for p in parsed["parameters"]]
        assert "Outage min" in param_cols
        assert "p_outage_min_sum" in parsed["formula_expression"]
        assert any(p["aggregation"] == "SUM" for p in parsed["parameters"])

    def test_execute_natural_language_rule_on_real_data(self, nl_kpi_data):
        """
        Executes the parsed natural language rule against real uploaded staged rows,
        verifying filtered row count, grouped calculations, and total sum.
        """
        rule_text = (
            "From the selected uploaded dataset, consider only records where Site On Air Status is Active "
            "and O&M Status is Open. Group the matching records by Circle Name. Calculate total outage minutes."
        )

        available_columns = [c.name for c in nl_kpi_data["version"].columns.all()]
        parsed = KPILogicParser.parse_natural_language_rule(
            nl_rule=rule_text,
            available_columns=available_columns,
        )

        result = KPIEngineService.execute_adhoc_logic(
            dataset_id=nl_kpi_data["template"].id,
            natural_language_rule=rule_text,
            logic_expression=parsed["interpreted_expression"],
            formula_expression=parsed["formula_expression"],
            filters=parsed["filters"],
            parameters=parsed["parameters"],
            group_by=parsed["group_by"],
            presentation_config={
                "column_colors": {
                    "Site On Air Status": "#10B981",
                    "Outage min": "#EF4444",
                    "Circle Name": "#0284C7",
                }
            },
            user=nl_kpi_data["admin"],
        )

        assert result["success"] is True
        # Total matching rows: Row 1 (DL), Row 2 (DL), Row 4 (MUM) = 3 rows
        assert result["records_considered"] == 3

        # Outage min sum = 120 + 80 + 300 = 500
        assert result["calculated_value"] == 500.0

        # Grouped results should exist for DL and MUM
        grouped = result["grouped_results"]
        assert len(grouped) == 2
        groups_by_key = {g["group_key"]: g for g in grouped}

        assert "DL" in groups_by_key
        assert groups_by_key["DL"]["records_count"] == 2
        assert groups_by_key["DL"]["calculated_value"] == 200.0  # 120 + 80

        assert "MUM" in groups_by_key
        assert groups_by_key["MUM"]["records_count"] == 1
        assert groups_by_key["MUM"]["calculated_value"] == 300.0

        # Refined records preview should contain 3 rows
        assert len(result["refined_records_preview"]) == 3

    def test_save_and_reopen_kpi_with_natural_language_and_presentation_config(self, nl_kpi_data):
        """
        Verifies full persistence: natural language rule, presentation color mappings,
        and group by fields are saved to KPIDefinition and reopened intact.
        """
        client = APIClient()
        client.force_authenticate(user=nl_kpi_data["admin"])

        payload = {
            "code": "KPI_NL_OUTAGE",
            "name": "Circle Outage Minutes for Open O&M",
            "description": "Natural language rule driven KPI",
            "hierarchy_level": "CIRCLE",
            "source_dataset": nl_kpi_data["template"].id,
            "natural_language_rule": "Consider records where Site On Air Status is Active. Group by Circle Name. Sum Outage min.",
            "calculation_type": "FORMULA",
            "formula_expression": "p_outage_min_sum",
            "presentation_config": {
                "column_colors": {
                    "Site On Air Status": "#10B981",
                    "Outage min": "#EF4444",
                },
                "group_by": ["Circle Name"],
            },
            "parameters": [
                {
                    "name": "p_outage_min_sum",
                    "label": "Total Outage",
                    "source_column": "Outage min",
                    "aggregation": "SUM",
                }
            ],
            "filters": [
                {
                    "field_name": "Site On Air Status",
                    "operator": "EQUALS",
                    "value": "Active",
                }
            ],
            "unit": "Minutes",
            "is_active": True,
        }

        # 1. Create KPI Definition via API
        create_res = client.post("/api/v1/kpi/definitions/", payload, format="json")
        assert create_res.status_code == 201, create_res.data
        kpi_id = create_res.data["id"]

        # 2. Fetch KPI Definition by ID
        get_res = client.get(f"/api/v1/kpi/definitions/{kpi_id}/")
        assert get_res.status_code == 200
        data = get_res.data

        assert data["code"] == "KPI_NL_OUTAGE"
        assert data["natural_language_rule"] == payload["natural_language_rule"]
        assert data["presentation_config"]["column_colors"]["Site On Air Status"] == "#10B981"
        assert data["presentation_config"]["column_colors"]["Outage min"] == "#EF4444"
        assert data["presentation_config"]["group_by"] == ["Circle Name"]

    def test_organization_scoped_filtering(self, nl_kpi_data):
        """
        Verifies that scoping the KPI to Delhi (DL) node returns only DL records.
        """
        rule_text = "Consider records where Site On Air Status is Active and O&M Status is Open. Calculate total outage minutes."
        available_columns = [c.name for c in nl_kpi_data["version"].columns.all()]
        parsed = KPILogicParser.parse_natural_language_rule(
            nl_rule=rule_text,
            available_columns=available_columns,
        )

        result = KPIEngineService.execute_adhoc_logic(
            dataset_id=nl_kpi_data["template"].id,
            natural_language_rule=rule_text,
            logic_expression=parsed["interpreted_expression"],
            formula_expression=parsed["formula_expression"],
            filters=parsed["filters"],
            parameters=parsed["parameters"],
            hierarchy_level="CIRCLE",
            hierarchy_id=nl_kpi_data["circle_dl"].id,
            user=nl_kpi_data["admin"],
        )

        assert result["success"] is True
        # Only DL rows match: Row 1 (120) and Row 2 (80) = 2 rows
        assert result["records_considered"] == 2
        assert result["calculated_value"] == 200.0

    def test_invalid_rule_produces_clear_validation_error(self, nl_kpi_data):
        """
        Verifies that referencing non-existent fields or invalid grammar raises clear errors.
        """
        available_columns = [c.name for c in nl_kpi_data["version"].columns.all()]

        with pytest.raises(KPILogicParseError) as exc_info:
            KPILogicParser.parse_natural_language_rule(
                nl_rule="Consider records where NonExistentColumn is Active",
                available_columns=available_columns,
            )

        assert "does not exist in the selected dataset schema" in str(exc_info.value)
