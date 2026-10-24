import React from "react";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";

import { SlideBreadcrumbItem } from "../types/slide.types";
import { colorTokens } from "../../../app/theme/tokens";

interface SlideBreadcrumbsProps {
  items: SlideBreadcrumbItem[];
  onItemClick: (level: string, id: number) => void;
}

function getLevelIcon(level: string) {
  switch (level.toUpperCase()) {
    case "ROOT":
      return <HomeOutlinedIcon sx={{ fontSize: 16 }} />;
    case "MAIN_COMPANY":
      return <BusinessOutlinedIcon sx={{ fontSize: 16 }} />;
    case "SUB_COMPANY":
      return <ApartmentOutlinedIcon sx={{ fontSize: 16 }} />;
    case "PROJECT":
      return <AccountTreeOutlinedIcon sx={{ fontSize: 16 }} />;
    case "CIRCLE":
      return <PublicOutlinedIcon sx={{ fontSize: 16 }} />;
    case "DOMAIN":
      return <LayersOutlinedIcon sx={{ fontSize: 16 }} />;
    case "DEPARTMENT":
    case "SUB_DEPARTMENT":
    case "TEAM":
      return <GroupsOutlinedIcon sx={{ fontSize: 16 }} />;
    case "USER":
      return <PersonOutlineIcon sx={{ fontSize: 16 }} />;
    default:
      return null;
  }
}

export const SlideBreadcrumbs: React.FC<SlideBreadcrumbsProps> = ({
  items,
  onItemClick,
}) => {
  if (!items || items.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Breadcrumbs
        separator={<NavigateNextIcon sx={{ fontSize: 16, color: colorTokens.text.muted }} />}
        aria-label="organization-breadcrumb"
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          const icon = getLevelIcon(item.level);

          if (isLast) {
            return (
              <Box
                key={`${item.level}_${item.id}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  color: colorTokens.text.primary,
                  fontWeight: 700,
                  fontSize: "0.84rem",
                }}
              >
                {icon}
                <span>{item.name}</span>
                {item.code && item.level !== "ROOT" && (
                  <Typography
                    component="span"
                    sx={{
                      fontSize: "0.72rem",
                      color: colorTokens.text.muted,
                      fontWeight: 600,
                      bgcolor: colorTokens.workspace.borderSubtle,
                      px: 0.75,
                      py: 0.1,
                      borderRadius: "4px",
                    }}
                  >
                    {item.code}
                  </Typography>
                )}
              </Box>
            );
          }

          return (
            <Link
              key={`${item.level}_${item.id}`}
              component="button"
              type="button"
              onClick={() => onItemClick(item.level, item.id)}
              underline="hover"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.6,
                fontSize: "0.82rem",
                color: colorTokens.text.secondary,
                fontWeight: 500,
                border: "none",
                background: "none",
                cursor: "pointer",
                p: 0,
                "&:hover": {
                  color: colorTokens.primary.main,
                },
              }}
            >
              {icon}
              <span>{item.name}</span>
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
};
