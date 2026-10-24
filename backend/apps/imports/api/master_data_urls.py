from django.urls import path
from apps.imports.api.master_data_views import (
    MasterDataMetaView,
    MasterDataRecordsView,
    MasterDataRecordDetailView,
    MasterDataUploadView,
    MasterDataExportView,
)

urlpatterns = [
    path("meta/", MasterDataMetaView.as_view(), name="master-data-meta"),
    path("records/", MasterDataRecordsView.as_view(), name="master-data-records-list"),
    path("records/<int:pk>/", MasterDataRecordDetailView.as_view(), name="master-data-record-detail"),
    path("upload/", MasterDataUploadView.as_view(), name="master-data-upload"),
    path("export/", MasterDataExportView.as_view(), name="master-data-export"),
]
