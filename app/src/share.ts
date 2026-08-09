import { Platform, Share } from "react-native";

export interface ShareContent {
  // Web Share API(navigator.share)に渡す形。
  web: ShareData;
  // React NativeのShare.share、またはクリップボードへのコピーに使う本文。
  message: string;
}

// Web: navigator.share があれば使う。無ければクリップボードへコピーする
// (招待リンクの共有・週次カードの保存で共通の最小手段)。ネイティブ: Share.share。
// クリップボードへコピーしたときだけtrueを返す。呼び出し側は「コピーしたよ」の表示に使う。
export async function shareOrCopy(content: ShareContent): Promise<boolean> {
  if (Platform.OS === "web") {
    const nav = window.navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      await nav.share(content.web).catch(() => undefined);
      return false;
    }
    return copyToClipboard(content.message);
  }
  await Share.share({ message: content.message });
  return false;
}

// Webのクリップボードへ本文をコピーする。コピーできたときだけtrueを返す。
export async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS === "web" && window.navigator.clipboard) {
    await window.navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}
