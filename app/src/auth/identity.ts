import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// 初回起動時に端末が作るID・合言葉の組。以後はこれをBearerトークン
// (`<userId>:<secret>`)としてサーバーに送る(server/src/auth.ts)。
export interface Identity {
  userId: string;
  secret: string;
}

const STORAGE_KEY = "saborine.identity";

// Web: ブラウザの保存領域。iOS: 端末の安全な保存領域(SecureStore)。
async function readStorage(): Promise<string | null> {
  if (Platform.OS === "web") {
    return window.localStorage.getItem(STORAGE_KEY);
  }
  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function writeStorage(value: string): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.setItem(STORAGE_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, value);
}

// 保存済みの身分証を読み出す。ないときはnull(まだ登録していない)を返す。
export async function loadIdentity(): Promise<Identity | null> {
  const raw = await readStorage();
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
  await writeStorage(JSON.stringify(identity));
}

// ペア解除・アカウント削除の直後にだけ呼ぶ。サーバー側で使えなくなった身分証を
// 端末からも消し、再読み込みしても「登録済み」に戻らないようにする。
export async function clearIdentity(): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
