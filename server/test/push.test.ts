import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestDb, registerTestAccount } from "./helpers.js";
import {
  NOTIFICATION_KINDS,
  assertNotificationKind,
  buildNotificationContent,
  groupWithinOneHour,
  resolveDeliveryTime,
} from "../src/push/notifications.js";
import type { NotificationKind } from "../src/push/notifications.js";
import { sendWebPush } from "../src/push/send.js";
import type { PushSubscription, WebPushConfig } from "../src/push/send.js";
import { base64UrlDecode, base64UrlEncode, generateVapidKeyPair } from "../src/push/vapid.js";
import { MORNING_CATCH_UP_CRON, WEEKLY_CARD_CRON, runScheduled } from "../src/scheduled.js";
import { getPreviousWeekRange } from "../src/domain/weekly-card.js";

// SQLiteに保存するときと同じ"YYYY-MM-DD HH:MM:SS"(UTC、区切りは空白)の形にする。
function formatForStorage(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// テスト用に、実在の購読と同じ形(P-256のECDH公開鍵+16バイトの認証シークレット)を作る。
async function createFakeSubscription(endpoint: string): Promise<PushSubscription> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const publicKeyBytes = new Uint8Array((await crypto.subtle.exportKey("raw", keyPair.publicKey)) as ArrayBuffer);
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  return {
    endpoint,
    keys: { p256dh: base64UrlEncode(publicKeyBytes), auth: base64UrlEncode(authSecret) },
  };
}

// vapid.tsのbuildVapidAuthorizationHeaderが作ったAuthorizationヘッダを、実際に検証キーで検証する。
async function verifyVapidAuthorization(authorization: string, publicKeyB64Url: string) {
  const match = /^vapid t=([^,]+), k=(.+)$/.exec(authorization);
  const jwt = match?.[1];
  if (!jwt) {
    throw new Error(`Authorizationヘッダの形式が不正です: ${authorization}`);
  }
  const [encodedHeader, encodedPayload, encodedSignature] = jwt.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error(`VAPID JWTの形式が不正です: ${jwt}`);
  }
  const publicKeyBytes = base64UrlDecode(publicKeyB64Url);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(publicKeyBytes.slice(1, 33)),
    y: base64UrlEncode(publicKeyBytes.slice(33, 65)),
    ext: true,
  };
  const verifyKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "verify",
  ]);
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    verifyKey,
    base64UrlDecode(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  return {
    validSignature: valid,
    header: JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader))) as Record<string, unknown>,
    payload: JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as Record<string, unknown>,
  };
}

describe("お知らせの種類", () => {
  it("良い出来事の4種に限定される", () => {
    expect(NOTIFICATION_KINDS).toEqual(["chore_recorded", "thanks_received", "growth", "weekly_card"]);
  });

  it("4種以外は実行時に必ず失敗する", () => {
    expect(() => assertNotificationKind("reminder")).toThrow();
    expect(() => assertNotificationKind("nudge")).toThrow();
    expect(() => buildNotificationContent("reminder" as NotificationKind)).toThrow();
  });

  it("4種それぞれの本文が組み立てられる", () => {
    for (const kind of NOTIFICATION_KINDS) {
      const content = buildNotificationContent(kind);
      expect(content.title.length).toBeGreaterThan(0);
      expect(content.body.length).toBeGreaterThan(0);
    }
  });
});

describe("記録のお知らせのまとめ方", () => {
  it("1時間以内に連続した出来事は1つのまとまりになる", () => {
    const base = new Date("2024-01-10T00:00:00.000Z").getTime();
    const events = [
      { occurredAt: new Date(base) },
      { occurredAt: new Date(base + 30 * 60 * 1000) }, // +30分: 直前から60分以内なので同じまとまり
      { occurredAt: new Date(base + 95 * 60 * 1000) }, // +95分: 直前(30分)から65分後なので新しいまとまり
      { occurredAt: new Date(base + 250 * 60 * 1000) }, // +250分: 直前(95分)から155分後なので新しいまとまり
    ];

    const batches = groupWithinOneHour(events);
    expect(batches.map((batch) => batch.length)).toEqual([2, 1, 1]);
  });

  it("並び順に関わらず時系列でまとめる", () => {
    const base = new Date("2024-01-10T00:00:00.000Z").getTime();
    const events = [
      { occurredAt: new Date(base + 30 * 60 * 1000) },
      { occurredAt: new Date(base) },
    ];
    const batches = groupWithinOneHour(events);
    expect(batches).toHaveLength(1);
  });
});

describe("22時〜翌8時の繰り越し", () => {
  it("23時に発生したお知らせは翌朝8時(日本時間)に回される", () => {
    // 2024-01-10T14:00:00Z = 2024-01-10 23:00 JST
    const occurredAt = new Date("2024-01-10T14:00:00.000Z");
    const delivered = resolveDeliveryTime(occurredAt);
    // 2024-01-11 08:00 JST = 2024-01-10T23:00:00Z
    expect(delivered).toEqual(new Date("2024-01-10T23:00:00.000Z"));
  });

  it("日中(22時〜翌8時の外)に発生したお知らせは、そのまま(即時)届く", () => {
    // 2024-01-10T06:00:00Z = 2024-01-10 15:00 JST
    const occurredAt = new Date("2024-01-10T06:00:00.000Z");
    expect(resolveDeliveryTime(occurredAt)).toEqual(occurredAt);
  });

  it("深夜0時〜8時に発生したお知らせも、同じ朝8時(日本時間)に回される", () => {
    // 2024-01-10T18:00:00Z = 2024-01-11 03:00 JST
    const occurredAt = new Date("2024-01-10T18:00:00.000Z");
    const delivered = resolveDeliveryTime(occurredAt);
    expect(delivered).toEqual(new Date("2024-01-10T23:00:00.000Z"));
  });
});

describe("Web Pushの送信要求", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("暗号化された本文・VAPIDの認証ヘッダ・有効期限を満たす", async () => {
    const vapidKeyPair = await generateVapidKeyPair();
    const config: WebPushConfig = { vapidKeyPair, subject: "mailto:test@example.com" };
    const subscription = await createFakeSubscription("https://push.example.com/abc123");

    const captured: { url: string | null; init: RequestInit | null } = { url: null, init: null };
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      captured.url = String(url);
      captured.init = init ?? null;
      return new Response(null, { status: 201 });
    }) as typeof fetch;

    const result = await sendWebPush(subscription, { kind: "thanks_received" }, config);

    expect(result).toEqual({ outcome: "sent" });
    expect(captured.url).toBe(subscription.endpoint);
    const headers = captured.init?.headers as Record<string, string>;
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers["Content-Type"]).toBe("application/octet-stream");
    expect(Number(headers.TTL)).toBeGreaterThan(0);
    const authorization = headers.Authorization;
    if (!authorization) {
      throw new Error("Authorizationヘッダが送信要求に含まれていません");
    }

    const { validSignature, header, payload } = await verifyVapidAuthorization(authorization, vapidKeyPair.publicKey);
    expect(validSignature).toBe(true);
    expect(header.alg).toBe("ES256");
    expect(payload.aud).toBe(new URL(subscription.endpoint).origin);
    expect(payload.sub).toBe(config.subject);
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    // RFC 8188のaes128gcmヘッダ: salt(16) || レコードサイズ(4) || 鍵id長(1) || 鍵id(65)。本文自体は暗号化されている。
    const body = captured.init?.body as Uint8Array;
    expect(body).toBeInstanceOf(Uint8Array);
    expect(body.length).toBeGreaterThan(16 + 4 + 1 + 65);
    expect(body[20]).toBe(65);
    const plaintextGuess = new TextDecoder().decode(body);
    expect(plaintextGuess).not.toContain("thanks_received");
  });

  it("購読が失効している(410/404)ときは、送信結果でそれとわかる", async () => {
    const vapidKeyPair = await generateVapidKeyPair();
    const config: WebPushConfig = { vapidKeyPair, subject: "mailto:test@example.com" };
    const subscription = await createFakeSubscription("https://push.example.com/expired");

    globalThis.fetch = (async () => new Response(null, { status: 410 })) as typeof fetch;
    expect(await sendWebPush(subscription, { kind: "growth" }, config)).toEqual({ outcome: "expired" });

    globalThis.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
    expect(await sendWebPush(subscription, { kind: "growth" }, config)).toEqual({ outcome: "expired" });

    globalThis.fetch = (async () => new Response(null, { status: 500 })) as typeof fetch;
    expect(await sendWebPush(subscription, { kind: "growth" }, config)).toEqual({ outcome: "failed", status: 500 });
  });
});

