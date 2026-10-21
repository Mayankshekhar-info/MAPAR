"""
Universal KPI Formula Excel Configuration Service.
Parses, validates, previews, activates, and versions Excel formula workbooks.
Enforces strict sandboxed AST validation with SafeFormulaEvaluator.
Never executes arbitrary Python code, Excel macros, or unsafe expressions.
"""

import io
import os
import hashlib
from decimal import Decimal, InvalidOperation
from typing import Dict, Any, List, Tuple, Optional, Set
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.core.exceptions import ValidationError
from django.utils import timezone
from openpyxl import load_workbook, Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from common.database.transactions import atomic_operation
from apps.organization.models import MainCompany, Project, Domain, Circle
from apps.imports.models import UploadTemplate
from apps.kpi.models import (
    KPIDefinition,
    KPIParameter,
    KPIFilter,
    KPIConfigurationVersion,
)
from apps.kpi.services.formula_evaluator import SafeFormulaEvaluator, SafeFormulaError


class KPIFormulaExcelService:
    # Standard field mapping synonyms for auto-detecting Excel header columns
    FIELD_SYNONYMS = {
        "code": ["kpi_code", "kpi code", "code", "metric_code", "metric code", "id", "kpi_id", "metric_id"],
        "name": ["kpi_name", "kpi name", "name", "metric_name", "metric name", "title"],
        "description": ["description", "kpi_description", "kpi description", "definition", "details"],
        "domain": ["domain", "category", "kpi_category", "department", "functional_area"],
        "hierarchy_level": ["hierarchy_level", "hierarchy level", "level", "tier", "org_level"],
        "calculation_type": ["calculation_type", "calculation type", "type", "formula_type", "metric_type"],
        "formula_expression": ["formula_expression", "formula expression", "formula", "calculation", "expression", "rule", "logic"],
        "aggregation_method": ["aggregation_method", "aggregation method", "aggregation", "agg_method", "rollup"],
        "unit": ["unit", "uom", "unit_of_measure", "measurement_unit"],
        "direction": ["direction", "performance_direction", "polarity", "trend_direction"],
        "target_value": ["target_value", "target value", "target", "plan", "benchmark", "budget"],
        "threshold_green": ["threshold_green", "threshold green", "green_threshold", "green threshold", "green threshold %", "green_min", "green_target", "green_%", "green %"],
        "threshold_amber": ["threshold_amber", "threshold amber", "amber_threshold", "amber threshold", "amber threshold %", "amber_min", "amber_target", "amber_%", "amber %"],
        "source_dataset": ["source_dataset", "source dataset", "dataset", "template", "template_code", "data_source"],
        "natural_language_rule": ["natural_language_rule", "natural language rule", "business_rule", "plain_english_rule"],
        "cleaning_rules": ["cleaning_rules", "cleaning rules", "data_cleaning", "normalization"],
        "is_inheritance_allowed": ["is_inheritance_allowed", "is inheritance allowed", "allow_inheritance", "allow inheritance", "inheritable", "inheritance"],
        "company_code": ["company_code", "company code", "company", "main_company"],
        "project_code": ["project_code", "project code", "project"],
    }

    @staticmethod
    def _sanitize_header(h: Any) -> str:
        if not h:
            return ""
        return str(h).strip().lower().replace("_", " ").replace("-", " ")

    @classmethod
    def parse_and_preview_workbook(
        cls,
        uploaded_file: Any,
        custom_mapping: Optional[Dict[str, str]] = None,
        target_sheet: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Parses workbook sheets, identifies headers, performs AST formula validation,
        detects duplicate codes, and constructs a pre-activation preview report.
        """
        try:
            wb = load_workbook(uploaded_file, data_only=True)
        except Exception as ex:
            raise ValidationError(f"Unable to read Excel workbook: {str(ex)}")

        sheet_names = wb.sheetnames
        if not sheet_names:
            raise ValidationError("Workbook contains no worksheets.")

        # Select sheet: target_sheet, or first sheet named like KPI/Formula, or first sheet
        chosen_sheet_name = target_sheet if target_sheet and target_sheet in sheet_names else sheet_names[0]
        for sname in sheet_names:
            if not target_sheet and any(term in sname.lower() for term in ["kpi", "formula", "definition", "metric"]):
                chosen_sheet_name = sname
                break

        ws = wb[chosen_sheet_name]
        all_rows = list(ws.iter_rows(values_only=True))
        if not all_rows:
            return {
                "sheet_names": sheet_names,
                "selected_sheet": chosen_sheet_name,
                "detected_mapping": {},
                "total_rows": 0,
                "preview_rows": [],
                "valid_count": 0,
                "error_count": 0,
            }

        # 1. Identify header row (first non-empty row)
        header_row_idx = 0
        raw_headers: List[str] = []
        for idx, row in enumerate(all_rows):
            clean_items = [str(c).strip() for c in row if c is not None and str(c).strip()]
            if len(clean_items) >= 2:
                header_row_idx = idx
                raw_headers = [str(c).strip() if c is not None else f"Column_{i+1}" for i, c in enumerate(row)]
                break

        if not raw_headers:
            raise ValidationError("Could not identify table headers in the selected worksheet.")

        # 2. Build column mapping: custom overrides or auto-detection
        detected_mapping: Dict[str, str] = {}
        for idx, h in enumerate(raw_headers):
            norm_h = cls._sanitize_header(h)
            matched_field = None
            for standard_field, synonyms in cls.FIELD_SYNONYMS.items():
                if norm_h in [cls._sanitize_header(s) for s in synonyms]:
                    matched_field = standard_field
                    break
            if matched_field:
                detected_mapping[matched_field] = h

        # Apply any custom mappings provided by user
        if custom_mapping:
            for std_field, mapped_h in custom_mapping.items():
                if mapped_h:
                    detected_mapping[std_field] = mapped_h

        # Invert mapping: Header label -> Standard field
        header_to_field = {v: k for k, v in detected_mapping.items()}

        # 3. Parse Data Rows
        preview_rows: List[Dict[str, Any]] = []
        valid_count = 0
        error_count = 0
        seen_file_codes: Set[str] = set()
        existing_db_codes = set(KPIDefinition.objects.values_list("code", flat=True))

        for row_num, row_cells in enumerate(all_rows[header_row_idx + 1:], start=header_row_idx + 2):
            # Check if row is completely empty
            if all(c is None or str(c).strip() == "" for c in row_cells):
                continue

            row_data: Dict[str, Any] = {}
            for col_idx, h in enumerate(raw_headers):
                cell_val = row_cells[col_idx] if col_idx < len(row_cells) else None
                if cell_val is not None and isinstance(cell_val, str):
                    cell_val = cell_val.strip()
                row_data[h] = cell_val

            # Extract standard fields
            code_raw = row_data.get(detected_mapping.get("code", ""))
            name_raw = row_data.get(detected_mapping.get("name", ""))
            formula_raw = row_data.get(detected_mapping.get("formula_expression", ""))
            desc_raw = row_data.get(detected_mapping.get("description", "")) or ""
            domain_raw = row_data.get(detected_mapping.get("domain", ""))
            calc_type_raw = row_data.get(detected_mapping.get("calculation_type", "")) or "FORMULA"
            agg_method_raw = row_data.get(detected_mapping.get("aggregation_method", "")) or "SUM"
            unit_raw = row_data.get(detected_mapping.get("unit", "")) or "Units"
            direction_raw = row_data.get(detected_mapping.get("direction", "")) or "HIGHER_BETTER"
            target_raw = row_data.get(detected_mapping.get("target_value", ""))
            thresh_green_raw = row_data.get(detected_mapping.get("threshold_green", ""))
            thresh_amber_raw = row_data.get(detected_mapping.get("threshold_amber", ""))
            dataset_raw = row_data.get(detected_mapping.get("source_dataset", ""))
            level_raw = row_data.get(detected_mapping.get("hierarchy_level", "")) or "CIRCLE"
            nl_rule_raw = row_data.get(detected_mapping.get("natural_language_rule", "")) or ""
            rules_raw = row_data.get(detected_mapping.get("cleaning_rules", "")) or ""
            inherit_raw = row_data.get(detected_mapping.get("is_inheritance_allowed", ""))
            clean_inherit = None
            if inherit_raw is not None and str(inherit_raw).strip():
                clean_inherit = str(inherit_raw).strip().lower() not in ["false", "0", "no", "disabled", "n"]
            comp_code_raw = row_data.get(detected_mapping.get("company_code", "")) or ""
            proj_code_raw = row_data.get(detected_mapping.get("project_code", "")) or ""

            # Row Validation
            row_errors: List[str] = []
            row_warnings: List[str] = []

            # A. Required Fields
            clean_code = str(code_raw).strip().upper().replace(" ", "_") if code_raw else None
            clean_name = str(name_raw).strip() if name_raw else None

            if not clean_code:
                row_errors.append("Mandatory field 'KPI Code' is missing or empty.")
            else:
                # Check duplicate code within the workbook
                if clean_code in seen_file_codes:
                    row_errors.append(f"Duplicate KPI code '{clean_code}' detected in this workbook.")
                else:
                    seen_file_codes.add(clean_code)

                # Check existing DB code
                if clean_code in existing_db_codes:
                    row_warnings.append(f"KPI code '{clean_code}' already exists in database; activating will update existing definition.")

            if not clean_name:
                row_errors.append("Mandatory field 'KPI Name' is missing or empty.")

            # B. Safe AST Formula Validation
            clean_formula = str(formula_raw).strip() if formula_raw else ""
            if clean_formula:
                # Disallow macros, exec, eval, imports, dunders
                if any(bad in clean_formula.lower() for bad in ["__", "import ", "eval(", "exec(", "open(", "os.", "sys."]):
                    row_errors.append("Disallowed expression: unsafe syntax or forbidden keyword in formula.")
                else:
                    try:
                        is_valid_syntax, err_msg, vars_found = SafeFormulaEvaluator.validate_syntax(clean_formula)
                        if not is_valid_syntax:
                            row_errors.append(f"Formula validation error: {err_msg}")
                        elif not vars_found and not any(op in clean_formula for op in ["+", "-", "*", "/"]):
                            row_warnings.append("Formula expression contains no variable parameters.")
                    except SafeFormulaError as sfe:
                        row_errors.append(f"Formula validation error: {str(sfe)}")
                    except Exception as ex:
                        row_errors.append(f"Formula syntax error: {str(ex)}")

            # C. Target & Threshold parsing
            clean_target = None
            if target_raw is not None and str(target_raw).strip():
                try:
                    clean_target = float(Decimal(str(target_raw).replace("%", "").replace(",", "").strip()))
                except (InvalidOperation, ValueError):
                    row_warnings.append(f"Non-numeric target value '{target_raw}' could not be converted to decimal.")

            clean_green = 95.0
            if thresh_green_raw is not None and str(thresh_green_raw).strip():
                try:
                    clean_green = float(Decimal(str(thresh_green_raw).replace("%", "").strip()))
                except Exception:
                    pass

            clean_amber = 80.0
            if thresh_amber_raw is not None and str(thresh_amber_raw).strip():
                try:
                    clean_amber = float(Decimal(str(thresh_amber_raw).replace("%", "").strip()))
                except Exception:
                    pass

            # D. Direction normalization
            clean_dir = "HIGHER_BETTER"
            if str(direction_raw).strip().upper() in ["LOWER_BETTER", "LOWER", "DECREASING", "MIN"]:
                clean_dir = "LOWER_BETTER"
            elif str(direction_raw).strip().upper() in ["NEUTRAL", "EXACT", "INFORMATIVE"]:
                clean_dir = "NEUTRAL"

            # E. Aggregation method normalization
            clean_agg = "SUM"
            if str(agg_method_raw).strip().upper() in ["AVG", "AVERAGE", "MEAN"]:
                clean_agg = "AVG"
            elif str(agg_method_raw).strip().upper() in ["COUNT", "COUNT_DISTINCT", "MIN", "MAX", "LATEST"]:
                clean_agg = str(agg_method_raw).strip().upper()

            is_valid = len(row_errors) == 0
            if is_valid:
                valid_count += 1
            else:
                error_count += 1

            preview_rows.append({
                "row_index": row_num,
                "is_valid": is_valid,
                "errors": row_errors,
                "warnings": row_warnings,
                "code": clean_code,
                "name": clean_name,
                "description": desc_raw,
                "domain": str(domain_raw).strip() if domain_raw else None,
                "hierarchy_level": str(level_raw).strip().upper(),
                "calculation_type": str(calc_type_raw).strip().upper(),
                "formula_expression": clean_formula,
                "aggregation_method": clean_agg,
                "unit": str(unit_raw).strip(),
                "direction": clean_dir,
                "target_value": clean_target,
                "threshold_green": clean_green,
                "threshold_amber": clean_amber,
                "source_dataset": str(dataset_raw).strip() if dataset_raw else None,
                "natural_language_rule": str(nl_rule_raw).strip(),
                "cleaning_rules": str(rules_raw).strip(),
                "is_inheritance_allowed": clean_inherit,
                "company_code": str(comp_code_raw).strip() if comp_code_raw else None,
                "project_code": str(proj_code_raw).strip() if proj_code_raw else None,
                "raw_values": row_data,
            })

        return {
            "is_valid": error_count == 0,
            "sheet_names": sheet_names,
            "selected_sheet": chosen_sheet_name,
            "headers": raw_headers,
            "available_headers": raw_headers,
            "detected_mapping": detected_mapping,
            "total_rows": len(preview_rows),
            "valid_count": valid_count,
            "error_count": error_count,
            "preview_rows": preview_rows,
        }

    @classmethod
    def activate_configuration(
        cls,
        uploaded_file: Any,
        approved_kpis: List[Dict[str, Any]],
        scope_type: str = "ENTERPRISE",
        company_id: Optional[int] = None,
        project_id: Optional[int] = None,
        circle_id: Optional[int] = None,
        hierarchy_level: Optional[str] = None,
        hierarchy_id: Optional[int] = None,
        changelog: str = "",
        is_inheritance_allowed: bool = True,
        user=None,
    ) -> Dict[str, Any]:
        """
        Atomically commits the validated KPI configuration into PostgreSQL.
        Enforces strict hierarchy scope resolution: Enterprise, Company, Project, or Circle.
        Rejects incompatible hierarchy assignments and prevents scope leakage.
        """
        if not approved_kpis:
            raise ValidationError("No approved KPI definitions provided for activation.")

        valid_kpis = [k for k in approved_kpis if k.get("code") and k.get("name") and k.get("is_valid", True)]
        if not valid_kpis:
            raise ValidationError("No valid approved KPI definitions with both code and name provided for activation.")

        norm_scope = (scope_type or "ENTERPRISE").strip().upper()
        valid_scopes = [
            KPIConfigurationVersion.ScopeType.ENTERPRISE,
            KPIConfigurationVersion.ScopeType.COMPANY,
            KPIConfigurationVersion.ScopeType.PROJECT,
            KPIConfigurationVersion.ScopeType.CIRCLE,
        ]
        if norm_scope not in valid_scopes:
            raise ValidationError(f"Invalid scope type '{scope_type}'. Must be one of {valid_scopes}.")

        company_obj = None
        sub_company_obj = None
        project_obj = None
        circle_obj = None
        target_h_lvl = norm_scope
        target_h_id = None

        if norm_scope == KPIConfigurationVersion.ScopeType.ENTERPRISE:
            target_h_lvl = "ENTERPRISE"
            target_h_id = None
            if user and not user.is_superuser:
                from common.permissions.authorization import AuthorizationService
                scope = AuthorizationService.get_user_hierarchy_scope(user)
                if not scope.is_unrestricted:
                    raise ValidationError("You do not have permission to publish Enterprise-wide default KPI formulas.")

        elif norm_scope == KPIConfigurationVersion.ScopeType.COMPANY:
            c_id = company_id or (hierarchy_id if hierarchy_level in ["MAIN_COMPANY", "SUB_COMPANY", "COMPANY"] else None)
            if not c_id:
                raise ValidationError("Company scope requires a valid Company to be selected.")
            company_obj = MainCompany.objects.filter(id=c_id).first()
            if not company_obj:
                raise ValidationError(f"Main Company with ID {c_id} does not exist.")
            target_h_lvl = "MAIN_COMPANY"
            target_h_id = company_obj.id

        elif norm_scope == KPIConfigurationVersion.ScopeType.PROJECT:
            p_id = project_id or (hierarchy_id if hierarchy_level == "PROJECT" else None)
            if not p_id:
                raise ValidationError("Project scope requires a valid Project to be selected.")
            project_obj = Project.objects.filter(id=p_id).select_related("sub_company__main_company").first()
            if not project_obj:
                raise ValidationError(f"Project with ID {p_id} does not exist.")

            # Coherence check: if company_id is also supplied, verify relationship
            if company_id and project_obj.sub_company.main_company_id != company_id:
                raise ValidationError(f"Project '{project_obj.name}' does not belong to the selected Company.")

            sub_company_obj = project_obj.sub_company
            company_obj = project_obj.sub_company.main_company
            target_h_lvl = "PROJECT"
            target_h_id = project_obj.id

        elif norm_scope == KPIConfigurationVersion.ScopeType.CIRCLE:
            circ_id = circle_id or (hierarchy_id if hierarchy_level == "CIRCLE" else None)
            if not circ_id:
                raise ValidationError("Circle scope requires a valid Circle to be selected.")
            circle_obj = Circle.objects.filter(id=circ_id).select_related("project__sub_company__main_company").first()
            if not circle_obj:
                raise ValidationError(f"Circle with ID {circ_id} does not exist.")

            # Coherence check: verify parent hierarchy
            if project_id and circle_obj.project_id != project_id:
                raise ValidationError(f"Circle '{circle_obj.name}' does not belong to the selected Project.")
            if company_id and circle_obj.project and circle_obj.project.sub_company.main_company_id != company_id:
                raise ValidationError(f"Circle '{circle_obj.name}' does not belong to the selected Company.")

            if circle_obj.project:
                project_obj = circle_obj.project
                sub_company_obj = circle_obj.project.sub_company
                company_obj = circle_obj.project.sub_company.main_company
            target_h_lvl = "CIRCLE"
            target_h_id = circle_obj.id

        # Authorization enforcement for non-superusers
        if user and not user.is_superuser:
            from common.permissions.authorization import AuthorizationService
            if circle_obj:
                AuthorizationService.require_organization_access(user=user, circle_id=circle_obj.id, action="edit")
            elif project_obj:
                first_circle = project_obj.circles.values_list("id", flat=True).first()
                if first_circle:
                    AuthorizationService.require_organization_access(user=user, circle_id=first_circle, action="edit")

        # Compute file hash and save workbook
        file_hash = ""
        stored_path = ""
        filename = getattr(uploaded_file, "name", "kpi_config.xlsx") or "kpi_config.xlsx"

        if uploaded_file:
            from apps.imports.services.data_cleaning_service import DataCleaningService
            file_hash = DataCleaningService.compute_file_hash(uploaded_file)

            config_dir = os.path.join(settings.MEDIA_ROOT, "kpi_configurations")
            os.makedirs(config_dir, exist_ok=True)
            stored_filename = f"{timezone.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
            stored_path = os.path.join(config_dir, stored_filename)
            try:
                if hasattr(uploaded_file, "seek"):
                    uploaded_file.seek(0)
                with open(stored_path, "wb+") as dest:
                    if hasattr(uploaded_file, "chunks"):
                        for chunk in uploaded_file.chunks():
                            dest.write(chunk)
                    elif hasattr(uploaded_file, "read"):
                        dest.write(uploaded_file.read())
            except Exception:
                pass

        # Compute next version number for this exact scope
        last_version = KPIConfigurationVersion.objects.filter(
            scope_type=norm_scope,
            company=company_obj,
            project=project_obj,
            circle=circle_obj,
        ).order_by("-version_number").first()
        next_ver = (last_version.version_number + 1) if last_version else 1

        with atomic_operation():
            # Supersede previous active version in this exact scope
            superseded_qs = KPIConfigurationVersion.objects.filter(
                scope_type=norm_scope,
                company=company_obj,
                project=project_obj,
                circle=circle_obj,
                status=KPIConfigurationVersion.Status.ACTIVE,
            )
            superseded_ids = list(superseded_qs.values_list("id", flat=True))
            superseded_qs.update(status=KPIConfigurationVersion.Status.SUPERSEDED)

            # Deactivate KPI definitions belonging to superseded versions of this exact scope
            if superseded_ids:
                KPIDefinition.objects.filter(config_version_id__in=superseded_ids).update(is_active=False)

            # Create new configuration version
            config_version = KPIConfigurationVersion.objects.create(
                version_number=next_ver,
                name=f"KPI Formula Config v{next_ver} ({filename})",
                description=changelog or f"Approved formula configuration workbook with {len(valid_kpis)} KPIs.",
                original_filename=filename,
                stored_file_path=stored_path,
                file_hash=file_hash,
                scope_type=norm_scope,
                company=company_obj,
                sub_company=sub_company_obj,
                project=project_obj,
                circle=circle_obj,
                hierarchy_level=target_h_lvl,
                hierarchy_id=target_h_id,
                is_inheritance_allowed=is_inheritance_allowed,
                status=KPIConfigurationVersion.Status.ACTIVE,
                total_kpis=len(valid_kpis),
                changelog=changelog,
                created_by=user,
                activated_at=timezone.now(),
            )

            # Resolve domain lookups
            all_domains = {d.code.upper(): d for d in Domain.objects.all()}
            for d in Domain.objects.all():
                all_domains[d.name.upper()] = d

            # Resolve template lookups
            all_templates = {t.code.upper(): t for t in UploadTemplate.objects.all()}
            for t in UploadTemplate.objects.all():
                all_templates[t.name.upper()] = t

            activated_codes: List[str] = []

            for item in valid_kpis:
                code = item.get("code")
                if not code:
                    continue

                domain_val = item.get("domain")
                domain_obj = all_domains.get(str(domain_val).strip().upper()) if domain_val else None

                dataset_val = item.get("source_dataset")
                dataset_obj = all_templates.get(str(dataset_val).strip().upper()) if dataset_val else None
                if not dataset_obj:
                    # Fallback to standard operational metrics dataset
                    dataset_obj = UploadTemplate.objects.filter(code="DS_KPI_OPS").first()

                # Parse cleaning rules if string or dict
                raw_cleaning = item.get("cleaning_rules", {})
                cleaning_rules_dict = {}
                if isinstance(raw_cleaning, dict):
                    cleaning_rules_dict = raw_cleaning
                elif isinstance(raw_cleaning, str) and raw_cleaning.strip():
                    rules_tokens = [r.strip() for r in raw_cleaning.split(";") if r.strip()]
                    cleaning_rules_dict = {"rules": rules_tokens}

                # Create scoped KPIDefinition bound to this config_version
                kpi_def = KPIDefinition.objects.create(
                    code=code,
                    name=item.get("name") or code,
                    description=item.get("description", "") or "",
                    domain=domain_obj,
                    scope_type=norm_scope,
                    hierarchy_level=target_h_lvl,
                    hierarchy_id=target_h_id,
                    calculation_type=item.get("calculation_type", "FORMULA") or "FORMULA",
                    source_dataset=dataset_obj,
                    formula_expression=item.get("formula_expression", "") or "",
                    natural_language_rule=item.get("natural_language_rule", "") or "",
                    aggregation_method=item.get("aggregation_method", "SUM") or "SUM",
                    unit=item.get("unit", "Units") or "Units",
                    direction=item.get("direction", "HIGHER_BETTER") or "HIGHER_BETTER",
                    target_value=Decimal(str(item["target_value"])) if item.get("target_value") is not None else None,
                    threshold_green=Decimal(str(item["threshold_green"])) if item.get("threshold_green") is not None else Decimal("95.00"),
                    threshold_amber=Decimal(str(item["threshold_amber"])) if item.get("threshold_amber") is not None else Decimal("80.00"),
                    config_version=config_version,
                    company=company_obj,
                    project=project_obj,
                    circle=circle_obj,
                    is_inheritance_allowed=(
                        item.get("is_inheritance_allowed")
                        if item.get("is_inheritance_allowed") is not None
                        else is_inheritance_allowed
                    ),
                    cleaning_rules=cleaning_rules_dict,
                    is_active=True,
                )

                # Ensure formula parameters exist for detected variables
                if kpi_def.formula_expression:
                    try:
                        is_valid_syntax, _, var_names = SafeFormulaEvaluator.validate_syntax(kpi_def.formula_expression)
                        for vname in var_names:
                            if not kpi_def.parameters.filter(name=vname).exists():
                                KPIParameter.objects.create(
                                    kpi=kpi_def,
                                    name=vname,
                                    label=vname.replace("_", " ").title(),
                                    source_column=vname,
                                    aggregation=kpi_def.aggregation_method or "SUM",
                                )
                    except Exception:
                        pass

                # Default parameters if none
                if not kpi_def.parameters.exists():
                    KPIParameter.objects.create(
                        kpi=kpi_def,
                        name="actual",
                        label="Actual Value",
                        source_column="actual_value",
                        aggregation=kpi_def.aggregation_method,
                    )

                activated_codes.append(code)

            config_version.activated_kpi_codes = activated_codes
            config_version.save(update_fields=["activated_kpi_codes"])

        return {
            "success": True,
            "version_number": config_version.version_number,
            "version_id": config_version.id,
            "scope_type": config_version.scope_type,
            "activated_count": len(activated_codes),
            "activated_codes": activated_codes,
            "message": f"Successfully activated {len(activated_codes)} KPI definitions under Configuration Version {config_version.version_number}.",
        }

    @classmethod
    def generate_starter_excel_template(cls) -> io.BytesIO:
        """
        Builds a beautifully styled, authoritative starter Excel template for Universal KPIs.
        Contains:
        1. KPI Definitions sheet with realistic telecom/operational metrics & safe formulas.
        2. Column Mappings guide.
        3. Instructions sheet explaining AST formula rules, functions, and cleaning options.
        """
        wb = Workbook()
        
        # 1. KPI Definitions Sheet
        ws_kpi = wb.active
        ws_kpi.title = "KPI Definitions"
        ws_kpi.views.sheetView[0].showGridLines = True

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        title_font = Font(name="Calibri", size=14, bold=True, color="0F172A")
        sub_font = Font(name="Calibri", size=10, italic=True, color="64748B")
        header_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1"),
        )

        ws_kpi.cell(row=1, column=1, value="MAPAR Universal KPI Configuration & Formula Workbook").font = title_font
        ws_kpi.cell(row=2, column=1, value="Define KPI codes, safe formulas, targets, directions, and data cleaning rules. Save and upload directly into MAPAR.").font = sub_font

        headers = [
            "KPI Code*",
            "KPI Name*",
            "Description",
            "Domain / Category",
            "Hierarchy Level",
            "Calculation Type",
            "Aggregation Method",
            "Formula Expression*",
            "Unit",
            "Direction",
            "Target Value",
            "Green Threshold %",
            "Amber Threshold %",
            "Source Dataset Code",
            "Data Cleaning Rules",
        ]

        for col_idx, h in enumerate(headers, start=1):
            cell = ws_kpi.cell(row=4, column=col_idx, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = thin_border

        ws_kpi.row_dimensions[4].height = 28

        # Sample Universal KPI rows
        sample_rows = [
            [
                "KPI_NET_AVAIL",
                "Network Site Availability %",
                "Percentage of active telecom sites operational without outages",
                "Operations & Maintenance",
                "CIRCLE",
                "PERCENTAGE",
                "AVG",
                "(sites_up / total_sites) * 100",
                "%",
                "HIGHER_BETTER",
                99.50,
                98.00,
                95.00,
                "DS_KPI_OPS",
                "TRIM_WHITESPACE; NUMERIC_DECIMAL; REQUIRE_CIRCLE",
            ],
            [
                "KPI_EB_UPTIME",
                "Electricity Board (EB) Power Uptime",
                "Grid power availability ratio across all active telecom towers",
                "Operations & Maintenance",
                "CIRCLE",
                "PERCENTAGE",
                "AVG",
                "(eb_hours / total_hours) * 100",
                "%",
                "HIGHER_BETTER",
                95.00,
                92.00,
                88.00,
                "DS_KPI_OPS",
                "TRIM_WHITESPACE; NUMERIC_DECIMAL",
            ],
            [
                "KPI_OUTAGE_MIN",
                "Total Cumulative Outage Duration",
                "Total duration in minutes of telecom tower network downtime",
                "Operations & Maintenance",
                "CIRCLE",
                "SIMPLE_AGGREGATE",
                "SUM",
                "outage_min",
                "Mins",
                "LOWER_BETTER",
                120.00,
                150.00,
                240.00,
                "DS_KPI_OPS",
                "TRIM_WHITESPACE; NUMERIC_INTEGER",
            ],
            [
                "KPI_WORKFORCE_GAP",
                "Field Resource Staffing Gap",
                "Difference between required technician headcount and deployed technicians",
                "Governance",
                "CIRCLE",
                "VARIANCE",
                "SUM",
                "required_headcount - deployed_headcount",
                "Headcount",
                "LOWER_BETTER",
                0.00,
                2.00,
                5.00,
                "DS_WORKFORCE",
                "TRIM_WHITESPACE; NUMERIC_INTEGER",
            ],
            [
                "KPI_GOV_CLOSURE",
                "Governance Action Item Closure %",
                "Resolution rate of escalated compliance and governance action items",
                "Project Governance",
                "PROJECT",
                "PERCENTAGE",
                "AVG",
                "(closed_actions / total_actions) * 100",
                "%",
                "HIGHER_BETTER",
                90.00,
                85.00,
                75.00,
                "DS_GOVERNANCE",
                "TRIM_WHITESPACE; NUMERIC_DECIMAL",
            ],
        ]

        for r_offset, r_data in enumerate(sample_rows, start=5):
            ws_kpi.row_dimensions[r_offset].height = 22
            for c_offset, val in enumerate(r_data, start=1):
                cell = ws_kpi.cell(row=r_offset, column=c_offset, value=val)
                cell.border = thin_border
                cell.alignment = Alignment(
                    horizontal="center" if c_offset in [1, 5, 6, 7, 9, 10] else "left",
                    vertical="center",
                )

        # 2. Instructions Sheet
        ws_inst = wb.create_sheet(title="Formula Instructions")
        ws_inst.views.sheetView[0].showGridLines = True
        ws_inst.cell(row=1, column=1, value="MAPAR Universal Formula Engine - User Guide").font = title_font

        guide_points = [
            ("Safe Formula Syntax", "Standard arithmetic operators: +, -, *, /, //, %, **. Grouping with parentheses: (a + b) / c."),
            ("Supported Functions", "abs(x), round(x, n), min(a, b), max(a, b), sum(x), avg(x), sqrt(x), ceil(x), floor(x), if_else(cond, true_val, false_val)."),
            ("Performance Direction", "HIGHER_BETTER: Greater values are Green; LOWER_BETTER: Smaller values are Green; NEUTRAL: Informational."),
            ("Hierarchy Levels", "MAIN_COMPANY, SUB_COMPANY, PROJECT, CIRCLE, DOMAIN, DEPARTMENT, SUB_DEPARTMENT."),
            ("Deterministic Cleaning", "TRIM_WHITESPACE, DATE_ISO, NUMERIC_DECIMAL, NUMERIC_INTEGER, REQUIRE_CIRCLE."),
            ("Security Sandbox", "Excel macros, imports, dunders, and arbitrary Python execution are strictly blocked by the AST parser."),
        ]

        for idx, (title, detail) in enumerate(guide_points, start=3):
            c_title = ws_inst.cell(row=idx, column=1, value=title)
            c_title.font = Font(bold=True, color="0284C7")
            c_detail = ws_inst.cell(row=idx, column=2, value=detail)

        # Auto-width
        for sheet in [ws_kpi, ws_inst]:
            for col_cells in sheet.columns:
                max_len = max(len(str(c.value or "")) for c in col_cells)
                col_letter = get_column_letter(col_cells[0].column)
                sheet.column_dimensions[col_letter].width = min(max(max_len + 3, 14), 45)

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer
