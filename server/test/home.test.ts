import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
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

async function getHome(db: Db, account: TestAccount) {
  const res = await createApp(db).request("/api/home", {
    headers: { Authorization: account.authorization },
  });
  return { res, body: (await res.json()) as Record<string, unknown> };
}

async function recordChore(db: Db, account: TestAccount, choreType: string) {
  const res = await createApp(db).request("/api/chores", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: account.authorization },
    body: JSON.stringify({ choreType }),
  });
  return (await res.json()) as { id: string };
}

async function sendThanks(db: Db, account: TestAccount, choreLogId: string) {
  await createApp(db).request(`/api/chores/${choreLogId}/thanks`, {
    method: "POST",
    headers: { Authorization: account.authorization },
  });
}

describe("ホームの状態", () => {
  it("認証なしは401になる", async () => {
    const db = await createTestDb();
    const res = await createApp(db).request("/api/home");
    expect(res.status).toBe(401);
  });

  it("ひとり期間でも、自分のなつき度とゲージが返る", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const { res, body } = await getHome(db, account);
    expect(res.status).toBe(200);
    const myAffection = body.myAffection as { value: number; gestures: string[] };
    expect(myAffection.value).toBe(0);
    expect(myAffection.gestures).toEqual([]);
    expect(body.balanceGauge).toBe(1);
    expect(body.partnerLatestChore).toBeNull();
  });

  it("相手の直近の記録と、ありがとう済みかどうかを返す", async () => {
    const db = await createTestDb();
    const { a, b } = await registerPair(db, "彩花", "大樹");
    const log = await recordChore(db, a, "お皿洗い");

    const beforeThanks = await getHome(db, b);
    const partnerChoreBefore = beforeThanks.body.partnerLatestChore as {
      id: string;
      choreType: string;
      thanked: boolean;
    };
    expect(partnerChoreBefore.choreType).toBe("お皿洗い");
    expect(partnerChoreBefore.thanked).toBe(false);

    await sendThanks(db, b, log.id);

    const afterThanks = await getHome(db, b);
    const partnerChoreAfter = afterThanks.body.partnerLatestChore as { thanked: boolean };
    expect(partnerChoreAfter.thanked).toBe(true);
  });

  it("ありがとうが届くとゲージとなつき度が動く", async () => {
    const db = await createTestDb();
    const { a, b } = await registerPair(db, "彩花", "大樹");
    const logA = await recordChore(db, a, "お皿洗い");
    const logB = await recordChore(db, b, "ゴミ出し");

    await sendThanks(db, b, logA.id);
    await sendThanks(db, a, logB.id);

    const { body } = await getHome(db, a);
    expect(body.balanceGauge).toBe(1);
    const myAffection = body.myAffection as { value: number; gestures: string[] };
    // aは記録1回(+1)とありがとう1回(+1)で2。
    expect(myAffection.value).toBe(2);
  });

  it("なつき度が5に達すると仕草が1つ解放される", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");
    for (let i = 0; i < 5; i += 1) {
      await recordChore(db, account, "掃除");
    }

    const { body } = await getHome(db, account);
    const myAffection = body.myAffection as { value: number; gestures: string[] };
    expect(myAffection.value).toBe(5);
    expect(myAffection.gestures).toEqual(["facesPartner"]);
  });

  it("相手のなつき度・ふたりの記録回数・ゲージの生の回数を一切含まない", async () => {
    const db = await createTestDb();
    const { a, b } = await registerPair(db, "彩花", "大樹");
    const logA = await recordChore(db, a, "お皿洗い");
    await sendThanks(db, b, logA.id);

    const { body } = await getHome(db, a);
    const text = JSON.stringify(body);
    expect(body).not.toHaveProperty("partnerAffection");
    expect(body).not.toHaveProperty("recordCount");
    expect(body).not.toHaveProperty("totalRecords");
    expect(text).not.toMatch(/"a"\s*:\s*\d/);
    expect(text).not.toMatch(/"b"\s*:\s*\d/);
  });

  it("セリフに命令・催促・期限を示す表現が含まれない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const { body } = await getHome(db, account);
    const saborine = body.saborine as { serif: string };
    expect(saborine.serif).not.toMatch(/して(ください|!|。)?$/);
    expect(saborine.serif).not.toMatch(/しなさい|今すぐ|期限|までに/);
  });
});
