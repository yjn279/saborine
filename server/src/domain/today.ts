import { jstCalendarDay } from "./week.js";

const MAX_TODAY_EVENTS = 6;

export interface ChoreLogRecord {
  id: string;
  userId: string;
  choreType: string;
  createdAt: Date;
  thanked: boolean;
}

export interface TodayEvent {
  id: string;
  choreType: string;
  mine: boolean;
  thanked: boolean;
}

// きょう、ふたりに起きたこと = 日本時間の当日中に作られた記録を、新しい順に最大6件だけ返す。
// 件数・時刻・順位は持たせない(docs/mvp.mdの「持たないデータ」)。
export function selectTodayEvents(records: ChoreLogRecord[], myUserId: string, now: Date): TodayEvent[] {
  const today = jstCalendarDay(now);
  return records
    .filter((record) => jstCalendarDay(record.createdAt) === today)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, MAX_TODAY_EVENTS)
    .map((record) => ({
      id: record.id,
      choreType: record.choreType,
      mine: record.userId === myUserId,
      thanked: record.thanked,
    }));
}
