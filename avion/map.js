/* ============================================================
   CARTE — Leaflet + imagerie satellite ESRI
   ============================================================ */
let map, L_airports, L_routes, L_planes, L_rival, L_night, L_drc;
const planeMarkers = new Map(); // id avion -> marker
const rivalMarkers = [];
const MAPOPT = { routes:true, airports:true, night:true, rival:true, trails:true, weather:true };
let L_weather;
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

// Silhouettes vues de dessus (nez vers le haut), fuselage blanc, dérive et moteurs aux couleurs de la livrée
function planeCat(m){
  if(!m) return 'nb';
  if(m.fam==='CONC') return 'conc';
  if(m.fam==='TURBO') return 'prop';
  if(m.fam==='CRJ'||m.fam==='EMB') return 'rj';
  if(m.fam==='B747'||m.fam==='A380') return 'quad';
  if(['A330','A350','B777','B787'].includes(m.fam)||m.id==='B763'||m.id==='B76F') return 'wb';
  if(m.custom) return m.seats>=400?'quad':m.seats>=250?'wb':m.seats<=80?'prop':'nb';
  return 'nb';
}
const SHAPES = {
  prop:(c)=>`<rect x="29.5" y="6" width="5" height="50" rx="2.5" class="fu"/>
    <rect x="3" y="20" width="58" height="6" rx="2" class="wi"/>
    <rect x="16" y="15" width="4" height="12" rx="1.5" fill="${c}"/><rect x="44" y="15" width="4" height="12" rx="1.5" fill="${c}"/>
    <ellipse cx="18" cy="15" rx="6" ry="1" class="pr"/><ellipse cx="46" cy="15" rx="6" ry="1" class="pr"/>
    <rect x="21" y="53" width="22" height="4" rx="1.5" class="wi"/><rect x="31" y="47" width="2" height="12" fill="${c}"/>`,
  rj:(c)=>`<rect x="29.5" y="5" width="5" height="52" rx="2.5" class="fu"/>
    <path d="M32 24 L56 36 L56 38.5 L32 32 L8 38.5 L8 36Z" class="wi"/>
    <rect x="25" y="41" width="4" height="10" rx="1.8" fill="${c}"/><rect x="35" y="41" width="4" height="10" rx="1.8" fill="${c}"/>
    <path d="M32 53 L43 58 L43 60 L32 57.5 L21 60 L21 58Z" class="wi"/><rect x="31" y="47" width="2" height="13" fill="${c}"/>`,
  nb:(c)=>`<rect x="29.2" y="3" width="5.6" height="56" rx="2.8" class="fu"/>
    <path d="M32 22 L61 37 L61 40 L32 32.5 L3 40 L3 37Z" class="wi"/>
    <rect x="15" y="27" width="4.5" height="9" rx="2" fill="${c}"/><rect x="44.5" y="27" width="4.5" height="9" rx="2" fill="${c}"/>
    <path d="M32 50 L44 57 L44 59.5 L32 56.5 L20 59.5 L20 57Z" class="wi"/><rect x="31" y="47" width="2" height="14" fill="${c}"/>`,
  wb:(c)=>`<rect x="28.3" y="2" width="7.4" height="58" rx="3.7" class="fu"/>
    <path d="M32 20 L63 38 L63 41.5 L32 31.5 L1 41.5 L1 38Z" class="wi"/>
    <rect x="13" y="26" width="6" height="11" rx="2.6" fill="${c}"/><rect x="45" y="26" width="6" height="11" rx="2.6" fill="${c}"/>
    <path d="M32 49 L46 57 L46 60 L32 56 L18 60 L18 57Z" class="wi"/><rect x="30.8" y="46" width="2.4" height="15" fill="${c}"/>`,
  quad:(c)=>`<rect x="28" y="2" width="8" height="58" rx="4" class="fu"/><rect x="29.3" y="4" width="5.4" height="12" rx="2.7" class="fu2"/>
    <path d="M32 19 L63 39 L63 42.5 L32 31 L1 42.5 L1 39Z" class="wi"/>
    <rect x="9" y="31" width="5" height="10" rx="2.3" fill="${c}"/><rect x="18" y="26" width="5.5" height="11" rx="2.5" fill="${c}"/>
    <rect x="40.5" y="26" width="5.5" height="11" rx="2.5" fill="${c}"/><rect x="50" y="31" width="5" height="10" rx="2.3" fill="${c}"/>
    <path d="M32 49 L47 57 L47 60 L32 56 L17 60 L17 57Z" class="wi"/><rect x="30.8" y="46" width="2.4" height="15" fill="${c}"/>`,
  conc:(c)=>`<path d="M32 1 L34 8 L34 58 L30 58 L30 8Z" class="fu"/>
    <path d="M32 20 C36 30 50 44 57 56 L57 58 L7 58 L7 56 C14 44 28 30 32 20Z" class="wi"/>
    <rect x="21" y="47" width="3.5" height="10" fill="${c}"/><rect x="25.5" y="47" width="3.5" height="10" fill="${c}"/>
    <rect x="35" y="47" width="3.5" height="10" fill="${c}"/><rect x="39.5" y="47" width="3.5" height="10" fill="${c}"/>
    <rect x="31" y="44" width="2" height="14" fill="${c}"/>`,
};
const PLANE_SVG = (color, size=26, cat='nb')=>`<svg class="ac-svg" viewBox="0 0 64 64" width="${size}" height="${size}">${SHAPES[cat](color)}</svg>`;
function zoomScale(){ const z=map?map.getZoom():5; return z<=3?0.75:z<=5?1:z<=7?1.3:z<=9?1.7:z<=11?2.2:z<=13?2.8:3.4; }

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
  L_trails = L.layerGroup().addTo(map);
  L_weather = L.layerGroup().addTo(map);
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
  drawWeather(true);
  map.on('click',()=>{ selectPlane(null); });
  map.on('zoomend',()=>{ drawAirports(); for(const [,mk] of planeMarkers) L_planes.removeLayer(mk); planeMarkers.clear(); for(const [,mk] of parkedMarkers) L_planes.removeLayer(mk); parkedMarkers.clear(); updatePlanes(); updateRival(); drawWeather(); });
}

