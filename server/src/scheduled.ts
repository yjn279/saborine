import type { Db } from "./db.js";
import { formatStoredTimestamp, parseStoredTimestamp } from "./db.js";
import type { PushSubscription, WebPushConfig } from "./push/send.js";
import { sendWebPush } from "./push/send.js";
import type { NotificationKind, TimedEvent } from "./push/notifications.js";
import {
  buildNotificationContent,
  groupWithinOneHour,
  quietHourWindowEnding,
  resolveDeliveryTime,
} from "./push/notifications.js";
import { getPreviousWeekRange } from "./domain/weekly-card.js";
import { ensureWeeklyCard } from "./weekly-card-store.js";
import { getPreviousMonthRange, isFirstDayOfMonthJst } from "./domain/week.js";
import { decideEvolution } from "./domain/evolution.js";
import { computeEvolutionRatios } from "./growth-ledger.js";

// 予定実行(Cron Triggers)から呼ぶ2つの仕事に対応する式。server/wrangler.jsoncの設定と対にする。
// 週次カード: 日曜21:00 JST(=12:00 UTC)。繰り越しぶんの記録・ありがとう: 翌8:00 JST(=23:00 UTC)。
// 曜日は1〜7(1=月曜、7=日曜)で書く。Cloudflareは0を日曜として受け付けない。
export const WEEKLY_CARD_CRON = "0 12 * * 7";
export const MORNING_CATCH_UP_CRON = "0 23 * * *";

export async function runScheduled(db: Db, config: WebPushConfig, cron: string, now: Date): Promise<void> {
  if (cron === WEEKLY_CARD_CRON) {
    await deliverWeeklyCards(db, config, now);
    return;
  }
  if (cron === MORNING_CATCH_UP_CRON) {
    await deliverQuietHourNotifications(db, config, now);
    await deliverMonthlyEvolutions(db, config, now);
    return;
  }
  // 設定側の式とここの式がずれたら、黙って何もしないのではなく失敗させる。
  // 黙って通すと、週次カードが二度と作られないまま誰も気づかない。
  throw new Error(`知らない予定実行の式です: ${cron}`);
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
// 1件ごとに送信を独立してtry/catchし、1件の失敗・例外が他の購読への送信や呼び出し元の
// 予定実行全体を巻き込んで失敗にしないようにする。
export async function notifyUser(db: Db, config: WebPushConfig, userId: string, kind: NotificationKind): Promise<void> {
  const subscriptions = await subscriptionsForUser(db, userId);
  if (subscriptions.length === 0) {
    return;
  }
  const content = buildNotificationContent(kind);
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        const result = await sendWebPush(subscription, { kind, ...content }, config);
        if (result.outcome === "expired") {
          await db.execute({
            sql: "DELETE FROM push_subscriptions WHERE endpoint = ?",
            args: [subscription.endpoint],
          });
        } else if (result.outcome === "failed") {
          console.error(`プッシュ送信に失敗しました: userId=${userId} kind=${kind} status=${result.status}`);
        }
      } catch (error) {
        console.error(`プッシュ送信中に例外が発生しました: userId=${userId} kind=${kind}`, error);
      }
    }),
  );
}

// 記録・ありがとうの直後に、いま(=occurredAt)が夜間(22時〜翌8時JST)でなければその場で届ける。
// 夜間なら何もせず、翌朝の予定実行(deliverQuietHourNotifications)に任せ、二重送信を避ける。
export async function notifyIfImmediate(
  db: Db,
  config: WebPushConfig | undefined,
  recipientUserId: string,
  kind: "chore_recorded" | "thanks_received",
  occurredAt: Date,
): Promise<void> {
  if (!config) {
    return;
  }
  if (resolveDeliveryTime(occurredAt).getTime() !== occurredAt.getTime()) {
    return;
  }
  await notifyUser(db, config, recipientUserId, kind);
}

// 直前の週が閉じたペアそれぞれへ、週次カードを生成(未生成なら)し、購読しているメンバーへ届ける。
async function deliverWeeklyCards(db: Db, config: WebPushConfig, now: Date): Promise<void> {
  const weekRange = getPreviousWeekRange(now);
  const pairsResult = await db.execute({ sql: "SELECT id FROM pairs WHERE established_at IS NOT NULL", args: [] });

  await Promise.all(
    pairsResult.rows.map(async (pairRow) => {
      const pairId = String(pairRow.id);
      await ensureWeeklyCard(db, pairId, weekRange);

      const usersResult = await db.execute({
        sql: "SELECT id FROM users WHERE pair_id = ? AND notifications_enabled = 1",
        args: [pairId],
      });
      await Promise.all(
        usersResult.rows.map((userRow) => notifyUser(db, config, String(userRow.id), "weekly_card")),
      );
    }),
  );
}

