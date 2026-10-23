/* Sky Empire — service worker : le jeu s'ouvre comme une application et fonctionne SANS RÉSEAU
   • fichiers du jeu, carte (Leaflet) et image de la Terre : gardés sur le téléphone ;
   • 3D (Cesium) : téléchargée en arrière-plan une fois, puis gardée ;
   • images de carte et de relief déjà vues : gardées (les plus anciennes sont effacées au-delà de 6 000).
   Les mises à jour sont récupérées dès qu'Internet est là. */
const CACHE='sky-empire-v29', TILES='sky-tiles-v1';
const SHELL=['./','./index.html','./manifest.webmanifest','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./lib/leaflet/leaflet.js','./lib/leaflet/leaflet.css','./offline/earth-merc.jpg','./offline/earth-eq.jpg'];
const CES='https://cdn.jsdelivr.net/npm/cesium@1.146.0/Build/Cesium/';
const CES_FILES=['Cesium.js','Widgets/widgets.css','Assets/approximateTerrainHeights.json','Assets/IAU2006_XYS/IAU2006_XYS_17.json','Assets/IAU2006_XYS/IAU2006_XYS_18.json','Assets/IAU2006_XYS/IAU2006_XYS_19.json','Assets/Images/ion-credit.png',
  'Assets/Textures/moonSmall.jpg','Assets/Textures/waterNormals.jpg','Assets/Textures/waterNormalsSmall.jpg',...['mx','my','mz','px','py','pz'].map(s=>`Assets/Textures/SkyBox/tycho2t3_80_${s}.jpg`),
  ...["chunk-6FYG4X2F.js", "chunk-GWE2HRAQ.js", "chunk-HNL5VMHB.js", "chunk-IGOYCRIJ.js", "chunk-J6FR5PFB.js", "chunk-LOEQS4D5.js", "chunk-MXXXHGW3.js", "chunk-QVYSL4VL.js", "chunk-VF77DAIX.js", "chunk-YYTML7GF.js", "combineGeometry.js", "createBoxGeometry.js", "createBoxOutlineGeometry.js", "createCircleGeometry.js", "createCircleOutlineGeometry.js", "createCoplanarPolygonGeometry.js", "createCoplanarPolygonOutlineGeometry.js", "createCorridorGeometry.js", "createCorridorOutlineGeometry.js", "createCylinderGeometry.js", "createCylinderOutlineGeometry.js", "createEllipseGeometry.js", "createEllipseOutlineGeometry.js", "createEllipsoidGeometry.js", "createEllipsoidOutlineGeometry.js", "createFrustumGeometry.js", "createFrustumOutlineGeometry.js", "createGeometry.js", "createGroundPolylineGeometry.js", "createPlaneGeometry.js", "createPlaneOutlineGeometry.js", "createPolygonGeometry.js", "createPolygonOutlineGeometry.js", "createPolylineGeometry.js", "createPolylineVolumeGeometry.js", "createPolylineVolumeOutlineGeometry.js", "createRectangleGeometry.js", "createRectangleOutlineGeometry.js", "createSimplePolylineGeometry.js", "createSphereGeometry.js", "createSphereOutlineGeometry.js", "createTaskProcessorWorker.js", "createVectorTileClampedPolylines.js", "createVectorTileGeometries.js", "createVectorTilePoints.js", "createVectorTilePolygons.js", "createVectorTilePolylines.js", "createVerticesFromCesium3DTilesTerrain.js", "createVerticesFromGoogleEarthEnterpriseBuffer.js", "createVerticesFromHeightmap.js", "createVerticesFromQuantizedTerrainMesh.js", "createWallGeometry.js", "createWallOutlineGeometry.js", "decodeDraco.js", "decodeGoogleEarthEnterprisePacket.js", "decodeI3S.js", "gaussianSplatSorter.js", "gaussianSplatTextureGenerator.js", "incrementallyBuildTerrainPicker.js", "transcodeKTX2.js", "transferTypedArrayTest.js", "upsampleQuantizedTerrainMesh.js", "upsampleVerticesFromCesium3DTilesTerrain.js"].map(w=>'Workers/'+w)];
const TILE_HOSTS=/(^|\.)arcgisonline\.com$|(^|\.)basemaps\.cartocdn\.com$|^tile\.openstreetmap\.org$|^tiles\.maps\.eox\.at$|^gibs\.earthdata\.nasa\.gov$|^s3\.amazonaws\.com$/;
// installation : tout le jeu est gardé tout de suite (pages, scripts, carte, image de la Terre), pas au fil des écrans
self.addEventListener('install',e=>{ e.waitUntil((async()=>{ const c=await caches.open(CACHE); await Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})));
  try{ const html=await (await fetch('./index.html',{cache:'no-store'})).text(), files=[...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(u=>!/^(https?:|data:|\/\/)/.test(u));
    let i=0; const run=async()=>{ while(i<files.length){ const u=files[i++]; await c.add(u).catch(()=>{}); } }; await Promise.all([run(),run(),run(),run()]); }catch(err){} })()); self.skipWaiting(); });
