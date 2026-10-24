import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import { HierarchyLevel, CreateNodePayload } from "../types/organization.types";
import { HIERARCHY_CONFIG, getLevelBadgeColor, getLevelBadgeBg } from "../utils/hierarchy";
import { createNodeSchema, CreateNodeFormValues } from "../schemas/organization.schema";
import { colorTokens } from "../../../app/theme/tokens";

interface CreateOrganizationModalProps {
  open: boolean;
  onClose: () => void;
  targetLevel: HierarchyLevel;
  parent?: {
    id: number;
    name: string;
    code: string;
    level: HierarchyLevel;
  } | null;
  onSubmit: (payload: CreateNodePayload) => Promise<void>;
  isSubmitting: boolean;
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  open,
  onClose,
  targetLevel,
  parent,
  onSubmit,
  isSubmitting,
}) => {
  const cfg = HIERARCHY_CONFIG[targetLevel];

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateNodeFormValues>({
    resolver: zodResolver(createNodeSchema) as any,
    defaultValues: {
      level: targetLevel,
      name: "",
      code: "",
      description: "",
      parent_id: parent?.id ?? null,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        level: targetLevel,
        name: "",
        code: "",
        description: "",
        parent_id: parent?.id ?? null,
      });
    }
  }, [open, targetLevel, parent, reset]);

  const onFormSubmit = async (values: CreateNodeFormValues) => {
    await onSubmit({
      level: values.level,
      name: values.name,
      code: values.code,
      description: values.description,
      parent_id: parent?.id ?? null,
      extra_fields: {
        parent_level: parent?.level ?? null,
      },
    });
    onClose();
  };

  const badgeColor = getLevelBadgeColor(targetLevel);
  const badgeBg = getLevelBadgeBg(targetLevel);

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "16px",
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            size="small"
            label={cfg?.name || targetLevel}
            sx={{
              fontWeight: 700,
              fontSize: "0.72rem",
              bgcolor: badgeBg,
              color: badgeColor,
              border: `1px solid ${badgeColor}33`,
            }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            {parent ? `Add ${cfg?.name}` : "Create New Main Company"}
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: colorTokens.text.secondary, mt: 0.5, display: "block" }}>
          {parent
            ? `Creating child node under ${parent.name} (${parent.code})`
            : "Define the top-level enterprise organization holding."}
        </Typography>
      </DialogTitle>

      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogContent dividers sx={{ borderColor: colorTokens.workspace.divider, py: 2.5 }}>
          <Stack spacing={2.5}>
            {parent && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: "10px",
                  bgcolor: "rgba(0,0,0,0.02)",
                  border: `1px solid ${colorTokens.workspace.divider}`,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, color: colorTokens.text.secondary, textTransform: "uppercase" }}>
                  Selected Parent ({parent.level.replace("_", " ")})
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: colorTokens.text.primary, mt: 0.25 }}>
                  {parent.name} &bull; <span style={{ fontFamily: "monospace" }}>{parent.code}</span>
                </Typography>
              </Box>
            )}

            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  id="input-create-node-name"
                  label={`${cfg?.name} Name`}
                  placeholder={`e.g. ${
                    targetLevel === "MAIN_COMPANY"
                      ? "Telecrats Global"
                      : targetLevel === "PROJECT"
                      ? "Network Modernization"
                      : targetLevel === "DOMAIN"
                      ? "Operations & Maintenance"
                      : "Core Department"
                  }`}
                  fullWidth
                  required
                  error={Boolean(errors.name)}
                  helperText={errors.name?.message}
                />
              )}
            />

            <Controller
              name="code"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  id="input-create-node-code"
                  label={`${cfg?.name} Unique Code`}
                  placeholder="e.g. TC_GLOBAL, NET_MOD, OPS_OM"
                  fullWidth
                  required
                  error={Boolean(errors.code)}
                  helperText={errors.code?.message || "Alphanumeric uppercase letters, numbers, hyphens, and underscores."}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  id="input-create-node-description"
                  label="Description (Optional)"
                  placeholder="Briefly describe responsibilities, scope, or operational focus."
                  fullWidth
                  multiline
                  rows={3}
                  error={Boolean(errors.description)}
                  helperText={errors.description?.message}
                />
              )}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={isSubmitting} sx={{ fontWeight: 600, color: colorTokens.text.secondary }}>
            Cancel
          </Button>
          <Button
            id="btn-submit-create-node"
            type="submit"
            variant="contained"
            color="primary"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 600, borderRadius: "10px", px: 3 }}
          >
            {isSubmitting ? "Creating..." : `Create ${cfg?.name || "Node"}`}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
