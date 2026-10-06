/* ============================================================
   AFFAIRES — bourse & rachats, commandes d'avions, partages de
   codes, décisions stratégiques, statistiques hebdomadaires
   ============================================================ */
const TOTAL_SHARES = 100e6;

/* ---------- bourse ---------- */
function ensureBiz(){
  S.stock=S.stock||{ipo:false, public:0, sentiment:0, hist:[], holdings:{}};
  S.stock.holdings=S.stock.holdings||{};
  S.orders=S.orders||[]; S.codeshares=S.codeshares||[]; S.weeks=S.weeks||[]; S.obligations=S.obligations||[];
}
function avgWeeklyProfit(){ const w=(S.weeks||[]).slice(-4); return w.length? w.reduce((s,x)=>s+x.profit,0)/w.length : 0; }
function rivalValue(R){ return Math.max(10e6, R.fleet*27e6 + R.cash); }
function holdingsValue(){ ensureBiz(); let v=0; for(const [code,pct] of Object.entries(S.stock.holdings)){ const R=(S.rivals||[]).find(x=>x.code===code); if(R) v+=pct*rivalValue(R); } return v; }
function companyValue(){
  const equity=S.cash+fleetValue()-debt()+holdingsValue();
  return Math.max(5e6, equity*0.8 + avgWeeklyProfit()*52*6 + S.reputation*0.5e6 + S.routes.length*2e6);
}
function sharePrice(){ ensureBiz(); return companyValue()*(1+S.stock.sentiment)/TOTAL_SHARES; }
function ipo(pct){
  ensureBiz(); const st=S.stock;
  if(st.ipo) return 'Déjà cotée en bourse';
  if(netWorth()<40e6) return 'Valeur nette minimale : $40 M';
  if(S.reputation<40) return 'Image minimale : 40/100';
  const cash=pct*companyValue()*0.95;
  S.cash+=cash; st.ipo=true; st.public=pct; st.sentiment=0.05;
  logMsg(`🔔 Introduction en bourse ! ${Math.round(pct*100)} % du capital vendu pour ${fmtMoney(cash)}.`,'ok');
  notify('Introduction en bourse', `${S.company.name} est cotée`);
  return null;
}
function issueShares(pct){
  const st=S.stock; if(!st.ipo) return 'Entrez d’abord en bourse';
  if(st.public+pct>0.49+1e-9) return 'Vous devez garder au moins 51 % du capital';
  const cash=pct*companyValue()*0.93; S.cash+=cash; st.public+=pct; st.sentiment=clamp(st.sentiment-0.04,-0.3,0.3);
  logMsg(`📈 Augmentation de capital : ${Math.round(pct*100)} % émis pour ${fmtMoney(cash)}.`,'ok'); return null;
}
function buyback(pct){
  const st=S.stock; if(!st.ipo||st.public<pct-1e-9) return 'Pas assez d’actions en circulation';
  const cost=pct*companyValue()*1.05; if(S.cash<cost) return 'Trésorerie insuffisante';
  S.cash-=cost; st.public=Math.max(0,st.public-pct); st.sentiment=clamp(st.sentiment+0.03,-0.3,0.3);
  logMsg(`📉 Rachat d’actions : ${Math.round(pct*100)} % pour ${fmtMoney(cost)}.`,'info'); return null;
}
function payDividend(amount){
  const st=S.stock; if(!st.ipo) return 'Réservé aux sociétés cotées';
  if(S.cash<amount) return 'Trésorerie insuffisante';
  S.cash-=amount; st.sentiment=clamp(st.sentiment+amount/companyValue()*4,-0.3,0.3); S.reputation=clamp(S.reputation+1,0,100);
  logMsg(`💸 Dividende versé : ${fmtMoney(amount)} (dont ${fmtMoney(amount*st.public)} aux actionnaires).`,'ok'); return null;
}
function buyStake(code, pct){
  ensureBiz(); const R=S.rivals.find(x=>x.code===code); if(!R) return 'Compagnie introuvable';
  const cur=S.stock.holdings[code]||0;
  if(cur+pct>1+1e-9) return 'Vous possédez déjà tout';
  const cost=pct*rivalValue(R)*(1.1+cur*0.6); // la prime grimpe à mesure qu'on monte au capital
  if(S.cash<cost) return `Trésorerie insuffisante (${fmtMoney(cost)})`;
  S.cash-=cost; S.stock.holdings[code]=+(cur+pct).toFixed(4);
  logMsg(`📊 Achat de ${Math.round(pct*100)} % de ${R.name} pour ${fmtMoney(cost)} (participation : ${Math.round(S.stock.holdings[code]*100)} %).`,'ok');
  if(S.stock.holdings[code]>=0.51) absorbRival(R);
  return null;
}
function sellStake(code, pct){
  const R=S.rivals.find(x=>x.code===code), cur=S.stock.holdings[code]||0; if(!R||cur<pct-1e-9) return 'Participation insuffisante';
  const cash=pct*rivalValue(R)*0.95; S.cash+=cash; S.stock.holdings[code]=+(cur-pct).toFixed(4);
  if(S.stock.holdings[code]<=0) delete S.stock.holdings[code];
  logMsg(`📊 Vente de ${Math.round(pct*100)} % de ${R.name} pour ${fmtMoney(cash)}.`,'info'); return null;
}
// Rachat : la compagnie est intégrée (hub, lignes, avions, équipages)
function absorbRival(R){
  const hub=R.hub;
  if(!S.hubs.includes(hub)) S.hubs.push(hub);
  S.cash+=R.cash>0? R.cash*0.5 : R.cash;
  const lines=[];
  for(const r of R.routes){
    let stops = r.a===hub? [r.a,r.b] : r.b===hub? [r.b,r.a] : null;
    if(!stops) continue;
    let line=S.routes.find(x=>x.stops.join()===stops.join());
    if(!line){ line={id:uid(), stops, pm:{y:1,j:1,f:1,c:1}, audit:true, opened:S.time, stats:{flights:0,pax:0,seats:0,rev:0,cost:0,recent:[],shareSum:0,shareN:0}}; S.routes.push(line); }
    lines.push({line, freq:r.freq});
  }
  const n=Math.min(R.fleet, Math.max(lines.length*2, 4), 30);
  const pick3=d=> d<1400? (AP(hub).cls>=3?'E195':'AT76') : d<5500? 'A20N' : 'B789';
  for(let i=0;i<n && lines.length;i++){
    const {line}=lines[i%lines.length], d=legsFor(line.stops).reduce((s,l)=>s+l.dist,0);
    let mid=pick3(d); if(getModel(mid).cls>Math.min(...line.stops.map(c=>AP(c).cls))) mid='AT76';
    const ac=addAircraft(mid,{owned:true, used:true, hub});
    if(!checkLegs(ac,legsFor(line.stops))){ const w=maxWeekly(ac,line); if(w>0) setPlan(ac,line.id,w); }
    const fam=getModel(mid).fam; for(let k=0;k<2;k++) S.pilots.push(makePilot([fam]));
  }
  const need=staffNeed(); for(const k of ['pnc','meca','sol']) S.staff[k]=Math.max(S.staff[k],need[k]);
  S.rivals=S.rivals.filter(x=>x!==R); delete S.stock.holdings[R.code];
  S.codeshares=S.codeshares.filter(c=>c!==R.code);
  S.takeovers=(S.takeovers||0)+1; S.reputation=clamp(S.reputation+4,0,100);
  logMsg(`🏆 RACHAT : ${R.name} rejoint ${S.company.name} ! Nouveau hub ${AP(hub).city}, ${lines.length} lignes et ${n} avions intégrés.`,'ok');
  notify('Rachat réussi', `${R.name} est à vous`);
  if(typeof drawRoutes==='function'){ drawRoutes(); drawAirports(); }
}

