import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import { HierarchySummary } from "../types/organization.types";
import { colorTokens } from "../../../app/theme/tokens";

interface OrganizationSummaryProps {
  summary?: HierarchySummary;
  isLoading: boolean;
}

interface CounterCardProps {
  label: string;
  count: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

const CounterCard: React.FC<CounterCardProps> = ({
  label,
  count,
  color,
  bgColor,
  borderColor,
}) => (
  <Paper
    elevation={0}
    sx={{
      p: 2,
      borderRadius: "12px",
      bgcolor: bgColor,
      border: `1px solid ${borderColor}`,
      textAlign: "center",
      transition: "transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out",
      "&:hover": {
        transform: "translateY(-2px)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
      },
    }}
  >
    <Typography
      variant="caption"
      sx={{
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color,
        display: "block",
      }}
    >
      {label}
    </Typography>
    <Typography
      variant="h4"
      sx={{
        fontWeight: 800,
        color: colorTokens.text.primary,
        mt: 0.5,
        lineHeight: 1.1,
      }}
    >
      {count}
    </Typography>
  </Paper>
);

export const OrganizationSummary: React.FC<OrganizationSummaryProps> = ({
  summary,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(3, 1fr)",
            md: "repeat(4, 1fr)",
            lg: "repeat(7, 1fr)",
          },
          gap: 2,
        }}
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            height={82}
            sx={{ borderRadius: "12px" }}
          />
        ))}
      </Box>
    );
  }

  const cards = [
    {
      label: "Main Co.",
      count: summary?.main_companies ?? 0,
      color: "#7e22ce",
      bgColor: "#faf5ff",
      borderColor: "#e9d5ff",
    },
    {
      label: "Sub Co.",
      count: summary?.sub_companies ?? 0,
      color: "#4338ca",
      bgColor: "#eef2ff",
      borderColor: "#c7d2fe",
    },
    {
      label: "Projects",
      count: summary?.projects ?? 0,
      color: "#1d4ed8",
      bgColor: "#eff6ff",
      borderColor: "#bfdbfe",
    },
    {
      label: "Circles",
      count: summary?.circles ?? 0,
      color: "#0e7490",
      bgColor: "#ecfeff",
      borderColor: "#a5f3fc",
    },
    {
      label: "Domains",
      count: summary?.domains ?? 0,
      color: "#047857",
      bgColor: "#ecfdf5",
      borderColor: "#a7f3d0",
    },
    {
      label: "Departments",
      count: summary?.departments ?? 0,
      color: "#b45309",
      bgColor: "#fffbeb",
      borderColor: "#fde68a",
    },
    {
      label: "Sub-Depts",
      count: summary?.sub_departments ?? 0,
      color: "#be123c",
      bgColor: "#fff1f2",
      borderColor: "#fecdd3",
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(3, 1fr)",
          md: "repeat(4, 1fr)",
          lg: "repeat(7, 1fr)",
        },
        gap: 2,
      }}
    >
      {cards.map((c) => (
        <CounterCard
          key={c.label}
          label={c.label}
          count={c.count}
          color={c.color}
          bgColor={c.bgColor}
          borderColor={c.borderColor}
        />
      ))}
    </Box>
  );
};
