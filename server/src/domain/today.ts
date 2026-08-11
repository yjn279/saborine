import { jstCalendarDay } from "./week.js";

const MAX_TODAY_EVENTS = 6;
const MIN_SLOTS_PER_SIDE = 3;

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
// 相手・自分それぞれに最低3件ぶんの枠を確保し、どちらかがその枠を使い切らなければ
// 余った枠をもう一方に回す。これにより、一方が多く記録した日でも、もう一方の記録が
// 全部押し出されて見えなくなる(=ありがとうを送る機会を失う)ことがないようにする。
function takeSlots(partnerCount: number, myCount: number): { partnerSlots: number; mySlots: number } {
  const partnerBase = Math.min(partnerCount, MIN_SLOTS_PER_SIDE);
  const myBase = Math.min(myCount, MIN_SLOTS_PER_SIDE);
  let remaining = MAX_TODAY_EVENTS - partnerBase - myBase;
  const partnerExtra = Math.min(partnerCount - partnerBase, remaining);
  remaining -= partnerExtra;
  const myExtra = Math.min(myCount - myBase, remaining);
  return { partnerSlots: partnerBase + partnerExtra, mySlots: myBase + myExtra };
}

export function selectTodayEvents(records: ChoreLogRecord[], myUserId: string, now: Date): TodayEvent[] {
  const today = jstCalendarDay(now);
  const byRecency = (a: ChoreLogRecord, b: ChoreLogRecord) => b.createdAt.getTime() - a.createdAt.getTime();
  // 1回だけ新しい順に並べる。以降のfilterは順序を保つため、部分集合も新しい順のまま扱える。
  const todaysByRecency = records.filter((record) => jstCalendarDay(record.createdAt) === today).sort(byRecency);
  const partnerRecords = todaysByRecency.filter((record) => record.userId !== myUserId);
  const myRecords = todaysByRecency.filter((record) => record.userId === myUserId);
  const { partnerSlots, mySlots } = takeSlots(partnerRecords.length, myRecords.length);
  const selectedIds = new Set(
    [...partnerRecords.slice(0, partnerSlots), ...myRecords.slice(0, mySlots)].map((record) => record.id),
  );
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
