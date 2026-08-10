import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./app.js";
import type { Db } from "./db.js";

// クライアントが自分で生成するID・合言葉の形式。UUID(ハイフンあり36文字)がそのまま収まる
// 範囲に絞り、Bearerトークン(`<userId>:<secret>`)の区切り文字と衝突しないようにする。
// 下限は22文字(base62で約131ビット相当)とし、人が記憶するパスワードと違って
// 端末が生成する高エントロピーな値であることを長さでも保証する。
const CREDENTIAL_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;

export function isValidCredential(value: string): boolean {
  return CREDENTIAL_PATTERN.test(value);
}

export const DISPLAY_NAME_MAX_LENGTH = 30;

export interface RegistrationInput {
  displayName: string;
  userId: string;
  secret: string;
}

export type RegistrationValidation =
  | { ok: true; input: RegistrationInput }
  | { ok: false; error: string };

// 表示名だけの新規登録(routes/account.ts)と、招待の受諾登録(routes/invite.ts)が
// 共有する入力チェック。表示名・クライアント生成のID/合言葉の形を検証する。
export function validateRegistrationInput(body: unknown): RegistrationValidation {
  const record = body as { displayName?: unknown; userId?: unknown; secret?: unknown } | null;
  const displayName = typeof record?.displayName === "string" ? record.displayName.trim() : "";
  const userId = typeof record?.userId === "string" ? record.userId : "";
  const secret = typeof record?.secret === "string" ? record.secret : "";

  if (!displayName || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, error: "表示名を入力してください" };
  }
  if (!isValidCredential(userId) || !isValidCredential(secret)) {
    return { ok: false, error: "登録情報が正しくありません" };
  }
  return { ok: true, input: { displayName, userId, secret } };
}

export interface RegisteredUser {
  pairId: string;
  displayName: string;
  secretHash: string;
}

// 指定したIDのユーザーがすでに登録済みなら、その中身を返す。
// 呼び出し側は合言葉が一致するかで「同じ端末からの送り直し」と「別人の衝突」を見分ける。
export async function findRegisteredUser(db: Db, userId: string): Promise<RegisteredUser | null> {
  const existing = await db.execute({
    sql: "SELECT pair_id, display_name, secret_hash FROM users WHERE id = ?",
    args: [userId],
  });
  const row = existing.rows[0];
  if (!row) {
    return null;
  }
  return {
    pairId: String(row.pair_id),
    displayName: String(row.display_name),
    secretHash: String(row.secret_hash),
  };
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
