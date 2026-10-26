import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { LoginPage, ProtectedRoute } from "../../features/auth";
import { AppShell } from "../layout/AppShell";
import { ManagementCockpitPage } from "../../features/dashboard";
import { OrganizationPage } from "../../features/organization";
import { SlideViewPage, SlideDetailPage, SlideHierarchyPage } from "../../features/slides";
import { UploadsPage, CreateTemplatePage, BatchDetailPage } from "../../features/uploads";
import { UserAccountsPage, CreateUserPage, EditUserPage } from "../../features/users";
import { EnterpriseRolesPage } from "../../features/roles";
import { AccessScopesPage } from "../../features/permissions";
import { KPIRegistryPage } from "../../features/kpi";
// Master Data section disabled
// import { MasterDataPage } from "../../features/master-data";
import { GovernanceDashboardPage, TaskDetailPage, ActionOwnerTasksPage } from "../../features/governance";
import { NotificationsAdminPage } from "../../features/notifications";
import { ModulePlaceholderPage } from "../layout/ModulePlaceholderPage";




function AuthenticatedShellLayout() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <AuthenticatedShellLayout />,
    children: [
      {
        index: true,
        element: <ManagementCockpitPage />,
      },
      {
        path: "management-cockpit",
        element: <Navigate to="/" replace />,
      },
      {
        path: "management-cockpit/detail/:id",
        element: <SlideDetailPage />,
      },
      {
        path: "organization/*",
        element: <OrganizationPage />,
      },
      {
        path: "slides",
        element: <SlideViewPage />,
      },
      {
        path: "slides/:level/:id",
        element: <SlideHierarchyPage />,
      },
      {
        path: "slides/detail/:id",
        element: <SlideDetailPage />,
      },
      {
        path: "operations",
        element: <ModulePlaceholderPage />,
      },
      {
        path: "workflow",
        element: <ModulePlaceholderPage />,
      },
      {
        path: "workforce",
        element: <ModulePlaceholderPage />,
      },
      {
        path: "governance",
        element: <GovernanceDashboardPage mode="governance" />,
      },
      {
        path: "governance/owners/:ownerId/tasks",
        element: <ActionOwnerTasksPage mode="governance" />,
      },
      {
        path: "governance/tasks/:id",
        element: <TaskDetailPage />,
      },
      {
        path: "audit",
        element: <GovernanceDashboardPage mode="audit" />,
      },
      {
        path: "audit/owners/:ownerId/tasks",
        element: <ActionOwnerTasksPage mode="audit" />,
      },
      {
        path: "audit/tasks/:id",
        element: <TaskDetailPage />,
      },
      {
        path: "documents",
        element: <GovernanceDashboardPage mode="documents" />,
      },
      {
        path: "documents/tasks/:id",
        element: <TaskDetailPage />,
      },
      {
        path: "finance",
        element: <ModulePlaceholderPage />,
      },
      {
        path: "reporting",
        element: <ModulePlaceholderPage />,
      },
      {
        path: "kpi",
        element: <KPIRegistryPage />,
      },
      {
        path: "uploads",
        element: <UploadsPage />,
      },
      {
        path: "uploads/templates/create",
        element: <CreateTemplatePage />,
      },
      {
        path: "uploads/batches/:batchId",
        element: <BatchDetailPage />,
      },
      {
        // Master Data section completely disabled per architectural directive
        path: "master-data",
        element: <Navigate to="/uploads" replace />,
      },
      {
        path: "imports",
        element: <Navigate to="/uploads" replace />,
      },
      {
        path: "users",
        element: <UserAccountsPage />,
      },
      {
        path: "users/create",
        element: <CreateUserPage />,
      },
      {
        path: "users/:id/edit",
        element: <EditUserPage />,
      },

      {
        path: "roles",
        element: <EnterpriseRolesPage />,
      },
      {
        path: "permissions",
        element: <AccessScopesPage />,
      },
      {
        path: "access-scopes",
        element: <Navigate to="/permissions" replace />,
      },
      {
        path: "notifications",
        element: <NotificationsAdminPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
