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

  it("自分が6件以上記録していても、相手の記録は上限に押し出されない", () => {
    const mine = Array.from({ length: 6 }, (_, index) =>
      record({ id: `mine-${index}`, userId: ME, createdAt: new Date(NOW.getTime() + (index + 1) * 1000) }),
    );
    const partners = record({ id: "partners", userId: PARTNER, createdAt: NOW });
    const result = selectTodayEvents([...mine, partners], ME, NOW);
    expect(result.map((event) => event.id)).toContain("partners");
  });

  function recordsOf(userId: string, count: number, idPrefix: string) {
    return Array.from({ length: count }, (_, index) =>
      record({ id: `${idPrefix}-${index}`, userId, createdAt: new Date(NOW.getTime() + index * 1000) }),
    );
  }

  it("相手が6件・自分が6件の日は、相手3件・自分3件の計6件が返る", () => {
    const records = [...recordsOf(PARTNER, 6, "partner"), ...recordsOf(ME, 6, "mine")];
    const result = selectTodayEvents(records, ME, NOW);
    expect(result.filter((event) => !event.mine)).toHaveLength(3);
    expect(result.filter((event) => event.mine)).toHaveLength(3);
    expect(result).toHaveLength(6);
  });

  it("自分が6件・相手が1件の日は、相手の1件を含む計6件が返る", () => {
    const records = [...recordsOf(PARTNER, 1, "partner"), ...recordsOf(ME, 6, "mine")];
    const result = selectTodayEvents(records, ME, NOW);
    expect(result.filter((event) => !event.mine)).toHaveLength(1);
    expect(result.filter((event) => event.mine)).toHaveLength(5);
    expect(result).toHaveLength(6);
  });

  it("相手が5件・自分が0件の日は、相手の5件がすべて返る", () => {
    const records = recordsOf(PARTNER, 5, "partner");
    const result = selectTodayEvents(records, ME, NOW);
    expect(result).toHaveLength(5);
  });

  it("相手が8件・自分が2件の日は、相手4件・自分2件の計6件が返る", () => {
    const records = [...recordsOf(PARTNER, 8, "partner"), ...recordsOf(ME, 2, "mine")];
    const result = selectTodayEvents(records, ME, NOW);
    expect(result.filter((event) => !event.mine)).toHaveLength(4);
    expect(result.filter((event) => event.mine)).toHaveLength(2);
    expect(result).toHaveLength(6);
  });

  it("枠が絞られても、返る並びは全体を通して新しい順のままである", () => {
    const records = [...recordsOf(PARTNER, 8, "partner"), ...recordsOf(ME, 2, "mine")];
    const result = selectTodayEvents(records, ME, NOW);
    const timestamps = result.map((event) => records.find((record) => record.id === event.id)!.createdAt.getTime());
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
    // 各側の中でも新しいものが残る: partnerは末尾4件(4-7)、mineは末尾2件(0-1)が残る。
    expect(result.map((event) => event.id)).toEqual(
      expect.arrayContaining(["partner-4", "partner-5", "partner-6", "partner-7", "mine-0", "mine-1"]),
    );
  });

  it("返す1件はid・choreType・mine・thankedの4項目だけを持つ", () => {
    const result = selectTodayEvents([record({ id: "log-1", choreType: "洗い物", thanked: true })], ME, NOW);
    expect(result).toEqual([{ id: "log-1", choreType: "洗い物", mine: true, thanked: true }]);
  });
});
