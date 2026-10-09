/* ============================================================
   MONDE VIVANT — les autres compagnies évoluent
   Chaque semaine, chaque compagnie gagne ou perd de l'argent, commande
   des avions, ouvre ou ferme des lignes, a un accident, ou fait faillite.
   De nouvelles compagnies apparaissent. Tout est dans les actualités et
   le journal. Le classement mondial en découle.
   ============================================================ */

const AI_PREFIX=['Nova','Zenith','Aurora','Horizon','Atlas','Savane','Azur','Meridian','Condor','Sahel','Lumière','Boréal','Corail','Alizé','Kivu','Phénix','Équateur','Mistral','Safari','Étoile'];
const AI_SUFFIX=['Air','Airways','Jet','Wings','Aviation','Express'];
const keyCity=c=>AP(c)?AP(c).city:c;
const _cAP={}; const cAirports=cc=>_cAP[cc]||(_cAP[cc]=AIRPORT_CODES.filter(c=>AP(c).cc===cc).sort((x,y)=>AP(y).traffic-AP(x).traffic));

/* ---------- état ---------- */
function makeAI(code){
  const a=AIRLINE_DB[code], fleet=(typeof REAL_FLEET!=='undefined'&&REAL_FLEET[code])||realFleet(a[3],code);
  return { code, name:a[0], color:airlineColor(code), hub:a[2], cc:AP(a[2]).cc, real:true, fleet, cash:fleet*rnd(3e6,22e6), rep:Math.round(rnd(46,78)), pax:Math.round(fleet*520), skill:+rnd(-0.4,0.25).toFixed(2),
    safety:+rnd(0.6,1.4).toFixed(2), routes:a[3], crashes:0, incidents:0, status:'ok', debt:0, pax:0, hist:[] };
}
function initWorldAI(){
  const mine=S.company.code, cc=homeCC();
  const rows=Object.entries(AIRLINE_DB).filter(([c,a])=>AP(a[2])&&a[3]>=8).sort((x,y)=>y[1][3]-x[1][3]);
  const codes=rows.slice(0,60).map(r=>r[0]);
  for(const [c] of rows.filter(([c,a])=>AP(a[2]).cc===cc).slice(0,6)) if(!codes.includes(c)) codes.push(c);
  for(const R of S.rivals||[]) if(!codes.includes(R.code) && AIRLINE_DB[R.code]) codes.push(R.code);
  S.ai={ list:codes.filter(c=>c!==mine).map(makeAI), news:[], crashes:[], extra:{}, cut:{}, rank:{}, ver:1, lastWeek:-1, lastMonth:-1, myRank:0 };
  aiNews(`🌍 Le ciel est ouvert : ${S.ai.list.length} compagnies se disputent le marché mondial.`,'news');
}
const aiAlive=()=>S.ai.list.filter(e=>e.status!=='dead');
const aiBy=code=>S.ai&&S.ai.list.find(e=>e.code===code);
function aiNews(text, kind='news', important=false){
  const ai=S.ai; ai.news.unshift({t:S.time,text,kind});
  if(ai.news.length>300) ai.news.length=300;
  if(important) logMsg(text, kind==='news'?'info':kind);
  if(typeof tickerPush==='function') tickerPush(text,kind);
}
const touchesMe=(a,b)=>S.hubs.includes(a)||S.hubs.includes(b)||S.routes.some(r=>r.stops.includes(a)&&r.stops.includes(b));
const modelFor=e=>{ const big=e.fleet>=60, pool=MODELS.filter(m=>!isCargo(m)&&m.fam!=='CONC'&&(big? m.seats>=120 : e.fleet>=12? m.seats>=70&&m.seats<=300 : m.seats<=120)); return pick(pool.length?pool:MODELS.filter(m=>!isCargo(m))); };

/* ---------- boucle hebdomadaire ---------- */
function aiWeekly(){
  if(!S.ai||!S.ai.list) return;
  const wk=Math.floor(S.time/(7*DAY)); if(S.ai.lastWeek===wk) return; S.ai.lastWeek=wk;
  const mk=monthKey(S.time); if(S.ai.lastMonth!==mk){ const first=S.ai.lastMonth===-1; S.ai.lastMonth=mk; if(!first) aiMonthly(); }
  const oilF=clamp(1.15-(S.oil-82)/160,0.6,1.3);
  for(const e of S.ai.list.slice()) if(e.status!=='dead') aiStep(e,oilF);
  moodWeekly(); storiesWeekly(); storiesRandom(); if(typeof aiReact==='function') aiReact();
  aiRanking();
}
function aiStep(e,oilF){
  const R=(S.rivals||[]).find(x=>x.code===e.code);
  const margin=(e.startup? rnd(-0.8,0.95) : rnd(-0.55,0.75)) + (e.rep-55)/120 + (e.skill||0);
  e.cash+=e.fleet*margin*oilF*0.5e6;
  if(e.cash>e.fleet*60e6) e.cash*=0.97;                      // dividendes
  if(Math.random()<0.008){ const l=e.fleet*rnd(1.5e6,6e6); e.cash-=l; if(e.fleet>=60&&l>e.fleet*5e6) aiNews(`✊ ${e.name} : grève et pertes record (${fmtMoney(l)}).`,'news'); } // choc
  e.rep=clamp(e.rep+rnd(-1.1,1.2)+(margin>0.2?0.25:-0.25)+(e.rep>72?-0.2:0.1),20,95);
  e.pax=Math.round(e.fleet*520*(0.6+e.rep/150));
  // expansion : commandes d'avions
  if(e.cash>e.fleet*(e.startup?12e6:30e6) && Math.random()<0.18){
    const n=Math.max(1,Math.round(e.fleet*rnd(0.01,0.05))), m=modelFor(e);
    e.fleet+=n; e.cash-=n*9e6;
    if(n>=6) aiNews(`🛒 ${e.name} commande ${n} ${m.name} — flotte portée à ${e.fleet} avions.`,'news',e.fleet>=100&&n>=10);
    else if(e.startup) aiNews(`🛒 ${e.name} (nouvelle compagnie) reçoit un ${m.name} : ${e.fleet} avions.`,'news');
  }
  // lignes
  if(Math.random()<0.14) aiRoute(e, (e.cash<0||margin<-0.25)&&e.routes>3? 'close':'open');
  // sécurité
  if(Math.random()<0.0034*Math.sqrt(Math.max(1,e.fleet)/100)/e.safety*(e.startup?1.4:1)) aiAccident(e);
  // difficultés financières
  if(e.cash<-e.fleet*(e.startup?2e6:8e6)){
    e.debt=(e.debt||0)+1;
    if(e.debt===1) aiNews(`⚠️ ${e.name} en grande difficulté financière : plan de restructuration.`,'news',e.fleet>=40);
    const n=Math.max(1,Math.ceil(e.fleet*0.06)); e.fleet=Math.max(1,e.fleet-n); e.cash+=n*10e6; e.rep=clamp(e.rep-1.5,15,95);
    if(Math.random()<0.5) aiRoute(e,'close');
    if(e.debt>=(e.startup?4:6)){ if(e.fleet>=150){ e.cash=e.fleet*4e6; e.debt=0; e.rep=clamp(e.rep-4,15,95); aiNews(`🏛️ ${e.name} sauvée de la faillite par un plan de l’État (${e.fleet} avions, emplois préservés).`,'news',true); } else aiBankrupt(e); }
  } else e.debt=0;
  e.hist.push(Math.round((e.fleet*40e6+Math.max(0,e.cash))/1e6)); if(e.hist.length>40) e.hist.shift();
  if(R){ R.fleet=e.fleet; R.cash=e.cash; R.rep=e.rep; R.paxDay=e.pax; R.network=e.routes; }
}

