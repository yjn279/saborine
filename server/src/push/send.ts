import { base64UrlDecode, buildVapidAuthorizationHeader } from "./vapid.js";
import type { VapidKeyPair } from "./vapid.js";

// RFC 8188(aes128gcmコンテンツ符号化)の1レコードぶんの大きさ。本文が十分小さいため常に1レコードで足りる。
const RECORD_SIZE = 4096;
// 平文の終わりを示す区切り(RFC 8188)。追加のパディングは行わない。
const PADDING_DELIMITER = 0x02;
const NONCE_LENGTH = 12;
const AUTH_TAG_BITS = 128;
// プッシュサービスがこの秒数だけ再配達を試みる。お知らせは新しいうちに届けば十分なので1日に留める。
const TTL_SECONDS = 60 * 60 * 24;

// @cloudflare/workers-typesのSubtleCryptoDeriveKeyAlgorithmは、ECDHの相手公開鍵を`$public`と誤って
// 宣言している(実行時のWeb Crypto仕様どおりの名前は`public`。Node/workerdともに`public`だけを読む)。
// 変数の型としてここで正しい形を宣言し、呼び出し側では型チェックを迂回せずに済むようにする。
interface EcdhDeriveBitsAlgorithm {
  name: "ECDH";
  public: CryptoKey;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface WebPushConfig {
  vapidKeyPair: VapidKeyPair;
  /** Web Pushサーバーが送信元に問い合わせるときの連絡先。mailto:から始める。 */
  subject: string;
}

export type WebPushSendResult =
  | { outcome: "sent" }
  // 410 Gone / 404 Not Found。購読が失効した合図で、呼び出し側は購読情報を削除してよい。
  | { outcome: "expired" }
  | { outcome: "failed"; status: number };

// RFC 8291(aes128gcm)で本文を暗号化し、RFC 8292のVAPID認証ヘッダを付けてWeb Pushサーバーへ直接届ける。
// 送信を代行する外部サービスは使わない。
export async function sendWebPush(
  subscription: PushSubscription,
  payload: unknown,
  config: WebPushConfig,
): Promise<WebPushSendResult> {
  const body = await encryptPayload(JSON.stringify(payload), subscription.keys);
  const audience = new URL(subscription.endpoint).origin;
  const authorization = await buildVapidAuthorizationHeader({
    keyPair: config.vapidKeyPair,
    audience,
    subject: config.subject,
  });

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: String(TTL_SECONDS),
    },
    body,
  });

  if (response.status === 404 || response.status === 410) {
    return { outcome: "expired" };
  }
  if (!response.ok) {
    return { outcome: "failed", status: response.status };
  }
  return { outcome: "sent" };
}

async function encryptPayload(plaintext: string, keys: { p256dh: string; auth: string }): Promise<Uint8Array> {
  const receiverPublicKeyBytes = base64UrlDecode(keys.p256dh);
  const authSecret = base64UrlDecode(keys.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const receiverPublicKey = await crypto.subtle.importKey(
    "raw",
    receiverPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const senderKeyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const senderPublicKeyBytes = new Uint8Array(
    (await crypto.subtle.exportKey("raw", senderKeyPair.publicKey)) as ArrayBuffer,
  );
  const deriveAlgorithm: EcdhDeriveBitsAlgorithm = { name: "ECDH", public: receiverPublicKey };
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(deriveAlgorithm, senderKeyPair.privateKey, 256),
  );

  // 購読者の認証シークレットで共有秘密を鍵付けし、双方の公開鍵をひもづけたIKMにする(RFC 8291 §3.3)。
  const authInfo = concatBytes(
    new TextEncoder().encode("WebPush: info\0"),
    receiverPublicKeyBytes,
    senderPublicKeyBytes,
  );
  const inputKeyingMaterial = await hkdf(authSecret, sharedSecret, authInfo, 32);

  const contentEncryptionKey = await hkdf(
    salt,
    inputKeyingMaterial,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(salt, inputKeyingMaterial, new TextEncoder().encode("Content-Encoding: nonce\0"), NONCE_LENGTH);

  const recordPlaintext = concatBytes(new TextEncoder().encode(plaintext), new Uint8Array([PADDING_DELIMITER]));
  const cek = await crypto.subtle.importKey("raw", contentEncryptionKey, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: AUTH_TAG_BITS }, cek, recordPlaintext),
  );

  // RFC 8188のヘッダ: salt(16) || レコードサイズ(4, big-endian) || 鍵id長(1) || 鍵id(送信者の公開鍵)。
  const header = new Uint8Array(16 + 4 + 1 + senderPublicKeyBytes.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false);
  header[20] = senderPublicKeyBytes.length;
  header.set(senderPublicKeyBytes, 21);

  return concatBytes(header, ciphertext);
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, lengthBytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, lengthBytes * 8);
  return new Uint8Array(bits);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
