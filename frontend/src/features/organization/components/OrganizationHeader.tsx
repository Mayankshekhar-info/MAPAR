import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import AddIcon from "@mui/icons-material/Add";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BusinessIcon from "@mui/icons-material/Business";
import { colorTokens } from "../../../app/theme/tokens";

interface OrganizationHeaderProps {
  onAddCompany: () => void;
  onAddChild?: () => void;
  onAddCircle?: () => void;
  selectedNodeLabel?: string | null;
  addChildLabel?: string | null;
}

export const OrganizationHeader: React.FC<OrganizationHeaderProps> = ({
  onAddCompany,
  onAddChild,
  onAddCircle,
  addChildLabel,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        alignItems: { xs: "flex-start", md: "center" },
        justifyContent: "space-between",
        gap: 2,
        pb: 3,
        borderBottom: `1px solid ${colorTokens.workspace.divider}`,
      }}
    >
      <Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 42,
              height: 42,
              borderRadius: "12px",
              bgcolor: colorTokens.status.info.light,
              color: colorTokens.primary.main,
            }}
          >
            <AccountTreeIcon fontSize="medium" />
          </Box>
          <Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                color: colorTokens.text.primary,
                letterSpacing: "-0.02em",
              }}
            >
              Organization Hierarchy &amp; Tree Explorer
            </Typography>
            <Typography variant="body2" sx={{ color: colorTokens.text.secondary, mt: 0.25 }}>
              Enterprise Structure: Main Company &rarr; Sub Company / Circle &rarr; Project &rarr; Circle &rarr; Domain &rarr; Department &rarr; Sub-Department
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        <Button
          id="btn-add-main-company"
          variant="contained"
          color="primary"
          startIcon={<BusinessIcon />}
          onClick={onAddCompany}
          sx={{
            fontWeight: 600,
            borderRadius: "10px",
            px: 2.5,
            py: 1,
            boxShadow: "0 2px 8px rgba(30, 58, 138, 0.25)",
          }}
        >
          + Add Company
        </Button>

        {onAddChild && addChildLabel && (
          <Button
            id="btn-header-add-child"
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            onClick={onAddChild}
            sx={{
              fontWeight: 600,
              borderRadius: "10px",
              px: 2,
              py: 1,
            }}
          >
            {addChildLabel}
          </Button>
        )}

        {onAddCircle && (
          <Button
            id="btn-header-add-circle"
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            onClick={onAddCircle}
            sx={{
              fontWeight: 600,
              borderRadius: "10px",
              px: 2,
              py: 1,
            }}
          >
            + Add Circle
          </Button>
        )}
      </Stack>
    </Box>
  );
};
