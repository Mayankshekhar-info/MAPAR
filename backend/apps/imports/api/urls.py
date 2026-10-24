from django.urls import path
from apps.imports.api.views import (
    UploadsMetaView,
    TemplateListView,
    TemplateDetailView,
    TemplateVersionCreateView,
    TemplateVersionDetailView,
    TemplateDownloadExcelView,
    BatchUploadView,
    BatchListView,
    BatchDetailView,
    BatchErrorsView,
    BatchErrorReportExportView,
    BatchCommitView,
    BatchRevalidateView,
    TemplateCompatibleKPIsView,
    BatchProcessKPIView,
)

urlpatterns = [
    # Metadata for dynamic builder & filter forms
    path("meta/", UploadsMetaView.as_view(), name="uploads-meta"),

    # Template Endpoints
    path("templates/", TemplateListView.as_view(), name="uploads-templates-list"),
    path("templates/<int:template_id>/", TemplateDetailView.as_view(), name="uploads-template-detail"),
    path("templates/<int:template_id>/compatible-kpis/", TemplateCompatibleKPIsView.as_view(), name="uploads-template-compatible-kpis"),
    path("templates/<int:template_id>/version/", TemplateVersionCreateView.as_view(), name="uploads-template-new-version"),
    path("templates/<int:template_id>/versions/<int:version_id>/", TemplateVersionDetailView.as_view(), name="uploads-template-version-detail"),
    path("templates/<int:template_id>/download/", TemplateDownloadExcelView.as_view(), name="uploads-template-download"),

    # Batch & Import Endpoints
    path("batches/", BatchListView.as_view(), name="uploads-batches-list"),
    path("batches/upload/", BatchUploadView.as_view(), name="uploads-batch-upload"),
    path("batches/<str:identifier>/", BatchDetailView.as_view(), name="uploads-batch-detail"),
    path("batches/<str:identifier>/process-kpi/", BatchProcessKPIView.as_view(), name="uploads-batch-process-kpi"),
    path("batches/<str:identifier>/errors/", BatchErrorsView.as_view(), name="uploads-batch-errors"),
    path("batches/<str:identifier>/errors/export/", BatchErrorReportExportView.as_view(), name="uploads-batch-errors-export"),
    path("batches/<str:identifier>/commit/", BatchCommitView.as_view(), name="uploads-batch-commit"),
    path("batches/<str:identifier>/revalidate/", BatchRevalidateView.as_view(), name="uploads-batch-revalidate"),
]
