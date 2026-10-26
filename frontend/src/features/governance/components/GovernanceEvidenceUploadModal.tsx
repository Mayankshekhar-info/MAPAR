import React, { useRef, useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import Chip from "@mui/material/Chip";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { GovernanceActionPoint } from "../types/governance.types";

interface GovernanceEvidenceUploadModalProps {
  open: boolean;
  action?: GovernanceActionPoint | null;
  availableActions?: GovernanceActionPoint[];
  isLoading?: boolean;
  onClose: () => void;
  onSubmit: (file: File, title: string, description: string, actionId?: number) => Promise<void>;
}

export const GovernanceEvidenceUploadModal: React.FC<GovernanceEvidenceUploadModalProps> = ({
  open,
  action,
  availableActions = [],
  isLoading,
  onClose,
  onSubmit,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedActionId, setSelectedActionId] = useState<number | null>(action?.id || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setTitle("");
      setDescription("");
      setErrorMsg(null);
      setSelectedActionId(action?.id || (availableActions.length > 0 ? availableActions[0].id : null));
    }
  }, [open, action, availableActions]);

  const effectiveAction = action || availableActions.find((a) => a.id === selectedActionId) || null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
      setErrorMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
      setErrorMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!effectiveAction) {
      setErrorMsg("Please select a task to upload evidence for.");
      return;
    }
    if (!selectedFile) {
      setErrorMsg("Please select or drop an evidence file to upload.");
      return;
    }
    if (!title.trim()) {
      setErrorMsg("Evidence title is required.");
      return;
    }

    try {
      await onSubmit(selectedFile, title.trim(), description.trim(), effectiveAction.id);
      onClose();
    } catch (err: any) {
      const respError = err?.response?.data?.errors;
      if (typeof respError === "string") {
        setErrorMsg(respError);
      } else if (typeof respError === "object") {
        setErrorMsg(Object.values(respError).flat().join(" "));
      } else {
        setErrorMsg("Failed to upload evidence. Please check file format and try again.");
      }
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: radiusTokens.lg } }}>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ pb: 1, borderBottom: "1px solid", borderColor: colorTokens.workspace.border }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            Upload Task Evidence Proof
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
            {effectiveAction
              ? `Task: ${effectiveAction.action_id} — ${(effectiveAction.action_point || "").slice(0, 45)}...`
              : "Select a governance task to attach supporting proof"}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMsg}
            </Alert>
          )}

          {/* Task selector if action wasn't fixed */}
          {!action && availableActions.length > 0 && (
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel id="select-task-evidence-label">Select Task / Action Point</InputLabel>
              <Select
                labelId="select-task-evidence-label"
                label="Select Task / Action Point"
                value={selectedActionId || ""}
                onChange={(e) => setSelectedActionId(Number(e.target.value))}
                required
              >
                {availableActions.map((act) => (
                  <MenuItem key={act.id} value={act.id}>
                    {act.action_id} — {(act.action_point || "").slice(0, 50)} ({act.circle?.code || "Org"})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Deliverable guidance box */}
          {effectiveAction?.key_deliverable && (
            <Box sx={{ mb: 2.5, p: 2, backgroundColor: "#F0F9FF", borderRadius: radiusTokens.sm, border: "1px solid #BAE6FD" }}>
              <Typography variant="caption" sx={{ color: "#0369A1", fontWeight: 700, display: "block", mb: 0.5 }}>
                EXPECTED DELIVERABLE REQUIREMENT:
              </Typography>
              <Typography variant="body2" sx={{ color: "#0C4A6E", fontSize: "0.85rem", lineHeight: 1.4 }}>
                {effectiveAction.key_deliverable}
              </Typography>
            </Box>
          )}

          {effectiveAction?.evidence_status === "Rework Required" && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Previous submission required rework. Please review the reviewer comments in the detail drawer and upload updated proof.
            </Alert>
          )}

          {/* File Drop Area */}
          <Box
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: "2px dashed",
              borderColor: selectedFile ? colorTokens.primary.main : "#CBD5E1",
              borderRadius: radiusTokens.md,
              p: 3,
              mb: 2.5,
              textAlign: "center",
              backgroundColor: selectedFile ? "#F0F9FF" : "#FAFAFA",
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                borderColor: colorTokens.primary.main,
                backgroundColor: "#F0F9FF",
              },
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf, .xlsx, .xls, .doc, .docx, .png, .jpg, .jpeg, .csv, .txt, .zip"
              style={{ display: "none" }}
            />
            {selectedFile ? (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <InsertDriveFileOutlinedIcon sx={{ fontSize: 36, color: colorTokens.primary.main, mb: 1 }} />
                <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                  {selectedFile.name}
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.secondary }}>
                  {(selectedFile.size / 1024).toFixed(1)} KB — Click to change
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <CloudUploadOutlinedIcon sx={{ fontSize: 36, color: colorTokens.text.muted, mb: 1 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary }}>
                  Drop proof file here, or click to browse
                </Typography>
                <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                  PDF, Excel, Word, Image, CSV, ZIP (max 25MB)
                </Typography>
              </Box>
            )}
          </Box>

          <TextField
            fullWidth
            size="small"
            required
            label="Evidence Title / Document Label"
            placeholder="e.g. Inverter Inspection Sign-off Sheet"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label="Comments / Explanation (Optional)"
            placeholder="Describe what this proof confirms or link to test results..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: "1px solid", borderColor: colorTokens.workspace.border }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!selectedFile || isLoading}
            sx={{
              backgroundColor: colorTokens.primary.main,
              "&:hover": { backgroundColor: colorTokens.primary.dark },
            }}
          >
            {isLoading ? "Uploading..." : "Submit Evidence"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
