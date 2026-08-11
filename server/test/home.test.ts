import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db.js";
import {
  createTestDb,
  registerTestAccount,
  registerTestPair as registerPair,
  type TestAccount,
} from "./helpers.js";

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
    // ひとりのうちは息ぴったりも何も起きていないため空。画面でも帯は出さない。
    expect(body.balanceGauge).toBe(0);
    expect(body.todayEvents).toEqual([]);
  });

  it("ひとりだけのアカウントでは、ペア成立が偽になる", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const { body } = await getHome(db, account);
    expect(body.isPaired).toBe(false);
  });

  it("手紙を受諾して2人になったアカウントでは、双方でペア成立が真になる", async () => {
    const db = await createTestDb();
    const { a, b } = await registerPair(db, "彩花", "大樹");

    const { body: bodyA } = await getHome(db, a);
    const { body: bodyB } = await getHome(db, b);
    expect(bodyA.isPaired).toBe(true);
    expect(bodyB.isPaired).toBe(true);
  });

  it("迎えたばかりでは、まだ誰も記録していなくてもだらしなモードにならない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const { body } = await getHome(db, account);
    const saborine = body.saborine as { isSloppy: boolean };
    expect(saborine.isSloppy).toBe(false);
  });

  it("自分と相手の両方のきょうのできごとを、新しい順に返す", async () => {
    const db = await createTestDb();
    const { a, b } = await registerPair(db, "彩花", "大樹");
    await recordChore(db, a, "お皿洗い");
    await recordChore(db, b, "ゴミ出し");

    const { body } = await getHome(db, a);
    const todayEvents = body.todayEvents as Array<{ choreType: string; mine: boolean }>;
    expect(todayEvents).toEqual([
      { id: expect.any(String), choreType: "ゴミ出し", mine: false, thanked: false },
      { id: expect.any(String), choreType: "お皿洗い", mine: true, thanked: false },
    ]);
  });

  it("相手が3件記録し1件だけありがとうを送ると、真が1件・偽が2件になる", async () => {
    const db = await createTestDb();
    const { a, b } = await registerPair(db, "彩花", "大樹");
    const log1 = await recordChore(db, a, "お皿洗い");
    await recordChore(db, a, "洗濯");
    await recordChore(db, a, "掃除");
    await sendThanks(db, b, log1.id);

    const { body } = await getHome(db, b);
    const todayEvents = body.todayEvents as Array<{ mine: boolean; thanked: boolean }>;
    const partnerEvents = todayEvents.filter((event) => !event.mine);
    expect(partnerEvents).toHaveLength(3);
    expect(partnerEvents.filter((event) => event.thanked)).toHaveLength(1);
    expect(partnerEvents.filter((event) => !event.thanked)).toHaveLength(2);
  });

  it("きょうの相手の記録がすべてありがとう済みなら、セリフがthanksWaitingにならない", async () => {
    const db = await createTestDb();
    const { a, b } = await registerPair(db, "彩花", "大樹");
    const log = await recordChore(db, a, "お皿洗い");
    await sendThanks(db, b, log.id);

    const { body } = await getHome(db, b);
    const saborine = body.saborine as { serifKind: string };
    expect(saborine.serifKind).not.toBe("thanksWaiting");
  });

  it("きょうの相手の記録にまだありがとうを送っていないものがあれば、セリフがthanksWaitingになる", async () => {
    const db = await createTestDb();
    const { a, b } = await registerPair(db, "彩花", "大樹");
    await recordChore(db, a, "お皿洗い");

    const { body } = await getHome(db, b);
    const saborine = body.saborine as { serifKind: string };
    expect(saborine.serifKind).toBe("thanksWaiting");
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

  it("きょうのできごとの1件は、記録のID・家事の名前・自分のものか・ありがとう済みかの4項目だけを持つ", async () => {
    const db = await createTestDb();
    const { a, b } = await registerPair(db, "彩花", "大樹");
    await recordChore(db, a, "お皿洗い");

    const { body } = await getHome(db, b);
    const todayEvents = body.todayEvents as Array<Record<string, unknown>>;
    expect(todayEvents).toHaveLength(1);
    expect(Object.keys(todayEvents[0]!).sort()).toEqual(["choreType", "id", "mine", "thanked"]);
  });

  it("セリフに命令・催促・期限を示す表現が含まれない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const { body } = await getHome(db, account);
    const saborine = body.saborine as { serif: string };
    expect(saborine.serif).not.toMatch(/して(ください|!|。)?$/);
    expect(saborine.serif).not.toMatch(/しなさい|今すぐ|期限|までに/);
  });

  it("記録が24時間以上ない利用者では、serifKindが促しになる", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const { body } = await getHome(db, account);
    const saborine = body.saborine as { serifKind: string };
    expect(saborine.serifKind).toBe("nudge");
  });

  it("直近に自分が記録済みのふだんの状態では、serifKindが促しではない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");
    await recordChore(db, account, "掃除");

    const { body } = await getHome(db, account);
    const saborine = body.saborine as { serifKind: string };
    expect(saborine.serifKind).toBe("default");
  });

  it("だらしなモードのとき、serifKindがだらしなになる", async () => {
    const db = await createTestDb();
    const { a } = await registerPair(db, "彩花", "大樹");
    await db.execute({
      sql: "UPDATE characters SET created_at = ? WHERE pair_id = ?",
      args: ["2020-01-01 00:00:00", a.pairId],
    });

    const { body } = await getHome(db, a);
    const saborine = body.saborine as { isSloppy: boolean; serifKind: string };
    expect(saborine.isSloppy).toBe(true);
    expect(saborine.serifKind).toBe("sloppy");
  });

  it("応答に見せ方(跳ねる・動かす)を指示する項目が無い", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const { body } = await getHome(db, account);
    const saborine = body.saborine as Record<string, unknown>;
    expect(saborine).not.toHaveProperty("bounce");
    expect(saborine).not.toHaveProperty("shouldBounce");
    expect(saborine).not.toHaveProperty("animate");
  });

  it("いまの育ち具合が0以上1以下の数値で返る", async () => {
    const db = await createTestDb();
    const { a } = await registerPair(db, "彩花", "大樹");
    await recordChore(db, a, "掃除");

    const { body } = await getHome(db, a);
    const saborine = body.saborine as { growthProgress: number };
    expect(typeof saborine.growthProgress).toBe("number");
    expect(saborine.growthProgress).toBeGreaterThanOrEqual(0);
    expect(saborine.growthProgress).toBeLessThanOrEqual(1);
  });

  it("キャラクターの行がまだ無いときも、育ち具合が0で応答が壊れない", async () => {
    const db = await createTestDb();
    const { a } = await registerPair(db, "彩花", "大樹");
    await db.execute({ sql: "DELETE FROM characters WHERE pair_id = ?", args: [a.pairId] });

    const { res, body } = await getHome(db, a);
    expect(res.status).toBe(200);
    const saborine = body.saborine as { growthProgress: number };
    expect(saborine.growthProgress).toBe(0);
  });

  it("saborineが持つキーは、名前・だらしな・進化の段階・系統・セリフ・育ち具合のちょうど7つだけ", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const { body } = await getHome(db, account);
    const saborine = body.saborine as Record<string, unknown>;
    expect(Object.keys(saborine).sort()).toEqual(
      [
        "evolutionLineage",
        "evolutionStage",
        "growthProgress",
        "isSloppy",
        "name",
        "serif",
        "serifKind",
      ].sort(),
    );
  });
});
