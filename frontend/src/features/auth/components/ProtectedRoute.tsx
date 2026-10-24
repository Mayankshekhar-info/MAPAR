import React from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../hooks/useAuth";
import { MAPAR_NAVIGATION_CONFIG } from "../../../app/navigation/navigation.config";
import { findNavigationItem, resolveSafeLandingRoute } from "../../../app/navigation/navigation.resolver";
import { colorTokens, radiusTokens } from "../../../app/theme/tokens";

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#F8FAFC",
          gap: 2,
        }}
      >
        <CircularProgress size={36} sx={{ color: colorTokens.primary.main }} />
        <Typography variant="body2" sx={{ color: "#64748B", fontWeight: 500 }}>
          Verifying session credentials...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Superuser / Super Admin bypasses module route guards
  if (user?.is_superuser || user?.role === "SUPER_ADMIN") {
    return <>{children}</>;
  }

  // Dynamic Module Access Enforcement
  if (user && user.accessible_modules && user.accessible_modules.length > 0) {
    // Smart task route rewrite across governance / audit / documents modules
    if (
      location.pathname.startsWith("/governance/tasks/") ||
      location.pathname.startsWith("/audit/tasks/") ||
      location.pathname.startsWith("/documents/tasks/")
    ) {
      const safeTaskRoute = resolveSafeLandingRoute(location.pathname, user);
      if (safeTaskRoute !== location.pathname) {
        return <Navigate to={safeTaskRoute} replace />;
      }
    }

    const matchedItem = findNavigationItem(location.pathname, MAPAR_NAVIGATION_CONFIG);
    const requiredModule = matchedItem?.moduleCode;

    if (requiredModule && !user.accessible_modules.includes(requiredModule)) {
      // Find the first module the user actually has access to
      const firstAllowedItem = MAPAR_NAVIGATION_CONFIG
        .flatMap((g) => g.items)
        .find((item) => item.moduleCode && user.accessible_modules?.includes(item.moduleCode));

      // If user hit "/" directly without management access, auto-redirect to their primary allowed workspace
      if (location.pathname === "/" && firstAllowedItem) {
        return <Navigate to={firstAllowedItem.path} replace />;
      }

      return (
        <Box
          sx={{
            minHeight: "80vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
            bgcolor: "#F8FAFC",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              maxWidth: 540,
              width: "100%",
              p: 4.5,
              borderRadius: radiusTokens.lg,
              border: `1px solid ${colorTokens.workspace.border}`,
              textAlign: "center",
              bgcolor: "#FFFFFF",
              boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.08)",
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                bgcolor: "rgba(239, 68, 68, 0.1)",
                color: colorTokens.status.error.main,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2.5,
              }}
            >
              <LockOutlinedIcon sx={{ fontSize: 32 }} />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 800, color: colorTokens.text.primary, mb: 1 }}>
              Module Access Restricted
            </Typography>

            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 3, lineHeight: 1.6 }}>
              You do not have permission to view or interact with the <strong>{matchedItem?.label || requiredModule}</strong> module.
              Your account permissions are governed strictly by MAPAR Enterprise Access & Scope policies.
            </Typography>

            <Box
              sx={{
                p: 2,
                mb: 3,
                bgcolor: "#F1F5F9",
                borderRadius: radiusTokens.sm,
                fontSize: "0.82rem",
                color: "#475569",
                fontFamily: "monospace",
                textAlign: "left",
              }}
            >
              <div><strong>Attempted Route:</strong> {location.pathname}</div>
              <div><strong>Module Code:</strong> {requiredModule}</div>
              <div><strong>Your Allowed Modules:</strong> {user.accessible_modules.join(", ")}</div>
            </Box>

            <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center" }}>
              {firstAllowedItem && (
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate(firstAllowedItem.path)}
                  sx={{
                    bgcolor: colorTokens.primary.main,
                    fontWeight: 700,
                    textTransform: "none",
                    borderRadius: radiusTokens.sm,
                    "&:hover": { bgcolor: colorTokens.primary.dark },
                  }}
                >
                  Go to {firstAllowedItem.label}
                </Button>
              )}
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={() => logout()}
                sx={{
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: radiusTokens.sm,
                }}
              >
                Sign Out
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }
  }

  return <>{children}</>;
};