describe("お知らせの購読", () => {
  it("認証なしの要求は401になる", async () => {
    const db = await createTestDb();
    const res = await createApp(db).request("/api/push/subscription", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("登録すると購読が保存され、解除すると消える", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");
    const app = createApp(db);

    const registerRes = await app.request("/api/push/subscription", {
      method: "POST",
      headers: { Authorization: account.authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://push.example.com/user1",
        keys: { p256dh: "p256dh-key-value", auth: "auth-key-value" },
      }),
    });
    expect(registerRes.status).toBe(201);

    const rows = await db.execute({
      sql: "SELECT user_id, endpoint FROM push_subscriptions WHERE user_id = ?",
      args: [account.userId],
    });
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.endpoint).toBe("https://push.example.com/user1");

    const deleteRes = await app.request("/api/push/subscription", {
      method: "DELETE",
      headers: { Authorization: account.authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "https://push.example.com/user1" }),
    });
    expect(deleteRes.status).toBe(200);

    const rowsAfterDelete = await db.execute({
      sql: "SELECT id FROM push_subscriptions WHERE user_id = ?",
      args: [account.userId],
    });
    expect(rowsAfterDelete.rows).toHaveLength(0);
  });

  it("自分以外の購読は解除できない", async () => {
    const db = await createTestDb();
    const accountA = await registerTestAccount(db, "彩花");
    const accountB = await registerTestAccount(db, "大樹");
    const app = createApp(db);

    await app.request("/api/push/subscription", {
      method: "POST",
      headers: { Authorization: accountA.authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://push.example.com/user-a",
        keys: { p256dh: "p256dh-key-value", auth: "auth-key-value" },
      }),
    });

    await app.request("/api/push/subscription", {
      method: "DELETE",
      headers: { Authorization: accountB.authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "https://push.example.com/user-a" }),
    });

    const rows = await db.execute({
      sql: "SELECT id FROM push_subscriptions WHERE user_id = ?",
      args: [accountA.userId],
    });
    expect(rows.rows).toHaveLength(1);
  });
});

describe("予定実行(Cron Triggers)", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("週次カードの予定実行で、生成したカードのお知らせが購読者に届く", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");
    await db.execute({
      sql: "UPDATE pairs SET established_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [account.pairId],
    });
    const now = new Date();
    const previousWeek = getPreviousWeekRange(now);
    await db.execute({
      sql: "INSERT INTO chore_logs (id, pair_id, user_id, chore_type, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [
        crypto.randomUUID(),
        account.pairId,
        account.userId,
        "お皿洗い",
        formatForStorage(new Date(previousWeek.start.getTime() + 60_000)),
      ],
    });
    const subscription = await createFakeSubscription("https://push.example.com/weekly");
    await db.execute({
      sql: "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key) VALUES (?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), account.userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth],
    });

    let sendCount = 0;
    globalThis.fetch = (async () => {
      sendCount += 1;
      return new Response(null, { status: 201 });
    }) as typeof fetch;

    const vapidKeyPair = await generateVapidKeyPair();
    await runScheduled(db, { vapidKeyPair, subject: "mailto:test@example.com" }, WEEKLY_CARD_CRON, now);

    expect(sendCount).toBe(1);
    const cardRows = await db.execute({
      sql: "SELECT story_text FROM weekly_cards WHERE pair_id = ? AND week_start = ?",
      args: [account.pairId, previousWeek.start.toISOString()],
    });
    expect(cardRows.rows).toHaveLength(1);
  });

  it("22時〜翌8時に届いた記録は、翌朝8時の予定実行でパートナーにまとめて届く", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");
    const partnerId = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO users (id, pair_id, display_name, secret_hash) VALUES (?, ?, ?, ?)",
      args: [partnerId, account.pairId, "大樹", "dummy-hash"],
    });
    await db.execute({ sql: "INSERT INTO affections (user_id, value) VALUES (?, 0)", args: [partnerId] });

    // 2024-01-10T14:00:00Z = 2024-01-10 23:00 JST。記録した本人ではなく、相手(partner)に届くはず。
    await db.execute({
      sql: "INSERT INTO chore_logs (id, pair_id, user_id, chore_type, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), account.pairId, account.userId, "ゴミ出し", "2024-01-10 14:00:00"],
    });

    const subscription = await createFakeSubscription("https://push.example.com/catch-up");
    await db.execute({
      sql: "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key) VALUES (?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), partnerId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth],
    });

    let sendCount = 0;
    globalThis.fetch = (async () => {
      sendCount += 1;
      return new Response(null, { status: 201 });
    }) as typeof fetch;

    const vapidKeyPair = await generateVapidKeyPair();
    // 2024-01-11 08:00 JST = 2024-01-10T23:00:00Z。この予定実行が繰り越しぶんをまとめて届ける。
    const now = new Date("2024-01-10T23:00:00.000Z");
    await runScheduled(db, { vapidKeyPair, subject: "mailto:test@example.com" }, MORNING_CATCH_UP_CRON, now);

    expect(sendCount).toBe(1);
  });
});
