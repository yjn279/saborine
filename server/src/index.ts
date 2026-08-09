import { createApp } from "./app.js";
import { createDb } from "./db.js";

// ローカル開発では`turso dev`が既定で開くHTTP入口(自分で決めたこと7番)。
// 認証は不要なため、DB_AUTH_TOKENは本番でTursoを使う場合にのみ必要になる。
const LOCAL_DB_URL = "http://127.0.0.1:8080";

interface Env {
  DB_URL?: string;
  DB_AUTH_TOKEN?: string;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const db = createDb({ url: env.DB_URL ?? LOCAL_DB_URL, authToken: env.DB_AUTH_TOKEN });
    return createApp(db).fetch(request, env, ctx);
  },
};
