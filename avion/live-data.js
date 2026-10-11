/* =========================================================
   Sky Empire — le monde réel en direct
   • ✈️ Trafic réel : les vrais avions en vol en ce moment autour de la
     caméra 3D (transpondeurs ADS-B publics), mis à jour toutes les 15 s.
   • 🌧️ Radar de pluie réel (RainViewer) sur la carte 2D et le globe 3D.
   • 🌀 Cyclones tropicaux en cours (GDACS, sinon NHC/NOAA).
   Tout est chargé directement par le navigateur, sans clé. Si un service
   refuse la connexion, le jeu essaie le suivant et le dit honnêtement.
   Ces données sont à l'heure RÉELLE, pas à l'heure du jeu.
   Sources : adsb.lol (ODbL), airplanes.live, OpenSky Network (usage non
   commercial), RainViewer (usage personnel), GDACS (ONU/UE), NOAA NHC.
   ========================================================= */
'use strict';
const LIVE={air:false, radar:false, cyc:(()=>{ if(window.SE_SAFE) return false; try{ return localStorage.getItem('se-cyc')!=='0'; }catch(e){ return true; } })(),
  ac:new Map(), src:'', err:'', at:0, busy:false, rv:null, rvAt:0, cyclones:[], cycAt:0, cycSrc:'', ents:new Map(), layer3:null, layer2:null, cycL2:null, cycE:[], viewer:null};
