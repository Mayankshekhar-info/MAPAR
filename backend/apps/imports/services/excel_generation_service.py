"""
Dynamic Excel (.xlsx) Template Generation Service.
Generates fully-styled, validated workbooks from database column specifications.
Zero static files.
"""

import io
from typing import Optional
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from apps.imports.models import UploadTemplateVersion, UploadTemplate


class ExcelGenerationService:
    # Enterprise MAPAR styling tokens
    HEADER_FILL = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
    HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    REQUIRED_HEADER_FILL = PatternFill(start_color="0369A1", end_color="0369A1", fill_type="solid")
    
    INSTRUCTION_HEADER_FILL = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    INSTRUCTION_HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    
    THIN_BORDER = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1")
    )

    @classmethod
    def generate_template_workbook(
        cls,
        version: UploadTemplateVersion,
        clean_only: Optional[bool] = None,
    ) -> io.BytesIO:
        """
        Builds a dynamic .xlsx workbook from the database column definitions of a template version.
        Supports clean export mode (single sheet, exact headers only, no sample rows or extra sheets)
        when clean_only is True, or when configured with [CLEAN_TEMPLATE] on the template description/code.
        """
        if clean_only is None:
            template_code = getattr(getattr(version, "template", None), "code", "")
            template_desc = getattr(getattr(version, "template", None), "description", "") or ""
            clean_only = (
                "[CLEAN_TEMPLATE]" in template_desc
                or template_code in ["UPLOAD_EXCEL_TEMPLATE", "EXCEL_UPLOAD_TEMPLATE"]
            )

        wb = Workbook()
        
        # 1. Primary Sheet: Single sheet for clean template, or Data Entry for standard
        ws_data = wb.active
        ws_data.title = "Sheet1" if clean_only else "Data Entry"
        ws_data.views.sheetView[0].showGridLines = True

        columns = list(version.columns.all().order_by("column_order", "id"))

        # Write Header Row
        for col_idx, col in enumerate(columns, start=1):
            cell = ws_data.cell(row=1, column=col_idx)
            # In clean mode, use exact display_label without any asterisk modifier
            label_text = col.display_label if clean_only else (f"{col.display_label} *" if col.is_required else col.display_label)
            cell.value = label_text
            cell.font = cls.HEADER_FONT
            cell.fill = cls.REQUIRED_HEADER_FILL if (col.is_required and not clean_only) else cls.HEADER_FILL
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = cls.THIN_BORDER
            
            # Set minimum width
            col_letter = get_column_letter(col_idx)
            header_len = max(len(label_text) + 4, 15)
            ws_data.column_dimensions[col_letter].width = min(max(header_len, 16), 40)

        # Set header row height
        ws_data.row_dimensions[1].height = 28

        # Only add sample rows and instructions sheet when not in clean_only mode
        if not clean_only:
            # Add 5 blank sample rows with borders
            for row_idx in range(2, 7):
                ws_data.row_dimensions[row_idx].height = 20
                for col_idx, col in enumerate(columns, start=1):
                    cell = ws_data.cell(row=row_idx, column=col_idx)
                    cell.border = cls.THIN_BORDER
                    # Alignment based on data type
                    if col.data_type in ["INTEGER", "DECIMAL", "PERCENTAGE"]:
                        cell.alignment = Alignment(horizontal="right", vertical="center")
                    else:
                        cell.alignment = Alignment(horizontal="left", vertical="center")

            # 2. Reference Sheet: Column Rules & Guide
            ws_guide = wb.create_sheet(title="Column Guide & Instructions")
            ws_guide.views.sheetView[0].showGridLines = True

            guide_headers = ["Column #", "Display Header", "Data Type", "Required?", "Unique?", "Field Description", "Validation Rules"]
            for g_idx, g_title in enumerate(guide_headers, start=1):
                c = ws_guide.cell(row=1, column=g_idx)
                c.value = g_title
                c.font = cls.INSTRUCTION_HEADER_FONT
                c.fill = cls.INSTRUCTION_HEADER_FILL
                c.alignment = Alignment(horizontal="center", vertical="center")
                c.border = cls.THIN_BORDER

            ws_guide.row_dimensions[1].height = 26

            for r_idx, col in enumerate(columns, start=2):
                ws_guide.row_dimensions[r_idx].height = 20
                
                row_vals = [
                    r_idx - 1,
                    col.display_label,
                    col.get_data_type_display(),
                    "Yes" if col.is_required else "Optional",
                    "Yes" if col.is_unique else "No",
                    col.description or "No description provided",
                    str(col.validation_rules) if col.validation_rules else "Standard"
                ]
                
                for c_idx, val in enumerate(row_vals, start=1):
                    cell = ws_guide.cell(row=r_idx, column=c_idx)
                    cell.value = val
                    cell.border = cls.THIN_BORDER
                    cell.alignment = Alignment(
                        horizontal="center" if c_idx in [1, 3, 4, 5] else "left",
                        vertical="center"
                    )

            # Auto width for guide sheet
            for col_cells in ws_guide.columns:
                max_len = max(len(str(cell.value or "")) for cell in col_cells)
                col_letter = get_column_letter(col_cells[0].column)
                ws_guide.column_dimensions[col_letter].width = min(max(max_len + 3, 14), 45)

        # Save to buffer
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer
