"""
Upload Processing & Validation Service for Uploads Module.
Authoritative backend validation for workbook structure, headers, rows, types,
uniqueness, organization hierarchy, and user circle-scoped authorization.
Source files are archived untouched.
"""

import os
import uuid
import datetime
from decimal import Decimal, InvalidOperation
from typing import Dict, Any, List, Tuple, cast
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.core.exceptions import ValidationError
from openpyxl import load_workbook  # type: ignore

from common.database.transactions import atomic_operation
from apps.imports.models import (
    UploadTemplateVersion,
    UploadTemplateColumn,
    ImportBatch,
    ImportStagedRow,
    ImportValidationError,
    ImportAuditLineage,
)
from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Domain,
    Department,
    SubDepartment,
)
from apps.dashboard.selectors.cockpit_selectors import get_user_circle_ids
from apps.dashboard.models import ReportingPeriod


class UploadValidationService:
    @staticmethod
    def _sanitize_header(header: Any) -> str:
        """Strips whitespace, lowercases, and removes trailing requirement indicators."""
        if not header:
            return ""
        h_str = str(header).strip()
        if h_str.endswith("*"):
            h_str = h_str[:-1].strip()
        return h_str.lower().replace("_", " ").replace("-", " ")

    @staticmethod
    def _sanitize_cell_value(val: Any) -> Any:
        """
        Converts non-JSON-serializable objects (datetime, date, time, Decimal)
        returned by openpyxl into standard JSON types.
        """
        if val is None:
            return None
        if isinstance(val, datetime.datetime):
            if val.time() == datetime.time.min:
                return val.strftime("%Y-%m-%d")
            return val.strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(val, datetime.date):
            return val.strftime("%Y-%m-%d")
        if isinstance(val, datetime.time):
            return val.strftime("%H:%M:%S")
        if isinstance(val, Decimal):
            return str(val)
        if isinstance(val, str):
            return val.strip()
        return val

    @classmethod
    def _save_uploaded_source_file(cls, uploaded_file: UploadedFile, batch_id: str) -> str:
        """
        Saves the source file into media storage untouched.
        Never modifies, overwrites, or alters source bytes.
        """
        upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads", "batches")
        os.makedirs(upload_dir, exist_ok=True)
        orig_name = uploaded_file.name or "upload.xlsx"
        ext = os.path.splitext(orig_name)[1]
        filename = f"{batch_id}_{orig_name}"
        file_path = os.path.join(upload_dir, filename)

        with open(file_path, "wb+") as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)

        return file_path

    @classmethod
    def process_and_validate_upload(
        cls,
        version: UploadTemplateVersion,
        uploaded_file: UploadedFile,
        reporting_period_id: Any = None,
        reporting_period_type: Any = None,
        reporting_date: Any = None,
        start_date: Any = None,
        end_date: Any = None,
        kpi_id: Any = None,
        company_id: Any = None,
        sub_company_id: Any = None,
        project_id: Any = None,
        circle_id: Any = None,
        department_id: Any = None,
        duplicate_handling: str = "ERROR",
        user=None,
        auto_commit: bool = False,
    ) -> ImportBatch:
        """
        Main entry point for processing and validating an uploaded Excel workbook.
        Performs full pipeline:
        1. File validation (.xlsx extension, readability, SHA-256 duplicate detection)
        2. Header verification against template column definitions
        3. Deterministic cleaning and normalization (whitespace, dates, numbers)
        4. Row-by-row type, requirement, and business-key duplicate validation
        5. Hierarchy reference validation against live organization database
        6. User-scoped circle authorization checks
        7. Staging and error record creation (REVIEW_REQUIRED on errors, auto-commit if valid)
        """
        from apps.imports.services.data_cleaning_service import DataCleaningService

        # Validate extension
        orig_name = uploaded_file.name or ""
        ext = os.path.splitext(orig_name)[1].lower()
        if ext not in [".xlsx", ".xlsm"]:
            raise ValidationError("Invalid file format. Only Excel (.xlsx) workbooks are supported.")

        # Compute file hash
        file_hash = DataCleaningService.compute_file_hash(uploaded_file)
        if duplicate_handling == "ERROR":
            dup_batch = DataCleaningService.detect_duplicate_file(file_hash, template_version_id=version.id)
            if dup_batch:
                raise ValidationError(
                    f"Duplicate file detected: This exact workbook has already been uploaded and processed under Batch '{dup_batch.batch_id}' on {dup_batch.created_at.strftime('%Y-%m-%d %H:%M')}."
                )

        # Generate unique Batch ID
        today_str = datetime.date.today().strftime("%Y%m%d")
        batch_id = f"BATCH-{today_str}-{uuid.uuid4().hex[:6].upper()}"

        # Save source file intact
        stored_path = cls._save_uploaded_source_file(uploaded_file, batch_id)

        # Parse workbook with openpyxl in read-only / data-only mode
        try:
            wb = load_workbook(filename=stored_path, data_only=True)
        except Exception as e:
            raise ValidationError(f"Unable to read Excel workbook: {str(e)}")

        sheet_names = wb.sheetnames
        # Prefer 'Data Entry' or use the first worksheet
        ws: Any
        if "Data Entry" in sheet_names:
            ws = wb["Data Entry"]
        else:
            ws = wb.worksheets[0]

        # 1. Inspect Header Row
        header_row = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
        if not header_row or all(h is None for h in header_row):
            raise ValidationError("Uploaded worksheet contains no header row.")

        # Map template columns
        expected_columns = list(
            UploadTemplateColumn.objects.filter(version=version).order_by("column_order", "id")
        )
        col_header_map: Dict[int, Any] = {} # col_idx -> expected_column

        # Normalize header matching
        sanitized_file_headers = [cls._sanitize_header(h) for h in header_row]

        missing_required_headers = []
        for col in expected_columns:
            sanitized_label = cls._sanitize_header(col.display_label)
            sanitized_name = cls._sanitize_header(col.name)
            
            # Find matching column index
            match_idx = None
            for idx, f_hdr in enumerate(sanitized_file_headers):
                if f_hdr and (f_hdr == sanitized_label or f_hdr == sanitized_name):
                    match_idx = idx
                    break

            if match_idx is not None:
                col_header_map[match_idx] = col
            elif col.is_required:
                missing_required_headers.append(col.display_label)

        if missing_required_headers:
            raise ValidationError(
                f"Missing required columns in uploaded Excel file: {', '.join(missing_required_headers)}"
            )

        # 2. Pre-fetch Organization Data for Hierarchy Validation
        active_main_cos = {mc.code.upper(): mc for mc in MainCompany.objects.filter(status="ACTIVE")}
        active_sub_cos = {sc.code.upper(): sc for sc in SubCompany.objects.filter(status="ACTIVE")}
        active_projects = {p.code.upper(): p for p in Project.objects.filter(status="ACTIVE")}
        active_circles = {c.code.upper(): c for c in Circle.objects.filter(is_active=True)}
        active_domains = {d.code.upper(): d for d in Domain.objects.filter(is_active=True)}
        active_depts = {dp.code.upper(): dp for dp in Department.objects.filter(status="ACTIVE")}
        active_teams = {t.code.upper(): t for t in SubDepartment.objects.filter(status="ACTIVE")}

        # Scoped authorization for user
        user_scope = None
        if user and user.is_authenticated:
            try:
                from common.permissions.authorization import AuthorizationService
                user_scope = AuthorizationService.get_user_hierarchy_scope(user)
            except Exception:
                user_scope = None

        user_allowed_circle_ids = None
        if user_scope and not user_scope.is_unrestricted:
            user_allowed_circle_ids = user_scope.circle_ids

        # 3. Read Data Rows and Validate
        staged_rows_data = []
        validation_errors_data = []
        unique_tracker: Dict[str, set] = {col.name: set() for col in expected_columns if col.is_unique}

        total_rows_count = 0
        valid_rows_count = 0
        error_rows_count = 0

        # Read rows starting at row 2
        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            # Check if row is completely empty
            if not row or all(v is None or str(v).strip() == "" for v in row):
                continue

            total_rows_count += 1
            row_data: Dict[str, Any] = {}
            row_errors: List[str] = []

            # Populate row_data
            for col_idx, cell_value in enumerate(row):
                col_def = col_header_map.get(col_idx)
                raw_header = header_row[col_idx] if col_idx < len(header_row) else None
                cleaned_val = cls._sanitize_cell_value(cell_value)

                if col_def:
                    row_data[col_def.name] = cleaned_val
                    row_data[col_def.display_label] = cleaned_val
                if raw_header is not None:
                    h_name = str(raw_header).strip()
                    if h_name:
                        row_data[h_name] = cleaned_val

                if not col_def:
                    continue

                # Required Check
                is_empty = (cleaned_val is None or cleaned_val == "")
                if col_def.is_required and is_empty:
                    err_msg = f"Field '{col_def.display_label}' is required and cannot be blank."
                    row_errors.append(err_msg)
                    validation_errors_data.append({
                        "row_index": row_idx,
                        "column_name": col_def.display_label,
                        "cell_value": "",
                        "error_message": err_msg,
                        "severity": ImportValidationError.Severity.ERROR,
                    })

                # If value is present, validate data type
                if not is_empty:
                    val_str = str(cleaned_val)

                    # Unique Check
                    if col_def.is_unique:
                        val_key = val_str.lower()
                        if val_key in unique_tracker[col_def.name]:
                            err_msg = f"Duplicate value '{cleaned_val}' found for unique column '{col_def.display_label}'."
                            row_errors.append(err_msg)
                            validation_errors_data.append({
                                "row_index": row_idx,
                                "column_name": col_def.display_label,
                                "cell_value": val_str,
                                "error_message": err_msg,
                                "severity": ImportValidationError.Severity.ERROR,
                            })
                        else:
                            unique_tracker[col_def.name].add(val_key)

                    # Type checks
                    if col_def.data_type == "INTEGER":
                        try:
                            int(val_str.split(".")[0])
                        except (ValueError, TypeError):
                            err_msg = f"Value '{cleaned_val}' is not a valid integer for column '{col_def.display_label}'."
                            row_errors.append(err_msg)
                            validation_errors_data.append({
                                "row_index": row_idx,
                                "column_name": col_def.display_label,
                                "cell_value": val_str,
                                "error_message": err_msg,
                                "severity": ImportValidationError.Severity.ERROR,
                            })

                    elif col_def.data_type in ["DECIMAL", "PERCENTAGE"]:
                        try:
                            cleaned_dec_str = val_str.replace("%", "").strip()
                            Decimal(cleaned_dec_str)
                        except (InvalidOperation, TypeError):
                            err_msg = f"Value '{cleaned_val}' is not a valid numeric decimal for column '{col_def.display_label}'."
                            row_errors.append(err_msg)
                            validation_errors_data.append({
                                "row_index": row_idx,
                                "column_name": col_def.display_label,
                                "cell_value": val_str,
                                "error_message": err_msg,
                                "severity": ImportValidationError.Severity.ERROR,
                            })

                    elif col_def.data_type == "DATE":
                        if not isinstance(cell_value, (datetime.date, datetime.datetime)):
                            try:
                                datetime.date.fromisoformat(val_str[:10])
                            except (ValueError, TypeError):
                                err_msg = f"Value '{cleaned_val}' is not a valid ISO date (YYYY-MM-DD) for column '{col_def.display_label}'."
                                row_errors.append(err_msg)
                                validation_errors_data.append({
                                    "row_index": row_idx,
                                    "column_name": col_def.display_label,
                                    "cell_value": val_str,
                                    "error_message": err_msg,
                                    "severity": ImportValidationError.Severity.ERROR,
                                })

                    elif col_def.data_type == "BOOLEAN":
                        norm_bool = val_str.lower()
                        if norm_bool not in ["true", "false", "yes", "no", "1", "0", "y", "n"]:
                            err_msg = f"Value '{cleaned_val}' is not a valid boolean (Yes/No, True/False) for column '{col_def.display_label}'."
                            row_errors.append(err_msg)
                            validation_errors_data.append({
                                "row_index": row_idx,
                                "column_name": col_def.display_label,
                                "cell_value": val_str,
                                "error_message": err_msg,
                                "severity": ImportValidationError.Severity.ERROR,
                            })

                    elif col_def.data_type == "REFERENCE":
                        # Check hierarchy reference rules
                        ref_level = col_def.validation_rules.get("reference_level", "CIRCLE").upper()
                        target_code = val_str.upper()

                        if ref_level in ("MAIN_COMPANY", "COMPANY"):
                            mc_obj = active_main_cos.get(target_code)
                            if not mc_obj:
                                err_msg = f"Company with code '{target_code}' does not exist or is inactive."
                                row_errors.append(err_msg)
                                validation_errors_data.append({
                                    "row_index": row_idx,
                                    "column_name": col_def.display_label,
                                    "cell_value": val_str,
                                    "error_message": err_msg,
                                    "severity": ImportValidationError.Severity.ERROR,
                                })
                            elif user_scope and not user_scope.is_unrestricted:
                                if user_scope.main_company_ids is not None and mc_obj.id not in user_scope.main_company_ids:
                                    err_msg = f"Access Denied: You are not authorized to import data for Company '{mc_obj.name}' ({mc_obj.code})."
                                    row_errors.append(err_msg)
                                    validation_errors_data.append({
                                        "row_index": row_idx,
                                        "column_name": col_def.display_label,
                                        "cell_value": val_str,
                                        "error_message": err_msg,
                                        "severity": ImportValidationError.Severity.ERROR,
                                    })

                        elif ref_level == "SUB_COMPANY":
                            sc_obj = active_sub_cos.get(target_code)
                            if not sc_obj:
                                err_msg = f"Sub-Company with code '{target_code}' does not exist or is inactive."
                                row_errors.append(err_msg)
                                validation_errors_data.append({
                                    "row_index": row_idx,
                                    "column_name": col_def.display_label,
                                    "cell_value": val_str,
                                    "error_message": err_msg,
                                    "severity": ImportValidationError.Severity.ERROR,
                                })
                            elif user_scope and not user_scope.is_unrestricted:
                                if user_scope.sub_company_ids is not None and sc_obj.id not in user_scope.sub_company_ids:
                                    err_msg = f"Access Denied: You are not authorized to import data for Sub-Company '{sc_obj.name}' ({sc_obj.code})."
                                    row_errors.append(err_msg)
                                    validation_errors_data.append({
                                        "row_index": row_idx,
                                        "column_name": col_def.display_label,
                                        "cell_value": val_str,
                                        "error_message": err_msg,
                                        "severity": ImportValidationError.Severity.ERROR,
                                    })

                        elif ref_level == "PROJECT":
                            proj_obj = active_projects.get(target_code)
                            if not proj_obj:
                                err_msg = f"Project with code '{target_code}' does not exist or is inactive."
                                row_errors.append(err_msg)
                                validation_errors_data.append({
                                    "row_index": row_idx,
                                    "column_name": col_def.display_label,
                                    "cell_value": val_str,
                                    "error_message": err_msg,
                                    "severity": ImportValidationError.Severity.ERROR,
                                })
                            elif user_scope and not user_scope.is_unrestricted:
                                if user_scope.project_ids is not None and proj_obj.id not in user_scope.project_ids:
                                    err_msg = f"Access Denied: You are not authorized to import data for Project '{proj_obj.name}' ({proj_obj.code})."
                                    row_errors.append(err_msg)
                                    validation_errors_data.append({
                                        "row_index": row_idx,
                                        "column_name": col_def.display_label,
                                        "cell_value": val_str,
                                        "error_message": err_msg,
                                        "severity": ImportValidationError.Severity.ERROR,
                                    })

                        elif ref_level == "CIRCLE":
                            circle_obj = active_circles.get(target_code)
                            if not circle_obj:
                                err_msg = f"Circle with code '{target_code}' does not exist or is inactive."
                                row_errors.append(err_msg)
                                validation_errors_data.append({
                                    "row_index": row_idx,
                                    "column_name": col_def.display_label,
                                    "cell_value": val_str,
                                    "error_message": err_msg,
                                    "severity": ImportValidationError.Severity.ERROR,
                                })
                            elif user_scope and not user_scope.is_unrestricted:
                                if not user_scope.is_circle_allowed(circle_obj.id):
                                    err_msg = f"Access Denied: You are not authorized to import data for Circle '{circle_obj.name}' ({circle_obj.code})."
                                    row_errors.append(err_msg)
                                    validation_errors_data.append({
                                        "row_index": row_idx,
                                        "column_name": col_def.display_label,
                                        "cell_value": val_str,
                                        "error_message": err_msg,
                                        "severity": ImportValidationError.Severity.ERROR,
                                    })

                        elif ref_level == "DOMAIN":
                            dom_obj = active_domains.get(target_code)
                            if not dom_obj:
                                err_msg = f"Domain with code '{target_code}' does not exist or is inactive."
                                row_errors.append(err_msg)
                                validation_errors_data.append({
                                    "row_index": row_idx,
                                    "column_name": col_def.display_label,
                                    "cell_value": val_str,
                                    "error_message": err_msg,
                                    "severity": ImportValidationError.Severity.ERROR,
                                })
                            elif user_scope and not user_scope.is_unrestricted:
                                if not user_scope.is_domain_allowed(dom_obj.id):
                                    err_msg = f"Access Denied: You are not authorized to import data for Domain '{dom_obj.name}' ({dom_obj.code})."
                                    row_errors.append(err_msg)
                                    validation_errors_data.append({
                                        "row_index": row_idx,
                                        "column_name": col_def.display_label,
                                        "cell_value": val_str,
                                        "error_message": err_msg,
                                        "severity": ImportValidationError.Severity.ERROR,
                                    })

                        elif ref_level == "DEPARTMENT":
                            dept_obj = active_depts.get(target_code)
                            if not dept_obj:
                                err_msg = f"Department with code '{target_code}' does not exist or is inactive."
                                row_errors.append(err_msg)
                                validation_errors_data.append({
                                    "row_index": row_idx,
                                    "column_name": col_def.display_label,
                                    "cell_value": val_str,
                                    "error_message": err_msg,
                                    "severity": ImportValidationError.Severity.ERROR,
                                })
                            elif user_scope and not user_scope.is_unrestricted:
                                if not user_scope.is_department_allowed(dept_obj.id):
                                    err_msg = f"Access Denied: You are not authorized to import data for Department '{dept_obj.name}' ({dept_obj.code})."
                                    row_errors.append(err_msg)
                                    validation_errors_data.append({
                                        "row_index": row_idx,
                                        "column_name": col_def.display_label,
                                        "cell_value": val_str,
                                        "error_message": err_msg,
                                        "severity": ImportValidationError.Severity.ERROR,
                                    })

                        elif ref_level in ("SUB_DEPARTMENT", "TEAM"):
                            team_obj = active_teams.get(target_code)
                            if not team_obj:
                                err_msg = f"Team/Sub-Department with code '{target_code}' does not exist or is inactive."
                                row_errors.append(err_msg)
                                validation_errors_data.append({
                                    "row_index": row_idx,
                                    "column_name": col_def.display_label,
                                    "cell_value": val_str,
                                    "error_message": err_msg,
                                    "severity": ImportValidationError.Severity.ERROR,
                                })
                            elif user_scope and not user_scope.is_unrestricted:
                                if not user_scope.is_team_allowed(team_obj.id):
                                    err_msg = f"Access Denied: You are not authorized to import data for Team '{team_obj.name}' ({team_obj.code})."
                                    row_errors.append(err_msg)
                                    validation_errors_data.append({
                                        "row_index": row_idx,
                                        "column_name": col_def.display_label,
                                        "cell_value": val_str,
                                        "error_message": err_msg,
                                        "severity": ImportValidationError.Severity.ERROR,
                                    })

            is_row_valid = len(row_errors) == 0
            if is_row_valid:
                valid_rows_count += 1
            else:
                error_rows_count += 1

            staged_rows_data.append({
                "row_index": row_idx,
                "raw_data": row_data,
                "is_valid": is_row_valid,
                "validation_errors": row_errors,
            })

        # Duplicate business records detection using unique template columns
        business_key_cols = [c.name for c in expected_columns if c.is_unique]
        if not business_key_cols:
            # Fallback to key reference fields if present
            for cand in ["bsnl_site_id", "site_id", "action_code", "kpi_code"]:
                if cand in [c.name.lower() for c in expected_columns]:
                    business_key_cols = [cand]
                    break

        staged_rows_data, duplicate_count = DataCleaningService.detect_and_handle_record_duplicates(
            staged_rows_data,
            business_key_cols=business_key_cols,
            duplicate_mode=duplicate_handling,
            user=user,
        )

        # Recount valid and error rows after duplicate evaluation
        valid_rows_count = sum(1 for item in staged_rows_data if item["is_valid"])
        error_rows_count = sum(1 for item in staged_rows_data if not item["is_valid"] and not item.get("is_skipped"))

        # Determine batch status: REVIEW_REQUIRED on any validation errors, VALIDATED if all valid
        if total_rows_count == 0:
            batch_status = ImportBatch.Status.FAILED
            summary_notes = "Uploaded file contains 0 data rows."
        elif error_rows_count > 0:
            batch_status = ImportBatch.Status.REVIEW_REQUIRED
            summary_notes = f"Validation completed with {error_rows_count} invalid rows out of {total_rows_count} total rows. Complete batch marked as REVIEW_REQUIRED (no partial publication)."
        else:
            batch_status = ImportBatch.Status.VALIDATED
            dup_note = f" ({duplicate_count} duplicates skipped)" if duplicate_count and duplicate_handling == "SKIP" else ""
            summary_notes = f"All {valid_rows_count} rows passed validation and cleaning{dup_note}."

        # 4. Auto-resolve circle & hierarchy context
        final_circle_id = int(circle_id) if circle_id and str(circle_id).isdigit() else None
        if not final_circle_id:
            detected_circles = set()
            for item in staged_rows_data:
                if item["is_valid"]:
                    raw = item["raw_data"]
                    for k, v in raw.items():
                        if "circle" in k.lower() and v:
                            s_v = str(v).strip().upper()
                            if s_v in active_circles:
                                detected_circles.add(active_circles[s_v].id)
                                break
                            norm_v = s_v.replace("_", "").replace("-", "").replace(" ", "").replace("CIRCLE", "").replace("SH", "S")
                            for c_code, c_obj in active_circles.items():
                                norm_code = c_code.replace("_", "").replace("-", "").replace(" ", "").replace("CIRCLE", "").replace("SH", "S")
                                if norm_v == norm_code:
                                    detected_circles.add(c_obj.id)
                                    break
            if len(detected_circles) == 1:
                final_circle_id = next(iter(detected_circles))

        final_company_id = int(company_id) if company_id and str(company_id).isdigit() else None
        final_sub_company_id = int(sub_company_id) if sub_company_id and str(sub_company_id).isdigit() else None
        final_project_id = int(project_id) if project_id and str(project_id).isdigit() else None
        final_department_id = int(department_id) if department_id and str(department_id).isdigit() else None

        if final_circle_id and (not final_project_id or not final_sub_company_id or not final_company_id):
            cir_obj = Circle.objects.filter(id=final_circle_id).select_related("project__sub_company__main_company").first()
            if cir_obj and cir_obj.project:
                if not final_project_id:
                    final_project_id = cir_obj.project_id
                if not final_sub_company_id and cir_obj.project.sub_company_id:
                    final_sub_company_id = cir_obj.project.sub_company_id
                if not final_company_id and cir_obj.project.sub_company and cir_obj.project.sub_company.main_company_id:
                    final_company_id = cir_obj.project.sub_company.main_company_id

        # Resolve reporting period
        resolved_period = None
        if reporting_period_id and str(reporting_period_id).isdigit():
            resolved_period = ReportingPeriod.objects.filter(id=int(reporting_period_id)).first()

        if not resolved_period:
            from apps.reporting.services.period_resolution_service import PeriodResolutionService
            period_type = (reporting_period_type or "").upper()
            if period_type == "DAILY" or (reporting_date and not period_type):
                rep_d = reporting_date or start_date
                if rep_d:
                    resolved_period = PeriodResolutionService.resolve_period(
                        period_type=PeriodResolutionService.DAILY,
                        start_date=rep_d,
                        end_date=rep_d,
                        period_name=f"Daily: {rep_d}",
                    )
            elif period_type == "WEEKLY":
                if start_date and end_date:
                    resolved_period = PeriodResolutionService.resolve_period(
                        period_type=PeriodResolutionService.WEEKLY,
                        start_date=start_date,
                        end_date=end_date,
                        period_name=f"Weekly: {start_date} to {end_date}",
                    )
                elif start_date or reporting_date:
                    ref_d = start_date or reporting_date
                    parsed_d = datetime.date.fromisoformat(str(ref_d).strip()) if isinstance(ref_d, str) else ref_d
                    w_start, w_end = PeriodResolutionService.get_week_bounds(parsed_d)
                    resolved_period = PeriodResolutionService.resolve_period(
                        period_type=PeriodResolutionService.WEEKLY,
                        start_date=w_start,
                        end_date=w_end,
                        period_name=f"Weekly: {w_start} to {w_end}",
                    )
            elif period_type == "MONTHLY":
                ref_d = reporting_date or start_date
                if ref_d:
                    parsed_d = datetime.date.fromisoformat(str(ref_d).strip()) if isinstance(ref_d, str) else ref_d
                    m_start, m_end = PeriodResolutionService.get_month_bounds(parsed_d.year, parsed_d.month)
                    resolved_period = PeriodResolutionService.resolve_period(
                        period_type=PeriodResolutionService.MONTHLY,
                        start_date=m_start,
                        end_date=m_end,
                        period_name=f"Monthly: {m_start.strftime('%B %Y')}",
                    )
            elif period_type in [PeriodResolutionService.QUARTERLY, PeriodResolutionService.YEARLY, PeriodResolutionService.CUSTOM]:
                resolved_period = PeriodResolutionService.resolve_period(
                    period_type=period_type,
                    start_date=start_date,
                    end_date=end_date,
                )
            else:
                resolved_period = PeriodResolutionService.get_active_or_current_period()

        # 5. Atomic persistence of Batch, Staged Rows, and Errors
        with atomic_operation():
            batch = ImportBatch.objects.create(
                batch_id=batch_id,
                template_version=version,
                reporting_period=resolved_period,
                company_id=final_company_id,
                sub_company_id=final_sub_company_id,
                project_id=final_project_id,
                circle_id=final_circle_id,
                department_id=final_department_id,
                uploaded_by=user,
                original_filename=uploaded_file.name or "uploaded_workbook.xlsx",
                stored_file_path=stored_path,
                file_size_bytes=uploaded_file.size,
                file_hash=file_hash,
                total_rows=total_rows_count,
                valid_rows=valid_rows_count,
                error_rows=error_rows_count,
                duplicate_rows_count=duplicate_count,
                duplicate_handling=duplicate_handling,
                status=batch_status,
                summary_notes=summary_notes,
            )

            # Bulk create staged rows
            staged_objects = [
                ImportStagedRow(
                    batch=batch,
                    row_index=item["row_index"],
                    raw_data=item["raw_data"],
                    is_valid=item["is_valid"],
                    validation_errors=item["validation_errors"],
                )
                for item in staged_rows_data
            ]
            ImportStagedRow.objects.bulk_create(staged_objects)

            # Bulk create validation errors
            error_objects = [
                ImportValidationError(
                    batch=batch,
                    row_index=item["row_index"],
                    column_name=item["column_name"],
                    cell_value=item["cell_value"],
                    error_message=item["error_message"],
                    severity=item["severity"],
                )
                for item in validation_errors_data
            ]
            ImportValidationError.objects.bulk_create(error_objects)

            # Initial Lineage audit event
            ImportAuditLineage.objects.create(
                batch=batch,
                template_version=version,
                action="FILE_UPLOADED_AND_VALIDATED",
                records_affected=total_rows_count,
                details={
                    "original_filename": uploaded_file.name,
                    "total_rows": total_rows_count,
                    "valid_rows": valid_rows_count,
                    "error_rows": error_rows_count,
                    "duplicate_rows": duplicate_count,
                    "duplicate_handling": duplicate_handling,
                    "status": batch_status,
                    "circle_id": final_circle_id,
                    "company_id": final_company_id,
                },
                performed_by=user,
            )

            # Auto-commit 100% valid batches to PostgreSQL when requested or configured
            if auto_commit and batch_status == ImportBatch.Status.VALIDATED and error_rows_count == 0 and valid_rows_count > 0:
                try:
                    from apps.imports.services.import_execution_service import ImportExecutionService
                    commit_out = ImportExecutionService.commit_batch(batch, user=user)
                    batch.auto_committed = True
                    batch.status = ImportBatch.Status.COMPLETED
                    batch.summary_notes = f"All {valid_rows_count} records cleanly validated, auto-committed, and stored in PostgreSQL."
                    batch.save(update_fields=["auto_committed", "status", "summary_notes"])
                except Exception as commit_ex:
                    batch.summary_notes += f" Auto-commit notice: {str(commit_ex)}"
                    batch.save(update_fields=["summary_notes"])

        # 6. KPI Execution Handling
        target_kpi = None
        if kpi_id and str(kpi_id).isdigit():
            from apps.kpi.models import KPIDefinition
            target_kpi = KPIDefinition.objects.filter(id=int(kpi_id), is_active=True).first()

        if target_kpi:
            # Enforce hierarchy scope resolution: ensure KPI applies to this batch's node
            if final_circle_id:
                node_lvl, node_id = "CIRCLE", final_circle_id
            elif getattr(batch, "project_id", None):
                node_lvl, node_id = "PROJECT", batch.project_id
            elif final_company_id:
                node_lvl, node_id = "MAIN_COMPANY", final_company_id
            else:
                node_lvl, node_id = "ENTERPRISE", 1

            from apps.kpi.services.kpi_engine_service import KPIEngineService
            resolved_kpi = KPIEngineService.resolve_kpi_for_scope(
                kpi_code=target_kpi.code,
                hierarchy_level=node_lvl,
                hierarchy_id=node_id,
            )

            if not resolved_kpi:
                batch.kpi_execution_status = "COMPATIBILITY_ERROR"
                batch.kpi_result_summary = {
                    "status": "COMPATIBILITY_ERROR",
                    "kpi_id": target_kpi.id,
                    "kpi_code": target_kpi.code,
                    "kpi_name": target_kpi.name,
                    "message": f"KPI '{target_kpi.code}' is not authorized or scoped for hierarchy node {node_lvl}:{node_id}.",
                }
                batch.save(update_fields=["kpi_execution_status", "kpi_result_summary"])
                target_kpi = None
            else:
                target_kpi = resolved_kpi
                batch.applied_kpi = target_kpi

        if target_kpi:
            # Compatibility check: ensure all required parameters and filters are present in expected template columns
            version_col_names = {c.name.strip().upper() for c in expected_columns} | {c.display_label.strip().upper() for c in expected_columns}
            missing_cols = []
            for param in target_kpi.parameters.all():
                if param.source_column and param.source_column.strip().upper() not in version_col_names:
                    missing_cols.append(param.source_column)
            for flt in target_kpi.filters.all():
                if flt.field_name and flt.field_name.strip().upper() not in version_col_names:
                    missing_cols.append(flt.field_name)

            if missing_cols:
                batch.kpi_execution_status = "COMPATIBILITY_ERROR"
                batch.kpi_result_summary = {
                    "status": "COMPATIBILITY_ERROR",
                    "kpi_id": target_kpi.id,
                    "kpi_code": target_kpi.code,
                    "kpi_name": target_kpi.name,
                    "message": f"KPI requires column(s) not found in uploaded dataset: {', '.join(set(missing_cols))}",
                    "missing_columns": list(set(missing_cols)),
                }
                batch.save(update_fields=["applied_kpi", "kpi_execution_status", "kpi_result_summary"])
            else:
                batch.kpi_execution_status = "PROCESSING"
                batch.save(update_fields=["applied_kpi", "kpi_execution_status"])
                try:
                    from apps.kpi.services.kpi_engine_service import KPIEngineService
                    target_lvl = target_kpi.hierarchy_level or ("CIRCLE" if final_circle_id else "MAIN_COMPANY")
                    target_nid = target_kpi.hierarchy_id or (final_circle_id if target_lvl == "CIRCLE" else (final_company_id or 1))
                    calc_res = KPIEngineService.calculate_kpi(
                        kpi=target_kpi,
                        period=batch.reporting_period,
                        hierarchy_level=target_lvl,
                        hierarchy_id=target_nid,
                        trigger_type="UPLOAD_COMMIT",
                        batch_id=batch.batch_id,
                        user=user,
                    )
                    batch.kpi_execution_status = "COMPLETED" if calc_res.get("calculation_status") == "SUCCESS" else "FAILED"
                    batch.kpi_result_summary = calc_res
                    batch.save(update_fields=["kpi_execution_status", "kpi_result_summary"])
                except Exception as ex:
                    batch.kpi_execution_status = "FAILED"
                    batch.kpi_result_summary = {
                        "status": "FAILED",
                        "error": str(ex),
                        "kpi_id": target_kpi.id,
                        "kpi_code": target_kpi.code,
                        "kpi_name": target_kpi.name,
                    }
                    batch.save(update_fields=["kpi_execution_status", "kpi_result_summary"])
        elif batch.valid_rows > 0:
            # Trigger downstream KPI recalculation for this batch
            try:
                from apps.kpi.services.kpi_recalculation_service import KPIRecalculationService
                KPIRecalculationService.recalculate_for_batch(batch, user=user)
            except Exception:
                pass

        return batch

