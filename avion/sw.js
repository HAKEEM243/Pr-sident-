/* Sky Empire — service worker : le jeu s'ouvre comme une application et fonctionne même sans réseau
   (les fichiers du jeu sont gardés en cache ; les mises à jour sont récupérées dès qu'Internet est là). */
const CACHE='sky-empire-v1';
const SHELL=['./','./index.html','./manifest.webmanifest','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{})); self.skipWaiting(); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('sky-empire-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const url=new URL(req.url);
  // fichiers du jeu : réseau d'abord (toujours la dernière version), cache si hors ligne
  if(url.origin===location.origin){
    e.respondWith(fetch(req).then(res=>{ if(res.ok){ const cp=res.clone(); caches.open(CACHE).then(c=>c.put(req,cp)); } return res; })
      .catch(()=>caches.match(req).then(r=>r||caches.match(req,{ignoreSearch:true})).then(r=>r||(req.mode==='navigate'?caches.match('./index.html'):Response.error()))));
    return;
  }
  // bibliothèques (Leaflet, Cesium, MapLibre) : cache d'abord, elles ne changent pas (version fixée)
  if(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com/.test(url.host)){
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{ if(res.ok||res.type==='opaque'){ const cp=res.clone(); caches.open(CACHE).then(c=>c.put(req,cp)); } return res; })));
  }
});
