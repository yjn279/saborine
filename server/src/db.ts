import { createClient } from "@libsql/client/web";
import type { Client, Config } from "@libsql/client/web";

// Worker上ではHTTP経由のlibSQLクライアント(@libsql/client/web)を使う。
// テストではNode用クライアントの:memory:に差し替える(server/test/helpers.ts)。
// どちらも@libsql/core/apiの同じClient型を実装するため、呼び出し側は区別しない。
export type Db = Client;

export function createDb(config: Config): Db {
  return createClient(config);
}
