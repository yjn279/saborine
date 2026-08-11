import { describe, expect, it } from "vitest";
import { decideTodayEventView } from "../src/home/todayEvents";

describe("きょうのできごと1件の見せ方(decideTodayEventView)", () => {
  it("相手の記録には、ありがとうのボタンを出すと判断する", () => {
    const view = decideTodayEventView({ id: "1", choreType: "皿洗い", mine: false, thanked: false });

    expect(view.showThanksButton).toBe(true);
  });

  it("自分の記録には、ありがとうのボタンを出さないと判断する", () => {
    const view = decideTodayEventView({ id: "1", choreType: "皿洗い", mine: true, thanked: false });

    expect(view.showThanksButton).toBe(false);
  });

  it("すでにありがとうが届いている相手の記録は、送り済みとして扱う", () => {
    const view = decideTodayEventView({ id: "1", choreType: "皿洗い", mine: false, thanked: true });

    expect(view.showThanksButton).toBe(true);
    expect(view.thanked).toBe(true);
  });

  it("まだありがとうが届いていない相手の記録は、送り済みではないと扱う", () => {
    const view = decideTodayEventView({ id: "1", choreType: "皿洗い", mine: false, thanked: false });

    expect(view.thanked).toBe(false);
  });

  it("出す一文に、数字・時刻・順位が現れない", () => {
    const view = decideTodayEventView({ id: "1", choreType: "皿洗い", mine: false, thanked: false });

    expect(view.text).not.toMatch(/[0-9０-９]/);
    expect(view.text).not.toMatch(/時|分/);
    expect(view.text).not.toMatch(/番|位/);
  });

  it("相手を責める言い回しを含まない", () => {
    const thanked = decideTodayEventView({ id: "1", choreType: "皿洗い", mine: false, thanked: true });
    const unthanked = decideTodayEventView({ id: "1", choreType: "皿洗い", mine: false, thanked: false });

    for (const view of [thanked, unthanked]) {
      expect(view.text).not.toMatch(/まだ/);
      expect(view.text).not.toMatch(/していない/);
    }
  });
});
