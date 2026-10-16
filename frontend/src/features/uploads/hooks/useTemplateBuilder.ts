/**
 * Stateful Hook for Dynamic Template & Column Builder.
 * Manages user-configured schema, column ordering, field metadata, and live preview.
 */

import { useState, useCallback, useMemo } from "react";
import { UploadTemplateColumn, ColumnDataType, CreateTemplatePayload } from "../types/uploads.types";

export interface TemplateBuilderState {
  name: string;
  code: string;
  description: string;
  data_level: string;
  target_entity: string;
  columns: UploadTemplateColumn[];
}

export function useTemplateBuilder(initialData?: Partial<TemplateBuilderState>) {
  const [name, setName] = useState<string>(initialData?.name || "");
  const [code, setCode] = useState<string>(initialData?.code || "");
  const [description, setDescription] = useState<string>(initialData?.description || "");
  const [dataLevel, setDataLevel] = useState<string>(initialData?.data_level || "CIRCLE");
  const [targetEntity, setTargetEntity] = useState<string>(initialData?.target_entity || "KPI_VALUES");

  const [columns, setColumns] = useState<UploadTemplateColumn[]>(
    initialData?.columns || [
      {
        name: "circle_code",
        display_label: "Circle Code",
        data_type: "REFERENCE",
        is_required: true,
        is_unique: false,
        column_order: 0,
        default_value: "",
        description: "MAPAR operational circle reference code",
        validation_rules: { reference_level: "CIRCLE" },
      },
    ]
  );

  const addColumn = useCallback(() => {
    setColumns((prev) => {
      const nextIndex = prev.length;
      const newCol: UploadTemplateColumn = {
        name: `column_${nextIndex + 1}`,
        display_label: `New Field ${nextIndex + 1}`,
        data_type: "TEXT",
        is_required: false,
        is_unique: false,
        column_order: nextIndex,
        default_value: "",
        description: "",
        validation_rules: {},
      };
      return [...prev, newCol];
    });
  }, []);

  const updateColumn = useCallback(
    (index: number, updates: Partial<UploadTemplateColumn>) => {
      setColumns((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...updates };
        return next;
      });
    },
    []
  );

  const removeColumn = useCallback((index: number) => {
    setColumns((prev) => {
      if (prev.length <= 1) return prev; // Keep at least one column
      const next = prev.filter((_, i) => i !== index);
      // Re-index column_order
      return next.map((col, idx) => ({ ...col, column_order: idx }));
    });
  }, []);

  const moveColumnUp = useCallback((index: number) => {
    if (index === 0) return;
    setColumns((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next.map((col, idx) => ({ ...col, column_order: idx }));
    });
  }, []);

  const moveColumnDown = useCallback((index: number) => {
    setColumns((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next.map((col, idx) => ({ ...col, column_order: idx }));
    });
  }, []);

  // Validation
  const validationError = useMemo(() => {
    if (!name.trim()) return "Template Name is required.";
    if (columns.length === 0) return "At least one column is required.";
    const seen = new Set<string>();
    for (const col of columns) {
      const label = col.display_label.trim().toLowerCase();
      if (!label && col.display_label !== "@") {
        return "All columns must have a display label.";
      }
      if (label && label !== "contact" && label !== "@") {
        if (seen.has(label)) {
          return `Duplicate column label detected: "${col.display_label}". Column names must be unique.`;
        }
        seen.add(label);
      }
    }
    return null;
  }, [name, columns]);

  // Payload generator
  const getPayload = useCallback((): CreateTemplatePayload => {
    return {
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim(),
      data_level: dataLevel,
      target_entity: targetEntity,
      columns: columns.map((col, idx) => ({
        name: col.name?.trim() || `col_${idx + 1}`,
        display_label: col.display_label,
        data_type: col.data_type,
        is_required: col.is_required,
        is_unique: col.is_unique,
        column_order: idx,
        default_value: col.default_value?.trim(),
        description: col.description?.trim(),
        validation_rules: col.validation_rules || {},
      })),
    };
  }, [name, code, description, dataLevel, targetEntity, columns]);

  return {
    name,
    setName,
    code,
    setCode,
    description,
    setDescription,
    dataLevel,
    setDataLevel,
    targetEntity,
    setTargetEntity,
    columns,
    setColumns,
    addColumn,
    updateColumn,
    removeColumn,
    moveColumnUp,
    moveColumnDown,
    validationError,
    getPayload,
  };
}
