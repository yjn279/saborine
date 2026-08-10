import { Platform } from "react-native";
import { apiRequest } from "../api/client";
import type { Identity } from "../auth/identity";

const SERVICE_WORKER_PATH = "/sw.js";

interface PushSubscriptionRequest {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type SubscribeResult =
  | { subscribed: true }
  // unsupported: この環境ではお知らせを購読できない(対応していないブラウザ、
  // またはiOSでホーム画面に追加していない状態)。permission_denied: 許可を拒まれた。
  // failed: 対応してはいるが、購読の作成またはサーバーへの登録に失敗した。
  | { subscribed: false; reason: "unsupported" | "permission_denied" | "failed" };

// このブラウザ・環境がお知らせの購読に対応しているか。iOSは「ホーム画面に追加」した
// 状態でしか対応せず、その場合もこの判定は自然にfalseになる(docs/mvp.md:128)。
export function isPushSupported(): boolean {
  return (
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toSubscriptionRequest(subscription: PushSubscription): PushSubscriptionRequest | null {
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return null;
  }
  return { endpoint, keys: { p256dh, auth } };
}

// お知らせの購読を作り、サーバー(server/src/routes/push.ts)に登録する。対応していない・
// 許可されなかった・失敗したときは理由付きで知らせる。呼び出し側はこれを使って、
// アプリ内バナー(InAppBanner)への切り替えを判断する。代替値で購読できたことにはしない。
export async function subscribeToPush(identity: Identity): Promise<SubscribeResult> {
  if (!isPushSupported()) {
    return { subscribed: false, reason: "unsupported" };
  }
  const publicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return { subscribed: false, reason: "unsupported" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { subscribed: false, reason: "permission_denied" };
    }

    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    const body = toSubscriptionRequest(subscription);
    if (!body) {
      return { subscribed: false, reason: "failed" };
    }

    await apiRequest("/api/push/subscription", { method: "POST", identity, body });
    return { subscribed: true };
  } catch {
    return { subscribed: false, reason: "failed" };
  }
}

// この端末に、お知らせの購読がすでにあるか調べる。対応していない環境ではfalseを返す。
export async function hasPushSubscription(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  return subscription != null;
}

// 購読を解除する。購読していない、または対応していない環境では何もしない。
export async function unsubscribeFromPush(identity: Identity): Promise<void> {
  if (!isPushSupported()) {
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    return;
  }
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await apiRequest("/api/push/subscription", { method: "DELETE", identity, body: { endpoint } });
}
