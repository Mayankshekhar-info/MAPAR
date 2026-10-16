from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.identity.api.urls")),
    path("api/v1/organization/", include("apps.organization.api.urls")),
    path("api/v1/dashboard/", include("apps.dashboard.api.urls")),
    path("api/v1/uploads/", include("apps.imports.api.urls")),
    path("api/v1/authorization/", include("apps.authorization.api.urls")),
    path("api/v1/users/", include("apps.users.api.urls")),
    path("api/v1/kpi/", include("apps.kpi.api.urls")),
    path("api/v1/reporting/", include("apps.reporting.api.urls")),
    # Master Data section completely disabled per architectural directive
    # path("api/v1/master-data/", include("apps.imports.api.master_data_urls")),
]


