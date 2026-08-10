import { describe, expect, it } from "vitest";
import { createTestDb } from "./helpers.js";

const EXPECTED_TABLES = [
  "affections",
  "characters",
  "chore_logs",
  "pairs",
  "push_subscriptions",
  "thanks",
  "users",
  "weekly_cards",
].sort();

// 責める材料になり得る状態(既読・未読・放置日数など)や、
// 個人別の家事回数を集計して保持する列を検出するための語。
const FORBIDDEN_COLUMN_PATTERNS = [
  /count/i,
  /read/i,
  /neglect/i,
  /idle/i,
  /streak/i,
  /last_active/i,
  /ignored/i,
];

describe("データの置き場", () => {
  it("7つのまとまりとお知らせ購読の、合わせて8つのテーブルができる", async () => {
    const db = await createTestDb();
    const result = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const tableNames = result.rows.map((row) => String(row.name)).sort();
    expect(tableNames).toEqual(EXPECTED_TABLES);
  });

  it("ビューを持たない(個人別の集計を隠し持たない)", async () => {
    const db = await createTestDb();
    const result = await db.execute("SELECT name FROM sqlite_master WHERE type = 'view'");
    expect(result.rows).toHaveLength(0);
  });

  it("責める材料になる列や、家事回数の集計を保持する列を持たない", async () => {
    const db = await createTestDb();
    for (const table of EXPECTED_TABLES) {
      const result = await db.execute(`PRAGMA table_info(${table})`);
      for (const row of result.rows) {
        const columnName = String(row.name);
        const matched = FORBIDDEN_COLUMN_PATTERNS.some((pattern) => pattern.test(columnName));
        expect(matched, `${table}.${columnName} は責める材料または集計の列に見える`).toBe(false);
      }
    }
  });
});