// nouvelle version du service worker : anciens caches supprimés et pages ouvertes rechargées (partie gardée par le jeu)
self.addEventListener('activate',e=>{ e.waitUntil((async()=>{
  const ks=await caches.keys(), old=ks.filter(k=>k.startsWith('sky-empire-')&&k!==CACHE);
  // la 3D déjà téléchargée est reprise de l'ancien cache (pas besoin de la retélécharger)
  try{ const nc=await caches.open(CACHE); for(const k of old){ const oc=await caches.open(k); for(const rq of await oc.keys()) if(rq.url.startsWith(CES)||/\/offline\/|\/lib\//.test(rq.url)){ const r=await oc.match(rq); if(r) await nc.put(rq,r); } } }catch(err){}
  await Promise.all(old.map(k=>caches.delete(k)));
  try{ const t=await caches.open(TILES); for(const rq of await t.keys()){ const r=await t.match(rq); if(!r||r.type==='opaque') await t.delete(rq); } }catch(err){}   // anciennes images opaques : trop lourdes
  await self.clients.claim();
  if(old.length){ const cs=await self.clients.matchAll({type:'window'}); await Promise.all(cs.map(c=>c.navigate(c.url).catch(()=>{}))); }   // mise à jour d'une ancienne version : on recharge une fois
})()); });
// réseau avec délai : en avion ou avec un mauvais réseau, on n'attend pas plus de 4 s avant de prendre la copie gardée
const timed=(p,ms)=>new Promise((res,rej)=>{ const t=setTimeout(()=>rej(new Error('lent')),ms); p.then(v=>{ clearTimeout(t); res(v); },e=>{ clearTimeout(t); rej(e); }); });
let puts=0;
async function trimTiles(){ try{ const c=await caches.open(TILES), k=await c.keys(); if(k.length>6000) for(const rq of k.slice(0,k.length-5000)) await c.delete(rq); }catch(e){} }
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const url=new URL(req.url);
  // fichiers du jeu : réseau d'abord (toujours la dernière version), copie gardée si pas de réseau
  if(url.origin===location.origin){
    e.respondWith(timed(fetch(req),4000).then(res=>{ if(res.ok){ const cp=res.clone(); caches.open(CACHE).then(c=>c.put(req,cp)); } return res; })
      .catch(()=>caches.match(req).then(r=>r||caches.match(req,{ignoreSearch:true})).then(r=>r||(req.mode==='navigate'?caches.match('./index.html',{ignoreSearch:true}).then(x=>x||caches.match('./')):fetch(req)))));
    return;
  }
  // bibliothèques (Cesium, MapLibre) : copie gardée d'abord, elles ne changent pas (version fixée)
  if(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com/.test(url.host)){
    e.respondWith(caches.match(req.url,{ignoreVary:true}).then(r=>r||fetch(req.url,{mode:'cors',credentials:'omit'}).then(res=>{ if(res.ok){ const cp=res.clone(); caches.open(CACHE).then(c=>c.put(req.url,cp)); } return res; },()=>fetch(req))));
    return;
  }
  // images de carte et de relief : celles déjà vues restent visibles sans réseau
  if(TILE_HOSTS.test(url.hostname)){
    // téléchargées en mode « cors » : une image opaque compterait ~7 Mo de place pour le téléphone (et ferait effacer les copies)
    e.respondWith(caches.open(TILES).then(c=>c.match(req.url,{ignoreVary:true}).then(r=>r||fetch(req.url,{mode:'cors',credentials:'omit'}).then(res=>{ if(res.ok){ c.put(req.url,res.clone()); if(++puts%300===0) trimTiles(); } return res; },()=>fetch(req)))));
  }
});
// téléchargement pour jouer hors ligne (demandé par la page) : 3D + images de carte de base
self.addEventListener('message',e=>{ const d=e.data||{}; if(d.type==='ver'){ if(e.ports&&e.ports[0]) e.ports[0].postMessage({cache:CACHE}); return; } if(d.type!=='precache') return;
  e.waitUntil((async()=>{ const c=await caches.open(CACHE), t=await caches.open(TILES); let ok=0, bad=0;
    const all=[...CES_FILES.map(f=>[CES+f,c]),...(d.urls||[]).map(u=>[u,c]),...(d.tiles||[]).map(u=>[u,t])];
    const send=async m=>{ const cs=await self.clients.matchAll({type:'window'}); for(const x of cs) x.postMessage(m); };
    let i=0; const run=async()=>{ while(i<all.length){ const [u,cc]=all[i++]; try{ if(await cc.match(u,{ignoreVary:true})){ ok++; continue; } const r=await fetch(u,{mode:u.startsWith(self.location.origin)?'same-origin':'cors',credentials:'omit'}); if(r&&r.ok){ await cc.put(u,r); ok++; } else bad++; }catch(err){ bad++; } if((ok+bad)%25===0) send({type:'precache-progress',done:ok+bad,total:all.length}); } };
    await Promise.all([run(),run(),run(),run()]);
    await send({type:'precache-done',ok,bad,total:all.length});
  })()); });
