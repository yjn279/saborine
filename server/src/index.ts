import { createApp } from "./app.js";
import { createDb } from "./db.js";
import { runScheduled } from "./scheduled.js";
import type { VapidKeyPair } from "./push/vapid.js";

// ローカル開発では`turso dev`が既定で開くHTTP入口(自分で決めたこと7番)。
// 認証は不要なため、DB_AUTH_TOKENは本番でTursoを使う場合にのみ必要になる。
const LOCAL_DB_URL = "http://127.0.0.1:8080";

interface Env {
  DB_URL?: string;
  DB_AUTH_TOKEN?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

function vapidConfig(env: Env): { vapidKeyPair: VapidKeyPair; subject: string } {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new Error("VAPID_PUBLIC_KEY・VAPID_PRIVATE_KEY・VAPID_SUBJECTが設定されていません");
  }
  return {
    vapidKeyPair: { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
    subject: env.VAPID_SUBJECT,
  };
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const db = createDb({ url: env.DB_URL ?? LOCAL_DB_URL, authToken: env.DB_AUTH_TOKEN });
    return createApp(db).fetch(request, env, ctx);
  },

  // 週次カードと、22時〜翌8時に起きた出来事の繰り越し配信を、予定実行(Cron Triggers)から呼ぶ。
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const db = createDb({ url: env.DB_URL ?? LOCAL_DB_URL, authToken: env.DB_AUTH_TOKEN });
    const config = vapidConfig(env);
    ctx.waitUntil(runScheduled(db, config, controller.cron, new Date(controller.scheduledTime)));
  },
};
