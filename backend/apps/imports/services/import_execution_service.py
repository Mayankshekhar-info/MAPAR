"""
Import Execution & Commit Service for Uploads Module.
Executes transactional staging commits into MAPAR operational target entities,
generates downloadable error report workbooks, and maintains audit lineage.
"""

import io
from decimal import Decimal
from typing import Dict, Any, List
from django.core.exceptions import ValidationError
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from common.database.transactions import atomic_operation
from apps.imports.models import (
    ImportBatch,
    ImportStagedRow,
    ImportValidationError,
    ImportAuditLineage,
)
from apps.dashboard.models import KPI, KPIValue, ReportingPeriod
from apps.organization.models import Circle, Domain, HierarchyAuditLog


class ImportExecutionService:
    @classmethod
    def commit_batch(cls, batch: ImportBatch, user=None) -> Dict[str, Any]:
        """
        Transactional commit of valid staged records in the batch.
        Marks batch as COMPLETED and logs lineage.
        """
        if batch.status == ImportBatch.Status.COMPLETED:
            raise ValidationError("This batch has already been committed.")

        valid_staged_rows = list(
            ImportStagedRow.objects.filter(batch=batch, is_valid=True, is_imported=False)
        )

        if not valid_staged_rows:
            raise ValidationError("There are no valid uncommitted rows in this batch to import.")

        template = batch.template_version.template
        committed_count = 0

        with atomic_operation():
            batch.status = ImportBatch.Status.COMMITTING
            batch.save(update_fields=["status", "updated_at"])

            # Map uploaded operational rows directly into MAPAR KPIValue data layer
            if template.target_entity in ["KPI_VALUES", "OPERATIONS", "WORKFORCE"]:
                period = batch.reporting_period
                if not period:
                    period = (
                        ReportingPeriod.objects.filter(is_current=True).first()
                        or ReportingPeriod.objects.first()
                    )

                active_circles = {c.code.upper(): c for c in Circle.objects.filter(is_active=True)}
                for c in Circle.objects.filter(is_active=True):
                    active_circles[c.name.upper()] = c

                columns = list(batch.template_version.columns.all())

                # Find circle reference column
                circle_col_name = None
                for col in columns:
                    if col.data_type == "REFERENCE" and col.validation_rules.get("reference_level") == "CIRCLE":
                        circle_col_name = col.name
                        break
                if not circle_col_name:
                    for col in columns:
                        if "circle" in col.name.lower() or "circle" in col.display_label.lower():
                            circle_col_name = col.name
                            break

                default_domain = Domain.objects.first()

                for row in valid_staged_rows:
                    raw = row.raw_data

                    # 1. Circle resolution
                    circle_val = None
                    if circle_col_name and circle_col_name in raw:
                        circle_val = str(raw[circle_col_name]).strip().upper()
                    if not circle_val:
                        for k, v in raw.items():
                            if "circle" in k.lower() and v:
                                circle_val = str(v).strip().upper()
                                break

                    circle_obj = active_circles.get(circle_val) if circle_val else None
                    if not circle_obj:
                        # Fallback to circle associated with user or first active circle
                        if active_circles:
                            circle_obj = next(iter(active_circles.values()))
                        else:
                            continue

                    # 2. Metric / KPI resolution
                    kpi_code = None
                    kpi_name = None
                    for k in ["kpi_code", "metric_code", "resource_code", "code", "kpi", "resource_category", "resource"]:
                        if k in raw and raw[k]:
                            kpi_code = str(raw[k]).strip().upper().replace(" ", "_")
                            break

                    for k in ["kpi_name", "metric_name", "resource_name", "resource_category", "name", "kpi", "category"]:
                        if k in raw and raw[k]:
                            kpi_name = str(raw[k]).strip()
                            break

                    if not kpi_name:
                        kpi_name = template.name
                    if not kpi_code:
                        kpi_code = f"KPI_{kpi_name[:15].upper().replace(' ', '_')}"

                    domain_for_kpi = circle_obj.domains.first() or default_domain

                    kpi_obj, _ = KPI.objects.get_or_create(
                        code=kpi_code,
                        defaults={
                            "name": kpi_name,
                            "domain": domain_for_kpi,
                            "unit": "Units",
                            "direction": "HIGHER_BETTER",
                            "is_active": True,
                        }
                    )

                    # 3. Values extraction (Actual / Available vs. Target / Required)
                    actual_val_raw = None
                    target_val_raw = None

                    # Check semantic keyword matches in raw keys
                    for k, v in raw.items():
                        if v is None or str(v).strip() == "":
                            continue
                        k_norm = k.lower()
                        if actual_val_raw is None and any(term in k_norm for term in ["actual", "available", "current", "achieved", "attained"]):
                            actual_val_raw = v
                        elif target_val_raw is None and any(term in k_norm for term in ["target", "required", "plan", "budget", "need"]):
                            target_val_raw = v

                    if actual_val_raw is None:
                        for k in ["actual_value", "actual", "available", "available_manpower", "value", "count", "headcount", "output", "amount"]:
                            if k in raw and raw[k] is not None and str(raw[k]).strip() != "":
                                actual_val_raw = raw[k]
                                break

                    if target_val_raw is None:
                        for k in ["target_value", "target", "required", "required_manpower", "plan", "budget"]:
                            if k in raw and raw[k] is not None and str(raw[k]).strip() != "":
                                target_val_raw = raw[k]
                                break

                    if actual_val_raw is None:
                        numeric_cols = [c for c in columns if c.data_type in ["DECIMAL", "INTEGER", "PERCENTAGE"]]
                        if len(numeric_cols) > 0 and numeric_cols[0].name in raw:
                            actual_val_raw = raw[numeric_cols[0].name]
                        if len(numeric_cols) > 1 and numeric_cols[1].name in raw and target_val_raw is None:
                            target_val_raw = raw[numeric_cols[1].name]

                    if actual_val_raw is None:
                        continue

                    try:
                        clean_actual = Decimal(str(actual_val_raw).replace("%", "").strip())
                    except Exception:
                        continue

                    clean_target = None
                    if target_val_raw is not None:
                        try:
                            clean_target = Decimal(str(target_val_raw).replace("%", "").strip())
                        except Exception:
                            clean_target = clean_actual
                    else:
                        clean_target = clean_actual

                    # RAG calculation
                    variance = clean_actual - clean_target
                    if clean_target > 0:
                        var_pct = round((variance / clean_target) * Decimal("100.00"), 2)
                        if clean_actual >= clean_target:
                            rag_status = "GREEN"
                        elif clean_actual >= clean_target * Decimal("0.80"):
                            rag_status = "AMBER"
                        else:
                            rag_status = "RED"
                    else:
                        var_pct = Decimal("0.00")
                        rag_status = "GREEN" if clean_actual >= 0 else "RED"

                    if "rag_status" in raw and str(raw["rag_status"]).upper() in ["GREEN", "AMBER", "RED"]:
                        rag_status = str(raw["rag_status"]).upper()

                    # Save to live MAPAR KPIValue table
                    if period:
                        KPIValue.objects.update_or_create(
                            kpi=kpi_obj,
                            circle=circle_obj,
                            period=period,
                            defaults={
                                "actual_value": clean_actual,
                                "target_value": clean_target,
                                "variance_to_target": variance,
                                "variance_percentage": var_pct,
                                "rag_status": rag_status,
                                "notes": f"Ingested via Uploads Batch {batch.batch_id} (Template {template.name} v{batch.template_version.version_number})",
                                "entered_by": user if user and user.is_authenticated else None,
                            }
                        )

            # Mark staged rows as imported
            for row in valid_staged_rows:
                row.is_imported = True
                row.save(update_fields=["is_imported"])
                committed_count += 1

            # Update batch status
            batch.status = ImportBatch.Status.COMPLETED
            batch.summary_notes = f"Successfully imported {committed_count} records into MAPAR on {batch.updated_at}."
            batch.save(update_fields=["status", "summary_notes", "updated_at"])

            # Lineage audit record
            ImportAuditLineage.objects.create(
                batch=batch,
                template_version=batch.template_version,
                action="BATCH_COMMITTED",
                records_affected=committed_count,
                details={
                    "committed_rows": committed_count,
                    "target_entity": template.target_entity,
                    "reporting_period": batch.reporting_period.name if batch.reporting_period else None,
                },
                performed_by=user,
            )

            # Master HierarchyAuditLog
            HierarchyAuditLog.objects.create(
                user=user if user and user.is_authenticated else None,
                action="IMPORT",
                level="IMPORT_BATCH",
                object_id=str(batch.batch_id),
                object_repr=f"Import Batch {batch.batch_id} ({template.name})",
                details={
                    "committed_records": committed_count,
                    "template": template.name,
                    "version": batch.template_version.version_number,
                }
            )

        # Trigger dynamic Universal KPI recalculation pipeline
        recalc_summary = None
        try:
            from apps.kpi.services.kpi_recalculation_service import KPIRecalculationService
            recalc_summary = KPIRecalculationService.recalculate_for_batch(batch, user=user)
        except Exception:
            pass

        return {
            "success": True,
            "batch_id": batch.batch_id,
            "committed_rows": committed_count,
            "status": batch.status,
            "kpi_recalculation": recalc_summary,
        }

    @classmethod
    def generate_error_report(cls, batch: ImportBatch) -> io.BytesIO:
        """
        Builds a dedicated Excel (.xlsx) workbook detailing all validation errors in the batch.
        The original uploaded file is never modified.
        """
        wb = Workbook()
        ws = wb.active
        ws.title = "Validation Errors"
        ws.views.sheetView[0].showGridLines = True

        header_fill = PatternFill(start_color="DC2626", end_color="DC2626", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1")
        )

        # Batch Header Info
        ws.cell(row=1, column=1, value="MAPAR-v2 Import Batch Error Diagnostic Report").font = Font(size=14, bold=True, color="0F172A")
        ws.cell(row=2, column=1, value=f"Batch ID: {batch.batch_id} | Template: {batch.template_version.template.name} (v{batch.template_version.version_number})")
        ws.cell(row=3, column=1, value=f"Original File: {batch.original_filename} | Total Rows: {batch.total_rows} | Error Rows: {batch.error_rows}")

        # Table Headers at Row 5
        table_headers = ["Row # in Excel", "Column Name", "Submitted Value", "Error Description", "Severity Level"]
        for col_idx, title in enumerate(table_headers, start=1):
            c = ws.cell(row=5, column=col_idx, value=title)
            c.font = header_font
            c.fill = header_fill
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.border = thin_border

        ws.row_dimensions[5].height = 26

        # Populate error rows
        errors = batch.validation_errors.all().order_by("row_index", "column_name")
        for row_offset, err in enumerate(errors, start=6):
            ws.row_dimensions[row_offset].height = 20
            row_vals = [
                err.row_index,
                err.column_name,
                err.cell_value,
                err.error_message,
                err.severity,
            ]
            for c_idx, val in enumerate(row_vals, start=1):
                cell = ws.cell(row=row_offset, column=c_idx, value=val)
                cell.border = thin_border
                cell.alignment = Alignment(
                    horizontal="center" if c_idx in [1, 5] else "left",
                    vertical="center"
                )

        # Auto width
        for col_cells in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col_cells)
            col_letter = get_column_letter(col_cells[0].column)
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 16), 55)

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer
