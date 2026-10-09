/* =========================================================
   Sky Empire — 🗼 contrôle aérien
   • Une piste = un seul avion à la fois. Chaque décollage et
     atterrissage réserve la piste ; si elle est prise, l'avion
     attend au point d'arrêt ou tourne dans un circuit d'attente.
   • Les avions des autres compagnies respectent aussi la piste.
   • 📻 Radio de la tour (texte + voix) pour l'avion suivi en 3D.
   • 📡 Écran radar avec balayage, étiquettes et file d'attente.
   ========================================================= */
'use strict';
const ATC_TO=95*1000, ATC_LDG=80*1000, ATC_GAP=25*1000;
function rwyKey(code,r){ if(!r) return code+':0'; const a=r.thr.lat.toFixed(4)+','+r.thr.lon.toFixed(4), b=r.end.lat.toFixed(4)+','+r.end.lon.toFixed(4); return code+':'+(a<b?a+'|'+b:b+'|'+a); }
function atcList(key){ S.atc=S.atc||{}; return S.atc[key]||(S.atc[key]=[]); }
function atcFree(key,s,e,acId){ for(const x of atcList(key)) if(x.ac!==acId&&s<x.e+ATC_GAP&&e+ATC_GAP>x.s) return x; return null; }
function atcPrune(){ if(!S.atc) return; const lim=S.time-15*MIN; for(const k of Object.keys(S.atc)){ const L=S.atc[k].filter(x=>x.e>lim); if(L.length) S.atc[k]=L; else delete S.atc[k]; } }
// appelé pour chaque tronçon programmé (sim.js → startFlight)
function atcPlanLeg(l,m,ac){
  l.hOut=0; l.hIn=0; atcPrune();
  const base=legProfile(l.dist,m,l.wind,l.from,l.to), path=legPath(l,m);
  const sTO=base.segs.find(x=>x.ph===2), sLD=base.segs.find(x=>x.ph===7);
  const kD=rwyKey(l.from,path.dep), kA=rwyKey(l.to,path.arr), fn=S.company.code+(typeof flightNumber==='function'?flightNumber(ac):'');
  let tTO=l.dep+sTO.t0, c, n=0;
  while((c=atcFree(kD,tTO,tTO+ATC_TO,ac.id))&&n++<40){ tTO=c.e+ATC_GAP+1000; }
  let hOut=Math.min(40*MIN,Math.max(0,tTO-(l.dep+sTO.t0))), t0L=l.dep+sLD.t0+hOut, tLD=t0L; n=0;
  // le contrôleur régule au sol : si la piste d'arrivée sera occupée, on retarde le départ de quelques minutes
  // plutôt que de faire tourner l'avion en l'air (circuit d'attente seulement en dernier recours)
  for(let it=0;it<10;it++){
    tLD=t0L; n=0; while((c=atcFree(kA,tLD-ATC_LDG*0.6,tLD+ATC_LDG,ac.id))&&n++<60){ tLD=c.e+ATC_GAP+ATC_LDG*0.6+1000; }
    const need=tLD-t0L; if(need<=0||hOut+need>40*MIN) break;
    tTO=l.dep+sTO.t0+hOut+need; n=0; while((c=atcFree(kD,tTO,tTO+ATC_TO,ac.id))&&n++<40){ tTO=c.e+ATC_GAP+1000; }
    hOut=Math.min(40*MIN,Math.max(0,tTO-(l.dep+sTO.t0))); t0L=l.dep+sLD.t0+hOut;
  }
  l.hOut=hOut;
  // reste-t-il un conflit à l'arrivée ? alors seulement un circuit d'attente (au moins 4 min)
  if(tLD>t0L&&tLD-t0L<4*MIN){ tLD=t0L+4*MIN; n=0; while((c=atcFree(kA,tLD-ATC_LDG*0.6,tLD+ATC_LDG,ac.id))&&n++<60){ tLD=c.e+ATC_GAP+ATC_LDG*0.6+1000; } }
  l.hIn=Math.min(35*MIN,Math.max(0,tLD-t0L)); tLD=t0L+l.hIn;
  atcList(kD).push({s:l.dep+sTO.t0+l.hOut, e:l.dep+sTO.t0+l.hOut+ATC_TO, ac:ac.id, k:'D', fn, o:l.to});
  atcList(kA).push({s:tLD-ATC_LDG*0.6, e:tLD+ATC_LDG, ac:ac.id, k:'A', fn, o:l.from});
  l.rwD=path.dep&&path.dep.id; l.rwA=path.arr&&path.arr.id;
}
// avions des autres compagnies : la piste est-elle libre pour eux ?
const _claims=new Map();
function atcRivalBlocked(key,id,t){
  for(const x of (S.atc&&S.atc[key])||[]) if(t>x.s-ATC_GAP&&t<x.e+ATC_GAP) return true;   // un de vos avions utilise la piste
  // les appels arrivent avec des heures légèrement différentes (carte, 3D, radar) : tolérance de 2 min
  const c=_claims.get(key);
  if(c&&c.id!==id&&c.until>t&&c.from<=t+2*MIN) return true;
  if(!c||c.id===id||c.until<=t) _claims.set(key,{id,from:Math.min(t,c&&c.id===id?c.from:t)-1000,until:Math.max(t,c&&c.id===id?c.until-ATC_TO:t)+ATC_TO});
  return false;
}

