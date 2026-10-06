/* ============================================================
   MODE PILOTE — pilotez vous-même un vol sur la carte satellite
   ============================================================ */
let P=null, pilotLayer=null, pilotMk=null, pilotLine=null, pilotRaf=0, pilotLast=0, pilotAudio=null, pilotUiAt=0;
const PKEYS={};

function destPoint(lat,lon,hdg,km){
  const δ=km/6371, θ=toRad(hdg), φ1=toRad(lat), λ1=toRad(lon);
  const φ2=Math.asin(Math.sin(φ1)*Math.cos(δ)+Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
  const λ2=λ1+Math.atan2(Math.sin(θ)*Math.sin(δ)*Math.cos(φ1),Math.cos(δ)-Math.sin(φ1)*Math.sin(φ2));
  return {lat:toDeg(φ2), lon:toDeg(λ2)};
}
// position relative à une piste : distance le long de l'axe (m, depuis le seuil) et écart latéral (m)
function rwyFrame(r, p){
  const kx=111320*Math.cos(toRad(r.thr.lat)), dx=(p.lon-r.thr.lon)*kx, dy=(p.lat-r.thr.lat)*110540;
  const h=toRad(r.hdg), ux=Math.sin(h), uy=Math.cos(h);
  return {along:dx*ux+dy*uy, xt:dx*uy-dy*ux};
}
function onRunway(p, code){
  const hits=runwaysOf(code).filter(r=>{ const f=rwyFrame(r,p); return f.along>-60 && f.along<r.len+60 && Math.abs(f.xt)<(r.wid||45)/2+12; });
  return hits.sort((a,b)=>angDiff(a.hdg,p.hdg)-angDiff(b.hdg,p.hdg))[0]||null;
}
// vent en altitude au point courant (km/h, composante sur le cap)
function windHere(p){ const jet=180*Math.exp(-Math.pow((Math.abs(p.lat)-40)/13,2)) - 18*Math.exp(-Math.pow(p.lat/14,2)); return jet*Math.sin(toRad(p.hdg))*clamp(p.alt/32000,0,1); }
function perf(m){
  const cat=planeCat(m);
  const vr = cat==='prop'? (m.seats<=20?120:190) : cat==='conc'? 370 : cat==='rj'?250 : cat==='nb'?270 : 290;
  return { vr, vstall:vr*0.8, vtdMax:vr*1.4, ceil:m.alt*3.28084, climb: cat==='prop'?1600:cat==='conc'?5000:2800, acc: cat==='prop'?6:cat==='conc'?12:8 };
}
function pilotCandidates(ac){
  const m=modelOf(ac);
  return AIRPORT_CODES.filter(c=>c!==ac.loc && dist(ac.loc,c)<=m.range && !airportClosed(c) && !runwayCheck(m,c))
    .map(c=>({c,d:dist(ac.loc,c)})).sort((a,b)=>a.d-b.d);
}
function pilotSetupHtml(ac){
  const m=modelOf(ac), list=pilotCandidates(ac);
  const planned=(ac.plan||[]).map(p=>S.routes.find(r=>r.id===p.routeId)).filter(Boolean).flatMap(r=>r.stops).filter(c=>c!==ac.loc);
  const sugg=[...new Set([...planned, ...list.slice(0,10).map(x=>x.c)])].filter(c=>list.some(x=>x.c===c)).slice(0,10);
  return `${photoHtml(m,'banner')}<div class="small">Vous êtes le commandant de bord du <b>${m.name}</b> ${ac.reg}, au sol à <b>${apName(ac.loc)}</b>.
  Décollez, naviguez et posez l’avion vous-même. Un bon atterrissage rapporte une prime et de la réputation.</div>
  <h3>Destination</h3>
  <div class="chips">${sugg.map(c=>`<button class="chip" data-act="pilotGo" data-id="${ac.id}" data-c="${c}">${flag(c)} ${AP(c).city} · ${num(dist(ac.loc,c))} km</button>`).join('')}</div>
  <datalist id="pilotList">${list.map(x=>`<option value="${x.c} — ${esc(AP(x.c).city)} (${Math.round(x.d)} km)">`).join('')}</datalist>
  <label>Autre destination à portée (${list.length} aéroports)<input list="pilotList" id="pilotTo" placeholder="Code ou ville…"></label>
  <label class="tog"><input type="checkbox" id="pilotPax" checked> ${isCargo(m)?'Avec fret payant':'Avec passagers (vol commercial)'}</label>
  <div class="btns"><button class="btn gold" data-act="pilotGo" data-id="${ac.id}">🛫 Prendre les commandes</button></div>
  <div class="card small"><b>Commandes</b> — clavier : ←/→ ou Q/D virer · ↑/↓ ou Z/S monter/descendre · +/− ou PageUp/PageDown gaz · Espace pilote automatique · T accélérer le temps.<br>
  Sur mobile : boutons à l’écran. Pour décoller : gaz à fond, puis ▲ quand la vitesse dépasse V<sub>R</sub>. Pour atterrir : arrivez à moins de 4 km de l’aéroport et touchez le sol en douceur (moins de 600 ft/min).</div>`;
}

function startPilot(acId, to, commercial){
  const ac=S.fleet.find(a=>a.id===acId); if(!ac) return 'Avion introuvable';
  if(ac.status!=='idle') return 'L’avion doit être au sol et disponible';
  if(ac.condition<15) return 'Condition technique critique';
  const m=modelOf(ac);
  if(!AIRPORTS[to] || to===ac.loc) return 'Destination invalide';
  if(dist(ac.loc,to)>m.range) return 'Destination hors autonomie';
  const rwErr=runwayCheck(m,to)||runwayCheck(m,ac.loc); if(rwErr) return rwErr;
  const A=AP(ac.loc), d=dist(ac.loc,to);
  let pax=null, cargo=0;
  if(commercial){
    if(isCargo(m)) cargo=+(m.cargo*rnd(0.6,0.85)).toFixed(1);
    else {
      const r={id:'manual', stops:[ac.loc,to], aircraft:[ac.id], price:1, cabin:{f:0,j:0,w:0}, auto:false, stats:{}};
      pax=Math.max(4,Math.min(m.seats, Math.round(legMarket(r,ac.loc,to,1).perFlight*rnd(0.9,1.1))));
    }
  }
  ac.status='manual';
  const pf=perf(m);
  const depR=bestRunway(ac.loc, bearing(A,AP(to)), m), arrR=bestRunway(to,(bearing(AP(to),A)+180)%360, m);
  const st0=depR? {lat:depR.thr.lat, lon:depR.thr.lon, hdg:depR.hdg} : {lat:A.lat, lon:A.lon, hdg:bearing(A,AP(to))};
  P={ acId, from:ac.loc, to, lat:st0.lat, lon:st0.lon, hdg:st0.hdg, depR, arrR, spd:0, alt:0, vs:0, vsT:0, thr:0, roll:0,
      fuelMax:m.burn*(d/m.speed+1.3), fuel:0, phase:'ground', accel:1, ap:false, autoCam:true, t:0, air:0, pax, cargo, commercial,
      pf, m, dist0:d, msg:depR?`Aligné piste ${depR.id} (${num0(depR.len)} m) — mettez les gaz à fond`:'Mettez les gaz à fond pour décoller', maxAlt:0, td:null, sound:true };
  P.fuel=P.fuelMax;
  openCockpit();
  return null;
}

/* ---------- physique ---------- */
function pilotPhysics(dt){
  const m=P.m, pf=P.pf, to=AP(P.to);
  const dTo=gcDist(P,to), brgTo=bearing(P,to);
  // pilote automatique
  if(P.ap && P.phase==='air'){
    let tgtHdg=brgTo, dThr=dTo;
    if(P.arrR){ // interception de l'axe de piste : point d'approche finale (FAF) à 14 km, puis suivi de l'axe
      const R=P.arrR, f=rwyFrame(R,P), faf=destPt(R.thr.lat,R.thr.lon,(R.hdg+180)%360,14);
      const onFinal = f.along<R.len && f.along>-26000 && Math.abs(f.xt)<(P.final?2500:1500) && angDiff(P.hdg,R.hdg)<50;
      if(onFinal){ tgtHdg=(R.hdg+clamp(-f.xt/45,-25,25)+360)%360; dThr=Math.max(0,(300-f.along)/1000); P.final=true; }
      else { tgtHdg=bearing(P,faf); dThr=gcDist(P,faf)+14; P.final=false; }
    }
    let diff=((tgtHdg-P.hdg+540)%360)-180;
    P.turn=clamp(diff/4,-1,1);
    const glide = Math.max(0,dThr-0.3)*172;              // plan de descente à 3° : ~172 ft par km
    const cruise = Math.min(pf.ceil, Math.max(8000, P.dist0*30));
    const tgtAlt = Math.min(cruise, glide);
    let vsT=(tgtAlt-P.alt)*0.8;
    if(glide<cruise && P.alt>tgtAlt-400) vsT-=P.spd*172/60;   // anticipation de la pente
    P.vsT=clamp(vsT,-2600,pf.climb);
    const flare = P.alt<60 && dThr<1.5;
    const tgtSpd = flare? pf.vr*0.98 : dThr<12? pf.vr*1.05 : dThr<40? pf.vr*1.4 : m.speed*0.92;
    P.thr=clamp(P.thr+(tgtSpd-P.spd)*0.02*dt,0,1);
    if(P.alt<1500 && dThr<10) P.vsT=Math.max(P.vsT,-1100);      // approche stabilisée
    if(flare) P.vsT=-160;                                        // arrondi automatique
  }
  if(P.fuel<=0){ P.thr=0; P.fuel=0; }
  // virage
  const turnIn = P.ap? (P.turn||0) : (PKEYS.left?-1:0)+(PKEYS.right?1:0);
  const rate = P.phase==='air'? 3 : (P.spd<80? 12 : 3);
  if(P.phase!=='crashed') P.hdg=(P.hdg+turnIn*rate*dt+360)%360;
  P.roll += ((P.phase==='air'?turnIn*25:0)-P.roll)*Math.min(1,dt*3);
  // vitesse
  const vmax=m.speed*(0.62+0.38*Math.min(1,P.alt/pf.ceil));
  if(P.phase==='ground'||P.phase==='rollout'){
    let dv = P.thr*pf.acc - (P.spd>0?1.2:0);
    if(P.phase==='rollout' && P.thr<0.05) dv=-11;
    P.spd=clamp(P.spd+dv*dt, 0, vmax);
  } else if(P.phase==='air'){
    const tgt = P.thr*vmax - P.vs/60*1.1;
    P.spd=clamp(P.spd+clamp(tgt-P.spd,-pf.acc*dt,pf.acc*dt)*0.6, 0, m.speed*1.05);
  }
  // vertical
  if(P.phase==='ground'){
    P.vs=0;
    if(P.spd>=pf.vr && P.vsT>0){ P.phase='air'; P.msg='Décollage ! Rentrez le train, montez vers l’altitude de croisière.'; beep(660,0.12); }
  } else if(P.phase==='air'){
    let maxClimb = pf.climb*(1-0.75*P.alt/pf.ceil)*clamp((P.spd-pf.vstall)/(pf.vr*0.4),0,1);
    let vsT=clamp(P.vsT,-4000,Math.max(0,maxClimb));
    if(P.spd<pf.vstall){ vsT=-2200; P.stall=true; } else P.stall=false;
    P.vs+=clamp(vsT-P.vs,-1500*dt,1500*dt);
    P.alt=Math.max(0,P.alt+P.vs/60*dt);
    if(P.alt>=pf.ceil){ P.alt=pf.ceil; P.vs=Math.min(0,P.vs); }
    P.maxAlt=Math.max(P.maxAlt,P.alt); P.air+=dt;
    if(P.alt<=0) touchdown();
    if(!P) return;
  }
  // déplacement
  P.gs = P.phase==='air'? Math.max(0,P.spd+windHere(P)) : P.spd;
  if(P.phase!=='crashed' && P.gs>0){ const p=destPoint(P.lat,P.lon,P.hdg,P.gs*dt/3600); P.lat=p.lat; P.lon=p.lon; }
  P.fuel=Math.max(0,P.fuel-m.burn*(0.2+0.8*P.thr)*dt/3600);
  P.t+=dt;
  if(P.phase==='rollout' && P.spd<25) finishPilot();
}
function nearestAirport(p){ let best=null; for(const c of AIRPORT_CODES){ const d=gcDist(p,AP(c)); if(!best||d<best.d) best={c,d}; } return best; }
function touchdown(){
  const n=nearestAirport(P), vs=P.vs, hasRw=runwaysOf(n.c).length>0, rw=hasRw? onRunway(P,n.c) : (n.d<4?{id:'?'}:null);
  P.td={vs, spd:P.spd, d:n.d, code:n.c, ap:P.ap, rwy:rw&&rw.id, off:!rw};
  P.alt=0; P.vs=0;
  if(n.d>4 || vs<-2500 || P.spd>P.pf.vtdMax*1.25){ P.phase='crashed'; P.spd=0; crashPilot(n.d>4?'Atterrissage hors aéroport !':'Impact trop violent !'); return; }
  if(!rw){ P.phase='crashed'; P.spd=0; crashPilot('Sortie de piste : l’avion s’est posé à côté de la piste !', 0.35); return; }
  P.phase='rollout'; P.thr=0; P.ap=false;
  P.msg=(vs>-200?'🧈 Kiss landing':vs>-600?'Bel atterrissage':'Atterrissage ferme')+` sur la piste ${rw.id} — freinage…`;
  beep(vs>-600?520:300,0.2);
}

/* ---------- fin du vol ---------- */
function landingRating(vs){ return vs>-180?5: vs>-350?4: vs>-600?3: vs>-1000?2: 1; }
function settleFlight(ac, landedAt, rating, extraCost=0){
  const m=modelOf(ac), hrs=P.air/3600;
  const fuelCost=(P.fuelMax-P.fuel)*fuelPrice(P.from);
  book('carburant',-fuelCost);
  const B=AP(landedAt), size=Math.max(m.seats,m.cargo*3)/100;
  const fees=[0,60,150,300,550,900][B.cls]*Math.max(0.25,size)+(P.pax||0)*(AP(P.from).cc!==B.cc?22:7);
  book('taxes',-fees);
  if(extraCost) book('incidents',-extraCost);
  let rev=0;
  if(P.commercial && landedAt===P.to){
    if(P.pax){ rev=P.pax*baseFare(P.from,P.to); book('billets',rev); S.stats.pax+=P.pax; }
    if(P.cargo){ rev=P.cargo*P.dist0*0.42; book('cargo',rev); S.stats.cargoT+=P.cargo; }
    if(rating>=4){ const b=rev*(rating===5?0.08:0.04); book('billets',b); rev+=b; }
  }
  ac.hours+=hrs; ac.cycles++; ac.sinceA+=hrs; ac.sinceC+=hrs; ac.sinceD+=hrs;
  ac.condition=clamp(ac.condition-hrs*0.02-(rating<=2?6:0),0,100);
  ac.loc=landedAt; ac.status='idle'; ac.readyAt=S.time+turnaround(m);
  S.stats.flights++; S.stats.manual=(S.stats.manual||0)+1;
  S.reputation=clamp(S.reputation+(rating===5?1.5:rating===4?0.8:rating<=2?-2:0)+(P.commercial&&landedAt!==P.to?-1:0),0,100);
  return {rev, fuelCost, fees, hrs};
}
function finishPilot(){
  const ac=S.fleet.find(a=>a.id===P.acId); const at=(P.td&&P.td.code)||nearestAirport(P).c;
  let rating=P.td? landingRating(P.td.vs) : 3;
  if(P.td&&P.td.ap) rating=Math.min(3,rating); // l'autoland ne mérite pas la prime du pilote
  const r=settleFlight(ac, at, rating);
  const div = at!==P.to;
  logMsg(`🕹️ Vol piloté ${P.from}→${at}${div?' (déroutement)':''} : atterrissage ${'★'.repeat(rating)}${P.td?' à '+Math.round(P.td.vs)+' ft/min':''}.`,'ok');
  const res={rating, td:P.td, at, div, ...r, time:P.t};
  closeCockpit();
  showModal(rating>=4?'🏆 Superbe vol, commandant !':'Vol terminé', `
    <div class="landing-stars">${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</div>
    <div class="grid2 card"><div>Arrivée : <b>${apName(at)}</b>${div?' <span class="neg">(déroutement)</span>':''}</div>
    <div>Taux de chute : <b>${res.td?Math.round(res.td.vs):'—'} ft/min</b></div>
    <div>Piste : <b>${res.td&&res.td.rwy?res.td.rwy:'—'}</b></div><div>Temps de vol : <b>${fmtDur(res.hrs*HOUR)}</b></div>
    <div>Revenus : <b class="pos">${fmtMoney(res.rev)}</b></div><div>Carburant + taxes : <b class="neg">${fmtMoney(res.fuelCost+res.fees)}</b></div></div>
    <div class="small mut">${rating===5?'Kiss landing : prime de 8 % et réputation +1,5.':rating===4?'Très bon atterrissage : prime de 4 %.':rating<=2?'Atterrissage dur : usure de l’avion et réputation en baisse.':'Atterrissage correct.'}</div>
    <div class="btns"><button class="btn gold" data-act="closeModal">Continuer</button></div>`);
  P=null; renderPanel(); renderTop();
}
function crashPilot(why, sev=1){
  const ac=S.fleet.find(a=>a.id===P.acId), m=modelOf(ac);
  const cost=(m.price*1e6*0.18+200000)*sev, repLoss=Math.round(12*Math.max(0.5,sev));
  beep(120,0.6);
  const at=nearestAirport(P).c;
  settleFlight(ac, at, 1, cost);
  ac.condition= sev<1? Math.max(5,ac.condition-40) : 5; S.reputation=clamp(S.reputation-repLoss,0,100); S.stats.incidents++;
  ac.readyAt=S.time+(sev<1?2:5)*DAY;
  logMsg(`💥 ${ac.reg} : ${why} Avion gravement endommagé, ${fmtMoney(cost)} de frais. Aucun blessé grave.`,'bad');
  closeCockpit();
  showModal('💥 Accident', `<div class="card"><b>${why}</b><br>L’avion ${ac.reg} est gravement endommagé près de ${apName(at)}. Heureusement, l’évacuation s’est bien passée.<br>
    Frais : <b class="neg">${fmtMoney(cost)}</b> · image −${repLoss} · condition technique ${Math.round(ac.condition)} % (check conseillé).</div>
    <div class="small mut">Astuce : suivez la ligne magenta jusqu’au point d’approche, alignez-vous sur l’axe de la piste et touchez le sol sur la piste avec moins de 600 ft/min.</div>
    <div class="btns"><button class="btn gold" data-act="closeModal">Compris</button></div>`);
  P=null; renderPanel(); renderTop();
}
function handOverAutopilot(){
  if(!P) return;
  if(P.phase==='ground' && P.spd<5){ const ac=S.fleet.find(a=>a.id===P.acId); ac.status='idle'; P=null; closeCockpit(); toast('Vol annulé','info'); return; }
  if(P.phase==='ground'){ P.thr=1; P.vsT=1500; }
  P.ap=true; P.accel=64; P.hidden=true; closeCockpit(true);
  toast('🤖 Pilote automatique engagé jusqu’à l’atterrissage','ok');
}

/* ---------- cockpit ---------- */
function openCockpit(){
  setTab('map'); closeModal();
  document.body.classList.add('piloting');
  const box=document.getElementById('cockpit'); box.hidden=false;
  box.innerHTML=`
  <div class="ck-pfd"><svg id="pfd" viewBox="0 0 240 200"></svg></div>
  <div class="ck-info" id="ckInfo"></div>
  <div class="ck-ctrl">
    <div class="ck-thr"><span>GAZ</span><input type="range" id="ckThr" min="0" max="100" value="0" orient="vertical"><b id="ckThrV">0%</b></div>
    <div class="ck-pad">
      <button data-pk="up">▲</button>
      <button data-pk="left">◀</button><button data-pk="right">▶</button>
      <button data-pk="down">▼</button>
    </div>
    <div class="ck-btns">
      <button data-ck="ap" id="ckAp">AP</button>
      <button data-ck="accel" id="ckAcc">×1</button>
      <button data-ck="cam" id="ckCam">📷 Auto</button>
      <button data-ck="snd" id="ckSnd">🔊</button>
      <button data-ck="quit">🤖 Confier à l’AP</button>
    </div>
  </div>`;
  if(!pilotLayer) pilotLayer=L.layerGroup().addTo(map);
  pilotLayer.clearLayers();
  const to=AP(P.to);
  L.circle([to.lat,to.lon],{radius:4000,color:'#ff2bd6',weight:1,dashArray:'5 6',fillOpacity:0.02,interactive:false}).addTo(pilotLayer);
  for(const R of [P.depR,P.arrR]) if(R){
    const w=(R.wid||45)/2000, c=[destPt(R.thr.lat,R.thr.lon,R.hdg-90,w),destPt(R.end.lat,R.end.lon,R.hdg-90,w),destPt(R.end.lat,R.end.lon,R.hdg+90,w),destPt(R.thr.lat,R.thr.lon,R.hdg+90,w)].map(p=>[p.lat,p.lon]);
    L.polygon(c,{color:'#ffffff',weight:2,fillColor:'#111827',fillOpacity:0.55,interactive:false}).addTo(pilotLayer);
  }
  if(P.arrR){ const R=P.arrR, faf=destPt(R.thr.lat,R.thr.lon,(R.hdg+180)%360,14);
    L.polyline([[faf.lat,faf.lon],[R.thr.lat,R.thr.lon]],{color:'#22d3ee',weight:2,dashArray:'4 6',interactive:false}).addTo(pilotLayer);
    L.marker([faf.lat,faf.lon],{icon:L.divIcon({className:'faf',html:'<span>FAF</span>',iconSize:[34,16],iconAnchor:[17,8]}),interactive:false}).addTo(pilotLayer);
    L.marker([R.thr.lat,R.thr.lon],{icon:L.divIcon({className:'rwy-label big',html:`<span style="transform:rotate(${R.hdg}deg)">${R.id}</span>`,iconSize:[34,18],iconAnchor:[17,9]}),interactive:false}).addTo(pilotLayer); }
  pilotLine=L.polyline([],{color:'#ff2bd6',weight:3,opacity:0.9,dashArray:'8 8'}).addTo(pilotLayer);
  pilotTrail=L.polyline([],{color:'#fff',weight:2,opacity:0.6}).addTo(pilotLayer);
  const cat=planeCat(P.m);
  pilotMk=L.marker([P.lat,P.lon],{icon:L.divIcon({className:'plane-icon pilot',html:`<div class="rot">${PLANE_SVG(P.m.color||S.company.color,64,cat)}</div>`,iconSize:[64,64],iconAnchor:[32,32]}),zIndexOffset:3000,interactive:false}).addTo(pilotLayer);
  map.setView([P.lat,P.lon],15,{animate:false});
  map.on('dragstart',pilotCamOff);
  // contrôles
  box.querySelectorAll('[data-pk]').forEach(b=>{
    const k=b.dataset.pk;
    const on=e=>{ e.preventDefault(); if(k==='up'||k==='down'){ P.vsT=clamp((P.vsT||0)+(k==='up'?500:-500),-4000,6000); P.ap=false; } else { PKEYS[k]=true; P.ap=false; } b.classList.add('on'); };
    const off=e=>{ if(k==='left'||k==='right') PKEYS[k]=false; b.classList.remove('on'); };
    b.addEventListener('pointerdown',on); b.addEventListener('pointerup',off); b.addEventListener('pointerleave',off); b.addEventListener('pointercancel',off);
  });
  box.querySelector('#ckThr').addEventListener('input',e=>{ if(P){ P.thr=e.target.value/100; P.ap=false; } });
  box.querySelectorAll('[data-ck]').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.ck; if(!P) return;
    if(k==='ap'){ if(P.phase!=='air') return toast('Le pilote automatique s’engage en vol','warn'); P.ap=!P.ap; }
    if(k==='accel'){ const L2=[1,2,4,8,16,32]; P.accel=L2[(L2.indexOf(P.accel)+1)%L2.length]||1; }
    if(k==='cam'){ P.autoCam=!P.autoCam; }
    if(k==='snd'){ P.sound=!P.sound; }
    if(k==='quit') handOverAutopilot();
  }));
  startAudio();
  pilotLast=performance.now();
  cancelAnimationFrame(pilotRaf); pilotRaf=requestAnimationFrame(pilotFrame);
}
let pilotTrail=null;
function pilotCamOff(){ if(P) P.autoCam=false; }
function closeCockpit(keepRunning){
  const box=document.getElementById('cockpit'); box.hidden=true; box.innerHTML='';
  document.body.classList.remove('piloting');
  map.off('dragstart',pilotCamOff);
  if(!keepRunning){ cancelAnimationFrame(pilotRaf); if(pilotLayer) pilotLayer.clearLayers(); stopAudio(); }
  else stopAudio();
}
function pilotFrame(now){
  if(!P || P.hidden){ return; }
  let dt=Math.min(0.25,(now-pilotLast)/1000); pilotLast=now;
  let left=dt*P.accel;
  while(left>0 && P){ const s=Math.min(0.2,left); pilotPhysics(s); left-=s; if(P && P.phase==='crashed') break; }
  if(!P) return;
  // carte
  const pos=[P.lat,unwrapLon(P.lon,map.getCenter().lng)];
  pilotMk.setLatLng(pos);
  const el=pilotMk.getElement();
  if(el){ const rot=el.querySelector('.rot'); const sh=Math.min(60,2+P.alt/250); rot.style.transform=`rotate(${P.hdg}deg)`; rot.style.setProperty('--sh',sh.toFixed(0)+'px'); rot.style.setProperty('--blur',(1+P.alt/3000).toFixed(1)+'px'); }
  if(P.autoCam){
    const z = P.alt<300?15 : P.alt<1500?13 : P.alt<6000?11 : P.alt<20000?9 : 8;
    if(map.getZoom()!==z) map.setView(pos,z,{animate:false}); else map.panTo(pos,{animate:false});
  }
  if(now-pilotUiAt>250){
    pilotUiAt=now;
    const to=AP(P.to);
    if(P.arrR&&!P.final){ const R=P.arrR, faf=destPt(R.thr.lat,R.thr.lon,(R.hdg+180)%360,14); pilotLine.setLatLngs([...gcPath({lat:P.lat,lon:P.lon},faf,pos[1]),[R.thr.lat,unwrapLon(R.thr.lon,pos[1])]]); }
    else pilotLine.setLatLngs(gcPath({lat:P.lat,lon:P.lon},P.arrR?P.arrR.thr:to,pos[1]));
    const tr=pilotTrail.getLatLngs(); if(!tr.length||gcDist({lat:tr[tr.length-1].lat,lon:tr[tr.length-1].lng},P)>0.3){ tr.push(L.latLng(pos)); if(tr.length>2000) tr.shift(); pilotTrail.setLatLngs(tr); }
    drawPFD(); drawCkInfo();
  }
  updateAudio();
  pilotRaf=requestAnimationFrame(pilotFrame);
}
// le vol continue en arrière-plan si le cockpit est fermé (pilote automatique)
function pilotBackground(dtMs){
  if(!P || !P.hidden) return;
  let left=dtMs/1000*P.accel;
  while(left>0 && P){ const s=Math.min(0.5,left); pilotPhysics(s); left-=s; }
  if(P && pilotMk) pilotMk.setLatLng([P.lat,P.lon]);
}

