"""
Serializers for Uploads Module API.
Strict validation at API boundary, serialization, and response formatting.
"""

from rest_framework import serializers
from apps.imports.models import (
    UploadTemplate,
    UploadTemplateVersion,
    UploadTemplateColumn,
    ImportBatch,
    ImportValidationError,
    ImportStagedRow,
    ImportAuditLineage,
)


class UploadTemplateColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadTemplateColumn
        fields = [
            "id",
            "name",
            "display_label",
            "data_type",
            "is_required",
            "is_unique",
            "column_order",
            "default_value",
            "description",
            "validation_rules",
        ]


class UploadTemplateVersionSerializer(serializers.ModelSerializer):
    columns = UploadTemplateColumnSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = UploadTemplateVersion
        fields = [
            "id",
            "version_number",
            "changelog",
            "is_active",
            "created_by_name",
            "created_at",
            "columns",
        ]

    def get_created_by_name(self, obj) -> str:
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return "System"


class UploadTemplateListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    latest_version_id = serializers.SerializerMethodField()
    latest_version_number = serializers.SerializerMethodField()
    columns_count = serializers.SerializerMethodField()
    batches_count = serializers.SerializerMethodField()

    class Meta:
        model = UploadTemplate
        fields = [
            "id",
            "name",
            "code",
            "description",
            "data_level",
            "status",
            "target_entity",
            "created_by_name",
            "created_at",
            "updated_at",
            "latest_version_id",
            "latest_version_number",
            "columns_count",
            "batches_count",
        ]

    def get_created_by_name(self, obj) -> str:
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return "System"

    def get_latest_version_id(self, obj):
        latest = obj.versions.order_by("-version_number").first()
        return latest.id if latest else None

    def get_latest_version_number(self, obj) -> int:
        latest = obj.versions.order_by("-version_number").first()
        return latest.version_number if latest else 1

    def get_columns_count(self, obj) -> int:
        latest = obj.versions.order_by("-version_number").first()
        return latest.columns.count() if latest else 0

    def get_batches_count(self, obj) -> int:
        # Count all batches across all versions of this template
        return ImportBatch.objects.filter(template_version__template=obj).count()


class UploadTemplateDetailSerializer(serializers.ModelSerializer):
    versions = UploadTemplateVersionSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    available_columns = serializers.SerializerMethodField()

    class Meta:
        model = UploadTemplate
        fields = [
            "id",
            "name",
            "code",
            "description",
            "data_level",
            "status",
            "target_entity",
            "created_by_name",
            "created_at",
            "updated_at",
            "versions",
            "available_columns",
        ]

    def get_created_by_name(self, obj) -> str:
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return "System"

    def get_available_columns(self, obj) -> list:
        cols = []
        seen = set()

        # 1. Defined columns from latest active version
        latest_version = obj.versions.filter(is_active=True).first() or obj.versions.order_by("-version_number").first()
        if latest_version:
            for c in latest_version.columns.all().order_by("column_order", "id"):
                header_name = c.display_label or c.name or ""
                if header_name and header_name not in seen:
                    seen.add(header_name)
                    cols.append({
                        "name": header_name,
                        "label": header_name,
                        "field_name": c.name,
                        "display_label": header_name,
                        "data_type": c.data_type,
                        "is_numeric": c.data_type in ["INTEGER", "DECIMAL", "PERCENTAGE", "NUMBER"],
                        "source": "TEMPLATE",
                    })

        # 2. Dynamic headers discovered from uploaded staged rows
        staged_sample = ImportStagedRow.objects.filter(
            batch__template_version__template=obj
        ).order_by("-id").first()

        if staged_sample and isinstance(staged_sample.raw_data, dict):
            for k, v in staged_sample.raw_data.items():
                if k and k not in seen:
                    seen.add(k)
                    is_num = False
                    d_type = "TEXT"
                    if v is not None and str(v).strip() != "":
                        try:
                            float(str(v).replace(",", "").replace("%", ""))
                            is_num = True
                            d_type = "PERCENTAGE" if "%" in str(v) or "uptime" in k.lower() else "DECIMAL"
                        except (ValueError, TypeError):
                            if any(dt in k.lower() for dt in ["date", "time", "day", "month", "year"]):
                                d_type = "DATE"
                            else:
                                d_type = "TEXT"
                    cols.append({
                        "name": k,
                        "label": k,
                        "data_type": d_type,
                        "is_numeric": is_num,
                        "source": "UPLOADED_DATASET",
                    })

        return cols


class ColumnInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    display_label = serializers.CharField(max_length=150, trim_whitespace=False)
    data_type = serializers.ChoiceField(choices=UploadTemplateColumn.DataType.choices, default="TEXT")
    is_required = serializers.BooleanField(default=False)
    is_unique = serializers.BooleanField(default=False)
    column_order = serializers.IntegerField(default=0)
    default_value = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    validation_rules = serializers.DictField(required=False, default=dict)


class CreateTemplateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    code = serializers.CharField(max_length=100, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    data_level = serializers.CharField(max_length=50, default="CIRCLE")
    target_entity = serializers.CharField(max_length=100, default="KPI_VALUES")
    columns = ColumnInputSerializer(many=True)


class CreateVersionSerializer(serializers.Serializer):
    changelog = serializers.CharField(required=False, allow_blank=True)
    columns = ColumnInputSerializer(many=True)


class UpdateVersionSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    data_level = serializers.CharField(max_length=50, required=False, allow_blank=True)
    changelog = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    columns = ColumnInputSerializer(many=True, required=False)


class ImportValidationErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportValidationError
        fields = [
            "id",
            "row_index",
            "column_name",
            "cell_value",
            "error_message",
            "severity",
            "created_at",
        ]


class ImportAuditLineageSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ImportAuditLineage
        fields = [
            "id",
            "action",
            "records_affected",
            "details",
            "performed_by_name",
            "created_at",
        ]

    def get_performed_by_name(self, obj) -> str:
        if obj.performed_by:
            return obj.performed_by.get_full_name() or obj.performed_by.username
        return "System"


class ImportBatchListSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source="template_version.template.name", read_only=True)
    template_id = serializers.IntegerField(source="template_version.template.id", read_only=True)
    template_version_number = serializers.IntegerField(source="template_version.version_number", read_only=True)
    reporting_period_name = serializers.CharField(source="reporting_period.name", read_only=True, default="")
    applied_kpi_id = serializers.IntegerField(source="applied_kpi.id", read_only=True, default=None)
    applied_kpi_code = serializers.CharField(source="applied_kpi.code", read_only=True, default="")
    applied_kpi_name = serializers.CharField(source="applied_kpi.name", read_only=True, default="")
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ImportBatch
        fields = [
            "id",
            "batch_id",
            "template_name",
            "template_id",
            "template_version_number",
            "reporting_period_id",
            "reporting_period_name",
            "applied_kpi_id",
            "applied_kpi_code",
            "applied_kpi_name",
            "kpi_execution_status",
            "kpi_result_summary",
            "uploaded_by_name",
            "original_filename",
            "file_size_bytes",
            "total_rows",
            "valid_rows",
            "error_rows",
            "status",
            "summary_notes",
            "created_at",
        ]

    def get_uploaded_by_name(self, obj) -> str:
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return "System"


class ImportBatchDetailSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source="template_version.template.name", read_only=True)
    template_id = serializers.IntegerField(source="template_version.template.id", read_only=True)
    template_data_level = serializers.CharField(source="template_version.template.data_level", read_only=True)
    template_version_number = serializers.IntegerField(source="template_version.version_number", read_only=True)
    reporting_period_name = serializers.CharField(source="reporting_period.name", read_only=True, default="")
    applied_kpi_id = serializers.IntegerField(source="applied_kpi.id", read_only=True, default=None)
    applied_kpi_code = serializers.CharField(source="applied_kpi.code", read_only=True, default="")
    applied_kpi_name = serializers.CharField(source="applied_kpi.name", read_only=True, default="")
    uploaded_by_name = serializers.SerializerMethodField()
    lineage_events = ImportAuditLineageSerializer(many=True, read_only=True)

    class Meta:
        model = ImportBatch
        fields = [
            "id",
            "batch_id",
            "template_name",
            "template_id",
            "template_data_level",
            "template_version_number",
            "reporting_period_id",
            "reporting_period_name",
            "applied_kpi_id",
            "applied_kpi_code",
            "applied_kpi_name",
            "kpi_execution_status",
            "kpi_result_summary",
            "uploaded_by_name",
            "original_filename",
            "file_size_bytes",
            "total_rows",
            "valid_rows",
            "error_rows",
            "status",
            "summary_notes",
            "created_at",
            "updated_at",
            "lineage_events",
        ]

    def get_uploaded_by_name(self, obj) -> str:
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return "System"
