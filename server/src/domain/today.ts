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
// 上限は自分と相手で別々に数える。自分が同じ日に多く記録しても、相手の記録が
// 上限に押し出されて見えなくなる(=ありがとうを送る機会を失う)ことがないようにする。
export function selectTodayEvents(records: ChoreLogRecord[], myUserId: string, now: Date): TodayEvent[] {
  const today = jstCalendarDay(now);
  const byRecency = (a: ChoreLogRecord, b: ChoreLogRecord) => b.createdAt.getTime() - a.createdAt.getTime();
  // 1回だけ新しい順に並べる。以降のfilterは順序を保つため、部分集合も新しい順のまま扱える。
  const todaysByRecency = records.filter((record) => jstCalendarDay(record.createdAt) === today).sort(byRecency);
  const partnerRecords = todaysByRecency.filter((record) => record.userId !== myUserId).slice(0, MAX_TODAY_EVENTS);
  const myRecords = todaysByRecency
    .filter((record) => record.userId === myUserId)
    .slice(0, MAX_TODAY_EVENTS - partnerRecords.length);
  const selectedIds = new Set([...partnerRecords, ...myRecords].map((record) => record.id));
  return todaysByRecency
    .filter((record) => selectedIds.has(record.id))
    .map((record) => ({
      id: record.id,
      choreType: record.choreType,
      mine: record.userId === myUserId,
      thanked: record.thanked,
    }));
}

// きょうの相手の記録に、自分がまだありがとうを送っていないものがあるか。
export function hasUnthankedPartnerEvent(events: TodayEvent[]): boolean {
  return events.some((event) => !event.mine && !event.thanked);
}
