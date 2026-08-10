import { createClient } from "@libsql/client";
import { applyMigrations } from "./apply-migrations.mjs";

const url = process.argv[2] ?? "file:.dev.db";
const client = createClient({ url });

try {
  await applyMigrations(client);
  console.log(`migrated: ${url}`);
} finally {
  client.close();
}
