/* ============================================================
   MODE SIMPLE
   Trois gestes : choisir son hub, ouvrir une ligne, regarder voler.
   Le personnel, le carburant, la maintenance et la programmation
   des avions sont gérés automatiquement (désactivable dans « Plus »).
   ============================================================ */

/* ---------- programmation automatique des avions ---------- */
// Choisit pour un avion la ligne de son hub qui en a le plus besoin et la programme au maximum utile
function autoPlan(ac){
  if(!ac || ac.status==='manual') return null;
  const m=modelOf(ac), seats=Math.max(m.seats, m.cargo*3, 1); let best=null;
  for(const r of S.routes){
    if(r.stops[0]!==ac.hub || checkLegs(ac,legsFor(r.stops))) continue;
    const a=r.stops[0], b=r.stops[r.stops.length-1];
    const dem=marketDemand(a,b), served=routeAircraft(r).length;
    const free=maxWeekly(ac,r); if(free<=0) continue;
    const score=dem/(1+served*1.5) * (seats>dem*0.4? 0.5 : 1);
    if(!best || score>best.score) best={r, score, dem, free};
  }
  if(!best) return null;
  const perDay=best.dem*0.45/(seats*0.8);               // rotations/jour nécessaires pour capter la demande
  const weekly=clamp(Math.ceil(perDay*7), 1, best.free);
  return setPlan(ac,best.r.id,weekly)? null : best.r;
}
function autoPlanAll(){
  let n=0;
  for(const ac of S.fleet){
    if(ac.status==='manual' || (ac.plan||[]).some(p=>p.weekly>0)) continue;
    if(autoPlan(ac)) n++;
  }
  return n;
}

/* ---------- gestion automatique quotidienne ---------- */
function autoManage(){
  const A=S.auto||{};
  // pilotes : 2 par avion + 2 de réserve par famille, formés immédiatement (si « recrutement automatique » est activé)
  const cnt={}; for(const a of S.fleet){ const f=modelOf(a).fam; cnt[f]=(cnt[f]||0)+1; }
  if(A.pil) for(const [f,n] of Object.entries(cnt)){
    let q=qualifiedPilots(f)+S.pilots.filter(p=>p.training&&p.training.fam===f).length, guard=0;
    while(q<2*n+2 && guard++<4000){ const p=makePilot([f],true); S.pilots.push(p); book('recrutement',-p.salary); useHire('pil',1); q++; }
  }
  // personnel navigant, mécaniciens, sol
  const need=staffNeed();
  for(const k of ['pnc','meca','sol']){ if(!A[k]) continue; const miss=need[k]-S.staff[k]; if(miss>0){ book('recrutement',-STAFF_CATS[k][1]*0.6*miss); S.staff[k]+=miss; useHire(k,miss); } }
  if(!S.simple) return;
  S.autoMaint=true;
  // carburant et CO₂
  if(S.fuel.stock<S.fuel.cap*0.35){ const l=S.fuel.cap*0.85-S.fuel.stock; if(S.cash>l*fuelPrice()*1.3) buyFuel(l,true); }
  if(S.co2.stock<S.co2.cap*0.3) buyCO2(S.co2.cap*0.7-S.co2.stock);
  // avions livrés ou libres
  autoPlanAll();
}

/* ---------- tutoriel court ---------- */
const SIMPLE_GUIDE = [
  {t:'Ouvrez votre première ligne', d:'Touchez « Montre-moi », puis « Ouvrir la ligne » : votre avion sera programmé tout seul.', done:()=>S.routes.length>0,
   go:()=>GUIDE[0].go()},
  {t:'Regardez voler votre avion', d:'Ouvrez « 🛫 Mes vols » sur la carte et touchez votre avion pour le suivre.', done:()=>S.stats.flights>0||UI.followed,
   go:()=>{ S.speed='rapide'; setTab('map'); const ac=S.fleet.find(a=>a.status==='flight'); if(ac){ selectPlane(ac.id); followPlane=true; UI.followed=true; } else { UI.fl=true; renderFlightList(); } }},
  {t:'Achetez un deuxième avion', d:'Onglet « Acheter » : le nouvel avion rejoint automatiquement une ligne.', done:()=>S.fleet.length>=(START_PACKS[S.packId||'regional']?START_PACKS[S.packId||'regional'].fleet.length+1:3),
   go:()=>setTab('shop')},
];

