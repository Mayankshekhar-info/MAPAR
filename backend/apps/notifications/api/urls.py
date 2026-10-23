from django.urls import path
from apps.notifications.api.views import (
    SMTPConfigurationView,
    TestConnectionView,
    SendTestEmailView,
    EmailDeliveryLogsView,
    ScheduleOverviewView,
    TriggerRemindersView,
)

urlpatterns = [
    path("smtp/", SMTPConfigurationView.as_view(), name="notification-smtp-config"),
    path("smtp/test-connection/", TestConnectionView.as_view(), name="notification-test-connection"),
    path("smtp/send-test/", SendTestEmailView.as_view(), name="notification-send-test"),
    path("logs/", EmailDeliveryLogsView.as_view(), name="notification-delivery-logs"),
    path("schedule/", ScheduleOverviewView.as_view(), name="notification-schedule-overview"),
    path("reminders/trigger/", TriggerRemindersView.as_view(), name="notification-trigger-reminders"),
]
