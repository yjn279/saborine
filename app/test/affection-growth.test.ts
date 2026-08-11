import { describe, expect, it } from "vitest";
import { buildAffectionGrowthNote } from "../src/affection/growth";
import type { SaborineGesture } from "../src/components/saborine/types";

const ALL_GESTURE_LISTS: SaborineGesture[][] = [
  [],
  ["facesPartner"],
  ["facesPartner", "callsName"],
  ["facesPartner", "callsName", "approaches"],
  ["facesPartner", "callsName", "approaches", "specialGesture"],
];

describe("なつき度が育っていることを表す1行(buildAffectionGrowthNote)", () => {
  it("何も解放していない状態でも文面が返る", () => {
    const note = buildAffectionGrowthNote([]);

    expect(note.length).toBeGreaterThan(0);
  });

  it("解放済みの仕草が増えると文面が変わる", () => {
    const notes = ALL_GESTURE_LISTS.map((gestures) => buildAffectionGrowthNote(gestures));

    expect(new Set(notes).size).toBe(notes.length);
  });

  it("最も新しく解放された仕草が、その時点の文面になる", () => {
    const noteAfterFacesPartner = buildAffectionGrowthNote(["facesPartner"]);
    const noteAfterCallsName = buildAffectionGrowthNote(["facesPartner", "callsName"]);

    expect(noteAfterCallsName).not.toBe(noteAfterFacesPartner);
    expect(noteAfterCallsName).toBe(buildAffectionGrowthNote(["callsName"]));
  });

  it("文面に数字(半角・全角とも)が一切含まれない", () => {
    for (const gestures of ALL_GESTURE_LISTS) {
      const note = buildAffectionGrowthNote(gestures);

      expect(note).not.toMatch(/[0-9０-９]/);
    }
  });
});
