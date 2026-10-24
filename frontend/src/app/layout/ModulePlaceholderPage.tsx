import React from "react";
import { useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ConstructionIcon from "@mui/icons-material/Construction";
import RefreshIcon from "@mui/icons-material/Refresh";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { useAuth } from "../../features/auth";
import { findNavigationItem, resolveNavigation } from "../navigation/navigation.resolver";
import { colorTokens, radiusTokens, shadowTokens } from "../theme/tokens";

export const ModulePlaceholderPage: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const groups = resolveNavigation(user);
  const currentItem = findNavigationItem(location.pathname, groups);

  const title = currentItem?.label || "MAPAR Enterprise Module";
  const description =
    currentItem?.description || "Dedicated operational workspace and data models for this functional domain.";

  return (
    <Box>
      <PageHeader
        title={title}
        subtitle={description}
        badge="ACTIVE SCOPE"
        badgeColor="info"
        actions={
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            sx={{
              borderRadius: radiusTokens.md,
              borderColor: colorTokens.workspace.border,
              color: colorTokens.text.primary,
              bgcolor: "#FFFFFF",
              "&:hover": { borderColor: colorTokens.primary.main },
            }}
          >
            Refresh Data
          </Button>
        }
      />

      <Card
        sx={{
          border: `1px solid ${colorTokens.workspace.border}`,
          borderRadius: radiusTokens.lg,
          boxShadow: shadowTokens.card,
          bgcolor: "#FFFFFF",
          p: 4,
          textAlign: "center",
        }}
      >
        <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 600, mx: "auto" }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: radiusTokens.full,
              bgcolor: colorTokens.primary.lighter,
              color: colorTokens.primary.main,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 2.5,
            }}
          >
            <ConstructionIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: colorTokens.text.primary, mb: 1 }}>
            {title} Workspace
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mb: 3 }}>
            This native MAPAR module is registered in the enterprise navigation architecture and ready for domain-specific data view bindings.
          </Typography>
          <Box
            sx={{
              p: 2,
              borderRadius: radiusTokens.md,
              bgcolor: colorTokens.workspace.background,
              border: `1px solid ${colorTokens.workspace.borderSubtle}`,
              width: "100%",
              textAlign: "left",
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.muted, display: "block", mb: 0.5 }}>
              MODULE METADATA
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem", color: colorTokens.text.secondary }}>
              Route Path: {location.pathname}
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem", color: colorTokens.text.secondary }}>
              Access Scope: {user?.role_name || user?.role}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