/* ---------- lignes ouvertes / fermées ---------- */
function aiRoute(e, mode){
  const ai=S.ai, code=e.code, R=(S.rivals||[]).find(x=>x.code===code);
  if(mode==='open'){
    if((ai.extra[code]||[]).length>=90) return;
    const maxD=e.fleet>=60?9500:e.fleet>=15?5000:e.fleet>=6?2500:1400, minT=e.fleet>=30?1.5:e.fleet>=8?0.7:0.25;
    let origin=e.hub; if(e.fleet>=40 && Math.random()<0.25){ const net=airlinePairs(code); if(net.length) origin=pick(pick(net)); }
    let best=null;
    for(let i=0;i<70;i++){
      const c=pick(AIRPORT_CODES), A=AP(c); if(c===origin||A.cls<2||A.traffic<minT) continue;
      const d=dist(origin,c); if(d<200||d>maxD) continue;
      const k=pairKey(origin,c); if(carriersOn(origin,c).includes(code)) continue;
      if(typeof runwayCheck==='function' && e.fleet<8 && A.cls<3) continue;
      const s=marketDemand(origin,c)*(AP(c).cc===AP(origin).cc?1.2:1); if(!best||s>best.s) best={c,k,s,d};
    }
    if(!best) return;
    (ai.extra[code]=ai.extra[code]||[]).push(best.k); ai.cut[code]=(ai.cut[code]||[]).filter(k=>k!==best.k);
    e.routes++; ai.ver++;
    if(R && !R.routes.some(r=>pairKey(r.a,r.b)===best.k)) R.routes.push({a:origin,b:best.c,freq:realFreq(origin,best.c,carriersOn(origin,best.c).length+1)});
    const mine=touchesMe(origin,best.c), notable=mine||e.fleet>=120||e.startup||AP(origin).cc===homeCC()||AP(best.c).cc===homeCC();
    if(notable) aiNews(vary('open',[`🛫 ${e.name} ouvre ${keyCity(origin)} → ${keyCity(best.c)}${mine?' — sur votre marché !':''}.`,`🆕 Nouvelle liaison : ${e.name} desservira ${keyCity(best.c)} depuis ${keyCity(origin)}${mine?' (concurrence directe)':''}.`,`🛫 ${keyCity(origin)}–${keyCity(best.c)} : ${e.name} se lance${moodOf(AP(best.c).cc).boom>0.2?' pour profiter de l’engouement':''}${mine?', sur votre terrain':''}.`]), mine?'rival':'news', mine);
  } else {
    const list=airlinePairs(code).filter(([a,b])=>!(ai.cut[code]||[]).includes(pairKey(a,b)));
    const own=(ai.extra[code]||[]);
    if(list.length<4 && !own.length) return;
    let pick1=null, worst=1e12;
    for(let i=0;i<8;i++){ const p=list.length&&Math.random()<0.8? pick(list) : null; if(!p) continue; const s=marketDemand(p[0],p[1]); if(s<worst){ worst=s; pick1=p; } }
    if(!pick1){ if(!own.length) return; const k=pick(own); ai.extra[code]=own.filter(x=>x!==k); e.routes=Math.max(1,e.routes-1); ai.ver++; aiNews(`✂️ ${e.name} abandonne ${keyCity(k.slice(0,3))} → ${keyCity(k.slice(3))}.`,'news'); return; }
    const [a,b]=pick1, k=pairKey(a,b);
    (ai.cut[code]=ai.cut[code]||[]).push(k); e.routes=Math.max(1,e.routes-1); ai.ver++;
    if(R) R.routes=R.routes.filter(r=>pairKey(r.a,r.b)!==k);
    const mine=touchesMe(a,b), notable=mine||e.fleet>=120||AP(a).cc===homeCC()||AP(b).cc===homeCC();
    if(notable) aiNews(vary('close',[`✂️ ${e.name} ferme ${keyCity(a)} → ${keyCity(b)} (ligne peu rentable)${mine?' — votre concurrent se retire !':''}.`,`✂️ ${e.name} abandonne ${keyCity(a)}–${keyCity(b)}${S.oil>95?' : le carburant coûte trop cher':e.cash<0?' pour économiser':''}${mine?' — place libre pour vous ?':''}.`]), mine?'rival':'news', mine);
  }
}

