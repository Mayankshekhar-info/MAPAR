import React, { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import LockReset from "@mui/icons-material/LockReset";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import KeyOutlined from "@mui/icons-material/KeyOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import axios from "axios";

import { authService } from "../services/authService";

interface PasswordResetDialogProps {
  open: boolean;
  onClose: () => void;
  dark?: boolean;
}

export const PasswordResetDialog: React.FC<PasswordResetDialogProps> = ({
  open,
  onClose,
  dark = false,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [identifier, setIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Reset dialog state on reopen
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setIdentifier("");
      setOtpCode("");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setErrorMessage(null);
      setSuccessNotice(null);
      setIsLoading(false);
      setResendCountdown(0);
    }
  }, [open]);

  // Countdown timer for resending OTP
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage("Please enter your registered username or corporate email.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await authService.requestPasswordReset(identifier.trim());
      setSuccessNotice(res.detail);
      setResendCountdown(60);
      setActiveStep(1);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(
          err.response?.data?.detail || "Unable to request verification code. Please try again."
        );
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await authService.verifyResetOtp(identifier.trim(), otpCode.trim());
      if (res.reset_token) {
        setResetToken(res.reset_token);
        setSuccessNotice("Identity verified successfully. Please choose a new password.");
        setActiveStep(2);
      } else {
        setErrorMessage(res.detail || "Verification failed. Please check the code.");
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(
          err.response?.data?.detail || "Invalid or expired verification code. Please request a new one."
        );
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await authService.confirmPasswordReset({
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setActiveStep(3);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(
          err.response?.data?.detail ||
            err.response?.data?.errors?.new_password?.[0] ||
            "Failed to reset password. Please ensure requirements are met."
        );
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const steps = ["Identifier", "Verify OTP", "New Password"];

  return (
    <Dialog
      open={open}
      onClose={!isLoading ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            bgcolor: dark ? "#111827" : "#FFFFFF",
            color: dark ? "#F8FAFC" : "#0F172A",
            border: dark ? "1px solid rgba(0, 210, 255, 0.25)" : "1px solid #E2E8F0",
            boxShadow: dark
              ? "0 20px 40px -15px rgba(0, 210, 255, 0.25)"
              : "0 20px 40px -15px rgba(0, 0, 0, 0.15)",
            p: { xs: 1, sm: 2 },
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          fontWeight: 700,
          fontSize: "1.25rem",
          color: dark ? "#F8FAFC" : "#0F172A",
          pb: 1,
        }}
      >
        <LockReset sx={{ color: dark ? "#00D2FF" : "#059669", fontSize: 28 }} />
        <span>Change or Reset Password</span>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Progress Stepper */}
        {activeStep < 3 && (
          <Stepper
            activeStep={activeStep}
            alternativeLabel
            sx={{
              mb: 3,
              mt: 1,
              "& .MuiStepLabel-label": {
                color: dark ? "#64748B" : "#94A3B8",
                fontSize: "0.8rem",
                "&.Mui-active": {
                  color: dark ? "#00D2FF" : "#059669",
                  fontWeight: 600,
                },
                "&.Mui-completed": {
                  color: dark ? "#00E676" : "#10B981",
                },
              },
              "& .MuiStepIcon-root": {
                color: dark ? "#1E293B" : "#E2E8F0",
                "&.Mui-active": {
                  color: dark ? "#00D2FF" : "#059669",
                },
                "&.Mui-completed": {
                  color: dark ? "#00E676" : "#10B981",
                },
              },
            }}
          >
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        )}

        {/* Feedback Messages */}
        {errorMessage && (
          <Alert
            severity="error"
            onClose={() => setErrorMessage(null)}
            sx={{ mb: 2.5, borderRadius: 1.5, fontSize: "0.85rem" }}
          >
            {errorMessage}
          </Alert>
        )}

        {successNotice && activeStep < 3 && (
          <Alert
            severity="info"
            onClose={() => setSuccessNotice(null)}
            sx={{ mb: 2.5, borderRadius: 1.5, fontSize: "0.85rem" }}
          >
            {successNotice}
          </Alert>
        )}

        {/* STEP 0: Enter Identifier */}
        {activeStep === 0 && (
          <Box component="form" onSubmit={handleRequestOtp} noValidate>
            <Typography variant="body2" sx={{ color: dark ? "#94A3B8" : "#475569", mb: 2.5 }}>
              Enter your registered corporate username, email address, or employee ID. A single-use 6-digit
              verification code will be sent to your registered inbox.
            </Typography>

            <TextField
              fullWidth
              autoFocus
              id="reset-identifier"
              label="Username, Corporate Email, or Employee ID"
              placeholder="e.g. admin or jdoe@pratap.co.in"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isLoading}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlined sx={{ color: dark ? "#64748B" : "#94A3B8" }} />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 1.5,
                    bgcolor: dark ? "rgba(19, 28, 40, 0.85)" : "#F8FAFC",
                    color: dark ? "#F8FAFC" : "#0F172A",
                  },
                },
              }}
            />
          </Box>
        )}

        {/* STEP 1: Enter OTP Code */}
        {activeStep === 1 && (
          <Box component="form" onSubmit={handleVerifyOtp} noValidate>
            <Typography variant="body2" sx={{ color: dark ? "#94A3B8" : "#475569", mb: 2 }}>
              A 6-digit verification code has been dispatched. Enter the code below to verify your identity:
            </Typography>

            <TextField
              fullWidth
              autoFocus
              id="reset-otp"
              label="6-Digit Verification Code"
              placeholder="123456"
              value={otpCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtpCode(val);
              }}
              disabled={isLoading}
              slotProps={{
                htmlInput: {
                  maxLength: 6,
                  style: { letterSpacing: 8, fontSize: "1.4rem", fontFamily: "monospace", textAlign: "center" },
                },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyOutlined sx={{ color: dark ? "#64748B" : "#94A3B8" }} />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 1.5,
                    bgcolor: dark ? "rgba(19, 28, 40, 0.85)" : "#F8FAFC",
                    color: dark ? "#F8FAFC" : "#0F172A",
                  },
                },
              }}
            />

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2 }}>
              <Typography variant="caption" sx={{ color: dark ? "#64748B" : "#94A3B8" }}>
                Code valid for 15 minutes.
              </Typography>
              <Button
                variant="text"
                size="small"
                disabled={isLoading || resendCountdown > 0}
                onClick={() => handleRequestOtp()}
                sx={{
                  color: dark ? "#00D2FF" : "#059669",
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                }}
              >
                {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : "Resend Code"}
              </Button>
            </Box>
          </Box>
        )}

        {/* STEP 2: Enter New Password */}
        {activeStep === 2 && (
          <Box component="form" onSubmit={handleConfirmReset} noValidate>
            <Typography variant="body2" sx={{ color: dark ? "#94A3B8" : "#475569", mb: 2.5 }}>
              Choose a strong new password meeting enterprise security requirements:
            </Typography>

            <TextField
              fullWidth
              autoFocus
              id="reset-new-password"
              label="New Password"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              sx={{ mb: 2 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: dark ? "#64748B" : "#94A3B8" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{ color: dark ? "#64748B" : "#94A3B8" }}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 1.5,
                    bgcolor: dark ? "rgba(19, 28, 40, 0.85)" : "#F8FAFC",
                    color: dark ? "#F8FAFC" : "#0F172A",
                  },
                },
              }}
            />

            <TextField
              fullWidth
              id="reset-confirm-password"
              label="Confirm New Password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: dark ? "#64748B" : "#94A3B8" }} />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 1.5,
                    bgcolor: dark ? "rgba(19, 28, 40, 0.85)" : "#F8FAFC",
                    color: dark ? "#F8FAFC" : "#0F172A",
                  },
                },
              }}
            />

            {/* Complexity Guidance */}
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: dark ? "#1E293B" : "#F1F5F9" }}>
              <Typography variant="caption" sx={{ display: "block", color: dark ? "#94A3B8" : "#475569", fontWeight: 600 }}>
                Password Requirements:
              </Typography>
              <Typography variant="caption" sx={{ display: "block", color: dark ? "#64748B" : "#64748B", mt: 0.5 }}>
                &bull; At least 8 characters long<br />
                &bull; Includes uppercase (A-Z) and lowercase (a-z) letters<br />
                &bull; Includes at least one number (0-9) and special character (!@#$%^&*)
              </Typography>
            </Box>
          </Box>
        )}

        {/* STEP 3: Success Confirmation */}
        {activeStep === 3 && (
          <Box sx={{ textAlign: "center", py: 3 }}>
            <CheckCircleOutline sx={{ fontSize: 60, color: dark ? "#00E676" : "#10B981", mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: dark ? "#F8FAFC" : "#0F172A", mb: 1 }}>
              Password Changed Successfully!
            </Typography>
            <Typography variant="body2" sx={{ color: dark ? "#94A3B8" : "#475569", maxWidth: 400, mx: "auto" }}>
              Your account password has been updated and previous sessions have been terminated. You can now log in
              using your new password.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {activeStep < 3 ? (
          <>
            <Button
              onClick={onClose}
              disabled={isLoading}
              variant="text"
              sx={{ color: dark ? "#94A3B8" : "#64748B", textTransform: "none" }}
            >
              Cancel
            </Button>
            {activeStep === 0 && (
              <Button
                onClick={handleRequestOtp}
                disabled={isLoading || !identifier.trim()}
                variant="contained"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 1.5,
                  background: dark
                    ? "linear-gradient(135deg, #00D2FF 0%, #00E676 100%)"
                    : "linear-gradient(135deg, #059669 0%, #0D9488 100%)",
                  color: dark ? "#031124" : "#FFFFFF",
                }}
              >
                {isLoading ? <CircularProgress size={18} color="inherit" /> : "Send Verification Code"}
              </Button>
            )}
            {activeStep === 1 && (
              <Button
                onClick={handleVerifyOtp}
                disabled={isLoading || otpCode.trim().length !== 6}
                variant="contained"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 1.5,
                  background: dark
                    ? "linear-gradient(135deg, #00D2FF 0%, #00E676 100%)"
                    : "linear-gradient(135deg, #059669 0%, #0D9488 100%)",
                  color: dark ? "#031124" : "#FFFFFF",
                }}
              >
                {isLoading ? <CircularProgress size={18} color="inherit" /> : "Verify Code"}
              </Button>
            )}
            {activeStep === 2 && (
              <Button
                onClick={handleConfirmReset}
                disabled={isLoading || !newPassword || !confirmPassword}
                variant="contained"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 1.5,
                  background: dark
                    ? "linear-gradient(135deg, #00D2FF 0%, #00E676 100%)"
                    : "linear-gradient(135deg, #059669 0%, #0D9488 100%)",
                  color: dark ? "#031124" : "#FFFFFF",
                }}
              >
                {isLoading ? <CircularProgress size={18} color="inherit" /> : "Update Password"}
              </Button>
            )}
          </>
        ) : (
          <Button
            onClick={onClose}
            variant="contained"
            fullWidth
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 1.5,
              py: 1,
              background: dark
                ? "linear-gradient(135deg, #00D2FF 0%, #00E676 100%)"
                : "linear-gradient(135deg, #059669 0%, #0D9488 100%)",
              color: dark ? "#031124" : "#FFFFFF",
            }}
          >
            Return to Sign In
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
