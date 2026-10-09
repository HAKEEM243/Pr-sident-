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
const liveryOf=ac=>S.company.color;
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
function initGlobe(){
  const C=Cesium; C.Ion.defaultAccessToken='';
  const esriImg=new C.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maximumLevel:19, credit:'Imagerie © Esri, Maxar, Earthstar Geographics'});
  const viewer=new C.Viewer('globe',{ baseLayer:new C.ImageryLayer(esriImg), baseLayerPicker:false, geocoder:false, homeButton:false, sceneModePicker:false,
    navigationHelpButton:false, animation:false, timeline:false, fullscreenButton:false, infoBox:false, selectionIndicator:false, msaaSamples:4 });
  viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', maximumLevel:18}));
  const sc=viewer.scene;
  sc.globe.enableLighting=true; sc.globe.dynamicAtmosphereLighting=true; sc.skyAtmosphere.show=true; sc.fog.enabled=true; sc.fog.density=0.00012;
  sc.globe.depthTestAgainstTerrain=false; sc.highDynamicRange=false; sc.globe.maximumScreenSpaceError=1.6;
  viewer.clock.shouldAnimate=false;
  G={viewer, planes:new Map(), rivals:[], routes:[], airports:[], follow:null, cam:{mode:'chase',h:0,p:-9,range:120}, lighting:true, tiles:null, simAt:performance.now(), simTime:S.time, att:new Map(), trail:[], hudAt:0};
  // clic sur un avion
  const h=new C.ScreenSpaceEventHandler(sc.canvas);
  h.setInputAction(e=>{ if(G.follow) return; const p=sc.pick(e.position); const id=p&&p.id&&p.id._acId; if(id){ selectPlane(id); renderGlobeHud(); } }, C.ScreenSpaceEventType.LEFT_CLICK);
  // caméra de poursuite : rotation au doigt / à la souris, zoom molette et pincement
  let drag=null;
  h.setInputAction(e=>{ if(G.follow) drag={x:e.position.x,y:e.position.y}; }, C.ScreenSpaceEventType.LEFT_DOWN);
  h.setInputAction(()=>{ drag=null; }, C.ScreenSpaceEventType.LEFT_UP);
  h.setInputAction(e=>{ if(!G.follow||!drag) return; const dx=e.endPosition.x-drag.x, dy=e.endPosition.y-drag.y; drag={x:e.endPosition.x,y:e.endPosition.y};
    if(G.cam.mode==='cockpit'){ G.cam.h+=dx*0.25; G.cam.p=clamp(G.cam.p-dy*0.2,-60,40); } else { G.cam.h-=dx*0.35; G.cam.p=clamp(G.cam.p-dy*0.25,-88,12); } }, C.ScreenSpaceEventType.MOUSE_MOVE);
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
  const h=Math.max(st.alt, mi.R+mi.gH+0.4);
  const pos=Cesium.Cartesian3.fromDegrees(st.lon, st.lat, h);
  const q=Cesium.Transforms.headingPitchRollQuaternion(pos, new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(st.hdg-90), Cesium.Math.toRadians(a.pitch), Cesium.Math.toRadians(a.bank)));
  return {pos,q,st,a,gear,mi,h};
}