/* ---------- accidents ---------- */
function aiAccident(e){
  const ai=S.ai, pairs=airlinePairs(e.code).concat((ai.extra[e.code]||[]).map(k=>[k.slice(0,3),k.slice(3)]));
  const [a,b]=pairs.length? pick(pairs):[e.hub,e.hub], m=modelFor(e), r=Math.random();
  const sev=r<0.12?'fatal':r<0.38?'hull':'incident';
  const victims=sev==='fatal'? Math.max(2,Math.round(m.seats*rnd(0.25,0.95)*0.9)):0;
  e.incidents++; if(sev!=='incident') e.crashes++;
  if(sev==='fatal'){ e.rep=clamp(e.rep-rnd(14,24),10,95); e.fleet=Math.max(1,e.fleet-1); e.cash-=rnd(30e6,120e6); }
  else if(sev==='hull'){ e.rep=clamp(e.rep-rnd(5,9),10,95); e.fleet=Math.max(1,e.fleet-1); e.cash-=rnd(10e6,40e6); }
  else e.rep=clamp(e.rep-rnd(1,3),10,95);
  const where=Math.random()<0.5? a:b;
  ai.crashes.unshift({t:S.time,code:e.code,name:e.name,model:m.name,a,b,sev,victims}); if(ai.crashes.length>80) ai.crashes.length=80;
  const big=e.fleet>=60;
  if(sev==='fatal'){ aiNews(vary('crash',[`💥 CRASH — ${e.name} : un ${m.name} s’écrase près de ${keyCity(where)} (${keyCity(a)} → ${keyCity(b)}), ${victims} victime${victims>1?'s':''}.`,`💥 Tragédie : le vol ${e.code}${rndi(100,999)} ${keyCity(a)}–${keyCity(b)} s’est abîmé près de ${keyCity(where)} ; ${victims} personne${victims>1?'s':''} à bord n’ont pas survécu.`,`💥 ${e.name} en deuil : ${victims} morts dans l’accident d’un ${m.name} à ${keyCity(where)}.`]),'bad',true);
    storyStart('probe',{code:e.code,name:e.name,big,in:rndi(7,14)}); }
  else if(sev==='hull'){ aiNews(vary('hull',[`🔥 ${e.name} : sortie de piste à ${keyCity(where)}, un ${m.name} est détruit (pas de victime).`,`🔥 Un ${m.name} de ${e.name} est détruit à l’atterrissage à ${keyCity(where)} ; équipage et passagers évacués.`]),'warn',big);
    if(Math.random()<0.5) storyStart('probe',{code:e.code,name:e.name,big,in:rndi(10,21)}); }
  else aiNews(vary('incident',[`⚠️ ${e.name} : atterrissage d’urgence d’un ${m.name} à ${keyCity(where)}.`,`⚠️ Un ${m.name} de ${e.name} fait demi-tour après une alerte technique, sans blessé.`,`⚠️ Fumée en cabine sur un vol ${e.name} : déroutement vers ${keyCity(where)}.`]),'news'); 
}

/* ---------- faillites et nouvelles compagnies ---------- */
function aiBankrupt(e){
  e.status='dead'; e.deadAt=S.time; S.ai.ver++;
  aiNews(`💥 Faillite : ${e.name} cesse ses activités${e.fleet>20?` (${e.fleet} avions saisis)`:''}${e.startup?' — la jeune compagnie n’aura tenu que quelques mois':''}.`,'bad',e.fleet>=15||e.startup===false);
  if(S.rivals) S.rivals=S.rivals.filter(R=>R.code!==e.code);
  if(S.codeshares) S.codeshares=S.codeshares.filter(c=>c!==e.code);
  if(S.stock&&S.stock.holdings&&S.stock.holdings[e.code]){ logMsg(`📉 Vos actions ${e.name} ne valent plus rien.`,'warn'); delete S.stock.holdings[e.code]; }
}
function aiMonthly(){
  const ai=S.ai, alive=aiAlive();
  if(Math.random()<0.5 && alive.filter(e=>e.startup&&e.fleet<=15).length<8) aiStartup();
  // une compagnie en forme absorbe parfois une compagnie en difficulté
  const weak=alive.filter(e=>e.debt>=3&&e.fleet<40), strong=alive.filter(e=>e.cash>e.fleet*35e6&&e.fleet>=60);
  if(weak.length&&strong.length&&Math.random()<0.3){ const w=pick(weak), s=pick(strong);
    s.fleet+=Math.round(w.fleet*0.7); s.routes+=Math.round(w.routes*0.5); s.cash-=w.fleet*6e6; w.status='dead'; w.deadAt=S.time; ai.ver++;
    if(S.rivals) S.rivals=S.rivals.filter(R=>R.code!==w.code);
    aiNews(`🤝 ${s.name} rachète ${w.name} en difficulté : flotte portée à ${s.fleet} avions.`,'news',true); }
  // bilan du trimestre
  if(S.ai.lastMonth%3===0){ const top=aiRows().slice(0,3); aiNews(`🏆 Podium mondial : ${top.map((c,i)=>`${['🥇','🥈','🥉'][i]} ${c.name}`).join(' · ')}.`,'news'); }
}
function aiStartup(){
  const ai=S.ai, mine=S.company.code;
  const ccs=Object.keys(COUNTRIES).filter(cc=>cAirports(cc).some(c=>AP(c).cls>=2&&AP(c).traffic>=0.15));
  const w=ccs.map(cc=>{ const nat=Object.values(AIRLINE_DB).filter(a=>a[1]===cc&&AP(a[2])&&AP(a[2]).cc===cc&&a[3]>=3).length+aiAlive().filter(e=>e.startup&&e.cc===cc).length*2;
    return 1/(1+nat*1.6)*Math.sqrt(cAirports(cc).length); });
  let r=Math.random()*w.reduce((s,x)=>s+x,0), cc=ccs[0]; for(let i=0;i<ccs.length;i++){ r-=w[i]; if(r<=0){ cc=ccs[i]; break; } }
  const hub=cAirports(cc).find(c=>AP(c).cls>=2); if(!hub) return;
  let code=null; for(let i=0;i<300&&!code;i++){ const c=String.fromCharCode(65+rndi(0,25))+String.fromCharCode(65+rndi(0,25)); if(!AIRLINE_DB[c]&&c!==mine&&!aiBy(c)) code=c; }
  if(!code) return;
  const name=`${pick(AI_PREFIX)} ${pick(AI_SUFFIX)}`, fleet=rndi(1,4);
  const e={ code, name, color:airlineColor(code), hub, cc, real:false, startup:true, founded:S.time, fleet, cash:rnd(12e6,45e6), rep:48, safety:+rnd(0.6,1.1).toFixed(2), routes:0, crashes:0, incidents:0, status:'ok', debt:0, pax:0, hist:[] };
  ai.list.push(e); ai.ver++;
  for(let i=0,n=rndi(2,4);i<n;i++) aiRoute(e,'open');
  aiNews(`🆕 Nouvelle compagnie : ${name} (${code}) démarre à ${keyCity(hub)} (${COUNTRIES[cc][0]}) avec ${fleet} avion${fleet>1?'s':''} et ${e.routes} ligne${e.routes>1?'s':''}.`,'news',true);
}

