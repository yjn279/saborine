// ベータテストの日次ログを作る(docs/beta.md「日次の観察とログ」)。
// データベースを読むだけで、何も書き換えない。毎日21時にこれを実行し、
// 出てきた表をそのままログに貼り、気づいたことを「特記」に書き足す。
//
// 使い方:
//   node server/scripts/beta-log.mjs "$(turso db show saborine --url)?authToken=$(turso db tokens create saborine)"
//
// 出さないもの: 「どちらが何回やったか」を比べる集計。プロダクトが持たないものは
// 運用でも作らない(docs/mvp.md「持たないデータ」)。この表が数えるのは、その日に
// 何が起きたかという事実だけである。

import { createClient } from "@libsql/client";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const SLACKING_THRESHOLD_DAYS = 3;

// SQLiteのCURRENT_TIMESTAMP("YYYY-MM-DD HH:MM:SS"、UTC)を日本時間の日付にする。
function toJstDate(stored) {
  const utc = new Date(`${String(stored).replace(" ", "T")}Z`);
  return new Date(utc.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayInJst() {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

const url = process.argv[2];
if (!url) {
  console.error("データベースの宛先を渡してください。使い方はこのファイルの先頭にあります。");
  process.exit(1);
}

const client = createClient({ url });

try {
  const pairs = await client.execute(
    "SELECT id, established_at, created_at FROM pairs ORDER BY created_at",
  );

  if (pairs.rows.length === 0) {
    console.log("まだ1組も始まっていません。");
    process.exit(0);
  }

  const today = todayInJst();
  console.log(`# ベータ 日次ログ(${today} 時点・日本時間)\n`);

  for (const [index, pair] of pairs.rows.entries()) {
    // ペアに先にいるのが招待した側(する側)、後から加わったのが招待された側(しない側)。
    const users = await client.execute({
      sql: "SELECT id, display_name FROM users WHERE pair_id = ? ORDER BY created_at, rowid",
      args: [pair.id],
    });
    const inviter = users.rows[0];
    const invitee = users.rows[1];

    const chores = await client.execute({
      sql: "SELECT user_id, chore_type, created_at FROM chore_logs WHERE pair_id = ? ORDER BY created_at",
      args: [pair.id],
    });
    const thanks = await client.execute({
      sql: `SELECT t.user_id, t.created_at
            FROM thanks t JOIN chore_logs c ON c.id = t.chore_log_id
            WHERE c.pair_id = ? ORDER BY t.created_at`,
      args: [pair.id],
    });

    const nameOf = new Map(users.rows.map((user) => [user.id, user.display_name]));
    const startDate = toJstDate(pair.created_at);

    console.log(`## 組${index + 1}`);
    console.log(
      `- する側(招待した人): ${inviter?.display_name ?? "—"} / しない側(招待された人): ${invitee?.display_name ?? "まだ受諾されていません"}`,
    );
    console.log(
      `- 開始: ${startDate}${pair.established_at ? ` / ペア成立: ${toJstDate(pair.established_at)}` : " / ペア未成立"}`,
    );
    console.log("");
    console.log("| 日 | 日付 | 記録した人 | ありがとうを送った人 | 感謝の往復 | だらしなモード |");
    console.log("| :-- | :-- | :-- | :-- | :-: | :-: |");

    let firstInviteeChoreDay = null;
    let firstReciprocalDay = null;
    let quietStreak = 0;
    let longestQuietStreak = 0;

    for (let day = 0; ; day += 1) {
      const date = addDays(startDate, day);
      if (date > today) {
        break;
      }

      const choresToday = chores.rows.filter((row) => toJstDate(row.created_at) === date);
      const thanksToday = thanks.rows.filter((row) => toJstDate(row.created_at) === date);
      const choreSenders = [...new Set(choresToday.map((row) => row.user_id))];
      const thanksSenders = [...new Set(thanksToday.map((row) => row.user_id))];

      if (invitee && firstInviteeChoreDay === null && choreSenders.includes(invitee.id)) {
        firstInviteeChoreDay = day;
      }
      // 同じ日のうちに、ふたりとも相手へありがとうを送った状態を往復とみなす。
      const reciprocal = thanksSenders.length === 2;
      if (reciprocal && firstReciprocalDay === null) {
        firstReciprocalDay = day;
      }

      if (choresToday.length === 0 && thanksToday.length === 0) {
        quietStreak += 1;
        longestQuietStreak = Math.max(longestQuietStreak, quietStreak);
      } else {
        quietStreak = 0;
      }

      // だらしなモード: ふたりとも記録が3日途切れた状態(docs/mvp.md)。
      const lastChoreBefore = chores.rows.filter((row) => toJstDate(row.created_at) <= date).pop();
      const daysSinceChore = lastChoreBefore
        ? (new Date(`${date}T00:00:00Z`) - new Date(`${toJstDate(lastChoreBefore.created_at)}T00:00:00Z`)) /
          86_400_000
        : day;
      const slacking = daysSinceChore >= SLACKING_THRESHOLD_DAYS;

      const label = (ids) => (ids.length === 0 ? "—" : ids.map((id) => nameOf.get(id) ?? "?").join("・"));
      console.log(
        `| Day ${day} | ${date} | ${label(choreSenders)} | ${label(thanksSenders)} | ${reciprocal ? "○" : "—"} | ${slacking ? "○" : "—"} |`,
      );
    }

    console.log("");
    console.log(
      `- しない側の初回記録: ${firstInviteeChoreDay === null ? "まだ" : `Day ${firstInviteeChoreDay}`}(自発かどうかはDay7の聞き取りで裏を取る)`,
    );
    console.log(
      `- 感謝の往復の初回: ${firstReciprocalDay === null ? "まだ" : `Day ${firstReciprocalDay}`}`,
    );
    console.log(
      `- 何も起きなかった日の最長連続: ${longestQuietStreak}日${longestQuietStreak >= 3 ? "(離脱の兆候。3日以上が続き、振り返りにも応じない場合は離脱1組と数える)" : ""}`,
    );
    console.log("- 特記: ");
    console.log("");
  }
} finally {
  client.close();
}
