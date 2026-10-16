from django.urls import path
from apps.dashboard.api.views import (
    HealthView,
    CockpitFiltersView,
    CockpitSummaryView,
    CockpitDetailView,
    CockpitRecordDetailView,
    CockpitExportView,
    SlideViewDeckView,
    SlideMasterTableView,
    SlideDetailView,
    SlideHierarchyRootView,
    SlideHierarchyNodeView,
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="cockpit-health"),
    path("filters/", CockpitFiltersView.as_view(), name="cockpit-filters"),
    path("summary/", CockpitSummaryView.as_view(), name="cockpit-summary"),
    path("detail/", CockpitDetailView.as_view(), name="cockpit-detail"),
    path("record/<int:pk>/", CockpitRecordDetailView.as_view(), name="cockpit-record-detail"),
    path("export/", CockpitExportView.as_view(), name="cockpit-export"),
    path("slides/", SlideViewDeckView.as_view(), name="cockpit-slides"),
    path("slide-master/", SlideMasterTableView.as_view(), name="slide-master-table"),
    path("slide-detail/<int:pk>/", SlideDetailView.as_view(), name="slide-detail"),
    path("slide-hierarchy/", SlideHierarchyRootView.as_view(), name="slide-hierarchy-root"),
    path("slide-hierarchy/<str:level>/<int:pk>/", SlideHierarchyNodeView.as_view(), name="slide-hierarchy-node"),
]
