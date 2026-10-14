/* =========================================================
   Sky Empire — vue 3D : vraies routes et voitures qui roulent,
   plus une mini-carte réglable pour savoir où l'on est.
   Routes : OpenStreetMap (Overpass, sans clé), chargées seulement
   près du sol, autour de la caméra. Voitures : modèles très simples,
   en nombre limité (moins en qualité Minimal).
   ========================================================= */
'use strict';
const RD={cells:new Map(), busy:false, fail:0, cars:[], roads:[], viewer:null, last:0, models:null};
const RD_CELL=0.05, RD_KIND={motorway:[22,'#f59e0b',31],trunk:[18,'#fbbf24',25],primary:[14,'#e5e7eb',17],secondary:[11,'#d1d5db',14],tertiary:[8,'#cbd5e1',11]};
const RD_EP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
const RD_COLORS=['#f8fafc','#111827','#9ca3af','#b91c1c','#1d4ed8','#e5e7eb','#78716c','#facc15','#065f46'];
const M_CAR=c=>()=>{ const k=C3(c), g=C3('#1e293b'), w=C3('#0f172a'); return [[-0.9,0.9,0.3,1.0,-2.2,2.2,k],[-0.8,0.8,1.0,1.5,-1.1,1.0,g],[-0.95,-0.7,0,0.6,1.2,1.7,w],[0.7,0.95,0,0.6,1.2,1.7,w],[-0.95,-0.7,0,0.6,-1.7,-1.2,w],[0.7,0.95,0,0.6,-1.7,-1.2,w]]; };
const M_BUS=()=>{ const k=C3('#eab308'), g=C3('#1e293b'); return [[-1.25,1.25,0.4,3.0,-5.5,5.5,k],[-1.27,1.27,1.6,2.5,-5.3,5.3,g]]; };

