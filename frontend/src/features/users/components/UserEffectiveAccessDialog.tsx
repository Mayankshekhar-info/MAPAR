import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PublicIcon from "@mui/icons-material/Public";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import { colorTokens, radiusTokens } from "../../../app/theme/tokens";
import { api } from "../../../services/api";

interface UserEffectiveAccessDialogProps {
  open: boolean;
  onClose: () => void;
  userId?: number | null;
  username?: string;
}

export const UserEffectiveAccessDialog: React.FC<UserEffectiveAccessDialogProps> = ({
  open,
  onClose,
  userId,
  username,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (open && userId) {
      setLoading(true);
      api.get(`/authorization/users/${userId}/effective-access/`)
        .then((res) => {
          setData(res.data.effective_access);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open, userId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: radiusTokens.md } }}>
      <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: radiusTokens.sm,
            bgcolor: colorTokens.primary.lighter,
            color: colorTokens.primary.main,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <VpnKeyOutlinedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1.05rem" }}>
            Effective Access Breakdown
          </Typography>
          <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
            Calculated matrix for user: <strong>{username}</strong> (USER + ROLE + SCOPE)
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress size={32} />
          </Box>
        ) : !data ? (
          <Typography variant="body2" sx={{ color: colorTokens.text.muted, textAlign: "center", py: 4 }}>
            No effective access records returned.
          </Typography>
        ) : (
          <Box>
            {/* Roles */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: colorTokens.primary.main }}>
              Assigned Enterprise Roles
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2.5 }}>
              {data.roles?.map((r: any) => (
                <Chip
                  key={r.id}
                  label={`${r.name} (${r.code})`}
                  color={r.is_primary ? "primary" : "default"}
                  size="small"
                  sx={{ fontWeight: 700, borderRadius: radiusTokens.xs }}
                />
              ))}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Organization Scope */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: colorTokens.primary.main }}>
              Authorized Organization Scope (WHERE User Can Operate)
            </Typography>
            {data.scope_restriction === "UNRESTRICTED" ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, bgcolor: colorTokens.workspace.background, borderRadius: radiusTokens.sm }}>
                <PublicIcon color="primary" fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Global Unrestricted Access — User has enterprise-wide visibility across all Companies, Projects, and Circles.
                </Typography>
              </Box>
            ) : data.scopes && data.scopes.length > 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {data.scopes.map((s: any, sIdx: number) => (
                  <Box
                    key={s.id || sIdx}
                    sx={{
                      p: 1.25,
                      border: `1px solid ${colorTokens.workspace.border}`,
                      borderRadius: radiusTokens.sm,
                      bgcolor: colorTokens.workspace.background,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                        Scope #{sIdx + 1}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        {(s.actions || []).map((act: string) => (
                          <Chip
                            key={act}
                            label={act.toUpperCase()}
                            size="small"
                            sx={{
                              fontSize: "0.65rem",
                              height: 18,
                              fontWeight: 700,
                              bgcolor: act === "manage" ? "#FAF5FF" : "#EFF6FF",
                              color: act === "manage" ? "#7E22CE" : "#1D4ED8",
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ color: colorTokens.text.secondary, display: "block" }}>
                      {s.hierarchy_breadcrumb || "Root hierarchy"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : data.allowed_circles?.length > 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {data.allowed_circles.map((c: any) => (
                  <Box
                    key={c.id}
                    sx={{
                      p: 1.25,
                      border: `1px solid ${colorTokens.workspace.border}`,
                      borderRadius: radiusTokens.sm,
                      bgcolor: colorTokens.workspace.background,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700, color: colorTokens.text.primary }}>
                      {c.name} ({c.code})
                    </Typography>
                    <Typography variant="caption" sx={{ color: colorTokens.text.muted }}>
                      Hierarchy: {c.breadcrumb} • Region: {c.region}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, bgcolor: "#FEF2F2", borderRadius: radiusTokens.sm }}>
                <LockOutlinedIcon sx={{ color: colorTokens.status.error.main }} fontSize="small" />
                <Typography variant="body2" sx={{ color: colorTokens.status.error.text }}>
                  No operational scope assigned. Data queries will return empty.
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Effective Permissions */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: colorTokens.primary.main }}>
              Effective Granted Permissions ({data.effective_permissions?.length || 0})
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, maxHeight: 220, overflowY: "auto" }}>
              {data.effective_permissions?.map((p: string) => (
                <Chip
                  key={p}
                  icon={<CheckCircleOutlineIcon sx={{ fontSize: "14px !important" }} />}
                  label={p}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "0.74rem",
                    fontWeight: 600,
                    borderColor: colorTokens.workspace.border,
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: colorTokens.primary.main, borderRadius: radiusTokens.sm }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
