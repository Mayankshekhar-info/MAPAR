import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  MenuItem,
  Grid,
  IconButton,
  Divider,
  Stepper,
  Step,
  StepLabel,
  FormControlLabel,
  Switch,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  Tooltip,
  RadioGroup,
  Radio,
  LinearProgress,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import BarChartIcon from "@mui/icons-material/BarChart";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TableChartIcon from "@mui/icons-material/TableChart";
import TrafficIcon from "@mui/icons-material/Traffic";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import TuneIcon from "@mui/icons-material/Tune";

import {
  KPIDefinition,
  CreateKPIDefinitionPayload,
  HierarchyLevelType,
  VisualizationType,
  KPIComparisonItem,
  KPIComparisonRule,
  KPIPerformanceColors,
  KPIVisualizationStyle,
  PerformanceDirection,
  KPIActualDataSourceConfig,
} from "../types/kpi";
import { organizationService } from "../../organization/api/organizationService";
import { CascadingOption, HierarchyLevel } from "../../organization/types/organization.types";
import { uploadsService } from "../../uploads/api/uploadsService";
import { UploadTemplate } from "../../uploads/types/uploads.types";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import StorageIcon from "@mui/icons-material/Storage";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import { FormulaCalculationSection } from "./FormulaCalculationSection";

interface KPIBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: CreateKPIDefinitionPayload) => Promise<any>;
  initialData?: KPIDefinition | null;
}

const STEPS = [
  "General Setup",
  "Performance Targets & Comparison",
  "Visualization",
  "Review & Save",
];

const DEFAULT_PERFORMANCE_COLORS: KPIPerformanceColors = {
  meets_target: "#10B981",
  below_target: "#EF4444",
  exceeded_limit: "#8B5CF6",
  warning: "#F59E0B",
  critical: "#DC2626",
};