/* =========================================================
   RADIO DE LA TOUR
   ========================================================= */
const RADIO={last:{}, lines:[], voice:true};
try{ RADIO.voice=localStorage.getItem('se-voice')!=='0'; }catch(e){}
function callsign(ac){ const n=(S.company.name||'Sky').split(' ').slice(0,2).join(' '); return `${n} ${typeof flightNumber==='function'?flightNumber(ac):''}`; }
function rwSay(id){ return String(id||'').replace(/^0/,'').replace('L',' gauche').replace('R',' droite').replace('C',' centre'); }
function radioSay(who,text){
  RADIO.lines.push({who,text,t:performance.now()}); if(RADIO.lines.length>4) RADIO.lines.shift();
  renderRadio();
  if(RADIO.voice&&typeof FX!=='undefined'&&FX.soundOn&&'speechSynthesis' in window){
    try{ if(FX.sound) radioClick(); const u=new SpeechSynthesisUtterance(text.replace(/\bSE(\d)/,'S E $1')); u.lang='fr-FR'; u.rate=1.12; u.pitch=who==='tour'?0.9:1.15; u.volume=0.9;
      const vs=speechSynthesis.getVoices().filter(v=>/^fr/i.test(v.lang)); if(vs.length) u.voice=vs[who==='tour'?0:Math.min(1,vs.length-1)]; speechSynthesis.speak(u); }catch(e){}
  }
}
function radioClick(){ const s=FX.sound; if(!s) return; const ctx=s.ctx, t=ctx.currentTime, b=ctx.createBufferSource(); b.buffer=s.white; const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=2200; const g=ctx.createGain(); g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.12); b.connect(f); f.connect(g); g.connect(s.master); b.start(t); b.stop(t+0.15); }
function renderRadio(){
  let el=document.getElementById('radioBox'); if(!el){ if(!document.body.classList.contains('globe-follow')) return; el=document.createElement('div'); el.id='radioBox'; $('#main').appendChild(el); }
  el.innerHTML=`<div class="rb-h">📻 Radio <span class="mut">· ${RADIO.voice?'🔈 voix':'voix coupée'}</span></div>`+RADIO.lines.slice(-3).map(l=>`<div class="rb-${l.who}"><b>${l.who==='tour'?'🗼':'👨‍✈️'}</b> ${esc(l.text)}</div>`).join('');
}
function atcTick(ac,st){
  const L=RADIO.last, id=ac.id, cs=callsign(ac), A=AP(st.from), B=AP(st.to), leg=st.leg;
  const w=st.wind||0, wd=Math.round(((st.hdg+(w>0?180:0)+360)%360)/10)*10||360, wk=Math.max(2,Math.round(Math.abs(w)/1.852));
  let k=st.phase+(st.holding?'h'+st.holding:'')+(st.phase===6&&st.alt<320?'f':'')+(st.phase===3&&st.alt>600?'d':'');
  if(L.id!==id){ L.id=id; L.k=null; RADIO.lines=[]; }
  if(L.k===k) return; const prev=L.k; L.k=k; if(prev===null&&st.phase>=3&&st.phase<=5) return;
  const tw=`${A.city} Tour`, ta=`${B.city} Tour`, rwD=rwSay(leg.rwD), rwA=rwSay(leg.rwA);
  const pair=(t1,t2)=>{ radioSay('tour',t1); setTimeout(()=>radioSay('pilote',t2),2600); };
  if(k==='1') pair(`${cs}, ${A.city} Sol, roulez jusqu’au point d’arrêt piste ${rwD}.`,`Point d’arrêt piste ${rwD}, ${cs}.`);
  else if(k==='1hout'){ const m=Math.max(1,Math.round(((st.holdEnd||0)-S.time)/MIN)); pair(`${cs}, ${tw}, maintenez position avant la piste ${rwD}, trafic sur la piste. Attente environ ${m} minute${m>1?'s':''}.`,`On maintient avant la piste ${rwD}, ${cs}.`); }
  else if(k==='2') pair(`${cs}, ${tw}, vent ${wd} degrés ${wk} nœuds, piste ${rwD}, autorisé décollage.`,`Autorisé décollage piste ${rwD}, ${cs}.`);
  else if(k==='3d') pair(`${cs}, contactez le contrôle départ, bon vol.`,`Contrôle départ, ${cs}, au revoir.`);
  else if(k==='5') pair(`${cs}, ${B.city} Approche, descendez niveau 100, calage 1013.`,`Descendons niveau 100, 1013, ${cs}.`);
  else if(k==='6hin'){ const m=Math.max(4,Math.round(((st.holdEnd||0)-S.time)/MIN)); pair(`${cs}, ${B.city} Approche, rejoignez le circuit d’attente, piste occupée, attente prévue ${m} minutes.`,`Circuit d’attente, ${cs}.`); }
  else if(k==='6') pair(`${cs}, autorisé approche ILS piste ${rwA}.`,`Approche ILS piste ${rwA}, ${cs}.`);
  else if(k==='6f') pair(`${cs}, ${ta}, vent ${wd} degrés ${wk} nœuds, piste ${rwA}, autorisé atterrissage.`,`Autorisé atterrissage piste ${rwA}, ${cs}.`);
  else if(k==='8') pair(`${cs}, dégagez à droite, contactez le sol. Bienvenue à ${B.city}.`,`On dégage, merci, ${cs}.`);
}

