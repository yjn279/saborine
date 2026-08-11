import { getStorageItem, setStorageItem } from "../storage";
import type { InvitePromptStage } from "./prompt";

// 手紙の自動提示(app/src/invite/prompt.ts)が端末に残す値をここに集める。読み書きの
// 場所を1つにまとめることで、保存の名前が記録シート・ホームに散らばらないようにする。
// 既存の再提示回数(saborine.inviteReminderCount, app/app/invite.tsx)とは別の名前を使う。

// 初めて記録した日時。記録シート(app/app/record.tsx)が記録の成立直後に書き、
// ホーム(app/app/index.tsx)がそれを「初めてかどうか」と「3日経過したか」の起点として読む。
const FIRST_RECORDED_AT_KEY = "saborine.inviteFirstRecordedAt";

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
const PROMPT_STAGE_KEY = "saborine.invitePromptStage";

export async function getInvitePromptStage(): Promise<InvitePromptStage> {
  const raw = await getStorageItem(PROMPT_STAGE_KEY);
  return raw === "first" || raw === "second" ? raw : "none";
}

export async function setInvitePromptStage(stage: InvitePromptStage): Promise<void> {
  await setStorageItem(PROMPT_STAGE_KEY, stage);
}
