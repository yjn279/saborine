import { describe, expect, it } from "vitest";
import { decidePose } from "../src/saborine/pose";

describe("ホームで出す姿の判断(decidePose)", () => {
  it("セリフの種類がだらしな(sloppy)なら、だらしな姿を返す", () => {
    const pose = decidePose({ serifKind: "sloppy", isEating: false });

    expect(pose).toBe("sloppy");
  });

  it("セリフの種類がありがとう待ち(thanksWaiting)なら、よろこぶ姿を返す", () => {
    const pose = decidePose({ serifKind: "thanksWaiting", isEating: false });

    expect(pose).toBe("happy");
  });

  it("セリフの種類が促し(nudge)なら、ふつうの姿を返す", () => {
    // 促しているあいだは跳ねる動きで目を向けてもらう。寝ている姿だと動きと矛盾する。
    const pose = decidePose({ serifKind: "nudge", isEating: false });

    expect(pose).toBe("normal");
  });

  it("セリフの種類がふだん(default)なら、ふだんの姿を返す", () => {
    const pose = decidePose({ serifKind: "default", isEating: false });

    expect(pose).toBe("normal");
  });

  it("ありがとう送信直後は、セリフの種類にかかわらず食べる姿を返す", () => {
    const kinds = ["sloppy", "thanksWaiting", "nudge", "default"] as const;

    for (const serifKind of kinds) {
      expect(decidePose({ serifKind, isEating: true })).toBe("eating");
    }
  });
});
