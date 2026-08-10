import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Web: ブラウザの保存領域。iOS: 端末の安全な保存領域(SecureStore)。
// 身分証(auth/identity.ts)・招待の再提示回数(app/invite.tsx)など、端末に
// 単純な文字列を残しておきたい画面はすべてこれを共有する。
export async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setStorageItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeStorageItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
