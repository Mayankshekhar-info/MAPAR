from django.urls import path
from apps.organization.api.views import (
    HierarchyTreeView,
    HierarchySummaryView,
    HierarchyOptionsView,
    HierarchyNodeDetailView,
    CreateNodeView,
    UpdateNodeView,
    DeleteNodeView,
    HierarchySearchView,
)

urlpatterns = [
    path("tree/", HierarchyTreeView.as_view(), name="org-hierarchy-tree"),
    path("summary/", HierarchySummaryView.as_view(), name="org-hierarchy-summary"),
    path("options/", HierarchyOptionsView.as_view(), name="org-hierarchy-options"),
    path("search/", HierarchySearchView.as_view(), name="org-hierarchy-search"),
    path("nodes/", CreateNodeView.as_view(), name="org-create-node"),
    path("nodes/<str:level>/<int:node_id>/", HierarchyNodeDetailView.as_view(), name="org-node-detail"),
    path("nodes/<str:level>/<int:node_id>/update/", UpdateNodeView.as_view(), name="org-update-node"),
    path("nodes/<str:level>/<int:node_id>/delete/", DeleteNodeView.as_view(), name="org-delete-node"),
]
