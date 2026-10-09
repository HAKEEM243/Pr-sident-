/* ============================================================
   INTERFACE — écrans de gestion (style « airline manager »)
   ============================================================ */
const UI = { tab:'dash', catFam:'all', catSort:'price', catRdc:false, mobile:false, ol:null, buyHub:null };
const $ = s=>document.querySelector(s);
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = v=>Math.round(v*100)+' %';
const num = v=>Math.round(v).toLocaleString('fr-FR');
const stars = r=>{ const s=r/20; let h=''; for(let i=1;i<=5;i++) h+= s>=i?'★': s>=i-0.5?'⯪':'☆'; return `<span class="stars" title="${Math.round(r)}/100">${h}</span>`; };
const apName = c=>`${AP(c).city} (${c})`;
const flag = c=>COUNTRIES[AP(c).cc][2];
const bar = (v,cls='')=>`<div class="pbar ${cls}"><i style="width:${clamp(v,0,1)*100}%"></i></div>`;

const TABS_SIMPLE = [['map','🗺️','Carte'],['network','🧭','Lignes'],['fleet','✈️','Flotte'],['shop','🛒','Acheter'],['news','📰','Actus'],['more','⋯','Plus']];
const TABS_ALL = [
  ['map','🗺️','Carte'],['dash','🏠','Accueil'],['news','📰','Actus'],['pax','🛂','Passagers'],['network','🌍','Réseau'],['fleet','✈️','Flotte'],['shop','🛒','Achats'],
  ['staff','👥','Personnel'],['fuel','⛽','Carburant'],['finance','💰','Finances'],['bourse','📈','Bourse'],['company','📣','Compagnie'],['world','🌐','Monde'],['admin','🛠️','Admin'],
];
const TABS = TABS_ALL;
const isSimple=()=>!!(typeof S!=='undefined'&&S&&S.simple!==false);
function renderTabs(){ const T=isSimple()?TABS_SIMPLE:TABS_ALL; $('#tabs').innerHTML=T.map(([k,i,l])=>`<button data-tab="${k}"><span>${i}</span><small>${l}</small></button>`).join(''); document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===tabKey(UI.tab))); }
function tabKey(t){ if(!isSimple()) return t; return TABS_SIMPLE.some(x=>x[0]===t)? t : 'more'; }

/* ---------- photos réelles des avions (Wikimedia Commons via l'API Wikipédia) ---------- */
const PHOTO_MEM={}, PHOTO_PENDING={};
function photoRec(t){
  if(PHOTO_MEM[t]) return PHOTO_MEM[t];
  try{ const c=JSON.parse(localStorage.getItem('cst-photo-'+t)||'null'); if(c&&c.src){ PHOTO_MEM[t]=c; return c; } }catch(e){}
  return null;
}
function photoFetch(t){
  if(PHOTO_PENDING[t]||PHOTO_MEM[t]) return; PHOTO_PENDING[t]=true;
  fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(t.replace(/ /g,'_')))
    .then(r=>r.ok?r.json():Promise.reject(r.status))
    .then(j=>{
      const o=j.originalimage, th=j.thumbnail; if(!o&&!th) throw 'no image';
      const src = o && o.width<=1280 ? o.source : (th? th.source.replace(/\/\d+px-/,'/800px-') : o.source);
      const orig=(o||th).source, file=decodeURIComponent((o?orig:orig.replace(/\/\d+px-[^/]+$/,'')).split('/').pop());
      const rec={src, file:'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(file.replace(/ /g,'_'))};
      PHOTO_MEM[t]=rec; try{ localStorage.setItem('cst-photo-'+t,JSON.stringify(rec)); }catch(e){}
      hydratePhotos();
    }).catch(()=>{ setTimeout(()=>{ PHOTO_PENDING[t]=false; },60000); });
}
// Illustrations fournies avec le jeu (affichées tant que la photo Wikimedia n'est pas chargée)
const MODEL_IMG={A20N:'a320',A320:'a320',A19N:'a320',A318:'a320',A321:'a320',A21N:'a320',A21X:'a320',B738:'b737',B38M:'b737',B3XM:'b737',B737:'b737',B39M:'b737',B38F:'b737',
  A388:'a380',B744:'b747',B748:'b747',B74F:'b747',B788:'b787',B789:'b787',B78X:'b787',CONC:'conc',A359:'a350',A35K:'a350',A35F:'a350',
  B77E:'b777',B77W:'b777',B779:'b777',B77F:'b777',B77L:'b777',B778:'b777',AT76:'atr',AT46:'atr',AT7F:'atr',CRJ2:'crj',CRJ7:'crj',CRJ9:'crj',
  E175:'e195',E190:'e195',E195:'e195',E170:'e195',E290:'e195',E295:'e195',C208:'c208'};
function photoHtml(m, cls='', color){
  const t=WIKI_TITLES[m.id], c=color||m.color||S.company.color, svg=PLANE_SVG(c,cls.includes('thumb')?44:92,planeCat(m));
  const rec=t&&photoRec(t);
  if(rec) return `<div class="photo ok ${cls}"><img src="${rec.src}" alt="${esc(m.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('fail')"><a class="credit" href="${rec.file}" target="_blank" rel="noopener" title="Photo Wikimedia Commons — auteur et licence">📷 Wikimedia</a>${svg}</div>`;
  const fb=MODEL_IMG[m.id];
  if(fb) return `<div class="photo ok fallback ${cls}" ${t?`data-pt="${esc(t)}" data-mid="${m.id}"`:''}><img src="img/ac-${fb}.jpg" alt="${esc(m.name)}" loading="lazy"></div>`;
  return `<div class="photo ${cls}" ${t?`data-pt="${esc(t)}" data-mid="${m.id}"`:''}>${svg}</div>`;
}
function hydratePhotos(){
  document.querySelectorAll('.photo[data-pt]').forEach(el=>{
    const t=el.dataset.pt, rec=photoRec(t);
    if(!rec){ photoFetch(t); return; }
    const m=getModel(el.dataset.mid); if(!m) return;
    const cls=[...el.classList].filter(c=>c!=='photo').join(' ');
    el.outerHTML=photoHtml(m,cls);
  });
}

/* ---------- notifications ---------- */
function toast(text, kind='info'){
  const box=$('#toasts'); if(!box) return;
  const el=document.createElement('div'); el.className='toast '+kind; el.innerHTML=text;
  box.appendChild(el); setTimeout(()=>el.classList.add('out'),5200); setTimeout(()=>el.remove(),5800);
  while(box.children.length>(UI.mobile?2:3)) box.firstChild.remove();
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
  const scroll=m.querySelector('.mbody')?.scrollTop||0, same=m.dataset.title===title;
  m.innerHTML=`<div class="mbox ${wide?'wide':''}"><div class="mhead"><h2>${title}</h2><button class="x" data-act="closeModal">×</button></div><div class="mbody">${html}</div></div>`;
  m.dataset.title=title; m.hidden=false;
  if(same) m.querySelector('.mbody').scrollTop=scroll;
  hydratePhotos();
}
function closeModal(){ $('#modal').hidden=true; $('#modal').innerHTML=''; $('#modal').dataset.title=''; UI.modal=null; UI.modalArg=null; }
function refreshModal(){ if(UI.modal && MODALS[UI.modal]) MODALS[UI.modal](UI.modalArg); }

/* ---------- barre supérieure ---------- */
function renderTop(){
  const c=S.company;
  $('#tb-name').innerHTML=`<span class="logo" style="background:${c.color}">${esc(c.logo)}</span><span class="nm">${esc(c.name)}</span>${stars(S.reputation)}`;
  $('#tb-cash').innerHTML=`<span class="${S.cash<0?'neg':''}">${fmtMoney(S.cash)}</span>`;
  const wk=ledSum(S.led.week||{},1)+ledSum(S.led.week||{},-1);
  $('#tb-week').innerHTML=`<span class="mut">Semaine</span> <b class="${wk<0?'neg':'pos'}">${wk>=0?'+':''}${fmtMoney(wk)}</b>`;
  $('#tb-time').innerHTML=`${fmtDate(S.time)} <b>${fmtTime(S.time)}</b>`;
  $('#tb-oil').innerHTML=`⛽ $${fuelPrice().toFixed(2)}/L`;
  document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('on', b.dataset.speed===S.speed && !S.paused));
  $('#tb-pause').textContent=S.paused?'▶':'⏸';
  $('#tb-pause').classList.toggle('on',S.paused);
  renderGuide();
}

