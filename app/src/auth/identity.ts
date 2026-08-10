import * as Crypto from "expo-crypto";
import { getStorageItem, removeStorageItem, setStorageItem } from "../storage";

// 初回起動時に端末が作るID・合言葉の組。以後はこれをBearerトークン
// (`<userId>:<secret>`)としてサーバーに送る(server/src/auth.ts)。
export interface Identity {
  userId: string;
  secret: string;
}

const STORAGE_KEY = "saborine.identity";

// 保存済みの身分証を読み出す。ないときはnull(まだ登録していない)を返す。
export async function loadIdentity(): Promise<Identity | null> {
  const raw = await getStorageItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as Identity;
}

// 新しいID・合言葉を作る。人が選ぶパスワードではなく端末が生成する乱数で、
// サーバー側の最小長チェック(22文字以上、server/src/auth.ts)を満たす。
export function createIdentity(): Identity {
  return { userId: Crypto.randomUUID(), secret: Crypto.randomUUID() };
}

// 登録に成功したあとにだけ呼ぶ。失敗した身分証を保存しないことで、
// 再読み込み時に「登録済み」と誤判定しないようにする。
export async function saveIdentity(identity: Identity): Promise<void> {
  await setStorageItem(STORAGE_KEY, JSON.stringify(identity));
}

// ペア解除・アカウント削除の直後にだけ呼ぶ。サーバー側で使えなくなった身分証を
// 端末からも消し、再読み込みしても「登録済み」に戻らないようにする。
export async function clearIdentity(): Promise<void> {
  await removeStorageItem(STORAGE_KEY);
}
