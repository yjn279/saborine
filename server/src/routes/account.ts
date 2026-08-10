import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { authMiddleware, findRegisteredUser, hashSecret, validateRegistrationInput } from "../auth.js";

const CHARACTER_NAME = "サボリーヌ";

export function createAccountRoutes() {
  const routes = new Hono<AppEnv>();

  // 表示名だけの登録。ユーザー・ペアの器・サボリーヌ1体・なつき度の初期値を同時に作る。
  routes.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const validation = validateRegistrationInput(body);
    if (!validation.ok) {
      return c.json({ error: validation.error }, 400);
    }
    const { displayName, userId, secret } = validation.input;

    const db = c.get("db");
    const secretHashForInput = await hashSecret(secret);
    const existing = await findRegisteredUser(db, userId);
    if (existing) {
      // 同じ身分証での送り直し。前回の応答が届かなかった場合にここへ来る。
      // 新しく作り直すと、前回できたペアが誰も辿れないまま残ってしまうため、
      // 前回の登録をそのまま返す。合言葉が違えば別人なので断る。
      if (existing.secretHash !== secretHashForInput) {
        return c.json({ error: "すでに登録されています" }, 409);
      }
      const characterResult = await db.execute({
        sql: "SELECT id, name FROM characters WHERE pair_id = ?",
        args: [existing.pairId],
      });
      const character = characterResult.rows[0];
      if (!character) {
        return c.json({ error: "ペアが見つかりません" }, 404);
      }
      return c.json({
        userId,
        displayName: existing.displayName,
        pairId: existing.pairId,
        characterId: String(character.id),
        characterName: String(character.name),
      });
    }

    const pairId = crypto.randomUUID();
    const characterId = crypto.randomUUID();
    const inviteToken = crypto.randomUUID();

    await db.batch(
      [
        {
          sql: "INSERT INTO pairs (id, invite_token) VALUES (?, ?)",
          args: [pairId, inviteToken],
        },
        {
          sql: "INSERT INTO users (id, pair_id, display_name, secret_hash) VALUES (?, ?, ?, ?)",
          args: [userId, pairId, displayName, secretHashForInput],
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

  // アカウント削除。自分ぶんの身分証・なつき度・お知らせ購読だけを消し、以後は同じ
  // Bearerトークンで何もできなくする。ペアとサボリーヌはひとり期間と同じ形で相手の
  // もとに残るため(docs/mvp.md:17)、この入口はペアそのものは解かない(ペア解除は
  // routes/pair.ts が別に担う)。招待リンクの合言葉(invite_token)は新しいものに
  // 差し替える。差し替えないと、離脱前に見た誰か(元パートナー自身や、以前リンクを
  // 見ただけの第三者)が、残った側の同意なく古いリンクからペアへ入り込めてしまう。
  routes.delete("/", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const newInviteToken = crypto.randomUUID();

    await db.batch(
      [
        { sql: "DELETE FROM push_subscriptions WHERE user_id = ?", args: [user.id] },
        { sql: "DELETE FROM affections WHERE user_id = ?", args: [user.id] },
        { sql: "DELETE FROM users WHERE id = ?", args: [user.id] },
        { sql: "UPDATE pairs SET invite_token = ? WHERE id = ?", args: [newInviteToken, user.pairId] },
      ],
      "write",
    );

    return c.body(null, 204);
  });

  return routes;
}
