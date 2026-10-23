import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import PersonOutline from "@mui/icons-material/PersonOutline";
import LockOutlined from "@mui/icons-material/LockOutlined";

import { LoginFormData, loginSchema } from "../schemas/login.schema";
import { LoginCredentials } from "../types/auth.types";

interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClearError: () => void;
  dark?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  isSubmitting,
  errorMessage,
  onClearError,
  dark = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  const handleFormSubmit = (data: LoginFormData) => {
    onSubmit({
      username: data.username,
      password: data.password,
      rememberMe: data.rememberMe,
    });
  };

  return (
    <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} noValidate sx={{ width: "100%" }}>
      {/* Error Feedback */}
      {errorMessage && (
        <Alert
          severity="error"
          onClose={onClearError}
          sx={{
            mb: 3,
            borderRadius: 1.5,
            fontSize: "0.875rem",
            alignItems: "center",
          }}
        >
          {errorMessage}
        </Alert>
      )}

      {/* Username / Corporate Email Field */}
      <Box sx={{ mb: 2.5 }}>
        <Typography
          component="label"
          htmlFor="login-username"
          sx={{
            display: "block",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: dark ? "#CBD5E1" : "#334155",
            mb: 0.75,
          }}
        >
          Username or Corporate Email
        </Typography>
        <Controller
          name="username"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              id="login-username"
              fullWidth
              autoComplete="username"
              autoFocus
              placeholder="e.g. jdoe@telecrats.in"
              error={!!errors.username}
              helperText={errors.username?.message}
              disabled={isSubmitting}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutline sx={{ color: dark ? "#64748B" : "#94A3B8", fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 1.5,
                    bgcolor: dark ? "rgba(19, 28, 40, 0.85)" : "#F8FAFC",
                    color: dark ? "#F8FAFC" : "#0F172A",
                    border: dark ? "1px solid rgba(0, 210, 255, 0.22)" : "1px solid #E2E8F0",
                    "&:hover": {
                      bgcolor: dark ? "rgba(25, 38, 54, 0.95)" : "#FFFFFF",
                      borderColor: dark ? "rgba(0, 210, 255, 0.45)" : "#CBD5E1",
                    },
                    "&.Mui-focused": {
                      bgcolor: dark ? "#162334" : "#FFFFFF",
                      borderColor: dark ? "#00D2FF" : "#059669",
                    },
                  },
                },
              }}
            />
          )}
        />
      </Box>

      {/* Password Field */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
          <Typography
            component="label"
            htmlFor="login-password"
            sx={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: dark ? "#CBD5E1" : "#334155",
            }}
          >
            Password
          </Typography>
          <Link
            component="button"
            type="button"
            variant="body2"
            onClick={() => setForgotPasswordOpen(true)}
            sx={{
              fontSize: "0.825rem",
              fontWeight: 600,
              color: dark ? "#38BDF8" : "#059669",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Forgot password?
          </Link>
        </Box>
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              id="login-password"
              type={showPassword ? "text" : "password"}
              fullWidth
              autoComplete="current-password"
              placeholder="••••••••••••"
              error={!!errors.password}
              helperText={errors.password?.message}
              disabled={isSubmitting}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: dark ? "#64748B" : "#94A3B8", fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        sx={{ color: dark ? "#94A3B8" : "#94A3B8" }}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 1.5,
                    bgcolor: dark ? "rgba(19, 28, 40, 0.85)" : "#F8FAFC",
                    color: dark ? "#F8FAFC" : "#0F172A",
                    border: dark ? "1px solid rgba(0, 210, 255, 0.22)" : "1px solid #E2E8F0",
                    "&:hover": {
                      bgcolor: dark ? "rgba(25, 38, 54, 0.95)" : "#FFFFFF",
                      borderColor: dark ? "rgba(0, 210, 255, 0.45)" : "#CBD5E1",
                    },
                    "&.Mui-focused": {
                      bgcolor: dark ? "#162334" : "#FFFFFF",
                      borderColor: dark ? "#00D2FF" : "#059669",
                    },
                  },
                },
              }}
            />
          )}
        />
      </Box>

      {/* Remember Me Option */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Controller
          name="rememberMe"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Checkbox
                  {...field}
                  checked={field.value}
                  size="small"
                  disabled={isSubmitting}
                  sx={{
                    color: dark ? "#64748B" : "#94A3B8",
                    "&.Mui-checked": { color: dark ? "#38BDF8" : "#059669" },
                  }}
                />
              }
              label={
                <Typography variant="body2" sx={{ color: dark ? "#94A3B8" : "#475569", fontSize: "0.85rem", userSelect: "none" }}>
                  Remember me on this workstation
                </Typography>
              }
            />
          )}
        />
      </Box>

      {/* Submit Button */}
      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={isSubmitting}
        sx={{
          py: 1.4,
          borderRadius: 1.5,
          fontWeight: 700,
          fontSize: "0.95rem",
          textTransform: "none",
          background: dark
            ? "linear-gradient(135deg, #00D2FF 0%, #00E676 100%)"
            : "linear-gradient(135deg, #059669 0%, #0D9488 100%)",
          color: dark ? "#031124" : "#FFFFFF",
          boxShadow: dark
            ? "0 4px 18px rgba(0, 210, 255, 0.4)"
            : "0 3px 12px rgba(5, 150, 105, 0.25)",
          transition: "all 0.25s ease",
          "&:hover": {
            background: dark
              ? "linear-gradient(135deg, #00E676 0%, #00D2FF 100%)"
              : "linear-gradient(135deg, #047857 0%, #0F766E 100%)",
            boxShadow: dark
              ? "0 6px 24px rgba(0, 230, 118, 0.55)"
              : "0 6px 18px rgba(5, 150, 105, 0.35)",
            transform: "translateY(-1px)",
          },
        }}
      >
        {isSubmitting ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <CircularProgress size={18} color="inherit" thickness={4} />
            <span>Authenticating...</span>
          </Box>
        ) : (
          "Sign in to Platform"
        )}
      </Button>

      {/* Security Disclaimer */}
      <Typography
        variant="caption"
        sx={{
          display: "block",
          textAlign: "center",
          mt: 3,
          color: "#94A3B8",
          fontSize: "0.75rem",
        }}
      >
        Protected by corporate multi-factor session security & role-scoped authorization.
      </Typography>

      {/* Forgot Password Helper Dialog */}
      <Dialog
        open={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: { borderRadius: 2, p: 1 },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: "1.1rem", color: "#1E293B" }}>
          Reset Account Access
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#475569", mb: 1.5 }}>
            MAPAR utilizes enterprise centralized identity. If you forgot your password or need an account unlock:
          </Typography>
          <Box sx={{ bgcolor: "#F1F5F9", p: 1.5, borderRadius: 1.5, border: "1px solid #E2E8F0" }}>
            <Typography variant="caption" sx={{ display: "block", fontWeight: 600, color: "#1E293B" }}>
              Corporate Helpdesk Contact:
            </Typography>
            <Typography variant="caption" sx={{ display: "block", color: "#64748B" }}>
              Email: <strong>it.security@telecrats.in</strong>
            </Typography>
            <Typography variant="caption" sx={{ display: "block", color: "#64748B" }}>
              Internal Extension: <strong>#4402</strong>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setForgotPasswordOpen(false)}
            variant="contained"
            size="small"
            sx={{ textTransform: "none", borderRadius: 1 }}
          >
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
