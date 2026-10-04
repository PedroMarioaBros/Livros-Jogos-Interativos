const CACHE_NAME = "livros-jogos-v49";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./assets/app-icon-192.png",
  "./assets/app-icon-512.png",
  "./src/style.css",
  "./src/app.js",
  "./src/engine/dice.js",
  "./src/engine/character.js",
  "./src/engine/luck.js",
  "./src/engine/combat.js",
  "./src/engine/magic.js",
  "./src/engine/sync.js",
  "./src/engine/story.js",
  "./src/engine/encounter.js",
  "./src/engine/save.js",
  "./src/engine/spell-combat.js",
  "./src/engine/duo.js",
  "./src/engine/merchant.js",
  "./src/engine/combat-item.js",
  "./jogos/catalogo.json",
  "./jogos/furia-de-principes/game.json",
  "./jogos/furia-de-principes/data/colthar.json",
  "./jogos/furia-de-principes/data/lothar.json",
  "./jogos/furia-de-principes/data/sincronizacao.json",
  "./jogos/furia-de-principes/rules/base.json",
  "./jogos/furia-de-principes/rules/spells.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (
            response.ok &&
            new URL(event.request.url).origin === self.location.origin
          ) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, copy)
            );
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
