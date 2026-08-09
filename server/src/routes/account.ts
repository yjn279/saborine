import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { authMiddleware, hashSecret, isValidCredential } from "../auth.js";

const DISPLAY_NAME_MAX_LENGTH = 30;
const CHARACTER_NAME = "サボリーヌ";

interface RegisterBody {
  displayName?: unknown;
  userId?: unknown;
  secret?: unknown;
}

export function createAccountRoutes() {
  const routes = new Hono<AppEnv>();

  // 表示名だけの登録。ユーザー・ペアの器・サボリーヌ1体・なつき度の初期値を同時に作る。
  routes.post("/", async (c) => {
    const body = (await c.req.json().catch(() => null)) as RegisterBody | null;
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const secret = typeof body?.secret === "string" ? body.secret : "";

    if (!displayName || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
      return c.json({ error: "表示名を入力してください" }, 400);
    }
    if (!isValidCredential(userId) || !isValidCredential(secret)) {
      return c.json({ error: "登録情報が正しくありません" }, 400);
    }

    const db = c.get("db");
    const existing = await db.execute({
      sql: "SELECT id FROM users WHERE id = ?",
      args: [userId],
    });
    if (existing.rows.length > 0) {
      return c.json({ error: "すでに登録されています" }, 409);
    }

    const pairId = crypto.randomUUID();
    const characterId = crypto.randomUUID();
    const inviteToken = crypto.randomUUID();
    const secretHash = await hashSecret(secret);

    await db.batch(
      [
        {
          sql: "INSERT INTO pairs (id, invite_token) VALUES (?, ?)",
          args: [pairId, inviteToken],
        },
        {
          sql: "INSERT INTO users (id, pair_id, display_name, secret_hash) VALUES (?, ?, ?, ?)",
          args: [userId, pairId, displayName, secretHash],
        },
        {
          sql: "INSERT INTO characters (id, pair_id, name) VALUES (?, ?, ?)",
          args: [characterId, pairId, CHARACTER_NAME],
        },
        {
          sql: "INSERT INTO affections (user_id, value) VALUES (?, 0)",
          args: [userId],
        },
      ],
      "write",
    );

    return c.json(
      {
        userId,
        displayName,
        pairId,
        characterId,
        characterName: CHARACTER_NAME,
      },
      201,
    );
  });

  // 自分の状態を返す入口。他人の情報は含めない。
  routes.get("/me", authMiddleware, (c) => {
    const user = c.get("user");
    return c.json({
      userId: user.id,
      displayName: user.displayName,
      pairId: user.pairId,
    });
  });

  return routes;
}