/* ---------- bandeaux d'aide en haut des onglets ---------- */
function simpleTop(tab){
  if(!isSimple()) return '';
  if(tab==='network'){
    const nf=S.routes.length? S.fleet.filter(a=>!(a.plan||[]).some(p=>p.weekly>0)&&a.status!=='manual').length : 0;
    return `<div class="simplehelp">🧭 Une <b>ligne</b> relie votre hub à une ville. Ouvrez-en une : un avion libre y est programmé <b>automatiquement</b>.${S.routes.length===0?' Commencez par là !':''}</div>
    <div class="bigcta"><button class="btn gold" data-act="openLine">➕ Ouvrir une ligne<small>Choisissez une ville, c’est tout</small></button>
    ${nf?`<button class="btn" data-act="autoAll">⚡ Programmer mes ${nf} avion(s) libre(s)<small>Chacun va sur la meilleure ligne</small></button>`:''}</div>`;
  }
  if(tab==='fleet'){
    const nf=S.routes.length? S.fleet.filter(a=>!(a.plan||[]).some(p=>p.weekly>0)&&a.status!=='manual').length : 0;
    return `<div class="bigcta"><button class="btn gold" data-act="goShop">🛒 Acheter un avion<small>Il est programmé tout seul</small></button>
    ${nf?`<button class="btn" data-act="autoAll">⚡ Programmer mes ${nf} avion(s) libre(s)<small>Chacun va sur la meilleure ligne</small></button>`:''}</div>`;
  }
  if(tab==='shop') return `<div class="simplehelp">🛒 Achetez, louez ou prenez d’occasion. Le nouvel avion, ses pilotes et son équipage sont gérés automatiquement.</div>`;
  return '';
}

/* ---------- menu « Plus » ---------- */
function pMore(){
  const wk=ledSum(S.led.week||{},1)+ledSum(S.led.week||{},-1), flying=S.fleet.filter(a=>a.status==='flight').length;
  const item=(k,i,l,d)=>`<button data-tab="${k}">${i} <b>${l}</b><small>${d}</small></button>`;
  return `<div class="hero"><div class="biglogo" style="background:${S.company.color}">${esc(S.company.logo)}</div>
    <div class="grow"><h2>${esc(S.company.name)} <span class="mut">${esc(S.company.code)}</span></h2><div>${stars(S.reputation)}</div>
    <div class="small mut">Hub : ${S.hubs.map(h=>`${flag(h)} ${AP(h).city}`).join(' · ')}</div></div></div>
  <div class="kpis"><div class="kpi"><div class="kl">Capital</div><div class="kv ${S.cash<0?'neg':''}">${fmtMoney(S.cash)}</div></div>
    <div class="kpi"><div class="kl">Cette semaine</div><div class="kv ${wk<0?'neg':'pos'}">${wk>=0?'+':''}${fmtMoney(wk)}</div></div>
    <div class="kpi"><div class="kl">Avions en vol</div><div class="kv">${flying} / ${S.fleet.length}</div></div>
    <div class="kpi"><div class="kl">Passagers</div><div class="kv">${num(S.stats.pax)}</div></div></div>
  <h3>Aller plus loin</h3>
  <div class="morelist">
    ${item('finance','💰','Finances','Recettes et dépenses')}
    ${item('dash','🏠','Statistiques','Objectifs, journal')}
    ${item('pax','🛂','Passagers','Nationalités, richesse, prix')}
    ${item('world','🌐','Monde','Pays, compagnies, marchés')}
    ${item('shop','🛒','Acheter','Avions neufs et occasion')}
    ${item('staff','👥','Personnel','Géré automatiquement')}
    ${item('fuel','⛽','Carburant','Géré automatiquement')}
    ${item('company','📣','Compagnie','Prix, publicité, alliances')}
    ${item('bourse','📈','Bourse','Actions et rachats')}
  </div>
  <label class="tog"><input type="checkbox" data-in="simple" ${S.simple?'checked':''}> <b>Mode simple</b> : personnel, carburant, maintenance et programmation automatiques</label>
  <div class="small mut" style="margin:4px 0 10px">Décochez pour tout gérer vous-même (mode expert : tous les onglets).</div>
  <div class="btns"><button class="btn" data-act="guideReset">🎓 Revoir le tutoriel</button><button class="btn" data-act="mapStyle">🗺️ Fond de carte</button></div>
  <div class="btns"><button class="btn" data-tab="admin">🛠️ Outils de test</button></div>`;
}

