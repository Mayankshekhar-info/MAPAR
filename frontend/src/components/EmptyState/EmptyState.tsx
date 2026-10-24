import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { colorTokens, radiusTokens } from "../../app/theme/tokens";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No data found",
  description = "There are no records matching your current filter criteria.",
  action,
  icon,
}) => {
  return (
    <Box
      sx={{
        py: 8,
        px: 3,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#FFFFFF",
        borderRadius: radiusTokens.lg,
        border: `1px dashed ${colorTokens.workspace.border}`,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: radiusTokens.full,
          bgcolor: colorTokens.workspace.borderSubtle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colorTokens.text.muted,
          mb: 2,
        }}
      >
        {icon || <InboxOutlinedIcon sx={{ fontSize: 32 }} />}
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 600, color: colorTokens.text.primary, mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: colorTokens.text.secondary, maxWidth: 440, mb: action ? 3 : 0 }}>
        {description}
      </Typography>
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
};
