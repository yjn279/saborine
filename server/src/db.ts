import { createClient } from "@libsql/client/web";
import type { Client, Config } from "@libsql/client/web";

// Worker上ではHTTP経由のlibSQLクライアント(@libsql/client/web)を使う。
// テストではNode用クライアントの:memory:に差し替える(server/test/helpers.ts)。
// どちらも@libsql/core/apiの同じClient型を実装するため、呼び出し側は区別しない。
export type Db = Client;

export function createDb(config: Config): Db {
  return createClient(config);
}

// SQLiteのCURRENT_TIMESTAMPは"YYYY-MM-DD HH:MM:SS"(UTC、区切りは空白)で保存される。
// JSのDateとして扱えるよう、T区切り+Zサフィックスの形に直す。
export function parseStoredTimestamp(value: unknown): Date {
  return new Date(`${String(value).replace(" ", "T")}Z`);
}

// parseStoredTimestampの逆変換。DateをWHERE句のcreated_at比較に使える
// "YYYY-MM-DD HH:MM:SS"形式へ直す。
export function formatStoredTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}
