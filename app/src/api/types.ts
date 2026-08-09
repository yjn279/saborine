// サーバーとやりとりする値の形。サーバー側(server/src/routes/account.ts)の入出力に合わせる。

// 表示名だけの登録。IDと合言葉は端末側(src/auth/identity.ts)で作って一緒に送る。
export interface RegisterAccountRequest {
  displayName: string;
  userId: string;
  secret: string;
}

export interface RegisterAccountResponse {
  userId: string;
  displayName: string;
  pairId: string;
  characterId: string;
  characterName: string;
}
