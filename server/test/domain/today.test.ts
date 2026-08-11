import { describe, expect, it } from "vitest";
import { selectTodayEvents, type ChoreLogRecord } from "../../src/domain/today.js";

const ME = "user-me";
const PARTNER = "user-partner";

// 2023-06-15はJSTで日付が変わる境目を作りやすい。0:00 JST = 前日15:00 UTC。
const TODAY_00_01_JST = new Date("2023-06-14T15:01:00.000Z");
const YESTERDAY_23_59_JST = new Date("2023-06-14T14:59:00.000Z");
const NOW = new Date("2023-06-15T09:00:00.000Z"); // 18:00 JST

function record(overrides: Partial<ChoreLogRecord>): ChoreLogRecord {
  return {
    id: "log-1",
    userId: ME,
    choreType: "洗い物",
    createdAt: NOW,
    thanked: false,
    ...overrides,
  };
}

describe("きょうのできごとを選ぶ", () => {
  it("日本時間の前日23:59の記録は含まれない", () => {
    const result = selectTodayEvents([record({ id: "yesterday", createdAt: YESTERDAY_23_59_JST })], ME, NOW);
    expect(result).toEqual([]);
  });

  it("日本時間の当日0:01の記録は含まれる", () => {
    const result = selectTodayEvents([record({ id: "today-early", createdAt: TODAY_00_01_JST })], ME, NOW);
    expect(result.map((event) => event.id)).toEqual(["today-early"]);
  });

  it("新しい順(いちばん新しい記録が先頭)に並ぶ", () => {
    const older = record({ id: "older", createdAt: new Date("2023-06-15T08:00:00.000Z") });
    const newer = record({ id: "newer", createdAt: new Date("2023-06-15T08:30:00.000Z") });
    const result = selectTodayEvents([older, newer], ME, NOW);
    expect(result.map((event) => event.id)).toEqual(["newer", "older"]);
  });

  it("自分の記録と相手の記録の両方が、区別できる形(mine)で含まれる", () => {
    const mine = record({ id: "mine", userId: ME });
    const partners = record({ id: "partners", userId: PARTNER });
    const result = selectTodayEvents([mine, partners], ME, NOW);
    expect(result.find((event) => event.id === "mine")?.mine).toBe(true);
    expect(result.find((event) => event.id === "partners")?.mine).toBe(false);
  });

  it("7件以上あるときは、新しい順に6件だけを返す", () => {
    const records = Array.from({ length: 8 }, (_, index) =>
      record({ id: `log-${index}`, createdAt: new Date(NOW.getTime() + index * 1000) }),
    );
    const result = selectTodayEvents(records, ME, NOW);
    expect(result).toHaveLength(6);
    expect(result.map((event) => event.id)).toEqual(["log-7", "log-6", "log-5", "log-4", "log-3", "log-2"]);
  });

  it("返す1件はid・choreType・mine・thankedの4項目だけを持つ", () => {
    const result = selectTodayEvents([record({ id: "log-1", choreType: "洗い物", thanked: true })], ME, NOW);
    expect(result).toEqual([{ id: "log-1", choreType: "洗い物", mine: true, thanked: true }]);
  });
});
