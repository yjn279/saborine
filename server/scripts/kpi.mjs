// 事業の数字を出す(docs/business.md「事業の指標」)。データベースを読むだけで、何も書き換えない。
// 週に一度これを実行し、北極星指標とファネルの各段を、置いた目標と見比べる。
//
// 使い方:
//   node server/scripts/kpi.mjs "$(turso db show saborine --url)?authToken=$(turso db tokens create saborine)"
//
// 出さないもの: 「どちらが何回やったか」を比べる集計。プロダクトが持たないものは事業指標でも
// 作らない(docs/business.md)。数えるのはすべてペア単位である。

import { createClient } from "@libsql/client";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const CONVERSION_WINDOW_DAYS = 7;
const RETENTION_WEEKS = 4;

// docs/business.md のファネルに置いた仮置きの目標。実測で置き換えるまでの見比べ用。
const TARGETS = {
  paired: 0.5,
  switched: 0.6,
  reciprocal: 0.5,
  retained: 0.35,
};

function toJstDate(stored) {
  const utc = new Date(`${String(stored).replace(" ", "T")}Z`);
  return new Date(utc.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

function toDate(stored) {
  return new Date(`${String(stored).replace(" ", "T")}Z`);
}

function ratio(part, whole) {
  return whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`;
}

function judge(part, whole, target) {
  if (whole === 0) {
    return "—";
  }
  return part / whole >= target ? "達成" : "未達";
}

const url = process.argv[2];
if (!url) {
  console.error("データベースの宛先を渡してください。使い方はこのファイルの先頭にあります。");
  process.exit(1);
}

const client = createClient({ url });

try {
  const [pairs, users, chores, thanks] = await Promise.all([
    client.execute("SELECT id, established_at, created_at FROM pairs"),
    client.execute("SELECT id, pair_id, created_at FROM users ORDER BY created_at, rowid"),
    client.execute("SELECT pair_id, user_id, created_at FROM chore_logs"),
    client.execute(
      `SELECT c.pair_id AS pair_id, t.user_id AS user_id, t.created_at AS created_at
       FROM thanks t JOIN chore_logs c ON c.id = t.chore_log_id`,
    ),
  ]);

  if (pairs.rows.length === 0) {
    console.log("まだ1組も始まっていません。");
    process.exit(0);
  }

  const now = new Date();
  const usersByPair = new Map();
  for (const user of users.rows) {
    const list = usersByPair.get(user.pair_id) ?? [];
    list.push(user);
    usersByPair.set(user.pair_id, list);
  }

  function groupByPair(rows) {
    const grouped = new Map();
    for (const row of rows) {
      const list = grouped.get(row.pair_id) ?? [];
      list.push(row);
      grouped.set(row.pair_id, list);
    }
    return grouped;
  }
  const choresByPair = groupByPair(chores.rows);
  const thanksByPair = groupByPair(thanks.rows);

  // 同じ日のうちに、ふたりとも相手へありがとうを送った日を「往復した日」とする。
  function reciprocalDays(pairId) {
    const byDay = new Map();
    for (const row of thanksByPair.get(pairId) ?? []) {
      const day = toJstDate(row.created_at);
      const senders = byDay.get(day) ?? new Set();
      senders.add(row.user_id);
      byDay.set(day, senders);
    }
    return [...byDay.entries()].filter(([, senders]) => senders.size >= 2).map(([day]) => day);
  }

  let paired = 0;
  let switched = 0;
  let reciprocal = 0;
  let retainedEligible = 0;
  let retained = 0;
  let reciprocalThisWeek = 0;
  let reciprocalLastWeek = 0;

  const thisWeekStart = new Date(now.getTime() - 7 * DAY_MS);
  const lastWeekStart = new Date(now.getTime() - 14 * DAY_MS);

  for (const pair of pairs.rows) {
    const members = usersByPair.get(pair.id) ?? [];
    const invitee = members[1];
    if (!invitee) {
      continue;
    }
    paired += 1;

    // 招待された側(しない側)が、受諾から7日以内に自分で記録したか。
    const inviteeJoined = toDate(invitee.created_at);
    const inviteeChores = (choresByPair.get(pair.id) ?? []).filter((row) => row.user_id === invitee.id);
    const firstInviteeChore = inviteeChores
      .map((row) => toDate(row.created_at))
      .sort((a, b) => a - b)[0];
    if (firstInviteeChore && firstInviteeChore - inviteeJoined <= CONVERSION_WINDOW_DAYS * DAY_MS) {
      switched += 1;
    }

    const days = reciprocalDays(pair.id);
    if (days.length > 0) {
      reciprocal += 1;
    }
    if (days.some((day) => new Date(`${day}T00:00:00Z`) >= thisWeekStart)) {
      reciprocalThisWeek += 1;
    }
    if (
      days.some((day) => {
        const date = new Date(`${day}T00:00:00Z`);
        return date >= lastWeekStart && date < thisWeekStart;
      })
    ) {
      reciprocalLastWeek += 1;
    }

    // 4週続いたか。成立から4週が過ぎた組だけを分母に数える。
    const established = toDate(pair.established_at ?? pair.created_at);
    if (now - established >= RETENTION_WEEKS * 7 * DAY_MS) {
      retainedEligible += 1;
      const fourWeeksLater = new Date(established.getTime() + RETENTION_WEEKS * 7 * DAY_MS);
      const activeAfter = [...(choresByPair.get(pair.id) ?? []), ...(thanksByPair.get(pair.id) ?? [])].some(
        (row) => toDate(row.created_at) >= fourWeeksLater,
      );
      if (activeAfter) {
        retained += 1;
      }
    }
  }

  const registered = pairs.rows.length;

  const today = new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
  console.log(`# saborine 事業の数字(${today} 時点・日本時間)\n`);
  console.log("## 北極星指標: その週に感謝が往復したペアの数\n");
  console.log(`- 直近7日: **${reciprocalThisWeek}組**`);
  console.log(`- その前の7日: ${reciprocalLastWeek}組\n`);

  console.log("## ファネル\n");
  console.log("| 段 | 実測 | 割合 | 目標 | 判定 |");
  console.log("| :-- | :-- | :-- | :-- | :-- |");
  console.log(`| 使いはじめる(登録したペア) | ${registered}組 | — | — | — |`);
  console.log(
    `| ペアが成立する | ${paired}/${registered}組 | ${ratio(paired, registered)} | ${TARGETS.paired * 100}% | ${judge(paired, registered, TARGETS.paired)} |`,
  );
  console.log(
    `| しない側が自分で記録する | ${switched}/${paired}組 | ${ratio(switched, paired)} | ${TARGETS.switched * 100}% | ${judge(switched, paired, TARGETS.switched)} |`,
  );
  console.log(
    `| 感謝が往復する | ${reciprocal}/${paired}組 | ${ratio(reciprocal, paired)} | ${TARGETS.reciprocal * 100}% | ${judge(reciprocal, paired, TARGETS.reciprocal)} |`,
  );
  console.log(
    `| 4週間続く | ${retained}/${retainedEligible}組 | ${ratio(retained, retainedEligible)} | ${TARGETS.retained * 100}% | ${judge(retained, retainedEligible, TARGETS.retained)} |`,
  );
  console.log("");
  console.log(
    "「4週間続く」の分母は、成立から4週が過ぎた組だけである。まだ4週たっていない組はここに数えない。",
  );
  console.log(
    "紹介ページに着いた人のうち何人が登録したかは、このデータベースには無い。Cloudflare の記録で見る。",
  );
} finally {
  client.close();
}
