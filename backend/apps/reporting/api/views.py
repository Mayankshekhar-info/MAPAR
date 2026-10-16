from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.dashboard.models import ReportingPeriod
from apps.reporting.services.period_resolution_service import PeriodResolutionService
from apps.reporting.api.serializers import (
    ReportingPeriodSerializer,
    PeriodResolveRequestSerializer,
)


class ReportingPeriodListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period_type = request.query_params.get("frequency") or request.query_params.get("period_type")
        qs = ReportingPeriod.objects.all().order_by("-start_date")

        if period_type and period_type.upper() != "ALL":
            qs = qs.filter(period_type=period_type.upper())

        serializer = ReportingPeriodSerializer(qs[:100], many=True)
        current = ReportingPeriod.objects.filter(is_current=True).first()

        return Response({
            "current_period": ReportingPeriodSerializer(current).data if current else None,
            "periods": serializer.data,
            "supported_frequencies": [
                "MONTHLY",
                "WEEKLY",
                "QUARTERLY",
                "YEARLY",
                "DAILY",
                "CUSTOM",
            ],
        })


class ReportingPeriodResolveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PeriodResolveRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            period = PeriodResolutionService.resolve_period(
                period_id=data.get("period_id"),
                period_type=data.get("period_type"),
                start_date=data.get("start_date"),
                end_date=data.get("end_date"),
                period_name=data.get("period_name"),
            )
            return Response(ReportingPeriodSerializer(period).data, status=status.HTTP_200_OK)
        except ValueError as val_err:
            return Response({"message": str(val_err)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({"message": f"Failed to resolve reporting period: {str(ex)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