/* ---------- classement ---------- */
function aiRows(){
  const me={name:S.company.name, code:S.company.code, value:fleetValue()+Math.max(0,S.cash), fleet:S.fleet.length, me:true, color:S.company.color, hub:S.company.hub, routes:S.routes.length, pax:typeof marketStatsCache==='function'? marketStatsCache().playerDaily : 0, rep:S.reputation, crashes:S.stats.crashes||0};
  const others=aiAlive().map(e=>({name:e.name, code:e.code, value:e.fleet*40e6+Math.max(0,e.cash), fleet:e.fleet, color:e.color, hub:e.hub, routes:e.routes, pax:e.pax||Math.round(e.fleet*520*(0.6+e.rep/150)), rep:e.rep, crashes:e.crashes, incidents:e.incidents, startup:e.startup, e, R:(S.rivals||[]).find(x=>x.code===e.code)}));
  const rows=[me,...others].sort((a,b)=>b.value-a.value);
  rows.forEach((r,i)=>{ r.rank=i+1; const p=S.ai&&S.ai.rank[r.code]; r.delta=p? p-(i+1) : 0; });
  return rows;
}
function aiRanking(){
  const rows=aiRows(), ai=S.ai, prev=ai.rank, newRank={};
  rows.forEach(r=>newRank[r.code]=r.rank);
  const me=rows.find(r=>r.me);
  if(ai.myRank && me.rank!==ai.myRank && Math.abs(me.rank-ai.myRank)<=3){
    const better=me.rank<ai.myRank, other=better? rows[me.rank] : rows[me.rank-2];
    if(other) aiNews(better? `📈 Vous passez ${me.rank}ᵉ au classement mondial en dépassant ${other.name} !` : `📉 ${other.name} vous dépasse : vous êtes ${me.rank}ᵉ.`, better?'ok':'warn', true);
  }
  ai.myRank=me.rank;
  const top=rows.slice(0,5);
  for(const r of top){ const p=prev[r.code]; if(p&&p>5&&!r.me) aiNews(`📈 ${r.name} entre dans le top 5 mondial.`,'news'); }
  ai.rank=newRank;
}

