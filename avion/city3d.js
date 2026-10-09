/* =========================================================
   Sky Empire — Ville 3D (MapLibre GL + OpenFreeMap)
   Bâtiments OSM extrudés en 3D, monuments célèbres modélisés,
   vos avions en direct. Chargé seulement à la demande pour que
   la carte 2D reste fluide.
   ========================================================= */
'use strict';
const ML_BASE='https://unpkg.com/maplibre-gl@4.7.1/dist/';
const CITY_STYLE='https://tiles.openfreemap.org/styles/liberty';
let CITY=null;

function loadMapLibre(){
  if(window.maplibregl) return Promise.resolve();
  if(loadMapLibre.p) return loadMapLibre.p;
  loadMapLibre.p=new Promise((res,rej)=>{
    const l=document.createElement('link'); l.rel='stylesheet'; l.href=ML_BASE+'maplibre-gl.css'; document.head.appendChild(l);
    const s=document.createElement('script'); s.src=ML_BASE+'maplibre-gl.js'; s.onload=res; s.onerror=()=>{ loadMapLibre.p=null; rej(new Error('maplibre')); }; document.head.appendChild(s);
  });
  return loadMapLibre.p;
}

/* ---------- monuments : [nom, ville, lat, lon, parties, couleur]
   partie = [forme, demi-largeur(m), base(m), sommet(m), dx(m), dy(m), demi-longueur(m)]
   forme : s = carré/rectangle, c = cylindre, r = anneau (arène) ---------- */
