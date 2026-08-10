// VAPID(RFC 8292)。どのアプリケーションサーバーがWeb Pushサーバー宛てに送っているかを、
// 秘密鍵で署名したJWTで示す。秘密鍵はWorkerのシークレット(ローカルは.dev.vars、コミットしない)として渡す。

const EC_P256_PUBLIC_KEY_LENGTH = 65; // 0x04 || X(32バイト) || Y(32バイト) の非圧縮点
const VAPID_TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000; // 12時間。RFC 8292が上限とする24時間以内に収める

export interface VapidKeyPair {
  /** base64url。65バイトの非圧縮P-256公開鍵 */
  publicKey: string;
  /** base64url。32バイトの秘密スカラー値 */
  privateKey: string;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// 同じ鍵ペアはお知らせの配信中に何度も使われる(scheduled.tsが購読ごとに送信する)ため、
// インポート結果をVapidKeyPairごとにキャッシュし、毎回のcrypto.subtle.importKeyを避ける。
const importedKeyCache = new WeakMap<VapidKeyPair, Promise<CryptoKey>>();

function importVapidPrivateKey(keyPair: VapidKeyPair): Promise<CryptoKey> {
  const cached = importedKeyCache.get(keyPair);
  if (cached) {
    return cached;
  }
  const imported = importVapidPrivateKeyUncached(keyPair);
  importedKeyCache.set(keyPair, imported);
  return imported;
}

async function importVapidPrivateKeyUncached(keyPair: VapidKeyPair): Promise<CryptoKey> {
  const publicBytes = base64UrlDecode(keyPair.publicKey);
  if (publicBytes.length !== EC_P256_PUBLIC_KEY_LENGTH) {
    throw new Error("VAPID公開鍵の形式が不正です");
  }
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(publicBytes.slice(1, 33)),
    y: base64UrlEncode(publicBytes.slice(33, 65)),
    d: keyPair.privateKey,
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

// 開発・テスト用に、その場でVAPIDの鍵ペアを作る。本番は`wrangler secret put`で登録した固定の鍵を使う。
export async function generateVapidKeyPair(): Promise<VapidKeyPair> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const publicRaw = new Uint8Array((await crypto.subtle.exportKey("raw", keyPair.publicKey)) as ArrayBuffer);
  const jwk = (await crypto.subtle.exportKey("jwk", keyPair.privateKey)) as JsonWebKey;
  if (!jwk.d) {
    throw new Error("VAPID秘密鍵の書き出しに失敗しました");
  }
  return { publicKey: base64UrlEncode(publicRaw), privateKey: jwk.d };
}

// Web Pushサーバー宛ての要求に付けるAuthorizationヘッダ(RFC 8292のvapidスキーム)を作る。
// audienceはプッシュサービスのオリジン(例: https://fcm.googleapis.com)、subjectは連絡先(mailto:から始める)。
export async function buildVapidAuthorizationHeader(params: {
  keyPair: VapidKeyPair;
  audience: string;
  subject: string;
}): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: params.audience,
    exp: Math.floor((Date.now() + VAPID_TOKEN_LIFETIME_MS) / 1000),
    sub: params.subject,
  };
  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await importVapidPrivateKey(params.keyPair);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `vapid t=${signingInput}.${encodedSignature}, k=${params.keyPair.publicKey}`;
}
