import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import AutoModeOutlinedIcon from "@mui/icons-material/AutoModeOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface WhyItem {
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  accentColor: string;
  gradient: string;
}

const WHY_ITEMS: WhyItem[] = [
  {
    icon: <SpeedOutlinedIcon sx={{ fontSize: 20 }} />,
    tag: "METRICS",
    title: "Centralized KPI Tracking",
    description: "Standardized performance metrics across circles, departments, and domains in real-time.",
    accentColor: "#00D2FF", // Pratap Cyan
    gradient: "linear-gradient(135deg, #00D2FF 0%, #0284C7 100%)",
  },
  {
    icon: <VisibilityOutlinedIcon sx={{ fontSize: 20 }} />,
    tag: "TRANSPARENCY",
    title: "Complete Visibility",
    description: "End-to-end transparency from boardroom MD / CXO dashboards down to site action owners.",
    accentColor: "#00E676", // Pratap Leaf Green
    gradient: "linear-gradient(135deg, #00E676 0%, #059669 100%)",
  },
  {
    icon: <TaskAltOutlinedIcon sx={{ fontSize: 20 }} />,
    tag: "ACTIONABLES",
    title: "Track Open Actionables",
    description: "Closed-loop action tracking with target date governance, revision history, and zero leakage.",
    accentColor: "#FBBF24", // Vibrant Amber
    gradient: "linear-gradient(135deg, #FBBF24 0%, #D97706 100%)",
  },
  {
    icon: <WarningAmberOutlinedIcon sx={{ fontSize: 20 }} />,
    tag: "ESCALATION",
    title: "Proactive Risk Management",
    description: "Early warning triggers, risk escalation matrix (>30 days ageing), and blocker detection.",
    accentColor: "#F43F5E", // Rose / Coral
    gradient: "linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)",
  },
  {
    icon: <TrendingUpOutlinedIcon sx={{ fontSize: 20 }} />,
    tag: "IMPROVEMENT",
    title: "Structured Improvement",
    description: "Systematic review cadences, weekly milestone commits, and verified evidence audits.",
    accentColor: "#A855F7", // Purple
    gradient: "linear-gradient(135deg, #A855F7 0%, #7E22CE 100%)",
  },
  {
    icon: <AutoModeOutlinedIcon sx={{ fontSize: 20 }} />,
    tag: "AUTOMATION",
    title: "Automated Governance",
    description: "Automated weekly reporting cadences, bulk Excel synchronizer, and tamper-proof audit trail.",
    accentColor: "#38BDF8", // Electric Blue
    gradient: "linear-gradient(135deg, #38BDF8 0%, #2563EB 100%)",
  },
];

export const GovernanceWhyPanel: React.FC = () => {
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
      {/* Top Luminous Emerald-to-Teal Accent Bar */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "linear-gradient(90deg, #059669 0%, #0891B2 100%)",
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
            bgcolor: "#ECFDF5",
            border: "1px solid #A7F3D0",
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 18, color: "#059669" }} />
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 900,
              letterSpacing: "1.2px",
              color: "#065F46",
              fontSize: "0.85rem",
            }}
          >
            WHY PAGMS
          </Typography>
        </Box>
        <Chip
          label="CORE CAPABILITIES"
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
        {WHY_ITEMS.map((item, idx) => (
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
                transform: "translateX(4px)",
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
