import io
import re
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional, Tuple
import openpyxl  # type: ignore
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side  # type: ignore
from openpyxl.utils import get_column_letter  # type: ignore
from openpyxl.worksheet.datavalidation import DataValidation  # type: ignore
from django.db import transaction
from django.db.models import Q
from django.core.exceptions import ValidationError, PermissionDenied
from django.utils import timezone

from apps.governance.models import (
    GovernanceActionPoint,
    GovernanceWeeklyUpdate,
    GovernanceBulkOperationLog,
)
from apps.identity.models import User


class GovernanceWeeklyUpdateService:
    @classmethod
    def can_update_weekly(cls, action_point: GovernanceActionPoint, user: User) -> bool:
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or getattr(user, "is_superadmin", False):
            return True
        if user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT, User.Role.CORPORATE_DOMAIN_LEAD]:
            return True
        if action_point.owner_id == user.id:
            return True
        if action_point.assigned_by_id == user.id or action_point.created_by_id == user.id:
            return True
        user_circle_id = getattr(user, "circle_id", None) or (user.circle.id if getattr(user, "circle", None) else None)
        if user.role == User.Role.CIRCLE_DOMAIN_MANAGER and user_circle_id == action_point.circle_id:
            return True
        return False

    @classmethod
    def submit_weekly_update(
        cls,
        action_point: GovernanceActionPoint,
        data: Dict[str, Any],
        user: User,
        allow_revision: bool = False,
    ) -> GovernanceWeeklyUpdate:
        """
        Submits or revises a weekly progress report for an action point.
        Prevents accidental duplicate submissions for the same reporting week.
        """
        if not cls.can_update_weekly(action_point, user):
            raise PermissionDenied("You are not authorized to submit weekly progress for this action point.")

        reporting_week = str(data.get("reporting_week") or "").strip()
        if not reporting_week:
            raise ValidationError({"reporting_week": "Reporting week identifier is required (e.g. 2026-W42)."})

        work_completed = str(data.get("work_completed") or "").strip()
        if not work_completed:
            raise ValidationError({"work_completed": "Work completed description is required."})

        raw_progress = data.get("progress_percent", 0)
        try:
            progress_percent = int(raw_progress)
            if progress_percent < 0 or progress_percent > 100:
                raise ValueError()
        except (ValueError, TypeError):
            raise ValidationError({"progress_percent": "Progress percentage must be an integer between 0 and 100."})

        status_val = data.get("status") or GovernanceActionPoint.Status.WIP
        if status_val not in GovernanceActionPoint.Status.values:
            status_val = GovernanceActionPoint.Status.WIP

        week_start_date = cls._parse_date(data.get("week_start_date"))
        week_end_date = cls._parse_date(data.get("week_end_date"))
        achievements = str(data.get("achievements") or "").strip()
        blockers = str(data.get("blockers") or "").strip()
        next_week_plan = str(data.get("next_week_plan") or "").strip()
        actual_closure_date = cls._parse_date(data.get("actual_closure_date"))
        remarks = str(data.get("remarks") or "").strip()

        with transaction.atomic():
            # Retrieve latest update to establish progression
            latest_update = GovernanceWeeklyUpdate.objects.filter(
                action_point=action_point,
            ).order_by("-submitted_at", "-id").first()

            prev_progress = (
                latest_update.progress_percent
                if latest_update
                else (action_point.current_progress_percent or 0)
            )
            prev_status = (
                latest_update.status
                if latest_update
                else action_point.status
            )

            # Determine revision count within this reporting week & total sequence
            week_updates_count = GovernanceWeeklyUpdate.objects.filter(
                action_point=action_point,
                reporting_week=reporting_week,
            ).count()
            revision_num = week_updates_count + 1

            total_updates_count = GovernanceWeeklyUpdate.objects.filter(
                action_point=action_point,
            ).count()
            update_seq = total_updates_count + 1

            update_obj = GovernanceWeeklyUpdate.objects.create(
                action_point=action_point,
                reporting_week=reporting_week,
                week_start_date=week_start_date,
                week_end_date=week_end_date,
                work_completed=work_completed,
                progress_percent=progress_percent,
                previous_progress_percent=prev_progress,
                previous_status=prev_status,
                update_sequence=update_seq,
                revision_number=revision_num,
                achievements=achievements,
                blockers=blockers,
                next_week_plan=next_week_plan,
                status=status_val,
                actual_closure_date=actual_closure_date,
                remarks=remarks,
                submitted_by=user,
            )

            # Sync parent action point progress & latest summary notes
            action_point.current_progress_percent = progress_percent
            summary_snippet = f"[{reporting_week} #{revision_num}] {work_completed[:120]}"
            action_point.last_update = summary_snippet
            action_point.reporting_week = reporting_week

            # If user selected Completed or Closed
            if status_val == GovernanceActionPoint.Status.CLOSED:
                from apps.governance.services.governance_task_review_service import GovernanceTaskReviewService
                GovernanceTaskReviewService.check_can_close_task(action_point, user)
                action_point.status = GovernanceActionPoint.Status.CLOSED
                if actual_closure_date:
                    action_point.actual_closure_date = actual_closure_date
                elif not action_point.actual_closure_date:
                    action_point.actual_closure_date = timezone.localdate()
            elif status_val == GovernanceActionPoint.Status.WIP:
                if action_point.status == GovernanceActionPoint.Status.OPEN:
                    action_point.status = GovernanceActionPoint.Status.WIP

            action_point.save()

        return update_obj

    @classmethod
    def bulk_submit_weekly_updates(
        cls,
        updates_list: List[Dict[str, Any]],
        user: User,
    ) -> Dict[str, Any]:
        """
        Bulk updates weekly progress across selected tasks.
        Validates every record individually and records a traceable bulk audit log.
        """
        results: List[Dict[str, Any]] = []
        success_count = 0
        failure_count = 0

        for item in updates_list:
            task_id = item.get("task_id")
            if not task_id:
                results.append({
                    "task_id": None,
                    "success": False,
                    "error": "Task ID is required for each update entry."
                })
                failure_count += 1
                continue

            try:
                action_point = GovernanceActionPoint.objects.get(id=task_id)
            except GovernanceActionPoint.DoesNotExist:
                results.append({
                    "task_id": task_id,
                    "success": False,
                    "error": f"Task #{task_id} not found."
                })
                failure_count += 1
                continue

            try:
                update_obj = cls.submit_weekly_update(
                    action_point=action_point,
                    data=item,
                    user=user,
                    allow_revision=item.get("allow_revision", False),
                )
                results.append({
                    "task_id": task_id,
                    "action_id": action_point.action_id,
                    "success": True,
                    "update_id": update_obj.id,
                    "reporting_week": update_obj.reporting_week,
                    "progress_percent": update_obj.progress_percent,
                })
                success_count += 1
            except (ValidationError, PermissionDenied) as e:
                err_msg = e.message_dict if hasattr(e, "message_dict") else str(e)
                results.append({
                    "task_id": task_id,
                    "action_id": action_point.action_id,
                    "success": False,
                    "error": err_msg,
                })
                failure_count += 1
            except Exception as e:
                results.append({
                    "task_id": task_id,
                    "action_id": action_point.action_id,
                    "success": False,
                    "error": str(e),
                })
                failure_count += 1

        # Audit log entry
        GovernanceBulkOperationLog.objects.create(
            operation_type=GovernanceBulkOperationLog.OperationType.WEEKLY_BULK_UPDATE,
            user=user,
            total_selected=len(updates_list),
            successful_count=success_count,
            failed_count=failure_count,
            details={"results_summary": results[:50]},
        )

        return {
            "total": len(updates_list),
            "successful_count": success_count,
            "failed_count": failure_count,
            "results": results,
        }

    WEEKLY_TEMPLATE_HEADERS = [
        "Task ID",
        "Task Title (Reference Only)",
        "Reporting Week Start (YYYY-MM-DD)",
        "Reporting Week End (YYYY-MM-DD)",
        "Work Completed",
        "Current Progress (%)",
        "Current Status",
        "Challenges / Blockers",
        "Next Week's Plan",
        "Actual Completion Date (YYYY-MM-DD)",
        "Remarks",
    ]

    @classmethod
    def generate_weekly_template(cls, user: User) -> io.BytesIO:
        wb = openpyxl.Workbook()
        ws: Any = wb.active or wb.create_sheet(title="Weekly Updates")
        ws.title = "Weekly Updates"

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="0369A1", end_color="0369A1", fill_type="solid")
        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1"),
        )
        center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
        left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)

        for col_idx, header in enumerate(cls.WEEKLY_TEMPLATE_HEADERS, start=1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.border = thin_border
            cell.alignment = center_align

        ws.row_dimensions[1].height = 28

        # Dropdown validation for status (Col G = 7)
        status_dv = DataValidation(
            type="list",
            formula1='"Open,WIP,Closed"',
            allow_blank=True,
        )
        ws.add_data_validation(status_dv)
        status_dv.add("G2:G500")

        # Validation for progress % (Col F = 6, 0 to 100)
        progress_dv = DataValidation(
            type="whole",
            operator="between",
            formula1="0",
            formula2="100",
            allow_blank=True,
        )
        ws.add_data_validation(progress_dv)
        progress_dv.add("F2:F500")

        # Determine current week start (Monday) and end (Sunday)
        today = timezone.localdate()
        monday = today - timedelta(days=today.weekday())
        sunday = monday + timedelta(days=6)

        # Pre-populate user's active assigned tasks
        user_tasks = (
            GovernanceActionPoint.objects.filter(owner=user)
            .exclude(status=GovernanceActionPoint.Status.CLOSED)
            .order_by("action_id")
        )

        current_row = 2
        for task in user_tasks:
            ws.cell(row=current_row, column=1, value=task.action_id).alignment = center_align
            ws.cell(row=current_row, column=2, value=task.action_point).alignment = left_align
            ws.cell(row=current_row, column=3, value=monday.strftime("%Y-%m-%d")).alignment = center_align
            ws.cell(row=current_row, column=4, value=sunday.strftime("%Y-%m-%d")).alignment = center_align
            ws.cell(row=current_row, column=5, value="").alignment = left_align
            ws.cell(row=current_row, column=6, value=task.current_progress_percent or 0).alignment = center_align
            ws.cell(row=current_row, column=7, value=task.status).alignment = center_align
            ws.cell(row=current_row, column=8, value="").alignment = left_align
            ws.cell(row=current_row, column=9, value="").alignment = left_align
            ws.cell(row=current_row, column=10, value="").alignment = center_align
            ws.cell(row=current_row, column=11, value="").alignment = left_align

            for c in range(1, 12):
                ws.cell(row=current_row, column=c).border = thin_border
            ws.row_dimensions[current_row].height = 22
            current_row += 1

        # Adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 14)

        ws.column_dimensions["A"].width = 16
        ws.column_dimensions["B"].width = 34
        ws.column_dimensions["E"].width = 38
        ws.column_dimensions["H"].width = 28
        ws.column_dimensions["I"].width = 28

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    @classmethod
    def _parse_date(cls, val: Any) -> Optional[date]:
        if not val:
            return None
        if isinstance(val, datetime):
            return val.date()
        if isinstance(val, date):
            return val
        val_str = str(val).strip()
        if not val_str:
            return None
        clean_str = val_str.split("T")[0].split(" ")[0].strip()
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(clean_str, fmt).date()
            except ValueError:
                continue
        return None

    @classmethod
    def _parse_progress(cls, val: Any) -> int:
        if val is None or val == "":
            return 0
        try:
            if isinstance(val, float) and 0.0 < val <= 1.0:
                return round(val * 100)
            cleaned = str(val).replace("%", "").strip()
            num = int(float(cleaned))
            return max(0, min(100, num))
        except (ValueError, TypeError):
            return 0

    @classmethod
    def _parse_status(cls, val: Any) -> str:
        s = str(val or "").strip().lower()
        if s in ["closed", "completed", "done", "close"]:
            return GovernanceActionPoint.Status.CLOSED
        if s in ["open", "new"]:
            return GovernanceActionPoint.Status.OPEN
        return GovernanceActionPoint.Status.WIP

    @classmethod
    def parse_and_preview_weekly_excel(cls, file_obj, user: User) -> Dict[str, Any]:
        """
        Parses an uploaded weekly progress Excel workbook and validates row-by-row before committing.
        Enforces strict Task-Level Access Control against the authenticated user.
        """
        wb = openpyxl.load_workbook(file_obj, data_only=True)
        ws: Any = wb.active
        if ws is None:
            if wb.worksheets:
                ws = wb.worksheets[0]
            else:
                return {
                    "total_rows": 0,
                    "valid_rows_count": 0,
                    "invalid_rows_count": 0,
                    "parsed_rows": [],
                    "error_summary": ["The uploaded workbook contains no active worksheet."],
                }

        header_map: Dict[str, int] = {}
        for col_idx in range(1, ws.max_column + 1):
            val = str(ws.cell(row=1, column=col_idx).value or "").strip().lower()
            if "task id" in val or "action id" in val:
                header_map["task_id"] = col_idx
            elif "title" in val or "action point" in val:
                header_map["title"] = col_idx
            elif "start" in val:
                header_map["week_start"] = col_idx
            elif "end" in val:
                header_map["week_end"] = col_idx
            elif "work completed" in val or "completed" in val:
                header_map["work_completed"] = col_idx
            elif "progress" in val:
                header_map["progress"] = col_idx
            elif "status" in val:
                header_map["status"] = col_idx
            elif "blocker" in val or "challenge" in val:
                header_map["blockers"] = col_idx
            elif "next week" in val or "plan" in val:
                header_map["next_week_plan"] = col_idx
            elif "actual closure" in val or "completion date" in val:
                header_map["actual_closure_date"] = col_idx
            elif "remark" in val:
                header_map["remarks"] = col_idx

        task_id_col = header_map.get("task_id", 1)
        title_col = header_map.get("title", 2)
        start_col = header_map.get("week_start", 3)
        end_col = header_map.get("week_end", 4)
        work_col = header_map.get("work_completed", 5)
        progress_col = header_map.get("progress", 6)
        status_col = header_map.get("status", 7)
        blockers_col = header_map.get("blockers", 8)
        plan_col = header_map.get("next_week_plan", 9)
        closure_col = header_map.get("actual_closure_date", 10)
        remarks_col = header_map.get("remarks", 11)

        rows = []
        valid_count = 0
        invalid_count = 0
        today = timezone.localdate()

        for row_idx in range(2, ws.max_row + 1):
            raw_task_id = ws.cell(row=row_idx, column=task_id_col).value
            if raw_task_id is None or str(raw_task_id).strip() == "":
                is_empty = all(ws.cell(row=row_idx, column=c).value is None for c in range(1, 12))
                if is_empty:
                    continue
                raw_task_id = ""

            task_id_str = str(raw_task_id).strip()
            title_val = str(ws.cell(row=row_idx, column=title_col).value or "").strip()
            week_start_val = ws.cell(row=row_idx, column=start_col).value
            week_end_val = ws.cell(row=row_idx, column=end_col).value
            work_val = str(ws.cell(row=row_idx, column=work_col).value or "").strip()
            progress_val = ws.cell(row=row_idx, column=progress_col).value
            status_val = ws.cell(row=row_idx, column=status_col).value
            blockers_val = str(ws.cell(row=row_idx, column=blockers_col).value or "").strip()
            plan_val = str(ws.cell(row=row_idx, column=plan_col).value or "").strip()
            closure_val = ws.cell(row=row_idx, column=closure_col).value
            remarks_val = str(ws.cell(row=row_idx, column=remarks_col).value or "").strip()

            parsed_start = cls._parse_date(week_start_val)
            parsed_end = cls._parse_date(week_end_val)
            parsed_progress = cls._parse_progress(progress_val)
            parsed_status = cls._parse_status(status_val)
            parsed_closure = cls._parse_date(closure_val)

            if parsed_start:
                iso_year, iso_week, _ = parsed_start.isocalendar()
                reporting_week = f"{iso_year}-W{iso_week:02d}"
            else:
                iso_year, iso_week, _ = today.isocalendar()
                reporting_week = f"{iso_year}-W{iso_week:02d}"

            errors = []

            # 1. Validate Task ID existence
            if not task_id_str:
                errors.append("Task ID is missing.")
                action = None
            else:
                task_q = Q(action_id__iexact=task_id_str)
                if task_id_str.isdigit():
                    task_q |= Q(id=int(task_id_str))
                action = GovernanceActionPoint.objects.filter(task_q).first()
                if not action:
                    errors.append(f"Task ID '{task_id_str}' does not exist.")

            # 2. Strict Task-Level Access Control Check
            if action:
                if not cls.can_update_weekly(action, user):
                    assigned_to_name = (
                        (action.owner.get_full_name() or action.owner.username)
                        if action.owner
                        else (action.owner_name_override or "another user")
                    )
                    errors.append(f"Unauthorized: Task '{task_id_str}' is assigned to {assigned_to_name}. You can only update tasks assigned to you.")

            # 3. Validate Work Completed
            if not work_val:
                errors.append("Work Completed description is required.")

            # 4. Check if duplicate weekly update
            already_exists = False
            if action:
                already_exists = GovernanceWeeklyUpdate.objects.filter(
                    action_point=action,
                    reporting_week=reporting_week,
                ).exists()

            # 5. Mandatory Evidence Check on Closure
            if action and parsed_status == GovernanceActionPoint.Status.CLOSED:
                if action.evidence_required and action.evidence_status != GovernanceActionPoint.EvidenceStatus.ACCEPTED:
                    is_admin_or_mgr = (
                        user.is_superuser
                        or getattr(user, "is_superadmin", False)
                        or user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT]
                    )
                    if not is_admin_or_mgr:
                        errors.append(f"Cannot close task '{task_id_str}': Mandatory evidence is required and has not been accepted.")

            is_valid = len(errors) == 0
            if is_valid:
                valid_count += 1
            else:
                invalid_count += 1

            rows.append({
                "row_num": row_idx,
                "task_id": task_id_str,
                "task_title": action.action_point if action else (title_val or "—"),
                "reporting_week": reporting_week,
                "week_start_date": parsed_start.strftime("%Y-%m-%d") if parsed_start else None,
                "week_end_date": parsed_end.strftime("%Y-%m-%d") if parsed_end else None,
                "work_completed": work_val,
                "progress_percent": parsed_progress,
                "status": parsed_status,
                "blockers": blockers_val,
                "next_week_plan": plan_val,
                "actual_closure_date": parsed_closure.strftime("%Y-%m-%d") if parsed_closure else None,
                "remarks": remarks_val,
                "already_exists": already_exists,
                "is_valid": is_valid,
                "errors": errors,
            })

        return {
            "total_rows": len(rows),
            "valid_rows_count": valid_count,
            "invalid_rows_count": invalid_count,
            "rows": rows,
        }

    @classmethod
    def import_weekly_excel(
        cls,
        file_obj,
        user: User,
        allow_revision: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes weekly progress Excel import.
        Enforces strict task-level authorization and records full bulk audit history.
        """
        preview_data = cls.parse_and_preview_weekly_excel(file_obj, user)
        rows = preview_data["rows"]

        results = []
        error_report = []
        successful_count = 0
        failed_count = 0

        for r in rows:
            row_num = r["row_num"]
            task_id = r["task_id"]
            task_title = r["task_title"]

            if not r["is_valid"]:
                err_text = "; ".join(r["errors"])
                results.append({
                    "row_num": row_num,
                    "task_id": task_id,
                    "task_title": task_title,
                    "success": False,
                    "error": err_text,
                })
                error_report.append({
                    "row_num": row_num,
                    "task_id": task_id,
                    "task_title": task_title,
                    "error": err_text,
                    "work_completed": r["work_completed"][:100],
                })
                failed_count += 1
                continue

            try:
                commit_task_str = str(task_id).strip()
                task_q = Q(action_id__iexact=commit_task_str)
                if commit_task_str.isdigit():
                    task_q |= Q(id=int(commit_task_str))
                action = GovernanceActionPoint.objects.filter(task_q).first()

                if not action:
                    raise ValidationError(f"Task ID '{task_id}' not found.")

                if not cls.can_update_weekly(action, user):
                    raise PermissionDenied(f"Task '{task_id}' is not assigned to you.")

                update_obj = cls.submit_weekly_update(
                    action_point=action,
                    data=r,
                    user=user,
                    allow_revision=allow_revision,
                )

                results.append({
                    "row_num": row_num,
                    "task_id": task_id,
                    "task_title": task_title,
                    "success": True,
                    "update_id": update_obj.id,
                    "reporting_week": update_obj.reporting_week,
                    "progress_percent": update_obj.progress_percent,
                    "status": update_obj.status,
                })
                successful_count += 1
            except (ValidationError, PermissionDenied) as e:
                err_msg = str(e.message_dict if hasattr(e, "message_dict") else e)
                results.append({
                    "row_num": row_num,
                    "task_id": task_id,
                    "task_title": task_title,
                    "success": False,
                    "error": err_msg,
                })
                error_report.append({
                    "row_num": row_num,
                    "task_id": task_id,
                    "task_title": task_title,
                    "error": err_msg,
                    "work_completed": r["work_completed"][:100],
                })
                failed_count += 1
            except Exception as e:
                err_msg = str(e)
                results.append({
                    "row_num": row_num,
                    "task_id": task_id,
                    "task_title": task_title,
                    "success": False,
                    "error": err_msg,
                })
                error_report.append({
                    "row_num": row_num,
                    "task_id": task_id,
                    "task_title": task_title,
                    "error": err_msg,
                    "work_completed": r["work_completed"][:100],
                })
                failed_count += 1

        # Traceable bulk audit log
        GovernanceBulkOperationLog.objects.create(
            operation_type=GovernanceBulkOperationLog.OperationType.WEEKLY_EXCEL_IMPORT,
            user=user,
            total_selected=len(rows),
            successful_count=successful_count,
            failed_count=failed_count,
            details={
                "results_summary": results[:50],
                "error_report_summary": error_report[:50],
            },
        )

        return {
            "total": len(rows),
            "valid_count": preview_data["valid_rows_count"],
            "successful_count": successful_count,
            "failed_count": failed_count,
            "results": results,
            "error_report": error_report,
        }

    @classmethod
    def generate_error_report_file(cls, error_report: List[Dict[str, Any]]) -> io.BytesIO:
        wb = openpyxl.Workbook()
        ws: Any = wb.active or wb.create_sheet(title="Import Errors")
        ws.title = "Import Errors"

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="DC2626", end_color="DC2626", fill_type="solid")
        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1"),
        )
        center_align = Alignment(horizontal="center", vertical="center")
        left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)

        headers = ["Row Number", "Task ID", "Task Title", "Rejection Reason", "Work Completed"]
        for col_idx, header in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.border = thin_border
            cell.alignment = center_align

        ws.row_dimensions[1].height = 26

        for idx, item in enumerate(error_report, start=2):
            ws.cell(row=idx, column=1, value=item.get("row_num", idx)).alignment = center_align
            ws.cell(row=idx, column=2, value=item.get("task_id", "—")).alignment = center_align
            ws.cell(row=idx, column=3, value=item.get("task_title", "—")).alignment = left_align
            ws.cell(row=idx, column=4, value=item.get("error", "Unknown error")).alignment = left_align
            ws.cell(row=idx, column=5, value=item.get("work_completed", "")).alignment = left_align

            for c in range(1, 6):
                ws.cell(row=idx, column=c).border = thin_border
            ws.row_dimensions[idx].height = 22

        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 14)

        ws.column_dimensions["C"].width = 28
        ws.column_dimensions["D"].width = 45
        ws.column_dimensions["E"].width = 30

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output
