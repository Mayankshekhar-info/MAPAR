import React, { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import SaveIcon from "@mui/icons-material/Save";
import NetworkCheckIcon from "@mui/icons-material/NetworkCheck";
import ForwardToInboxIcon from "@mui/icons-material/ForwardToInbox";
import SecurityIcon from "@mui/icons-material/Security";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import AddIcon from "@mui/icons-material/Add";

import { colorTokens, radiusTokens, shadowTokens } from "../../../app/theme/tokens";
import { SMTPConfiguration, UpdateSMTPConfigurationPayload } from "../types/notifications.types";

interface Props {
  config: SMTPConfiguration | undefined;
  isLoading: boolean;
  onSave: (payload: UpdateSMTPConfigurationPayload) => Promise<any>;
  onTestConnection: (config?: any) => Promise<{ success: boolean; message: string }>;
  onOpenSendTestModal: () => void;
  isSaving: boolean;
}

export const SMTPConfigCard: React.FC<Props> = ({
  config,
  isLoading,
  onSave,
  onTestConnection,
  onOpenSendTestModal,
  isSaving,
}) => {
  const [formData, setFormData] = useState<UpdateSMTPConfigurationPayload>({
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    smtp_security: "STARTTLS",
    from_email: "notifications@mapar.co.in",
    from_name: "MAPAR Governance System",
    is_enabled: true,
    cc_addresses: ["abhay@pratap.co.in"],
    frontend_base_url: "http://localhost:5185",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [newCC, setNewCC] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        smtp_host: config.smtp_host || "",
        smtp_port: config.smtp_port || 587,
        smtp_username: config.smtp_username || "",
        smtp_password: "", // Always empty initially for security
        smtp_security: config.smtp_security || "STARTTLS",
        from_email: config.from_email || "notifications@mapar.co.in",
        from_name: config.from_name || "MAPAR Governance System",
        is_enabled: config.is_enabled,
        cc_addresses: (config.cc_addresses || ["abhay@pratap.co.in"]).filter(
          (e: string) => e.toLowerCase() !== "shakti.singh@pratap.co.in"
        ),
        frontend_base_url: config.frontend_base_url || "http://localhost:5185",
      });
    }
  }, [config]);

  const handleChange = (field: keyof UpdateSMTPConfigurationPayload, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const handleAddCC = () => {
    const email = newCC.trim().toLowerCase();
    if (email && email.includes("@")) {
      const current = formData.cc_addresses || [];
      if (!current.includes(email)) {
        setFormData(prev => ({ ...prev, cc_addresses: [...current, email] }));
      }
      setNewCC("");
    }
  };

  const handleRemoveCC = (emailToRemove: string) => {
    // Both mandatory addresses must remain warned if removed
    setFormData(prev => ({
      ...prev,
      cc_addresses: (prev.cc_addresses || []).filter(e => e !== emailToRemove),
    }));
  };

  const handleTest = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await onTestConnection({
        smtp_host: formData.smtp_host,
        smtp_port: formData.smtp_port,
        smtp_username: formData.smtp_username,
        smtp_password: formData.smtp_password,
        smtp_security: formData.smtp_security,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.response?.data?.message || err?.message || "Connection test failed.",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave(formData);
      setSaveSuccess(true);
    } catch (err) {
      // handled in parent or toast
    }
  };

  if (isLoading) {
    return (
      <Card sx={{ p: 4, display: "flex", justifyContent: "center", borderRadius: radiusTokens.md }}>
        <CircularProgress size={32} />
      </Card>
    );
  }

  return (
    <Card
      elevation={0}
      sx={{
        p: 3,
        borderRadius: radiusTokens.md,
        border: `1px solid ${colorTokens.workspace.border}`,
        boxShadow: shadowTokens.subtle,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
            SMTP Server Configuration
          </Typography>
          <Typography variant="body2" sx={{ color: colorTokens.text.secondary }}>
            Configure your enterprise email provider for automatic task assignment alerts and scheduled reminders.
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={formData.is_enabled ?? true}
              onChange={e => handleChange("is_enabled", e.target.checked)}
              color="primary"
            />
          }
          label={
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {formData.is_enabled ? "Notifications Enabled" : "Notifications Disabled"}
            </Typography>
          }
        />
      </Box>

      <Divider sx={{ mb: 3 }} />

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSaveSuccess(false)}>
          SMTP settings saved successfully. Outgoing task alerts will use this configuration.
        </Alert>
      )}

      {testResult && (
        <Alert
          severity={testResult.success ? "success" : "error"}
          sx={{ mb: 3 }}
          onClose={() => setTestResult(null)}
        >
          {testResult.message}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              fullWidth
              size="small"
              label="SMTP Host / Server"
              placeholder="e.g. smtp.office365.com or smtp.gmail.com"
              value={formData.smtp_host || ""}
              onChange={e => handleChange("smtp_host", e.target.value)}
              helperText="The hostname or IP address of your corporate email server"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="SMTP Port"
              value={formData.smtp_port || 587}
              onChange={e => handleChange("smtp_port", parseInt(e.target.value, 10))}
              helperText="Standard ports: 587 (STARTTLS), 465 (SSL), 25 (Internal)"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              select
              label="Encryption / Security"
              value={formData.smtp_security || "STARTTLS"}
              onChange={e => handleChange("smtp_security", e.target.value)}
            >
              <MenuItem value="STARTTLS">STARTTLS (Port 587 - Recommended)</MenuItem>
              <MenuItem value="SSL">SSL / TLS (Port 465)</MenuItem>
              <MenuItem value="NONE">None / Plaintext (Port 25)</MenuItem>
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              label="SMTP Username"
              placeholder="e.g. user@pratap.co.in"
              value={formData.smtp_username || ""}
              onChange={e => handleChange("smtp_username", e.target.value)}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              type={showPassword ? "text" : "password"}
              label="SMTP Password / App Password"
              placeholder={config?.has_password ? "•••••••• (Configured — leave blank to keep)" : "Enter password"}
              value={formData.smtp_password || ""}
              onChange={e => handleChange("smtp_password", e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword(prev => !prev)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              helperText={
                config?.has_password
                  ? "Password securely stored in backend. Leave blank unless updating."
                  : "Enter provider password or app-specific key."
              }
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              size="small"
              label="Sender Email Address"
              value={formData.from_email || ""}
              onChange={e => handleChange("from_email", e.target.value)}
              helperText="Outgoing sender address displayed in the 'From' header"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              size="small"
              label="Sender Display Name"
              value={formData.from_name || ""}
              onChange={e => handleChange("from_name", e.target.value)}
              helperText="e.g. MAPAR Governance System"
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              size="small"
              label="MAPAR Frontend Base URL"
              value={formData.frontend_base_url || ""}
              onChange={e => handleChange("frontend_base_url", e.target.value)}
              helperText="Base URL used to generate secure direct task links in emails (e.g. http://localhost:5185 or https://mapar.yourdomain.com)"
            />
          </Grid>

          {/* Central Mandatory CC Addresses */}
          <Grid size={{ xs: 12 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: radiusTokens.sm,
                backgroundColor: colorTokens.workspace.background,
                border: `1px solid ${colorTokens.workspace.border}`,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colorTokens.text.primary, mb: 0.5 }}>
                Mandatory Central CC Addresses
              </Typography>
              <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block", mb: 1.5 }}>
                Every automated assignment alert and recurring weekly reminder will automatically include these CC addresses.
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                {(formData.cc_addresses || []).map(email => (
                  <Chip
                    key={email}
                    label={email}
                    onDelete={() => handleRemoveCC(email)}
                    color={
                      email === "abhay@pratap.co.in"
                        ? "primary"
                        : "default"
                    }
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Stack>

              <Box sx={{ display: "flex", gap: 1, maxWidth: 420 }}>
                <TextField
                  size="small"
                  placeholder="Add additional CC email..."
                  value={newCC}
                  onChange={e => setNewCC(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCC();
                    }
                  }}
                  fullWidth
                />
                <Button variant="outlined" size="small" onClick={handleAddCC} startIcon={<AddIcon />}>
                  Add
                </Button>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 4, pt: 2, borderTop: `1px solid ${colorTokens.workspace.border}` }}>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={testingConnection ? <CircularProgress size={16} /> : <NetworkCheckIcon />}
              onClick={handleTest}
              disabled={testingConnection || isSaving}
            >
              Test Connection
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<ForwardToInboxIcon />}
              onClick={onOpenSendTestModal}
              disabled={isSaving}
            >
              Send Test Email...
            </Button>
          </Stack>

          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            disabled={isSaving}
            sx={{ px: 3 }}
          >
            Save SMTP Settings
          </Button>
        </Box>
      </form>
    </Card>
  );
};
