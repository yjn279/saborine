import type { Identity } from "../auth/identity";
import { apiRequest } from "./client";

// サーバーとやりとりする値の形。サーバー側(server/src/routes/settings.ts)の入出力に合わせる。
// この4項目だけが設定であり、通知・催促・タスク割当に類する項目は持たない。

export interface SettingsState {
  notificationsEnabled: boolean;
  characterName: string;
}

export function fetchSettings(identity: Identity): Promise<SettingsState> {
  return apiRequest<SettingsState>("/api/settings", { identity });
}

export interface UpdateSettingsRequest {
  notificationsEnabled?: boolean;
  characterName?: string;
}

export function updateSettings(
  identity: Identity,
  request: UpdateSettingsRequest,
): Promise<SettingsState> {
  return apiRequest<SettingsState>("/api/settings", { method: "PATCH", identity, body: request });
}

// ペア解除。ふたりで育てていたサボリーヌごと、ペアのデータを手放す(server/src/routes/pair.ts)。
export function unpair(identity: Identity): Promise<void> {
  return apiRequest<void>("/api/pair", { method: "DELETE", identity });
}

// アカウント削除。自分ぶんの身分証だけを消す(server/src/routes/account.ts)。
export function deleteAccount(identity: Identity): Promise<void> {
  return apiRequest<void>("/api/account", { method: "DELETE", identity });
}