function airportStyle(a){
  const hub = S.hubs? S.hubs.includes(a.code) : a.code===S.company.hub;
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
      if(off===0 && (z>=6 && a.drc || z>=7 || (S.hubs||[]).includes(code))){
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
        L.polyline(pts,{color:'#000', weight:5, opacity:0.35, interactive:false}).addTo(L_routes);
        L.polyline(pts,{color, weight:2.6, opacity:0.95, className:'route-anim'}).addTo(L_routes)
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
      const m=modelOf(ac), cat=planeCat(m);
      const base = cat==='quad'?34 : cat==='wb'?31 : cat==='conc'?28 : cat==='nb'?26 : 22;
      const size = Math.round(base*zoomScale());
      mk=L.marker(pos,{icon:L.divIcon({className:'plane-icon', html:`<div class="rot">${PLANE_SVG(planeColor(ac),size,cat)}</div>`, iconSize:[size,size], iconAnchor:[size/2,size/2]}), zIndexOffset:1000});
      mk.bindTooltip('',{direction:'right',offset:[14,0],className:'flight-tip'});
      mk.on('tooltipopen',()=>{ const s2=flightState(ac); if(s2) mk.setTooltipContent(flightTipHtml(ac,s2)); });
      mk.on('click',(e)=>{ L.DomEvent.stopPropagation(e); selectPlane(ac.id); });
      mk.addTo(L_planes); planeMarkers.set(ac.id,mk);
    } else mk.setLatLng(pos);
    const el=mk.getElement();
    if(el){ const rot=el.querySelector('.rot'); if(rot){ rot.style.transform=`rotate(${st.hdg}deg)`; const sh=Math.min(9,1+st.alt/1500)*Math.min(1.6,zoomScale()); rot.style.setProperty('--sh',sh.toFixed(1)+'px'); } el.classList.toggle('ground', st.phase<=1||st.phase>=8); el.classList.toggle('sel', selectedPlane===ac.id); }
    updateTrail(ac,st);
    if(mk.isTooltipOpen()) mk.setTooltipContent(flightTipHtml(ac,st));
  }
  for(const [id,mk] of planeMarkers){ if(!seen.has(id)){ L_planes.removeLayer(mk); planeMarkers.delete(id); if(selectedPlane===id) selectPlane(null); } }
  for(const [id,t] of trails){ if(!seen.has(id)){ L_trails.removeLayer(t.line); if(t.ahead) L_trails.removeLayer(t.ahead); trails.delete(id); } }
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

