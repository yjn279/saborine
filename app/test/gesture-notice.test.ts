import { describe, expect, it } from "vitest";
import { buildGestureNoticeMessage, decideGestureNotice } from "../src/affection/gestureNotice";
import type { SaborineGesture } from "../src/components/saborine/types";

const ALL_GESTURES: SaborineGesture[] = ["facesPartner", "callsName", "approaches", "specialGesture"];

describe("新しい仕草の解放を知らせるべきかの判断(decideGestureNotice)", () => {
  it("増えていなければ、必ず知らせない", () => {
    const decision = decideGestureNotice({
      current: ["facesPartner", "callsName"],
      previouslySeen: ["facesPartner", "callsName"],
    });

    expect(decision).toBeNull();
  });

  it("1つ増えたときは、その仕草を知らせる", () => {
    const decision = decideGestureNotice({
      current: ["facesPartner", "callsName"],
      previouslySeen: ["facesPartner"],
    });

    expect(decision).toBe("callsName");
  });

  it("2つ以上まとめて増えたときは、最も新しいものだけを1つ知らせる", () => {
    const decision = decideGestureNotice({
      current: ["facesPartner", "callsName", "approaches", "specialGesture"],
      previouslySeen: ["facesPartner"],
    });

    expect(decision).toBe("specialGesture");
  });

  it("前に見た記録が端末に無いときは、知らせない", () => {
    const decision = decideGestureNotice({
      current: ["facesPartner"],
      previouslySeen: null,
    });

    expect(decision).toBeNull();
  });
});

describe("知らせの文面(buildGestureNoticeMessage)", () => {
  it("数字(半角・全角とも)が一切含まれない", () => {
    for (const gesture of ALL_GESTURES) {
      const message = buildGestureNoticeMessage(gesture);

      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/[0-9０-９]/);
    }
  });
});
