import type { Identity } from "../auth/identity";
import { apiRequest } from "./client";

// サーバーとやりとりする値の形。サーバー側(server/src/routes/weekly-card.ts)の出力に合わせる。
// 個人別の集計は含まれない。

export interface WeeklyCard {
  weekStart: string;
  weekEnd: string;
  // 定型文テンプレート+記録の埋め込みで作った本文。5行以内、改行区切り。
  storyText: string;
}

export function fetchWeeklyCard(identity: Identity): Promise<WeeklyCard> {
  return apiRequest<WeeklyCard>("/api/weekly-card", { identity });
}
