import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { authMiddleware } from "../auth.js";

const ENDPOINT_MAX_LENGTH = 2048;
const KEY_MAX_LENGTH = 256;

interface SubscriptionBody {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

interface ParsedSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function parseSubscription(body: SubscriptionBody | null): ParsedSubscription | null {
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || endpoint.length > ENDPOINT_MAX_LENGTH) {
    return null;
  }
  if (!p256dh || p256dh.length > KEY_MAX_LENGTH || !auth || auth.length > KEY_MAX_LENGTH) {
    return null;
  }
  return { endpoint, p256dh, auth };
}

export function createPushRoutes() {
  const routes = new Hono<AppEnv>();

  // お知らせの購読を登録する。同じendpointですでに購読があれば、宛先の鍵を最新のものに置き換える。
  routes.post("/subscription", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const body = (await c.req.json().catch(() => null)) as SubscriptionBody | null;
    const subscription = parseSubscription(body);
    if (!subscription) {
      return c.json({ error: "購読情報が正しくありません" }, 400);
    }

    await db.execute({
      sql: `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (endpoint) DO UPDATE SET
              user_id = excluded.user_id,
              p256dh_key = excluded.p256dh_key,
              auth_key = excluded.auth_key`,
      args: [crypto.randomUUID(), user.id, subscription.endpoint, subscription.p256dh, subscription.auth],
    });

    return c.json({ ok: true }, 201);
  });

  // お知らせの購読を解除する。自分以外の購読は消せない。
  routes.delete("/subscription", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const body = (await c.req.json().catch(() => null)) as { endpoint?: unknown } | null;
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
    if (!endpoint) {
      return c.json({ error: "endpointを指定してください" }, 400);
    }

    await db.execute({
      sql: "DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
      args: [user.id, endpoint],
    });

    return c.json({ ok: true });
  });

  return routes;
}
