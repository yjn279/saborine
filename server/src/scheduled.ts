import type { Db } from "./db.js";
import type { PushSubscription, WebPushConfig } from "./push/send.js";
import { sendWebPush } from "./push/send.js";
import type { NotificationKind, TimedEvent } from "./push/notifications.js";
import { buildNotificationContent, groupWithinOneHour, quietHourWindowEnding } from "./push/notifications.js";
import { generateWeeklyCardText, getPreviousWeekRange } from "./domain/weekly-card.js";

// 予定実行(Cron Triggers)から呼ぶ2つの仕事に対応する式。server/wrangler.jsoncの設定と対にする。
// 週次カード: 日曜21:00 JST(=12:00 UTC)。繰り越しぶんの記録・ありがとう: 翌8:00 JST(=23:00 UTC)。
export const WEEKLY_CARD_CRON = "0 12 * * 0";
export const MORNING_CATCH_UP_CRON = "0 23 * * *";

// SQLiteのCURRENT_TIMESTAMPは"YYYY-MM-DD HH:MM:SS"(UTC、区切りは空白)で保存される。
function parseStoredTimestamp(value: unknown): Date {
  return new Date(`${String(value).replace(" ", "T")}Z`);
}

function formatForQuery(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function runScheduled(db: Db, config: WebPushConfig, cron: string, now: Date): Promise<void> {
  if (cron === WEEKLY_CARD_CRON) {
    await deliverWeeklyCards(db, config, now);
    return;
  }
  if (cron === MORNING_CATCH_UP_CRON) {
    await deliverQuietHourNotifications(db, config, now);
  }
}

async function subscriptionsForUser(db: Db, userId: string): Promise<PushSubscription[]> {
  const result = await db.execute({
    sql: "SELECT endpoint, p256dh_key, auth_key FROM push_subscriptions WHERE user_id = ?",
    args: [userId],
  });
  return result.rows.map((row) => ({
    endpoint: String(row.endpoint),
    keys: { p256dh: String(row.p256dh_key), auth: String(row.auth_key) },
  }));
}

// 1人ぶんの購読すべてに同じお知らせを送る。届かなくなった購読(410/404)はその場で消す。
async function notifyUser(db: Db, config: WebPushConfig, userId: string, kind: NotificationKind): Promise<void> {
  const subscriptions = await subscriptionsForUser(db, userId);
  if (subscriptions.length === 0) {
    return;
  }
  const content = buildNotificationContent(kind);
  for (const subscription of subscriptions) {
    const result = await sendWebPush(subscription, { kind, ...content }, config);
    if (result.outcome === "expired") {
      await db.execute({ sql: "DELETE FROM push_subscriptions WHERE endpoint = ?", args: [subscription.endpoint] });
    }
  }
}

// 直前の週が閉じたペアそれぞれへ、週次カードを生成(未生成なら)し、購読しているメンバーへ届ける。
async function deliverWeeklyCards(db: Db, config: WebPushConfig, now: Date): Promise<void> {
  const weekRange = getPreviousWeekRange(now);
  const pairsResult = await db.execute({ sql: "SELECT id FROM pairs WHERE established_at IS NOT NULL", args: [] });

  for (const pairRow of pairsResult.rows) {
    const pairId = String(pairRow.id);
    await ensureWeeklyCard(db, pairId, weekRange);

    const usersResult = await db.execute({
      sql: "SELECT id FROM users WHERE pair_id = ? AND notifications_enabled = 1",
      args: [pairId],
    });
    for (const userRow of usersResult.rows) {
      await notifyUser(db, config, String(userRow.id), "weekly_card");
    }
  }
}

async function ensureWeeklyCard(db: Db, pairId: string, weekRange: { start: Date; end: Date }): Promise<void> {
  const existing = await db.execute({
    sql: "SELECT id FROM weekly_cards WHERE pair_id = ? AND week_start = ?",
    args: [pairId, weekRange.start.toISOString()],
  });
  if (existing.rows.length > 0) {
    return;
  }

  const [choreLogsResult, thanksResult] = await Promise.all([
    db.execute({ sql: "SELECT chore_type, created_at FROM chore_logs WHERE pair_id = ?", args: [pairId] }),
    db.execute({
      sql: `SELECT thanks.created_at AS created_at
            FROM thanks
            JOIN chore_logs ON thanks.chore_log_id = chore_logs.id
            WHERE chore_logs.pair_id = ?`,
      args: [pairId],
    }),
  ]);
  const choreTypes = choreLogsResult.rows
    .filter((row) => isWithinRange(parseStoredTimestamp(row.created_at), weekRange))
    .map((row) => String(row.chore_type));
  const thanksCount = thanksResult.rows.filter((row) => isWithinRange(parseStoredTimestamp(row.created_at), weekRange)).length;

  const storyText = generateWeeklyCardText({ choreTypes, thanksCount });
  await db.execute({
    sql: "INSERT INTO weekly_cards (id, pair_id, week_start, story_text) VALUES (?, ?, ?, ?)",
    args: [crypto.randomUUID(), pairId, weekRange.start.toISOString(), storyText],
  });
}

function isWithinRange(at: Date, range: { start: Date; end: Date }): boolean {
  return at >= range.start && at < range.end;
}

interface RecipientEvent extends TimedEvent {
  recipientUserId: string;
  kind: "chore_recorded" | "thanks_received";
}

// 22時〜翌8時(日本時間)に起きた記録・ありがとうを集め、届け先ごとに1時間以内のまとまりを1通として届ける。
async function deliverQuietHourNotifications(db: Db, config: WebPushConfig, now: Date): Promise<void> {
  const window = quietHourWindowEnding(now);
  const events = await collectQuietHourEvents(db, window);

  const groupedByRecipient = new Map<string, RecipientEvent[]>();
  for (const event of events) {
    const key = `${event.recipientUserId}:${event.kind}`;
    const list = groupedByRecipient.get(key);
    if (list) {
      list.push(event);
    } else {
      groupedByRecipient.set(key, [event]);
    }
  }

  for (const [key, recipientEvents] of groupedByRecipient) {
    const separatorIndex = key.lastIndexOf(":");
    const userId = key.slice(0, separatorIndex);
    const kind = key.slice(separatorIndex + 1) as RecipientEvent["kind"];
    const batchCount = groupWithinOneHour(recipientEvents).length;
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      await notifyUser(db, config, userId, kind);
    }
  }
}

