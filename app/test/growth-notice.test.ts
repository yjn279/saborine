import { describe, expect, it } from "vitest";
import { buildGrowthNoticeMessage, decideGrowthNotice } from "../src/saborine/growthNotice";

describe("育ち具合の知らせを出すべきかの判断(decideGrowthNotice)", () => {
  it("前に見た値より上がっていれば、知らせる", () => {
    const decision = decideGrowthNotice({ current: 0.6, previouslySeen: 0.4 });

    expect(decision).toBe(true);
  });

  it("前に見た値と同じときは、知らせない", () => {
    const decision = decideGrowthNotice({ current: 0.4, previouslySeen: 0.4 });

    expect(decision).toBe(false);
  });

  it("前に見た値より下がっているときは、知らせない", () => {
    const decision = decideGrowthNotice({ current: 0.2, previouslySeen: 0.4 });

    expect(decision).toBe(false);
  });

  it("前に見た記録が端末に無いときは、知らせない", () => {
    const decision = decideGrowthNotice({ current: 0.4, previouslySeen: null });

    expect(decision).toBe(false);
  });
});

describe("知らせの文面(buildGrowthNoticeMessage)", () => {
  it("誰の働きにも帰属させず、数字も割合を示す語も含まない", () => {
    const message = buildGrowthNoticeMessage();

    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toMatch(/[0-9０-９]/);
    expect(message).not.toMatch(/[%割]/);
    expect(message).not.toContain("あと");
    expect(message).not.toContain("残り");
  });
});