/* ---------- instruments ---------- */
function drawPFD(){
  const svg=document.getElementById('pfd'); if(!svg) return;
  const pitch=clamp(P.phase==='air'? Math.atan2(P.vs*0.00508, Math.max(30,P.spd)/3.6)*57.3*1.6 : 0,-25,25);
  const py=pitch*3, roll=-P.roll;
  const spd=Math.round(P.spd), alt=Math.round(P.alt);
  let spdTape='', altTape='', hdgTape='';
  for(let v=Math.floor((spd-80)/20)*20; v<=spd+80; v+=20){ if(v<0) continue; const y=100-(v-spd)*0.9; spdTape+=`<line x1="34" x2="40" y1="${y}" y2="${y}"/><text x="31" y="${y+3}" text-anchor="end">${v}</text>`; }
  for(let v=Math.floor((alt-1000)/200)*200; v<=alt+1000; v+=200){ if(v<0) continue; const y=100-(v-alt)*0.08; altTape+=`<line x1="200" x2="206" y1="${y}" y2="${y}"/>${v%1000===0?`<text x="209" y="${y+3}">${v/1000}k</text>`:''}`; }
  for(let h=Math.floor((P.hdg-40)/10)*10; h<=P.hdg+40; h+=10){ const x=120+(h-P.hdg)*1.6; const hh=(h+360)%360; hdgTape+=`<line x1="${x}" x2="${x}" y1="186" y2="${hh%30===0?180:183}"/>${hh%30===0?`<text x="${x}" y="178" text-anchor="middle">${hh===0?'N':hh===90?'E':hh===180?'S':hh===270?'O':hh/10}</text>`:''}`; }
  const vr=P.pf.vr, vsC=clamp(P.vs/40,-60,60);
  svg.innerHTML=`
  <defs><clipPath id="adi"><rect x="45" y="25" width="150" height="150" rx="10"/></clipPath></defs>
  <g clip-path="url(#adi)"><g transform="rotate(${roll} 120 100) translate(0 ${py})">
    <rect x="-100" y="-300" width="440" height="400" fill="#2f7dd1"/><rect x="-100" y="100" width="440" height="400" fill="#7a4b22"/>
    <line x1="-100" x2="340" y1="100" y2="100" stroke="#fff" stroke-width="1.5"/>
    ${[-20,-10,10,20].map(p=>`<line x1="${p%20?105:95}" x2="${p%20?135:145}" y1="${100-p*3}" y2="${100-p*3}" stroke="#fff" stroke-width="1"/>`).join('')}
  </g></g>
  <path d="M85 100 h22 l5 6 M155 100 h-22 l-5 6" stroke="#ffd400" stroke-width="3.5" fill="none"/><circle cx="120" cy="100" r="2.5" fill="#ffd400"/>
  <path d="M120 30 l-5 8 h10z" fill="#fff" transform="rotate(${roll} 120 100)"/>
  <g class="tape"><rect x="0" y="25" width="42" height="150" fill="#0008"/>${spdTape}
    <rect x="0" y="91" width="42" height="18" fill="#000" stroke="#fff"/><text x="38" y="104" text-anchor="end" class="big">${spd}</text>
    ${P.phase!=='air'?`<text x="21" y="22" text-anchor="middle" fill="#0ff">VR ${Math.round(vr)}</text>`:''}</g>
  <g class="tape"><rect x="198" y="25" width="42" height="150" fill="#0008"/>${altTape}
    <rect x="198" y="91" width="42" height="18" fill="#000" stroke="#fff"/><text x="237" y="104" text-anchor="end" class="big">${alt}</text>
    <line x1="196" x2="196" y1="100" y2="${100-vsC}" stroke="#0f0" stroke-width="4"/></g>
  <g class="tape"><rect x="45" y="176" width="150" height="24" fill="#0008"/>${hdgTape}<path d="M120 176 l-4 -6 h8z" fill="#ffd400"/></g>
  ${P.stall?'<text x="120" y="70" text-anchor="middle" class="warn">STALL</text>':''}
  ${P.ap?'<text x="120" y="20" text-anchor="middle" fill="#0f0" font-weight="700">AP1 · AUTOLAND</text>':''}`;
}
function drawCkInfo(){
  const box=document.getElementById('ckInfo'); if(!box) return;
  const to=AP(P.to), d=gcDist(P,to), gs=P.gs||P.spd;
  const eta=gs>50? d/gs*HOUR : 0;
  let guide='';
  if(P.phase==='air' && P.arrR && d<45){
    const R=P.arrR, f=rwyFrame(R,P), dT=Math.max(0,-f.along/1000), ideal=dT*172, dev=P.alt-ideal;
    const lat = Math.abs(f.xt)<40? '<span class="pos">axe ✓</span>' : `axe ${f.xt>0?'◀ à gauche':'▶ à droite'} de ${num0(Math.abs(f.xt))} m`;
    guide = `Piste <b>${R.id}</b> · ${dT.toFixed(1)} km · ${lat} · ` + (Math.abs(dev)<250? '<span class="pos">● plan de descente</span>' : dev>0? `<span class="warnt">▼ trop haut ${num0(dev)} ft</span>` : `<span class="warnt">▲ trop bas ${num0(-dev)} ft</span>`);
  } else if(P.phase==='air' && d<40){
    const ideal=d*172, dev=P.alt-ideal;
    guide = Math.abs(dev)<300? '<span class="pos">● Sur le plan de descente</span>' : dev>0? `<span class="warnt">▼ Trop haut de ${Math.round(dev)} ft — descendez</span>` : `<span class="warnt">▲ Trop bas de ${Math.round(-dev)} ft</span>`;
    if(d<4) guide+= ` · <b>Zone d’atterrissage</b> — visez −200 à −500 ft/min`;
  }
  const fuelPct=P.fuel/P.fuelMax;
  document.getElementById('ckThr').value=Math.round(P.thr*100);
  document.getElementById('ckThrV').textContent=Math.round(P.thr*100)+'%';
  document.getElementById('ckAp').classList.toggle('on',P.ap);
  document.getElementById('ckAcc').textContent='×'+P.accel;
  document.getElementById('ckCam').classList.toggle('on',P.autoCam);
  document.getElementById('ckSnd').textContent=P.sound?'🔊':'🔇';
  const phase = P.phase==='ground'? (P.spd<5?'Au sol':'Course au décollage') : P.phase==='rollout'?'Roulage à l’atterrissage' : P.ap?'Pilote automatique' : P.vs>300?'Montée': P.vs<-300?'Descente':'Croisière';
  box.innerHTML=`<div class="ck-dest">${S.company.code}${flightNumber({id:P.acId})} · ${P.from} ✈ ${P.to} <span class="mut">${esc(to.city)}</span></div>
  <div class="ck-grid">
    <div><span>DIST</span><b>${d<10?d.toFixed(1):Math.round(d)} km</b></div>
    <div><span>ETE</span><b>${eta?fmtDur(eta):'—'}</b></div>
    <div><span>V/S</span><b>${Math.round(P.vs)} ft/min</b></div>
    <div><span>VITESSE SOL</span><b>${Math.round(gs)} km/h <small class="${(gs-P.spd)>=0?'pos':'neg'}">${Math.abs(gs-P.spd)>=5?(gs>P.spd?'+':'')+Math.round(gs-P.spd):''}</small></b></div>
    <div><span>CAP</span><b>${String(Math.round(P.hdg)).padStart(3,'0')}° <small class="mut">→${String(Math.round(bearing(P,to))).padStart(3,'0')}°</small></b></div>
    <div><span>CARBURANT</span><b class="${fuelPct<0.15?'neg':''}">${Math.round(fuelPct*100)} %</b></div>
    <div><span>PHASE</span><b>${phase}</b></div>
  </div>
  <div class="ck-msg">${P.stall?'<b class="neg">⚠ DÉCROCHAGE — baissez le nez et mettez les gaz !</b>':guide||P.msg}</div>
  ${P.commercial?`<div class="small mut">${P.pax?P.pax+' passagers à bord':P.cargo?P.cargo+' t de fret':''}</div>`:''}`;
}