/* ---------- commandes d'avions (délais de livraison) ---------- */
const LEAD_DAYS={prop:12, rj:20, nb:30, wb:50, quad:70, conc:90};
function leadDays(m){ return m.custom? 25 : LEAD_DAYS[planeCat(m)]||30; }
function volumeDiscount(qty){ return Math.min(0.15, 0.025*(qty-1)); }
function orderAircraft(modelId, qty, hub, express, extraDiscount=0){
  ensureBiz(); const m=getModel(modelId);
  const unit=m.price*1e6*(1-volumeDiscount(qty)-extraDiscount)*(express?1.12:1);
  if(express){
    const total=unit*qty; S.cash-=total;
    for(let i=0;i<qty;i++) addAircraft(modelId,{owned:true, hub});
    logMsg(`🛬 Livraison immédiate : ${qty} × ${m.name} à ${AP(hub).city} (${fmtMoney(total)}).`,'ok');
    return null;
  }
  for(let i=0;i<qty;i++){
    const dep=unit*0.2; S.cash-=dep;
    S.orders.push({id:uid(), model:modelId, hub, due:S.time+(leadDays(m)+i*3)*DAY, total:unit, paid:dep, ordered:S.time});
  }
  logMsg(`📝 Commande : ${qty} × ${m.name}${qty>1?` (remise ${Math.round((volumeDiscount(qty)+extraDiscount)*100)} %)`:''} — acompte ${fmtMoney(unit*0.2*qty)}, première livraison le ${fmtDate(S.time+leadDays(m)*DAY)}.`,'ok');
  return null;
}
function cancelOrder(id){ S.orders=S.orders.filter(o=>o.id!==id); logMsg('❌ Commande annulée : l’acompte est perdu.','warn'); }
function deliverOrders(){
  ensureBiz();
  for(const o of S.orders.filter(o=>o.due<=S.time)){
    S.cash-=o.total-o.paid;
    const ac=addAircraft(o.model,{owned:true, hub:S.hubs.includes(o.hub)?o.hub:S.company.hub});
    logMsg(`🛬 Livraison : ${getModel(o.model).name} ${ac.reg} est arrivé à ${AP(ac.hub).city}. Programmez-le !`,'ok');
    notify('Avion livré', `${getModel(o.model).name} ${ac.reg}`);
  }
  S.orders=S.orders.filter(o=>o.due>S.time);
}

