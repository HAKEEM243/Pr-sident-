/* =========================================================
   Sky Empire — progression façon jeux mobiles
   • 🎁 Récompense de connexion (calendrier de 7 jours, série)
   • 🎯 3 défis du jour (passagers, vols, recettes, charter…)
   • 🛫 Vols charters à saisir (équipes de foot, pèlerins,
     concerts, délégations…) : aller-retour avec un avion de
     votre hub, grosse prime à la clé.
   ========================================================= */
'use strict';
const realDay=()=>{ const d=new Date(); return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate(); };
const scaleCash=()=>{ const wk=Math.max(0,(typeof ledSum==='function'?ledSum(S.led.week||{},1):0)); return Math.max(250e3, Math.min(25e6, wk*0.06+S.fleet.length*60e3)); };
const LOGIN_REWARDS=[
  {d:1,t:'cash',k:1,  l:'💵'}, {d:2,t:'cash',k:1.5,l:'💵'}, {d:3,t:'rep',v:1,l:'⭐'}, {d:4,t:'cash',k:2.5,l:'💰'},
  {d:5,t:'fuel',v:0.15,l:'⛽'}, {d:6,t:'cash',k:3.5,l:'💰'}, {d:7,t:'plane',l:'✈️'}];
function loginRewardText(r,amt){ return r.t==='cash'?fmtMoney(amt):r.t==='rep'?`Image +${r.v}`:r.t==='fuel'?'Kérosène −15 % (3 jours)':'Avion d’occasion offert'; }