/* =========================================================
   📡 RADAR
   ========================================================= */
const RADAR={ap:null, range:60, raf:0, sweep:0, t0:0};
function radarTargets(code){
  const A=AP(code), out=[], t=typeof simNow==='function'?simNow():S.time, R=RADAR.range*1.852;
  for(const ac of S.fleet){ if(ac.status!=='flight') continue; const st=flightState(ac,t); if(!st) continue; const d=gcDist(A,st); if(d>R*1.05) continue;
    out.push({me:true, lat:st.lat, lon:st.lon, hdg:st.hdg, alt:st.alt, spd:st.gs||st.spd, cs:S.company.code+flightNumber(ac), hold:st.holding, ph:st.phase, gnd:st.alt<1}); }
  const b=L.latLngBounds([A.lat-R/111,A.lon-R/80],[A.lat+R/111,A.lon+R/80]);
  const list=[...((S.rivals||[]).flatMap(R0=>R0.routes.map(r=>{ if(!r.c) r.c=R0.code; return {R:R0,r}; }))), ...(typeof visibleRealRoutes==='function'?visibleRealRoutes(b,A.lon,40):[])];
  for(const {R:Rr,r} of list.slice(0,400)){ for(let i=0;i<3;i++){ const q=rivalPos(r,i,t); if(!q) continue; const d=gcDist(A,q.p); if(d>R*1.05) continue;
      out.push({me:false, lat:q.p.lat, lon:q.p.lon, hdg:q.hdg, alt:q.alt||(q.d<1200?6500:10500), spd:q.ph===4?(q.d<1200?520:850):300, cs:(Rr.code||'')+(100+hashStr(r.a+r.b+i)%800), hold:q.holding, ph:q.ph, gnd:q.gnd}); } }
  return out;
}
function radarHtml(){
  const opts=[...new Set([...(S.hubs||[]),...S.routes.flatMap(r=>r.stops)])].filter(c=>AP(c));
  return `<div class="row wrap"><select data-in="radarAp">${opts.map(c=>`<option value="${c}" ${c===RADAR.ap?'selected':''}>${flag(c)} ${esc(AP(c).city)} (${c})</option>`).join('')}</select>
    <div class="chips">${[20,40,60,120].map(r=>`<button class="chip ${RADAR.range===r?'on':''}" data-act="radarRange" data-r="${r}">${r} NM</button>`).join('')}</div></div>
    <div class="radar-wrap"><canvas id="radarCv" width="720" height="720"></canvas></div>
    <div class="small mut">🟡 vos avions · 🟢 autres compagnies · 🟠 en attente (piste occupée) · altitude en centaines de pieds</div>
    <h4>🗼 Séquence de la tour</h4><div id="radarSeq" class="small"></div>`;
}
function radarSeqHtml(){
  const code=RADAR.ap, rows=[];
  for(const [k,L] of Object.entries(S.atc||{})) if(k.startsWith(code+':')) for(const x of L) if(x.e>S.time-2*MIN) rows.push(x);
  rows.sort((a,b)=>a.s-b.s);
  if(!rows.length) return '<span class="mut">Aucun de vos mouvements prévus sur cette piste pour l’instant.</span>';
  return rows.slice(0,8).map(x=>`<div class="rseq ${x.s<=S.time&&x.e>=S.time?'now':''}">${fmtTime(x.s)} · ${x.k==='D'?'🛫 Décollage':'🛬 Atterrissage'} <b>${esc(x.fn)}</b> ${x.k==='D'?'→':'←'} ${esc(AP(x.o)?AP(x.o).city:x.o)}${x.s<=S.time&&x.e>=S.time?' · <b>sur la piste</b>':''}</div>`).join('');
}
function radarDraw(){
  const cv=document.getElementById('radarCv'); if(!cv||UI.modal!=='radar'){ cancelAnimationFrame(RADAR.raf); RADAR.raf=0; return; }
  RADAR.raf=requestAnimationFrame(radarDraw);
  const now=performance.now(); if(now-RADAR.t0<50) return; const dt=(now-(RADAR.t0||now))/1000; RADAR.t0=now;
  const g=cv.getContext('2d'), W=cv.width, c=W/2, A=AP(RADAR.ap), Rkm=RADAR.range*1.852, sc=(c-14)/Rkm;
  RADAR.sweep=(RADAR.sweep+dt*90)%360;
  g.fillStyle='#03140b'; g.fillRect(0,0,W,W);
  const grd=g.createRadialGradient(c,c,10,c,c,c); grd.addColorStop(0,'rgba(20,90,45,.35)'); grd.addColorStop(1,'rgba(0,0,0,.1)'); g.fillStyle=grd; g.beginPath(); g.arc(c,c,c-6,0,7); g.fill();
  g.strokeStyle='rgba(60,255,120,.25)'; g.lineWidth=1.2; g.font='16px ui-monospace,monospace'; g.fillStyle='rgba(60,255,120,.5)';
  for(let i=1;i<=4;i++){ g.beginPath(); g.arc(c,c,(c-14)*i/4,0,7); g.stroke(); g.fillText(`${Math.round(RADAR.range*i/4)}`,c+4,c-(c-14)*i/4+16); }
  for(let a=0;a<360;a+=30){ const r=a*Math.PI/180; g.beginPath(); g.moveTo(c,c); g.lineTo(c+Math.sin(r)*(c-14),c-Math.cos(r)*(c-14)); g.stroke(); }
  const xy=(lat,lon)=>{ const d=gcDist(A,{lat,lon}), b=bearing(A,{lat,lon})*Math.PI/180; return [c+Math.sin(b)*d*sc, c-Math.cos(b)*d*sc]; };
  // pistes
  g.strokeStyle='#e5e7eb'; g.lineWidth=4; for(const r of runwaysOf(RADAR.ap)){ const [x1,y1]=xy(r.thr.lat,r.thr.lon), [x2,y2]=xy(r.end.lat,r.end.lon); g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); }
  // balayage
  const sr=RADAR.sweep*Math.PI/180; for(let k=0;k<26;k++){ const a=sr-k*0.025; g.strokeStyle=`rgba(80,255,140,${0.5*(1-k/26)})`; g.lineWidth=3; g.beginPath(); g.moveTo(c,c); g.lineTo(c+Math.sin(a)*(c-10),c-Math.cos(a)*(c-10)); g.stroke(); }
  // cibles
  if(!RADAR.tg||now-RADAR.tgAt>900){ RADAR.tg=radarTargets(RADAR.ap); RADAR.tgAt=now; }
  g.font='bold 15px ui-monospace,monospace';
  for(const p of RADAR.tg){ const [x,y]=xy(p.lat,p.lon); if(Math.hypot(x-c,y-c)>c-8) continue;
    const ang=(bearing(A,p)+360)%360, since=((RADAR.sweep-ang+360)%360)/360, br=Math.max(0.35,1-since*0.8);
    const col=p.hold?`rgba(251,146,60,${br})`:p.me?`rgba(250,204,21,${br})`:`rgba(74,222,128,${br})`;
    g.fillStyle=col; g.strokeStyle=col; g.lineWidth=2;
    if(p.gnd){ g.fillRect(x-3,y-3,6,6); } else { g.beginPath(); g.rect(x-5,y-5,10,10); g.stroke(); const h=(p.hdg||0)*Math.PI/180, v=Math.min(40,(p.spd||300)/18); g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.sin(h)*v,y-Math.cos(h)*v); g.stroke(); }
    if(p.me||RADAR.range<=60){ g.fillText(p.cs,x+9,y-6); g.font='13px ui-monospace,monospace'; g.fillText(`${p.gnd?'SOL':String(Math.round(p.alt*3.28/100)).padStart(3,'0')} ${Math.round((p.spd||0)/1.852)}${p.hold?' ATT':''}`,x+9,y+10); g.font='bold 15px ui-monospace,monospace'; } }
  g.fillStyle='#4ade80'; g.font='bold 16px ui-monospace,monospace'; g.fillText(`${RADAR.ap} · ${A.city}`,12,24); g.fillText(fmtTime(S.time)+' UTC',12,W-12);
  if(!RADAR.seqAt||now-RADAR.seqAt>2000){ RADAR.seqAt=now; const el=document.getElementById('radarSeq'); if(el) el.innerHTML=radarSeqHtml(); }
}
function openRadar(code){
  RADAR.ap=code||RADAR.ap||(G&&G.follow&&(()=>{ const ac=S.fleet.find(a=>a.id===G.follow), st=ac&&flightState(ac); return st&&(st.frac>0.5?st.to:st.from); })())||S.company.hub;
  UI.modal='radar'; showModal('📡 Radar & tour de contrôle', radarHtml(), true); RADAR.tg=null; cancelAnimationFrame(RADAR.raf); RADAR.raf=requestAnimationFrame(radarDraw);
}
function registerAtcActions(){
  MODALS.radar=()=>openRadar();
  Object.assign(ACTIONS,{
    radar:d=>openRadar(d&&d.c),
    radarRange:d=>{ RADAR.range=+d.r; openRadar(RADAR.ap); },
    radioVoice:()=>{ RADIO.voice=!RADIO.voice; try{ localStorage.setItem('se-voice',RADIO.voice?'1':'0'); }catch(e){} if(!RADIO.voice&&'speechSynthesis' in window) speechSynthesis.cancel(); renderRadio(); renderGlobeHud(); },
  });
  INPUTS.radarAp=el=>openRadar(el.value);
}

