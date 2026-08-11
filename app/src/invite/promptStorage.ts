import { getStorageItem, removeStorageItem, setStorageItem } from "../storage";
import type { InvitePromptStage } from "./prompt";

// 手紙の自動提示(app/src/invite/prompt.ts)と招待画面(app/app/invite.tsx)が使う、
// 端末保存の読み書きをここに置く。

const PROMPT_STAGE_KEY = "saborine.invitePromptStage";
const REMINDER_COUNT_KEY = "saborine.inviteReminderCount";

// 自動提示のうち、これまでにどこまで出したか。ホーム(app/app/index.tsx)だけが読み書きする。
export async function getInvitePromptStage(): Promise<InvitePromptStage> {
  const raw = await getStorageItem(PROMPT_STAGE_KEY);
  return raw === "first" || raw === "second" ? raw : "none";
}

export async function setInvitePromptStage(stage: InvitePromptStage): Promise<void> {
  await setStorageItem(PROMPT_STAGE_KEY, stage);
}

// 招待画面(app/app/invite.tsx)が開かれた回数。招待カードの再提示は2回までとし、
// それ以上は誘いの文面を外す(docs/mvp.md)。
export async function getReminderCount(): Promise<number> {
  const raw = await getStorageItem(REMINDER_COUNT_KEY);
  return raw ? Number(raw) : 0;
}

export async function bumpReminderCount(current: number): Promise<void> {
  await setStorageItem(REMINDER_COUNT_KEY, String(current + 1));
}

// ペア解除・アカウント削除の直後にだけ呼ぶ。次にこの端末で登録する相手に、
// 前の関係の進み具合を持ち越さないようにする。
export async function clearInvitePromptState(): Promise<void> {
  await Promise.all([removeStorageItem(PROMPT_STAGE_KEY), removeStorageItem(REMINDER_COUNT_KEY)]);
}