const LANDMARKS=[
  // Kinshasa
  ['Tour de l’Échangeur (Limete)','Kinshasa',-4.3586,15.3330,[['s',22,0,40],['s',9,40,210]],'#e5e7eb'],
  ['Palais du Peuple','Kinshasa',-4.3311,15.3089,[['s',60,0,28,0,0,38]],'#f1f5f9'],
  ['Stade des Martyrs','Kinshasa',-4.3317,15.3008,[['r',140,0,42]],'#cbd5e1'],
  ['Tour Sozacom','Kinshasa',-4.3054,15.3123,[['s',18,0,85,0,0,24]],'#94a3b8'],
  ['Hôtel Fleuve Congo','Kinshasa',-4.2983,15.3044,[['s',20,0,100,0,0,30]],'#e2e8f0'],
  ['Cathédrale Notre-Dame du Congo','Kinshasa',-4.3216,15.3058,[['s',22,0,22,0,0,40],['s',7,22,38,0,-30]],'#fef3c7'],
  ['Gare centrale de Kinshasa','Kinshasa',-4.3036,15.3155,[['s',15,0,18,0,0,60]],'#fde68a'],
  ['Mausolée Laurent-Désiré Kabila','Kinshasa',-4.3122,15.3049,[['c',16,0,14],['c',6,14,24]],'#f8fafc'],
  ['Tour Nabemba','Brazzaville',-4.2668,15.2834,[['c',18,0,106]],'#cbd5e1'],
  // Afrique
  ['Grande Pyramide de Khéops','Le Caire',29.9792,31.1342,[['s',115,0,30],['s',86,30,60],['s',58,60,90],['s',30,90,120],['s',8,120,139]],'#e9c88a'],
  ['Mosquée Hassan II','Casablanca',33.6084,-7.6326,[['s',100,0,40,0,0,60],['s',13,40,210,-90,0]],'#fef9c3'],
  ['Monument de la Renaissance africaine','Dakar',14.7222,-17.4951,[['s',15,0,52]],'#b45309'],
  ['KICC','Nairobi',-1.2887,36.8233,[['c',22,0,105]],'#c2410c'],
  ['Tour Hillbrow','Johannesburg',-26.1908,28.0499,[['c',9,0,250],['c',16,190,215]],'#e5e7eb'],
  ['Kigali Convention Centre','Kigali',-1.9547,30.0928,[['c',40,0,58],['c',22,58,68]],'#fbbf24'],
  // Europe
  ['Tour Eiffel','Paris',48.8584,2.2945,[['s',62,0,57],['s',35,57,115],['s',12,115,276],['s',4,276,330]],'#8b6b3d'],
  ['Arc de Triomphe','Paris',48.8738,2.2950,[['s',22,0,50,0,0,12]],'#f5f0e1'],
  ['Notre-Dame de Paris','Paris',48.8530,2.3499,[['s',24,0,35,0,0,64],['s',10,35,69,0,40],['s',3,35,96,0,-10]],'#e7dcc5'],
  ['Tour Montparnasse','Paris',48.8421,2.3220,[['s',25,0,210,0,0,32]],'#334155'],
  ['Sacré-Cœur','Paris',48.8867,2.3431,[['s',30,0,40,0,0,40],['c',14,40,83]],'#ffffff'],
  ['Big Ben','Londres',51.5007,-0.1246,[['s',6,0,96]],'#c8a96a'],
  ['The Shard','Londres',51.5045,-0.0865,[['s',30,0,100],['s',22,100,200],['s',12,200,280],['s',4,280,310]],'#a5c8e4'],
  ['Cathédrale Saint-Paul','Londres',51.5138,-0.0984,[['s',35,0,30,0,0,80],['c',20,30,111]],'#e7e5e4'],
  ['Colisée','Rome',41.8902,12.4922,[['r',90,0,48]],'#d6b98c'],
  ['Basilique Saint-Pierre','Vatican',41.9022,12.4539,[['s',70,0,45,0,0,100],['c',22,45,136,0,30]],'#f5f0e1'],
  ['Porte de Brandebourg','Berlin',52.5163,13.3777,[['s',33,0,26,0,0,6]],'#e7dcc5'],
  ['Fernsehturm','Berlin',52.5208,13.4094,[['c',5,0,368],['c',16,200,230]],'#e2e8f0'],
  ['Sagrada Família','Barcelone',41.4036,2.1744,[['s',45,0,60,0,0,75],['c',8,60,172]],'#d6b98c'],
  ['Sainte-Sophie','Istanbul',41.0086,28.9802,[['s',40,0,30],['c',16,30,55]],'#f0a77d'],
  ['Tour Ostankino','Moscou',55.8197,37.6117,[['c',20,0,60],['c',6,60,540]],'#e2e8f0'],
  ['Tour Spasskaïa (Kremlin)','Moscou',55.7525,37.6231,[['s',9,0,71]],'#b91c1c'],
  // Amériques
  ['Empire State Building','New York',40.7484,-73.9857,[['s',60,0,80,0,0,45],['s',35,80,320],['s',8,320,443]],'#cbd5e1'],
  ['One World Trade Center','New York',40.7127,-74.0134,[['s',31,0,415],['s',4,415,541]],'#93c5fd'],
  ['Chrysler Building','New York',40.7516,-73.9755,[['s',30,0,240],['s',12,240,282],['s',3,282,319]],'#e5e7eb'],
  ['Statue de la Liberté','New York',40.6892,-74.0445,[['s',20,0,47],['c',5,47,93]],'#5eead4'],
  ['Tour CN','Toronto',43.6426,-79.3871,[['c',10,0,553],['c',20,330,350]],'#e2e8f0'],
  ['Washington Monument','Washington',38.8895,-77.0353,[['s',8,0,169]],'#f8fafc'],
  ['Capitole','Washington',38.8899,-77.0091,[['s',30,0,30,0,0,115],['c',18,30,88]],'#ffffff'],
  ['Christ Rédempteur','Rio de Janeiro',-22.9519,-43.2105,[['s',4,0,700],['s',14,690,700,0,0,2]],'#f1f5f9'],
  // Moyen-Orient & Asie
  ['Burj Khalifa','Dubaï',25.1972,55.2744,[['s',45,0,240],['s',30,240,450],['s',18,450,600],['s',7,600,828]],'#cbd5e1'],
  ['Burj Al Arab','Dubaï',25.1412,55.1853,[['s',30,0,321,0,0,15]],'#f8fafc'],
  ['Abraj Al Bait (Tour de l’Horloge)','La Mecque',21.4189,39.8262,[['s',70,0,250],['s',25,250,450],['s',10,450,601]],'#e7dcc5'],
  ['Tours Petronas','Kuala Lumpur',3.1579,101.7116,[['c',23,0,380,-50,0],['c',23,0,380,50,0],['c',8,380,452,-50,0],['c',8,380,452,50,0]],'#cbd5e1'],
  ['Marina Bay Sands','Singapour',1.2834,103.8607,[['s',18,0,200,-90,0,30],['s',18,0,200,0,0,30],['s',18,0,200,90,0,30],['s',120,200,207,0,0,20]],'#e2e8f0'],
  ['Shanghai Tower','Shanghai',31.2335,121.5056,[['c',40,0,300],['c',30,300,560],['c',18,560,632]],'#93c5fd'],
  ['Taipei 101','Taipei',25.0340,121.5645,[['s',35,0,90],['s',27,90,450],['s',8,450,508]],'#86efac'],
  ['Tokyo Skytree','Tokyo',35.7101,139.8107,[['c',35,0,60],['c',12,60,634],['c',20,340,360]],'#e2e8f0'],
  ['Tour de Tokyo','Tokyo',35.6586,139.7454,[['s',40,0,60],['s',12,60,250],['s',4,250,333]],'#f97316'],
  ['Lotte World Tower','Séoul',37.5126,127.1025,[['s',35,0,400],['s',18,400,555]],'#e5e7eb'],
  ['Hôtel Ryugyong','Pyongyang',39.0364,125.7306,[['s',85,0,100],['s',60,100,200],['s',35,200,290],['s',12,290,330]],'#94a3b8'],
  ['Tour du Juche','Pyongyang',39.0177,125.7676,[['s',9,0,150],['s',4,150,170]],'#e7dcc5'],
  ['International Commerce Centre','Hong Kong',22.3033,114.1602,[['s',33,0,484]],'#93c5fd'],
  ['Taj Mahal','Agra',27.1751,78.0421,[['s',50,0,8],['c',18,8,73],['c',3,8,40,-38,-38],['c',3,8,40,38,38],['c',3,8,40,-38,38],['c',3,8,40,38,-38]],'#ffffff'],
  ['Opéra de Sydney','Sydney',-33.8568,151.2153,[['s',40,0,30,0,0,90],['s',25,30,65,0,-20,25]],'#ffffff'],
];