/* ---------- écran « Actualités » ---------- */
const trendArrow=d=>d>0?`<span class="pos">▲${d}</span>`:d<0?`<span class="neg">▼${-d}</span>`:'<span class="mut">•</span>';
function sparkline(h,w=70,hh=20){
  if(!h||h.length<3) return '';
  const mn=Math.min(...h), mx=Math.max(...h), r=(mx-mn)||1;
  const pts=h.map((v,i)=>`${(i/(h.length-1)*w).toFixed(1)},${(hh-2-(v-mn)/r*(hh-4)).toFixed(1)}`).join(' ');
  const up=h[h.length-1]>=h[0];
  return `<svg width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}"><polyline points="${pts}" fill="none" stroke="${up?'#34d399':'#f87171'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
const feedRows=(list,n)=>list.slice(0,n).map(l=>`<div class="lg ${l.kind}"><span class="mut">${fmtDate(l.t)}</span> ${l.text}</div>`).join('')||'<div class="mut small">Rien à signaler pour l’instant. Laissez le temps passer…</div>';
function pNews(){
  const ai=S.ai; if(!ai) return '<div class="mut">Les actualités arrivent bientôt.</div>';
  const t=UI.newsTab||'actu';
  const chips=[['actu','📰 Actualités'],['rank','🏆 Classement'],['secu','🛡️ Sécurité'],['new','🆕 Nouvelles / faillites'],['avis','⭐ Avis passagers'],['apt','🏢 Aéroports']].map(([k,l])=>`<button class="chip ${t===k?'on':''}" data-act="newsTab" data-k="${k}">${l}</button>`).join('');
  let body='';
  if(t==='actu'){
    body=`<div class="simplehelp">Les compagnies du monde vivent leur vie : elles commandent des avions, ouvrent ou ferment des lignes, ont des accidents, font faillite… Parfois sur <b>votre</b> marché.</div><div class="log big">${feedRows(ai.news,60)}</div>`;
  } else if(t==='rank'){
    const rows=aiRows();
    body=`<div class="tblwrap"><table class="tbl rank"><tr><th>#</th><th>Compagnie</th><th>Flotte</th><th>Lignes</th><th>Valeur</th><th>Tendance</th></tr>${rows.slice(0,40).map((c,i)=>`<tr class="${c.me?'me':'click'}" ${c.me?'':`data-act="airlineCard" data-c="${c.code}"`}><td>${['🥇','🥈','🥉'][i]||i+1} ${trendArrow(c.delta)}</td><td><span class="dot" style="background:${c.color}"></span><b>${esc(c.name)}</b>${c.startup?' <span class="badge">🆕</span>':''}${c.crashes?` <span class="mut" title="accidents graves">💥${c.crashes}</span>`:''}<br><span class="small mut">${flag(c.hub)} ${esc(AP(c.hub).city)}</span></td><td>${num(c.fleet)}</td><td>${num(c.routes)}</td><td>${fmtMoney(c.value)}</td><td>${c.e?sparkline(c.e.hist):''}</td></tr>`).join('')}</table></div><div class="small mut">Valeur = flotte + trésorerie. Mise à jour chaque semaine.</div>`;
  } else if(t==='apt'){
    body=airportsTabHtml();
  } else if(t==='avis'){
    body=typeof reviewsHtml==='function'?reviewsHtml():'';
  } else if(t==='secu'){
    const bad=aiAlive().concat(S.ai.list.filter(e=>e.status==='dead')).filter(e=>e.crashes+e.incidents>0).sort((x,y)=>y.crashes-x.crashes||y.incidents-x.incidents).slice(0,10);
    const safe=aiAlive().filter(e=>e.crashes===0&&e.fleet>=30).sort((x,y)=>y.fleet-x.fleet).slice(0,6);
    const sevTxt={fatal:'💥 Crash mortel',hull:'🔥 Avion détruit',incident:'⚠️ Incident'};
    body=`<h3>Les compagnies les plus touchées</h3>${bad.length?`<table class="tbl"><tr><th>Compagnie</th><th>Accidents</th><th>Incidents</th><th>Flotte</th></tr>${bad.map(e=>`<tr><td><span class="dot" style="background:${e.color}"></span>${esc(e.name)}${e.status==='dead'?' <span class="badge bad">disparue</span>':''}</td><td><b class="${e.crashes?'neg':''}">💥 ${e.crashes}</b></td><td>⚠️ ${e.incidents}</td><td>${e.fleet}</td></tr>`).join('')}</table>`:'<div class="mut small">Aucun accident pour l’instant.</div>'}
    <h3>Derniers accidents</h3><div class="log">${ai.crashes.slice(0,12).map(c=>`<div class="lg ${c.sev==='fatal'?'bad':c.sev==='hull'?'warn':''}"><span class="mut">${fmtDate(c.t)}</span> ${sevTxt[c.sev]} — <b>${esc(c.name)}</b>, ${c.model}, ${keyCity(c.a)} → ${keyCity(c.b)}${c.victims?` · ${c.victims} victimes`:''}</div>`).join('')||'<div class="mut small">Aucun accident récent.</div>'}</div>
    <h3>Les grandes compagnies sans accident grave</h3><div class="chips">${safe.map(e=>`<span class="chip"><span class="dot" style="background:${e.color}"></span>${esc(e.name)} · ${e.fleet} avions</span>`).join('')||'<span class="mut small">—</span>'}</div>
    <div class="small mut" style="margin-top:8px">Vous-même : la sécurité de vos vols dépend de l’entretien de vos avions (condition technique) et de vos pilotes.</div>`;
  } else {
    const young=S.ai.list.filter(e=>e.startup&&e.status!=='dead'), dead=S.ai.list.filter(e=>e.status==='dead').sort((x,y)=>y.deadAt-x.deadAt).slice(0,12);
    body=`<h3>Jeunes compagnies en lice</h3>${young.length?young.map(e=>`<div class="card small"><span class="dot" style="background:${e.color}"></span><b>${esc(e.name)}</b> <span class="mut">${e.code}</span> — ${flag(e.hub)} ${esc(AP(e.hub).city)}, ${COUNTRIES[e.cc][0]}<br>${e.fleet} avion(s) · ${e.routes} ligne(s) · fondée il y a ${Math.max(1,Math.round((S.time-e.founded)/DAY))} j · ${e.debt?'<span class="neg">en difficulté</span>':'<span class="pos">en bonne santé</span>'}</div>`).join(''):'<div class="mut small">Aucune pour l’instant : de nouvelles compagnies apparaissent régulièrement, surtout dans les pays peu desservis.</div>'}
    <h3>Faillites et disparitions</h3>${dead.length?dead.map(e=>`<div class="card small"><span class="dot" style="background:#6b7280"></span><b>${esc(e.name)}</b> — ${fmtDate(e.deadAt)} · ${flag(e.hub)} ${esc(AP(e.hub).city)}${e.startup?' · jeune compagnie':''}</div>`).join(''):'<div class="mut small">Aucune faillite pour l’instant.</div>'}`;
  }
  return `<div class="chips">${chips}</div>${body}`;
}
function registerNewsActions(){ Object.assign(ACTIONS,{ newsTab:d=>{ UI.newsTab=d.k; renderPanel(); } }); }

/* ============================================================
   CLIMAT DES PAYS : colère sociale, crises, booms touristiques
   Quand un pays s'énerve, la demande baisse, les compagnies étrangères
   suspendent leurs vols, l'aéroport peut fermer. Quand il explose
   (festival, saison, pétrole…), on voit beaucoup plus d'avions.
   ============================================================ */
const _calm={tension:0,boom:0,note:''};
const moodOf=cc=>(S.ai&&S.ai.mood&&S.ai.mood[cc])||_calm;
function moodDemand(cc){ const m=S.ai&&S.ai.mood&&S.ai.mood[cc]; if(!m) return 1; return clamp(1-m.tension*0.55+m.boom*0.45,0.35,1.6); }
function moodTraffic(cc){ const m=S.ai&&S.ai.mood&&S.ai.mood[cc]; if(!m) return 1; return moodDemand(cc)*((m.surge||0)>S.time?1.7:1); }
function routeMoodFreq(r){ if(!S.ai||!S.ai.mood||!Object.keys(S.ai.mood).length) return r.freq; const f=Math.sqrt(moodTraffic(AP(r.a).cc)*moodTraffic(AP(r.b).cc)); return clamp(Math.round(r.freq*f*(f>1?1.35:1)-0.2),0,5); }
function moodLabel(m){ return m.tension>0.7?'🔴 Très tendu':m.tension>0.4?'🟠 Tendu':m.tension>0.15?'🟡 Agité':m.boom>0.5?'🟢 En plein essor':m.boom>0.2?'🟢 Dynamique':'⚪ Calme'; }
const mainAirport=cc=>cAirports(cc).find(c=>AP(c).cls>=2)||cAirports(cc)[0];
const ccName=cc=>COUNTRIES[cc]?COUNTRIES[cc][0]:cc;
const ccWith=cc=>`${COUNTRIES[cc][2]} ${COUNTRIES[cc][0]}`;
const mineCountry=cc=>S.hubs.some(h=>AP(h).cc===cc)||S.routes.some(r=>r.stops.some(c=>AP(c).cc===cc));
// choisit une formulation différente de la précédente pour un même type d'actualité
function vary(type, list){ const L=S.ai.last||(S.ai.last={}); let i=Math.floor(Math.random()*list.length); if(list.length>1&&i===L[type]) i=(i+1)%list.length; L[type]=i; return list[i]; }
const homeOf=c=>{ const a=typeof AIRLINE_DB!=='undefined'&&AIRLINE_DB[c]; if(a) return a[1]; const e=aiBy(c); return e?e.cc:''; };

