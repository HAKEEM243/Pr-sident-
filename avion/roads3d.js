/* =========================================================
   Sky Empire — vue 3D : vraies routes et voitures qui roulent,
   plus une mini-carte réglable pour savoir où l'on est.
   Routes : OpenStreetMap (Overpass, sans clé), chargées seulement
   près du sol, autour de la caméra. Voitures : modèles très simples,
   en nombre limité (moins en qualité Minimal).
   ========================================================= */
'use strict';
const RD={cells:new Map(), busy:false, fail:0, cars:[], roads:[], paths:[], viewer:null, last:0, models:null};
const RD_CELL=0.05, RD_KIND={motorway:[24,'#2b2e33',31],trunk:[20,'#30343a',25],primary:[15,'#3a3e44',17],secondary:[11,'#464a50',14],tertiary:[8,'#53575c',11]};   // asphalte (plus sombre = plus grande route)
const RD_EP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.nextgis.com/api/interpreter'];
const RD_COLORS=['#f8fafc','#111827','#9ca3af','#b91c1c','#1d4ed8','#e5e7eb','#78716c','#facc15','#065f46'];
// voitures : carrosserie, vitres, phares, feux arrière, roues (longueur sur z : avant en +z)
const M_CAR=c=>()=>{ const k=C3(c), gl=C3('#1f2a3a'), w=C3('#0b0f17'), hl=C3('#fff7d6'), tl=C3('#dc2626'), ch=C3('#cbd5e1');
  return [[-0.92,0.92,0.35,0.95,-2.25,2.25,k],[-0.82,0.82,0.95,1.48,-1.25,0.95,k],[-0.84,0.84,1.0,1.42,-1.15,0.85,gl],[-0.83,0.83,1.48,1.52,-1.2,0.9,k],
    [-0.8,-0.45,0.62,0.82,2.25,2.3,hl],[0.45,0.8,0.62,0.82,2.25,2.3,hl],[-0.82,-0.5,0.62,0.82,-2.3,-2.25,tl],[0.5,0.82,0.62,0.82,-2.3,-2.25,tl],[-0.6,0.6,0.38,0.48,2.25,2.3,ch],
    [-0.98,-0.72,0,0.66,1.15,1.75,w],[0.72,0.98,0,0.66,1.15,1.75,w],[-0.98,-0.72,0,0.66,-1.75,-1.15,w],[0.72,0.98,0,0.66,-1.75,-1.15,w]]; };
const M_BUS=()=>{ const k=C3('#eab308'), g=C3('#1f2a3a'), w=C3('#0b0f17'), hl=C3('#fff7d6');
  return [[-1.25,1.25,0.45,3.1,-5.6,5.6,k],[-1.27,1.27,1.6,2.6,-5.2,4.6,g],[-1.2,1.2,1.4,2.8,5.6,5.65,g],[-1.0,-0.6,0.7,0.95,5.6,5.66,hl],[0.6,1.0,0.7,0.95,5.6,5.66,hl],[-1.2,1.2,3.1,3.25,-5.4,5.4,C3('#f8fafc')],
    [-1.32,-1.0,0,0.9,3.2,4.1,w],[1.0,1.32,0,0.9,3.2,4.1,w],[-1.32,-1.0,0,0.9,-4.1,-3.2,w],[1.0,1.32,0,0.9,-4.1,-3.2,w]]; };
const M_TRUCK=()=>{ const cab=C3('#1d4ed8'), box=C3('#e5e7eb'), g=C3('#1f2a3a'), w=C3('#0b0f17');
  return [[-1.2,1.2,0.5,2.7,2.6,4.6,cab],[-1.15,1.15,1.7,2.4,4.6,4.65,g],[-1.25,1.25,0.6,3.6,-4.6,2.4,box],[-1.3,-1.0,0,0.95,3.2,4.0,w],[1.0,1.3,0,0.95,3.2,4.0,w],[-1.3,-1.0,0,0.95,-3.8,-2.6,w],[1.0,1.3,0,0.95,-3.8,-2.6,w]]; };


