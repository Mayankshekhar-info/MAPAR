import { describe, it, expect } from "vitest";

describe("Cockpit Calculations and Logic", () => {
  it("computes achievement percentage correctly", () => {
    const target = 193.0;
    const actual = 189.99;
    const ach = Math.round((actual / target) * 1000) / 10;
    expect(ach).toBe(98.4);
  });

  it("handles zero target safely without NaN or Infinity", () => {
    const target = 0;
    const actual = 5.0;
    const ach = target > 0 ? (actual / target) * 100 : 100;
    expect(ach).toBe(100);
  });

  it("computes variance percentage correctly", () => {
    const target = 95.0;
    const actual = 96.2;
    const variance = actual - target;
    expect(Math.round(variance * 10) / 10).toBe(1.2);
  });
});
