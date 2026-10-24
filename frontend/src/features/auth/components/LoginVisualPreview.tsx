import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";

export const LoginVisualPreview: React.FC = () => {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        p: { xs: 2, md: 4, lg: 6 },
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle geometric background glows */}
      <Box
        sx={{
          position: "absolute",
          top: "-15%",
          right: "-10%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(21, 101, 192, 0.25) 0%, rgba(13, 71, 161, 0) 70%)",
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: "-20%",
          left: "-10%",
          width: 450,
          height: 450,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0) 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      {/* Main Preview Container */}
      <Box sx={{ width: "100%", maxWidth: 640, position: "relative", zIndex: 1 }}>
        {/* Header Preview Intro */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Chip
              label="MANAGEMENT REVIEW"
              size="small"
              sx={{
                bgcolor: "rgba(255, 255, 255, 0.12)",
                color: "#E2E8F0",
                fontWeight: 700,
                fontSize: "0.68rem",
                letterSpacing: "0.5px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
              }}
            />
            <Typography variant="caption" sx={{ color: "#94A3B8", fontWeight: 500 }}>
              Live Multi-Company Portfolio Cockpit
            </Typography>
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: "#FFFFFF",
              letterSpacing: "-0.5px",
              fontSize: { xs: "1.5rem", md: "1.9rem" },
              lineHeight: 1.25,
            }}
          >
            Unified Corporate Governance & Operational Intelligence
          </Typography>
        </Box>

        {/* Mock Cockpit Window */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            bgcolor: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            overflow: "hidden",
          }}
        >
          {/* Top Window Bar */}
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              bgcolor: "rgba(30, 41, 59, 0.7)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#EF4444" }} />
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#F59E0B" }} />
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#10B981" }} />
              <Typography
                variant="caption"
                sx={{
                  color: "#94A3B8",
                  ml: 1.5,
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                  fontSize: "0.725rem",
                }}
              >
                PTPL MAPAR • Executive Management Cockpit
              </Typography>
            </Box>
            <Chip
              label="SEP 2026 REVIEW"
              size="small"
              sx={{
                height: 18,
                fontSize: "0.625rem",
                fontWeight: 700,
                color: "#38BDF8",
                bgcolor: "rgba(56, 189, 248, 0.12)",
                border: "1px solid rgba(56, 189, 248, 0.25)",
              }}
            />
          </Box>

          {/* Metric Tiles Row */}
          <Box sx={{ p: 2.5 }}>
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              {/* Tile 1 */}
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "rgba(30, 41, 59, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <Typography variant="caption" sx={{ color: "#94A3B8", display: "block", fontSize: "0.7rem" }}>
                    Network Uptime
                  </Typography>
                  <Typography variant="h6" sx={{ color: "#10B981", fontWeight: 700, lineHeight: 1.3 }}>
                    99.85%
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748B", fontSize: "0.65rem" }}>
                    Target: ≥ 99.5%
                  </Typography>
                </Box>
              </Grid>

              {/* Tile 2 */}
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "rgba(30, 41, 59, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <Typography variant="caption" sx={{ color: "#94A3B8", display: "block", fontSize: "0.7rem" }}>
                    Revenue Efficiency
                  </Typography>
                  <Typography variant="h6" sx={{ color: "#38BDF8", fontWeight: 700, lineHeight: 1.3 }}>
                    98.4%
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748B", fontSize: "0.65rem" }}>
                    Collections Active
                  </Typography>
                </Box>
              </Grid>

              {/* Tile 3 */}
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "rgba(30, 41, 59, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <Typography variant="caption" sx={{ color: "#94A3B8", display: "block", fontSize: "0.7rem" }}>
                    MOM Actions
                  </Typography>
                  <Typography variant="h6" sx={{ color: "#F59E0B", fontWeight: 700, lineHeight: 1.3 }}>
                    94.2%
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748B", fontSize: "0.65rem" }}>
                    Closure Rate
                  </Typography>
                </Box>
              </Grid>

              {/* Tile 4 */}
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "rgba(30, 41, 59, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <Typography variant="caption" sx={{ color: "#94A3B8", display: "block", fontSize: "0.7rem" }}>
                    Risk Index
                  </Typography>
                  <Typography variant="h6" sx={{ color: "#10B981", fontWeight: 700, lineHeight: 1.3 }}>
                    Low (1.8)
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748B", fontSize: "0.65rem" }}>
                    5×5 Matrix Guard
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Table Mockup Preview */}
            <Box
              sx={{
                borderRadius: 2,
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                bgcolor: "rgba(2, 6, 23, 0.4)",
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  px: 2,
                  py: 1,
                  bgcolor: "rgba(30, 41, 59, 0.8)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <Typography variant="caption" sx={{ color: "#94A3B8", fontWeight: 700, fontSize: "0.7rem" }}>
                  GOVERNANCE DOMAIN
                </Typography>
                <Typography variant="caption" sx={{ color: "#94A3B8", fontWeight: 700, fontSize: "0.7rem" }}>
                  TARGET
                </Typography>
                <Typography variant="caption" sx={{ color: "#94A3B8", fontWeight: 700, fontSize: "0.7rem" }}>
                  ACHIEVED
                </Typography>
                <Typography variant="caption" sx={{ color: "#94A3B8", fontWeight: 700, fontSize: "0.7rem" }}>
                  STATUS
                </Typography>
              </Box>

              {/* Rows */}
              {[
                { domain: "Asset Availability & Fleet", target: "≥ 98.0%", val: "99.1%", status: "NORMAL", color: "#10B981" },
                { domain: "Statutory & Tax Compliance", target: "100%", val: "100%", status: "COMPLIANT", color: "#10B981" },
                { domain: "Telecom SIM Utilization", target: "≥ 95.0%", val: "92.4%", status: "ATTENTION", color: "#F59E0B" },
                { domain: "Field Splicer Attendance", target: "≥ 97.0%", val: "98.2%", status: "NORMAL", color: "#10B981" },
              ].map((row, i) => (
                <Box
                  key={i}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr",
                    px: 2,
                    py: 1.1,
                    borderBottom: i < 3 ? "1px solid rgba(255, 255, 255, 0.04)" : "none",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="caption" sx={{ color: "#f1f9f5ff", fontWeight: 500, fontSize: "0.75rem" }}>
                    {row.domain}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#3ab68fff", fontSize: "0.725rem" }}>
                    {row.target}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#3fcf8eff", fontWeight: 600, fontSize: "0.725rem" }}>
                    {row.val}
                  </Typography>
                  <Box>
                    <Chip
                      label={row.status}
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        color: row.color,
                        bgcolor: `${row.color}1A`,
                        border: `1px solid ${row.color}40`,
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Footer Preview Watermark */}
          <Box
            sx={{
              px: 2.5,
              py: 1.25,
              bgcolor: "rgba(15, 23, 42, 0.9)",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="caption" sx={{ color: "#64748B", fontSize: "0.68rem" }}>
              7-Tier Hierarchy Scoping • Immutable Audit Trail Active
            </Typography>
            <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.65rem", fontWeight: 600 }}>
              PREVIEW ONLY
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};
