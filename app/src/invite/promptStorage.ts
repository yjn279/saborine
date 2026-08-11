import { getStorageItem, removeStorageItem, setStorageItem } from "../storage";
import type { InvitePromptStage } from "./prompt";

// 手紙の自動提示(app/src/invite/prompt.ts)と招待画面(app/app/invite.tsx)が使う、
// 端末保存の読み書きをここに置く。

const FIRST_RECORDED_AT_KEY = "saborine.inviteFirstRecordedAt";
const PROMPT_STAGE_KEY = "saborine.invitePromptStage";
const REMINDER_COUNT_KEY = "saborine.inviteReminderCount";

// 初めて記録した日時。記録シート(app/app/record.tsx)が記録の成立直後に書き、
// ホーム(app/app/index.tsx)が「初めてかどうか」と「3日経過したか」の起点として読む。

export async function getFirstRecordedAt(): Promise<Date | null> {
  const raw = await getStorageItem(FIRST_RECORDED_AT_KEY);
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// すでに日時が残っていれば上書きしない。記録が成功したときにだけ呼ぶこと。
export async function markFirstRecordedAt(now: Date = new Date()): Promise<void> {
  const existing = await getFirstRecordedAt();
  if (existing) {
    return;
  }
  await setStorageItem(FIRST_RECORDED_AT_KEY, now.toISOString());
}

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
  await Promise.all([
    removeStorageItem(FIRST_RECORDED_AT_KEY),
    removeStorageItem(PROMPT_STAGE_KEY),
    removeStorageItem(REMINDER_COUNT_KEY),
  ]);
}
