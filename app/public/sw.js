// サボリーヌのService Worker。オフラインの最小対応と、届いたお知らせの表示・
// タップで該当画面を開く処理だけを担う。お知らせの中身はサーバー
// (server/src/push/notifications.ts)が組み立てた「良い出来事だけ」の4種であり、
// ここではそれをそのまま表示するだけで、催促の文言は一切足さない。

const CACHE_NAME = "saborine-shell-v1";
const OFFLINE_URLS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// 最小のオフライン対応。ネットワークを優先し、つながらないときだけキャッシュへ逃がす。
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
  );
});

// お知らせをタップしたときに開く画面。週次カードだけ専用の画面へ、それ以外はホームへ。
const NOTIFICATION_PATHS = {
  chore_recorded: "/",
  thanks_received: "/",
  growth: "/",
  weekly_card: "/weekly",
};

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const path = NOTIFICATION_PATHS[payload.kind] || "/";
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { path },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ("focus" in client) {
          if ("navigate" in client) {
            client.navigate(path);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(path);
      }
      return undefined;
    }),
  );
});
