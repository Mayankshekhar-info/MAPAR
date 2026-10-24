import React, { useEffect, useState } from "react";
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
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import { NodeDetail, UpdateNodePayload, CascadingOption } from "../types/organization.types";
import { HIERARCHY_CONFIG, getLevelBadgeColor, getLevelBadgeBg } from "../utils/hierarchy";
import { updateNodeSchema, UpdateNodeFormValues } from "../schemas/organization.schema";
import { organizationService } from "../api/organizationService";
import { colorTokens } from "../../../app/theme/tokens";

interface EditOrganizationModalProps {
  open: boolean;
  onClose: () => void;
  nodeDetail: NodeDetail;
  onSubmit: (payload: UpdateNodePayload) => Promise<void>;
  isSubmitting: boolean;
}

export const EditOrganizationModal: React.FC<EditOrganizationModalProps> = ({
  open,
  onClose,
  nodeDetail,
  onSubmit,
  isSubmitting,
}) => {
  const cfg = HIERARCHY_CONFIG[nodeDetail.level];
  const parentLevel = cfg?.parent_level;
  const parentCfg = parentLevel ? HIERARCHY_CONFIG[parentLevel] : null;

  const [parentOptions, setParentOptions] = useState<CascadingOption[]>([]);
  const [isLoadingParents, setIsLoadingParents] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateNodeFormValues>({
    resolver: zodResolver(updateNodeSchema) as any,
    defaultValues: {
      name: nodeDetail.name,
      code: nodeDetail.code,
      description: nodeDetail.description || "",
      status: nodeDetail.status,
      parent_id: nodeDetail.parent?.id ?? null,
    },
  });

  // Load parent options if node has a parent level
  useEffect(() => {
    if (open && parentLevel) {
      setIsLoadingParents(true);
      organizationService
        .getOptions(parentLevel)
        .then((opts) => setParentOptions(opts))
        .catch(() => setParentOptions([]))
        .finally(() => setIsLoadingParents(false));
    } else {
      setParentOptions([]);
    }
  }, [open, parentLevel]);

  useEffect(() => {
    if (open && nodeDetail) {
      reset({
        name: nodeDetail.name,
        code: nodeDetail.code,
        description: nodeDetail.description || "",
        status: nodeDetail.status,
        parent_id: nodeDetail.parent?.id ?? null,
      });
    }
  }, [open, nodeDetail, reset]);

  const onFormSubmit = async (values: UpdateNodeFormValues) => {
    await onSubmit({
      level: nodeDetail.level,
      name: values.name,
      code: values.code,
      description: values.description,
      status: values.status,
      parent_id: values.parent_id ?? undefined,
    });
    onClose();
  };

  const badgeColor = getLevelBadgeColor(nodeDetail.level);
  const badgeBg = getLevelBadgeBg(nodeDetail.level);

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
            label={cfg?.name || nodeDetail.level}
            sx={{
              fontWeight: 700,
              fontSize: "0.72rem",
              bgcolor: badgeBg,
              color: badgeColor,
              border: `1px solid ${badgeColor}33`,
            }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
            Edit {cfg?.name}
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: colorTokens.text.secondary, mt: 0.5, display: "block" }}>
          Update properties and parent hierarchy for {nodeDetail.name} ({nodeDetail.code})
        </Typography>
      </DialogTitle>

      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogContent dividers sx={{ borderColor: colorTokens.workspace.divider, py: 2.5 }}>
          <Stack spacing={2.5}>
            {/* Parent Node Selector (when applicable) */}
            {parentLevel && (
              <Controller
                name="parent_id"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    id="select-edit-node-parent"
                    select
                    label={`Parent ${parentCfg?.name || parentLevel}`}
                    fullWidth
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                    disabled={isLoadingParents}
                    helperText={
                      isLoadingParents
                        ? "Loading available parent nodes..."
                        : `Assigns which ${parentCfg?.name || "parent"} this node is organized under.`
                    }
                  >
                    <MenuItem value="">
                      <em>-- No Parent Selected --</em>
                    </MenuItem>
                    {parentOptions.map((opt) => (
                      <MenuItem key={opt.id} value={opt.id}>
                        {opt.name} ({opt.code})
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            )}

            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  id="input-edit-node-name"
                  label="Node Name"
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
                  id="input-edit-node-code"
                  label="Unique Code"
                  fullWidth
                  required
                  error={Boolean(errors.code)}
                  helperText={errors.code?.message}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              )}
            />

            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  id="select-edit-node-status"
                  select
                  label="Operational Status"
                  fullWidth
                  error={Boolean(errors.status)}
                  helperText={errors.status?.message}
                >
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                </TextField>
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  id="input-edit-node-description"
                  label="Description"
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
            id="btn-submit-edit-node"
            type="submit"
            variant="contained"
            color="primary"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 600, borderRadius: "10px", px: 3 }}
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
