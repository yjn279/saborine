import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { authMiddleware, findRegisteredUser, hashSecret, validateRegistrationInput } from "../auth.js";
import { LETTER_LINES } from "../domain/letter.js";

const PAIR_MAX_MEMBERS = 2;

export function createInviteRoutes() {
  const routes = new Hono<AppEnv>();

  // 送るための手紙。本文とリンクだけを返す。相手が開いたか・受諾したかの状態は一切含めない。
  routes.get("/letter", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");

    const result = await db.execute({
      sql: "SELECT invite_token FROM pairs WHERE id = ?",
      args: [user.pairId],
    });
    const token = result.rows[0]?.invite_token;
    if (!token) {
      return c.json({ error: "ペアが見つかりません" }, 404);
    }

    return c.json({
      body: LETTER_LINES,
      token: String(token),
      link: `/join?t=${String(token)}`,
    });
  });

  // 受け取った手紙のプレビュー。認証なしで見られる。招待した人の記録内容は含めない。
  routes.get("/:token", async (c) => {
    const token = c.req.param("token");
    const db = c.get("db");

    const pairResult = await db.execute({
      sql: "SELECT id FROM pairs WHERE invite_token = ?",
      args: [token],
    });
    const pair = pairResult.rows[0];
    if (!pair) {
      return c.json({ error: "招待が見つかりません" }, 404);
    }

    const characterResult = await db.execute({
      sql: "SELECT name FROM characters WHERE pair_id = ?",
      args: [String(pair.id)],
    });
    const characterName = characterResult.rows[0]?.name;

    return c.json({
      body: LETTER_LINES,
      characterName: characterName ? String(characterName) : undefined,
    });
  });

  // 受諾して登録し、ペアに加わる。ペアは2人まで。すでに埋まっている場合は失敗させる。
  routes.post("/:token/accept", async (c) => {
    const token = c.req.param("token");
    const body = await c.req.json().catch(() => null);
    const validation = validateRegistrationInput(body);
    if (!validation.ok) {
      return c.json({ error: validation.error }, 400);
    }
    const { displayName, userId, secret } = validation.input;

    const db = c.get("db");

    const pairResult = await db.execute({
      sql: "SELECT id FROM pairs WHERE invite_token = ?",
      args: [token],
    });
    const pair = pairResult.rows[0];
    if (!pair) {
      return c.json({ error: "招待が見つかりません" }, 404);
    }
    const pairId = String(pair.id);

    const secretHash = await hashSecret(secret);
    const [existing, memberCountResult, characterResult] = await Promise.all([
      findRegisteredUser(db, userId),
      db.execute({
        sql: "SELECT COUNT(*) as count FROM users WHERE pair_id = ?",
        args: [pairId],
      }),
      db.execute({
        sql: "SELECT id, name FROM characters WHERE pair_id = ?",
        args: [pairId],
      }),
    ]);
    if (existing) {
      // 同じ身分証での送り直し。前回の応答が届かなかった場合にここへ来る。
      // 断ってしまうと、受諾は成立しているのに招待も使い切られており、
      // 招待された人がどこにも入れなくなる。同じペアに入っていれば成功として返す。
      if (existing.secretHash !== secretHash || existing.pairId !== pairId) {
        return c.json({ error: "すでに登録されています" }, 409);
      }
      const acceptedCharacter = characterResult.rows[0];
      if (!acceptedCharacter) {
        return c.json({ error: "ペアが見つかりません" }, 404);
      }
      return c.json({
        userId,
        displayName: existing.displayName,
        pairId,
        characterId: String(acceptedCharacter.id),
        characterName: String(acceptedCharacter.name),
      });
    }

    const memberCount = Number(memberCountResult.rows[0]?.count ?? 0);
    if (memberCount >= PAIR_MAX_MEMBERS) {
      return c.json({ error: "この招待はすでに使われています" }, 409);
    }

    const character = characterResult.rows[0];
    if (!character) {
      return c.json({ error: "ペアが見つかりません" }, 404);
    }

    // 上のCOUNTでの確認とこのINSERTの間に、同時受諾やペア解除が割り込む余地があるため、
    // ペアがまだ存在することと人数の確認を同じ1文の中に埋め込み、pairsが消えた後の孤立
    // ユーザーや3人目の紛れ込みを防ぐ(挿入0件なら競合負け)。
    const insertResult = await db.execute({
      sql: `INSERT INTO users (id, pair_id, display_name, secret_hash)
            SELECT ?, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM pairs WHERE id = ?)
              AND (SELECT COUNT(*) FROM users WHERE pair_id = ?) < ?`,
      args: [userId, pairId, displayName, secretHash, pairId, pairId, PAIR_MAX_MEMBERS],
    });
    if (insertResult.rowsAffected === 0) {
      return c.json({ error: "この招待はすでに使われています" }, 409);
    }

    await db.batch(
      [
        {
          sql: "INSERT INTO affections (user_id, value) VALUES (?, 0)",
          args: [userId],
        },
        {
          sql: "UPDATE pairs SET established_at = CURRENT_TIMESTAMP WHERE id = ? AND established_at IS NULL",
          args: [pairId],
        },
      ],
      "write",
    );

    return c.json(
      {
        userId,
        displayName,
        pairId,
        characterId: String(character.id),
        characterName: String(character.name),
      },
      201,
    );
  });

  return routes;
}
