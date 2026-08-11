import { describe, expect, it } from "vitest";
import { buildRecordReactionMessage } from "../src/record/reaction";

describe("記録直後のひとことの判断(buildRecordReactionMessage)", () => {
  it("だらしなでなかった場合、家事の名前を含む文面を返す", () => {
    const message = buildRecordReactionMessage({ choreType: "お皿洗い", wasSloppy: false });

    expect(message).toContain("お皿洗い");
  });

  it("直前がだらしなだった場合も、家事の名前を含む文面を返す", () => {
    const message = buildRecordReactionMessage({ choreType: "ゴミ出し", wasSloppy: true });

    expect(message).toContain("ゴミ出し");
  });

  it("直前がだらしなだった場合は、そうでない場合と文面が異なる", () => {
    const normal = buildRecordReactionMessage({ choreType: "洗濯", wasSloppy: false });
    const recovered = buildRecordReactionMessage({ choreType: "洗濯", wasSloppy: true });

    expect(recovered).not.toBe(normal);
  });

  it("だらしなだったことを責める言い回しを含まない", () => {
    const blamingWords = ["やっと", "ひさしぶり", "さぼって"];
    const messages = [
      buildRecordReactionMessage({ choreType: "掃除", wasSloppy: false }),
      buildRecordReactionMessage({ choreType: "掃除", wasSloppy: true }),
    ];

    for (const message of messages) {
      for (const word of blamingWords) {
        expect(message).not.toContain(word);
      }
    }
  });
});
