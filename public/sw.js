const CACHE_NAME = "streamhub-pwa-v3";

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
  "/incoming-call/",
  "/calls",
  "/messages",
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

function isBuildAsset(url) {
  return url.pathname.startsWith("/_next/");
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

  // Page navigations: network first, offline page only as last resort.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match("/offline");
      })
    );
    return;
  }

  // Build assets (CSS/JS chunks): network first so a fresh deploy is
  // always picked up. Cached copy is only a fallback, and a failed
  // request is NEVER answered with HTML.
  if (isBuildAsset(url)) {
    event.respondWith(
      fetch(request)
        .then(function (networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(function () {
          return caches.match(request).then(function (cachedResponse) {
            return cachedResponse || Response.error();
          });
        })
    );
    return;
  }

  // Other static files (icons, sounds): cache first, but a miss +
  // network failure returns a real error, never the offline HTML page.
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
          return Response.error();
        });
    })
  );
});

self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};

  const isIncomingCall =
    data.type === "incoming_call" || data.notificationType === "incoming_call";

  // Incoming calls are handled by the native notification (Android) and
  // the in-app IncomingCallPopup. Skip the duplicate web notification.
  if (isIncomingCall) return;

  const title = data.title || "StreamHub";

  const options = {
    body: data.body || "You have a new notification.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: data.url || "/notifications",
      type: data.type || data.notificationType || "general",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url || "/notifications";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // Prefer focusing an already-open app window.
        if (clientList.length > 0) {
          const client = clientList[0];
          if ("focus" in client) client.focus();
          if ("navigate" in client) return client.navigate(url);
          return;
        }

        return clients.openWindow(url);
      })
  );
});
