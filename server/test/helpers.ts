import { createClient } from "@libsql/client";
import { applyMigrations } from "../scripts/apply-migrations.mjs";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db.js";

// テスト用のデータベース。起動不要なNode用クライアントの:memory:に、
// server/migrations/ と同じSQLを適用して組み立てる。
export async function createTestDb(): Promise<Db> {
  const db = createClient({ url: ":memory:" });
  await applyMigrations(db);
  return db;
}

export interface TestCredential {
  userId: string;
  secret: string;
  authorization: string;
}

// テスト用のBearerトークンを、実際のクライアントと同じ形式(ランダムなID・合言葉)で作る。
export function createTestCredential(): TestCredential {
  const userId = crypto.randomUUID();
  const secret = crypto.randomUUID();
  return { userId, secret, authorization: `Bearer ${userId}:${secret}` };
}

export interface TestAccount extends TestCredential {
  pairId: string;
  characterId: string;
}

// POST /api/accountを実際に叩いて、認証つきの入口を試すテストで使えるアカウントを1つ作る。
export async function registerTestAccount(
  db: Db,
  displayName: string,
): Promise<TestAccount> {
  const credential = createTestCredential();
  const res = await createApp(db).request("/api/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName,
      userId: credential.userId,
      secret: credential.secret,
    }),
  });
  if (res.status !== 201) {
    throw new Error(`テスト用アカウントの登録に失敗しました: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { pairId: string; characterId: string };
  return { ...credential, pairId: json.pairId, characterId: json.characterId };
}
