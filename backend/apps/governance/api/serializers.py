from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from apps.governance.models import GovernanceActionPoint, GovernanceTargetRevision, GovernanceEvidence
from apps.organization.models import Circle
from apps.identity.models import User


class OwnerAssignmentField(serializers.Field):
    """
    Accepts user ID (int or str), username, or registered email address and resolves to canonical User instance.
    """
    def to_internal_value(self, data):
        if data is None or data == "" or data == 0:
            return None
        from apps.governance.services.governance_service import GovernanceService
        try:
            return GovernanceService.resolve_user_identity(data)
        except DjangoValidationError as e:
            msg = e.message_dict.get("owner", str(e)) if hasattr(e, "message_dict") else str(e)
            if isinstance(msg, list):
                msg = msg[0]
            raise serializers.ValidationError(msg)

    def to_representation(self, value):
        if not value:
            return None
        return SimpleUserSerializer(value).data


class SimpleUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "email", "role"]

    def get_full_name(self, obj) -> str:
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name or obj.username


class SimpleCircleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Circle
        fields = ["id", "name", "code", "region"]


class GovernanceTargetRevisionSerializer(serializers.ModelSerializer):
    revised_by = SimpleUserSerializer(read_only=True)

    class Meta:
        model = GovernanceTargetRevision
        fields = [
            "id",
            "revision_number",
            "previous_target",
            "revised_target",
            "revision_date",
            "revised_by",
            "reason",
            "approved_by",
            "created_at",
        ]


class GovernanceEvidenceSerializer(serializers.ModelSerializer):
    submitted_by = SimpleUserSerializer(read_only=True)
    reviewed_by = SimpleUserSerializer(read_only=True)
    action_id = serializers.CharField(source="action_point.action_id", read_only=True)
    action_point_title = serializers.CharField(source="action_point.action_point", read_only=True)
    circle_code = serializers.CharField(source="action_point.circle.code", read_only=True)

    class Meta:
        model = GovernanceEvidence
        fields = [
            "id",
            "action_point",
            "action_id",
            "action_point_title",
            "circle_code",
            "version",
            "title",
            "description",
            "file_name",
            "file_size",
            "file_type",
            "submitted_by",
            "submitted_at",
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_comment",
        ]
        read_only_fields = [
            "id",
            "version",
            "file_name",
            "file_size",
            "file_type",
            "submitted_by",
            "submitted_at",
            "status",
            "reviewed_by",
            "reviewed_at",
        ]


class GovernanceActionPointSerializer(serializers.ModelSerializer):
    circle = SimpleCircleSerializer(read_only=True)
    circle_id = serializers.PrimaryKeyRelatedField(
        queryset=Circle.objects.all(),
        source="circle",
        write_only=True,
        required=True,
    )
    owner = SimpleUserSerializer(read_only=True)
    owner_id = OwnerAssignmentField(
        source="owner",
        write_only=True,
        required=False,
        allow_null=True,
    )
    assigned_by = SimpleUserSerializer(read_only=True)
    created_by = SimpleUserSerializer(read_only=True)
    revisions = GovernanceTargetRevisionSerializer(many=True, read_only=True)
    evidence_items = GovernanceEvidenceSerializer(many=True, read_only=True)

    def to_internal_value(self, data):
        data_copy = dict(data) if isinstance(data, dict) else data
        # Normalize owner, assignee, or email into owner_id for consistent resolution
        if isinstance(data_copy, dict):
            if "owner_id" not in data_copy or data_copy["owner_id"] is None or data_copy["owner_id"] == "":
                if "owner" in data_copy and data_copy["owner"]:
                    data_copy["owner_id"] = data_copy["owner"]
                elif "assignee" in data_copy and data_copy["assignee"]:
                    data_copy["owner_id"] = data_copy["assignee"]
        return super().to_internal_value(data_copy)

    class Meta:
        model = GovernanceActionPoint
        fields = [
            "id",
            "action_id",
            "circle",
            "circle_id",
            "hierarchy_level",
            "hierarchy_node_id",
            "hierarchy_path",
            "domain",
            "department",
            "sub_department",
            "function_area",
            "action_point",
            "key_deliverable",
            "owner",
            "owner_id",
            "owner_name_override",
            "assigned_by",
            "raised_date",
            "target_closure_date",
            "current_target_date",
            "revision_count",
            "status",
            "actual_closure_date",
            "current_progress_percent",
            "ageing_days",
            "ageing_bucket",
            "weeks_in_review",
            "reporting_week",
            "priority",
            "is_escalated",
            "is_overdue",
            "evidence_status",
            "evidence_required",
            "last_update",
            "revisions",
            "evidence_items",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "action_id",
            "current_target_date",
            "revision_count",
            "ageing_days",
            "ageing_bucket",
            "weeks_in_review",
            "is_escalated",
            "is_overdue",
            "evidence_status",
            "created_at",
            "updated_at",
        ]


