import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestCredential, createTestDb, registerTestAccount } from "./helpers.js";

describe("表示名だけの登録", () => {
  it("表示名だけを送ると登録が成功し、ユーザー・ペア・サボリーヌが1組できる", async () => {
    const db = await createTestDb();
    const credential = createTestCredential();

    const res = await createApp(db).request("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "ゆうじ",
        userId: credential.userId,
        secret: credential.secret,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      userId: string;
      displayName: string;
      pairId: string;
      characterId: string;
    };
    expect(body.displayName).toBe("ゆうじ");

    const users = await db.execute("SELECT id FROM users");
    const pairs = await db.execute("SELECT id FROM pairs");
    const characters = await db.execute("SELECT id, pair_id FROM characters");
    expect(users.rows).toHaveLength(1);
    expect(pairs.rows).toHaveLength(1);
    expect(characters.rows).toHaveLength(1);
    expect(String(characters.rows[0]?.pair_id)).toBe(body.pairId);
  });

  it("入力項目が表示名(と端末が作るID・合言葉)のみで、メールアドレスやパスワードを要求しない", async () => {
    const db = await createTestDb();
    const credential = createTestCredential();

    // メールアドレス・パスワードを一切送らなくても登録が成立することを確認する。
    const res = await createApp(db).request("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "みさき",
        userId: credential.userId,
        secret: credential.secret,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("password");
  });

  it("合言葉が平文のまま保存されていない", async () => {
    const db = await createTestDb();
    const credential = createTestCredential();

    await registerTestAccount(db, "はると");
    const res = await createApp(db).request("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "はると",
        userId: credential.userId,
        secret: credential.secret,
      }),
    });
    expect(res.status).toBe(201);

    const result = await db.execute({
      sql: "SELECT secret_hash FROM users WHERE id = ?",
      args: [credential.userId],
    });
    const storedHash = String(result.rows[0]?.secret_hash);
    expect(storedHash).not.toBe(credential.secret);
    // SHA-256の16進表現(32バイト=64文字)であることを確認し、単なる別形式の平文保存でないことを保証する。
    expect(storedHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("同じ身分証で送り直しても、ペアは増えず前回の登録が返る", async () => {
    // 応答が届かずクライアントがやり直したときの経路。ここで新しく作ってしまうと、
    // 前回できたペアが誰も辿れないまま残り、サボリーヌが行方不明になる。
    const db = await createTestDb();
    const credential = createTestCredential();
    const app = createApp(db);
    const body = JSON.stringify({
      displayName: "ゆうじ",
      userId: credential.userId,
      secret: credential.secret,
    });
    const send = () =>
      app.request("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

    const first = await send();
    expect(first.status).toBe(201);
    const firstJson = (await first.json()) as { pairId: string; characterId: string };

    const second = await send();
    expect(second.status).toBe(200);
    const secondJson = (await second.json()) as { pairId: string; characterId: string };
    expect(secondJson.pairId).toBe(firstJson.pairId);
    expect(secondJson.characterId).toBe(firstJson.characterId);

    const pairs = await db.execute("SELECT COUNT(*) as count FROM pairs");
    expect(Number(pairs.rows[0]?.count)).toBe(1);
  });

  it("同じIDでも合言葉が違えば断る", async () => {
    const db = await createTestDb();
    const credential = createTestCredential();
    await registerTestAccount(db, "ゆうじ");
    const owner = await db.execute("SELECT id FROM users LIMIT 1");

    const res = await createApp(db).request("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "べつじん",
        userId: String(owner.rows[0]?.id),
        secret: credential.secret,
      }),
    });

    expect(res.status).toBe(409);
  });
});

describe("認証", () => {
  it("トークンなしの要求は401で失敗する", async () => {
    const db = await createTestDb();
    const res = await createApp(db).request("/api/account/me");
    expect(res.status).toBe(401);
  });

  it("誤った合言葉の要求は401で失敗する", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "そら");

    const res = await createApp(db).request("/api/account/me", {
      headers: { Authorization: `Bearer ${account.userId}:not-the-secret` },
    });
    expect(res.status).toBe(401);
  });

  it("存在しないユーザーIDの要求は401で失敗する", async () => {
    const db = await createTestDb();
    const credential = createTestCredential();

    const res = await createApp(db).request("/api/account/me", {
      headers: { Authorization: credential.authorization },
    });
    expect(res.status).toBe(401);
  });

  it("正しいBearerトークンなら自分の状態が返る", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "つき");

    const res = await createApp(db).request("/api/account/me", {
      headers: { Authorization: account.authorization },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string; displayName: string; pairId: string };
    expect(body.userId).toBe(account.userId);
    expect(body.displayName).toBe("つき");
    expect(body.pairId).toBe(account.pairId);
  });
});