function shutAirport(code,days,why){ const ai=S.ai; ai.shut=ai.shut||{}; ai.shut[code]=S.time+days*DAY; }
function suspendFlights(cc,weeks){
  const ai=S.ai; ai.suspend=ai.suspend||{}; ai.suspend[cc]=Math.max(ai.suspend[cc]||0,S.time+weeks*7*DAY); ai.ver++;
  const hub=mainAirport(cc), names=airlinesAt(hub).filter(([c])=>homeOf(c)!==cc).slice(0,3).map(([c])=>airlineName(c));
  return names;
}
function moodWeekly(){
  const ai=S.ai; ai.mood=ai.mood||{}; ai.suspend=ai.suspend||{}; ai.shut=ai.shut||{};
  for(const [cc,m] of Object.entries(ai.mood)){ m.tension*=0.9; m.boom*=0.93; if(m.tension<0.04&&m.boom<0.04&&!(m.surge>S.time)) delete ai.mood[cc]; }
  for(const [cc,u] of Object.entries(ai.suspend)) if(u<=S.time){ delete ai.suspend[cc]; ai.ver++; aiNews(vary('resume',[`✅ Les compagnies étrangères reprennent leurs vols vers ${ccName(cc)}.`,`🛫 Retour au calme en ${ccName(cc)} : les liaisons internationales reprennent.`,`✅ ${ccName(cc)} : fin des suspensions de vols, les avions reviennent.`]),'news',mineCountry(cc)); }
  for(const [code,u] of Object.entries(ai.shut)) if(u<=S.time){ delete ai.shut[code]; aiNews(`🛬 L’aéroport de ${keyCity(code)} rouvre aux vols.`,'news',S.hubs.includes(code)); }
  if(Math.random()<0.22) moodEpisode();
}
function moodEpisode(){
  const ai=S.ai, ccs=Object.keys(COUNTRIES).filter(cc=>cAirports(cc).length&&countryTraffic(cc)>0.3);
  const r=Math.random(), type=r<0.42?'unrest':r<0.74?'boom':r<0.85?'strike':r<0.9?'crisis':'event';
  const w=ccs.map(cc=>{ const lv=incomeOf(cc), t=Math.sqrt(countryTraffic(cc)+1); return type==='unrest'||type==='crisis'? t*(lv<=1?2.4:lv===2?1.4:0.6) : t*(lv>=2?1.3:1); });
  let x=Math.random()*w.reduce((s,v)=>s+v,0), cc=ccs[0]; for(let i=0;i<ccs.length;i++){ x-=w[i]; if(x<=0){ cc=ccs[i]; break; } }
  const m=ai.mood[cc]||(ai.mood[cc]={tension:0,boom:0,note:''}), hub=mainAirport(cc), city=keyCity(hub), C=ccWith(cc), mine=mineCountry(cc);
  if(type==='unrest'){
    const reasons=S.oil>98?['la flambée du prix des carburants','la hausse du coût de la vie','une réforme contestée']:['la hausse du coût de la vie','une réforme contestée','une élection contestée','des licenciements massifs','des coupures d’électricité','la corruption'];
    const why=pick(reasons); m.tension=clamp(m.tension+rnd(0.3,0.7),0,1); m.note=why;
    let txt=vary('unrest',[`✊ ${C} : la colère gronde à ${city} (${why}) — routes bloquées, l’aéroport tourne au ralenti.`,`🔥 Manifestations à ${city} (${ccName(cc)}) contre ${why} ; moins de voyageurs à l’aéroport.`,`📣 Mouvement social en ${ccName(cc)} : ${why}. Les compagnies surveillent la situation de près.`]);
    if(m.tension>0.65){ shutAirport(hub,rndi(2,6)); const names=suspendFlights(cc,rndi(2,5)); txt+=` L’aéroport de ${city} ferme quelques jours${names.length?` et ${names.join(', ')} suspendent leurs vols`:''}.`; }
    aiNews(txt,'warn',mine||m.tension>0.8);
  } else if(type==='crisis'){
    m.tension=0.97; m.surge=S.time+rndi(10,21)*DAY; m.note='crise politique';
    shutAirport(hub,rndi(5,14)); const names=suspendFlights(cc,rndi(4,10));
    aiNews(vary('crisis',[`🚨 ${C} : coup de force à ${city}, l’espace aérien est fermé. Des vols d’évacuation s’organisent.`,`🚨 Crise politique en ${ccName(cc)} : l’aéroport de ${city} est fermé${names.length?`, ${names.join(' et ')} annulent leurs vols`:''}. Pont aérien pour évacuer les étrangers.`]),'bad',true);
  } else if(type==='boom'){
    const why=pick(['la pleine saison touristique','un grand festival','une compétition sportive continentale','la découverte d’un gisement de pétrole','un sommet international','les vacances scolaires','une libéralisation des visas','un concert géant']);
    m.boom=clamp(m.boom+rnd(0.3,0.65),0,1); m.note=why; m.surge=S.time+rndi(10,24)*DAY;
    const big=aiAlive().filter(e=>e.fleet>=40&&e.cc!==cc).sort(()=>Math.random()-0.5).slice(0,rndi(2,4)); const added=[];
    for(const e of big){ const k=pairKey(e.hub,hub); if(carriersOn(e.hub,hub).includes(e.code)||dist(e.hub,hub)>9500||dist(e.hub,hub)<250) continue;
      (ai.extra[e.code]=ai.extra[e.code]||[]).push(k); e.routes++; ai.ver++; added.push(e.name); }
    aiNews(vary('boom',[`🎉 ${C} : ${why} — les réservations explosent, ${added.length?added.join(' et ')+' ajoutent des vols':'les compagnies ajoutent des vols'}.`,`📈 ${ccName(cc)} en effervescence (${why}) : avions pleins vers ${city}${added.length?` ; ${added[0]} ouvre une ligne`:''}.`,`🌟 ${why[0].toUpperCase()+why.slice(1)} en ${ccName(cc)} : la demande grimpe de ${Math.round(m.boom*55+10)} % vers ${city}.`]),'ok',mine);
  } else if(type==='strike'){
    shutAirport(hub,rndi(1,3)); m.tension=clamp(m.tension+0.25,0,1); m.note='grève du contrôle aérien';
    aiNews(vary('strike',[`⛔ Grève des contrôleurs aériens en ${ccName(cc)} : l’aéroport de ${city} cloué au sol quelques jours.`,`⛔ ${city} : grève surprise du personnel d’aéroport, vols annulés.`]),'warn',mine);
  } else {
    m.boom=clamp(m.boom+rnd(0.2,0.4),0,1); m.note='grand événement'; m.surge=S.time+rndi(7,14)*DAY;
    aiNews(`🎪 ${city} accueille un grand événement international : ciel chargé en ${ccName(cc)} ces prochaines semaines.`,'news',mine);
  }
}