async function collectQuietHourEvents(db: Db, window: { start: Date; end: Date }): Promise<RecipientEvent[]> {
  const windowStart = formatForQuery(window.start);
  const windowEnd = formatForQuery(window.end);
  const events: RecipientEvent[] = [];

  // 記録のお知らせは、記録した本人ではなく相手に届ける。
  const choreLogsResult = await db.execute({
    sql: `SELECT partner.id AS partner_id, chore_logs.created_at AS created_at
          FROM chore_logs
          JOIN users AS partner ON partner.pair_id = chore_logs.pair_id AND partner.id != chore_logs.user_id
          WHERE chore_logs.created_at >= ? AND chore_logs.created_at < ?`,
    args: [windowStart, windowEnd],
  });
  for (const row of choreLogsResult.rows) {
    events.push({
      recipientUserId: String(row.partner_id),
      kind: "chore_recorded",
      occurredAt: parseStoredTimestamp(row.created_at),
    });
  }

  // ありがとうのお届けは、記録した本人に届ける。
  const thanksResult = await db.execute({
    sql: `SELECT chore_logs.user_id AS recipient_id, thanks.created_at AS created_at
          FROM thanks
          JOIN chore_logs ON thanks.chore_log_id = chore_logs.id
          WHERE thanks.created_at >= ? AND thanks.created_at < ?`,
    args: [windowStart, windowEnd],
  });
  for (const row of thanksResult.rows) {
    events.push({
      recipientUserId: String(row.recipient_id),
      kind: "thanks_received",
      occurredAt: parseStoredTimestamp(row.created_at),
    });
  }

  return events;
}
