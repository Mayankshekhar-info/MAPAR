from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse

from apps.dashboard.selectors.cockpit_selectors import get_filter_options
from apps.dashboard.services.cockpit_service import CockpitService
from apps.dashboard.services.slide_service import SlideService
from apps.dashboard.services.slide_table_service import SlideTableService
from apps.dashboard.services.slide_hierarchy_service import SlideHierarchyService


class HealthView(APIView):
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok"})


class CockpitFiltersView(APIView):
    """
    GET /api/v1/dashboard/filters/
    Returns real dynamic cascading filters from the database.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = get_filter_options(user=request.user)
        return Response({"success": True, "filters": data})


class CockpitSummaryView(APIView):
    """
    GET /api/v1/dashboard/summary/
    Returns Master Operational Summary Matrix with valid subtotals and grand totals.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get("company_id")
        sub_company_id = request.query_params.get("sub_company_id")
        project_id = request.query_params.get("project_id")
        circle_id = request.query_params.get("circle_id")
        domain_id = request.query_params.get("domain_id")
        department_id = request.query_params.get("department_id")
        period_id = request.query_params.get("period_id")
        status = request.query_params.get("status")
        search = request.query_params.get("search")

        def _to_int(val):
            return int(val) if val and val.isdigit() else None

        summary = CockpitService.get_master_summary(
            user=request.user,
            company_id=_to_int(company_id),
            sub_company_id=_to_int(sub_company_id),
            project_id=_to_int(project_id),
            circle_id=_to_int(circle_id),
            domain_id=_to_int(domain_id),
            department_id=_to_int(department_id),
            period_id=_to_int(period_id),
            status=status,
            search=search,
        )

        return Response({"success": True, "data": summary})


class CockpitDetailView(APIView):
    """
    GET /api/v1/dashboard/detail/?circle_id=1&domain_id=2
    Returns contextual detail breakdown table and linked observations & actions.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        circle_id = request.query_params.get("circle_id")
        if not circle_id or not circle_id.isdigit():
            return Response(
                {"success": False, "error": "circle_id is required"},
                status=400,
            )

        domain_id = request.query_params.get("domain_id")
        period_id = request.query_params.get("period_id")
        status = request.query_params.get("status")
        search = request.query_params.get("search")

        def _to_int(val):
            return int(val) if val and val.isdigit() else None

        detail = CockpitService.get_detail_breakdown(
            circle_id=int(circle_id),
            domain_id=_to_int(domain_id),
            period_id=_to_int(period_id),
            status=status,
            search=search,
            user=request.user,
        )

        return Response({"success": True, "data": detail})


class CockpitRecordDetailView(APIView):
    """
    GET /api/v1/dashboard/record/<id>/
    Returns level 3 deep record inspection with full 7-tier organizational context,
    metrics, audit history, and provenance.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        detail = SlideTableService.get_record_detail(record_id=pk, user=request.user)
        if not detail:
            return Response(
                {"success": False, "error": "Record not found or access denied for this organization scope."},
                status=404,
            )
        return Response({"success": True, "data": detail, "record": detail})


class CockpitExportView(APIView):
    """
    GET /api/v1/dashboard/export/
    Exports filtered authorized operational performance data to CSV.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        circle_id = request.query_params.get("circle_id")
        domain_id = request.query_params.get("domain_id")
        period_id = request.query_params.get("period_id")
        status = request.query_params.get("status")
        search = request.query_params.get("search")

        def _to_int(val):
            return int(val) if val and val.isdigit() else None

        csv_content = CockpitService.export_csv(
            user=request.user,
            circle_id=_to_int(circle_id),
            domain_id=_to_int(domain_id),
            period_id=_to_int(period_id),
            status=status,
            search=search,
        )

        response = HttpResponse(csv_content, content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="cockpit_operational_export.csv"'
        return response


class SlideViewDeckView(APIView):
    """
    GET /api/v1/dashboard/slides/
    Returns dynamic operational presentation deck with authorized slides,
    hierarchy breadcrumbs, KPI cards, and linked governance actions.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get("company_id")
        project_id = request.query_params.get("project_id")
        circle_id = request.query_params.get("circle_id")
        domain_id = request.query_params.get("domain_id")
        department_id = request.query_params.get("department_id")
        period_id = request.query_params.get("period_id")
        status = request.query_params.get("status")
        search = request.query_params.get("search")

        def _to_int(val):
            return int(val) if val and val.isdigit() else None

        deck = SlideService.get_slide_deck(
            user=request.user,
            company_id=_to_int(company_id),
            project_id=_to_int(project_id),
            circle_id=_to_int(circle_id),
            domain_id=_to_int(domain_id),
            department_id=_to_int(department_id),
            period_id=_to_int(period_id),
            status=status,
            search=search,
        )

        return Response({"success": True, "data": deck})


class SlideMasterTableView(APIView):
    """
    GET /api/v1/dashboard/slide-master/
    Returns interactive operational master matrix with grouped hierarchy rows,
    required/available/gap metrics, subtotal rows, and grand totals.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get("company_id")
        project_id = request.query_params.get("project_id")
        circle_id = request.query_params.get("circle_id")
        domain_id = request.query_params.get("domain_id")
        department_id = request.query_params.get("department_id")
        period_id = request.query_params.get("period_id")
        status = request.query_params.get("status")
        search = request.query_params.get("search")

        def _to_int(val):
            return int(val) if val and val.isdigit() else None

        master_data = SlideTableService.get_master_table(
            user=request.user,
            company_id=_to_int(company_id),
            project_id=_to_int(project_id),
            circle_id=_to_int(circle_id),
            domain_id=_to_int(domain_id),
            department_id=_to_int(department_id),
            period_id=_to_int(period_id),
            status=status,
            search=search,
        )

        return Response({"success": True, "data": master_data})


class SlideDetailView(APIView):
    """
    GET /api/v1/dashboard/slide-detail/<int:pk>/
    Returns complete context, organization hierarchy, operational metrics,
    audit trail, RCA issues, and corrective actions for a selected entity ID.
    Enforces user circle scope authorization.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        detail = SlideTableService.get_record_detail(record_id=pk, user=request.user)
        if not detail:
            return Response(
                {"success": False, "error": "Record not found or access denied for this organization scope."},
                status=404,
            )

        return Response({"success": True, "data": detail})


class SlideHierarchyRootView(APIView):
    """
    GET /api/v1/dashboard/slide-hierarchy/
    Returns Level 1 root organizations (authorized Main Companies) for Slide View drill-down.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period_id = request.query_params.get("period_id")
        period_id_int = int(period_id) if period_id and period_id.isdigit() else None
        data = SlideHierarchyService.get_root_level_data(user=request.user, period_id=period_id_int)
        return Response({"success": True, "data": data})


class SlideHierarchyNodeView(APIView):
    """
    GET /api/v1/dashboard/slide-hierarchy/<str:level>/<int:pk>/
    Returns dynamic Level 2-8 node details, parent, ancestor breadcrumbs, direct children,
    operational KPI values, and uploaded batches.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, level: str, pk: int):
        period_id = request.query_params.get("period_id")
        period_id_int = int(period_id) if period_id and period_id.isdigit() else None
        data = SlideHierarchyService.get_node_level_data(
            level=level,
            node_id=pk,
            user=request.user,
            period_id=period_id_int,
        )
        return Response({"success": True, "data": data})
