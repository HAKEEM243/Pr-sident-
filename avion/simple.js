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
    return advisorHtml()+`<div class="simplehelp">🧭 Une <b>ligne</b> relie votre hub à une ville. Ouvrez-en une : un avion libre y est programmé <b>automatiquement</b>.${S.routes.length===0?' Commencez par là !':''}</div>
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
  ${diagHtml()}
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
  <div class="btns"><button class="btn" data-act="exportSave">💾 Exporter ma sauvegarde</button><button class="btn" data-act="importSave">📂 Importer</button></div>
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
if(typeof registerAirlineActions==='function') registerAirlineActions();
Object.assign(ACTIONS,{
  flightList:()=>{ UI.fl=!UI.fl; if(UI.fl&&UI.mobile) $('#mapctl').classList.remove('open'); renderFlightList(); },
  flTab:d=>{ UI.flTab=d.k; renderFlightList(); },
  flSel:d=>{ const ac=findAc(d.id); if(!ac) return;
    if(ac.status==='flight'){ selectPlane(ac.id); zoomPlane(); } else { selectPlane(null); focusAirport(ac.loc); }
    if(UI.mobile){ UI.fl=false; renderFlightList(); } },
  mapAdv:()=>{ $('#mapctl').classList.toggle('advopen'); },
  autoAll:()=>{ const n=autoPlanAll(); toast(n?`⚡ ${n} avion(s) programmé(s)`:'Aucune ligne disponible pour ces avions : ouvrez une ligne depuis leur hub','ok'); after(); renderFlightList(); },
  goShop:()=>{ closeModal(); setTab('shop'); },
  exportSave:()=>{ save(); const blob=new Blob([localStorage.getItem(SAVE_KEY)||JSON.stringify(S)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`sky-empire-${S.company.code}-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },600); toast('💾 Sauvegarde téléchargée : gardez ce fichier précieusement','ok'); },
  importSave:()=>{ const f=document.getElementById('importFile'); if(f) f.click(); },
});
Object.assign(INPUTS,{
  simple:el=>{ S.simple=el.checked; renderTabs(); renderGuide(); toast(S.simple?'Mode simple activé : gestion automatique':'Mode expert : vous gérez tout vous-même','ok'); setTab(S.simple?'more':'dash'); },
});
document.addEventListener('pointerdown',e=>{ if(e.target.closest&&e.target.closest('#flightlist')) UI.flTouch=performance.now(); },true);
setInterval(()=>{ if(typeof S!=='undefined'&&S&&UI.fl) renderFlightList(); },1500);
}

/* ============================================================
   DIAGNOSTIC FINANCIER : pourquoi je suis dans le rouge ?
   ============================================================ */
function pilotsRequired(){ const n={}; for(const a of S.fleet){ const f=modelOf(a).fam; n[f]=(n[f]||0)+1; } return {map:n, total:Object.values(n).reduce((s,v)=>s+2*v+2,0)}; }
function financeDiagnosis(){
  const w=S.led.prevWeek&&Object.keys(S.led.prevWeek).length? S.led.prevWeek : (S.led.week||{});
  const rev=ledSum(w,1), cost=-ledSum(w,-1), res=rev-cost, out=[];
  const costs=Object.entries(w).filter(([k,v])=>typeof v==='number'&&v<0).sort((a,b)=>a[1]-b[1]);
  // 1. pilotes en trop
  const req=pilotsRequired(), keepP=Math.ceil(req.total*1.1), surP=Math.max(0,S.pilots.length-keepP);
  if(surP>0){ const avg=S.pilots.reduce((s,p)=>s+p.salary,0)/Math.max(1,S.pilots.length), sav=surP*avg*S.staff.sal.pil/100;
    out.push({w:sav*12/52, ico:'👨‍✈️', t:`Vous avez <b>${num(S.pilots.length)} pilotes</b> pour seulement ${num(req.total)} nécessaires : <b>${num(surP)} pilotes en trop</b> coûtent ≈ ${fmtMoney(sav)} par mois en salaires.`, fix:'trimStaff', label:`Licencier les ${num(surP)} pilotes en trop`}); }
  // 2. personnel en trop
  const need=staffNeed(); let savS=0, nS=0;
  for(const k of ['pnc','meca','sol']){ const keep=Math.ceil(need[k]*1.1), sur=Math.max(0,S.staff[k]-keep); if(sur>0){ nS+=sur; savS+=sur*STAFF_CATS[k][1]*S.staff.sal[k]/100; } }
  if(nS>0) out.push({w:savS*12/52, ico:'🧳', t:`<b>${num(nS)} employés en trop</b> (navigants, mécaniciens, sol) : ≈ ${fmtMoney(savS)} par mois.`, fix:'trimStaff', label:`Ajuster le personnel`});
  // 3. avions sans ligne
  const idle=S.fleet.filter(a=>!(a.plan||[]).some(p=>p.weekly>0)&&a.status!=='manual');
  if(idle.length){ const lease=idle.filter(a=>!a.owned).reduce((s,a)=>s+a.lease,0), val=idle.reduce((s,a)=>s+(typeof acValue==='function'?acValue(a):0),0);
    out.push({w:lease*12/52+val*0.002, ico:'✈️', t:`<b>${idle.length} avion(s) sans ligne</b> ne rapportent rien${lease?` et coûtent ${fmtMoney(lease)}/mois de location`:''} (valeur immobilisée ≈ ${fmtMoney(val)}).`, fix:'autoAll', label:`Les programmer sur vos lignes`}); }
  // 4. lignes qui perdent
  const losers=S.routes.filter(r=>r.stats.flights>=6&&(r.stats.rev-r.stats.cost)<0).sort((a,b)=>(a.stats.rev-a.stats.cost)-(b.stats.rev-b.stats.cost));
  if(losers.length){ const tot=losers.reduce((s,r)=>s+(r.stats.rev-r.stats.cost),0);
    out.push({w:-tot/20, ico:'🧭', t:`<b>${losers.length} ligne(s) perdent de l’argent</b> (pire : ${losers[0].stops.join('⇄')}, ${fmtMoney(losers[0].stats.rev-losers[0].stats.cost)}). Baissez la fréquence, ajustez les prix ou fermez-les.`, tab:'network', label:'Voir mes lignes'}); }
  // 5. prix trop bas / trop haut
  const rs=S.routes.filter(r=>r.audit&&routeAircraft(r).length);
  const lowP=rs.filter(r=>(r.pm.y??1)<0.85).length;
  if(lowP) out.push({w:1e4*lowP, ico:'🏷️', t:`<b>${lowP} ligne(s)</b> vendent leurs billets à plus de 15 % sous le prix idéal : vous remplissez les avions mais gagnez peu.`, tab:'network', label:'Ajuster les prix'});
  // 6. carburant
  const fuelW=-(w.carburant||0); if(S.oil>98&&fuelW>0.3*cost) out.push({w:fuelW*0.1, ico:'⛽', t:`Le kérosène est cher (${S.oil.toFixed(0)} $/baril) : il pèse ${Math.round(fuelW/Math.max(1,cost)*100)} % de vos dépenses.`, tab:'fuel', label:'Acheter le carburant'});
  // 7. leasing
  const lz=-(w.leasing||0); if(lz>0.2*cost) out.push({w:lz*0.2, ico:'🔑', t:`La location d’avions pèse ${Math.round(lz/Math.max(1,cost)*100)} % de vos dépenses : rendez les appareils sous-utilisés.`, tab:'fleet', label:'Voir la flotte'});
  out.sort((a,b)=>b.w-a.w);
  return {res, rev, cost, top:costs.slice(0,4), items:out};
}
function diagHtml(){
  const d=financeDiagnosis(), ok=d.res>=0;
  const catName=k=>(LED_CATS[k]||[k])[0];
  return `<div class="card diag ${ok?'':'diag-bad'}"><div class="row"><b class="grow">🔍 ${ok?'Vos finances sont dans le vert':'Pourquoi je suis dans le rouge ?'}</b><span class="${ok?'pos':'neg'}"><b>${d.res>=0?'+':''}${fmtMoney(d.res)}</b> <span class="mut small">la semaine dernière</span></span></div>
    <div class="small mut">Recettes ${fmtMoney(d.rev)} · dépenses ${fmtMoney(d.cost)} · plus gros postes : ${d.top.map(([k,v])=>`${catName(k)} ${fmtMoney(-v)}`).join(' · ')||'—'}</div>
    ${d.items.length? d.items.slice(0,5).map(i=>`<div class="diag-item"><div class="grow">${i.ico} ${i.t}</div>${i.fix?`<button class="btn sm gold" data-act="${i.fix}">${i.label}</button>`:`<button class="btn sm" data-tab="${i.tab}">${i.label}</button>`}</div>`).join('') : `<div class="small mut" style="margin-top:6px">${ok?'Rien d’anormal : continuez ainsi.':'Pas de cause évidente : laissez passer une semaine complète pour que le bilan se stabilise (un avion neuf coûte avant de rapporter).'}</div>`}</div>`;
}
if(typeof ACTIONS!=='undefined') Object.assign(ACTIONS,{
  trimStaff:()=>{
    const req=pilotsRequired(), remain={...Object.fromEntries(Object.entries(req.map).map(([f,n])=>[f,Math.ceil((2*n+2)*1.1)]))};
    const keep=[], fired=[];
    for(const p of S.pilots.slice().sort((a,b)=>b.hours-a.hours)){
      const q=p.quals.find(x=>remain[x]>0);
      if(p.training||q){ keep.push(p); if(q) remain[q]--; } else fired.push(p);
    }
    let sev=fired.reduce((s,p)=>s+p.salary*0.5,0);
    let nStaff=0; const need=staffNeed();
    for(const k of ['pnc','meca','sol']){ const target=Math.ceil(need[k]*1.1), sur=Math.max(0,S.staff[k]-target); if(sur>0){ sev+=sur*STAFF_CATS[k][1]*0.5; S.staff[k]=target; nStaff+=sur; } }
    if(!fired.length&&!nStaff) return toast('Rien à ajuster : vos effectifs sont déjà au bon niveau','ok');
    S.pilots=keep; book('salaires',-sev);
    logMsg(`✂️ Effectifs ajustés : ${num(fired.length)} pilotes et ${num(nStaff)} employés en moins (indemnités ${fmtMoney(sev)}).`,'ok');
    toast(`✅ ${num(fired.length)} pilotes et ${num(nStaff)} employés en moins · masse salariale ramenée à ${fmtMoney(monthlyPayroll())}/mois`,'ok'); renderPanel(); renderTop();
  },
});

