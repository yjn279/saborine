import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { containsBlameWords } from "../src/domain/letter.js";
import { generateWeeklyCardText, getPreviousWeekRange } from "../src/domain/weekly-card.js";
import { createTestDb, registerTestAccount } from "./helpers.js";

// SQLiteに保存するときと同じ"YYYY-MM-DD HH:MM:SS"(UTC、区切りは空白)の形にする。
function formatForStorage(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

describe("週次カードの本文", () => {
  it("常に5行以内で、責める調子にならない", () => {
    const withRecords = generateWeeklyCardText({
      choreTypes: ["お皿洗い", "ゴミ出し", "お皿洗い"],
      thanksCount: 3,
    });
    expect(withRecords.split("\n").length).toBeLessThanOrEqual(5);
    expect(containsBlameWords(withRecords)).toBe(false);

    const empty = generateWeeklyCardText({ choreTypes: [], thanksCount: 0 });
    expect(empty.split("\n").length).toBeLessThanOrEqual(5);
    expect(containsBlameWords(empty)).toBe(false);
    expect(empty).not.toMatch(/あなたは/);
  });

  it("個人名ごとの回数や「あなたは○回」に類する表現を含まない", () => {
    const text = generateWeeklyCardText({ choreTypes: ["お皿洗い"], thanksCount: 5 });
    expect(text).not.toMatch(/あなたは\s*\d+\s*回/);
    expect(text).not.toMatch(/彩花|大樹/);
  });

  it("記録もありがとうも無い週でも、本文が生成される", () => {
    const text = generateWeeklyCardText({ choreTypes: [], thanksCount: 0 });
    expect(text.length).toBeGreaterThan(0);
  });
});

describe("直前の週の範囲", () => {
  it("いま進行中の週の1つ前を返す", () => {
    // 2023-01-08はJSTで日曜日。21:00 JST = 12:00 UTC。
    const currentWeekStart = new Date("2023-01-08T12:00:00.000Z");
    const middleOfCurrentWeek = new Date("2023-01-10T00:00:00.000Z");
    const range = getPreviousWeekRange(middleOfCurrentWeek);
    expect(range.end).toEqual(currentWeekStart);
    expect(range.start).toEqual(new Date("2023-01-01T12:00:00.000Z"));
  });
});

describe("GET /api/weekly-card", () => {
  it("認証なしの要求は401になる", async () => {
    const db = await createTestDb();
    const res = await createApp(db).request("/api/weekly-card");
    expect(res.status).toBe(401);
  });

  it("直前の週の記録とありがとうを埋め込んだ本文を返し、個人別の集計を含まない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");
    const previousWeek = getPreviousWeekRange(new Date());
    const withinPreviousWeek = formatForStorage(new Date(previousWeek.start.getTime() + 60_000));

    const choreLogId = crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO chore_logs (id, pair_id, user_id, chore_type, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [choreLogId, account.pairId, account.userId, "お皿洗い", withinPreviousWeek],
    });
    await db.execute({
      sql: "INSERT INTO thanks (id, chore_log_id, user_id, created_at) VALUES (?, ?, ?, ?)",
      args: [crypto.randomUUID(), choreLogId, account.userId, withinPreviousWeek],
    });

    const res = await createApp(db).request("/api/weekly-card", {
      headers: { Authorization: account.authorization },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { weekStart: string; weekEnd: string; storyText: string };
    expect(body.weekStart).toBe(previousWeek.start.toISOString());
    expect(body.storyText).toContain("お皿洗い");
    expect(body.storyText.split("\n").length).toBeLessThanOrEqual(5);

    const text = JSON.stringify(body);
    expect(text).not.toMatch(/あなたは\s*\d+\s*回/);
    expect(body).not.toHaveProperty("myCount");
    expect(body).not.toHaveProperty("partnerCount");
  });

  it("記録が1件も無い週でも、責める調子にならない本文が返る", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");

    const res = await createApp(db).request("/api/weekly-card", {
      headers: { Authorization: account.authorization },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { storyText: string };
    expect(containsBlameWords(body.storyText)).toBe(false);
  });

  it("同じ週に2回求めても同じ本文が返り、作り直さない", async () => {
    const db = await createTestDb();
    const account = await registerTestAccount(db, "彩花");
    const previousWeek = getPreviousWeekRange(new Date());
    const withinPreviousWeek = formatForStorage(new Date(previousWeek.start.getTime() + 60_000));
    await db.execute({
      sql: "INSERT INTO chore_logs (id, pair_id, user_id, chore_type, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), account.pairId, account.userId, "ゴミ出し", withinPreviousWeek],
    });

    const app = createApp(db);
    const first = await app.request("/api/weekly-card", {
      headers: { Authorization: account.authorization },
    });
    const firstBody = (await first.json()) as { storyText: string };

    // 1回目の取得の後に新しい記録を足しても、本文は作り直されない。
    await db.execute({
      sql: "INSERT INTO chore_logs (id, pair_id, user_id, chore_type, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), account.pairId, account.userId, "せんたく", withinPreviousWeek],
    });

    const second = await app.request("/api/weekly-card", {
      headers: { Authorization: account.authorization },
    });
    const secondBody = (await second.json()) as { storyText: string };
    expect(secondBody.storyText).toBe(firstBody.storyText);

    const rows = await db.execute({
      sql: "SELECT id FROM weekly_cards WHERE pair_id = ?",
      args: [account.pairId],
    });
    expect(rows.rows).toHaveLength(1);
  });
});
