import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { authMiddleware } from "../auth.js";
import { formatStoredTimestamp, parseStoredTimestamp } from "../db.js";
import { calcBalanceGauge } from "../domain/gauge.js";
import { unlockedGestures } from "../domain/affection.js";
import { isSloppyMode } from "../domain/mood.js";
import { pickLine } from "../domain/lines.js";
import { hasUnthankedPartnerEvent, selectTodayEvents, type ChoreLogRecord } from "../domain/today.js";

const GAUGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_RECORD_WINDOW_MS = 24 * 60 * 60 * 1000;

export function createHomeRoutes() {
  const routes = new Hono<AppEnv>();

  // ホーム画面の全状態を1回で返す。相手のなつき度・ふたりの記録回数・ゲージの回数そのものは含めない。
  routes.get("/", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const now = new Date();

    const [characterResult, affectionResult, partnerResult, chorePairResult] = await Promise.all([
      db.execute({
        sql: "SELECT name, evolution_stage, evolution_lineage, created_at FROM characters WHERE pair_id = ?",
        args: [user.pairId],
      }),
      db.execute({
        sql: "SELECT value FROM affections WHERE user_id = ?",
        args: [user.id],
      }),
      db.execute({
        sql: "SELECT id, display_name FROM users WHERE pair_id = ? AND id != ?",
        args: [user.pairId, user.id],
      }),
      db.execute({
        // created_at(秒精度)だけでは同じ秒の記録の前後が決まらないため、挿入順どおりに増える
        // rowidを第二キーにして並べ、最後に読んだ行を「直近」として扱えるようにする。
        sql: "SELECT id, user_id, chore_type, created_at FROM chore_logs WHERE pair_id = ? ORDER BY created_at ASC, rowid ASC",
        args: [user.pairId],
      }),
    ]);

    const character = characterResult.rows[0];
    const myAffectionValue = Number(affectionResult.rows[0]?.value ?? 0);
    const partner = partnerResult.rows[0];
    const partnerId = partner ? String(partner.id) : null;
    // サボリーヌを迎えた瞬間(=だらしなモードの起算点)。まだ一度も記録が無い側の
    // 「最後の記録時刻」は、この時刻で代用する。0ならnullではなく起算点そのものを
    // 使うことで、迎えたばかりのサボリーヌが開口一番だらしない姿にならないようにする。
    const characterCreatedAt = character ? parseStoredTimestamp(character.created_at) : now;

    // 行の時刻は一度だけ読み解き、最後の記録時刻ときょうのできごとの両方に使い回す。
    const parsedChoreRows = chorePairResult.rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      choreType: String(row.chore_type),
      createdAt: parseStoredTimestamp(row.created_at),
    }));

    // ユーザーごとの最後の記録時刻(だらしなモード判定用)を、記録一覧から求める。
    // 行はcreated_at, rowidの昇順で来るため、同じ秒でも最後に読んだ行が最新になる。
    let myLastRecordAt: Date | null = null;
    let partnerLastRecordAt: Date | null = null;
    for (const row of parsedChoreRows) {
      if (row.userId === user.id) {
        if (myLastRecordAt === null || row.createdAt >= myLastRecordAt) {
          myLastRecordAt = row.createdAt;
        }
      } else if (row.userId === partnerId) {
        if (partnerLastRecordAt === null || row.createdAt >= partnerLastRecordAt) {
          partnerLastRecordAt = row.createdAt;
        }
      }
    }

    const isSloppy = isSloppyMode(
      myLastRecordAt ?? characterCreatedAt,
      partnerLastRecordAt ?? characterCreatedAt,
      now,
    );

    // 息ぴったりゲージときょうのできごとの「ありがとう済みか」は、どちらも直近7日にペアの
    // 各記録へ届いたありがとうから求まる(記録から届くまでが7日を超えることはない)ため、1回の
    // 読み出しで両方をまかなう。
    const gaugeWindowStart = new Date(now.getTime() - GAUGE_WINDOW_MS);
    const thanksResult =
      chorePairResult.rows.length > 0
        ? await db.execute({
            sql: `SELECT thanks.chore_log_id AS chore_log_id, chore_logs.user_id AS recipient
                  FROM thanks
                  JOIN chore_logs ON thanks.chore_log_id = chore_logs.id
                  WHERE chore_logs.pair_id = ? AND thanks.created_at >= ?`,
            args: [user.pairId, formatStoredTimestamp(gaugeWindowStart)],
          })
        : null;

    let myRecentThanksCount = 0;
    let partnerRecentThanksCount = 0;
    const thankedChoreLogIds = new Set<string>();
    for (const row of thanksResult?.rows ?? []) {
      const recipient = String(row.recipient);
      if (recipient === user.id) {
        myRecentThanksCount += 1;
      } else if (recipient === partnerId) {
        partnerRecentThanksCount += 1;
      }
      thankedChoreLogIds.add(String(row.chore_log_id));
    }
    const balanceGauge = calcBalanceGauge(myRecentThanksCount, partnerRecentThanksCount);

    // parsedChoreRowsは古い順(created_at, rowidの昇順)なので、そのまま反転すれば新しい順になる。
    // created_at(秒精度)が同じ記録が並んでも、rowidによる前後がここで保たれる。
    const choreLogRecords: ChoreLogRecord[] = parsedChoreRows
      .map((row) => ({
        ...row,
        thanked: thankedChoreLogIds.has(row.id),
      }))
      .reverse();
    const todayEvents = selectTodayEvents(choreLogRecords, user.id, now);

    const hasRecordedRecently =
      myLastRecordAt !== null && now.getTime() - myLastRecordAt.getTime() < RECENT_RECORD_WINDOW_MS;
    const line = pickLine({
      isSloppy,
      hasUnthankedPartnerChore: hasUnthankedPartnerEvent(todayEvents),
      hasRecordedRecently,
      pairId: user.pairId,
      now,
    });

    return c.json({
      isPaired: partner !== undefined,
      saborine: {
        name: character ? String(character.name) : null,
        isSloppy,
        evolutionStage: Number(character?.evolution_stage ?? 0),
        evolutionLineage: character?.evolution_lineage ? String(character.evolution_lineage) : null,
        serif: line.text,
        serifKind: line.kind,
      },
      balanceGauge,
      myAffection: {
        value: myAffectionValue,
        gestures: unlockedGestures(myAffectionValue),
      },
      todayEvents,
    });
  });

  return routes;
}
