import { describe, expect, it } from "vitest";
import { calcGrowthPoints } from "../../src/domain/growth.js";

describe("成長ポイント", () => {
  it("片方だけ10個で10ポイントになる", () => {
    expect(calcGrowthPoints(10, 0)).toBe(10);
  });

  it("5個ずつで20ポイントになる", () => {
    expect(calcGrowthPoints(5, 5)).toBe(20);
  });

  it("記録が無ければ0ポイントになる", () => {
    expect(calcGrowthPoints(0, 0)).toBe(0);
  });
});
