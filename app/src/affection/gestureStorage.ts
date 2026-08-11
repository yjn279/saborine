import { getStorageItem, setStorageItem } from "../storage";
import type { SaborineGesture } from "../components/saborine/types";

// 新しい仕草の解放を知らせるべきか(app/src/affection/gestureNotice.ts)の判断に使う、
// 前回ホームで確認した解放済み仕草の一覧をここに読み書きする。

const SEEN_GESTURES_KEY = "saborine.seenGestures";

// 前回確認した解放済み仕草の一覧。まだ一度も残していなければnull。
export async function getSeenGestures(): Promise<readonly SaborineGesture[] | null> {
  const raw = await getStorageItem(SEEN_GESTURES_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as SaborineGesture[];
}

// ホーム(app/app/index.tsx)が知らせを出すべきか判断したあとに呼ぶ。同じ解放で
// 二度目の知らせが出ないよう、そのとき確認した一覧をそのまま残す。
export async function setSeenGestures(gestures: readonly SaborineGesture[]): Promise<void> {
  await setStorageItem(SEEN_GESTURES_KEY, JSON.stringify(gestures));
}
