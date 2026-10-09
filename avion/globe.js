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
const liveryOf=ac=>S.livery||S.company.color;
function modelInfo(m,color){ return AC3D.uri(m,color); }

/* ---------- ouverture / fermeture ---------- */
async function open3D(){
  toast('🌍 Chargement de la vue 3D…','info');
  try{ await loadCesium(); }catch(e){ toast('⛔ Impossible de charger le moteur 3D (connexion Internet ?)','bad'); return false; }
  if(UI.mobile) setTab('map');
  document.body.classList.add('globe-on'); $('#globe').hidden=false; $('#globeHud').hidden=false;
  if(!G) initGlobe(); else G.viewer.resize();
  globeSync(true);
  renderGlobeHud();
  return true;
}
function close3D(){
  globeFollow(null);
  document.body.classList.remove('globe-on'); $('#globe').hidden=true; $('#globeHud').hidden=true;
  const h=$('#rfsHud'); if(h) h.hidden=true;
  setTimeout(()=>map&&map.invalidateSize(),60);
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
const GQ=(()=>{ let v=null; try{ v=localStorage.getItem('se-q'); }catch(e){} const mob=/iphone|ipad|android|mobile/i.test(navigator.userAgent)||(window.matchMedia&&matchMedia('(pointer:coarse)').matches); return {hq: v? v==='h' : !mob, mob}; })();
function initGlobe(){
  const C=Cesium; C.Ion.defaultAccessToken=''; patchCesium(C);
  const esriImg=new C.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maximumLevel:19, credit:'Imagerie © Esri, Maxar, Earthstar Geographics'});
  const viewer=new C.Viewer('globe',{ baseLayer:new C.ImageryLayer(esriImg), baseLayerPicker:false, geocoder:false, homeButton:false, sceneModePicker:false,
    navigationHelpButton:false, animation:false, timeline:false, fullscreenButton:false, infoBox:false, selectionIndicator:false, msaaSamples:GQ.hq?4:1, orderIndependentTranslucency:!window.SE_NO_OIT });
  viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', maximumLevel:18}));
  // la nuit, les villes s'allument : images « Black Marble » de la NASA (GIBS, libres d'accès), affichées seulement du côté nuit du globe
  try{ const nl=viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png', maximumLevel:8, credit:'Lumières nocturnes : NASA Black Marble (GIBS)'}),1);
    nl.dayAlpha=0; nl.nightAlpha=1; nl.brightness=3.2; nl.contrast=1.15; }catch(e){}
  // nuit réaliste même près du sol (par défaut Cesium éclaire tout quand on est proche) ; relief ombré par le soleil le jour
  try{ const gl=viewer.scene.globe; gl.lightingFadeOutDistance=1; gl.lightingFadeInDistance=2; }catch(e){}
  const sc=viewer.scene;
  try{ const base=viewer.imageryLayers.get(0); base.saturation=1.32; base.contrast=1.12; base.brightness=1.04; base.gamma=1.04; }catch(e){}
  try{ sc.postProcessStages.fxaa.enabled=true; }catch(e){}
  try{ if(typeof TERRAIN!=='undefined'&&TERRAIN.on){ terrFlattenNetwork(); sc.globe.terrainProvider=terrainProvider(); sc.globe.depthTestAgainstTerrain=true; } }catch(e){ console.warn(e); }
  try{ sc.globe.showGroundAtmosphere=true; sc.globe.atmosphereLightIntensity=12; sc.skyAtmosphere.atmosphereLightIntensity=40; }catch(e){}
  // filet de sécurité : si le rendu plante, on retire les décors optionnels et on redémarre
  viewer.showRenderLoopErrors=false;
  sc.renderError.addEventListener((scene,err)=>{
    console.warn('rendu 3D',err); G.safe=(G.safe||0)+1;
    try{ if(G.clouds){ sc.primitives.remove(G.clouds); G.clouds=null; } }catch(e){}
    if(G.safe>=2){ try{ worldClear(); }catch(e){} G.noWorld=true; }
    if(G.safe<=4) setTimeout(()=>{ try{ viewer.useDefaultRenderLoop=true; }catch(e){} },300);
    else toast('⛔ La vue 3D rencontre un problème sur cet appareil','bad');
  });
  sc.globe.enableLighting=true; sc.globe.dynamicAtmosphereLighting=true; sc.skyAtmosphere.show=true; sc.fog.enabled=true; sc.fog.density=0.00012;
  sc.globe.depthTestAgainstTerrain=false; sc.highDynamicRange=false; sc.globe.maximumScreenSpaceError=GQ.hq?1.6:2.4;
  viewer.clock.shouldAnimate=false;
  G={viewer, planes:new Map(), rivals:[], routes:[], airports:[], follow:null, cam:{mode:'chase',h:0,p:-9,range:120}, lighting:true, tiles:null, simAt:performance.now(), simTime:S.time, att:new Map(), trail:[], hudAt:0, forceDay:(()=>{ try{ return localStorage.getItem('se-day')==='1'; }catch(e){ return false; } })()};
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
  if(key && localStorage.getItem('cst-3dtiles')==='1') toggleGoogle3D(true);
  G.loop=setInterval(()=>{ if(!$('#globe').hidden) globeSync(false); },1000);
  sc.preRender.addEventListener(globeFollowTick);
  try{ G.clouds=sc.primitives.add(new C.CloudCollection({noiseDetail:16})); }catch(e){ G.clouds=null; }
}

