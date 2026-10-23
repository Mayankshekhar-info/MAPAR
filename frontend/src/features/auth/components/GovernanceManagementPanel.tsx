import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import HourglassBottomOutlinedIcon from "@mui/icons-material/HourglassBottomOutlined";
import AnalyticsOutlinedIcon from "@mui/icons-material/AnalyticsOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import StarsIcon from "@mui/icons-material/Stars";

interface ManagementItem {
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  accentColor: string;
  gradient: string;
}

const MANAGEMENT_ITEMS: ManagementItem[] = [
  {
    icon: <DashboardOutlinedIcon sx={{ fontSize: 20 }} />,
    tag: "COCKPIT",
    title: "One Consolidated View",
    description: "Unified executive cockpit aggregating operational health, velocity, and circle comparisons.",
    accentColor: "#00E676", // Pratap Leaf Green
    gradient: "linear-gradient(135deg, #00E676 0%, #059669 100%)",
  },
  {
    icon: <AssignmentIndOutlinedIcon sx={{ fontSize: 20 }} />,
    tag: "ACCOUNTABILITY",
    title: "Clear Accountability",
    description: "Single-point task ownership with verifiable assigned owners and hierarchical reviewer sign-offs.",
    accentColor: "#00D2FF", // Pratap Cyan
    gradient: "linear-gradient(135deg, #00D2FF 0%, #0284C7 100%)",
  },
  {
    icon: <ShieldOutlinedIcon sx={{ fontSize: 20 }} />,
    tag: "EARLY WARNING",
    title: "Early Visibility of Risks",
    description: "Predictive identification of delayed deliverables, stalled tasks, and critical path bottlenecks.",
    accentColor: "#F43F5E", // Rose / Red
    gradient: "linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)",
  },
  {
    icon: <HourglassBottomOutlinedIcon sx={{ fontSize: 20 }} />,
    tag: "AGEING BUCKETS",
    title: "Action Ageing and Follow-Up",
    description: "Automated classification into 0-7, 8-15, 16-30, and 30+ days ageing buckets with escalation tags.",
    accentColor: "#FBBF24", // Amber
    gradient: "linear-gradient(135deg, #FBBF24 0%, #D97706 100%)",
  },
  {
    icon: <AnalyticsOutlinedIcon sx={{ fontSize: 20 }} />,
    tag: "ANALYTICS",
    title: "Trend-Based Improvement",
    description: "Historical velocity analytics, weekly progress curves, and multi-week trend extrapolation.",
    accentColor: "#10B981", // Emerald
    gradient: "linear-gradient(135deg, #10B981 0%, #047857 100%)",
  },
  {
    icon: <FactCheckOutlinedIcon sx={{ fontSize: 20 }} />,
    tag: "AUDIT READY",
    title: "Decision-Ready Data",
    description: "Authoritative data feeds with verifiable proof documents eliminating reliance on ad-hoc spreadsheets.",
    accentColor: "#818CF8", // Indigo / Blue
    gradient: "linear-gradient(135deg, #818CF8 0%, #4F46E5 100%)",
  },
];

export const GovernanceManagementPanel: React.FC = () => {
  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        p: { xs: 2.5, sm: 3 },
        borderRadius: 3,
        bgcolor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
        position: "relative",
        overflow: "hidden",
        transition: "all 0.3s ease",
        "&:hover": {
          borderColor: "#A7F3D0",
          boxShadow: "0 8px 28px rgba(5, 150, 105, 0.08)",
        },
      }}
    >
      {/* Top Luminous Teal-to-Emerald Accent Bar */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "linear-gradient(90deg, #0891B2 0%, #059669 100%)",
        }}
      />

      {/* Header Accent Badge */}
      <Box sx={{ mb: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            px: 1.8,
            py: 0.7,
            borderRadius: 2,
            bgcolor: "#F0FDFA",
            border: "1px solid #99F6E4",
          }}
        >
          <StarsIcon sx={{ fontSize: 18, color: "#0891B2" }} />
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 900,
              letterSpacing: "1.2px",
              color: "#0F766E",
              fontSize: "0.85rem",
            }}
          >
            WHAT MANAGEMENT GETS
          </Typography>
        </Box>
        <Chip
          label="EXECUTIVE OUTCOMES"
          size="small"
          sx={{
            bgcolor: "#F1F5F9",
            color: "#475569",
            fontWeight: 700,
            fontSize: "0.68rem",
            letterSpacing: "0.6px",
            border: "1px solid #E2E8F0",
          }}
        />
      </Box>

      {/* 6 Icon-led Rows with Color Highlights & Border Accents */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75, flex: 1, justifyContent: "space-between" }}>
        {MANAGEMENT_ITEMS.map((item, idx) => (
          <Box
            key={idx}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1.6,
              p: 1.4,
              borderRadius: 2,
              bgcolor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderLeft: `3.5px solid ${item.accentColor}`,
              position: "relative",
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                bgcolor: "#FFFFFF",
                borderColor: "#CBD5E1",
                borderLeftColor: item.accentColor,
                transform: "translateX(-4px)",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
              },
            }}
          >
            {/* Gradient Icon Container */}
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#FFFFFF",
                background: item.gradient,
                boxShadow: `0 3px 10px ${item.accentColor}35`,
              }}
            >
              {item.icon}
            </Box>

            {/* Text Information */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.3 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 800,
                    color: "#0F172A",
                    fontSize: "0.88rem",
                    lineHeight: 1.25,
                  }}
                >
                  {item.title}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: item.accentColor,
                    fontSize: "0.64rem",
                    fontWeight: 800,
                    letterSpacing: "0.6px",
                    bgcolor: `${item.accentColor}12`,
                    px: 0.8,
                    py: 0.2,
                    borderRadius: 1,
                    border: `1px solid ${item.accentColor}25`,
                  }}
                >
                  {item.tag}
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: "#64748B",
                  fontSize: "0.75rem",
                  lineHeight: 1.4,
                  display: "block",
                }}
              >
                {item.description}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};
