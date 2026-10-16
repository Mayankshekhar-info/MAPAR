"""
Unit Tests for Master Data Module.
Tests metadata retrieval, record listing, record editing with column validation,
audit trail logging, and Excel export generation.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.exceptions import PermissionDenied, NotFound

from apps.imports.models import (
    UploadTemplate,
    UploadTemplateVersion,
    UploadTemplateColumn,
    ImportBatch,
    ImportStagedRow,
    ImportAuditLineage,
)
from apps.organization.models import MainCompany, SubCompany, Project, Circle, Domain, Department, HierarchyAuditLog
from apps.dashboard.models import ReportingPeriod
from apps.imports.selectors.master_data_selectors import (
    get_master_data_meta,
    list_master_data_records,
    get_master_data_record_by_id,
)
from apps.imports.services.master_data_service import MasterDataService

User = get_user_model()


@pytest.fixture
def master_data_fixture(db):
    user = User.objects.create_user(
        username="master_data_admin",
        email="md_admin@mapar.internal",
        password="ValidPassword123!",
        is_superuser=True,
    )
    mc = MainCompany.objects.create(name="Test Company", code="TC_01", status="ACTIVE")
    sc = SubCompany.objects.create(main_company=mc, name="Test SubCo", code="TSC_01", status="ACTIVE")
    prj = Project.objects.create(sub_company=sc, name="Test Project", code="TP_01", status="ACTIVE")
    cir = Circle.objects.create(project=prj, name="Test Circle", code="TCIR_01", is_active=True)
    dom = Domain.objects.create(circle=cir, name="Test Domain", code="TDOM_01", is_active=True)
    dept = Department.objects.create(domain=dom, name="Operations", code="OPS_01", status="ACTIVE")
    period = ReportingPeriod.objects.create(
        name="Oct 2026",
        period_type="MONTHLY",
        start_date="2026-10-01",
        end_date="2026-10-31",
        is_current=True,
    )

    tpl = UploadTemplate.objects.create(
        name="Field Operations Master",
        code="TPL_FIELD_OPS",
        data_level="CIRCLE",
        status=UploadTemplate.Status.ACTIVE,
    )
    ver = UploadTemplateVersion.objects.create(template=tpl, version_number=1, is_active=True)
    col1 = UploadTemplateColumn.objects.create(
        version=ver,
        name="site_code",
        display_label="Site Code",
        data_type=UploadTemplateColumn.DataType.TEXT,
        is_required=True,
        column_order=1,
    )
    col2 = UploadTemplateColumn.objects.create(
        version=ver,
        name="operational_capacity",
        display_label="Operational Capacity",
        data_type=UploadTemplateColumn.DataType.DECIMAL,
        is_required=True,
        column_order=2,
    )
    col3 = UploadTemplateColumn.objects.create(
        version=ver,
        name="is_active",
        display_label="Active Status",
        data_type=UploadTemplateColumn.DataType.BOOLEAN,
        is_required=False,
        column_order=3,
    )

    batch = ImportBatch.objects.create(
        batch_id="BATCH-MD-TEST-001",
        template_version=ver,
        reporting_period=period,
        company=mc,
        project=prj,
        circle=cir,
        department=dept,
        uploaded_by=user,
        original_filename="field_ops.xlsx",
        total_rows=2,
        valid_rows=2,
        error_rows=0,
        status=ImportBatch.Status.COMPLETED,
    )

    row1 = ImportStagedRow.objects.create(
        batch=batch,
        row_index=2,
        raw_data={"site_code": "SITE_101", "operational_capacity": "98.50", "is_active": "TRUE"},
        is_valid=True,
        validation_errors=[],
        is_imported=True,
    )
    row2 = ImportStagedRow.objects.create(
        batch=batch,
        row_index=3,
        raw_data={"site_code": "SITE_102", "operational_capacity": "84.20", "is_active": "FALSE"},
        is_valid=True,
        validation_errors=[],
        is_imported=True,
    )

    return {
        "user": user,
        "company": mc,
        "project": prj,
        "circle": cir,
        "department": dept,
        "period": period,
        "template": tpl,
        "version": ver,
        "batch": batch,
        "rows": [row1, row2],
    }


@pytest.mark.django_db
def test_get_master_data_meta(master_data_fixture):
    meta = get_master_data_meta(master_data_fixture["user"])
    assert "templates" in meta
    assert len(meta["templates"]) >= 1
    assert any(t["code"] == "TPL_FIELD_OPS" for t in meta["templates"])
    assert any(c["code"] == "TC_01" for c in meta["companies"])
    assert any(cir["code"] == "TCIR_01" for cir in meta["circles"])


@pytest.mark.django_db
def test_list_master_data_records(master_data_fixture):
    user = master_data_fixture["user"]
    cir = master_data_fixture["circle"]
    result = list_master_data_records(user=user, circle_id=cir.id)
    assert result["total"] == 2
    assert len(result["records"]) == 2
    assert len(result["columns"]) == 3
    assert result["records"][0]["raw_data"]["site_code"] == "SITE_101"


@pytest.mark.django_db
def test_master_data_update_and_audit(master_data_fixture):
    user = master_data_fixture["user"]
    row1 = master_data_fixture["rows"][0]

    updated = MasterDataService.update_record(
        record_id=row1.id,
        updated_data={"operational_capacity": "99.95"},
        user=user,
    )

    assert updated["raw_data"]["operational_capacity"] == "99.95"
    assert updated["is_valid"] is True

    # Audit check
    lineage = ImportAuditLineage.objects.filter(batch=row1.batch, action="RECORD_EDITED").first()
    assert lineage is not None
    assert lineage.details["record_id"] == row1.id

    audit_log = HierarchyAuditLog.objects.filter(level="MASTER_DATA_RECORD", object_id=str(row1.id)).first()
    assert audit_log is not None


@pytest.mark.django_db
def test_master_data_update_invalid_data(master_data_fixture):
    user = master_data_fixture["user"]
    row1 = master_data_fixture["rows"][0]

    updated = MasterDataService.update_record(
        record_id=row1.id,
        updated_data={"operational_capacity": "INVALID_DECIMAL_TEXT"},
        user=user,
    )

    assert updated["is_valid"] is False
    assert len(updated["validation_errors"]) >= 1


@pytest.mark.django_db
def test_export_master_data_excel(master_data_fixture):
    user = master_data_fixture["user"]
    tpl = master_data_fixture["template"]
    cir = master_data_fixture["circle"]

    buf, filename = MasterDataService.export_master_data_excel(
        user=user,
        template_id=tpl.id,
        circle_id=cir.id,
    )

    assert buf is not None
    assert buf.getvalue().startswith(b"PK")  # Valid zip / xlsx header
    assert filename.endswith(".xlsx")
