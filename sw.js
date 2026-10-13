/* MyLexicon — service worker : fonctionnement 100 % hors ligne dès la première visite. */
const VERSION = "mylexicon-v1";
const CORE = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

function extractAssets(html) {
  const urls = new Set();
  let m;
  const a = /(?:src|href)=["'](\/_next\/[^"']+)["']/g;
  while ((m = a.exec(html))) urls.add(m[1]);
  const b = /\/_next\/static\/[^"'\\\s)]+/g;
  while ((m = b.exec(html))) urls.add(m[0]);
  const c = /static\/(?:chunks|media|css)\/[^"'\\\s)]+\.(?:js|css|woff2?)/g;
  while ((m = c.exec(html))) urls.add("/_next/" + m[0]);
  return Array.from(urls).map((u) => u.replace(/\\u0026/g, "&"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.all(CORE.map((u) => cache.add(new Request(u, { cache: "reload" })).catch(() => undefined)));
      try {
        const res = await fetch("/", { cache: "reload" });
        const html = await res.text();
        await Promise.all(extractAssets(html).map((u) => cache.add(new Request(u, { cache: "reload" })).catch(() => undefined)));
      } catch (e) {
        /* hors ligne pendant l'installation : le cache sera complété à l'exécution */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(
        data.urls
          .filter((u) => typeof u === "string" && new URL(u).origin === self.location.origin)
          .map((u) => cache.match(u).then((hit) => hit || cache.add(u).catch(() => undefined)))
      )
    )
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation : réseau d'abord (version à jour), sinon page en cache.
  if (req.mode === "navigate") {
    event.respondWith(
      Promise.race([fetch(req), timeout(4000)])
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(async () => (await caches.match("/")) || Response.error())
    );
    return;
  }

  // Fichiers immuables de Next.js : cache d'abord.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Le reste : cache d'abord, mise à jour en arrière-plan.
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || net;
    })
  );
});