/* ---------- défis du jour ---------- */
const CH_TYPES=[
  {k:'pax',   f:()=>S.stats.pax,     goal:()=>Math.max(300,Math.round(S.fleet.length*450/50)*50), lab:n=>`Transporter ${num(n)} passagers`},
  {k:'flights',f:()=>S.stats.flights, goal:()=>Math.max(5,Math.round(S.fleet.length*2.2)), lab:n=>`Réaliser ${n} vols`},
  {k:'rev',   f:()=>((S.led.total||{}).billets||0)+((S.led.total||{}).cargo||0), goal:()=>Math.round(scaleCash()*6/1e4)*1e4, lab:n=>`Encaisser ${fmtMoney(n)} de recettes`},
  {k:'ontime',f:()=>S.stats.onTime||0, goal:()=>Math.max(4,Math.round(S.fleet.length*1.5)), lab:n=>`${n} vols à l’heure`},
  {k:'charter',f:()=>(S.charters&&S.charters.done)||0, goal:()=>1, lab:()=>`Réaliser un vol charter`},
  {k:'cases', f:()=>(S.inbox||[]).filter(m=>m.kind&&m.kind.startsWith('pax')&&m.st==='done').length, goal:()=>2, lab:n=>`Traiter ${n} cas passagers (📬)`},
  {k:'line',  f:()=>S.routes.length, goal:()=>1, lab:()=>`Ouvrir une nouvelle ligne`},
];
function newDaily(){
  const today=realDay(), D=S.daily||{};
  const pool=CH_TYPES.slice().sort(()=>Math.random()-0.5).slice(0,3);
  return {...D, day:today, claimed:false, chest:false,
    ch:pool.map(t=>{ const g=t.goal(); return {k:t.k, base:t.f(), goal:g, label:t.lab(g), reward:Math.round(scaleCash()*(t.k==='charter'||t.k==='line'?1.4:1)/1e4)*1e4, got:false}; })};
}
function dailyProgress(c){ const t=CH_TYPES.find(x=>x.k===c.k); if(!t) return 0; return Math.max(0,t.f()-c.base); }
function progressTick(){
  if(!S||!S.company) return;
  if(typeof atcMigrate==='function') atcMigrate();
  const today=realDay();
  if(!S.daily||S.daily.day!==today){
    const prev=S.daily&&S.daily.day, yest=(()=>{ const d=new Date(); d.setDate(d.getDate()-1); return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate(); })();
    const streak=prev===yest?((S.daily.streak||0)+1):1;
    S.daily={...newDaily(), streak, loginDay:((S.daily&&S.daily.loginDay)||0)%7+1};
    if(!(typeof UI!=='undefined'&&UI.silent)) setTimeout(()=>{ if(!UI.modal&&!document.body.classList.contains('globe-on')&&!document.body.classList.contains('city-on')&&S.daily&&!S.daily.claimed) openM('daily'); },2500);
  }
  // défis terminés → notification
  for(const c of S.daily.ch) if(!c.done&&dailyProgress(c)>=c.goal){ c.done=true; toast(`🎯 Défi du jour réussi : <b>${esc(c.label)}</b> — récupérez la prime dans 🎁`,'ok'); }
  renderDailyBadge();
}
function renderDailyBadge(){
  const el=document.getElementById('tb-daily'); if(!el||!S||!S.daily) return;
  const n=(S.daily.claimed?0:1)+S.daily.ch.filter(c=>c.done&&!c.got).length+(S.daily.ch.every(c=>c.got)&&!S.daily.chest?1:0);
  el.innerHTML=`🎁${n?`<i>${n}</i>`:''}`; el.classList.toggle('has',n>0);
}
function dailyHtml(){
  const D=S.daily, base=scaleCash(), day=D.loginDay||1;
  const cal=LOGIN_REWARDS.map(r=>{ const amt=r.t==='cash'?Math.round(base*r.k/1e4)*1e4:0, st=r.d<day||(r.d===day&&D.claimed)?'got':r.d===day?'today':'';
    return `<div class="dl ${st}"><small>Jour ${r.d}</small><div class="dl-i">${r.l}</div><small>${loginRewardText(r,amt)}</small>${st==='got'?'<b class="dl-ok">✓</b>':''}</div>`; }).join('');
  const chs=D.ch.map((c,i)=>{ const pr=Math.min(c.goal,dailyProgress(c)), pct=Math.round(pr/c.goal*100);
    return `<div class="dch ${c.got?'got':c.done?'ok':''}"><div class="grow"><b>${esc(c.label)}</b><div class="pbar"><i style="width:${pct}%"></i></div><small class="mut">${c.k==='rev'?fmtMoney(pr):num(pr)} / ${c.k==='rev'?fmtMoney(c.goal):num(c.goal)} · prime ${fmtMoney(c.reward)}</small></div>
      ${c.got?'<span class="mut">✓ reçu</span>':c.done?`<button class="btn sm gold" data-act="dailyCh" data-i="${i}">Récupérer</button>`:''}</div>`; }).join('');
  const all=D.ch.every(c=>c.got);
  return `<div class="dstreak">🔥 Série : <b>${D.streak||1} jour${(D.streak||1)>1?'s':''}</b> de suite <span class="mut small">· revenez chaque jour, le 7ᵉ jour un avion est offert</span></div>
    <div class="dcal">${cal}</div>
    ${D.claimed?'':`<div class="btns"><button class="btn gold" data-act="dailyClaim">🎁 Récupérer la récompense du jour</button></div>`}
    <h3>🎯 Défis du jour</h3>${chs}
    <div class="dchest ${all&&!D.chest?'ready':''}">🧰 <b>Coffre du jour</b> : réussissez les 3 défis — ${D.chest?'<span class="mut">déjà ouvert ✓</span>':all?`<button class="btn sm gold" data-act="dailyChest">Ouvrir</button>`:'<span class="mut">verrouillé</span>'}</div>
    <p class="small mut">Nouveaux défis chaque jour à minuit (heure de votre téléphone).</p>`;
}
function grantPlane(){
  const pool=MODELS.filter(m=>!isCargo(m)&&m.price<=Math.max(40,S.fleet.length*6)&&m.cls<=AP(S.company.hub).cls).sort((a,b)=>b.seats-a.seats);
  const m=pool[Math.min(pool.length-1,Math.floor(Math.random()*Math.min(4,pool.length)))]||getModel('AT76');
  const ac=addAircraft(m.id,{owned:true,used:true}); return `${m.name} (${ac.reg})`;
}

