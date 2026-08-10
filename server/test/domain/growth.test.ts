import { describe, expect, it } from "vitest";
import { calcGrowthPoints, sumWeeklyGrowthPoints } from "../../src/domain/growth.js";

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

describe("複数週にまたがる成長ポイントの合算", () => {
  it("週ごとの成長ポイントを単純に積み上げる(置き換えない)", () => {
    // 1週目: 5個ずつ→20点。2週目: 片方だけ3個→3点。合計23点。
    const total = sumWeeklyGrowthPoints([
      { a: 5, b: 5 },
      { a: 3, b: 0 },
    ]);
    expect(total).toBe(23);
  });

  it("週が1つも無ければ0点", () => {
    expect(sumWeeklyGrowthPoints([])).toBe(0);
  });
});
