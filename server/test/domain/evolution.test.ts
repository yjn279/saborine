import { describe, expect, it } from "vitest";
import { calcGrowthProgress, decideEvolution } from "../../src/domain/evolution.js";

describe("進化", () => {
  it("当月の成長ポイントが20未満なら進化せず、翌月へ持ち越す", () => {
    const result = decideEvolution({
      monthlyGrowthPoints: 19,
      harmonyRatio: 1,
      mutualThanksDays: 30,
      recordedDays: 30,
      daysInMonth: 30,
    });
    expect(result).toEqual({ evolves: false, lineage: null });
  });

  it("息ぴったり度が最大なら調和系になる", () => {
    const result = decideEvolution({
      monthlyGrowthPoints: 20,
      harmonyRatio: 0.9,
      mutualThanksDays: 3,
      recordedDays: 10,
      daysInMonth: 30,
    });
    expect(result).toEqual({ evolves: true, lineage: "harmony" });
  });

  it("感謝が往復した日数の割合が最大なら花さき系になる", () => {
    const result = decideEvolution({
      monthlyGrowthPoints: 20,
      harmonyRatio: 0.1,
      mutualThanksDays: 27,
      recordedDays: 10,
      daysInMonth: 30,
    });
    expect(result).toEqual({ evolves: true, lineage: "blossom" });
  });

  it("どちらかが記録した日数の割合が最大ならこつこつ系になる", () => {
    const result = decideEvolution({
      monthlyGrowthPoints: 20,
      harmonyRatio: 0.1,
      mutualThanksDays: 3,
      recordedDays: 27,
      daysInMonth: 30,
    });
    expect(result).toEqual({ evolves: true, lineage: "steady" });
  });

  it("同点のときは調和系になる", () => {
    const result = decideEvolution({
      monthlyGrowthPoints: 20,
      harmonyRatio: 0.6,
      mutualThanksDays: 18,
      recordedDays: 18,
      daysInMonth: 30,
    });
    expect(result).toEqual({ evolves: true, lineage: "harmony" });
  });
});

describe("いまの育ち具合", () => {
  it("ポイント0で割合が0になる", () => {
    expect(calcGrowthProgress(0)).toBe(0);
  });

  it("ポイント10で割合が0.5になる", () => {
    expect(calcGrowthProgress(10)).toBe(0.5);
  });

  it("ポイント20で割合が1になる", () => {
    expect(calcGrowthProgress(20)).toBe(1);
  });

  it("しきい値を超えたポイント40でも割合が1を超えない", () => {
    expect(calcGrowthProgress(40)).toBe(1);
  });

  it("ポイントが負のとき(防御)でも割合が0未満にならない", () => {
    expect(calcGrowthProgress(-5)).toBe(0);
  });
});
