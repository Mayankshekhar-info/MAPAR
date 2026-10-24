import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";

export const LoginBranding: React.FC = () => {
  return (
    <Box sx={{ mb: 4 }}>
      {/* Brand Badge */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        {/* Hexagonal Shield Logo Icon */}
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            background: "linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(21, 101, 192, 0.35)",
            color: "#ffffff",
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L3 7V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V7L12 2Z"
              fill="rgba(255,255,255,0.2)"
            />
            <path
              d="M12 4L5 8V12C5 16.4 7.97 20.5 12 21.6C16.03 20.5 19 16.4 19 12V8L12 4Z"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 12L11 14L15 10"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Box>

        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                letterSpacing: "-0.5px",
                color: "#1E293B",
                lineHeight: 1,
              }}
            >
              MAPAR
            </Typography>
            <Chip
              label="v2.0 ENTERPRISE"
              size="small"
              sx={{
                height: 20,
                fontSize: "0.65rem",
                fontWeight: 700,
                bgcolor: "rgba(21, 101, 192, 0.08)",
                color: "#1565C0",
                borderRadius: 1,
              }}
            />
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: "#64748B",
              fontWeight: 500,
              fontSize: "0.75rem",
              letterSpacing: "0.2px",
            }}
          >
            Governance, Risk & Operational Review
          </Typography>
        </Box>
      </Box>

      {/* Welcome Heading */}
      <Typography
        variant="h4"
        component="h1"
        sx={{
          fontWeight: 700,
          color: "#0F172A",
          fontSize: { xs: "1.6rem", sm: "1.85rem" },
          letterSpacing: "-0.5px",
          mb: 0.75,
        }}
      >
        Sign in to your account
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: "#64748B",
          fontSize: "0.925rem",
          lineHeight: 1.5,
        }}
      >
        Welcome back. Enter your corporate credentials to access the management cockpit.
      </Typography>
    </Box>
  );
};