/* ---------- onglets ---------- */
function setTab(t){
  UI.tab=t;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===tabKey(t)));
  document.body.classList.toggle('show-map', t==='map');
  if(t==='map'){ $('#panel').classList.add('hide'); setTimeout(()=>map&&map.invalidateSize(),50); return; }
  $('#panel').classList.remove('hide');
  renderPanel();
  $('#panelBody').scrollTop=0;
}
function renderPanel(){
  const body=$('#panelBody'); if(!body) return;
  const fn={more:pMore, news:pNews, pax:pPax, dash:pDash, network:pNetwork, fleet:pFleet, shop:pShop, staff:pStaff, fuel:pFuel, finance:pFinance, bourse:pBourse, company:pCompany, world:pWorld, drc:pWorld, admin:pAdmin}[UI.tab];
  if(!fn) return;
  const st=body.scrollTop;
  body.innerHTML=(typeof simpleTop==='function'?simpleTop(UI.tab):'')+fn();
  body.scrollTop=st;
  hydratePhotos();
  if(UI.tab==='finance'){ drawChart(); drawWeeksChart(); }
  if(UI.tab==='bourse') drawPriceChart('stockChart',(S.stock&&S.stock.hist)||[],'#7dd3fc',v=>'$'+v.toFixed(2));
  if(UI.tab==='fuel'){ drawPriceChart('fuelChart',S.fuel.hist,'#f5c518',v=>'$'+v.toFixed(3)); drawPriceChart('co2Chart',S.co2.hist,'#34d399',v=>'$'+v.toFixed(0)); }
}
function liveRefresh(){
  if(UI.tab==='map'||$('#panel').classList.contains('hide')) return;
  const a=document.activeElement;
  if(a && ($('#panel').contains(a)||$('#modal').contains(a)) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  if(['admin','company','shop'].includes(UI.tab)) return;
  if(performance.now()-(UI.touchAt||0)<4000) return; // ne pas redessiner sous le doigt / la souris du joueur
  renderPanel();
}

/* ---------- indicateurs globaux ---------- */
function marketStats(){
  let player=0, total=0, drcP=0, drcT=0;
  for(const r of S.routes){
    if(!routeAircraft(r).length) continue;
    for(let i=0;i<r.stops.length-1;i++) for(const [a,b] of [[r.stops[i],r.stops[i+1]],[r.stops[i+1],r.stops[i]]]){
      const mk=legMarket(r,a,b); player+=mk.daily; total+=mk.market+0.0001;
      if(isDrc(a)&&isDrc(b)) drcP+=mk.daily;
    }
  }
  return { share: total? player/total:0, playerDaily:player };
}
let _msc={t:-1,v:null};
function marketStatsCache(){ if(_msc.t!==S.time){ _msc={t:S.time,v:marketStats()}; } return _msc.v; }
function loadFactor(){ let p=0,s=0; for(const r of S.routes){ p+=r.stats.pax; s+=r.stats.seats; } return s? p/s : 0; }
function competitors(){
  if(S.ai&&typeof aiRows==='function') return aiRows();
  return [
    {name:S.company.name, value:fleetValue()+Math.max(0,S.cash), fleet:S.fleet.length, me:true, color:S.company.color, hub:S.company.hub, routes:S.routes.length, pax:marketStatsCache().playerDaily, rep:S.reputation},
    ...(S.rivals||[]).map(R=>({name:R.name, value:R.fleet*45e6+Math.max(0,R.cash), fleet:R.fleet, color:R.color, hub:R.hub, routes:R.network||R.routes.length, pax:R.paxDay, rep:R.rep, R})),
  ].sort((a,b)=>b.value-a.value);
}
const routeLosing = r=>r.stats.recent.length>=4 && r.stats.recent.reduce((s,v)=>s+v,0)<0;
function alerts(){
  const out=[];
  if(S.cash<0) out.push(['bad','Trésorerie négative : empruntez ou vendez un avion.','finance']);
  if((S.staff.strikeUntil||0)>S.time) out.push(['bad',`Grève en cours jusqu’au ${fmtDate(S.staff.strikeUntil)} : augmentez les salaires.`,'staff']);
  if(S.fuel.stock<S.fuel.cap*0.1) out.push(['warn','Réservoir de kérosène presque vide : achetez du carburant.','fuel']);
  for(const k of Object.keys(STAFF_CATS)) if(staffShortage(k)>0) out.push(['warn',`Sous-effectif : ${STAFF_CATS[k][0]} (${staffCount(k)}/${staffNeed()[k]}).`,'staff']);
  for(const ac of S.fleet){
    if(maintOverdue(ac)) out.push(['bad',`${ac.reg} : maintenance en retard (risque d’incident).`,'fleet']);
    if(ac.status==='idle' && !(ac.plan&&ac.plan.length) && !ac.flight) out.push(['info',`${ac.reg} (${modelOf(ac).name}) n’a aucun vol programmé.`,'fleet']);
    if(ac.blocked && ac.plan?.length) out.push(['warn',`${ac.reg} bloqué : ${ac.blocked}`,'fleet']);
  }
  for(const r of S.routes){
    if(routeLosing(r)) out.push(['warn',`Ligne ${r.stops.join('-')} déficitaire sur les derniers vols.`,'network']);
    if(!routeAircraft(r).length) out.push(['info',`Ligne ${r.stops.join('-')} ouverte mais sans avion programmé.`,'network']);
  }
  return out.slice(0,10);
}

/* ---------- 🏠 ACCUEIL ---------- */
function pDash(){
  const ms=marketStats(), comp=competitors(), rank=comp.findIndex(x=>x.me)+1;
  const flying=S.fleet.filter(a=>a.status==='flight').length;
  const w=S.led.week||{}, wr=ledSum(w,1), wc=-ledSum(w,-1), lw=S.lastWeekReport;
  const kpis=[
    ['💵','Capital',fmtMoney(S.cash),S.cash<0?'neg':''],
    ['🏦','Valeur nette',fmtMoney(netWorth()),''],
    ['✈️','Valeur de la flotte',fmtMoney(fleetValue()),''],
    ['📈','Part de marché',(ms.share*100).toFixed(1)+' %',''],
    ['💺','Remplissage',pct(loadFactor()),''],
    ['🛫','En vol',`${flying} / ${S.fleet.length}`,''],
    ['👥','Passagers',num(S.stats.pax),''],
    ['⛽','Kérosène',`$${fuelPrice().toFixed(2)}/L`,''],
    ['😊','Satisfaction',Math.round(satisfaction())+' %',''],
    ['⏱️','Ponctualité',pct(punctuality()),''],
  ];
  const top=[...S.routes].sort((a,b)=>(b.stats.rev-b.stats.cost)-(a.stats.rev-a.stats.cost)).slice(0,5);
  return `
  <div class="hero">
    <div class="biglogo" style="background:${S.company.color}">${esc(S.company.logo)}</div>
    <div class="grow"><h2>${esc(S.company.name)} <span class="mut">${esc(S.company.code)}</span></h2>
      <div>${stars(S.reputation)} <span class="mut">image ${Math.round(S.reputation)}/100</span></div>
      <div class="small mut">Hubs : ${S.hubs.map(h=>`${flag(h)} ${AP(h).city}`).join(' · ')} · Classement <b>${rank}<sup>e</sup></b>/${comp.length}</div>
      ${S.alliance?`<span class="chip gold">${ALLIANCES.find(a=>a.id===S.alliance).name}</span>`:''}
    </div>
  </div>
  <div class="weekcards">
    <div class="wcard"><div class="kl">Cette semaine</div><div class="kv ${wr-wc<0?'neg':'pos'}">${fmtMoney(wr-wc)}</div><div class="small mut">CA ${fmtMoney(wr)} · charges ${fmtMoney(wc)}</div></div>
    <div class="wcard"><div class="kl">Semaine dernière</div>${lw?`<div class="kv ${lw.profit<0?'neg':'pos'}">${fmtMoney(lw.profit)}</div><div class="small mut">${num(lw.pax)} pax · ${lw.flights} vols</div>`:'<div class="kv mut">—</div><div class="small mut">premier bilan dimanche soir</div>'}</div>
  </div>
  <div class="kpis five">${kpis.map(([i,l,v,c])=>`<div class="kpi"><div class="kl">${i} ${l}</div><div class="kv ${c}">${v}</div></div>`).join('')}</div>
  ${S.events.length?`<h3>Actualité mondiale</h3><div class="evs">${S.events.map(e=>{const t=EV(e);return `<div class="ev ${t.drc?'drc':''}">${t.icon} <b>${t.name}</b>${e.where||''} <span class="mut">— jusqu’au ${fmtDate(e.until)}</span><br><small>${t.desc}</small></div>`;}).join('')}</div>`:''}
  ${missionsHtml()}
  <h3>À faire</h3>
  <div class="alerts">${alerts().map(([k,t,tab])=>`<div class="al ${k}" ${tab?`data-tab="${tab}"`:''}>${t}</div>`).join('')||'<div class="mut">Tout va bien, commandant.</div>'}</div>
  <h3>Meilleures lignes</h3>
  ${top.length?`<table class="tbl"><tr><th>Ligne</th><th>Vols</th><th>Rempl.</th><th>Résultat</th></tr>${top.map(r=>`<tr data-act="line" data-id="${r.id}" class="click"><td>${r.stops.join('⇄')}</td><td>${r.stats.flights}</td><td>${r.stats.seats?pct(r.stats.pax/r.stats.seats):'—'}</td><td class="${r.stats.rev-r.stats.cost<0?'neg':'pos'}">${fmtMoney(r.stats.rev-r.stats.cost)}</td></tr>`).join('')}</table>`:'<div class="mut">Aucune ligne pour l’instant.</div>'}
  <h3>Actualités du secteur <button class="btn sm" data-tab="news">Tout voir</button></h3>
  <div class="log">${typeof feedRows==='function'&&S.ai?feedRows(S.ai.news,5):''}</div>
  <h3>Classement mondial des compagnies</h3>
  <div class="tblwrap"><table class="tbl rank"><tr><th>#</th><th>Compagnie</th><th>Hub</th><th>Flotte</th><th>Lignes</th><th>PAX/j</th><th>Image</th><th>Valeur</th></tr>${comp.map((c,i)=>`<tr class="${c.me?'me':''}"><td>${['🥇','🥈','🥉'][i]||i+1}${c.delta>0?'<sup class="pos">▲</sup>':c.delta<0?'<sup class="neg">▼</sup>':''}</td><td><span class="dot" style="background:${c.color}"></span>${esc(c.name)}${c.startup?' <span class="badge">🆕</span>':''}${c.crashes?` <span class="mut">💥${c.crashes}</span>`:''}${c.R&&c.R.local?' <span class="badge bad">rival local</span>':''}</td><td>${flag(c.hub)} ${c.hub}</td><td>${c.fleet}</td><td>${c.routes}</td><td>${num(c.pax||0)}</td><td>${stars(c.rep)}</td><td>${fmtMoney(c.value)}</td></tr>`).join('')}</table></div>
  <h3>Journal</h3>
  <div class="log">${S.log.slice(0,18).map(l=>`<div class="lg ${l.kind}"><span class="mut">${fmtDate(l.t)} ${fmtTime(l.t)}</span> ${l.text}</div>`).join('')}</div>`;
}
function missionsHtml(){
  const done=S.missions||[], todo=MISSIONS.filter(m=>!done.includes(m.id)&&missionAvail(m));
  return `<h3>Objectifs <span class="mut">${done.length}/${MISSIONS.filter(missionAvail).length}</span></h3>
  ${bar(done.length/MISSIONS.filter(missionAvail).length)}
  ${todo.slice(0,3).map(m=>`<div class="al mission"><b>🎯 ${m.name}</b> — ${m.desc} <span class="mut">· ${m.cash?fmtMoney(m.cash):''}${m.rep?' · +'+m.rep+' image':''}</span></div>`).join('')}
  ${done.length?`<details class="prov"><summary>🏆 ${done.length} objectif(s) atteint(s)</summary>${MISSIONS.filter(m=>done.includes(m.id)).map(m=>`<div class="small">✅ ${m.name}</div>`).join('')}</details>`:''}`;
}

/* ---------- 🌍 RÉSEAU : hubs & lignes ---------- */
function lineDemandRows(r, compact){
  const a=r.stops[0], b=r.stops[1], mk=legMarket(r,a,b, routeFreq(r)>0?undefined:1), audited=r.audit;
  const acs=routeAircraft(r);
  const seatsPerDay = k=>{ let s=0; for(const ac of acs){ const p=ac.plan.find(x=>x.routeId===r.id); const st=acSeats(ac); s+=(k==='c'?st.cargo:st[k])*(p?p.weekly/7:0); } return s; };
  const rows=['y','j','f','c'].map(k=>{
    const x=mk[k]; if(!x || (k==='f'&&x.demand<1)) return '';
    const unit=k==='c'?' t':'';
    const dem = audited? num(x.demand)+unit : '~'+num(Math.round(x.demand/10)*10)+unit;
    const offer=seatsPerDay(k), cap=x.daily;
    const ratio=x.ratio, cls=ratio>1.15?'neg':ratio<0.85?'warnt':'pos';
    return `<tr><td>${{y:'💺 Éco',j:'💼 Affaires',f:'👑 Première',c:'📦 Fret'}[k]}</td><td>${dem}</td><td>${num(Math.min(cap,offer||cap))}${unit}${offer?` <span class="mut">/ ${num(offer)}</span>`:''}</td>
      <td><b>${fmtMoney(x.price)}</b>${audited?` <span class="${cls} small">(${ratio>=1?'+':''}${Math.round((ratio-1)*100)} %)</span>`:''}</td></tr>`;
  }).join('');
  return `<table class="tbl dem"><tr><th>Type de billet</th><th>Voyageurs qui veulent ce trajet<br><span class="mut">(par jour)</span></th><th>Vous transportez<br><span class="mut">(par jour / places offertes)</span></th><th>Prix du billet</th></tr>${rows}</table>
  <div class="small mut">Exemple : « 400 voyageurs » = 400 personnes veulent faire ce trajet chaque jour. « 120 / 180 » = vous en transportez 120 avec 180 places offertes. Le pourcentage à côté du prix compare votre prix au prix idéal du marché.</div>`;
}
function pNetwork(){
  const byHub={}; for(const r of S.routes) (byHub[r.stops[0]]=byHub[r.stops[0]]||[]).push(r);
  return `<div class="btns">${isSimple()?'':'<button class="btn gold big" data-act="openLine">➕ Ouvrir une ligne</button>'}<button class="btn ${isSimple()?'sm':'big'}" data-act="buyHubModal">🏢 Acheter un hub</button></div>
  <div class="hubs">${S.hubs.map(h=>{ const a=AP(h), n=(byHub[h]||[]).length, f=S.fleet.filter(x=>x.hub===h).length; return `<div class="hubcard" data-act="openAp" data-c="${h}">
    <div class="hc-top">${flag(h)} <b>${a.city}</b> <span class="mut">${h}</span></div><div class="small">${n} ligne(s) · ${f} avion(s)</div><div class="small mut">${a.name} · piste cl.${a.cls}</div></div>`; }).join('')}</div>
  ${S.hubs.map(h=>`<h3>Lignes depuis ${AP(h).city}</h3>${(byHub[h]||[]).map(lineCard).join('')||'<div class="mut small">Aucune ligne depuis ce hub.</div>'}`).join('')}`;
}
function lineCard(r){
  const legs=legsFor(r.stops), tot=legs.reduce((s,l)=>s+l.dist,0), acs=routeAircraft(r);
  const weekly=acs.reduce((s,ac)=>s+(ac.plan.find(p=>p.routeId===r.id)?.weekly||0),0);
  const res=r.stats.rev-r.stats.cost, losing=routeLosing(r), share=legMarket(r,r.stops[0],r.stops[1]).share;
  return `<div class="card line ${losing?'losing':''}" data-act="line" data-id="${r.id}">
    <div class="lhead"><div><b class="lroute">${r.stops.join(' ⇄ ')}</b><div class="small mut">${r.stops.map(c=>AP(c).city).join(' – ')} · ${num(tot)} km</div></div>
      <div class="lbadges">${!r.audit?'<span class="badge warn">Audit ?</span>':''}${losing?'<span class="badge bad">Déficit</span>':''}${!acs.length?'<span class="badge">Aucun avion</span>':''}</div></div>
    <div class="lstats"><div><span>Vols/sem.</span><b>${weekly}</b></div><div><span>Part</span><b>${pct(share)}</b></div><div><span>Rempl.</span><b>${r.stats.seats?pct(r.stats.pax/r.stats.seats):'—'}</b></div><div><span>Résultat</span><b class="${res<0?'neg':'pos'}">${fmtMoney(res)}</b></div></div>
  </div>`;
}
function lineModalHtml(r){
  const acs=routeAircraft(r), legs=legsFor(r.stops);
  const a=r.stops[0], b=r.stops[1];
  const hubAcs=S.fleet.filter(ac=>ac.hub===r.stops[0] && !acs.includes(ac));
  const priceRow=k=>{ const ip=idealPrice(a,b,k), cur=ip*(r.pm[k]??1);
    return `<div class="prow"><span class="pl">${{y:'💺 Économique',j:'💼 Affaires',f:'👑 Première',c:'📦 Fret (par t)'}[k]}</span>
      <button class="btn sm" data-act="price" data-id="${r.id}" data-k="${k}" data-d="-0.05">−</button>
      <input type="number" class="pin" min="1" step="1" value="${Math.round(cur)}" data-in="price" data-id="${r.id}" data-k="${k}">
      <button class="btn sm" data-act="price" data-id="${r.id}" data-k="${k}" data-d="0.05">+</button>
      ${r.audit?`<button class="btn sm" data-act="price" data-id="${r.id}" data-k="${k}" data-set="1">Idéal ${fmtMoney(ip)}</button>`:''}</div>`; };
  return `<div class="small">${r.stops.map(c=>`${flag(c)} ${AP(c).city}`).join(' → ')} · ${legs.map(l=>num(l.dist)+' km').join(' + ')}</div>
  ${lineTechHtml(r)}
  ${!r.audit?`<div class="al warn">🔍 <b>Audit non réalisé</b> : la demande exacte et les prix idéaux sont inconnus. <button class="btn sm gold" data-act="audit" data-id="${r.id}">Lancer l’audit (${fmtMoney(auditCost(r))})</button></div>`:'<div class="al ok">🔍 Ligne auditée : demande et prix idéaux connus.</div>'}
  <h3>Voyageurs sur ${a} → ${b}</h3>${lineDemandRows(r)}
  <div class="btns"><button class="btn sm" data-act="paxLine" data-a="${a}" data-b="${b}">🛂 Qui sont ces passagers ? (nationalité, richesse, prix)</button></div>
  ${(()=>{ const rv=rivalsOn(a,b), mn=typeof realMinutes==='function'?realMinutes(a,b):0;
    return rv.length? `<h3>Compagnies réelles sur cette ligne</h3>${mn?`<div class="small mut">Durée de vol réelle (horaire) ≈ <b>${fmtDur(mn*MIN)}</b></div>`:''}${rv.map(x=>`<div class="small"><span class="dot" style="background:${x.R.color}"></span><b>${x.R.name}</b> <span class="mut">${x.R.code}</span> — ≈ ${x.freq} vol(s)/j par sens</div>`).join('')}`
      : `<div class="small mut">✈️ Aucune compagnie ne relie aujourd’hui ${AP(a).city} et ${AP(b).city} en direct : marché vierge.</div>`; })()}
  ${legMarket(r,a,b).transfer>1?`<div class="small">🔁 Correspondances via votre réseau : +${num(legMarket(r,a,b).transfer)} pax/j potentiels.</div>`:''}
  <h3>Prix des billets</h3>
  <div class="prices">${['y','j','f','c'].map(priceRow).join('')}</div>
  <div class="mut small">Plus cher que l’idéal = moins de passagers ; moins cher = plus de passagers mais moins de recettes. Les prix s’appliquent à tous les tronçons de la ligne.</div>
  <h3>Avions programmés</h3>
  ${acs.map(ac=>{ const p=ac.plan.find(x=>x.routeId===r.id), m=modelOf(ac), mx=maxWeekly(ac,r);
    return `<div class="acl"><div class="grow"><b>${ac.reg}</b> <span class="mut">${m.name}</span><br>${acStatus(ac)}<div class="small mut">${num(routeCycleHours(r,ac))} h par rotation · ${Math.round(planHours(ac))}/${MAX_WEEK_HOURS} h</div></div>
      <div class="stepper"><button class="btn sm" data-act="plan" data-ac="${ac.id}" data-r="${r.id}" data-d="-1">−</button><b>${p.weekly}</b><span class="mut small">/sem</span><button class="btn sm" data-act="plan" data-ac="${ac.id}" data-r="${r.id}" data-d="1" ${p.weekly>=mx?'disabled':''}>+</button><button class="btn sm" data-act="plan" data-ac="${ac.id}" data-r="${r.id}" data-max="1">Max</button></div></div>`; }).join('')||'<div class="mut small">Aucun avion programmé sur cette ligne.</div>'}
  ${hubAcs.length?`<select data-in="addPlan" data-id="${r.id}"><option value="">+ Programmer un avion basé à ${r.stops[0]}…</option>${hubAcs.map(ac=>{ const e=checkLegs(ac,legs), mx=e?0:maxWeekly(ac,r); return `<option value="${ac.id}" ${e||mx<1?'disabled':''}>${ac.reg} — ${modelOf(ac).name}${e?' ✖ '+e:mx<1?' (planning plein)':` (jusqu’à ${mx}/sem)`}</option>`; }).join('')}</select>`:`<div class="mut small">Aucun autre avion basé à ${r.stops[0]}. <a href="#" data-tab="shop">Achetez-en un</a>.</div>`}
  <h3>Résultats</h3>
  <div class="grid2 small"><div>Vols : <b>${r.stats.flights}</b></div><div>Passagers : <b>${num(r.stats.pax)}</b></div><div>Remplissage : <b>${r.stats.seats?pct(r.stats.pax/r.stats.seats):'—'}</b></div><div>Retards : <b>${r.stats.late||0}</b></div>
  <div>Recettes : <b>${fmtMoney(r.stats.rev)}</b></div><div>Résultat : <b class="${r.stats.rev-r.stats.cost<0?'neg':'pos'}">${fmtMoney(r.stats.rev-r.stats.cost)}</b></div></div>
  <div class="btns"><button class="btn sm" data-act="showLineMap" data-id="${r.id}">🗺️ Voir sur la carte</button><button class="btn sm danger" data-act="closeLine" data-id="${r.id}">Fermer la ligne</button></div>`;
}
function lineTechHtml(r){
  const legs=legsFor(r.stops), acs=routeAircraft(r), ref=acs.length?modelOf(acs[0]):null;
  const apRow=c=>{ const a=AP(c), rws=runwaysOf(c), best=rws.slice().sort((x,y)=>y.len-x.len)[0];
    return `<div><b>${c}</b> ${esc(a.city)} · ${num(a.runway)} m${best?` (piste ${best.id}/${rws.find(x=>x.thr===best.end)?.id||''})`:''} · ${a.surface} · alt. ${num(a.elev||0)} ft${rws.length>2?` · ${rws.length/2} pistes`:''}</div>`; };
  return `<div class="card tech"><div class="kl">📐 Fiche technique</div>
    ${legs.map(l=>{ const back=windKmh(l.to,l.from);
      const bt=m=>`${fmtDur(legProfile(l.dist,m,l.wind,l.from,l.to).total)} aller · ${fmtDur(legProfile(l.dist,m,back,l.to,l.from).total)} retour`;
      return `<div class="techleg"><b>${l.from} → ${l.to}</b> · ${num(l.dist)} km · ${num(l.dist/1.852)} NM · vent moyen ${l.wind>0?'+':''}${l.wind} km/h à l’aller, ${back>0?'+':''}${back} km/h au retour
        ${(acs.length?acs.map(a=>modelOf(a)):[]).filter((m,i,arr)=>arr.findIndex(x=>x.id===m.id)===i).map(m=>{ const pf=payloadFactor(m,l.dist);
          return `<div class="small">✈ ${m.name} : ${bt(m)}${pf<1?` · <span class="warnt">charge limitée à ${Math.round(pf*100)} % (proche de l’autonomie max)</span>`:''}</div>`; }).join('')||'<div class="small mut">Programmez un avion pour voir les temps de vol.</div>'}</div>`; }).join('')}
    <div class="small">${r.stops.map(apRow).join('')}</div></div>`;
}
function openLineHtml(){
  const ol=UI.ol;
  const hub=ol.stops[0], last=ol.stops[ol.stops.length-1];
  const q=(ol.q||'').toLowerCase();
  let list=AIRPORT_CODES.filter(c=>!ol.stops.includes(c) && AP(c).cls>=1);
  const hcc=AP(hub).cc, hcont=COUNTRIES[hcc][1];
  if(ol.f==='home') list=list.filter(c=>AP(c).cc===hcc); else if(ol.f==='cont') list=list.filter(c=>continentOf(c)===hcont); else if(ol.f==='world') list=list.filter(c=>continentOf(c)!==hcont); else if(ol.f==='big') list=list.filter(c=>AP(c).traffic>=10);
  if(q) list=list.filter(c=>c.toLowerCase().includes(q)||AP(c).city.toLowerCase().includes(q)||COUNTRIES[AP(c).cc][0].toLowerCase().includes(q));
  const rows=list.map(c=>({c,d:dist(last,c),dem:marketDemand(last,c)})).sort((x,y)=>y.dem-x.dem).slice(0,40);
  const owned=S.routes.find(r=>r.stops.join()===ol.stops.join());
  let preview='';
  if(ol.stops.length>=2){
    const fake={id:'preview',stops:ol.stops,pm:{y:1,j:1,f:1,c:1},stats:{}};
    preview=`<div class="card gold-b"><div><b>${ol.stops.join(' ⇄ ')}</b> · ${num(legsFor(ol.stops).reduce((s,l)=>s+l.dist,0))} km</div>
      ${lineDemandRows({...fake,audit:false})}
      <div class="small">Compatible avec vos avions basés à ${hub} : ${S.fleet.filter(ac=>ac.hub===hub && !checkLegs(ac,legsFor(ol.stops))).map(ac=>ac.reg).join(', ')||'<span class="warnt">aucun pour l’instant</span>'}</div>
      <div class="btns">${owned?'<span class="badge">Déjà exploitée</span>':`<button class="btn gold" data-act="buyLine">Acheter la ligne · ${fmtMoney(lineCost(ol.stops))}</button>`}<button class="btn sm" data-act="olPop">↩ Retirer ${AP(last).city}</button></div></div>`;
  }
  return `<div class="chips">Hub : ${S.hubs.map(h=>`<button class="chip ${h===hub?'on':''}" data-act="olHub" data-c="${h}">${flag(h)} ${AP(h).city}</button>`).join('')}</div>
  <div class="small">Itinéraire : <b>${ol.stops.map(c=>AP(c).city).join(' → ')}</b>${ol.stops.length>=2?' · <span class="mut">cliquez une autre ville pour ajouter une escale</span>':''}</div>
  ${preview}
  <div class="row"><input id="olq" placeholder="🔍 Ville, code ou pays…" value="${esc(ol.q||'')}" data-in="olq"></div>
  <div class="chips">${[['all','Tous'],['home',COUNTRIES[AP(hub).cc][2]+' '+COUNTRIES[AP(hub).cc][0]],['cont',CONTINENTS[COUNTRIES[AP(hub).cc][1]]],['world','Autres continents'],['big','Grands hubs mondiaux']].map(([k,l])=>`<button class="chip ${ol.f===k?'on':''}" data-act="olFilter" data-f="${k}">${l}</button>`).join('')}</div>
  <table class="tbl destlist"><tr><th>Destination</th><th>km</th><th>Demande/j</th><th>Piste</th><th>Licence</th></tr>
  ${rows.map(x=>`<tr class="click" data-act="olPick" data-c="${x.c}"><td>${flag(x.c)} <b>${AP(x.c).city}</b> <span class="mut">${x.c}</span></td><td>${num(x.d)}</td><td>${num(x.dem)}</td><td>cl.${AP(x.c).cls}</td><td>${fmtMoney(lineCost([last,x.c]))}</td></tr>`).join('')}</table>`;
}
function buyHubHtml(){
  const q=(UI.hq||'').toLowerCase();
  let list=AIRPORT_CODES.filter(c=>!S.hubs.includes(c)&&AP(c).cls>=2);
  if(q) list=list.filter(c=>c.toLowerCase().includes(q)||AP(c).city.toLowerCase().includes(q)||COUNTRIES[AP(c).cc][0].toLowerCase().includes(q));
  list=list.sort((a,b)=>AP(b).traffic-AP(a).traffic).slice(0,60);
  return `<div class="small mut">Un hub est une base : vos avions y sont stationnés et toutes vos lignes partent d’un hub. Prix selon la taille de l’aéroport.</div>
  <input id="hq" placeholder="🔍 Ville, code ou pays… (3 200 aéroports)" value="${esc(UI.hq||'')}" data-in="hq">
  <table class="tbl destlist"><tr><th>Aéroport</th><th>Trafic</th><th>Piste</th><th>Prix</th><th></th></tr>
  ${list.map(c=>`<tr><td>${flag(c)} <b>${AP(c).city}</b> <span class="mut">${c}</span></td><td>${AP(c).traffic>=1?AP(c).traffic+' M':Math.round(AP(c).traffic*1000)+' k'}</td><td>cl.${AP(c).cls}</td><td>${fmtMoney(hubCost(c))}</td><td><button class="btn sm gold" data-act="buyHub" data-c="${c}">Acheter</button></td></tr>`).join('')}</table>`;
}

/* ---------- ✈️ FLOTTE ---------- */
function acStatus(ac){
  if(ac.status==='flight'){ const st=flightState(ac); return `<span class="badge fly">✈ ${PHASES[st.phase]} · ${st.origin}→${st.dest} · ${Math.round(st.progress*100)} %</span>`; }
  if(ac.status==='manual') return `<span class="badge fly">🕹️ Piloté par vous</span>`;
  if(ac.status==='maint') return `<span class="badge maint">🔧 ${MAINT[ac.maintType].label} · fin ${fmtDate(ac.maintUntil)}</span>`;
  if((ac.readyAt||0)>S.time) return `<span class="badge">⏳ Escale à ${ac.loc} · prêt ${fmtTime(ac.readyAt)}</span>`;
  return `<span class="badge idle">● Au sol à ${ac.loc}</span>`;
}
function pFleet(){
  const byHub={}; for(const ac of S.fleet) (byHub[ac.hub]=byHub[ac.hub]||[]).push(ac);
  return `<div class="btns"><button class="btn gold" data-tab="shop">🛒 Acheter un avion</button><button class="btn" data-act="editor">🛠️ Éditeur d’avion</button></div>
  ${(S.orders||[]).length?`<h3>Commandes en cours (${S.orders.length})</h3>${S.orders.slice().sort((a,b)=>a.due-b.due).map(o=>{ const m=getModel(o.model); return `<div class="card row"><div class="grow"><b>${m.name}</b> → ${AP(o.hub).city}<br>${bar((S.time-o.ordered)/(o.due-o.ordered))}<span class="small mut">Livraison le ${fmtDate(o.due)} · solde ${fmtMoney(o.total-o.paid)} à payer</span></div><button class="btn sm danger" data-act="cancelOrder" data-id="${o.id}">Annuler</button></div>`; }).join('')}`:''}
  <label class="tog"><input type="checkbox" data-in="autoMaint" ${S.autoMaint?'checked':''}> Maintenance automatique (check A 600 h · C 3 000 h · D 12 000 h)</label>
  ${Object.entries(byHub).map(([h,list])=>`<h3>Basés à ${AP(h).city} (${list.length})</h3>${list.map(acCard).join('')}`).join('')||'<div class="mut">Aucun avion.</div>'}`;
}
function acCard(ac){
  const m=modelOf(ac), st=acSeats(ac), h=planHours(ac);
  const lines=(ac.plan||[]).map(p=>{ const r=S.routes.find(x=>x.id===p.routeId); return r?`<span class="chip">${r.stops.join('⇄')} ×${p.weekly}</span>`:''; }).join('');
  const mt=k=>{ const v=ac['since'+k], e=MAINT[k].every; return `<span class="mtc ${v>e?'over':v>e*0.9?'due':''}" title="${MAINT[k].label}">${k} ${Math.round(v/e*100)}%</span>`; };
  return `<div class="card ac">
    <div class="acrow">${photoHtml(m,'thumb')}
      <div class="grow"><b>${ac.reg}</b> ${ac.name?'« '+esc(ac.name)+' »':''}<br><span class="mut small">${m.name}${m.custom?' (perso)':''} · ${ac.owned?'propriété':'leasing '+fmtMoney(ac.lease)+'/mois'}</span><br>${acStatus(ac)}</div></div>
    <div class="small">${isCargo(m)?`📦 ${m.cargo} t`:`💺 <b>${st.f}</b> F · <b>${st.j}</b> J · <b>${st.y}</b> Y`} · ${num(m.range)} km · piste cl.${m.cls}</div>
    <div class="planbar"><span>📅 Planning</span>${bar(h/MAX_WEEK_HOURS, h>MAX_WEEK_HOURS*0.95?'warn':'')}<b>${Math.round(h)}/${MAX_WEEK_HOURS} h</b></div>
    <div class="chips">${lines||'<span class="mut small">Aucune ligne programmée</span>'}</div>
    <div class="cond">État ${bar(ac.condition/100, ac.condition<40?'bad':ac.condition<70?'warn':'')} <b>${Math.round(ac.condition)} %</b> ${mt('A')}${mt('C')}${mt('D')}</div>
    ${ac.blocked&&ac.plan?.length?`<div class="al warn small">${ac.blocked}</div>`:''}
    <div class="btns sm">
      <button class="btn sm gold" data-act="planModal" data-id="${ac.id}">📅 Planning</button>
      ${isCargo(m)?'':`<button class="btn sm" data-act="cfgModal" data-id="${ac.id}">💺 Cabine</button>`}
      <button class="btn sm" data-act="maintModal" data-id="${ac.id}">🔧 Entretien</button>
      ${ac.status==='idle'?`<button class="btn sm" data-act="pilot" data-id="${ac.id}">🕹️ Piloter</button>`:''}
      ${ac.status==='flight'?`<button class="btn sm" data-act="follow" data-id="${ac.id}">🎯 Suivre</button>`:''}
      <button class="btn sm" data-act="moreModal" data-id="${ac.id}">⋯</button>
    </div>
  </div>`;
}
const planCat = m=>planeCat(m);
function planModalHtml(ac){
  const m=modelOf(ac), lines=S.routes.filter(r=>r.stops[0]===ac.hub), h=planHours(ac);
  return `<div class="small">${m.name} · basé à <b>${apName(ac.hub)}</b>. Une rotation = aller + retour. Maximum ${MAX_WEEK_HOURS} h de rotations par semaine.</div>
  <div class="planbar big"><span>Utilisation</span>${bar(h/MAX_WEEK_HOURS)}<b>${Math.round(h)}/${MAX_WEEK_HOURS} h</b></div>
  ${lines.map(r=>{ const e=checkLegs(ac,legsFor(r.stops)), p=(ac.plan||[]).find(x=>x.routeId===r.id), w=p?p.weekly:0, mx=e?0:maxWeekly(ac,r);
    const mk=legMarket(r,r.stops[0],r.stops[1]), seats=acSeats(ac).total||1;
    return `<div class="acl ${e?'dis':''}"><div class="grow"><b>${r.stops.join(' ⇄ ')}</b> <span class="mut small">${num(legsFor(r.stops).reduce((s,l)=>s+l.dist,0))} km · ${e?'✖ '+e:routeCycleHours(r,ac).toFixed(1)+' h/rotation'}</span>
      ${!e&&!isCargo(m)?`<div class="small mut">≈ ${num(mk.perFlight)} pax/vol pour ${seats} sièges</div>`:''}</div>
      <div class="stepper"><button class="btn sm" data-act="plan" data-ac="${ac.id}" data-r="${r.id}" data-d="-1" ${w<=0?'disabled':''}>−</button><b>${w}</b><span class="mut small">/sem</span><button class="btn sm" data-act="plan" data-ac="${ac.id}" data-r="${r.id}" data-d="1" ${e||w>=mx?'disabled':''}>+</button><button class="btn sm" data-act="plan" data-ac="${ac.id}" data-r="${r.id}" data-max="1" ${e?'disabled':''}>Max</button></div></div>`; }).join('')||`<div class="mut">Aucune ligne depuis ${ac.hub}. <button class="btn sm gold" data-act="openLine">Ouvrir une ligne</button></div>`}
  <label class="tog"><input type="checkbox" data-in="hold" data-id="${ac.id}" ${ac.hold?'checked':''}> Suspendre les vols de cet avion</label>`;
}
function cfgModalHtml(ac){
  const m=modelOf(ac), s=acSeats(ac);
  const maxF=Math.floor(m.seats/CLASS_SPACE.f*0.3), maxJ=Math.floor(m.seats/CLASS_SPACE.j*0.5);
  const lines=(ac.plan||[]).map(p=>S.routes.find(r=>r.id===p.routeId)).filter(Boolean);
  const hint=lines.map(r=>{ const mk=legMarket(r,r.stops[0],r.stops[1]); return `<div class="small">${r.stops.join('⇄')} : ≈ ${num(mk.f.perFlight)} F · ${num(mk.j.perFlight)} J · ${num(mk.y.perFlight)} Y par vol</div>`; }).join('');
  return `<div class="small mut">Un siège Première occupe la place de 3 sièges éco, un siège Affaires celle de 2,2. Capacité totale : ${m.seats} sièges éco.</div>
  <label>👑 Première : <b>${s.f}</b><input type="range" min="0" max="${maxF}" value="${s.f}" data-in="cfg" data-k="f" data-id="${ac.id}"></label>
  <label>💼 Affaires : <b>${s.j}</b><input type="range" min="0" max="${maxJ}" value="${s.j}" data-in="cfg" data-k="j" data-id="${ac.id}"></label>
  <div class="card">💺 Économique : <b>${s.y}</b> · total <b>${s.total}</b> sièges · soute ${s.cargo} t</div>
  ${hint?`<h3>Demande sur vos lignes</h3>${hint}`:''}`;
}
function maintModalHtml(ac){
  const m=modelOf(ac);
  return `<div class="cond">État ${bar(ac.condition/100, ac.condition<40?'bad':ac.condition<70?'warn':'')} <b>${Math.round(ac.condition)} %</b></div>
  <div class="small">${num(ac.hours)} h de vol · ${num(ac.cycles)} cycles · ${acAgeYears(ac).toFixed(1)} ans</div>
  ${['A','C','D'].map(k=>{ const v=ac['since'+k], e=MAINT[k].every; return `<div class="card row"><div class="grow"><b>${MAINT[k].label}</b> — tous les ${num(e)} h<br>${bar(v/e, v>e?'bad':v>e*0.9?'warn':'')}<span class="small mut">${num(v)}/${num(e)} h · ${fmtMoney(MAINT[k].cost(m))} · ${MAINT[k].days} j d’immobilisation</span></div><button class="btn sm ${v>e*0.9?'gold':''}" data-act="maint" data-id="${ac.id}" data-k="${k}" ${ac.status!=='idle'?'disabled':''}>Lancer</button></div>`; }).join('')}
  <div class="mut small">Un avion en retard d’entretien s’use 3 fois plus vite et risque des incidents. Le manque de mécaniciens accélère l’usure.</div>`;
}
function moreModalHtml(ac){
  const m=modelOf(ac);
  return `<div class="btns">
    <button class="btn" data-act="rename" data-id="${ac.id}">✏️ Renommer</button>
    <button class="btn" data-act="ferry" data-id="${ac.id}" ${ac.status!=='idle'?'disabled':''}>↗ Convoyer</button>
    ${S.hubs.length>1?`<select data-in="transfer" data-id="${ac.id}"><option value="">🏢 Transférer vers un autre hub…</option>${S.hubs.filter(h=>h!==ac.hub).map(h=>`<option value="${h}">${AP(h).city} (${h})</option>`).join('')}</select>`:''}
    <button class="btn danger" data-act="sell" data-id="${ac.id}" ${ac.status==='flight'||ac.status==='manual'?'disabled':''}>${ac.owned?`Vendre ${fmtMoney(acValue(ac))}`:'Rendre au loueur (1 mois)'}</button></div>`;
}

/* ---------- 🛒 ACHATS ---------- */
function pShop(){
  const all=[...MODELS,...S.customModels];
  const fams=['all',...Object.keys(FAMILIES)];
  let list=all.filter(m=>UI.catFam==='all'||m.fam===UI.catFam);
  if(UI.catRdc) list=list.filter(m=>m.cls<=2);
  const key={price:m=>m.price, seats:m=>m.seats||m.cargo*3, range:m=>m.range}[UI.catSort];
  list.sort((a,b)=>key(a)-key(b));
  const hub=UI.buyHub&&S.hubs.includes(UI.buyHub)?UI.buyHub:S.hubs[0];
  const maxSeats=Math.max(...all.map(m=>m.seats||m.cargo*3)), maxRange=Math.max(...all.map(m=>m.range));
  return `<div class="row wrap"><span>Livraison à</span><select data-in="buyHub">${S.hubs.map(h=>`<option value="${h}" ${h===hub?'selected':''}>${AP(h).city} (${h})</option>`).join('')}</select>
    <select data-in="catSort"><option value="price" ${UI.catSort==='price'?'selected':''}>Trier : prix</option><option value="seats" ${UI.catSort==='seats'?'selected':''}>Trier : capacité</option><option value="range" ${UI.catSort==='range'?'selected':''}>Trier : autonomie</option></select>
    <label class="tog"><input type="checkbox" data-in="catRdc" ${UI.catRdc?'checked':''}> Pistes courtes (classe ≤ 2)</label>
    <span>Quantité</span><select data-in="qty">${[1,2,3,4,5,6,8,10].map(n=>`<option ${n===(UI.qty||1)?'selected':''}>${n}</option>`).join('')}</select>${(UI.qty||1)>1?`<span class="badge ok">Remise volume ${Math.round(volumeDiscount(UI.qty)*100)} %</span>`:''}</div>
  <div class="chips">${fams.map(f=>`<button class="chip ${UI.catFam===f?'on':''}" data-act="catFam" data-f="${f}">${f==='all'?'Tous':f}</button>`).join('')}</div>
  <div class="catalog">${list.map(m=>{ const q=qualifiedPilots(m.fam), cat=planeCat(m), c=m.color||S.company.color;
    return `<div class="card cat">
      ${photoHtml(m,'cat-img')}
      <div class="cat-name"><b>${m.name}</b><span class="mut small">${m.maker} · ${m.fam}</span></div>
      <div class="spec"><span>${isCargo(m)?'📦 Fret':'💺 Sièges'}</span>${bar((m.seats||m.cargo*3)/maxSeats)}<b>${isCargo(m)?m.cargo+' t':m.seats}</b></div>
      <div class="spec"><span>📏 Autonomie</span>${bar(m.range/maxRange)}<b>${num(m.range)} km</b></div>
      <div class="spec"><span>⚡ Vitesse</span>${bar(m.speed/2200)}<b>${m.speed} km/h</b></div>
      <div class="spec"><span>⛽ Conso</span>${bar(m.burn/26000,'warn')}<b>${num(m.burn)} L/h</b></div>
      <div class="small mut">📐 ${acSpec(m).span} m d’envergure · ${acSpec(m).len} m de long · décollage ${num(acSpec(m).tod)} m (masse max.)</div>
      <div class="small ${q<2?'warnt':'mut'}">${q} pilote(s) qualifié(s) ${m.fam}</div>
      <div class="btns sm">
        <button class="btn sm gold" data-act="order" data-m="${m.id}" title="Acompte 20 %, solde à la livraison">Commander${UI.qty>1?' ×'+UI.qty:''} ${fmtMoney(m.price*1e6*(1-volumeDiscount(UI.qty||1))*(UI.qty||1))} · ${leadDays(m)} j</button>
        <button class="btn sm" data-act="orderExpress" data-m="${m.id}">Immédiat +12 %</button>
        ${m.custom?'':`<button class="btn sm" data-act="buy" data-m="${m.id}" data-mode="used">Occasion ${fmtMoney(m.price*1e6*0.55)}</button>`}
        <button class="btn sm" data-act="buy" data-m="${m.id}" data-mode="lease">Leasing ${fmtMoney(m.price*1e6*0.0085)}/mois</button>
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

/* ---------- 👥 PERSONNEL ---------- */
function pStaff(){
  const need=staffNeed(), st=S.staff, strike=(st.strikeUntil||0)>S.time, A=S.auto||{};
  const icon={pil:'👨‍✈️',pnc:'💁',meca:'🔧',sol:'🧳'};
  const card=k=>{ const [name,base]=STAFF_CATS[k], n=staffCount(k), mo=st.morale[k];
    return `<div class="card staff"><div class="row"><b class="grow">${icon[k]} ${name}</b><span class="${n<need[k]?'neg':'pos'}"><b>${num(n)}</b> / ${num(need[k])} requis</span></div>
      <div class="cond">Moral ${bar(mo/100, mo<30?'bad':mo<50?'warn':'')} <b>${Math.round(mo)} %</b></div>
      <label class="tog"><input type="checkbox" data-in="autoK" data-k="${k}" ${A[k]?'checked':''}> <b>Recrutement automatique</b> <span class="mut small">(maintient l’effectif nécessaire)</span></label>
      <label class="small">Salaire : <b>${st.sal[k]} %</b> du marché ${k==='pil'?'':`(${fmtMoney(base*st.sal[k]/100)}/mois)`}<input type="range" min="70" max="160" step="5" value="${st.sal[k]}" data-in="sal" data-k="${k}"></label>
      <div class="hirerow"><input type="number" min="1" max="100000" value="${UI.hn&&UI.hn[k]||(k==='pil'?10:20)}" id="hn-${k}" data-in="hn" data-k="${k}" inputmode="numeric">
        ${k==='pil'?`<select id="hf">${Object.keys(FAMILIES).map(f=>`<option value="${f}" ${f===(UI.hfam||'A320')?'selected':''}>${f}</option>`).join('')}</select>`:''}
        <button class="btn sm gold" data-act="hireBulk" data-k="${k}">➕ Recruter</button>
        ${k==='pil'?'':`<button class="btn sm" data-act="hireStaff" data-k="${k}" data-fill="1">Combler le manque</button><button class="btn sm danger" data-act="hireStaff" data-k="${k}" data-n="-1">−1</button>`}</div>
      <div class="small mut">Coût d’embauche : ≈ ${k==='pil'?'1 mois de salaire par pilote':fmtMoney(base*0.6)+' par personne'} · aucune limite.</div></div>`; };
  const fams=Object.keys(FAMILIES), MAXP=30;
  return `${strike?`<div class="al bad">✊ <b>Grève en cours</b> jusqu’au ${fmtDate(st.strikeUntil)} : aucun départ depuis vos hubs.</div>`:''}
  <div class="card">Masse salariale : <b>${fmtMoney(monthlyPayroll())}</b>/mois · Recrutez autant de monde que vous voulez, en un clic. Un moral sous 28 % peut déclencher une grève ; le sous-effectif cloue les avions au sol.</div>
  <div class="staffgrid">${['pil','pnc','meca','sol'].map(card).join('')}</div>
  <h3>Qualifications des pilotes</h3>
  <table class="tbl"><tr><th>Famille</th><th>Qualifiés</th><th>Requis</th><th>En formation</th></tr>
  ${fams.map(f=>{ const q=qualifiedPilots(f), nd=2*S.fleet.filter(a=>modelOf(a).fam===f).length, tr=S.pilots.filter(p=>p.training&&p.training.fam===f).length;
    if(!q&&!nd&&!tr) return ''; return `<tr><td>${f}</td><td>${num(q)}</td><td class="${q<nd?'neg':''}">${nd}</td><td>${tr?tr+' ⏳':'—'}</td></tr>`;}).join('')}</table>
  <h3>Pilotes (${num(S.pilots.length)})</h3>
  ${S.pilots.slice(0,MAXP).map(p=>`<div class="card pilot"><div class="grow"><b>${esc(p.name)}</b> ${COUNTRIES[p.nat]?COUNTRIES[p.nat][2]:'🌍'} <span class="mut small">${num(p.hours)} h · ${fmtMoney(p.salary)}/mois</span><br>
    ${p.quals.map(q=>`<span class="chip">${q}</span>`).join('')}
    ${p.training?`<div class="small">⏳ Formation ${p.training.fam} — fin le ${fmtDate(p.training.until)} ${bar((S.time-p.training.start)/(p.training.until-p.training.start))}</div>`:''}</div>
    <div class="btns sm col"><button class="btn sm" data-act="train" data-id="${p.id}" ${p.training?'disabled':''}>🎓 Former</button><button class="btn sm danger" data-act="fire" data-id="${p.id}">Licencier</button></div></div>`).join('')}
  ${S.pilots.length>MAXP?`<div class="small mut">… et ${num(S.pilots.length-MAXP)} autres pilotes (affichage limité aux ${MAXP} premiers).</div>`:''}
  <h3>Candidats pilotes (renouvelés chaque semaine)</h3>
  ${S.candidates.map(p=>`<div class="card pilot"><div class="grow"><b>${esc(p.name)}</b> ${COUNTRIES[p.nat]?COUNTRIES[p.nat][2]:'🌍'} <span class="mut small">${num(p.hours)} h · ${fmtMoney(p.salary)}/mois</span><br>${p.quals.map(q=>`<span class="chip">${q}</span>`).join('')}</div>
    <button class="btn sm gold" data-act="hire" data-id="${p.id}">Recruter</button></div>`).join('')}`;
}

/* ---------- ⛽ CARBURANT & CO₂ ---------- */
function pFuel(){
  const F=S.fuel, C=S.co2, p=fuelPrice();
  const avg=F.hist.length? F.hist.reduce((s,x)=>s+x.p,0)/F.hist.length : p;
  const cavg=C.hist.length? C.hist.reduce((s,x)=>s+x.p,0)/C.hist.length : C.price;
  const verdict=(cur,av)=> cur<av*0.97?'<span class="badge ok">Bon moment pour acheter</span>': cur>av*1.03?'<span class="badge bad">Prix élevé</span>':'<span class="badge">Prix moyen</span>';
  const weekNeed=S.fleet.reduce((s,ac)=>s+planHours(ac)*0.45*modelOf(ac).burn,0);
  return `<div class="card fuelcard">
    <div class="row"><div class="grow"><div class="kl">Kérosène Jet A1</div><div class="kv">$${p.toFixed(3)}<small>/L</small></div><div class="small mut">Moyenne 30 j : $${avg.toFixed(3)} · baril $${S.oil.toFixed(1)}</div></div>${verdict(p,avg)}</div>
    <canvas id="fuelChart" height="120"></canvas>
    <div class="cond">Stock ${bar(F.stock/F.cap, F.stock<F.cap*0.1?'bad':'')} <b>${num(F.stock)} / ${num(F.cap)} L</b></div>
    <div class="small mut">Consommation estimée : ${num(weekNeed)} L/semaine${weekNeed?` · autonomie du stock ≈ ${(F.stock/weekNeed*7).toFixed(1)} jours`:''}. Sans stock, le carburant est acheté au comptant +20 %.</div>
    <div class="btns sm">${[0.1,0.25,0.5,1].map(f=>{ const L2=Math.max(0,Math.min(F.cap-F.stock,F.cap*f)); return `<button class="btn sm ${f===1?'gold':''}" data-act="buyFuel" data-l="${L2}" ${L2<1?'disabled':''}>${f===1?'Remplir':'+'+f*100+' %'} · ${fmtMoney(L2*p)}</button>`; }).join('')}</div>
    <label class="tog"><input type="checkbox" data-in="fuelAuto" ${F.auto?'checked':''}> Achat automatique quand le prix passe sous <b>$${F.autoBelow.toFixed(2)}</b>/L</label>
    <input type="range" min="0.4" max="1.2" step="0.01" value="${F.autoBelow}" data-in="fuelBelow">
    <div class="btns sm"><button class="btn sm" data-act="tank">🛢️ Agrandir le réservoir (+1 M L) · ${fmtMoney(tankUpgradeCost())}</button></div>
  </div>
  <div class="card fuelcard">
    <div class="row"><div class="grow"><div class="kl">Quotas CO₂ (compensation CORSIA)</div><div class="kv">$${C.price.toFixed(1)}<small>/t</small></div><div class="small mut">Moyenne 30 j : $${cavg.toFixed(1)}</div></div>${verdict(C.price,cavg)}</div>
    <canvas id="co2Chart" height="100"></canvas>
    <div class="cond">Stock ${bar(C.stock/C.cap)} <b>${num(C.stock)} / ${num(C.cap)} t</b></div>
    <div class="small mut">Chaque vol consomme des quotas ; sans stock ils sont achetés +30 %.</div>
    <div class="btns sm">${[0.25,0.5,1].map(f=>{ const t=Math.max(0,Math.min(C.cap-C.stock,C.cap*f)); return `<button class="btn sm ${f===1?'gold':''}" data-act="buyCO2" data-t="${t}" ${t<1?'disabled':''}>${f===1?'Remplir':'+'+f*100+' %'} · ${fmtMoney(t*C.price)}</button>`; }).join('')}</div>
  </div>
  <div class="card small">⛽ Dans les petits aéroports isolés (et à l’intérieur de la RDC), le kérosène doit être acheminé : il coûte plus cher sur place. Construisez un dépôt de carburant depuis la fiche de l’aéroport.</div>`;
}
function drawPriceChart(id, hist, color, fmt){
  const cv=document.getElementById(id); if(!cv) return;
  const w=cv.clientWidth||340, h=cv.height, dpr=window.devicePixelRatio||1;
  cv.width=w*dpr; cv.height=h*dpr; cv.style.height=h+'px'; const g=cv.getContext('2d'); g.scale(dpr,dpr);
  if(hist.length<2){ g.fillStyle='#8fa0b8'; g.font='12px system-ui'; g.fillText('Historique disponible après quelques heures de jeu',8,h/2); return; }
  const vals=hist.map(x=>x.p), lo=Math.min(...vals), hi=Math.max(...vals)||1, span=(hi-lo)||hi*0.05;
  const X=i=>4+i/(hist.length-1)*(w-50), Y=v=>h-14-(v-lo)/span*(h-28);
  g.strokeStyle='rgba(255,255,255,.08)'; g.fillStyle='#8fa0b8'; g.font='10px system-ui';
  for(const v of [lo,hi]){ g.beginPath(); g.moveTo(4,Y(v)); g.lineTo(w-46,Y(v)); g.stroke(); g.fillText(fmt(v),w-44,Y(v)+3); }
  const grd=g.createLinearGradient(0,0,0,h); grd.addColorStop(0,color+'55'); grd.addColorStop(1,color+'00');
  g.beginPath(); hist.forEach((p,i)=>i?g.lineTo(X(i),Y(p.p)):g.moveTo(X(i),Y(p.p))); g.lineTo(X(hist.length-1),h-14); g.lineTo(X(0),h-14); g.closePath(); g.fillStyle=grd; g.fill();
  g.strokeStyle=color; g.lineWidth=2; g.beginPath(); hist.forEach((p,i)=>i?g.lineTo(X(i),Y(p.p)):g.moveTo(X(i),Y(p.p))); g.stroke();
  const l=hist[hist.length-1]; g.fillStyle=color; g.beginPath(); g.arc(X(hist.length-1),Y(l.p),3.5,0,7); g.fill();
}

/* ---------- 💰 FINANCES ---------- */
function pFinance(){
  const cats=Object.keys(LED_CATS);
  const cols=[['week','Semaine'],['prevWeek','Sem. préc.'],['month','Ce mois'],['total','Total']];
  const col=(l,k)=>{ const v=(l||{})[k]||0; return `<td class="${v<0?'neg':v>0?'pos':'mut'}">${v?fmtMoney(v):'—'}</td>`; };
  const tot=l=>{ const v=ledSum(l||{},1)+ledSum(l||{},-1); return `<td class="${v<0?'neg':'pos'}"><b>${fmtMoney(v)}</b></td>`; };
  return `<div class="kpis three">
    <div class="kpi"><div class="kl">Capital</div><div class="kv ${S.cash<0?'neg':''}">${fmtMoney(S.cash)}</div></div>
    <div class="kpi"><div class="kl">Valeur nette</div><div class="kv">${fmtMoney(netWorth())}</div></div>
    <div class="kpi"><div class="kl">Dette</div><div class="kv">${fmtMoney(debt())}</div></div></div>
  <h3>Résultats hebdomadaires</h3><canvas id="weeksChart" height="170"></canvas>
  <h3>Historique (capital & valeur nette)</h3><canvas id="chart" height="170"></canvas>
  <h3>Compte de résultat</h3>
  <div class="tblwrap"><table class="tbl pl"><tr><th></th>${cols.map(c=>`<th>${c[1]}</th>`).join('')}</tr>
  ${cats.filter(k=>cols.some(([c])=>(S.led[c]||{})[k])).map(k=>`<tr><td>${LED_CATS[k][0]}</td>${cols.map(([c])=>col(S.led[c],k)).join('')}</tr>`).join('')}
  <tr class="sum"><td>Résultat d’exploitation</td>${cols.map(([c])=>tot(S.led[c])).join('')}</tr></table></div>
  <div class="mut small">Hors investissements (avions, hubs, licences, chantiers) et remboursement du capital emprunté.</div>
  <h3>Banque</h3>
  ${LOAN_PRODUCTS.map(p=>{ const r=p.rate/12, mo=p.amount*r/(1-Math.pow(1+r,-p.months)); return `<div class="card row"><div class="grow"><b>${p.name}</b> — ${fmtMoney(p.amount)} · ${p.months} mois · ${(p.rate*100).toFixed(1)} %<br><span class="mut small">Mensualité ${fmtMoney(mo)}${p.minNet?` · valeur nette mini ${fmtMoney(p.minNet)}`:''}</span></div><button class="btn sm gold" data-act="loan" data-id="${p.id}">Emprunter</button></div>`;}).join('')}
  ${S.loans.length?`<h3>Prêts en cours</h3>${S.loans.map(l=>`<div class="card row"><div class="grow"><b>${l.name}</b> · reste ${fmtMoney(l.remaining)} · ${l.monthsLeft} mois · ${fmtMoney(l.monthly)}/mois</div><button class="btn sm" data-act="repay" data-id="${l.id}">Rembourser</button></div>`).join('')}`:''}`;
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

/* ---------- 📣 COMPAGNIE ---------- */
function pCompany(){
  const c=S.company, a=S.ancillary;
  return `<h3>Identité visuelle</h3>
  <div class="form">
    <label>Nom<input data-in="co.name" value="${esc(c.name)}"></label>
    <label>Code IATA<input data-in="co.code" maxlength="3" value="${esc(c.code)}"></label>
    <label>Livrée (couleur)<input type="color" data-in="co.color" value="${c.color}"></label>
    <label>Logo<input data-in="co.logo" maxlength="3" value="${esc(c.logo)}"></label>
  </div>
  <div class="card row"><div class="biglogo" style="background:${c.color}">${esc(c.logo)}</div><div>${PLANE_SVG(c.color,64,'wb')}</div><div><b>${esc(c.name)}</b><br><span class="mut">Hub principal ${apName(c.hub)}</span></div></div>
  <h3>Niveau de service à bord</h3>
  <div class="chips">${[1,2,3,4,5].map(n=>`<button class="chip ${S.service===n?'on':''}" data-act="service" data-n="${n}">${'★'.repeat(n)}</button>`).join('')}</div>
  <div class="mut small">Coût ${fmtMoney(SERVICE_COST[S.service-1])}/passager/heure · attractivité ×${SERVICE_ATTR[S.service-1]} (Affaires & Première encore plus sensibles). À partir de 4★, les repas sont inclus.</div>
  <h3>Revenus annexes</h3>
  ${[['seat','Choix du siège','$6, 30 % des passagers'],['bags','Bagage en soute','$25, 35 % des passagers'],['wifi','Wi-Fi à bord','$9, vols > 1h30'],['meals','Repas payants','$11, désactivé si service ≥ 4★']].map(([k,l,d])=>`<label class="tog"><input type="checkbox" data-in="anc" data-k="${k}" ${a[k]?'checked':''}> <b>${l}</b> <span class="mut small">${d}</span></label>`).join('')}
  <div class="mut small">Chaque option réduit légèrement l’attractivité (×${ancillaryPenalty().toFixed(3)}).</div>
  <h3>Campagnes marketing</h3>
  ${CAMPAIGNS.map(cp=>{ const on=S.campaigns.find(x=>x.id===cp.id); return `<div class="card row"><div class="grow"><b>${cp.name}</b> — ${fmtMoney(cp.cost)} · ${cp.days} j · demande +${cp.boost*100} % (${cp.scope==='home'||cp.scope==='drc'?COUNTRIES[homeCC()][0]:cp.scope==='intl'?'international':'tout le réseau'}) · image +${cp.rep}<br><span class="mut small">${cp.desc}</span></div>${on?`<span class="badge ok">Active → ${fmtDate(on.until)}</span>`:`<button class="btn sm gold" data-act="campaign" data-id="${cp.id}">Lancer</button>`}</div>`;}).join('')}
  <h3>Alliances</h3>
  ${ALLIANCES.map(al=>{ const ok=S.reputation>=al.minRep&&S.fleet.length>=al.minFleet; const mine=S.alliance===al.id; return `<div class="card row ${mine?'gold-b':''}"><div class="grow"><b>${al.name}</b> — ${fmtMoney(al.fee)}/mois · demande +${al.boost*100} % (${al.scope==='africa'||al.scope==='region'?'international, '+(CONTINENTS[COUNTRIES[homeCC()][1]]||''):'international'})<br><span class="mut small">${al.desc} · requis : image ${al.minRep}, flotte ${al.minFleet}</span></div>${mine?`<button class="btn sm danger" data-act="leaveAlliance">Quitter</button>`:`<button class="btn sm ${ok?'gold':''}" data-act="joinAlliance" data-id="${al.id}" ${ok&&!S.alliance?'':'disabled'}>Adhérer</button>`}</div>`;}).join('')}
  <h3>Partages de codes</h3>
  <div class="mut small">Accord avec une grande compagnie : +15 % de demande sur vos lignes vers son hub, et elle cesse de vous concurrencer agressivement (maximum 3 accords).</div>
  ${(S.rivals||[]).filter(R=>!R.local).map(R=>{ const on=isPartner(R); return `<div class="card row ${on?'gold-b':''}"><div class="grow"><span class="dot" style="background:${R.color}"></span><b>${R.name}</b> — hub ${flag(R.hub)} ${AP(R.hub).city} · ${R.fleet} avions<br><span class="small mut">${fmtMoney(codeshareFee(R))}/mois · requis : image 45, 4 avions</span></div>${on?`<button class="btn sm danger" data-act="csCancel" data-c="${R.code}">Rompre</button>`:`<button class="btn sm gold" data-act="csSign" data-c="${R.code}">Signer</button>`}</div>`; }).join('')}
  <h3>Contrats cargo</h3>${cargoHtml()}
  <h3>Paramètres</h3>
  <div class="card">
    <div>Vitesse du temps :</div><div class="chips">${Object.entries(SPEEDS).map(([k,v])=>`<button class="chip ${S.speed===k?'on':''}" data-speed="${k}">${v.label} (×${v.mult})</button>`).join('')}</div>
    <div class="mut small">Réaliste = temps réel. Standard : 1 s = 1 min. Rapide : 1 s = 10 min. Le jeu continue quand la page est fermée (jusqu’à 30 jours rattrapés).</div>
    <label class="tog"><input type="checkbox" data-in="notif" ${S.notifications?'checked':''}> Notifications du navigateur</label>
    <div class="btns sm"><button class="btn sm" data-act="guideReset">🎓 Revoir le tutoriel</button><button class="btn sm" data-act="export">⬇ Exporter</button><button class="btn sm" data-act="import">⬆ Importer</button><button class="btn sm danger" data-act="reset">Nouvelle partie</button></div>
  </div>`;
}
function cargoHtml(){
  const cargoAc=S.fleet.filter(a=>isCargo(modelOf(a)));
  return `${S.cargo.active.map(c=>`<div class="card row"><div class="grow">🚚 <b>${c.goods}</b> ${c.tons} t · ${apName(c.from)} → ${apName(c.to)}<br><span class="mut small">Échéance ${fmtDate(c.deadline)} · ${fmtMoney(c.reward)}</span></div><span class="badge fly">En cours</span></div>`).join('')}
  ${S.cargo.offers.map(o=>`<div class="card"><div>📦 <b>${o.goods}</b> — ${o.tons} t · ${flag(o.from)} ${apName(o.from)} → ${flag(o.to)} ${apName(o.to)} (${num(dist(o.from,o.to))} km)</div>
    <div class="mut small">Prime ${fmtMoney(o.reward)} · avant le ${fmtDate(o.deadline)} · offre valable jusqu’au ${fmtDate(o.expires)}${o.rep?' · +image':''}</div>
    ${cargoAc.length?`<select data-in="cargoAssign" data-id="${o.id}"><option value="">Affecter un avion cargo…</option>${cargoAc.map(a=>{const m=modelOf(a); const bad=m.cargo<o.tons||a.plan?.length||a.status!=='idle'; return `<option value="${a.id}" ${bad?'disabled':''}>${a.reg} ${m.name} (${m.cargo} t) @${a.loc}${a.plan?.length?' — planning occupé':''}</option>`;}).join('')}</select>`:'<div class="mut small">Achetez un avion cargo (ATR 72F, 737-800BCF, 777F…) pour accepter des contrats.</div>'}</div>`).join('')||'<div class="mut">Pas d’offre pour le moment.</div>'}
  <div class="mut small">Contrats livrés : ${S.cargo.done} · fret total : ${num(S.stats.cargoT)} t</div>`;
}

/* ---------- 🌐 MONDE & PAYS ---------- */
const _cache={};
function countryAirports(cc){ return _cache['ca'+cc]||(_cache['ca'+cc]=AIRPORT_CODES.filter(c=>AP(c).cc===cc).sort((x,y)=>AP(y).traffic-AP(x).traffic)); }
function pWorld(){
  const cc=UI.country||homeCC(), C=COUNTRIES[cc], aps=countryAirports(cc);
  const served=servedAirports(), dom=S.routes.filter(r=>r.stops.every(c=>AP(c).cc===cc));
  const top=aps.slice(0,22), pairs=[];
  for(let i=0;i<top.length;i++) for(let j=i+1;j<top.length;j++){ const a=top[i],b=top[j],d=dist(a,b); if(d<180) continue; pairs.push({a,b,d,dem:marketDemand(a,b)}); }
  pairs.sort((x,y)=>y.dem-x.dem);
  let domMarket=0; for(const p of pairs) domMarket+=2*p.dem;
  let domMine=0; for(const r of dom){ if(!routeAircraft(r).length) continue; for(let i=0;i<r.stops.length-1;i++){ domMine+=legMarket(r,r.stops[i],r.stops[i+1]).daily+legMarket(r,r.stops[i+1],r.stops[i]).daily; } }
  const regions={}; for(const c of aps){ const a=AP(c), k=a.prov||(a.region||'').replace(cc+'-','')||'—'; (regions[k]=regions[k]||[]).push(c); }
  const rivalsHere=(S.rivals||[]).filter(R=>AP(R.hub).cc===cc), realHere=typeof airlinesOfCountry==='function'? airlinesOfCountry(cc,1) : [];
  const evs=S.events.filter(e=>{ const t=EV(e); return (e.airports||[]).some(c=>AP(c).cc===cc) || (e.airport&&AP(e.airport).cc===cc) || (e.boostAirport&&AP(e.boostAirport).cc===cc) || ((e.ccs||t.ccs||[]).includes(cc)) || (t.drc&&cc==='CD'); });
  const intl = cc!==homeCC()? S.hubs.flatMap(h=>aps.slice(0,15).map(c=>({h,c,d:dist(h,c),dem:marketDemand(h,c)}))).filter(x=>x.h!==x.c).sort((x,y)=>y.dem-x.dem).slice(0,10) : [];
  const suggest=(p)=>{ const minCls=Math.min(AP(p.a).cls,AP(p.b).cls); const ok=MODELS.filter(m=>!isCargo(m)&&m.cls<=minCls&&m.range>=p.d).sort((x,y)=>Math.abs(x.seats-p.dem*0.3)-Math.abs(y.seats-p.dem*0.3)); return ok[0]?ok[0].name:'—'; };
  const quick=[...new Set([homeCC(), ...S.hubs.map(h=>AP(h).cc), ...(S.rivals||[]).map(R=>AP(R.hub).cc)])];
  const conts={}; for(const c of AIRPORT_CODES){ const k=continentOf(c); (conts[k]=conts[k]||{n:0,mine:0}); conts[k].n++; if(served.has(c)) conts[k].mine++; }
  const worldTop=AIRPORT_CODES.slice().sort((x,y)=>AP(y).traffic-AP(x).traffic).slice(0,12);
  return `<div class="card country-hero"><div class="cflag">${C[2]}</div><div class="grow"><h2>${C[0]}</h2><div class="small mut">${CONTINENTS[C[1]]||''} · ${aps.length} aéroport(s) avec vols réguliers${cc===homeCC()?' · <b>votre pays</b>':''}</div>
    <div class="btns sm"><button class="btn sm gold" data-act="focusCountry" data-cc="${cc}">🔍 Voir sur la carte</button></div></div></div>
  <div class="row wrap"><select data-in="country">${Object.keys(COUNTRIES).filter(k=>countryAirports(k).length).sort((x,y)=>COUNTRIES[x][0].localeCompare(COUNTRIES[y][0])).map(k=>`<option value="${k}" ${k===cc?'selected':''}>${COUNTRIES[k][2]} ${COUNTRIES[k][0]} (${countryAirports(k).length})</option>`).join('')}</select></div>
  <div class="chips">${quick.map(k=>`<button class="chip ${k===cc?'on':''}" data-act="country" data-cc="${k}">${COUNTRIES[k][2]} ${COUNTRIES[k][0]}</button>`).join('')}</div>
  <div class="kpis">
    <div class="kpi"><div class="kl">Aéroports</div><div class="kv">${aps.length}</div></div>
    <div class="kpi"><div class="kl">Que vous desservez</div><div class="kv">${aps.filter(c=>served.has(c)).length}</div></div>
    <div class="kpi"><div class="kl">Vos lignes intérieures</div><div class="kv">${dom.length}</div></div>
    <div class="kpi"><div class="kl">Marché intérieur</div><div class="kv">${num(domMarket)} pax/j</div></div>
    <div class="kpi"><div class="kl">Votre part intérieure</div><div class="kv">${domMarket?(Math.min(1,domMine/domMarket)*100).toFixed(1):'0'} %</div></div>
    <div class="kpi"><div class="kl">Kérosène</div><div class="kv">$${fuelPrice(aps[0]).toFixed(2)}/L</div></div>
  </div>
  ${evs.length?`<h3>Actualité du pays</h3>${evs.map(e=>{const t=EV(e);return `<div class="ev">${t.icon} <b>${t.name}</b>${e.where||''} — ${t.desc} <span class="mut">(jusqu’au ${fmtDate(e.until)})</span></div>`;}).join('')}`:''}
  <h3>Compagnies aériennes du pays</h3>${realHere.length? realHere.slice(0,12).map(c=>{ const A=AIRLINE_DB[c]; return `<div class="card small"><span class="dot" style="background:${airlineColor(c)}"></span><b>${A[0]}</b> <span class="mut">${c}</span> — base ${apName(A[2])} · ${A[3]} ligne(s) régulière(s)${rivalsHere.some(R=>R.code===c)?' · <span class="badge">concurrent suivi</span>':''}</div>`; }).join('') : `<div class="al">Aucune compagnie aérienne n’est basée dans ce pays : il est desservi uniquement par des compagnies étrangères${cc===homeCC()?' — vous serez la compagnie nationale !':''}.</div>`}
  ${rivalsHere.length&&false?`<h3>Concurrents basés ici</h3>${rivalsHere.map(R=>`<div class="card small"><span class="dot" style="background:${R.color}"></span><b>${R.name}</b> — hub ${apName(R.hub)} · ${R.fleet} avions · ${R.routes.length} lignes · ${stars(R.rep)}</div>`).join('')}`:''}
  ${intl.length?`<h3>Meilleures lignes depuis vos hubs vers ce pays</h3><table class="tbl"><tr><th>Ligne</th><th>km</th><th>Demande/j</th><th></th></tr>${intl.map(x=>`<tr><td>${x.h} → ${AP(x.c).city}</td><td>${num(x.d)}</td><td>${num(x.dem)}</td><td><button class="btn sm" data-act="draftPair" data-a="${x.h}" data-b="${x.c}">Ouvrir</button></td></tr>`).join('')}</table>`:''}
  <h3>Lignes intérieures les plus demandées</h3>
  ${pairs.length?`<table class="tbl"><tr><th>Ligne</th><th>km</th><th>Demande/j</th><th>Avion conseillé</th><th></th></tr>
  ${pairs.slice(0,12).map(p=>`<tr><td>${AP(p.a).city} – ${AP(p.b).city}</td><td>${num(p.d)}</td><td>${num(p.dem)}</td><td class="small">${suggest(p)}</td><td>${S.hubs.includes(p.a)||S.hubs.includes(p.b)?`<button class="btn sm" data-act="draftPair" data-a="${S.hubs.includes(p.a)?p.a:p.b}" data-b="${S.hubs.includes(p.a)?p.b:p.a}">Ouvrir</button>`:`<button class="btn sm" data-act="openAp" data-c="${p.a}">Hub ?</button>`}</td></tr>`).join('')}</table>`:'<div class="mut small">Pas de ligne intérieure significative.</div>'}
  <h3>Aéroports par région</h3>
  ${Object.entries(regions).sort((x,y)=>AP(y[1][0]).traffic-AP(x[1][0]).traffic).slice(0,40).map(([k,list])=>`<details class="prov"><summary><b>${esc(k)}</b> <span class="mut">${list.length} aéroport(s) · ${list.slice(0,3).map(c=>AP(c).city).join(', ')}</span></summary>
    ${list.map(c=>{const a=AP(c); return `<div class="aprow"><span><b>${c}</b> ${a.icao||''} — ${esc(a.city)}${S.hubs.includes(c)?' 🏢':''}${served.has(c)?' ✈':''}</span><span class="small">${num(a.runway)} m · ${a.surface} · cl.${a.cls} · ${a.traffic>=1?a.traffic+' M':Math.round(a.traffic*1000)+' k'} pax${a.fuelDepot?' ⛽':''}${a.terminal?' 🏢':''}${a.ils?' 💡':''}${airportClosed(c)?' · <b class="neg">fermé</b>':''}</span><span><button class="btn sm" data-act="openAp" data-c="${c}">Voir</button></span></div>`;}).join('')}</details>`).join('')}
  <h3>Vos chantiers aéroportuaires</h3>
  ${(S.projects||[]).map(p=>`<div class="card row"><div class="grow">${UPGRADES[p.type].icon} <b>${UPGRADES[p.type].name}</b> — ${AP(p.code).city}<br>${bar((S.time-p.start)/(p.until-p.start))}<span class="small mut">Fin le ${fmtDate(p.until)}</span></div></div>`).join('')||'<div class="mut small">Aucun chantier. Ouvrez un aéroport pour construire un terminal, un dépôt de carburant, un ILS ou allonger la piste.</div>'}
  <h3>Le monde</h3>
  <table class="tbl"><tr><th>Continent</th><th>Aéroports</th><th>Desservis</th></tr>${Object.entries(conts).filter(([k])=>k!=='AN').map(([k,v])=>`<tr><td>${CONTINENTS[k]}</td><td>${v.n}</td><td>${v.mine}</td></tr>`).join('')}</table>
  <h3>Les plus grands aéroports du monde</h3>
  <div class="chips">${worldTop.map(c=>`<button class="chip" data-act="openAp" data-c="${c}">${flag(c)} ${AP(c).city} · ${AP(c).traffic} M</button>`).join('')}</div>`;
}
const pDRC = pWorld;

/* ---------- 🛠️ ADMIN ---------- */
function pAdmin(){
  return `<div class="card warnb">Mode bac à sable : ces actions trichent. Les sommes apparaissent dans « Primes & bac à sable ».</div>
  <h3>Trésorerie</h3><div class="btns sm">${[1e6,10e6,100e6,1e9].map(v=>`<button class="btn sm" data-act="adCash" data-v="${v}">+${fmtMoney(v)}</button>`).join('')}<button class="btn sm danger" data-act="adCash" data-v="-10000000">−$10 M</button></div>
  <h3>Temps</h3><div class="btns sm"><button class="btn sm" data-act="adTime" data-v="1">+1 heure</button><button class="btn sm" data-act="adTime" data-v="24">+1 jour</button><button class="btn sm" data-act="adTime" data-v="168">+7 jours</button><button class="btn sm" data-act="adTime" data-v="720">+30 jours</button></div>
  <h3>Économie</h3>
  <label>Pétrole : $${S.oil.toFixed(0)}<input type="range" min="30" max="180" value="${S.oilBase}" data-in="adOil"></label>
  <label>Image : ${Math.round(S.reputation)}<input type="range" min="0" max="100" value="${Math.round(S.reputation)}" data-in="adRep"></label>
  <h3>Déclencher un événement</h3><div class="chips">${EVENT_TYPES.map(e=>`<button class="chip" data-act="adEvent" data-id="${e.id}">${e.icon} ${e.name}</button>`).join('')}</div>
  <div class="btns sm"><button class="btn sm" data-act="adClearEv">Terminer tous les événements</button></div>
  <h3>Flotte & personnel</h3><div class="btns sm"><button class="btn sm" data-act="adQual">Qualifier tous les pilotes</button><button class="btn sm" data-act="adFix">Remettre la flotte à neuf</button><button class="btn sm" data-act="adCrew">Personnel au complet</button><button class="btn sm" data-act="adFuel">Remplir le réservoir</button><button class="btn sm" data-act="adCargo">Nouvelles offres cargo</button></div>
  <h3>Rival</h3><div class="btns sm"><button class="btn sm" data-act="adRival" data-v="1">StarWing +$100 M</button><button class="btn sm" data-act="adRival" data-v="-1">StarWing en difficulté</button></div>`;
}

/* ---------- aéroport ---------- */
function boardHtml(code){
  const dep=[], arr=[];
  for(const ac of S.fleet){
    if(!ac.flight) continue; const m=modelOf(ac);
    ac.flight.legs.forEach((l,i)=>{
      if(i<ac.flight.li) return;
      const prof=legProfile(l.dist,m,l.wind,l.from,l.to), tOff=l.dep+prof.segs[1].t0, tOn=l.dep+prof.segs[8].t0;
      const st=i===ac.flight.li? flightState(ac):null;
      const fn=S.company.code+flightNumber(ac);
      if(l.from===code) dep.push({t:tOff, fn, other:l.to, ac, status: st? (st.phase<=1?(st.phase===0?'Embarquement':'Roulage'):'Parti') : 'Prévu'});
      if(l.to===code) arr.push({t:tOn, fn, other:l.from, ac, status: st? (st.phase>=7?'Atterri':st.phase>=5?'En approche':'En vol') : 'Prévu'});
    });
  }
  if(!dep.length&&!arr.length) return '';
  const row=x=>`<tr><td><b>${fmtTime(x.t)}</b></td><td>${x.fn}</td><td>${AP(x.other).city}</td><td class="mut">${modelOf(x.ac).name}</td><td class="st">${x.status}</td></tr>`;
  return `<div class="board">${dep.length?`<div class="bh">🛫 DÉPARTS</div><table>${dep.sort((a,b)=>a.t-b.t).slice(0,8).map(row).join('')}</table>`:''}
    ${arr.length?`<div class="bh">🛬 ARRIVÉES</div><table>${arr.sort((a,b)=>a.t-b.t).slice(0,8).map(row).join('')}</table>`:''}</div>`;
}
function mapStyleHtml(){
  const hasKey=!!localStorage.getItem(GKEY);
  return `<div class="styles">${Object.entries(MAP_STYLES).map(([id,st])=>`<button class="card stylebtn ${currentStyle===id?'gold-b':''}" data-act="setStyle" data-id="${id}" ${st.google&&!hasKey?'disabled':''}><b>${st.label}</b>${currentStyle===id?' ✓':''}<br><span class="mut small">${st.desc}</span></button>`).join('')}</div>
  <h3>Google Maps officiel</h3>
  <div class="small">Google n’autorise ses cartes dans un jeu qu’avec une <b>clé API personnelle</b> (gratuite jusqu’à un quota mensuel élevé) :</div>
  <ol class="small"><li>Ouvrez <b>console.cloud.google.com</b> et créez un projet.</li><li>Dans « API et services », activez <b>Map Tiles API</b>.</li><li>Dans « Identifiants », créez une <b>clé API</b> et collez-la ci-dessous.</li></ol>
  <label>Clé API Google<input id="gkey" type="password" placeholder="AIza…" value="${esc(localStorage.getItem(GKEY)||'')}"></label>
  <div class="btns"><button class="btn gold" data-act="saveGKey">Activer Google Maps</button></div>
  <div class="mut small">La clé reste uniquement dans ce navigateur. Sans clé, « Satellite + routes & noms » offre la même qualité d’imagerie.</div>`;
}
function airportHtml(code){
  const a=AP(code), c=COUNTRIES[a.cc], isHub=S.hubs.includes(code);
  const here=S.fleet.filter(x=>x.loc===code&&x.status==='idle');
  const projects=(S.projects||[]).filter(p=>p.code===code);
  return `<div class="small">${a.name}${a.icao?' · OACI '+a.icao:''}<br>${a.drc?'Province : <b>'+a.prov+'</b> · ':''}${c[0]} · ${CONTINENTS[c[1]]}</div>
    <div class="grid2 small card"><div>Piste : <b>${a.runway} m</b> (${a.surface})</div><div>Classe : <b>${a.cls}</b>/5</div>
    <div>Trafic : <b>${a.traffic>=1?a.traffic+' M':Math.round(a.traffic*1000)+' k'}</b> pax/an</div><div>Kérosène : $${fuelPrice(code).toFixed(2)}/L</div>
    ${a.fuelDepot||a.terminal||a.ils?`<div>Équipements : ${a.fuelDepot?'⛽ dépôt ':''}${a.terminal?'🏢 terminal ':''}${a.ils?'💡 ILS':''}</div>`:''}</div>
    ${(()=>{ const rws=runwaysOf(code), seen=new Set(), rows=[]; for(const r of rws){ const k=[r.thr.lat.toFixed(4),r.end.lat.toFixed(4)].sort().join(); if(seen.has(k)) continue; seen.add(k); const o=rws.find(x=>x!==r&&x.thr===r.end); rows.push(`<tr><td><b>${r.id}${o?'/'+o.id:''}</b></td><td>${num0(r.len)} m</td><td>${r.wid?Math.round(r.wid)+' m':'—'}</td><td>${r.hard?'Revêtue':'Non revêtue'}</td><td>${Math.round(r.hdg)}°/${Math.round((r.hdg+180)%360)}°</td></tr>`); }
      return rows.length? `<div class="card small"><b>🛬 Pistes réelles</b> · altitude ${num0(a.elev||0)} ft
        <table class="tbl"><tr><th>Piste</th><th>Longueur</th><th>Largeur</th><th>Revêtement</th><th>QFU</th></tr>${rows.join('')}</table>
        <div class="btns"><button class="btn sm gold" data-act="apZoom" data-c="${code}">🔍 Voir l’aéroport et ses pistes</button></div></div>` : ''; })()}
    ${airportClosed(code)?'<div class="al bad">Aéroport actuellement fermé.</div>':''}
    ${isHub?'<div class="al ok">🏢 C’est l’un de vos hubs.</div>':a.cls>=2?`<div class="btns"><button class="btn gold" data-act="buyHub" data-c="${code}">🏢 Acheter ce hub · ${fmtMoney(hubCost(code))}</button></div>`:''}
    <div class="btns">${S.hubs.filter(h=>h!==code).map(h=>`<button class="btn sm" data-act="draftPair" data-a="${h}" data-b="${code}">➕ Ligne ${h} → ${code} · ${num(dist(h,code))} km</button>`).join('')}</div>
    ${here.length?`<div class="small">Vos avions au sol ici : ${here.map(x=>`<button class="btn sm" data-act="pilot" data-id="${x.id}">🕹️ Piloter ${x.reg}</button>`).join(' ')}</div>`:''}
    ${(()=>{ const al=typeof airlinesAt==='function'?airlinesAt(code):[]; if(!al.length) return '<div class="small mut">Aucune ligne régulière connue au départ de cet aéroport.</div>';
      return `<div class="card small"><b>🛫 Compagnies présentes</b> · ${(AP_ROUTES[code]||[]).length} destination(s) directe(s)<div class="chips">${al.slice(0,18).map(([c,n])=>`<span class="chip"><span class="dot" style="background:${airlineColor(c)}"></span>${esc(airlineName(c))} · ${n}</span>`).join('')}${al.length>18?`<span class="chip">+${al.length-18}</span>`:''}</div></div>`; })()}
    ${boardHtml(code)}
    ${true?`<h3>Investir dans l’aéroport${a.drc?' (partenariat RVA)':''}</h3>${projects.map(p=>`<div class="al">${UPGRADES[p.type].icon} ${UPGRADES[p.type].name} — fin le ${fmtDate(p.until)}</div>`).join('')}
      ${Object.entries(UPGRADES).filter(([k,u])=>u.can(a)&&!projects.some(p=>p.type===k)).map(([k,u])=>`<div class="card row"><div class="grow">${u.icon} <b>${u.name}</b> — ${fmtMoney(u.cost(a))} · ${u.days} j<br><span class="small mut">${u.desc}</span></div><button class="btn sm gold" data-act="project" data-c="${code}" data-k="${k}">Lancer</button></div>`).join('')||'<div class="mut small">Aucun chantier disponible ici.</div>'}`:''}`;
}
