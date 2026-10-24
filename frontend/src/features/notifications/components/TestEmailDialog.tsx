import React, { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import ForwardToInboxIcon from "@mui/icons-material/ForwardToInbox";

interface Props {
  open: boolean;
  onClose: () => void;
  onSend: (payload: { recipient_email: string; recipient_name?: string }) => Promise<{ success: boolean; message: string }>;
}

export const TestEmailDialog: React.FC<Props> = ({ open, onClose, onSend }) => {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("MAPAR Administrator");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSend = async () => {
    if (!recipientEmail || !recipientEmail.includes("@")) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await onSend({ recipient_email: recipientEmail, recipient_name: recipientName });
      setResult(res);
      if (res.success) {
        setTimeout(() => {
          onClose();
          setResult(null);
        }, 2200);
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err?.response?.data?.message || err?.message || "Failed to dispatch test email.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
        <ForwardToInboxIcon color="primary" /> Send Verification Test Email
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Send a live test message to verify end-to-end SMTP dispatch and delivery to an actual mailbox.
        </Typography>

        {result && (
          <Alert severity={result.success ? "success" : "error"} sx={{ mb: 2 }}>
            {result.message}
          </Alert>
        )}

        <Stack spacing={2}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Recipient Email Address"
            placeholder="e.g. your.email@company.com"
            value={recipientEmail}
            onChange={e => setRecipientEmail(e.target.value)}
            disabled={loading}
            required
          />
          <TextField
            fullWidth
            size="small"
            label="Recipient Name"
            value={recipientName}
            onChange={e => setRecipientName(e.target.value)}
            disabled={loading}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSend}
          variant="contained"
          disabled={loading || !recipientEmail || !recipientEmail.includes("@")}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ForwardToInboxIcon />}
        >
          Send Test Email
        </Button>
      </DialogActions>
    </Dialog>
  );
};
