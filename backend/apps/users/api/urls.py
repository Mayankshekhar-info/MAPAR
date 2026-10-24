from django.urls import path
from apps.users.api.views import UserListView, UserDetailView, UserStatusToggleView

urlpatterns = [
    path("", UserListView.as_view(), name="user-list"),
    path("<int:pk>/", UserDetailView.as_view(), name="user-detail"),
    path("<int:pk>/toggle-status/", UserStatusToggleView.as_view(), name="user-toggle-status"),
]
