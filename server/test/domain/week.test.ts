import { describe, expect, it } from "vitest";
import {
  getMonthRange,
  getPreviousMonthRange,
  getWeekRange,
  getWeekStart,
  isFirstDayOfMonthJst,
  jstCalendarDay,
} from "../../src/domain/week.js";

// 2023-01-01はJSTで日曜日。21:00 JST = 12:00 UTC(同日)。
const SUNDAY_21_00_JST = new Date("2023-01-01T12:00:00.000Z");
const SUNDAY_20_59_59_JST = new Date("2023-01-01T11:59:59.999Z");
const PREVIOUS_WEEK_START = new Date("2022-12-25T12:00:00.000Z");

describe("週の区切り", () => {
  it("日曜21時00分は新しい週の始まりになる", () => {
    expect(getWeekStart(SUNDAY_21_00_JST)).toEqual(SUNDAY_21_00_JST);
  });

  it("日曜20時59分は前の週に属する", () => {
    expect(getWeekStart(SUNDAY_20_59_59_JST)).toEqual(PREVIOUS_WEEK_START);
  });

  it("日曜20時59分と21時00分は別の週に入る", () => {
    expect(getWeekStart(SUNDAY_20_59_59_JST)).not.toEqual(getWeekStart(SUNDAY_21_00_JST));
  });

  it("週の途中の時刻も、同じ週の始まりに揃う", () => {
    const wednesday = new Date("2023-01-04T05:00:00.000Z");
    expect(getWeekStart(wednesday)).toEqual(SUNDAY_21_00_JST);
  });

  it("週の範囲は7日ちょうどで、始まりを含み終わりを含まない", () => {
    const range = getWeekRange(SUNDAY_21_00_JST);
    expect(range.start).toEqual(SUNDAY_21_00_JST);
    expect(range.end.getTime() - range.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("月の区切り", () => {
  it("日本時間の暦月(1日0:00〜翌月1日0:00)で区切られる", () => {
    // 2024-01-15 12:00 JST = 2024-01-15T03:00:00Z
    const midMonth = new Date("2024-01-15T03:00:00.000Z");
    const range = getMonthRange(midMonth);
    expect(range.start).toEqual(new Date("2023-12-31T15:00:00.000Z")); // 2024-01-01 00:00 JST
    expect(range.end).toEqual(new Date("2024-01-31T15:00:00.000Z")); // 2024-02-01 00:00 JST
    expect(range.daysInMonth).toBe(31);
  });

  it("うるう年の2月は29日になる", () => {
    const inFebruary = new Date("2024-02-10T03:00:00.000Z");
    expect(getMonthRange(inFebruary).daysInMonth).toBe(29);
  });

  it("直前に閉じた月の範囲を返す", () => {
    // 2024-02-01 00:00 JST = 2024-01-31T15:00:00Z(月が変わった直後)
    const justAfterMonthChange = new Date("2024-01-31T15:00:00.000Z");
    const previous = getPreviousMonthRange(justAfterMonthChange);
    expect(previous.start).toEqual(new Date("2023-12-31T15:00:00.000Z")); // 2024-01-01 00:00 JST
    expect(previous.end).toEqual(new Date("2024-01-31T15:00:00.000Z")); // 2024-02-01 00:00 JST
  });

  it("日本時間で月の最初の日かどうかを判定する", () => {
    expect(isFirstDayOfMonthJst(new Date("2024-01-31T15:00:00.000Z"))).toBe(true); // 2024-02-01 00:00 JST
    expect(isFirstDayOfMonthJst(new Date("2024-01-31T14:59:59.000Z"))).toBe(false); // 2024-01-31 23:59:59 JST
  });

  it("日本時間の暦日を返す", () => {
    // 2024-01-10 23:30 JST = 2024-01-10T14:30:00Z
    expect(jstCalendarDay(new Date("2024-01-10T14:30:00.000Z"))).toBe("2024-01-10");
    // 2024-01-11 00:30 JST = 2024-01-10T15:30:00Z(日付が変わる)
    expect(jstCalendarDay(new Date("2024-01-10T15:30:00.000Z"))).toBe("2024-01-11");
  });
});
