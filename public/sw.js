const CACHE_NAME = "streamhub-pwa-v2";

const STATIC_CACHE_URLS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

const NETWORK_ONLY_PATHS = [
  "/api/",
  "/live/",
  "/watch/",
  "/admin/",
  "/analytics",
  "/wallet",
  "/profile/",
  "/notifications",
  "/following",
  "/explore",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_CACHE_URLS);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (cacheName) {
            return cacheName !== CACHE_NAME;
          })
          .map(function (cacheName) {
            return caches.delete(cacheName);
          })
      );
    })
  );

  self.clients.claim();
});

function shouldUseNetworkOnly(url) {
  return NETWORK_ONLY_PATHS.some(function (path) {
    return url.pathname.startsWith(path);
  });
}

self.addEventListener("fetch", function (event) {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (shouldUseNetworkOnly(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match("/offline");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cachedResponse) {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then(function (networkResponse) {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          return caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(function () {
          return caches.match("/offline");
        });
    })
  );
});

self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};

  const title = data.title || "StreamHub";

  const options = {
    body: data.body || "You have a new notification.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: data.url || "/notifications",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url || "/notifications";

  event.waitUntil(clients.openWindow(url));
});