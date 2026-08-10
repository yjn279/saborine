import type { Identity } from "../auth/identity";
import { apiRequest } from "./client";

// サーバーとやりとりする値の形。サーバー側(server/src/routes/invite.ts)の入出力に合わせる。

// 送るための手紙。相手が開いたか・受諾したかの状態は含まれない(server/src/routes/invite.ts)。
export interface InviteLetter {
  body: string[];
  token: string;
  link: string;
}

export function fetchInviteLetter(identity: Identity): Promise<InviteLetter> {
  return apiRequest<InviteLetter>("/api/invite/letter", { identity });
}

// 受け取った手紙のプレビュー。認証なしで見られる。
export interface InvitePreview {
  body: string[];
  characterName?: string;
}

export function fetchInvitePreview(token: string): Promise<InvitePreview> {
  return apiRequest<InvitePreview>(`/api/invite/${token}`);
}

export interface AcceptInviteRequest {
  displayName: string;
  userId: string;
  secret: string;
}

export interface AcceptInviteResponse {
  userId: string;
  displayName: string;
  pairId: string;
  characterId: string;
  characterName: string;
}

// 受諾して登録し、ペアに加わる。受諾する側はまだ身分証を持たないため認証は不要。
export function acceptInvite(
  token: string,
  request: AcceptInviteRequest,
): Promise<AcceptInviteResponse> {
  return apiRequest<AcceptInviteResponse>(`/api/invite/${token}/accept`, {
    method: "POST",
    body: request,
  });
}
