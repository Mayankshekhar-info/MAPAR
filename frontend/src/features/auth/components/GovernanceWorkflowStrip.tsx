import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import SyncAltIcon from "@mui/icons-material/SyncAlt";

interface WorkflowStage {
  step: string;
  title: string;
  description: string;
  color: string;
  gradient: string;
}

const WORKFLOW_STAGES: WorkflowStage[] = [
  {
    step: "01",
    title: "Identify & Assign",
    description: "Target setting, clear deliverables & assigned ownership across hierarchy.",
    color: "#00D2FF", // Pratap Cyan
    gradient: "linear-gradient(135deg, #00D2FF 0%, #0284C7 100%)",
  },
  {
    step: "02",
    title: "Execute & Log",
    description: "Weekly progress updates, completion velocity, achievements & blocker notes.",
    color: "#00E676", // Pratap Leaf Green
    gradient: "linear-gradient(135deg, #00E676 0%, #059669 100%)",
  },
  {
    step: "03",
    title: "Upload Evidence",
    description: "Supporting documentation, test certificates, and photographic proof.",
    color: "#FBBF24", // Amber
    gradient: "linear-gradient(135deg, #FBBF24 0%, #D97706 100%)",
  },
  {
    step: "04",
    title: "Review & Verify",
    description: "Authorized evaluator review, acceptance sign-off, or rework comments.",
    color: "#10B981", // Emerald
    gradient: "linear-gradient(135deg, #10B981 0%, #047857 100%)",
  },
  {
    step: "05",
    title: "Close & Audit",
    description: "Formal milestone closure, immutable audit trail, and executive KPI reflection.",
    color: "#8B5CF6", // Purple
    gradient: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
  },
];

export const GovernanceWorkflowStrip: React.FC = () => {
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
          background: "linear-gradient(90deg, #059669 0%, #0891B2 50%, #6366F1 100%)",
        }}
      />

      {/* Header */}
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
            <SyncAltIcon sx={{ fontSize: 16 }} />
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
            Closed-Loop Governance Workflow — 5-Stage Systematic Cadence
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
          Continuous Audit Loop
        </Typography>
      </Box>

      {/* 5 Stages Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(5, 1fr)" },
          gap: 1.5,
        }}
      >
        {WORKFLOW_STAGES.map((stg) => (
          <Box
            key={stg.step}
            sx={{
              p: 1.6,
              borderRadius: 2,
              bgcolor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderLeft: `3px solid ${stg.color}`,
              position: "relative",
              transition: "all 0.22s ease-in-out",
              "&:hover": {
                bgcolor: "#FFFFFF",
                borderColor: "#CBD5E1",
                borderLeftColor: stg.color,
                transform: "translateY(-2px)",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.6 }}>
              <Box
                sx={{
                  px: 0.9,
                  py: 0.25,
                  borderRadius: 1,
                  background: stg.gradient,
                  color: "#FFFFFF",
                  fontSize: "0.72rem",
                  fontWeight: 900,
                  letterSpacing: "0.5px",
                }}
              >
                {stg.step}
              </Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 800,
                  color: "#0F172A",
                  fontSize: "0.86rem",
                  lineHeight: 1.2,
                }}
              >
                {stg.title}
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: "#64748B",
                fontSize: "0.72rem",
                lineHeight: 1.4,
                display: "block",
              }}
            >
              {stg.description}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};
