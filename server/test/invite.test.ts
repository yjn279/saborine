import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { containsBlameWords, LETTER_LINES } from "../src/domain/letter.js";
import { createTestCredential, createTestDb, registerTestAccount } from "./helpers.js";

describe("手紙", () => {
  it("本文が3行以内で、責めに読める語を含まない", () => {
    expect(LETTER_LINES.length).toBeLessThanOrEqual(3);
    const fullText = LETTER_LINES.join("\n");
    expect(containsBlameWords(fullText)).toBe(false);
    // 犬の名前「サボリーヌ」(カタカナ)自体は誤検出されないことも確認する。
    expect(containsBlameWords("サボリーヌ")).toBe(false);
    expect(containsBlameWords("サボりがち")).toBe(true);
    expect(containsBlameWords("家事を分担して")).toBe(true);
  });

  it("送るための手紙は認証が要り、本文とリンクだけを返し、途中状態を含まない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const unauthed = await createApp(db).request("/api/invite/letter");
    expect(unauthed.status).toBe(401);

    const res = await createApp(db).request("/api/invite/letter", {
      headers: { Authorization: account.authorization },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.body).toEqual(LETTER_LINES);
    expect(typeof body.link).toBe("string");
    expect(typeof body.token).toBe("string");
    // 「相手が開いたか」「受諾したか」を示す途中状態を一切含まない。
    expect(body).not.toHaveProperty("opened");
    expect(body).not.toHaveProperty("accepted");
    expect(body).not.toHaveProperty("acceptedAt");
    expect(body).not.toHaveProperty("establishedAt");
    expect(body).not.toHaveProperty("memberCount");
  });
});

describe("手紙のプレビュー", () => {
  it("認証なしで見られ、招待した人の記録内容も途中状態も含まない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");
    await db.execute({
      sql: "INSERT INTO chore_logs (id, pair_id, user_id, chore_type) VALUES (?, ?, ?, ?)",
      args: [crypto.randomUUID(), account.pairId, account.userId, "お皿洗い"],
    });

    const letterRes = await createApp(db).request("/api/invite/letter", {
      headers: { Authorization: account.authorization },
    });
    const { token } = (await letterRes.json()) as { token: string };

    const res = await createApp(db).request(`/api/invite/${token}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.body).toEqual(LETTER_LINES);

    const text = JSON.stringify(body);
    expect(text).not.toContain("お皿洗い");
    expect(body).not.toHaveProperty("opened");
    expect(body).not.toHaveProperty("accepted");
    expect(body).not.toHaveProperty("acceptedAt");
    expect(body).not.toHaveProperty("establishedAt");
    expect(body).not.toHaveProperty("memberCount");
  });

  it("存在しないトークンは404になる", async () => {
    const db = await createTestDb();
    const res = await createApp(db).request("/api/invite/no-such-token");
    expect(res.status).toBe(404);
  });
});

describe("招待の受諾", () => {
  it("受諾すると2人が同じペアに属し、サボリーヌが1体のまま増えない", async () => {
    const db = await createTestDb();
    const inviter = await registerTestAccount(db, "彩花");
    const letterRes = await createApp(db).request("/api/invite/letter", {
      headers: { Authorization: inviter.authorization },
    });
    const { token } = (await letterRes.json()) as { token: string };

    const invitee = createTestCredential();
    const acceptRes = await createApp(db).request(`/api/invite/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "大樹",
        userId: invitee.userId,
        secret: invitee.secret,
      }),
    });
    expect(acceptRes.status).toBe(201);
    const acceptBody = (await acceptRes.json()) as { pairId: string; characterId: string };
    expect(acceptBody.pairId).toBe(inviter.pairId);
    expect(acceptBody.characterId).toBe(inviter.characterId);

    const users = await db.execute({
      sql: "SELECT id FROM users WHERE pair_id = ?",
      args: [inviter.pairId],
    });
    expect(users.rows).toHaveLength(2);

    const characters = await db.execute({
      sql: "SELECT id FROM characters WHERE pair_id = ?",
      args: [inviter.pairId],
    });
    expect(characters.rows).toHaveLength(1);
  });

  it("すでに2人いるペアへの受諾は失敗する", async () => {
    const db = await createTestDb();
    const inviter = await registerTestAccount(db, "彩花");
    const letterRes = await createApp(db).request("/api/invite/letter", {
      headers: { Authorization: inviter.authorization },
    });
    const { token } = (await letterRes.json()) as { token: string };

    const second = createTestCredential();
    await createApp(db).request(`/api/invite/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "大樹", userId: second.userId, secret: second.secret }),
    });

    const third = createTestCredential();
    const res = await createApp(db).request(`/api/invite/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "みさき", userId: third.userId, secret: third.secret }),
    });
    expect(res.status).toBe(409);

    const users = await db.execute({
      sql: "SELECT id FROM users WHERE pair_id = ?",
      args: [inviter.pairId],
    });
    expect(users.rows).toHaveLength(2);
  });

  it("同時に2人が受諾しても、3人目にはなれない", async () => {
    const db = await createTestDb();
    const inviter = await registerTestAccount(db, "彩花");
    const letterRes = await createApp(db).request("/api/invite/letter", {
      headers: { Authorization: inviter.authorization },
    });
    const { token } = (await letterRes.json()) as { token: string };

    const second = createTestCredential();
    const third = createTestCredential();
    const [secondRes, thirdRes] = await Promise.all([
      createApp(db).request(`/api/invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "大樹", userId: second.userId, secret: second.secret }),
      }),
      createApp(db).request(`/api/invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "みさき", userId: third.userId, secret: third.secret }),
      }),
    ]);

    const statuses = [secondRes.status, thirdRes.status].sort();
    expect(statuses).toEqual([201, 409]);

    const users = await db.execute({
      sql: "SELECT id FROM users WHERE pair_id = ?",
      args: [inviter.pairId],
    });
    expect(users.rows).toHaveLength(2);
  });

  it("存在しないトークンでの受諾は404になる", async () => {
    const db = await createTestDb();
    const credential = createTestCredential();
    const res = await createApp(db).request("/api/invite/no-such-token/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "大樹",
        userId: credential.userId,
        secret: credential.secret,
      }),
    });
    expect(res.status).toBe(404);
  });

  it("同じ身分証で受諾を送り直しても、締め出されず成功が返る", async () => {
    // 応答が届かず招待された人がやり直したときの経路。ここで断ると、受諾は
    // 成立しているのに招待は使い切られており、その人はどこにも入れなくなる。
    const db = await createTestDb();
    const inviter = await registerTestAccount(db, "彩花");
    const letterRes = await createApp(db).request("/api/invite/letter", {
      headers: { Authorization: inviter.authorization },
    });
    const { token } = (await letterRes.json()) as { token: string };

    const invitee = createTestCredential();
    const app = createApp(db);
    const send = () =>
      app.request(`/api/invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "大樹",
          userId: invitee.userId,
          secret: invitee.secret,
        }),
      });

    expect((await send()).status).toBe(201);

    const second = await send();
    expect(second.status).toBe(200);
    const body = (await second.json()) as { pairId: string; characterId: string };
    expect(body.pairId).toBe(inviter.pairId);
    expect(body.characterId).toBe(inviter.characterId);

    const users = await db.execute({
      sql: "SELECT id FROM users WHERE pair_id = ?",
      args: [inviter.pairId],
    });
    expect(users.rows).toHaveLength(2);
  });
});