const CITY_SPOTS=[['Kinshasa',-4.3195,15.3070],['Paris',48.8566,2.3100],['Londres',51.5040,-0.1100],['New York',40.7300,-73.9950],['Dubaï',25.1950,55.2750],['Tokyo',35.6800,139.7700],['Le Caire',29.9792,31.1342],['Pyongyang',39.0300,125.7500],['Séoul',37.5126,127.1025],['Rome',41.8950,12.4800]];

function lmGeojson(){
  const feats=[], pts=[];
  for(const [name,city,lat,lon,parts,color] of LANDMARKS){
    const kx=1/(111320*Math.cos(lat*Math.PI/180)), ky=1/110540;
    const P=(dx,dy)=>[lon+dx*kx, lat+dy*ky];
    for(const [sh,w,b,t,dx=0,dy=0,l] of parts){
      let ring;
      if(sh==='s'){ const L=l||w; ring=[P(dx-w,dy-L),P(dx+w,dy-L),P(dx+w,dy+L),P(dx-w,dy+L),P(dx-w,dy-L)]; }
      else { ring=[]; for(let i=0;i<=24;i++){ const a=i/24*Math.PI*2; ring.push(P(dx+Math.cos(a)*w*(sh==='r'?1.2:1), dy+Math.sin(a)*w)); } }
      const coords=[ring];
      if(sh==='r'){ const inner=[]; for(let i=24;i>=0;i--){ const a=i/24*Math.PI*2; inner.push(P(dx+Math.cos(a)*w*0.75, dy+Math.sin(a)*w*0.55)); } coords.push(inner); }
      feats.push({type:'Feature',properties:{b,t,color},geometry:{type:'Polygon',coordinates:coords}});
    }
    pts.push({type:'Feature',properties:{name,city},geometry:{type:'Point',coordinates:[lon,lat]}});
  }
  return {poly:{type:'FeatureCollection',features:feats}, pts:{type:'FeatureCollection',features:pts}};
}

