import { getStorageItem, setStorageItem } from "../storage";

// 育ちを知らせるべきか(app/src/saborine/growthNotice.ts)の判断に使う、
// 前回ホームで確認した育ち具合をここに読み書きする。

const SEEN_GROWTH_PROGRESS_KEY = "saborine.seenGrowthProgress";

// 前回確認した育ち具合。まだ一度も残していない、または壊れていて読めないときは
// null(壊れたデータはネットワーク取得の失敗と混同しないよう、ここで吸収する)。
export async function getSeenGrowthProgress(): Promise<number | null> {
  const raw = await getStorageItem(SEEN_GROWTH_PROGRESS_KEY);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

// ホーム(app/app/index.tsx)が知らせを出すべきか判断したあとに呼ぶ。同じ育ちで
// 二度目の知らせが出ないよう、そのとき確認した値をそのまま残す。
export async function setSeenGrowthProgress(growthProgress: number): Promise<void> {
  await setStorageItem(SEEN_GROWTH_PROGRESS_KEY, String(growthProgress));
}
