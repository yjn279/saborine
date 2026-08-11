import { createApp } from "./app.js";
import { createDb } from "./db.js";
import { runScheduled } from "./scheduled.js";
import type { VapidKeyPair } from "./push/vapid.js";

// ローカル開発では`turso dev`が既定で開くHTTP入口(自分で決めたこと7番)。
// 認証は不要なため、DB_AUTH_TOKENは本番でTursoを使う場合にのみ必要になる。
const LOCAL_DB_URL = "http://127.0.0.1:8080";

interface Env {
  // 書き出し済みのアプリ。招待リンクを配るためだけに使う(下の JOIN_PAGE を参照)。
  ASSETS: Fetcher;
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

// 記録・ありがとうの直後の即時プッシュ通知(docs/mvp.md:126)に使う。予定実行(cron)と違い
// この設定が無くても記録自体は続けられるべきなので、未設定なら即時送信を諦めるだけに留める。
function optionalVapidConfig(env: Env): { vapidKeyPair: VapidKeyPair; subject: string } | undefined {
  try {
    return vapidConfig(env);
  } catch {
    return undefined;
  }
}

// 招待リンクは /join/<合言葉> で届くが、書き出されるのは join/[token].html の1枚だけで、
// 合言葉ごとのファイルは存在しない。そのままではパスが一致せず、招待された人が
// 404を受け取り、ペアを作る唯一の道が塞がる。ここで1枚を代わりに返す。
// 合言葉はアプリが画面上のURLから読むため、Worker側で中身を差し替える必要はない。
const JOIN_PATH_PREFIX = "/join/";
const JOIN_PAGE = "/join/[token].html";

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname, origin } = new URL(request.url);
    if (pathname.startsWith(JOIN_PATH_PREFIX)) {
      return env.ASSETS.fetch(new Request(`${origin}${JOIN_PAGE}`, request));
    }
    const db = createDb({ url: env.DB_URL ?? LOCAL_DB_URL, authToken: env.DB_AUTH_TOKEN });
    return createApp(db, optionalVapidConfig(env)).fetch(request, env, ctx);
  },

  // 週次カードと、22時〜翌8時に起きた出来事の繰り越し配信を、予定実行(Cron Triggers)から呼ぶ。
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const db = createDb({ url: env.DB_URL ?? LOCAL_DB_URL, authToken: env.DB_AUTH_TOKEN });
    const config = vapidConfig(env);
    ctx.waitUntil(runScheduled(db, config, controller.cron, new Date(controller.scheduledTime)));
  },
};