/* ---------- synchronisation avec la simulation ---------- */
function globeSync(full){
  if(!G) return;
  const C=Cesium, V=G.viewer;
  V.clock.currentTime=C.JulianDate.fromDate(new Date(S.time));
  V.scene.globe.enableLighting=G.lighting;
  const seen=new Set();
  for(const ac of S.fleet){
    if(ac.status!=='flight'||!ac.flight) continue;
    seen.add(ac.id);
    if(G.planes.has(ac.id)) continue;
    const m=modelOf(ac), mi=modelInfo(m,liveryOf(ac));
    let pose=null, poseAt=-1;
    const P=()=>{ const now=performance.now(); if(now!==poseAt){ pose=acPose(ac); poseAt=now; } return pose; };
    const ent=V.entities.add({
      position:new C.CallbackProperty(()=>{ const p=P(); return p&&p.pos; },false),
      orientation:new C.CallbackProperty(()=>{ const p=P(); return p&&p.q; },false),
      model:{uri:mi.uri, scale:1, minimumPixelSize:54, maximumScale:20000, runAnimations:false,
        nodeTransformations:new C.PropertyBag({gear:new C.CallbackProperty(()=>{ const p=P(); const s=p&&p.gear?1:0.001; return new C.TranslationRotationScale(C.Cartesian3.ZERO,C.Quaternion.IDENTITY,new C.Cartesian3(s,s,s)); },false)})},
      label:{text:`${S.company.code}${flightNumber(ac)} · ${m.name}`, font:'600 13px system-ui', fillColor:C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new C.Cartesian2(0,-38), distanceDisplayCondition:new C.DistanceDisplayCondition(2500,4e6), scale:0.9},
    });
    ent._acId=ac.id; G.planes.set(ac.id,ent);
  }
  for(const [id,ent] of G.planes) if(!seen.has(id)){ V.entities.remove(ent); G.planes.delete(id); G.att.delete(id); if(G.follow===id){ globeFollow(null); toast('🛬 L’avion suivi est arrivé à destination','ok'); } }
  if(full || (G.netKey!==netKey())){ drawGlobeNetwork(); }
  if(full || !G.rivAt || performance.now()-G.rivAt>3000){ G.rivAt=performance.now(); drawGlobeRivals(); }
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
  const list=[]; for(const R of S.rivals||[]) for(const r of R.routes) list.push({R,r});
  // autour de l'avion suivi : le trafic réel des aéroports proches
  if(G.follow&&typeof visibleRealRoutes==='function'){ const ac=S.fleet.find(a=>a.id===G.follow), st=ac&&flightState(ac,t);
    if(st){ const b=L.latLngBounds([st.lat-6,st.lon-8],[st.lat+6,st.lon+8]); list.unshift(...visibleRealRoutes(b,st.lon,15)); } }
  for(const {R,r} of list){
    if(n>=70) return;
    const q=typeof rivalPos==='function'? rivalPos(r,0,t) : null; if(!q) continue;
    const pos=C.Cartesian3.fromDegrees(q.p.lon,q.p.lat,q.d<1200?6500:10800);
    const cat=q.d<1200?'prop':q.d<5000?'nb':'wb', mi=modelInfo(getModel(REP_MODEL[cat])||{id:'A20N',seats:180,cargo:0,fam:'A320'},R.color);
    G.rivals.push(V.entities.add({position:pos, orientation:C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(q.hdg-90),0,0)),
      model:{uri:mi.uri, scale:1, minimumPixelSize:26, maximumScale:20000},
      label:{text:R.name, font:'600 11px system-ui', fillColor:C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new C.Cartesian2(0,-24), distanceDisplayCondition:new C.DistanceDisplayCondition(0,60000), scale:0.85}}));
    n++;
  }
}