/* ---------- histoires qui se déroulent sur plusieurs semaines ---------- */
const CAUSES=['une défaillance moteur','une erreur de maintenance','des conditions météo extrêmes','le givrage des sondes','la fatigue de l’équipage','un incendie de batterie','un défaut de formation'];
function storyStart(type,data){ const ai=S.ai; (ai.stories=ai.stories||[]).push({type,...data,due:S.time+(data.in||14)*DAY}); }
function storiesWeekly(){
  const ai=S.ai; if(!ai.stories) return;
  for(const st of ai.stories.slice()){
    if(st.due>S.time) continue; const e=aiBy(st.code);
    if(st.type==='probe'){
      if(st.stage===undefined){ st.stage=1; st.due=S.time+rndi(14,30)*DAY; const c=pick(CAUSES); st.cause=c;
        aiNews(vary('probe',[`🔎 Enquête sur le crash de ${st.name} : les premiers éléments pointent ${c}.`,`🔎 ${st.name} : le rapport préliminaire évoque ${c}.`]),'news',st.big);
      } else { ai.stories=ai.stories.filter(x=>x!==st);
        if(e&&e.status!=='dead'){ const f=Math.max(1,Math.round(e.fleet*0.04)); e.cash-=f*3e6; e.rep=clamp(e.rep-2,10,95);
          aiNews(vary('probe2',[`⚖️ ${e.name} : les autorités imposent un audit et immobilisent ${f} appareil${f>1?'s':''} après l’accident.`,`⚖️ Après l’accident, ${e.name} est sommée de revoir sa maintenance (${st.cause}).`]),'news',e.fleet>=60); } }
    } else if(st.type==='strike'){
      if(!e||e.status==='dead'){ ai.stories=ai.stories.filter(x=>x!==st); continue; }
      if(st.stage===0){ st.stage=1; st.due=S.time+rndi(5,9)*DAY; const l=e.fleet*rnd(1e6,3.5e6); e.cash-=l; e.rep=clamp(e.rep-2,10,95);
        aiNews(vary('strike2',[`✊ Grève chez ${e.name} : des centaines de vols annulés (pertes ≈ ${fmtMoney(l)}).`,`✊ ${e.name} paralysée par la grève des ${st.who}.`]),'warn',e.fleet>=80);
      } else { ai.stories=ai.stories.filter(x=>x!==st); aiNews(`🤝 Accord chez ${e.name} : la grève des ${st.who} est levée, les vols reprennent.`,'news',false); }
    } else if(st.type==='merger'){
      ai.stories=ai.stories.filter(x=>x!==st); const a=aiBy(st.code), b=aiBy(st.other);
      if(!a||!b||a.status==='dead'||b.status==='dead') continue;
      if(Math.random()<0.6){ a.fleet+=Math.round(b.fleet*0.75); a.routes+=Math.round(b.routes*0.5); b.status='dead'; b.deadAt=S.time; ai.ver++; if(S.rivals) S.rivals=S.rivals.filter(R=>R.code!==b.code);
        aiNews(`🤝 C’est officiel : ${a.name} et ${b.name} fusionnent (${a.fleet} avions).`,'news',true);
      } else aiNews(`🙅 ${b.name} dément tout rapprochement avec ${a.name}.`,'news',false);
    }
  }
}
function storiesRandom(){
  const ai=S.ai, alive=aiAlive(); ai.stories=ai.stories||[];
  if(Math.random()<0.05){ const e=pick(alive.filter(x=>x.fleet>=15)); if(e&&!ai.stories.some(s=>s.code===e.code&&s.type==='strike')){ const who=pick(['pilotes','hôtesses et stewards','mécaniciens','personnels au sol']);
    storyStart('strike',{code:e.code,stage:0,who,in:rndi(6,12)}); aiNews(vary('strike1',[`📢 Préavis de grève des ${who} chez ${e.name}.`,`📢 ${e.name} : les ${who} menacent de débrayer, négociations tendues.`]),'news',false); } }
  if(Math.random()<0.03){ const weak=alive.filter(e=>e.cash<e.fleet*4e6&&e.fleet<80), strong=alive.filter(e=>e.fleet>=40&&e.cash>e.fleet*10e6);
    if(weak.length&&strong.length){ const a=pick(strong), b=pick(weak.filter(w=>w.code!==a.code)); if(b){ storyStart('merger',{code:a.code,other:b.code,in:rndi(21,35)}); aiNews(`🗞️ Rumeurs : ${a.name} serait en discussion pour racheter ${b.name}.`,'news',false); } } }
  if(Math.random()<0.04){ const a=pick(alive.filter(e=>e.fleet>=30)), b=pick(alive.filter(e=>e.fleet>=30&&e.code!==(a&&a.code)));
    if(a&&b){ a.rep=clamp(a.rep+1,10,95); b.rep=clamp(b.rep+1,10,95); aiNews(`🔗 ${a.name} et ${b.name} signent un accord de partage de codes.`,'news',false); } }
  if(Math.random()<0.03){ const e=pick(alive.filter(x=>x.fleet>=40)); if(e){ e.rep=clamp(e.rep+2,10,95); aiNews(vary('award',[`🏅 ${e.name} élue « meilleure compagnie de la région » par les voyageurs.`,`🏅 ${e.name} dévoile sa nouvelle cabine : classe affaires remise à neuf.`,`🏅 ${e.name} annonce un programme de fidélité renforcé pour reconquérir ses clients.`]),'news',false); } }
  // carburant
  if(S.oil>105&&Math.random()<0.25&&!(ai.lastOilNews>S.time-56*DAY)){ ai.lastOilNews=S.time; for(const e of alive.filter(x=>x.cash<x.fleet*8e6).slice(0,3)) aiRoute(e,'close');
    aiNews(`⛽ Kérosène à ${S.oil.toFixed(0)} $ : plusieurs compagnies réduisent leurs vols les moins rentables.`,'warn',true); }
  else if(S.oil<62&&Math.random()<0.25&&!(ai.lastOilNews>S.time-56*DAY)){ ai.lastOilNews=S.time; for(const e of alive) e.cash+=e.fleet*0.4e6;
    aiNews(`⛽ Le kérosène s’effondre : les compagnies engrangent des bénéfices records.`,'ok',false); }
}

