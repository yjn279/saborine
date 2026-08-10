import { describe, expect, it } from "vitest";
import { isSloppyMode } from "../../src/domain/mood.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("だらしなモード", () => {
  it("記録が2日途切れただけでは、だらしなモードにならない", () => {
    const now = new Date("2024-01-10T00:00:00Z");
    const twoDaysAgo = new Date(now.getTime() - 2 * DAY_MS);
    expect(isSloppyMode(twoDaysAgo, twoDaysAgo, now)).toBe(false);
  });

  it("ふたりとも記録が3日途切れると、だらしなモードになる", () => {
    const now = new Date("2024-01-10T00:00:00Z");
    const threeDaysAgo = new Date(now.getTime() - 3 * DAY_MS);
    expect(isSloppyMode(threeDaysAgo, threeDaysAgo, now)).toBe(true);
  });

  it("片方だけが3日途切れていても、だらしなモードにならない", () => {
    const now = new Date("2024-01-10T00:00:00Z");
    const threeDaysAgo = new Date(now.getTime() - 3 * DAY_MS);
    expect(isSloppyMode(threeDaysAgo, now, now)).toBe(false);
  });

  it("だらしなモード中にどちらか1回記録すると、同じ判定で即座に戻る", () => {
    const now = new Date("2024-01-10T00:00:00Z");
    const longAgo = new Date(now.getTime() - 10 * DAY_MS);
    expect(isSloppyMode(longAgo, longAgo, now)).toBe(true);

    const justRecorded = now;
    expect(isSloppyMode(justRecorded, longAgo, now)).toBe(false);
  });

  it("一度も記録が無い相手は、常に途切れている側として扱う", () => {
    const now = new Date("2024-01-10T00:00:00Z");
    expect(isSloppyMode(null, null, now)).toBe(true);
    expect(isSloppyMode(now, null, now)).toBe(false);
  });
});
