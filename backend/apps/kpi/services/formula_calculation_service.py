"""
Authoritative Formula Calculation Service for MAPAR-v2 KPI Engine.
Executes user-defined mathematical formulas on uploaded daily records,
evaluates input/output units and numeric constants, persists non-destructive
KPICalculatedOutput rows, and integrates with KPI target comparisons.
"""

import re
import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Dict, Any, List, Optional, Tuple, Set

from django.db import transaction
from django.core.exceptions import ValidationError

from apps.imports.models import UploadTemplate, ImportBatch, ImportStagedRow
from apps.kpi.models.kpi_definition import KPIDefinition
from apps.kpi.models.calculated_output import KPICalculatedOutput
from apps.kpi.services.formula_evaluator import (
    SafeFormulaEvaluator,
    DivisionByZeroError,
    SafeFormulaError,
)


class KPIFormulaCalculationService:
    @staticmethod
    def _sanitize_name(val: Any) -> str:
        if not val:
            return ""
        return str(val).strip().lower().replace("_", " ").replace("-", " ")

    @classmethod
    def get_template_column_names(cls, template: UploadTemplate) -> Set[str]:
        """Returns set of all display labels and raw machine names for a template."""
        names = set()
        for v in template.versions.all():
            for c in v.columns.all():
                names.add(c.name.strip())
                names.add(c.display_label.strip())
        return names

    @classmethod
    def validate_formula_configuration(
        cls,
        formula_config: Dict[str, Any],
        template: Optional[UploadTemplate] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validates formula expression syntax, referenced columns against template schema,
        constants, and output configuration.
        """
        expression = (formula_config.get("formula_expression") or "").strip()
        if not expression:
            return False, "Formula expression cannot be empty."

        # Template check
        if template:
            valid_col_names = cls.get_template_column_names(template)
            clean_valid = {cls._sanitize_name(n) for n in valid_col_names}

            # Check specified input columns
            input_cols = formula_config.get("input_columns") or []
            if isinstance(input_cols, str):
                input_cols = [input_cols]
            single_input = formula_config.get("input_column")
            if single_input and single_input not in input_cols:
                input_cols.append(single_input)

            for col in input_cols:
                if col and cls._sanitize_name(col) not in clean_valid:
                    return False, f"Input column '{col}' does not exist in template '{template.name}'."

        # Constants check
        constants = formula_config.get("constants") or {}
        allowed_vars = set(constants.keys())
        if template:
            allowed_vars.update(cls.get_template_column_names(template))
        # Add input columns
        for c in (formula_config.get("input_columns") or []):
            allowed_vars.add(c)
        if formula_config.get("input_column"):
            allowed_vars.add(formula_config.get("input_column"))

        # Preprocess brackets if any
        cleaned_expr, token_map = SafeFormulaEvaluator.preprocess_expression(expression)
        effective_allowed = set(allowed_vars)
        for tok, orig in token_map.items():
            effective_allowed.add(tok)
            effective_allowed.add(orig)

        is_valid, err, detected = SafeFormulaEvaluator.validate_syntax(
            expression,
            allowed_variables=effective_allowed if allowed_vars else None,
        )
        if not is_valid:
            return False, err or "Invalid formula syntax."

        # Verify output column name
        output_col = (formula_config.get("output_column_name") or "").strip()
        if not output_col:
            return False, "Output column name cannot be empty."

        return True, None

    @classmethod
    def validate_formula(
        cls,
        formula: str,
        available_columns: Optional[List[str]] = None,
        constants: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Convenience validation method for formula, columns, and constants."""
        constants = constants or {}
        allowed_vars = set(constants.keys())
        if available_columns:
            allowed_vars.update(available_columns)

        cleaned_expr, token_map = SafeFormulaEvaluator.preprocess_expression(formula)
        effective_allowed = set(allowed_vars)
        for tok, orig in token_map.items():
            effective_allowed.add(tok)
            effective_allowed.add(orig)

        is_valid, err, detected = SafeFormulaEvaluator.validate_syntax(
            formula,
            allowed_variables=effective_allowed if allowed_vars else None,
        )

        detected_list = []
        for d in detected:
            detected_list.append(token_map.get(d, d))

        ref_cols = [v for v in detected_list if v not in constants]

        return {
            "is_valid": is_valid,
            "error": err,
            "detected_variables": sorted(list(detected_list)),
            "referenced_columns": sorted(list(ref_cols)),
        }

    @classmethod
    def evaluate_row(
        cls,
        row: ImportStagedRow,
        formula: str,
        input_column: str = "",
        constants: Optional[Dict[str, Any]] = None,
        decimal_precision: int = 2,
    ) -> Tuple[Optional[Decimal], str, Optional[str]]:
        formula_config = {
            "formula_expression": formula,
            "input_column": input_column,
            "constants": constants or {},
            "decimal_precision": decimal_precision,
        }
        val, status_code, err = cls.evaluate_row_formula(
            raw_row_data=row.raw_data or {},
            formula_config=formula_config,
            constants=constants or {},
        )
        return val, status_code, err if err else None

    @classmethod
    def process_batch(
        cls,
        kpi: KPIDefinition,
        batch: ImportBatch,
        formula_config: Dict[str, Any],
        rule_id: str = "rule_1",
        formula_name: str = "",
        user=None,
    ) -> Dict[str, Any]:
        return cls.execute_and_persist_formula_outputs(
            kpi=kpi,
            batch=batch,
            formula_config=formula_config,
            rule_id=rule_id,
            formula_name=formula_name,
            user=user,
        )

    @classmethod
    def evaluate_row_formula(
        cls,
        raw_row_data: Dict[str, Any],
        formula_config: Dict[str, Any],
        constants: Dict[str, Any],
        template_columns: Optional[Set[str]] = None,
    ) -> Tuple[Optional[Decimal], str, str]:
        """
        Evaluates formula for a single row's dictionary.
        Returns: (calculated_value, status, error_message)
        """
        expression = (formula_config.get("formula_expression") or "").strip()
        input_col = (formula_config.get("input_column") or "").strip()
        output_col = (formula_config.get("output_column_name") or "").strip()
        precision = int(formula_config.get("decimal_precision", 2))

        # 1. Check if column exists in row data
        row_context: Dict[str, Any] = {}
        # Populate constants
        for c_k, c_v in constants.items():
            try:
                row_context[c_k] = Decimal(str(c_v))
            except Exception:
                row_context[c_k] = c_v

        # Extract values for all row keys
        clean_row = {}
        for k, v in raw_row_data.items():
            clean_row[cls._sanitize_name(k)] = v
            clean_row[k.strip().lower()] = v
            clean_row[k.strip()] = v

        # Validate input column is present
        target_val = None
        col_found = False
        if input_col:
            if input_col in raw_row_data:
                target_val = raw_row_data[input_col]
                col_found = True
            else:
                s_name = cls._sanitize_name(input_col)
                if s_name in clean_row:
                    target_val = clean_row[s_name]
                    col_found = True
                elif input_col.strip().lower() in clean_row:
                    target_val = clean_row[input_col.strip().lower()]
                    col_found = True

            if not col_found:
                return None, KPICalculatedOutput.Status.MISSING_COLUMN, f"Column '{input_col}' not found in uploaded record."

            # Check missing or blank value - DO NOT silently convert to zero
            if target_val is None or str(target_val).strip() == "":
                return None, KPICalculatedOutput.Status.PENDING_DATA, f"Required input column '{input_col}' is missing or blank."

            try:
                dec_val = Decimal(str(target_val).replace("%", "").strip())
            except (InvalidOperation, ValueError):
                return None, KPICalculatedOutput.Status.INVALID_INPUT, f"Input value '{target_val}' for column '{input_col}' is not a valid number."

            # Check impossible business constraints (e.g. negative downtime or downtime > total period)
            # Check if total period constant exists (e.g., 1440 or Total_Time)
            total_limit = None
            for const_name in ["Total_Time", "total_time", "total_daily_time", "Total Time", "1440"]:
                if const_name in row_context:
                    total_limit = row_context[const_name]
                    break

            if "downtime" in input_col.lower() or "outage" in input_col.lower():
                if dec_val < Decimal("0"):
                    return None, KPICalculatedOutput.Status.INVALID_INPUT, f"Impossible value: '{input_col}' cannot be negative ({dec_val})."
                if total_limit is not None and dec_val > Decimal(str(total_limit)):
                    return None, KPICalculatedOutput.Status.INVALID_INPUT, f"Impossible value: '{input_col}' ({dec_val}) exceeds configured maximum total period ({total_limit})."

            row_context[input_col] = dec_val
            # Also provide clean identifier
            safe_identifier = re.sub(r'[^a-zA-Z0-9_]', '_', input_col).strip('_')
            row_context[safe_identifier] = dec_val

        # Also supply any other numeric fields from row into row_context
        for k, v in raw_row_data.items():
            if v is not None and str(v).strip() != "":
                try:
                    dec = Decimal(str(v).replace("%", "").strip())
                    row_context[k] = dec
                    safe_k = re.sub(r'[^a-zA-Z0-9_]', '_', k).strip('_')
                    row_context[safe_k] = dec
                except (InvalidOperation, ValueError):
                    pass

        # 2. Evaluate Expression Safely
        try:
            res_dec = SafeFormulaEvaluator.evaluate(expression, row_context)
            prec_str = "1." + ("0" * precision) if precision > 0 else "1"
            quantized = res_dec.quantize(Decimal(prec_str), rounding=ROUND_HALF_UP)
            return quantized, KPICalculatedOutput.Status.SUCCESS, ""
        except DivisionByZeroError as ex:
            return None, KPICalculatedOutput.Status.DIV_ZERO, str(ex)
        except SafeFormulaError as ex:
            return None, KPICalculatedOutput.Status.ERROR, str(ex)
        except Exception as ex:
            return None, KPICalculatedOutput.Status.ERROR, f"Calculation error: {str(ex)}"

    @classmethod
    def execute_and_persist_formula_outputs(
        cls,
        kpi: KPIDefinition,
        batch: ImportBatch,
        formula_config: Dict[str, Any],
        rule_id: str = "rule_1",
        formula_name: str = "",
        user=None,
    ) -> Dict[str, Any]:
        """
        Executes formula across all staged rows in a batch, saving non-destructive
        KPICalculatedOutput records. Prevents duplicates on reprocess.
        """
        template = batch.template_version.template if batch.template_version else None
        staged_rows = list(ImportStagedRow.objects.filter(batch=batch, is_valid=True).order_by("row_index"))
        if not staged_rows:
            return {
                "success": True,
                "batch_id": batch.batch_id,
                "total_rows": 0,
                "calculated_rows": 0,
                "average_value": None,
                "status": "NO_ROWS",
            }

        input_col = (formula_config.get("input_column") or "").strip()
        output_col = (formula_config.get("output_column_name") or "Calculated Output").strip()
        input_unit = (formula_config.get("input_unit") or "").strip()
        output_unit = (formula_config.get("output_unit") or "%").strip()
        expression = (formula_config.get("formula_expression") or "").strip()
        precision = int(formula_config.get("decimal_precision", 2))
        constants = formula_config.get("constants") or {}

        # Resolve reporting date for daily processing
        rep_date = None
        if batch.reporting_period and batch.reporting_period.start_date:
            rep_date = batch.reporting_period.start_date
        else:
            rep_date = batch.created_at.date()

        circle_obj = batch.circle

        calculated_objects: List[KPICalculatedOutput] = []
        valid_calculated_values: List[Decimal] = []
        status_counts = {
            "SUCCESS": 0,
            "PENDING_DATA": 0,
            "INVALID_INPUT": 0,
            "MISSING_COLUMN": 0,
            "DIV_ZERO": 0,
            "ERROR": 0,
        }

        with transaction.atomic():
            # Delete any previous calculated outputs for this batch, kpi, and output column
            KPICalculatedOutput.objects.filter(
                batch=batch,
                kpi=kpi,
                output_column_name=output_col,
            ).delete()

            for row in staged_rows:
                raw_data = row.raw_data or {}
                calc_val, row_status, err_msg = cls.evaluate_row_formula(
                    raw_row_data=raw_data,
                    formula_config=formula_config,
                    constants=constants,
                )

                status_counts[row_status] = status_counts.get(row_status, 0) + 1
                if row_status == KPICalculatedOutput.Status.SUCCESS and calc_val is not None:
                    valid_calculated_values.append(calc_val)

                input_snap = {}
                if input_col and input_col in raw_data:
                    input_snap[input_col] = raw_data[input_col]

                # Row-level date if present
                row_date = rep_date
                for d_key in ["date", "reporting_date", "day"]:
                    for r_k, r_v in raw_data.items():
                        if d_key in r_k.lower() and r_v:
                            try:
                                if isinstance(r_v, str):
                                    row_date = datetime.date.fromisoformat(r_v.split("T")[0].split(" ")[0])
                                elif isinstance(r_v, (datetime.date, datetime.datetime)):
                                    row_date = r_v.date() if isinstance(r_v, datetime.datetime) else r_v
                            except Exception:
                                pass
                            break

                calc_obj = KPICalculatedOutput(
                    kpi=kpi,
                    rule_id=rule_id,
                    formula_name=formula_name or formula_config.get("formula_name") or kpi.name,
                    batch=batch,
                    staged_row=row,
                    row_index=row.row_index,
                    template=template,
                    reporting_period=batch.reporting_period,
                    reporting_date=row_date,
                    circle=circle_obj,
                    input_column=input_col,
                    input_unit=input_unit,
                    input_values=input_snap,
                    formula_expression=expression,
                    constants_applied=constants,
                    output_column_name=output_col,
                    output_unit=output_unit,
                    calculated_value=calc_val,
                    decimal_precision=precision,
                    status=row_status,
                    error_message=err_msg,
                )
                calculated_objects.append(calc_obj)

            KPICalculatedOutput.objects.bulk_create(calculated_objects)

        # Compute summary metric
        summary_val: Optional[Decimal] = None
        if valid_calculated_values:
            # Use configured aggregation (default AVG for daily percentages / uptime)
            agg_method = (formula_config.get("aggregation") or "AVG").upper()
            if agg_method == "SUM":
                summary_val = sum(valid_calculated_values, Decimal("0"))
            elif agg_method == "MIN":
                summary_val = min(valid_calculated_values)
            elif agg_method == "MAX":
                summary_val = max(valid_calculated_values)
            else:  # AVG
                summary_val = sum(valid_calculated_values, Decimal("0")) / Decimal(str(len(valid_calculated_values)))
            prec_str = "1." + ("0" * precision) if precision > 0 else "1"
            summary_val = summary_val.quantize(Decimal(prec_str), rounding=ROUND_HALF_UP)

        overall_status = "SUCCESS"
        if status_counts["SUCCESS"] == 0:
            if status_counts["MISSING_COLUMN"] > 0:
                overall_status = "MISSING_COLUMN"
            elif status_counts["INVALID_INPUT"] > 0:
                overall_status = "INVALID_INPUT"
            elif status_counts["PENDING_DATA"] > 0:
                overall_status = "PENDING_DATA"
            elif status_counts["DIV_ZERO"] > 0:
                overall_status = "DIV_ZERO"
            else:
                overall_status = "ERROR"

        return {
            "success": True,
            "kpi_id": kpi.id,
            "batch_id": batch.batch_id,
            "output_column_name": output_col,
            "output_unit": output_unit,
            "total_rows": len(staged_rows),
            "calculated_rows": len(valid_calculated_values),
            "calculated_value": summary_val,
            "status_counts": status_counts,
            "overall_status": overall_status,
        }

    @classmethod
    def merge_calculated_columns_into_rows(
        cls,
        staged_rows: List[ImportStagedRow],
        kpi: Optional[KPIDefinition] = None,
    ) -> List[Dict[str, Any]]:
        """
        Enriches staged rows with their logical calculated output columns
        without mutating the underlying JSONField in database.
        """
        if not staged_rows:
            return []

        row_ids = [r.id for r in staged_rows]
        calc_qs = KPICalculatedOutput.objects.filter(staged_row_id__in=row_ids)
        if kpi:
            calc_qs = calc_qs.filter(kpi=kpi)

        calc_map: Dict[int, Dict[str, Any]] = {}
        for c in calc_qs:
            sr_id = c.staged_row_id
            if sr_id not in calc_map:
                calc_map[sr_id] = {}
            col_key = f"{c.output_column_name} ({c.output_unit})" if c.output_unit and c.output_unit != "Units" else c.output_column_name
            calc_map[sr_id][col_key] = float(c.calculated_value) if c.calculated_value is not None else None
            calc_map[sr_id][c.output_column_name] = float(c.calculated_value) if c.calculated_value is not None else None

        enriched = []
        for r in staged_rows:
            base = dict(r.raw_data or {})
            if r.id in calc_map:
                base.update(calc_map[r.id])
            enriched.append(base)
        return enriched
