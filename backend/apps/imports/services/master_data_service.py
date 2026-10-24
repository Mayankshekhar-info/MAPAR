"""
Master Data Service.
Business logic for managing, validating, updating, and exporting operational master data records.
Enforces transactional integrity, audit logging, and downstream synchronization.
"""

import io
from decimal import Decimal, InvalidOperation
from typing import Dict, Any, List, Optional
from django.core.exceptions import ValidationError
from rest_framework.exceptions import PermissionDenied, NotFound
from openpyxl import Workbook  # type: ignore
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side  # type: ignore
from openpyxl.utils import get_column_letter  # type: ignore

from common.database.transactions import atomic_operation
from apps.imports.models import (
    UploadTemplate,
    UploadTemplateVersion,
    UploadTemplateColumn,
    ImportBatch,
    ImportStagedRow,
    ImportAuditLineage,
    ImportValidationError,
)
from apps.organization.models import HierarchyAuditLog
from apps.imports.selectors.master_data_selectors import (
    get_master_data_record_by_id,
    list_master_data_records,
)
from apps.imports.services.upload_validation_service import UploadValidationService
from apps.imports.api.views import check_can_manage_uploads


class MasterDataService:

    @classmethod
    def update_record(
        cls,
        record_id: int,
        updated_data: Dict[str, Any],
        user=None,
    ) -> Dict[str, Any]:
        """
        Validates, updates, and saves a Master Data record (ImportStagedRow).
        Enforces user permissions, column validation rules, and structured audit logs.
        """
        if not check_can_manage_uploads(user):
            raise PermissionDenied("Access Denied: You do not have permission to edit Master Data records.")

        row = get_master_data_record_by_id(record_id, user=user)
        batch = row.batch
        template_version = batch.template_version
        columns = list(UploadTemplateColumn.objects.filter(version=template_version).order_by("column_order", "id"))

        # Merge new fields into existing raw_data
        merged_raw = dict(row.raw_data)
        changed_fields = {}
        for k, v in updated_data.items():
            old_val = merged_raw.get(k)
            if old_val != v:
                changed_fields[k] = {"old": old_val, "new": v}
            merged_raw[k] = v

        # Row-level validation against template columns
        row_errors: List[str] = []
        for col in columns:
            col_name = col.name
            col_label = col.display_label
            val = merged_raw.get(col_name, merged_raw.get(col_label))

            # Required check
            if col.is_required:
                if val is None or str(val).strip() == "":
                    row_errors.append(f"Field '{col_label}' is required.")
                    continue

            if val is not None and str(val).strip() != "":
                val_str = str(val).strip()
                dtype = col.data_type

                if dtype == UploadTemplateColumn.DataType.INTEGER:
                    try:
                        int(float(val_str.replace(",", "")))
                    except Exception:
                        row_errors.append(f"Field '{col_label}' must be a valid whole number.")

                elif dtype == UploadTemplateColumn.DataType.DECIMAL:
                    try:
                        Decimal(val_str.replace(",", "").replace("$", "").replace("₹", ""))
                    except Exception:
                        row_errors.append(f"Field '{col_label}' must be a valid decimal number.")

                elif dtype == UploadTemplateColumn.DataType.PERCENTAGE:
                    try:
                        clean_pct = Decimal(val_str.replace("%", "").strip())
                        if clean_pct < 0 or clean_pct > 100:
                            row_errors.append(f"Field '{col_label}' percentage must be between 0 and 100.")
                    except Exception:
                        row_errors.append(f"Field '{col_label}' must be a valid percentage.")

                elif dtype == UploadTemplateColumn.DataType.BOOLEAN:
                    if str(val).upper() not in ["TRUE", "FALSE", "1", "0", "YES", "NO"]:
                        row_errors.append(f"Field '{col_label}' must be Yes/No or True/False.")

        is_row_valid = len(row_errors) == 0

        with atomic_operation():
            row.raw_data = merged_raw
            row.is_valid = is_row_valid
            row.validation_errors = row_errors
            row.save(update_fields=["raw_data", "is_valid", "validation_errors"])

            # Recalculate batch valid/error row counts
            batch.valid_rows = ImportStagedRow.objects.filter(batch=batch, is_valid=True).count()
            batch.error_rows = ImportStagedRow.objects.filter(batch=batch, is_valid=False).count()
            batch.save(update_fields=["valid_rows", "error_rows", "updated_at"])

            # Structured Lineage Audit
            ImportAuditLineage.objects.create(
                batch=batch,
                template_version=template_version,
                action="RECORD_EDITED",
                records_affected=1,
                details={
                    "record_id": record_id,
                    "row_index": row.row_index,
                    "changed_fields": changed_fields,
                    "is_valid": is_row_valid,
                    "validation_errors": row_errors,
                },
                performed_by=user,
            )

            # Master HierarchyAuditLog
            HierarchyAuditLog.objects.create(
                user=user,
                action="UPDATE",
                level="MASTER_DATA_RECORD",
                object_id=str(record_id),
                object_repr=f"Master Data Row #{row.row_index} ({batch.batch_id})",
                details={
                    "batch_id": batch.batch_id,
                    "template": template_version.template.name,
                    "changed_fields_count": len(changed_fields),
                },
            )

        # Master Data is strictly reference-only: does not trigger KPI recalculations or affect business reporting

        return {
            "id": row.id,
            "row_index": row.row_index,
            "raw_data": row.raw_data,
            "is_valid": row.is_valid,
            "validation_errors": row.validation_errors,
            "is_imported": row.is_imported,
            "batch_id": batch.batch_id,
            "updated_at": batch.updated_at.isoformat(),
        }

    @classmethod
    def export_master_data_excel(
        cls,
        user=None,
        template_id: Optional[int] = None,
        batch_id: Optional[str] = None,
        company_id: Optional[int] = None,
        sub_company_id: Optional[int] = None,
        project_id: Optional[int] = None,
        circle_id: Optional[int] = None,
        department_id: Optional[int] = None,
        period_id: Optional[int] = None,
        search: Optional[str] = None,
    ) -> tuple[io.BytesIO, str]:
        """
        Exports the current working database values for the selected hierarchy and dataset to Excel (.xlsx).
        Preserves original column names, order, and styling.
        Never modifies source files.
        """
        data = list_master_data_records(
            user=user,
            template_id=template_id,
            batch_id=batch_id,
            company_id=company_id,
            sub_company_id=sub_company_id,
            project_id=project_id,
            circle_id=circle_id,
            department_id=department_id,
            period_id=period_id,
            search=search,
            limit=5000,
            offset=0,
        )

        columns = data["columns"]
        records = data["records"]
        tpl_name = data["template"]["name"] if data.get("template") else "Master_Data"
        clean_tpl_name = str(tpl_name).replace(" ", "_").replace("/", "_")

        wb = Workbook()
        ws: Any = wb.active
        if ws is None:
            ws = wb.create_sheet(title="Master Data")
        else:
            ws.title = "Master Data"

        # Styling
        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        data_font = Font(name="Calibri", size=10)
        thin_border = Border(
            left=Side(style="thin", color="E2E8F0"),
            right=Side(style="thin", color="E2E8F0"),
            top=Side(style="thin", color="E2E8F0"),
            bottom=Side(style="thin", color="E2E8F0"),
        )

        # Header Row
        headers = [col["display_label"] for col in columns] if columns else ["Row #", "Data"]
        for col_idx, header_text in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_idx, value=header_text)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        ws.row_dimensions[1].height = 28

        # Data Rows
        for row_idx, rec in enumerate(records, 2):
            raw = rec.get("raw_data", {})
            if columns:
                for col_idx, col in enumerate(columns, 1):
                    col_name = col["name"]
                    col_label = col["display_label"]
                    cell_val = raw.get(col_name, raw.get(col_label, ""))

                    # Cast numbers where appropriate
                    if col["data_type"] in (UploadTemplateColumn.DataType.INTEGER, UploadTemplateColumn.DataType.DECIMAL):
                        try:
                            if cell_val is not None and str(cell_val).strip() != "":
                                cell_val = float(str(cell_val).replace(",", ""))
                        except Exception:
                            pass

                    cell = ws.cell(row=row_idx, column=col_idx, value=cell_val)
                    cell.font = data_font
                    cell.border = thin_border
                    cell.alignment = Alignment(vertical="center")
            else:
                cell = ws.cell(row=row_idx, column=1, value=str(raw))
                cell.font = data_font
                cell.border = thin_border

            ws.row_dimensions[row_idx].height = 20

        # Auto-fit column widths
        for col_cells in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col_cells)
            first_cell = col_cells[0]
            col_letter = getattr(first_cell, "column_letter", None) or get_column_letter(first_cell.column)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        filename = f"{clean_tpl_name}_master_data.xlsx"
        return buf, filename
