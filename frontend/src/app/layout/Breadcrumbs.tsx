import React from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import Box from "@mui/material/Box";
import { useAuth } from "../../features/auth";
import { resolveBreadcrumbs, resolveNavigation } from "../navigation/navigation.resolver";
import { colorTokens } from "../theme/tokens";

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const groups = resolveNavigation(user);
  const items = resolveBreadcrumbs(location.pathname, groups);

  return (
    <MuiBreadcrumbs
      separator={<NavigateNextIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />}
      aria-label="breadcrumb"
      sx={{ display: "flex", alignItems: "center" }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isHome = index === 0;

        if (isLast) {
          return (
            <Typography
              key={item.path}
              variant="body2"
              sx={{
                fontWeight: 600,
                color: colorTokens.text.primary,
                display: "flex",
                alignItems: "center",
                gap: 0.5,
              }}
            >
              {isHome && <HomeOutlinedIcon sx={{ fontSize: 16, color: colorTokens.primary.main }} />}
              {item.label}
            </Typography>
          );
        }

        return (
          <Link
            key={item.path}
            component={RouterLink}
            to={item.path}
            underline="hover"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: "0.8125rem",
              color: colorTokens.text.secondary,
              fontWeight: 500,
              "&:hover": { color: colorTokens.primary.main },
            }}
          >
            {isHome && <HomeOutlinedIcon sx={{ fontSize: 16 }} />}
            {item.label}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
};