/* ---------- traînées de condensation ---------- */
const trails=new Map(); let L_trails;
function updateTrail(ac,st){
  if(!MAPOPT.trails) return;
  let t=trails.get(ac.id);
  const now=performance.now();
  if(t && now-t.at<900 && t.li===ac.flight.li) return;
  const A=AP(st.from), B=AP(st.to), leg=st.leg;
  const frac=leg.dist? Math.min(1,gcDist(A,{lat:st.lat,lon:st.lon})/leg.dist):0;
  const n=Math.max(2,Math.ceil(frac*leg.dist/80));
  const pts=[]; let prev=A.lon;
  for(let i=0;i<=n;i++){ const p=gcInterp(A,B,frac*i/n); const lon=unwrapLon(p.lon,prev); pts.push([p.lat,lon]); prev=lon; }
  const sel=selectedPlane===ac.id;
  if(!t){ t={line:L.polyline(pts,{color:'#ffffff',weight:sel?3:2,opacity:0.55,className:'trail',interactive:false}).addTo(L_trails)}; trails.set(ac.id,t); }
  else t.line.setLatLngs(pts);
  if(sel){
    const ahead=[]; let pv=pts[pts.length-1][1];
    for(let i=0;i<=20;i++){ const p=gcInterp(A,B,frac+(1-frac)*i/20); const lon=unwrapLon(p.lon,pv); ahead.push([p.lat,lon]); pv=lon; }
    if(!t.ahead) t.ahead=L.polyline(ahead,{color:'#ff2bd6',weight:2.5,opacity:0.9,dashArray:'6 8',interactive:false}).addTo(L_trails); else t.ahead.setLatLngs(ahead);
  } else if(t.ahead){ L_trails.removeLayer(t.ahead); t.ahead=null; }
  t.at=now; t.li=ac.flight.li;
}

/* ---------- avions stationnés ---------- */
function updateParked(){
  const show = map.getZoom()>=7;
  const want=new Map();
  if(show){
    const byAp={};
    for(const ac of S.fleet){ if(ac.status==='flight'||ac.status==='manual') continue; (byAp[ac.loc]=byAp[ac.loc]||[]).push(ac); }
    for(const [code,list] of Object.entries(byAp)) list.forEach((ac,i)=>want.set(ac.id,{ac,code,i}));
  }
  for(const [id,mk] of parkedMarkers){ const w=want.get(id); if(!w || mk._code!==w.code || mk._i!==w.i || mk._st!==w.ac.status){ L_planes.removeLayer(mk); parkedMarkers.delete(id); } }
  for(const [id,{ac,code,i}] of want){
    if(parkedMarkers.has(id)) continue;
    const a=AP(code), m=modelOf(ac), z=Math.round(14*zoomScale()), ang=i*0.9+0.6, rad=z*0.9+i*z*0.25;
    const dx=Math.cos(ang)*rad, dy=Math.sin(ang)*rad;
    const mk=L.marker([a.lat,a.lon],{icon:L.divIcon({className:'plane-icon parked'+(ac.status==='maint'?' maint':''),html:`<div class="rot" style="transform:rotate(${(i*47)%360}deg);--sh:1px">${PLANE_SVG(m.color||S.company.color,z,planeCat(m))}</div>`,iconSize:[z,z],iconAnchor:[z/2-dx,z/2-dy]}),zIndexOffset:800})
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
      const mk=L.marker([p.lat,lon],{icon:L.divIcon({className:'plane-icon rival', html:`<div class="rot" style="transform:rotate(${bearing(p,q)}deg);--sh:5px">${PLANE_SVG('#e5484d',Math.round(19*zoomScale()),d<1200?'prop':'nb')}</div>`, iconSize:[Math.round(19*zoomScale()),Math.round(19*zoomScale())], iconAnchor:[Math.round(9.5*zoomScale()),Math.round(9.5*zoomScale())]}), zIndexOffset:500})
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

/* ---------- météo ---------- */
let _wxKey='';
function drawWeather(force){
  if(!map||!L_weather) return;
  const key=(S.wxHour||0)+'|'+map.getZoom()+'|'+MAPOPT.weather;
  if(!force && key===_wxKey) return; _wxKey=key;
  L_weather.clearLayers();
  if(!MAPOPT.weather) return;
  for(const c of S.weather||[]){
    for(const off of [-360,0,360]){
      const ll=[c.lat,c.lon+off];
      L.circle(ll,{radius:c.r*1000,stroke:false,fillColor:'#e2e8f0',fillOpacity:0.18*c.power,className:'storm',interactive:false}).addTo(L_weather);
      L.circle(ll,{radius:c.r*600,stroke:false,fillColor:'#94a3b8',fillOpacity:0.22*c.power,interactive:false}).addTo(L_weather);
      L.circle(ll,{radius:c.r*300,stroke:false,fillColor:'#334155',fillOpacity:0.25*c.power,className:'storm-core'}).addTo(L_weather)
        .bindTooltip(`⛈️ Cellule orageuse · ${Math.round(c.r)} km<br><span class="mut">Attentes et retards à l’arrivée</span>`);
    }
  }
}