const COLOR_PRESETS = [
  { name: "Emerald", hex: "#10B981" },
  { name: "Sky Blue", hex: "#0284C7" },
  { name: "Indigo", hex: "#6366F1" },
  { name: "Purple", hex: "#8B5CF6" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Rose", hex: "#EF4444" },
  { name: "Slate", hex: "#64748B" },
];

const HIERARCHY_LEVELS: Array<{ value: HierarchyLevelType; label: string }> = [
  { value: "MAIN_COMPANY", label: "Main Company" },
  { value: "SUB_COMPANY", label: "Sub Company" },
  { value: "PROJECT", label: "Project" },
  { value: "CIRCLE", label: "Circle" },
  { value: "DOMAIN", label: "Domain" },
  { value: "DEPARTMENT", label: "Department" },
  { value: "SUB_DEPARTMENT", label: "Sub Department" },
];

const UNIT_SUGGESTIONS = ["%", "minutes", "hours", "count", "units", "ms", "MB/s", "ratio", "score"];

export const KPIBuilderModal: React.FC<KPIBuilderModalProps> = ({
  open,
  onClose,
  onSave,
  initialData,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 0: General Setup (Exactly 5 fields + Active toggle)
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [hierarchyLevel, setHierarchyLevel] = useState<HierarchyLevelType>("CIRCLE");
  const [hierarchyId, setHierarchyId] = useState<number | "">("");
  const [isActive, setIsActive] = useState(true);

  // Dynamic organization nodes
  const [hierarchyNodes, setHierarchyNodes] = useState<CascadingOption[]>([]);
  const [isLoadingNodes, setIsLoadingNodes] = useState(false);

  // Real Uploaded Datasets & Discovered Schemas
  const [datasets, setDatasets] = useState<UploadTemplate[]>([]);
  const [datasetSchemas, setDatasetSchemas] = useState<Record<number, Array<{ name: string; label: string; data_type: string; is_numeric: boolean }>>>({});
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const [loadingSchemaId, setLoadingSchemaId] = useState<number | null>(null);

  // Step 1: Performance Targets & Comparison
  const [comparisons, setComparisons] = useState<KPIComparisonItem[]>([]);
  const [editingComparisonIndex, setEditingComparisonIndex] = useState<number>(0);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  // Step 2: Visualization & Presentation Settings
  const [visualizationStyle, setVisualizationStyle] = useState<KPIVisualizationStyle>("CARD");
  const [performanceColors, setPerformanceColors] = useState<KPIPerformanceColors>(DEFAULT_PERFORMANCE_COLORS);

  // Load datasets when modal opens
  useEffect(() => {
    if (open) {
      setIsLoadingDatasets(true);
      uploadsService
        .getTemplates()
        .then((res) => {
          const list = res || [];
          setDatasets(list);
          const preSchemas: Record<number, Array<{ name: string; label: string; data_type: string; is_numeric: boolean }>> = {};
          list.forEach((t: any) => {
            if (t.available_columns && t.available_columns.length > 0) {
              preSchemas[t.id] = t.available_columns;
            } else if (t.versions && t.versions[0]?.columns) {
              preSchemas[t.id] = t.versions[0].columns.map((c: any) => ({
                name: c.display_label || c.name,
                label: c.display_label || c.name,
                data_type: c.data_type,
                is_numeric: ["INTEGER", "DECIMAL", "PERCENTAGE", "NUMBER"].includes(c.data_type),
              }));
            }
          });
          setDatasetSchemas((prev) => ({ ...preSchemas, ...prev }));
        })
        .catch(() => setDatasets([]))
        .finally(() => setIsLoadingDatasets(false));
    }
  }, [open]);

  // Load dataset schema columns dynamically
  const loadDatasetColumns = async (datasetId: number) => {
    if (datasetSchemas[datasetId] && datasetSchemas[datasetId].length > 0) return datasetSchemas[datasetId];
    setLoadingSchemaId(datasetId);
    try {
      const tpl = await uploadsService.getTemplate(datasetId);
      let cols: Array<{ name: string; label: string; data_type: string; is_numeric: boolean }> = [];
      if ((tpl as any).available_columns && (tpl as any).available_columns.length > 0) {
        cols = (tpl as any).available_columns;
      } else if (tpl.versions && tpl.versions[0]?.columns) {
        cols = tpl.versions[0].columns.map((c: any) => ({
          name: c.display_label || c.name,
          label: c.display_label || c.name,
          data_type: c.data_type,
          is_numeric: ["INTEGER", "DECIMAL", "PERCENTAGE", "NUMBER"].includes(c.data_type),
        }));
      }
      setDatasetSchemas((prev) => ({ ...prev, [datasetId]: cols }));
      return cols;
    } catch {
      return [];
    } finally {
      setLoadingSchemaId(null);
    }
  };

  // Load hierarchy nodes dynamically when level changes
  useEffect(() => {
    setIsLoadingNodes(true);
    organizationService
      .getOptions(hierarchyLevel as HierarchyLevel)
      .then((nodes) => {
        setHierarchyNodes(nodes);
        if (hierarchyId && !nodes.some((n) => n.id === hierarchyId)) {
          setHierarchyId("");
        }
      })
      .catch(() => setHierarchyNodes([]))
      .finally(() => setIsLoadingNodes(false));
  }, [hierarchyLevel]);

  // Initialize or reset form state
  useEffect(() => {
    if (initialData && open) {
      setName(initialData.name || "");
      setCode(initialData.code || "");
      setDescription(initialData.description || "");
      setHierarchyLevel(initialData.hierarchy_level || "CIRCLE");
      setHierarchyId(initialData.hierarchy_id || "");
      setIsActive(initialData.is_active ?? true);

      // Load comparisons from presentation_config or synthesized fallback
      const pConfig = initialData.presentation_config || {};
      const savedComparisons: KPIComparisonItem[] =
        pConfig.comparisons || (initialData as any).comparisons || [];

      if (savedComparisons.length > 0) {
        setComparisons(
          savedComparisons.map((c) => {
            const stdVal = c.standard_value ?? c.target_value ?? "";
            const achCol = c.achieved_data_column || c.data_source?.metric_field || "";
            const dsId = c.data_source?.dataset_id || initialData.source_dataset || null;
            const existingRules = c.rules && c.rules.length > 0 ? c.rules : [
              {
                id: "rule_1",
                achieved_data_column: achCol,
                standard_value: stdVal,
                performance_direction: c.performance_direction || "HIGHER_BETTER",
                unit: c.unit || "%",
                aggregation: c.data_source?.aggregation || (initialData.aggregation_method as any) || "AVG",
              }
            ];
            const normRules: KPIComparisonRule[] = existingRules.map((r, rIdx) => ({
              id: r.id || `rule_${rIdx + 1}`,
              achieved_data_column: r.achieved_data_column || "",
              standard_value: r.standard_value ?? (r as any).target_value ?? "",
              performance_direction: r.performance_direction || "HIGHER_BETTER",
              unit: r.unit || c.unit || "%",
              aggregation: r.aggregation || c.data_source?.aggregation || "AVG",
            }));
            const primR = normRules[0] || {};
            return {
              ...c,
              rules: normRules,
              standard_value: primR.standard_value ?? stdVal,
              target_value: primR.standard_value ?? stdVal,
              achieved_data_column: primR.achieved_data_column ?? achCol,
              performance_direction: primR.performance_direction ?? c.performance_direction ?? "HIGHER_BETTER",
              data_source: {
                source_type: "UPLOAD",
                dataset_id: dsId,
                dataset_name: c.data_source?.dataset_name || initialData.source_dataset_name || "",
                metric_field: primR.achieved_data_column ?? achCol,
                aggregation: c.data_source?.aggregation || (initialData.aggregation_method as any) || "AVG",
                period_behavior: c.data_source?.period_behavior || "MATCH_PERIOD",
                date_field: c.data_source?.date_field || null,
              },
            };
          })
        );
        // Pre-fetch columns for datasets in comparisons
        savedComparisons.forEach((c) => {
          const dsId = c.data_source?.dataset_id || initialData.source_dataset;
          if (dsId) {
            loadDatasetColumns(dsId);
          }
        });
      } else {
        let pDir: PerformanceDirection = "HIGHER_BETTER";
        if (initialData.direction === "LOWER_BETTER") pDir = "LOWER_BETTER";
        else if (initialData.direction === "NEUTRAL") pDir = "EXACT_TARGET";

        const stdVal = initialData.target_value ?? "";
        const achCol = initialData.formula_expression || "";

        setComparisons([
          {
            id: `comp_init_${Date.now()}`,
            name: initialData.name || "Default Target",
            metric_label: initialData.name || "Primary Metric",
            unit: initialData.unit || "%",
            rules: [
              {
                id: "rule_1",
                achieved_data_column: achCol,
                standard_value: stdVal,
                performance_direction: pDir,
                unit: initialData.unit || "%",
                aggregation: (initialData.aggregation_method as any) || "AVG",
              }
            ],
            standard_value: stdVal,
            target_value: stdVal,
            actual_value: stdVal,
            achieved_data_column: achCol,
            performance_direction: pDir,
            warning_threshold: initialData.threshold_amber ?? null,
            critical_threshold: null,
            display_color: "#10B981",
            is_enabled: true,
            is_manual: false,
            data_source: {
              source_type: "UPLOAD",
              dataset_id: initialData.source_dataset || null,
              dataset_name: initialData.source_dataset_name || "",
              metric_field: achCol,
              aggregation: (initialData.aggregation_method as any) || "AVG",
              period_behavior: "MATCH_PERIOD",
            },
          },
        ]);
        if (initialData.source_dataset) {
          loadDatasetColumns(initialData.source_dataset);
        }
      }

      setVisualizationStyle(pConfig.visualization_style || (initialData.visualization_type as any) || "CARD");
      setPerformanceColors(pConfig.performance_colors || DEFAULT_PERFORMANCE_COLORS);
      setActiveStep(0);
      setErrorMsg(null);
    } else if (open) {
      // Default clean state for new KPI creation
      setName("");
      setCode("");
      setDescription("");
      setHierarchyLevel("CIRCLE");
      setHierarchyId("");
      setIsActive(true);

      const firstDataset = datasets[0];
      setComparisons([
        {
          id: `comp_${Date.now()}`,
          name: "Primary Comparison",
          metric_label: "Target vs Achievement",
          unit: "%",
          rules: [
            {
              id: "rule_1",
              achieved_data_column: "",
              standard_value: "",
              performance_direction: "HIGHER_BETTER",
              unit: "%",
              aggregation: "AVG",
            }
          ],
          standard_value: "",
          target_value: "",
          actual_value: "",
          achieved_data_column: "",
          performance_direction: "HIGHER_BETTER",
          warning_threshold: "",
          critical_threshold: "",
          display_color: "#10B981",
          is_enabled: true,
          is_manual: false,
          data_source: {
            source_type: "UPLOAD",
            dataset_id: firstDataset?.id || null,
            dataset_name: firstDataset?.name || "",
            metric_field: "",
            aggregation: "AVG",
            period_behavior: "MATCH_PERIOD",
          },
        },
      ]);
      if (firstDataset?.id) {
        loadDatasetColumns(firstDataset.id);
      }
      setVisualizationStyle("CARD");
      setPerformanceColors(DEFAULT_PERFORMANCE_COLORS);
      setActiveStep(0);
      setErrorMsg(null);
    }
  }, [initialData, open, datasets.length]);

  // Comparison Management
  const handleAddComparison = () => {
    const nextNum = comparisons.length + 1;
    const firstDataset = datasets[0];
    const newComp: KPIComparisonItem = {
      id: `comp_${Date.now()}_${nextNum}`,
      name: `Comparison ${nextNum}`,
      metric_label: `Metric ${nextNum}`,
      unit: comparisons[0]?.unit || "%",
      rules: [
        {
          id: "rule_1",
          achieved_data_column: "",
          standard_value: "",
          performance_direction: "HIGHER_BETTER",
          unit: comparisons[0]?.unit || "%",
          aggregation: "AVG",
        }
      ],
      standard_value: "",
      target_value: "",
      actual_value: "",
      achieved_data_column: "",
      performance_direction: "HIGHER_BETTER",
      warning_threshold: "",
      critical_threshold: "",
      display_color: COLOR_PRESETS[(nextNum - 1) % COLOR_PRESETS.length].hex,
      is_enabled: true,
      is_manual: false,
      data_source: {
        source_type: "UPLOAD",
        dataset_id: firstDataset?.id || comparisons[0]?.data_source?.dataset_id || null,
        dataset_name: firstDataset?.name || comparisons[0]?.data_source?.dataset_name || "",
        metric_field: "",
        aggregation: "AVG",
        period_behavior: "MATCH_PERIOD",
      },
    };
    setComparisons((prev) => [...prev, newComp]);
    setEditingComparisonIndex(comparisons.length);
    if (newComp.data_source?.dataset_id) {
      loadDatasetColumns(newComp.data_source.dataset_id);
    }
  };

  const handleUpdateComparison = (index: number, field: keyof KPIComparisonItem, value: any) => {
    setComparisons((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleUpdateComparisonDataSource = (
    index: number,
    field: keyof KPIActualDataSourceConfig,
    value: any
  ) => {
    setComparisons((prev) => {
      const copy = [...prev];
      const current = copy[index].data_source || {
        source_type: "UPLOAD",
        dataset_id: datasets[0]?.id || null,
        dataset_name: datasets[0]?.name || "",
        metric_field: "",
        aggregation: "AVG",
        period_behavior: "MATCH_PERIOD",
      };
      const updated = { ...current, [field]: value };
      if (field === "dataset_id") {
        const found = datasets.find((d) => d.id === value);
        updated.dataset_name = found?.name || "";
        loadDatasetColumns(value);
      }
      copy[index] = {
        ...copy[index],
        data_source: updated,
        is_manual: updated.source_type === "MANUAL",
      };
      return copy;
    });
  };

  // Rule Management within a Comparison
  const handleAddRule = (compIndex: number) => {
    setComparisons((prev) => {
      const copy = [...prev];
      const comp = copy[compIndex];
      const currentRules = comp.rules && comp.rules.length > 0 ? comp.rules : [
        {
          id: "rule_1",
          achieved_data_column: comp.achieved_data_column || "",
          standard_value: comp.standard_value ?? comp.target_value ?? "",
          performance_direction: comp.performance_direction || "HIGHER_BETTER",
          unit: comp.unit || "%",
          aggregation: comp.data_source?.aggregation || "AVG",
        }
      ];
      const newRule: KPIComparisonRule = {
        id: `rule_${Date.now()}_${currentRules.length + 1}`,
        achieved_data_column: "",
        standard_value: "",
        performance_direction: "HIGHER_BETTER",
        unit: comp.unit || "%",
        aggregation: comp.data_source?.aggregation || "AVG",
      };
      copy[compIndex] = {
        ...comp,
        rules: [...currentRules, newRule],
      };
      return copy;
    });
  };

  const handleUpdateRule = (
    compIndex: number,
    ruleIndex: number,
    field: keyof KPIComparisonRule,
    value: any
  ) => {
    setComparisons((prev) => {
      const copy = [...prev];
      const comp = copy[compIndex];
      const currentRules = comp.rules && comp.rules.length > 0 ? [...comp.rules] : [
        {
          id: "rule_1",
          achieved_data_column: comp.achieved_data_column || "",
          standard_value: comp.standard_value ?? comp.target_value ?? "",
          performance_direction: comp.performance_direction || "HIGHER_BETTER",
          unit: comp.unit || "%",
          aggregation: comp.data_source?.aggregation || "AVG",
        }
      ];
      currentRules[ruleIndex] = { ...currentRules[ruleIndex], [field]: value };

      const isFirst = ruleIndex === 0;
      const primaryRule = currentRules[0] || {};
      copy[compIndex] = {
        ...comp,
        rules: currentRules,
        ...(isFirst
          ? {
              achieved_data_column: primaryRule.achieved_data_column,
              standard_value: primaryRule.standard_value,
              target_value: primaryRule.standard_value,
              performance_direction: primaryRule.performance_direction,
              data_source: {
                ...(comp.data_source || {
                  source_type: "UPLOAD",
                  aggregation: "AVG",
                  period_behavior: "MATCH_PERIOD",
                }),
                metric_field: primaryRule.achieved_data_column,
              },
            }
          : {}),
      };
      return copy;
    });
  };

  const handleRemoveRule = (compIndex: number, ruleIndex: number) => {
    setComparisons((prev) => {
      const copy = [...prev];
      const comp = copy[compIndex];
      const currentRules = comp.rules || [];
      if (currentRules.length <= 1) return prev; // Preserve at least one rule

      const rules = currentRules.filter((_, idx) => idx !== ruleIndex);
      const primaryRule = rules[0] || {};
      copy[compIndex] = {
        ...comp,
        rules,
        achieved_data_column: primaryRule.achieved_data_column,
        standard_value: primaryRule.standard_value,
        target_value: primaryRule.standard_value,
        performance_direction: primaryRule.performance_direction,
        data_source: {
          ...(comp.data_source || {
            source_type: "UPLOAD",
            aggregation: "AVG",
            period_behavior: "MATCH_PERIOD",
          }),
          metric_field: primaryRule.achieved_data_column,
        },
      };
      return copy;
    });
  };

  const handleDuplicateComparison = (index: number) => {
    const source = comparisons[index];
    const clone: KPIComparisonItem = {
      ...source,
      id: `comp_${Date.now()}_copy`,
      name: `${source.name} (Copy)`,
      is_enabled: true,
      rules: source.rules ? source.rules.map(r => ({ ...r, id: `rule_${Date.now()}_${Math.random()}` })) : undefined,
      data_source: source.data_source ? { ...source.data_source } : undefined,
    };
    setComparisons((prev) => [...prev, clone]);
    setEditingComparisonIndex(comparisons.length);
  };

  const handleRemoveComparison = () => {
    if (deleteConfirmIndex === null) return;
    setComparisons((prev) => prev.filter((_, idx) => idx !== deleteConfirmIndex));
    setEditingComparisonIndex(0);
    setDeleteConfirmIndex(null);
  };

  // Live Performance Calculation Helper
  const calculateComparisonMetrics = (comp: KPIComparisonItem) => {
    const rules = comp.rules && comp.rules.length > 0 ? comp.rules : [
      {
        id: "rule_1",
        achieved_data_column: comp.achieved_data_column || comp.data_source?.metric_field || "",
        standard_value: comp.standard_value ?? comp.target_value ?? "",
        performance_direction: comp.performance_direction || "HIGHER_BETTER",
      }
    ];

    const currentDsId = comp.data_source?.dataset_id || datasets[0]?.id;
    const availableCols = (currentDsId && datasetSchemas[currentDsId]) || [];
    const dsName = comp.data_source?.dataset_name || datasets.find((d) => d.id === currentDsId)?.name || "Uploaded Dataset";

    if (datasets.length === 0 && !isLoadingDatasets) {
      return {
        gap: null,
        achievementPct: null,
        statusLabel: "Awaiting Uploaded Data",
        statusColor: "#D97706",
        statusCode: "AWAITING_UPLOAD",
        isDataDriven: true,
        sourceDescription: "Awaiting uploaded Excel dataset",
      };
    }

    if (availableCols.length > 0) {
      for (const r of rules) {
        const col = (r.achieved_data_column || "").trim();
        if (col) {
          const matched = availableCols.find(
            (c) =>
              c.name.trim().toLowerCase() === col.toLowerCase() ||
              c.label.trim().toLowerCase() === col.toLowerCase()
          );
          if (!matched) {
            return {
              gap: null,
              achievementPct: null,
              statusLabel: `Missing Column: ${col}`,
              statusColor: "#DC2626",
              statusCode: "CONFIG_INVALID",
              isDataDriven: true,
              sourceDescription: `Column "${col}" not found in uploaded schema`,
            };
          }
        }
      }
    }

    const firstCol = (rules[0]?.achieved_data_column || comp.achieved_data_column || "").trim();
    if (firstCol) {
      return {
        gap: null,
        achievementPct: null,
        statusLabel: rules.length > 1 ? `${rules.length} Rules Active` : `Excel: ${firstCol}`,
        statusColor: "#0284C7",
        statusCode: "DATA_DRIVEN",
        isDataDriven: true,
        sourceDescription: `${dsName} • ${rules.length} rule${rules.length > 1 ? "s" : ""}`,
      };
    }

    return {
      gap: null,
      achievementPct: null,
      statusLabel: "Pending Column Selection",
      statusColor: "#64748B",
      statusCode: "PENDING",
      isDataDriven: true,
      sourceDescription: "Select an Excel column",
    };
  };

  // Step Navigation & Validation
  const handleNext = () => {
    setErrorMsg(null);
    if (activeStep === 0) {
      if (!name.trim()) {
        setErrorMsg("KPI Name is required.");
        return;
      }
      if (!code.trim()) {
        setErrorMsg("KPI Code is required.");
        return;
      }
    } else if (activeStep === 1) {
      if (comparisons.length === 0) {
        setErrorMsg("Please define at least one Target vs Achievement comparison.");
        return;
      }
      for (let cIdx = 0; cIdx < comparisons.length; cIdx++) {
        const c = comparisons[cIdx];
        if (!c.is_enabled) continue;
        if (!c.name.trim()) {
          setErrorMsg("Comparison Name is required for all comparisons.");
          return;
        }
        const rules = c.rules && c.rules.length > 0 ? c.rules : [
          {
            id: "rule_1",
            achieved_data_column: c.achieved_data_column || c.data_source?.metric_field || "",
            standard_value: c.standard_value ?? c.target_value ?? "",
            performance_direction: c.performance_direction || "HIGHER_BETTER",
          }
        ];
        if (rules.length === 0) {
          setErrorMsg(`Comparison "${c.name}" must have at least one column rule.`);
          return;
        }
        const seenCols = new Set<string>();
        for (let rIdx = 0; rIdx < rules.length; rIdx++) {
          const r = rules[rIdx];
          const achCol = (r.achieved_data_column || "").trim();
          if (!achCol) {
            setErrorMsg(`Rule #${rIdx + 1} in comparison "${c.name}" requires an Achieved Data Column Name.`);
            return;
          }
          const stdVal = r.standard_value ?? r.target_value;
          if (stdVal === "" || stdVal === null || stdVal === undefined) {
            setErrorMsg(`Rule #${rIdx + 1} ("${achCol}") in comparison "${c.name}" requires a Standard Value.`);
            return;
          }
          const normCol = achCol.toLowerCase();
          if (seenCols.has(normCol)) {
            setErrorMsg(`Column "${achCol}" is configured more than once in comparison "${c.name}". Each rule under a comparison must target a distinct uploaded column.`);
            return;
          }
          seenCols.add(normCol);

          const dsId = c.data_source?.dataset_id || (datasets.length > 0 ? datasets[0].id : null);
          const schemaCols = (dsId && datasetSchemas[dsId]) || [];
          if (schemaCols.length > 0) {
            const colFound = schemaCols.some(
              (col) =>
                col.name.trim().toLowerCase() === normCol ||
                col.label.trim().toLowerCase() === normCol
            );
            if (!colFound) {
              setErrorMsg(
                `Column "${achCol}" in comparison "${c.name}" was not found in the uploaded Excel dataset. Please select a detected column.`
              );
              return;
            }
          }
        }
      }
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setErrorMsg(null);
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !code.trim()) {
      setErrorMsg("KPI Name and Code are required.");
      setActiveStep(0);
      return;
    }

    if (comparisons.length === 0) {
      setErrorMsg("Please configure at least one comparison.");
      setActiveStep(1);
      return;
    }

    for (let cIdx = 0; cIdx < comparisons.length; cIdx++) {
      const c = comparisons[cIdx];
      if (!c.is_enabled) continue;
      if (!c.name.trim()) {
        setErrorMsg("Comparison Name is required for all comparisons.");
        setActiveStep(1);
        return;
      }
      const rules = c.rules && c.rules.length > 0 ? c.rules : [
        {
          id: "rule_1",
          achieved_data_column: c.achieved_data_column || c.data_source?.metric_field || "",
          standard_value: c.standard_value ?? c.target_value ?? "",
          performance_direction: c.performance_direction || "HIGHER_BETTER",
        }
      ];
      if (rules.length === 0) {
        setErrorMsg(`Comparison "${c.name}" must have at least one column rule.`);
        setActiveStep(1);
        return;
      }
      const seenCols = new Set<string>();
      for (let rIdx = 0; rIdx < rules.length; rIdx++) {
        const r = rules[rIdx];
        const achCol = (r.achieved_data_column || "").trim();
        if (!achCol) {
          setErrorMsg(`Rule #${rIdx + 1} in comparison "${c.name}" requires an Achieved Data Column Name.`);
          setActiveStep(1);
          return;
        }
        const stdVal = r.standard_value ?? r.target_value;
        if (stdVal === "" || stdVal === null || stdVal === undefined) {
          setErrorMsg(`Rule #${rIdx + 1} ("${achCol}") in comparison "${c.name}" requires a Standard Value.`);
          setActiveStep(1);
          return;
        }
        const normCol = achCol.toLowerCase();
        if (seenCols.has(normCol)) {
          setErrorMsg(`Column "${achCol}" is configured more than once in comparison "${c.name}". Each rule under a comparison must target a distinct uploaded column.`);
          setActiveStep(1);
          return;
        }
        seenCols.add(normCol);

        const dsId = c.data_source?.dataset_id || (datasets.length > 0 ? datasets[0].id : null);
        const schemaCols = (dsId && datasetSchemas[dsId]) || [];
        if (schemaCols.length > 0) {
          const colFound = schemaCols.some(
            (col) =>
              col.name.trim().toLowerCase() === normCol ||
              col.label.trim().toLowerCase() === normCol
          );
          if (!colFound) {
            setErrorMsg(
              `Column "${achCol}" in comparison "${c.name}" was not found in the uploaded Excel dataset. Please select a detected column.`
            );
            setActiveStep(1);
            return;
          }
        }
      }
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const primaryComp = comparisons[0] || {};
      const primaryRules = primaryComp.rules && primaryComp.rules.length > 0 ? primaryComp.rules : [];
      const primaryRule = primaryRules[0] || {};
      const primaryStandard = primaryRule.standard_value ?? (primaryComp.standard_value ?? primaryComp.target_value ?? "");
      const primaryTarget = primaryStandard !== "" && primaryStandard !== null ? Number(primaryStandard) : null;
      const primaryCol = (primaryRule.achieved_data_column || primaryComp.achieved_data_column || primaryComp.data_source?.metric_field || "").trim();

      let primaryDirection: "HIGHER_BETTER" | "LOWER_BETTER" | "NEUTRAL" = "HIGHER_BETTER";
      const pdir = primaryRule.performance_direction || primaryComp.performance_direction;
      if (pdir === "LOWER_BETTER") {
        primaryDirection = "LOWER_BETTER";
      } else if (pdir === "EXACT_TARGET") {
        primaryDirection = "NEUTRAL";
      }

      const primaryDsId = primaryComp.data_source?.dataset_id || (datasets[0]?.id ?? null);
      const primaryAgg = primaryComp.data_source?.aggregation || "AVG";

      const sanitizedComparisons: KPIComparisonItem[] = comparisons.map((c) => {
        const rules = c.rules && c.rules.length > 0 ? c.rules : [
          {
            id: "rule_1",
            achieved_data_column: c.achieved_data_column || c.data_source?.metric_field || "",
            standard_value: c.standard_value ?? c.target_value ?? "",
            performance_direction: c.performance_direction || "HIGHER_BETTER",
            unit: c.unit || "%",
            aggregation: c.data_source?.aggregation || "AVG",
          }
        ];

        const sanitizedRules: KPIComparisonRule[] = rules.map((r, rIdx) => {
          const sVal = r.standard_value !== "" && r.standard_value !== null ? Number(r.standard_value) : null;
          return {
            id: r.id || `rule_${rIdx + 1}`,
            achieved_data_column: (r.achieved_data_column || "").trim(),
            standard_value: sVal !== null && !isNaN(sVal) ? sVal : r.standard_value,
            target_value: sVal !== null && !isNaN(sVal) ? sVal : r.standard_value,
            performance_direction: r.performance_direction || "HIGHER_BETTER",
            unit: r.unit || c.unit || "%",
            aggregation: r.aggregation || c.data_source?.aggregation || "AVG",
          };
        });

        const primR = sanitizedRules[0] || {};
        const cCol = primR.achieved_data_column || (c.achieved_data_column || c.data_source?.metric_field || "").trim();
        const sVal = primR.standard_value ?? (c.standard_value ?? c.target_value);
        const cDsId = c.data_source?.dataset_id || primaryDsId;

        return {
          ...c,
          rules: sanitizedRules,
          standard_value: sVal !== "" && sVal !== null ? Number(sVal) : null,
          target_value: sVal !== "" && sVal !== null ? Number(sVal) : null,
          achieved_data_column: cCol,
          performance_direction: primR.performance_direction || c.performance_direction || "HIGHER_BETTER",
          data_source: {
            source_type: "UPLOAD" as const,
            dataset_id: cDsId,
            dataset_name: c.data_source?.dataset_name || "",
            metric_field: cCol,
            aggregation: (c.data_source?.aggregation || "AVG") as any,
            period_behavior: c.data_source?.period_behavior || "MATCH_PERIOD",
            date_field: c.data_source?.date_field || null,
          },
        };
      });

      const payload: CreateKPIDefinitionPayload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        hierarchy_level: hierarchyLevel,
        hierarchy_id: hierarchyId ? Number(hierarchyId) : null,
        visualization_type: (visualizationStyle as VisualizationType) || "CARD",
        calculation_type: "ACHIEVEMENT_PCT",
        source_dataset: primaryDsId ? Number(primaryDsId) : null,
        formula_expression: primaryCol,
        aggregation_method: primaryAgg,
        unit: primaryComp.unit || "%",
        decimal_precision: 2,
        direction: primaryDirection,
        target_value: primaryTarget,
        comparison_method: "TARGET",
        threshold_green: 95.0,
        threshold_amber:
          primaryComp.warning_threshold !== "" && primaryComp.warning_threshold !== null
            ? Number(primaryComp.warning_threshold)
            : 80.0,
        is_active: isActive,
        is_executive: false,
        display_order: initialData?.display_order ?? 0,
        presentation_config: {
          comparisons: sanitizedComparisons,
          performance_colors: performanceColors,
          visualization_style: visualizationStyle,
        },
        comparisons: sanitizedComparisons,
        performance_colors: performanceColors,
        visualization_style: visualizationStyle,
        parameters: [],
        filters: [],
        dependencies: [],
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || "Failed to save KPI definition.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            width: "100%",
            maxWidth: { xs: "calc(100vw - 24px)", sm: "calc(100vw - 48px)", md: "980px", lg: "1160px" },
            maxHeight: "92vh",
            m: "auto",
            borderRadius: 2,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: 24,
          },
        }}
      >
        {/* Header */}
        <DialogTitle
          sx={{
            px: { xs: 2.5, md: 3.5 },
            py: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {initialData ? `Edit Master KPI: ${initialData.code}` : "Configure Master KPI"}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>
              Independent Target vs Achievement Performance Comparison System
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        {/* Stepper Header */}
        <Box sx={{ px: { xs: 2, md: 4 }, py: 2, bgcolor: "grey.50", borderBottom: "1px solid", borderColor: "divider" }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {STEPS.map((label, idx) => (
              <Step key={label} completed={activeStep > idx}>
                <StepLabel
                  onClick={() => {
                    if (idx < activeStep) setActiveStep(idx);
                  }}
                  sx={{
                    cursor: idx < activeStep ? "pointer" : "default",
                    "& .MuiStepLabel-label": { fontWeight: activeStep === idx ? 700 : 500, fontSize: "0.85rem" },
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Scrollable Form Body */}
        <DialogContent sx={{ p: { xs: 2.5, md: 3.5 }, overflowY: "auto", flex: "1 1 auto" }}>
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 1.5 }} onClose={() => setErrorMsg(null)}>
              {errorMsg}
            </Alert>
          )}

          {/* ========================================================================= */}
          {/* STEP 0: GENERAL SETUP (EXACTLY 5 FIELDS + ACTIVE TOGGLE)                   */}
          {/* ========================================================================= */}
          {activeStep === 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  General KPI Identification & Organization Assignment
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Define the core identity of this KPI and assign it to the appropriate tier of the organization hierarchy.
                </Typography>
              </Box>

              <Grid container spacing={2.5}>
                {/* 1. KPI Name */}
                <Grid size={{ xs: 12, sm: 7 }}>
                  <TextField
                    fullWidth
                    label="KPI Name"
                    required
                    placeholder="e.g. Network Uptime Percentage"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    helperText="Required. Display name used across KPI cards, reports, and summary matrices."
                  />
                </Grid>

                {/* 2. KPI Code */}
                <Grid size={{ xs: 12, sm: 5 }}>
                  <TextField
                    fullWidth
                    label="KPI Code"
                    required
                    placeholder="e.g. UPTIME_PCT"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                    helperText="Required. Unique uppercase identifier (e.g. UPTIME_PCT)."
                  />
                </Grid>

                {/* 3. Description */}
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={2.5}
                    placeholder="Explain the purpose, business objective, or operational context of this KPI..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    helperText="Optional. Guidance on business meaning and target goals."
                  />
                </Grid>

                {/* 4. Organization Hierarchy Level */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    label="Organization Hierarchy Level"
                    value={hierarchyLevel}
                    onChange={(e) => setHierarchyLevel(e.target.value as HierarchyLevelType)}
                    helperText="Loaded dynamically from the Organization module."
                  >
                    {HIERARCHY_LEVELS.map((lvl) => (
                      <MenuItem key={lvl.value} value={lvl.value}>
                        {lvl.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                {/* 5. Assigned Organization Node */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    label="Assigned Organization Node"
                    value={hierarchyId}
                    onChange={(e) => setHierarchyId(e.target.value === "" ? "" : Number(e.target.value))}
                    disabled={isLoadingNodes}
                    helperText={
                      isLoadingNodes
                        ? "Loading authorized hierarchy nodes..."
                        : "Target organization scope. Choose 'Dynamic' for viewer context scope."
                    }
                  >
                    <MenuItem value="">
                      <em>Dynamic / All Nodes (Context-Aware)</em>
                    </MenuItem>
                    {hierarchyNodes.map((node) => (
                      <MenuItem key={node.id} value={node.id}>
                        {node.name} {node.code ? `(${node.code})` : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                {/* Toggle: Active in Calculation Engine */}
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "grey.50" }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            Active in Calculation Engine
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            Only active KPI definitions will be evaluated in automated dashboard runs and report summaries.
                          </Typography>
                        </Box>
                      }
                    />
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: PERFORMANCE TARGETS & COMPARISON                                    */}
          {/* ========================================================================= */}
          {activeStep === 1 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 1.5 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Performance Targets & Comparison Builder
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Configure one or more target-versus-achievement rules under this single KPI. Each comparison computes gaps and compliance independently.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddComparison}
                  sx={{ fontWeight: 600 }}
                >
                  Add Comparison
                </Button>
              </Box>

              {/* Comparison Tabs / Cards List */}
              <Grid container spacing={2}>
                {comparisons.map((comp, idx) => {
                  const metrics = calculateComparisonMetrics(comp);
                  const isEditing = editingComparisonIndex === idx;

                  return (
                    <Grid size={{ xs: 12 }} key={comp.id || idx}>
                      <Card
                        variant="outlined"
                        sx={{
                          borderRadius: 2,
                          borderColor: isEditing ? "primary.main" : "divider",
                          boxShadow: isEditing ? "0 4px 14px rgba(0,0,0,0.06)" : "none",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {/* Comparison Card Header */}
                        <Box
                          sx={{
                            p: 2,
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1.5,
                            bgcolor: isEditing ? "primary.50" : "grey.50",
                            borderBottom: isEditing ? "1px solid" : "none",
                            borderColor: "divider",
                            cursor: "pointer",
                          }}
                          onClick={() => setEditingComparisonIndex(isEditing ? -1 : idx)}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                bgcolor: comp.display_color || "#10B981",
                              }}
                            />
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {comp.name || `Comparison ${idx + 1}`}
                            </Typography>
                            {comp.rules && comp.rules.length > 1 ? (
                              <Chip
                                size="small"
                                label={`${comp.rules.length} Column Rules`}
                                color="primary"
                                variant="outlined"
                                sx={{ height: 22, fontSize: "0.72rem", fontWeight: 700 }}
                              />
                            ) : (
                              <>
                                <Chip
                                  size="small"
                                  label={`Standard: ${(comp.standard_value ?? comp.target_value) !== "" ? `${comp.standard_value ?? comp.target_value} ${comp.unit}` : "—"}`}
                                  variant="outlined"
                                  sx={{ height: 22, fontSize: "0.72rem", bgcolor: "background.paper", fontWeight: 600 }}
                                />
                                <Chip
                                  size="small"
                                  label={
                                    comp.performance_direction === "HIGHER_BETTER"
                                      ? "Higher is Better"
                                      : comp.performance_direction === "LOWER_BETTER"
                                      ? "Lower is Better"
                                      : "Exact Target"
                                  }
                                  sx={{ height: 22, fontSize: "0.72rem", fontWeight: 600 }}
                                />
                                <Chip
                                  size="small"
                                  label={`Col: [${comp.achieved_data_column || comp.data_source?.metric_field || "Not set"}]`}
                                  variant="outlined"
                                  color={comp.achieved_data_column || comp.data_source?.metric_field ? "primary" : "default"}
                                  sx={{ height: 22, fontSize: "0.72rem", fontWeight: 600 }}
                                />
                              </>
                            )}
                          </Box>

                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }} onClick={(e) => e.stopPropagation()}>
                            {/* Live status badge */}
                            <Chip
                              size="small"
                              label={metrics.statusLabel}
                              sx={{
                                bgcolor: metrics.statusColor,
                                color: "#fff",
                                fontWeight: 700,
                                height: 24,
                                fontSize: "0.72rem",
                              }}
                            />

                            {/* Enable Toggle */}
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={comp.is_enabled}
                                  onChange={(e) => handleUpdateComparison(idx, "is_enabled", e.target.checked)}
                                />
                              }
                              label={<Typography variant="caption">Enabled</Typography>}
                              sx={{ mr: 0 }}
                            />

                            {/* Duplicate */}
                            <Tooltip title="Duplicate Comparison">
                              <IconButton size="small" onClick={() => handleDuplicateComparison(idx)}>
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* Delete (if more than 1) */}
                            {comparisons.length > 1 && (
                              <Tooltip title="Remove Comparison">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => setDeleteConfirmIndex(idx)}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            {/* Edit toggle */}
                            <IconButton
                              size="small"
                              onClick={() => setEditingComparisonIndex(isEditing ? -1 : idx)}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>

                        {/* Collapsible Edit Form */}
                        {isEditing && (() => {
                          const currentDatasetId = comp.data_source?.dataset_id || (datasets.length > 0 ? datasets[0].id : null);
                          const availableColumns = (currentDatasetId && datasetSchemas[currentDatasetId]) || [];
                          const compRules = comp.rules && comp.rules.length > 0 ? comp.rules : [
                            {
                              id: "rule_1",
                              achieved_data_column: comp.achieved_data_column || "",
                              standard_value: comp.standard_value ?? comp.target_value ?? "",
                              performance_direction: comp.performance_direction || "HIGHER_BETTER",
                            }
                          ];
                          const isAwaitingUpload = datasets.length === 0 && !isLoadingDatasets;

                          return (
                            <CardContent sx={{ p: 2.5 }}>
                              <Grid container spacing={2}>
                                {/* Comparison Name at the top */}
                                <Grid size={{ xs: 12, sm: datasets.length > 1 ? 7 : 12 }}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Comparison Name"
                                    required
                                    value={comp.name}
                                    onChange={(e) => handleUpdateComparison(idx, "name", e.target.value)}
                                    placeholder="e.g. Site Performance"
                                    helperText="Name of the overall comparison grouping rules"
                                  />
                                </Grid>

                                {/* Multiple Uploaded Datasets Selection (if workspace contains > 1 template) */}
                                {datasets.length > 1 && (
                                  <Grid size={{ xs: 12, sm: 5 }}>
                                    <TextField
                                      select
                                      fullWidth
                                      size="small"
                                      label="Source Upload Dataset"
                                      value={currentDatasetId || ""}
                                      onChange={(e) => {
                                        const newDId = Number(e.target.value);
                                        handleUpdateComparisonDataSource(idx, "dataset_id", newDId);
                                        loadDatasetColumns(newDId);
                                      }}
                                      helperText={`${availableColumns.length} columns detected in schema`}
                                    >
                                      {datasets.map((d) => (
                                        <MenuItem key={d.id} value={d.id}>
                                          {d.name} ({(d as any).file_type || d.data_level || "EXCEL"})
                                        </MenuItem>
                                      ))}
                                    </TextField>
                                  </Grid>
                                )}

                                {/* Configured Column Rules Section Header */}
                                <Grid size={{ xs: 12 }}>
                                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1, mb: 0.5 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary" }}>
                                        Configured Column Rules
                                      </Typography>
                                      <Chip
                                        size="small"
                                        label={`${compRules.length} ${compRules.length === 1 ? "Rule" : "Rules"}`}
                                        color="primary"
                                        variant="outlined"
                                        sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }}
                                      />
                                    </Box>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<AddIcon />}
                                      onClick={() => handleAddRule(idx)}
                                      sx={{ textTransform: "none", fontWeight: 600, borderRadius: 1.5 }}
                                    >
                                      Add Rule
                                    </Button>
                                  </Box>
                                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    Define independent target rules for uploaded Excel columns. Each rule compares actual uploaded values against its benchmark standard.
                                  </Typography>
                                </Grid>

                                {/* Rules List */}
                                <Grid size={{ xs: 12 }}>
                                  <Stack spacing={1.5}>
                                    {compRules.map((rule, rIdx) => {
                                      const ruleCol = (rule.achieved_data_column || "").trim();
                                      const ruleMatchedCol = availableColumns.find(
                                        (c) =>
                                          c.name.trim().toLowerCase() === ruleCol.toLowerCase() ||
                                          c.label.trim().toLowerCase() === ruleCol.toLowerCase()
                                      );
                                      const isRuleColDetected = Boolean(ruleCol && ruleMatchedCol);
                                      const isRuleColMissing = Boolean(ruleCol && availableColumns.length > 0 && !ruleMatchedCol);
                                      const isDuplicate = Boolean(
                                        ruleCol &&
                                        compRules.some(
                                          (other, otherIdx) =>
                                            otherIdx !== rIdx &&
                                            (other.achieved_data_column || "").trim().toLowerCase() === ruleCol.toLowerCase()
                                        )
                                      );

                                      return (
                                        <Paper
                                          key={rule.id || rIdx}
                                          variant="outlined"
                                          sx={{
                                            p: 2,
                                            borderRadius: 2,
                                            borderColor: isDuplicate ? "error.main" : isRuleColMissing ? "warning.main" : "divider",
                                            bgcolor: isDuplicate ? "#FFF5F5" : "background.paper",
                                            transition: "all 0.2s ease",
                                          }}
                                        >
                                          {/* Rule Sub-Header */}
                                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                              <Chip
                                                size="small"
                                                label={`Rule #${rIdx + 1}`}
                                                sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: "grey.100" }}
                                              />
                                              {isDuplicate && (
                                                <Chip
                                                  size="small"
                                                  label="Duplicate Column Selection"
                                                  color="error"
                                                  sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }}
                                                />
                                              )}
                                              {isRuleColDetected && (
                                                <Chip
                                                  size="small"
                                                  icon={<CheckCircleOutlineIcon sx={{ fontSize: "13px !important" }} />}
                                                  label={`Detected (${ruleMatchedCol?.data_type})`}
                                                  color="success"
                                                  variant="outlined"
                                                  sx={{ height: 20, fontSize: "0.7rem" }}
                                                />
                                              )}
                                              {isRuleColMissing && (
                                                <Chip
                                                  size="small"
                                                  icon={<WarningAmberIcon sx={{ fontSize: "13px !important" }} />}
                                                  label="Column Missing in Upload"
                                                  color="warning"
                                                  variant="outlined"
                                                  sx={{ height: 20, fontSize: "0.7rem" }}
                                                />
                                              )}
                                            </Box>

                                            <Tooltip title={compRules.length <= 1 ? "At least one rule is required" : "Remove this rule"}>
                                              <span>
                                                <IconButton
                                                  size="small"
                                                  color="error"
                                                  disabled={compRules.length <= 1}
                                                  onClick={() => handleRemoveRule(idx, rIdx)}
                                                  sx={{ p: 0.5 }}
                                                >
                                                  <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                              </span>
                                            </Tooltip>
                                          </Box>

                                          {/* Rule Inputs in Exact Sequence: 1. Achieved Data Column Name, 2. Standard Value, 3. Performance Direction */}
                                          <Grid container spacing={2} alignItems="flex-start">
                                            {/* 1. Achieved Data Column Name */}
                                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                              <Autocomplete
                                                freeSolo
                                                options={availableColumns.map((col) => col.label || col.name)}
                                                value={rule.achieved_data_column || ""}
                                                onChange={(_, newValue) => {
                                                  const val = typeof newValue === "string" ? newValue : newValue || "";
                                                  handleUpdateRule(idx, rIdx, "achieved_data_column", val);
                                                }}
                                                onInputChange={(_, newInputValue) => {
                                                  handleUpdateRule(idx, rIdx, "achieved_data_column", newInputValue);
                                                }}
                                                renderInput={(params) => (
                                                  <TextField
                                                    {...params}
                                                    size="small"
                                                    required
                                                    label="1. Achieved Data Column Name"
                                                    placeholder="e.g. 13-Oct-26 uptime"
                                                    error={isDuplicate || isRuleColMissing}
                                                    helperText={
                                                      isDuplicate ? (
                                                        <Box component="span" sx={{ color: "error.main", display: "flex", alignItems: "center", gap: 0.5, fontWeight: 600 }}>
                                                          <ErrorOutlineIcon sx={{ fontSize: 13 }} />
                                                          Duplicate column. Each rule must evaluate a unique Excel column.
                                                        </Box>
                                                      ) : isLoadingDatasets || loadingSchemaId === currentDatasetId ? (
                                                        "Detecting Excel column headers..."
                                                      ) : isAwaitingUpload ? (
                                                        <Box component="span" sx={{ color: "warning.main", display: "flex", alignItems: "center", gap: 0.5 }}>
                                                          <WarningAmberIcon sx={{ fontSize: 13 }} />
                                                          Awaiting uploaded data.
                                                        </Box>
                                                      ) : !ruleCol ? (
                                                        "Select or enter exact Excel column header"
                                                      ) : isRuleColDetected ? (
                                                        <Box component="span" sx={{ color: "success.main", display: "flex", alignItems: "center", gap: 0.5, fontWeight: 600 }}>
                                                          <CheckCircleOutlineIcon sx={{ fontSize: 13 }} />
                                                          Detected in uploaded Excel schema ({ruleMatchedCol?.data_type})
                                                        </Box>
                                                      ) : (
                                                        <Box component="span" sx={{ color: "error.main", display: "flex", alignItems: "center", gap: 0.5, fontWeight: 600 }}>
                                                          <ErrorOutlineIcon sx={{ fontSize: 13 }} />
                                                          Column not found in uploaded schema
                                                        </Box>
                                                      )
                                                    }
                                                  />
                                                )}
                                                renderOption={(props, option) => {
                                                  const colInfo = availableColumns.find((c) => (c.label || c.name) === option);
                                                  return (
                                                    <Box component="li" {...props} key={option} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", py: 0.5 }}>
                                                      <Typography variant="body2">{option}</Typography>
                                                      {colInfo && (
                                                        <Chip
                                                          size="small"
                                                          label={colInfo.data_type}
                                                          variant="outlined"
                                                          sx={{ height: 18, fontSize: "0.65rem", ml: 1 }}
                                                        />
                                                      )}
                                                    </Box>
                                                  );
                                                }}
                                              />
                                            </Grid>

                                            {/* 2. Standard Value */}
                                            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                                              <TextField
                                                fullWidth
                                                size="small"
                                                type="number"
                                                label="2. Standard Value"
                                                required
                                                value={rule.standard_value ?? ""}
                                                onChange={(e) => handleUpdateRule(idx, rIdx, "standard_value", e.target.value)}
                                                placeholder="e.g. 98.8 or 60"
                                                helperText="Target benchmark"
                                              />
                                            </Grid>

                                            {/* 2b. Unit (Directly Beside Standard Value) */}
                                            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                                              <TextField
                                                select
                                                fullWidth
                                                size="small"
                                                label="Unit"
                                                value={rule.unit || comp.unit || "%"}
                                                onChange={(e) => {
                                                  handleUpdateRule(idx, rIdx, "unit", e.target.value);
                                                  handleUpdateComparison(idx, "unit", e.target.value);
                                                }}
                                                helperText="Benchmark unit"
                                              >
                                                <MenuItem value="%">Percentage (%)</MenuItem>
                                                <MenuItem value="Minutes">Minutes</MenuItem>
                                                <MenuItem value="Hours">Hours</MenuItem>
                                                <MenuItem value="Seconds">Seconds</MenuItem>
                                                <MenuItem value="Count">Count</MenuItem>
                                                <MenuItem value="Units">Units</MenuItem>
                                              </TextField>
                                            </Grid>

                                            {/* 3. Performance Direction */}
                                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                              <TextField
                                                select
                                                fullWidth
                                                size="small"
                                                label="3. Performance Direction"
                                                required
                                                value={rule.performance_direction || "HIGHER_BETTER"}
                                                onChange={(e) =>
                                                  handleUpdateRule(
                                                    idx,
                                                    rIdx,
                                                    "performance_direction",
                                                    e.target.value as PerformanceDirection
                                                  )
                                                }
                                                helperText="Evaluation direction"
                                              >
                                                <MenuItem value="HIGHER_BETTER">Higher is Better</MenuItem>
                                                <MenuItem value="LOWER_BETTER">Lower is Better</MenuItem>
                                                <MenuItem value="EXACT_TARGET">Exact Target</MenuItem>
                                              </TextField>
                                            </Grid>
                                          </Grid>
                                        </Paper>
                                      );
                                    })}
                                  </Stack>
                                </Grid>

                                {/* Dedicated Mathematical Calculation & Formula Section (Replaces legacy Additional Settings) */}
                                <Grid size={{ xs: 12 }}>
                                  <FormulaCalculationSection
                                    comparison={comp}
                                    rule={compRules[0]}
                                    availableTemplates={datasets}
                                    selectedTemplateId={currentDatasetId}
                                    onSelectTemplate={(templateId) => {
                                      handleUpdateComparisonDataSource(idx, "dataset_id", templateId);
                                      const selT = datasets.find((d) => d.id === templateId);
                                      if (selT) {
                                        handleUpdateComparisonDataSource(idx, "dataset_name", selT.name);
                                      }
                                      loadDatasetColumns(templateId);
                                    }}
                                    availableColumns={availableColumns}
                                    onUpdateRule={(field, val) => handleUpdateRule(idx, 0, field as any, val)}
                                    onUpdateComparison={(field, val) => handleUpdateComparison(idx, field as any, val)}
                                  />
                                </Grid>

                                {/* Live Verification & Rule Summary Banner */}
                                <Grid size={{ xs: 12 }}>
                                  <Paper
                                    variant="outlined"
                                    sx={{
                                      p: 1.5,
                                      borderRadius: 1.5,
                                      bgcolor: "grey.50",
                                      borderColor: "divider",
                                      display: "flex",
                                      flexWrap: "wrap",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 2,
                                    }}
                                  >
                                    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                                        Rules Configured: <strong>{compRules.length}</strong>
                                      </Typography>
                                      {compRules.map((r, rI) => (
                                        <Chip
                                          key={r.id || rI}
                                          size="small"
                                          label={`${r.achieved_data_column || "Col"}: Target ${r.standard_value ?? "—"}`}
                                          sx={{ height: 20, fontSize: "0.68rem" }}
                                        />
                                      ))}
                                    </Box>

                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                      <Chip
                                        size="small"
                                        label={metrics.statusLabel}
                                        sx={{
                                          bgcolor: metrics.statusColor,
                                          color: "#fff",
                                          fontWeight: 700,
                                        }}
                                      />
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setEditingComparisonIndex(-1)}
                                        sx={{ textTransform: "none", fontSize: "0.75rem", py: 0.2 }}
                                      >
                                        Done
                                      </Button>
                                    </Box>
                                  </Paper>
                                </Grid>
                              </Grid>
                            </CardContent>
                          );
                        })()}
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: VISUALIZATION & USER-CONFIGURABLE PERFORMANCE COLORS               */}
          {/* ========================================================================= */}
          {activeStep === 2 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Visualization & Presentation Settings
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Select how this KPI and its target-versus-achievement results should appear, and customize the compliance color palette.
                </Typography>
              </Box>

              {/* 1. Presentation Display Types */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                  Display Presentation Style
                </Typography>
                <Grid container spacing={2}>
                  {[
                    {
                      key: "CARD",
                      title: "KPI Performance Card",
                      desc: "Executive stat card with primary metric, unit, and compliance status pill.",
                      icon: <ViewModuleIcon />,
                    },
                    {
                      key: "COMPARISON",
                      title: "Target vs Actual",
                      desc: "Side-by-side comparison boxes showing target, actual, and gap variance.",
                      icon: <CompareArrowsIcon />,
                    },
                    {
                      key: "PROGRESS",
                      title: "Progress Tracker",
                      desc: "Horizontal progress bar showing percentage of target achieved.",
                      icon: <TrendingUpIcon />,
                    },
                    {
                      key: "VARIANCE",
                      title: "Variance / Gap Callout",
                      desc: "Emphasizes the delta (+ / -) relative to the target or limit.",
                      icon: <BarChartIcon />,
                    },
                    {
                      key: "STATUS",
                      title: "Status Health Indicator",
                      desc: "High-contrast compliance health chip and boundary warnings.",
                      icon: <TrafficIcon />,
                    },
                    {
                      key: "TABLE",
                      title: "Multi-Measure Table",
                      desc: "Tabular comparison comparing all configured target rules simultaneously.",
                      icon: <TableChartIcon />,
                    },
                  ].map((styleOpt) => {
                    const isSelected = visualizationStyle === styleOpt.key;
                    return (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={styleOpt.key}>
                        <Paper
                          variant="outlined"
                          onClick={() => setVisualizationStyle(styleOpt.key as KPIVisualizationStyle)}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            cursor: "pointer",
                            borderColor: isSelected ? "primary.main" : "divider",
                            bgcolor: isSelected ? "primary.50" : "background.paper",
                            boxShadow: isSelected ? "0 4px 12px rgba(2, 132, 199, 0.12)" : "none",
                            transition: "all 0.15s ease",
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                            height: "100%",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: isSelected ? "primary.main" : "text.secondary" }}>
                            {styleOpt.icon}
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary" }}>
                              {styleOpt.title}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.3 }}>
                            {styleOpt.desc}
                          </Typography>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>

              <Divider />

              {/* 2. User-Configurable Performance Colors */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Custom Performance Colors
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
                  Set custom display colors for each compliance state. These colors will be used when rendering this KPI throughout MAPAR.
                </Typography>

                <Grid container spacing={2}>
                  {[
                    { key: "meets_target", label: "Meets Target", defaultHex: "#10B981" },
                    { key: "below_target", label: "Below Target", defaultHex: "#EF4444" },
                    { key: "exceeded_limit", label: "Exceeded Limit", defaultHex: "#8B5CF6" },
                    { key: "warning", label: "Warning Threshold", defaultHex: "#F59E0B" },
                    { key: "critical", label: "Critical Breach", defaultHex: "#DC2626" },
                  ].map((colorItem) => {
                    const currentHex = performanceColors[colorItem.key as keyof KPIPerformanceColors] || colorItem.defaultHex;
                    return (
                      <Grid size={{ xs: 12, sm: 6, md: 2.4 }} key={colorItem.key}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.8 }}>
                            {colorItem.label}
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <input
                              type="color"
                              value={currentHex}
                              onChange={(e) =>
                                setPerformanceColors((prev) => ({
                                  ...prev,
                                  [colorItem.key]: e.target.value,
                                }))
                              }
                              style={{
                                width: 32,
                                height: 32,
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                                padding: 0,
                              }}
                            />
                            <Typography variant="caption" sx={{ fontWeight: 600, fontFamily: "monospace" }}>
                              {currentHex}
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>

              <Divider />

              {/* 3. Live Interactive Presentation Preview */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                  Live Presentation Preview ({visualizationStyle})
                </Typography>
                <Card variant="outlined" sx={{ borderRadius: 2, p: 2.5, bgcolor: "grey.50" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>
                    {code || "KPI_CODE"} • {hierarchyLevel}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                    {name || "KPI Display Name"}
                  </Typography>

                  {/* Render simulated presentation according to selected style */}
                  {visualizationStyle === "TABLE" ? (
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: "grey.100" }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Comparison</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Target</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Actual</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Gap</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {comparisons.map((c, i) => {
                            const m = calculateComparisonMetrics(c);
                            return (
                              <TableRow key={i}>
                                <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                                <TableCell>{c.target_value} {c.unit}</TableCell>
                                <TableCell>{c.actual_value} {c.unit}</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: m.statusColor }}>
                                  {m.gap !== null ? (m.gap > 0 ? `+${m.gap}` : m.gap) : "—"} {c.unit}
                                </TableCell>
                                <TableCell>
                                  <Chip size="small" label={m.statusLabel} sx={{ bgcolor: m.statusColor, color: "#fff", fontWeight: 700 }} />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : visualizationStyle === "COMPARISON" ? (
                    <Grid container spacing={2}>
                      {comparisons.map((c, i) => {
                        const m = calculateComparisonMetrics(c);
                        return (
                          <Grid size={{ xs: 12, sm: 6 }} key={i}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                {c.name}
                              </Typography>
                              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                                <Box>
                                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Target:</Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{c.target_value || "—"} {c.unit}</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Actual:</Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{c.actual_value || "—"} {c.unit}</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Variance:</Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 700, color: m.statusColor }}>
                                    {m.gap !== null ? (m.gap > 0 ? `+${m.gap}` : m.gap) : "—"}
                                  </Typography>
                                </Box>
                              </Box>
                              <Chip size="small" label={m.statusLabel} sx={{ bgcolor: m.statusColor, color: "#fff", fontWeight: 700 }} />
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>
                  ) : visualizationStyle === "PROGRESS" ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {comparisons.map((c, i) => {
                        const m = calculateComparisonMetrics(c);
                        const progressVal = Math.min(Math.max(m.achievementPct || 0, 0), 100);
                        return (
                          <Box key={i}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.name}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: m.statusColor }}>
                                {m.achievementPct !== null ? `${m.achievementPct}%` : "—"}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={progressVal}
                              sx={{
                                height: 8,
                                borderRadius: 4,
                                bgcolor: "grey.200",
                                "& .MuiLinearProgress-bar": { bgcolor: m.statusColor },
                              }}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                    /* Default: Performance Card */
                    <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
                      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                        <Typography variant="h3" sx={{ fontWeight: 800 }}>
                          {comparisons[0]?.actual_value || "0.00"}
                        </Typography>
                        <Typography variant="body1" sx={{ color: "text.secondary", fontWeight: 600 }}>
                          {comparisons[0]?.unit || "%"}
                        </Typography>
                      </Box>
                      {(() => {
                        const m0 = calculateComparisonMetrics(comparisons[0] || {});
                        return (
                          <Chip
                            label={`${m0.statusLabel} (Target: ${comparisons[0]?.target_value || "—"} ${comparisons[0]?.unit})`}
                            sx={{ bgcolor: m0.statusColor, color: "#fff", fontWeight: 700 }}
                          />
                        );
                      })()}
                    </Box>
                  )}
                </Card>
              </Box>
            </Box>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: REVIEW & SAVE                                                     */}
          {/* ========================================================================= */}
          {activeStep === 3 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Review KPI Configuration
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Verify your General Setup, Target vs Achievement comparisons, and Presentation settings before saving.
                </Typography>
              </Box>

              {/* General Setup Summary */}
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: "primary.main" }}>
                  1. General Setup
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>KPI Name:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{name}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>KPI Code:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{code}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Active Status:</Typography>
                    <Box sx={{ mt: 0.3 }}>
                      <Chip
                        size="small"
                        label={isActive ? "Active in Engine" : "Inactive"}
                        color={isActive ? "success" : "default"}
                        sx={{ fontWeight: 700, height: 22 }}
                      />
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Hierarchy Level:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{hierarchyLevel}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Assigned Node:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {hierarchyId
                        ? hierarchyNodes.find((n) => n.id === hierarchyId)?.name || `Node #${hierarchyId}`
                        : "Dynamic / All Nodes (Context-Aware)"}
                    </Typography>
                  </Grid>
                  {description && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>Description:</Typography>
                      <Typography variant="body2">{description}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>

              {/* Performance Comparisons Summary */}
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: "primary.main" }}>
                  2. Configured Target vs Achievement Comparisons ({comparisons.length})
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: "grey.100" }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Comparison</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Direction</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Standard Target</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Actual Data Source</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Aggregation / Mode</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status / Readiness</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {comparisons.map((c, i) => {
                        const m = calculateComparisonMetrics(c);
                        const isDataDriven = (c.data_source?.source_type || "UPLOAD") === "UPLOAD";
                        const hasMultipleRules = Boolean(c.rules && c.rules.length > 1);

                        return (
                          <React.Fragment key={i}>
                            <TableRow sx={{ bgcolor: hasMultipleRules ? "grey.50" : "inherit" }}>
                              <TableCell sx={{ fontWeight: 600 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                  {c.name}
                                  {hasMultipleRules && (
                                    <Chip
                                      size="small"
                                      label={`${c.rules?.length} Rules`}
                                      color="primary"
                                      variant="outlined"
                                      sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }}
                                    />
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell>
                                {!hasMultipleRules ? (
                                  <Chip
                                    size="small"
                                    label={
                                      c.performance_direction === "HIGHER_BETTER"
                                        ? "Higher is Better"
                                        : c.performance_direction === "LOWER_BETTER"
                                        ? "Lower is Better"
                                        : "Exact Target"
                                    }
                                    sx={{ height: 20, fontSize: "0.7rem" }}
                                  />
                                ) : (
                                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    See rule breakdown below
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>
                                {!hasMultipleRules
                                  ? (c.standard_value ?? c.target_value) !== ""
                                    ? `${c.standard_value ?? c.target_value} ${c.unit}`
                                    : "—"
                                  : "Multi-standard"}
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                                  <CloudUploadOutlinedIcon fontSize="small" color="primary" />
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {c.data_source?.dataset_name || "Uploaded Dataset"}
                                    </Typography>
                                    {!hasMultipleRules && (
                                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                        Column: <strong>{c.achieved_data_column || c.data_source?.metric_field || "Not selected"}</strong>
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                {isDataDriven ? (
                                  <Chip
                                    size="small"
                                    label={`${c.data_source?.aggregation || "AVG"} • ${c.data_source?.period_behavior || "MATCH_PERIOD"}`}
                                    color="info"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: "0.7rem", fontWeight: 600 }}
                                  />
                                ) : (
                                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    Static Manual Value
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={m.statusLabel}
                                  sx={{ bgcolor: m.statusColor, color: "#fff", fontWeight: 700 }}
                                />
                              </TableCell>
                            </TableRow>
                            {hasMultipleRules &&
                              c.rules?.map((rule, rIdx) => (
                                <TableRow key={`rule_${rIdx}`} sx={{ bgcolor: "background.paper", "& td": { py: 0.75 } }}>
                                  <TableCell sx={{ pl: 4, fontSize: "0.8rem", color: "text.secondary" }}>
                                    ↳ Rule #{rIdx + 1}
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      size="small"
                                      label={
                                        rule.performance_direction === "HIGHER_BETTER"
                                          ? "Higher is Better"
                                          : rule.performance_direction === "LOWER_BETTER"
                                          ? "Lower is Better"
                                          : "Exact Target"
                                      }
                                      variant="outlined"
                                      sx={{ height: 18, fontSize: "0.68rem" }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem" }}>
                                    {rule.standard_value ?? "—"} {c.unit}
                                  </TableCell>
                                  <TableCell colSpan={3}>
                                    <Typography variant="caption" sx={{ fontWeight: 600, color: "primary.main" }}>
                                      Column: [{rule.achieved_data_column || "Not selected"}]
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* Presentation Summary */}
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "primary.main" }}>
                  3. Presentation & Colors
                </Typography>
                <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Display Style:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{visualizationStyle}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Performance Colors:</Typography>
                    <Box sx={{ display: "flex", gap: 0.8, mt: 0.3 }}>
                      {Object.entries(performanceColors).map(([k, hex]) => (
                        <Tooltip key={k} title={`${k}: ${hex}`}>
                          <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: hex, border: "1px solid rgba(0,0,0,0.1)" }} />
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </Box>
          )}
        </DialogContent>

        {/* Sticky Footer Actions */}
        <DialogActions
          sx={{
            px: { xs: 2.5, md: 3.5 },
            py: 2,
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Button
            variant="outlined"
            onClick={activeStep === 0 ? onClose : handleBack}
            disabled={isSubmitting}
            sx={{ fontWeight: 600 }}
          >
            {activeStep === 0 ? "Cancel" : "Back"}
          </Button>

          <Box sx={{ display: "flex", gap: 1.5 }}>
            {activeStep < STEPS.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                sx={{ fontWeight: 600, minWidth: 100 }}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
                sx={{ fontWeight: 700, minWidth: 140 }}
              >
                {isSubmitting ? "Saving KPI..." : initialData ? "Update Master KPI" : "Save Master KPI"}
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Confirmation dialog for deleting a comparison */}
      <ConfirmDialog
        open={deleteConfirmIndex !== null}
        title="Remove Comparison"
        message={`Are you sure you want to remove comparison "${comparisons[deleteConfirmIndex ?? 0]?.name}"?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        confirmColor="error"
        onConfirm={handleRemoveComparison}
        onCancel={() => setDeleteConfirmIndex(null)}
      />
    </>
  );
};
