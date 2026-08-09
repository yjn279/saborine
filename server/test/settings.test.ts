import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestCredential, createTestDb, registerTestAccount } from "./helpers.js";

describe("設定の取得と変更", () => {
  it("認証なしの要求は401になる", async () => {
    const db = await createTestDb();
    const getRes = await createApp(db).request("/api/settings");
    expect(getRes.status).toBe(401);
    const patchRes = await createApp(db).request("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationsEnabled: false }),
    });
    expect(patchRes.status).toBe(401);
  });

  it("初期値は通知オン・キャラクター名はサボリーヌ", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const res = await createApp(db).request("/api/settings", {
      headers: { Authorization: account.authorization },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { notificationsEnabled: boolean; characterName: string };
    expect(body.notificationsEnabled).toBe(true);
    expect(body.characterName).toBe("サボリーヌ");
  });

  it("通知のオン・オフだけを変更できる", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const res = await createApp(db).request("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: account.authorization },
      body: JSON.stringify({ notificationsEnabled: false }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { notificationsEnabled: boolean; characterName: string };
    expect(body.notificationsEnabled).toBe(false);
    expect(body.characterName).toBe("サボリーヌ");

    const stored = await db.execute({
      sql: "SELECT notifications_enabled FROM users WHERE id = ?",
      args: [account.userId],
    });
    expect(Number(stored.rows[0]?.notifications_enabled)).toBe(0);
  });

  it("サボリーヌの名前だけを変更できる", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const res = await createApp(db).request("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: account.authorization },
      body: JSON.stringify({ characterName: "まろん" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { notificationsEnabled: boolean; characterName: string };
    expect(body.characterName).toBe("まろん");
    expect(body.notificationsEnabled).toBe(true);
  });

  it("空の名前や項目なしの変更は失敗する", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const empty = await createApp(db).request("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: account.authorization },
      body: JSON.stringify({ characterName: "  " }),
    });
    expect(empty.status).toBe(400);

    const nothing = await createApp(db).request("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: account.authorization },
      body: JSON.stringify({}),
    });
    expect(nothing.status).toBe(400);
  });

  it("通知・催促・タスク割当に類する項目を持たない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const res = await createApp(db).request("/api/settings", {
      headers: { Authorization: account.authorization },
    });
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["characterName", "notificationsEnabled"]);
  });
});

describe("ペア解除", () => {
  it("認証なしの要求は401になる", async () => {
    const db = await createTestDb();
    const res = await createApp(db).request("/api/pair", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("実行するとペア・サボリーヌ・両方のユーザーが消え、元の状態へ戻らない", async () => {
    const db = await createTestDb();
    const inviter = await registerTestAccount(db, "彩花");
    const letterRes = await createApp(db).request("/api/invite/letter", {
      headers: { Authorization: inviter.authorization },
    });
    const { token } = (await letterRes.json()) as { token: string };
    const invitee = createTestCredential();
    await createApp(db).request(`/api/invite/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "大樹", userId: invitee.userId, secret: invitee.secret }),
    });
    await createApp(db).request("/api/chores", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: inviter.authorization },
      body: JSON.stringify({ choreType: "お皿洗い" }),
    });

    const res = await createApp(db).request("/api/pair", {
      method: "DELETE",
      headers: { Authorization: inviter.authorization },
    });
    expect(res.status).toBe(204);

    const pairs = await db.execute({ sql: "SELECT id FROM pairs WHERE id = ?", args: [inviter.pairId] });
    const users = await db.execute({ sql: "SELECT id FROM users WHERE pair_id = ?", args: [inviter.pairId] });
    const characters = await db.execute({
      sql: "SELECT id FROM characters WHERE pair_id = ?",
      args: [inviter.pairId],
    });
    const choreLogs = await db.execute({
      sql: "SELECT id FROM chore_logs WHERE pair_id = ?",
      args: [inviter.pairId],
    });
    expect(pairs.rows).toHaveLength(0);
    expect(users.rows).toHaveLength(0);
    expect(characters.rows).toHaveLength(0);
    expect(choreLogs.rows).toHaveLength(0);

    const meRes = await createApp(db).request("/api/account/me", {
      headers: { Authorization: inviter.authorization },
    });
    expect(meRes.status).toBe(401);
    const partnerMeRes = await createApp(db).request("/api/account/me", {
      headers: { Authorization: invitee.authorization },
    });
    expect(partnerMeRes.status).toBe(401);
  });
});

describe("アカウント削除", () => {
  it("認証なしの要求は401になる", async () => {
    const db = await createTestDb();
    const res = await createApp(db).request("/api/account", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("自分だけが消え、以後は同じトークンで何もできない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const res = await createApp(db).request("/api/account", {
      method: "DELETE",
      headers: { Authorization: account.authorization },
    });
    expect(res.status).toBe(204);

    const users = await db.execute({ sql: "SELECT id FROM users WHERE id = ?", args: [account.userId] });
    expect(users.rows).toHaveLength(0);

    const meRes = await createApp(db).request("/api/account/me", {
      headers: { Authorization: account.authorization },
    });
    expect(meRes.status).toBe(401);
  });

  it("相手のアカウントとサボリーヌはペアに残る(ひとり期間と同じ形)", async () => {
    const db = await createTestDb();
    const inviter = await registerTestAccount(db, "彩花");
    const letterRes = await createApp(db).request("/api/invite/letter", {
      headers: { Authorization: inviter.authorization },
    });
    const { token } = (await letterRes.json()) as { token: string };
    const invitee = createTestCredential();
    await createApp(db).request(`/api/invite/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "大樹", userId: invitee.userId, secret: invitee.secret }),
    });

    await createApp(db).request("/api/account", {
      method: "DELETE",
      headers: { Authorization: invitee.authorization },
    });

    const meRes = await createApp(db).request("/api/account/me", {
      headers: { Authorization: inviter.authorization },
    });
    expect(meRes.status).toBe(200);
    const characters = await db.execute({
      sql: "SELECT id FROM characters WHERE pair_id = ?",
      args: [inviter.pairId],
    });
    expect(characters.rows).toHaveLength(1);
  });
});