function rdOn(){ return typeof G!=='undefined'&&G&&G.viewer&&!document.getElementById('globe').hidden&&!window.SE_SAFE; }
function rdCam(){ const c=G.viewer.camera.positionCartographic; return {lat:Cesium.Math.toDegrees(c.latitude), lon:Cesium.Math.toDegrees(c.longitude), h:c.height}; }
// point du sol au centre de l'écran (là où l'on regarde), sinon sous la caméra
function rdView(cam){ try{ const V=G.viewer, cv=V.scene.canvas, p=V.camera.pickEllipsoid(new Cesium.Cartesian2(cv.clientWidth/2,cv.clientHeight*0.6)); if(p){ const c=Cesium.Cartographic.fromCartesian(p), lat=Cesium.Math.toDegrees(c.latitude), lon=Cesium.Math.toDegrees(c.longitude); if(gcDist({lat,lon},cam)<25) return {lat,lon}; } }catch(e){} return {lat:cam.lat,lon:cam.lon}; }
const RD_MAJ=0.4;
function rdTick(){
  if(!rdOn()) return;
  if(RD.viewer!==G.viewer){ rdReset(); RD.viewer=G.viewer; G.viewer.scene.preRender.addEventListener(rdFrame); }
  const cam=rdCam(), ground=typeof groundAt==='function'?groundAt(cam.lat,cam.lon):0, agl=cam.h-ground;
  try{ minimapUpdate(cam); }catch(e){}
  try{ cityRingTick(cam,agl); }catch(e){ console.warn(e); }
  if(agl>9000||G.tiles){ for(const r of RD.roads) r.show=false; for(const c of RD.cars) c.e.show=false; return; }
  for(const r of RD.roads) r.show=true;
  const v=rdView(cam);
  try{ rdCars(v,agl); }catch(e){ console.warn(e); }
  if(RD.busy||RD.fail>=4) return;
  // 1) grandes routes (autoroutes, nationales) sur ~45 km autour : elles partent loin
  const mi=Math.floor(v.lat/RD_MAJ), mj=Math.floor(v.lon/RD_MAJ), mk='M'+mi+','+mj;
  if(!RD.cells.has(mk)) return rdLoad(mk,mi*RD_MAJ,mj*RD_MAJ,(mi+1)*RD_MAJ,(mj+1)*RD_MAJ,'motorway|trunk|primary',GQ.mini?250:500,true);
  if(agl>4000) return;
  // 2) toutes les routes de quartier, sur plusieurs cases autour du point regardé
  const R=GQ.mini?0:1, ci=Math.floor(v.lat/RD_CELL), cj=Math.floor(v.lon/RD_CELL), want=[];
  for(let di=-R;di<=R;di++) for(let dj=-R;dj<=R;dj++) want.push([ci+di,cj+dj,di*di+dj*dj]);
  want.sort((x,y)=>x[2]-y[2]);
  for(const [i,j] of want){ const key=i+','+j; if(!RD.cells.has(key)) return rdLoad(key,i*RD_CELL,j*RD_CELL,(i+1)*RD_CELL,(j+1)*RD_CELL,'motorway|trunk|primary|secondary|tertiary',400,false); }
}
// bâtiments OpenStreetMap autour du point regardé (et plus seulement sous l'avion suivi) : une grande partie de la ville en 3D
function cityRingTick(cam,agl){
  if(typeof loadOsmCell!=='function'||typeof OSM_CELL==='undefined'||agl>6000||G.tiles) return;
  if(!G.osm) G.osm={cells:new Map(), busy:false, fail:0};
  const O=G.osm; const v0=rdView(cam);
  try{ if(typeof cityExtrasTick==='function') cityExtrasTick(v0,agl); }catch(e){ console.warn(e); }
  if(O.busy||O.fail>=4) return;
  // les deux rives du fleuve Congo (Kinshasa, Brazzaville) d'abord, en petites cases plus denses
  try{ if(riverPinTick(v0,cam)) return; }catch(e){ console.warn(e); }
  const v=v0, R=GQ.mini?1:GQ.mob&&!GQ.hq?1:2, cap=GQ.mini?4:GQ.mob&&!GQ.hq?6:14; G.osmCap=cap;
  const ci=Math.floor(v.lat/OSM_CELL), cj=Math.floor(v.lon/OSM_CELL), want=[];
  for(let di=-R;di<=R;di++) for(let dj=-R;dj<=R;dj++) want.push([ci+di,cj+dj,di*di+dj*dj]);
  want.sort((x,y)=>x[2]-y[2]);
  const c=want.slice(0,cap).find(([i,j])=>!O.cells.has(i+','+j)); if(!c) return;
  O.e0=typeof groundAt==='function'?groundAt(v.lat,v.lon):0;
  loadOsmCell(c[0],c[1]);
  // ménage : on retire les cases les plus éloignées du point regardé
  while(O.cells.size>cap){ let far=null, fd=-1; for(const k of O.cells.keys()){ const [i,j]=k.split(',').map(Number), d=(i-ci)**2+(j-cj)**2; if(d>fd){ fd=d; far=k; } }
    const prim=O.cells.get(far); if(prim&&prim.destroy) G.viewer.scene.primitives.remove(prim); O.cells.delete(far); if(fd<=R*R*2) break; }
}
// rives du fleuve : [nom, sud, ouest, nord, est, bâtiments max par case (ordinateur)]
const RIVER_PIN=[['Kinshasa',-4.335,15.250,-4.295,15.365,2200],['Brazzaville',-4.290,15.230,-4.250,15.295,800]], PIN_CELL=0.03;
function pinCells(){ const out=[]; for(const [city,s0,w0,n0,e0,lim] of RIVER_PIN){ for(let i=Math.floor(s0/PIN_CELL);i<=Math.floor(n0/PIN_CELL);i++) for(let j=Math.floor(w0/PIN_CELL);j<=Math.floor(e0/PIN_CELL);j++){
    const s=Math.max(s0,i*PIN_CELL), w=Math.max(w0,j*PIN_CELL), n=Math.min(n0,(i+1)*PIN_CELL), e=Math.min(e0,(j+1)*PIN_CELL); if(n<=s||e<=w) continue; out.push({key:'P'+city[0]+i+','+j,city,s,w,n,e,lim}); } }
  return out; }
