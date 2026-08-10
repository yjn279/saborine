import { apiRequest } from "./client";
import type { RegisterAccountRequest, RegisterAccountResponse } from "./types";

// サーバーとやりとりする値の形は app/src/api/types.ts に合わせる(server/src/routes/account.ts)。

// 表示名だけで新規登録する。登録前で身分証をまだ持たないため認証は不要。
export function registerAccount(
  request: RegisterAccountRequest,
): Promise<RegisterAccountResponse> {
  return apiRequest<RegisterAccountResponse>("/api/account", { method: "POST", body: request });
}
