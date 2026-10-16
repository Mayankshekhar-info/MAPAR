import React from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

import { LoginBranding } from "../components/LoginBranding";
import { LoginForm } from "../components/LoginForm";
import { LoginVisualPreview } from "../components/LoginVisualPreview";
import { useLogin } from "../hooks/useLogin";

export const LoginPage: React.FC = () => {
  const { login, isSubmitting, errorMessage, clearError } = useLogin();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        bgcolor: "#FFFFFF",
      }}
    >
      <Grid container sx={{ flex: 1 }}>
        {/* Left Side: Login Form Area */}
        <Grid
          size={{ xs: 12, md: 5, lg: 5 }}
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            p: { xs: 3, sm: 6, md: 6, lg: 8 },
            bgcolor: "#FFFFFF",
            borderRight: { md: "1px solid #E2E8F0" },
          }}
        >
          {/* Top spacer or brand micro-logo if needed */}
          <Box />

          {/* Centered Form Container */}
          <Box sx={{ width: "100%", maxWidth: 440, mx: "auto", my: "auto", py: 4 }}>
            <LoginBranding />
            <LoginForm
              onSubmit={login}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              onClearError={clearError}
            />
          </Box>

          {/* Footer Legal & Compliance */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              pt: 3,
              borderTop: "1px solid #F1F5F9",
              flexWrap: "wrap",
              gap: 1.5,
            }}
          >
            <Typography variant="caption" sx={{ color: "#94A3B8" }}>
              © {new Date().getFullYear()} PTPL MAPAR Enterprise. All rights reserved.
            </Typography>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Link
                href="#"
                underline="hover"
                sx={{ color: "#64748B", fontSize: "0.75rem", fontWeight: 500 }}
              >
                Security Policy
              </Link>
              <Link
                href="#"
                underline="hover"
                sx={{ color: "#64748B", fontSize: "0.75rem", fontWeight: 500 }}
              >
                Compliance
              </Link>
            </Box>
          </Box>
        </Grid>

        {/* Right Side: Visual Cockpit Preview Area */}
        <Grid
          size={{ xs: 0, md: 7, lg: 7 }}
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            bgcolor: "#0A192F",
            background: "linear-gradient(145deg, #091322 0%, #0F172A 60%, #1E293B 100%)",
            position: "relative",
          }}
        >
          <LoginVisualPreview />
        </Grid>
      </Grid>
    </Box>
  );
};
