import { describe, expect, it } from "vitest";
import { decideEvolution } from "../../src/domain/evolution.js";

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