/* ---------- temps et attitude ---------- */
function globeNoteSim(){ if(G){ G.simAt=performance.now(); G.simTime=S.time; } }
function gSimNow(){ if(!G||S.paused) return S.time; return G.simTime + Math.min(400,performance.now()-G.simAt)*SPEEDS[S.speed].mult; }
function attitude(ac,st,t){
  let a=G.att.get(ac.id); if(!a){ a={hdg:st.hdg,t,bank:0,pitch:0,alt:st.alt,vs:0}; G.att.set(ac.id,a); }
  const dtg=(t-a.t)/1000;
  if(dtg>0.05){
    const dh=((st.hdg-a.hdg+540)%360)-180, rate=dh/dtg;
    const ground=st.phase<=1||st.phase>=8||st.alt<3;
    const tb=ground?0:clamp(rate*9,-28,28);
    a.bank+=(tb-a.bank)*Math.min(1,dtg*0.6);
    const vs=(st.alt-a.alt)/dtg*196.85; a.vs+=(vs-a.vs)*Math.min(1,dtg*0.5);
    const tp = ground? (st.phase===2&&st.spd>220?8:0) : st.phase===2?9 : st.phase===3?7 : st.phase===4?2.2 : st.phase===5?-0.5 : st.phase===6?2.5 : st.alt<20?5:3;
    a.pitch+=(tp-a.pitch)*Math.min(1,dtg*0.4);
    a.hdg=st.hdg; a.t=t; a.alt=st.alt;
  }
  return a;
}
function acPose(ac){
  const t=gSimNow(), st=flightState(ac,t); if(!st) return null;
  const mi=modelInfo(modelOf(ac),liveryOf(ac)), a=attitude(ac,st,t);
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
  if(now-an.litAt>2500){ an.litAt=now; const el=(G&&G.viewer.scene.globe.enableLighting&&!G.forceDay&&typeof sunElevAt==='function')? sunElevAt(lat,lon) : 45;
    an.lit=el<-4; an.el=el; }
  an.gnd=gnd||ph<=1||ph>=8;
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
  let tv=S.time; if(G.forceDay){ const f=G.follow&&S.fleet.find(a=>a.id===G.follow), st=f&&flightState(f), lon=st?st.lon:(V.camera.positionCartographic?C.Math.toDegrees(V.camera.positionCartographic.longitude):0); tv=fxNoon(lon)+2*HOUR; }
  V.clock.currentTime=C.JulianDate.fromDate(new Date(tv));
  V.scene.globe.enableLighting=G.lighting;
  const seen=new Set();
  for(const ac of S.fleet){
    if(ac.status!=='flight'||!ac.flight) continue;
    seen.add(ac.id);
    if(G.planes.has(ac.id)) continue;
    const m=modelOf(ac), mi=modelInfo(m,liveryOf(ac));
    let pose=null, poseAt=-1; const an={}, nt={};
    const P=()=>{ const now=performance.now(); if(now!==poseAt){ pose=acPose(ac); poseAt=now; } return pose; };
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
    ent._acId=ac.id; G.planes.set(ac.id,ent);
  }
  for(const [id,ent] of G.planes) if(!seen.has(id)){ V.entities.remove(ent); G.planes.delete(id); G.att.delete(id); if(G.follow===id){ const nx=S.fleet.find(a=>a.status==='flight'&&a.flight&&a.id!==id); if(nx){ toast('🛬 Arrivé au parking ! On passe à un autre de vos vols en cours…','ok'); globeSync(false); globeFollow(nx.id); } else { globeFollow(null); toast('🛬 L’avion suivi est arrivé au parking','ok'); } } }
  if(full || (G.netKey!==netKey())){ drawGlobeNetwork(); }
  if(full || !G.rivAt || performance.now()-G.rivAt>20000){ G.rivAt=performance.now(); drawGlobeRivals(); }
}
const netKey=()=>S.routes.map(r=>r.id).join()+'|'+S.hubs.join()+'|'+S.company.color;
function drawGlobeNetwork(){
  const C=Cesium, V=G.viewer; G.netKey=netKey();
  for(const e of [...G.routes,...G.airports]) V.entities.remove(e); G.routes=[]; G.airports=[];
  const col=C.Color.fromCssColorString(S.company.color);
  for(const r of S.routes){
    const pts=r.stops.flatMap(c=>[AP(c).lon,AP(c).lat]);
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
  const list=[]; for(const R of S.rivals||[]) for(const r of R.routes){ if(!r.c) r.c=R.code; list.push({R,r}); }
  // autour de l'avion suivi : le trafic réel des aéroports proches
  if(G.follow&&typeof visibleRealRoutes==='function'){ const ac=S.fleet.find(a=>a.id===G.follow), st=ac&&flightState(ac,t);
    if(st){ const b=L.latLngBounds([st.lat-6,st.lon-8],[st.lat+6,st.lon+8]); list.unshift(...visibleRealRoutes(b,st.lon,15)); } }
  // les plus proches d'abord (roulage, décollages et atterrissages autour de vous)
  const fol=G.follow&&S.fleet.find(a=>a.id===G.follow), fst=fol&&flightState(fol,t);
  const cands=[]; for(const it of list.slice(0,600)){ const q=typeof rivalPos==='function'? rivalPos(it.r,0,t) : null; if(q) cands.push({...it,q,dd:fst?gcDist(q.p,fst):0}); }
  if(fst) cands.sort((x,y)=>x.dd-y.dd);
  for(const {R,r,q:q0} of cands){
    if(n>=(GQ.hq?60:22)) return;
    const mi=modelInfo(getModel(REP_MODEL[q0.cat]||'A20N')||{id:'A20N',seats:180,cargo:0,fam:'A320'},R.color);
    let q=q0, qAt=-1; const an={}, nt={};
    const Q=()=>{ const now=performance.now(); if(now!==qAt){ qAt=now; q=rivalPos(r,0,gSimNow())||q; } return q; };
    const posOf=()=>{ const v=Q(); const e=typeof gElev==='function'?gElev(gcDist(v.p,v.from)<gcDist(v.p,v.to)?v.from.code:v.to.code):0; return C.Cartesian3.fromDegrees(v.p.lon,v.p.lat,Math.max(v.alt||0,mi.R+mi.gH+0.4)+e); };
    const re=V.entities.add({position:new C.CallbackProperty(posOf,false),
      orientation:new C.CallbackProperty(()=>{ const v=Q(), pos=posOf(); const pitch=v.ph===2&&!v.gnd?8:v.ph===3?6:v.ph===6||v.ph===5?-2:0; return C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(v.hdg-90),C.Math.toRadians(pitch),0)); },false),
      model:{uri:mi.uri, scale:1, minimumPixelSize:26, maximumScale:20000, show:new C.CallbackProperty(()=>rivalVisible(posOf()),false)},
      label:{show:new C.CallbackProperty(()=>rivalVisible(posOf()),false), text:new C.CallbackProperty(()=>{ const v=Q(); return R.name+(v.ph===2?' · 🛫':v.ph===7?' · 🛬':''); },false), font:'600 11px system-ui', fillColor:C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new C.Cartesian2(0,-24), distanceDisplayCondition:new C.DistanceDisplayCondition(0,60000), scale:0.85}});
    const lo=acLight(an); re.model.lightColor=new C.CallbackProperty(()=>acLight(an,lo).c,false); re.model.imageBasedLightingFactor=new C.CallbackProperty(()=>lo.f,false);
    re.model.nodeTransformations=new C.CallbackProperty(()=>{ const v=Q(); acAnimate(an,mi,v.ph,v.alt||0,!!v.gnd,undefined,v.holding==='in',false,v.p.lat,v.p.lon); return AC3D.pose(mi,an,nt); },false);
    G.rivals.push(re); n++;
  }
}

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
function globeFollowTick(){
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
      G.tiles=await C.Cesium3DTileset.fromUrl(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`,{showCreditsOnScreen:true, maximumScreenSpaceError:12});
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
  if(G.follow){
    box.innerHTML=`<button class="gh" data-act="close3D">✖ Carte</button><button class="gh" data-act="globeFollow">🌍 Quitter la poursuite</button>
      ${Object.entries(CAM_MODES).map(([k,v])=>`<button class="gh ${G.cam.mode===k?'on':''}" data-act="globeCam" data-k="${k}">${v.label}</button>`).join('')}
      <button class="gh" data-act="globeZoom" data-d="0.7">🔍＋</button><button class="gh" data-act="globeZoom" data-d="1.4">🔍－</button>
      <button class="gh" data-act="globeNext">⏭ Avion suivant</button>
      <button class="gh ${typeof FX!=='undefined'&&FX.soundOn?'on':''}" data-act="globeSound">🔊 Son</button>
      <button class="gh ${G.forceDay?'on':''}" data-act="globeDay" title="Toujours en plein jour">☀️ Jour</button>
      <button class="gh ${typeof TERRAIN!=='undefined'&&TERRAIN.on?'on':''}" data-act="globeRelief" title="Relief réel (montagnes, vallées)">⛰️ Relief</button>
      <button class="gh" data-act="globeQ" title="Qualité graphique">⚙️ ${GQ.hq?'Haute':'Éco'}</button>
      <button class="gh" data-act="photo">📸 Photo</button>
      <button class="gh" data-act="radar">📡 Radar</button>
      <button class="gh ${typeof RADIO!=='undefined'&&RADIO.voice?'on':''}" data-act="radioVoice">🗣️ Voix</button>
      <button class="gh ${typeof FX!=='undefined'&&FX.forceRain?'on':''}" data-act="globeRain" title="Pluie et orage (sinon : selon la météo du jeu)">🌧️ Pluie</button>
      <span class="gh-sep"></span>
      <button class="gh ${G.tm&&G.tm.auto?'on':''}" data-act="globeTime" data-k="auto" title="Temps réel au décollage et à l’atterrissage, accéléré en croisière">🎬 Auto</button>
      ${TM_STEPS.map(([k,l])=>`<button class="gh ${G.tm&&!G.tm.auto&&S.speed===k?'on':''}" data-act="globeTime" data-k="${k}">${l}</button>`).join('')}
      <span class="gh-tip">Glissez pour tourner autour de l’avion · temps ×${SPEEDS[S.speed].mult}</span>`;
    return;
  }
  box.innerHTML=`<button class="gh" data-act="close3D">✖ Carte 2D</button>
    <button class="gh" data-act="globeFollow" ${flying.length?'':'disabled'}>🎥 Suivre un avion${!sel&&flying.length?' (au hasard)':''}</button>
    <button class="gh" data-act="globeHome">🏠 Mon hub</button>
    <button class="gh ${G.lighting?'on':''}" data-act="globeLight">🌗 Soleil</button>
    <button class="gh ${typeof TERRAIN!=='undefined'&&TERRAIN.on?'on':''}" data-act="globeRelief">⛰️ Relief</button>
    <button class="gh ${G.tiles?'on':''}" data-act="google3D">🏙️ Villes 3D Google</button>`;
}
Object.assign(ACTIONS,{
  open3D:()=>{ if(typeof fxAudioUnlock==='function') fxAudioUnlock(); return open3D(); },
  close3D:()=>close3D(),
  view3D:async d=>{ if(typeof fxAudioUnlock==='function') fxAudioUnlock(); const ok=await open3D(); if(!ok) return; const ac=S.fleet.find(a=>a.id===d.id&&a.status==='flight'); if(ac){ selectPlane(ac.id); globeSync(false); globeFollow(ac.id); } },
  globeFollow:()=>{ if(G.follow) return globeFollow(null); if(typeof fxAudioUnlock==='function') fxAudioUnlock(); const sel=selectedPlane&&S.fleet.find(a=>a.id===selectedPlane&&a.status==='flight'); const ac=sel||pick(S.fleet.filter(a=>a.status==='flight')); if(ac){ selectPlane(ac.id); globeFollow(ac.id); } },
  globeNext:()=>{ const fl=S.fleet.filter(a=>a.status==='flight'); if(!fl.length) return; const i=fl.findIndex(a=>a.id===G.follow); const ac=fl[(i+1)%fl.length]; selectPlane(ac.id); globeFollow(ac.id); },
  globeCam:d=>{ G.lastMode=d.k; setCam(d.k); },
  globeQ:()=>{ GQ.hq=!GQ.hq; try{ localStorage.setItem('se-q',GQ.hq?'h':'e'); }catch(e){} toast(GQ.hq?'⚙️ Qualité haute : ombres, plus de détails (plus lourd)':'⚙️ Mode éco : plus fluide sur téléphone','info'); if(G){ G.viewer.scene.globe.maximumScreenSpaceError=GQ.hq?1.6:2.4; G.rivAt=0; } renderGlobeHud(); },
  globeRelief:()=>{ TERRAIN.on=!TERRAIN.on; try{ localStorage.setItem('se-relief',TERRAIN.on?'1':'0'); }catch(e){} terrainApply(); toast(TERRAIN.on?'⛰️ Relief réel activé : montagnes, vallées et volcans':'Relief désactivé (terre plate, plus léger)','info'); renderGlobeHud(); },
  globeSound:()=>fxToggleSound(),
  globeRain:()=>{ FX.forceRain=!FX.forceRain; fxAudioUnlock(); renderGlobeHud(); },
  globeDay:()=>{ G.forceDay=!G.forceDay; try{ localStorage.setItem('se-day',G.forceDay?'1':'0'); }catch(e){} globeSync(false); renderGlobeHud(); },
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
const OSM_CELL=0.06, OSM_EP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
function osmTick(p){
  if(!G.osm) G.osm={cells:new Map(), busy:false, fail:0};
  const O=G.osm; if(O.busy||O.fail>=4||p.h>4500||G.tiles) return;
  const ci=Math.floor(p.st.lat/OSM_CELL), cj=Math.floor(p.st.lon/OSM_CELL);
  // la case sous l'avion, puis celle devant lui
  const ahead=destPt(p.st.lat,p.st.lon,p.st.hdg,4);
  const cand=[[ci,cj],[Math.floor(ahead.lat/OSM_CELL),Math.floor(ahead.lon/OSM_CELL)]];
  const c=cand.find(([i,j])=>!O.cells.has(i+','+j)); if(!c) return;
  O.e0=typeof gElev==='function'?gElev(p.st.frac<0.5?p.st.from:p.st.to):0;
  loadOsmCell(c[0],c[1]);
  // ménage : on garde les 8 cases les plus récentes
  if(O.cells.size>8){ const k=O.cells.keys().next().value, prim=O.cells.get(k); if(prim&&prim.destroy) G.viewer.scene.primitives.remove(prim); O.cells.delete(k); }
}
async function loadOsmCell(i,j){
  const O=G.osm, key=i+','+j; O.cells.set(key,null); O.busy=true;
  const s=i*OSM_CELL, w=j*OSM_CELL, n=s+OSM_CELL, e=w+OSM_CELL;
  const q=`[out:json][timeout:25];way["building"](${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)});out geom ${GQ.hq?5000:2200};`;
  let js=null;
  for(const ep of OSM_EP){ try{ const r=await fetch(ep,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'}}); if(r.ok){ js=await r.json(); break; } }catch(err){} }
  O.busy=false;
  if(!js){ O.fail++; O.cells.delete(key); return; }
  O.fail=0;
  if(!G||!js.elements||!js.elements.length) return;
  const e0=O.e0||0, gb=v=>{ if(typeof TERRAIN==='undefined'||!TERRAIN.on) return 0; const h=groundAt(v.lat,v.lon); return h>0?h:e0; };
  const C=Cesium, inst=[];
  for(const el of js.elements){
    const g=el.geometry; if(!g||g.length<4) continue;
    const t=el.tags||{}; let h=parseFloat(t.height)||(parseFloat(t['building:levels'])||0)*3.2;
    if(!h){ const b=t.building; h=b==='house'||b==='residential'||b==='detached'?6:b==='hangar'||b==='industrial'||b==='warehouse'?11:b==='terminal'||b==='transportation'?16:b==='apartments'?15:b==='commercial'||b==='office'?18:4+((el.id%7)); }
    h=Math.min(h,450);
    const pos=g.slice(0,-1).flatMap(v=>[v.lon,v.lat]);
    const shade=0.78+((el.id%13)/13)*0.16, tall=Math.min(1,h/80);
    const col=new C.Color(shade-0.1*tall,shade-0.06*tall,shade-0.02*tall+(t.building==='hangar'?0.05:0),1);
    try{ inst.push(new C.GeometryInstance({geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(pos)), height:gb(g[0])-1, extrudedHeight:gb(g[0])+h, vertexFormat:C.PerInstanceColorAppearance.VERTEX_FORMAT}), attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(col)}})); }catch(err){}
  }
  if(!inst.length) return;
  const prim=new C.Primitive({geometryInstances:inst, appearance:new C.PerInstanceColorAppearance({flat:false, closed:true}), asynchronous:true, shadows:C.ShadowMode.DISABLED});
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
  for(const [d,c,a] of near.filter(([d,c,a])=>d<90||a.cls>=3||S.hubs.includes(c)).slice(0,16)){
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
  if(G.apNear){ for(const e of G.apNear.ents) V.entities.remove(e); G.apNear.lights.removeAll(); for(const e of G.apNear.rwy) V.scene.primitives.remove(e); V.scene.primitives.remove(G.apNear.lights); G.apNear=null; }
  if(G.tm){ if(G.tm.auto&&G.tm.prev&&S.speed!==G.tm.prev){ S.speed=G.tm.prev; if(typeof renderTop==='function') renderTop(); } G.tm=null; }
}
Object.assign(ACTIONS,{
  globeTime:d=>{ if(!G||!G.tm) return; if(d.k==='auto'){ G.tm.auto=true; } else { G.tm.auto=false; S.speed=d.k; S.paused=false; if(typeof renderTop==='function') renderTop(); } renderGlobeHud(); },
});
