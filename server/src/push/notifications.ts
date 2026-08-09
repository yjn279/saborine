// お知らせは「良い出来事だけ」の4種に固定する(docs/mvp.md:117)。未読・放置・無反応をきっかけに
// 送る経路は存在しない。ここに無い種類は実行時に必ず失敗し、催促の紛れ込みをコードの形で防ぐ。
export const NOTIFICATION_KINDS = ["chore_recorded", "thanks_received", "growth", "weekly_card"] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface NotificationContent {
  title: string;
  body: string;
}

function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

// 文字列からNotificationKindへ絞り込む。4種以外は実行時に失敗する。
export function assertNotificationKind(value: string): NotificationKind {
  if (!isNotificationKind(value)) {
    throw new Error(`送れないお知らせの種類です: ${value}`);
  }
  return value;
}

// お知らせの本文を組み立てる。命令・催促・期限の表現は使わず、良い出来事をそのまま伝えるだけにする。
export function buildNotificationContent(kind: NotificationKind): NotificationContent {
  switch (kind) {
    case "chore_recorded":
      return { title: "きろくが とどいたよ", body: "サボリーヌが おせわに きづいたよ。" };
    case "thanks_received":
      return { title: "ありがとうが とどいたよ", body: "サボリーヌが ごはんを たべて よろこんでいるよ。" };
    case "growth":
      return { title: "サボリーヌが せいちょうしたよ", body: "サボリーヌが すこし おおきくなったみたい。" };
    case "weekly_card":
      return { title: "こんしゅうの おはなしが とどいたよ", body: "ふたりの1しゅうかんが カードに なったよ。" };
    default: {
      const exhaustiveCheck: never = kind;
      throw new Error(`送れないお知らせの種類です: ${String(exhaustiveCheck)}`);
    }
  }
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
const JST_OFFSET_MS = 9 * HOUR_MS;
const BATCH_WINDOW_MS = HOUR_MS;
const QUIET_HOUR_START_JST = 22;
const QUIET_HOUR_END_JST = 8;

export interface TimedEvent {
  occurredAt: Date;
}

// 1時間以内に連続した出来事を、届け先ごとに1つのまとまりへ束ねる。記録のお知らせを1通にまとめる土台。
export function groupWithinOneHour<T extends TimedEvent>(events: readonly T[]): T[][] {
  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const batches: T[][] = [];
  for (const event of sorted) {
    const currentBatch = batches.at(-1);
    const lastEvent = currentBatch?.at(-1);
    if (currentBatch && lastEvent && event.occurredAt.getTime() - lastEvent.occurredAt.getTime() <= BATCH_WINDOW_MS) {
      currentBatch.push(event);
    } else {
      batches.push([event]);
    }
  }
  return batches;
}

// 22時〜翌8時(日本時間)に起きた出来事は、その朝の8時にまとめて届ける。それ以外はそのまま(即時)届ける。
export function resolveDeliveryTime(occurredAt: Date): Date {
  const jstMs = occurredAt.getTime() + JST_OFFSET_MS;
  const jstHour = new Date(jstMs).getUTCHours();
  const isQuietHours = jstHour >= QUIET_HOUR_START_JST || jstHour < QUIET_HOUR_END_JST;
  if (!isQuietHours) {
    return occurredAt;
  }
  const jstDayStartMs = Math.floor(jstMs / DAY_MS) * DAY_MS;
  const daysToAdd = jstHour >= QUIET_HOUR_START_JST ? 1 : 0;
  const deliveryJstMs = jstDayStartMs + daysToAdd * DAY_MS + QUIET_HOUR_END_JST * HOUR_MS;
  return new Date(deliveryJstMs - JST_OFFSET_MS);
}

// `now`に最も近い「22時〜翌8時」の繰り越し配信の範囲を返す。翌朝8時に実行される予定実行から使う。
export function quietHourWindowEnding(now: Date): { start: Date; end: Date } {
  const jstMs = now.getTime() + JST_OFFSET_MS;
  const jstDayStartMs = Math.floor(jstMs / DAY_MS) * DAY_MS;
  const endJstMs = jstDayStartMs + QUIET_HOUR_END_JST * HOUR_MS;
  const startJstMs = endJstMs - (24 - QUIET_HOUR_START_JST + QUIET_HOUR_END_JST) * HOUR_MS;
  return { start: new Date(startJstMs - JST_OFFSET_MS), end: new Date(endJstMs - JST_OFFSET_MS) };
}
