"""
Authoritative KPI Calculation Engine for MAPAR-v2.
Integrates uploaded datasets, hierarchy nodes, reporting periods, and safe formulas.
Persists results with transparent audit lineage.
"""

import time
import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Dict, Any, List, Optional, Set
from django.db.models import Q
from django.core.exceptions import ValidationError

from common.database.transactions import atomic_operation
from apps.organization.models import (
    MainCompany,
    SubCompany,
    Project,
    Circle,
    Domain,
    Department,
    SubDepartment,
)
from apps.dashboard.models import KPI, KPIValue, ReportingPeriod
from apps.imports.models import (
    ImportBatch,
    ImportStagedRow,
    UploadTemplate,
    UploadTemplateColumn,
)
from apps.kpi.models import (
    KPIDefinition,
    KPIParameter,
    KPIFilter,
    KPIDependency,
    KPICalculationResult,
    KPICalculationAuditLog,
)
from apps.kpi.services.formula_evaluator import (
    SafeFormulaEvaluator,
    DivisionByZeroError,
    SafeFormulaError,
)
from apps.kpi.services.kpi_logic_parser import KPILogicParser, KPILogicParseError


class KPIEngineService:
    @classmethod
    def resolve_hierarchy_descendant_circle_ids(cls, level: str, node_id: int) -> Set[int]:
        """
        Resolves all Circle IDs that descend from the specified hierarchy node.
        Handles all 7 tiers: MainCompany -> SubCompany -> Project -> Circle -> Domain -> Department -> SubDepartment.
        """
        lvl = level.upper()
        if lvl == "MAIN_COMPANY":
            return set(
                Circle.objects.filter(
                    Q(project__sub_company__main_company_id=node_id) |
                    Q(project__sub_company_id__in=SubCompany.objects.filter(main_company_id=node_id).values_list("id", flat=True)),
                    is_active=True
                ).values_list("id", flat=True)
            )
        elif lvl == "SUB_COMPANY":
            return set(
                Circle.objects.filter(
                    project__sub_company_id=node_id,
                    is_active=True
                ).values_list("id", flat=True)
            )
        elif lvl == "PROJECT":
            return set(
                Circle.objects.filter(
                    project_id=node_id,
                    is_active=True
                ).values_list("id", flat=True)
            )
        elif lvl == "CIRCLE":
            return {node_id}
        elif lvl in ["DOMAIN", "DEPARTMENT", "SUB_DEPARTMENT"]:
            # Ascend to Circle
            if lvl == "DOMAIN":
                dom = Domain.objects.filter(id=node_id).first()
                if dom and dom.circle_id:
                    return {dom.circle_id}
                # Shared domain applies to all active circles
                return set(Circle.objects.filter(is_active=True).values_list("id", flat=True))
            elif lvl == "DEPARTMENT":
                dept = Department.objects.filter(id=node_id).select_related("domain").first()
                if dept and dept.domain and dept.domain.circle_id:
                    return {dept.domain.circle_id}
                return set(Circle.objects.filter(is_active=True).values_list("id", flat=True))
            elif lvl == "SUB_DEPARTMENT":
                sub_dept = SubDepartment.objects.filter(id=node_id).select_related("department__domain").first()
                if sub_dept and sub_dept.department and sub_dept.department.domain and sub_dept.department.domain.circle_id:
                    return {sub_dept.department.domain.circle_id}
                return set(Circle.objects.filter(is_active=True).values_list("id", flat=True))
            return set()
        return set()

    @classmethod
    def get_node_display_name(cls, level: str, node_id: int) -> str:
        lvl = level.upper()
        try:
            if lvl == "MAIN_COMPANY":
                obj = MainCompany.objects.filter(id=node_id).first()
                return obj.name if obj else f"Company #{node_id}"
            elif lvl == "SUB_COMPANY":
                obj = SubCompany.objects.filter(id=node_id).first()
                return obj.name if obj else f"SubCompany #{node_id}"
            elif lvl == "PROJECT":
                obj = Project.objects.filter(id=node_id).first()
                return obj.name if obj else f"Project #{node_id}"
            elif lvl == "CIRCLE":
                obj = Circle.objects.filter(id=node_id).first()
                return obj.name if obj else f"Circle #{node_id}"
            elif lvl == "DOMAIN":
                obj = Domain.objects.filter(id=node_id).first()
                return obj.name if obj else f"Domain #{node_id}"
            elif lvl == "DEPARTMENT":
                obj = Department.objects.filter(id=node_id).first()
                return obj.name if obj else f"Dept #{node_id}"
            elif lvl == "SUB_DEPARTMENT":
                obj = SubDepartment.objects.filter(id=node_id).first()
                return obj.name if obj else f"SubDept #{node_id}"
        except Exception:
            pass
        return f"{lvl}:{node_id}"

    @classmethod
    def _normalize_circle_token(cls, val: Any) -> str:
        if not val:
            return ""
        s = str(val).strip().upper().replace("_", "").replace("-", "").replace(" ", "").replace("CIRCLE", "")
        # Common phonetic/regional spelling variations (e.g. ODISHA -> ODISA)
        s = s.replace("SH", "S")
        return s

    @classmethod
    def _build_circle_lookup(cls) -> Dict[str, int]:
        lookup: Dict[str, int] = {}
        for c in Circle.objects.all():
            cid = c.id
            lookup[str(cid)] = cid
            lookup[c.code.upper()] = cid
            lookup[c.name.upper()] = cid
            lookup[cls._normalize_circle_token(c.code)] = cid
            lookup[cls._normalize_circle_token(c.name)] = cid
        return lookup

    @classmethod
    def _eval_single_filter(cls, raw_data: Dict[str, Any], field_name: str, operator: str, value: str) -> bool:
        f_val = raw_data.get(field_name)
        if f_val is None:
            flt_name_lower = field_name.strip().lower()
            for k, v in raw_data.items():
                if k.strip().lower() == flt_name_lower:
                    f_val = v
                    break

        op = operator.upper()
        if op == "IS_EMPTY":
            return f_val is None or str(f_val).strip() == ""
        elif op == "IS_NOT_EMPTY":
            return f_val is not None and str(f_val).strip() != ""

        if f_val is None:
            return False

        str_val = str(f_val).strip()
        expected = value.strip() if value else ""

        if op == "EQUALS":
            return str_val.lower() == expected.lower()
        elif op == "NOT_EQUALS":
            return str_val.lower() != expected.lower()
        elif op == "CONTAINS":
            return expected.lower() in str_val.lower()
        elif op == "STARTS_WITH":
            return str_val.lower().startswith(expected.lower())
        elif op == "ENDS_WITH":
            return str_val.lower().endswith(expected.lower())
        elif op == "IN":
            tokens = [t.strip().lower() for t in expected.split(",") if t.strip()]
            return str_val.lower() in tokens
        elif op in ["GREATER_THAN", "LESS_THAN", "GREATER_EQUAL", "LESS_EQUAL"]:
            try:
                num_val = float(str_val.replace("%", "").replace(",", ""))
                exp_val = float(expected.replace("%", "").replace(",", ""))
                if op == "GREATER_THAN":
                    return num_val > exp_val
                if op == "LESS_THAN":
                    return num_val < exp_val
                if op == "GREATER_EQUAL":
                    return num_val >= exp_val
                if op == "LESS_EQUAL":
                    return num_val <= exp_val
            except (ValueError, TypeError):
                return False
        return True

    @classmethod
    def _apply_row_filters(cls, raw_data: Dict[str, Any], filters: List[Any]) -> bool:
        """Checks if a staged row passes all KPIFilter criteria supporting AND and OR conjunctions."""
        if not filters:
            return True

        overall_matched: Optional[bool] = None
        for flt in filters:
            raw_field = getattr(flt, "field_name", None) or (flt.get("field_name") if isinstance(flt, dict) else "") or ""
            f_name = str(raw_field)
            f_op = getattr(flt, "operator", None) or (flt.get("operator") if isinstance(flt, dict) else "EQUALS")
            f_val = getattr(flt, "value", None) or (flt.get("value", "") if isinstance(flt, dict) else "")
            f_conj = getattr(flt, "conjunction", None) or (flt.get("conjunction", "AND") if isinstance(flt, dict) else "AND") or "AND"

            matched = cls._eval_single_filter(raw_data, f_name, str(f_op), str(f_val))

            if overall_matched is None:
                overall_matched = matched
            else:
                if str(f_conj).upper() == "OR":
                    overall_matched = overall_matched or matched
                else:
                    overall_matched = overall_matched and matched

        return overall_matched if overall_matched is not None else True

    @staticmethod
    def _sanitize_header(header: Any) -> str:
        """Strips whitespace, lowercases, and removes trailing requirement indicators."""
        if not header:
            return ""
        h_str = str(header).strip()
        if h_str.endswith("*"):
            h_str = h_str[:-1].strip()
        return h_str.lower().replace("_", " ").replace("-", " ")

    @classmethod
    def _compute_aggregation(cls, values: List[Any], agg_method: str) -> Optional[Decimal]:
        if not values:
            return None

        # Clean decimal conversion
        cleaned = []
        for v in values:
            if v is None:
                continue
            if isinstance(v, (int, float, Decimal)):
                cleaned.append(Decimal(str(v)))
            else:
                try:
                    s = str(v).replace("%", "").strip()
                    if s:
                        cleaned.append(Decimal(s))
                except (InvalidOperation, ValueError):
                    pass

        agg = agg_method.upper()
        if agg == "COUNT":
            return Decimal(str(len(values)))
        if agg == "COUNT_DISTINCT":
            return Decimal(str(len(set(str(v).strip().lower() for v in values if v is not None))))

        if not cleaned:
            return None

        if agg == "SUM":
            return sum(cleaned, Decimal("0"))
        elif agg == "AVG":
            return sum(cleaned, Decimal("0")) / Decimal(str(len(cleaned)))
        elif agg == "MIN":
            return min(cleaned)
        elif agg == "MAX":
            return max(cleaned)
        elif agg == "LATEST":
            return cleaned[-1]
        return sum(cleaned, Decimal("0"))

    @classmethod
    def _evaluate_comparison_data_source(
        cls,
        comp: Dict[str, Any],
        period: Optional[ReportingPeriod],
        allowed_circles: Set[int],
        node_name: str,
        kpi_target_val: Optional[Decimal] = None,
        decimal_precision: int = 2,
        kpi: Optional[KPIDefinition] = None,
    ) -> Dict[str, Any]:
        """
        Calculates actual achievement for a comparison item from its configured column
        in the authoritative uploaded dataset, evaluating against the manual standard value.
        Supports dynamic mathematical formulas and KPICalculatedOutput generation.
        """

        data_source = comp.get("data_source") or {}
        has_column = bool(comp.get("achieved_data_column") or data_source.get("metric_field"))
        if comp.get("is_manual") or (not has_column and comp.get("actual_value") not in (None, "")):
            ds_type = "MANUAL"
        else:
            ds_type = "UPLOAD" if has_column or data_source.get("dataset_id") else data_source.get("source_type", "MANUAL")
        dataset_id = data_source.get("dataset_id")

        c_target = None
        raw_tgt = comp.get("standard_value") if comp.get("standard_value") not in (None, "") else comp.get("target_value")
        if raw_tgt not in (None, ""):
            try:
                c_target = float(Decimal(str(raw_tgt)))
            except Exception:
                pass
        elif kpi_target_val is not None:
            c_target = float(kpi_target_val)

        c_actual: Optional[float] = None
        c_status = "UNKNOWN"
        c_error = ""
        c_is_manual = True
        c_dataset_name = "Manual Entry"
        c_period_name = period.name if period else "All"
        c_records_considered = 0

        # Resolve Uploaded Dataset
        if ds_type == "UPLOAD":
            template = None
            if dataset_id:
                template = UploadTemplate.objects.filter(id=dataset_id).first()
            if not template:
                template = UploadTemplate.objects.filter(status="ACTIVE").first() or UploadTemplate.objects.first()

            if not template:
                c_status = "NO_DATA"
                c_error = "No uploaded dataset available in the system."
            else:
                c_is_manual = False
                c_dataset_name = template.name
                b_qs = ImportBatch.objects.filter(template_version__template=template)
                period_behavior = data_source.get("period_behavior", "MATCH_PERIOD")
                if period_behavior != "ALL_RECORDS" and period:
                    b_qs = b_qs.filter(Q(reporting_period=period) | Q(reporting_period__isnull=True))

                completed_batches = list(b_qs.filter(status=ImportBatch.Status.COMPLETED).order_by("-created_at"))
                batches = completed_batches if completed_batches else list(b_qs.filter(status=ImportBatch.Status.VALIDATED).order_by("-created_at"))

                if not batches:
                    c_status = "NO_DATA"
                    c_error = f"Awaiting uploaded data. No uploaded batches found for dataset '{template.name}' in reporting period '{c_period_name}'."
                else:
                    seen_scope: Set[Optional[int]] = set()
                    active_batches: List[ImportBatch] = []
                    for b in batches:
                        b_circle_id: Optional[int] = getattr(b, "circle_id", None) or (b.circle.id if getattr(b, "circle", None) else None)
                        if b_circle_id is not None:
                            if b_circle_id not in seen_scope:
                                seen_scope.add(b_circle_id)
                                active_batches.append(b)
                        else:
                            active_batches.append(b)

                    staged_qs = ImportStagedRow.objects.filter(batch__in=active_batches, is_valid=True)
                    circle_lookup = cls._build_circle_lookup()
                    matched_rows: List[ImportStagedRow] = []

                    org_col = (data_source.get("org_field") or "").strip().lower()
                    date_col = (data_source.get("date_field") or "").strip()

                    for row in staged_qs.iterator():
                        raw = row.raw_data or {}
                        circle_match = True

                        if allowed_circles:
                            row_circle_id: Optional[int] = None
                            if row.batch:
                                b_cid = getattr(row.batch, "circle_id", None) or (row.batch.circle.id if getattr(row.batch, "circle", None) else None)
                                if b_cid is not None:
                                    row_circle_id = int(b_cid)

                            if row_circle_id is None and org_col:
                                for k, v in raw.items():
                                    if k.strip().lower() == org_col and v:
                                        raw_v = str(v).strip().upper()
                                        norm_v = cls._normalize_circle_token(raw_v)
                                        if raw_v in circle_lookup:
                                            row_circle_id = circle_lookup[raw_v]
                                            break
                                        elif norm_v in circle_lookup:
                                            row_circle_id = circle_lookup[norm_v]
                                            break

                            if row_circle_id is None:
                                for k, v in raw.items():
                                    if "circle" in k.lower() and v:
                                        raw_v = str(v).strip().upper()
                                        norm_v = cls._normalize_circle_token(raw_v)
                                        if raw_v in circle_lookup:
                                            row_circle_id = circle_lookup[raw_v]
                                            break
                                        elif norm_v in circle_lookup:
                                            row_circle_id = circle_lookup[norm_v]
                                            break

                            if row_circle_id is not None:
                                if row_circle_id not in allowed_circles:
                                    circle_match = False
                            elif len(allowed_circles) < Circle.objects.filter(is_active=True).count():
                                circle_match = False

                        if not circle_match:
                            continue

                        # Optional row-level date check
                        if date_col and period and period.start_date and period.end_date:
                            row_d_val = raw.get(date_col)
                            if row_d_val:
                                try:
                                    d_parsed = None
                                    if isinstance(row_d_val, str):
                                        d_parsed = datetime.datetime.fromisoformat(row_d_val.split("T")[0]).date()
                                    elif isinstance(row_d_val, (datetime.date, datetime.datetime)):
                                        d_parsed = row_d_val.date() if isinstance(row_d_val, datetime.datetime) else row_d_val
                                    if d_parsed and not (period.start_date <= d_parsed <= period.end_date):
                                        continue
                                except Exception:
                                    pass

                        matched_rows.append(row)

                    c_records_considered = len(matched_rows)

        # Parse and prepare rules to evaluate
        raw_rules = comp.get("rules")
        rules_to_eval = []
        if isinstance(raw_rules, list) and len(raw_rules) > 0:
            for idx, r in enumerate(raw_rules):
                if isinstance(r, dict):
                    f_expr = (r.get("formula_expression") or (comp.get("formula_expression") if idx == 0 else "") or "").strip()
                    rules_to_eval.append({
                        "id": r.get("id") or f"rule-{idx+1}",
                        "achieved_data_column": (r.get("achieved_data_column") or r.get("output_column_name") or "").strip(),
                        "standard_value": r.get("standard_value") if r.get("standard_value") not in (None, "") else r.get("target_value"),
                        "performance_direction": r.get("performance_direction") or "HIGHER_BETTER",
                        "unit": r.get("unit") or r.get("output_unit") or comp.get("unit") or "%",
                        "aggregation": r.get("aggregation") or data_source.get("aggregation") or "AVG",
                        "actual_value": r.get("actual_value"),
                        "formula_expression": f_expr,
                        "formula_name": r.get("formula_name") or comp.get("name") or f"Formula #{idx+1}",
                        "input_column": (r.get("input_column") or comp.get("input_column") or r.get("achieved_data_column") or "").strip(),
                        "input_unit": r.get("input_unit") or comp.get("input_unit") or "Minutes",
                        "output_column_name": (r.get("output_column_name") or comp.get("output_column_name") or r.get("achieved_data_column") or "Calculated Output").strip(),
                        "output_unit": r.get("output_unit") or r.get("unit") or comp.get("unit") or "%",
                        "decimal_precision": r.get("decimal_precision", decimal_precision),
                        "constants": r.get("constants") or comp.get("constants") or {},
                    })
        else:
            col_fallback = (comp.get("achieved_data_column") or data_source.get("metric_field") or comp.get("output_column_name") or "").strip()
            std_fallback = comp.get("standard_value") if comp.get("standard_value") not in (None, "") else comp.get("target_value")
            rules_to_eval.append({
                "id": comp.get("id") or "rule-1",
                "achieved_data_column": col_fallback,
                "standard_value": std_fallback,
                "performance_direction": comp.get("performance_direction") or "HIGHER_BETTER",
                "unit": comp.get("unit") or "%",
                "aggregation": data_source.get("aggregation") or "AVG",
                "actual_value": comp.get("actual_value"),
                "formula_expression": (comp.get("formula_expression") or "").strip(),
                "formula_name": comp.get("formula_name") or comp.get("name") or "",
                "input_column": (comp.get("input_column") or col_fallback).strip(),
                "input_unit": comp.get("input_unit") or "Minutes",
                "output_column_name": (comp.get("output_column_name") or col_fallback or "Calculated Output").strip(),
                "output_unit": comp.get("output_unit") or comp.get("unit") or "%",
                "decimal_precision": comp.get("decimal_precision", decimal_precision),
                "constants": comp.get("constants") or {},
            })

        evaluated_rules = []
        for r in rules_to_eval:
            r_col = (r.get("achieved_data_column") or "").strip()
            r_pdir = r.get("performance_direction") or "HIGHER_BETTER"
            r_std_raw = r.get("standard_value")
            r_target_num: Optional[float] = None
            r_target: Any = None
            if r_std_raw not in (None, ""):
                try:
                    r_target_num = float(Decimal(str(r_std_raw)))
                    r_target = r_target_num
                except Exception:
                    r_target = str(r_std_raw)
            elif kpi_target_val is not None:
                r_target_num = float(kpi_target_val)
                r_target = r_target_num

            r_actual = None
            r_var = None
            r_pct = None
            r_calc_status = "UNKNOWN"
            r_perf_status = "UNKNOWN"
            r_error = ""

            formula_expr = (r.get("formula_expression") or "").strip()

            if ds_type == "UPLOAD" and formula_expr:
                if not template:
                    r_calc_status = "NO_DATA"
                    r_perf_status = "NO_DATA"
                    r_error = "No uploaded dataset available in the system."
                elif not batches:
                    r_calc_status = "NO_DATA"
                    r_perf_status = "NO_DATA"
                    r_error = f"Awaiting uploaded data. No uploaded batches found for dataset '{template.name}' in reporting period '{c_period_name}'."
                elif c_records_considered == 0:
                    r_calc_status = "NO_DATA"
                    r_perf_status = "NO_DATA"
                    r_error = f"No uploaded records found for dataset '{template.name}' matching {node_name}."
                else:
                    from apps.kpi.services.formula_calculation_service import KPIFormulaCalculationService
                    f_cfg = {
                        "formula_expression": formula_expr,
                        "formula_name": r.get("formula_name") or comp.get("name") or "",
                        "input_column": r.get("input_column") or r_col,
                        "input_unit": r.get("input_unit") or "Minutes",
                        "output_column_name": r.get("output_column_name") or r_col,
                        "output_unit": r.get("output_unit") or r.get("unit") or "%",
                        "decimal_precision": int(r.get("decimal_precision", decimal_precision)),
                        "constants": r.get("constants") or {},
                        "aggregation": r.get("aggregation") or "AVG",
                    }
                    target_batch = active_batches[0] if 'active_batches' in locals() and active_batches else batches[0]
                    if kpi:
                        batch_res = KPIFormulaCalculationService.execute_and_persist_formula_outputs(
                            kpi=kpi,
                            batch=target_batch,
                            formula_config=f_cfg,
                            rule_id=r.get("id") or "rule_1",
                            formula_name=r.get("formula_name") or comp.get("name") or "",
                        )
                    else:
                        row_vals = []
                        st_counts = {"SUCCESS": 0, "MISSING_COLUMN": 0, "INVALID_INPUT": 0, "PENDING_DATA": 0, "DIV_ZERO": 0}
                        for m_r in matched_rows:
                            c_v, st, err = KPIFormulaCalculationService.evaluate_row_formula(
                                raw_row_data=m_r.raw_data or {},
                                formula_config=f_cfg,
                                constants=f_cfg["constants"],
                            )
                            st_counts[st] = st_counts.get(st, 0) + 1
                            if st == "SUCCESS" and c_v is not None:
                                row_vals.append(c_v)
                        avg_v = None
                        if row_vals:
                            avg_v = sum(row_vals, Decimal("0")) / Decimal(str(len(row_vals)))
                        batch_res = {
                            "overall_status": "SUCCESS" if row_vals else "CONFIG_INVALID" if st_counts["MISSING_COLUMN"] > 0 else "NO_DATA",
                            "calculated_value": avg_v,
                        }

                    ov_status = batch_res.get("overall_status", "SUCCESS")
                    if ov_status == "SUCCESS" and batch_res.get("calculated_value") is not None:
                        d_val = batch_res["calculated_value"]
                        rule_prec = int(r.get("decimal_precision", decimal_precision))
                        prec_str = "1." + ("0" * rule_prec) if rule_prec > 0 else "1"
                        r_actual = float(d_val.quantize(Decimal(prec_str), rounding=ROUND_HALF_UP))
                        r_calc_status = "SUCCESS"
                        if r_target_num is not None:
                            r_var = round(r_actual - r_target_num, 2)
                            if r_pdir == "HIGHER_BETTER":
                                r_perf_status = "MEETS_TARGET" if r_actual >= r_target_num else "BELOW_TARGET"
                                r_pct = round((r_actual / r_target_num) * 100, 2) if r_target_num != 0 else (100.0 if r_actual >= r_target_num else 0.0)
                            elif r_pdir == "LOWER_BETTER":
                                r_perf_status = "MEETS_TARGET" if r_actual <= r_target_num else "EXCEEDED_LIMIT"
                                r_pct = round((r_target_num / r_actual) * 100, 2) if r_actual > 0 else (100.0 if r_actual <= r_target_num else 0.0)
                            else:
                                if abs(r_actual - r_target_num) < 1e-6:
                                    r_perf_status = "MEETS_TARGET"
                                    r_pct = 100.0
                                else:
                                    r_perf_status = "DOES_NOT_MATCH"
                                    r_pct = round((r_actual / r_target_num) * 100, 2) if r_target_num != 0 else 0.0
                        else:
                            r_perf_status = "SUCCESS"
                    elif ov_status == "MISSING_COLUMN":
                        r_calc_status = "CONFIG_INVALID"
                        r_perf_status = "CONFIG_INVALID"
                        r_error = f"Column '{f_cfg['input_column']}' not found in uploaded records for dataset '{template.name}'."
                    elif ov_status == "INVALID_INPUT":
                        r_calc_status = "INVALID_INPUT"
                        r_perf_status = "INVALID_INPUT"
                        r_error = f"Impossible or invalid input value in column '{f_cfg['input_column']}'."
                    elif ov_status == "PENDING_DATA":
                        r_calc_status = "NO_DATA"
                        r_perf_status = "NO_DATA"
                        r_error = f"Input column '{f_cfg['input_column']}' is empty in uploaded records."
                    elif ov_status == "DIV_ZERO":
                        r_calc_status = "DIV_ZERO"
                        r_perf_status = "ERROR"
                        r_error = "Division by zero in formula calculation."
                    else:
                        r_calc_status = "ERROR"
                        r_perf_status = "ERROR"
                        r_error = "Formula calculation error."

            elif ds_type == "UPLOAD":
                if not template:
                    r_calc_status = "NO_DATA"
                    r_perf_status = "NO_DATA"
                    r_error = "No uploaded dataset available in the system."
                elif not batches:
                    r_calc_status = "NO_DATA"
                    r_perf_status = "NO_DATA"
                    r_error = f"Awaiting uploaded data. No uploaded batches found for dataset '{template.name}' in reporting period '{c_period_name}'."
                elif c_records_considered == 0:
                    r_calc_status = "NO_DATA"
                    r_perf_status = "NO_DATA"
                    r_error = f"No uploaded records found for dataset '{template.name}' matching {node_name}."
                elif not r_col:
                    r_calc_status = "CONFIG_INVALID"
                    r_perf_status = "CONFIG_INVALID"
                    r_error = "No Achieved Data Column configured for rule."
                else:
                    clean_target = cls._sanitize_header(r_col)
                    norm_target = r_col.strip().lower()
                    alias_keys = {r_col, r_col.strip()}
                    if template:
                        for v in template.versions.all():
                            for col in v.columns.all():
                                if (
                                    cls._sanitize_header(col.display_label) == clean_target
                                    or cls._sanitize_header(col.name) == clean_target
                                    or col.display_label.strip().lower() == norm_target
                                    or col.name.strip().lower() == norm_target
                                ):
                                    alias_keys.add(col.name)
                                    alias_keys.add(col.display_label)

                    vals = []
                    col_found = False
                    for row in matched_rows:
                        raw = row.raw_data or {}
                        v = None
                        for a_key in alias_keys:
                            if a_key in raw:
                                v = raw[a_key]
                                col_found = True
                                break
                        if not col_found or v is None:
                            for k, row_v in raw.items():
                                if (
                                    cls._sanitize_header(k) == clean_target
                                    or k.strip().lower() == norm_target
                                ):
                                    v = row_v
                                    col_found = True
                                    break
                        vals.append(v)

                    if not col_found:
                        r_calc_status = "CONFIG_INVALID"
                        r_perf_status = "CONFIG_INVALID"
                        r_error = f"Achieved Data Column '{r_col}' not found in uploaded records for dataset '{template.name}'."
                    else:
                        non_null_vals = [v for v in vals if v is not None and str(v).strip() != ""]
                        if not non_null_vals:
                            r_calc_status = "NO_DATA"
                            r_perf_status = "NO_DATA"
                            r_error = f"Achieved Data Column '{r_col}' is empty in uploaded record."
                        else:
                            is_numeric = False
                            numeric_vals = []
                            for v in non_null_vals:
                                try:
                                    s = str(v).replace("%", "").strip()
                                    numeric_vals.append(Decimal(s))
                                    is_numeric = True
                                except (InvalidOperation, ValueError):
                                    is_numeric = False
                                    break

                            if is_numeric and numeric_vals:
                                if len(numeric_vals) == 1:
                                    d_val = numeric_vals[0]
                                else:
                                    agg = (r.get("aggregation") or data_source.get("aggregation") or "AVG").upper()
                                    d_val = cls._compute_aggregation(vals, agg)

                                if d_val is None:
                                    r_calc_status = "NO_DATA"
                                    r_perf_status = "NO_DATA"
                                    r_error = f"Could not aggregate column '{r_col}' using {r.get('aggregation') or 'AVG'}."
                                else:
                                    rule_unit = r.get("unit") or comp.get("unit") or "%"
                                    if rule_unit == "%" and r_target_num is not None and r_target_num > 1.0 and d_val <= Decimal("1.0"):
                                        d_val = d_val * Decimal("100")
                                    prec_str = "1." + ("0" * decimal_precision) if decimal_precision > 0 else "1"
                                    r_actual = float(d_val.quantize(Decimal(prec_str), rounding=ROUND_HALF_UP))
                                    r_calc_status = "SUCCESS"

                                    if r_target_num is not None:
                                        r_var = round(r_actual - r_target_num, 2)
                                        if r_pdir == "HIGHER_BETTER":
                                            if r_actual >= r_target_num:
                                                r_perf_status = "MEETS_TARGET"
                                            else:
                                                r_perf_status = "BELOW_TARGET"
                                            if r_target_num != 0:
                                                r_pct = round((r_actual / r_target_num) * 100, 2)
                                            else:
                                                r_pct = 100.0 if r_actual >= r_target_num else 0.0
                                        elif r_pdir == "LOWER_BETTER":
                                            if r_actual <= r_target_num:
                                                r_perf_status = "MEETS_TARGET"
                                            else:
                                                r_perf_status = "EXCEEDED_LIMIT"
                                            if r_actual > 0:
                                                r_pct = round((r_target_num / r_actual) * 100, 2)
                                            else:
                                                r_pct = 100.0 if r_actual <= r_target_num else 0.0
                                        else:  # EXACT_TARGET
                                            if abs(r_actual - r_target_num) < 1e-6:
                                                r_perf_status = "MEETS_TARGET"
                                                r_pct = 100.0
                                            else:
                                                r_perf_status = "DOES_NOT_MATCH"
                                                if r_target_num != 0:
                                                    r_pct = round((r_actual / r_target_num) * 100, 2)
                                                else:
                                                    r_pct = 0.0
                                    else:
                                        r_perf_status = "SUCCESS"
                            else:
                                # Categorical or Text Column (e.g. O&M Status)
                                raw_text = str(vals[0] if len(vals) == 1 else vals[-1]).strip()
                                r_actual = raw_text
                                r_calc_status = "SUCCESS"
                                target_text = str(r_std_raw).strip() if r_std_raw not in (None, "") else ""
                                if r_pdir == "EXACT_TARGET":
                                    if target_text and raw_text.lower() == target_text.lower():
                                        r_perf_status = "MEETS_TARGET"
                                        r_pct = 100.0
                                    else:
                                        r_perf_status = "DOES_NOT_MATCH"
                                        r_pct = 0.0
                                else:
                                    r_perf_status = "MEETS_TARGET" if raw_text else "NO_DATA"

            elif r.get("actual_value") not in (None, "") or comp.get("actual_value") not in (None, ""):
                # Manual entry
                try:
                    act_raw = r.get("actual_value") if r.get("actual_value") not in (None, "") else comp.get("actual_value")
                    r_actual = float(Decimal(str(act_raw)))
                    r_calc_status = "SUCCESS"
                    if r_target_num is not None:
                        r_var = round(r_actual - r_target_num, 2)
                        if r_pdir == "HIGHER_BETTER":
                            r_perf_status = "MEETS_TARGET" if r_actual >= r_target_num else "BELOW_TARGET"
                            r_pct = round((r_actual / r_target_num) * 100, 2) if r_target_num != 0 else 100.0
                        elif r_pdir == "LOWER_BETTER":
                            r_perf_status = "MEETS_TARGET" if r_actual <= r_target_num else "EXCEEDED_LIMIT"
                            r_pct = round((r_target_num / r_actual) * 100, 2) if r_actual > 0 else 100.0
                        else:
                            r_perf_status = "MEETS_TARGET" if abs(r_actual - r_target_num) < 1e-6 else "DOES_NOT_MATCH"
                            r_pct = 100.0 if abs(r_actual - r_target_num) < 1e-6 else 0.0
                except Exception:
                    r_calc_status = "CONFIG_INVALID"
                    r_perf_status = "CONFIG_INVALID"
                    r_error = "Invalid manual actual value."
            else:
                r_calc_status = "NO_DATA"
                r_perf_status = "NO_DATA"
                r_error = "No actual value or uploaded data source configured."

            if r_perf_status == "MEETS_TARGET":
                r_status_label = "Met"
            elif r_perf_status == "CONFIG_INVALID":
                r_status_label = "Column Missing"
            elif r_perf_status == "NO_DATA":
                r_status_label = "Pending Data"
            elif r_perf_status == "INVALID_INPUT":
                r_status_label = "Invalid Input"
            elif r_perf_status == "DIV_ZERO":
                r_status_label = "Calculation Error"
            else:
                r_status_label = "Not Met"

            evaluated_rules.append({
                "id": r.get("id"),
                "achieved_data_column": r_col,
                "standard_value": r_target if r_target is not None else r_std_raw,
                "target_value": r_target if r_target is not None else r_std_raw,
                "performance_direction": r_pdir,
                "unit": r.get("unit") or comp.get("unit") or "%",
                "actual_value": r_actual,
                "calculated_actual": r_actual,
                "calculated_variance": r_var,
                "achievement_percentage": r_pct,
                "performance_status": r_perf_status,
                "calculation_status": r_calc_status,
                "status_label": r_status_label,
                "error_message": r_error,
                "formula_name": r.get("formula_name") or "",
                "formula_expression": r.get("formula_expression") or "",
                "input_column": r.get("input_column") or r_col,
                "input_unit": r.get("input_unit") or "",
                "output_column_name": r.get("output_column_name") or r_col,
                "output_unit": r.get("output_unit") or r.get("unit") or "%",
                "constants": r.get("constants") or {},
            })


        # Calculate Overall Comparison Status based on all individual rules:
        # 1. Met: only when ALL applicable rules are met
        # 2. Not Met: when ANY applicable rule fails
        # 3. Column Missing (CONFIG_INVALID): when any configured column cannot be found
        # 4. Pending Data (NO_DATA): when required results cannot yet be calculated
        if len(evaluated_rules) == 1:
            comp_perf_status = evaluated_rules[0]["performance_status"]
            comp_calc_status = evaluated_rules[0]["calculation_status"]
            comp_error = evaluated_rules[0]["error_message"]
            if comp_perf_status == "MEETS_TARGET":
                overall_status = "MET"
                overall_status_label = "Met"
            elif comp_perf_status == "CONFIG_INVALID":
                overall_status = "CONFIG_INVALID"
                overall_status_label = "Column Missing"
            elif comp_perf_status == "NO_DATA":
                overall_status = "PENDING_DATA"
                overall_status_label = "Pending Data"
            else:
                overall_status = "NOT_MET"
                overall_status_label = "Not Met"
        elif any(r["performance_status"] == "CONFIG_INVALID" for r in evaluated_rules):
            overall_status = "CONFIG_INVALID"
            overall_status_label = "Column Missing"
            comp_perf_status = "CONFIG_INVALID"
            comp_calc_status = "CONFIG_INVALID"
            comp_error = next(r["error_message"] for r in evaluated_rules if r["performance_status"] == "CONFIG_INVALID")
        elif any(r["performance_status"] == "NO_DATA" for r in evaluated_rules):
            overall_status = "PENDING_DATA"
            overall_status_label = "Pending Data"
            comp_perf_status = "NO_DATA"
            comp_calc_status = "NO_DATA"
            comp_error = next(r["error_message"] for r in evaluated_rules if r["performance_status"] == "NO_DATA")
        elif any(r["performance_status"] in ["BELOW_TARGET", "EXCEEDED_LIMIT", "DOES_NOT_MATCH"] for r in evaluated_rules):
            overall_status = "NOT_MET"
            overall_status_label = "Not Met"
            comp_perf_status = "BELOW_TARGET"
            comp_calc_status = "SUCCESS"
            comp_error = ""
        elif all(r["performance_status"] == "MEETS_TARGET" for r in evaluated_rules):
            overall_status = "MET"
            overall_status_label = "Met"
            comp_perf_status = "MEETS_TARGET"
            comp_calc_status = "SUCCESS"
            comp_error = ""
        else:
            overall_status = "UNKNOWN"
            overall_status_label = "Unknown"
            comp_perf_status = "UNKNOWN"
            comp_calc_status = "UNKNOWN"
            comp_error = ""

        # Primary rule for backward compatibility
        primary_r = evaluated_rules[0] if evaluated_rules else {}

        return {
            **comp,
            "rules": evaluated_rules,
            "overall_status": overall_status,
            "overall_status_label": overall_status_label,
            "performance_status": comp_perf_status,
            "calculation_status": comp_calc_status,
            "standard_value": primary_r.get("standard_value"),
            "target_value": primary_r.get("standard_value"),
            "actual_value": primary_r.get("actual_value"),
            "calculated_actual": primary_r.get("calculated_actual"),
            "calculated_variance": primary_r.get("calculated_variance"),
            "achievement_percentage": primary_r.get("achievement_percentage"),
            "achieved_data_column": primary_r.get("achieved_data_column") or comp.get("achieved_data_column") or "",
            "performance_direction": primary_r.get("performance_direction") or comp.get("performance_direction", "HIGHER_BETTER"),
            "is_manual": c_is_manual,
            "dataset_name": c_dataset_name,
            "reporting_period_name": c_period_name,
            "records_considered": c_records_considered,
            "error_message": comp_error,
            "error": comp_error,
            "last_calculated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

    @classmethod
    def calculate_kpi(
        cls,
        kpi: KPIDefinition,
        period: ReportingPeriod,
        hierarchy_level: str,
        hierarchy_id: int,
        trigger_type: str = "ON_DEMAND",
        batch_id: Optional[str] = None,
        user=None,
    ) -> Dict[str, Any]:
        """
        Authoritative single KPI execution across source data for a specific period and node.
        Saves result to KPICalculationResult and KPICalculationAuditLog.
        """
        start_time = time.time()
        diagnostics: Dict[str, Any] = {
            "kpi_code": kpi.code,
            "period": period.name,
            "hierarchy": f"{hierarchy_level}:{hierarchy_id}",
            "calculation_type": kpi.calculation_type,
            "batches_considered": [],
            "parameter_values": {},
            "step_log": [],
        }

        # 1. Resolve circle descendants for hierarchy filtering
        allowed_circles = cls.resolve_hierarchy_descendant_circle_ids(hierarchy_level, hierarchy_id)
        node_name = cls.get_node_display_name(hierarchy_level, hierarchy_id)
        diagnostics["descendant_circle_count"] = len(allowed_circles)

        # 2. Check for Derived KPI dependencies
        param_context: Dict[str, Decimal] = {}
        if kpi.calculation_type == KPIDefinition.CalculationType.DERIVED:
            diagnostics["step_log"].append("Resolving derived KPI dependencies")
            deps = list(kpi.dependencies.select_related("depends_on").all())
            for dep in deps:
                # Recurse or fetch cached parent result for the same node and period
                parent_res = KPICalculationResult.objects.filter(
                    kpi=dep.depends_on,
                    reporting_period=period,
                    hierarchy_level=hierarchy_level,
                    hierarchy_id=hierarchy_id,
                ).first()

                if not parent_res or parent_res.calculated_value is None:
                    # Calculate on-demand
                    sub_out = cls.calculate_kpi(
                        kpi=dep.depends_on,
                        period=period,
                        hierarchy_level=hierarchy_level,
                        hierarchy_id=hierarchy_id,
                        trigger_type="DERIVED_SUB",
                        user=user,
                    )
                    parent_val = sub_out.get("calculated_value")
                else:
                    parent_val = parent_res.calculated_value

                if parent_val is None:
                    diagnostics["step_log"].append(f"Parent KPI {dep.depends_on.code} has no data")
                    parent_val = Decimal("0")
                param_context[dep.parameter_name] = Decimal(str(parent_val))
                diagnostics["parameter_values"][dep.parameter_name] = float(parent_val)

        # 3. Fetch Staged Rows from Uploaded Batches
        staged_rows_qs = ImportStagedRow.objects.none()
        batches = []
        if kpi.source_dataset:
            batch_filter = Q(template_version__template=kpi.source_dataset)
            if period:
                batch_filter &= (Q(reporting_period=period) | Q(reporting_period__isnull=True))

            # Prioritize COMPLETED batches from Uploads; fallback to VALIDATED batches
            completed_batches = list(
                ImportBatch.objects.filter(batch_filter, status=ImportBatch.Status.COMPLETED).order_by("-created_at")
            )
            if completed_batches:
                batches = completed_batches
            else:
                batches = list(
                    ImportBatch.objects.filter(batch_filter, status=ImportBatch.Status.VALIDATED).order_by("-created_at")
                )

            # Eliminate double counting by retaining only the latest batch per circle
            seen_scope: Set[Optional[int]] = set()
            active_batches: List[ImportBatch] = []
            for b in batches:
                b_circle_id: Optional[int] = getattr(b, "circle_id", None) or (b.circle.id if getattr(b, "circle", None) else None)
                if b_circle_id is not None:
                    if b_circle_id not in seen_scope:
                        seen_scope.add(b_circle_id)
                        active_batches.append(b)
                else:
                    active_batches.append(b)

            batches = active_batches
            diagnostics["batches_considered"] = [b.batch_id for b in batches]

            if batches:
                staged_rows_qs = ImportStagedRow.objects.filter(
                    batch__in=batches,
                    is_valid=True,
                ).select_related("batch")
        else:
            diagnostics["step_log"].append("No source dataset configured on KPI definition.")

        # 4. Filter rows by hierarchy node, reporting period, and KPI filters (KPI Funnel Flow)
        circle_lookup = cls._build_circle_lookup()
        all_staged_rows = list(staged_rows_qs)
        total_uploaded_count = len(all_staged_rows)

        scope_matched_rows: List[ImportStagedRow] = []
        period_matched_rows: List[ImportStagedRow] = []
        matched_rows: List[ImportStagedRow] = []
        excluded_rows_count = 0
        filters = list(kpi.filters.all())

        for row in all_staged_rows:
            raw = row.raw_data
            circle_match = True

            if allowed_circles:
                row_circle_id: Optional[int] = None

                # Check batch-level circle assignment first
                if row.batch:
                    b_cid = getattr(row.batch, "circle_id", None) or (row.batch.circle.id if getattr(row.batch, "circle", None) else None)
                    if b_cid is not None:
                        row_circle_id = int(b_cid)

                # If not on batch, inspect raw_data columns
                if row_circle_id is None:
                    for k, v in raw.items():
                        if "circle" in k.lower() and v:
                            raw_v = str(v).strip().upper()
                            norm_v = cls._normalize_circle_token(raw_v)
                            if raw_v in circle_lookup:
                                row_circle_id = circle_lookup[raw_v]
                                break
                            elif norm_v in circle_lookup:
                                row_circle_id = circle_lookup[norm_v]
                                break

                # Fallback: scan any text column matching circle names
                if row_circle_id is None:
                    for v in raw.values():
                        if v and isinstance(v, str):
                            raw_v = v.strip().upper()
                            norm_v = cls._normalize_circle_token(raw_v)
                            if raw_v in circle_lookup:
                                row_circle_id = circle_lookup[raw_v]
                                break
                            elif norm_v in circle_lookup:
                                row_circle_id = circle_lookup[norm_v]
                                break

                if row_circle_id is not None:
                    if row_circle_id not in allowed_circles:
                        circle_match = False
                elif len(allowed_circles) < Circle.objects.filter(is_active=True).count():
                    circle_match = False

            if not circle_match:
                excluded_rows_count += 1
                continue

            scope_matched_rows.append(row)

            # Period check
            period_match = True
            if period and row.batch:
                b_rpid = getattr(row.batch, "reporting_period_id", None) or (row.batch.reporting_period.id if getattr(row.batch, "reporting_period", None) else None)
                if b_rpid is not None and b_rpid != period.id:
                    period_match = False

            if not period_match:
                excluded_rows_count += 1
                continue

            period_matched_rows.append(row)

            # Check custom KPIFilter criteria
            if filters and not cls._apply_row_filters(raw, filters):
                excluded_rows_count += 1
                continue

            matched_rows.append(row)

        records_considered = len(matched_rows)
        diagnostics["total_uploaded_records"] = total_uploaded_count
        diagnostics["scope_matched_records"] = len(scope_matched_rows)
        diagnostics["period_matched_records"] = len(period_matched_rows)
        diagnostics["records_considered"] = records_considered
        diagnostics["records_excluded"] = excluded_rows_count

        # 5. Extract Parameters & Aggregations
        params = list(kpi.parameters.all())
        missing_columns: List[str] = []

        for p in params:
            col_target = p.source_column.strip()
            col_target_lower = col_target.lower()
            vals = []
            col_found = False

            for r in matched_rows:
                raw = r.raw_data
                val = raw.get(col_target)
                if val is None:
                    for k, v in raw.items():
                        if k.strip().lower() == col_target_lower:
                            val = v
                            col_found = True
                            break
                else:
                    col_found = True
                vals.append(val)

            if matched_rows and not col_found:
                missing_columns.append(p.source_column)

            agg_val = cls._compute_aggregation(vals, p.aggregation)
            if agg_val is None:
                agg_val = p.default_value if p.default_value is not None else Decimal("0")
            param_context[p.name] = agg_val
            diagnostics["parameter_values"][p.name] = float(agg_val)

        # 6. Evaluate Result based on CalculationType or Independent Target vs Achievement
        calc_status = KPICalculationResult.CalculationStatus.SUCCESS
        error_msg = ""
        calculated_value: Optional[Decimal] = None
        target_val: Optional[Decimal] = None

        p_cfg = getattr(kpi, "presentation_config", {}) or {}
        configured_comparisons = p_cfg.get("comparisons") or p_cfg.get("comparison_items") or []
        active_comparisons = [c for c in configured_comparisons if c.get("is_enabled", True)] if isinstance(configured_comparisons, list) else []

        processed_comparisons = []
        if active_comparisons:
            # Modern Data-Driven Target vs Actual Comparison KPI evaluation
            for c in (configured_comparisons if isinstance(configured_comparisons, list) else []):
                if c.get("is_enabled", True):
                    p_comp = cls._evaluate_comparison_data_source(
                        comp=c,
                        period=period,
                        allowed_circles=allowed_circles,
                        node_name=node_name,
                        kpi_target_val=kpi.target_value,
                        decimal_precision=kpi.decimal_precision or 2,
                        kpi=kpi,
                    )

                else:
                    p_comp = {**c, "performance_status": "DISABLED"}
                processed_comparisons.append(p_comp)

            active_processed = [pc for pc in processed_comparisons if pc.get("is_enabled", True)]
            primary_comp = active_processed[0] if active_processed else processed_comparisons[0]

            raw_act = primary_comp.get("calculated_actual")
            raw_tgt = primary_comp.get("target_value")
            calculated_value = Decimal(str(raw_act)) if raw_act is not None else None
            target_val = Decimal(str(raw_tgt)) if raw_tgt is not None else kpi.target_value
            variance_to_target = Decimal(str(primary_comp["calculated_variance"])) if primary_comp.get("calculated_variance") is not None else None
            variance_percentage = round((variance_to_target / target_val) * Decimal("100"), 2) if (variance_to_target is not None and target_val and target_val != Decimal("0")) else None
            achievement_percentage = Decimal(str(primary_comp["achievement_percentage"])) if primary_comp.get("achievement_percentage") is not None else None

            p_stat = primary_comp.get("performance_status", "UNKNOWN")
            c_calc_status = primary_comp.get("calculation_status", "SUCCESS")

            if p_stat == "MEETS_TARGET":
                rag_status = KPICalculationResult.RAGStatus.GREEN
                calc_status = KPICalculationResult.CalculationStatus.SUCCESS
            elif p_stat == "BELOW_TARGET":
                w_raw = primary_comp.get("warning_threshold")
                warn_val = float(w_raw) if w_raw not in (None, "") else None
                if warn_val is not None and raw_act is not None and float(raw_act) >= warn_val:
                    rag_status = KPICalculationResult.RAGStatus.AMBER
                else:
                    rag_status = KPICalculationResult.RAGStatus.RED
                calc_status = KPICalculationResult.CalculationStatus.SUCCESS
            elif p_stat == "EXCEEDED_LIMIT":
                w_raw = primary_comp.get("warning_threshold")
                warn_val = float(w_raw) if w_raw not in (None, "") else None
                if warn_val is not None and raw_act is not None and float(raw_act) <= warn_val:
                    rag_status = KPICalculationResult.RAGStatus.AMBER
                else:
                    rag_status = KPICalculationResult.RAGStatus.RED
                calc_status = KPICalculationResult.CalculationStatus.SUCCESS
            elif p_stat in ["CRITICAL", "DOES_NOT_MATCH"]:
                rag_status = KPICalculationResult.RAGStatus.RED
                calc_status = KPICalculationResult.CalculationStatus.SUCCESS
            elif p_stat == "NO_DATA" or c_calc_status == "NO_DATA":
                rag_status = KPICalculationResult.RAGStatus.UNKNOWN
                calc_status = KPICalculationResult.CalculationStatus.NO_DATA
                error_msg = primary_comp.get("error_message") or f"No uploaded data available for {node_name} in {period.name if period else 'selected period'}."
            else:
                rag_status = KPICalculationResult.RAGStatus.UNKNOWN
                calc_status = KPICalculationResult.CalculationStatus.ERROR
                error_msg = primary_comp.get("error_message") or "Comparison evaluation error."

            records_considered = primary_comp.get("records_considered", 0)
            diagnostics["step_log"].append(
                f"Evaluated Target vs Actual comparison: {primary_comp.get('name')} (Status: {p_stat}, Records: {records_considered})"
            )
        elif not kpi.source_dataset and kpi.calculation_type != KPIDefinition.CalculationType.DERIVED:
            calc_status = KPICalculationResult.CalculationStatus.NO_DATA
            error_msg = f"No source dataset configured for KPI '{kpi.code}'."
        elif missing_columns:
            calc_status = KPICalculationResult.CalculationStatus.ERROR
            ds_name = kpi.source_dataset.name if kpi.source_dataset else "Dataset"
            error_msg = f"Required uploaded field(s) '{', '.join(missing_columns)}' not found in uploaded dataset '{ds_name}'."
        elif kpi.source_dataset and records_considered == 0 and kpi.calculation_type != KPIDefinition.CalculationType.DERIVED:
            calc_status = KPICalculationResult.CalculationStatus.NO_DATA
            ds_name = kpi.source_dataset.name if kpi.source_dataset else "Dataset"
            error_msg = f"No uploaded records found for dataset '{ds_name}' matching {node_name}."
        else:
            try:
                if kpi.calculation_type == KPIDefinition.CalculationType.SIMPLE_AGGREGATE:
                    if params:
                        calculated_value = param_context.get(params[0].name)
                    elif matched_rows:
                        calculated_value = Decimal(str(records_considered))
                    else:
                        calculated_value = Decimal("0")

                elif kpi.calculation_type in [KPIDefinition.CalculationType.FORMULA, KPIDefinition.CalculationType.DERIVED]:
                    expr = kpi.formula_expression.strip()
                    if not expr:
                        raise SafeFormulaError("No formula expression configured for this KPI definition.")
                    calculated_value = SafeFormulaEvaluator.evaluate(expr, param_context)

                elif kpi.calculation_type == KPIDefinition.CalculationType.RATIO:
                    num = param_context.get("numerator", param_context.get("X", Decimal("0")))
                    den = param_context.get("denominator", param_context.get("Y", Decimal("0")))
                    if den == Decimal("0"):
                        raise DivisionByZeroError("Ratio denominator is zero.")
                    calculated_value = num / den

                elif kpi.calculation_type == KPIDefinition.CalculationType.PERCENTAGE:
                    num = param_context.get("numerator", param_context.get("X", Decimal("0")))
                    den = param_context.get("denominator", param_context.get("Y", Decimal("0")))
                    if den == Decimal("0"):
                        raise DivisionByZeroError("Percentage denominator is zero.")
                    calculated_value = (num / den) * Decimal("100")

                elif kpi.calculation_type == KPIDefinition.CalculationType.ACHIEVEMENT_PCT:
                    actual = param_context.get("actual", param_context.get("X", Decimal("0")))
                    target = param_context.get("target", kpi.target_value or Decimal("0"))
                    if target == Decimal("0"):
                        raise DivisionByZeroError("Target is zero; achievement % cannot be computed.")
                    calculated_value = (actual / target) * Decimal("100")

                elif kpi.calculation_type == KPIDefinition.CalculationType.VARIANCE:
                    actual = param_context.get("actual", param_context.get("X", Decimal("0")))
                    target = param_context.get("target", kpi.target_value or Decimal("0"))
                    calculated_value = actual - target

            except DivisionByZeroError as div_err:
                calc_status = KPICalculationResult.CalculationStatus.DIV_ZERO
                error_msg = str(div_err)
                calculated_value = None
            except SafeFormulaError as form_err:
                calc_status = KPICalculationResult.CalculationStatus.ERROR
                error_msg = str(form_err)
                calculated_value = None
            except Exception as ex:
                calc_status = KPICalculationResult.CalculationStatus.ERROR
                error_msg = f"Unexpected calculation error: {str(ex)}"
                calculated_value = None

        if calculated_value is not None:
            # Round to defined decimal precision
            prec_str = "1." + ("0" * kpi.decimal_precision) if kpi.decimal_precision > 0 else "1"
            calculated_value = calculated_value.quantize(Decimal(prec_str), rounding=ROUND_HALF_UP)

        # 7. Target & Status Evaluation (for legacy single-target KPIs without configured comparisons)
        if not active_comparisons:
            if target_val is None:
                target_val = kpi.target_value
            if target_val is None and "target" in param_context:
                target_val = param_context["target"]

            if target_val is not None and not isinstance(target_val, Decimal):
                target_val = Decimal(str(target_val))

            if calculated_value is not None and not isinstance(calculated_value, Decimal):
                calculated_value = Decimal(str(calculated_value))

            variance_to_target = None
            variance_percentage = None
            achievement_percentage = None
            rag_status = KPICalculationResult.RAGStatus.NEUTRAL

            eval_direction = "HIGHER_BETTER"
            if kpi.direction == KPIDefinition.Direction.LOWER_BETTER:
                eval_direction = "LOWER_BETTER"
            elif kpi.direction == KPIDefinition.Direction.NEUTRAL:
                eval_direction = "EXACT_TARGET"

            if calculated_value is not None and target_val is not None:
                variance_to_target = calculated_value - target_val
                if target_val != Decimal("0"):
                    if eval_direction == "HIGHER_BETTER":
                        achievement_percentage = round((calculated_value / target_val) * Decimal("100"), 2)
                        variance_percentage = round((variance_to_target / target_val) * Decimal("100"), 2)
                    elif eval_direction == "LOWER_BETTER":
                        variance_percentage = round((variance_to_target / target_val) * Decimal("100"), 2)
                        achievement_percentage = round((target_val / calculated_value) * Decimal("100"), 2) if calculated_value > 0 else Decimal("100.00")
                    else:  # EXACT_TARGET
                        variance_percentage = round((variance_to_target / target_val) * Decimal("100"), 2)
                        achievement_percentage = Decimal("100.00") if calculated_value == target_val else Decimal("0.00")

                    green_thresh = kpi.threshold_green or Decimal("95.00")
                    amber_thresh = kpi.threshold_amber or Decimal("80.00")

                    if eval_direction == "HIGHER_BETTER":
                        if calculated_value >= target_val:
                            rag_status = KPICalculationResult.RAGStatus.GREEN
                        elif achievement_percentage >= amber_thresh:
                            rag_status = KPICalculationResult.RAGStatus.AMBER
                        else:
                            rag_status = KPICalculationResult.RAGStatus.RED
                    elif eval_direction == "LOWER_BETTER":
                        if calculated_value <= target_val:
                            rag_status = KPICalculationResult.RAGStatus.GREEN
                        elif achievement_percentage <= (Decimal("100.00") + (Decimal("100.00") - amber_thresh)):
                            rag_status = KPICalculationResult.RAGStatus.AMBER
                        else:
                            rag_status = KPICalculationResult.RAGStatus.RED
                    elif eval_direction == "EXACT_TARGET":
                        if calculated_value == target_val:
                            rag_status = KPICalculationResult.RAGStatus.GREEN
                        else:
                            rag_status = KPICalculationResult.RAGStatus.RED
            elif calculated_value is None and calc_status != KPICalculationResult.CalculationStatus.SUCCESS:
                rag_status = KPICalculationResult.RAGStatus.UNKNOWN

        diagnostics["matched_row_ids"] = [r.id for r in matched_rows[:500]]
        execution_time_ms = round((time.time() - start_time) * 1000.0, 2)
        diagnostics["execution_time_ms"] = execution_time_ms
        diagnostics["status"] = calc_status
        diagnostics["error"] = error_msg
        diagnostics["presentation_config"] = getattr(kpi, "presentation_config", {}) or {}

        # Fallback enrichment if comparisons were not already processed
        if not processed_comparisons:
            for c in (configured_comparisons if isinstance(configured_comparisons, list) else []):
                c_target = None
                c_actual = None
                c_var = None
                c_pct = None
                c_status = "UNKNOWN"
                try:
                    if c.get("target_value") not in (None, ""):
                        c_target = float(Decimal(str(c["target_value"])))
                    if c.get("actual_value") not in (None, ""):
                        c_actual = float(Decimal(str(c["actual_value"])))
                    if c_target is not None and c_actual is not None:
                        c_var = round(c_actual - c_target, 2)
                        c_pdir = c.get("performance_direction", "HIGHER_BETTER")
                        if c_pdir == "HIGHER_BETTER":
                            c_status = "MEETS_TARGET" if c_actual >= c_target else "BELOW_TARGET"
                            if c_target != 0:
                                c_pct = round((c_actual / c_target) * 100, 2)
                        elif c_pdir == "LOWER_BETTER":
                            c_status = "MEETS_TARGET" if c_actual <= c_target else "EXCEEDED_LIMIT"
                            if c_target != 0:
                                c_pct = round((c_target / c_actual) * 100, 2) if c_actual > 0 else 100.0
                        else:
                            c_status = "MEETS_TARGET" if c_actual == c_target else "DOES_NOT_MATCH"
                            c_pct = 100.0 if c_actual == c_target else 0.0
                except Exception:
                    pass

                processed_comparisons.append({
                    **c,
                    "calculated_variance": c_var,
                    "achievement_percentage": c_pct,
                    "performance_status": c_status,
                })

        funnel_breakdown = {
            "total_uploaded_records": total_uploaded_count if kpi.source_dataset else 0,
            "organization_scope_records": len(scope_matched_rows) if kpi.source_dataset else 0,
            "reporting_period_records": len(period_matched_rows) if kpi.source_dataset else 0,
            "kpi_filtered_records": records_considered,
            "parameter_values": diagnostics["parameter_values"],
            "calculated_value": float(calculated_value) if calculated_value is not None else None,
            "target_value": float(target_val) if target_val is not None else None,
            "achievement_percentage": float(achievement_percentage) if achievement_percentage is not None else None,
            "rag_status": rag_status,
            "status": calc_status,
            "unit": kpi.unit,
            "visualization_type": kpi.visualization_type,
            "comparisons": processed_comparisons,
        }
        diagnostics["funnel_breakdown"] = funnel_breakdown

        # 8. Persist to KPICalculationResult
        with atomic_operation():
            res_obj, _ = KPICalculationResult.objects.update_or_create(
                kpi=kpi,
                reporting_period=period,
                hierarchy_level=hierarchy_level.upper(),
                hierarchy_id=hierarchy_id,
                defaults={
                    "hierarchy_name": node_name,
                    "calculated_value": calculated_value,
                    "target_value": target_val,
                    "variance_to_target": variance_to_target,
                    "variance_percentage": variance_percentage,
                    "achievement_percentage": achievement_percentage,
                    "rag_status": rag_status,
                    "records_considered": records_considered,
                    "records_excluded": excluded_rows_count,
                    "calculation_status": calc_status,
                    "error_message": error_msg,
                    "lineage_info": diagnostics,
                }
            )

            # Audit Log
            batch_obj = None
            if batch_id:
                batch_obj = ImportBatch.objects.filter(batch_id=batch_id).first()

            KPICalculationAuditLog.objects.create(
                kpi=kpi,
                reporting_period=period,
                hierarchy_level=hierarchy_level.upper(),
                hierarchy_id=hierarchy_id,
                trigger_type=trigger_type,
                batch=batch_obj,
                status=calc_status,
                calculated_value=calculated_value,
                execution_time_ms=execution_time_ms,
                records_considered=records_considered,
                records_excluded=excluded_rows_count,
                diagnostics=diagnostics,
                executed_by=user if user and user.is_authenticated else None,
            )

            # 9. Sync to live KPIValue table for Management Cockpit and Slide View
            if hierarchy_level.upper() == "CIRCLE" and period:
                circle_obj = Circle.objects.filter(id=hierarchy_id).first()
                if circle_obj:
                    kpi_legacy, _ = KPI.objects.get_or_create(
                        code=kpi.code,
                        defaults={
                            "name": kpi.name,
                            "unit": kpi.unit or "Units",
                            "direction": kpi.direction or "HIGHER_BETTER",
                            "is_active": kpi.is_active,
                            "display_order": kpi.display_order,
                            "domain": kpi.domain or circle_obj.domains.first() or Domain.objects.first(),
                        }
                    )
                    if kpi.domain and kpi_legacy.domain_id != kpi.domain_id:
                        kpi_legacy.domain = kpi.domain
                        kpi_legacy.save(update_fields=["domain"])

                    if calculated_value is not None and calc_status == KPICalculationResult.CalculationStatus.SUCCESS:
                        KPIValue.objects.update_or_create(
                            kpi=kpi_legacy,
                            circle=circle_obj,
                            period=period,
                            defaults={
                                "actual_value": calculated_value,
                                "target_value": target_val,
                                "variance_to_target": variance_to_target,
                                "variance_percentage": variance_percentage,
                                "rag_status": rag_status if rag_status in ["GREEN", "AMBER", "RED"] else "GREEN",
                                "notes": f"Calculated from {kpi.source_dataset.name if kpi.source_dataset else 'Target vs Achievement Comparisons (Manual)'}",
                                "entered_by": user if user and user.is_authenticated else None,
                            }
                        )

        return {
            "result_id": res_obj.id,
            "kpi_id": kpi.id,
            "kpi_code": kpi.code,
            "kpi_name": kpi.name,
            "calculated_value": float(calculated_value) if calculated_value is not None else None,
            "target_value": float(target_val) if target_val is not None else None,
            "variance_to_target": float(variance_to_target) if variance_to_target is not None else None,
            "achievement_percentage": float(achievement_percentage) if achievement_percentage is not None else None,
            "rag_status": rag_status,
            "unit": kpi.unit,
            "visualization_type": kpi.visualization_type,
            "status": calc_status,
            "calculation_status": calc_status,
            "error_message": error_msg,
            "records_considered": records_considered,
            "records_excluded": excluded_rows_count,
            "refined_records_count": records_considered,
            "refined_records_preview": [r.raw_data for r in matched_rows[:50]],
            "funnel_breakdown": funnel_breakdown,
            "diagnostics": diagnostics,
            "calculated_at": res_obj.calculated_at.isoformat(),
        }

    @classmethod
    def get_refined_records(
        cls,
        kpi: KPIDefinition,
        period: ReportingPeriod,
        hierarchy_level: str,
        hierarchy_id: int,
        page: int = 1,
        page_size: int = 25,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Retrieves the exact refined dataset records for a KPI definition,
        hierarchy scope, and reporting period, with pagination and search.
        """
        allowed_circles = cls.resolve_hierarchy_descendant_circle_ids(hierarchy_level, hierarchy_id)
        node_name = cls.get_node_display_name(hierarchy_level, hierarchy_id)
        filters = list(kpi.filters.all())

        staged_rows_qs = ImportStagedRow.objects.none()
        if kpi.source_dataset:
            batch_filter = Q(template_version__template=kpi.source_dataset)
            if period:
                batch_filter &= (Q(reporting_period=period) | Q(reporting_period__isnull=True))

            completed_batches = list(
                ImportBatch.objects.filter(batch_filter, status=ImportBatch.Status.COMPLETED).order_by("-created_at")
            )
            batches = completed_batches or list(
                ImportBatch.objects.filter(batch_filter, status=ImportBatch.Status.VALIDATED).order_by("-created_at")
            )

            seen_scope: Set[Optional[int]] = set()
            active_batches: List[ImportBatch] = []
            for b in batches:
                b_circle_id: Optional[int] = getattr(b, "circle_id", None) or (b.circle.id if getattr(b, "circle", None) else None)
                if b_circle_id is not None:
                    if b_circle_id not in seen_scope:
                        seen_scope.add(b_circle_id)
                        active_batches.append(b)
                else:
                    active_batches.append(b)

            if active_batches:
                staged_rows_qs = ImportStagedRow.objects.filter(
                    batch__in=active_batches,
                    is_valid=True,
                ).select_related("batch")

        circle_lookup = cls._build_circle_lookup()
        matched_rows: List[ImportStagedRow] = []

        for row in staged_rows_qs:
            raw = row.raw_data
            circle_match = True

            if allowed_circles:
                row_circle_id = None
                if row.batch:
                    b_cid = getattr(row.batch, "circle_id", None) or (row.batch.circle.id if getattr(row.batch, "circle", None) else None)
                    if b_cid is not None:
                        row_circle_id = int(b_cid)
                if row_circle_id is None:
                    for k, v in raw.items():
                        if "circle" in k.lower() and v:
                            raw_v = str(v).strip().upper()
                            norm_v = cls._normalize_circle_token(raw_v)
                            if raw_v in circle_lookup:
                                row_circle_id = circle_lookup[raw_v]
                                break
                            elif norm_v in circle_lookup:
                                row_circle_id = circle_lookup[norm_v]
                                break
                if row_circle_id is not None:
                    if row_circle_id not in allowed_circles:
                        circle_match = False
                elif len(allowed_circles) < Circle.objects.filter(is_active=True).count():
                    circle_match = False

            if not circle_match:
                continue

            if period and row.batch:
                b_rpid = getattr(row.batch, "reporting_period_id", None) or (row.batch.reporting_period.id if getattr(row.batch, "reporting_period", None) else None)
                if b_rpid is not None and b_rpid != period.id:
                    continue

            if filters and not cls._apply_row_filters(raw, filters):
                continue

            matched_rows.append(row)

        if search:
            s_lower = search.strip().lower()
            matched_rows = [
                r for r in matched_rows
                if any(s_lower in str(val).lower() for val in r.raw_data.values() if val is not None)
            ]

        total_count = len(matched_rows)
        page_size = max(1, min(page_size, 100))
        page = max(1, page)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paged_rows = matched_rows[start_idx:end_idx]

        columns = []
        if kpi.source_dataset:
            active_version = kpi.source_dataset.versions.filter(is_active=True).first() or kpi.source_dataset.versions.order_by("-version_number").first()
            if active_version:
                columns = list(active_version.columns.values_list("name", flat=True))
        if not columns and paged_rows:
            columns = list(paged_rows[0].raw_data.keys())

        from apps.kpi.services.formula_calculation_service import KPIFormulaCalculationService
        enriched_records = KPIFormulaCalculationService.merge_calculated_columns_into_rows(paged_rows, kpi=kpi)
        if enriched_records:
            existing_cols_set = set(columns)
            for k in enriched_records[0].keys():
                if k not in existing_cols_set:
                    columns.append(k)
                    existing_cols_set.add(k)

        return {
            "total_records": total_count,
            "page": page,
            "page_size": page_size,
            "has_more": total_count > end_idx,
            "columns": columns,
            "records": enriched_records if enriched_records else [r.raw_data for r in paged_rows],
            "node_name": node_name,
            "period_name": period.name if period else "",
            "applied_filters": [
                {"field": f.field_name, "operator": f.operator, "value": f.value}
                for f in filters
            ],
        }

    @classmethod
    def execute_adhoc_logic(
        cls,
        dataset_id: int,
        hierarchy_level: Optional[str] = None,
        hierarchy_id: Optional[int] = None,
        period_id: Optional[int] = None,
        natural_language_rule: Optional[str] = None,
        logic_expression: Optional[str] = None,
        filters: Optional[List[Dict[str, Any]]] = None,
        parameters: Optional[List[Dict[str, Any]]] = None,
        group_by: Optional[List[str]] = None,
        presentation_config: Optional[Dict[str, Any]] = None,
        formula_expression: Optional[str] = None,
        calculation_type: Optional[str] = None,
        unit: str = "Units",
        user=None,
    ) -> Dict[str, Any]:
        """
        Executes ad-hoc or uncommitted logic against actual uploaded records.
        Supports natural language plain-English business rules, structured filters,
        inline aggregations, multi-column grouping, and color presentation configs.
        """
        template = UploadTemplate.objects.filter(id=dataset_id).first()
        if not template:
            raise ValidationError(f"Source dataset with ID {dataset_id} does not exist.")

        active_version = (
            template.versions.filter(is_active=True).first() or
            template.versions.order_by("-version_number").first()
        )
        if not active_version:
            raise ValidationError(f"Dataset '{template.name}' has no active version schema.")

        available_cols = list(active_version.columns.values_list("display_label", flat=True)) or list(active_version.columns.values_list("name", flat=True))
        node_name = cls.get_node_display_name(hierarchy_level, hierarchy_id) if hierarchy_level and hierarchy_id else "Dynamic User Scope"

        # 1. Parse natural language rule or logic expression
        parsed_filters = filters or []
        parsed_parameters = parameters or []
        parsed_group_by = group_by or []
        parsed_formula = formula_expression or ""
        parsed_calc_type = calculation_type or "SIMPLE_AGGREGATE"
        nl_summary = ""
        interpreted_expr = ""

        rule_text = (natural_language_rule or "").strip() or (logic_expression or "").strip()

        if rule_text:
            try:
                parsed_result = KPILogicParser.parse_logic_expression(
                    rule_text,
                    available_columns=available_cols,
                    existing_parameters=parameters,
                )
                parsed_filters = parsed_result.get("filters") or parsed_filters
                parsed_parameters = parsed_result.get("parameters") or parsed_parameters
                parsed_group_by = parsed_result.get("group_by") or parsed_group_by
                parsed_formula = parsed_result.get("formula_expression") or parsed_formula
                parsed_calc_type = parsed_result.get("calculation_type") or parsed_calc_type
                nl_summary = parsed_result.get("natural_language_summary") or ""
                interpreted_expr = parsed_result.get("interpreted_expression") or ""
            except Exception as e:
                return {
                    "success": False,
                    "is_valid": False,
                    "status": "ERROR",
                    "error": str(e),
                    "message": str(e),
                    "records_considered": 0,
                    "calculated_value": None,
                    "grouped_results": [],
                    "refined_records_preview": [],
                    "unit": unit,
                    "columns": available_cols,
                    "parsed_filters": [],
                    "parsed_parameters": [],
                    "group_by": [],
                    "rewritten_formula": "",
                    "node_name": node_name,
                    "period_name": "",
                    "dataset_name": template.name,
                    "natural_language_summary": "",
                    "interpreted_expression": "",
                    "presentation_config": presentation_config or {},
                }

        # 2. Syntax validation
        param_tokens = {p["name"] for p in parsed_parameters if "name" in p}
        if parsed_formula:
            is_valid, err_msg, _ = SafeFormulaEvaluator.validate_syntax(parsed_formula, allowed_variables=param_tokens)
            if not is_valid:
                return {
                    "success": False,
                    "is_valid": False,
                    "status": "ERROR",
                    "error": f"Formula syntax error: {err_msg}",
                    "message": f"Formula syntax error: {err_msg}",
                    "records_considered": 0,
                    "calculated_value": None,
                    "refined_records_preview": [],
                    "unit": unit,
                    "columns": available_cols,
                    "parsed_filters": parsed_filters,
                    "parsed_parameters": parsed_parameters,
                    "rewritten_formula": parsed_formula,
                    "node_name": node_name,
                    "period_name": "",
                    "dataset_name": template.name,
                }

        # 3. Resolve organization scope and period
        period = None
        if period_id:
            period = ReportingPeriod.objects.filter(id=period_id).first()
        if not period:
            period = ReportingPeriod.objects.filter(is_current=True).first() or ReportingPeriod.objects.first()

        allowed_circles = set()
        if hierarchy_level and hierarchy_id:
            allowed_circles = cls.resolve_hierarchy_descendant_circle_ids(hierarchy_level, hierarchy_id)
            node_name = cls.get_node_display_name(hierarchy_level, hierarchy_id)
        else:
            node_name = "Dynamic User Scope"

        # 4. Fetch Staged Rows from Uploads
        batch_filter = Q(template_version__template=template)
        if period:
            batch_filter &= (Q(reporting_period=period) | Q(reporting_period__isnull=True))

        completed_batches = list(
            ImportBatch.objects.filter(batch_filter, status=ImportBatch.Status.COMPLETED).order_by("-created_at")
        )
        batches = completed_batches or list(
            ImportBatch.objects.filter(batch_filter, status=ImportBatch.Status.VALIDATED).order_by("-created_at")
        )

        seen_scope: Set[Optional[int]] = set()
        active_batches: List[ImportBatch] = []
        for b in batches:
            b_circle_id: Optional[int] = getattr(b, "circle_id", None) or (b.circle.id if getattr(b, "circle", None) else None)
            if b_circle_id is not None:
                if b_circle_id not in seen_scope:
                    seen_scope.add(b_circle_id)
                    active_batches.append(b)
            else:
                active_batches.append(b)

        staged_rows_qs = ImportStagedRow.objects.none()
        if active_batches:
            staged_rows_qs = ImportStagedRow.objects.filter(
                batch__in=active_batches,
                is_valid=True,
            ).select_related("batch")

        all_staged = list(staged_rows_qs)
        circle_lookup = cls._build_circle_lookup()

        matched_rows: List[ImportStagedRow] = []
        for row in all_staged:
            raw = row.raw_data
            circle_match = True

            if allowed_circles:
                row_circle_id = None
                if row.batch:
                    b_cid = getattr(row.batch, "circle_id", None) or (row.batch.circle.id if getattr(row.batch, "circle", None) else None)
                    if b_cid is not None:
                        row_circle_id = int(b_cid)
                if row_circle_id is None:
                    for k, v in raw.items():
                        if "circle" in k.lower() and v:
                            raw_v = str(v).strip().upper()
                            norm_v = cls._normalize_circle_token(raw_v)
                            if raw_v in circle_lookup:
                                row_circle_id = circle_lookup[raw_v]
                                break
                            elif norm_v in circle_lookup:
                                row_circle_id = circle_lookup[norm_v]
                                break
                if row_circle_id is not None:
                    if row_circle_id not in allowed_circles:
                        circle_match = False
                elif len(allowed_circles) < Circle.objects.filter(is_active=True).count():
                    circle_match = False

            if not circle_match:
                continue

            if period and row.batch:
                b_rpid = getattr(row.batch, "reporting_period_id", None) or (row.batch.reporting_period.id if getattr(row.batch, "reporting_period", None) else None)
                if b_rpid is not None and b_rpid != period.id:
                    continue

            if parsed_filters and not cls._apply_row_filters(raw, parsed_filters):
                continue

            matched_rows.append(row)

        records_considered = len(matched_rows)

        # 5. Extract Parameters & Aggregations
        param_context: Dict[str, Decimal] = {}
        missing_columns: List[str] = []

        for p in parsed_parameters:
            col_target = p.get("source_column", "").strip()
            col_target_lower = col_target.lower()
            vals = []
            col_found = False

            for r in matched_rows:
                raw = r.raw_data
                val = raw.get(col_target)
                if val is None:
                    for k, v in raw.items():
                        if k.strip().lower() == col_target_lower:
                            val = v
                            col_found = True
                            break
                else:
                    col_found = True
                vals.append(val)

            if matched_rows and not col_found:
                missing_columns.append(col_target)

            agg_val = cls._compute_aggregation(vals, p.get("aggregation", "SUM"))
            if agg_val is None:
                agg_val = Decimal(str(p.get("default_value", 0) or 0))
            param_context[p.get("name", "val")] = agg_val

        # 6. Grouped Calculations if group_by fields are specified
        grouped_results: List[Dict[str, Any]] = []
        if parsed_group_by and matched_rows:
            primary_grp_col = parsed_group_by[0]
            grouped_map: Dict[str, List[ImportStagedRow]] = {}
            for r in matched_rows:
                g_val = r.raw_data.get(primary_grp_col)
                if g_val is None:
                    for k, v in r.raw_data.items():
                        if k.strip().lower() == primary_grp_col.strip().lower():
                            g_val = v
                            break
                g_key = str(g_val or "Unknown").strip()
                if g_key not in grouped_map:
                    grouped_map[g_key] = []
                grouped_map[g_key].append(r)

            for g_key, g_rows in grouped_map.items():
                g_param_context: Dict[str, Decimal] = {}
                for p in parsed_parameters:
                    col_t = p.get("source_column", "").strip()
                    g_vals = []
                    for gr in g_rows:
                        val = gr.raw_data.get(col_t)
                        if val is None:
                            for k, v in gr.raw_data.items():
                                if k.strip().lower() == col_t.lower():
                                    val = v
                                    break
                        g_vals.append(val)
                    g_agg = cls._compute_aggregation(g_vals, p.get("aggregation", "SUM"))
                    if g_agg is None:
                        g_agg = Decimal(str(p.get("default_value", 0) or 0))
                    g_param_context[p.get("name", "val")] = g_agg

                g_calc_val: Optional[Decimal] = None
                try:
                    if parsed_calc_type == "SIMPLE_AGGREGATE" and not parsed_formula:
                        if parsed_parameters:
                            g_calc_val = g_param_context.get(parsed_parameters[0]["name"])
                        else:
                            g_calc_val = Decimal(str(len(g_rows)))
                    elif parsed_formula:
                        g_calc_val = SafeFormulaEvaluator.evaluate(parsed_formula, g_param_context)
                    else:
                        g_calc_val = Decimal(str(len(g_rows)))
                except Exception:
                    g_calc_val = None

                if g_calc_val is not None:
                    g_calc_val = round(g_calc_val, 4)

                grouped_results.append({
                    "group_key": g_key,
                    "group_field": primary_grp_col,
                    "records_count": len(g_rows),
                    "calculated_value": float(g_calc_val) if g_calc_val is not None else None,
                    "metrics": {k: float(v) for k, v in g_param_context.items()},
                })

        # 7. Evaluate Overall Result
        calculated_value: Optional[Decimal] = None
        calc_status = "SUCCESS"
        error_msg = ""

        if missing_columns:
            calc_status = "ERROR"
            error_msg = f"Required uploaded field(s) '{', '.join(missing_columns)}' not found in uploaded dataset '{template.name}'."
        elif records_considered == 0:
            calc_status = "NO_DATA"
            error_msg = f"No uploaded records found for dataset '{template.name}' matching {node_name} and period '{period.name if period else 'All'}'."
            calculated_value = Decimal("0")
        else:
            try:
                if parsed_calc_type == "SIMPLE_AGGREGATE" and not parsed_formula:
                    if parsed_parameters:
                        calculated_value = param_context.get(parsed_parameters[0]["name"])
                    else:
                        calculated_value = Decimal(str(records_considered))
                elif parsed_formula:
                    calculated_value = SafeFormulaEvaluator.evaluate(parsed_formula, param_context)
                else:
                    calculated_value = Decimal(str(records_considered))
            except DivisionByZeroError as div_err:
                calc_status = "DIV_ZERO"
                error_msg = str(div_err)
                calculated_value = None
            except Exception as ex:
                calc_status = "ERROR"
                error_msg = str(ex)
                calculated_value = None

        if calculated_value is not None:
            calculated_value = round(calculated_value, 4)

        return {
            "success": calc_status in ["SUCCESS", "NO_DATA"],
            "is_valid": calc_status in ["SUCCESS", "NO_DATA"],
            "status": calc_status,
            "error": error_msg or None,
            "message": error_msg or None,
            "records_considered": records_considered,
            "calculated_value": float(calculated_value) if calculated_value is not None else None,
            "unit": unit,
            "columns": available_cols,
            "refined_records_preview": [r.raw_data for r in matched_rows[:25]],
            "parsed_filters": parsed_filters,
            "parsed_parameters": parsed_parameters,
            "group_by": parsed_group_by,
            "grouped_results": grouped_results,
            "rewritten_formula": parsed_formula,
            "natural_language_summary": nl_summary,
            "interpreted_expression": interpreted_expr,
            "presentation_config": presentation_config or {},
            "node_name": node_name,
            "period_name": period.name if period else "",
            "dataset_name": template.name,
        }
