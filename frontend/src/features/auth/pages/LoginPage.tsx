import React, { useState } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import CloseIcon from "@mui/icons-material/Close";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LoginIcon from "@mui/icons-material/Login";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";

import { useLogin } from "../hooks/useLogin";
import { LoginForm } from "../components/LoginForm";
import { CentralGovernanceWheel } from "../components/CentralGovernanceWheel";
import { GovernanceWhyPanel } from "../components/GovernanceWhyPanel";
import { GovernanceManagementPanel } from "../components/GovernanceManagementPanel";
import { GovernanceHierarchyStrip } from "../components/GovernanceHierarchyStrip";
import { GovernanceWorkflowStrip } from "../components/GovernanceWorkflowStrip";

export const LoginPage: React.FC = () => {
  const { login, isSubmitting, errorMessage, clearError } = useLogin();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#EBF7F2",
        background: `
          radial-gradient(1400px circle at 50% -5%, #E1F7ED 0%, #D4F4E4 35%, #E2F6ED 65%, #ECF8F2 100%)
        `,
        color: "#0F172A",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflowX: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* 1. Thin Vibrant Pratap Cyan-to-Green Gradient Top Strip */}
      <Box
        sx={{
          height: 3,
          width: "100%",
          background: "linear-gradient(90deg, #059669 0%, #10B981 35%, #0891B2 70%, #059669 100%)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 1px 3px rgba(5, 150, 105, 0.2)",
        }}
      />

      {/* Soft Green Decorative Curves and Shapes */}
      <Box
        component="svg"
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.7,
        }}
      >
        <path
          d="M-80 160 C 300 70, 720 230, 1140 120 C 1320 70, 1480 160, 1600 200"
          stroke="rgba(16, 185, 129, 0.18)"
          strokeWidth="2.5"
          fill="none"
        />
        <path
          d="M-40 340 C 380 250, 760 410, 1180 270 C 1360 210, 1500 310, 1620 350"
          stroke="rgba(5, 150, 105, 0.14)"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M120 620 C 500 520, 880 690, 1260 550 C 1440 480, 1560 580, 1680 610"
          stroke="rgba(16, 185, 129, 0.15)"
          strokeWidth="2"
          fill="none"
        />
      </Box>

      {/* Ambient Soft Mint-Green Brand Lighting */}
      <Box
        sx={{
          position: "absolute",
          top: "-6%",
          left: "8%",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.20) 0%, rgba(5, 150, 105, 0.06) 55%, transparent 75%)",
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: "35%",
          right: "-6%",
          width: 580,
          height: 580,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(52, 211, 153, 0.22) 0%, rgba(16, 185, 129, 0.07) 60%, transparent 80%)",
          filter: "blur(70px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: "4%",
          left: "-6%",
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(5, 150, 105, 0.05) 55%, transparent 75%)",
          filter: "blur(65px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* 2. Header and Branding Bar */}
      <Box
        component="header"
        sx={{
          py: 1.5,
          px: { xs: 2, sm: 4, md: 5 },
          borderBottom: "1px solid #E2E8F0",
          bgcolor: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(16px)",
          position: "sticky",
          top: 3,
          zIndex: 90,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
            maxWidth: 1680,
            mx: "auto",
          }}
        >
          {/* Left Side: Pratap Logo & PAGMS Branding */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {/* Official Pratap - Carving Lives Logo Container */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                transition: "all 0.3s ease",
                "&:hover": {
                  filter: "drop-shadow(0 2px 6px rgba(5, 150, 105, 0.3))",
                },
              }}
            >
              <Box
                component="img"
                src="/pratap_logo.png"
                alt="Pratap - Carving Lives"
                sx={{
                  height: 44,
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </Box>

            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 900,
                    letterSpacing: "0.5px",
                    color: "#0F172A",
                    lineHeight: 1,
                  }}
                >
                  PAGMS
                </Typography>
                <Chip
                  label="ENTERPRISE"
                  size="small"
                  sx={{
                    bgcolor: "#ECFDF5",
                    color: "#059669",
                    fontWeight: 800,
                    fontSize: "0.65rem",
                    height: 20,
                    border: "1px solid #A7F3D0",
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: "#64748B",
                  fontWeight: 600,
                  fontSize: "0.74rem",
                  letterSpacing: "0.2px",
                }}
              >
                Performance & Action Governance Management System
              </Typography>
            </Box>

          </Box>

          {/* Far Right: Live Status Pill & Login Trigger */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                display: { xs: "none", sm: "flex" },
                alignItems: "center",
                gap: 0.8,
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                bgcolor: "#ECFDF5",
                border: "1px solid #A7F3D0",
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: "#10B981",
                  boxShadow: "0 0 6px rgba(16, 185, 129, 0.4)",
                }}
              />
              <Typography variant="caption" sx={{ color: "#059669", fontWeight: 800, fontSize: "0.74rem" }}>
                System Operational
              </Typography>
            </Box>

            <Button
              variant="contained"
              startIcon={<LockOutlinedIcon />}
              onClick={() => setIsLoginModalOpen(true)}
              sx={{
                background: "linear-gradient(135deg, #059669 0%, #0D9488 100%)",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: "0.86rem",
                textTransform: "none",
                px: 2.5,
                py: 0.85,
                borderRadius: 2,
                boxShadow: "0 2px 6px rgba(5, 150, 105, 0.25)",
                transition: "all 0.2s ease",
                "&:hover": {
                  background: "linear-gradient(135deg, #047857 0%, #0F766E 100%)",
                  boxShadow: "0 4px 12px rgba(5, 150, 105, 0.35)",
                  transform: "translateY(-1px)",
                },
              }}
            >
              Sign In to PAGMS
            </Button>
          </Box>
        </Box>
      </Box>

      {/* 3. Main Dashboard Body Container */}
      <Container
        maxWidth={false}
        sx={{
          maxWidth: 1680,
          flex: 1,
          py: { xs: 2.5, md: 3.5 },
          px: { xs: 2, sm: 3, md: 4 },
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {/* Row A: 3-Column Core Governance Layout */}
        <Grid container spacing={3} alignItems="stretch">
          {/* Left Column: WHY PAGMS Panel */}
          <Grid size={{ xs: 12, lg: 3.5 }}>
            <GovernanceWhyPanel />
          </Grid>

          {/* Center Column: Circular Governance Diagram & Direct Portal Entry */}
          <Grid
            size={{ xs: 12, lg: 5 }}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2.5,
              position: "relative",
            }}
          >
            {/* Subtle green glow around the central PAGMS governance diagram */}
            <Box
              sx={{
                position: "absolute",
                top: "36%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 480,
                height: 480,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.08) 50%, transparent 72%)",
                filter: "blur(45px)",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />

            {/* The Central Circular Diagram */}
            <Box sx={{ position: "relative", zIndex: 1, width: "100%", display: "flex", justifyContent: "center" }}>
              <CentralGovernanceWheel />
            </Box>

            {/* Central Portal Access Banner Card with ProTap Cyan-Green Border */}
            <Paper
              elevation={0}
              sx={{
                width: "100%",
                p: 2.25,
                borderRadius: 3,
                bgcolor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 2,
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.3s ease",
                "&:hover": {
                  borderColor: "#A7F3D0",
                  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.06)",
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
                  background: "linear-gradient(90deg, #059669 0%, #0891B2 100%)",
                }}
              />

              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 200, flex: 1 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    bgcolor: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#059669",
                    flexShrink: 0,
                  }}
                >
                  <VpnKeyOutlinedIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0F172A", fontSize: "0.9rem" }}>
                    Authorized Enterprise Access
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748B", fontSize: "0.75rem" }}>
                    Log in with assigned corporate credentials to access your organization scope.
                  </Typography>
                </Box>
              </Box>

              <Button
                variant="contained"
                startIcon={<LoginIcon />}
                onClick={() => setIsLoginModalOpen(true)}
                sx={{
                  background: "linear-gradient(135deg, #059669 0%, #0D9488 100%)",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  textTransform: "none",
                  px: 2.5,
                  py: 0.85,
                  borderRadius: 2,
                  boxShadow: "0 2px 6px rgba(5, 150, 105, 0.25)",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    background: "linear-gradient(135deg, #047857 0%, #0F766E 100%)",
                    boxShadow: "0 4px 12px rgba(5, 150, 105, 0.35)",
                    transform: "translateY(-1px)",
                  },
                }}
              >
                Access Portal
              </Button>
            </Paper>
          </Grid>

          {/* Right Column: WHAT MANAGEMENT GETS Panel */}
          <Grid size={{ xs: 12, lg: 3.5 }}>
            <GovernanceManagementPanel />
          </Grid>
        </Grid>

        {/* Row B: Horizontal Organization Hierarchy Strip */}
        <Box sx={{ width: "100%" }}>
          <GovernanceHierarchyStrip />
        </Box>

        {/* Row C: 5-Stage Closed-Loop Governance Workflow Strip */}
        <Box sx={{ width: "100%" }}>
          <GovernanceWorkflowStrip />
        </Box>
      </Container>

      {/* 4. Enterprise Footer */}
      <Box
        component="footer"
        sx={{
          mt: "auto",
          py: 2.5,
          px: { xs: 2, sm: 4 },
          borderTop: "1px solid #E2E8F0",
          bgcolor: "#FFFFFF",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
            maxWidth: 1680,
            mx: "auto",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography variant="caption" sx={{ color: "#64748B", fontSize: "0.76rem" }}>
              © {new Date().getFullYear()} PTPL MAPAR / PAGMS Enterprise. All rights reserved.
            </Typography>
            <Typography variant="caption" sx={{ color: "#CBD5E1", display: { xs: "none", sm: "inline" } }}>
              •
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <ShieldOutlinedIcon sx={{ fontSize: 14, color: "#059669" }} />
              <Typography variant="caption" sx={{ color: "#475569", fontSize: "0.74rem", fontWeight: 600 }}>
                ISO 27001 Certified • Multi-Tier Scoped RBAC • TLS 1.3 Encrypted
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 2.5 }}>
            <Link
              href="#"
              underline="hover"
              sx={{ color: "#64748B", fontSize: "0.76rem", fontWeight: 500, "&:hover": { color: "#059669" } }}
            >
              Security Policy
            </Link>
            <Link
              href="#"
              underline="hover"
              sx={{ color: "#64748B", fontSize: "0.76rem", fontWeight: 500, "&:hover": { color: "#059669" } }}
            >
              Compliance
            </Link>
            <Link
              href="#"
              underline="hover"
              sx={{ color: "#64748B", fontSize: "0.76rem", fontWeight: 500, "&:hover": { color: "#059669" } }}
            >
              Enterprise Support
            </Link>
          </Box>
        </Box>
      </Box>

      {/* 5. Refined Light Modal with ProTap Branding */}
      <Dialog
        open={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            boxShadow: "0 20px 48px rgba(0, 0, 0, 0.12)",
            p: 1,
            color: "#0F172A",
            position: "relative",
            overflow: "hidden",
          },
        }}
      >
        {/* Top Accent Gradient Bar in Modal */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3.5,
            background: "linear-gradient(90deg, #059669 0%, #0891B2 100%)",
          }}
        />

        <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
          <IconButton
            onClick={() => setIsLoginModalOpen(false)}
            size="small"
            sx={{ color: "#64748B", "&:hover": { color: "#0F172A", bgcolor: "#F1F5F9" } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <DialogContent sx={{ px: 3.5, pb: 4, pt: 0 }}>
          {/* Official Pratap Logo inside Modal Header */}
          <Box sx={{ textAlign: "center", mb: 2.5 }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                mb: 1.5,
              }}
            >
              <Box
                component="img"
                src="/pratap_logo.png"
                alt="Pratap - Carving Lives"
                sx={{
                  height: 48,
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 900, color: "#0F172A", letterSpacing: "-0.5px" }}>
              Sign In to PAGMS
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748B", mt: 0.5, fontSize: "0.84rem" }}>
              Performance & Action Governance Management System
            </Typography>
          </Box>

          {/* Integrated Authentication Form in Light Mode */}
          <LoginForm
            dark={false}
            onSubmit={login}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            onClearError={clearError}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};
