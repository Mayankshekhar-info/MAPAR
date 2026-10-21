from django.urls import path
from apps.kpi.api import views

urlpatterns = [
    path("definitions/", views.KPIDefinitionListCreateView.as_view(), name="kpi-definition-list-create"),
    path("definitions/<int:pk>/", views.KPIDefinitionDetailView.as_view(), name="kpi-definition-detail"),
    path("definitions/<int:pk>/duplicate/", views.KPIDuplicateView.as_view(), name="kpi-definition-duplicate"),
    path("definitions/<int:pk>/calculate/", views.KPICalculateView.as_view(), name="kpi-calculate"),
    path("validate-formula/", views.KPIValidateFormulaView.as_view(), name="kpi-validate-formula"),
    path("preview-formula/", views.KPIPreviewFormulaView.as_view(), name="kpi-preview-formula"),
    path("test-logic/", views.KPITestLogicView.as_view(), name="kpi-test-logic"),
    path("sources/datasets/", views.KPIDatasetListView.as_view(), name="kpi-sources-datasets"),
    path("sources/datasets/<int:dataset_id>/fields/", views.KPIDatasetFieldListView.as_view(), name="kpi-sources-fields"),
    path("dashboard/cards/", views.KPIDashboardCardListView.as_view(), name="kpi-dashboard-cards"),
    path("results/<int:result_id>/diagnostics/", views.KPIDiagnosticsView.as_view(), name="kpi-diagnostics"),
    path("results/<int:result_id>/records/", views.KPIRefinedRecordsView.as_view(), name="kpi-result-records"),
]
