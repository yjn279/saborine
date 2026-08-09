import { Hono } from "hono";
import { cors } from "hono/cors";
import { LibsqlError } from "@libsql/client/web";
import type { Db } from "./db.js";
import type { AuthedUser } from "./auth.js";
import { createAccountRoutes } from "./routes/account.js";
import { createInviteRoutes } from "./routes/invite.js";
import { createChoreRoutes } from "./routes/chores.js";
import { createHomeRoutes } from "./routes/home.js";
import { createWeeklyCardRoutes } from "./routes/weekly-card.js";
import { createPushRoutes } from "./routes/push.js";
import { createSettingsRoutes } from "./routes/settings.js";
import { createPairRoutes } from "./routes/pair.js";

export type AppEnv = {
  Variables: {
    db: Db;
    user: AuthedUser;
  };
};

// Hono本体を組み立てる。dbは呼び出し側(Worker本体またはテスト)が用意したものを差し込む。
// トップページの動作確認だけは、データベースが無くても200を返せるようにしておく。
export function createApp(db: Db) {
  const app = new Hono<AppEnv>();

  app.get("/", (c) => c.text("元気です"));

  // アプリ(Expo Web)はAPIと別オリジンで動く。Bearerトークン認証でCookieは使わないため、
  // 資格情報の共有は必要ない。
  app.use("/api/*", cors());

  app.use("/api/*", async (c, next) => {
    c.set("db", db);
    await next();
  });

  app.route("/api/account", createAccountRoutes());
  app.route("/api/invite", createInviteRoutes());
  app.route("/api/chores", createChoreRoutes());
  app.route("/api/home", createHomeRoutes());
  app.route("/api/weekly-card", createWeeklyCardRoutes());
  app.route("/api/push", createPushRoutes());
  app.route("/api/settings", createSettingsRoutes());
  app.route("/api/pair", createPairRoutes());

  // check-then-actの間に起きた競合(同時に届いたありがとう・週次カード生成等)は、
  // データベースの一意制約違反として現れる。エラーを握りつぶさず、意図どおりの
  // 409として表面化させる。それ以外の失敗は代替値を返さず500のまま表面化させる。
  app.onError((err, c) => {
    if (err instanceof LibsqlError && err.code.startsWith("SQLITE_CONSTRAINT")) {
      return c.json({ error: "すでに処理されています" }, 409);
    }
    console.error(err);
    return c.json({ error: "サーバーでエラーが発生しました" }, 500);
  });

  return app;
}
