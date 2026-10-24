from django.urls import path
from apps.reporting.api import views

urlpatterns = [
    path("periods/", views.ReportingPeriodListView.as_view(), name="reporting-period-list"),
    path("periods/resolve/", views.ReportingPeriodResolveView.as_view(), name="reporting-period-resolve"),
]
