import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { OrganizationScopeItem, UserModulePermissionItem } from "../types/users.types";

interface EffectiveAccessSummaryCardProps {
  roleName?: string;
  roleCode?: string;
  rolePermissions?: string[];
  modulePermissions?: UserModulePermissionItem[];
  scopes: OrganizationScopeItem[];
}

export const EffectiveAccessSummaryCard: React.FC<EffectiveAccessSummaryCardProps> = ({
  roleName,
  roleCode,
  rolePermissions = [],
  modulePermissions = [],
  scopes,
}) => {
  // Aggregate unique actions granted across all scopes
  const allActions = new Set<string>();
  scopes.forEach((s) => {
    if (s.can_view || s.actions?.includes("view")) allActions.add("view");
    if (s.can_manage || s.actions?.includes("manage")) allActions.add("manage");
    if (s.can_create || s.actions?.includes("create")) allActions.add("create");
    if (s.can_update || s.actions?.includes("update")) allActions.add("update");
    if (s.can_delete || s.actions?.includes("delete")) allActions.add("delete");
  });

  const writeModules = modulePermissions.filter((m) => m.access_level === "WRITE");
  const readModules = modulePermissions.filter((m) => m.access_level === "READ");
  const deniedModules = modulePermissions.filter((m) => m.access_level === "NO_ACCESS");

  return (
    <Card
      elevation={0}
      sx={{
        p: 3,
        borderRadius: radiusTokens.md,
        border: `1.5px solid ${colorTokens.workspace.border}`,
        bgcolor: "#FFFFFF",
        boxShadow: shadowTokens.card,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: radiusTokens.sm,
            bgcolor: colorTokens.primary.lighter,
            color: colorTokens.primary.main,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <VpnKeyOutlinedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: colorTokens.text.primary, letterSpacing: "-0.01em" }}>
            Effective Access & Scope Summary
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
            Real-time evaluation: USER + ENTERPRISE ROLE + MODULE ACCESS + ORGANIZATION SCOPE(S)
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
        {/* 1. ENTERPRISE ROLE */}
        <Box
          sx={{
            p: 2,
            borderRadius: radiusTokens.sm,
            bgcolor: "#F8FAFC",
            border: `1px solid ${colorTokens.workspace.border}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <SecurityOutlinedIcon fontSize="small" sx={{ color: "#4F46E5" }} />
            <Typography variant="body2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
              Enterprise Role (WHAT)
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 1.5 }}>
            Defines role-based authority & capabilities
          </Typography>

          <Box sx={{ mb: 1.5 }}>
            {roleName ? (
              <Chip
                label={`${roleName} (${roleCode || "ROLE"})`}
                color="primary"
                size="small"
                sx={{ fontWeight: 700, borderRadius: radiusTokens.xs }}
              />
            ) : (
              <Typography variant="caption" sx={{ color: colorTokens.text.muted, fontStyle: "italic" }}>
                No enterprise role selected yet
              </Typography>
            )}
          </Box>

          {rolePermissions.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary, display: "block", mb: 0.5 }}>
                Role Permissions ({rolePermissions.length}):
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, maxHeight: 100, overflowY: "auto" }}>
                {rolePermissions.map((perm) => (
                  <Chip
                    key={perm}
                    label={perm}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: "0.68rem", fontFamily: "monospace", borderRadius: radiusTokens.xs }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>

        {/* 2. MODULE ACCESS DIMENSION */}
        <Box
          sx={{
            p: 2,
            borderRadius: radiusTokens.sm,
            bgcolor: "#F8FAFC",
            border: `1px solid ${colorTokens.workspace.border}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <ViewModuleOutlinedIcon fontSize="small" sx={{ color: "#0284C7" }} />
            <Typography variant="body2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
              Module Access (WHERE TO WORK)
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 1.5 }}>
            Enforces independent module read/write gates
          </Typography>

          {modulePermissions.length === 0 ? (
            <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
              All modules configured by role defaults
            </Typography>
          ) : (
            <Stack spacing={1}>
              {writeModules.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#065F46", display: "block", mb: 0.3 }}>
                    Read & Write ({writeModules.length}):
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {writeModules.map((m) => (
                      <Chip
                        key={m.module_code}
                        label={m.module_name || m.module_code}
                        size="small"
                        sx={{ fontSize: "0.7rem", fontWeight: 600, bgcolor: "#D1FAE5", color: "#065F46" }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {readModules.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#0369A1", display: "block", mb: 0.3 }}>
                    Read Only ({readModules.length}):
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {readModules.map((m) => (
                      <Chip
                        key={m.module_code}
                        label={m.module_name || m.module_code}
                        size="small"
                        sx={{ fontSize: "0.7rem", fontWeight: 600, bgcolor: "#E0F2FE", color: "#0369A1" }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {deniedModules.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#DC2626", display: "block", mb: 0.3 }}>
                    No Access ({deniedModules.length}):
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {deniedModules.map((m) => (
                      <Chip
                        key={m.module_code}
                        label={m.module_name || m.module_code}
                        size="small"
                        sx={{ fontSize: "0.7rem", fontWeight: 500, bgcolor: "#F1F5F9", color: "#94A3B8" }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Stack>
          )}
        </Box>

        {/* 3. ORGANIZATION SCOPE DIMENSION */}
        <Box
          sx={{
            p: 2,
            borderRadius: radiusTokens.sm,
            bgcolor: "#F8FAFC",
            border: `1px solid ${colorTokens.workspace.border}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <AccountTreeOutlinedIcon fontSize="small" sx={{ color: "#0e7490" }} />
            <Typography variant="body2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
              Organization Scope (DATA BOUNDARY)
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 1.5 }}>
            Strict geographic and hierarchy data isolation
          </Typography>

          {scopes.length === 0 ? (
            <Typography variant="caption" sx={{ color: colorTokens.status.error.main, fontWeight: 600 }}>
              ⚠ No organization scope assigned. User will have no visible organization records.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {scopes.map((s, idx) => (
                <Box
                  key={idx}
                  sx={{
                    p: 1,
                    bgcolor: "#FFFFFF",
                    borderRadius: radiusTokens.xs,
                    border: `1px solid ${colorTokens.workspace.border}`,
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.primary, display: "block" }}>
                    Scope #{idx + 1}:
                  </Typography>
                  <Typography variant="caption" sx={{ color: colorTokens.text.secondary, wordBreak: "break-word" }}>
                    {s.hierarchy_breadcrumb || "Root hierarchy"}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}

          {allActions.size > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary, display: "block", mb: 0.5 }}>
                Scope Action Rights:
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {Array.from(allActions).map((act) => (
                  <Chip
                    key={act}
                    label={act.toUpperCase()}
                    size="small"
                    sx={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      bgcolor: act === "manage" ? "#FAF5FF" : "#EFF6FF",
                      color: act === "manage" ? "#7E22CE" : "#1D4ED8",
                      borderRadius: radiusTokens.xs,
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </Box>
    </Card>
  );
};

