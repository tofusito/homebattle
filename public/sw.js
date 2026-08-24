const CACHE = "happy-home-v6";
// Con red lenta no esperamos al timeout del sistema: pasado este margen se
// sirve el shell cacheado y la red sigue su curso en segundo plano.
const NAVIGATION_TIMEOUT_MS = 3500;
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon-home-sparkle.png",
  "/apple-touch-icon.png",
  "/icons/icon-home-sparkle-192.png",
  "/icons/icon-home-sparkle-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.url.includes("/api/events") || request.url.includes("_serverFn")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const network = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
        const timeout = new Promise((resolve) =>
          setTimeout(() => resolve("timeout"), NAVIGATION_TIMEOUT_MS),
        );
        const winner = await Promise.race([network.catch(() => "offline"), timeout]);
        if (winner !== "timeout" && winner !== "offline") return winner;
        const cached = (await caches.match(request)) || (await caches.match("/"));
        if (cached) return cached;
        // Sin caché (primera visita): no queda otra que esperar a la red.
        return network.catch(
          () =>
            new Response("Sin conexión", {
              status: 503,
              headers: { "content-type": "text/plain; charset=utf-8" },
            }),
        );
      })(),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Happy Home", {
      body: payload.body || "La casa tiene algo amable que recordarte.",
      icon: "/icons/icon-home-sparkle-192.png",
      badge: "/icons/icon-home-sparkle-192.png",
      tag: payload.tag || "happy-home-reminder",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const visible = clients.find((client) => "focus" in client);
      if (visible) {
        visible.navigate(url);
        return visible.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