async function liveFetch(url,ms){ const c=new AbortController(), t=setTimeout(()=>c.abort(),ms||9000); try{ const r=await fetch(url,{signal:c.signal,cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); } finally{ clearTimeout(t); } }

/* ---------- vrais avions ---------- */
const LIVE_SRC=[
  {name:'adsb.lol', url:(la,lo,nm)=>`https://api.adsb.lol/v2/lat/${la.toFixed(2)}/lon/${lo.toFixed(2)}/dist/${nm}`, parse:j=>(j.ac||[]).map(liveAdsb)},
  {name:'airplanes.live', url:(la,lo,nm)=>`https://api.airplanes.live/v2/point/${la.toFixed(2)}/${lo.toFixed(2)}/${nm}`, parse:j=>(j.ac||[]).map(liveAdsb)},
  {name:'OpenSky', url:(la,lo,nm)=>{ const d=nm/60; return `https://opensky-network.org/api/states/all?lamin=${(la-d).toFixed(2)}&lomin=${(lo-d/Math.max(0.2,Math.cos(la*Math.PI/180))).toFixed(2)}&lamax=${(la+d).toFixed(2)}&lomax=${(lo+d/Math.max(0.2,Math.cos(la*Math.PI/180))).toFixed(2)}`; },
    parse:j=>(j.states||[]).map(s=>({id:s[0], cs:(s[1]||'').trim(), reg:'', type:'', lat:s[6], lon:s[5], alt:s[13]??s[7]??0, gnd:!!s[8], gs:(s[9]||0)*1.944, trk:s[10]||0, vs:(s[11]||0)*196.85, t:(s[4]||Date.now()/1000)*1000, cc:s[2]||''}))},
];
function liveAdsb(a){ const ground=a.alt_baro==='ground'; return {id:a.hex, cs:(a.flight||'').trim(), reg:a.r||'', type:a.t||'', lat:a.lat, lon:a.lon, alt:ground?0:(+a.alt_geom||+a.alt_baro||0)*0.3048, gnd:ground, gs:a.gs||0, trk:a.track||a.true_heading||0, vs:a.baro_rate||0, t:Date.now()-((a.seen_pos||a.seen||0)*1000), cc:''}; }
async function liveAirPoll(){
  if(LIVE.busy||typeof G==='undefined'||!G||!G.viewer) return; const cg=G.viewer.camera.positionCartographic; if(!cg) return;
  if(cg.height>600000){ LIVE.err='Rapprochez la caméra (moins de 600 km d’altitude) pour voir le trafic réel.'; return; }
  const la=Cesium.Math.toDegrees(cg.latitude), lo=Cesium.Math.toDegrees(cg.longitude), nm=Math.round(Math.min(150,Math.max(40,cg.height/1852*1.2)));
  LIVE.busy=true; let ok=false; const fails=[];
  for(const s of LIVE_SRC){ if(s.down&&Date.now()<s.down) continue;
    try{ const j=await liveFetch(s.url(la,lo,nm)); const list=s.parse(j).filter(a=>isFinite(a.lat)&&isFinite(a.lon));
      const seen=new Set(); for(const a of list){ seen.add(a.id); LIVE.ac.set(a.id,{...a,fix:Date.now()}); }
      for(const [id,a] of LIVE.ac) if(!seen.has(id)&&Date.now()-a.fix>45000) LIVE.ac.delete(id);
      LIVE.src=s.name; LIVE.err=''; ok=true; break; }
    catch(e){ fails.push(s.name); s.down=Date.now()+120000; }   // service muet : on réessaie dans 2 min
  }
  if(!ok) LIVE.err=`Aucun service de trafic réel n’a répondu (${fails.join(', ')||'en pause'}) : connexion, blocage du navigateur ou limite de requêtes. Nouvel essai dans 2 min.`;
  LIVE.busy=false; LIVE.at=Date.now();
}
// position estimée maintenant à partir du dernier point reçu (cap et vitesse)
function livePos(a){ const dt=Math.min(60,(Date.now()-a.t)/1000), d=a.gnd?0:a.gs*0.514*dt/1000, p=d>0?destPt(a.lat,a.lon,a.trk,d):{lat:a.lat,lon:a.lon}; return {lat:p.lat,lon:p.lon,alt:Math.max(0,a.alt+(a.gnd?0:a.vs*0.00508*dt))}; }
function liveDraw(){
  const C=Cesium, V=G.viewer; if(LIVE.viewer!==V){ LIVE.ents.clear(); LIVE.viewer=V; }
  if(!LIVE.air){ for(const e of LIVE.ents.values()) V.entities.remove(e); LIVE.ents.clear(); return; }
  const cap=GQ.mob?(GQ.mini?25:45):90, cam=V.camera.positionCartographic, cla=C.Math.toDegrees(cam.latitude), clo=C.Math.toDegrees(cam.longitude);
  const list=[...LIVE.ac.values()].sort((x,y)=>gcDist(x,{lat:cla,lon:clo})-gcDist(y,{lat:cla,lon:clo})).slice(0,cap), keep=new Set(list.map(a=>a.id));
  for(const [id,e] of LIVE.ents) if(!keep.has(id)){ V.entities.remove(e); LIVE.ents.delete(id); }
  const mi=AC3D.uri(getModel('A20N'),'#e2e8f0');
  for(const a of list){ if(LIVE.ents.has(a.id)) continue; const id=a.id;
    const posOf=()=>{ const x=LIVE.ac.get(id); if(!x) return C.Cartesian3.fromDegrees(0,0,-1e6); const p=livePos(x); return C.Cartesian3.fromDegrees(p.lon,p.lat,Math.max(p.alt,mi.R+mi.gH+0.4)); };
    const e=V.entities.add({position:new C.CallbackProperty(posOf,false),
      orientation:new C.CallbackProperty(()=>{ const x=LIVE.ac.get(id); return C.Transforms.headingPitchRollQuaternion(posOf(),new C.HeadingPitchRoll(C.Math.toRadians((x?x.trk:0)-90),0,0)); },false),
      model:{uri:mi.uri, minimumPixelSize:30, maximumScale:20000, color:C.Color.fromCssColorString('#7dd3fc'), colorBlendMode:C.ColorBlendMode.MIX, colorBlendAmount:0.35},
      label:{text:`📡 ${a.cs||a.reg||a.id.toUpperCase()}${a.type?' · '+a.type:''}`, font:'600 11px system-ui', fillColor:C.Color.fromCssColorString('#7dd3fc'), outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new C.Cartesian2(0,-30), distanceDisplayCondition:new C.DistanceDisplayCondition(0,90000)}});
    e._live=id; LIVE.ents.set(id,e); }
}

/* ---------- radar de pluie (RainViewer) ---------- */
async function liveRadarIndex(){
  if(LIVE.rv&&Date.now()-LIVE.rvAt<9*60000) return LIVE.rv;
  const j=await liveFetch('https://api.rainviewer.com/public/weather-maps.json'); const past=(j.radar&&j.radar.past)||[]; if(!past.length) throw new Error('vide');
  const f=past[past.length-1]; LIVE.rv={url:`${j.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, time:f.time*1000}; LIVE.rvAt=Date.now(); return LIVE.rv;
}
async function liveRadarApply(){
  const off=()=>{ if(LIVE.layer2&&typeof map!=='undefined'&&map){ map.removeLayer(LIVE.layer2); LIVE.layer2=null; } if(LIVE.layer3&&G&&G.viewer){ G.viewer.imageryLayers.remove(LIVE.layer3,true); LIVE.layer3=null; } };
  if(!LIVE.radar){ off(); return; }
  let rv; try{ rv=await liveRadarIndex(); }catch(e){ off(); LIVE.radar=false; toast('⛔ Radar de pluie réel indisponible (RainViewer ne répond pas)','warn'); return; }
  if(typeof map!=='undefined'&&map&&(!LIVE.layer2||LIVE.layer2._seUrl!==rv.url)){ if(LIVE.layer2) map.removeLayer(LIVE.layer2);
    LIVE.layer2=L.tileLayer(rv.url,{opacity:0.65,maxNativeZoom:7,maxZoom:19,zIndex:450,attribution:'Radar © RainViewer'}).addTo(map); LIVE.layer2._seUrl=rv.url; }
  if(typeof G!=='undefined'&&G&&G.viewer&&(!LIVE.layer3||LIVE.layer3._seUrl!==rv.url||LIVE.layer3._v!==G.viewer)){ if(LIVE.layer3&&LIVE.layer3._v===G.viewer) G.viewer.imageryLayers.remove(LIVE.layer3,true);
    LIVE.layer3=G.viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({url:rv.url,maximumLevel:7,credit:'Radar © RainViewer'})); LIVE.layer3.alpha=0.6; LIVE.layer3._seUrl=rv.url; LIVE.layer3._v=G.viewer; }
}

/* ---------- cyclones tropicaux en cours ---------- */
async function liveCyclones(){
  if(Date.now()-LIVE.cycAt<30*60000) return; LIVE.cycAt=Date.now();
  const d=new Date(), iso=x=>x.toISOString().slice(0,10), from=new Date(d.getTime()-12*864e5);
  try{ const j=await liveFetch(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC&fromdate=${iso(from)}&todate=${iso(d)}&alertlevel=green;orange;red`,12000);
    LIVE.cyclones=(j.features||[]).filter(f=>String(f.properties.iscurrent)==='true'&&f.geometry&&f.geometry.coordinates).map(f=>{ const p=f.properties, c=f.geometry.coordinates;
      return {name:p.name||p.eventname||'Cyclone', lat:c[1], lon:c[0], level:(p.alertlevel||'').toLowerCase(), info:(p.severitydata&&p.severitydata.severitytext)||'', where:p.country||''}; });
    LIVE.cycSrc='GDACS'; }
  catch(e){
    try{ const j=await liveFetch('https://www.nhc.noaa.gov/CurrentStorms.json',12000);
      LIVE.cyclones=(j.activeStorms||[]).map(s=>({name:`${s.classification||''} ${s.name}`.trim(), lat:+s.latitudeNumeric, lon:+s.longitudeNumeric, level:(+s.intensity>=96?'red':+s.intensity>=64?'orange':'green'), info:`vents ${s.intensity} kt, déplacement ${s.movementDir||'?'}° à ${s.movementSpeed||'?'} kt`, where:''}));
      LIVE.cycSrc='NHC (Atlantique et Pacifique)'; }
    catch(e2){ LIVE.cycSrc=''; LIVE.cyclones=[]; LIVE.cycAt=Date.now()-25*60000; }   // réessai dans 5 min
  }
  liveCycDraw(); liveCycGame();
}
function liveCycDraw(){
  const col=l=>l==='red'?'#ef4444':l==='orange'?'#f59e0b':'#22c55e';
  if(typeof map!=='undefined'&&map){ if(LIVE.cycL2){ map.removeLayer(LIVE.cycL2); LIVE.cycL2=null; }
    if(LIVE.cyc&&LIVE.cyclones.length){ LIVE.cycL2=L.layerGroup(LIVE.cyclones.map(c=>L.marker([c.lat,c.lon],{icon:L.divIcon({className:'cyc-ic',html:`<span style="color:${col(c.level)}">🌀</span>`,iconSize:[34,34],iconAnchor:[17,17]})})
      .bindPopup(`<b>🌀 ${esc(c.name)}</b> — en ce moment (réel)<br>${esc(c.info)}${c.where?'<br>'+esc(c.where):''}<br><small>Source : ${esc(LIVE.cycSrc)}</small>`))).addTo(map); } }
  if(typeof G!=='undefined'&&G&&G.viewer){ for(const e of LIVE.cycE) G.viewer.entities.remove(e); LIVE.cycE=[];
    if(LIVE.cyc) for(const c of LIVE.cyclones) LIVE.cycE.push(G.viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(c.lon,c.lat,12000),
      label:{text:`🌀 ${c.name}`, font:'700 15px system-ui', fillColor:Cesium.Color.fromCssColorString(col(c.level)), outlineColor:Cesium.Color.BLACK, outlineWidth:4, style:Cesium.LabelStyle.FILL_AND_OUTLINE},
      ellipse:{semiMajorAxis:250000, semiMinorAxis:250000, material:Cesium.Color.fromCssColorString(col(c.level)).withAlpha(0.18), outline:true, outlineColor:Cesium.Color.fromCssColorString(col(c.level)).withAlpha(0.6), height:0}})); }
}
// un vrai cyclone près de vos aéroports : nouvelle et fermeture temporaire (alerte rouge seulement)
function liveCycGame(){
  if(typeof S==='undefined'||!S||!S.ai||!S.ai.news||!LIVE.cyc||!(S.hubs||[]).length) return; S.liveCyc=S.liveCyc||{};
  const mine=new Set([...(S.hubs||[]),...S.routes.flatMap(r=>r.stops)]);
  for(const c of LIVE.cyclones){ const key=c.name+'|'+new Date().toISOString().slice(0,10); if(S.liveCyc[key]) continue;
    const near=[...mine].filter(code=>gcDist(AP(code),c)<(c.level==='red'?350:200)); if(!near.length) continue; S.liveCyc[key]=1;
    if(c.level==='red') for(const code of near) if(typeof shutAirport==='function') shutAirport(code,1);
    aiNews(`🌀 Vrai cyclone en cours — ${c.name} s’approche de ${near.map(keyCity).join(', ')}.${c.level==='red'?' Aéroport fermé par précaution pendant 24 h.':' Vents forts et retards possibles.'} (Données réelles ${LIVE.cycSrc}.)`,'bad',true); }
}

