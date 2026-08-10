import type { Client } from "@libsql/client";

export declare function readMigrationFiles(): Array<{ name: string; sql: string }>;
export declare function applyMigrations(client: Client): Promise<void>;
