"""
KPI Definition Service.
Manages KPI configuration lifecycle: creation, validation, updating,
dependency DAG cycle detection, and cloning.
"""

from typing import Dict, Any, List, Set, Optional
from django.core.exceptions import ValidationError
from common.database.transactions import atomic_operation
from apps.kpi.models import (
    KPIDefinition,
    KPIParameter,
    KPIFilter,
    KPIDependency,
)
from apps.kpi.services.formula_evaluator import SafeFormulaEvaluator
from apps.kpi.services.kpi_logic_parser import KPILogicParser, KPILogicParseError
from apps.organization.models import Domain
from apps.imports.models import UploadTemplate, ImportStagedRow


class KPIDefinitionService:
    @classmethod
    def validate_comparisons(cls, comparisons: List[Dict[str, Any]], source_dataset: Optional[UploadTemplate] = None):
        """
        Validates comparison items against the uploaded dataset schema.
        Ensures Achieved Data Column exists in the applicable uploaded schema.
        """
        if not comparisons or not isinstance(comparisons, list):
            return

        for comp in comparisons:
            if not isinstance(comp, dict) or not comp.get("is_enabled", True):
                continue

            col_name = (
                comp.get("achieved_data_column")
                or (comp.get("data_source") or {}).get("metric_field")
                or ""
            ).strip()

            if not col_name:
                continue

            ds_id = (comp.get("data_source") or {}).get("dataset_id")
            template = None
            if ds_id:
                template = UploadTemplate.objects.filter(id=ds_id).first()
            elif source_dataset:
                template = source_dataset

            if template:
                from apps.imports.services.upload_validation_service import UploadValidationService
                clean_target = UploadValidationService._sanitize_header(col_name)
                norm_target = col_name.strip().lower()

                valid_cols = set()
                # Check version columns
                for v in template.versions.all():
                    for col in v.columns.all():
                        valid_cols.add(UploadValidationService._sanitize_header(col.display_label))
                        valid_cols.add(UploadValidationService._sanitize_header(col.name))
                        valid_cols.add(col.display_label.strip().lower())
                        valid_cols.add(col.name.strip().lower())

                # Check staged row keys
                staged_sample = ImportStagedRow.objects.filter(batch__template_version__template=template).order_by("-id").first()
                if staged_sample and isinstance(staged_sample.raw_data, dict):
                    for k in staged_sample.raw_data.keys():
                        valid_cols.add(UploadValidationService._sanitize_header(k))
                        valid_cols.add(str(k).strip().lower())

                if valid_cols and clean_target not in valid_cols and norm_target not in valid_cols:
                    raise ValidationError(
                        f"Achieved Data Column '{col_name}' does not exist in uploaded dataset '{template.name}'."
                    )

    @classmethod
    def detect_dependency_cycle(cls, kpi_id: int, proposed_dependency_ids: List[int]) -> bool:
        """
        Uses depth-first search to ensure adding dependencies does not introduce a cyclic graph.
        Returns True if a cycle is detected.
        """
        visited: Set[int] = set()
        rec_stack: Set[int] = set()

        # Build adjacency graph
        adj: Dict[int, Set[int]] = {}
        for dep in KPIDependency.objects.all().values("kpi_id", "depends_on_id"):
            adj.setdefault(dep["kpi_id"], set()).add(dep["depends_on_id"])

        # Inject proposed dependencies
        adj.setdefault(kpi_id, set()).update(proposed_dependency_ids)

        def _has_cycle(node: int) -> bool:
            visited.add(node)
            rec_stack.add(node)

            for neighbor in adj.get(node, set()):
                if neighbor not in visited:
                    if _has_cycle(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True

            rec_stack.remove(node)
            return False

        for node in list(adj.keys()):
            if node not in visited:
                if _has_cycle(node):
                    return True
        return False

    @classmethod
    def create_definition(cls, data: Dict[str, Any], user=None) -> KPIDefinition:
        """Creates a KPIDefinition with associated parameters, filters, and dependencies."""
        parameters = data.pop("parameters", [])
        filters = data.pop("filters", [])
        dependencies = data.pop("dependencies", [])
        logic_expr = data.get("logic_expression", "").strip()

        # Auto-transpile logic_expression if provided and parameters/filters are empty
        if logic_expr and (not parameters or not filters):
            try:
                parsed = KPILogicParser.parse_logic_expression(logic_expr, existing_parameters=parameters)
                if not filters and parsed.get("filters"):
                    filters = parsed["filters"]
                if not parameters and parsed.get("parameters"):
                    parameters = parsed["parameters"]
                if parsed.get("formula_expression") and not data.get("formula_expression"):
                    data["formula_expression"] = parsed["formula_expression"]
                if parsed.get("calculation_type") and "calculation_type" not in data:
                    data["calculation_type"] = parsed["calculation_type"]
            except KPILogicParseError as parse_err:
                raise ValidationError(str(parse_err))

        # Validate formula if calculation type is FORMULA
        calc_type = data.get("calculation_type", KPIDefinition.CalculationType.SIMPLE_AGGREGATE)
        formula_expr = data.get("formula_expression", "").strip()

        param_names = {p["name"] for p in parameters if "name" in p}
        for d in dependencies:
            if "parameter_name" in d:
                param_names.add(d["parameter_name"])

        if calc_type in [KPIDefinition.CalculationType.FORMULA, KPIDefinition.CalculationType.DERIVED] and formula_expr:
            is_valid, err_msg, found_vars = SafeFormulaEvaluator.validate_syntax(formula_expr, allowed_variables=param_names)
            if not is_valid:
                raise ValidationError(f"Formula validation failed: {err_msg}")

        # Resolve integer foreign keys if passed as primitives
        if "domain" in data and isinstance(data["domain"], int):
            data["domain"] = Domain.objects.filter(id=data["domain"]).first()
        if "source_dataset" in data and isinstance(data["source_dataset"], int):
            data["source_dataset"] = UploadTemplate.objects.filter(id=data["source_dataset"]).first()

        with atomic_operation():
            kpi = KPIDefinition.objects.create(created_by=user, **data)

            for param in parameters:
                KPIParameter.objects.create(
                    kpi=kpi,
                    name=param["name"],
                    label=param.get("label", param["name"]),
                    source_column=param.get("source_column", param["name"]),
                    aggregation=param.get("aggregation", KPIParameter.Aggregation.SUM),
                    default_value=param.get("default_value"),
                )

            for flt in filters:
                KPIFilter.objects.create(
                    kpi=kpi,
                    field_name=flt["field_name"],
                    operator=flt.get("operator", KPIFilter.Operator.EQUALS),
                    value=flt.get("value", ""),
                    conjunction=flt.get("conjunction", "AND"),
                )

            # Dependencies
            dep_ids = [d["depends_on_id"] for d in dependencies if "depends_on_id" in d]
            if dep_ids:
                if cls.detect_dependency_cycle(kpi.id, dep_ids):
                    raise ValidationError("Circular KPI dependency detected. A derived KPI cannot depend on itself directly or indirectly.")

                for dep in dependencies:
                    KPIDependency.objects.create(
                        kpi=kpi,
                        depends_on_id=dep["depends_on_id"],
                        parameter_name=dep["parameter_name"],
                    )

        return kpi

    @classmethod
    def update_definition(cls, kpi: KPIDefinition, data: Dict[str, Any], user=None) -> KPIDefinition:
        parameters = data.pop("parameters", None)
        filters = data.pop("filters", None)
        dependencies = data.pop("dependencies", None)

        logic_expr = data.get("logic_expression", "").strip()
        if logic_expr and (parameters is None and filters is None):
            try:
                parsed = KPILogicParser.parse_logic_expression(logic_expr)
                if parsed.get("filters"):
                    filters = parsed["filters"]
                if parsed.get("parameters"):
                    parameters = parsed["parameters"]
                if parsed.get("formula_expression") and "formula_expression" not in data:
                    data["formula_expression"] = parsed["formula_expression"]
            except KPILogicParseError as parse_err:
                raise ValidationError(str(parse_err))

        calc_type = data.get("calculation_type", kpi.calculation_type)
        formula_expr = data.get("formula_expression", kpi.formula_expression)

        if parameters is not None or dependencies is not None:
            param_names = set()
            if parameters is not None:
                param_names.update(p["name"] for p in parameters if "name" in p)
            else:
                param_names.update(kpi.parameters.values_list("name", flat=True))

            if dependencies is not None:
                param_names.update(d["parameter_name"] for d in dependencies if "parameter_name" in d)
            else:
                param_names.update(kpi.dependencies.values_list("parameter_name", flat=True))

            if calc_type in [KPIDefinition.CalculationType.FORMULA, KPIDefinition.CalculationType.DERIVED] and formula_expr:
                is_valid, err_msg, _ = SafeFormulaEvaluator.validate_syntax(formula_expr, allowed_variables=param_names)
                if not is_valid:
                    raise ValidationError(f"Formula validation failed: {err_msg}")

        # Resolve integer foreign keys if passed as primitives
        if "domain" in data and isinstance(data["domain"], int):
            data["domain"] = Domain.objects.filter(id=data["domain"]).first()
        if "source_dataset" in data and isinstance(data["source_dataset"], int):
            data["source_dataset"] = UploadTemplate.objects.filter(id=data["source_dataset"]).first()

        with atomic_operation():
            for attr, val in data.items():
                setattr(kpi, attr, val)
            kpi.save()

            if parameters is not None:
                kpi.parameters.all().delete()
                for param in parameters:
                    KPIParameter.objects.create(
                        kpi=kpi,
                        name=param["name"],
                        label=param.get("label", param["name"]),
                        source_column=param.get("source_column", param["name"]),
                        aggregation=param.get("aggregation", KPIParameter.Aggregation.SUM),
                        default_value=param.get("default_value"),
                    )

            if filters is not None:
                kpi.filters.all().delete()
                for flt in filters:
                    KPIFilter.objects.create(
                        kpi=kpi,
                        field_name=flt["field_name"],
                        operator=flt.get("operator", KPIFilter.Operator.EQUALS),
                        value=flt.get("value", ""),
                        conjunction=flt.get("conjunction", "AND"),
                    )

            if dependencies is not None:
                dep_ids = [d["depends_on_id"] for d in dependencies if "depends_on_id" in d]
                if dep_ids and cls.detect_dependency_cycle(kpi.id, dep_ids):
                    raise ValidationError("Circular KPI dependency detected.")

                kpi.dependencies.all().delete()
                for dep in dependencies:
                    KPIDependency.objects.create(
                        kpi=kpi,
                        depends_on_id=dep["depends_on_id"],
                        parameter_name=dep["parameter_name"],
                    )

        return kpi

    @classmethod
    def duplicate_definition(cls, kpi: KPIDefinition, user=None) -> KPIDefinition:
        """Creates an identical copy with a unique code and duplicate suffix."""
        base_code = f"{kpi.code}_COPY"
        unique_code = base_code
        counter = 1
        while KPIDefinition.objects.filter(code=unique_code).exists():
            unique_code = f"{base_code}_{counter}"
            counter += 1

        with atomic_operation():
            new_kpi = KPIDefinition.objects.create(
                code=unique_code,
                name=f"{kpi.name} (Copy)",
                description=kpi.description,
                domain=kpi.domain,
                hierarchy_level=kpi.hierarchy_level,
                calculation_type=kpi.calculation_type,
                source_dataset=kpi.source_dataset,
                formula_expression=kpi.formula_expression,
                aggregation_method=kpi.aggregation_method,
                unit=kpi.unit,
                decimal_precision=kpi.decimal_precision,
                direction=kpi.direction,
                target_value=kpi.target_value,
                target_field=kpi.target_field,
                comparison_method=kpi.comparison_method,
                threshold_green=kpi.threshold_green,
                threshold_amber=kpi.threshold_amber,
                presentation_config=kpi.presentation_config,
                is_active=True,
                is_executive=kpi.is_executive,
                display_order=kpi.display_order + 1,
                created_by=user,
            )

            for p in kpi.parameters.all():
                KPIParameter.objects.create(
                    kpi=new_kpi,
                    name=p.name,
                    label=p.label,
                    source_column=p.source_column,
                    aggregation=p.aggregation,
                    default_value=p.default_value,
                )

            for f in kpi.filters.all():
                KPIFilter.objects.create(
                    kpi=new_kpi,
                    field_name=f.field_name,
                    operator=f.operator,
                    value=f.value,
                )

            for d in kpi.dependencies.all():
                KPIDependency.objects.create(
                    kpi=new_kpi,
                    depends_on=d.depends_on,
                    parameter_name=d.parameter_name,
                )

        return new_kpi
