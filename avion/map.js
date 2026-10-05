/* ============================================================
   CARTE — Leaflet + imagerie satellite ESRI
   ============================================================ */
let map, L_airports, L_routes, L_planes, L_rival, L_night, L_drc;
const planeMarkers = new Map(); // id avion -> marker
const rivalMarkers = [];
const MAPOPT = { routes:true, airports:true, night:true, rival:true };
let selectedPlane = null, followPlane = false;
const parkedMarkers = new Map();

/* ---------- fonds de carte ---------- */
const MAPSTYLE_KEY='cst-map-style', GKEY='cst-google-key';
const ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/';
const esri=(path,opt={})=>L.tileLayer(ESRI+path+'/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,maxNativeZoom:opt.native||18,...opt});
const MAP_STYLES = {
  hybrid:{label:'🛰️ Satellite + routes & noms', desc:'Style Google Earth : imagerie satellite haute résolution, routes, villes et frontières.', make:()=>[
    esri('World_Imagery',{attribution:'Imagerie © Esri, Maxar, Earthstar Geographics'}),
    esri('Reference/World_Transportation',{opacity:0.9}),
    esri('Reference/World_Boundaries_and_Places')]},
  satellite:{label:'🛰️ Satellite pur', desc:'Imagerie seule, sans étiquettes.', make:()=>[esri('World_Imagery',{attribution:'Imagerie © Esri, Maxar, Earthstar Geographics'})]},
  plan:{label:'🗺️ Plan (OpenStreetMap)', desc:'Carte routière détaillée.', make:()=>[L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© les contributeurs d’OpenStreetMap'})]},
  relief:{label:'⛰️ Relief', desc:'Topographie (fleuves, montagnes, forêts).', make:()=>[esri('World_Topo_Map',{attribution:'© Esri, HERE, Garmin, USGS'})]},
  sombre:{label:'🌑 Sombre', desc:'Fond sobre pour mieux voir les avions.', make:()=>[L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd',attribution:'© OpenStreetMap, © CARTO'})]},
  google_sat:{label:'🌍 Google Maps — Satellite', google:'sat', desc:'Les vraies images Google Maps / Google Earth avec noms et routes (clé API Google requise).'},
  google_road:{label:'🌍 Google Maps — Plan', google:'road', desc:'Le plan Google Maps classique (clé API Google requise).'},
};
let baseLayers=[], currentStyle=null;
async function googleSession(kind){
  const key=localStorage.getItem(GKEY);
  if(!key) throw new Error('Aucune clé API Google enregistrée');
  const ck='cst-gsess-'+kind;
  let c=null; try{ c=JSON.parse(localStorage.getItem(ck)||'null'); }catch(e){}
  if(c && c.key===key && +c.expiry*1000>Date.now()+6*3600e3) return c;
  const body = kind==='road'? {mapType:'roadmap',language:'fr-FR',region:'CD'} : {mapType:'satellite',language:'fr-FR',region:'CD',layerTypes:['layerRoadmap']};
  const r=await fetch('https://tile.googleapis.com/v1/createSession?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok){ let m=''; try{ m=(await r.json()).error.message; }catch(e){} throw new Error(m||('Erreur Google '+r.status)); }
  const j=await r.json(); j.key=key; localStorage.setItem(ck,JSON.stringify(j)); return j;
}
async function setMapStyle(id, silent){
  const st=MAP_STYLES[id]||MAP_STYLES.hybrid;
  let layers;
  if(st.google){
    try{
      const sess=await googleSession(st.google), key=localStorage.getItem(GKEY);
      layers=[L.tileLayer(`https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${sess.session}&key=${encodeURIComponent(key)}`,{maxZoom:19,maxNativeZoom:st.google==='sat'?19:20,attribution:'Données cartographiques © Google'})];
    }catch(e){
      if(!silent && typeof toast==='function') toast('⛔ Google Maps : '+e.message+' — retour au satellite hybride','bad');
      id='hybrid'; layers=MAP_STYLES.hybrid.make();
    }
  } else layers=st.make();
  for(const l of baseLayers) map.removeLayer(l);
  baseLayers=layers; layers.forEach((l,i)=>{ l.addTo(map); l.setZIndex(i+1); });
  currentStyle=id; localStorage.setItem(MAPSTYLE_KEY,id);
  document.body.classList.toggle('google-map', !!MAP_STYLES[id].google);
  return id;
}

const PLANE_SVG = (color, size=26)=>`<svg viewBox="0 0 32 32" width="${size}" height="${size}"><path fill="${color}" stroke="#0b0f17" stroke-width="1.1" stroke-linejoin="round" d="M16 1.5c1.3 0 2.1 1.6 2.1 3.6v7.4l10.6 6.2v3l-10.6-3.2v6.3l3.2 2.5v2.4L16 28.3l-5.3 1.4v-2.4l3.2-2.5v-6.3L3.3 21.7v-3l10.6-6.2V5.1c0-2 .8-3.6 2.1-3.6z"/></svg>`;

function initMap(){
  map = L.map('map', { zoomControl:false, worldCopyJump:true, minZoom:2, maxZoom:19, attributionControl:true, preferCanvas:false })
    .setView([-3.5, 23.5], 5);
  L.control.zoom({position:'topleft'}).addTo(map);
  L.control.scale({position:'bottomleft', imperial:false}).addTo(map);
  setMapStyle(localStorage.getItem(MAPSTYLE_KEY)||'hybrid', true);

  map.createPane('night'); map.getPane('night').style.zIndex=350; map.getPane('night').style.pointerEvents='none';
  map.createPane('drc'); map.getPane('drc').style.zIndex=360; map.getPane('drc').style.pointerEvents='none';
  L_night = L.layerGroup().addTo(map);
  L_drc = L.layerGroup().addTo(map);
  L_routes = L.layerGroup().addTo(map);
  L_airports = L.layerGroup().addTo(map);
  L_rival = L.layerGroup().addTo(map);
  L_planes = L.layerGroup().addTo(map);

  // Frontière de la RDC, mise en valeur
  for(const off of [-360,0,360]){
    const ring = DRC_BORDER.map(([la,lo])=>[la,lo+off]);
    L.polygon(ring,{pane:'drc', color:'#f5c518', weight:2.5, opacity:0.95, fillColor:'#0a84ff', fillOpacity:0.06, dashArray:null}).addTo(L_drc);
  }
  drawAirports();
  drawRoutes();
  drawNight();
  map.on('click',()=>{ selectPlane(null); });
  map.on('zoomend',()=>drawAirports());
}

function airportStyle(a){
  const hub = a.code===S.company.hub;
  const closed = airportClosed(a.code);
  const color = closed? '#ff4d4f' : hub? '#ffd60a' : a.drc? '#34d399' : '#7dd3fc';
  const r = hub? 8 : [0,3.2,3.8,4.5,5.2,6][a.cls] + (a.drc?0.6:0);
  return {radius:r, color:'#0b0f17', weight:1.2, fillColor:color, fillOpacity:0.95};
}
function airportTip(a){
  const c=COUNTRIES[a.cc];
  return `<b>${c[2]} ${a.city} — ${a.code}</b>${a.icao?' / '+a.icao:''}<br>${a.name}`+
    (a.drc? `<br>Province : ${a.prov}`:`<br>${c[0]}`)+
    `<br>Piste ${a.runway} m · ${a.surface} · classe ${a.cls}`+
    (airportClosed(a.code)?'<br><b style="color:#ff6b6b">FERMÉ</b>':'');
}
function drawAirports(){
  if(!map) return;
  L_airports.clearLayers();
  if(!MAPOPT.airports) return;
  const z=map.getZoom();
  for(const code of AIRPORT_CODES){
    const a=AP(code);
    for(const off of [-360,0,360]){
      const mk=L.circleMarker([a.lat,a.lon+off], airportStyle(a));
      mk.bindTooltip(airportTip(a),{direction:'top',offset:[0,-4]});
      mk.on('click',(e)=>{ L.DomEvent.stopPropagation(e); openAirport(code); });
      mk.addTo(L_airports);
      if(off===0 && (z>=6 && a.drc || z>=7 || code===S.company.hub)){
        L.marker([a.lat,a.lon],{icon:L.divIcon({className:'ap-label'+(a.drc?' drc':''), html:a.city, iconSize:null, iconAnchor:[-7,7]}), interactive:false}).addTo(L_airports);
      }
    }
  }
}

function drawRoutes(){
  if(!map) return;
  L_routes.clearLayers();
  if(!MAPOPT.routes) return;
  for(const r of S.routes){
    const color = r.color || S.company.color;
    for(const off of [-360,0,360]){
      let ref=AP(r.stops[0]).lon;
      for(let i=0;i<r.stops.length-1;i++){
        const A=AP(r.stops[i]), B=AP(r.stops[i+1]);
        const pts=gcPath(A,B,ref).map(([la,lo])=>[la,lo+off]);
        ref=pts[pts.length-1][1]-off;
        L.polyline(pts,{color, weight:2.6, opacity:0.85, dashArray: r.stops.length>2?'7 6':null}).addTo(L_routes)
          .bindTooltip(`${r.stops.join(' → ')}`,{sticky:true});
      }
      r.stops.slice(1,-1).forEach(c=>{
        const a=AP(c);
        L.circleMarker([a.lat,a.lon+off],{radius:6,color:'#3b2a00',weight:1.5,fillColor:'#ffcc33',fillOpacity:1}).addTo(L_routes)
          .bindTooltip(`Escale : ${a.city} (${c})`);
      });
    }
  }
}

/* ---------- jour / nuit ---------- */
function sunPosition(t){
  const d=new Date(t);
  const start=Date.UTC(d.getUTCFullYear(),0,0);
  const doy=(t-start)/DAY;
  const decl=-23.44*Math.cos(2*Math.PI/365*(doy+10));
  const hours=d.getUTCHours()+d.getUTCMinutes()/60;
  const lon=-15*(hours-12);
  return {decl, lon};
}
function drawNight(){
  if(!map) return;
  L_night.clearLayers();
  if(!MAPOPT.night) return;
  const {decl,lon}=sunPosition(S.time);
  const tanD=Math.tan(toRad(decl||0.01));
  const pts=[];
  for(let x=-540;x<=540;x+=2){
    const lat=toDeg(Math.atan(-Math.cos(toRad(x-lon))/tanD));
    pts.push([lat,x]);
  }
  const pole = decl>0? -89.9 : 89.9;
  pts.push([pole,540],[pole,-540]);
  L.polygon(pts,{pane:'night',stroke:false,fillColor:'#000814',fillOpacity:0.38,interactive:false}).addTo(L_night);
}

/* ---------- avions ---------- */
function planeColor(ac){ const m=modelOf(ac); return m.color || S.company.color; }
function updatePlanes(){
  if(!map) return;
  const seen=new Set();
  for(const ac of S.fleet){
    if(ac.status!=='flight' || !ac.flight) continue;
    const st=flightState(ac); if(!st) continue;
    seen.add(ac.id);
    let mk=planeMarkers.get(ac.id);
    const pos=[st.lat,st.lon];
    if(!mk){
      const m=modelOf(ac);
      const size = m.seats>=300||m.cargo>=70? 30 : m.seats>=120||m.cargo>=20 ? 26 : 21;
      mk=L.marker(pos,{icon:L.divIcon({className:'plane-icon', html:`<div class="rot">${PLANE_SVG(planeColor(ac),size)}</div>`, iconSize:[size,size], iconAnchor:[size/2,size/2]}), zIndexOffset:1000});
      mk.bindTooltip('',{direction:'right',offset:[14,0],className:'flight-tip'});
      mk.on('tooltipopen',()=>{ const s2=flightState(ac); if(s2) mk.setTooltipContent(flightTipHtml(ac,s2)); });
      mk.on('click',(e)=>{ L.DomEvent.stopPropagation(e); selectPlane(ac.id); });
      mk.addTo(L_planes); planeMarkers.set(ac.id,mk);
    } else mk.setLatLng(pos);
    const el=mk.getElement();
    if(el){ const rot=el.querySelector('.rot'); if(rot) rot.style.transform=`rotate(${st.hdg}deg)`; el.classList.toggle('ground', st.phase<=1||st.phase>=8); el.classList.toggle('sel', selectedPlane===ac.id); }
    if(mk.isTooltipOpen()) mk.setTooltipContent(flightTipHtml(ac,st));
  }
  for(const [id,mk] of planeMarkers){ if(!seen.has(id)){ L_planes.removeLayer(mk); planeMarkers.delete(id); if(selectedPlane===id) selectPlane(null); } }
  if(followPlane && selectedPlane){ const ac=S.fleet.find(a=>a.id===selectedPlane); const st=ac&&flightState(ac); if(st) map.panTo([st.lat,st.lon],{animate:false}); }
  updateParked();
  updateFlightCard();
}
function flightTipHtml(ac,st){
  const m=modelOf(ac);
  const ft=Math.round(st.alt*3.28084/100)*100;
  const kind = ac.flight.kind==='ferry'?'Convoyage':ac.flight.kind==='cargo'?'Contrat cargo':'Vol commercial';
  return `<b>${S.company.code}${flightNumber(ac)} · ${ac.reg}</b> <span class="mut">${m.name}</span><br>`+
    `${st.origin} → ${st.dest} <span class="mut">(${kind})</span><br>`+
    `Phase : <b>${PHASES[st.phase]}</b><br>`+
    `Altitude : <b>${ft.toLocaleString('fr-FR')} ft</b> · Vitesse : <b>${Math.round(st.spd)} km/h</b><br>`+
    `ETA : <b>${fmtTime(st.eta)}</b> (dans ${fmtDur(st.eta-S.time)}) · <b>${Math.round(st.progress*100)} %</b>`+
    `<div class="pbar"><i style="width:${(st.progress*100).toFixed(1)}%"></i></div>`;
}
function flightNumber(ac){ let h=0; for(const c of ac.id) h=(h*31+c.charCodeAt(0))%900; return 100+h; }
function selectPlane(id){
  selectedPlane=id; if(!id) followPlane=false;
  updateFlightCard();
  if(id){ const st=flightState(S.fleet.find(a=>a.id===id)); if(st) map.panTo([st.lat,st.lon]); }
}
function updateFlightCard(){
  const box=document.getElementById('flightcard');
  const ac=selectedPlane && S.fleet.find(a=>a.id===selectedPlane);
  if(!ac||!ac.flight){ box.hidden=true; return; }
  const st=flightState(ac); if(!st){ box.hidden=true; return; }
  const legs=ac.flight.legs, pax=legs[ac.flight.li].pax;
  const paxTxt = pax? `${pax.f+pax.j+pax.w+pax.y} passagers (F${pax.f} · J${pax.j} · W${pax.w} · Y${pax.y})` : legs[ac.flight.li].cargo? `${legs[ac.flight.li].cargo} t de fret` : '';
  box.hidden=false;
  box.innerHTML=`<button class="x" data-act="closeCard">×</button>`+flightTipHtml(ac,st)+
    `<div class="btns sm"><button class="btn sm ${followPlane?'gold':''}" data-act="followCam">🎥 ${followPlane?'Caméra attachée':'Suivre l’avion'}</button><button class="btn sm" data-act="zoomPlane">🔍 Zoom</button><button class="btn sm" data-act="zoomRoute">🧭 Trajet</button></div>`+
    `<div class="mut" style="margin-top:4px">Tronçon ${ac.flight.li+1}/${legs.length} : ${AP(st.from).city} → ${AP(st.to).city} · ${Math.round(st.leg.dist)} km</div>`+
    (paxTxt?`<div>${paxTxt}</div>`:'')+
    `<div class="phases">${PHASES.map((p,i)=>`<span class="${i<st.phase?'done':i===st.phase?'cur':''}">${p}</span>`).join('')}</div>`;
}

/* ---------- avions stationnés ---------- */
function updateParked(){
  const show = map.getZoom()>=7;
  const want=new Map();
  if(show){
    const byAp={};
    for(const ac of S.fleet){ if(ac.status==='flight') continue; (byAp[ac.loc]=byAp[ac.loc]||[]).push(ac); }
    for(const [code,list] of Object.entries(byAp)) list.forEach((ac,i)=>want.set(ac.id,{ac,code,i}));
  }
  for(const [id,mk] of parkedMarkers){ const w=want.get(id); if(!w || mk._code!==w.code || mk._i!==w.i || mk._st!==w.ac.status){ L_planes.removeLayer(mk); parkedMarkers.delete(id); } }
  for(const [id,{ac,code,i}] of want){
    if(parkedMarkers.has(id)) continue;
    const a=AP(code), m=modelOf(ac), z=18, ang=i*0.9+0.6, rad=16+i*4;
    const dx=Math.cos(ang)*rad, dy=Math.sin(ang)*rad;
    const mk=L.marker([a.lat,a.lon],{icon:L.divIcon({className:'plane-icon parked'+(ac.status==='maint'?' maint':''),html:`<div class="rot" style="transform:rotate(${(i*47)%360}deg)">${PLANE_SVG(m.color||S.company.color,z)}</div>`,iconSize:[z,z],iconAnchor:[z/2-dx,z/2-dy]}),zIndexOffset:800})
      .bindTooltip(`<b>${ac.reg}</b> ${m.name}<br>${ac.status==='maint'?'🔧 En maintenance':'Au sol'} à ${a.city}`,{direction:'top'})
      .on('click',e=>{ L.DomEvent.stopPropagation(e); setTab('fleet'); });
    mk._code=code; mk._i=i; mk._st=ac.status;
    mk.addTo(L_planes); parkedMarkers.set(id,mk);
  }
}

/* ---------- avions du rival ---------- */
function updateRival(){
  if(!map) return;
  L_rival.clearLayers(); rivalMarkers.length=0;
  if(!MAPOPT.rival || !S.rival) return;
  let n=0;
  for(const r of S.rival.routes){
    const A=AP(r.a), B=AP(r.b), d=gcDist(A,B), v=d<1200?520:850;
    const T=2*(d/v*HOUR+1.2*HOUR);
    for(let i=0;i<Math.min(r.freq,3);i++){
      if(n++>40) return;
      const ph=((S.time+i*T/Math.min(r.freq,3)+hashStr(r.a+r.b)*1000)%T)/T;
      let f, from=A, to=B;
      if(ph<0.5){ f=ph*2; } else { f=(ph-0.5)*2; from=B; to=A; }
      f=clamp((f-0.08)/0.84,0,1);
      if(f<=0||f>=1) continue;
      const p=gcInterp(from,to,f), q=gcInterp(from,to,Math.min(1,f+0.01));
      const lon=unwrapLon(p.lon,from.lon);
      const mk=L.marker([p.lat,lon],{icon:L.divIcon({className:'plane-icon rival', html:`<div class="rot" style="transform:rotate(${bearing(p,q)}deg)">${PLANE_SVG('#e5484d',18)}</div>`, iconSize:[18,18], iconAnchor:[9,9]}), zIndexOffset:500})
        .bindTooltip(`<b>${S.rival.name}</b><br>${from.city} → ${to.city}`,{direction:'right'});
      mk.addTo(L_rival);
    }
  }
}
function hashStr(s){ let h=0; for(const c of s) h=(h*131+c.charCodeAt(0))%100000; return h; }

function zoomPlane(){ const ac=S.fleet.find(a=>a.id===selectedPlane), st=ac&&flightState(ac); if(st) map.flyTo([st.lat,st.lon],Math.max(map.getZoom(),st.phase<=1||st.phase>=7?14:8),{duration:1}); }
function zoomRoute(){ const ac=S.fleet.find(a=>a.id===selectedPlane); if(!ac?.flight) return; const pts=ac.flight.legs.flatMap(l=>[[AP(l.from).lat,AP(l.from).lon],[AP(l.to).lat,unwrapLon(AP(l.to).lon,AP(l.from).lon)]]); map.flyToBounds(pts,{padding:[60,60],duration:1}); }
function focusDRC(){ map.flyToBounds([[-13.5,12],[5.5,31.5]],{duration:1.2}); }
function focusWorld(){ map.flyTo([15,20],2,{duration:1.2}); }
