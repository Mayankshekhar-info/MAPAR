import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import LogoutIcon from "@mui/icons-material/Logout";
import SecurityIcon from "@mui/icons-material/Security";
import { useAuth } from "../../features/auth";
import { colorTokens, radiusTokens } from "../theme/tokens";

interface UserProfileWidgetProps {
  collapsed?: boolean;
}

export const UserProfileWidget: React.FC<UserProfileWidgetProps> = ({ collapsed = false }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = (user.name || user.username || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (collapsed) {
    return (
      <Box
        sx={{
          p: 1.5,
          display: "flex",
          justifyContent: "center",
          borderTop: `1px solid ${colorTokens.nav.border}`,
        }}
      >
        <Tooltip title={`${user.name || user.username} (${user.role_name || user.role})`} placement="right">
          <Avatar
            sx={{
              width: 38,
              height: 38,
              bgcolor: colorTokens.primary.main,
              color: "#FFFFFF",
              fontSize: "0.875rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {initials}
          </Avatar>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        borderTop: `1px solid ${colorTokens.nav.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        bgcolor: colorTokens.nav.surface,
        transition: "all 0.2s ease",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <Avatar
          sx={{
            width: 38,
            height: 38,
            bgcolor: colorTokens.primary.main,
            color: "#FFFFFF",
            fontSize: "0.875rem",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </Avatar>
        <Box sx={{ minWidth: 0, overflow: "hidden" }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: colorTokens.nav.textPrimary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {user.name || user.username}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
            <SecurityIcon sx={{ fontSize: 13, color: colorTokens.primary.light }} />
            <Typography
              variant="caption"
              sx={{
                color: colorTokens.nav.textSecondary,
                fontSize: "0.72rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.role_name || user.role}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Tooltip title="Sign Out of PAGMS">
        <IconButton
          onClick={logout}
          size="small"
          aria-label="Sign Out"
          sx={{
            color: colorTokens.nav.textSecondary,
            borderRadius: radiusTokens.sm,
            "&:hover": {
              color: colorTokens.status.error.main,
              bgcolor: "rgba(239, 68, 68, 0.1)",
            },
          }}
        >
          <LogoutIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};
