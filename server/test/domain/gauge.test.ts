import { describe, expect, it } from "vitest";
import { calcBalanceGauge } from "../../src/domain/gauge.js";

describe("息ぴったりゲージ", () => {
  it("0〜1の割合を返す", () => {
    expect(calcBalanceGauge(5, 10)).toBe(0.5);
    expect(calcBalanceGauge(10, 10)).toBe(1);
    expect(calcBalanceGauge(0, 10)).toBe(0);
  });

  it("回数そのものを含む値を返さない(0〜1の範囲を超えない)", () => {
    const result = calcBalanceGauge(3, 12);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
    expect(result).not.toBe(3);
    expect(result).not.toBe(12);
  });

  it("どちらも記録が無いときは満点(1)を返す", () => {
    expect(calcBalanceGauge(0, 0)).toBe(1);
  });
});
