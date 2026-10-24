"""
REST API Endpoints for Organization Hierarchy Module.
Fully dynamic, database-backed, zero hardcoded values.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError

from common.permissions.authorization import AuthorizationService
from apps.organization.selectors.organization_selectors import (
    get_hierarchy_tree,
    get_hierarchy_summary,
    get_cascading_options,
    get_node_details,
    search_hierarchy,
)
from apps.organization.services.organization_service import OrganizationHierarchyService
from apps.organization.api.serializers import CreateNodeSerializer, UpdateNodeSerializer


class HierarchyTreeView(APIView):
    """
    GET /api/v1/organization/tree/
    Returns organization hierarchy from DB filtered to user's authorized scope.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tree = get_hierarchy_tree(user=request.user)
        return Response({"success": True, "tree": tree})


class HierarchySummaryView(APIView):
    """
    GET /api/v1/organization/summary/
    Returns real-time aggregated counts for all tiers.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        counts = get_hierarchy_summary()
        return Response({"success": True, "counts": counts})


class HierarchyOptionsView(APIView):
    """
    GET /api/v1/organization/options/?level=SUB_COMPANY&parent_id=1
    Returns valid cascading options filtered to user's authorized scope.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        level = request.query_params.get("level", "").upper()
        parent_id = request.query_params.get("parent_id")
        parent_id_int = int(parent_id) if parent_id and parent_id.isdigit() else None

        company_id = request.query_params.get("company_id")
        company_id_int = int(company_id) if company_id and company_id.isdigit() else None

        sub_company_id = request.query_params.get("sub_company_id")
        sub_company_id_int = int(sub_company_id) if sub_company_id and sub_company_id.isdigit() else None

        project_id = request.query_params.get("project_id")
        project_id_int = int(project_id) if project_id and project_id.isdigit() else None

        parent_level = request.query_params.get("parent_level", "").upper() or None

        options = get_cascading_options(
            level,
            parent_id=parent_id_int,
            user=request.user,
            company_id=company_id_int,
            sub_company_id=sub_company_id_int,
            project_id=project_id_int,
            parent_level=parent_level,
        )
        return Response({"success": True, "level": level, "options": options})


class HierarchyNodeDetailView(APIView):
    """
    GET /api/v1/organization/nodes/<level>/<node_id>/
    Returns complete node metadata, parent, direct children, and audit events.
    Enforces organization scope boundary.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, level, node_id):
        details = get_node_details(level, node_id, user=request.user)
        if not details:
            return Response(
                {"success": False, "error": f"Node with level '{level}' and ID {node_id} not found or access denied."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"success": True, "data": details})


class CreateNodeView(APIView):
    """
    POST /api/v1/organization/nodes/
    Creates a new hierarchy node with parent-child validation.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        AuthorizationService.require(user=request.user, permission="organization.create")
        serializer = CreateNodeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            node = OrganizationHierarchyService.create_node(
                level=data["level"],
                name=data["name"],
                code=data["code"],
                description=data.get("description", ""),
                parent_id=data.get("parent_id"),
                extra_fields=data.get("extra_fields"),
                user=request.user,
                request=request,
            )
            return Response({"success": True, "node": node}, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"success": False, "error": str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UpdateNodeView(APIView):
    """
    PUT /api/v1/organization/nodes/<level>/<node_id>/
    Updates an existing hierarchy node.
    """
    permission_classes = [IsAuthenticated]

    def put(self, request, level, node_id):
        AuthorizationService.require(user=request.user, permission="organization.edit")
        serializer = UpdateNodeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            node = OrganizationHierarchyService.update_node(
                level=level,
                node_id=node_id,
                name=data["name"],
                code=data["code"],
                description=data.get("description", ""),
                status=data.get("status", "ACTIVE"),
                parent_id=data.get("parent_id"),
                user=request.user,
                request=request,
            )
            return Response({"success": True, "node": node})
        except ValidationError as e:
            return Response({"success": False, "error": str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DeleteNodeView(APIView):
    """
    DELETE /api/v1/organization/nodes/<level>/<node_id>/
    Safely deletes a node only if it has zero child elements.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, level, node_id):
        AuthorizationService.require(user=request.user, permission="organization.delete")
        try:
            result = OrganizationHierarchyService.delete_node(
                level=level,
                node_id=node_id,
                user=request.user,
                request=request,
            )
            return Response(result)
        except ValidationError as e:
            return Response({"success": False, "error": str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class HierarchySearchView(APIView):
    """
    GET /api/v1/organization/search/?q=<query>
    Performs real-time search across all organization levels within user scope.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "")
        results = search_hierarchy(query, user=request.user)
        return Response({"success": True, "results": results})
