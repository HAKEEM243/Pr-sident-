/* ============================================================
   INTERFACE — panneaux, modales, boucle principale
   ============================================================ */
const UI = { tab:'dash', draft:null, catFam:'all', mobile:false };
const $ = s=>document.querySelector(s);
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = v=>Math.round(v*100)+' %';
const num = v=>Math.round(v).toLocaleString('fr-FR');
const stars = r=>{ const s=r/20; let h=''; for(let i=1;i<=5;i++) h+= s>=i?'★': s>=i-0.5?'⯪':'☆'; return `<span class="stars" title="${Math.round(r)}/100">${h}</span>`; };
const apName = c=>`${AP(c).city} (${c})`;
const flag = c=>COUNTRIES[AP(c).cc][2];

const TABS = [
  ['map','🗺️','Carte'],['dash','📊','Tableau'],['fleet','✈️','Flotte'],['routes','🧭','Routes'],['crew','🎓','Équipage'],
  ['finance','💰','Finances'],['company','🏢','Compagnie'],['drc','🇨🇩','RDC'],['admin','🛠️','Admin'],
];

/* ---------- notifications ---------- */
function toast(text, kind='info'){
  const box=$('#toasts'); if(!box) return;
  const el=document.createElement('div'); el.className='toast '+kind; el.innerHTML=text;
  box.appendChild(el); setTimeout(()=>el.classList.add('out'),5200); setTimeout(()=>el.remove(),5800);
  while(box.children.length>4) box.firstChild.remove();
}
const _notified={};
function notify(title, body){
  const key=title; const now=Date.now();
  if(_notified[key] && now-_notified[key]<60000) return; _notified[key]=now;
  if(S && S.notifications && 'Notification' in window && Notification.permission==='granted' && document.hidden){
    try{ new Notification(title,{body, tag:key}); }catch(e){}
  }
}
function onLog(text, kind){ if(['bad','drc','warn','rival'].includes(kind) && !UI.silent) toast(text,kind); }

/* ---------- modales ---------- */
function showModal(title, html, wide){
  const m=$('#modal');
  m.innerHTML=`<div class="mbox ${wide?'wide':''}"><div class="mhead"><h2>${title}</h2><button class="x" data-act="closeModal">×</button></div><div class="mbody">${html}</div></div>`;
  m.hidden=false;
}
function closeModal(){ $('#modal').hidden=true; $('#modal').innerHTML=''; UI.modal=null; }

/* ---------- barre supérieure ---------- */
function renderTop(){
  const c=S.company;
  $('#tb-name').innerHTML=`<span class="logo" style="background:${c.color}">${esc(c.logo)}</span><span class="nm">${esc(c.name)}</span>`;
  $('#tb-cash').innerHTML=`<span class="${S.cash<0?'neg':''}">${fmtMoney(S.cash)}</span>`;
  $('#tb-time').innerHTML=`${fmtDate(S.time)} <b>${fmtTime(S.time)}</b> <span class="mut">UTC</span>`;
  $('#tb-oil').innerHTML=`🛢️ $${S.oil.toFixed(0)}`;
  document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('on', b.dataset.speed===S.speed && !S.paused));
  $('#tb-pause').textContent=S.paused?'▶':'⏸';
  $('#tb-pause').classList.toggle('on',S.paused);
}