/* ---------- ouverture ---------- */
async function openCity(lat,lon){
  toast('🏙️ Chargement de la ville 3D…','info');
  try{ await loadMapLibre(); }catch(e){ toast('⛔ Impossible de charger la vue Ville 3D (connexion Internet ?)','bad'); return false; }
  if(lat==null){
    const c=map.getCenter(), z=map.getZoom();
    if(z>=9){ lat=c.lat; lon=c.lng; }
    else { const h=AP(S.company.hub)||{lat:-4.3195,lon:15.307}; lat=h.lat; lon=h.lon; if(S.company.hub==='FIH'){ lat=-4.3195; lon=15.307; } }
  }
  if(UI.mobile) setTab('map');
  document.body.classList.add('city-on');
  let el=$('#city'); if(!el){ el=document.createElement('div'); el.id='city'; $('#main').appendChild(el); }
  el.hidden=false;
  if(!CITY) initCity(lat,lon); else { CITY.map.resize(); CITY.map.jumpTo({center:[lon,lat],zoom:15.4,pitch:62}); if(!CITY.tick) CITY.tick=setInterval(cityPlanes,1000); cityPlanes(); }
  renderCityHud();
  return true;
}
function closeCity(){
  document.body.classList.remove('city-on');
  const el=$('#city'); if(el) el.hidden=true;
  const h=$('#cityHud'); if(h) h.hidden=true;
  if(CITY){ clearInterval(CITY.tick); CITY.tick=null; CITY.follow=null; }
  setTimeout(()=>map&&map.invalidateSize(),60);
}
function initCity(lat,lon){
  const M=new maplibregl.Map({container:'city', style:CITY_STYLE, center:[lon,lat], zoom:15.4, pitch:62, bearing:-20, maxPitch:80, antialias:true, attributionControl:{compact:true}});
  M.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'bottom-right');
  CITY={map:M, sat:false, planes:new Map(), tick:null, spin:false};
  M.on('load',()=>{
    const layers=M.getStyle().layers, firstSym=(layers.find(l=>l.type==='symbol')||{}).id;
    M.addSource('esri',{type:'raster', tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize:256, maxzoom:19, attribution:'Imagerie © Esri, Maxar'});
    M.addLayer({id:'sat', type:'raster', source:'esri', layout:{visibility:'none'}}, firstSym);
    // bâtiments 3D plus beaux : couleur selon la hauteur
    const b3=layers.find(l=>l.type==='fill-extrusion');
    if(b3){
      try{
        M.setPaintProperty(b3.id,'fill-extrusion-color',['interpolate',['linear'],['coalesce',['get','render_height'],0],0,'#d9d2c5',20,'#c9c2b8',60,'#aeb8c6',150,'#8fa3bd']);
        M.setPaintProperty(b3.id,'fill-extrusion-opacity',0.92);
        M.setLayerZoomRange(b3.id,13,24);
      }catch(e){}
    }
    const g=lmGeojson();
    M.addSource('lm',{type:'geojson',data:g.poly});
    M.addSource('lmpt',{type:'geojson',data:g.pts});
    M.addLayer({id:'lm-3d', type:'fill-extrusion', source:'lm', minzoom:10, paint:{'fill-extrusion-color':['get','color'],'fill-extrusion-base':['get','b'],'fill-extrusion-height':['get','t'],'fill-extrusion-opacity':0.97}});
    M.addLayer({id:'lm-label', type:'symbol', source:'lmpt', minzoom:11, layout:{'text-field':['concat','★ ',['get','name']], 'text-font':['Noto Sans Bold'], 'text-size':13, 'text-offset':[0,-1.6], 'text-allow-overlap':false}, paint:{'text-color':'#7c2d12','text-halo-color':'#fff7ed','text-halo-width':2}});
    M.addSource('myac',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    M.addSource('pl3d',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    M.addLayer({id:'pl3d', type:'fill-extrusion', source:'pl3d', paint:{'fill-extrusion-color':['get','color'],'fill-extrusion-base':['get','b'],'fill-extrusion-height':['get','t'],'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}});
    M.addLayer({id:'pl3d-sh', type:'fill', source:'pl3d', filter:['==',['get','shadow'],1], paint:{'fill-color':'#000','fill-opacity':0.28}}, 'pl3d');
    M.addLayer({id:'myac-l', type:'symbol', source:'myac', minzoom:8, layout:{'text-field':['get','label'],'text-size':11,'text-offset':[0,1.6],'text-font':['Noto Sans Regular']}, paint:{'text-color':'#fff','text-halo-color':'#000','text-halo-width':1.5}});
    cityPlanes();
  });
  M.on('error',e=>{ if(!CITY.errShown && !M.isStyleLoaded()){ CITY.errShown=true; toast('⛔ Les tuiles de la ville 3D ne répondent pas','bad'); } });
  M.on('click','lm-label',e=>{ const f=e.features&&e.features[0]; if(f) toast(`★ ${f.properties.name} — ${f.properties.city}`,'info'); });
  M.on('click','pl3d',e=>{ const f=e.features&&e.features[0]; if(f&&f.properties.mine){ closeCity(); selectPlane(f.properties.id); } else if(f&&f.properties.label) toast('✈️ '+f.properties.label,'info'); });
  CITY.tick=setInterval(cityPlanes,1000); M.on('zoomend',cityPlanes);
}
// silhouette d'avion en 3D (mètres → coordonnées) : fuselage, ailes, empennage ; taille réelle, agrandie pour rester visible
function planeParts(lat,lon,hdg,alt,L,span,k,color){
  const h=hdg*Math.PI/180, fx=Math.sin(h), fy=Math.cos(h), rx=Math.cos(h), ry=-Math.sin(h), mLat=111320, mLon=111320*Math.max(0.05,Math.cos(lat*Math.PI/180));
  const P=(x,y)=>{ const X=(x*rx+y*fx)*k, Y=(x*ry+y*fy)*k; return [lon+X/mLon, lat+Y/mLat]; };
  const w=L*0.07, ring=pts=>[pts.map(q=>P(q[0],q[1])).concat([P(pts[0][0],pts[0][1])])];
  const body=[[0,L*0.5],[w*0.7,L*0.4],[w,L*0.25],[w,-L*0.3],[w*0.5,-L*0.5],[-w*0.5,-L*0.5],[-w,-L*0.3],[-w,L*0.25],[-w*0.7,L*0.4]];
  const wing=[[w,L*0.12],[span/2,-L*0.08],[span/2,-L*0.14],[w,-L*0.04],[-w,-L*0.04],[-span/2,-L*0.14],[-span/2,-L*0.08],[-w,L*0.12]];
  const tail=[[w*0.5,-L*0.38],[span*0.18,-L*0.5],[span*0.18,-L*0.54],[0,-L*0.5],[-span*0.18,-L*0.54],[-span*0.18,-L*0.5],[-w*0.5,-L*0.38]];
  const fin=[[0.001*L,-L*0.36],[0.001*L,-L*0.52],[-0.001*L,-L*0.52],[-0.001*L,-L*0.36]];
  const t=Math.max(2,L*0.08)*k;
  return [ {r:ring(body),b:alt,t:alt+t*1.2,c:'#f4f5f7'}, {r:ring(wing),b:alt+t*0.2,t:alt+t*0.5,c:'#b9c0cb'}, {r:ring(tail),b:alt+t*0.3,t:alt+t*0.5,c:'#b9c0cb'}, {r:ring(fin),b:alt+t*0.4,t:alt+t*3.2,c:color} ];
}
function cityPlanes(){
  if(!CITY||!CITY.map.getSource('pl3d')||$('#city').hidden) return;
  const M=CITY.map, c=M.getCenter(), z=M.getZoom(), mpp=156543*Math.cos(c.lat*Math.PI/180)/Math.pow(2,z), now=typeof simNow==='function'? simNow() : S.time;
  const feats=[], labels=[], list=[];
  const add=(id,mine,lat,lon,hdg,alt,L,span,color,label)=>{
    const k=Math.min(30,Math.max(1,46*mpp/L));                    // au moins ~46 px de long à l'écran
    const al=Math.max(alt,3)+(k>1?L*0.05:0);
    for(const p of planeParts(lat,lon,hdg,al,L,span,k,color)) feats.push({type:'Feature',properties:{id,mine:mine?1:0,color:p.c,b:p.b,t:p.t,label,shadow:0},geometry:{type:'Polygon',coordinates:p.r}});
    if(alt>20){ const g=planeParts(lat,lon,hdg,0,L,span,k,'#000')[0]; feats.push({type:'Feature',properties:{id,mine:mine?1:0,color:'#000',b:0,t:0.1,label,shadow:1},geometry:{type:'Polygon',coordinates:g.r}}); }  // ombre au sol
    labels.push({type:'Feature',properties:{id,label},geometry:{type:'Point',coordinates:[lon,lat]}}); list.push({id,mine,lat,lon,label});
  };
  // vos avions
  for(const ac of S.fleet){
    if(ac.status!=='flight'||!ac.flight) continue;
    const st=flightState(ac,now); if(!st) continue; const sp=(typeof acSpec==='function')?acSpec(modelOf(ac)):{span:35,len:38};
    add(ac.id,true,st.lat,st.lon,st.hdg||0,st.alt,sp.len,sp.span,S.company.color||'#facc15',`${S.company.code}${flightNumber(ac)} ${st.from}→${st.to} · ${Math.round(st.alt*3.28)} ft`);
  }
  // avions des autres compagnies autour de la zone affichée
  if(typeof visibleRealRoutes==='function'&&typeof rivalPos==='function'&&z>=9){
    const r=Math.max(0.12,Math.min(3,400*mpp/111320*1.4)), bb={contains:([la,lo])=>Math.abs(la-c.lat)<r&&Math.abs(lo-c.lng)<r/Math.max(0.2,Math.cos(c.lat*Math.PI/180))};
    let n=0; for(const {R,r:rt} of visibleRealRoutes(bb,c.lng,12)){ if(n>=40) break; const cnt=Math.min(rt.freq||1,3);
      for(let i=0;i<cnt&&n<40;i++){ const q=rivalPos(rt,i,now); if(!q||!bb.contains([q.p.lat,unwrapLon(q.p.lon,c.lng)])) continue; const m=getModel(TRAFFIC_MODEL[q.cat])||getModel('A20N'), sp=acSpec(m);
        add('r'+R.code+rt.a+rt.b+i,false,q.p.lat,unwrapLon(q.p.lon,c.lng),q.hdg||0,q.alt||0,sp.len,sp.span,R.color||'#64748b',`${R.name} · ${m.name}${q.holding?' · en attente':''}`); n++; } } }
  M.getSource('pl3d').setData({type:'FeatureCollection',features:feats});
  const ml=M.getSource('myac'); if(ml) ml.setData({type:'FeatureCollection',features:labels});
  CITY.list=list;
  if(CITY.follow){ const f=list.find(x=>x.id===CITY.follow); if(f) M.easeTo({center:[f.lon,f.lat],duration:1000,easing:t=>t}); else CITY.follow=null; }
  if(CITY.spin){ M.rotateTo((M.getBearing()+12)%360,{duration:1000,easing:t=>t}); }
}
function renderCityHud(){
  let h=$('#cityHud'); if(!h){ h=document.createElement('div'); h.id='cityHud'; $('#main').appendChild(h); }
  h.hidden=false;
  const near=CITY? CITY.map.getCenter() : null;
  h.innerHTML=`<button class="gh" data-act="closeCity">✖ Carte</button>
    <button class="gh${CITY&&CITY.sat?' on':''}" data-act="citySat">🛰️ Satellite</button>
    <button class="gh${CITY&&CITY.spin?' on':''}" data-act="citySpin">🔄 Tour</button>
    <button class="gh${CITY&&CITY.follow?' on':''}" data-act="cityPlane" title="Aller voir un de vos avions en vol">✈️ Voir un avion</button>
    <button class="gh" data-act="cityMonument">★ Monument suivant</button>
    <select class="gh" id="citySel" data-act="cityGo"><option value="">🌆 Aller à…</option>${CITY_SPOTS.map((c,i)=>`<option value="${i}">${c[0]}</option>`).join('')}</select>
    <span class="gh-tip">Clic droit / 2 doigts pour incliner et tourner · ★ = monument</span>`;
  const sel=$('#citySel'); if(sel) sel.onchange=()=>{ const c=CITY_SPOTS[+sel.value]; if(c&&CITY) CITY.map.flyTo({center:[c[2],c[1]],zoom:15.2,pitch:62,bearing:-20,duration:3500}); };
}
let _lmI=-1;
function registerCityActions(){
  Object.assign(ACTIONS,{
    openCity:()=>openCity(),
    closeCity:()=>closeCity(),
    citySat:()=>{ if(!CITY) return; CITY.sat=!CITY.sat; try{ CITY.map.setLayoutProperty('sat','visibility',CITY.sat?'visible':'none'); }catch(e){} renderCityHud(); },
    citySpin:()=>{ if(!CITY) return; CITY.spin=!CITY.spin; renderCityHud(); },
    cityMonument:()=>{ if(!CITY) return; _lmI=(_lmI+1)%LANDMARKS.length; const L=LANDMARKS[_lmI]; const top=Math.max(...L[4].map(p=>p[3]));
      CITY.map.flyTo({center:[L[3],L[2]], zoom:top>300?15.3:16.2, pitch:65, bearing:(_lmI*47)%360, duration:4000}); toast(`★ ${L[0]} — ${L[1]}`,'info'); },
    cityPlane:()=>{ if(!CITY) return; const mine=(CITY.list||[]).filter(x=>x.mine), any=mine.length?mine:(CITY.list||[]);
      if(!any.length){ // aucun avion en vol : on va à l'aéroport de départ du prochain vol
        const ac=S.fleet.find(a=>a.status==='flight'&&a.flight); const st=ac&&flightState(ac,typeof simNow==='function'?simNow():S.time);
        if(st){ CITY.map.flyTo({center:[st.lon,st.lat],zoom:14.5,pitch:62,duration:3000}); CITY.follow=ac.id; renderCityHud(); } else toast('Aucun avion en vol pour le moment : utilisez « Prochain décollage » en vue 3D.','warn'); return; }
      const i=Math.max(0,any.findIndex(x=>x.id===CITY.follow)); const f=any[(CITY.follow?i+1:i)%any.length]; CITY.follow=f.id;
      CITY.map.flyTo({center:[f.lon,f.lat],zoom:15.6,pitch:66,duration:2500}); toast('✈️ '+f.label,'info'); renderCityHud(); },
    cityGo:()=>{},
  });
}
