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
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PublicIcon from "@mui/icons-material/Public";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { OrganizationScopeItem } from "../types/users.types";

interface EffectiveAccessSummaryCardProps {
  roleName?: string;
  roleCode?: string;
  rolePermissions?: string[];
  scopes: OrganizationScopeItem[];
}

export const EffectiveAccessSummaryCard: React.FC<EffectiveAccessSummaryCardProps> = ({
  roleName,
  roleCode,
  rolePermissions = [],
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
            Effective Access Preview
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
            Real-time evaluation of USER + ENTERPRISE ROLE + ORGANIZATION SCOPE(S)
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5 }}>
        {/* WHAT: Role & Module Permissions */}
        <Box
          sx={{
            p: 2,
            borderRadius: radiusTokens.sm,
            bgcolor: "#F8FAFC",
            border: `1px solid ${colorTokens.workspace.border}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <SecurityOutlinedIcon fontSize="small" sx={{ color: colorTokens.primary.main }} />
            <Typography variant="body2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
              Role Capabilities (WHAT)
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 1.5 }}>
            Defined by Enterprise Role assignment
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
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, maxHeight: 120, overflowY: "auto" }}>
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

        {/* WHERE: Organization Boundaries */}
        <Box
          sx={{
            p: 2,
            borderRadius: radiusTokens.sm,
            bgcolor: "#F8FAFC",
            border: `1px solid ${colorTokens.workspace.border}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <AccountTreeOutlinedIcon fontSize="small" sx={{ color: colorTokens.primary.main }} />
            <Typography variant="body2" sx={{ fontWeight: 800, color: colorTokens.text.primary }}>
              Organization Access (WHERE)
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 1.5 }}>
            Defined by {scopes.length} assigned organizational scope(s)
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
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary, display: "block", mb: 0.5 }}>
                Cumulative Action Rights:
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
