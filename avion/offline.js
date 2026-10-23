/* =========================================================
   Sky Empire — 📴 jouer sans réseau
   • Carte 2D et vue 3D : une image de la Terre (Natural Earth, domaine
     public) est fournie avec le jeu et posée sous les images satellite.
     Sans réseau, on voit toujours les continents, les mers, le relief ;
     les endroits déjà regardés gardent leurs images détaillées.
   • Dès qu'il y a du réseau (une fois), le jeu télécharge en arrière-plan
     ce qu'il faut pour la 3D et la carte de votre région : ensuite tout
     marche en avion, sans Internet.
   • Sans réseau, les services en ligne (trafic réel, météo réelle…) se
     mettent en pause, le jeu continue.
   ========================================================= */
'use strict';
const OFF={ver:'3', earthM:'offline/earth-merc.jpg', earthE:'offline/earth-eq.jpg', ov:new WeakMap(), g3:null, err:0};
const offNet=()=>typeof navigator==='undefined'||navigator.onLine!==false;
// --- carte 2D : la Terre sous les images de carte (3 copies pour faire le tour du monde) ---
function offEarth2D(m){
  if(!m||typeof L==='undefined'||OFF.ov.get(m)) return; OFF.ov.set(m,true);
  try{ if(!m.getPane('seEarth')){ const p=m.createPane('seEarth'); p.style.zIndex=150; p.style.pointerEvents='none'; }
    for(const dx of [-360,0,360]) L.imageOverlay(OFF.earthM,[[-85.0511,-180+dx],[85.0511,180+dx]],{pane:'seEarth',interactive:false,className:'se-earth'}).addTo(m);
    m.getContainer().style.background='#1d4e89'; }catch(e){ console.warn('terre 2D',e); }
}
// --- 3D : la Terre comme couche du bas, ajoutée sans réseau ou si les images ne se chargent pas ---
function offEarth3D(force){
  if(typeof G==='undefined'||!G||!G.viewer||typeof Cesium==='undefined') return; const V=G.viewer;
  if(OFF.g3&&OFF.g3.v===V) return; if(!force&&offNet()&&OFF.err<4) return;
  try{ const C=Cesium, lay=C.ImageryLayer.fromProviderAsync(C.SingleTileImageryProvider.fromUrl(OFF.earthE)); V.imageryLayers.add(lay,0); OFF.g3={v:V,lay}; }catch(e){ console.warn('terre 3D',e); }
}
// erreurs de chargement des images 3D (pas de réseau, réseau coupé en vol) → la Terre intégrée prend le relais
function offWatch3D(){
  if(typeof G==='undefined'||!G||!G.viewer||OFF.w===G.viewer) return; OFF.w=G.viewer; OFF.err=0;
  try{ const L_=G.viewer.imageryLayers; for(let i=0;i<L_.length;i++){ const pv=L_.get(i).imageryProvider; if(pv&&pv.errorEvent) pv.errorEvent.addEventListener(()=>{ if(++OFF.err>=4) offEarth3D(true); }); } }catch(e){}
  offEarth3D(false);
}
// --- téléchargement pour jouer hors ligne ---
function offTilesAround(lat,lon,z0,z1,r){ const out=[], n2=z=>2**z;
  for(let z=z0;z<=z1;z++){ const n=n2(z), x=Math.floor((lon+180)/360*n), la=lat*Math.PI/180, y=Math.floor((1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*n);
    for(let dx=-r;dx<=r;dx++) for(let dy=-r;dy<=r;dy++){ const X=((x+dx)%n+n)%n, Y=y+dy; if(Y>=0&&Y<n) out.push([z,X,Y]); } }
  return out; }
function offPrecache(manual){
  if(!('serviceWorker' in navigator)||!navigator.serviceWorker.controller){ if(manual) toast('📴 Le mode hors ligne sera prêt après la prochaine ouverture du jeu (avec réseau).','info'); return; }
  if(!offNet()){ if(manual) toast('📴 Pas de réseau : reconnectez-vous une fois pour télécharger la 3D et les cartes.','bad'); return; }
  const base=location.href.replace(/[#?].*$/,'').replace(/[^/]*$/,'');
  const urls=[...document.querySelectorAll('script[src]')].map(s=>s.src).filter(u=>u.startsWith(base)).concat([base,base+'index.html',base+OFF.earthM,base+OFF.earthE,base+'lib/leaflet/leaflet.css',...['marker-icon.png','marker-icon-2x.png','marker-shadow.png','layers.png','layers-2x.png'].map(f=>base+'lib/leaflet/images/'+f)]);
  // images satellite : le monde entier en vue large, puis zoom autour de vos aéroports
  const ES='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/', T=[];
  for(let z=0;z<=3;z++) for(let x=0;x<2**z;x++) for(let y=0;y<2**z;y++) T.push([z,x,y]);
  const aps=[...new Set([...(S&&S.hubs||[]),...((S&&S.routes)||[]).flatMap(r=>r.stops)])].slice(0,manual?40:12);
  for(const c of aps){ const a=AP(c); if(a) T.push(...offTilesAround(a.lat,a.lon,5,manual?10:9,1)); }
  const tiles=[...new Set(T.map(([z,x,y])=>`${ES}${z}/${y}/${x}`))];
  OFF.busy=true; if(manual) toast(`📥 Téléchargement pour jouer hors ligne : 3D + ${tiles.length} images de carte…`,'info');
  navigator.serviceWorker.controller.postMessage({type:'precache',urls,tiles});
}
function offOnMsg(e){ const d=e.data||{};
  if(d.type==='precache-progress'){ OFF.prog=d; const el=document.getElementById('offProg'); if(el) el.textContent=`${d.done} / ${d.total}`; }
  if(d.type==='precache-done'){ OFF.busy=false; OFF.prog=d; try{ localStorage.setItem('se-offline',JSON.stringify({v:OFF.ver,at:Date.now(),ok:d.ok,bad:d.bad})); }catch(x){}
    if(OFF.manual||!OFF.quiet) toast(d.bad>d.total*0.2?`📴 Téléchargement partiel (${d.ok}/${d.total}) : réessayez avec un meilleur réseau.`:`✅ Prêt pour jouer sans réseau : carte, 3D et images de votre région gardées sur le téléphone.`,d.bad>d.total*0.2?'bad':'ok');
    OFF.manual=false; const el=document.getElementById('offProg'); if(el) el.textContent='terminé'; } }
// état affiché dans le menu Plus : prêt / en cours / pas encore
function offBadge(){ const s=offStatus(); if(OFF.busy) return `⏳ Téléchargement en cours${OFF.prog?' ('+OFF.prog.done+'/'+OFF.prog.total+')':''}… gardez le réseau`; if(s&&s.ok&&s.v===OFF.ver&&navigator.serviceWorker&&navigator.serviceWorker.controller) return '✅ Prêt : vous pouvez couper le réseau'; if(!('serviceWorker' in navigator)) return '❌ Impossible ici (navigation privée ?) : ouvrez le jeu en navigation normale'; return offNet()?'⏳ Pas encore prêt : touchez pour télécharger':'🔴 Pas prêt : reconnectez-vous une fois'; }
function offStatus(){ let s=null; try{ s=JSON.parse(localStorage.getItem('se-offline')||'null'); }catch(e){} return s; }
Object.assign(ACTIONS,{
  offlinePrep:()=>{ OFF.manual=true; offPrecache(true); },
  offlineInfo:()=>{ setTimeout(()=>offDiag().then(h=>{ const el=document.getElementById('offDiag'); if(el) el.innerHTML=h; }).catch(e=>{ const el=document.getElementById('offDiag'); if(el) el.textContent='erreur '+e; }),50); const s=offStatus();
    showModal('📴 Jouer sans réseau',`<p>${offNet()?'🟢 Réseau disponible.':'🔴 Pas de réseau en ce moment : le jeu continue avec ce qui est gardé sur le téléphone.'}</p>
      <p>${s?`✅ Dernier téléchargement : ${new Date(s.at).toLocaleString('fr-FR')} (${s.ok} fichiers).`:'⏳ Pas encore téléchargé.'}</p>
      <p class="small mut">Sans réseau : la carte et la 3D affichent la Terre intégrée au jeu (continents, mers, relief). Les endroits déjà vus gardent leurs images satellite. Le trafic réel et la météo réelle se mettent en pause.</p>
      <h3>🩺 Diagnostic (faites une capture et envoyez-la)</h3><div id="offDiag" class="small" style="font-family:ui-monospace,monospace;line-height:1.5">analyse…</div>
      <div class="btns"><button class="btn" data-act="offlinePrep">📥 Télécharger maintenant (3D + cartes de mes aéroports)</button></div><div class="small mut">Progression : <span id="offProg">${OFF.busy&&OFF.prog?OFF.prog.done+' / '+OFF.prog.total:'—'}</span></div>`); },
});
// diagnostic : ce que le téléphone garde vraiment (pour comprendre un échec sans réseau)
async function offDiag(){
  const L=[], ok=(b,t)=>L.push((b?'✅ ':'❌ ')+t), base=location.href.replace(/[#?].*$/,'').replace(/[^/]*$/,'');
  const sa=window.matchMedia&&matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  L.push('📱 Ouvert depuis : '+(sa?'l’icône de l’écran d’accueil':'Safari / navigateur')+' · v'+(document.querySelector('script[src*="offline.js"]')||{src:''}).src.split('v=')[1]);
  L.push('🔗 Adresse : '+location.pathname+location.search);
  const sw='serviceWorker' in navigator; ok(sw,'Service worker possible'+(sw?'':' (navigation privée ? mode Isolement ?)'));
  if(sw){ let rg=null; try{ rg=await navigator.serviceWorker.getRegistration(); }catch(e){}
    ok(!!rg,'Enregistré'+(rg?' (portée '+new URL(rg.scope).pathname+')':window.SE_SW_ERR?' — erreur : '+window.SE_SW_ERR:''));
    ok(!!(rg&&rg.active),'Actif'+(rg&&rg.installing?' (installation en cours…)':rg&&rg.waiting?' (en attente)':''));
    ok(!!navigator.serviceWorker.controller,'Contrôle cette page'+(navigator.serviceWorker.controller?'':' → rechargez la page une fois avec réseau'));
    if(navigator.serviceWorker.controller) try{ const v=await new Promise((res,rej)=>{ const ch=new MessageChannel(); ch.port1.onmessage=e=>res(e.data); navigator.serviceWorker.controller.postMessage({type:'ver'},[ch.port2]); setTimeout(()=>rej(),2500); }); L.push('🧩 Version gardée : '+v.cache); }catch(e){ L.push('🧩 Version : ancienne (pas de réponse)'); } }
  try{ const ks=await caches.keys(), parts=[]; for(const k of ks) parts.push(k+'='+(await (await caches.open(k)).keys()).length); L.push('🗄️ Copies : '+(parts.join(', ')||'aucune'));
    const idx=await caches.match(base)||await caches.match(base+'index.html',{ignoreSearch:true}); ok(!!idx,'Page du jeu gardée');
    const ces=await caches.match('https://cdn.jsdelivr.net/npm/cesium@1.146.0/Build/Cesium/Cesium.js'); ok(!!ces,'3D gardée');
  }catch(e){ ok(false,'Accès aux copies impossible : '+(e&&e.message||e)+' (navigation privée ?)'); }
  try{ if(navigator.storage&&navigator.storage.estimate){ const e=await navigator.storage.estimate(); L.push('💾 Place utilisée : '+Math.round((e.usage||0)/1048576)+' Mo sur '+Math.round((e.quota||0)/1048576)+' Mo'); }
    if(navigator.storage&&navigator.storage.persisted) ok(await navigator.storage.persisted(),'Stockage protégé contre l’effacement'); }catch(e){}
  try{ localStorage.setItem('se-t','1'); localStorage.removeItem('se-t'); ok(true,'Sauvegarde du jeu possible'); }catch(e){ ok(false,'Sauvegarde impossible (navigation privée ?)'); }
  return L.join('<br>');
}
function offHook(){ if(offHook.done) return; offHook.done=true;
  if('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message',offOnMsg);
  setInterval(()=>{ try{ if(typeof map!=='undefined'&&map) offEarth2D(map); if(typeof MM!=='undefined'&&MM.map) offEarth2D(MM.map); offWatch3D(); }catch(e){} },1000);
  window.addEventListener('offline',()=>{ try{ offEarth3D(true); }catch(e){} toast('📴 Plus de réseau : le jeu continue (carte et 3D avec les images gardées).','info'); });
  window.addEventListener('online',()=>{ const s=offStatus(); if(!s||s.v!==OFF.ver) setTimeout(()=>{ OFF.quiet=true; offPrecache(false); },5000); });
  // première fois (ou après une mise à jour du mode hors ligne) : téléchargement en arrière-plan, le plus tôt possible
  const auto=()=>{ const s=offStatus(); if(!OFF.busy&&(!s||s.v!==OFF.ver||Date.now()-s.at>7*86400000)&&offNet()&&navigator.serviceWorker&&navigator.serviceWorker.controller){ OFF.quiet=!!s; offPrecache(false); } };
  setTimeout(auto,4000); if('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange',()=>setTimeout(auto,3000));
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ offHook(); }catch(e){ console.warn(e); } },0));
