import { getStorageItem, setStorageItem } from "../storage";

// 初めて記録した日時を端末に残す。記録シート(app/app/record.tsx)が記録の成立直後に
// 書き、ホーム(app/app/index.tsx)がそれを「初めてかどうか」と「3日経過したか」の
// 起点として読む(app/src/invite/prompt.ts)。読み書きをここに集め、保存の名前が
// 記録シートとホームに散らばらないようにする。既存の再提示回数
// (saborine.inviteReminderCount, app/app/invite.tsx)とは別の名前を使う。
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
