import { createClient } from "@libsql/client";
import { applyMigrations } from "../scripts/apply-migrations.mjs";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db.js";
import type { PushSubscription } from "../src/push/send.js";

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

// 手紙の受諾フローを通して、実際にペアになったふたりぶんのアカウントを作る。
export async function registerTestPair(
  db: Db,
  nameA: string,
  nameB: string,
): Promise<{ a: TestAccount; b: TestAccount }> {
  const a = await registerTestAccount(db, nameA);
  const letterRes = await createApp(db).request("/api/invite/letter", {
    headers: { Authorization: a.authorization },
  });
  const { token } = (await letterRes.json()) as { token: string };

  const bUserId = crypto.randomUUID();
  const bSecret = crypto.randomUUID();
  const acceptRes = await createApp(db).request(`/api/invite/${token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: nameB, userId: bUserId, secret: bSecret }),
  });
  const acceptBody = (await acceptRes.json()) as { pairId: string; characterId: string };

  const b: TestAccount = {
    userId: bUserId,
    secret: bSecret,
    authorization: `Bearer ${bUserId}:${bSecret}`,
    pairId: acceptBody.pairId,
    characterId: acceptBody.characterId,
  };
  return { a, b };
}

// 実在の購読と同じ形(createFakeSubscriptionが作った値)を、push_subscriptionsへ登録する。
export async function registerPushSubscription(
  db: Db,
  userId: string,
  subscription: PushSubscription,
): Promise<void> {
  await db.execute({
    sql: "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key) VALUES (?, ?, ?, ?, ?)",
    args: [crypto.randomUUID(), userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth],
  });
}
