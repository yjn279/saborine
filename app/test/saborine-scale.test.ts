import { describe, expect, it } from "vitest";
import { calcScale } from "../src/saborine/scale";

const STAGES_WITH_HEADROOM = [0, 1, 2] as const;

describe("サボリーヌの大きさの決定(calcScale)", () => {
  it("育ち具合0のときは、いまの段階だけで決まる大きさと一致する(段階0〜4)", () => {
    for (let stage = 0; stage <= 4; stage++) {
      const legacyScale = 0.9 + Math.min(stage, 3) * 0.06;

      expect(calcScale(stage, 0)).toBeCloseTo(legacyScale);
    }
  });

  it.each(STAGES_WITH_HEADROOM)("段階%iでは、育ち具合が上がるにつれて大きさが減らない", (stage) => {
    let previous = calcScale(stage, 0);

    for (let progress = 0.01; progress <= 1; progress += 0.01) {
      const current = calcScale(stage, progress);

      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it.each(STAGES_WITH_HEADROOM)("段階%iで育ち具合1の大きさは、次の段階・育ち具合0の大きさと一致する", (stage) => {
    expect(calcScale(stage, 1)).toBeCloseTo(calcScale(stage + 1, 0));
  });

  it("育ち具合が1を超えても、育ち具合1のときの大きさを超えない", () => {
    expect(calcScale(1, 1.5)).toBeCloseTo(calcScale(1, 1));
  });

  it("育ち具合が負の値(防御)でも、育ち具合0のときの大きさを下回らない", () => {
    expect(calcScale(1, -1)).toBeCloseTo(calcScale(1, 0));
  });

  it("段階3では、育ち具合がいくつでも大きさが変わらない", () => {
    const base = calcScale(3, 0);

    expect(calcScale(3, 0.5)).toBeCloseTo(base);
    expect(calcScale(3, 1)).toBeCloseTo(base);
  });

  it("育ち具合を省略すると0として扱う", () => {
    expect(calcScale(2)).toBeCloseTo(calcScale(2, 0));
  });
});
