import { describe, expect, it } from "vitest";
import { incrementAffection, unlockedGestures } from "../../src/domain/affection.js";

describe("なつき度", () => {
  it("記録またはありがとう1回ごとに+1される", () => {
    expect(incrementAffection(0)).toBe(1);
    expect(incrementAffection(41)).toBe(42);
  });

  it("何をしても減らない(増やす操作しか存在しない)", () => {
    let value = 0;
    for (let i = 0; i < 10; i += 1) {
      const next = incrementAffection(value);
      expect(next).toBeGreaterThan(value);
      value = next;
    }
  });

  it.each([
    [4, []],
    [5, ["facesPartner"]],
    [19, ["facesPartner"]],
    [20, ["facesPartner", "callsName"]],
    [49, ["facesPartner", "callsName"]],
    [50, ["facesPartner", "callsName", "approaches"]],
    [99, ["facesPartner", "callsName", "approaches"]],
    [100, ["facesPartner", "callsName", "approaches", "specialGesture"]],
  ])("累計%iで解放済みの仕草は%j", (value, expected) => {
    expect(unlockedGestures(value)).toEqual(expected);
  });
});
