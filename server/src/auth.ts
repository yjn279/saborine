import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./app.js";

// クライアントが自分で生成するID・合言葉の形式。UUID(ハイフンあり36文字)がそのまま収まる
// 範囲に絞り、Bearerトークン(`<userId>:<secret>`)の区切り文字と衝突しないようにする。
// 下限は22文字(base62で約131ビット相当)とし、人が記憶するパスワードと違って
// 端末が生成する高エントロピーな値であることを長さでも保証する。
const CREDENTIAL_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;

export function isValidCredential(value: string): boolean {
  return CREDENTIAL_PATTERN.test(value);
}

// 合言葉をSHA-256でハッシュ化して保存用の文字列にする。平文のまま保存しないための処理。
// 合言葉は人が選ぶパスワードではなく端末が生成する高エントロピーな乱数(isValidCredentialで
// 22文字=約131ビット以上を強制)なので、遅延のあるパスワード用KDF(Argon2id・scrypt等)は
// 総当たり耐性の面で不要であり、乱数トークンの保存として一般的な高速ハッシュを用いる。
export async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifySecret(secret: string, storedHash: string): Promise<boolean> {
  const actualHash = await hashSecret(secret);
  return timingSafeEqual(actualHash, storedHash);
}

// ハッシュどうしの比較は長さが揃っているため、単純なXOR蓄積で定数時間比較する。
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export interface AuthedUser {
  id: string;
  pairId: string;
  displayName: string;
}

// Authorization: Bearer <userId>:<secret> を検証し、本人であればコンテキストにユーザーを載せる。
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const unauthorized = () => c.json({ error: "認証が必要です" }, 401);

  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    return unauthorized();
  }
  const separatorIndex = token.indexOf(":");
  if (separatorIndex < 0) {
    return unauthorized();
  }
  const userId = token.slice(0, separatorIndex);
  const secret = token.slice(separatorIndex + 1);
  if (!userId || !secret) {
    return unauthorized();
  }

  const db = c.get("db");
  const result = await db.execute({
    sql: "SELECT id, pair_id, display_name, secret_hash FROM users WHERE id = ?",
    args: [userId],
  });
  const row = result.rows[0];
  if (!row) {
    return unauthorized();
  }

  const verified = await verifySecret(secret, String(row.secret_hash));
  if (!verified) {
    return unauthorized();
  }

  c.set("user", {
    id: String(row.id),
    pairId: String(row.pair_id),
    displayName: String(row.display_name),
  });
  await next();
};