// les bâtiments déjà chargés sur les rives ne sont pas redessinés par les grandes cases autour (pas de doublons)
function osmSkip(lat,lon){ const P=G&&G.osmPin; if(!P) return false; for(const c of P.values()) if(c&&c.ok&&lat>=c.s&&lat<c.n&&lon>=c.w&&lon<c.e) return true; return false; }
function riverPinTick(v,cam){
  const near=gcDist(v,{lat:-4.30,lon:15.30})<35&&cam.h<12000; if(!G.osmPin) G.osmPin=new Map();
  if(!near){ if(G.osmPin.size){ for(const st of G.osmPin.values()) if(st&&st.prim) G.viewer.scene.primitives.remove(st.prim); G.osmPin.clear(); } return false; }
  if(GQ.mini&&gcDist(v,{lat:-4.31,lon:15.31})>12) return false;
  let cells=pinCells(); if(GQ.mini) cells=cells.filter(c=>c.city==='Kinshasa'&&c.w>=15.28&&c.e<=15.33);
  cells.sort((a,b)=>gcDist(v,{lat:(a.s+a.n)/2,lon:(a.w+a.e)/2})-gcDist(v,{lat:(b.s+b.n)/2,lon:(b.w+b.e)/2}));
  const c=cells.find(x=>!G.osmPin.has(x.key)); if(!c) return false;
  const k=GQ.mini?0.4:GQ.mob&&!GQ.hq?0.55:1, lim=Math.round(c.lim*k);
  G.osmPin.set(c.key,{s:c.s,w:c.w,n:c.n,e:c.e,ok:false}); pinLoad(c,lim); return true;
}
async function pinLoad(c,lim){
  const O=G.osm; O.busy=true;
  const q=`[out:json][timeout:25];way["building"](${c.s.toFixed(4)},${c.w.toFixed(4)},${c.n.toFixed(4)},${c.e.toFixed(4)});out geom ${lim};`;
  let js=null;
  for(const ep of (typeof OSM_EP!=='undefined'?OSM_EP:RD_EP)){ try{ const r=await fetch(ep,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'}}); if(r.ok){ js=await r.json(); break; } }catch(err){} }
  O.busy=false;
  if(!js){ O.fail++; G.osmPin.delete(c.key); return; }
  O.fail=0; if(!G||!G.viewer) return;
  const e0=typeof groundAt==='function'?groundAt((c.s+c.n)/2,(c.w+c.e)/2):0, gb=p=>{ if(typeof TERRAIN==='undefined'||!TERRAIN.on) return 0; const h=groundAt(p.lat,p.lon); return h>0?h:e0; };
  // un bâtiment n'appartient qu'à la case qui contient son premier point
  const els=(js.elements||[]).filter(el=>el.geometry&&el.geometry.length&&el.geometry[0].lat>=c.s&&el.geometry[0].lat<c.n&&el.geometry[0].lon>=c.w&&el.geometry[0].lon<c.e);
  let prim=null; try{ prim=typeof osmBuildCell==='function'?osmBuildCell(els,gb,true):null; }catch(e){ console.warn(e); }
  const st=G.osmPin.get(c.key); if(st){ st.prim=prim; st.ok=true; }
}
function rdReset(){ RD.cells.clear(); RD.roads=[]; RD.cars=[]; RD.paths=[]; RD.busy=false; RD.fail=0; }
async function rdLoad(key,s,w,n,e,kinds,limit,major){
  RD.cells.set(key,{prims:[],cars:[],major,s,w,n,e}); RD.busy=true;
  const q=`[out:json][timeout:25];way["highway"~"^(${kinds})$"](${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)});out geom ${limit};`;
  let js=null;
  for(const ep of RD_EP){ try{ const r=await fetch(ep,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'}}); if(r.ok){ js=await r.json(); break; } }catch(err){} }
  RD.busy=false;
  if(!js){ RD.fail++; RD.cells.delete(key); return; }
  RD.fail=0; if(!rdOn()) return;
  const C=Cesium, V=G.viewer, cell=RD.cells.get(key); if(!cell) return;
  const inst=[], paths=[], marks=[], edges=[];
  for(const el of js.elements||[]){
    const g=el.geometry, hw=(el.tags||{}).highway, k=RD_KIND[hw]; if(!g||g.length<2||!k) continue;
    if(!major&&[...RD.cells.values()].some(c=>c.major&&g[0].lat>=c.s&&g[0].lat<=c.n&&g[0].lon>=c.w&&g[0].lon<=c.e)&&/motorway|trunk|primary/.test(hw)) continue;
    const P3=C.Cartesian3.fromDegreesArray(g.flatMap(p=>[p.lon,p.lat]));
    if(/motorway|trunk|primary|secondary/.test(hw)) try{ marks.push(new C.GeometryInstance({geometry:new C.GroundPolylineGeometry({positions:P3,width:hw==='secondary'?0.7:1.0})})); }catch(err){}   // ligne médiane
    if(/motorway|trunk/.test(hw)) try{ edges.push(new C.GeometryInstance({geometry:new C.GroundPolylineGeometry({positions:P3,width:k[0]+3}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString('#d6d3c8').withAlpha(0.9))}})); }catch(err){}   // accotements clairs
    try{ inst.push(new C.GeometryInstance({geometry:new C.GroundPolylineGeometry({positions:C.Cartesian3.fromDegreesArray(g.flatMap(p=>[p.lon,p.lat])),width:k[0]}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString(k[1]).withAlpha(0.85))}})); }catch(err){}
    // chemin pour les voitures : distances cumulées
    const pts=g.map(p=>({lat:p.lat,lon:p.lon})), cum=[0]; for(let x=1;x<pts.length;x++) cum.push(cum[x-1]+gcDist(pts[x-1],pts[x])*1000);
    if(cum[cum.length-1]>150) paths.push({pts,cum,len:cum[cum.length-1],v:k[2],oneway:(el.tags||{}).oneway==='yes'||el.tags.highway==='motorway'});
  }
  if(edges.length){ const pe=V.scene.primitives.add(new C.GroundPolylinePrimitive({geometryInstances:edges, appearance:new C.PolylineColorAppearance(), asynchronous:true})); cell.prims.push(pe); RD.roads.push(pe); }
  if(inst.length){ const prim=V.scene.primitives.add(new C.GroundPolylinePrimitive({geometryInstances:inst, appearance:new C.PolylineColorAppearance(), asynchronous:true})); cell.prims.push(prim);
  if(marks.length&&!GQ.mini){ const pm=V.scene.primitives.add(new C.GroundPolylinePrimitive({geometryInstances:marks, appearance:new C.PolylineMaterialAppearance({material:C.Material.fromType('PolylineDash',{color:C.Color.WHITE.withAlpha(0.85),dashLength:22})}), asynchronous:true})); cell.prims.push(pm); RD.roads.push(pm); } RD.roads.push(prim); }
  // chemins gardés pour les voitures (avec leur boîte englobante)
  for(const p of paths){ p.key=key; p.s=Math.min(...p.pts.map(q=>q.lat)); p.n=Math.max(...p.pts.map(q=>q.lat)); p.w=Math.min(...p.pts.map(q=>q.lon)); p.e=Math.max(...p.pts.map(q=>q.lon)); RD.paths.push(p); }
  // ménage : 6 cases au plus
  const capMinor=GQ.mini?2:GQ.mob&&!GQ.hq?6:10, minors=[...RD.cells.entries()].filter(([k,c])=>!c.major), majors=[...RD.cells.entries()].filter(([k,c])=>c.major);
  const evict=minors.length>capMinor?minors[0][0]:majors.length>2?majors[0][0]:null;
  if(evict){ const k0=evict, old=RD.cells.get(k0); RD.cells.delete(k0);
    if(old){ for(const pr of old.prims){ V.scene.primitives.remove(pr); RD.roads=RD.roads.filter(x=>x!==pr); } RD.paths=RD.paths.filter(p=>p.key!==k0); for(const c of RD.cars) if(c.p&&c.p.key===k0) c.p=null; } }
}
// parc de voitures fixe : celles qui sont loin du point regardé reviennent sur une route proche
function rdCars(v,agl){
  const C=Cesium, V=G.viewer, cap=GQ.mini?18:GQ.mob&&!GQ.hq?45:90, rad=Math.max(1.2,Math.min(4,agl/600));
  if(!RD.models){ RD.models=RD_COLORS.map((c,x)=>apModel('car2'+x,M_CAR(c))); RD.models.push(apModel('truck',M_TRUCK),apModel('bus2',M_BUS)); }
  const pad=rad/111, near=RD.paths.filter(p=>p.n>=v.lat-pad&&p.s<=v.lat+pad&&p.e>=v.lon-pad&&p.w<=v.lon+pad);
  while(RD.cars.length<cap&&near.length){ const rr=Math.random(), url=RD.models[rr<0.05?RD.models.length-1:rr<0.13?RD.models.length-2:Math.floor(Math.random()*(RD.models.length-2))];
    RD.cars.push({e:V.entities.add({position:C.Cartesian3.ZERO, show:false, model:{uri:url, scale:1.6, minimumPixelSize:16, maximumScale:40, distanceDisplayCondition:new C.DistanceDisplayCondition(0,9000)}}),p:null}); }
  if(!near.length) return;
  const wsum=near.reduce((t,p)=>t+p.v,0);   // plus de voitures sur les grandes routes
  for(const c of RD.cars){
    if(c.p&&c.lat!=null&&gcDist({lat:c.lat,lon:c.lon},v)<rad*1.3) continue;
    let r=Math.random()*wsum, p=near[0]; for(const q of near){ r-=q.v; if(r<=0){ p=q; break; } }
    let bi=0, bd=1e9; for(let x=0;x<p.pts.length;x++){ const d=Math.abs(p.pts[x].lat-v.lat)+Math.abs(p.pts[x].lon-v.lon); if(d<bd){ bd=d; bi=x; } }
    c.p=p; c.d=clamp(p.cum[bi]+(Math.random()-0.5)*rad*1400,0,p.len); c.dir=p.oneway||Math.random()<0.5?1:-1; c.v=p.v*(0.75+Math.random()*0.4); c.seg=1; c.gh=null; c.lat=p.pts[bi].lat; c.lon=p.pts[bi].lon; }
}
function rdFrame(){
  if(!RD.cars.length||!rdOn()) return;
  const now=performance.now(), dt=Math.min(0.2,(now-(RD.last||now))/1000); RD.last=now;
  const C=Cesium, k=(typeof SPEEDS!=='undefined'&&S&&SPEEDS[S.speed]&&S.speed!=='realiste')?2:1;   // les voitures roulent en temps réel (un peu plus vite quand le jeu accélère)
  for(const c of RD.cars){
    if(!c.p){ c.e.show=false; continue; } c.e.show=true;
    c.d+=c.dir*c.v*dt*k; if(c.d>c.p.len||c.d<0){ c.dir=-c.dir; c.d=clamp(c.d,0,c.p.len); }   // bout de la route : demi-tour
    const P=c.p, cum=P.cum; let x=c.seg||1; while(x<cum.length-1&&cum[x]<c.d) x++; while(x>1&&cum[x-1]>c.d) x--; c.seg=x;
    const a=P.pts[x-1], b=P.pts[x], f=(c.d-cum[x-1])/Math.max(0.01,cum[x]-cum[x-1]);
    const lat=a.lat+(b.lat-a.lat)*f, lon=a.lon+(b.lon-a.lon)*f, hd=bearing(a,b)+(c.dir<0?180:0), off=(P.oneway?2:3.2)/111320;
    const lt=lat+Math.cos(toRad(hd+90))*off, ln=lon+Math.sin(toRad(hd+90))*off/Math.max(0.2,Math.cos(toRad(lat)));
    if(c.gx!==x||c.gh==null){ c.gx=x; c.gh=typeof groundAt==='function'?groundAt(lt,ln):0; }   // hauteur du sol : une fois par tronçon
    c.lat=lt; c.lon=ln; const pos=C.Cartesian3.fromDegrees(ln,lt,c.gh+0.3);
    c.e.position=pos; c.e.orientation=C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(hd-90),0,0));
  }
}

/* ---------- mini-carte réglable ---------- */
const MM={map:null, mk:null, size:null, zoomed:null};
function mmSize(){ if(MM.size) return MM.size; try{ MM.size=localStorage.getItem('se-mm')||'m'; }catch(e){ MM.size='m'; } return MM.size; }
function minimapInit(){
  if(MM.map||typeof L==='undefined') return; const host=document.getElementById('globe'); if(!host) return;
  const box=document.createElement('div'); box.id='minimap'; box.innerHTML=`<div id="mmMap"></div><div class="mmbar"><button data-mm="size" title="Taille">⤢</button><button data-mm="in">+</button><button data-mm="out">−</button><button data-mm="auto" title="Zoom automatique">🎯</button><button data-mm="hide" title="Masquer">×</button></div><button id="mmShow" hidden>🗺️</button>`;
  host.appendChild(box); box.className='mm-'+(mmSize()==='off'?'m':mmSize());
  MM.map=L.map('mmMap',{zoomControl:false,attributionControl:false,dragging:true,scrollWheelZoom:true,doubleClickZoom:false,keyboard:false}).setView([0,0],11);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18}).addTo(MM.map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,opacity:0.9}).addTo(MM.map);
  MM.mk=L.marker([0,0],{icon:L.divIcon({className:'mm-me',html:'<div class="mm-arrow">➤</div>',iconSize:[26,26],iconAnchor:[13,13]}),interactive:false}).addTo(MM.map);
  MM.cone=L.polygon([[0,0],[0,0],[0,0]],{color:'#ffd60a',weight:1,fillOpacity:0.18,interactive:false}).addTo(MM.map);
  // toucher la mini-carte : la caméra s'y rend (hors poursuite d'un avion)
  MM.map.on('click',e=>{ if(!G||!G.viewer||G.follow) return; const c=rdCam(); G.viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(e.latlng.lng,e.latlng.lat,Math.max(800,c.h)),orientation:{heading:G.viewer.camera.heading,pitch:G.viewer.camera.pitch,roll:0},duration:1.2}); });
  MM.map.on('zoomstart',()=>{ if(!MM.auto) MM.userZoom=true; });
  box.addEventListener('click',ev=>{ const b=ev.target.closest('[data-mm]'); if(!b) return; ev.stopPropagation(); const k=b.dataset.mm;
    if(k==='size'){ MM.size={s:'m',m:'l',l:'s'}[mmSize()]; try{ localStorage.setItem('se-mm',MM.size); }catch(e){} mmApply(); }
    if(k==='auto') MM.userZoom=false; if(k==='in') MM.map.zoomIn(); if(k==='out') MM.map.zoomOut();
    if(k==='hide'){ MM.size='off'; try{ localStorage.setItem('se-mm','off'); }catch(e){} mmApply(); } });
  box.querySelector('#mmShow').onclick=ev=>{ ev.stopPropagation(); MM.size='m'; try{ localStorage.setItem('se-mm','m'); }catch(e){} mmApply(); };
  mmApply();
}
function mmApply(){ const box=document.getElementById('minimap'); if(!box) return; const sz=mmSize(), off=sz==='off';
  box.className='mm-'+sz; box.querySelector('#mmMap').hidden=off; box.querySelector('.mmbar').hidden=off; box.querySelector('#mmShow').hidden=!off;
  setTimeout(()=>{ try{ MM.map.invalidateSize({pan:false}); if(G&&G.viewer){ const c=rdCam(); MM.map.setView([c.lat,c.lon],MM.map.getZoom(),{animate:false}); } }catch(e){} },50); }
