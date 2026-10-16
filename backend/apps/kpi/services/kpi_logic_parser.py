"""
Universal KPI Logic Parser & Transpiler for MAPAR-v2.
Allows users to write readable, human-friendly business logic expressions
with bracket field notation [Field], multi-condition filters (AND/OR),
inline aggregations (SUM([Field]), COUNT(), AVG([Field]), etc.),
and plain English natural-language business rules.
Safely transpiles human expressions and natural-language rules into validated
AST formulas and KPIFilter/KPIParameter objects.
"""

import re
from typing import Dict, Any, List, Optional, Tuple, Set


class KPILogicParseError(Exception):
    pass


class KPILogicParser:
    AGGREGATION_REGEX = re.compile(
        r'\b(SUM|AVG|MIN|MAX|COUNT_DISTINCT|COUNT)\s*\(\s*(?:\[([^\]]+)\]|([a-zA-Z0-9_]+)|\*|filtered records)?\s*\)',
        re.IGNORECASE
    )
    BRACKET_FIELD_REGEX = re.compile(r'\[([^\]]+)\]')

    OPERATOR_MAP = {
        "=": "EQUALS",
        "==": "EQUALS",
        "!=": "NOT_EQUALS",
        "<>": "NOT_EQUALS",
        ">=": "GREATER_EQUAL",
        "<=": "LESS_EQUAL",
        ">": "GREATER_THAN",
        "<": "LESS_THAN",
        "CONTAINS": "CONTAINS",
        "STARTS_WITH": "STARTS_WITH",
        "ENDS_WITH": "ENDS_WITH",
        "IN": "IN",
        "IS EMPTY": "IS_EMPTY",
        "IS NOT EMPTY": "IS_NOT_EMPTY",
    }

    @classmethod
    def _sanitize_param_token(cls, col_name: str, agg: str) -> str:
        clean = re.sub(r'[^a-zA-Z0-9_]', '_', col_name.strip().lower()).strip('_')
        if not clean:
            clean = "col"
        return f"p_{clean}_{agg.lower()}"

    @classmethod
    def _resolve_column_name(cls, col: str, available_columns: Optional[List[str]]) -> str:
        """
        Matches column against available dataset columns case-insensitively,
        with normalization and flexible alias handling.
        """
        if not available_columns:
            return col.strip()

        col_clean = col.strip().lower()

        # 1. Exact case-insensitive match
        for c in available_columns:
            if c.strip().lower() == col_clean:
                return c

        # 2. Normalized alphanumeric match
        t_clean = re.sub(r'[^a-zA-Z0-9]', '', col_clean)
        for c in available_columns:
            c_clean = re.sub(r'[^a-zA-Z0-9]', '', c.strip().lower())
            if c_clean == t_clean:
                return c

        # 3. Substring / Token match
        for c in available_columns:
            c_clean = re.sub(r'[^a-zA-Z0-9]', '', c.strip().lower())
            if c_clean in t_clean or t_clean in c_clean:
                return c

        # 4. Domain-specific aliases
        if "site" in t_clean:
            for c in available_columns:
                if "site id" in c.lower() or "site_id" in c.lower() or "site name" in c.lower():
                    return c
        if "outage" in t_clean:
            for c in available_columns:
                if "outage" in c.lower():
                    return c
        if "uptime" in t_clean:
            for c in available_columns:
                if "uptime" in c.lower():
                    return c
        if "circle" in t_clean:
            for c in available_columns:
                if "circle" in c.lower():
                    return c

        raise KPILogicParseError(
            f"Field '[{col.strip()}]' does not exist in the selected dataset schema. "
            f"Available fields: {', '.join(sorted(available_columns)) if available_columns else 'None'}"
        )

    @classmethod
    def is_natural_language(cls, text: str) -> bool:
        """Determines whether the input text is a plain English business rule."""
        if not text:
            return False
        raw = text.strip()
        # If bracket notation [Field] is used with FILTER ... CALCULATE, it's MAPAR expression syntax
        if "[" in raw and "]" in raw and (re.search(r'\bFILTER\s+(?:records\s+)?WHERE\b', raw, re.IGNORECASE) or re.search(r'\bCALCULATE\s*:', raw, re.IGNORECASE)):
            return False

        # Natural language indicators
        nl_markers = [
            r'\bfrom\s+(?:the\s+)?(?:selected\s+)?(?:uploaded\s+)?dataset\b',
            r'\bconsider\s+only\s+records\s+where\b',
            r'\bgroup\s+(?:the\s+matching\s+records\s+)?by\b',
            r'\bcount\s+(?:the\s+)?matching\b',
            r'\bcalculate\s+(?:the\s+)?total\b',
            r'\bcalculate\s+(?:the\s+)?average\b',
            r'\bfor\s+each\s+[a-zA-Z0-9_\s]+\b',
            r'\bwhere\s+[a-zA-Z0-9_\s]+\s+is\s+[a-zA-Z0-9_\s]+\b',
        ]
        return any(re.search(marker, raw, re.IGNORECASE) for marker in nl_markers)

    @classmethod
    def parse_natural_language_rule(
        cls,
        text: str = "",
        available_columns: Optional[List[str]] = None,
        existing_parameters: Optional[List[Dict[str, Any]]] = None,
        nl_rule: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Translates a plain-English natural language business rule into structured filters,
        groupings, parameters, and formula.
        Example:
        'From the selected uploaded dataset, consider only records where Site On Air Status is Active
         and O&M Status is Open. Group the matching records by Circle Name.
         Count the matching sites and calculate the total outage minutes for each circle.'
        """
        raw = (nl_rule if nl_rule is not None else text).strip()
        parsed_filters: List[Dict[str, Any]] = []
        group_by_fields: List[str] = []
        parameters_dict: Dict[str, Dict[str, Any]] = {}
        referenced_fields: Set[str] = set()

        if existing_parameters:
            for p in existing_parameters:
                p_name = p.get("name")
                if p_name:
                    parameters_dict[p_name] = p

        # 1. Extract Filter Conditions (Where Clause)
        where_match = re.search(
            r'(?:where|consider\s+only\s+records\s+where|filter\s+(?:records\s+)?where|only\s+include\s+records\s+where)\s+(.*?)(?=\.|\band\s+group\b|\bgroup\s+(?:the\s+matching\s+records\s+)?by\b|\bcount\b|\bcalculate\b|\Z)',
            raw,
            re.IGNORECASE
        )
        if where_match:
            where_text = where_match.group(1).strip()
            # Split by AND / OR / commas
            cond_tokens = re.split(r'\b(AND|OR)\b|,', where_text, flags=re.IGNORECASE)
            current_conj = "AND"

            for tok in cond_tokens:
                if not tok:
                    continue
                seg = tok.strip()
                if not seg:
                    continue
                if seg.upper() in ["AND", "OR"]:
                    current_conj = seg.upper()
                    continue

                # Parse single condition e.g. "Site On Air Status is Active", "Outage min > 30"
                m_cond = re.match(
                    r'^\s*(?:\[([^\]]+)\]|([a-zA-Z0-9_\s/&-]+?))\s+(is\s+not|does\s+not\s+equal|is\s+not\s+empty|is\s+empty|is\s+in|is|equals|equal\s+to|contains|starts\s+with|ends\s+with|greater\s+than\s+or\s+equal\s+to|at\s+least|less\s+than\s+or\s+equal\s+to|at\s+most|greater\s+than|more\s+than|above|less\s+than|fewer\s+than|below|>=|<=|!=|<>|==|>|<|=)\s*(.*)',
                    seg,
                    re.IGNORECASE
                )
                if m_cond:
                    f_name_raw = m_cond.group(1) or m_cond.group(2)
                    op_raw = m_cond.group(3).strip().lower()
                    val_raw = m_cond.group(4).strip() if m_cond.group(4) else ""

                    # Clean value quotes
                    if (val_raw.startswith('"') and val_raw.endswith('"')) or (val_raw.startswith("'") and val_raw.endswith("'")):
                        val_raw = val_raw[1:-1]

                    # Map operator
                    op_mapped = "EQUALS"
                    if op_raw in ["is not", "does not equal", "!=", "<>"]:
                        op_mapped = "NOT_EQUALS"
                    elif op_raw in [">=", "greater than or equal to", "at least"]:
                        op_mapped = "GREATER_EQUAL"
                    elif op_raw in ["<=", "less than or equal to", "at most"]:
                        op_mapped = "LESS_EQUAL"
                    elif op_raw in [">", "greater than", "more than", "above"]:
                        op_mapped = "GREATER_THAN"
                    elif op_raw in ["<", "less than", "fewer than", "below"]:
                        op_mapped = "LESS_THAN"
                    elif op_raw in ["contains"]:
                        op_mapped = "CONTAINS"
                    elif op_raw in ["starts with"]:
                        op_mapped = "STARTS_WITH"
                    elif op_raw in ["ends with"]:
                        op_mapped = "ENDS_WITH"
                    elif op_raw in ["is empty"]:
                        op_mapped = "IS_EMPTY"
                    elif op_raw in ["is not empty"]:
                        op_mapped = "IS_NOT_EMPTY"
                    elif op_raw in ["is in", "in"]:
                        op_mapped = "IN"

                    resolved_col = cls._resolve_column_name(f_name_raw, available_columns)
                    referenced_fields.add(resolved_col)

                    parsed_filters.append({
                        "field_name": resolved_col,
                        "operator": op_mapped,
                        "value": val_raw,
                        "conjunction": current_conj,
                    })

        # 2. Extract Group By
        group_match = re.search(
            r'(?:group\s+(?:the\s+matching\s+records\s+)?by|grouped\s+by)\s+([^.]+?)(?=\.|\band\s+count\b|\band\s+calculate\b|\bcount\b|\bcalculate\b|\Z)',
            raw,
            re.IGNORECASE
        )
        if group_match:
            group_text = group_match.group(1).strip()
            # Split multiple grouping fields
            g_tokens = re.split(r'\band\b|,', group_text, flags=re.IGNORECASE)
            for gt in g_tokens:
                gt_clean = gt.strip()
                if gt_clean:
                    resolved_grp = cls._resolve_column_name(gt_clean, available_columns)
                    referenced_fields.add(resolved_grp)
                    if resolved_grp not in group_by_fields:
                        group_by_fields.append(resolved_grp)

        # 3. Extract Count Metric
        count_match = re.search(
            r'\bcount\s+(?:the\s+)?(?:matching\s+)?([a-zA-Z0-9_\s/&-]+?)(?=\.|\band\s+calculate\b|\bfor\s+each\b|\Z)',
            raw,
            re.IGNORECASE
        )
        if count_match:
            cnt_target = count_match.group(1).strip()
            if cnt_target.lower() not in ["records", "items", "matching records", ""]:
                resolved_cnt = cls._resolve_column_name(cnt_target, available_columns)
                referenced_fields.add(resolved_cnt)
                token = cls._sanitize_param_token(resolved_cnt, "count")
                parameters_dict[token] = {
                    "name": token,
                    "label": f"Count of {resolved_cnt}",
                    "source_column": resolved_cnt,
                    "aggregation": "COUNT",
                }
            else:
                token = "p_records_count"
                fallback_col = available_columns[0] if available_columns else "id"
                parameters_dict[token] = {
                    "name": token,
                    "label": "Matching Records Count",
                    "source_column": fallback_col,
                    "aggregation": "COUNT",
                }

        # 4. Extract Aggregation / Calculate Metrics
        calc_matches = re.finditer(
            r'(?:calculate\s+(?:the\s+)?|find\s+(?:the\s+)?|get\s+(?:the\s+)?)(total|sum|average|mean|minimum|min|maximum|max|count)\s+([a-zA-Z0-9_\s/&-]+?)(?=\.|\band\s+calculate\b|\bfor\s+each\b|\band\s+count\b|\Z)',
            raw,
            re.IGNORECASE
        )
        calc_tokens: List[str] = []
        for cm in calc_matches:
            agg_word = cm.group(1).strip().lower()
            field_word = cm.group(2).strip()

            agg_type = "SUM"
            if agg_word in ["average", "mean"]:
                agg_type = "AVG"
            elif agg_word in ["minimum", "min"]:
                agg_type = "MIN"
            elif agg_word in ["maximum", "max"]:
                agg_type = "MAX"
            elif agg_word == "count":
                agg_type = "COUNT"

            resolved_calc_col = cls._resolve_column_name(field_word, available_columns)
            referenced_fields.add(resolved_calc_col)
            token = cls._sanitize_param_token(resolved_calc_col, agg_type)
            parameters_dict[token] = {
                "name": token,
                "label": f"{agg_type.capitalize()} of {resolved_calc_col}",
                "source_column": resolved_calc_col,
                "aggregation": agg_type,
            }
            calc_tokens.append(token)

        # Build formula expression
        final_params = list(parameters_dict.values())
        if calc_tokens:
            formula_expr = calc_tokens[-1]
        elif final_params:
            formula_expr = final_params[0]["name"]
        else:
            token = "p_records_count"
            fallback_col = available_columns[0] if available_columns else "id"
            parameters_dict[token] = {
                "name": token,
                "label": "Record Count",
                "source_column": fallback_col,
                "aggregation": "COUNT",
            }
            final_params = [parameters_dict[token]]
            formula_expr = token

        # Generate readable interpreted expression
        interpreted_expr = cls.format_to_readable_expression(
            filters=parsed_filters,
            formula=formula_expr,
            parameters=final_params,
            group_by=group_by_fields,
        )

        # Build human-friendly summary
        summary_parts = []
        if parsed_filters:
            filter_descs = [
                f"{f['field_name']} {f['operator'].lower().replace('_', ' ')} '{f['value']}'"
                for f in parsed_filters
            ]
            summary_parts.append(f"Filter records where {' and '.join(filter_descs)}")
        if group_by_fields:
            summary_parts.append(f"grouped by {', '.join(group_by_fields)}")
        if final_params:
            param_descs = [f"{p['aggregation']} of {p['source_column']}" for p in final_params]
            summary_parts.append(f"calculating {', '.join(param_descs)}")

        nl_summary = ", ".join(summary_parts) if summary_parts else "All records count"

        return {
            "is_valid": True,
            "error": None,
            "filters": parsed_filters,
            "group_by": group_by_fields,
            "parameters": final_params,
            "formula_expression": formula_expr,
            "calculation_type": "SIMPLE_AGGREGATE" if len(final_params) <= 1 else "FORMULA",
            "referenced_fields": sorted(list(referenced_fields)),
            "original_text": text,
            "natural_language_summary": nl_summary,
            "interpreted_expression": interpreted_expr,
        }

    @classmethod
    def parse_logic_expression(
        cls,
        text: str,
        available_columns: Optional[List[str]] = None,
        existing_parameters: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Parses a logic expression into structured filters, groupings, parameters, and executable formula.
        Automatically routes natural-language English business rules to the NLP translator.
        """
        if not text or not text.strip():
            return {
                "is_valid": True,
                "error": None,
                "filters": [],
                "group_by": [],
                "parameters": existing_parameters or [],
                "formula_expression": "",
                "calculation_type": "SIMPLE_AGGREGATE",
                "referenced_fields": [],
                "natural_language_summary": "",
                "interpreted_expression": "",
            }

        raw = text.strip()

        # Route to Natural Language parser if plain English is detected
        if cls.is_natural_language(raw):
            return cls.parse_natural_language_rule(
                raw,
                available_columns=available_columns,
                existing_parameters=existing_parameters,
            )

        filter_part = ""
        group_part = ""
        calculate_part = raw
        group_by_fields: List[str] = []

        # Detect GROUP BY in code syntax: GROUP BY [Col1], [Col2]
        group_match = re.search(r'\bGROUP\s+BY\s*[:\s]*(.*?)(?=\bCALCULATE|\Z)', raw, re.IGNORECASE | re.DOTALL)
        if group_match:
            group_part = group_match.group(1).strip()

        # Detect FILTER ... WHERE
        filter_match = re.search(r'\bFILTER\s+(?:records\s+)?WHERE\s+(.*?)(?=\bGROUP\s+BY|\bCALCULATE|\Z)', raw, re.IGNORECASE | re.DOTALL)
        if not filter_match:
            filter_match = re.search(r'\bFILTER\s*:\s*(.*?)(?=\bGROUP\s+BY|\bCALCULATE|\Z)', raw, re.IGNORECASE | re.DOTALL)

        if filter_match:
            filter_part = filter_match.group(1).strip()
            calc_match = re.search(r'\bCALCULATE\s*[:\s]*(.*)', raw, re.IGNORECASE | re.DOTALL)
            calculate_part = calc_match.group(1).strip() if calc_match else ""
        else:
            calc_match = re.match(r'^\s*CALCULATE\s*[:\s]*(.*)', raw, re.IGNORECASE | re.DOTALL)
            if calc_match:
                calculate_part = calc_match.group(1).strip()

        # 1. Parse Filter Conditions
        parsed_filters = []
        referenced_fields: Set[str] = set()

        if filter_part:
            tokens = re.split(r'\b(AND|OR)\b', filter_part, flags=re.IGNORECASE)
            current_conjunction = "AND"

            for segment in tokens:
                seg_clean = segment.strip()
                if not seg_clean:
                    continue
                if seg_clean.upper() in ["AND", "OR"]:
                    current_conjunction = seg_clean.upper()
                    continue

                field_match = re.match(
                    r'^\s*(?:\[([^\]]+)\]|([a-zA-Z0-9_\s/&-]+?))\s+(CONTAINS|STARTS_WITH|ENDS_WITH|IN|IS\s+NOT\s+EMPTY|IS\s+EMPTY|>=|<=|!=|<>|==|(?<![<>=!])>(?![<>=!])|(?<![<>=!])<(?![<>=!])|(?<![<>=!])=(?![<>=!]))\s*(.*)',
                    seg_clean,
                    re.IGNORECASE
                )
                if not field_match:
                    raise KPILogicParseError(f"Cannot parse filter condition: '{seg_clean}'. Expected format: [Field] = \"Value\"")

                field_raw = field_match.group(1) or field_match.group(2)
                op_raw = field_match.group(3).strip().upper()
                val_raw = field_match.group(4).strip() if field_match.group(4) else ""

                resolved_field = cls._resolve_column_name(field_raw, available_columns)
                referenced_fields.add(resolved_field)

                op_norm = re.sub(r'\s+', ' ', op_raw)
                if op_norm not in cls.OPERATOR_MAP:
                    raise KPILogicParseError(f"Unsupported filter operator '{op_raw}' in condition: '{seg_clean}'")
                mapped_op = cls.OPERATOR_MAP[op_norm]

                clean_val = val_raw
                if (clean_val.startswith('"') and clean_val.endswith('"')) or (clean_val.startswith("'") and clean_val.endswith("'")):
                    clean_val = clean_val[1:-1]

                parsed_filters.append({
                    "field_name": resolved_field,
                    "operator": mapped_op,
                    "value": clean_val,
                    "conjunction": current_conjunction,
                })

        # 2. Parse Group By Fields
        if group_part:
            g_cols = re.findall(r'\[([^\]]+)\]|([a-zA-Z0-9_\s/&-]+)', group_part)
            for g_bracket, g_plain in g_cols:
                g_col = (g_bracket or g_plain or "").strip()
                if g_col:
                    resolved_g = cls._resolve_column_name(g_col, available_columns)
                    referenced_fields.add(resolved_g)
                    if resolved_g not in group_by_fields:
                        group_by_fields.append(resolved_g)

        # 3. Parse Calculate Expression & Extract Aggregations
        parameters_dict: Dict[str, Dict[str, Any]] = {}
        if existing_parameters:
            for p in existing_parameters:
                p_name = p.get("name")
                if p_name:
                    parameters_dict[p_name] = p

        transformed_calc = calculate_part

        def _replace_aggregation(match):
            agg = match.group(1).upper()
            col_bracket = match.group(2)
            col_plain = match.group(3)
            col_target = (col_bracket or col_plain or "").strip()

            if not col_target or col_target.lower() in ["filtered records", "*", ""]:
                token = f"p_records_{agg.lower()}"
                if token not in parameters_dict:
                    fallback_col = available_columns[0] if available_columns else "id"
                    parameters_dict[token] = {
                        "name": token,
                        "label": f"{agg} of records",
                        "source_column": fallback_col,
                        "aggregation": agg,
                    }
                return token

            resolved_col = cls._resolve_column_name(col_target, available_columns)
            referenced_fields.add(resolved_col)
            token = cls._sanitize_param_token(resolved_col, agg)

            if token not in parameters_dict:
                parameters_dict[token] = {
                    "name": token,
                    "label": f"{agg} of {resolved_col}",
                    "source_column": resolved_col,
                    "aggregation": agg,
                }
            return token

        transformed_calc = cls.AGGREGATION_REGEX.sub(_replace_aggregation, transformed_calc)

        def _replace_standalone_bracket(match):
            col_target = match.group(1).strip()
            resolved_col = cls._resolve_column_name(col_target, available_columns)
            referenced_fields.add(resolved_col)
            token = cls._sanitize_param_token(resolved_col, "sum")

            if token not in parameters_dict:
                parameters_dict[token] = {
                    "name": token,
                    "label": f"Sum of {resolved_col}",
                    "source_column": resolved_col,
                    "aggregation": "SUM",
                }
            return token

        transformed_calc = cls.BRACKET_FIELD_REGEX.sub(_replace_standalone_bracket, transformed_calc)
        transformed_calc = transformed_calc.strip()

        if not transformed_calc and not parameters_dict:
            token = "p_records_count"
            fallback_col = available_columns[0] if available_columns else "id"
            parameters_dict[token] = {
                "name": token,
                "label": "Record Count",
                "source_column": fallback_col,
                "aggregation": "COUNT",
            }
            transformed_calc = token

        final_parameters = list(parameters_dict.values())

        calc_type = "FORMULA"
        if len(final_parameters) <= 1 and not any(op in transformed_calc for op in "+-*/%()"):
            calc_type = "SIMPLE_AGGREGATE"

        interpreted_expr = cls.format_to_readable_expression(
            filters=parsed_filters,
            formula=transformed_calc,
            parameters=final_parameters,
            group_by=group_by_fields,
        )

        return {
            "is_valid": True,
            "error": None,
            "filters": parsed_filters,
            "group_by": group_by_fields,
            "parameters": final_parameters,
            "formula_expression": transformed_calc,
            "calculation_type": calc_type,
            "referenced_fields": sorted(list(referenced_fields)),
            "original_text": text,
            "natural_language_summary": "",
            "interpreted_expression": interpreted_expr,
        }

    @classmethod
    def format_to_readable_expression(
        cls,
        filters: List[Dict[str, Any]],
        formula: str,
        parameters: Optional[List[Dict[str, Any]]] = None,
        group_by: Optional[List[str]] = None,
    ) -> str:
        """
        Generates readable business logic expression text from structured filters,
        groupings, and formula.
        """
        lines = []

        # Filters block
        if filters:
            lines.append("FILTER records WHERE")
            for idx, flt in enumerate(filters):
                prefix = "    " if idx == 0 else f"    {flt.get('conjunction', 'AND')} "
                op_val = flt.get("operator", "EQUALS")
                op_symbol = op_val if op_val in cls.OPERATOR_MAP else "="
                for sym, code in cls.OPERATOR_MAP.items():
                    if code == op_val:
                        op_symbol = sym
                        break
                val = str(flt.get("value", ""))
                val_str = f'"{val}"' if not val.replace('.', '', 1).isdigit() and op_val not in ["IS_EMPTY", "IS_NOT_EMPTY"] else val
                if op_val in ["IS_EMPTY", "IS_NOT_EMPTY"]:
                    lines.append(f"{prefix}[{flt.get('field_name')}] {op_symbol}")
                else:
                    lines.append(f"{prefix}[{flt.get('field_name')}] {op_symbol} {val_str}")
            lines.append("")

        # Group By block
        if group_by:
            lines.append("GROUP BY:")
            for g in group_by:
                lines.append(f"    [{g}]")
            lines.append("")

        # Calculate block
        calc_expr = formula or ""
        if parameters:
            for p in parameters:
                p_name = p.get("name", "")
                src_col = p.get("source_column", "")
                agg = p.get("aggregation", "SUM")
                if src_col and p_name in calc_expr:
                    if agg == "COUNT" and not src_col:
                        replacement = "COUNT(filtered records)"
                    else:
                        replacement = f"{agg}([{src_col}])"
                    calc_expr = re.sub(rf'\b{re.escape(p_name)}\b', replacement, calc_expr)

        lines.append("CALCULATE:")
        lines.append(f"    {calc_expr if calc_expr.strip() else 'COUNT(filtered records)'}")

        return "\n".join(lines)
