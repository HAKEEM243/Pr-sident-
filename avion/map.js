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
  if(L_runways&&S) drawRunways();
  document.body.classList.toggle('google-map', !!MAP_STYLES[id].google);
  return id;
}

// Silhouettes vues de dessus (nez vers le haut), fuselage blanc, dérive et moteurs aux couleurs de la livrée
function planeCat(m){
  if(!m) return 'nb';
  if(m.fam==='CONC') return 'conc';
  if(m.fam==='TURBO') return 'prop';
  if(m.fam==='CRJ'||m.id==='E145'||m.id==='B712'||m.id==='AJ27') return 'rj';
  if(m.fam==='EMB') return 'rj';
  if(m.fam==='A340') return 'quad';
  if(m.id==='MD11') return 'wb';
  if(m.fam==='B747'||m.fam==='A380') return 'quad';
  if(['A330','A350','B777','B787','A340'].includes(m.fam)||m.id==='B763'||m.id==='B76F') return 'wb';
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
const PLANE_SVG = (color, size=26, cat='nb', h)=>`<svg class="ac-svg" viewBox="0 0 64 64" width="${size}" height="${h||size}" preserveAspectRatio="none" style="--c:${color}">${SHAPES[cat]()}<rect x="31.1" y="7" width="1.8" height="38" rx=".9" fill="#fff" opacity=".35"/><path d="M30.2 6.6Q32 5 33.8 6.6L33.4 8.2Q32 7.3 30.6 8.2Z" fill="#0b1220" opacity=".55"/></svg>`;
// Taille à l'écran : grossie aux petits zooms, à l'échelle réelle (envergure × longueur) aux grands zooms
function acDims(m, lat, base){
  const sp=acSpec(m), z=map?map.getZoom():5, mpp=156543.03*Math.cos(toRad(lat||0))/Math.pow(2,z);
  const realW=sp.span/mpp, realH=sp.len/mpp;
  if(realW>=base) return {w:Math.round(realW), h:Math.round(realH), real:true};
  return {w:Math.round(base), h:Math.round(base*sp.len/sp.span), real:false};
}
function zoomScale(){ const z=map?map.getZoom():5; return z<=3?0.75:z<=5?1:z<=7?1.3:z<=9?1.7:z<=11?2.2:z<=13?2.8:3.4; }

function initMap(){
  map = L.map('map', { zoomControl:false, worldCopyJump:true, minZoom:2, maxZoom:19, attributionControl:true, preferCanvas:false, markerZoomAnimation:false })
    .setView([AP(S.company.hub).lat, AP(S.company.hub).lon], runwaysOf(S.company.hub).length?13:6);
  L.control.zoom({position:'topleft'}).addTo(map);
  L.control.scale({position:'bottomleft', imperial:false}).addTo(map);
  setMapStyle(localStorage.getItem(MAPSTYLE_KEY)||'hybrid', true);

  map.createPane('night'); map.getPane('night').style.zIndex=350; map.getPane('night').style.pointerEvents='none';
  map.createPane('drc'); map.getPane('drc').style.zIndex=360; map.getPane('drc').style.pointerEvents='none';
  L_night = L.layerGroup().addTo(map);
  L_drc = L.layerGroup().addTo(map);
  L_trails = L.layerGroup().addTo(map);
  L_weather = L.layerGroup().addTo(map);
  L_runways = L.layerGroup().addTo(map);
  L_routes = L.layerGroup().addTo(map);
  L_airports = L.layerGroup().addTo(map);
  L_rival = L.layerGroup().addTo(map);
  L_planes = L.layerGroup().addTo(map);

  // Frontière de la RDC, mise en valeur pour les compagnies congolaises
  if(homeCC()==='CD') for(const off of [-360,0,360]){
    const ring = DRC_BORDER.map(([la,lo])=>[la,lo+off]);
    L.polygon(ring,{pane:'drc', color:'#ffd54a', weight:1.6, opacity:0.8, fill:false, dashArray:'6 4'}).addTo(L_drc);
  }
  document.querySelectorAll('#mapctl [data-k]').forEach(b=>b.classList.toggle('on',!!MAPOPT[b.dataset.k]));
  drawAirports();
  drawRoutes();
  drawNight();
  drawWeather(true);
  map.on('click',()=>{ selectPlane(null); });
  let _mvT=0; map.on('moveend',()=>{ clearTimeout(_mvT); _mvT=setTimeout(()=>{ drawAirports(); updateRival(); },120); });
  map.on('zoomend',()=>{ drawAirports(); for(const [,mk] of planeMarkers) L_planes.removeLayer(mk); planeMarkers.clear(); for(const [,mk] of parkedMarkers) L_planes.removeLayer(mk); parkedMarkers.clear(); updatePlanes(); updateRival(); drawWeather(); });
  initRivalCanvas();
  map.on('movestart zoomstart',()=>{ map._mv=true; }); map.on('moveend zoomend',()=>{ map._mv=false; });
  requestAnimationFrame(animateFrame);
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
let L_runways, _rwCanvas;
// Pistes réelles : surface, marquages, balisage lumineux (allumé la nuit à l'heure locale), rampes d'approche et PAPI
let _rwDrawn=null;
function drawRunways(force){
  if(!L_runways) return;
  const z=map.getZoom();
  if(z<9 || !MAPOPT.airports){ if(_rwDrawn){ L_runways.clearLayers(); _rwDrawn=null; } return; }
  // inutile de tout redessiner à chaque déplacement : on garde le dessin tant que la vue reste dans la zone déjà tracée
  const vb=map.getBounds(), key=z+'|'+currentStyle+'|'+Math.floor(S.time/(30*MIN));
  if(!force && _rwDrawn && _rwDrawn.key===key && _rwDrawn.b.contains(vb) && _rwDrawn.lng===Math.round(map.getCenter().lng/360)) return;
  L_runways.clearLayers(); _rwDrawn={key, b:vb.pad(0.5), lng:Math.round(map.getCenter().lng/360)};
  if(!_rwCanvas) _rwCanvas=L.canvas({padding:0.35});
  const b=map.getBounds().pad(0.6), c0=map.getCenter().lng, sat=/hybrid|satellite|google_sat/.test(currentStyle||'hybrid');
  const LL=p=>[p.lat,unwrapLon(p.lon,c0)];
  const dot=(p,color,rad,op=1)=>L.circleMarker(LL(p),{renderer:_rwCanvas,interactive:false,stroke:false,fillColor:color,fillOpacity:op,radius:rad}).addTo(L_runways);
  const line=(pts,o)=>L.polyline(pts.map(LL),Object.assign({interactive:false},o)).addTo(L_runways);
  const label=(p,html,cls,size)=>L.marker(LL(p),{icon:L.divIcon({className:'rwy-label '+(cls||''),html,iconSize:[size||30,size||16],iconAnchor:[(size||30)/2,(size||16)/2]}),interactive:false}).addTo(L_runways);
  let budget=6000;
  for(const code of AIRPORT_CODES){
    const a=AP(code); if(!b.contains([a.lat,unwrapLon(a.lon,c0)])) continue;
    const rws=runwaysOf(code); if(!rws.length) continue;
    const night=sunElev(a.lat,a.lon,S.time)<-4, mpp=156543.03*Math.cos(toRad(a.lat))/Math.pow(2,z), px=m=>Math.max(1,m/mpp);
    for(let i=0;i<rws.length;i+=2){
      const r=rws[i], o=rws[i+1]||r, W=r.wid||45, hw=W/2, big=r.hard&&r.len>=1800;
      if(z<11){ line([r.thr,r.end],{color:night?'#ffd27a':r.hard?'#f8fafc':'#d4a373',weight:z<10?2:3,opacity:0.9,className:night?'rwlit':''}); continue; }
      // surface
      L.polygon([fromRw(r,0,-hw),fromRw(r,r.len,-hw),fromRw(r,r.len,hw),fromRw(r,0,hw)].map(LL),
        {color:night?'#ffe7a3':'#f1f5f9',weight:night?1.6:1,opacity:sat?0.6:0.85,fillColor:r.hard?'#1c2027':'#8a6238',fillOpacity:sat?0.3:0.8,interactive:false,className:night?'rwlit':''}).addTo(L_runways);
      if(z<14 && r.hard && r.len>=1500) for(const e of [r,o]) line([fromRw(e,-700,0),fromRw(e,-9500,0)],{color:'#e2e8f0',weight:1,opacity:0.35,dashArray:'4 9'});
      if(z>=13) line([fromRw(r,60,0),fromRw(r,r.len-60,0)],{color:'#fff',weight:px(0.9),opacity:sat?0.55:0.8,dashArray:`${px(30)} ${px(20)}`});
      for(const e of [r,o]){
        // identifiant de piste
        if(z>=15){ const fs=Math.max(10,Math.min(40,Math.round(18/mpp))); label(fromRw(e,70+18*mpp,0),`<span style="transform:rotate(${e.hdg}deg);font-size:${fs}px">${e.id}</span>`,'paint',fs*2); }
        else label(fromRw(e,-120*Math.pow(2,13-Math.min(z,15)),0),`<span style="transform:rotate(${e.hdg}deg)">${e.id}</span>`);
        if(z<13 || budget<0) continue;
        // marquages au sol (vue rapprochée)
        if(z>=15 && r.hard){
          const nb=W>=45?6:4, gap=(hw-3)/nb, mk={color:'#fff',opacity:sat?0.65:0.9,lineCap:'butt'};
          for(let j=0;j<nb;j++) for(const sg of [-1,1]){ const x=sg*(3+gap*(j+0.5)); line([fromRw(e,6,x),fromRw(e,36,x)],{...mk,weight:px(gap*0.55)}); }
          if(e.len>=1500) for(const sg of [-1,1]) line([fromRw(e,400,sg*hw*0.5),fromRw(e,450,sg*hw*0.5)],{...mk,weight:px(9)});
          for(const [d,n] of [[150,3],[300,3],[600,2],[750,2],[900,1]]) if(d+30<e.len/2) for(const sg of [-1,1]) for(let j=0;j<n;j++){ const x=sg*(hw*0.5+(j-(n-1)/2)*3.2*(d===300?0:1)); if(d===300) continue; line([fromRw(e,d,x),fromRw(e,d+22,x)],{...mk,weight:px(1.8)}); }
        }
        // feux de seuil (verts), rampe d'approche, PAPI, feux de bord la nuit
        const thrN=Math.max(4,Math.round(W/6));
        for(let j=0;j<=thrN;j++) dot(fromRw(e,-2,-hw+W*j/thrN),'#22c55e',night?2.4:1.2,night?1:0.6);
        if(big){
          for(let d=60;d<=900;d+=60){ dot(fromRw(e,-d,0),night?'#fff4c4':'#e5e7eb',night?(z>=15?3:2.2):1.1,night?1:0.5); budget--; }
          for(let x=-15;x<=15;x+=7.5) if(x) dot(fromRw(e,-300,x),night?'#fff4c4':'#e5e7eb',night?2.2:1.1,night?1:0.5);
          for(let j=0;j<4;j++) dot(fromRw(e,300,-(hw+14+j*9)),night?(j<2?'#ffffff':'#ef4444'):(j<2?'#f8fafc':'#f87171'),night?2.4:1.6,0.95);
        }
        if(night && z>=14){
          for(let d=0;d<=e.len/2;d+=60){ const col=d>e.len-600?'#fbbf24':'#fff1c1'; dot(fromRw(e,d,-(hw+2)),col,1.6); dot(fromRw(e,d,hw+2),col,1.6); budget-=2; }
          if(z>=15) for(let d=30;d<e.len/2;d+=30){ dot(fromRw(e,d,0),'#ffffff',1.1,0.9); budget--; }
        }
      }
    }
  }
}
const airportMk=new Map();
// Mise à jour incrémentale : on ne recrée que les aéroports qui entrent à l'écran ou changent d'aspect (carte fluide)
function drawAirports(){
  if(!map) return;
  drawRunways();
  if(!MAPOPT.airports){ if(airportMk.size){ L_airports.clearLayers(); airportMk.clear(); } return; }
  const z=map.getZoom(), served=servedSet(), bounds=map.getBounds().pad(0.2), c0=map.getCenter().lng, want=new Set();
  for(const code of AIRPORT_CODES){
    const a=AP(code), hub=(S.hubs||[]).includes(code), mine=served.has(code);
    // désencombrement : à petite échelle, seulement les grands aéroports et votre réseau
    const show = mine || hub || (z>=2 && a.traffic>=30) || (z>=3 && a.traffic>=15) || (z>=4 && a.traffic>=5) || (z>=5 && (a.large||a.traffic>=1.5)) || (z>=6 && a.cls>=3) || z>=7;
    if(!show) continue;
    const lon=unwrapLon(a.lon,c0);
    if(!bounds.contains([a.lat,lon])) continue;
    const closed=airportClosed(code);
    const size = hub? 24 : a.traffic>=10||mine? 16 : a.large? 13 : 10;
    const cls = 'ap-pin'+(hub?' hub':'')+(mine&&!hub?' mine':'')+(a.drc?' drc':'')+(closed?' closed':'')+(a.cls>=4&&!hub?' big':'')+((typeof moodOf==='function'&&moodOf(a.cc).tension>0.4)?' tense':(typeof moodOf==='function'&&moodOf(a.cc).boom>0.3)?' boomy':'');
    const html = hub? '<span>★</span>' : a.traffic>=10||mine? '<span>✈</span>' : '';
    const label = (hub||mine||z>=7||(z>=5&&a.traffic>=3)||(z>=4&&a.traffic>=15)||(z>=3&&a.traffic>=35)||a.traffic>=60) ? `<b class="ap-name">${a.city}</b>` : '';
    const sig=cls+'|'+size+'|'+html+label+'|'+lon.toFixed(3);
    want.add(code);
    const old=airportMk.get(code); if(old&&old._sig===sig) continue;
    if(old) L_airports.removeLayer(old);
    const mk=L.marker([a.lat,lon],{icon:L.divIcon({className:cls, html:html+label, iconSize:[size,size], iconAnchor:[size/2,size/2]}), zIndexOffset:hub?600:mine?400:0, riseOnHover:true});
    mk.bindTooltip(()=>airportTip(a),{direction:'top',offset:[0,-size/2]});
    mk.on('click',(e)=>{ L.DomEvent.stopPropagation(e); openAirport(code); });
    mk._sig=sig; mk.addTo(L_airports); airportMk.set(code,mk);
  }
  for(const [code,mk] of airportMk) if(!want.has(code)){ L_airports.removeLayer(mk); airportMk.delete(code); }
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
  const seen=new Set(), tNow=simNow();
  for(const ac of S.fleet){
    if(ac.status!=='flight' || !ac.flight) continue;
    const st=flightState(ac, tNow); if(!st) continue;
    seen.add(ac.id);
    let mk=planeMarkers.get(ac.id);
    const pos=[st.lat,st.lon];
    if(!mk){
      const m=modelOf(ac), cat=planeCat(m);
      const base = cat==='quad'?34 : cat==='wb'?31 : cat==='conc'?28 : cat==='nb'?26 : 22;
      const D=acDims(m, st.lat, map.getZoom()>=12? 20 : base*zoomScale()), sz=Math.max(D.w,D.h); // vue aéroport : taille réelle
      mk=L.marker(pos,{icon:L.divIcon({className:'plane-icon'+(D.real?' real':''), html:`<div class="rot" style="width:${sz}px;height:${sz}px;display:grid;place-items:center">${PLANE_SVG(planeColor(ac),D.w,cat,D.h)}</div>`, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2]}), zIndexOffset:1000});
      mk.bindTooltip('',{direction:'right',offset:[14,0],className:'flight-tip'});
      mk.on('tooltipopen',()=>{ const s2=flightState(ac); if(s2) mk.setTooltipContent(flightTipHtml(ac,s2)); });
      mk.on('click',(e)=>{ L.DomEvent.stopPropagation(e); selectPlane(ac.id); });
      mk.addTo(L_planes); planeMarkers.set(ac.id,mk);
    } else mk.setLatLng(pos);
    mk._ac=ac;
    const el=mk.getElement();
    if(el){ const rot=mk._rot||(mk._rot=el.querySelector('.rot')); if(rot){ setRot(rot,st.hdg); const sh=Math.min(9,1+st.alt/1500)*Math.min(1.6,zoomScale()); if(Math.abs((rot._sh||0)-sh)>0.2){ rot._sh=sh; rot.style.setProperty('--sh',sh.toFixed(1)+'px'); } } el.classList.toggle('ground', st.phase<=1||st.phase>=8); el.classList.toggle('sel', selectedPlane===ac.id); }
    updateTrail(ac,st);
    if(mk.isTooltipOpen()) mk.setTooltipContent(flightTipHtml(ac,st));
  }
  for(const [id,mk] of planeMarkers){ if(!seen.has(id)){ L_planes.removeLayer(mk); planeMarkers.delete(id); if(selectedPlane===id) selectPlane(null); } }
  for(const [id,t] of trails){ if(!seen.has(id)){ L_trails.removeLayer(t.line); if(t.ahead) L_trails.removeLayer(t.ahead); trails.delete(id); } }
  updateParked();
  updateFlightCard();
}
function fmtLocal(t, code){ const u=AP(code)&&AP(code).utc; return (u===''||u===undefined||u===null)? fmtTime(t)+' UTC' : fmtTime(t+u*HOUR)+' loc.'; }
function flightTipHtml(ac,st){
  const m=modelOf(ac);
  const ft=Math.round(st.alt*3.28084/100)*100, fl=st.alt>3000? 'FL'+String(Math.round(ft/1000)*10).padStart(3,'0') : num(ft)+' ft';
  const kind = ac.flight.kind==='ferry'?'Convoyage':ac.flight.kind==='cargo'?'Contrat cargo':'Vol commercial';
  const w=st.wind||0, cruise=st.phase>=3&&st.phase<=5;
  return `<b>${S.company.code}${flightNumber(ac)} · ${ac.reg}</b> <span class="mut">${m.name}</span><br>`+
    `${st.origin} → ${st.dest} <span class="mut">(${kind})</span><br>`+
    `Phase : <b>${st.holding?(st.holding==='out'?'⏸ Attente au point d’arrêt (piste occupée)':'🔄 Circuit d’attente (piste occupée)'):PHASES[st.phase]}</b>${st.depRwy||st.arrRwy?` <span class="mut">· piste ${st.depRwy||'—'} → ${st.arrRwy||'—'}</span>`:''}<br>`+
    `Altitude : <b>${fl}</b> · Vitesse sol : <b>${Math.round(cruise?st.gs:st.spd)} km/h</b>${cruise&&Math.abs(w)>=10?` <span class="${w>0?'pos':'neg'}">(vent ${w>0?'arrière +':'de face '}${w} km/h)</span>`:''}<br>`+
    `Reste : <b>${num(st.remain||0)} km</b> <span class="mut">(${num((st.remain||0)/1.852)} NM)</span> · Cap ${String(Math.round(st.hdg)).padStart(3,'0')}°<br>`+
    `Arrivée : <b>${fmtLocal(st.eta,st.dest)}</b> <span class="mut">(${fmtTime(st.eta)} UTC, dans ${fmtDur(st.eta-S.time)})</span> · <b>${Math.round(st.progress*100)} %</b>`+
    `<div class="pbar"><i style="width:${(st.progress*100).toFixed(1)}%"></i></div>`;
}
function flightNumber(ac){ let h=0; for(const c of ac.id) h=(h*31+c.charCodeAt(0))%900; return 100+h; }
function selectPlane(id){
  selectedPlane=id; if(!id) followPlane=false;
  updateFlightCard();
  if(id){ const st=flightState(S.fleet.find(a=>a.id===id)); if(st) map.panTo([st.lat,st.lon]); }
}
// La carte du vol n'est reconstruite que si l'avion change ; le reste est mis à jour en place (pas de clignotement)
let _fcKey='', _fcAt=0;
function updateFlightCard(){
  const box=document.getElementById('flightcard');
  const ac=selectedPlane && S.fleet.find(a=>a.id===selectedPlane);
  if(!ac||!ac.flight){ box.hidden=true; _fcKey=''; return; }
  const st=flightState(ac, simNow()); if(!st){ box.hidden=true; _fcKey=''; return; }
  const key=ac.id+'|'+followPlane+'|'+ac.flight.li+'|'+ac.flight.legs[0].dep, now=performance.now();
  if(key!==_fcKey){
    _fcKey=key; _fcAt=0;
    box.innerHTML=`<button class="x" data-act="closeCard">×</button>`+(typeof photoHtml==='function'?photoHtml(modelOf(ac),'banner'):'')+`<div class="fc-live"></div>`+
      `<div class="btns sm"><button class="btn sm ${followPlane?'gold':''}" data-act="followCam">🎥 ${followPlane?'Caméra attachée':'Suivre l’avion'}</button><button class="btn sm" data-act="zoomPlane">🔍 Zoom</button><button class="btn sm" data-act="zoomRoute">🧭 Trajet</button><button class="btn sm gold" data-act="view3D" data-id="${ac.id}">🎥 Vue 3D</button><button class="btn sm" data-act="manifest" data-id="${ac.id}">📋 Passagers</button></div><div class="fc-leg"></div>`;
    if(typeof hydratePhotos==='function') hydratePhotos();
  }
  box.hidden=false;
  if(now-_fcAt<450) return; _fcAt=now;
  const legs=ac.flight.legs, pax=legs[ac.flight.li].pax;
  const paxTxt = pax? `${pax.f+pax.j+pax.w+pax.y} passagers (F${pax.f} · J${pax.j} · W${pax.w} · Y${pax.y})` : legs[ac.flight.li].cargo? `${legs[ac.flight.li].cargo} t de fret` : '';
  box.querySelector('.fc-live').innerHTML=flightTipHtml(ac,st);
  const legHtml=`<div class="mut" style="margin-top:4px">Tronçon ${ac.flight.li+1}/${legs.length} : ${AP(st.from).city} → ${AP(st.to).city} · ${Math.round(st.leg.dist)} km</div>`+
    (paxTxt?`<div>${paxTxt}</div>`:'')+
    `<div class="phases">${PHASES.map((p,i)=>`<span class="${i<st.phase?'done':i===st.phase?'cur':''}">${p}</span>`).join('')}</div>`;
  const lg=box.querySelector('.fc-leg'); if(lg._h!==legHtml){ lg._h=legHtml; lg.innerHTML=legHtml; }
}

/* ---------- traînées de condensation ---------- */
const trails=new Map(); let L_trails;
function updateTrail(ac,st){
  if(!MAPOPT.trails) return;
  let t=trails.get(ac.id);
  const now=performance.now();
  if(t && now-t.at<900 && t.li===ac.flight.li) return;
  const leg=st.leg, path=legPath(leg,modelOf(ac)), s=(st.frac||0)*path.total;
  if(st.phase<=1) return;
  const pts=[]; let prev=path.air[0].lon;
  const push=p=>{ const lon=unwrapLon(p.lon,prev); pts.push([p.lat,lon]); prev=lon; };
  for(let i=0;i<path.air.length && path.cum[i]<s;i++) push(path.air[i]);
  push({lat:st.lat,lon:st.lon});
  const sel=selectedPlane===ac.id;
  if(!t){ t={line:L.polyline(pts,{color:'#ffffff',weight:sel?3:2,opacity:0.55,className:'trail',interactive:false}).addTo(L_trails)}; trails.set(ac.id,t); }
  else t.line.setLatLngs(pts);
  if(sel){
    const ahead=[[st.lat,pts[pts.length-1][1]]]; let pv=pts[pts.length-1][1];
    for(let i=0;i<path.air.length;i++) if(path.cum[i]>s){ const lon=unwrapLon(path.air[i].lon,pv); ahead.push([path.air[i].lat,lon]); pv=lon; }
    if(!t.ahead) t.ahead=L.polyline(ahead,{color:'#ff2bd6',weight:2.5,opacity:0.9,dashArray:'6 8',interactive:false}).addTo(L_trails); else t.ahead.setLatLngs(ahead);
  } else if(t.ahead){ L_trails.removeLayer(t.ahead); t.ahead=null; }
  t.at=now; t.li=ac.flight.li;
}

/* ---------- avions stationnés ---------- */
function updateParked(){
  const z=map.getZoom(), show = z>=7, real = z>=13;
  const want=new Map();
  if(show){
    const byAp={};
    for(const ac of S.fleet){ if(ac.status==='flight'||ac.status==='manual') continue; (byAp[ac.loc]=byAp[ac.loc]||[]).push(ac); }
    for(const [code,list] of Object.entries(byAp)){
      // au zoom rapproché : chaque avion sur son poste de stationnement réel (rangée le long de la piste)
      const used=new Set();
      list.slice().sort((a,b)=>a.id<b.id?-1:1).forEach((ac,i)=>{ let k=8+acSlotHash(ac.id)%14; while(used.has(k)) k++; used.add(k); want.set(ac.id,{ac,code,i,k}); });
    }
  }
  for(const [id,mk] of parkedMarkers){ const w=want.get(id); if(!w || mk._code!==w.code || mk._i!==(real?w.k:w.i) || mk._st!==w.ac.status || mk._real!==real){ L_planes.removeLayer(mk); parkedMarkers.delete(id); } }
  for(const [id,{ac,code,i,k}] of want){
    if(parkedMarkers.has(id)) continue;
    const a=AP(code), m=modelOf(ac);
    let mk;
    const tip=`<b>${ac.reg}</b> ${m.name}<br>${ac.status==='maint'?'🔧 En maintenance':'Au sol'} à ${a.city}`;
    if(real){
      const sp=slotPt(code,k), D=acDims(m,sp.lat,10), zz=Math.max(D.w,D.h);
      mk=L.marker([sp.lat,sp.lon],{icon:L.divIcon({className:'plane-icon parked'+(D.real?' real':'')+(ac.status==='maint'?' maint':''),html:`<div class="rot" style="transform:rotate(${sp.hdg}deg);--sh:1px;width:${zz}px;height:${zz}px;display:grid;place-items:center">${PLANE_SVG(m.color||S.company.color,D.w,planeCat(m),D.h)}</div>`,iconSize:[zz,zz],iconAnchor:[zz/2,zz/2]}),zIndexOffset:800});
      mk._i=k;
    } else {
      const D=acDims(m,a.lat,14*zoomScale()), zz=Math.max(D.w,D.h), ang=i*0.9+0.6, rad=zz*0.9+i*zz*0.25;
      const dx=Math.cos(ang)*rad, dy=Math.sin(ang)*rad;
      mk=L.marker([a.lat,a.lon],{icon:L.divIcon({className:'plane-icon parked'+(ac.status==='maint'?' maint':''),html:`<div class="rot" style="transform:rotate(${(i*47)%360}deg);--sh:1px;width:${zz}px;height:${zz}px;display:grid;place-items:center">${PLANE_SVG(m.color||S.company.color,D.w,planeCat(m),D.h)}</div>`,iconSize:[zz,zz],iconAnchor:[zz/2-dx,zz/2-dy]}),zIndexOffset:800});
      mk._i=i;
    }
    mk.bindTooltip(tip,{direction:'top'}).on('click',e=>{ L.DomEvent.stopPropagation(e); setTab('fleet'); });
    mk._code=code; mk._st=ac.status; mk._real=real;
    mk.addTo(L_planes); parkedMarkers.set(id,mk);
  }
}

/* ---------- avions du rival ---------- */
// Marqueurs conservés d'une image à l'autre et déplacés en douceur (plus de reconstruction chaque seconde)
const rivalPool=new Map();
// Les avions des autres compagnies suivent le même profil que les vôtres : roulage, décollage dans l'axe
// de la vraie piste, montée, croisière, approche, atterrissage, dégagement et roulage jusqu'au poste.
const TRAFFIC_MODEL={prop:'AT76', nb:'A20N', wb:'B789'};
function rivalPos(r,i,t){
  const A=AP(r.a), B=AP(r.b); if(!A||!B) return null;
  // tout ce qui ne dépend pas de l'heure est calculé une seule fois par ligne
  let K=r._tk; if(K&&K.c!==(r.c||'')) K=null;
  if(!K){ const d=gcDist(A,B), cat=d<1200?'prop':d<5000?'nb':'wb', m=getModel(TRAFFIC_MODEL[cat]); if(!m) return null;
    const pA=legProfile(d,m,0,r.a,r.b), pB=legProfile(d,m,0,r.b,r.a), turn=55*MIN;
    K=r._tk={c:r.c||'',d,cat,m,pA,pB,turn,T:pA.total+pB.total+2*turn,h:hashStr(r.a+r.b+(r.c||''))*1000,AB:null,BA:null}; }
  const d=K.d, cat=K.cat, m=K.m, pA=K.pA, pB=K.pB, turn=K.turn, T=K.T, cnt=Math.max(1,Math.min(r.freq||1,5));
  let rel=((t+i*T/cnt+K.h)%T+T)%T, from=r.a, to=r.b, prof=pA, dir='AB';
  if(rel>=pA.total+turn){ rel-=pA.total+turn; from=r.b; to=r.a; prof=pB; dir='BA'; }
  if(rel>=prof.total) return null;                    // au poste, entre deux vols
  const seg=prof.segs.find(x=>rel<x.t1)||prof.segs[prof.segs.length-1];
  if(seg.ph===0) return null;                         // embarquement : avion au poste
  const u=seg.t1>seg.t0? clamp((rel-seg.t0)/(seg.t1-seg.t0),0,1) : 1;
  let uD=u, alt=seg.a0+(seg.a1-seg.a0)*u;
  if(seg.ph===2){ const R=0.45; if(u<R){ const k=u/R; uD=0.4*k*k; alt=0; } else { const k=(u-R)/(1-R); uD=0.4+0.6*k; alt=seg.a1*Math.pow(k,1.3); } }
  else if(seg.ph===7){ uD=1-(1-u)*(1-u); alt=u<0.12? seg.a0*Math.pow(1-u/0.12,1.6) : 0; }
  let pp;
  if(seg.ph===4){ // croisière : grand cercle direct (pas besoin du tracé des pistes, bien plus rapide)
    const F=AP(from), Tt=AP(to), f=clamp((seg.d0+(seg.d1-seg.d0)*u)/d,0,1), a=gcInterp(F,Tt,f), b2=gcInterp(F,Tt,Math.min(1,f+0.002));
    return {p:{lat:a.lat,lon:a.lon}, hdg:bearing(a,b2), from:F, to:Tt, d, alt, ph:4, gnd:false, cat};
  }
  const path=K[dir]||(K[dir]=legPath({from,to,dist:d},m)), fake={id:r.a+r.b+i};
  // contrôle aérien : une seule machine sur la piste — sinon on attend
  if((seg.ph===2||seg.ph===7||(seg.ph===6&&alt<300))&&typeof atcRivalBlocked==='function'){
    const dep=seg.ph===2, rw=dep?path.dep:path.arr;
    if(rw&&atcRivalBlocked(rwyKey(dep?from:to,rw),r.a+r.b+(r.c||'')+i+dir,t)){
      if(dep){ const hp=holdPoint(path,gateSlot(from,fake),1+hashStr(r.a+r.b+(r.c||'')+i)%4); return {p:{lat:hp.lat,lon:hp.lon}, hdg:hp.hdg, from:AP(from), to:AP(to), d, alt:0, ph:1, gnd:true, cat, holding:'out'}; }
      const s6=prof.segs.find(x=>x.ph===6), f=pointOnPath(path,clamp(s6.d0/d,0,1)*path.total), c=destPt(f.lat,f.lon,(f.hdg||0)+90,4.5), b0=bearing(c,f), th=(t/(4*MIN)*360)%360, q2=destPt(c.lat,c.lon,b0+th,4.5);
      return {p:{lat:q2.lat,lon:q2.lon}, hdg:(b0+th+90)%360, from:AP(from), to:AP(to), d, alt:900+305*(1+hashStr(r.a+r.b+(r.c||'')+i)%5), ph:6, gnd:false, cat, holding:'in'};
    }
  }
  if(seg.ph===1) pp=polyAt(taxiOutPts(path,gateSlot(from,fake)),u);
  else if(seg.ph>=8) pp=polyAt(taxiInPts(path,gateSlot(to,fake)),u);
  else { const dd=seg.d0+(seg.d1-seg.d0)*uD; pp=pointOnPath(path, clamp(dd/d,0,1)*path.total); }
  return {p:{lat:pp.lat,lon:pp.lon}, hdg:pp.hdg, from:AP(from), to:AP(to), d, alt, ph:seg.ph, gnd:alt<5, cat};
}
const phaseLbl=q=>q.holding==='out'?'⏸ attend la piste':q.holding==='in'?'🔄 attente':q.ph===2?(q.gnd?'🛫 décolle':'🛫 décollage'):q.ph===7?(q.gnd?'🛬 atterrit':'🛬 toucher'):(q.ph===6&&q.alt<450)?'🛬 finale':'';
function routeBBox(r){
  if(r._bb) return r._bb;
  const A=AP(r.a), B=AP(r.b); let minLat=1e9,maxLat=-1e9,minLon=1e9,maxLon=-1e9, prev=A.lon;
  for(let i=0;i<=12;i++){ const p=gcInterp(A,B,i/12), lon=unwrapLon(p.lon,prev); prev=lon;
    if(p.lat<minLat)minLat=p.lat; if(p.lat>maxLat)maxLat=p.lat; if(lon<minLon)minLon=lon; if(lon>maxLon)maxLon=lon; }
  return r._bb={minLat:minLat-3,maxLat:maxLat+3,minLon:minLon-3,maxLon:maxLon+3};
}
/* Les avions des autres compagnies sont dessinés sur UN canvas (au lieu de centaines d'éléments HTML) : la carte reste fluide. */
let rivalCv=null, rivalCtx=null, rivalHover=null, rivalTipLayer=null, _rvDirty=false;
const spriteCache=new Map();
function rivalSprite(color,cat){
  const k=color+'|'+cat; let sp=spriteCache.get(k); if(sp) return sp.ok? sp.img : null;
  const img=new Image(); sp={img,ok:false}; spriteCache.set(k,sp);
  img.onload=()=>{ const c=document.createElement('canvas'); c.width=c.height=64; c.getContext('2d').drawImage(img,0,0,64,64); sp.img=c; sp.ok=true; _rvDirty=true; };   // pré-rastérisé : dessin très rapide
  const body=SHAPES[cat]().replace(/class="b"/g,`fill="${color}" stroke="#0b1220" stroke-width="1.1" stroke-linejoin="round"`);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${body}<rect x="31.1" y="7" width="1.8" height="38" rx=".9" fill="#fff" opacity=".35"/></svg>`;
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  return null;
}
function initRivalCanvas(){
  const host=document.getElementById('map'); if(!host||rivalCv) return;
  rivalCv=document.createElement('canvas'); rivalCv.className='rival-canvas'; host.appendChild(rivalCv); rivalCtx=rivalCv.getContext('2d');
  const fit=()=>{ const r=host.getBoundingClientRect(), d=Math.min(2,window.devicePixelRatio||1); rivalCv.width=Math.round(r.width*d); rivalCv.height=Math.round(r.height*d); rivalCv._d=d; _rvDirty=true; };
  fit(); window.addEventListener('resize',fit); map.on('resize',fit);
  map.on('move',()=>{ _rvDirty=true; });
  map.on('zoomstart',()=>{ rivalCv.style.visibility='hidden'; });   // pendant l'animation de zoom, on masque (réapparaît net à la fin)
  map.on('zoomend',()=>{ rivalCv.style.visibility='visible'; _rvDirty=true; });
  // survol / toucher : infobulle de l'avion le plus proche
  const pick=(pt)=>{ let best=null, bd=18*18; for(const e of rivalPool.values()){ if(e.px===undefined) continue; const dx=e.px-pt.x, dy=e.py-pt.y, d=dx*dx+dy*dy; if(d<bd){ bd=d; best=e; } } return best; };
  const show=(e)=>{ if(rivalHover===e) return; rivalHover=e; if(rivalTipLayer){ map.removeLayer(rivalTipLayer); rivalTipLayer=null; }
    if(e) rivalTipLayer=L.tooltip({permanent:true,direction:'right',offset:[10,0],className:'flight-tip',interactive:false}).setLatLng([e.lat,e.lon]).setContent(rivalTip(e)).addTo(map); };
  map.on('mousemove',ev=>{ if(map._mv) return; const e=pick(ev.containerPoint); host.style.cursor=e?'pointer':''; show(e); });
  map.on('click',ev=>{ const e=pick(ev.containerPoint); if(e){ show(e); setTimeout(()=>{ if(rivalHover===e) show(null); },3500); } });
  map.on('movestart zoomstart',()=>show(null));
}
function drawRivals(){
  if(!rivalCtx||!map) return; _rvDirty=false;
  const g=rivalCtx, d=rivalCv._d||1; g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,rivalCv.width,rivalCv.height);
  if(!MAPOPT.rival||!rivalPool.size) return;
  const sz=Math.round(19*zoomScale()), W=rivalCv.width/d, H=rivalCv.height/d; g.setTransform(d,0,0,d,0,0);
  for(const e of rivalPool.values()){
    const p=map.latLngToContainerPoint([e.lat,e.lon]); e.px=p.x; e.py=p.y;
    if(p.x<-30||p.y<-30||p.x>W+30||p.y>H+30) continue;
    const img=rivalSprite(e.R.color,e.cat); if(!img) continue;
    const k=e.gnd?0.72:1, z=Math.round(sz*k);
    g.save(); g.translate(p.x,p.y); g.rotate(e.hdg*Math.PI/180); g.globalAlpha=e.gnd?1:0.92; g.drawImage(img,-z/2,-z/2,z,z); g.restore();
    if(e.lbl&&sz>=22){ g.font='600 10px system-ui'; g.fillStyle='#fff'; g.strokeStyle='rgba(0,0,0,.75)'; g.lineWidth=3; g.strokeText(e.lbl,p.x+z/2+2,p.y+3); g.fillText(e.lbl,p.x+z/2+2,p.y+3); }
  }
}
function clearRivals(){ rivalPool.clear(); rivalHover=null; _rvDirty=true; }
function setRivalSize(){ _rvDirty=true; }
function rivalTip(e){ const q=rivalPos(e.r,e.i,simNow()); if(!q) return `<b>${e.R.name}</b>`; const mn=typeof realMinutes==='function'?realMinutes(e.r.a,e.r.b):0;
  return `<b>${e.R.name}</b> <span class="mut">${e.R.code}</span><br>${q.from.city} (${q.from.code}) → ${q.to.city} (${q.to.code})<br>${PHASES[q.ph]}${q.gnd?'':` · ${num(Math.round(q.alt*3.28/100)*100)} ft`}<br><span class="mut">${num(q.d)} km${mn?` · vol réel ≈ ${fmtDur(mn*MIN)}`:''}</span>`; }
function updateRival(){
  if(!map) return;
  if(!MAPOPT.rival || !S.rivals){ if(rivalPool.size) clearRivals(); return; }
  const bounds=map.getBounds().pad(0.3), t=simNow(), c0=map.getCenter().lng, want=new Set();
  let n=0;
  // vos concurrents suivis + toutes les compagnies réelles qui desservent les aéroports à l'écran
  const list=[]; for(const R of S.rivals) for(const r of R.routes){ if(!r.c) r.c=R.code; list.push({R,r}); }
  if(map.getZoom()>=4 && typeof visibleRealRoutes==='function') list.push(...visibleRealRoutes(map.getBounds().pad(0.1), c0, map.getZoom()>=7?20:45));
  const cap=map.getZoom()>=6?220:160;
  const vb=bounds, W=vb.getWest(), E=vb.getEast(), So=vb.getSouth(), No=vb.getNorth();
  outer: for(const {R,r} of list){
    const bb=routeBBox(r);   // ligne entièrement hors de l'écran : on ne calcule rien
    if(bb.maxLat<So||bb.minLat>No||![-360,0,360].some(o=>bb.maxLon+o>=W&&bb.minLon+o<=E)) continue;
    const cnt=typeof routeMoodFreq==='function'? Math.min(routeMoodFreq(r),5) : Math.min(r.freq,3);
    for(let i=0;i<cnt;i++){
      const q=rivalPos(r,i,t); if(!q) continue;
      const lon=unwrapLon(q.p.lon,c0);
      if(!bounds.contains([q.p.lat,lon])) continue;
      if(n++>cap) break outer;
      const key=R.code+'|'+r.a+'|'+r.b+'|'+i; if(want.has(key)) continue; want.add(key);
      let e=rivalPool.get(key);
      if(!e){ e={R,r,i,cat:q.d<1200?'prop':q.d<5000?'nb':'wb'}; rivalPool.set(key,e); }
      e.lat=q.p.lat; e.lon=lon; e.hdg=q.hdg; e.gnd=q.gnd; e.lbl=phaseLbl(q);
    }
  }
  for(const k of rivalPool.keys()) if(!want.has(k)) rivalPool.delete(k);
  _rvDirty=true;
}
function animateRivals(t,b){
  for(const e of rivalPool.values()){
    const q=rivalPos(e.r,e.i,t); if(!q) continue;
    e.lat=q.p.lat; e.lon=unwrapLon(q.p.lon,e.lon); e.hdg=q.hdg; e.gnd=q.gnd; e.lbl=phaseLbl(q);
  }
  _rvDirty=true;
}
/* ---------- animation fluide (60 images/s) ---------- */
// Rotation sans « tour complet » quand le cap passe de 359° à 1°
function setRot(el,h){ const a=el._a===undefined?h:el._a, d=((h-a)%360+540)%360-180; if(Math.abs(d)<0.2&&el._a!==undefined) return; el._a=a+d; el.style.transform=(el._pre||'')+`rotate(${el._a.toFixed(1)}deg)`; }
// Heure de jeu affichée : interpolée entre deux pas de simulation
let _clk={perf:0,t:-1};
function simNow(){
  if(!S) return 0; const now=performance.now();
  if(_clk.t!==S.time) _clk={perf:now,t:S.time};
  if(S.paused) return S.time;
  return S.time + Math.min(now-_clk.perf,450)*SPEEDS[S.speed].mult;
}
let _rafT=0;
function animateFrame(now){
  requestAnimationFrame(animateFrame);
  if(!map||!S||document.hidden||map._animatingZoom) return;
  const n=planeMarkers.size+rivalPool.size, gap=n>260?50:n>120?30:15;
  if(now-_rafT<gap) return; _rafT=now;
  const t=simNow(), b=map.getBounds().pad(0.4);
  for(const [id,mk] of planeMarkers){
    const ac=mk._ac; if(!ac||!ac.flight) continue;
    if(id!==selectedPlane && !b.contains(mk.getLatLng())) continue;
    const st=flightState(ac,t); if(!st) continue;
    mk.setLatLng([st.lat,st.lon]); if(mk._rot) setRot(mk._rot,st.hdg);
  }
  if(!map._mv) animateRivals(t,b);
  if(_rvDirty) drawRivals();
  if(followPlane&&selectedPlane){ const mk=planeMarkers.get(selectedPlane); if(mk) map.panTo(mk.getLatLng(),{animate:false}); }
}
function hashStr(s){ let h=0; for(const c of s) h=(h*131+c.charCodeAt(0))%100000; return h; }

function zoomPlane(){ const ac=S.fleet.find(a=>a.id===selectedPlane), st=ac&&flightState(ac); if(st) map.flyTo([st.lat,st.lon],Math.max(map.getZoom(),st.phase<=1||st.phase>=7?14:8),{duration:1}); }
function zoomRoute(){ const ac=S.fleet.find(a=>a.id===selectedPlane); if(!ac?.flight) return; const pts=ac.flight.legs.flatMap(l=>[[AP(l.from).lat,AP(l.from).lon],[AP(l.to).lat,unwrapLon(AP(l.to).lon,AP(l.from).lon)]]); map.flyToBounds(pts,{padding:[60,60],duration:1}); }
function focusDRC(){ focusCountry('CD'); }
function focusCountry(cc){
  const pts=countryAirports(cc).slice(0,60).map(c=>[AP(c).lat,AP(c).lon]);
  if(!pts.length) return;
  if(pts.length===1) return map.flyTo(pts[0],7,{duration:1.2});
  map.flyToBounds(pts,{padding:[40,40],maxZoom:7,duration:1.2});
}
function focusAirport(code){ const a=AP(code), rws=runwaysOf(code); if(!rws.length) return map.flyTo([a.lat,a.lon],13,{duration:1.2}); const pts=rws.flatMap(r=>[[r.thr.lat,r.thr.lon],[r.end.lat,r.end.lon]]); const pn=document.getElementById('panel'), pw=(!UI.mobile&&pn&&pn.offsetWidth)||0; map.flyToBounds(pts,{paddingTopLeft:[150,60],paddingBottomRight:[pw+40,60],maxZoom:15,duration:1.2}); }
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