/* ---------- onglets ---------- */
function setTab(t){
  UI.tab=t;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  document.body.classList.toggle('show-map', t==='map');
  if(t==='map'){ $('#panel').classList.add('hide'); setTimeout(()=>map.invalidateSize(),50); return; }
  $('#panel').classList.remove('hide');
  renderPanel();
}
function renderPanel(){
  const body=$('#panelBody'); if(!body) return;
  const fn={dash:pDash, fleet:pFleet, routes:pRoutes, crew:pCrew, finance:pFinance, company:pCompany, drc:pDRC, admin:pAdmin}[UI.tab];
  if(!fn) return;
  body.innerHTML=fn();
  if(UI.tab==='finance') drawChart();
}
function liveRefresh(){
  if(UI.tab==='map'||$('#panel').classList.contains('hide')) return;
  const a=document.activeElement;
  if(a && $('#panel').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  if(UI.tab==='admin'||UI.tab==='company') return;
  renderPanel();
}

/* ---------- indicateurs globaux ---------- */
function marketStats(){
  let player=0, total=0, drcP=0, drcT=0;
  for(const r of S.routes){
    if(!r.aircraft.length) continue;
    for(let i=0;i<r.stops.length-1;i++) for(const [a,b] of [[r.stops[i],r.stops[i+1]],[r.stops[i+1],r.stops[i]]]){
      const mk=legMarket(r,a,b); player+=mk.daily; total+=mk.market+0.0001;
      if(isDrc(a)&&isDrc(b)){ drcP+=mk.daily; }
    }
  }
  // marché domestique RDC total estimé (paires de grands aéroports)
  const big=AIRPORT_CODES.filter(c=>isDrc(c)&&AP(c).traffic>=0.02);
  for(let i=0;i<big.length;i++) for(let j=i+1;j<big.length;j++) drcT+=2*marketDemand(big[i],big[j]);
  return { share: total? player/total:0, playerDaily:player, drcShare: drcT? Math.min(1,drcP/drcT):0, drcDaily:drcP, drcMarket:drcT };
}
function loadFactor(){ let p=0,s=0; for(const r of S.routes){ p+=r.stats.pax; s+=r.stats.seats; } return s? p/s : 0; }
function competitors(){
  const list=[
    {name:S.company.name, value:fleetValue()+Math.max(0,S.cash), fleet:S.fleet.length, me:true},
    {name:S.rival.name, value:S.rival.fleet*45e6+Math.max(0,S.rival.cash), fleet:S.rival.fleet},
    {name:'Air Équateur', value:3*20e6, fleet:3}, {name:'Kivu Express', value:6*25e6, fleet:6},
    {name:'Sahel Connect', value:14*40e6, fleet:14}, {name:'Atlantica Global', value:120*90e6, fleet:120},
  ].sort((a,b)=>b.value-a.value);
  return list;
}
function alerts(){
  const out=[];
  if(S.cash<0) out.push(['bad','Trésorerie négative : empruntez ou vendez un avion.']);
  for(const ac of S.fleet){
    if(maintOverdue(ac)) out.push(['bad',`${ac.reg} : maintenance en retard (risque d’incident).`]);
    else if(maintDue(ac).length && !S.autoMaint) out.push(['warn',`${ac.reg} : ${maintDue(ac).map(k=>'check '+k).join(', ')} bientôt dû.`]);
    if(ac.status==='idle' && !ac.routeId && !ac.flight) out.push(['info',`${ac.reg} (${modelOf(ac).name}) est inactif à ${ac.loc}.`]);
    if(ac.blocked && ac.routeId) out.push(['warn',`${ac.reg} bloqué : ${ac.blocked}`]);
  }
  for(const r of S.routes) if(routeLosing(r)) out.push(['warn',`Route ${r.stops.join('-')} déficitaire sur les derniers vols.`]);
  if(!S.routes.length) out.push(['info','Créez votre première route dans l’onglet 🧭 Routes, ou cliquez sur un aéroport de la carte.']);
  return out.slice(0,10);
}
const routeLosing = r=>r.stats.recent.length>=4 && r.stats.recent.reduce((s,v)=>s+v,0)<0;

/* ---------- 📊 TABLEAU DE BORD ---------- */
function pDash(){
  const ms=marketStats(), comp=competitors(), rank=comp.findIndex(x=>x.me)+1;
  const flying=S.fleet.filter(a=>a.status==='flight').length;
  const kpis=[
    ['Capital',fmtMoney(S.cash),S.cash<0?'neg':''],
    ['Valeur nette',fmtMoney(netWorth()),''],
    ['Valeur de la flotte',fmtMoney(fleetValue()),''],
    ['Part de marché',(ms.share*100).toFixed(1)+' %',''],
    ['Remplissage moyen',pct(loadFactor()),''],
    ['Flotte en vol',`${flying} / ${S.fleet.length}`,''],
    ['PAX transportés',num(S.stats.pax),''],
    ['Pétrole · Kérosène',`$${S.oil.toFixed(1)} · $${fuelPrice().toFixed(2)}/L`,''],
  ];
  const top=[...S.routes].sort((a,b)=>(b.stats.rev-b.stats.cost)-(a.stats.rev-a.stats.cost)).slice(0,5);
  const R=S.rival;
  return `
  <div class="card profile">
    <div class="biglogo" style="background:${S.company.color}">${esc(S.company.logo)}</div>
    <div><h2>${esc(S.company.name)} <span class="mut">${esc(S.company.code)}</span></h2>
      <div>${stars(S.reputation)} <span class="mut">réputation ${Math.round(S.reputation)}/100</span></div>
      <div class="mut">Hub : ${flag(S.company.hub)} ${apName(S.company.hub)} · Position concurrentielle : <b>${rank}<sup>e</sup></b> / ${comp.length}</div>
      ${S.alliance?`<div class="chip gold">${ALLIANCES.find(a=>a.id===S.alliance).name}</div>`:''}
    </div>
  </div>
  <div class="kpis">${kpis.map(([l,v,c])=>`<div class="kpi"><div class="kl">${l}</div><div class="kv ${c}">${v}</div></div>`).join('')}</div>
  ${S.events.length?`<h3>Événements en cours</h3><div class="evs">${S.events.map(e=>{const t=EV(e);return `<div class="ev ${t.drc?'drc':''}">${t.icon} <b>${t.name}</b>${e.airport?' ('+AP(e.airport).city+')':''} <span class="mut">— jusqu’au ${fmtDate(e.until)}</span><br><small>${t.desc}</small></div>`;}).join('')}</div>`:''}
  <h3>Alertes</h3>
  <div class="alerts">${alerts().map(([k,t])=>`<div class="al ${k}">${t}</div>`).join('')||'<div class="mut">Tout va bien, commandant.</div>'}</div>
  <h3>Top routes</h3>
  ${top.length?`<table class="tbl"><tr><th>Route</th><th>Vols</th><th>Rempl.</th><th>Résultat</th></tr>${top.map(r=>`<tr><td>${r.stops.join('–')}</td><td>${r.stats.flights}</td><td>${r.stats.seats?pct(r.stats.pax/r.stats.seats):'—'}</td><td class="${r.stats.rev-r.stats.cost<0?'neg':'pos'}">${fmtMoney(r.stats.rev-r.stats.cost)}</td></tr>`).join('')}</table>`:'<div class="mut">Aucune route pour l’instant.</div>'}
  <h3>Vous vs ${R.name}</h3>
  <table class="tbl cmp">
    <tr><th></th><th>${esc(S.company.code)}</th><th>${R.code}</th></tr>
    <tr><td>Flotte</td><td>${S.fleet.length}</td><td>${R.fleet}</td></tr>
    <tr><td>Routes</td><td>${S.routes.length}</td><td>${R.routes.length}</td></tr>
    <tr><td>Réputation</td><td>${stars(S.reputation)}</td><td>${stars(R.rep)}</td></tr>
    <tr><td>PAX / jour</td><td>${num(ms.playerDaily)}</td><td>${num(R.paxDay)}</td></tr>
    <tr><td>Trésorerie</td><td>${fmtMoney(S.cash)}</td><td>${fmtMoney(R.cash)}</td></tr>
    <tr><td>Hub</td><td>${S.company.hub}</td><td>${R.hub}</td></tr>
  </table>
  <h3>Classement</h3>
  <table class="tbl">${comp.map((c,i)=>`<tr class="${c.me?'me':''}"><td>${i+1}</td><td>${esc(c.name)}</td><td>${c.fleet} av.</td><td>${fmtMoney(c.value)}</td></tr>`).join('')}</table>
  <h3>Journal</h3>
  <div class="log">${S.log.slice(0,18).map(l=>`<div class="lg ${l.kind}"><span class="mut">${fmtDate(l.t)} ${fmtTime(l.t)}</span> ${l.text}</div>`).join('')}</div>`;
}

/* ---------- ✈️ FLOTTE ---------- */
function acStatus(ac){
  if(ac.status==='flight'){ const st=flightState(ac); return `<span class="badge fly">✈ ${PHASES[st.phase]} · ${st.origin}→${st.dest} · ${Math.round(st.progress*100)} %</span>`; }
  if(ac.status==='maint') return `<span class="badge maint">🔧 ${MAINT[ac.maintType].label} · fin ${fmtDate(ac.maintUntil)} ${fmtTime(ac.maintUntil)}</span>`;
  if((ac.readyAt||0)>S.time) return `<span class="badge">⏳ Rotation au sol à ${ac.loc} · prêt ${fmtTime(ac.readyAt)}</span>`;
  return `<span class="badge idle">● Au sol à ${ac.loc}</span>`;
}
function pFleet(){
  return `
  <div class="btns"><button class="btn gold" data-act="catalog">🛒 Acheter / Louer</button><button class="btn" data-act="editor">🛠️ Éditeur d’avion</button></div>
  <label class="tog"><input type="checkbox" data-in="autoMaint" ${S.autoMaint?'checked':''}> Maintenance automatique à l’échéance (A 600 h · C 3 000 h · D 12 000 h)</label>
  ${S.fleet.map(ac=>{
    const m=modelOf(ac), r=S.routes.find(x=>x.id===ac.routeId);
    const bar=(k)=>{ const v=ac['since'+k], e=MAINT[k].every; return `<div class="mt ${v>e?'over':v>e*0.9?'due':''}"><span>${k}</span><div class="pbar"><i style="width:${Math.min(100,v/e*100)}%"></i></div><span>${Math.round(v)}/${e} h</span></div>`; };
    return `<div class="card ac">
      <div class="acrow"><div class="acic" style="color:${m.color||S.company.color}">${PLANE_SVG(m.color||S.company.color,28)}</div>
        <div class="grow"><b>${ac.reg}</b> ${ac.name?'« '+esc(ac.name)+' »':''} <span class="mut">${m.name}${m.custom?' (perso)':''}</span><br>
        ${acStatus(ac)} ${ac.owned?'<span class="chip">Propriété</span>':`<span class="chip">Leasing ${fmtMoney(ac.lease)}/mois</span>`}</div></div>
      <div class="grid2 small">
        <div>Route : ${r?`<b>${r.stops.join('–')}</b>`:'<span class="mut">aucune</span>'}</div>
        <div>Heures : ${num(ac.hours)} h · cycles ${num(ac.cycles)}</div>
        <div>Âge : ${acAgeYears(ac).toFixed(1)} ans · valeur ${fmtMoney(acValue(ac))}</div>
        <div>${isCargo(m)?`Fret ${m.cargo} t`:`${m.seats} sièges`} · ${m.range} km · piste cl. ${m.cls}</div>
      </div>
      <div class="cond">Condition technique <div class="pbar ${ac.condition<40?'bad':ac.condition<70?'warn':''}"><i style="width:${ac.condition}%"></i></div> <b>${Math.round(ac.condition)} %</b></div>
      <div class="mts">${bar('A')}${bar('C')}${bar('D')}</div>
      ${ac.blocked&&ac.routeId?`<div class="al warn">${ac.blocked}</div>`:''}
      <div class="btns sm">
        ${['A','C','D'].map(k=>`<button class="btn sm" data-act="maint" data-id="${ac.id}" data-k="${k}" ${ac.status!=='idle'?'disabled':''} title="${fmtMoney(MAINT[k].cost(m))} · ${MAINT[k].days} j">Check ${k} · ${fmtMoney(MAINT[k].cost(m))}</button>`).join('')}
        ${ac.status==='flight'?`<button class="btn sm" data-act="follow" data-id="${ac.id}">🎯 Suivre</button>`:''}
        <button class="btn sm" data-act="ferry" data-id="${ac.id}" ${ac.status!=='idle'?'disabled':''}>↗ Convoyer</button>
        <button class="btn sm" data-act="rename" data-id="${ac.id}">✏️</button>
        <button class="btn sm danger" data-act="sell" data-id="${ac.id}" ${ac.status==='flight'?'disabled':''}>${ac.owned?`Vendre ${fmtMoney(acValue(ac))}`:'Rendre (1 mois)'}</button>
      </div>
    </div>`;}).join('')||'<div class="mut">Aucun avion.</div>'}`;
}
function catalogHtml(){
  const all=[...MODELS,...S.customModels];
  const fams=['all',...Object.keys(FAMILIES)];
  const list=all.filter(m=>UI.catFam==='all'||m.fam===UI.catFam);
  return `<div class="chips">${fams.map(f=>`<button class="chip ${UI.catFam===f?'on':''}" data-act="catFam" data-f="${f}">${f==='all'?'Tous':f}</button>`).join('')}</div>
  <div class="mut small">Capital : <b>${fmtMoney(S.cash)}</b>. Leasing : dépôt de 2 mois. Occasion : −45 %, 12 ans, 30 000 h, condition 78 %.</div>
  <div class="catalog">${list.map(m=>{
    const q=qualifiedPilots(m.fam);
    return `<div class="card cat">
      <div><b>${m.name}</b> <span class="mut">${m.maker} · ${m.fam}</span></div>
      <div class="specs">${isCargo(m)?`<span>📦 ${m.cargo} t</span>`:`<span>💺 ${m.seats}</span>`}<span>📏 ${num(m.range)} km</span><span>⚡ ${m.speed} km/h</span><span>⛽ ${num(m.burn)} L/h</span><span>🛬 piste cl.${m.cls}</span></div>
      <div class="small ${q<2?'warnt':'mut'}">${q} pilote(s) qualifié(s) ${m.fam}${q<2?' — formez ou recrutez avant de voler':''}</div>
      <div class="btns sm">
        <button class="btn sm gold" data-act="buy" data-m="${m.id}" data-mode="new">Neuf ${fmtMoney(m.price*1e6)}</button>
        ${m.custom?'':`<button class="btn sm" data-act="buy" data-m="${m.id}" data-mode="used">Occasion ${fmtMoney(m.price*1e6*0.55)}</button>`}
        <button class="btn sm" data-act="buy" data-m="${m.id}" data-mode="lease">Louer ${fmtMoney(m.price*1e6*0.0085)}/mois</button>
      </div></div>`;}).join('')}</div>`;
}
function editorHtml(){
  const d=UI.edit||(UI.edit={name:'Mon avion',fam:'A320',seats:160,cargo:0,range:5000,speed:830,color:'#22c55e',logo:'🦅'});
  const est=customSpecs(d);
  return `<div class="form">
    <label>Nom<input data-in="ed.name" value="${esc(d.name)}"></label>
    <label>Famille (qualification)<select data-in="ed.fam">${Object.keys(FAMILIES).map(f=>`<option ${f===d.fam?'selected':''}>${f}</option>`).join('')}</select></label>
    <label>Sièges (0 = cargo)<input type="number" min="0" max="900" data-in="ed.seats" value="${d.seats}"></label>
    <label>Fret (t, si cargo)<input type="number" min="0" max="250" data-in="ed.cargo" value="${d.cargo}"></label>
    <label>Autonomie (km)<input type="number" min="500" max="20000" data-in="ed.range" value="${d.range}"></label>
    <label>Vitesse croisière (km/h)<input type="number" min="250" max="2500" data-in="ed.speed" value="${d.speed}"></label>
    <label>Couleur<input type="color" data-in="ed.color" value="${d.color}"></label>
    <label>Logo (emoji ou 3 lettres)<input maxlength="3" data-in="ed.logo" value="${esc(d.logo)}"></label>
  </div>
  <div id="edEst" class="card">${editorEst(est,d)}</div>
  <div class="btns"><button class="btn gold" data-act="saveCustom">Enregistrer le modèle</button></div>
  ${S.customModels.length?`<h3>Vos modèles</h3>${S.customModels.map(m=>`<div class="row"><span style="color:${m.color}">■</span> ${m.logo} <b>${esc(m.name)}</b> <span class="mut">${m.seats||m.cargo+' t'} · ${m.range} km · ${fmtMoney(m.price*1e6)}</span> <button class="btn sm danger" data-act="delCustom" data-m="${m.id}">Supprimer</button></div>`).join('')}`:''}`;
}
function customSpecs(d){
  const units=Math.max(+d.seats||0,(+d.cargo||0)*3,10);
  const burn=Math.round(units*22*Math.pow((+d.speed||800)/830,2)+300);
  const price=+(units*0.85*Math.pow((+d.speed||800)/830,1.3)*(1+(+d.range||3000)/20000)).toFixed(1);
  const cls=units<30?1:units<90?2:units<250?3:units<450?4:5;
  return {burn,price,cls,alt:(+d.speed>1500?18000:+d.speed<700?7600:11500)};
}
const editorEst=(e,d)=>`Prix estimé : <b>${fmtMoney(e.price*1e6)}</b> · Consommation : <b>${num(e.burn)} L/h</b> · Piste : classe ${e.cls} · Altitude ${num(e.alt*3.28)} ft <span style="color:${d.color}">■</span> ${esc(d.logo)}`;

/* ---------- 🧭 ROUTES ---------- */
function pRoutes(){
  return `<div class="btns"><button class="btn gold" data-act="newRoute">➕ Nouvelle route</button></div>
  ${S.routes.map(r=>routeCard(r)).join('')||'<div class="mut">Aucune route. Créez-en une, ou cliquez sur un aéroport de la carte.</div>'}`;
}
function routeCard(r){
  const legs=legsFor(r.stops), tot=legs.reduce((s,l)=>s+l.dist,0), freq=routeFreq(r);
  const share=r.stats.shareN? r.stats.shareSum/r.stats.shareN : (r.aircraft.length? legMarket(r,r.stops[0],r.stops[1]).share : 0);
  const res=r.stats.rev-r.stats.cost, losing=routeLosing(r);
  const avail=S.fleet.filter(a=>!a.routeId && a.status!=='maint');
  const firstAc=S.fleet.find(a=>r.aircraft.includes(a.id));
  return `<div class="card route ${losing?'losing':''}">
    <div class="rhead"><b>${r.stops.map(c=>`${flag(c)} ${c}`).join(' <span class="arr">→</span> ')}</b>
      ${losing?'<span class="badge bad">⚠ Déficitaire</span>':''}</div>
    <div class="mut small">${r.stops.map(c=>AP(c).city).join(' – ')} · ${num(tot)} km${r.stops.length>2?` · ${r.stops.length-2} escale(s)`:''}</div>
    <div class="grid2 small">
      <div>Part de marché : <b>${pct(share)}</b></div><div>Fréquence : <b>${freq.toFixed(1)}</b> vol/j/sens</div>
      <div>Vols : ${r.stats.flights} · PAX ${num(r.stats.pax)}</div><div>Remplissage : <b>${r.stats.seats?pct(r.stats.pax/r.stats.seats):'—'}</b></div>
      <div>Revenus : ${fmtMoney(r.stats.rev)}</div><div>Résultat : <b class="${res<0?'neg':'pos'}">${fmtMoney(res)}</b></div>
    </div>
    <div class="legs">${legs.map(l=>{ const mk=legMarket(r,l.from,l.to); const m=firstAc?modelOf(firstAc):null; const seats=m?routeSeats(r,m).total:0; const adv=m?sizingAdvice(mk.perFlight,seats):null;
      return `<div class="leg"><span>${l.from}→${l.to}</span><span>${num(l.dist)} km</span><span>demande ${num(mk.market)}/j</span><span>${num(mk.perFlight)} pax/vol</span>${adv?`<span class="badge ${adv.cls}" title="${adv.text}">${adv.cls==='ok'?'●':'▲'} ${adv.text}</span>`:''}${mk.rivalFreq?`<span class="badge rival">StarWing ×${mk.rivalFreq}</span>`:''}</div>`;}).join('')}</div>
    <div class="ctrl">
      <label>Prix ${pct(r.price)} <input type="range" min="0.6" max="1.8" step="0.05" value="${r.price}" data-in="price" data-id="${r.id}"></label>
      <span class="mut small">Billet éco ${r.stops[0]}→${r.stops[1]} : ${fmtMoney(baseFare(r.stops[0],r.stops[1])*r.price)}</span>
      <label class="tog"><input type="checkbox" data-in="auto" data-id="${r.id}" ${r.auto?'checked':''}> Rotation automatique (aller-retour)</label>
      <button class="btn sm" data-act="cabin" data-id="${r.id}">💺 Cabine F${r.cabin.f}% J${r.cabin.j}% W${r.cabin.w}%</button>
    </div>
    <div class="acs">${r.aircraft.map(id=>{ const ac=S.fleet.find(a=>a.id===id); if(!ac) return ''; const m=modelOf(ac);
      const atFirst=ac.loc===r.stops[0], atLast=ac.loc===r.stops[r.stops.length-1], idle=ac.status==='idle';
      return `<div class="acl"><div><b>${ac.reg}</b> <span class="mut">${m.name}</span><br>${acStatus(ac)}</div><div class="btns sm">
        <button class="btn sm gold" data-act="dep" data-id="${ac.id}" data-dir="1" ${!idle||!atFirst?'disabled':''}>Départ ▶</button>
        <button class="btn sm gold" data-act="dep" data-id="${ac.id}" data-dir="-1" ${!idle||!atLast?'disabled':''}>◀ Retour</button>
        ${idle&&!atFirst&&!atLast?`<button class="btn sm" data-act="repos" data-id="${ac.id}">↗ Repositionner</button>`:''}
        <button class="btn sm" data-act="hold" data-id="${ac.id}">${ac.hold?'▶ Reprendre':'⏸ Suspendre'}</button>
        <button class="btn sm danger" data-act="unassign" data-id="${ac.id}">Retirer</button></div></div>`;}).join('')}</div>
    <div class="btns sm">
      ${avail.length?`<select data-in="assign" data-id="${r.id}"><option value="">+ Affecter un avion…</option>${avail.map(a=>{ const e=checkLegs(a,legs); return `<option value="${a.id}" ${e?'disabled':''}>${a.reg} — ${modelOf(a).name} @${a.loc}${e?' ✖':''}</option>`;}).join('')}</select>`:''}
      <button class="btn sm danger" data-act="delRoute" data-id="${r.id}">Supprimer la route</button>
    </div></div>`;
}
function routeBuilderHtml(){
  const d=UI.draft;
  return `<datalist id="aplist">${AIRPORT_CODES.map(c=>`<option value="${c} — ${esc(AP(c).city)}${AP(c).drc?' 🇨🇩 '+esc(AP(c).prov):' '+COUNTRIES[AP(c).cc][2]}">`).join('')}</datalist>
  <div class="stops">${d.stops.map((c,i)=>`<div class="stop"><span class="sn">${i===0?'Départ':i===d.stops.length-1?'Arrivée':'Escale '+i}</span>
    <input list="aplist" data-in="stop" data-i="${i}" value="${c?c+' — '+esc(AP(c).city):''}" placeholder="Code ou ville…">
    ${d.stops.length>2?`<button class="btn sm" data-act="rmStop" data-i="${i}">✕</button>`:''}</div>`).join('')}
  <button class="btn sm" data-act="addStop">+ Ajouter une escale</button></div>
  <div class="mut small">Astuce : cliquez sur un aéroport de la carte puis « Ajouter au brouillon ».</div>
  <h3>Avions à affecter</h3>
  <div class="acpick">${S.fleet.filter(a=>!a.routeId).map(a=>`<label class="tog"><input type="checkbox" data-in="dAc" value="${a.id}" ${d.aircraft.includes(a.id)?'checked':''}> ${a.reg} — ${modelOf(a).name} <span class="mut">@${a.loc}</span></label>`).join('')||'<div class="mut">Aucun avion libre.</div>'}</div>
  <div class="grid2"><label>Prix ${pct(d.price)}<input type="range" min="0.6" max="1.8" step="0.05" value="${d.price}" data-in="dPrice"></label>
  <label class="tog"><input type="checkbox" data-in="dAuto" ${d.auto?'checked':''}> Rotation automatique</label></div>
  <div id="rbA">${routeAnalysis()}</div>
  <div class="btns"><button class="btn gold" data-act="createRoute">Créer la route</button></div>`;
}
function routeAnalysis(){
  const d=UI.draft, stops=d.stops.filter(Boolean);
  if(stops.length<2) return '<div class="mut">Choisissez au moins deux aéroports.</div>';
  const fake={id:'draft', stops, aircraft:d.aircraft, price:d.price, cabin:{f:0,j:0,w:0}, auto:d.auto, stats:{}};
  const legs=legsFor(stops);
  const acs=d.aircraft.map(id=>S.fleet.find(a=>a.id===id)).filter(Boolean);
  const freq= acs.length? routeFreq(fake) : 1;
  let html='<table class="tbl"><tr><th>Tronçon</th><th>Distance</th><th>Demande/j</th><th>PAX/vol</th><th>Billet éco</th></tr>';
  for(const l of legs){ const mk=legMarket(fake,l.from,l.to,freq); html+=`<tr><td>${l.from}→${l.to}</td><td>${num(l.dist)} km</td><td>${num(mk.market)}</td><td>${num(mk.perFlight)}</td><td>${fmtMoney(baseFare(l.from,l.to)*d.price)}</td></tr>`; }
  html+='</table>';
  for(const ac of acs){
    const m=modelOf(ac), err=checkLegs(ac,legs);
    const mk=legMarket(fake,legs[0].from,legs[0].to,freq), adv=sizingAdvice(mk.perFlight,m.seats);
    html+=`<div class="al ${err?'bad':adv.cls==='ok'?'ok':adv.cls==='warn'?'warn':'bad'}">${ac.reg} ${m.name} : ${err?err:`${adv.text} (${num(mk.perFlight)} pax pour ${m.seats||m.cargo+' t'})`}${ac.loc!==stops[0]&&ac.loc!==stops[stops.length-1]&&!err?' · sera convoyé depuis '+ac.loc:''}</div>`;
  }
  if(!acs.length) html+='<div class="mut small">Sélectionnez un avion pour voir le conseil de dimensionnement.</div>';
  return html;
}
function cabinHtml(r){
  const ac=S.fleet.find(a=>r.aircraft.includes(a.id)), m=ac?modelOf(ac):MODELS[4];
  const s=routeSeats(r,m);
  return `<div class="mut small">Part de la surface cabine par classe (une place Première = 3 places éco, Affaires = 2,2, Premium = 1,3).</div>
  ${[['f','Première',30],['j','Affaires',50],['w','Premium éco',40]].map(([k,l,max])=>`<label>${l} : ${r.cabin[k]} %<input type="range" min="0" max="${max}" step="5" value="${r.cabin[k]}" data-in="cab" data-k="${k}" data-id="${r.id}"></label>`).join('')}
  <div class="card">Sur ${m.name} : <b>${s.f}</b> F · <b>${s.j}</b> J · <b>${s.w}</b> W · <b>${s.y}</b> Y = <b>${s.total}</b> sièges</div>
  <div class="mut small">Tarifs : Première ×6, Affaires ×3,5, Premium ×1,7 le billet éco. La demande premium est limitée (≈3 % F, 9 % J, 12 % W).</div>`;
}

/* ---------- 🎓 ÉQUIPAGE ---------- */
function pCrew(){
  const fams=Object.keys(FAMILIES);
  const needCabin=S.fleet.reduce((s,a)=>s+cabinNeed(modelOf(a)),0);
  return `<h3>Panel Qualifications</h3>
  <table class="tbl"><tr><th>Famille</th><th>Qualifiés</th><th>Requis</th><th>En formation</th></tr>
  ${fams.map(f=>{ const q=qualifiedPilots(f), need=2*S.fleet.filter(a=>modelOf(a).fam===f).length, tr=S.pilots.filter(p=>p.training&&p.training.fam===f).length;
    if(!q&&!need&&!tr) return ''; return `<tr><td>${f}</td><td>${q}</td><td class="${q<need?'neg':''}">${need}</td><td>${tr?tr+' ⏳':'—'}</td></tr>`;}).join('')}
  </table>
  <h3>Pilotes (${S.pilots.length})</h3>
  ${S.pilots.map(p=>`<div class="card pilot"><div class="grow"><b>${esc(p.name)}</b> ${p.nat==='CD'?'🇨🇩':'🌍'} <span class="mut">${num(p.hours)} h de vol · ${fmtMoney(p.salary)}/mois</span><br>
    ${p.quals.map(q=>`<span class="chip">${q}</span>`).join('')}
    ${p.training?`<div class="small">⏳ Formation ${p.training.fam} — fin le ${fmtDate(p.training.until)} <div class="pbar"><i style="width:${clamp((S.time-p.training.start)/(p.training.until-p.training.start)*100,0,100)}%"></i></div></div>`:''}</div>
    <div class="btns sm"><button class="btn sm" data-act="train" data-id="${p.id}" ${p.training?'disabled':''}>🎓 Former</button><button class="btn sm danger" data-act="fire" data-id="${p.id}">Licencier</button></div></div>`).join('')}
  <h3>Candidats (renouvelés chaque semaine)</h3>
  ${S.candidates.map(p=>`<div class="card pilot"><div class="grow"><b>${esc(p.name)}</b> ${p.nat==='CD'?'🇨🇩':'🌍'} <span class="mut">${num(p.hours)} h · ${fmtMoney(p.salary)}/mois</span><br>${p.quals.map(q=>`<span class="chip">${q}</span>`).join('')}</div>
    <button class="btn sm gold" data-act="hire" data-id="${p.id}">Recruter (prime ${fmtMoney(p.salary)})</button></div>`).join('')}
  <h3>Personnel navigant commercial</h3>
  <div class="card">Hôtesses & stewards : <b>${S.cabinCrew}</b> · requis pour toute la flotte en vol : <b class="${S.cabinCrew<needCabin?'neg':''}">${needCabin}</b> (1 pour 50 sièges) · salaire $2 400/mois
  <div class="btns sm"><button class="btn sm gold" data-act="cabinCrew" data-n="5">+5 (prime $1 500/pers.)</button><button class="btn sm" data-act="cabinCrew" data-n="1">+1</button><button class="btn sm danger" data-act="cabinCrew" data-n="-1">−1</button><button class="btn sm danger" data-act="cabinCrew" data-n="-5">−5</button></div></div>`;
}

/* ---------- 💰 FINANCES ---------- */
function pFinance(){
  const cats=Object.keys(LED_CATS);
  const col=(l,k)=>{ const v=l[k]||0; return `<td class="${v<0?'neg':v>0?'pos':'mut'}">${v?fmtMoney(v):'—'}</td>`; };
  const tot=l=>{ const v=ledSum(l,1)+ledSum(l,-1); return `<td class="${v<0?'neg':'pos'}"><b>${fmtMoney(v)}</b></td>`; };
  return `<div class="kpis three">
    <div class="kpi"><div class="kl">Capital</div><div class="kv ${S.cash<0?'neg':''}">${fmtMoney(S.cash)}</div></div>
    <div class="kpi"><div class="kl">Valeur nette</div><div class="kv">${fmtMoney(netWorth())}</div></div>
    <div class="kpi"><div class="kl">Dette</div><div class="kv">${fmtMoney(debt())}</div></div></div>
  <h3>Historique (capital & valeur nette)</h3><canvas id="chart" height="170"></canvas>
  <h3>Compte de résultat (P&L)</h3>
  <table class="tbl pl"><tr><th></th><th>Aujourd’hui</th><th>Ce mois</th><th>Mois préc.</th><th>Total</th></tr>
  ${cats.filter(k=>[S.led.day,S.led.month,S.led.prevMonth,S.led.total].some(l=>l[k])).map(k=>`<tr><td>${LED_CATS[k][0]}</td>${col(S.led.day,k)}${col(S.led.month,k)}${col(S.led.prevMonth,k)}${col(S.led.total,k)}</tr>`).join('')}
  <tr class="sum"><td>Résultat d’exploitation</td>${tot(S.led.day)}${tot(S.led.month)}${tot(S.led.prevMonth)}${tot(S.led.total)}</tr></table>
  <div class="mut small">Hors achats/ventes d’avions (investissements) et remboursement du capital emprunté.</div>
  <h3>Financement</h3>
  ${LOAN_PRODUCTS.map(p=>{ const r=p.rate/12, mo=p.amount*r/(1-Math.pow(1+r,-p.months)); return `<div class="card row"><div class="grow"><b>${p.name}</b> — ${fmtMoney(p.amount)} · ${p.months} mois · ${(p.rate*100).toFixed(1)} %<br><span class="mut small">Mensualité ${fmtMoney(mo)}${p.minNet?` · valeur nette mini ${fmtMoney(p.minNet)}`:''}</span></div><button class="btn sm gold" data-act="loan" data-id="${p.id}">Emprunter</button></div>`;}).join('')}
  ${S.loans.length?`<h3>Prêts en cours</h3>${S.loans.map(l=>`<div class="card row"><div class="grow"><b>${l.name}</b> · reste ${fmtMoney(l.remaining)} · ${l.monthsLeft} mois · ${fmtMoney(l.monthly)}/mois</div><button class="btn sm" data-act="repay" data-id="${l.id}">Rembourser</button></div>`).join('')}`:''}
  <h3>Carburant</h3>
  <div class="card">Baril : <b>$${S.oil.toFixed(2)}</b> · Jet A1 : <b>$${fuelPrice().toFixed(3)}/L</b> (Kinshasa) · intérieur RDC : <b>$${fuelPrice('KND').toFixed(3)}/L</b></div>`;
}
function drawChart(){
  const cv=$('#chart'); if(!cv) return;
  const w=cv.clientWidth||360, h=170, dpr=window.devicePixelRatio||1;
  cv.width=w*dpr; cv.height=h*dpr; const g=cv.getContext('2d'); g.scale(dpr,dpr);
  const H=S.history.slice(-120); if(H.length<2){ g.fillStyle='#8fa0b8'; g.font='12px system-ui'; g.fillText('Données disponibles après quelques jours de jeu',10,90); return; }
  const vals=H.flatMap(p=>[p.cash,p.net]); let lo=Math.min(...vals,0), hi=Math.max(...vals);
  if(hi===lo) hi=lo+1;
  const X=i=>36+i/(H.length-1)*(w-44), Y=v=>h-20-(v-lo)/(hi-lo)*(h-34);
  g.strokeStyle='rgba(255,255,255,.08)'; g.fillStyle='#8fa0b8'; g.font='10px system-ui';
  for(let i=0;i<=3;i++){ const v=lo+(hi-lo)*i/3; g.beginPath(); g.moveTo(36,Y(v)); g.lineTo(w-8,Y(v)); g.stroke(); g.fillText(fmtMoney(v).replace('$',''),0,Y(v)+3); }
  if(lo<0){ g.strokeStyle='rgba(255,90,90,.5)'; g.beginPath(); g.moveTo(36,Y(0)); g.lineTo(w-8,Y(0)); g.stroke(); }
  for(const [k,c] of [['net','#7dd3fc'],['cash','#f5c518']]){ g.strokeStyle=c; g.lineWidth=2; g.beginPath(); H.forEach((p,i)=>i?g.lineTo(X(i),Y(p[k])):g.moveTo(X(i),Y(p[k]))); g.stroke(); }
  g.fillStyle='#f5c518'; g.fillText('■ Capital',40,12); g.fillStyle='#7dd3fc'; g.fillText('■ Valeur nette',100,12);
}

/* ---------- 🏢 COMPAGNIE ---------- */
function pCompany(){
  const c=S.company, a=S.ancillary;
  return `<h3>Identité visuelle</h3>
  <div class="form">
    <label>Nom<input data-in="co.name" value="${esc(c.name)}"></label>
    <label>Code IATA<input data-in="co.code" maxlength="3" value="${esc(c.code)}"></label>
    <label>Livrée (couleur)<input type="color" data-in="co.color" value="${c.color}"></label>
    <label>Logo<input data-in="co.logo" maxlength="3" value="${esc(c.logo)}"></label>
  </div>
  <div class="card row"><div class="biglogo" style="background:${c.color}">${esc(c.logo)}</div><div style="color:${c.color}">${PLANE_SVG(c.color,48)}</div><div><b>${esc(c.name)}</b><br><span class="mut">Hub ${apName(c.hub)}</span></div></div>
  <h3>Niveau de service cabine</h3>
  <div class="chips">${[1,2,3,4,5].map(n=>`<button class="chip ${S.service===n?'on':''}" data-act="service" data-n="${n}">${'★'.repeat(n)}</button>`).join('')}</div>
  <div class="mut small">Coût ${fmtMoney(SERVICE_COST[S.service-1])}/passager/heure · attractivité ×${SERVICE_ATTR[S.service-1]} · influence la réputation. À partir de 4★, les repas sont inclus.</div>
  <h3>Revenus annexes</h3>
  ${[['seat','Choix du siège','$6, 30 % des passagers'],['bags','Bagage en soute','$25, 35 % des passagers'],['wifi','Wi-Fi à bord','$9, vols > 1h30'],['meals','Repas payants','$11, désactivé si service ≥ 4★']].map(([k,l,d])=>`<label class="tog"><input type="checkbox" data-in="anc" data-k="${k}" ${a[k]?'checked':''}> <b>${l}</b> <span class="mut small">${d}</span></label>`).join('')}
  <div class="mut small">Chaque option réduit légèrement l’attractivité (×${ancillaryPenalty().toFixed(3)}).</div>
  <h3>Campagnes marketing</h3>
  ${CAMPAIGNS.map(cp=>{ const on=S.campaigns.find(x=>x.id===cp.id); return `<div class="card row"><div class="grow"><b>${cp.name}</b> — ${fmtMoney(cp.cost)} · ${cp.days} j · demande +${cp.boost*100} % (${cp.scope==='drc'?'RDC':cp.scope==='intl'?'international':'tout le réseau'}) · réputation +${cp.rep}<br><span class="mut small">${cp.desc}</span></div>${on?`<span class="badge ok">Active → ${fmtDate(on.until)}</span>`:`<button class="btn sm gold" data-act="campaign" data-id="${cp.id}">Lancer</button>`}</div>`;}).join('')}
  <h3>Alliances</h3>
  ${ALLIANCES.map(al=>{ const ok=S.reputation>=al.minRep&&S.fleet.length>=al.minFleet; const mine=S.alliance===al.id; return `<div class="card row ${mine?'gold-b':''}"><div class="grow"><b>${al.name}</b> — ${fmtMoney(al.fee)}/mois · demande +${al.boost*100} % (${al.scope==='africa'?'international africain':'international'})<br><span class="mut small">${al.desc} · requis : réputation ${al.minRep}, flotte ${al.minFleet}</span></div>${mine?`<button class="btn sm danger" data-act="leaveAlliance">Quitter</button>`:`<button class="btn sm ${ok?'gold':''}" data-act="joinAlliance" data-id="${al.id}" ${ok&&!S.alliance?'':'disabled'}>Adhérer</button>`}</div>`;}).join('')}
  <h3>Contrats cargo</h3>${cargoHtml()}
  <h3>Paramètres</h3>
  <div class="card">
    <div>Mode temporel :</div><div class="chips">${Object.entries(SPEEDS).map(([k,v])=>`<button class="chip ${S.speed===k?'on':''}" data-speed="${k}">${v.label} (×${v.mult})</button>`).join('')}</div>
    <div class="mut small">Réaliste = temps réel (un Kinshasa–Paris dure ~7 h). Standard : 1 s = 1 min. Rapide : 1 s = 10 min. Le jeu continue de tourner quand vous fermez la page (jusqu’à 30 jours de jeu rattrapés).</div>
    <label class="tog"><input type="checkbox" data-in="notif" ${S.notifications?'checked':''}> Notifications du navigateur (capital négatif, maintenance, événements)</label>
    <div class="btns sm"><button class="btn sm" data-act="export">⬇ Exporter la sauvegarde</button><button class="btn sm" data-act="import">⬆ Importer</button><button class="btn sm danger" data-act="reset">Nouvelle partie</button></div>
  </div>`;
}
function cargoHtml(){
  const cargoAc=S.fleet.filter(a=>isCargo(modelOf(a)));
  return `${S.cargo.active.map(c=>`<div class="card row"><div class="grow">🚚 <b>${c.goods}</b> ${c.tons} t · ${apName(c.from)} → ${apName(c.to)}<br><span class="mut small">Échéance ${fmtDate(c.deadline)} · ${fmtMoney(c.reward)}</span></div><span class="badge fly">En cours</span></div>`).join('')}
  ${S.cargo.offers.map(o=>`<div class="card"><div>📦 <b>${o.goods}</b> — ${o.tons} t · ${flag(o.from)} ${apName(o.from)} → ${flag(o.to)} ${apName(o.to)} (${num(dist(o.from,o.to))} km)</div>
    <div class="mut small">Prime ${fmtMoney(o.reward)} · livraison avant le ${fmtDate(o.deadline)} · offre valable jusqu’au ${fmtDate(o.expires)}${o.rep?' · +réputation':''}</div>
    ${cargoAc.length?`<select data-in="cargoAssign" data-id="${o.id}"><option value="">Affecter un avion cargo…</option>${cargoAc.map(a=>{const m=modelOf(a); const bad=m.cargo<o.tons||a.routeId||a.status!=='idle'; return `<option value="${a.id}" ${bad?'disabled':''}>${a.reg} ${m.name} (${m.cargo} t) @${a.loc}${a.routeId?' — sur une route':''}</option>`;}).join('')}</select>`:'<div class="mut small">Achetez un avion cargo (ATR 72F, 737-800BCF, 777F…) pour accepter des contrats.</div>'}</div>`).join('')||'<div class="mut">Pas d’offre pour le moment.</div>'}
  <div class="mut small">Contrats livrés : ${S.cargo.done} · fret total : ${num(S.stats.cargoT)} t</div>`;
}

/* ---------- 🇨🇩 RDC ---------- */
function pDRC(){
  const ms=marketStats();
  const drc=AIRPORT_CODES.filter(isDrc);
  const domRoutes=S.routes.filter(r=>r.stops.every(isDrc));
  const byProv={}; for(const c of drc){ (byProv[AP(c).prov]=byProv[AP(c).prov]||[]).push(c); }
  const pairs=[]; const big=drc.filter(c=>AP(c).traffic>=0.01);
  for(let i=0;i<big.length;i++) for(let j=i+1;j<big.length;j++){ const a=big[i],b=big[j]; const d=dist(a,b); if(d<150) continue; pairs.push({a,b,d,dem:marketDemand(a,b)}); }
  pairs.sort((x,y)=>y.dem-x.dem);
  const drcEvents=S.events.filter(e=>EV(e).drc);
  const suggest=(p)=>{ const minCls=Math.min(AP(p.a).cls,AP(p.b).cls); const ok=MODELS.filter(m=>!isCargo(m)&&m.cls<=minCls&&m.range>=p.d&&!m.custom).sort((x,y)=>Math.abs(x.seats-p.dem*0.3)-Math.abs(y.seats-p.dem*0.3)); return ok[0]?ok[0].name:'—'; };
  return `<div class="card drc-hero"><div class="flagbar"></div>
    <h2>🇨🇩 République démocratique du Congo</h2>
    <div class="small">2,3 millions de km², plus de 100 millions d’habitants, et un réseau routier quasi inexistant entre les provinces : l’avion est souvent le seul lien entre Kinshasa, le Katanga, le Kasaï et les Kivu. La demande domestique est multipliée par 5 dans le jeu.</div>
    <div class="btns sm"><button class="btn sm gold" data-act="focusDRC">🔍 Centrer la carte sur la RDC</button></div></div>
  <div class="kpis">
    <div class="kpi"><div class="kl">Aéroports RDC</div><div class="kv">${drc.length}</div></div>
    <div class="kpi"><div class="kl">Provinces desservies (carte)</div><div class="kv">${Object.keys(byProv).length}/26</div></div>
    <div class="kpi"><div class="kl">Vos routes domestiques</div><div class="kv">${domRoutes.length}</div></div>
    <div class="kpi"><div class="kl">Part du marché domestique</div><div class="kv">${(ms.drcShare*100).toFixed(1)} %</div></div>
    <div class="kpi"><div class="kl">Marché domestique</div><div class="kv">${num(ms.drcMarket)} pax/j</div></div>
    <div class="kpi"><div class="kl">Kérosène intérieur</div><div class="kv">$${fuelPrice('KND').toFixed(2)}/L</div></div>
  </div>
  ${drcEvents.length?`<h3>Actualité congolaise</h3>${drcEvents.map(e=>{const t=EV(e);return `<div class="ev drc">${t.icon} <b>${t.name}</b> — ${t.desc} <span class="mut">(jusqu’au ${fmtDate(e.until)})</span></div>`;}).join('')}`:''}
  <h3>Lignes domestiques les plus demandées</h3>
  <table class="tbl"><tr><th>Ligne</th><th>km</th><th>Demande/j</th><th>Avion conseillé</th><th></th></tr>
  ${pairs.slice(0,14).map(p=>`<tr><td>${AP(p.a).city} – ${AP(p.b).city}</td><td>${num(p.d)}</td><td>${num(p.dem)}</td><td class="small">${suggest(p)}</td><td><button class="btn sm" data-act="draftPair" data-a="${p.a}" data-b="${p.b}">Créer</button></td></tr>`).join('')}</table>
  <h3>Concurrence locale</h3>
  <div class="card small">✈️ <b>${S.rival.name}</b> (hub ${apName(S.rival.hub)}) — ${S.rival.routes.filter(r=>isDrc(r.a)&&isDrc(r.b)).length} lignes domestiques, ${S.rival.fleet} avions.<br>
  ✈️ <b>Kivu Express</b> — opérateur régional de l’Est (Goma, Bukavu, Bunia).<br>✈️ <b>Air Équateur</b> — petits porteurs vers Mbandaka et la cuvette centrale.<br>
  <span class="mut">Conseil : les pistes en latérite (classe 1) n’acceptent que Cessna Caravan, Twin Otter et ATR 42. Elles ferment pendant les grandes pluies.</span></div>
  <h3>Aéroports par province</h3>
  ${DRC_PROVINCES.filter(p=>byProv[p]).map(p=>`<details class="prov"><summary><b>${p}</b> <span class="mut">${byProv[p].length} aéroport(s)</span></summary>
    ${byProv[p].map(c=>{const a=AP(c); return `<div class="aprow"><span><b>${c}</b> ${a.icao} — ${a.city} <span class="mut">${a.name}</span></span><span class="small">${a.runway} m · ${a.surface} · cl.${a.cls}${airportClosed(c)?' · <b class="neg">fermé</b>':''}</span><span><button class="btn sm" data-act="openAp" data-c="${c}">Voir</button></span></div>`;}).join('')}</details>`).join('')}
  <div class="mut small">Province sans aéroport commercial dans le jeu : Kwango.</div>`;
}

/* ---------- 🛠️ ADMIN ---------- */
function pAdmin(){
  return `<div class="card warnb">Mode bac à sable : ces actions trichent. Les sommes ajoutées apparaissent dans « Bac à sable » du P&L.</div>
  <h3>Trésorerie</h3><div class="btns sm">${[1e6,10e6,100e6,1e9].map(v=>`<button class="btn sm" data-act="adCash" data-v="${v}">+${fmtMoney(v)}</button>`).join('')}<button class="btn sm danger" data-act="adCash" data-v="-10000000">−$10 M</button></div>
  <h3>Temps</h3><div class="btns sm"><button class="btn sm" data-act="adTime" data-v="1">+1 heure</button><button class="btn sm" data-act="adTime" data-v="24">+1 jour</button><button class="btn sm" data-act="adTime" data-v="168">+7 jours</button><button class="btn sm" data-act="adTime" data-v="720">+30 jours</button></div>
  <h3>Économie</h3>
  <label>Pétrole : $${S.oil.toFixed(0)}<input type="range" min="30" max="180" value="${S.oilBase}" data-in="adOil"></label>
  <label>Réputation : ${Math.round(S.reputation)}<input type="range" min="0" max="100" value="${Math.round(S.reputation)}" data-in="adRep"></label>
  <h3>Déclencher un événement</h3><div class="chips">${EVENT_TYPES.map(e=>`<button class="chip" data-act="adEvent" data-id="${e.id}">${e.icon} ${e.name}</button>`).join('')}</div>
  <div class="btns sm"><button class="btn sm" data-act="adClearEv">Terminer tous les événements</button></div>
  <h3>Flotte & équipage</h3><div class="btns sm"><button class="btn sm" data-act="adQual">Qualifier tous les pilotes sur toutes les familles</button><button class="btn sm" data-act="adFix">Remettre toute la flotte à neuf</button><button class="btn sm" data-act="adCrew">+50 PNC</button><button class="btn sm" data-act="adCargo">Nouvelles offres cargo</button></div>
  <h3>Rival</h3><div class="btns sm"><button class="btn sm" data-act="adRival" data-v="1">StarWing +$100 M</button><button class="btn sm" data-act="adRival" data-v="-1">StarWing en difficulté</button></div>`;
}

/* ---------- aéroport ---------- */
function openAirport(code){
  const a=AP(code), c=COUNTRIES[a.cc], hub=S.company.hub;
  const here=S.fleet.filter(x=>x.loc===code&&x.status!=='flight');
  const d=code!==hub? dist(hub,code):0;
  const rv=S.rival.routes.filter(r=>r.a===code||r.b===code);
  showModal(`${c[2]} ${a.city} — ${a.code}`, `
    <div class="small">${a.name}${a.icao?' · OACI '+a.icao:''}<br>${a.drc?'Province : <b>'+a.prov+'</b> · ':''}${c[0]} · ${CONTINENTS[c[1]]}</div>
    <div class="grid2 small card"><div>Piste : <b>${a.runway} m</b> (${a.surface})</div><div>Classe : <b>${a.cls}</b>/5</div>
    <div>Trafic : <b>${a.traffic>=1?a.traffic+' M':Math.round(a.traffic*1000)+' k'}</b> pax/an</div><div>Kérosène : $${fuelPrice(code).toFixed(2)}/L</div>
    ${code!==hub?`<div>Depuis ${hub} : <b>${num(d)} km</b></div><div>Demande ${hub}→${code} : <b>${num(marketDemand(hub,code))}</b>/j</div>`:'<div><b>Votre hub</b></div>'}</div>
    ${airportClosed(code)?'<div class="al bad">Aéroport actuellement fermé.</div>':''}
    <div class="small">Avions compatibles (piste) : ${MODELS.filter(m=>m.cls<=a.cls).length}/${MODELS.length}${a.cls<=1?' — uniquement petits turbopropulseurs':''}</div>
    ${here.length?`<div class="small">Vos avions ici : ${here.map(x=>x.reg).join(', ')}</div>`:''}
    ${rv.length?`<div class="small">${S.rival.name} : ${rv.map(r=>r.a===code?r.b:r.a).join(', ')}</div>`:''}
    <div class="btns">
      ${code!==hub?`<button class="btn gold" data-act="draftPair" data-a="${hub}" data-b="${code}">➕ Route ${hub} → ${code}</button>`:''}
      <button class="btn" data-act="addDraft" data-c="${code}">Ajouter au brouillon de route${UI.draft?` (${UI.draft.stops.filter(Boolean).join('-')})`:''}</button>
      ${code!==hub?`<button class="btn sm" data-act="setHub" data-c="${code}">Déplacer le hub ici</button>`:''}
    </div>`);
}

/* ---------- actions ---------- */
function findAc(id){ return S.fleet.find(a=>a.id===id); }
function err(msg){ if(msg){ toast('⛔ '+msg,'bad'); return true; } return false; }
const ACTIONS = {
  closeModal, closeCard:()=>selectPlane(null),
  tab:d=>setTab(d.t),
  catalog:()=>{ UI.modal='catalog'; showModal('Catalogue — 42 modèles réels'+(S.customModels.length?' + vos modèles':''), catalogHtml(), true); },
  catFam:d=>{ UI.catFam=d.f; showModal('Catalogue', catalogHtml(), true); },
  buy:d=>{
    const m=getModel(d.m), mode=d.mode;
    const cost = mode==='new'? m.price*1e6 : mode==='used'? m.price*1e6*0.55 : m.price*1e6*0.0085*2;
    if(S.cash<cost && !confirm(`Coût ${fmtMoney(cost)} > capital ${fmtMoney(S.cash)}. Acheter quand même (capital négatif) ?`)) return;
    const ac=addAircraft(m.id,{owned:mode!=='lease', used:mode==='used'});
    S.cash-=cost; if(mode==='lease') book('leasing',0);
    logMsg(`🛬 ${mode==='lease'?'Leasing':'Achat'} : ${m.name} ${mode==='used'?'(occasion) ':''}immatriculé ${ac.reg} — livré à ${AP(ac.loc).city}.`,'ok');
    toast(`✈️ ${m.name} ${ac.reg} livré !`,'ok'); drawAirports(); renderPanel();
  },
  editor:()=>{ UI.modal='editor'; showModal('Éditeur d’avion personnalisé', editorHtml(), true); },
  saveCustom:()=>{
    const d=UI.edit, e=customSpecs(d);
    if(!(+d.seats>0||+d.cargo>0)) return err('Indiquez des sièges ou une capacité cargo');
    const m={id:'X'+uid(), name:d.name.slice(0,30)||'Avion perso', maker:'Personnalisé', fam:d.fam, seats:+d.seats>0?+d.seats:0, cargo:+d.seats>0?0:+d.cargo, range:clamp(+d.range,500,20000), speed:clamp(+d.speed,250,2500), burn:e.burn, price:e.price, cls:e.cls, alt:e.alt, custom:true, color:d.color, logo:d.logo};
    S.customModels.push(m); toast(`Modèle « ${m.name} » ajouté au catalogue`,'ok'); showModal('Éditeur d’avion personnalisé', editorHtml(), true);
  },
  delCustom:d=>{ if(S.fleet.some(a=>a.model===d.m)) return err('Des avions de ce modèle sont en flotte'); S.customModels=S.customModels.filter(m=>m.id!==d.m); showModal('Éditeur d’avion personnalisé', editorHtml(), true); },
  maint:d=>{ const ac=findAc(d.id); if(!err(startMaint(ac,d.k))){ toast(`🔧 ${ac.reg} : ${MAINT[d.k].label} commencé`,'ok'); renderPanel(); } },
  follow:d=>{ setTab(UI.mobile?'map':UI.tab); selectPlane(d.id); },
  ferry:d=>{
    const ac=findAc(d.id);
    showModal(`Convoyer ${ac.reg}`, `<datalist id="aplist2">${AIRPORT_CODES.map(c=>`<option value="${c} — ${esc(AP(c).city)}">`).join('')}</datalist>
      <label>Destination<input list="aplist2" id="ferryTo" placeholder="Code ou ville"></label>
      <div class="btns"><button class="btn gold" data-act="doFerry" data-id="${ac.id}">Convoyer (sans passagers)</button></div>`);
  },
  doFerry:d=>{ const code=parseAp($('#ferryTo').value); if(!code) return err('Aéroport inconnu'); const ac=findAc(d.id); if(!err(ferry(ac,code))){ closeModal(); toast(`${ac.reg} en route vers ${AP(code).city}`,'ok'); } },
  rename:d=>{ const ac=findAc(d.id); const n=prompt('Nom de baptême de l’avion :', ac.name||''); if(n!==null){ ac.name=n.slice(0,30); renderPanel(); } },
  sell:d=>{
    const ac=findAc(d.id), m=modelOf(ac);
    if(ac.owned){ const v=acValue(ac); if(!confirm(`Vendre ${ac.reg} (${m.name}) pour ${fmtMoney(v)} ?`)) return; S.cash+=v; S.led.total.ventes=(S.led.total.ventes||0)+v; }
    else { if(!confirm(`Rendre ${ac.reg} au loueur (frais : 1 mois, ${fmtMoney(ac.lease)}) ?`)) return; book('leasing',-ac.lease); }
    for(const r of S.routes) r.aircraft=r.aircraft.filter(x=>x!==ac.id);
    S.fleet=S.fleet.filter(x=>x!==ac); logMsg(`${ac.owned?'💵 Vente':'↩ Restitution'} de ${ac.reg} (${m.name}).`,'info'); drawRoutes(); renderPanel();
  },
  newRoute:()=>{ UI.draft=UI.draft||{stops:[S.company.hub,''],aircraft:[],price:1,auto:true}; openBuilder(); },
  addStop:()=>{ UI.draft.stops.push(''); openBuilder(); },
  rmStop:d=>{ UI.draft.stops.splice(+d.i,1); openBuilder(); },
  addDraft:d=>{ UI.draft=UI.draft||{stops:[],aircraft:[],price:1,auto:true}; const s=UI.draft.stops; const empty=s.indexOf(''); if(empty>=0) s[empty]=d.c; else s.push(d.c); openBuilder(); },
  draftPair:d=>{ UI.draft={stops:[d.a,d.b],aircraft:[],price:1,auto:true}; openBuilder(); },
  createRoute:()=>{
    const dr=UI.draft, stops=dr.stops.filter(Boolean);
    if(stops.length<2) return err('Au moins deux aéroports');
    for(let i=1;i<stops.length;i++) if(stops[i]===stops[i-1]) return err('Deux escales identiques consécutives');
    const legs=legsFor(stops);
    for(const id of dr.aircraft){ const e=checkLegs(findAc(id),legs); if(e) return err(e); }
    const r={id:uid(), stops, aircraft:[...dr.aircraft], price:dr.price, cabin:{f:0,j:0,w:0}, auto:dr.auto, stats:{flights:0,pax:0,seats:0,rev:0,cost:0,recent:[],shareSum:0,shareN:0}};
    S.routes.push(r);
    for(const id of r.aircraft){ const ac=findAc(id); ac.routeId=r.id; ac.hold=false; }
    UI.draft=null; closeModal(); drawRoutes(); logMsg(`🧭 Nouvelle route ${stops.join(' → ')}.`,'ok'); setTab('routes');
  },
  dep:d=>{ const ac=findAc(d.id); if(!err(dispatchRoute(ac,+d.dir))){ toast(`✈️ ${ac.reg} : départ !`,'ok'); renderPanel(); } },
  repos:d=>{ const ac=findAc(d.id), r=S.routes.find(x=>x.id===ac.routeId); if(!err(ferry(ac,r.stops[0]))) renderPanel(); },
  hold:d=>{ const ac=findAc(d.id); ac.hold=!ac.hold; renderPanel(); },
  unassign:d=>{ const ac=findAc(d.id); const r=S.routes.find(x=>x.id===ac.routeId); if(r) r.aircraft=r.aircraft.filter(x=>x!==ac.id); ac.routeId=null; ac.blocked=null; renderPanel(); },
  delRoute:d=>{ const r=S.routes.find(x=>x.id===d.id); if(!confirm(`Supprimer la route ${r.stops.join('-')} ?`)) return; for(const id of r.aircraft){ const ac=findAc(id); if(ac) ac.routeId=null; } S.routes=S.routes.filter(x=>x!==r); drawRoutes(); renderPanel(); },
  cabin:d=>{ const r=S.routes.find(x=>x.id===d.id); UI.modal='cabin'; showModal('Configuration cabine — '+r.stops.join('-'), cabinHtml(r)); },
  train:d=>{
    const p=S.pilots.find(x=>x.id===d.id);
    showModal(`Former ${esc(p.name)}`, `<div class="mut small">Qualifications actuelles : ${p.quals.join(', ')}. Le pilote est indisponible pendant la formation.</div>
    ${Object.entries(FAMILIES).filter(([f])=>!p.quals.includes(f)).map(([f,[n,c,days,sal]])=>`<div class="card row"><div class="grow"><b>${n}</b><br><span class="mut small">${fmtMoney(c)} · ${days} jours · salaire ensuite ≥ ${fmtMoney(sal)}/mois</span></div><button class="btn sm gold" data-act="doTrain" data-id="${p.id}" data-f="${f}">Former</button></div>`).join('')}`);
  },
  doTrain:d=>{ const p=S.pilots.find(x=>x.id===d.id), [n,c,days]=FAMILIES[d.f]; book('formation',-c); p.training={fam:d.f,start:S.time,until:S.time+days*DAY}; logMsg(`🎓 ${p.name} commence la qualification ${d.f} (${days} j).`,'info'); closeModal(); renderPanel(); },
  fire:d=>{ const p=S.pilots.find(x=>x.id===d.id); if(!confirm(`Licencier ${p.name} ? Indemnité : 2 mois de salaire.`)) return; book('salaires',-p.salary*2); S.pilots=S.pilots.filter(x=>x!==p); renderPanel(); },
  hire:d=>{ const p=S.candidates.find(x=>x.id===d.id); book('recrutement',-p.salary); S.pilots.push(p); S.candidates=S.candidates.filter(x=>x!==p); logMsg(`👨‍✈️ ${p.name} rejoint la compagnie (${p.quals.join(', ')}).`,'ok'); renderPanel(); },
  cabinCrew:d=>{ const n=+d.n; if(n>0) book('recrutement',-1500*n); S.cabinCrew=Math.max(0,S.cabinCrew+n); renderPanel(); },
  loan:d=>{ if(!err(takeLoan(d.id))) renderPanel(); },
  repay:d=>{ if(!err(repayLoan(d.id))) renderPanel(); },
  service:d=>{ S.service=+d.n; renderPanel(); },
  campaign:d=>{ const cp=CAMPAIGNS.find(x=>x.id===d.id); book('marketing',-cp.cost); S.campaigns.push({id:cp.id,until:S.time+cp.days*DAY}); S.reputation=clamp(S.reputation+cp.rep*0.3,0,100); logMsg(`📣 Campagne « ${cp.name} » lancée.`,'ok'); renderPanel(); },
  joinAlliance:d=>{ const al=ALLIANCES.find(x=>x.id===d.id); S.alliance=al.id; book('alliance',-al.fee); logMsg(`🤝 ${S.company.name} rejoint ${al.name} !`,'ok'); renderPanel(); },
  leaveAlliance:()=>{ if(confirm('Quitter l’alliance ?')){ S.alliance=null; renderPanel(); } },
  export:()=>{ const b=new Blob([JSON.stringify(S)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`sauvegarde-${S.company.code}-${fmtDate(S.time).replace(/ /g,'-')}.json`; a.click(); },
  import:()=>{ const i=document.createElement('input'); i.type='file'; i.accept='.json,application/json'; i.onchange=()=>{ const f=i.files[0]; if(!f) return; f.text().then(t=>{ try{ const o=JSON.parse(t); if(!o.fleet||!o.company) throw 0; S=o; save(); location.reload(); }catch(e){ err('Fichier de sauvegarde invalide'); } }); }; i.click(); },
  reset:()=>{ if(confirm('Effacer la partie et recommencer ?')){ localStorage.removeItem(SAVE_KEY); location.reload(); } },
  focusDRC:()=>{ setTab(UI.mobile?'map':UI.tab); focusDRC(); },
  focusWorld:()=>focusWorld(),
  openAp:d=>openAirport(d.c),
  setHub:d=>{ if(!confirm(`Déplacer votre hub à ${AP(d.c).city} ? Coût de déménagement : $2 M.`)) return; book('admin',-2e6); S.company.hub=d.c; closeModal(); drawAirports(); renderPanel(); },
  mapToggle:d=>{ MAPOPT[d.k]=!MAPOPT[d.k]; document.querySelector(`[data-k="${d.k}"]`).classList.toggle('on',MAPOPT[d.k]); drawAirports(); drawRoutes(); drawNight(); updateRival(); },
  // admin
  adCash:d=>{ book('admin',+d.v); renderTop(); renderPanel(); },
  adTime:d=>{ UI.silent=true; advance(+d.v*HOUR); UI.silent=false; toast(`⏩ +${d.v} h`,'ok'); renderPanel(); drawNight(); },
  adEvent:d=>{ triggerEvent(d.id); drawAirports(); renderPanel(); },
  adClearEv:()=>{ S.events=[]; recomputeClosed(); S.oil=S.oilBase; drawAirports(); renderPanel(); },
  adQual:()=>{ for(const p of S.pilots) p.quals=Object.keys(FAMILIES); renderPanel(); toast('Tous les pilotes sont qualifiés','ok'); },
  adFix:()=>{ for(const a of S.fleet){ a.condition=100; a.sinceA=a.sinceC=a.sinceD=0; } toast('Flotte remise à neuf','ok'); },
  adCrew:()=>{ S.cabinCrew+=50; toast('+50 PNC','ok'); },
  adCargo:()=>{ genCargoOffers(4); toast('Nouvelles offres cargo','ok'); },
  adRival:d=>{ if(+d.v>0) S.rival.cash+=100e6; else { S.rival.cash=-5e6; S.rival.rep=35; } toast('Rival modifié','ok'); },
};
function openBuilder(){ UI.modal='builder'; showModal('Nouvelle route', routeBuilderHtml(), true); }
function parseAp(v){ const c=String(v||'').trim().slice(0,3).toUpperCase(); if(AIRPORTS[c]) return c; const low=String(v).toLowerCase(); return AIRPORT_CODES.find(x=>AP(x).city.toLowerCase()===low.trim())||null; }

/* ---------- saisies ---------- */
const INPUTS = {
  autoMaint:el=>{ S.autoMaint=el.checked; },
  'ed.name':el=>{ UI.edit.name=el.value; }, 'ed.fam':el=>{ UI.edit.fam=el.value; }, 'ed.seats':el=>{ UI.edit.seats=el.value; },
  'ed.cargo':el=>{ UI.edit.cargo=el.value; }, 'ed.range':el=>{ UI.edit.range=el.value; }, 'ed.speed':el=>{ UI.edit.speed=el.value; },
  'ed.color':el=>{ UI.edit.color=el.value; }, 'ed.logo':el=>{ UI.edit.logo=el.value; },
  price:el=>{ const r=S.routes.find(x=>x.id===el.dataset.id); r.price=+el.value; },
  auto:el=>{ const r=S.routes.find(x=>x.id===el.dataset.id); r.auto=el.checked; },
  assign:el=>{ if(!el.value) return; const ac=findAc(el.value), r=S.routes.find(x=>x.id===el.dataset.id); r.aircraft.push(ac.id); ac.routeId=r.id; ac.hold=false; renderPanel(); },
  cab:el=>{ const r=S.routes.find(x=>x.id===el.dataset.id); r.cabin[el.dataset.k]=+el.value; showModal('Configuration cabine — '+r.stops.join('-'), cabinHtml(r)); },
  stop:el=>{ const c=parseAp(el.value); UI.draft.stops[+el.dataset.i]=c||''; },
  dAc:el=>{ const d=UI.draft; if(el.checked) d.aircraft.push(el.value); else d.aircraft=d.aircraft.filter(x=>x!==el.value); },
  dPrice:el=>{ UI.draft.price=+el.value; }, dAuto:el=>{ UI.draft.auto=el.checked; },
  'co.name':el=>{ S.company.name=el.value.slice(0,40)||'Ma compagnie'; renderTop(); },
  'co.code':el=>{ S.company.code=el.value.toUpperCase().slice(0,3)||'XX'; },
  'co.color':el=>{ S.company.color=el.value; renderTop(); drawRoutes(); for(const [,mk] of planeMarkers) L_planes.removeLayer(mk); planeMarkers.clear(); },
  'co.logo':el=>{ S.company.logo=el.value||'✈'; renderTop(); },
  anc:el=>{ S.ancillary[el.dataset.k]=el.checked; },
  notif:el=>{ S.notifications=el.checked; if(el.checked && 'Notification' in window) Notification.requestPermission().then(p=>{ if(p!=='granted'){ S.notifications=false; el.checked=false; err('Notifications refusées par le navigateur'); } }); },
  cargoAssign:el=>{ if(!el.value) return; if(!err(acceptCargo(el.dataset.id, el.value))){ toast('📦 Contrat accepté','ok'); } renderPanel(); },
  adOil:el=>{ S.oilBase=+el.value; S.oil=+(S.oilBase*oilMult()).toFixed(2); },
  adRep:el=>{ S.reputation=+el.value; },
};
function onInput(e){
  const el=e.target.closest('[data-in]'); if(!el) return;
  const fn=INPUTS[el.dataset.in]; if(!fn) return;
  fn(el);
  if(UI.modal==='builder' && $('#rbA')) $('#rbA').innerHTML=routeAnalysis();
  if(UI.modal==='editor' && $('#edEst')) $('#edEst').innerHTML=editorEst(customSpecs(UI.edit),UI.edit);
  if(e.type==='change' && /^(price|auto|anc|adOil|adRep)$/.test(el.dataset.in)) renderPanel();
}

/* ---------- démarrage ---------- */
function newGameModal(){
  const hubs=AIRPORT_CODES.filter(c=>AP(c).cls>=3).sort((a,b)=>(isDrc(b)-isDrc(a))||AP(a).city.localeCompare(AP(b).city));
  $('#modal').hidden=false;
  $('#modal').innerHTML=`<div class="mbox"><div class="mhead"><h2>✈️ Nouvelle compagnie aérienne</h2></div><div class="mbody">
    <div class="small mut">Fondez votre compagnie, développez le réseau congolais puis conquérez le monde. 142 aéroports, 42 avions réels, un rival impitoyable.</div>
    <div class="form">
      <label>Nom de la compagnie<input id="ng-name" value="Congo Sky"></label>
      <label>Code (2-3 lettres)<input id="ng-code" maxlength="3" value="CS"></label>
      <label>Hub<select id="ng-hub">${hubs.map(c=>`<option value="${c}" ${c==='FIH'?'selected':''}>${isDrc(c)?'🇨🇩 ':COUNTRIES[AP(c).cc][2]+' '}${AP(c).city} (${c})</option>`).join('')}</select></label>
      <label>Capital de départ<select id="ng-cap"><option value="40000000">$40 M — difficile</option><option value="80000000" selected>$80 M — normal</option><option value="250000000">$250 M — facile</option></select></label>
      <label>Couleur de livrée<input id="ng-color" type="color" value="#d4a72c"></label>
      <label>Logo (emoji)<input id="ng-logo" maxlength="3" value="🐆"></label>
    </div>
    <div class="small">Vous démarrez avec un ATR 72-600 et un Cessna Caravan, 6 pilotes qualifiés turbopropulseurs et 8 PNC.</div>
    <div class="btns"><button class="btn gold" id="ng-go">Créer la compagnie</button></div></div></div>`;
  $('#ng-go').onclick=()=>{
    newGame({name:$('#ng-name').value, code:$('#ng-code').value, hub:$('#ng-hub').value, capital:+$('#ng-cap').value, color:$('#ng-color').value, logo:$('#ng-logo').value});
    closeModal(); boot(); focusDRC();
  };
}
function offlineReport(r){
  if(!r || r.game<HOUR) return;
  showModal('Pendant votre absence…', `<div class="card"><div>Temps réel écoulé : <b>${fmtDur(r.real)}</b> · temps de jeu simulé : <b>${fmtDur(r.game)}</b></div>
  <div class="grid2"><div>Vols effectués : <b>${num(r.flights)}</b></div><div>Passagers : <b>${num(r.pax)}</b></div>
  <div>Revenus : <b class="pos">${fmtMoney(r.rev)}</b></div><div>Coûts : <b class="neg">${fmtMoney(r.cost)}</b></div></div>
  <div>Variation de trésorerie : <b class="${r.cash<0?'neg':'pos'}">${fmtMoney(r.cash)}</b></div></div>
  <div class="btns"><button class="btn gold" data-act="closeModal">Reprendre les commandes</button></div>`);
}

let booted=false;
function boot(){
  if(booted) return; booted=true;
  initMap();
  renderTop(); setTab(window.innerWidth<820?'map':'dash');
  updatePlanes(); updateRival();
  let last=performance.now(), acc1=0, acc2=0, acc30=0, acc10=0;
  setInterval(()=>{
    const now=performance.now(), dt=Math.min(now-last, 3600000); last=now;
    if(!S.paused){ advance(dt*SPEEDS[S.speed].mult); }
    updatePlanes();
    acc1+=dt; acc2+=dt; acc30+=dt; acc10+=dt;
    if(acc1>=1000){ acc1=0; renderTop(); updateRival(); }
    if(acc2>=2000){ acc2=0; liveRefresh(); }
    if(acc30>=20000){ acc30=0; drawNight(); drawAirports(); }
    if(acc10>=10000){ acc10=0; save(); }
  },200);
  window.addEventListener('beforeunload',save);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) save(); });
}

