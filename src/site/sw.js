// Service worker de Coq Civique : l'application de révision fonctionne même sans connexion.
// La version, la page de l’application et la liste des fichiers à garder sont insérées par scripts/build.mjs.
const CACHE = "coq-__VERSION__";
const APP = "__APP__";
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("coq-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase et autres services : jamais en cache

  // Pages : réseau d'abord (contenu à jour), copie locale si pas de connexion
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match(APP)))
    );
    return;
  }

  // Fichiers statiques (versionnés) : cache d'abord. Vidéo et PDF : laissés au navigateur.
  if (/\.(css|js|woff2|png|jpg|jpeg|webp|svg|json|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((m) => m || fetch(req).then((res) => {
        if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
