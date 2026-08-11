import { describe, expect, it } from "vitest";
import { decideInvitePrompt, type InvitePromptStage } from "../src/invite/prompt";

const HOUR_MS = 60 * 60 * 1000;

describe("手紙を自動で出すかどうかの判断(decideInvitePrompt)", () => {
  it("ペアが成立しておらず、初めての記録を終えた直後は、1回目として出す", () => {
    const firstRecordedAt = new Date("2026-01-01T00:00:00Z");
    const decision = decideInvitePrompt({
      isPaired: false,
      firstRecordedAt,
      stage: "none",
      now: firstRecordedAt,
    });

    expect(decision).toBe("first");
  });

  it("ペアが成立していれば、初めての記録を終えた直後でも出さない", () => {
    const firstRecordedAt = new Date("2026-01-01T00:00:00Z");
    const decision = decideInvitePrompt({
      isPaired: true,
      firstRecordedAt,
      stage: "none",
      now: firstRecordedAt,
    });

    expect(decision).toBe("none");
  });

  it("初めての記録の日時が無ければ、ペアが成立していなくても出さない", () => {
    const decision = decideInvitePrompt({
      isPaired: false,
      firstRecordedAt: null,
      stage: "none",
      now: new Date("2026-01-01T00:00:00Z"),
    });

    expect(decision).toBe("none");
  });

  it("1回目まで済んでいて72時間が過ぎていなければ出さない", () => {
    const firstRecordedAt = new Date("2026-01-01T00:00:00Z");
    const decision = decideInvitePrompt({
      isPaired: false,
      firstRecordedAt,
      stage: "first",
      now: new Date(firstRecordedAt.getTime() + 71 * HOUR_MS),
    });

    expect(decision).toBe("none");
  });

  it("1回目まで済んでいて72時間以上が過ぎていれば2回目として出す", () => {
    const firstRecordedAt = new Date("2026-01-01T00:00:00Z");
    const decision = decideInvitePrompt({
      isPaired: false,
      firstRecordedAt,
      stage: "first",
      now: new Date(firstRecordedAt.getTime() + 72 * HOUR_MS),
    });

    expect(decision).toBe("second");
  });

  it("2回目まで済んでいれば、どれだけ時間が過ぎても出さない", () => {
    const firstRecordedAt = new Date("2026-01-01T00:00:00Z");
    const decision = decideInvitePrompt({
      isPaired: false,
      firstRecordedAt,
      stage: "second",
      now: new Date(firstRecordedAt.getTime() + 1000 * HOUR_MS),
    });

    expect(decision).toBe("none");
  });

  it("記録の直後から時間を進めながら段階を反映し続けても、出す回数の合計は2を超えない", () => {
    const firstRecordedAt = new Date("2026-01-01T00:00:00Z");
    let stage: InvitePromptStage = "none";
    let promptedCount = 0;
    let sawSecond = false;

    for (let hour = 0; hour <= 200; hour += 1) {
      const decision = decideInvitePrompt({
        isPaired: false,
        firstRecordedAt,
        stage,
        now: new Date(firstRecordedAt.getTime() + hour * HOUR_MS),
      });

      if (decision !== "none") {
        promptedCount += 1;
        stage = decision;
      }
      if (decision === "second") {
        sawSecond = true;
      }
    }

    expect(promptedCount).toBe(2);
    expect(sawSecond).toBe(true);
  });
});
