/* ============================================================
   CARTE — Leaflet + imagerie satellite ESRI
   ============================================================ */
let map, L_airports, L_routes, L_planes, L_rival, L_night, L_drc;
const planeMarkers = new Map(); // id avion -> marker
const rivalMarkers = [];
const MAPOPT = Object.assign({ routes:true, airports:true, night:false, rival:true, trails:true, weather:false }, (()=>{ try{ return JSON.parse(localStorage.getItem('cst-mapopt')||'{}'); }catch(e){ return {}; } })());
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
    esri('Reference/World_Transportation',{opacity:0.75,minZoom:8}),
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
// Silhouettes vues de dessus (nez vers le haut), dessinées comme sur les radars de vols en ligne
const ENG='#2b3442';
const SHAPES = {
  nb:()=>`<path class="b" d="M32 2C34.2 2 35.2 4.5 35.2 8L35.2 22 60 34.5C61 35 61.5 35.8 61.5 36.8L61.5 38.5 35.2 32.5 35 47 43.5 53.5C44 54 44.2 54.5 44.2 55.2L44.2 56.6 33.4 54 32.8 59.5C32.6 60.6 31.4 60.6 31.2 59.5L30.6 54 19.8 56.6 19.8 55.2C19.8 54.5 20 54 20.5 53.5L29 47 28.8 32.5 2.5 38.5 2.5 36.8C2.5 35.8 3 35 4 34.5L28.8 22 28.8 8C28.8 4.5 29.8 2 32 2Z"/>
    <ellipse cx="17" cy="28.5" rx="2.4" ry="4.4" fill="${ENG}"/><ellipse cx="47" cy="28.5" rx="2.4" ry="4.4" fill="${ENG}"/>`,
  wb:()=>`<path class="b" d="M32 1C34.6 1 36 3.5 36 8L36 21 61.5 36C62.5 36.6 63 37.4 63 38.4L63 40.2 36 33.5 35.8 47.5 46 54.5C46.6 55 46.8 55.5 46.8 56.2L46.8 57.8 33.6 55 32.9 61C32.7 62.3 31.3 62.3 31.1 61L30.4 55 17.2 57.8 17.2 56.2C17.2 55.5 17.4 55 18 54.5L28.2 47.5 28 33.5 1 40.2 1 38.4C1 37.4 1.5 36.6 2.5 36L28 21 28 8C28 3.5 29.4 1 32 1Z"/>
    <ellipse cx="15" cy="28.5" rx="3.1" ry="5.2" fill="${ENG}"/><ellipse cx="49" cy="28.5" rx="3.1" ry="5.2" fill="${ENG}"/>`,
  quad:()=>`<path class="b" d="M32 1C34.6 1 36 3.5 36 8L36 21 61.5 36C62.5 36.6 63 37.4 63 38.4L63 40.2 36 33.5 35.8 47.5 46 54.5C46.6 55 46.8 55.5 46.8 56.2L46.8 57.8 33.6 55 32.9 61C32.7 62.3 31.3 62.3 31.1 61L30.4 55 17.2 57.8 17.2 56.2C17.2 55.5 17.4 55 18 54.5L28.2 47.5 28 33.5 1 40.2 1 38.4C1 37.4 1.5 36.6 2.5 36L28 21 28 8C28 3.5 29.4 1 32 1Z"/>
    <ellipse cx="20" cy="26" rx="2.5" ry="4.4" fill="${ENG}"/><ellipse cx="44" cy="26" rx="2.5" ry="4.4" fill="${ENG}"/><ellipse cx="10.5" cy="31.5" rx="2.3" ry="4" fill="${ENG}"/><ellipse cx="53.5" cy="31.5" rx="2.3" ry="4" fill="${ENG}"/>
    <ellipse cx="32" cy="9" rx="2.6" ry="6" fill="#fff" opacity=".25"/>`,
  rj:()=>`<path class="b" d="M32 3C33.8 3 34.5 5.5 34.5 9L34.5 25 55 35.5C55.7 35.9 56 36.5 56 37.2L56 38.6 34.5 33.5 34.3 50 33.4 59C33.2 60.3 30.8 60.3 30.6 59L29.7 50 29.5 33.5 8 38.6 8 37.2C8 36.5 8.3 35.9 9 35.5L29.5 25 29.5 9C29.5 5.5 30.2 3 32 3Z"/>
    <path class="b" d="M32 53.5 42.5 57.3 42.5 59 32 57.3 21.5 59 21.5 57.3Z"/>
    <ellipse cx="26.6" cy="44.5" rx="2.3" ry="4.6" fill="${ENG}"/><ellipse cx="37.4" cy="44.5" rx="2.3" ry="4.6" fill="${ENG}"/>`,
  prop:()=>`<path class="b" d="M32 4C34.2 4 34.7 7 34.7 11L34.7 19.5 58.5 20.5C59.5 20.6 60 21.2 60 22L60 24.5C60 25.2 59.4 25.6 58.6 25.6L34.7 26.5 34.4 50 33.3 60C33.1 61.2 30.9 61.2 30.7 60L29.6 50 29.3 26.5 5.4 25.6C4.6 25.6 4 25.2 4 24.5L4 22C4 21.2 4.5 20.6 5.5 20.5L29.3 19.5 29.3 11C29.3 7 29.8 4 32 4Z"/>
    <path class="b" d="M32 54 44 56.5 44 58.6 32 58 20 58.6 20 56.5Z"/>
    <rect x="17" y="15" width="4" height="13" rx="2" fill="${ENG}"/><rect x="43" y="15" width="4" height="13" rx="2" fill="${ENG}"/>
    <ellipse cx="19" cy="14.6" rx="7.5" ry="1.2" fill="#fff" opacity=".6"/><ellipse cx="45" cy="14.6" rx="7.5" ry="1.2" fill="#fff" opacity=".6"/>`,
  conc:()=>`<path class="b" d="M32 .5 33.2 6 33.6 22C38 30 50 44 55.5 52L56 56 36 56 34.5 60.5 29.5 60.5 28 56 8 56 8.5 52C14 44 26 30 30.4 22L30.8 6Z"/>
    <rect x="20.5" y="47" width="3" height="9" fill="${ENG}"/><rect x="24.5" y="47" width="3" height="9" fill="${ENG}"/><rect x="36.5" y="47" width="3" height="9" fill="${ENG}"/><rect x="40.5" y="47" width="3" height="9" fill="${ENG}"/>`,
};
const PLANE_SVG = (color, size=26, cat='nb')=>`<svg class="ac-svg" viewBox="0 0 64 64" width="${size}" height="${size}" style="--c:${color}">${SHAPES[cat]()}<rect x="31.1" y="7" width="1.8" height="38" rx=".9" fill="#fff" opacity=".35"/><path d="M30.2 6.6Q32 5 33.8 6.6L33.4 8.2Q32 7.3 30.6 8.2Z" fill="#0b1220" opacity=".55"/></svg>`;
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
    L.polygon(ring,{pane:'drc', color:'#ffd54a', weight:1.6, opacity:0.8, fill:false, dashArray:'6 4'}).addTo(L_drc);
  }
  document.querySelectorAll('#mapctl [data-k]').forEach(b=>b.classList.toggle('on',!!MAPOPT[b.dataset.k]));
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
function servedSet(){ const set=new Set(S.hubs||[]); for(const r of S.routes) r.stops.forEach(c=>set.add(c)); return set; }
function drawAirports(){
  if(!map) return;
  L_airports.clearLayers();
  if(!MAPOPT.airports) return;
  const z=map.getZoom(), served=servedSet();
  for(const code of AIRPORT_CODES){
    const a=AP(code), hub=(S.hubs||[]).includes(code), mine=served.has(code), closed=airportClosed(code);
    // désencombrement : à petite échelle, seulement les grands aéroports et votre réseau
    const show = mine || hub || a.cls>=5 || (z>=3 && a.cls>=4) || (z>=4 && a.drc && a.cls>=2) || z>=5;
    if(!show) continue;
    const size = hub? 24 : a.cls>=4||mine? 16 : 11;
    const cls = 'ap-pin'+(hub?' hub':'')+(mine&&!hub?' mine':'')+(a.drc?' drc':'')+(closed?' closed':'')+(a.cls>=4&&!hub?' big':'');
    const html = hub? '<span>★</span>' : a.cls>=4||mine? '<span>✈</span>' : '';
    const label = (hub||mine||z>=6||(z>=5&&a.cls>=4)) ? `<b class="ap-name">${a.city}</b>` : '';
    for(const off of [-360,0,360]){
      const mk=L.marker([a.lat,a.lon+off],{icon:L.divIcon({className:cls, html:html+(off===0?label:''), iconSize:[size,size], iconAnchor:[size/2,size/2]}), zIndexOffset:hub?600:mine?400:0, riseOnHover:true});
      mk.bindTooltip(airportTip(a),{direction:'top',offset:[0,-size/2]});
      mk.on('click',(e)=>{ L.DomEvent.stopPropagation(e); openAirport(code); });
      mk.addTo(L_airports);
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
  const m0=modelOf(ac);
  box.innerHTML=`<button class="x" data-act="closeCard">×</button>`+(typeof photoHtml==='function'?photoHtml(m0,'banner'):'')+flightTipHtml(ac,st)+
    `<div class="btns sm"><button class="btn sm ${followPlane?'gold':''}" data-act="followCam">🎥 ${followPlane?'Caméra attachée':'Suivre l’avion'}</button><button class="btn sm" data-act="zoomPlane">🔍 Zoom</button><button class="btn sm" data-act="zoomRoute">🧭 Trajet</button></div>`+
    `<div class="mut" style="margin-top:4px">Tronçon ${ac.flight.li+1}/${legs.length} : ${AP(st.from).city} → ${AP(st.to).city} · ${Math.round(st.leg.dist)} km</div>`+
    (paxTxt?`<div>${paxTxt}</div>`:'')+
    `<div class="phases">${PHASES.map((p,i)=>`<span class="${i<st.phase?'done':i===st.phase?'cur':''}">${p}</span>`).join('')}</div>`;
  if(typeof hydratePhotos==='function') hydratePhotos();
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