/* ---------- partages de codes ---------- */
const isPartner = R=>!!(S.codeshares&&S.codeshares.includes(R.code));
const codeshareFee = R=>Math.round(R.fleet*8000/1000)*1000;
function signCodeshare(code){
  ensureBiz(); const R=S.rivals.find(x=>x.code===code);
  if(!R||R.local) return 'Le rival local refuse tout accord';
  if(S.reputation<45) return 'Image minimale : 45/100';
  if(S.fleet.length<4) return 'Flotte minimale : 4 avions';
  if(S.codeshares.length>=3) return 'Maximum 3 accords';
  S.codeshares.push(code); book('alliance',-codeshareFee(R));
  logMsg(`🤝 Accord de partage de codes signé avec ${R.name} : correspondances via ${AP(R.hub).city}, concurrence réduite.`,'ok');
  return null;
}
function cancelCodeshare(code){ S.codeshares=S.codeshares.filter(c=>c!==code); }

/* ---------- décisions stratégiques ---------- */
const DECISIONS = {
  subsidy:{ make:()=>{ const cc=homeCC(), served=servedAirports();
      const c=pick(AIRPORT_CODES.filter(x=>AP(x).cc===cc && !served.has(x) && AP(x).cls>=2)); if(!c) return null;
      const X=Math.round(rnd(1.5,6))*1e6;
      return {icon:'🏛️', title:'Subvention gouvernementale', text:`Le ministère des Transports (${COUNTRIES[cc][0]}) vous offre <b>${fmtMoney(X)}</b> si vous ouvrez une ligne vers <b>${AP(c).city}</b> dans les 30 jours. Sinon, vous rembourserez ${fmtMoney(X*1.5)}.`,
        options:['Accepter la subvention','Refuser'], p:{c,X}}; },
    apply:(i,p)=>{ if(i===0){ book('admin',p.X); S.obligations.push({code:p.c, until:S.time+30*DAY, penalty:p.X*1.5}); logMsg(`🏛️ Subvention reçue : ${fmtMoney(p.X)}. Ouvrez une ligne vers ${AP(p.c).city} avant le ${fmtDate(S.time+30*DAY)} !`,'ok'); } } },
  union:{ make:()=>({icon:'✊', title:'Revendications syndicales', text:'Les syndicats des pilotes et des PNC réclament une hausse de salaire. Sans accord, une grève est probable.', options:['Accorder +8 % (PNC) et +5 % (pilotes)','Refuser'], p:{}}),
    apply:(i)=>{ const st=S.staff; if(i===0){ st.sal.pnc=Math.min(160,st.sal.pnc+8); st.sal.pil=Math.min(160,st.sal.pil+5); for(const k in st.morale) st.morale[k]=clamp(st.morale[k]+15,0,100); logMsg('✊ Accord salarial signé : le moral remonte.','ok'); }
      else { for(const k in st.morale) st.morale[k]=clamp(st.morale[k]-12,0,100); if(Math.random()<0.4){ st.strikeUntil=S.time+rndi(1,2)*DAY; logMsg('✊ Les syndicats déclenchent une grève !','bad'); } else logMsg('✊ Les syndicats grondent, mais renoncent à la grève.','warn'); } } },
  vip:{ make:()=>{ const ac=S.fleet.filter(a=>a.status==='idle'&&!isCargo(modelOf(a))).sort((x,y)=>modelOf(y).seats-modelOf(x).seats)[0]; if(!ac) return null;
      const Y=Math.round(modelOf(ac).seats*rnd(4000,9000)/10000)*10000+200000;
      return {icon:'🎖️', title:'Vol présidentiel', text:`Une délégation officielle souhaite affréter votre <b>${modelOf(ac).name}</b> (${ac.reg}) pendant 3 jours pour <b>${fmtMoney(Y)}</b>. L’avion ne fera pas ses rotations pendant ce temps.`, options:['Accepter l’affrètement','Refuser'], p:{id:ac.id,Y}}; },
    apply:(i,p)=>{ const ac=S.fleet.find(a=>a.id===p.id); if(i===0&&ac){ book('billets',p.Y); ac.readyAt=Math.max(ac.readyAt||0,S.time)+3*DAY; S.reputation=clamp(S.reputation+2,0,100); logMsg(`🎖️ Affrètement VIP : ${fmtMoney(p.Y)} encaissés.`,'ok'); } } },
  recall:{ make:()=>{ const fams=[...new Set(S.fleet.map(a=>modelOf(a).fam))]; if(!fams.length) return null; const f=pick(fams), n=S.fleet.filter(a=>modelOf(a).fam===f).length;
      return {icon:'🔧', title:'Rappel de sécurité constructeur', text:`Le constructeur signale un défaut possible sur les moteurs de vos <b>${n} avion(s) ${f}</b>. Inspecter tout de suite coûte ${fmtMoney(n*60000)} et immobilise les avions 2 jours.`, options:['Inspecter immédiatement','Continuer à voler (risque)'], p:{f,n}}; },
    apply:(i,p)=>{ if(i===0){ book('maintenance',-p.n*60000); for(const a of S.fleet) if(modelOf(a).fam===p.f) a.readyAt=Math.max(a.readyAt||0,S.time)+2*DAY; S.reputation=clamp(S.reputation+1,0,100); logMsg(`🔧 Inspection des ${p.f} lancée.`,'ok'); }
      else { S.recallRisk={fam:p.f, until:S.time+20*DAY}; logMsg(`🔧 Vos ${p.f} continuent de voler : risque d’incident accru pendant 20 jours.`,'warn'); } } },
  influencer:{ make:()=>({icon:'📱', title:'Proposition d’influenceur', text:'Une star des réseaux sociaux (12 M d’abonnés) propose une campagne sur vos vols pour <b>$250 k</b>. Succès probable… mais pas garanti.', options:['Payer la campagne','Décliner'], p:{}}),
    apply:(i)=>{ if(i!==0) return; book('marketing',-250000); if(Math.random()<0.7){ S.reputation=clamp(S.reputation+5,0,100); S.campaigns.push({id:'digital',until:S.time+20*DAY}); logMsg('📱 La campagne fait un carton : image +5, demande en hausse.','ok'); } else { S.reputation=clamp(S.reputation-4,0,100); logMsg('📱 Polémique en ligne : la campagne se retourne contre vous (image −4).','bad'); } } },
  broker:{ make:()=>{ const ac=S.fleet.filter(a=>a.owned&&a.status==='idle').sort((x,y)=>acAgeYears(y)-acAgeYears(x))[0]; if(!ac||S.fleet.length<3) return null; const v=acValue(ac)*1.25;
      return {icon:'💼', title:'Offre d’un courtier', text:`Un courtier propose de racheter votre <b>${modelOf(ac).name}</b> (${ac.reg}, ${acAgeYears(ac).toFixed(1)} ans) pour <b>${fmtMoney(v)}</b>, soit 25 % au-dessus de sa valeur.`, options:['Vendre','Garder l’avion'], p:{id:ac.id,v}}; },
    apply:(i,p)=>{ const ac=S.fleet.find(a=>a.id===p.id); if(i===0&&ac&&ac.status==='idle'){ S.cash+=p.v; S.fleet=S.fleet.filter(a=>a!==ac); logMsg(`💼 ${ac.reg} vendu au courtier pour ${fmtMoney(p.v)}.`,'ok'); } } },
  loyalty:{ make:()=> S.loyalty? null : ({icon:'💳', title:'Programme de fidélité', text:`Lancer « ${esc0(S.company.name)} Miles » coûte <b>$3 M</b>. Les passagers fidèles reviennent : attractivité +6 % sur tout le réseau, image +3.`, options:['Lancer le programme','Plus tard'], p:{}}),
    apply:(i)=>{ if(i===0){ book('marketing',-3e6); S.loyalty=true; S.reputation=clamp(S.reputation+3,0,100); logMsg('💳 Programme de fidélité lancé !','ok'); } } },
  hedge:{ make:()=>{ const space=S.fuel.cap-S.fuel.stock; if(space<200000) return null; const L=Math.min(space,2e6), pr=fuelPrice()*0.85;
      return {icon:'🛢️', title:'Offre de couverture carburant', text:`Un négociant propose <b>${num0(L)} L</b> de kérosène à <b>$${pr.toFixed(3)}/L</b> (−15 %), livrés immédiatement, soit ${fmtMoney(L*pr)}.`, options:['Acheter','Refuser'], p:{L,pr}}; },
    apply:(i,p)=>{ if(i===0){ const L=Math.min(p.L,S.fuel.cap-S.fuel.stock); book('carburant',-L*p.pr); S.fuel.stock+=L; logMsg(`🛢️ ${num0(L)} L achetés à prix négocié.`,'ok'); } } },
  airshow:{ make:()=>{ const fams=S.fleet.map(a=>a.model).filter(id=>!getModel(id).custom&&!isCargo(getModel(id))); const id=fams.length?pick(fams):'A20N', m=getModel(id);
      return {icon:'🛩️', title:'Salon aéronautique', text:`Au salon international, ${m.maker} vous propose <b>3 × ${m.name}</b> avec <b>18 % de remise</b> (livraison sous ${leadDays(m)} jours, acompte 20 %).`, options:['Signer la commande','Décliner'], p:{id}}; },
    apply:(i,p)=>{ if(i===0) orderAircraft(p.id,3,S.hubs[0],false,0.18-volumeDiscount(3)); } },
};
const esc0 = s=>String(s).replace(/[<>&]/g,'');
function rollDecision(){
  ensureBiz();
  if(S.decision){ if(S.decision.until<S.time){ resolveDecision(S.decision.options.length-1, true); } return; }
  if(S.fleet.length<2 || Math.random()>0.06) return;
  const keys=Object.keys(DECISIONS); const k=pick(keys); const d=DECISIONS[k].make(); if(!d) return;
  S.decision={key:k, ...d, until:S.time+3*DAY};
  notify(d.title, 'Une décision vous attend');
}
function resolveDecision(i, auto){
  const d=S.decision; if(!d) return; S.decision=null;
  DECISIONS[d.key].apply(i, d.p);
  if(auto) logMsg(`⏳ Sans réponse, « ${d.title} » : choix par défaut (${d.options[i]}).`,'info');
}
function checkObligations(){
  ensureBiz(); const served=servedAirports();
  for(const o of S.obligations.slice()){
    if(served.has(o.code)){ S.obligations=S.obligations.filter(x=>x!==o); S.reputation=clamp(S.reputation+2,0,100); logMsg(`🏛️ Engagement tenu : ${AP(o.code).city} est desservi. Le gouvernement salue votre compagnie.`,'ok'); }
    else if(o.until<S.time){ S.obligations=S.obligations.filter(x=>x!==o); book('incidents',-o.penalty); S.reputation=clamp(S.reputation-3,0,100); logMsg(`🏛️ Engagement non tenu (${AP(o.code).city}) : remboursement de ${fmtMoney(o.penalty)}.`,'bad'); }
  }
}

/* ---------- tick quotidien & hebdomadaire ---------- */
function businessDaily(){
  ensureBiz(); const st=S.stock;
  deliverOrders(); checkObligations(); rollDecision();
  st.sentiment=clamp(st.sentiment*0.97+rnd(-0.02,0.02),-0.3,0.3);
  st.hist.push({t:S.time, p:+sharePrice().toFixed(4)}); if(st.hist.length>200) st.hist.shift();
  if(S.recallRisk && S.recallRisk.until<S.time) S.recallRisk=null;
}
function businessWeekly(r){
  ensureBiz(); S.weeks.push({t:S.time, rev:Math.round(r.rev), cost:Math.round(r.cost), profit:Math.round(r.profit), pax:r.pax, flights:r.flights});
  if(S.weeks.length>52) S.weeks.shift();
}
function businessMonthly(){
  ensureBiz();
  for(const code of S.codeshares){ const R=S.rivals.find(x=>x.code===code); if(R) book('alliance',-codeshareFee(R)); }
}
