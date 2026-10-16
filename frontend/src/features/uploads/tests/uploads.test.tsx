import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTemplateBuilder } from "../hooks/useTemplateBuilder";

describe("Uploads Module - Template Builder Unit Tests", () => {
  it("initializes with default circle_code reference column", () => {
    const { result } = renderHook(() => useTemplateBuilder());

    expect(result.current.columns.length).toBe(1);
    expect(result.current.columns[0].name).toBe("circle_code");
    expect(result.current.columns[0].data_type).toBe("REFERENCE");
    expect(result.current.columns[0].is_required).toBe(true);
  });

  it("adds, updates, reorders, and removes columns dynamically", () => {
    const { result } = renderHook(() => useTemplateBuilder());

    // 1. Add column
    act(() => {
      result.current.addColumn();
    });
    expect(result.current.columns.length).toBe(2);

    // 2. Update column
    act(() => {
      result.current.updateColumn(1, {
        name: "actual_kwh",
        display_label: "Actual kWh Output",
        data_type: "DECIMAL",
        is_required: true,
      });
    });
    expect(result.current.columns[1].name).toBe("actual_kwh");
    expect(result.current.columns[1].data_type).toBe("DECIMAL");

    // 3. Move up/down
    act(() => {
      result.current.moveColumnUp(1);
    });
    expect(result.current.columns[0].name).toBe("actual_kwh");
    expect(result.current.columns[1].name).toBe("circle_code");

    // 4. Remove column
    act(() => {
      result.current.removeColumn(1);
    });
    expect(result.current.columns.length).toBe(1);
    expect(result.current.columns[0].name).toBe("actual_kwh");
  });

  it("detects validation error on missing template name", () => {
    const { result } = renderHook(() => useTemplateBuilder());
    expect(result.current.validationError).toBe("Template Name is required.");

    act(() => {
      result.current.setName("Monthly Plant Generation");
    });
    expect(result.current.validationError).toBeNull();
  });

  it("detects validation error on duplicate column headers", () => {
    const { result } = renderHook(() => useTemplateBuilder());
    act(() => {
      result.current.setName("Plant Generation");
      result.current.addColumn();
      result.current.updateColumn(0, { display_label: "Metric Target" });
      result.current.updateColumn(1, { display_label: "Metric Target" });
    });

    expect(result.current.validationError).toContain("Duplicate column label detected");
  });

  it("generates correct CreateTemplatePayload adhering to API specification", () => {
    const { result } = renderHook(() => useTemplateBuilder());
    act(() => {
      result.current.setName("Solar Output Ingestion");
      result.current.setCode("SOLAR_INGEST");
      result.current.setDataLevel("CIRCLE");
      result.current.setDescription("Monthly generation actuals");
    });

    const payload = result.current.getPayload();
    expect(payload.name).toBe("Solar Output Ingestion");
    expect(payload.code).toBe("SOLAR_INGEST");
    expect(payload.data_level).toBe("CIRCLE");
    expect(payload.columns.length).toBe(1);
    expect(payload.columns[0].column_order).toBe(0);
  });
});