/* ---------- fiche d'une compagnie concurrente et classement des aéroports ---------- */
function airlineCardHtml(code){
  const e=aiBy(code); if(!e) return '<div class="mut">Compagnie inconnue.</div>';
  const pairs=airlinePairs(code), top=pairs.map(([a,b])=>({a,b,d:marketDemand(a,b)})).sort((x,y)=>y.d-x.d).slice(0,6);
  const news=S.ai.news.filter(n=>n.text.includes(e.name)).slice(0,8), crashes=S.ai.crashes.filter(c=>c.code===code).slice(0,4);
  const clash=S.routes.filter(r=>carriersOn(r.stops[0],r.stops[r.stops.length-1]).includes(code));
  const rows=aiRows(), rk=(rows.find(r=>r.code===code)||{}).rank, kind=e.startup?'jeune compagnie':LCC.has(code)?'low-cost':PREMIUM.has(code)?'compagnie premium':'compagnie classique';
  const kv=(k,v)=>`<div class="kpi"><div class="kl">${k}</div><div class="kv">${v}</div></div>`;
  return `<div class="row"><span class="dot big" style="background:${e.color}"></span><div class="grow"><h2 style="margin:0">${esc(e.name)} <span class="mut">${e.code}</span></h2><div class="small mut">${flag(e.hub)} ${esc(AP(e.hub).city)} · ${COUNTRIES[e.cc]?COUNTRIES[e.cc][0]:''} · ${kind}${e.status==='dead'?' · <b class="neg">disparue</b>':''}</div></div></div>
  <div class="kpis">${kv('Classement',rk?`${rk}ᵉ mondial`:'—')}${kv('Flotte',num(e.fleet)+' avions')}${kv('Lignes',num(e.routes))}${kv('Passagers/j',num(e.pax))}${kv('Réputation',stars(e.rep))}${kv('Trésorerie',`<span class="${e.cash<0?'neg':''}">${fmtMoney(e.cash)}</span>`)}${kv('Accidents',`💥 ${e.crashes} · ⚠️ ${e.incidents}`)}${kv('Stratégie',typeof personaOf==='function'?({lcc:'prix bas agressifs',premium:'qualité de service',startup:'conquête',legacy:'réseau mondial'})[personaOf(code).k]:'—')}</div>
  ${e.hist&&e.hist.length>3?`<div class="card"><div class="small mut">Valeur de la compagnie (40 dernières semaines)</div>${sparkline(e.hist,300,50)}</div>`:''}
  ${clash.length?`<div class="al warn">⚔️ Elle vous concurrence sur ${clash.length} ligne(s) : ${clash.slice(0,4).map(r=>r.stops.join('⇄')).join(', ')}.</div>`:''}
  <h3>Ses plus grandes lignes</h3><table class="tbl"><tr><th>Ligne</th><th>Voyageurs/j</th></tr>${top.map(t=>`<tr><td>${flag(t.a)} ${esc(AP(t.a).city)} → ${esc(AP(t.b).city)}</td><td>${num(t.d)}</td></tr>`).join('')||'<tr><td colspan="2" class="mut">Réseau en construction.</td></tr>'}</table>
  ${crashes.length?`<h3>Accidents</h3>${crashes.map(c=>`<div class="small">${fmtDate(c.t)} · ${c.sev==='fatal'?'💥 mortel':c.sev==='hull'?'🔥 avion détruit':'⚠️ incident'} · ${c.model} · ${esc(keyCity(c.a))} → ${esc(keyCity(c.b))}</div>`).join('')}`:''}
  <h3>Dernières nouvelles</h3><div class="log">${news.map(n=>`<div class="lg ${n.kind}"><span class="mut">${fmtDate(n.t)}</span> ${n.text}</div>`).join('')||'<div class="mut small">Rien de récent.</div>'}</div>
  ${(S.rivals||[]).some(r=>r.code===code)?`<div class="btns"><button class="btn gold" data-tab="bourse">📈 Acheter des actions</button></div>`:''}`;
}
let _apRank=null;
function airportRanking(){ return _apRank||(_apRank=AIRPORT_CODES.slice().sort((a,b)=>AP(b).traffic-AP(a).traffic)); }
const airportRank=code=>airportRanking().indexOf(code)+1;
function airportsTabHtml(){
  const top=airportRanking().slice(0,25), mine=S.hubs;
  return `<div class="simplehelp">🏢 Les aéroports les plus fréquentés du monde (en passagers par an). Votre hub peut-il passer n°1 ?</div>
  ${mine.map(h=>`<div class="card gold-b"><b>${flag(h)} ${esc(AP(h).city)}</b> <span class="mut">${h}</span> — <b>n° ${airportRank(h)}</b> mondial · ${AP(h).traffic>=1?AP(h).traffic+' M':Math.round(AP(h).traffic*1000)+' k'} passagers/an</div>`).join('')}
  <table class="tbl"><tr><th>#</th><th>Aéroport</th><th>Passagers/an</th><th>Climat</th></tr>${top.map((c,i)=>`<tr class="${mine.includes(c)?'me':''}" data-act="openAp" data-c="${c}"><td>${i+1}</td><td>${flag(c)} <b>${esc(AP(c).city)}</b> <span class="mut">${c}</span></td><td>${AP(c).traffic} M</td><td>${moodLabel(moodOf(AP(c).cc))}</td></tr>`).join('')}</table>`;
}
function registerAirlineActions(){ Object.assign(ACTIONS,{ airlineCard:d=>{ showModal('🏢 Compagnie', airlineCardHtml(d.c), true); } }); }