/* ---------- boutons, état, boucle ---------- */
function liveButtons(){ return `<button class="gh ${LIVE.air?'on':''}" data-act="liveAir" title="Vrais avions en vol en ce moment">📡 Trafic réel</button><button class="gh ${LIVE.radar?'on':''}" data-act="liveRadar" title="Vraie pluie, radar en direct">🌧️ Radar réel</button>`; }
function liveStatusHtml(){
  return `<div class="small">${LIVE.air?`📡 Trafic réel : ${LIVE.err?`<span class="warnt">${esc(LIVE.err)}</span>`:`<b>${LIVE.ac.size}</b> avions reçus via ${esc(LIVE.src)}`}`:'📡 Trafic réel : coupé'}<br>
    ${LIVE.radar?`🌧️ Radar : ${LIVE.rv?'image de '+new Date(LIVE.rv.time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'…'} (RainViewer)`:'🌧️ Radar réel : coupé'}<br>
    🌀 Cyclones réels : ${LIVE.cycSrc?`${LIVE.cyclones.length} en cours (${esc(LIVE.cycSrc)})${LIVE.cyclones.length?' — '+LIVE.cyclones.map(c=>esc(c.name)).join(', '):''}`:'source injoignable pour le moment'}</div>`;
}
setInterval(()=>{ try{
  const on3=typeof G!=='undefined'&&G&&G.viewer&&!$('#globe').hidden;
  if(on3&&LIVE.air&&Date.now()-LIVE.at>15000) liveAirPoll();
  if(on3){ liveDraw(); if(LIVE.radar&&(!LIVE.layer3||LIVE.layer3._v!==G.viewer)) liveRadarApply(); }
  if(LIVE.cyc) liveCyclones();
  if(LIVE.cyc&&LIVE.cyclones.length&&typeof map!=='undefined'&&map&&!LIVE.cycL2) liveCycDraw();
  if(LIVE.cyc&&LIVE.cyclones.length&&Date.now()-(LIVE.gameAt||0)>60000){ LIVE.gameAt=Date.now(); liveCycGame(); }
  if(LIVE.cyc&&on3&&LIVE.cyclones.length&&(!LIVE.cycE.length||LIVE.cycV!==G.viewer)){ LIVE.cycV=G.viewer; liveCycDraw(); }
}catch(e){ console.warn(e); } },1000);
setInterval(()=>{ if(LIVE.radar){ LIVE.rvAt=0; liveRadarApply(); } },10*60000);   // nouvelle image radar toutes les 10 min
Object.assign(ACTIONS,{
  liveAir:()=>{ LIVE.air=!LIVE.air; LIVE.at=0; if(!LIVE.air&&G&&G.viewer) liveDraw();
    toast(LIVE.air?'📡 Trafic réel : les vrais avions en vol en ce moment (heure réelle) apparaissent en bleu clair autour de la caméra. Approchez-vous à moins de 600 km d’altitude.':'📡 Trafic réel coupé','info'); if(typeof renderGlobeHud==='function'&&G) renderGlobeHud(); },
  liveRadar:()=>{ LIVE.radar=!LIVE.radar; liveRadarApply(); toast(LIVE.radar?'🌧️ Radar de pluie réel (dernière image, RainViewer)':'🌧️ Radar réel coupé','info'); if(typeof renderGlobeHud==='function'&&G) renderGlobeHud(); const b=document.querySelector('[data-act="liveRadar2D"]'); if(b) b.classList.toggle('on',LIVE.radar); },
  liveRadar2D:()=>ACTIONS.liveRadar(),
  liveCyc:()=>{ LIVE.cyc=!LIVE.cyc; try{ localStorage.setItem('se-cyc',LIVE.cyc?'1':'0'); }catch(e){} LIVE.cycAt=0; liveCycDraw(); if(LIVE.cyc) liveCyclones(); toast(LIVE.cyc?'🌀 Cyclones réels affichés':'🌀 Cyclones réels masqués','info'); },
});
// les vrais avions comptent aussi dans la détection et les contacts
if(typeof visTargets==='function'){ const _vt=visTargets; visTargets=function(){ const out=_vt(); if(!LIVE.air) return out;
  for(const [id,e] of LIVE.ents){ const a=LIVE.ac.get(id); if(!a) continue; const p=livePos(a);
    out.push({p:Cesium.Cartesian3.fromDegrees(p.lon,p.lat,p.alt),own:false,live:true,tag:'📡 '+(a.cs||a.reg||id.toUpperCase()),sub:`réel ${a.type||''} ${a.reg||''}`.trim(),alt:p.alt,spd:a.gs*1.852,ph:4,span:34}); }
  return out; }; }
