import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { colorTokens } from "../../app/theme/tokens";

export interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: "success" | "warning" | "error" | "info" | "neutral";
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  badgeColor = "info",
  actions,
  children,
}) => {
  if (!title && !subtitle && !actions && !children) {
    return null;
  }

  const badgeStyles = colorTokens.status[badgeColor] || colorTokens.status.info;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        gap: 2,
        mb: 3.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          {title && (
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                color: colorTokens.text.primary,
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </Typography>
          )}

          {badge && (
            <Chip
              label={badge}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: "0.72rem",
                bgcolor: badgeStyles.light,
                color: badgeStyles.text,
                border: `1px solid ${badgeStyles.border}`,
                height: 24,
              }}
            />
          )}
        </Box>

        {subtitle && (
          <Typography
            variant="body2"
            sx={{
              color: colorTokens.text.secondary,
              mt: 0.5,
              fontSize: "0.875rem",
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>

      {actions && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            alignSelf: { xs: "stretch", sm: "auto" },
          }}
        >
          {actions}
        </Box>
      )}

      {children}
    </Box>
  );
};
