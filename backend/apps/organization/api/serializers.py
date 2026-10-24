"""
REST Serializers for Organization Hierarchy.
"""

from rest_framework import serializers
from apps.organization.constants import HIERARCHY_LEVELS


class CreateNodeSerializer(serializers.Serializer):
    level = serializers.ChoiceField(choices=HIERARCHY_LEVELS)
    name = serializers.CharField(max_length=200)
    code = serializers.CharField(max_length=50)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    parent_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    extra_fields = serializers.DictField(required=False, default=dict)


class UpdateNodeSerializer(serializers.Serializer):
    level = serializers.ChoiceField(choices=HIERARCHY_LEVELS)
    name = serializers.CharField(max_length=200)
    code = serializers.CharField(max_length=50)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    status = serializers.ChoiceField(choices=["ACTIVE", "INACTIVE"], default="ACTIVE")
    parent_id = serializers.IntegerField(required=False, allow_null=True, default=None)
