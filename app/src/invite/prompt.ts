// 手紙を自動で出すべきかどうかを、画面から切り離して判断する。react-native・expo・
// expo-router・app/src/storage.ts のいずれも読み込まない。ペアの成否・初めての記録の
// 日時・これまでに自動で出した段階・現在時刻は、呼び出し側(app/app/index.tsx)が渡す。
// これにより、画面を動かさずに判断だけを試験できる。

// これまでに自動で出した段階。none: まだ一度も出していない。first: 1回目まで出した。
// second: 2回目まで出した(以後は出さない)。
export type InvitePromptStage = "none" | "first" | "second";

export type InvitePromptDecision = "first" | "second" | "none";

export interface InvitePromptInput {
  isPaired: boolean;
  firstRecordedAt: Date | null;
  stage: InvitePromptStage;
  now: Date;
}

// 2回目の自動提示は、初めての記録から3日(72時間)が過ぎたときに限る(docs/mvp.md)。
const SECOND_PROMPT_DELAY_MS = 72 * 60 * 60 * 1000;

export function decideInvitePrompt(input: InvitePromptInput): InvitePromptDecision {
  if (input.isPaired) {
    return "none";
  }
  if (!input.firstRecordedAt) {
    return "none";
  }
  if (input.stage === "none") {
    return "first";
  }
  if (input.stage === "second") {
    return "none";
  }

  const elapsedMs = input.now.getTime() - input.firstRecordedAt.getTime();
  return elapsedMs >= SECOND_PROMPT_DELAY_MS ? "second" : "none";
}

// サーバー(/api/home)が返す初めての記録の日時をDateに直す。1件も無ければnull。
export function parseFirstRecordedAt(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