// vols programmés avant l'arrivée du contrôle aérien (anciennes sauvegardes) : créneaux attribués au chargement
function atcMigrate(){
  if(!S||!S.fleet||S._atcMig) return; S._atcMig=1;
  const fl=S.fleet.filter(a=>a.flight&&a.status==='flight').map(a=>({a,l:a.flight.legs[a.flight.li]})).filter(x=>x.l&&x.l.hOut===undefined).sort((x,y)=>x.l.dep-y.l.dep);
  for(const {a,l} of fl){ const m=modelOf(a), base=legProfile(l.dist,m,l.wind,l.from,l.to), tTO=l.dep+base.segs.find(x=>x.ph===2).t0;
    if(S.time<tTO-20000){ atcPlanLeg(l,m,a); }   // pas encore décollé : créneau de décollage et d'atterrissage
    else { l.hOut=0; const sLD=base.segs.find(x=>x.ph===6); if(S.time<l.dep+sLD.t0-60000){ const keep=l.dep; atcPlanLeg(l,m,a); l.hOut=0; l.dep=keep; } }
    // les tronçons suivants de ce vol sont recalés
    let dep=legEnd(l,m); for(let i=a.flight.li+1;i<a.flight.legs.length;i++){ const n=a.flight.legs[i]; n.dep=Math.max(n.dep,dep); atcPlanLeg(n,m,a); dep=legEnd(n,m); }
  }
}
