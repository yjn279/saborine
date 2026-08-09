import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { CHORE_PRESETS } from "../src/domain/presets.js";
import { calcGrowthPoints } from "../src/domain/growth.js";
import type { Db } from "../src/db.js";
import { createTestDb, registerTestAccount, type TestAccount } from "./helpers.js";

// 手紙の受諾フローを通して、実際にペアになったふたりぶんのアカウントを作る。
async function registerPair(
  db: Db,
  nameA: string,
  nameB: string,
): Promise<{ a: TestAccount; b: TestAccount }> {
  const a = await registerTestAccount(db, nameA);
  const letterRes = await createApp(db).request("/api/invite/letter", {
    headers: { Authorization: a.authorization },
  });
  const { token } = (await letterRes.json()) as { token: string };

  const bUserId = crypto.randomUUID();
  const bSecret = crypto.randomUUID();
  const acceptRes = await createApp(db).request(`/api/invite/${token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: nameB, userId: bUserId, secret: bSecret }),
  });
  const acceptBody = (await acceptRes.json()) as { pairId: string; characterId: string };

  const b: TestAccount = {
    userId: bUserId,
    secret: bSecret,
    authorization: `Bearer ${bUserId}:${bSecret}`,
    pairId: acceptBody.pairId,
    characterId: acceptBody.characterId,
  };
  return { a, b };
}

async function recordChore(db: Db, account: TestAccount, choreType: string) {
  const res = await createApp(db).request("/api/chores", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: account.authorization },
    body: JSON.stringify({ choreType }),
  });
  return { res, body: (await res.json()) as { id: string } };
}

describe("家事プリセット", () => {
  it("6種を返し、自由入力用の枠は別に持たない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const res = await createApp(db).request("/api/chores/presets", {
      headers: { Authorization: account.authorization },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { presets: string[] };
    expect(body.presets).toHaveLength(6);
    expect(body.presets).toEqual(CHORE_PRESETS);
  });

  it("使った順に並び替わる", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    await recordChore(db, account, "掃除");
    await recordChore(db, account, "料理");

    const res = await createApp(db).request("/api/chores/presets", {
      headers: { Authorization: account.authorization },
    });
    const body = (await res.json()) as { presets: string[] };
    expect(body.presets[0]).toBe("料理");
    expect(body.presets[1]).toBe("掃除");
    expect(body.presets).toHaveLength(6);
  });

  it("自由入力した内容はプリセット一覧に混ざらない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    await recordChore(db, account, "植木の水やり");

    const res = await createApp(db).request("/api/chores/presets", {
      headers: { Authorization: account.authorization },
    });
    const body = (await res.json()) as { presets: string[] };
    expect(body.presets).toEqual(CHORE_PRESETS);
  });

  it("認証なしは401になる", async () => {
    const db = await createTestDb();
    const res = await createApp(db).request("/api/chores/presets");
    expect(res.status).toBe(401);
  });
});

describe("家事の記録", () => {
  it("プリセットでも自由入力でも記録でき、自分のなつき度が+1される", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const { res } = await recordChore(db, account, "植木の水やり");
    expect(res.status).toBe(201);

    const affection = await db.execute({
      sql: "SELECT value FROM affections WHERE user_id = ?",
      args: [account.userId],
    });
    expect(Number(affection.rows[0]?.value)).toBe(1);
  });

  it("空文字は400になる", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const { res } = await recordChore(db, account, "   ");
    expect(res.status).toBe(400);
  });

  it("認証なしは401になる", async () => {
    const db = await createTestDb();
    const res = await createApp(db).request("/api/chores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choreType: "掃除" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("ありがとう", () => {
  it("自分の記録に自分でありがとうを送れない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");
    const { body } = await recordChore(db, account, "掃除");

    const res = await createApp(db).request(`/api/chores/${body.id}/thanks`, {
      method: "POST",
      headers: { Authorization: account.authorization },
    });
    expect(res.status).toBe(400);
  });

  it("同じ記録に2回目のありがとうを送れない", async () => {
    const db = await createTestDb();
    const { a, b } = await registerPair(db, "彩花", "大樹");
    const { body } = await recordChore(db, a, "掃除");

    const first = await createApp(db).request(`/api/chores/${body.id}/thanks`, {
      method: "POST",
      headers: { Authorization: b.authorization },
    });
    expect(first.status).toBe(201);

    const second = await createApp(db).request(`/api/chores/${body.id}/thanks`, {
      method: "POST",
      headers: { Authorization: b.authorization },
    });
    expect(second.status).toBe(409);
  });

  it("存在しない記録へのありがとうは404になる", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");
    const res = await createApp(db).request("/api/chores/no-such-id/thanks", {
      method: "POST",
      headers: { Authorization: account.authorization },
    });
    expect(res.status).toBe(404);
  });

  it("ありがとうが1件増えると、なつき度と成長ポイントが式どおりに動く", async () => {
    const db = await createTestDb();
    const { a, b } = await registerPair(db, "彩花", "大樹");

    const first = await recordChore(db, a, "掃除");
    const second = await recordChore(db, b, "ゴミ出し");

    await createApp(db).request(`/api/chores/${first.body.id}/thanks`, {
      method: "POST",
      headers: { Authorization: b.authorization },
    });
    await createApp(db).request(`/api/chores/${second.body.id}/thanks`, {
      method: "POST",
      headers: { Authorization: a.authorization },
    });

    const affectionB = await db.execute({
      sql: "SELECT value FROM affections WHERE user_id = ?",
      args: [b.userId],
    });
    // bは記録1回(+1)とありがとう1回(+1)で2。
    expect(Number(affectionB.rows[0]?.value)).toBe(2);

    const character = await db.execute({
      sql: "SELECT total_growth_points FROM characters WHERE pair_id = ?",
      args: [a.pairId],
    });
    // A=1(aの記録に届いたありがとう)、B=1(bの記録に届いたありがとう) → 1+1+2×min(1,1)=4。
    expect(Number(character.rows[0]?.total_growth_points)).toBe(calcGrowthPoints(1, 1));
  });
});
