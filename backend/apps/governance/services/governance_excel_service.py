import io
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Tuple, cast
import openpyxl
from openpyxl.worksheet.worksheet import Worksheet
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from django.utils import timezone
from django.db import transaction

from apps.governance.models import GovernanceActionPoint, GovernanceTargetRevision
from apps.governance.services.governance_service import GovernanceService
from apps.organization.models import Circle
from apps.identity.models import User


class GovernanceExcelService:
    """
    Handles end-to-end import, export, and template generation for Governance Action Tracking.
    Faithfully mirrors 'Governance & Action Tracking.xlsx' with all sheets:
    - Open Points Tracker
    - Owner_wise_Dasboard
    - State-wise Dashboard
    - Ageing Summary
    - Target Revision History
    - How to Use
    """

    # Field aliases map for robust header identification without positional guessing
    FIELD_ALIASES = {
        "action_id": ["action id (optional)", "action id", "action_id", "s.no", "sno", "task id", "action code", "action item id"],
        "circle": ["circle code", "circle name", "circle", "state", "region"],
        "function_area": ["function/area", "function area", "function", "area", "domain"],
        "action_point": ["action point", "action item", "task description", "description"],
        "key_deliverable": ["key requirement / deliverable", "key requirement", "key deliverable", "deliverable", "requirement"],
        "owner": ["owner (username/email)", "action owner", "assigned to", "owner", "pic", "responsibility", "assigned"],
        "raised_date": ["raised date (yyyy-mm-dd)", "raised date", "raised on", "date raised", "created date", "meeting / raised date", "meeting date"],
        "target_closure_date": ["target closure date (yyyy-mm-dd)", "target closure date", "target date", "due date", "deadline"],
        "current_target": ["current target date", "current target", "revised target"],
        "status": ["status", "state"],
        "priority": ["priority", "severity", "urgency"],
        "actual_closure_date": ["actual closure date (yyyy-mm-dd)", "actual closure date", "closure date", "completion date"],
        "last_update": [
            "last update", "latest update", "remarks", "update", "notes",
            "cbh update", "cbh update – action taken", "cbh update - action taken",
            "next step / commitment – cbh", "next step / commitment - cbh", "next step",
        ],
        "reporting_week": [
            "reporting week", "week", "week no", "week no.", "week number", "week #",
            "reporting_week", "period week", "review week", "meeting week"
        ],
        "bucket": [
            "bucket", "action bucket", "task bucket", "category bucket", "classification bucket", "business bucket"
        ],
    }

    @classmethod
    def normalize_reporting_week(cls, value: Any) -> str:
        """
        Normalizes reporting week strings/numbers into canonical format (e.g. 'Week 42').
        Handles 'Week-42', 'week 42', 'W42', '2026-W42', '42', etc.
        Rejects non-positive weeks (e.g. 0, -1).
        """
        if value is None:
            return ""
        s = str(value).strip()
        if not s or s in ("0", "0.0"):
            return ""
        import re
        m1 = re.search(r"[Ww]eek[-_ ]?(\d+)", s)
        if m1:
            w_num = int(m1.group(1))
            return f"Week {w_num}" if w_num > 0 else ""
        m2 = re.search(r"[Ww](\d+)", s)
        if m2:
            w_num = int(m2.group(1))
            return f"Week {w_num}" if w_num > 0 else ""
        if s.isdigit():
            w_num = int(s)
            return f"Week {w_num}" if w_num > 0 else ""
        return s

    TRACKER_HEADERS = [
        "S.No",
        "Circle",
        "Function/Area",
        "Action Point",
        "Key Requirement / Deliverable",
        "Owner",
        "Raised Date",
        "Target Closure Date",
        "Current Target",
        "Revision Count",
        "Status",
        "Actual Closure Date",
        "Ageing (Days)",
        "Ageing Bucket",
        "Priority",
        "Escalate to Business Head?",
        "Weeks in Review",
        "Last Update",
        "Week",
        "Bucket",
    ]

    @classmethod
    def _parse_date(cls, value: Any) -> Optional[date]:
        """
        Parses date from Excel datetime/date object or string formatted dates.
        """
        if not value:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value

        val_str = str(value).strip()
        if not val_str:
            return None

        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%d-%b-%Y", "%d %b %Y"):
            try:
                return datetime.strptime(val_str, fmt).date()
            except ValueError:
                continue

        return None

    @classmethod
    def generate_template(cls) -> io.BytesIO:
        """
        Generates simplified Excel template containing ONLY the 'Open Points Tracker' sheet.
        Preserves exact columns, order, headers, formatting, alignments, widths, and dropdown data validations.
        Excludes dashboard, summary, history, and reference sheets.
        """
        return cls._build_workbook(actions=[], revisions=[], is_template_only=True)

    @classmethod
    def export_governance_workbook(cls, user: User, filters: Optional[Dict[str, Any]] = None) -> io.BytesIO:
        """
        Exports the live database records within authorized user scope into the canonical multi-sheet
        'Governance & Action Tracking.xlsx' workbook.
        """
        from apps.governance.selectors.governance_selectors import get_governance_actions

        actions_qs = get_governance_actions(filters or {}, user)
        actions = list(actions_qs)

        action_ids = [a.id for a in actions]
        revisions = list(
            GovernanceTargetRevision.objects.filter(action_point_id__in=action_ids)
            .select_related("action_point", "revised_by")
            .order_by("action_point__action_id", "revision_number")
        )

        return cls._build_workbook(actions=actions, revisions=revisions, is_template_only=False)

    @classmethod
    def _build_workbook(
        cls,
        actions: List[GovernanceActionPoint],
        revisions: List[GovernanceTargetRevision],
        is_template_only: bool = False,
    ) -> io.BytesIO:
        wb = openpyxl.Workbook()

        # Styles
        navy_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        teal_fill = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")
        slate_fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
        white_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        dark_bold = Font(name="Calibri", size=11, bold=True, color="1E293B")
        regular_font = Font(name="Calibri", size=10, color="0F172A")
        subtle_font = Font(name="Calibri", size=9, italic=True, color="64748B")
        title_font = Font(name="Calibri", size=14, bold=True, color="1E3A8A")

        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1"),
        )
        center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
        left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)

        # -------------------------------------------------------------
        # SHEET 1: Open Points Tracker
        # -------------------------------------------------------------
        ws_tracker = wb.active
        if not isinstance(ws_tracker, Worksheet):
            ws_tracker = wb.create_sheet(title="Open Points Tracker")
        assert isinstance(ws_tracker, Worksheet)
        ws_tracker.title = "Open Points Tracker"

        ws_tracker.cell(row=1, column=1, value="Governance & Action Tracking").font = title_font
        ws_tracker.cell(
            row=2,
            column=1,
            value="Fill only the white input columns (A-I, N, T). Ageing, Ageing Bucket and Escalation Flag calculate automatically. Weekly review cadence with Business Head.",
        ).font = subtle_font

        # Write Header Row (Row 3)
        for col_idx, header in enumerate(cls.TRACKER_HEADERS, start=1):
            cell = ws_tracker.cell(row=3, column=col_idx, value=header)
            cell.border = thin_border
            cell.alignment = center_align
            # Differentiate input vs calculated columns
            if col_idx in [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 15, 18, 19, 20]:
                cell.font = white_font
                cell.fill = navy_fill
            else:
                cell.font = dark_bold
                cell.fill = slate_fill
        ws_tracker.row_dimensions[3].height = 28

        # Populate rows
        max_row_calc = max(len(actions) + 3, 250)
        if actions:
            for idx, act in enumerate(actions, start=4):
                owner_display = (
                    f"{act.owner.first_name} {act.owner.last_name}".strip() or act.owner.username
                    if act.owner
                    else (act.owner_name_override or "")
                )
                raised_val = act.raised_date.strftime("%Y-%m-%d") if act.raised_date else ""
                target_val = act.target_closure_date.strftime("%Y-%m-%d") if act.target_closure_date else ""
                current_target_val = act.current_target_date.strftime("%Y-%m-%d") if act.current_target_date else target_val
                actual_closure_val = act.actual_closure_date.strftime("%Y-%m-%d") if act.actual_closure_date else ""
                week_val = act.reporting_week or (f"Week {act.raised_date.isocalendar()[1]}" if act.raised_date else "")

                row_data = [
                    act.action_id,
                    act.circle.code if act.circle else "",
                    act.function_area,
                    act.action_point,
                    act.key_deliverable or "",
                    owner_display,
                    raised_val,
                    target_val,
                    current_target_val,
                    act.revision_count,
                    act.status,
                    actual_closure_val,
                    act.ageing_days,
                    act.ageing_bucket,
                    act.priority,
                    "Y" if act.is_escalated else "N",
                    act.weeks_in_review,
                    act.last_update or "",
                    week_val,
                    act.bucket or "",
                ]

                for c_idx, val in enumerate(row_data, start=1):
                    c = ws_tracker.cell(row=idx, column=c_idx, value=val)
                    c.font = regular_font
                    c.border = thin_border
                    if c_idx in [1, 2, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20]:
                        c.alignment = center_align
                    else:
                        c.alignment = left_align
                ws_tracker.row_dimensions[idx].height = 20
        else:
            # Sample guidance row
            first_user = User.objects.filter(is_active=True).first()
            sample_owner = first_user.username if first_user else "mgupta"
            first_circle = Circle.objects.first()
            sample_circle = first_circle.code if first_circle else "RJ"
            sample_row = [
                "ACT-00101",
                sample_circle,
                "Operations",
                "Ensure vendor compliance documentation",
                "All SLA signed agreements received",
                sample_owner,
                timezone.localdate().strftime("%Y-%m-%d"),
                (timezone.localdate() + timezone.timedelta(days=14)).strftime("%Y-%m-%d"),
                (timezone.localdate() + timezone.timedelta(days=14)).strftime("%Y-%m-%d"),
                0,
                "Open",
                "",
                0,
                "0-7 Days",
                "High",
                "N",
                0,
                "Initial review scheduled",
                f"Week {timezone.localdate().isocalendar()[1]}",
                "Audit Finding",
            ]
            for c_idx, val in enumerate(sample_row, start=1):
                c = ws_tracker.cell(row=4, column=c_idx, value=val)
                c.font = subtle_font
                c.border = thin_border
                c.alignment = center_align if c_idx not in [4, 5, 18] else left_align

        # Add Data Validations to Open Points Tracker
        func_dv = DataValidation(
            type="list",
            formula1='"SCM,Operations,Sales,Finance,HR,IT/Systems,Compliance/Legal,Other"',
            allow_blank=True,
        )
        ws_tracker.add_data_validation(func_dv)
        func_dv.add(f"C4:C{max_row_calc}")

        status_dv = DataValidation(type="list", formula1='"Open,WIP,Closed"', allow_blank=True)
        ws_tracker.add_data_validation(status_dv)
        status_dv.add(f"K4:K{max_row_calc}")

        priority_dv = DataValidation(type="list", formula1='"High,Medium,Low"', allow_blank=True)
        ws_tracker.add_data_validation(priority_dv)
        priority_dv.add(f"O4:O{max_row_calc}")

        # Column widths for Tracker
        col_widths = {
            "A": 16, "B": 10, "C": 18, "D": 40, "E": 34, "F": 22,
            "G": 14, "H": 18, "I": 16, "J": 14, "K": 12, "L": 18,
            "M": 14, "N": 15, "O": 12, "P": 25, "Q": 16, "R": 32,
            "S": 16, "T": 18,
        }
        for col_letter, width in col_widths.items():
            ws_tracker.column_dimensions[col_letter].width = width

        if not is_template_only:
            # -------------------------------------------------------------
            # SHEET 2: Owner_wise_Dasboard
            # CRITICAL FIX: References Column F (Owner), NOT Column B (Circle)!
            # -------------------------------------------------------------
            ws_owner = cast(Worksheet, wb.create_sheet(title="Owner_wise_Dasboard"))
            ws_owner.cell(row=1, column=1, value="Domain-wise Open Points Dashboard").font = title_font
            ws_owner.cell(
                row=2,
                column=1,
                value="Auto-calculated from 'Open Points Tracker'. Refresh by opening the file (F9 to force recalculate).",
            ).font = subtle_font

            owner_headers = ["S.No", "Owner", "Total Points", "Open", "WIP", "Closed", "% Closed", "Aged 30+ Days (Open/WIP)", "Escalated to last level"]
            for c_idx, h in enumerate(owner_headers, start=1):
                c = ws_owner.cell(row=3, column=c_idx, value=h)
                c.font = white_font
                c.fill = teal_fill
                c.alignment = center_align
                c.border = thin_border
            ws_owner.row_dimensions[3].height = 26

            # Gather distinct owners from actions or users
            distinct_owners: List[str] = []
            for act in actions:
                name = (
                    f"{act.owner.first_name} {act.owner.last_name}".strip() or act.owner.username
                    if act.owner
                    else (act.owner_name_override or "")
                )
                if name and name not in distinct_owners:
                    distinct_owners.append(name)

            if not distinct_owners:
                active_users = User.objects.filter(is_active=True).order_by("username")[:10]
                distinct_owners = [
                    f"{u.first_name} {u.last_name}".strip() or u.username for u in active_users
                ] or ["Owner 1", "Owner 2"]

            for o_idx, owner_name in enumerate(distinct_owners, start=4):
                ws_owner.cell(row=o_idx, column=1, value=o_idx - 3).alignment = center_align
                ws_owner.cell(row=o_idx, column=2, value=owner_name).alignment = left_align
                # VERIFIED FIX: Uses Column F (Owner) of 'Open Points Tracker'
                ws_owner.cell(row=o_idx, column=3, value=f"=COUNTIF('Open Points Tracker'!$F$4:$F${max_row_calc}, B{o_idx})")
                ws_owner.cell(row=o_idx, column=4, value=f'=COUNTIFS(\'Open Points Tracker\'!$F$4:$F${max_row_calc}, B{o_idx}, \'Open Points Tracker\'!$K$4:$K${max_row_calc}, "Open")')
                ws_owner.cell(row=o_idx, column=5, value=f'=COUNTIFS(\'Open Points Tracker\'!$F$4:$F${max_row_calc}, B{o_idx}, \'Open Points Tracker\'!$K$4:$K${max_row_calc}, "WIP")')
                ws_owner.cell(row=o_idx, column=6, value=f'=COUNTIFS(\'Open Points Tracker\'!$F$4:$F${max_row_calc}, B{o_idx}, \'Open Points Tracker\'!$K$4:$K${max_row_calc}, "Closed")')
                ws_owner.cell(row=o_idx, column=7, value=f"=IFERROR(F{o_idx}/C{o_idx}, 0)")
                ws_owner.cell(row=o_idx, column=8, value=f'=COUNTIFS(\'Open Points Tracker\'!$F$4:$F${max_row_calc}, B{o_idx}, \'Open Points Tracker\'!$N$4:$N${max_row_calc}, "30+ Days", \'Open Points Tracker\'!$K$4:$K${max_row_calc}, "<>Closed")')
                ws_owner.cell(row=o_idx, column=9, value=f'=COUNTIFS(\'Open Points Tracker\'!$F$4:$F${max_row_calc}, B{o_idx}, \'Open Points Tracker\'!$P$4:$P${max_row_calc}, "Y")')

                ws_owner.cell(row=o_idx, column=7).number_format = "0.0%"
                for col_c in range(1, 10):
                    ws_owner.cell(row=o_idx, column=col_c).border = thin_border
                    ws_owner.cell(row=o_idx, column=col_c).font = regular_font
                    if col_c != 2:
                        ws_owner.cell(row=o_idx, column=col_c).alignment = center_align

            ws_owner.column_dimensions["A"].width = 8
            ws_owner.column_dimensions["B"].width = 24
            ws_owner.column_dimensions["C"].width = 14
            ws_owner.column_dimensions["D"].width = 10
            ws_owner.column_dimensions["E"].width = 10
            ws_owner.column_dimensions["F"].width = 10
            ws_owner.column_dimensions["G"].width = 14
            ws_owner.column_dimensions["H"].width = 26
            ws_owner.column_dimensions["I"].width = 24

            # -------------------------------------------------------------
            # SHEET 3: State-wise Dashboard
            # Uses Column B (Circle/State)
            # -------------------------------------------------------------
            ws_state = cast(Worksheet, wb.create_sheet(title="State-wise Dashboard"))
            ws_state.cell(row=1, column=1, value="State-wise Open Points Dashboard").font = title_font
            ws_state.cell(
                row=2,
                column=1,
                value="Auto-calculated from 'Open Points Tracker'. Refresh by opening the file (F9 to force recalculate).",
            ).font = subtle_font

            state_headers = ["S.No", "State / Circle", "Total Points", "Open", "WIP", "Closed", "% Closed", "Aged 30+ Days (Open/WIP)", "Escalated to last level"]
            for c_idx, h in enumerate(state_headers, start=1):
                c = ws_state.cell(row=3, column=c_idx, value=h)
                c.font = white_font
                c.fill = navy_fill
                c.alignment = center_align
                c.border = thin_border
            ws_state.row_dimensions[3].height = 26

            all_circles = Circle.objects.filter(status=Circle.Status.ACTIVE).order_by("name")
            for s_idx, circ in enumerate(all_circles, start=4):
                ws_state.cell(row=s_idx, column=1, value=s_idx - 3).alignment = center_align
                ws_state.cell(row=s_idx, column=2, value=circ.code).alignment = center_align
                ws_state.cell(row=s_idx, column=3, value=f"=COUNTIF('Open Points Tracker'!$B$4:$B${max_row_calc}, B{s_idx})")
                ws_state.cell(row=s_idx, column=4, value=f'=COUNTIFS(\'Open Points Tracker\'!$B$4:$B${max_row_calc}, B{s_idx}, \'Open Points Tracker\'!$K$4:$K${max_row_calc}, "Open")')
                ws_state.cell(row=s_idx, column=5, value=f'=COUNTIFS(\'Open Points Tracker\'!$B$4:$B${max_row_calc}, B{s_idx}, \'Open Points Tracker\'!$K$4:$K${max_row_calc}, "WIP")')
                ws_state.cell(row=s_idx, column=6, value=f'=COUNTIFS(\'Open Points Tracker\'!$B$4:$B${max_row_calc}, B{s_idx}, \'Open Points Tracker\'!$K$4:$K${max_row_calc}, "Closed")')
                ws_state.cell(row=s_idx, column=7, value=f"=IFERROR(F{s_idx}/C{s_idx}, 0)")
                ws_state.cell(row=s_idx, column=8, value=f'=COUNTIFS(\'Open Points Tracker\'!$B$4:$B${max_row_calc}, B{s_idx}, \'Open Points Tracker\'!$N$4:$N${max_row_calc}, "30+ Days", \'Open Points Tracker\'!$K$4:$K${max_row_calc}, "<>Closed")')
                ws_state.cell(row=s_idx, column=9, value=f'=COUNTIFS(\'Open Points Tracker\'!$B$4:$B${max_row_calc}, B{s_idx}, \'Open Points Tracker\'!$P$4:$P${max_row_calc}, "Y")')

                ws_state.cell(row=s_idx, column=7).number_format = "0.0%"
                for col_c in range(1, 10):
                    ws_state.cell(row=s_idx, column=col_c).border = thin_border
                    ws_state.cell(row=s_idx, column=col_c).font = regular_font
                    if col_c != 2:
                        ws_state.cell(row=s_idx, column=col_c).alignment = center_align

            ws_state.column_dimensions["A"].width = 8
            ws_state.column_dimensions["B"].width = 18
            ws_state.column_dimensions["C"].width = 14
            ws_state.column_dimensions["D"].width = 10
            ws_state.column_dimensions["E"].width = 10
            ws_state.column_dimensions["F"].width = 10
            ws_state.column_dimensions["G"].width = 14
            ws_state.column_dimensions["H"].width = 26
            ws_state.column_dimensions["I"].width = 24

            # -------------------------------------------------------------
            # SHEET 4: Ageing Summary
            # -------------------------------------------------------------
            ws_ageing = cast(Worksheet, wb.create_sheet(title="Ageing Summary"))
            ws_ageing.cell(row=1, column=1, value="Ageing Summary (All States)").font = title_font
            ws_ageing.cell(
                row=2,
                column=1,
                value="Bucket-wise count of currently Open/WIP points only. Use this slide for the weekly Business Head review opener.",
            ).font = subtle_font

            ageing_headers = ["Ageing Bucket", "Open/WIP Points", "% of Total Open", "Priority: High Count"]
            for c_idx, h in enumerate(ageing_headers, start=1):
                c = ws_ageing.cell(row=3, column=c_idx, value=h)
                c.font = white_font
                c.fill = teal_fill
                c.alignment = center_align
                c.border = thin_border
            ws_ageing.row_dimensions[3].height = 26

            buckets = ["0-7 Days", "8-15 Days", "16-30 Days", "30+ Days"]
            for b_idx, b_name in enumerate(buckets, start=4):
                ws_ageing.cell(row=b_idx, column=1, value=b_name).alignment = center_align
                ws_ageing.cell(row=b_idx, column=2, value=f'=COUNTIFS(\'Open Points Tracker\'!$N$4:$N${max_row_calc}, A{b_idx}, \'Open Points Tracker\'!$K$4:$K${max_row_calc}, "<>Closed")').alignment = center_align
                ws_ageing.cell(row=b_idx, column=3, value=f"=IFERROR(B{b_idx}/$B$8, 0)").alignment = center_align
                ws_ageing.cell(row=b_idx, column=3).number_format = "0.0%"
                ws_ageing.cell(row=b_idx, column=4, value=f'=COUNTIFS(\'Open Points Tracker\'!$N$4:$N${max_row_calc}, A{b_idx}, \'Open Points Tracker\'!$K$4:$K${max_row_calc}, "<>Closed", \'Open Points Tracker\'!$O$4:$O${max_row_calc}, "High")').alignment = center_align

                for c in range(1, 5):
                    ws_ageing.cell(row=b_idx, column=c).border = thin_border
                    ws_ageing.cell(row=b_idx, column=c).font = regular_font

            # Total row
            ws_ageing.cell(row=8, column=1, value="Total").alignment = center_align
            ws_ageing.cell(row=8, column=1).font = dark_bold
            ws_ageing.cell(row=8, column=2, value="=SUM(B4:B7)").alignment = center_align
            ws_ageing.cell(row=8, column=2).font = dark_bold
            ws_ageing.cell(row=8, column=3, value="100.0%").alignment = center_align
            ws_ageing.cell(row=8, column=3).font = dark_bold
            ws_ageing.cell(row=8, column=4, value="=SUM(D4:D7)").alignment = center_align
            ws_ageing.cell(row=8, column=4).font = dark_bold

            for c in range(1, 5):
                ws_ageing.cell(row=8, column=c).border = thin_border
                ws_ageing.cell(row=8, column=c).fill = slate_fill

            ws_ageing.column_dimensions["A"].width = 18
            ws_ageing.column_dimensions["B"].width = 18
            ws_ageing.column_dimensions["C"].width = 18
            ws_ageing.column_dimensions["D"].width = 22

            # -------------------------------------------------------------
            # SHEET 5: Target Revision History
            # -------------------------------------------------------------
            ws_revisions = cast(Worksheet, wb.create_sheet(title="Target Revision History"))
            ws_revisions.cell(row=1, column=1, value="Target Revision History").font = title_font

            rev_headers = ["Action ID", "Revision No.", "Previous Target", "Revised Target", "Revision Date", "Revised By", "Reason for Revision", "Approved By"]
            for c_idx, h in enumerate(rev_headers, start=1):
                c = ws_revisions.cell(row=2, column=c_idx, value=h)
                c.font = white_font
                c.fill = navy_fill
                c.alignment = center_align
                c.border = thin_border
            ws_revisions.row_dimensions[2].height = 26

            if revisions:
                for r_idx, rev in enumerate(revisions, start=3):
                    revised_by_name = rev.revised_by.username if rev.revised_by else ""
                    ws_revisions.cell(row=r_idx, column=1, value=rev.action_point.action_id).alignment = center_align
                    ws_revisions.cell(row=r_idx, column=2, value=rev.revision_number).alignment = center_align
                    ws_revisions.cell(row=r_idx, column=3, value=rev.previous_target.strftime("%Y-%m-%d")).alignment = center_align
                    ws_revisions.cell(row=r_idx, column=4, value=rev.revised_target.strftime("%Y-%m-%d")).alignment = center_align
                    ws_revisions.cell(row=r_idx, column=5, value=rev.revision_date.strftime("%Y-%m-%d")).alignment = center_align
                    ws_revisions.cell(row=r_idx, column=6, value=revised_by_name).alignment = center_align
                    ws_revisions.cell(row=r_idx, column=7, value=rev.reason or "").alignment = left_align
                    ws_revisions.cell(row=r_idx, column=8, value=rev.approved_by or "").alignment = center_align

                    for col_c in range(1, 9):
                        ws_revisions.cell(row=r_idx, column=col_c).border = thin_border
                        ws_revisions.cell(row=r_idx, column=col_c).font = regular_font
            else:
                sample_rev = ["ACT-00101", 1, "2026-09-03", "2026-09-10", "2026-09-02", "mgupta", "Distributor confirmation delayed", "Business Head"]
                for col_c, val in enumerate(sample_rev, start=1):
                    c = ws_revisions.cell(row=3, column=col_c, value=val)
                    c.font = subtle_font
                    c.border = thin_border
                    c.alignment = center_align if col_c != 7 else left_align

            ws_revisions.column_dimensions["A"].width = 16
            ws_revisions.column_dimensions["B"].width = 14
            ws_revisions.column_dimensions["C"].width = 16
            ws_revisions.column_dimensions["D"].width = 16
            ws_revisions.column_dimensions["E"].width = 16
            ws_revisions.column_dimensions["F"].width = 20
            ws_revisions.column_dimensions["G"].width = 34
            ws_revisions.column_dimensions["H"].width = 20

            # -------------------------------------------------------------
            # SHEET 6: How to Use
            # -------------------------------------------------------------
            ws_help = cast(Worksheet, wb.create_sheet(title="How to Use"))
            ws_help.cell(row=1, column=1, value="How to Use This Tracker").font = title_font

            guidelines = [
                ("Purpose", "Single tracker to capture open action points across operational circles, auto-compute ageing, and drive weekly governance cadence."),
                ("Sheet 1 - Open Points Tracker", "Log every open point here. Fill columns A-I, K, L, O, R. Ageing, Ageing Bucket, Escalation Flag, Weeks in Review calculate automatically."),
                ("Sheet 2 - Owner-wise Dashboard", "Auto-rolls up counts per Owner: Open / WIP / Closed / % Closed / items aged 30+ days. Uses actual Owner mapping."),
                ("Sheet 3 - State-wise Dashboard", "Auto-rolls up counts per Circle: Open / WIP / Closed / % Closed / items aged 30+ days."),
                ("Sheet 4 - Ageing Summary", "Provides bucket-wise breakdown (0-7, 8-15, 16-30, 30+ Days) with High Priority counts for review openers."),
                ("Sheet 5 - Target Revision History", "Logs all official target date revision requests, reason, revised target, and approval authority."),
                ("Closure Policy", "Tasks requiring evidence cannot be marked Closed until mandatory proof (Image/PDF) is accepted by an authorized reviewer."),
            ]

            for g_idx, (sec, desc) in enumerate(guidelines, start=3):
                ws_help.cell(row=g_idx, column=1, value=sec).font = dark_bold
                ws_help.cell(row=g_idx, column=1).alignment = left_align
                ws_help.cell(row=g_idx, column=1).border = thin_border
                ws_help.cell(row=g_idx, column=2, value=desc).font = regular_font
                ws_help.cell(row=g_idx, column=2).alignment = left_align
                ws_help.cell(row=g_idx, column=2).border = thin_border

            ws_help.column_dimensions["A"].width = 30
            ws_help.column_dimensions["B"].width = 90

            # -------------------------------------------------------------
            # SHEET 7: Reference Data
            # -------------------------------------------------------------
            ws_ref = cast(Worksheet, wb.create_sheet(title="Reference Data"))
            ws_ref.cell(row=1, column=1, value="Circle Code").font = dark_bold
            ws_ref.cell(row=1, column=2, value="Circle Name").font = dark_bold
            ws_ref.cell(row=1, column=3, value="Region").font = dark_bold
            ws_ref.cell(row=1, column=5, value="Username").font = dark_bold
            ws_ref.cell(row=1, column=6, value="Full Name").font = dark_bold
            ws_ref.cell(row=1, column=7, value="Email").font = dark_bold

            for c_idx, c in enumerate(all_circles, start=2):
                ws_ref.cell(row=c_idx, column=1, value=c.code)
                ws_ref.cell(row=c_idx, column=2, value=c.name)
                ws_ref.cell(row=c_idx, column=3, value=c.region or "North")

            all_users = User.objects.filter(is_active=True).order_by("username")
            for u_idx, u in enumerate(all_users, start=2):
                ws_ref.cell(row=u_idx, column=5, value=u.username)
                ws_ref.cell(row=u_idx, column=6, value=f"{u.first_name} {u.last_name}".strip())
                ws_ref.cell(row=u_idx, column=7, value=u.email)

        sheet_views = cast(Any, ws_tracker.views.sheetView)
        if sheet_views:
            sheet_views[0].tabSelected = True

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    @classmethod
    def import_excel(cls, file_obj, user: User, default_reporting_week: Optional[str] = None) -> Dict[str, Any]:
        """
        Validates and imports action tracking records from uploaded Excel file.
        Matches columns using validated header aliases rather than positional guessing.
        Strictly enforces mandatory evidence closure validation for tasks being closed.
        Supports parsing Target Revision History when included in the workbook.
        """
        try:
            wb = openpyxl.load_workbook(file_obj, data_only=True)
        except Exception as e:
            return {
                "success": False,
                "total_rows": 0,
                "created_count": 0,
                "updated_count": 0,
                "errors": [{"row": 0, "field": "File", "message": f"Unable to read Excel workbook: {str(e)}"}],
            }

        # 1. Target Sheet Selection
        target_sheet = None
        for name in ["Open Points Tracker", "Action Tracker"]:
            if name in wb.sheetnames:
                target_sheet = wb[name]
                break
        if not target_sheet:
            target_sheet = wb.active

        if not target_sheet or not isinstance(target_sheet, Worksheet):
            return {
                "success": False,
                "total_rows": 0,
                "created_count": 0,
                "updated_count": 0,
                "errors": [{"row": 0, "field": "File", "message": "No active worksheet found in Excel workbook."}],
            }

        # 2. Caches for fast, precise lookups
        all_circles = {c.code.upper(): c for c in Circle.objects.all()}
        all_circles_by_name = {c.name.upper(): c for c in Circle.objects.all()}

        all_users_by_username = {u.username.lower(): u for u in User.objects.all()}
        all_users_by_email = {u.email.lower(): u for u in User.objects.all() if u.email}
        all_users_by_fullname = {
            f"{u.first_name} {u.last_name}".strip().lower(): u for u in User.objects.all() if u.first_name or u.last_name
        }

        # 3. Detect Header Row and Map Columns Using Field Aliases
        header_row_idx = 1
        headers_found = False
        col_field_map: Dict[str, int] = {}  # field_name -> 0-indexed column

        for row in target_sheet.iter_rows(min_row=1, max_row=6, values_only=False):
            normalized_row = [str(c.value).strip().lower() if c.value is not None else "" for c in row]
            if any("circle" in v or "action point" in v or "s.no" in v for v in normalized_row):
                header_row_idx = row[0].row
                headers_found = True

                # Phase 1: Exact matches
                for col_idx, cell in enumerate(row):
                    if cell.value is None:
                        continue
                    header_str = str(cell.value).strip().lower()
                    for field_name, aliases in cls.FIELD_ALIASES.items():
                        if field_name not in col_field_map:
                            if field_name == "bucket" and "ageing" in header_str:
                                continue
                            if header_str in aliases:
                                col_field_map[field_name] = col_idx
                                break

                # Phase 2: Longest alias partial matches for remaining fields
                for col_idx, cell in enumerate(row):
                    if cell.value is None:
                        continue
                    if col_idx in col_field_map.values():
                        continue
                    header_str = str(cell.value).strip().lower()
                    best_field = None
                    best_len = 0
                    for field_name, aliases in cls.FIELD_ALIASES.items():
                        if field_name not in col_field_map:
                            # Weeks in Review is a duration metric, never the reporting week identifier
                            if field_name == "reporting_week" and ("weeks in review" in header_str or "in review" in header_str):
                                continue
                            # Ageing Bucket is a duration metric, never the classification Bucket
                            if field_name == "bucket" and "ageing" in header_str:
                                continue
                            for alias in aliases:
                                if alias in header_str and len(alias) > best_len:
                                     best_field = field_name
                                     best_len = len(alias)
                    if best_field:
                        col_field_map[best_field] = col_idx
                break

        if not headers_found or header_row_idx is None or "circle" not in col_field_map or "action_point" not in col_field_map:
            return {
                "success": False,
                "total_rows": 0,
                "created_count": 0,
                "updated_count": 0,
                "errors": [
                    {
                        "row": header_row_idx,
                        "field": "Headers",
                        "message": "Unable to identify valid column headers. Workbook must contain 'Circle' and 'Action Point' columns.",
                    }
                ],
            }

        def get_row_val(row_cells, field_name: str) -> Any:
            col_idx = col_field_map.get(field_name)
            if col_idx is not None and col_idx < len(row_cells):
                return row_cells[col_idx].value
            return None

        row_errors: List[Dict[str, Any]] = []
        parsed_records: List[Dict[str, Any]] = []

        total_rows = 0
        min_row = header_row_idx + 1

        is_admin_or_manager = (
            user.is_superuser
            or getattr(user, "is_superadmin", False)
            or user.role in [User.Role.SUPER_ADMIN, User.Role.MANAGEMENT]
        )

        for row_cells in target_sheet.iter_rows(min_row=min_row, values_only=False):
            # Skip empty rows
            raw_values = [c.value for c in row_cells if c.value is not None and str(c.value).strip()]
            if not raw_values:
                continue

            row_num = row_cells[0].row

            # Skip sample guidance rows
            action_desc_raw = get_row_val(row_cells, "action_point")
            if action_desc_raw and "[auto-calculated]" in str(action_desc_raw).lower():
                continue

            total_rows += 1

            # 1. Circle validation
            circle_raw = get_row_val(row_cells, "circle")
            matched_circle = None
            if not circle_raw or not str(circle_raw).strip():
                row_errors.append({"row": row_num, "field": "Circle", "message": "Circle is required."})
            else:
                c_str = str(circle_raw).strip().upper()
                matched_circle = all_circles.get(c_str) or all_circles_by_name.get(c_str)
                if not matched_circle:
                    row_errors.append({
                        "row": row_num,
                        "field": "Circle",
                        "message": f"Circle '{circle_raw}' does not match any registered Circle in MAPAR.",
                    })

            # 2. Function / Area
            function_area_raw = get_row_val(row_cells, "function_area")
            function_area = str(function_area_raw).strip() if function_area_raw else "Operations"
            valid_funcs = [choice[0] for choice in GovernanceActionPoint.FUNCTION_AREA_CHOICES]
            if function_area not in valid_funcs:
                found_func = next((vf for vf in valid_funcs if vf.lower() == function_area.lower()), None)
                function_area = found_func if found_func else "Other"

            # 3. Action Point (Description)
            if not action_desc_raw or not str(action_desc_raw).strip():
                row_errors.append({"row": row_num, "field": "Action Point", "message": "Action Point description is required."})
                action_point_text = ""
            else:
                action_point_text = str(action_desc_raw).strip()

            # 4. Key Requirement / Deliverable
            deliverable_raw = get_row_val(row_cells, "key_deliverable")
            deliverable = str(deliverable_raw).strip() if deliverable_raw else ""

            # 5. Owner mapping (Uses Owner column: username or email of existing MAPAR user)
            owner_raw = get_row_val(row_cells, "owner")
            matched_owner = None
            owner_name_override = ""
            if not owner_raw or not str(owner_raw).strip():
                row_errors.append({
                    "row": row_num,
                    "field": "Owner",
                    "message": "Owner is required. Please provide a valid username or email address of an existing MAPAR user.",
                })
            else:
                owner_str = str(owner_raw).strip()
                try:
                    matched_owner = GovernanceService.resolve_user_identity(owner_str)
                except Exception:
                    matched_owner = None

                if not matched_owner:
                    row_errors.append({
                        "row": row_num,
                        "field": "Owner",
                        "message": f"Owner '{owner_str}' does not match any existing MAPAR user. Please provide a valid username or email address.",
                    })

            # 6. Raised Date
            raised_raw = get_row_val(row_cells, "raised_date")
            raised_date = cls._parse_date(raised_raw) or timezone.localdate()

            # 7. Target Closure Date
            target_raw = get_row_val(row_cells, "target_closure_date")
            target_date = cls._parse_date(target_raw)
            if not target_date:
                row_errors.append({
                    "row": row_num,
                    "field": "Target Closure Date",
                    "message": f"Target Closure Date is required and must be a valid date (received: '{target_raw}').",
                })

            # 8. Status
            status_raw = get_row_val(row_cells, "status")
            status = "Open"
            if status_raw:
                s_str = str(status_raw).strip().lower()
                if "close" in s_str:
                    status = "Closed"
                elif "wip" in s_str or "progress" in s_str:
                    status = "WIP"
                else:
                    status = "Open"

            # 9. Priority
            priority_raw = get_row_val(row_cells, "priority")
            priority = "Medium"
            if priority_raw:
                p_str = str(priority_raw).strip().lower()
                if "high" in p_str:
                    priority = "High"
                elif "low" in p_str:
                    priority = "Low"
                else:
                    priority = "Medium"

            # 10. Actual Closure Date
            actual_raw = get_row_val(row_cells, "actual_closure_date")
            actual_closure_date = cls._parse_date(actual_raw)
            if status == "Closed" and not actual_closure_date:
                actual_closure_date = timezone.localdate()

            # 11. Last Update
            last_update_raw = get_row_val(row_cells, "last_update")
            last_update = str(last_update_raw).strip() if last_update_raw else ""

            # 12. Reporting Week (Normalized from Week column or derived from Raised Date)
            reporting_week_raw = get_row_val(row_cells, "reporting_week")
            reporting_week = cls.normalize_reporting_week(reporting_week_raw)
            if not reporting_week and default_reporting_week:
                reporting_week = cls.normalize_reporting_week(default_reporting_week)
            if not reporting_week and raised_date:
                reporting_week = f"Week {raised_date.isocalendar()[1]}"

            # 13. Action ID (if updating existing)
            action_id_raw = get_row_val(row_cells, "action_id")
            action_id = str(action_id_raw).strip() if action_id_raw is not None else ""
            if action_id.isdigit() and not GovernanceActionPoint.objects.filter(action_id=action_id).exists():
                action_id = ""

            # 14. Bucket (Classification)
            bucket_raw = get_row_val(row_cells, "bucket")
            bucket = str(bucket_raw).strip() if bucket_raw is not None else ""

            # 15. MANDATORY EVIDENCE CHECK ON CLOSURE
            if status == "Closed" and action_id:
                existing_act = GovernanceActionPoint.objects.filter(action_id=action_id).first()
                if existing_act:
                    if existing_act.evidence_required and existing_act.evidence_status != GovernanceActionPoint.EvidenceStatus.ACCEPTED:
                        if not is_admin_or_manager:
                            row_errors.append({
                                "row": row_num,
                                "field": "Status",
                                "message": f"Cannot close task '{action_id}': Mandatory evidence is required and has not been accepted.",
                            })

            current_row_errors = [e for e in row_errors if e["row"] == row_num]
            if not current_row_errors and matched_circle and target_date and action_point_text and matched_owner:
                parsed_records.append({
                    "action_id": action_id,
                    "circle": matched_circle,
                    "function_area": function_area,
                    "action_point": action_point_text,
                    "key_deliverable": deliverable,
                    "owner": matched_owner,
                    "owner_name_override": "",
                    "raised_date": raised_date,
                    "target_closure_date": target_date,
                    "status": status,
                    "priority": priority,
                    "actual_closure_date": actual_closure_date,
                    "last_update": last_update,
                    "reporting_week": reporting_week,
                    "bucket": bucket,
                })

        if row_errors:
            return {
                "success": False,
                "total_rows": total_rows,
                "created_count": 0,
                "updated_count": 0,
                "errors": row_errors,
            }

        created_count = 0
        updated_count = 0

        with transaction.atomic():
            for rec in parsed_records:
                action_id = rec.get("action_id")
                existing = None
                if action_id:
                    existing = GovernanceActionPoint.objects.filter(action_id=action_id).first()

                if existing:
                    existing.circle = rec["circle"]
                    existing.function_area = rec["function_area"]
                    existing.action_point = rec["action_point"]
                    existing.key_deliverable = rec["key_deliverable"]
                    if rec["owner"]:
                        existing.owner = rec["owner"]
                        existing.owner_name_override = ""
                    existing.status = rec["status"]
                    existing.priority = rec["priority"]
                    existing.actual_closure_date = rec["actual_closure_date"]
                    existing.last_update = rec["last_update"]
                    if rec["reporting_week"]:
                        existing.reporting_week = rec["reporting_week"]
                    if rec.get("bucket"):
                        existing.bucket = rec["bucket"]
                    existing.save()
                    action_item = existing
                    updated_count += 1
                else:
                    new_action_id = (
                        action_id
                        if action_id and not GovernanceActionPoint.objects.filter(action_id=action_id).exists()
                        else GovernanceService.generate_next_action_id()
                    )
                    action_item = GovernanceActionPoint(
                        action_id=new_action_id,
                        circle=rec["circle"],
                        function_area=rec["function_area"],
                        action_point=rec["action_point"],
                        key_deliverable=rec["key_deliverable"],
                        owner=rec["owner"],
                        owner_name_override="",
                        assigned_by=user,
                        raised_date=rec["raised_date"],
                        target_closure_date=rec["target_closure_date"],
                        current_target_date=rec["target_closure_date"],
                        revision_count=0,
                        status=rec["status"],
                        priority=rec["priority"],
                        actual_closure_date=rec["actual_closure_date"],
                        last_update=rec["last_update"],
                        reporting_week=rec["reporting_week"],
                        bucket=rec.get("bucket", ""),
                        created_by=user,
                    )
                    action_item.save()
                    created_count += 1

                # Sync initial weekly progress record if reporting_week is supplied
                if rec["reporting_week"]:
                    from apps.governance.models import GovernanceWeeklyUpdate
                    w_upd = GovernanceWeeklyUpdate.objects.filter(
                        action_point=action_item,
                        reporting_week=rec["reporting_week"],
                    ).first()
                    if not w_upd:
                        GovernanceWeeklyUpdate.objects.create(
                            action_point=action_item,
                            reporting_week=rec["reporting_week"],
                            work_completed=rec["last_update"] or "Excel import",
                            progress_percent=100 if rec["status"] == "Closed" else (action_item.current_progress_percent or 0),
                            status=rec["status"],
                            actual_closure_date=rec["actual_closure_date"],
                            submitted_by=user,
                        )
                    elif rec["last_update"]:
                        w_upd.work_completed = rec["last_update"]
                        w_upd.status = rec["status"]
                        w_upd.save()

            # Parse Target Revision History sheet if present in workbook
            if "Target Revision History" in wb.sheetnames:
                rev_ws = cast(Worksheet, wb["Target Revision History"])
                for r_idx in range(3, rev_ws.max_row + 1):
                    act_id_val = rev_ws.cell(row=r_idx, column=1).value
                    rev_no_val = rev_ws.cell(row=r_idx, column=2).value
                    prev_target_raw = rev_ws.cell(row=r_idx, column=3).value
                    new_target_raw = rev_ws.cell(row=r_idx, column=4).value
                    rev_date_raw = rev_ws.cell(row=r_idx, column=5).value
                    reason_val = str(rev_ws.cell(row=r_idx, column=7).value or "").strip()
                    appr_val = str(rev_ws.cell(row=r_idx, column=8).value or "").strip()

                    if not act_id_val or not new_target_raw:
                        continue

                    act_obj = GovernanceActionPoint.objects.filter(action_id=str(act_id_val).strip()).first()
                    if act_obj:
                        parsed_new = cls._parse_date(new_target_raw)
                        parsed_prev = cls._parse_date(prev_target_raw) or act_obj.target_closure_date
                        parsed_rev_date = cls._parse_date(rev_date_raw) or timezone.localdate()
                        try:
                            rev_num = int(str(rev_no_val).strip()) if rev_no_val is not None else (act_obj.revision_count + 1)
                        except (TypeError, ValueError):
                            rev_num = act_obj.revision_count + 1

                        if parsed_new and not GovernanceTargetRevision.objects.filter(action_point=act_obj, revision_number=rev_num).exists():
                            GovernanceTargetRevision.objects.create(
                                action_point=act_obj,
                                revision_number=rev_num,
                                previous_target=parsed_prev,
                                revised_target=parsed_new,
                                revision_date=parsed_rev_date,
                                revised_by=user,
                                reason=reason_val,
                                approved_by=appr_val,
                            )
                            act_obj.current_target_date = parsed_new
                            act_obj.revision_count = max(act_obj.revision_count, rev_num)
                            act_obj.save()

        return {
            "success": True,
            "total_rows": total_rows,
            "created_count": created_count,
            "updated_count": updated_count,
            "errors": [],
        }