/* ---------- charters ---------- */
const CHARTER_KINDS=[
  {k:'foot', w:3, ic:'⚽', who:()=>pick(['l’équipe nationale de football','un club de football et ses supporters','l’équipe de basket','une équipe de handball']), why:'un match à l’extérieur', pax:[60,180], mult:1.25},
  {k:'pilgrim', w:2, ic:'🕌', who:()=>pick(['un groupe de pèlerins','une délégation religieuse','une chorale paroissiale']), why:'un pèlerinage', pax:[120,300], mult:1.1, dest:['JED','MED','TLV','ROM','FCO','LDE']},
  {k:'concert', w:2, ic:'🎤', who:()=>pick(['un groupe de rumba et son équipe','une star de la musique et ses musiciens','un orchestre symphonique']), why:'une tournée de concerts', pax:[25,90], mult:1.6},
  {k:'gov', w:2, ic:'🏛️', who:()=>pick(['une délégation ministérielle','une délégation de députés','une mission diplomatique']), why:'un sommet international', pax:[30,120], mult:1.5},
  {k:'wedding', w:1.5, ic:'💍', who:()=>pick(['les invités d’un grand mariage','une famille et ses invités']), why:'un mariage', pax:[60,160], mult:1.3},
  {k:'ngo', w:1.5, ic:'🤝', who:()=>pick(['une ONG médicale','une équipe de secouristes','des médecins volontaires']), why:'une mission humanitaire', pax:[20,80], mult:1.2, rep:2},
  {k:'school', w:1, ic:'🎓', who:()=>pick(['un voyage scolaire','une université en échange']), why:'un voyage d’études', pax:[40,150], mult:1.0},
  {k:'company', w:1.5, ic:'🏢', who:()=>pick(['une compagnie minière','une société pétrolière','une grande banque']), why:'un séminaire d’entreprise', pax:[30,140], mult:1.45},
];
function chartersHourly(){
  if(!S.fleet||!S.fleet.length) return;
  S.charters=S.charters||{offers:[],active:[],done:0};
  const C=S.charters; C.offers=C.offers.filter(o=>o.expires>S.time);
  if(C.offers.length>=4||Math.random()>0.09) return;
  const kind=wpick(CHARTER_KINDS), hub=pick(S.hubs);
  const maxSeats=Math.max(...S.fleet.filter(a=>a.hub===hub).map(a=>modelOf(a).seats||0),0); if(maxSeats<20) return;
  const maxRange=Math.max(...S.fleet.filter(a=>a.hub===hub).map(a=>modelOf(a).range||0),0);
  let to=null;
  const cand=(kind.dest||[]).filter(c=>AP(c)&&dist(hub,c)<=maxRange&&c!==hub);
  if(cand.length) to=pick(cand);
  else { const rs=((typeof AP_ROUTES!=='undefined'&&AP_ROUTES[hub])||[]).filter(c=>AP(c)&&dist(hub,c)<=maxRange&&dist(hub,c)>150); if(rs.length) to=pick(rs); }
  if(!to) return;
  const pax=Math.min(maxSeats,rndi(kind.pax[0],kind.pax[1])), d=dist(hub,to);
  const reward=Math.round((pax*d*0.16*kind.mult*2+60000)/1e3)*1e3;
  C.offers.push({id:uid(), kind:kind.k, ic:kind.ic, who:kind.who(), why:kind.why, from:hub, to, pax, reward, rep:kind.rep||1, deadline:S.time+rndi(18,48)*HOUR, expires:S.time+rndi(10,30)*HOUR});
  if(!(typeof UI!=='undefined'&&UI.silent)) toast(`${kind.ic} Nouveau charter : ${esc(C.offers[C.offers.length-1].who)} → ${esc(AP(to).city)} · ${fmtMoney(reward)} — voir 🛫 Charters`,'info');
}
function charterFits(a,o){ return a.hub===o.from&&!isCargo(modelOf(a))&&(modelOf(a).seats||0)>=o.pax&&!a.charterQ&&!(a.flight&&a.flight.kind==='charter')&&!checkLegs(a,legsFor([o.from,o.to,o.from])); }
function charterReadyNow(a,o){ return a.loc===o.from&&a.status==='idle'&&(a.readyAt||0)<=S.time+5*MIN&&!canFly(a); }
function charterEligible(o){ return S.fleet.filter(a=>charterFits(a,o)).sort((x,y)=>(charterReadyNow(y,o)-charterReadyNow(x,o))||((x.readyAt||0)-(y.readyAt||0))); }
function charterStart(ac,o,t){
  const err=startFlight(ac,[o.from,o.to,o.from],'charter',t,{contractId:o.id}); if(err) return err;
  for(const l of ac.flight.legs) l.pax={f:0,j:0,w:0,y:o.pax};
  o.started=true; ac.charterQ=null;
  logMsg(`${o.ic} Charter : ${ac.reg} décolle de ${AP(o.from).city} pour ${AP(o.to).city} avec ${o.who} (${o.pax} passagers).`,'ok');
  return null;
}
function acceptCharter(id,acId){
  const C=S.charters, o=C.offers.find(x=>x.id===id), ac=S.fleet.find(a=>a.id===acId); if(!o||!ac) return 'Offre ou avion introuvable';
  if(!charterFits(ac,o)) return 'Cet avion ne convient pas';
  C.offers=C.offers.filter(x=>x!==o); C.active.push(o); o.acId=ac.id;
  if(charterReadyNow(ac,o)){ const e=charterStart(ac,o,S.time); if(e){ C.active=C.active.filter(x=>x!==o); C.offers.push(o); return e; } }
  else { ac.charterQ=o.id; logMsg(`${o.ic} Charter réservé : ${ac.reg} partira de ${AP(o.from).city} dès son retour à la base.`,'ok'); }
  return null;
}
// appelé par la boucle de simulation quand l'avion est libre
function charterQueued(ac,t){
  const C=S.charters, o=C&&C.active.find(x=>x.id===ac.charterQ); if(!o){ ac.charterQ=null; return false; }
  if(t>o.deadline+6*HOUR){ ac.charterQ=null; C.active=C.active.filter(x=>x!==o); S.reputation=clamp(S.reputation-1,0,100); logMsg(`${o.ic} Charter annulé : ${ac.reg} n’est pas revenu à temps. Le client est mécontent (image −1).`,'warn'); return false; }
  if(ac.loc!==o.from) return false;   // il finit sa rotation et revient à la base
  return !charterStart(ac,o,t);
}
// appelé à la fin d'un tronçon (sim.js)
function charterLegDone(ac,fl,leg,arr){
  if(fl.kind!=='charter'||!fl.contractId||fl.li!==fl.legs.length-1) return 0;
  const C=S.charters, o=C&&C.active.find(x=>x.id===fl.contractId); if(!o) return 0;
  const late=arr>o.deadline+12*HOUR, pay=late?o.reward*0.6:o.reward;
  book('billets',pay); S.stats.pax+=o.pax*2; C.done=(C.done||0)+1; C.active=C.active.filter(x=>x!==o);
  S.reputation=clamp(S.reputation+(late?0:o.rep),0,100);
  logMsg(`${o.ic} Charter terminé : ${o.who} ramené${''} à ${AP(o.from).city} — ${fmtMoney(pay)}${late?' (retard, prime réduite)':''}`, late?'warn':'ok');
  if(typeof aiNews==='function'&&o.kind==='foot'&&Math.random()<0.5) aiNews(`⚽ ${S.company.name} a transporté ${o.who} pour ${o.why} à ${AP(o.to).city}.`,'news',true);
  return pay;
}
function chartersHtml(){
  const C=S.charters=S.charters||{offers:[],active:[],done:0};
  const off=C.offers.filter(o=>o.expires>S.time);
  return `<p class="small mut">Des clients privés louent un avion entier pour un aller-retour depuis votre hub. Choisissez un avion libre assez grand : la prime est payée au retour.</p>
  ${off.length?off.map(o=>{ const el=charterEligible(o);
    return `<div class="chart"><div class="ch-h"><span class="ch-ic">${o.ic}</span><div class="grow"><b>${esc(o.who.charAt(0).toUpperCase()+o.who.slice(1))}</b><br><small class="mut">${esc(o.why)} · ${o.pax} passagers</small></div><b class="ch-pay">${fmtMoney(o.reward)}</b></div>
      <div class="small">${flag(o.from)} ${esc(AP(o.from).city)} ⇄ ${flag(o.to)} ${esc(AP(o.to).city)} · ${num(dist(o.from,o.to))} km · départ avant le ${fmtDate(o.deadline)} ${fmtTime(o.deadline)} · offre valable jusqu’au ${fmtDate(o.expires)} ${fmtTime(o.expires)}</div>
      ${el.length?`<div class="row wrap" style="margin-top:6px"><select id="chs-${o.id}">${el.map(a=>`<option value="${a.id}">${esc(a.reg)} · ${esc(modelOf(a).name)} (${modelOf(a).seats} pl.) · ${charterReadyNow(a,o)?'libre maintenant':'dès son retour'}</option>`).join('')}</select><button class="btn sm gold" data-act="charterGo" data-id="${o.id}">✅ Accepter</button></div>`
        :`<div class="small mut" style="margin-top:6px">⛔ Aucun avion libre de ${o.pax} places ou plus à ${esc(AP(o.from).city)} en ce moment.</div>`}</div>`; }).join('')
   :'<p class="mut">Aucune offre pour l’instant : de nouvelles demandes arrivent régulièrement (≈ 2 par jour de jeu).</p>'}
  ${C.active.length?`<h3>En cours</h3>${C.active.map(o=>{ const a=S.fleet.find(x=>x.id===o.acId); return `<div class="small">${o.ic} ${esc(o.who)} · ${esc(AP(o.from).city)} ⇄ ${esc(AP(o.to).city)} · ${fmtMoney(o.reward)} · ${a?esc(a.reg):''} ${o.started?'✈️ en vol':'⏳ attend le retour de l’avion'}</div>`; }).join('')}`:''}
  <p class="small mut">Charters réalisés : <b>${C.done||0}</b></p>`;
}
function registerProgressActions(){
  MODALS.daily=()=>showModal('🎁 Récompenses & défis du jour', dailyHtml(), true);
  MODALS.charters=()=>showModal('🛫 Vols charters', chartersHtml(), true);
  Object.assign(ACTIONS,{
    daily:()=>openM('daily'),
    charters:()=>openM('charters'),
    dailyClaim:()=>{ const D=S.daily; if(D.claimed) return; const r=LOGIN_REWARDS[(D.loginDay||1)-1], base=scaleCash(); let txt='';
      if(r.t==='cash'){ const a=Math.round(base*r.k/1e4)*1e4; book('admin',a); txt=fmtMoney(a); }
      else if(r.t==='rep'){ S.reputation=clamp(S.reputation+r.v,0,100); txt=`image +${r.v}`; }
      else if(r.t==='fuel'){ S.fuelDiscount={until:S.time+3*DAY,f:0.85}; txt='kérosène −15 % pendant 3 jours'; }
      else txt=grantPlane();
      D.claimed=true; toast(`🎁 Récompense du jour : <b>${txt}</b>`,'ok'); logMsg(`🎁 Récompense de connexion (jour ${D.loginDay}) : ${txt}`,'ok'); openM('daily'); renderDailyBadge(); },
    dailyCh:d=>{ const c=S.daily.ch[+d.i]; if(!c||!c.done||c.got) return; c.got=true; book('admin',c.reward); toast(`🎯 Prime de défi : ${fmtMoney(c.reward)}`,'ok'); openM('daily'); renderDailyBadge(); },
    dailyChest:()=>{ const D=S.daily; if(D.chest||!D.ch.every(c=>c.got)) return; D.chest=true; const a=Math.round(scaleCash()*3/1e4)*1e4; book('admin',a); S.reputation=clamp(S.reputation+1,0,100);
      toast(`🧰 Coffre ouvert : <b>${fmtMoney(a)}</b> + image +1`,'ok'); openM('daily'); renderDailyBadge(); },
    charterGo:d=>{ const sel=document.getElementById('chs-'+d.id); const e=acceptCharter(d.id,sel&&sel.value); if(e) toast('⛔ '+e,'bad'); else { toast('✅ Charter accepté','ok'); openM('charters'); } },
  });
}