/* ---------- son moteur (Web Audio) ---------- */
function startAudio(){
  try{
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    const ctx=new AC(), len=ctx.sampleRate*2, buf=ctx.createBuffer(1,len,ctx.sampleRate), d=buf.getChannelData(0);
    let last=0; for(let i=0;i<len;i++){ const w=Math.random()*2-1; last=(last+0.02*w)/1.02; d[i]=last*3.5; }
    const src=ctx.createBufferSource(); src.buffer=buf; src.loop=true;
    const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=300;
    const g=ctx.createGain(); g.gain.value=0;
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
    pilotAudio={ctx,f,g};
  }catch(e){ pilotAudio=null; }
}
function updateAudio(){
  if(!pilotAudio||!P) return;
  const v=P.sound? (0.05+0.25*P.thr)*(P.alt>20000?0.6:1) : 0;
  pilotAudio.g.gain.setTargetAtTime(v,pilotAudio.ctx.currentTime,0.2);
  pilotAudio.f.frequency.setTargetAtTime(220+P.thr*700+P.spd*0.3,pilotAudio.ctx.currentTime,0.3);
}
function stopAudio(){ if(pilotAudio){ try{ pilotAudio.ctx.close(); }catch(e){} pilotAudio=null; } }
function beep(freq,dur){
  try{ const ctx=pilotAudio?.ctx; if(!ctx||!P?.sound) return; const o=ctx.createOscillator(), g=ctx.createGain();
    o.frequency.value=freq; g.gain.value=0.08; o.connect(g); g.connect(ctx.destination); o.start(); g.gain.setTargetAtTime(0,ctx.currentTime+dur*0.6,0.05); o.stop(ctx.currentTime+dur); }catch(e){}
}

