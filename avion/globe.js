/* ============================================================
   VUE 3D — globe CesiumJS (imagerie satellite, soleil réel)
   Avions 3D détaillés et différents selon le modèle, caméra de
   poursuite façon simulateur (arrière, côté, avant, dessus, cockpit,
   rotation au doigt), HUD de vol, nuages, traînées, villes 3D Google.
   ============================================================ */
const CESIUM_VER='1.146.0', CESIUM_BASE=`https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VER}/Build/Cesium/`;
let G=null;

function loadCesium(){
  if(window.Cesium) return Promise.resolve();
  if(loadCesium.p) return loadCesium.p;
  window.CESIUM_BASE_URL=CESIUM_BASE;
  loadCesium.p=new Promise((res,rej)=>{
    const l=document.createElement('link'); l.rel='stylesheet'; l.href=CESIUM_BASE+'Widgets/widgets.css'; document.head.appendChild(l);
    const s=document.createElement('script'); s.src=CESIUM_BASE+'Cesium.js'; s.onload=res; s.onerror=()=>{ loadCesium.p=null; rej(new Error('cesium')); }; document.head.appendChild(s);
  });
  return loadCesium.p;
}
// modèle représentatif pour les avions des autres compagnies
const REP_MODEL={prop:'AT76', rj:'CRJ9', nb:'A20N', wb:'B789', quad:'B748', conc:'CONC'};
const liveryOf=ac=>(ac&&ac.expo&&ac.livery)||S.livery||S.company.color;   // vol libre : couleurs de sa compagnie
function modelInfo(m,color,lite){ return AC3D.uri(m,color,lite); }
// téléphone (hors qualité Haute) : modèles légers pour les avions des autres compagnies (un modèle par couleur de compagnie = beaucoup de mémoire graphique)
const acLite=()=>typeof GQ!=='undefined'&&GQ.mob&&!GQ.hq;
// téléphone : seul l'avion suivi a le modèle détaillé, les autres avions du joueur prennent le modèle léger
const acLiteFor=ac=>acLite()&&!(G&&G.follow===ac.id);

/* ---------- ouverture / fermeture ---------- */
async function open3D(){
  toast('🌍 Chargement de la vue 3D…','info');
  try{ await loadCesium(); }catch(e){ toast('⛔ Impossible de charger le moteur 3D (connexion Internet ?)','bad'); return false; }
  if(UI.mobile) setTab('map');
  document.body.classList.add('globe-on'); $('#globe').hidden=false; $('#globeHud').hidden=false;
  if(!G){ try{ log3D('ouverture',GQ.mode); initGlobe(); }catch(e){ log3D('erreur au démarrage',String(e&&e.message||e)); try{ if(G&&G.viewer) G.viewer.destroy(); }catch(_){} G=null; close3D();
      fail3D('La 3D n’a pas pu démarrer : '+String(e&&e.message||e).slice(0,140)); return false; } }
  else G.viewer.resize();
  live3D(true);
  if(GQ.crashed){ GQ.crashed=false; toast('🪶 La 3D avait fait fermer la page : mode Minimal activé (⚙️ pour changer)','info'); }
  if(GQ.mig){ GQ.mig=false; toast('🪶 3D en mode Minimal sur téléphone pour qu’elle ne coupe plus. Touchez ⚙️ Minimal pour essayer Éco ou Haute.','info'); }
  globeSync(true);
  if(G.snowOn) snowStart3D();
  renderGlobeHud();
  return true;
}
// marqueur « vue 3D ouverte » : s'il reste posé au prochain lancement, la page a planté pendant la 3D
// journal de la 3D (gardé sur l'appareil) : aide à comprendre une fermeture qu'on ne peut pas reproduire ici
function log3D(ev,msg){ try{ const L=JSON.parse(localStorage.getItem('se-3d-log')||'[]'); L.unshift({t:Date.now(),ev,msg:String(msg||'').slice(0,160)}); localStorage.setItem('se-3d-log',JSON.stringify(L.slice(0,12))); }catch(e){} }
// la 3D s'est fermée : on explique et on propose une solution (au lieu d'un message qui disparaît)
function fail3D(why){ log3D('fermeture',why);
  showModal('⚠️ La vue 3D s’est fermée',`<p>${esc(why)}</p><p class="small">Le mode <b>Minimal</b> est activé pour la prochaine ouverture. Fermer les autres onglets et applis libère de la mémoire.</p>
    <div class="btns"><button class="btn gold" data-act="open3D">🔁 Réessayer la 3D</button><button class="btn" data-act="city3DFallback">🏙️ Voir les avions en Ville 3D (plus léger)</button><button class="btn" data-act="diag3D">🩺 Diagnostic</button></div>`); }
// ville 3D allégée après un plantage (page tuée par manque de mémoire, ou contexte graphique perdu) : 1 = normal, 0.5, 0.25
function cityLiteBump(){ try{ const k=Math.max(0.25,(+localStorage.getItem('se-city-k')||1)/2); localStorage.setItem('se-city-k',String(k)); }catch(e){} }
function cityK(){ try{ return +localStorage.getItem('se-city-k')||1; }catch(e){ return 1; } }
// boîte noire : toutes les 15 s pendant la 3D, on note ce qui est chargé (si le téléphone coupe la page, on saura quoi)
setInterval(()=>{ try{ if(typeof G==='undefined'||!G||!G.viewer||$('#globe').hidden) return; const c=G.viewer.camera.positionCartographic, sc=G.viewer.scene;
  let fh=0; if(G.osmFill) for(const st of G.osmFill.values()) fh+=st.cnt||0;
  G.bbT=G.bbT||Date.now(); const m=performance.memory?' · mém '+Math.round(performance.memory.usedJSHeapSize/1e6)+' Mo':'';
  localStorage.setItem('se-3d-bb',`après ${Math.round((Date.now()-G.bbT)/1000)} s · ${GQ.mode} · ville×${(typeof cityK==='function'?cityK():1).toFixed(2)} · ${Cesium.Math.toDegrees(c.latitude).toFixed(3)},${Cesium.Math.toDegrees(c.longitude).toFixed(3)} à ${Math.round(c.height)} m · quartiers ${G.osmPin?G.osmPin.size:0} · maisons ${fh} · cases ${G.osm?G.osm.cells.size:0} · routes ${typeof RD!=='undefined'?RD.roads.length:0} · voitures ${typeof RD!=='undefined'?RD.cars.length:0} · objets ${sc.primitives.length} · entités ${G.viewer.entities.values.length}${G.follow?' · suit un avion':''}${G.tiles?' · Google 3D':''}${m}`); }catch(e){} },15000);
