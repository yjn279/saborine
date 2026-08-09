import { describe, expect, it } from "vitest";
import { getWeekRange, getWeekStart } from "../../src/domain/week.js";

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
