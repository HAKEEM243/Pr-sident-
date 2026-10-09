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
  return { code, name:a[0], color:airlineColor(code), hub:a[2], cc:AP(a[2]).cc, real:true, fleet, cash:fleet*rnd(3e6,22e6), rep:Math.round(rnd(46,78)), skill:+rnd(-0.4,0.25).toFixed(2),
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
  if(ai.news.length>150) ai.news.length=150;
  if(important) logMsg(text, kind==='news'?'info':kind);
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
    if(notable) aiNews(`🛫 ${e.name} ouvre ${keyCity(origin)} → ${keyCity(best.c)}${mine?' — sur votre marché !':''}.`, mine?'rival':'news', mine);
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
    if(notable) aiNews(`✂️ ${e.name} ferme ${keyCity(a)} → ${keyCity(b)} (ligne peu rentable)${mine?' — votre concurrent se retire !':''}.`, mine?'rival':'news', mine);
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
  if(sev==='fatal') aiNews(`💥 CRASH — ${e.name} : un ${m.name} s’écrase près de ${keyCity(where)} (${keyCity(a)} → ${keyCity(b)}), ${victims} victime${victims>1?'s':''}. Réputation en chute.`,'bad',true);
  else if(sev==='hull') aiNews(`🔥 ${e.name} : sortie de piste à ${keyCity(where)}, un ${m.name} est détruit (pas de victime).`,'warn',e.fleet>=60);
  else aiNews(`⚠️ ${e.name} : atterrissage d’urgence d’un ${m.name} à ${keyCity(where)}.`,'news');
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
  const others=aiAlive().map(e=>({name:e.name, code:e.code, value:e.fleet*40e6+Math.max(0,e.cash), fleet:e.fleet, color:e.color, hub:e.hub, routes:e.routes, pax:e.pax, rep:e.rep, crashes:e.crashes, incidents:e.incidents, startup:e.startup, e, R:(S.rivals||[]).find(x=>x.code===e.code)}));
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
  const chips=[['actu','📰 Actualités'],['rank','🏆 Classement'],['secu','🛡️ Sécurité'],['new','🆕 Nouvelles / faillites']].map(([k,l])=>`<button class="chip ${t===k?'on':''}" data-act="newsTab" data-k="${k}">${l}</button>`).join('');
  let body='';
  if(t==='actu'){
    body=`<div class="simplehelp">Les compagnies du monde vivent leur vie : elles commandent des avions, ouvrent ou ferment des lignes, ont des accidents, font faillite… Parfois sur <b>votre</b> marché.</div><div class="log big">${feedRows(ai.news,60)}</div>`;
  } else if(t==='rank'){
    const rows=aiRows();
    body=`<div class="tblwrap"><table class="tbl rank"><tr><th>#</th><th>Compagnie</th><th>Flotte</th><th>Lignes</th><th>Valeur</th><th>Tendance</th></tr>${rows.slice(0,40).map((c,i)=>`<tr class="${c.me?'me':''}"><td>${['🥇','🥈','🥉'][i]||i+1} ${trendArrow(c.delta)}</td><td><span class="dot" style="background:${c.color}"></span><b>${esc(c.name)}</b>${c.startup?' <span class="badge">🆕</span>':''}${c.crashes?` <span class="mut" title="accidents graves">💥${c.crashes}</span>`:''}<br><span class="small mut">${flag(c.hub)} ${esc(AP(c.hub).city)}</span></td><td>${num(c.fleet)}</td><td>${num(c.routes)}</td><td>${fmtMoney(c.value)}</td><td>${c.e?sparkline(c.e.hist):''}</td></tr>`).join('')}</table></div><div class="small mut">Valeur = flotte + trésorerie. Mise à jour chaque semaine.</div>`;
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
if(typeof ACTIONS!=='undefined') Object.assign(ACTIONS,{ newsTab:d=>{ UI.newsTab=d.k; renderPanel(); } });