/* ---------- caméra façon simulateur ---------- */
const CAM_MODES={chase:{h:0,p:-9,k:3.2,label:'🎥 Arrière'}, side:{h:-90,p:-4,k:3.5,label:'↔ Côté'}, front:{h:180,p:-6,k:2.8,label:'↩ Avant'}, top:{h:0,p:-62,k:4,label:'⬇ Dessus'}, tower:{h:35,p:-14,k:9,label:'🗼 Loin'}, cockpit:{h:0,p:-4,k:0,label:'🧑‍✈️ Cockpit'}};
function setCam(mode){
  const M=CAM_MODES[mode]||CAM_MODES.chase, ac=S.fleet.find(a=>a.id===G.follow), mi=ac&&modelInfo(modelOf(ac),liveryOf(ac));
  G.cam={mode, h:M.h, p:M.p, range:mi? Math.max(30,mi.L*M.k) : 120};
  if(mode!=='cockpit') G.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  for(const [id,e] of G.planes) e.show=!(mode==='cockpit'&&id===G.follow);
  renderGlobeHud();
}
function globeFollowTick(){
  if(!G||!G.follow||$('#globe').hidden) return;
  const ac=S.fleet.find(a=>a.id===G.follow); if(!ac) return;
  const p=acPose(ac); if(!p) return;
  const C=Cesium, cam=G.viewer.camera, c=G.cam;
  if(c.mode==='cockpit'){
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
  if(now-G.hudAt>120){ G.hudAt=now; renderRfsHud(ac,p); }
}
function spawnClouds(c){
  const C=Cesium; G.clouds.removeAll();
  const wet=(typeof stormAt==='function'&&stormAt(c.lat,c.lon))?1.6:1;
  for(let i=0;i<Math.round(34*wet);i++){
    const d=rnd(2,70), b=rnd(0,360), q=destPt(c.lat,c.lon,b,d), alt=rnd(900,3400);
    G.clouds.add({position:C.Cartesian3.fromDegrees(q.lon,q.lat,alt), scale:new C.Cartesian2(rnd(1200,3200),rnd(500,1100)), maximumSize:new C.Cartesian3(rnd(30,60),rnd(14,26),rnd(18,30)), slice:rnd(0.3,0.7), brightness:rnd(0.85,1)});
  }
}
function globeFollow(id){
  if(!G) return;
  const C=Cesium, sc=G.viewer.scene;
  if(!id){ for(const e of G.planes.values()) e.show=true; G.follow=null; G.viewer.camera.lookAtTransform(C.Matrix4.IDENTITY); sc.screenSpaceCameraController.enableInputs=true; G.trail=[]; if(G.trailEnt){ G.viewer.entities.remove(G.trailEnt); G.trailEnt=null; } if(G.clouds) G.clouds.removeAll(); G.cloudC=null; const hd=$('#rfsHud'); if(hd) hd.hidden=true; document.body.classList.remove('globe-follow'); setTimeout(()=>G&&G.viewer.resize(),30); renderGlobeHud(); return; }
  G.follow=id; sc.screenSpaceCameraController.enableInputs=false; document.body.classList.add('globe-follow'); setTimeout(()=>G&&G.viewer.resize(),30); setCam('chase');
  if(!G.trailEnt) G.trailEnt=G.viewer.entities.add({polyline:{positions:new C.CallbackProperty(()=>G.trail.length>1?G.trail:[],false), width:4, material:C.Color.WHITE.withAlpha(0.45)}});
  if(SPEEDS[S.speed].mult>60) toast('💡 En vitesse « Réaliste » ou « Standard », le vol est bien plus spectaculaire','info');
  renderGlobeHud();
}

/* ---------- HUD de vol (façon simulateur) ---------- */
function renderRfsHud(ac,p){
  let hud=$('#rfsHud'); if(!hud){ hud=document.createElement('div'); hud.id='rfsHud'; $('#globe').parentNode.appendChild(hud); }
  hud.hidden=false;
  const st=p.st, m=modelOf(ac), altFt=Math.round(st.alt*3.28084), tas=st.spd, ias=tas/(1+st.alt/1000*0.065), kts=Math.round(ias/1.852);
  const a=1225-Math.min(11000,st.alt)*0.0185, mach=tas/a, gs=Math.round((st.gs||tas)/1.852);
  const oat=Math.round(Math.max(-56.5,15-6.5*st.alt/1000));
  const ap=AP(st.to), agl=Math.max(0,Math.round(altFt-(ap&&ap.elev||0)*Math.min(1,st.frac>0.5?1:0)));
  const w=st.wind||0, wdir=Math.round((st.hdg+(w>0?180:0)+360)%360), wk=Math.round(Math.abs(w)/1.852);
  const leg=st.leg, prof=legProfile(leg.dist,m,leg.wind,leg.from,leg.to), el=Math.max(0,gSimNow()-leg.dep), fuel0=m.burn*(prof.total/HOUR+1)*0.8, fuel=Math.max(0,fuel0-m.burn*Math.max(0,(el-prof.segs[2].t0)/HOUR)*0.8);
  const cap=m.burn*(m.range/m.speed+1)*0.8, fob=Math.round(fuel), fp=Math.round(clamp(fuel/cap*100,0,100));
  const ft=`${Math.floor(el/HOUR)}:${String(Math.floor(el%HOUR/MIN)).padStart(2,'0')} h`;
  const tape=(v,step,fmt)=>{ let s=''; const base=Math.round(v/step)*step; for(let i=-3;i<=3;i++){ const val=base+i*step; s+=`<div style="top:${50-(val-v)/step*14}%">${fmt(val)}—</div>`; } return s; };
  const hdg=Math.round((st.hdg+360)%360);
  const vs=Math.round(p.a.vs/100)*100;
  hud.innerHTML=`<div class="rf-top">${S.company.code}${flightNumber(ac)} · ${esc(m.name)} · ${esc(st.origin)} → ${esc(st.dest)}</div>
    <div class="rf-hdg">H ${String(hdg).padStart(3,'0')}</div><div class="rf-oat">OAT ${oat}°C · M ${mach.toFixed(2).replace('.',',')} · VS ${vs>0?'+':''}${vs} ft/min</div>
    <div class="rf-tape left">${tape(kts,10,v=>v)}<b>${kts}</b></div>
    <div class="rf-tape right">${tape(altFt,100,v=>v)}<b>${altFt}</b></div>
    <div class="rf-dest">${esc(ap?ap.icao||st.to:st.to)}<br>${(st.remain/1.852).toFixed(1).replace('.',',')} NM</div>
    <div class="rf-bar"><div><b>${wdir}/${wk}kts</b><span>Vent</span></div><div><b>${kts} kts</b><span>IAS (GS ${gs})</span></div><div><b>${altFt} ft</b><span>Altitude MSL</span></div><div><b>${agl} ft</b><span>Altitude AGL</span></div><div><b>${fp}% · ${num(fob*0.8)} kg</b><span>Carburant</span></div><div><b>${ft}</b><span>Temps de vol</span></div><div><b>${PHASES[st.phase]}</b><span>Phase</span></div></div>`;
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
      <span class="gh-tip">Glissez pour tourner autour de l’avion</span>`;
    return;
  }
  box.innerHTML=`<button class="gh" data-act="close3D">✖ Carte 2D</button>
    <button class="gh" data-act="globeFollow" ${flying.length?'':'disabled'}>🎥 Suivre un avion${!sel&&flying.length?' (au hasard)':''}</button>
    <button class="gh" data-act="globeHome">🏠 Mon hub</button>
    <button class="gh ${G.lighting?'on':''}" data-act="globeLight">🌗 Soleil</button>
    <button class="gh ${G.tiles?'on':''}" data-act="google3D">🏙️ Villes 3D Google</button>`;
}
Object.assign(ACTIONS,{
  open3D:()=>open3D(),
  close3D:()=>close3D(),
  view3D:async d=>{ const ok=await open3D(); if(!ok) return; const ac=S.fleet.find(a=>a.id===d.id&&a.status==='flight'); if(ac){ selectPlane(ac.id); globeSync(false); globeFollow(ac.id); } },
  globeFollow:()=>{ if(G.follow) return globeFollow(null); const sel=selectedPlane&&S.fleet.find(a=>a.id===selectedPlane&&a.status==='flight'); const ac=sel||pick(S.fleet.filter(a=>a.status==='flight')); if(ac){ selectPlane(ac.id); globeFollow(ac.id); } },
  globeNext:()=>{ const fl=S.fleet.filter(a=>a.status==='flight'); if(!fl.length) return; const i=fl.findIndex(a=>a.id===G.follow); const ac=fl[(i+1)%fl.length]; selectPlane(ac.id); globeFollow(ac.id); },
  globeCam:d=>setCam(d.k),
  globeZoom:d=>{ G.cam.range=clamp(G.cam.range*(+d.d),15,80000); },
  globeHome:()=>{ globeFollow(null); const a=AP(S.company.hub); G.viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(a.lon,a.lat-6,2.2e6), orientation:{heading:0,pitch:Cesium.Math.toRadians(-55),roll:0}, duration:2}); },
  globeLight:()=>{ G.lighting=!G.lighting; G.viewer.scene.globe.enableLighting=G.lighting; renderGlobeHud(); },
  google3D:()=>toggleGoogle3D(),
});