function live3D(on){ try{ if(on&&!$('#globe').hidden&&!document.hidden) localStorage.setItem('se-3d-live','1'); else localStorage.removeItem('se-3d-live'); }catch(e){} }
document.addEventListener('visibilitychange',()=>{ live3D(!document.hidden); if(!document.hidden&&G&&G.snowOn) snowStart3D(); });
window.addEventListener('pagehide',()=>live3D(false));
function close3D(){
  live3D(false);
  globeFollow(null);
  document.body.classList.remove('globe-on'); $('#globe').hidden=true; $('#globeHud').hidden=true;
  const h=$('#rfsHud'); if(h) h.hidden=true;
  setTimeout(()=>map&&map.invalidateSize(),60);
}
// Neige d'écran légère : Canvas 2D, sans particules Cesium ni ressource distante.
const SNOW3D={canvas:null,ctx:null,raf:0,last:0,w:0,h:0,items:[]};
function snowResize3D(){
  const c=SNOW3D.canvas,host=$('#globe'); if(!c||!host) return;
  const w=host.clientWidth,h=host.clientHeight,dpr=GQ.mob?0.72:Math.min(window.devicePixelRatio||1,0.95);
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){ c.width=Math.max(1,Math.round(w*dpr)); c.height=Math.max(1,Math.round(h*dpr)); c.style.width=w+'px'; c.style.height=h+'px'; SNOW3D.ctx=c.getContext('2d',{alpha:true}); SNOW3D.ctx.setTransform(dpr,0,0,dpr,0,0); SNOW3D.w=w; SNOW3D.h=h; }
  const count=GQ.mob?38:72; while(SNOW3D.items.length<count) SNOW3D.items.push({x:Math.random()*w,y:Math.random()*h,r:0.7+Math.random()*1.5,v:18+Math.random()*34,drift:-9+Math.random()*18,a:0.35+Math.random()*0.5});
  if(SNOW3D.items.length>count) SNOW3D.items.length=count;
}
function snowFrame3D(now){
  if(!G||!G.snowOn||document.hidden||$('#globe').hidden){ SNOW3D.raf=0; return; }
  if(now-SNOW3D.last<40){ SNOW3D.raf=requestAnimationFrame(snowFrame3D); return; }
  snowResize3D(); const c=SNOW3D.ctx,w=SNOW3D.w,h=SNOW3D.h,dt=Math.min(0.08,(now-(SNOW3D.last||now-40))/1000); SNOW3D.last=now;
  if(!c||!w||!h){ SNOW3D.raf=requestAnimationFrame(snowFrame3D); return; }
  c.clearRect(0,0,w,h);
  for(const p of SNOW3D.items){ p.y+=p.v*dt; p.x+=p.drift*dt; if(p.y>h+3){p.y=-3;p.x=Math.random()*w;} if(p.x<-4)p.x=w+3; else if(p.x>w+4)p.x=-3; c.fillStyle=`rgba(255,255,255,${p.a})`; c.beginPath(); c.arc(p.x,p.y,p.r,0,Math.PI*2); c.fill(); }
  SNOW3D.raf=requestAnimationFrame(snowFrame3D);
}
function snowStart3D(){
  if(!G||!G.snowOn||document.hidden) return;
  let c=SNOW3D.canvas||document.getElementById('globeSnow');
  if(!c){ c=document.createElement('canvas'); c.id='globeSnow'; c.setAttribute('aria-hidden','true'); c.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:6;'; $('#globe').appendChild(c); }
  SNOW3D.canvas=c; snowResize3D(); if(!SNOW3D.raf) SNOW3D.raf=requestAnimationFrame(snowFrame3D);
}
function set3DSnow(on,quiet=false){
  if(!G) return; G.snowOn=!!on; try{localStorage.setItem('se-snow',G.snowOn?'1':'0');}catch(e){}
  if(G.snowOn) snowStart3D(); else { if(SNOW3D.raf) cancelAnimationFrame(SNOW3D.raf); SNOW3D.raf=0; if(SNOW3D.ctx&&SNOW3D.canvas) SNOW3D.ctx.clearRect(0,0,SNOW3D.w,SNOW3D.h); }
  if(!quiet){ toast(G.snowOn?'❄️ Neige 3D activée (effet léger)':'❄️ Neige 3D désactivée','info'); renderGlobeHud(); }
}
function patchCesium(C){
  // Sur iPhone/iPad (pas de transparence indépendante de l'ordre), Cesium trie les objets transparents
  // par distance : les nuages n'ont pas de volume englobant, ce qui faisait planter le rendu.
  if(C.CloudCollection&&!C.CloudCollection._sePatched){
    const up=C.CloudCollection.prototype.update; C.CloudCollection._sePatched=true;
    C.CloudCollection.prototype.update=function(fs){
      const n=fs.commandList.length; up.call(this,fs);
      for(let i=n;i<fs.commandList.length;i++){ const c=fs.commandList[i]; if(c&&!c.boundingVolume) c.boundingVolume=this._seBV||(this._seBV=new C.BoundingSphere(C.Cartesian3.ZERO,6.4e6)); }
    };
  }
}
// qualité graphique : « Éco » par défaut sur téléphone (fluide), « Haute » sur ordinateur
const GQ=(()=>{ let v=null; try{ v=localStorage.getItem('se-q'); }catch(e){} const mob=/iphone|ipad|android|mobile/i.test(navigator.userAgent)||(window.matchMedia&&matchMedia('(pointer:coarse)').matches); let crashed=false; try{ crashed=localStorage.getItem('se-3d-live')==='1'; localStorage.removeItem('se-3d-live'); }catch(e){}
  // la page s'est fermée brutalement pendant la vue 3D (mémoire du téléphone saturée) : on repasse en Éco
  if(crashed) try{ const k=Math.max(0.25,(+localStorage.getItem('se-city-k')||1)/2); localStorage.setItem('se-city-k',String(k)); }catch(e){}
  // boîte noire : ce que la 3D affichait juste avant le plantage (visible dans 🩺 Diagnostic)
  if(crashed) try{ const bb=localStorage.getItem('se-3d-bb'); if(bb) log3D('plantage',bb); }catch(e){}
  if(crashed&&v!=='l'){ v=mob?'l':'e'; try{ localStorage.setItem('se-q',v); }catch(e){} }
  // une fois : les téléphones passent en Minimal (la 3D coupait sur iPhone) ; on peut remonter la qualité avec ⚙️
  let mig=false; try{ if(mob&&localStorage.getItem('se-q-v2')!=='1'){ localStorage.setItem('se-q-v2','1'); if(v!=='l'){ v='l'; mig=true; localStorage.setItem('se-q','l'); } } }catch(e){}
  const mode=(v==='l'||v==='e'||v==='h'||v==='a')?v:(mob?'l':'a'); return {mode, hq:mode==='h'||mode==='a', mini:mode==='l', mob, crashed, mig}; })();   // e = éco, h = haute, a (défaut) = haute avec allègement doux si la vue rame ; téléphone : FXAA au lieu du MSAA
function applyQuality(){ if(!G) return; const V=G.viewer, sc=V.scene; GQ.hq=GQ.mode==='h'||GQ.mode==='a'; GQ.mini=GQ.mode==='l'; if(GQ.mini) G.lite=true;
  try{ sc.msaaSamples=(GQ.hq&&!GQ.mob)?4:1; sc.postProcessStages.fxaa.enabled=true; }catch(e){}
  // Cesium dessine à (rapport de pixels de l'écran × resolutionScale) quand useBrowserRecommendedResolution est faux, et à 1 pixel CSS sinon (flou sur un écran rétina)
  try{ const dpr=window.devicePixelRatio||1; V.useBrowserRecommendedResolution=false; G.resBase=Math.min(dpr,GQ.mob?1.6:2)/dpr; V.resolutionScale=GQ.hq?G.resBase:GQ.mini?Math.min(dpr,1.3)/dpr:Math.min(dpr,GQ.mob?1.45:1.25)/dpr; }catch(e){}   // Minimal et Éco plus nets (1 pixel CSS était flou sur iPhone)
  // relief : réglages d'origine (un sol plus grossier faisait traverser la piste à l'avion au décollage et à l'atterrissage)
  try{ sc.globe.tileCacheSize=GQ.mob?100:300; }catch(e){}
  try{ sc.globe.maximumScreenSpaceError=GQ.hq?1.4:GQ.mini?2.0:1.8; sc.globe.showWaterEffect=!(GQ.mob&&!GQ.hq); sc.postProcessStages.fxaa.enabled=true; if(G.clouds) G.clouds.show=!(GQ.mob&&!GQ.hq)&&!GQ.mini; sc.fog.enabled=!GQ.mini; if(GQ.mini){ sc.globe.showWaterEffect=false; sc.globe.showGroundAtmosphere=false; sc.globe.tileCacheSize=60; } if(G3night) G3night.show=!GQ.mini; }catch(e){}
  // téléphone : 30 images/s max en Éco (moins de chauffe, donc moins de ralentissements au bout de quelques minutes)
  try{ V.targetFrameRate=(GQ.mob&&!GQ.hq)?30:undefined; }catch(e){}
  G.rivalCap=GQ.mini?6:undefined; G.rivAt=0; G.perf=null; }
// fonds de carte de la vue 3D (mêmes sources libres que la carte 2D)
const ESRI3='https://server.arcgisonline.com/ArcGIS/rest/services/';
const BASE3D={
  hybrid:{label:'🛰️ Satellite + noms', sat:true, make:C=>[new C.UrlTemplateImageryProvider({url:ESRI3+'World_Imagery/MapServer/tile/{z}/{y}/{x}',maximumLevel:19,credit:'Imagerie © Esri, Maxar, Earthstar Geographics'}),new C.UrlTemplateImageryProvider({url:ESRI3+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',maximumLevel:18})]},
  satellite:{label:'🛰️ Satellite pur', sat:true, make:C=>[new C.UrlTemplateImageryProvider({url:ESRI3+'World_Imagery/MapServer/tile/{z}/{y}/{x}',maximumLevel:19,credit:'Imagerie © Esri, Maxar, Earthstar Geographics'})]},
  sentinel:{label:'🌿 Sentinel-2', sat:true, make:C=>[new C.UrlTemplateImageryProvider({url:'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',maximumLevel:14,credit:'Sentinel-2 cloudless © EOX (Copernicus, modifié)'})]},
  plan:{label:'🗺️ Plan OpenStreetMap', make:C=>[new C.UrlTemplateImageryProvider({url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',maximumLevel:19,credit:'© les contributeurs d’OpenStreetMap'})]},
  relief:{label:'⛰️ Relief (topo)', make:C=>[new C.UrlTemplateImageryProvider({url:ESRI3+'World_Topo_Map/MapServer/tile/{z}/{y}/{x}',maximumLevel:18,credit:'© Esri, HERE, Garmin, USGS'})]},
  sombre:{label:'🌑 Sombre', make:C=>[new C.UrlTemplateImageryProvider({url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',subdomains:'abcd',maximumLevel:19,credit:'© OpenStreetMap, © CARTO'})]},
  gris:{label:'⚪ Gris clair', make:C=>[new C.UrlTemplateImageryProvider({url:ESRI3+'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',maximumLevel:16,credit:'© Esri'})]},
};
let G3labels=[], G3night=null;
function setBase3D(key){
  const C=Cesium, V=G.viewer, L_=V.imageryLayers, def=BASE3D[key]; if(!def) return;
  // on retire le fond et les noms, on garde la couche des lumières nocturnes
  const keep=G3night; for(const l of [...Array(L_.length).keys()].map(i=>L_.get(i)).filter(l=>l!==keep)) L_.remove(l,true);
  G3labels=[]; const pv=def.make(C); const b=L_.addImageryProvider(pv[0],0);
  if(def.sat){ b.saturation=1.32; b.contrast=1.12; b.brightness=1.04; b.gamma=1.04; }
  for(const x of pv.slice(1)) G3labels.push(L_.addImageryProvider(x));
  G.baseKey=key; try{ localStorage.setItem('se-3dstyle',key); }catch(e){}
}
function initGlobe(){
  const C=Cesium; C.Ion.defaultAccessToken=''; patchCesium(C); G3night=null;
  const base0=BASE3D[(()=>{ try{ return localStorage.getItem('se-3dstyle'); }catch(e){ return null; } })()]||BASE3D.hybrid;
  const viewer=new C.Viewer('globe',{ baseLayer:new C.ImageryLayer(base0.make(C)[0]), baseLayerPicker:false, geocoder:false, homeButton:false, sceneModePicker:false,
    navigationHelpButton:false, animation:false, timeline:false, fullscreenButton:false, infoBox:false, selectionIndicator:false, msaaSamples:GQ.hq&&!GQ.mob?4:1, scene3DOnly:true,
    // téléphone : pas d'anticrénelage du tampon principal ni de transparence « indépendante de l'ordre » (plusieurs images plein écran en plus) — c'est ce qui saturait la mémoire graphique de l'iPhone
    orderIndependentTranslucency:!window.SE_NO_OIT&&!GQ.mob, contextOptions:GQ.mob?{webgl:{antialias:false, powerPreference:'default', preserveDrawingBuffer:false}, allowTextureFilterAnisotropic:false}:undefined });
  { const extra=base0.make(C).slice(1); G3labels=extra.map(pv=>viewer.imageryLayers.addImageryProvider(pv)); }
  // la nuit, les villes s'allument : images « Black Marble » de la NASA (GIBS, libres d'accès), affichées seulement du côté nuit du globe
  if(!GQ.mini) try{ const nl=viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png', maximumLevel:8, credit:'Lumières nocturnes : NASA Black Marble (GIBS)'}),1);
    nl.dayAlpha=0; nl.nightAlpha=1; nl.brightness=3.2; nl.contrast=1.15; G3night=nl; }catch(e){}
  // nuit réaliste même près du sol (par défaut Cesium éclaire tout quand on est proche) ; relief ombré par le soleil le jour
  try{ const gl=viewer.scene.globe; gl.lightingFadeOutDistance=1; gl.lightingFadeInDistance=2; }catch(e){}
  try{ viewer.scene.globe.showWaterEffect=true; }catch(e){}   // vagues animées et reflet du soleil (masque d'eau du relief)
  const sc=viewer.scene;
  try{ if(base0.sat){ const base=viewer.imageryLayers.get(0); base.saturation=1.32; base.contrast=1.12; base.brightness=1.04; base.gamma=1.04; } }catch(e){}
  try{ sc.postProcessStages.fxaa.enabled=true; }catch(e){}
  // mode Minimal : pas de relief chargé, donc tout est posé au niveau du sol plat (sinon avions et aéroports flottaient à leur altitude réelle)
  if(GQ.mini&&typeof TERRAIN!=='undefined'&&TERRAIN.on){ TERRAIN.on=false; TERRAIN.offMini=true; }
  try{ if(typeof TERRAIN!=='undefined'&&TERRAIN.on&&!GQ.mini){ terrFlattenNetwork(); sc.globe.terrainProvider=terrainProvider(); sc.globe.depthTestAgainstTerrain=true; } }catch(e){ console.warn(e); }
  try{ sc.globe.showGroundAtmosphere=true; sc.globe.atmosphereLightIntensity=12; sc.skyAtmosphere.atmosphereLightIntensity=40; }catch(e){}
  // filet de sécurité : si le rendu plante, on retire les décors optionnels et on redémarre
  viewer.showRenderLoopErrors=false;
  sc.canvas.addEventListener('webglcontextlost',ev=>{ ev.preventDefault(); log3D('contexte graphique perdu',GQ.mode); cityLiteBump();
    const again=Date.now()-(window._se3dLost||0)<30000; window._se3dLost=Date.now();
    GQ.mode='l'; GQ.mini=true; GQ.hq=false; try{ localStorage.setItem('se-q','l'); }catch(e){}
    const g=G, fol=g&&g.follow; G=null; setTimeout(()=>{ try{ clearInterval(g.loop); g.viewer.destroy(); }catch(e){} },0);
    if(again){ live3D(false); try{ close3D(); }catch(e){} fail3D('Le téléphone a coupé la carte graphique deux fois de suite (mémoire graphique pleine).'); return; }
    // première coupure : on relance tout seul la 3D en mode Minimal, sans quitter l'écran
    toast('⚙️ Le téléphone a manqué de mémoire graphique : relance de la 3D en mode Minimal…','warn');
    setTimeout(()=>{ if($('#globe').hidden) return; try{ initGlobe(); globeSync(true); if(fol&&S.fleet.some(a=>a.id===fol)) globeFollow(fol); renderGlobeHud(); log3D('relance minimale','ok'); }
      catch(e){ log3D('relance impossible',String(e&&e.message||e)); try{ close3D(); }catch(_){} toast('⛔ La 3D ne peut pas redémarrer sur cet appareil','bad'); } },700); },false);
  sc.renderError.addEventListener((scene,err)=>{
    console.warn('rendu 3D',err); log3D('erreur de rendu',String(err&&err.message||err)); G.safe=(G.safe||0)+1;
    // on compte les erreurs rapprochées : quelques erreurs isolées sur une longue session ne doivent pas figer la 3D
    const now=Date.now(); G.errT=(G.errT||[]).filter(t=>now-t<30000); G.errT.push(now); const burst=G.errT.length; if(GQ.mode!=='e'&&GQ.mode!=='l'){ GQ.mode='e'; try{ localStorage.setItem('se-q','e'); }catch(e){} try{ applyQuality(); }catch(e){} }
    try{ if(G.clouds){ sc.primitives.remove(G.clouds); G.clouds=null; } }catch(e){}
    if(G.safe===1){
      try{ viewer.useBrowserRecommendedResolution=false; viewer.resolutionScale=Math.min(viewer.resolutionScale||1,0.68); sc.msaaSamples=1; sc.globe.showWaterEffect=false; G.rivalCap=8; G.rivAt=0; }
      catch(e){}
      toast('⚙️ Le rendu 3D a détecté une surcharge : qualité réduite automatiquement pour stabiliser l’image.','warn');
    }
    // 2e erreur : aéroport allégé (pistes, terminal, tour, passerelles) au lieu de tout supprimer ; 4e : plus de décor
    if(G.safe>=2&&!G.lite){ G.lite=true; try{ worldClear(); sc.globe.showWaterEffect=false; }catch(e){} toast('⚙️ Aéroport 3D allégé pour cet appareil (décollages et atterrissages toujours visibles)','info'); }
    if(G.safe>=4){ try{ worldClear(); }catch(e){} G.noWorld=true; }
    if(burst<6) setTimeout(()=>{ try{ viewer.useDefaultRenderLoop=true; }catch(e){} },300);   // on relance toujours le rendu…
    else { log3D('fermeture','trop d’erreurs de rendu en 30 s'); try{ close3D(); }catch(e){} fail3D('La 3D a rencontré trop d’erreurs d’affichage d’affilée sur cet appareil. Elle est passée en mode Minimal : réessayez.'); }   // …sauf si les erreurs s'enchaînent : on ferme proprement au lieu de figer l'écran
  });
  sc.globe.enableLighting=true; sc.globe.dynamicAtmosphereLighting=true; sc.skyAtmosphere.show=true; sc.fog.enabled=true; sc.fog.density=0.00012;
  sc.globe.depthTestAgainstTerrain=false; sc.highDynamicRange=false; sc.globe.maximumScreenSpaceError=GQ.hq?1.4:GQ.mini?2.0:1.8;
  viewer.clock.shouldAnimate=false;
  G={viewer, baseKey:(BASE3D[(()=>{ try{ return localStorage.getItem('se-3dstyle'); }catch(e){ return null; } })()]?localStorage.getItem('se-3dstyle'):'hybrid'), planes:new Map(), rivals:[], routes:[], airports:[], follow:null, cam:{mode:'chase',h:0,p:-9,range:120}, lighting:true, tiles:null, simAt:performance.now(), simTime:S.time, att:new Map(), trail:[], hudAt:0, forceDay:(()=>{ try{ return localStorage.getItem('se-day')==='1'; }catch(e){ return false; } })()};
  G.forceNight=!G.forceDay&&(()=>{ try{ return localStorage.getItem('se-night')==='1'; }catch(e){ return false; } })();
  G.snowOn=(()=>{ try{ return localStorage.getItem('se-snow')==='1'; }catch(e){ return false; } })();
  applyQuality();
  // clic sur un avion
  const h=new C.ScreenSpaceEventHandler(sc.canvas);
  h.setInputAction(e=>{ if(G.follow) return; const p=sc.pick(e.position); const id=p&&p.id&&p.id._acId; if(id){ selectPlane(id); renderGlobeHud(); } }, C.ScreenSpaceEventType.LEFT_CLICK);
  // caméra de poursuite : rotation au doigt / à la souris, zoom molette et pincement
  let drag=null;
  h.setInputAction(e=>{ if(G.follow) drag={x:e.position.x,y:e.position.y}; }, C.ScreenSpaceEventType.LEFT_DOWN);
  h.setInputAction(()=>{ drag=null; }, C.ScreenSpaceEventType.LEFT_UP);
  h.setInputAction(e=>{ if(!G.follow||!drag) return; const dx=e.endPosition.x-drag.x, dy=e.endPosition.y-drag.y; drag={x:e.endPosition.x,y:e.endPosition.y};
    if(G.cam.mode==='cockpit'||G.cam.mode==='cabin'){ G.cam.h+=dx*0.25; G.cam.p=clamp(G.cam.p-dy*0.2,-60,40); } else { G.cam.h-=dx*0.35; G.cam.p=clamp(G.cam.p-dy*0.25,-88,12); } }, C.ScreenSpaceEventType.MOUSE_MOVE);
  h.setInputAction(d=>{ if(G.follow) G.cam.range=clamp(G.cam.range*(d>0?0.88:1.14),15,80000); }, C.ScreenSpaceEventType.WHEEL);
  h.setInputAction(e=>{ if(!G.follow) return; const a=e.distance.startPosition, b=e.distance.endPosition; const da=Math.hypot(a.x,a.y), db=Math.hypot(b.x,b.y); if(da&&db) G.cam.range=clamp(G.cam.range*(da/db),15,80000); }, C.ScreenSpaceEventType.PINCH_MOVE);
  const hub=AP(S.company.hub);
  viewer.camera.setView({destination:C.Cartesian3.fromDegrees(hub.lon, hub.lat-18, 7.5e6), orientation:{heading:0, pitch:C.Math.toRadians(-70), roll:0}});
  const key=localStorage.getItem(GKEY);
  if(key && localStorage.getItem('cst-3dtiles')==='1'){ if(GQ.crashed&&GQ.mob){ try{ localStorage.setItem('cst-3dtiles','0'); }catch(e){} toast('🏙️ Villes 3D Google coupées (trop lourdes pour ce téléphone) : réactivez-les si vous voulez','info'); } else toggleGoogle3D(true); }
  G.loop=setInterval(()=>{ if(!$('#globe').hidden) globeSync(false); },1000);
  sc.preRender.addEventListener(globeFollowTick);
  if(!GQ.mini) try{ G.clouds=sc.primitives.add(new C.CloudCollection({noiseDetail:16})); }catch(e){ G.clouds=null; }
}

/* ---------- temps et attitude ---------- */
function globeNoteSim(){ if(G){ G.simAt=performance.now(); G.simTime=S.time; } }
// horloge d'affichage de la 3D : avance en continu, ne recule jamais, et se recale en douceur sur le temps du jeu
// (avant : quand le téléphone ralentissait, l'avion était projeté trop loin puis ramené en arrière → saccades)
// une seule heure par image : l'avion, ses feux et la caméra utilisent exactement le même instant.
// L'heure de l'image suivante est fixée à la fin de chaque image (postRender) : Cesium place les avions AVANT
// l'événement preRender où la caméra est posée — les deux voient donc la même heure (sinon la caméra cockpit tremble).
function gSimNow(){ if(!G) return S.time; G.vc=G.vc||{}; const V=G.viewer;
  if(V&&V.scene&&!V._seClock){ V._seClock=true; V.scene.postRender.addEventListener(()=>{ try{ G._ft=smoothClock(G.vc,G.simTime,G.simAt); G._ftOk=true; }catch(e){} }); }
  if(G._ftOk&&V&&V._seClock&&!S.paused) return G._ft;
  const t=smoothClock(G.vc,G.simTime,G.simAt); G._ft=t; return t; }
function smoothClock(c,base,baseAt){
  const now=performance.now(); if(S.paused||base===undefined){ c.v=S.time; c.at=now; c.b=undefined; return S.time; }
  const mult=(SPEEDS[S.speed]||{mult:1}).mult;
  // vitesse réellement mesurée du temps de jeu (ms de jeu par ms réelle), lissée
  if(c.b!==base){ if(c.b!==undefined&&baseAt>c.bAt){ const r=(base-c.b)/(baseAt-c.bAt); if(r>=0&&r<=mult*1.5) c.rate=c.rate===undefined?r:c.rate*0.7+r*0.3; } c.b=base; c.bAt=baseAt; }
  if(c.mult!==mult){ c.mult=mult; c.rate=mult; }
  const rate=Math.max(0,Math.min(mult,c.rate===undefined?mult:c.rate)), target=base+Math.min(1500,now-baseAt)*rate;
  if(c.v===undefined||Math.abs(target-c.v)>Math.max(90000,4000*mult)){ c.v=target; c.at=now; return c.v; }      // saut (rattrapage) : on se cale
  const dt=Math.min(250,now-(c.at||now)); let v=c.v+dt*rate; v+=(target-v)*Math.min(1,dt/900);
  if(v<c.v) v=c.v; c.v=v; c.at=now; return v; }
function attitude(ac,st,t){
  let a=G.att.get(ac.id); if(!a){ a={hdg:st.hdg,t,bank:0,pitch:0,alt:st.alt,vs:0}; G.att.set(ac.id,a); }
  const dtg=(t-a.t)/1000;
  if(dtg>0.05){
    const dh=((st.hdg-a.hdg+540)%360)-180, rate=dh/dtg;
    const ground=st.phase<=1||st.phase>=8||st.alt<3;
    const tb=ground?0:clamp(rate*9,-28,28);
    a.bank+=(tb-a.bank)*Math.min(1,dtg*0.6);
    const vs=(st.alt-a.alt)/dtg*196.85; a.vs+=(vs-a.vs)*Math.min(1,dtg*0.5);
    // assiette = pente de la trajectoire + incidence (plus grande quand l'avion est lent), arrondi avant le toucher, rotation au décollage
    let tp;
    if(ground){ let vr=240; if(st.phase===2){ try{ const s2=legProf(st.leg,modelOf(ac)).segs.find(x=>x.ph===2); if(s2) vr=s2.s1*0.95; }catch(e){} } tp = st.phase===2? clamp((st.spd-(vr-24))/22,0,1)*8 : 0; }   // rotation juste avant la vitesse de décollage du modèle                                       // rotation puis roulage nez au sol
    else { const fpa=Math.atan2(a.vs/196.85,Math.max(35,st.spd/3.6))*180/Math.PI, aoa=st.phase===4?2.3:st.phase===2||st.phase===3?6.5:st.phase===5?3:4.5;
      tp=clamp(fpa+aoa,-4,17);
      if(st.phase===6) tp=Math.max(1.5,fpa+5.5);                                   // approche : nez légèrement haut (volets sortis, avion lent)
      if(st.phase===7) tp=2.5+(1-Math.min(1,st.alt/40))*4; }                       // finale puis arrondi : le nez se lève avant le toucher des roues
    a.pitch+=(tp-a.pitch)*Math.min(1,dtg*(ground&&st.phase>=7?0.35:0.6));
    a.hdg=st.hdg; a.t=t; a.alt=st.alt;
  }
  return a;
}
// trajectoire lissée en vol : la route est une ligne brisée ; sans lissage l'avion changeait de cap d'un coup
// à chaque angle (ex. pour s'aligner sur la piste). On moyenne la position sur quelques secondes autour de
// l'instant : les angles deviennent de vrais virages, et le cap suit la tangente (l'inclinaison en découle).
function smoothSt(get,t,alt,D){
  const s0=get(t); if(!s0||(s0.alt!==undefined?s0.alt:alt)<60) return s0;
  const P=[get(t-D),get(t-D/2),s0,get(t+D/2),get(t+D)], W=[1,2,3,2,1]; if(P.some(x=>!x)) return s0;
  let la=0,lo=0,al=0,w=0; for(let i=0;i<5;i++){ const q=P[i].p||P[i]; la+=q.lat*W[i]; lo+=(q.lon+(Math.abs(q.lon-(s0.p||s0).lon)>180?(q.lon<0?360:-360):0))*W[i]; al+=(P[i].alt||0)*W[i]; w+=W[i]; }
  const A=P[1].p||P[1], B=P[3].p||P[3], h=gcDist(A,B)>0.02?bearing(A,B):s0.hdg;
  return {s0,lat:la/w,lon:lo/w,alt:al/w,hdg:h};
}
function smoothState(ac,t){ const st=flightState(ac,t); if(!st||st.alt<60||st.phase<=1||st.phase>=8) return st;
  const D=st.alt<3500?16000:30000, lg=st.leg; const r=smoothSt(x=>{ const q=flightState(ac,x); return q&&q.leg===lg?q:null; },t,st.alt,D);
  if(!r||!r.s0) return st; return Object.assign({},st,{lat:r.lat,lon:r.lon,alt:Math.max(r.alt,60),hdg:r.hdg}); }
function acPose(ac){
  const t=gSimNow(), st=smoothState(ac,t); if(!st) return null;
  const mi=modelInfo(modelOf(ac),liveryOf(ac),acLiteFor(ac)), a=attitude(ac,st,t);
  const gear=st.alt<600||st.phase<=2||st.phase>=6;
  let h=Math.max(st.alt, mi.R+mi.gH+0.4)+(typeof legElev==='function'?legElev(st.from,st.to,st.frac):0);
  // jamais à travers une montagne : marge de sécurité au-dessus du relief en route
  if(typeof TERRAIN!=='undefined'&&TERRAIN.on&&st.alt>30&&st.phase>=3&&st.phase<=5){ const g=groundAt(st.lat,st.lon); if(h<g+300) h=g+300; }
  const pos=Cesium.Cartesian3.fromDegrees(st.lon, st.lat, h);
  const q=Cesium.Transforms.headingPitchRollQuaternion(pos, new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(st.hdg-90), Cesium.Math.toRadians(a.pitch), Cesium.Math.toRadians(a.bank)));
  return {pos,q,st,a,gear,mi,h};
}

// volets, train, aérofreins, inverseurs et hublots éclairés : suivent la phase de vol, à vitesse réaliste
function acAnimate(an,mi,ph,alt,gnd,spd,hold,push,lat,lon){
  const now=performance.now(), tg=AC3D.cfg(ph,alt,gnd,spd,hold,push,mi.v);
  if(!an.t){ Object.assign(an,tg); an.litAt=0; }
  else AC3D.step(an,tg,Math.min(0.5,(now-an.t)/1000)*Math.max(1,Math.min(20,(SPEEDS[S.speed]||{mult:1}).mult)));
  an.t=now;
  if(now-an.litAt>2500){ an.litAt=now; const el=globeSunElevation(lat,lon);
    an.lit=el<-4; an.el=el; }
  an.gnd=gnd||ph<=1||ph>=8;
}
function globeSunElevation(lat,lon){
  if(!G||!G.lighting) return 45; if(G.forceNight) return -12; if(G.forceDay) return 45;
  return typeof sunElevAt==='function'?sunElevAt(lat,lon):45;
}
// lumière du soleil sur l'avion : nuit sombre (seuls hublots et feux brillent), lumière dorée à l'aube et au crépuscule
function acLight(an,out){
  const el=an.el===undefined?45:an.el, k=Math.max(0.1,Math.min(1,(el+5)/13)), w=Math.max(0,1-Math.abs(el-3)/9)*0.35;
  out=out||{c:new Cesium.Color(2,2,2,1), f:new Cesium.Cartesian2()};   // lightColor : une Color (composantes HDR), pas un Cartesian3
  // au sol la nuit : éclairé par les projecteurs de l'aéroport (lumière orangée)
  const n=an.gnd?Math.max(0,Math.min(1,-el/6)):0;
  out.c.red=Math.max(2*k,0.85*n); out.c.green=Math.max(2*k*(1-w*0.45),0.68*n); out.c.blue=Math.max(2*k*(1-w),0.46*n); Cesium.Cartesian2.fromElements(Math.max(k,0.3*n),Math.max(k,0.3*n),out.f); return out;
}

/* ---------- synchronisation avec la simulation ---------- */
function globeSync(full){
  if(!G) return;
  const C=Cesium, V=G.viewer;
  let tv=S.time; if(G.forceDay||G.forceNight){ const f=G.follow&&S.fleet.find(a=>a.id===G.follow), st=f&&flightState(f), lon=st?st.lon:(V.camera.positionCartographic?C.Math.toDegrees(V.camera.positionCartographic.longitude):0); tv=fxNoon(lon)+(G.forceNight?14:2)*HOUR; }
  V.clock.currentTime=C.JulianDate.fromDate(new Date(tv));
  V.scene.globe.enableLighting=G.lighting;
  const seen=new Set();
  // téléphone : seulement les 25 avions les plus proches de ce qu'on regarde (+ l'avion suivi) — une grosse flotte saturait la mémoire
  let keep=null;
  if(typeof GQ!=='undefined'&&GQ.mob&&!GQ.hq){ try{ let ref=null; const f=G.follow&&S.fleet.find(a=>a.id===G.follow), fs=f&&f.flight&&flightState(f);
      if(fs) ref={lat:fs.lat,lon:fs.lon}; else { const cp=V.camera.positionCartographic; if(cp) ref={lat:C.Math.toDegrees(cp.latitude),lon:C.Math.toDegrees(cp.longitude)}; }
      if(ref){ const L=[]; for(const ac of S.fleet){ if(ac.status!=='flight'||!ac.flight) continue; const st=flightState(ac); if(st) L.push([gcDist(ref,st),ac.id]); }
        if(L.length>12){ L.sort((x,y)=>x[0]-y[0]); keep=new Set(L.slice(0,12).map(x=>x[1])); if(G.follow) keep.add(G.follow); if(typeof selectedPlane!=='undefined'&&selectedPlane) keep.add(selectedPlane); } } }catch(e){ keep=null; } }
  for(const ac of S.fleet){
    if(ac.status!=='flight'||!ac.flight) continue;
    if(keep&&!keep.has(ac.id)) continue;
    seen.add(ac.id);
    if(G.planes.has(ac.id)){ const old=G.planes.get(ac.id); if(old._lite===acLiteFor(ac)) continue; V.entities.remove(old); G.planes.delete(ac.id); }   // l'avion suivi passe au modèle détaillé
    const m=modelOf(ac), mi=modelInfo(m,liveryOf(ac),acLiteFor(ac)); const isLite=acLiteFor(ac);
    let pose=null, poseAt=-1; const an={}, nt={};
    const P=()=>{ const tt=gSimNow(); if(tt!==poseAt){ pose=acPose(ac); poseAt=tt; } return pose; };   // une seule pose par image
    const ent=V.entities.add({
      position:new C.CallbackProperty(()=>{ const p=P(); return p&&p.pos; },false),
      orientation:new C.CallbackProperty(()=>{ const p=P(); return p&&p.q; },false),
      model:{uri:mi.uri, scale:1, minimumPixelSize:54, maximumScale:20000, runAnimations:false, shadows:C.ShadowMode.CAST_ONLY,
},
      label:{text:`${S.company.code}${flightNumber(ac)} · ${m.name}`, font:'600 13px system-ui', fillColor:C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new C.Cartesian2(0,-38), distanceDisplayCondition:new C.DistanceDisplayCondition(2500,4e6), scale:0.9},
    });
    // (affecté après coup : passé au constructeur, Cesium transformerait le rappel en simple sac de propriétés)
    const lo=acLight(an); ent.model.lightColor=new C.CallbackProperty(()=>acLight(an,lo).c,false); ent.model.imageBasedLightingFactor=new C.CallbackProperty(()=>lo.f,false);
    ent.model.nodeTransformations=new C.CallbackProperty(()=>{ const p=P(); if(!p) return nt; const st=p.st; acAnimate(an,p.mi,st.phase,st.alt,st.alt<0.6,st.spd,st.holding==='in',st.pushback,st.lat,st.lon); return AC3D.pose(p.mi,an,nt); },false);
    ent._acId=ac.id; ent._lite=isLite; G.planes.set(ac.id,ent);
  }
  for(const [id,ent] of G.planes) if(!seen.has(id)){ V.entities.remove(ent); G.planes.delete(id); G.att.delete(id); if(G.follow===id){ const nx=S.fleet.find(a=>a.status==='flight'&&a.flight&&a.id!==id); if(nx){ toast('🛬 Arrivé au parking ! On passe à un autre de vos vols en cours…','ok'); globeSync(false); globeFollow(nx.id); } else { globeFollow(null); toast('🛬 L’avion suivi est arrivé au parking','ok'); } } }
  if(full || (G.netKey!==netKey())){ drawGlobeNetwork(); }
  if(full || !G.rivAt || performance.now()-G.rivAt>20000){ G.rivAt=performance.now(); drawGlobeRivals(); }
}
const netKey=()=>S.routes.map(r=>r.id).join()+'|'+S.hubs.join()+'|'+S.company.color+'|'+airspacePolicyRev()+'|'+Math.floor(S.time/DAY);   // les tracés suivent la route du jour
function drawGlobeNetwork(){
  const C=Cesium, V=G.viewer; G.netKey=netKey();
  for(const e of [...G.routes,...G.airports]) V.entities.remove(e); G.routes=[]; G.airports=[];
  const col=C.Color.fromCssColorString(S.company.color);
  for(const r of S.routes){
    const pts=[];
    for(let i=0;i<r.stops.length-1;i++){
      const plan=airspaceRoutePlan(S.company.code,r.stops[i],r.stops[i+1]); if(plan.violation) continue;
      // la vraie trajectoire (courbe, différente à chaque vol), pas la ligne droite
      let P=null; try{ P=typeof routeLegPath==='function'?routeLegPath(r.stops[i],r.stops[i+1]):null; }catch(e){}
      const ptsL=P&&P.air&&P.air.length>2?P.air:plan.points; for(let j=i?1:0;j<ptsL.length;j++) pts.push(ptsL[j].lon,ptsL[j].lat);
    }
    if(pts.length<4) continue;
    G.routes.push(V.entities.add({polyline:{positions:C.Cartesian3.fromDegreesArray(pts), width:3, arcType:C.ArcType.GEODESIC, material:new C.PolylineGlowMaterialProperty({glowPower:0.25, color:col.withAlpha(0.9)}), distanceDisplayCondition:new C.DistanceDisplayCondition(30000,3e7)}}));
  }
  const codes=new Set([...S.hubs, ...S.routes.flatMap(r=>r.stops)]);
  for(const c of codes){ const a=AP(c), hub=S.hubs.includes(c);
    G.airports.push(V.entities.add({position:C.Cartesian3.fromDegrees(a.lon,a.lat,30), point:{pixelSize:hub?12:8, color:hub?C.Color.fromCssColorString('#ffd60a'):C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:2, distanceDisplayCondition:new C.DistanceDisplayCondition(20000,3e7)},
      label:{text:a.city, font:`${hub?'700 15px':'600 12px'} system-ui`, fillColor:hub?C.Color.fromCssColorString('#ffe066'):C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new C.Cartesian2(10,-10), horizontalOrigin:C.HorizontalOrigin.LEFT, distanceDisplayCondition:new C.DistanceDisplayCondition(0,9e6)}}));
  }
}
function drawGlobeRivals(){
  const C=Cesium, V=G.viewer;
  for(const e of G.rivals) V.entities.remove(e); G.rivals=[];
  if(!MAPOPT.rival) return;
  let n=0; const t=gSimNow();
  const list=[]; for(const R of S.rivals||[]) for(const r of R.routes){ if(typeof airspaceViolation==='function'&&airspaceViolation(R.code,r.a,r.b)) continue; if(typeof godCcDead==='function'&&godCcDead(r.a,r.b)) continue; if(!r.c) r.c=R.code; list.push({R,r}); }
  // autour de l'avion suivi : le trafic réel des aéroports proches
  if(G.follow&&typeof visibleRealRoutes==='function'){ const ac=S.fleet.find(a=>a.id===G.follow), st=ac&&flightState(ac,t);
    if(st){ const b=L.latLngBounds([st.lat-6,st.lon-8],[st.lat+6,st.lon+8]); list.unshift(...visibleRealRoutes(b,st.lon,15)); } }
  // les plus proches d'abord (roulage, décollages et atterrissages autour de vous)
  const fol=G.follow&&S.fleet.find(a=>a.id===G.follow), fst=fol&&flightState(fol,t);
  const cands=[]; for(const it of list.slice(0,600)){ const sc=typeof rivalSched==='function'?rivalSched(it.r):null; const nP=Math.min(3,sc?sc.nP:1); for(let i=0;i<nP;i++){ const q=typeof rivalPos==='function'? rivalPos(it.r,i,t) : null; if(q) cands.push({...it,i,q,dd:fst?gcDist(q.p,fst):0}); } }
  if(fst) cands.sort((x,y)=>x.dd-y.dd);
  for(const {R,r,i:pi,q:q0} of cands){
    if(n>=(G.rivalCap!==undefined?G.rivalCap:(GQ.hq?60:GQ.mob?12:22))) return;
    const mi=modelInfo(getModel(REP_MODEL[q0.cat]||'A20N')||{id:'A20N',seats:180,cargo:0,fam:'A320'},R.color,acLite());
    let q=q0, qAt=-1, re=null; const an={}, nt={}, at={b:0,p:0};
    const Q=()=>{ const tt=gSimNow(); if(tt!==qAt){ qAt=tt; const q1=rivalPos(r,pi||0,tt)||q;
        // virages lissés aussi pour les autres compagnies (en vol seulement)
        if(q1&&!q1.gnd&&(q1.alt||0)>60){ const sm=smoothSt(x=>{ const z=rivalPos(r,pi||0,x); return z&&!z.gnd?z:null; },tt,q1.alt,(q1.alt||0)<3500?16000:30000);
          q=sm&&sm.s0?Object.assign({},q1,{p:{lat:sm.lat,lon:sm.lon},alt:Math.max(60,sm.alt),hdg:sm.hdg}):q1; } else q=q1; } return q; };
    const posOf=()=>{ const v=Q(); const e=typeof gElev==='function'?gElev(gcDist(v.p,v.from)<gcDist(v.p,v.to)?v.from.code:v.to.code):0; return C.Cartesian3.fromDegrees(v.p.lon,v.p.lat,Math.max(v.alt||0,mi.R+mi.gH+0.4)+e); };
    re=V.entities.add({position:new C.CallbackProperty(posOf,false),
      orientation:new C.CallbackProperty(()=>{ const v=Q(), pos=posOf(), tt=gSimNow(), now=performance.now();
        // attitude : inclinaison dans les virages, nez qui suit la trajectoire (montée, descente, arrondi), sans à-coups
        if(at.t!=null&&tt>at.t){ const dt=(tt-at.t)/1000, dh=((v.hdg-at.h+540)%360)-180, spd=(v.alt||0)<3000?75:220;
          const bk=v.gnd?0:Math.max(-25,Math.min(25,Math.atan(spd*(dh/dt)*Math.PI/180/9.81)*180/Math.PI)), vs=((v.alt||0)-at.a)/dt;
          const fpa=v.gnd?0:Math.atan2(vs,spd)*180/Math.PI, tp=v.gnd?(v.ph===2&&(v.alt||0)>0?6:0):Math.max(-4,Math.min(16,fpa+(v.ph===4?2.3:v.ph<=3?6:v.ph===7?5:3.5)));
          const kf=Math.min(1,(now-(at.n||now))/1000*0.8)||0.05; at.b+=(bk-at.b)*kf; at.p+=(tp-at.p)*kf; }
        at.t=tt; at.h=v.hdg; at.a=v.alt||0; at.n=now;
        return C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(v.hdg-90),C.Math.toRadians(at.p),C.Math.toRadians(at.b))); },false),
      model:{uri:new C.CallbackProperty(()=>rivalUri(re,mi,R,q0),false), scale:1, minimumPixelSize:26, maximumScale:20000, show:new C.CallbackProperty(()=>rivalVisible(posOf()),false)},
      label:{show:new C.CallbackProperty(()=>rivalVisible(posOf()),false), text:new C.CallbackProperty(()=>{ const v=Q(); return R.name+(v.ph===2?' · 🛫':v.ph===7?' · 🛬':''); },false), font:'600 11px system-ui', fillColor:C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new C.Cartesian2(0,-24), distanceDisplayCondition:new C.DistanceDisplayCondition(0,60000), scale:0.85}});
    const lo=acLight(an); re.model.lightColor=new C.CallbackProperty(()=>acLight(an,lo).c,false); re.model.imageBasedLightingFactor=new C.CallbackProperty(()=>lo.f,false);
    re.model.nodeTransformations=new C.CallbackProperty(()=>{ const v=Q(); acAnimate(an,mi,v.ph,v.alt||0,!!v.gnd,undefined,v.holding==='in',false,v.p.lat,v.p.lon); return AC3D.pose(mi,an,nt); },false);
    re._riv={name:R.name,code:R.code,Q,mi}; G.rivals.push(re); n++;
  }
}

// tout près de l'avion suivi (moins de 2,5 km), un avion d'une autre compagnie passe en modèle détaillé (3 au plus)
function rivalUri(re,mi,R,q0){
  if(!re||!acLite()||!G.followPos||(typeof P3!=='undefined'&&P3.lvl>=2)) return mi.uri; const now=performance.now();
  if(!re._lodAt||now-re._lodAt>700){ re._lodAt=now; let p=null; try{ p=re.position.getValue(G.viewer.clock.currentTime); }catch(e){}
    const d=p?Cesium.Cartesian3.distance(p,G.followPos):1e9, hi=re._hi?d<4000:d<2500&&G.rivals.filter(x=>x._hi).length<3;
    if(hi&&!re._miHi) try{ re._miHi=modelInfo(getModel(REP_MODEL[q0.cat]||'A20N')||getModel('A20N'),R.color,false); }catch(e){}
    re._hi=hi&&!!re._miHi; }
  return re._hi?re._miHi.uri:mi.uri; }
// un avion d'une autre compagnie ne doit pas se superposer à celui qu'on suit (même piste au même moment)
function rivalVisible(pos){ if(!G.follow||!G.followPos) return true; return Cesium.Cartesian3.distance(pos,G.followPos)>Math.max(250,(G.followL||40)*6); }
/* ---------- caméra façon simulateur ---------- */
const CAM_MODES={auto:{h:0,p:-9,k:3.2,label:'🎬 Auto'}, cabin:{h:0,p:-7,k:0,label:'👥 Cabine'}, chase:{h:0,p:-9,k:3.2,label:'🎥 Arrière'}, side:{h:-90,p:-4,k:3.5,label:'↔ Côté'}, front:{h:180,p:-6,k:2.8,label:'↩ Avant'}, top:{h:0,p:-62,k:4,label:'⬇ Dessus'}, tower:{h:35,p:-14,k:9,label:'🗼 Loin'}, cockpit:{h:0,p:-4,k:0,label:'🧑‍✈️ Cockpit'}};
function setCam(mode){
  const M=CAM_MODES[mode]||CAM_MODES.chase, ac=S.fleet.find(a=>a.id===G.follow), mi=ac&&modelInfo(modelOf(ac),liveryOf(ac));
  G.cam={mode, h:M.h, p:M.p, range:mi? Math.max(30,mi.L*M.k) : 120};
  if(mode!=='cockpit') G.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  for(const [id,e] of G.planes) e.show=!((mode==='cockpit'||mode==='cabin')&&id===G.follow);
  if(mode!=='cabin'&&typeof fxCabinOff==='function') fxCabinOff();
  if(mode==='cabin') toast('👥 Vue cabine : glissez pour regarder autour de vous, touchez un passager dans la liste','info');
  renderGlobeHud();
}
// régulateur de fluidité : si la vue 3D tourne sous ~22 images/s, le jeu s'allège par paliers (résolution, effets, avions lointains)
function perfGov(){
  if(!G||navigator.webdriver||window.SE_NO_PERF||GQ.mode!=='a') return;
  const now=performance.now(), P=G.perf||(G.perf={t0:now,n:0,lvl:0}); P.n++;
  const el=now-P.t0; if(el<6000) return; const fps=P.n/(el/1000); P.t0=now; P.n=0;
  if(el>12000||document.hidden||P.lvl>=2) return;
  if(fps<(GQ.mob?20:14)){ P.lvl++; const V=G.viewer, sc=V.scene;      // allègement doux : on garde l'image belle, on réduit seulement la charge
    try{ sc.globe.maximumScreenSpaceError=Math.max(sc.globe.maximumScreenSpaceError,2+P.lvl*0.6); V.resolutionScale=Math.max(0.85*(G.resBase||1),(V.resolutionScale||1)*0.9); G.rivalCap=P.lvl===1?16:8; G.rivAt=0; if(P.lvl>=2) sc.msaaSamples=1; }catch(e){}
    toast(`⚙️ Allègement automatique (${Math.round(fps)} images/s)`,'info'); }
}
function globeFollowTick(){
  perfGov();
  // caméra libre (aucun avion suivi) : les aéroports en 3D apparaissent quand on s'en approche
  if(G&&!G.follow&&!G.noWorld&&!$('#globe').hidden){ const now=performance.now(); if(!G.freeAt||now-G.freeAt>1500){ G.freeAt=now;
    try{ const cp=G.viewer.camera.positionCartographic, h=cp&&cp.height;
      if(h!==undefined&&h<60000){ const ll={lat:Cesium.Math.toDegrees(cp.latitude),lon:Cesium.Math.toDegrees(cp.longitude)}; G.cam.free=true; if(typeof nightTick==='function') nightTick({st:ll}); airportsTick({st:ll,h}); }
      else if(G.apNear&&G.cam.free){ G.cam.free=false; worldClear(); } }catch(e){ console.warn(e); } } }
  if(!G||!G.follow||$('#globe').hidden) return;
  const ac=S.fleet.find(a=>a.id===G.follow); if(!ac) return;
  const p=acPose(ac); if(!p) return;
  G.followPos=p.pos; G.followL=p.mi.L;
  const C=Cesium, cam=G.viewer.camera, c=G.cam;
  if(typeof fxCamera==='function'&&fxCamera(ac,p,c)){ /* caméra auto ou cabine */ if(typeof fxShake==='function') fxShake(p); }
  else if(c.mode==='cockpit'){
    // œil du pilote : à l'avant du fuselage, au-dessus de l'axe
    const fwd=p.mi.L*0.43, off=C.Cartesian3.fromElements(0,0,0), enu=C.Transforms.eastNorthUpToFixedFrame(p.pos);
    const hd=C.Math.toRadians(p.st.hdg), e=Math.sin(hd)*fwd, n=Math.cos(hd)*fwd;
    const eye=C.Matrix4.multiplyByPoint(enu, new C.Cartesian3(e,n,p.mi.R*0.45), new C.Cartesian3());
    cam.lookAtTransform(C.Matrix4.IDENTITY);
    cam.setView({destination:eye, orientation:{heading:C.Math.toRadians(p.st.hdg+c.h), pitch:C.Math.toRadians(c.p+p.a.pitch*0.8), roll:C.Math.toRadians(p.a.bank)}});
  } else {
    cam.lookAt(p.pos, new C.HeadingPitchRange(C.Math.toRadians(p.st.hdg+c.h), C.Math.toRadians(c.p), c.range));
  }
  // traînée de condensation (haute altitude)
  const now=performance.now();
  if(!G.trailAt||now-G.trailAt>350){ G.trailAt=now; if(p.h>7600){ G.trail.push(p.pos.clone()); if(G.trail.length>90) G.trail.shift(); } else if(G.trail.length) G.trail.shift(); }
  // nuages autour de l'avion
  if(G.clouds){ const ll={lat:p.st.lat,lon:p.st.lon}; if(!G.cloudC||gcDist(G.cloudC,ll)>45){ G.cloudC=ll; spawnClouds(ll); } }
  worldTick(p);
  if(typeof fxTick==='function'){ try{ fxTick(ac,p); }catch(e){ console.warn(e); } }
  if(typeof atcTick==='function'){ try{ atcTick(ac,p.st); }catch(e){ console.warn(e); } }
  if(now-G.hudAt>120){ G.hudAt=now; try{ renderRfsHud(ac,p); }catch(e){ console.warn(e); } }
}
function spawnClouds(c){
  const C=Cesium; G.clouds.removeAll(); G.clouds._seBV=new C.BoundingSphere(C.Cartesian3.fromDegrees(c.lon,c.lat,2000),90000);
  const wet=(typeof stormAt==='function'&&stormAt(c.lat,c.lon))?1.6:1;
  for(let i=0;i<Math.round(34*wet);i++){
    const d=rnd(2,70), b=rnd(0,360), q=destPt(c.lat,c.lon,b,d), alt=rnd(900,3400);
    G.clouds.add({position:C.Cartesian3.fromDegrees(q.lon,q.lat,alt+(typeof groundAt==='function'?Math.max(0,groundAt(q.lat,q.lon)):0)), scale:new C.Cartesian2(rnd(1200,3200),rnd(500,1100)), maximumSize:new C.Cartesian3(rnd(30,60),rnd(14,26),rnd(18,30)), slice:rnd(0.3,0.7), brightness:rnd(0.85,1)*(G.cloudK||1)});
  }
}
function globeFollow(id){
  if(!G) return;
  const C=Cesium, sc=G.viewer.scene;
  if(!id){ for(const e of G.planes.values()) e.show=true; G.follow=null; G.viewer.camera.lookAtTransform(C.Matrix4.IDENTITY); sc.screenSpaceCameraController.enableInputs=true; G.trail=[]; if(G.trailEnt){ G.viewer.entities.remove(G.trailEnt); G.trailEnt=null; } if(G.clouds) G.clouds.removeAll(); G.cloudC=null; const hd=$('#rfsHud'); if(hd) hd.hidden=true; worldClear(); if(typeof fxClear==='function') fxClear(); { const rb=document.getElementById('radioBox'); if(rb) rb.remove(); } document.body.classList.remove('globe-follow'); setTimeout(()=>G&&G.viewer.resize(),30); renderGlobeHud(); return; }
  if(typeof terrFlatten==='function'){ const f=S.fleet.find(a=>a.id===id), lg=f&&f.flight&&f.flight.legs[f.flight.li]; let n=false; if(lg){ n=terrFlatten(lg.from)|n; n=terrFlatten(lg.to)|n; } if(n) terrReload(); }
  if(!G.tm) G.tm={auto:true, prev:S.speed};
  G.follow=id; sc.screenSpaceCameraController.enableInputs=false; document.body.classList.add('globe-follow'); setTimeout(()=>G&&G.viewer.resize(),30); setCam(G.lastMode&&CAM_MODES[G.lastMode]?G.lastMode:'auto');
  if(!G.trailEnt) G.trailEnt=G.viewer.entities.add({polyline:{positions:new C.CallbackProperty(()=>G.trail.length>1?G.trail:[],false), width:4, material:C.Color.WHITE.withAlpha(0.45)}});
  toast('🎬 Ralenti automatique : temps réel au décollage et à l’atterrissage, accéléré en croisière','info');
  renderGlobeHud();
}

/* ---------- HUD de vol (façon simulateur) ---------- */
function renderRfsHud(ac,p){
  let hud=$('#rfsHud'); if(!hud){ hud=document.createElement('div'); hud.id='rfsHud'; $('#globe').parentNode.appendChild(hud); }
  hud.hidden=false;
  const st=p.st, m=modelOf(ac), altFt=Math.round(st.alt*3.28084), tas=st.spd, ias=tas/(1+st.alt/1000*0.065), kts=Math.round(ias/1.852);
  const a=1225-Math.min(11000,st.alt)*0.0185, mach=tas/a, gs=Math.round((st.gs||tas)/1.852);
  const oat=Math.round(Math.max(-56.5,15-6.5*st.alt/1000));
  const ap=AP(st.to), apE=AP(st.frac>0.5?st.to:st.from), agl=Math.max(0,altFt), msl=Math.round(altFt+((apE&&apE.elev)||0));
  const w=st.wind||0, wdir=Math.round((st.hdg+(w>0?180:0)+360)%360), wk=Math.round(Math.abs(w)/1.852);
  const leg=st.leg, prof=legProf(leg,m), el=Math.max(0,gSimNow()-leg.dep), fuel0=m.burn*(prof.total/HOUR+1)*0.8, fuel=Math.max(0,fuel0-m.burn*Math.max(0,(el-prof.segs.find(x=>x.ph===2&&!x.hold).t0)/HOUR)*0.8);
  const cap=m.burn*(m.range/m.speed+1)*0.8, fob=Math.round(fuel), fp=Math.round(clamp(fuel/cap*100,0,100));
  const ft=`${Math.floor(el/HOUR)}:${String(Math.floor(el%HOUR/MIN)).padStart(2,'0')} h`;
  const tape=(v,step,fmt)=>{ let s=''; const base=Math.round(v/step)*step; for(let i=-3;i<=3;i++){ const val=base+i*step; s+=`<div style="top:${50-(val-v)/step*14}%">${fmt(val)}—</div>`; } return s; };
  const hdg=Math.round((st.hdg+360)%360);
  const vs=Math.round(p.a.vs/100)*100;
  hud.innerHTML=`<div class="rf-top">${S.company.code}${flightNumber(ac)} · ${esc(m.name)} · ${esc(st.origin)} → ${esc(st.dest)}</div>
    <div class="rf-hdg">H ${String(hdg).padStart(3,'0')}</div><div class="rf-oat">OAT ${oat}°C · M ${mach.toFixed(2).replace('.',',')} · VS ${vs>0?'+':''}${vs} ft/min</div>
    <div class="rf-tape left">${tape(kts,10,v=>v)}<b>${kts}</b></div>
    <div class="rf-tape right">${tape(msl,100,v=>v)}<b>${msl}</b></div>
    <div class="rf-dest">${esc(ap?ap.icao||st.to:st.to)}<br>${(st.remain/1.852).toFixed(1).replace('.',',')} NM</div>
    <div class="rf-bar"><div><b>${wdir}/${wk}kts</b><span>Vent</span></div><div><b>${kts} kts</b><span>IAS (GS ${gs})</span></div><div><b>${msl} ft</b><span>Altitude MSL</span></div><div><b>${agl} ft</b><span>Altitude AGL</span></div><div><b>${fp}% · ${num(fob*0.8)} kg</b><span>Carburant</span></div><div><b>${ft}</b><span>Temps de vol</span></div><div><b>${st.holding?(st.holding==='out'?'Attente piste':'Attente'):st.phase===0&&typeof AP3D!=='undefined'&&AP3D.gate&&AP3D.gate.stage!=='on'?(AP3D.gate.stage==='off'?'Débarquement':'Nettoyage cabine'):PHASES[st.phase]}</b><span>Phase</span></div></div>`;
}
async function toggleGoogle3D(on){
  const C=Cesium, key=localStorage.getItem(GKEY);
  if(on===undefined) on=!G.tiles;
  if(on && !key){ toast('🔑 Ajoutez d’abord une clé Google dans « 🗺️ Fond de carte »','warn'); return; }
  if(on){
    try{
      // téléphone : bâtiments Google moins détaillés et cache limité (ils saturaient la mémoire de l'iPhone)
      G.tiles=await C.Cesium3DTileset.fromUrl(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`,GQ.mob?{showCreditsOnScreen:true, maximumScreenSpaceError:GQ.hq?20:28, cacheBytes:96*1024*1024, maximumCacheOverflowBytes:32*1024*1024, skipLevelOfDetail:true, foveatedScreenSpaceError:true, dynamicScreenSpaceError:true}:{showCreditsOnScreen:true, maximumScreenSpaceError:12});
      G.viewer.scene.primitives.add(G.tiles); G.viewer.scene.globe.show=false;
      localStorage.setItem('cst-3dtiles','1'); toast('🏙️ Villes 3D Google activées','ok');
    }catch(e){ G.tiles=null; toast('⛔ Villes 3D Google : clé refusée (activez « Map Tiles API »)','bad'); }
  } else if(G.tiles){
    G.viewer.scene.primitives.remove(G.tiles); G.tiles=null; G.viewer.scene.globe.show=true; localStorage.setItem('cst-3dtiles','0');
  }
  renderGlobeHud();
}
function renderGlobeHud(){
  const box=$('#globeHud'); if(!box||!G) return;
  const sel=selectedPlane && S.fleet.find(a=>a.id===selectedPlane && a.status==='flight');
  const flying=S.fleet.filter(a=>a.status==='flight');
  const skyLabel=G.forceNight?'🌙 Nuit':G.forceDay?'☀️ Jour':'🕒 Auto';
  const skyBtn=`<button class="gh ${G.forceDay||G.forceNight?'on':''}" data-act="globeDay" title="Cycle du soleil : automatique, jour forcé, nuit forcée">${skyLabel}</button>`;
  const snowBtn=`<button class="gh ${G.snowOn?'on':''}" data-act="globeSnow" title="Neige animée légère sur la vue 3D">❄️ Neige</button>`;
  if(G.follow){
    box.innerHTML=`<button class="gh" data-act="close3D">✖ Carte</button><button class="gh" data-act="globeFollow">🌍 Quitter la poursuite</button>
      ${Object.entries(CAM_MODES).map(([k,v])=>`<button class="gh ${G.cam.mode===k?'on':''}" data-act="globeCam" data-k="${k}">${v.label}</button>`).join('')}
      <button class="gh" data-act="globeZoom" data-d="0.7">🔍＋</button><button class="gh" data-act="globeZoom" data-d="1.4">🔍－</button>
      <button class="gh" data-act="globeNext">⏭ Avion suivant</button>
      <button class="gh ${typeof FX!=='undefined'&&FX.soundOn?'on':''}" data-act="globeSound">🔊 Son</button>
      ${typeof visionButtons==='function'?visionButtons():''}${typeof liveButtons==='function'?liveButtons():''}
      ${skyBtn}${snowBtn}
      <button class="gh ${typeof TERRAIN!=='undefined'&&TERRAIN.on?'on':''}" data-act="globeRelief" title="Relief réel (montagnes, vallées)">⛰️ Relief</button>
      <button class="gh" data-act="globeQ" title="Qualité graphique">⚙️ ${GQ.mode==='a'?'Auto':GQ.mode==='h'?'Haute':GQ.mode==='l'?'Minimal':'Éco'}</button>
      <button class="gh" data-act="globeBase" title="Changer le fond : satellite, plan, relief, sombre…">🗺️ Fond</button>
      <button class="gh" data-act="photo">📸 Photo</button>
      <button class="gh" data-act="radar">📡 Radar</button>
      <button class="gh ${typeof RADIO!=='undefined'&&RADIO.voice?'on':''}" data-act="radioVoice">🗣️ Voix</button>
      <button class="gh ${typeof FX!=='undefined'&&FX.forceRain?'on':''}" data-act="globeRain" title="Pluie et orage (sinon : selon la météo du jeu)">🌧️ Pluie</button><button class="gh ${typeof CL!=='undefined'&&clMode()!=='auto'?'on':''}" data-act="globeClouds" title="Nuages : touchez pour changer">☁️ ${typeof clModeLabel==='function'?clModeLabel():'Nuages'}</button>
      <span class="gh-sep"></span>
      <button class="gh ${G.tm&&G.tm.auto?'on':''}" data-act="globeTime" data-k="auto" title="Temps réel au décollage et à l’atterrissage, accéléré en croisière">🎬 Auto</button>
      ${TM_STEPS.map(([k,l])=>`<button class="gh ${G.tm&&!G.tm.auto&&S.speed===k?'on':''}" data-act="globeTime" data-k="${k}">${l}</button>`).join('')}
      <span class="gh-tip">Glissez pour tourner autour de l’avion · temps ×${SPEEDS[S.speed].mult}</span>`;
    return;
  }
  box.innerHTML=`<button class="gh" data-act="close3D">✖ Carte 2D</button>
    <button class="gh" data-act="globeFollow" ${flying.length?'':'disabled'}>🎥 Suivre un avion${!sel&&flying.length?' (au hasard)':''}</button>
    <button class="gh" data-act="globeHome">🏠 Mon hub</button>
    <button class="gh ${G.lighting?'on':''}" data-act="globeLight">🌗 Soleil</button>${skyBtn}${snowBtn}
    ${typeof visionButtons==='function'?visionButtons():''}${typeof liveButtons==='function'?liveButtons():''}
    <button class="gh ${typeof TERRAIN!=='undefined'&&TERRAIN.on?'on':''}" data-act="globeRelief">⛰️ Relief</button>
    <button class="gh ${G.tiles?'on':''}" data-act="google3D">🏙️ Villes 3D Google</button>
    <button class="gh" data-act="globeBase" title="Changer le fond : satellite, plan, relief, sombre…">🗺️ Fond</button>
    <button class="gh" data-act="watchEvent" data-k="dep">🛫 Prochain décollage</button>
    <button class="gh" data-act="watchEvent" data-k="arr">🛬 Prochain atterrissage</button>`;
}
// prochain décollage / atterrissage de vos avions (aussi ceux qui n'ont pas encore quitté la porte)
function nextEvent(kind){
  const t=S.time; let best=null;
  for(const ac of S.fleet){ if(ac.status==='manual') continue; const m=modelOf(ac);
    if(ac.flight){ const leg=ac.flight.legs[ac.flight.li]; if(!leg) continue; const sg=legProf(leg,m).segs.find(x=>x.ph===(kind==='dep'?2:7)); if(!sg) continue; const at=leg.dep+sg.t0; if(at>t&&(!best||at<best.at)) best={id:ac.id,at}; }
    else if(kind==='dep'&&ac.status==='idle'&&ac.plan&&ac.plan.length){ const wk=weekIndex(t+hubTz(ac));
      for(const p of ac.plan){ const done=ac.wk&&ac.wk.week===wk?(ac.wk.c[p.routeId]||0):0; if(done>=p.weekly) continue; const std=planSlotTimes(ac,p,t)[done]; if(std===undefined) continue; const at=std+20*MIN; if(at>t&&(!best||at<best.at)) best={id:ac.id,at}; } } }
  return best;
}
Object.assign(ACTIONS,{
  globeBase:()=>{ const ks=Object.keys(BASE3D), k=ks[(ks.indexOf(G.baseKey)+1)%ks.length]; setBase3D(k); toast('🗺️ Fond : '+BASE3D[k].label,'info'); },
  watchEvent:d=>{ const e=nextEvent(d.k); if(!e){ toast(d.k==='dep'?'Aucun décollage prévu : programmez des avions sur une ligne.':'Aucun avion en vol.','warn'); return; }
    if(typeof fxAudioUnlock==='function') fxAudioUnlock();
    const tgt=e.at-(d.k==='dep'?3:2)*MIN, jump=tgt-S.time;
    if(jump>0){ UI.silent=true; advance(jump); UI.silent=false; globeNoteSim(); if(jump>HOUR) toast(`⏩ ${fmtDur?fmtDur(jump):Math.round(jump/HOUR)+' h'} de jeu écoulées jusqu’au ${d.k==='dep'?'décollage':'atterrissage'}`,'info'); }
    const ac=S.fleet.find(a=>a.id===e.id&&a.status==='flight'); if(!ac){ toast('L’avion n’est pas encore parti, réessayez.','warn'); return; }
    selectPlane(ac.id); globeSync(false); globeFollow(ac.id); G.tm&&(G.tm.auto=true); },
  open3D:()=>{ if(typeof fxAudioUnlock==='function') fxAudioUnlock(); return open3D(); },
  close3D:()=>close3D(),
  view3D:async d=>{ if(typeof fxAudioUnlock==='function') fxAudioUnlock(); const ok=await open3D(); if(!ok) return; const ac=S.fleet.find(a=>a.id===d.id&&a.status==='flight'); if(ac){ selectPlane(ac.id); globeSync(false); globeFollow(ac.id); } },
  globeFollow:()=>{ if(G.follow) return globeFollow(null); if(typeof fxAudioUnlock==='function') fxAudioUnlock(); const sel=selectedPlane&&S.fleet.find(a=>a.id===selectedPlane&&a.status==='flight'); const ac=sel||pick(S.fleet.filter(a=>a.status==='flight')); if(ac){ selectPlane(ac.id); globeFollow(ac.id); } },
  globeNext:()=>{ const fl=S.fleet.filter(a=>a.status==='flight'); if(!fl.length) return; const i=fl.findIndex(a=>a.id===G.follow); const ac=fl[(i+1)%fl.length]; selectPlane(ac.id); globeFollow(ac.id); },
  globeCam:d=>{ G.lastMode=d.k; setCam(d.k); },
  globeQ:()=>{ GQ.mode=GQ.mode==='l'?'e':GQ.mode==='e'?'h':GQ.mode==='h'?'a':'l'; try{ localStorage.setItem('se-q',GQ.mode); }catch(e){} toast(GQ.mode==='l'?'⚙️ Minimal : pour les téléphones qui coupent la 3D (sans relief ni nuages ; relancez la 3D pour tout alléger)':GQ.mode==='e'?'⚙️ Éco : plus fluide sur téléphone':GQ.mode==='h'?'⚙️ Haute qualité : image nette, anticrénelage, ombres':'⚙️ Auto : haute qualité, allègement doux si la vue rame','info'); applyQuality(); renderGlobeHud(); },
  city3DFallback:()=>{ closeModal(); const ac=S.fleet.find(a=>a.status==='flight'&&a.flight); const st=ac&&flightState(ac,simNow()); const c=st&&st.alt<3000?(st.frac<0.5?st.origin:st.dest):S.company.hub; const A=AP(c)||AP(S.company.hub); if(typeof openCity==='function') openCity(A.lat,A.lon); else ACTIONS.openCity&&ACTIONS.openCity(); },
  diag3D:()=>{ let L=[]; try{ L=JSON.parse(localStorage.getItem('se-3d-log')||'[]'); }catch(e){} let gl='?'; try{ const c=document.createElement('canvas'), x=c.getContext('webgl2')||c.getContext('webgl'); gl=x?(x instanceof (window.WebGL2RenderingContext||Object)?'WebGL2':'WebGL1')+' · max texture '+x.getParameter(x.MAX_TEXTURE_SIZE):'WebGL indisponible'; }catch(e){ gl='erreur '+e.message; }
    showModal('🩺 Diagnostic 3D',`<div class="small">Mode : <b>${GQ.mode==='l'?'Minimal':GQ.mode==='e'?'Éco':GQ.mode==='h'?'Haute':'Auto'}</b> · écran ×${window.devicePixelRatio||1} · ${esc(gl)}<br><span class="mut">${esc(navigator.userAgent)}</span></div><h3>Derniers événements</h3>${L.length?L.map(x=>`<div class="small">${new Date(x.t).toLocaleString('fr-FR')} — <b>${esc(x.ev)}</b> ${esc(x.msg)}</div>`).join(''):'<div class="mut small">Rien d’enregistré.</div>'}<p class="small mut">Faites une capture de cet écran pour signaler un problème.</p><div class="btns"><button class="btn" data-act="q3Mini">🪶 Passer en mode Minimal</button><button class="btn" data-act="closeModal">Fermer</button></div>`); },
  q3Mini:()=>{ GQ.mode='l'; try{ localStorage.setItem('se-q','l'); }catch(e){} if(G){ try{ applyQuality(); }catch(e){} } toast('🪶 Mode Minimal activé pour la 3D','ok'); closeModal(); },
  globeRelief:()=>{ TERRAIN.on=!TERRAIN.on; try{ localStorage.setItem('se-relief',TERRAIN.on?'1':'0'); }catch(e){} terrainApply(); toast(TERRAIN.on?'⛰️ Relief réel activé : montagnes, vallées et volcans':'Relief désactivé (terre plate, plus léger)','info'); renderGlobeHud(); },
  globeSound:()=>fxToggleSound(),
  globeRain:()=>{ FX.forceRain=!FX.forceRain; fxAudioUnlock(); renderGlobeHud(); },
  globeClouds:()=>{ if(typeof clNext==='function'){ clNext(); toast('☁️ '+clModeLabel(),'info'); } renderGlobeHud(); },
  globeDay:()=>{ if(G.forceNight){ G.forceNight=false; G.forceDay=false; } else if(G.forceDay){ G.forceDay=false; G.forceNight=true; } else { G.forceDay=true; G.forceNight=false; } G.lighting=true; try{ localStorage.setItem('se-day',G.forceDay?'1':'0'); localStorage.setItem('se-night',G.forceNight?'1':'0'); }catch(e){} globeSync(false); renderGlobeHud(); },
  globeSnow:()=>set3DSnow(!G.snowOn),
  globeZoom:d=>{ G.cam.range=clamp(G.cam.range*(+d.d),15,80000); },
  globeHome:()=>{ globeFollow(null); const a=AP(S.company.hub); G.viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(a.lon,a.lat-6,2.2e6), orientation:{heading:0,pitch:Cesium.Math.toRadians(-55),roll:0}, duration:2}); },
  globeLight:()=>{ G.lighting=!G.lighting; G.viewer.scene.globe.enableLighting=G.lighting; renderGlobeHud(); },
  google3D:()=>toggleGoogle3D(),
});

/* =========================================================
   Monde autour de l'avion suivi : bâtiments réels (OpenStreetMap),
   aéroports voisins, pistes balisées, ralenti automatique.
   ========================================================= */
// --- vitesse du temps pendant la poursuite (comme un simulateur) ---
const TM_STEPS=[['realiste','×1'],['x4','×4'],['x16','×16'],['standard','×60'],['rapide','×600']];
function autoSpeedFor(st,h){
  const ph=st.phase;
  if(ph===0) return 'standard';                 // embarquement
  if(ph===2||ph===7) return 'realiste';         // décollage, atterrissage
  if((ph===3||ph===6)&&h<1500) return 'realiste'; // montée initiale, finale
  if(ph===1||ph===8) return 'x4';               // roulage
  if(ph===4) return 'x16';                      // croisière
  return 'x4';
}
function timeTick(p){
  const tm=G.tm; if(!tm||!tm.auto) return;
  const want=autoSpeedFor(p.st,p.h);
  if(S.speed!==want){ S.speed=want; S.paused=false; if(typeof renderTop==='function') renderTop(); renderGlobeHud(); }
}

// --- bâtiments OpenStreetMap (Overpass, sans clé) ---
const OSM_CELL=0.06, OSM_EP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.nextgis.com/api/interpreter'];
function osmTick(p){
  if(!G.osm) G.osm={cells:new Map(), busy:false, fail:0};
  const O=G.osm; if(O.busy||(O.fail>=4&&Date.now()-(O.failT||0)<45000)||p.h>4500||G.tiles) return;
  const ci=Math.floor(p.st.lat/OSM_CELL), cj=Math.floor(p.st.lon/OSM_CELL);
  // la case sous l'avion, puis celle devant lui
  const ahead=destPt(p.st.lat,p.st.lon,p.st.hdg,4);
  const cand=[[ci,cj],[Math.floor(ahead.lat/OSM_CELL),Math.floor(ahead.lon/OSM_CELL)]];
  const c=cand.find(([i,j])=>!O.cells.has(i+','+j)); if(!c) return;
  O.e0=typeof gElev==='function'?gElev(p.st.frac<0.5?p.st.from:p.st.to):0;
  loadOsmCell(c[0],c[1]);
  // ménage : on garde les 8 cases les plus récentes
  if(O.cells.size>(G.osmCap||8)){ const k=O.cells.keys().next().value, prim=O.cells.get(k); if(prim&&prim.destroy) G.viewer.scene.primitives.remove(prim); O.cells.delete(k); }
}
async function loadOsmCell(i,j){
  const O=G.osm, key=i+','+j; O.cells.set(key,null); O.busy=true;
  const s=i*OSM_CELL, w=j*OSM_CELL, n=s+OSM_CELL, e=w+OSM_CELL;
  const q=`[out:json][timeout:25];way["building"](${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)});out geom ${Math.round((GQ.mini?350:GQ.mob?600:GQ.hq?5000:1800)*cityK())};`;
  let js=null;
  for(const ep of OSM_EP){ try{ const r=await fetch(ep,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'}}); if(r.ok){ js=await r.json(); break; } }catch(err){} }
  O.busy=false;
  if(!js){ O.fail++; O.failT=Date.now(); O.cells.delete(key); return; }
  O.fail=0;
  if(!G||!js.elements||!js.elements.length) return;
  // altitude lue dans les tuiles de relief (pas seulement là où le globe est déjà affiché)
  let gb=v=>0; try{ if(typeof cellGround==='function') gb=await cellGround(s,w,n,e,O.e0||0); else { const e0=O.e0||0; gb=v=>{ if(typeof TERRAIN==='undefined'||!TERRAIN.on) return 0; const h=groundAt(v.lat,v.lon); return h>0?h:e0; }; } }catch(err){ console.warn(err); }
  if(!G||!G.viewer||!O.cells.has(key)) return;
  const C=Cesium, inst=[];
  // bâtiments détaillés (façades, fenêtres, toits) : scenery3d.js ; sinon blocs simples
  if(typeof osmBuildCell==='function'&&!G.noFacade){ try{ const prim=osmBuildCell(js.elements,gb); if(prim) O.cells.set(key,prim); return; }catch(err){ console.warn(err); } }
  for(const el of js.elements){
    const g=el.geometry; if(!g||g.length<4) continue;
    const t=el.tags||{}; let h=parseFloat(t.height)||(parseFloat(t['building:levels'])||0)*3.2;
    if(!h){ const b=t.building; h=b==='house'||b==='residential'||b==='detached'?6:b==='hangar'||b==='industrial'||b==='warehouse'?11:b==='terminal'||b==='transportation'?16:b==='apartments'?15:b==='commercial'||b==='office'?18:4+((el.id%7)); }
    if(!t.height&&!t['building:levels']&&typeof sceneryHeight==='function') h=sceneryHeight(el,g,t,h);   // centre-ville : immeubles et tours
    h=Math.min(h,450);
    const pos=g.slice(0,-1).flatMap(v=>[v.lon,v.lat]);
    const shade=0.78+((el.id%13)/13)*0.16, tall=Math.min(1,h/80);
    let col=new C.Color(shade-0.1*tall,shade-0.06*tall,shade-0.02*tall+(t.building==='hangar'?0.05:0),1);
    if(typeof sceneryColor==='function') try{ col=sceneryColor(el,t,h,col); }catch(err){}
    try{ inst.push(new C.GeometryInstance({geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(pos)), height:gb(g[0])-1, extrudedHeight:gb(g[0])+h, vertexFormat:C.PerInstanceColorAppearance.VERTEX_FORMAT}), attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(col)}})); }catch(err){}
    // toit distinct (dalle plus sombre, bord) sur les immeubles : moins « bloc »
    if(h>=12&&!GQ.mini) try{ const rc=AP3D&&AP3D.night?new C.Color(0.08,0.09,0.12,1):new C.Color(col.red*0.72,col.green*0.72,col.blue*0.74,1); inst.push(new C.GeometryInstance({geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(pos)), height:gb(g[0])+h, extrudedHeight:gb(g[0])+h+1.2, vertexFormat:C.PerInstanceColorAppearance.VERTEX_FORMAT}), attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(rc)}})); }catch(err){}
  }
  if(!inst.length) return;
  const prim=new C.Primitive({geometryInstances:inst, appearance:new C.PerInstanceColorAppearance({flat:false, closed:true, translucent:false}), asynchronous:true, shadows:C.ShadowMode.DISABLED});
  G.viewer.scene.primitives.add(prim); O.cells.set(key,prim);
}

// --- aéroports voisins, pistes et balisage lumineux ---
function airportsTick(p){
  const C=Cesium, V=G.viewer, here={lat:p.st.lat,lon:p.st.lon};
  if(G.apNear&&gcDist(G.apNear.c,here)<25) return;
  if(!G.apNear) G.apNear={c:here, ents:[], lights:V.scene.primitives.add(new C.PointPrimitiveCollection()), rwy:[]};
  const N=G.apNear; N.c=here;
  for(const e of N.ents) V.entities.remove(e); N.ents=[]; N.lights.removeAll();
  for(const e of N.rwy) V.scene.primitives.remove(e); N.rwy=[];
  const near=[]; for(const c of AIRPORT_CODES){ const a=AP(c); if(Math.abs(a.lat-here.lat)>3.5) continue; const d=gcDist(a,here); if(d<320) near.push([d,c,a]); }
  near.sort((x,y)=>x[0]-y[0]);
  if(typeof terrFlatten==='function'){ let fresh=false; for(const [d,c] of near) if(d<300&&terrFlatten(c)&&d<60) fresh=true; if(fresh) terrReload(); }
  for(const [d,c,a] of near.filter(([d,c,a])=>d<90||a.cls>=3||S.hubs.includes(c)).slice(0,GQ.mob&&!GQ.hq?8:16)){
    const big=a.cls>=3, mine=S.hubs.includes(c);
    const EL=(typeof gElev==='function'?gElev(c):0);
    N.ents.push(V.entities.add({position:C.Cartesian3.fromDegrees(a.lon,a.lat,40+EL),
      label:{text:`✈ ${c} · ${a.city}`, font:`${big?'700 14px':'600 12px'} system-ui`, fillColor:mine?C.Color.fromCssColorString('#ffe066'):C.Color.fromCssColorString('#e0f2fe'), outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, verticalOrigin:C.VerticalOrigin.BOTTOM, pixelOffset:new C.Cartesian2(0,-6), distanceDisplayCondition:new C.DistanceDisplayCondition(0,big?400000:150000), disableDepthTestDistance:Number.POSITIVE_INFINITY}}));
    if(d>70) continue;
    const surf=[];
    if(d<45&&typeof airportProps==='function'){ try{ airportProps(c,N); }catch(e){ console.warn(e); } }
    for(const r of runwaysOf(c)){
      const L=r.len, W=Math.max(23,r.wid||45), H=r.hdg;
      if(r._drawn===G.apNear) continue; // une seule fois par piste physique
      const twin=runwaysOf(c).find(x=>x!==r&&x.thr===r.end); if(twin) twin._drawn=G.apNear;
      const P=(along,side)=>{ const q=destPt(r.thr.lat,r.thr.lon,H,along/1000); return side? destPt(q.lat,q.lon,H+90,side/1000) : q; };
      const corners=[P(0,-W/2),P(L,-W/2),P(L,W/2),P(0,W/2)];
      // piste texturée (asphalte, marquages, numéros) ; à défaut, surface unie
      let done=false; if(typeof runwayEntity==='function'&&d<45){ try{ N.ents.push(typeof apLit==='function'?apLit(runwayEntity(c,r,W),'rwy'):runwayEntity(c,r,W)); done=true; }catch(e){ console.warn(e); } }
      if(!done) surf.push(new C.GeometryInstance({geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(corners.flatMap(q=>[q.lon,q.lat]))), height:0.5+EL, vertexFormat:C.PerInstanceColorAppearance.VERTEX_FORMAT}), attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(r.hard?new C.Color(0.22,0.23,0.25,0.92):new C.Color(0.45,0.38,0.28,0.9))}}));
      // balisage : bords blancs, seuil vert, fin rouge, rampe d'approche
      const nightK=(typeof AP3D!=='undefined'&&AP3D.night)?1.5:1;
      const add=(q,col,sz)=>N.lights.add({position:C.Cartesian3.fromDegrees(q.lon,q.lat,1.4+EL), color:col, pixelSize:(sz||4)*nightK, disableDepthTestDistance:2500, scaleByDistance:new C.NearFarScalar(300,1.6,25000,0.5)});
      for(let x=0;x<=L;x+=60){ add(P(x,-W/2-2),C.Color.fromCssColorString('#fff7d6')); add(P(x,W/2+2),C.Color.fromCssColorString('#fff7d6')); add(P(x,0),C.Color.WHITE.withAlpha(0.8),3); }
      for(let s=-W/2;s<=W/2;s+=4){ add(P(0,s),C.Color.LIME,5); add(P(L,s),C.Color.RED,5); }
      for(let x=60;x<=900;x+=60){ add(P(-x,0),C.Color.fromCssColorString('#fffbe6'),5); if(x%300===0) for(let s=-15;s<=15;s+=5) add(P(-x,s),C.Color.fromCssColorString('#fffbe6'),4); }
    }
    for(const r of runwaysOf(c)) delete r._drawn;
    if(surf.length){
      const polys=surf.filter(g=>g.geometry instanceof C.PolygonGeometry), lines=surf.filter(g=>!(g.geometry instanceof C.PolygonGeometry));
      if(polys.length) N.rwy.push(V.scene.primitives.add(new C.Primitive({geometryInstances:polys, appearance:new C.PerInstanceColorAppearance({flat:true, translucent:true}), asynchronous:true})));
      if(lines.length) N.rwy.push(V.scene.primitives.add(new C.Primitive({geometryInstances:lines, appearance:new C.PolylineColorAppearance(), asynchronous:true})));
    }
  }
}
function worldTick(p){
  const now=performance.now(); if(G.noWorld){ timeTick(p); return; }
  timeTick(p);
  if(!G.wAt||now-G.wAt>1500){ G.wAt=now; try{ if(typeof nightTick==='function') nightTick(p); }catch(e){ console.warn(e); } try{ airportsTick(p); }catch(e){ console.warn(e); } try{ osmTick(p); }catch(e){ console.warn(e); } }
}
function worldClear(){
  if(!G) return; const V=G.viewer;
  if(G.osm){ for(const prim of G.osm.cells.values()) if(prim) V.scene.primitives.remove(prim); G.osm.cells.clear(); }
  if(G.osmPin){ for(const st of G.osmPin.values()) if(st&&st.prim) V.scene.primitives.remove(st.prim); G.osmPin.clear(); }
  if(G.osmFill){ for(const st of G.osmFill.values()) if(st&&st.prim) V.scene.primitives.remove(st.prim); G.osmFill.clear(); }
  if(G.apNear){ for(const e of G.apNear.ents) V.entities.remove(e); G.apNear.lights.removeAll(); for(const e of G.apNear.rwy) V.scene.primitives.remove(e); V.scene.primitives.remove(G.apNear.lights); G.apNear=null; }
  if(G.tm){ if(G.tm.auto&&G.tm.prev&&S.speed!==G.tm.prev){ S.speed=G.tm.prev; if(typeof renderTop==='function') renderTop(); } G.tm=null; }
}
Object.assign(ACTIONS,{
  globeTime:d=>{ if(!G||!G.tm) return; if(d.k==='auto'){ G.tm.auto=true; } else { G.tm.auto=false; S.speed=d.k; S.paused=false; if(typeof renderTop==='function') renderTop(); } renderGlobeHud(); },
});