/* ---------- clavier ---------- */
document.addEventListener('keydown',e=>{
  if(!P || P.hidden || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  const k=e.key.toLowerCase();
  if(['arrowleft','q','a'].includes(k)){ PKEYS.left=true; P.ap=false; }
  else if(['arrowright','d'].includes(k)){ PKEYS.right=true; P.ap=false; }
  else if(['arrowup','z','w'].includes(k)){ if(!e.repeat){ P.vsT=clamp((P.vsT||0)+500,-4000,6000); P.ap=false; } }
  else if(['arrowdown','s'].includes(k)){ if(!e.repeat){ P.vsT=clamp((P.vsT||0)-500,-4000,6000); P.ap=false; } }
  else if(['+','=','pageup'].includes(k)){ P.thr=clamp(P.thr+0.1,0,1); P.ap=false; }
  else if(['-','pagedown'].includes(k)){ P.thr=clamp(P.thr-0.1,0,1); P.ap=false; }
  else if(k===' '){ if(P.phase==='air') P.ap=!P.ap; }
  else if(k==='t'){ const L2=[1,2,4,8,16,32]; P.accel=L2[(L2.indexOf(P.accel)+1)%L2.length]||1; }
  else return;
  e.preventDefault();
});
document.addEventListener('keyup',e=>{ const k=e.key.toLowerCase(); if(['arrowleft','q','a'].includes(k)) PKEYS.left=false; if(['arrowright','d'].includes(k)) PKEYS.right=false; });
