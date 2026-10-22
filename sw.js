const CACHE_NAME = 'hakvision-president-v3';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Sky Empire (dossier avion/) : il a son propre service worker. Si on arrive ici (adresse sans « / »
  // final, ou avant son installation), on ne casse rien : réseau, sinon la copie gardée par le jeu.
  const u = new URL(event.request.url), scopePath = new URL(self.registration.scope).pathname;
  if (u.origin === location.origin && u.pathname.startsWith(scopePath + 'avion')) {
    const nav = event.request.mode === 'navigate';
    if (nav && u.pathname === scopePath + 'avion') { event.respondWith(fetch(event.request).catch(() => Response.redirect(scopePath + 'avion/' + u.search, 302))); return; }
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request, { ignoreSearch: true })
      .then((r) => r || (nav ? caches.match(scopePath + 'avion/index.html', { ignoreSearch: true }).then((x) => x || caches.match(scopePath + 'avion/')).then((x) => x || Response.error()) : Response.error()))));
    return;
  }
  const isAppShell = event.request.mode === 'navigate' || event.request.destination === 'document'
    || event.request.url.endsWith('manifest.json');
  if (isAppShell) {
    // Le jeu change souvent : toujours tenter le réseau en premier, pour ne
    // jamais coincer un joueur sur une version obsolète. Le cache ne sert
    // qu'en secours hors-ligne.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
