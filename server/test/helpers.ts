import { createClient } from "@libsql/client";
import { applyMigrations } from "../scripts/apply-migrations.mjs";
import type { Db } from "../src/db.js";

// テスト用のデータベース。起動不要なNode用クライアントの:memory:に、
// server/migrations/ と同じSQLを適用して組み立てる。
export async function createTestDb(): Promise<Db> {
  const db = createClient({ url: ":memory:" });
  await applyMigrations(db);
  return db;
}
