import { describe, expect, it } from "vitest";
import { NUDGE_LINES, pickLine } from "../../src/domain/lines.js";

const PAIR_A = "pair-a";
const PAIR_B = "pair-b";

// 2024-01-10 12:00 JST = 2024-01-10T03:00:00Z
const DAY_1_NOON_JST = new Date("2024-01-10T03:00:00.000Z");
const DAY_1_23_59_59_JST = new Date("2024-01-10T14:59:59.999Z");
const DAY_2_00_00_00_JST = new Date("2024-01-10T15:00:00.000Z");

function nudgeContext(pairId: string, now: Date) {
  return {
    isSloppy: false,
    hasUnthankedPartnerChore: false,
    hasRecordedRecently: false,
    pairId,
    now,
  };
}

describe("促しのセリフ", () => {
  it("5案が一覧として取り出せる", () => {
    expect(NUDGE_LINES).toEqual([
      "ゴミ出しでも ごはんになるんだって。",
      "きみの 1かいは、いま いちばん えいようが あるんだって。",
      "コップ ひとつ あらうのも、りっぱな ごはんに なるらしいよ。",
      "きょうは なにして あそぼっか。あ、そうじも たのしいって きいたよ。",
      "ふたりぶん そろうと、ごはんが 3ばい おいしいんだって。",
    ]);
  });

  it("だらしな・ありがとう待ち・ふだんの文面は変わっていない", () => {
    expect(
      pickLine({
        isSloppy: true,
        hasUnthankedPartnerChore: false,
        hasRecordedRecently: false,
        pairId: PAIR_A,
        now: DAY_1_NOON_JST,
      }),
    ).toEqual({ kind: "sloppy", text: "きょうは のんびり きぶんなんだ。ねぐせも なおしてないや。" });

    expect(
      pickLine({
        isSloppy: false,
        hasUnthankedPartnerChore: true,
        hasRecordedRecently: false,
        pairId: PAIR_A,
        now: DAY_1_NOON_JST,
      }),
    ).toEqual({ kind: "thanksWaiting", text: "なんだか うれしいことが あったみたい。" });

    expect(
      pickLine({
        isSloppy: false,
        hasUnthankedPartnerChore: false,
        hasRecordedRecently: true,
        pairId: PAIR_A,
        now: DAY_1_NOON_JST,
      }),
    ).toEqual({ kind: "default", text: "きょうも いっしょに いられて うれしいな。" });
  });

  it("kindはnudgeで、同じペア・同じ日本時間の日なら何度呼んでも同じ文面になる", () => {
    const first = pickLine(nudgeContext(PAIR_A, DAY_1_NOON_JST));
    const second = pickLine(nudgeContext(PAIR_A, DAY_1_23_59_59_JST));
    expect(first.kind).toBe("nudge");
    expect(NUDGE_LINES).toContain(first.text);
    expect(second).toEqual(first);
  });

  it("日本時間の午前0時ちょうどをまたぐと文面が変わる", () => {
    const beforeMidnight = pickLine(nudgeContext(PAIR_A, DAY_1_23_59_59_JST));
    const afterMidnight = pickLine(nudgeContext(PAIR_A, DAY_2_00_00_00_JST));
    expect(afterMidnight.text).not.toBe(beforeMidnight.text);
  });

  it("5日連続で呼ぶと5つの文面がすべて1回ずつ現れる", () => {
    const texts = Array.from({ length: 5 }, (_, i) =>
      pickLine(nudgeContext(PAIR_A, new Date(DAY_1_NOON_JST.getTime() + i * 24 * 60 * 60 * 1000))).text,
    );
    expect(new Set(texts).size).toBe(5);
    expect([...texts].sort()).toEqual([...NUDGE_LINES].sort());
  });

  it("同じ日でもペアが違えば、少なくとも1組は違う文面になる", () => {
    const days = Array.from({ length: 5 }, (_, i) => new Date(DAY_1_NOON_JST.getTime() + i * 24 * 60 * 60 * 1000));
    const differsSomewhere = days.some(
      (day) => pickLine(nudgeContext(PAIR_A, day)).text !== pickLine(nudgeContext(PAIR_B, day)).text,
    );
    expect(differsSomewhere).toBe(true);
  });
});
