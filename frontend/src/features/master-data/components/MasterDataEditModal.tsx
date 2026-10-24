import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";

import { MasterDataColumn, MasterDataRecord } from "../types/masterData.types";

interface MasterDataEditModalProps {
  open: boolean;
  record: MasterDataRecord | null;
  columns: MasterDataColumn[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (recordId: number, updatedFields: Record<string, any>) => Promise<void>;
  canEdit?: boolean;
}

export const MasterDataEditModal: React.FC<MasterDataEditModalProps> = ({
  open,
  record,
  columns,
  isSaving,
  onClose,
  onSave,
  canEdit = true,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [clientErrors, setClientErrors] = useState<string[]>([]);

  useEffect(() => {
    if (record) {
      setFormData(record.raw_data || {});
      setClientErrors(record.validation_errors || []);
    } else {
      setFormData({});
      setClientErrors([]);
    }
  }, [record]);

  if (!record) return null;

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave(record.id, formData);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Failed to save record.";
      setClientErrors([msg]);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
      <form onSubmit={handleFormSubmit}>
        <DialogTitle sx={{ pb: 1, borderBottom: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Edit Master Data Record #{record.row_index}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip label={`Batch: ${record.batch_id}`} size="small" variant="outlined" />
              {record.circle && <Chip label={`Circle: ${record.circle}`} size="small" color="primary" variant="outlined" />}
            </Stack>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {clientErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: "8px" }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Validation Issues:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {clientErrors.map((err, idx) => (
                  <li key={idx}>
                    <Typography variant="caption">{err}</Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
              gap: 2.5,
              mt: 1,
            }}
          >
            {columns.map((col) => {
              const fieldKey = col.name;
              const curVal = formData[fieldKey] ?? formData[col.display_label] ?? "";

              if (col.data_type === "BOOLEAN") {
                return (
                  <FormControl key={col.id} fullWidth size="small">
                    <InputLabel id={`label-${col.id}`}>{col.display_label}</InputLabel>
                    <Select
                      labelId={`label-${col.id}`}
                      label={col.display_label}
                      value={String(curVal).toUpperCase() === "TRUE" ? "TRUE" : String(curVal).toUpperCase() === "FALSE" ? "FALSE" : ""}
                      onChange={(e) => handleChange(fieldKey, e.target.value)}
                      disabled={!canEdit}
                    >
                      <MenuItem value="TRUE">True / Yes</MenuItem>
                      <MenuItem value="FALSE">False / No</MenuItem>
                    </Select>
                  </FormControl>
                );
              }

              return (
                <TextField
                  key={col.id}
                  label={col.display_label}
                  value={curVal}
                  onChange={(e) => handleChange(fieldKey, e.target.value)}
                  fullWidth
                  size="small"
                  required={col.is_required}
                  disabled={!canEdit}
                  type={col.data_type === "INTEGER" || col.data_type === "DECIMAL" ? "number" : "text"}
                  helperText={`Data Type: ${col.data_type}${col.is_required ? " (Required)" : ""}`}
                />
              );
            })}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Button onClick={onClose} variant="outlined" sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600 }}>
            Cancel
          </Button>
          {canEdit && (
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSaving}
              sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600, boxShadow: "none" }}
            >
              {isSaving ? "Saving Changes..." : "Save Changes"}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
};
