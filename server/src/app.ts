import { Hono } from "hono";
import type { Db } from "./db.js";
import type { AuthedUser } from "./auth.js";
import { createAccountRoutes } from "./routes/account.js";
import { createInviteRoutes } from "./routes/invite.js";
import { createChoreRoutes } from "./routes/chores.js";
import { createHomeRoutes } from "./routes/home.js";

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

  app.use("/api/*", async (c, next) => {
    c.set("db", db);
    await next();
  });

  app.route("/api/account", createAccountRoutes());
  app.route("/api/invite", createInviteRoutes());
  app.route("/api/chores", createChoreRoutes());
  app.route("/api/home", createHomeRoutes());

  return app;
}
