import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Typography,
  Chip,
  Alert,
  Stack,
  Button,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import FunctionsIcon from "@mui/icons-material/Functions";
import { kpiService } from "../api/kpiService";

interface FormulaExpressionEditorProps {
  value: string;
  onChange: (val: string) => void;
  availableVariables: string[];
}

const COMMON_FUNCTIONS = ["sum", "avg", "min", "max", "round", "abs", "if_else"];

export const FormulaExpressionEditor: React.FC<FormulaExpressionEditorProps> = ({
  value,
  onChange,
  availableVariables,
}) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detectedVars, setDetectedVars] = useState<string[]>([]);

  useEffect(() => {
    if (!value || !value.trim()) {
      setIsValid(null);
      setErrorMsg(null);
      setDetectedVars([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await kpiService.validateFormula(value, availableVariables);
        setIsValid(res.is_valid);
        setErrorMsg(res.error);
        setDetectedVars(res.detected_variables);
      } catch (err: any) {
        setIsValid(false);
        setErrorMsg(err?.message || "Validation failed");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [value, availableVariables]);

  const handleInsert = (token: string) => {
    onChange(value ? `${value} ${token}` : token);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Formula Expression
        </Typography>
        {isValid === true && (
          <Chip
            size="small"
            icon={<CheckCircleOutlineIcon fontSize="small" />}
            label="Valid Syntax"
            color="success"
            variant="outlined"
          />
        )}
        {isValid === false && (
          <Chip
            size="small"
            icon={<ErrorOutlineIcon fontSize="small" />}
            label="Invalid Syntax"
            color="error"
            variant="outlined"
          />
        )}
      </Box>

      <TextField
        fullWidth
        multiline
        rows={2}
        placeholder="e.g. (actual / target) * 100  or  actual - target"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{
          fontFamily: "monospace",
          "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: "0.9rem" },
        }}
      />

      {errorMsg && (
        <Alert severity="error" sx={{ py: 0.5, fontSize: "0.82rem" }}>
          {errorMsg}
        </Alert>
      )}

      {/* Allowed Variable Chips */}
      <Box>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
          CLICK TO INSERT SOURCE PARAMETERS:
        </Typography>
        <Stack direction="row" spacing={0.8} sx={{ flexWrap: "wrap", mt: 0.5 }}>
          {availableVariables.length === 0 ? (
            <Typography variant="caption" sx={{ fontStyle: "italic", color: "text.disabled" }}>
              Define parameters in the step above to use them here.
            </Typography>
          ) : (
            availableVariables.map((v) => (
              <Chip
                key={v}
                label={v}
                size="small"
                onClick={() => handleInsert(v)}
                sx={{ cursor: "pointer", fontWeight: 600, bgcolor: "action.hover" }}
              />
            ))
          )}
        </Stack>
      </Box>

      {/* Allowed Math Functions */}
      <Box>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
          ALLOWED FUNCTIONS & OPERATORS:
        </Typography>
        <Stack direction="row" spacing={0.8} sx={{ flexWrap: "wrap", mt: 0.5 }}>
          {["+", "-", "*", "/", "(", ")"].map((op) => (
            <Chip
              key={op}
              label={op}
              size="small"
              onClick={() => handleInsert(op)}
              sx={{ cursor: "pointer", fontFamily: "monospace" }}
            />
          ))}
          {COMMON_FUNCTIONS.map((fn) => (
            <Chip
              key={fn}
              label={`${fn}()`}
              size="small"
              icon={<FunctionsIcon fontSize="inherit" />}
              onClick={() => handleInsert(`${fn}()`)}
              sx={{ cursor: "pointer" }}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
};
