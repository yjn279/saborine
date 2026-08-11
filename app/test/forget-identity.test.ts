import { describe, expect, it } from "vitest";
import { forgetIdentity } from "../src/auth/forgetIdentity";

describe("身分証を手放す(forgetIdentity)", () => {
  it("身分証と招待の自動提示の端末保存を、どちらも消す", async () => {
    const calls: string[] = [];
    await forgetIdentity({
      clearIdentity: async () => {
        calls.push("identity");
      },
      clearInvitePromptState: async () => {
        calls.push("invitePrompt");
      },
    });

    expect(calls).toEqual(expect.arrayContaining(["identity", "invitePrompt"]));
    expect(calls).toHaveLength(2);
  });

  it("片方が失敗しても、もう片方は呼ばれている", async () => {
    const calls: string[] = [];
    await expect(
      forgetIdentity({
        clearIdentity: async () => {
          calls.push("identity");
          throw new Error("保存領域が読めない");
        },
        clearInvitePromptState: async () => {
          calls.push("invitePrompt");
        },
      }),
    ).rejects.toThrow();

    expect(calls).toEqual(expect.arrayContaining(["identity", "invitePrompt"]));
  });
});