class GovernanceWeeklyUpdateSerializer(serializers.ModelSerializer):
    submitted_by = SimpleUserSerializer(read_only=True)
    action_id = serializers.CharField(source="action_point.action_id", read_only=True)
    action_point_title = serializers.CharField(source="action_point.action_point", read_only=True)

    class Meta:
        from apps.governance.models import GovernanceWeeklyUpdate
        model = GovernanceWeeklyUpdate
        fields = [
            "id",
            "action_point",
            "action_id",
            "action_point_title",
            "reporting_week",
            "week_start_date",
            "week_end_date",
            "work_completed",
            "progress_percent",
            "achievements",
            "blockers",
            "next_week_plan",
            "status",
            "actual_closure_date",
            "remarks",
            "submitted_by",
            "submitted_at",
            "updated_at",
            "revision_number",
        ]
        read_only_fields = [
            "id",
            "submitted_by",
            "submitted_at",
            "updated_at",
            "revision_number",
        ]


class ReviseTargetSerializer(serializers.Serializer):
    new_target_date = serializers.DateField(required=True)
    reason = serializers.CharField(required=True, allow_blank=False, max_length=500)
    approved_by = serializers.CharField(required=False, allow_blank=True, default="", max_length=150)


class ReviewEvidenceSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["Accepted", "Rework Required"], required=True)
    review_comment = serializers.CharField(required=False, allow_blank=True, default="", max_length=1000)


class GovernanceActionBulkUpdateSerializer(serializers.Serializer):
    task_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    owner_id = OwnerAssignmentField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=GovernanceActionPoint.Status.choices, required=False)
    priority = serializers.ChoiceField(choices=GovernanceActionPoint.Priority.choices, required=False)
    target_closure_date = serializers.DateField(required=False)


class GovernanceWeeklyBulkSubmitSerializer(serializers.Serializer):
    task_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    reporting_week = serializers.CharField(max_length=30)
    work_completed = serializers.CharField()
    progress_percent = serializers.IntegerField(default=0, min_value=0, max_value=100)
    achievements = serializers.CharField(required=False, allow_blank=True, default="")
    blockers = serializers.CharField(required=False, allow_blank=True, default="")
    next_week_plan = serializers.CharField(required=False, allow_blank=True, default="")
    status = serializers.ChoiceField(choices=GovernanceActionPoint.Status.choices, required=False, default=GovernanceActionPoint.Status.WIP)
    allow_revision = serializers.BooleanField(required=False, default=False)


class GovernanceEvidenceBulkReviewSerializer(serializers.Serializer):
    evidence_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    decision = serializers.ChoiceField(choices=["Accepted", "Rework Required"])
    review_comment = serializers.CharField(required=False, allow_blank=True, default="")


class GovernanceTargetRevisionRequestSerializer(serializers.ModelSerializer):
    requested_by = SimpleUserSerializer(read_only=True)
    reviewed_by = SimpleUserSerializer(read_only=True)
    action_id = serializers.CharField(source="action_point.action_id", read_only=True)
    action_point_title = serializers.CharField(source="action_point.action_point", read_only=True)
    circle_name = serializers.CharField(source="action_point.circle.name", read_only=True, default="")
    owner_name = serializers.SerializerMethodField()

    class Meta:
        from apps.governance.models import GovernanceTargetRevisionRequest
        model = GovernanceTargetRevisionRequest
        fields = [
            "id",
            "action_point",
            "action_id",
            "action_point_title",
            "circle_name",
            "owner_name",
            "requested_by",
            "original_target_date",
            "current_target_date",
            "requested_target_date",
            "reason",
            "status",
            "requested_at",
            "reviewed_by",
            "reviewed_at",
            "reviewer_comment",
        ]
        read_only_fields = [
            "id",
            "action_point",
            "action_id",
            "action_point_title",
            "circle_name",
            "owner_name",
            "requested_by",
            "original_target_date",
            "current_target_date",
            "status",
            "requested_at",
            "reviewed_by",
            "reviewed_at",
            "reviewer_comment",
        ]

    def get_owner_name(self, obj) -> str:
        if obj.action_point.owner:
            return obj.action_point.owner.get_full_name() or obj.action_point.owner.username
        return obj.action_point.owner_name_override or "Unassigned"


class CreateTargetRevisionRequestSerializer(serializers.Serializer):
    requested_target_date = serializers.DateField(required=True)
    reason = serializers.CharField(required=True, allow_blank=False, max_length=1000)


class ReviewTargetRevisionRequestSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["Approved", "Rejected"], required=True)
    reviewer_comment = serializers.CharField(required=False, allow_blank=True, default="", max_length=1000)


