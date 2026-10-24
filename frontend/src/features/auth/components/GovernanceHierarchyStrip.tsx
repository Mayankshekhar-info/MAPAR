import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

interface HierarchyNode {
  level: number;
  label: string;
  sublabel: string;
  color: string;
  gradient: string;
}

const HIERARCHY_NODES: HierarchyNode[] = [
  { level: 1, label: "Main Company", sublabel: "Corporate Board & CXO", color: "#6366F1", gradient: "linear-gradient(135deg, #6366F1 0%, #4338CA 100%)" },
  { level: 2, label: "Sub-Company", sublabel: "Operating Entities", color: "#00D2FF", gradient: "linear-gradient(135deg, #00D2FF 0%, #0284C7 100%)" },
  { level: 3, label: "Circle", sublabel: "Regional Operations", color: "#00E676", gradient: "linear-gradient(135deg, #00E676 0%, #059669 100%)" },
  { level: 4, label: "Project", sublabel: "Solar / Wind / Sites", color: "#0D9488", gradient: "linear-gradient(135deg, #0D9488 0%, #047857 100%)" },
  { level: 5, label: "Domain", sublabel: "Eng, O&M, SCM, QA", color: "#FBBF24", gradient: "linear-gradient(135deg, #FBBF24 0%, #D97706 100%)" },
  { level: 6, label: "Department", sublabel: "Functional Teams", color: "#F97316", gradient: "linear-gradient(135deg, #F97316 0%, #C2410C 100%)" },
  { level: 7, label: "Action Owner", sublabel: "Assigned Task Leads", color: "#EC4899", gradient: "linear-gradient(135deg, #EC4899 0%, #BE185D 100%)" },
];

export const GovernanceHierarchyStrip: React.FC = () => {
  return (
    <Paper
      elevation={0}
      sx={{
        width: "100%",
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        bgcolor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
        position: "relative",
        overflow: "hidden",
        transition: "all 0.3s ease",
        "&:hover": {
          borderColor: "#A7F3D0",
          boxShadow: "0 6px 20px rgba(5, 150, 105, 0.06)",
        },
      }}
    >
      {/* Top Accent Gradient Bar */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "linear-gradient(90deg, #6366F1 0%, #0891B2 35%, #059669 70%, #EC4899 100%)",
        }}
      />

      {/* Strip Title */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1.5,
              bgcolor: "#ECFDF5",
              border: "1px solid #A7F3D0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#059669",
            }}
          >
            <AccountTreeOutlinedIcon sx={{ fontSize: 16 }} />
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 900,
              letterSpacing: "0.8px",
              color: "#0F172A",
              textTransform: "uppercase",
              fontSize: "0.78rem",
            }}
          >
            Configured Organization Hierarchy — Multi-Tier Cascading Governance
          </Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: "#059669",
            fontSize: "0.72rem",
            fontWeight: 800,
            bgcolor: "#ECFDF5",
            px: 1.2,
            py: 0.3,
            borderRadius: 1.5,
            border: "1px solid #A7F3D0",
          }}
        >
          7 Authorized Levels
        </Typography>
      </Box>

      {/* Horizontal Connected Nodes */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: 1, sm: 1.5 },
          overflowX: "auto",
          py: 0.5,
          "&::-webkit-scrollbar": { height: 4 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "#CBD5E1", borderRadius: 2 },
        }}
      >
        {HIERARCHY_NODES.map((node, idx) => (
          <React.Fragment key={node.level}>
            <Box
              sx={{
                flex: "1 0 auto",
                minWidth: { xs: 125, sm: 145 },
                p: 1.35,
                borderRadius: 2,
                bgcolor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderLeft: `3px solid ${node.color}`,
                position: "relative",
                transition: "all 0.22s ease-in-out",
                "&:hover": {
                  bgcolor: "#FFFFFF",
                  borderColor: "#CBD5E1",
                  borderLeftColor: node.color,
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.3 }}>
                <Box
                  sx={{
                    px: 0.7,
                    py: 0.15,
                    borderRadius: 0.8,
                    bgcolor: node.color,
                    color: "#FFFFFF",
                    fontWeight: 900,
                    fontSize: "0.65rem",
                    letterSpacing: "0.5px",
                  }}
                >
                  L{node.level}
                </Box>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    bgcolor: node.color,
                    opacity: 0.8,
                  }}
                />
              </Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 800,
                  color: "#0F172A",
                  fontSize: "0.84rem",
                  lineHeight: 1.25,
                }}
              >
                {node.label}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: "#64748B",
                  fontSize: "0.7rem",
                  display: "block",
                  mt: 0.3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.sublabel}
              </Typography>
            </Box>

            {/* Connecting Chevron Arrow (except last) */}
            {idx < HIERARCHY_NODES.length - 1 && (
              <ArrowForwardIosIcon
                sx={{
                  fontSize: 12,
                  color: "#94A3B8",
                  flexShrink: 0,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </Box>
    </Paper>
  );
};