/* ---------- liste des vols (façon « Airline Manager ») ---------- */
function renderFlightList(){
  const box=$('#flightlist'); if(!box||!S) return;
  box.hidden=!UI.fl; if(!UI.fl) return;
  const tab=UI.flTab||'fly';
  const fly=S.fleet.filter(a=>a.status==='flight'||a.status==='manual');
  const idle=S.fleet.filter(a=>a.status!=='flight'&&a.status!=='manual'&&(a.plan||[]).some(p=>p.weekly>0));
  const wait=S.fleet.filter(a=>a.status!=='flight'&&a.status!=='manual'&&!(a.plan||[]).some(p=>p.weekly>0));
  const short=ac=>modelOf(ac).name.replace(/^(Airbus|Boeing|Embraer|Bombardier|ATR|Cessna|De Havilland Canada|Saab|Sukhoi|Comac|Irkut|Antonov) ?/,'');
  let rows='';
  if(tab==='fly'){
    rows=fly.map(ac=>{ const st=ac.status==='flight'?flightState(ac,simNow()):null;
      return st? `<div class="fl-row" data-act="flSel" data-id="${ac.id}"><div class="grow"><b>${ac.reg}</b> <span class="mut">${esc(short(ac))}</span><br><span class="small">${st.origin} → ${st.dest} · ${PHASES[st.phase]}</span><div class="pbar"><i style="width:${(st.progress*100).toFixed(0)}%"></i></div></div><b>${Math.round(st.progress*100)} %</b></div>`
        : `<div class="fl-row" data-act="flSel" data-id="${ac.id}"><div class="grow"><b>${ac.reg}</b> 🕹️ Piloté par vous</div></div>`; }).join('');
    if(!rows) rows=`<div class="fl-empty">Aucun avion en vol.<br>${S.routes.length?'Ils décolleront selon leur planning.':'Ouvrez d’abord une ligne.'}</div>`;
  } else if(tab==='ground'){
    rows=idle.map(ac=>{ const pl=(ac.plan||[]).find(p=>p.weekly>0), r=pl&&S.routes.find(x=>x.id===pl.routeId);
      return `<div class="fl-row" data-act="flSel" data-id="${ac.id}"><div class="grow"><b>${ac.reg}</b> <span class="mut">${esc(short(ac))}</span><br><span class="small">${ac.status==='maint'?'🔧 En maintenance':'Au sol à '+AP(ac.loc).city}${r?' · ligne '+r.stops.join('⇄'):''}</span></div></div>`; }).join('')
      || `<div class="fl-empty">Aucun avion au sol.</div>`;
  } else {
    rows=wait.map(ac=>`<div class="fl-row" data-act="flSel" data-id="${ac.id}"><div class="grow"><b>${ac.reg}</b> <span class="mut">${esc(short(ac))}</span><br><span class="small warnt">Pas de ligne · ${AP(ac.loc).city}</span></div></div>`).join('')
      || `<div class="fl-empty">Tous vos avions ont une ligne 👍</div>`;
  }
  const html=`<div class="fl-head"><b>🛫 Mes vols</b><button class="btn sm" data-act="flightList">×</button></div>
    <div class="fl-tabs"><button class="${tab==='fly'?'on':''}" data-act="flTab" data-k="fly">En vol (${fly.length})</button><button class="${tab==='ground'?'on':''}" data-act="flTab" data-k="ground">Au sol (${idle.length})</button><button class="${tab==='wait'?'on':''}" data-act="flTab" data-k="wait">Sans ligne (${wait.length})</button></div>
    <div class="fl-body">${rows}</div>
    <div class="fl-act"><button class="btn sm gold" data-act="openLine">➕ Nouvelle ligne</button>${tab==='wait'&&wait.length?`<button class="btn sm" data-act="autoAll">⚡ Programmer</button>`:`<button class="btn sm" data-act="goShop">🛒 Avion</button>`}</div>`;
  if(box._h!==html && performance.now()-(UI.flTouch||0)>900){ box._h=html; box.innerHTML=html; }
}

if(typeof ACTIONS!=='undefined'){
if(typeof registerNewsActions==='function') registerNewsActions();
if(typeof registerPaxActions==='function') registerPaxActions();
Object.assign(ACTIONS,{
  flightList:()=>{ UI.fl=!UI.fl; if(UI.fl&&UI.mobile) $('#mapctl').classList.remove('open'); renderFlightList(); },
  flTab:d=>{ UI.flTab=d.k; renderFlightList(); },
  flSel:d=>{ const ac=findAc(d.id); if(!ac) return;
    if(ac.status==='flight'){ selectPlane(ac.id); zoomPlane(); } else { selectPlane(null); focusAirport(ac.loc); }
    if(UI.mobile){ UI.fl=false; renderFlightList(); } },
  mapAdv:()=>{ $('#mapctl').classList.toggle('advopen'); },
  autoAll:()=>{ const n=autoPlanAll(); toast(n?`⚡ ${n} avion(s) programmé(s)`:'Aucune ligne disponible pour ces avions : ouvrez une ligne depuis leur hub','ok'); after(); renderFlightList(); },
  goShop:()=>{ closeModal(); setTab('shop'); },
});
Object.assign(INPUTS,{
  simple:el=>{ S.simple=el.checked; renderTabs(); renderGuide(); toast(S.simple?'Mode simple activé : gestion automatique':'Mode expert : vous gérez tout vous-même','ok'); setTab(S.simple?'more':'dash'); },
});
document.addEventListener('pointerdown',e=>{ if(e.target.closest&&e.target.closest('#flightlist')) UI.flTouch=performance.now(); },true);
setInterval(()=>{ if(typeof S!=='undefined'&&S&&UI.fl) renderFlightList(); },1500);
}