if(typeof document!=='undefined') document.addEventListener('DOMContentLoaded',()=>{
  const f=document.getElementById('importFile'); if(!f) return;
  f.addEventListener('change',()=>{
    const file=f.files&&f.files[0]; if(!file) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{ const o=JSON.parse(rd.result); if(!o||!o.company||!o.fleet||!o.time) throw new Error('fichier invalide');
        if(!confirm(`Importer la sauvegarde « ${o.company.name} » ? Votre partie actuelle sera remplacée.`)) return;
        localStorage.setItem(SAVE_KEY,rd.result); location.reload(); }
      catch(e){ toast('⛔ Sauvegarde illisible : '+e.message,'bad'); }
      f.value=''; };
    rd.readAsText(file);
  });
});

/* ============================================================
   CONSEILLER : propose les meilleures actions du moment
   ============================================================ */
let _adv={k:'',v:[]};
function advisorSuggestions(){
  const key=Math.floor(S.time/DAY)+'|'+S.routes.length+'|'+S.fleet.length+'|'+S.hubs.join(); if(_adv.k===key) return _adv.v;
  const out=[], fleet=S.fleet; if(!S.hubs.length) return out;
  const pool=typeof airportRanking==='function'? airportRanking().slice(0,220) : AIRPORT_CODES;
  const have=new Set(S.routes.map(r=>r.stops.join('>')));
  const maxRange=fleet.length? Math.max(...fleet.map(a=>modelOf(a).range)) : 1500;
  for(const h of S.hubs.slice(0,3)){
    const usable=fleet.filter(a=>a.hub===h);
    const cands=[];
    for(const c of pool){
      if(c===h||AP(c).cls<2||have.has(h+'>'+c)) continue;
      const d=dist(h,c); if(d<180||d>Math.min(maxRange*0.92,9000)) continue;
      const comp=usable.filter(a=>!checkLegs(a,legsFor([h,c])));
      if(fleet.length&&!comp.length) continue;
      const dem=marketDemand(h,c), riv=carriersOn(h,c).length, war=0;
      cands.push({h,c,d,dem,riv,comp:comp.length,score:dem/(1+riv*1.3)});
    }
    cands.sort((a,b)=>b.score-a.score);
    for(const x of cands.slice(0,3)) out.push({kind:'line',...x,w:x.score});
  }
  // lignes pleines : ajouter un avion ; lignes déficitaires : alléger
  for(const r of S.routes){
    if(!routeAircraft(r).length||r.stats.flights<6) continue;
    const lf=r.stats.seats? r.stats.pax/r.stats.seats : 0;
    if(lf>0.9&&(r.stats.rev-r.stats.cost)>0) out.push({kind:'add',r,lf,w:lf*(r.stats.rev-r.stats.cost)/50});
    else if((r.stats.rev-r.stats.cost)<0&&lf<0.5) out.push({kind:'cut',r,lf,w:Math.abs(r.stats.rev-r.stats.cost)/80});
  }
  out.sort((a,b)=>b.w-a.w);
  _adv={k:key,v:out.slice(0,4)};
  return _adv.v;
}
function advisorHtml(){
  const L=advisorSuggestions(); if(!L.length) return '';
  return `<div class="card advisor"><b>🧠 Conseiller</b> <span class="small mut">— les meilleures actions du moment</span>${L.map(x=>{
    if(x.kind==='line') return `<div class="diag-item"><div class="grow">➕ Ouvrez <b>${esc(AP(x.h).city)} → ${esc(AP(x.c).city)}</b> · ${num(x.d)} km · ≈ ${num(x.dem)} voyageurs/jour · ${x.riv?x.riv+' concurrent(s)':'<b>aucun concurrent</b>'}${x.comp?` · ${x.comp} avion(s) compatible(s)`:''}</div><button class="btn sm gold" data-act="advLine" data-a="${x.h}" data-b="${x.c}">Ouvrir · ${fmtMoney(lineCost([x.h,x.c]))}</button></div>`;
    if(x.kind==='add') return `<div class="diag-item"><div class="grow">📈 <b>${x.r.stops.join('⇄')}</b> est pleine (${Math.round(x.lf*100)} %) et rentable : un avion de plus y gagnerait de l’argent.</div><button class="btn sm" data-tab="shop">Acheter un avion</button></div>`;
    return `<div class="diag-item"><div class="grow">✂️ <b>${x.r.stops.join('⇄')}</b> perd de l’argent (remplissage ${Math.round(x.lf*100)} %) : réduisez les rotations ou fermez-la.</div><button class="btn sm" data-act="line" data-id="${x.r.id}">Voir la ligne</button></div>`; }).join('')}</div>`;
}
if(typeof ACTIONS!=='undefined') Object.assign(ACTIONS,{
  advLine:d=>{ const r=openLine([d.a,d.b]); if(typeof r==='string') return toast('⛔ '+r,'bad'); r.audit=true; const n=autoPlanAll(); drawRoutes(); toast(n?`🧭 Ligne ${d.a}⇄${d.b} ouverte : ${n} avion(s) programmé(s)`:`🧭 Ligne ${d.a}⇄${d.b} ouverte. Achetez un avion pour la desservir.`,'ok'); renderPanel(); },
});
