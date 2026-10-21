from typing import Optional
from rest_framework import serializers
from apps.kpi.models import (
    KPIDefinition,
    KPIParameter,
    KPIFilter,
    KPIDependency,
    KPICalculationResult,
    KPICalculationAuditLog,
)
from apps.organization.models import Domain
from apps.imports.models import UploadTemplate


class KPIParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model = KPIParameter
        fields = ["id", "name", "label", "source_column", "aggregation", "default_value"]


class KPIFilterSerializer(serializers.ModelSerializer):
    class Meta:
        model = KPIFilter
        fields = ["id", "field_name", "operator", "value", "conjunction"]


class KPIDependencySerializer(serializers.ModelSerializer):
    depends_on_code = serializers.CharField(source="depends_on.code", read_only=True)
    depends_on_name = serializers.CharField(source="depends_on.name", read_only=True)

    class Meta:
        model = KPIDependency
        fields = ["id", "depends_on", "depends_on_code", "depends_on_name", "parameter_name"]


class KPIDefinitionSerializer(serializers.ModelSerializer):
    parameters = KPIParameterSerializer(many=True, required=False)
    filters = KPIFilterSerializer(many=True, required=False)
    dependencies = KPIDependencySerializer(many=True, required=False)
    domain_name = serializers.CharField(source="domain.name", read_only=True)
    source_dataset_name = serializers.CharField(source="source_dataset.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    hierarchy_node_name = serializers.SerializerMethodField()
    comparisons = serializers.SerializerMethodField()
    performance_colors = serializers.SerializerMethodField()
    visualization_style = serializers.SerializerMethodField()

    class Meta:
        model = KPIDefinition
        fields = [
            "id",
            "code",
            "name",
            "description",
            "domain",
            "domain_name",
            "hierarchy_level",
            "hierarchy_id",
            "hierarchy_node_name",
            "visualization_type",
            "visualization_style",
            "calculation_type",
            "source_dataset",
            "source_dataset_name",
            "natural_language_rule",
            "logic_expression",
            "formula_expression",
            "presentation_config",
            "comparisons",
            "performance_colors",
            "aggregation_method",
            "unit",
            "decimal_precision",
            "direction",
            "target_value",
            "target_field",
            "comparison_method",
            "threshold_green",
            "threshold_amber",
            "is_active",
            "is_executive",
            "display_order",
            "parameters",
            "filters",
            "dependencies",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "created_by_name", "hierarchy_node_name"]

    def get_hierarchy_node_name(self, obj: KPIDefinition) -> str:
        if not obj.hierarchy_id:
            return "Dynamic Viewer Scope"
        from apps.kpi.services.kpi_engine_service import KPIEngineService
        return KPIEngineService.get_node_display_name(obj.hierarchy_level, obj.hierarchy_id)

    def get_comparisons(self, obj: KPIDefinition):
        p_cfg = getattr(obj, "presentation_config", {}) or {}
        comps = p_cfg.get("comparisons")
        if comps is not None:
            return comps
        if obj.target_value is not None:
            dir_val = "HIGHER_BETTER"
            if obj.direction == KPIDefinition.Direction.LOWER_BETTER:
                dir_val = "LOWER_BETTER"
            elif obj.direction == KPIDefinition.Direction.NEUTRAL:
                dir_val = "EXACT_TARGET"
            return [
                {
                    "id": f"comp_{obj.id or 1}",
                    "name": obj.name,
                    "metric_label": obj.name,
                    "unit": obj.unit or "Units",
                    "target_value": float(obj.target_value),
                    "actual_value": float(obj.target_value),
                    "performance_direction": dir_val,
                    "warning_threshold": float(obj.threshold_amber) if obj.threshold_amber else None,
                    "critical_threshold": None,
                    "display_color": "#10B981",
                    "is_enabled": True,
                    "is_manual": True,
                }
            ]
        return []

    def get_performance_colors(self, obj: KPIDefinition):
        p_cfg = getattr(obj, "presentation_config", {}) or {}
        return p_cfg.get("performance_colors", {
            "meets_target": "#10B981",
            "below_target": "#EF4444",
            "exceeded_limit": "#8B5CF6",
            "warning": "#F59E0B",
            "critical": "#DC2626",
        })

    def get_visualization_style(self, obj: KPIDefinition):
        p_cfg = getattr(obj, "presentation_config", {}) or {}
        return p_cfg.get("visualization_style", obj.visualization_type)

    def to_internal_value(self, data):
        ret = super().to_internal_value(data)
        p_cfg = ret.get("presentation_config") or {}
        if not isinstance(p_cfg, dict):
            p_cfg = {}

        if "comparisons" in data:
            raw_comps = data["comparisons"]
            comps = []
            if isinstance(raw_comps, list):
                for c in raw_comps:
                    if isinstance(c, dict):
                        std_val = c.get("standard_value", c.get("target_value"))
                        col_val = c.get("achieved_data_column") or (c.get("data_source") or {}).get("metric_field") or ""
                        ds = dict(c.get("data_source") or {})
                        ds["metric_field"] = col_val
                        if c.get("is_manual") or (not col_val and c.get("actual_value") not in (None, "")):
                            ds["source_type"] = "MANUAL"
                        elif col_val or ds.get("dataset_id"):
                            ds["source_type"] = "UPLOAD"
                        else:
                            ds["source_type"] = ds.get("source_type") or "MANUAL"
                        raw_rules = c.get("rules")
                        norm_rules = []
                        if isinstance(raw_rules, list) and len(raw_rules) > 0:
                            for idx, r in enumerate(raw_rules):
                                if isinstance(r, dict):
                                    r_col = (r.get("achieved_data_column") or "").strip()
                                    r_std = r.get("standard_value", r.get("target_value"))
                                    r_pdir = r.get("performance_direction") or "HIGHER_BETTER"
                                    norm_rules.append({
                                        **r,
                                        "id": r.get("id") or f"rule-{idx+1}",
                                        "achieved_data_column": r_col,
                                        "standard_value": r_std,
                                        "target_value": r_std,
                                        "performance_direction": r_pdir,
                                    })
                        else:
                            if col_val or std_val is not None:
                                norm_rules.append({
                                    "id": f"{c.get('id', 'rule')}-1",
                                    "achieved_data_column": col_val,
                                    "standard_value": std_val,
                                    "target_value": std_val,
                                    "performance_direction": c.get("performance_direction", "HIGHER_BETTER"),
                                })

                        if norm_rules:
                            primary_r = norm_rules[0]
                            col_val = primary_r["achieved_data_column"]
                            std_val = primary_r["standard_value"]
                            ds["metric_field"] = col_val

                        normalized = {
                            **c,
                            "rules": norm_rules,
                            "standard_value": std_val,
                            "target_value": std_val,
                            "achieved_data_column": col_val,
                            "performance_direction": (norm_rules[0]["performance_direction"] if norm_rules else c.get("performance_direction", "HIGHER_BETTER")),
                            "data_source": ds,
                        }
                        comps.append(normalized)
            p_cfg["comparisons"] = comps
            ret["presentation_config"] = p_cfg
            if comps and len(comps) > 0:
                primary = comps[0]
                if "target_value" in primary and primary["target_value"] not in (None, ""):
                    try:
                        ret["target_value"] = primary["target_value"]
                    except Exception:
                        pass
                if "unit" in primary and primary["unit"]:
                    ret["unit"] = primary["unit"]
                if "performance_direction" in primary:
                    pdir = primary["performance_direction"]
                    if pdir == "LOWER_BETTER":
                        ret["direction"] = KPIDefinition.Direction.LOWER_BETTER
                    elif pdir == "EXACT_TARGET":
                        ret["direction"] = KPIDefinition.Direction.NEUTRAL
                    else:
                        ret["direction"] = KPIDefinition.Direction.HIGHER_BETTER

                primary_col = primary.get("achieved_data_column") or (primary.get("data_source") or {}).get("metric_field")
                if primary_col:
                    ret["formula_expression"] = primary_col

                if "data_source" in primary and isinstance(primary["data_source"], dict):
                    ds_info = primary["data_source"]
                    if ds_info.get("dataset_id") and not ret.get("source_dataset"):
                        from apps.imports.models import UploadTemplate
                        ds_obj = UploadTemplate.objects.filter(id=ds_info["dataset_id"]).first()
                        if ds_obj:
                            ret["source_dataset"] = ds_obj

        if "performance_colors" in data:
            p_cfg["performance_colors"] = data["performance_colors"]

        if "visualization_style" in data:
            p_cfg["visualization_style"] = data["visualization_style"]
            v_style = data["visualization_style"]
            if v_style in KPIDefinition.VisualizationType.values:
                ret["visualization_type"] = v_style

        ret["presentation_config"] = p_cfg
        return ret


class KPICalculateRequestSerializer(serializers.Serializer):
    period_id = serializers.IntegerField(required=False, default=None)
    hierarchy_level = serializers.CharField(required=False, default=None)
    hierarchy_id = serializers.IntegerField(required=False, default=None)


class KPITestLogicRequestSerializer(serializers.Serializer):
    dataset_id = serializers.IntegerField(required=False, allow_null=True)
    natural_language_rule = serializers.CharField(required=False, allow_blank=True, default="")
    logic_expression = serializers.CharField(required=False, allow_blank=True, default="")
    formula_expression = serializers.CharField(required=False, allow_blank=True, default="")
    calculation_type = serializers.CharField(required=False, default="formula")
    filters = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    parameters = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    group_by = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    presentation_config = serializers.DictField(required=False, default=dict)
    hierarchy_level = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    hierarchy_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    period_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    unit = serializers.CharField(required=False, allow_blank=True, default="")


class KPIFormulaValidationSerializer(serializers.Serializer):
    formula = serializers.CharField(allow_blank=True)
    variables = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class KPIFormulaPreviewSerializer(serializers.Serializer):
    dataset_id = serializers.IntegerField(required=False, allow_null=True)
    formula = serializers.CharField(allow_blank=False)
    input_column = serializers.CharField(required=False, allow_blank=True, default="")
    constants = serializers.DictField(required=False, default=dict)
    decimal_precision = serializers.IntegerField(required=False, default=2)
    input_unit = serializers.CharField(required=False, allow_blank=True, default="")
    output_unit = serializers.CharField(required=False, allow_blank=True, default="")
    period_id = serializers.IntegerField(required=False, allow_null=True)
    limit = serializers.IntegerField(required=False, default=5)


class KPICalculationResultSerializer(serializers.ModelSerializer):
    kpi_code = serializers.CharField(source="kpi.code", read_only=True)
    kpi_name = serializers.CharField(source="kpi.name", read_only=True)
    unit = serializers.CharField(source="kpi.unit", read_only=True)

    class Meta:
        model = KPICalculationResult
        fields = [
            "id",
            "kpi",
            "kpi_code",
            "kpi_name",
            "unit",
            "reporting_period",
            "hierarchy_level",
            "hierarchy_id",
            "hierarchy_name",
            "calculated_value",
            "target_value",
            "variance_to_target",
            "variance_percentage",
            "achievement_percentage",
            "rag_status",
            "records_considered",
            "records_excluded",
            "calculation_status",
            "error_message",
            "lineage_info",
            "calculated_at",
        ]
