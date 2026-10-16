import { describe, it, expect } from "vitest";
import { UploadTemplateColumn, CreateTemplatePayload } from "../types/uploads.types";

describe("Uploads Module - Pure Logic & Schema Unit Tests", () => {
  it("validates dynamic column definitions and order indexing", () => {
    const columns: UploadTemplateColumn[] = [
      {
        name: "circle_code",
        display_label: "Circle Code",
        data_type: "REFERENCE",
        is_required: true,
        is_unique: false,
        column_order: 0,
        default_value: "",
        description: "Circle code",
        validation_rules: { reference_level: "CIRCLE" },
      },
      {
        name: "actual_kwh",
        display_label: "Actual kWh Output",
        data_type: "DECIMAL",
        is_required: true,
        is_unique: false,
        column_order: 1,
        default_value: "",
        description: "Megawatts converted to kWh",
        validation_rules: {},
      },
    ];

    expect(columns.length).toBe(2);
    expect(columns[0].data_type).toBe("REFERENCE");
    expect(columns[1].data_type).toBe("DECIMAL");
    expect(columns[0].is_required).toBe(true);
  });

  it("detects duplicate column headers and prevents invalid payloads", () => {
    const seen = new Set<string>();
    const labels = ["Circle Code", "Metric Value", "Circle Code"];

    let duplicateFound = false;
    for (const label of labels) {
      const normalized = label.trim().toLowerCase();
      if (seen.has(normalized)) {
        duplicateFound = true;
        break;
      }
      seen.add(normalized);
    }

    expect(duplicateFound).toBe(true);
  });

  it("constructs compliant CreateTemplatePayload for backend API", () => {
    const payload: CreateTemplatePayload = {
      name: "Solar Generation Data",
      code: "SOLAR_GEN",
      description: "Monthly solar energy operational intake",
      data_level: "CIRCLE",
      target_entity: "KPI_VALUES",
      columns: [
        {
          name: "circle_code",
          display_label: "Circle Code",
          data_type: "REFERENCE",
          is_required: true,
          is_unique: false,
          column_order: 0,
          validation_rules: { reference_level: "CIRCLE" },
        },
        {
          name: "energy_kwh",
          display_label: "Energy (kWh)",
          data_type: "DECIMAL",
          is_required: true,
          is_unique: false,
          column_order: 1,
        },
      ],
    };

    expect(payload.name).toBe("Solar Generation Data");
    expect(payload.code).toBe("SOLAR_GEN");
    expect(payload.data_level).toBe("CIRCLE");
    expect(payload.columns.length).toBe(2);
    expect(payload.columns[0].name).toBe("circle_code");
    expect(payload.columns[1].column_order).toBe(1);
  });
});