function rdOn(){ return typeof G!=='undefined'&&G&&G.viewer&&!document.getElementById('globe').hidden&&!window.SE_SAFE; }
function rdCam(){ const c=G.viewer.camera.positionCartographic; return {lat:Cesium.Math.toDegrees(c.latitude), lon:Cesium.Math.toDegrees(c.longitude), h:c.height}; }
function rdTick(){
  if(!rdOn()) return;
  if(RD.viewer!==G.viewer){ rdReset(); RD.viewer=G.viewer; G.viewer.scene.preRender.addEventListener(rdFrame); }
  const cam=rdCam(), ground=typeof groundAt==='function'?groundAt(cam.lat,cam.lon):0, agl=cam.h-ground;
  try{ minimapUpdate(cam); }catch(e){}
  if(agl>6000||G.tiles){ for(const r of RD.roads) r.show=false; for(const c of RD.cars) c.e.show=false; return; }
  for(const r of RD.roads) r.show=true;
  if(RD.busy||RD.fail>=4) return;
  const i=Math.floor(cam.lat/RD_CELL), j=Math.floor(cam.lon/RD_CELL), key=i+','+j;
  if(!RD.cells.has(key)) rdLoad(i,j,key);
}
function rdReset(){ RD.cells.clear(); RD.roads=[]; RD.cars=[]; RD.busy=false; RD.fail=0; }
async function rdLoad(i,j,key){
  RD.cells.set(key,{prims:[],cars:[]}); RD.busy=true;
  const s=i*RD_CELL, w=j*RD_CELL, n=s+RD_CELL, e=w+RD_CELL;
  const q=`[out:json][timeout:20];way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)});out geom 400;`;
  let js=null;
  for(const ep of RD_EP){ try{ const r=await fetch(ep,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'}}); if(r.ok){ js=await r.json(); break; } }catch(err){} }
  RD.busy=false;
  if(!js){ RD.fail++; RD.cells.delete(key); return; }
  RD.fail=0; if(!rdOn()) return;
  const C=Cesium, V=G.viewer, cell=RD.cells.get(key); if(!cell) return;
  const inst=[], paths=[];
  for(const el of js.elements||[]){
    const g=el.geometry, k=RD_KIND[(el.tags||{}).highway]; if(!g||g.length<2||!k) continue;
    try{ inst.push(new C.GeometryInstance({geometry:new C.GroundPolylineGeometry({positions:C.Cartesian3.fromDegreesArray(g.flatMap(p=>[p.lon,p.lat])),width:k[0]}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString(k[1]).withAlpha(0.85))}})); }catch(err){}
    // chemin pour les voitures : distances cumulées
    const pts=g.map(p=>({lat:p.lat,lon:p.lon})), cum=[0]; for(let x=1;x<pts.length;x++) cum.push(cum[x-1]+gcDist(pts[x-1],pts[x])*1000);
    if(cum[cum.length-1]>150) paths.push({pts,cum,len:cum[cum.length-1],v:k[2],oneway:(el.tags||{}).oneway==='yes'||el.tags.highway==='motorway'});
  }
  if(inst.length){ const prim=V.scene.primitives.add(new C.GroundPolylinePrimitive({geometryInstances:inst, appearance:new C.PolylineColorAppearance(), asynchronous:true})); cell.prims.push(prim); RD.roads.push(prim); }
  // voitures : réparties selon la longueur des routes, nombre plafonné
  const cap=(GQ.mini?16:GQ.mob&&!GQ.hq?40:80), maxCars=Math.max(0,cap-RD.cars.length+Math.round(cap/3)), tot=paths.reduce((t,p)=>t+p.len,0);   // plafond pour toute la scène
  if(!RD.models){ RD.models=RD_COLORS.map((c,x)=>apModel('car'+x,M_CAR(c))); RD.models.push(apModel('bus',M_BUS)); }
  for(const p of paths){ const nC=Math.min(12,Math.round(maxCars*p.len/Math.max(1,tot))); for(let c=0;c<nC;c++){
      const dir=p.oneway||Math.random()<0.5?1:-1, url=RD.models[Math.random()<0.06?RD.models.length-1:Math.floor(Math.random()*(RD.models.length-1))];
      const ent=V.entities.add({position:C.Cartesian3.ZERO, model:{uri:url, minimumPixelSize:7, maximumScale:6, distanceDisplayCondition:new C.DistanceDisplayCondition(0,6000)}});
      const car={e:ent,p,d:Math.random()*p.len,dir,v:p.v*(0.75+Math.random()*0.4)}; cell.cars.push(car); RD.cars.push(car); } }
  // ménage : 6 cases au plus
  if(RD.cells.size>6){ const k0=RD.cells.keys().next().value, old=RD.cells.get(k0); RD.cells.delete(k0);
    if(old){ for(const pr of old.prims){ V.scene.primitives.remove(pr); RD.roads=RD.roads.filter(x=>x!==pr); } for(const c of old.cars){ V.entities.remove(c.e); } RD.cars=RD.cars.filter(c=>!old.cars.includes(c)); } }
}
function rdFrame(){
  if(!RD.cars.length||!rdOn()) return;
  const now=performance.now(), dt=Math.min(0.2,(now-(RD.last||now))/1000); RD.last=now;
  const C=Cesium, k=(typeof SPEEDS!=='undefined'&&S&&SPEEDS[S.speed]&&S.speed!=='realiste')?2:1;   // les voitures roulent en temps réel (un peu plus vite quand le jeu accélère)
  const cam=rdCam(), near=c=>Math.abs(c.p.pts[0].lat-cam.lat)<0.12&&Math.abs(c.p.pts[0].lon-cam.lon)<0.12;
  for(const c of RD.cars){
    if(!near(c)){ c.e.show=false; continue; } c.e.show=true;
    c.d+=c.dir*c.v*dt*k; if(c.d>c.p.len) c.d-=c.p.len; if(c.d<0) c.d+=c.p.len;
    const P=c.p, cum=P.cum; let x=c.seg||1; while(x<cum.length-1&&cum[x]<c.d) x++; while(x>1&&cum[x-1]>c.d) x--; c.seg=x;
    const a=P.pts[x-1], b=P.pts[x], f=(c.d-cum[x-1])/Math.max(0.01,cum[x]-cum[x-1]);
    const lat=a.lat+(b.lat-a.lat)*f, lon=a.lon+(b.lon-a.lon)*f, hd=bearing(a,b)+(c.dir<0?180:0), off=(P.oneway?2:3.2)/111320;
    const lt=lat+Math.cos(toRad(hd+90))*off, ln=lon+Math.sin(toRad(hd+90))*off/Math.max(0.2,Math.cos(toRad(lat)));
    if(c.gx!==x||c.gh==null){ c.gx=x; c.gh=typeof groundAt==='function'?groundAt(lt,ln):0; }   // hauteur du sol : une fois par tronçon
    const pos=C.Cartesian3.fromDegrees(ln,lt,c.gh+0.3);
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