// 月が変わった日(日本時間)にだけ、直前に閉じた月について進化を判定する(docs/mvp.md:145)。
// 進化した回だけ、ふたりへ「成長のお知らせ」を届ける。
async function deliverMonthlyEvolutions(db: Db, config: WebPushConfig, now: Date): Promise<void> {
  if (!isFirstDayOfMonthJst(now)) {
    return;
  }
  const monthRange = getPreviousMonthRange(now);
  const pairsResult = await db.execute({ sql: "SELECT id FROM pairs WHERE established_at IS NOT NULL", args: [] });

  await Promise.all(
    pairsResult.rows.map(async (pairRow) => {
      const pairId = String(pairRow.id);
      const characterResult = await db.execute({
        sql: "SELECT total_growth_points, growth_cycle_started_at FROM characters WHERE pair_id = ?",
        args: [pairId],
      });
      const character = characterResult.rows[0];
      if (!character) {
        return;
      }

      const ratios = await computeEvolutionRatios(db, pairId, monthRange);
      const decision = decideEvolution({
        monthlyGrowthPoints: Number(character.total_growth_points),
        harmonyRatio: ratios.harmonyRatio,
        mutualThanksDays: ratios.mutualThanksDays,
        recordedDays: ratios.recordedDays,
        daysInMonth: monthRange.daysInMonth,
      });
      if (!decision.evolves) {
        return;
      }

      // growth_cycle_started_atが読み取り時から変わっていない場合に限り進化を適用する。
      // Cron Triggersの重複実行(手動再実行含む)で同じ進化イベントが二重に走っても、
      // 2回目はこの条件に一致せず0行更新となり、evolution_stageの二重加算・お知らせの
      // 二重送信を防ぐ。
      const updateResult = await db.execute({
        sql: `UPDATE characters
              SET evolution_stage = evolution_stage + 1, evolution_lineage = ?,
                  total_growth_points = 0, growth_cycle_started_at = ?
              WHERE pair_id = ? AND growth_cycle_started_at = ?`,
        args: [decision.lineage, formatStoredTimestamp(monthRange.end), pairId, String(character.growth_cycle_started_at)],
      });
      if (updateResult.rowsAffected === 0) {
        return;
      }

      const usersResult = await db.execute({
        sql: "SELECT id FROM users WHERE pair_id = ? AND notifications_enabled = 1",
        args: [pairId],
      });
      await Promise.all(usersResult.rows.map((userRow) => notifyUser(db, config, String(userRow.id), "growth")));
    }),
  );
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

  await Promise.all(
    Array.from(groupedByRecipient.entries()).map(([key, recipientEvents]) => {
      const separatorIndex = key.lastIndexOf(":");
      const userId = key.slice(0, separatorIndex);
      const kind = key.slice(separatorIndex + 1) as RecipientEvent["kind"];
      const batchCount = groupWithinOneHour(recipientEvents).length;
      return Promise.all(
        Array.from({ length: batchCount }, () => notifyUser(db, config, userId, kind)),
      );
    }),
  );
}

async function collectQuietHourEvents(db: Db, window: { start: Date; end: Date }): Promise<RecipientEvent[]> {
  const windowStart = formatStoredTimestamp(window.start);
  const windowEnd = formatStoredTimestamp(window.end);
  const events: RecipientEvent[] = [];

  // 記録のお知らせは、記録した本人ではなく相手に届ける。相手がお知らせをオフにしていれば届けない。
  const choreLogsResult = await db.execute({
    sql: `SELECT partner.id AS partner_id, chore_logs.created_at AS created_at
          FROM chore_logs
          JOIN users AS partner ON partner.pair_id = chore_logs.pair_id AND partner.id != chore_logs.user_id
          WHERE chore_logs.created_at >= ? AND chore_logs.created_at < ? AND partner.notifications_enabled = 1`,
    args: [windowStart, windowEnd],
  });
  for (const row of choreLogsResult.rows) {
    events.push({
      recipientUserId: String(row.partner_id),
      kind: "chore_recorded",
      occurredAt: parseStoredTimestamp(row.created_at),
    });
  }

  // ありがとうのお届けは、記録した本人に届ける。本人がお知らせをオフにしていれば届けない。
  const thanksResult = await db.execute({
    sql: `SELECT chore_logs.user_id AS recipient_id, thanks.created_at AS created_at
          FROM thanks
          JOIN chore_logs ON thanks.chore_log_id = chore_logs.id
          JOIN users AS recipient ON recipient.id = chore_logs.user_id
          WHERE thanks.created_at >= ? AND thanks.created_at < ? AND recipient.notifications_enabled = 1`,
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
