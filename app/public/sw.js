// Minimal offline support. The food log lives in IndexedDB (handled by the app);
// this just caches the app shell + foods.json so the PWA opens without a network.
// Base path this SW is served under ("" at root, "/pasto" on GitHub Pages).
const BASE = self.location.pathname.replace(/\/sw\.js.*$/, "");
const CACHE = "pasto-v8"; // bumped for the new logo — clears the old icon cache
const PRECACHE = [`${BASE}/`, `${BASE}/foods.json`, `${BASE}/manifest.json`, `${BASE}/icon.svg`];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first for navigations/data (fresh when online), falling back to cache
// when offline. Other GETs are cache-first.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isAppData =
    request.mode === "navigate" ||
    url.pathname === `${BASE}/foods.json` ||
    url.pathname === `${BASE}/exercises.json`;
  if (isAppData) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((m) => m || caches.match(`${BASE}/`))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});

// ---- Water reminders (web push) --------------------------------------------
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text ? event.data.text() : "" };
  }
  const title = data.title || "💧 Time to drink water";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: `${BASE}/icon-192.png`,
      badge: `${BASE}/icon-192.png`,
      tag: "water-reminder",
      renotify: true,
      data: { url: data.url || `${BASE}/` },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || `${BASE}/`;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(BASE) && "focus" in w) return w.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