function minimapUpdate(cam){
  minimapInit(); if(!MM.map||mmSize()==='off') return;
  const hd=Cesium.Math.toDegrees(G.viewer.camera.heading), ll=[cam.lat,cam.lon];
  // zoom automatique selon l'altitude, tant que le joueur n'a pas zoomé lui-même
  const z=Math.max(4,Math.min(16,Math.round(17-Math.log2(Math.max(200,cam.h)/120))));
  MM.auto=true; try{ if(!MM.userZoom) MM.map.setView(ll,z,{animate:false}); else MM.map.panTo(ll,{animate:false}); } finally{ MM.auto=false; }
  MM.mk.setLatLng(ll); const el=MM.mk.getElement(); if(el){ const a=el.querySelector('.mm-arrow'); if(a) a.style.transform=`rotate(${hd-90}deg)`; }
  // cône de vue de la caméra
  const R=Math.max(0.3,cam.h/1000*1.6), p1=destPt(cam.lat,cam.lon,hd-30,R), p2=destPt(cam.lat,cam.lon,hd+30,R);
  MM.cone.setLatLngs([ll,[p1.lat,p1.lon],[p2.lat,p2.lon]]);
}
setInterval(()=>{ try{ rdTick(); }catch(e){ console.warn(e); } },1000);