document.addEventListener('DOMContentLoaded',()=>{
  UI.mobile = window.matchMedia('(max-width: 820px)').matches;
  // barre d'onglets
  const tabsHtml=TABS.map(([k,i,l])=>`<button data-tab="${k}"><span>${i}</span><small>${l}</small></button>`).join('');
  $('#tabs').innerHTML=tabsHtml;
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-tab]'); if(t){ setTab(t.dataset.tab); return; }
    const sp=e.target.closest('[data-speed]'); if(sp){ S.speed=sp.dataset.speed; S.paused=false; renderTop(); if(UI.tab==='company') renderPanel(); return; }
    const a=e.target.closest('[data-act]'); if(a && ACTIONS[a.dataset.act]){ ACTIONS[a.dataset.act](a.dataset); renderTop(); }
  });
  document.addEventListener('change',onInput);
  document.addEventListener('input',e=>{ if(e.target.type==='range'||e.target.dataset.in?.startsWith('ed.')) onInput(e); });
  $('#tb-pause').onclick=()=>{ S.paused=!S.paused; renderTop(); };
  $('#modal').addEventListener('click',e=>{ if(e.target.id==='modal' && UI.modal!=='newgame' && S) closeModal(); });

  if(typeof L==='undefined'){ document.body.insertAdjacentHTML('beforeend','<div class="fatal">Impossible de charger la carte (Leaflet). Vérifiez votre connexion Internet puis rechargez.</div>'); }
  if(load()){
    UI.silent=true; const rep=catchUp(); UI.silent=false;
    boot(); offlineReport(rep);
  } else { UI.modal='newgame'; newGameModal(); }
});
