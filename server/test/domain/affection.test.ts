import { describe, expect, it } from "vitest";
import { unlockedGestures } from "../../src/domain/affection.js";

describe("なつき度", () => {
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
