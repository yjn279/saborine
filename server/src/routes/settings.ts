import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { authMiddleware } from "../auth.js";

const CHARACTER_NAME_MAX_LENGTH = 20;

interface SettingsBody {
  notificationsEnabled?: unknown;
  characterName?: unknown;
}

async function loadSettings(db: AppEnv["Variables"]["db"], userId: string, pairId: string) {
  const [userResult, characterResult] = await Promise.all([
    db.execute({ sql: "SELECT notifications_enabled FROM users WHERE id = ?", args: [userId] }),
    db.execute({ sql: "SELECT name FROM characters WHERE pair_id = ?", args: [pairId] }),
  ]);
  return {
    notificationsEnabled: Number(userResult.rows[0]?.notifications_enabled ?? 1) === 1,
    characterName: String(characterResult.rows[0]?.name ?? ""),
  };
}

// 設定は4項目だけ: お知らせのオン・オフ、サボリーヌの名前変更、ペア解除(routes/pair.ts)、
// アカウント削除(routes/account.ts)。通知・催促・タスク割当に類する項目は置かない。
export function createSettingsRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    return c.json(await loadSettings(db, user.id, user.pairId));
  });

  routes.patch("/", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const body = (await c.req.json().catch(() => null)) as SettingsBody | null;

    const hasNotifications = typeof body?.notificationsEnabled === "boolean";
    const hasCharacterName = typeof body?.characterName === "string";
    const characterName = hasCharacterName ? (body?.characterName as string).trim() : "";
    if (hasCharacterName && (!characterName || characterName.length > CHARACTER_NAME_MAX_LENGTH)) {
      return c.json({ error: "サボリーヌの名前を確認してください" }, 400);
    }
    if (!hasNotifications && !hasCharacterName) {
      return c.json({ error: "変更する項目を指定してください" }, 400);
    }

    const statements = [];
    if (hasNotifications) {
      statements.push({
        sql: "UPDATE users SET notifications_enabled = ? WHERE id = ?",
        args: [body?.notificationsEnabled ? 1 : 0, user.id],
      });
    }
    if (hasCharacterName) {
      statements.push({
        sql: "UPDATE characters SET name = ? WHERE pair_id = ?",
        args: [characterName, user.pairId],
      });
    }
    await db.batch(statements, "write");

    return c.json(await loadSettings(db, user.id, user.pairId));
  });

  return routes;
}
