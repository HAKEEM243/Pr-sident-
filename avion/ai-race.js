/* =========================================================
   Sky Empire — 🏁 la course au sommet
   Personne ne vise le joueur en particulier : chaque compagnie veut
   être PREMIÈRE dans son pays (et dans le monde). Toutes contre toutes.
   Chaque semaine, chaque compagnie regarde le classement de son pays
   et s'attaque à celle juste au-dessus d'elle (la n°1 se défend contre
   la n°2) — que ce soit une autre IA ou vous.
   • elle ouvre des lignes sur le réseau de sa cible ;
   • elle lance des guerres des prix (qui coûtent cher aux deux) ;
   • elle s'endette pour acheter des avions si elle est ambitieuse.
   Celles qui se ruinent font faillite : leurs avions disparaissent de
   la carte et leurs lignes se libèrent. Tout est fictif.
   ========================================================= */
'use strict';
const RACE_TXT={open:'ouvre une ligne sur son réseau',war:'lance une guerre des prix',fleet:'achète des avions à crédit',defend:'défend sa place'};
function raceAmb(e){ if(e.amb===undefined){ e.amb=+(0.35+(hashStr(e.code)%65)/100+(e.startup?0.15:0)).toFixed(2); e.amb=Math.min(1,e.amb); } return e.amb; }
// classements par pays (vous compris, dans le pays de votre siège)
function raceTables(){
  const rows=aiRows(), home=homeCC(), by={};
  for(const r of rows){ const cc=r.me?home:r.e&&r.e.cc; if(!cc) continue; (by[cc]=by[cc]||[]).push(r); }
  return by;
}
const raceHubOf=row=>row.me?((S.hubs||[]).slice().sort((a,b)=>AP(b).traffic-AP(a).traffic)[0]||S.company.hub):row.e.hub;
function racePairsOf(row){
  if(row.me) return (S.routes||[]).filter(r=>typeof routeAircraft!=='function'||routeAircraft(r).length).map(r=>[r.stops[0],r.stops[r.stops.length-1]]);
  const cut=new Set((S.ai.cut||{})[row.code]||[]);
  return [...airlinePairs(row.code),...((S.ai.extra||{})[row.code]||[]).map(k=>[k.slice(0,3),k.slice(3)])].filter(([a,b])=>AP(a)&&AP(b)&&!cut.has(pairKey(a,b)));
}
const raceR=code=>(S.rivals||[]).find(x=>x.code===code);
function raceAddPair(e,a,b,freq){ const key=pairKey(a,b); if(carriersOn(a,b).includes(e.code)) return false;
  (S.ai.extra[e.code]=S.ai.extra[e.code]||[]).push(key); if(S.ai.cut[e.code]) S.ai.cut[e.code]=S.ai.cut[e.code].filter(k=>k!==key); e.routes++; S.ai.ver++;
  const R=raceR(e.code); if(R&&!R.routes.some(x=>pairKey(x.a,x.b)===key)){ R.routes.push({a,b,freq:freq||2}); R._v=(R._v||0)+1; } return true; }
function raceDropPair(e,a,b){ const key=pairKey(a,b);
  if((S.ai.extra[e.code]||[]).includes(key)) S.ai.extra[e.code]=S.ai.extra[e.code].filter(k=>k!==key); else (S.ai.cut[e.code]=S.ai.cut[e.code]||[]).push(key);
  e.routes=Math.max(0,e.routes-1); S.ai.ver++; const R=raceR(e.code); if(R){ R.routes=R.routes.filter(x=>pairKey(x.a,x.b)!==key); R._v=(R._v||0)+1; } }
// les nouvelles : votre pays et ceux où vous volez ; ailleurs, seulement les géants (le reste reste visible dans l'onglet 🏁 Course)
const raceLoud=(cc,big)=>cc===homeCC()||(typeof mineCountry==='function'&&mineCountry(cc))||(big&&Math.random()<0.25);

/* ---------- attaques ---------- */
// 1. s'installer sur le réseau de la cible (au départ de son hub ou sur sa meilleure ligne)
function raceOpen(e,tg,cc){
  const maxD=e.fleet>=60?9000:e.fleet>=15?5000:2600, pairs=racePairsOf(tg).filter(([a,b])=>dist(a,b)<=maxD&&dist(a,b)>150&&!carriersOn(a,b).includes(e.code)&&!airspaceViolation(e.code,a,b)
    &&(typeof aiAirportMarketOpen!=='function'||(aiAirportMarketOpen(a)&&aiAirportMarketOpen(b)))&&(AP(a).cc===e.cc||AP(b).cc===e.cc||dist(e.hub,a)<1500));
  if(!pairs.length) return false; const [a,b]=pairs.sort((x,y)=>marketDemand(y[0],y[1])-marketDemand(x[0],x[1])).slice(0,6)[rndi(0,Math.min(5,pairs.length-1))];
  const cost=e.fleet<10?0.8e6:e.fleet<40?2e6:4e6; e.cash-=cost; if(!raceAddPair(e,a,b,2)) return false;
  if(raceLoud(cc,e.fleet>=150)) aiNews(`🏁 ${e.name} attaque ${tg.name} sur son terrain : nouvelle ligne ${keyCity(a)}–${keyCity(b)}. Objectif : la 1re place ${ccName(cc)==='—'?'':'en '+ccName(cc)}.`,tg.me?'rival':'news',tg.me);
  return true;
}
// 2. guerre des prix : coûte cher aux deux, la plus faible finit par céder la ligne
function raceWar(e,tg,cc){
  const shared=racePairsOf(tg).filter(([a,b])=>carriersOn(a,b).includes(e.code)||(tg.me&&carriersOn(a,b).includes(e.code)));
  let pair=shared.length?pick(shared):null;
  if(!pair){ if(!raceOpen(e,tg,cc)) return false; const ex=(S.ai.extra[e.code]||[]); const k=ex[ex.length-1]; pair=[k.slice(0,3),k.slice(3)]; }
  const [a,b]=pair, key=pairKey(a,b), until=S.time+rndi(14,35)*DAY;
  if(tg.me){ S.ai.wars=S.ai.wars||{}; if(S.ai.wars[e.code+key]||(typeof isAlly==='function'&&isAlly(e.code))) return false; S.ai.wars[e.code+key]={code:e.code,a,b,until,kind:'prix'}; }
  else { const F=S.ai.fights=S.ai.fights||{}, fk=e.code+'>'+tg.code+key; if(F[fk]) return false; F[fk]={att:e.code,def:tg.code,a,b,until,cc}; }
  if(raceLoud(cc,e.fleet>=150||tg.fleet>=150)) aiNews(`⚔️ Guerre des prix ${keyCity(a)}–${keyCity(b)} : ${e.name} contre ${tg.name}, pour la place de n°${Math.max(1,tg.rank)} ${ccName(cc)?'en '+ccName(cc):''}.`,tg.me?'rival':'news',tg.me||raceLoud(cc,false));
  return true;
}
// 3. course aux avions : les ambitieuses s'endettent (et peuvent s'y ruiner)
function raceFleet(e,cc){
  const n=Math.max(1,Math.round(e.fleet*rnd(0.04,0.1)*(0.5+raceAmb(e)))), price=n*rnd(5e6,9e6);
  if(e.cash-price<-e.fleet*4e6*raceAmb(e)) return false;    // même les plus folles ont une limite
  e.fleet+=n; e.cash-=price; const R=raceR(e.code); if(R) R.fleet=e.fleet;
  if(raceLoud(cc,e.fleet>=150)&&n>=2) aiNews(`🛒 ${e.name} achète ${n} avions${e.cash<0?' à crédit':''} pour monter au classement ${ccName(cc)?'en '+ccName(cc):''} (${e.fleet} au total).`,'news');
  return true;
}
// 4. la n°1 défend : vols en plus et prix cassés contre son poursuivant
function raceDefend(e,ch,cc){
  const F=S.ai.fights||{}; const hit=Object.values(F).find(f=>f.def===e.code&&f.until>S.time);
  if(hit&&!ch.me){ const fk=e.code+'>'+hit.att+pairKey(hit.a,hit.b); if(!F[fk]){ F[fk]={att:e.code,def:hit.att,a:hit.a,b:hit.b,until:hit.until,cc}; if(raceLoud(cc,e.fleet>=150)) aiNews(`🛡️ ${e.name}, n°1 ${ccName(cc)?'en '+ccName(cc):''}, riposte sur ${keyCity(hit.a)}–${keyCity(hit.b)} : prix cassés contre ${aiBy(hit.att)?aiBy(hit.att).name:hit.att}.`,'news'); return true; } }
  const R=raceR(e.code); if(R&&R.routes.length){ const rt=R.routes.filter(x=>x.a===e.hub||x.b===e.hub).sort((x,y)=>marketDemand(y.a,y.b)-marketDemand(x.a,x.b))[0]; if(rt&&(rt.freq||1)<9){ rt.freq=(rt.freq||1)+1; R._v=(R._v||0)+1; S.ai.ver++; return true; } }
  e.rep=clamp((e.rep||60)+1,10,95); e.cash-=e.fleet*0.2e6; return true;
}

/* ---------- semaine de course ---------- */
function raceWeekly(){
  const ai=S.ai; if(!ai||!ai.list) return; const D=typeof drive==='function'?drive():2, tables=raceTables(); ai.raceLead=ai.raceLead||{};
  for(const [cc,rows] of Object.entries(tables)){
    if(rows.length<2) continue;
    // changement de n°1 dans le pays
    const lead=rows[0], prev=ai.raceLead[cc];
    if(prev&&prev!==lead.code){ const old=rows.find(r=>r.code===prev); if(raceLoud(cc,lead.fleet>=150)) aiNews(`🥇 ${lead.me?'Vous devenez':lead.name+' devient'} n°1 ${ccName(cc)?'en '+ccName(cc):''}${old?`, devant ${old.me?'vous':old.name}`:''} !`,lead.me||(old&&old.me)?'rival':'news',true); }
    ai.raceLead[cc]=lead.code;
    rows.forEach((r,i)=>{ if(r.me||!r.e) return; const e=r.e; if(e.status==='dead'||(e.debt||0)>=4) return;
      const amb=raceAmb(e), p=(0.08+0.3*amb)*(0.35+D/3)*(e.cash<0?0.6:1); if(Math.random()>p) return;
      const tg=i>0?rows[i-1]:rows[1]; if(!tg||(tg.me&&typeof isAlly==='function'&&(isAlly(e.code)||(typeof inTruce==='function'&&inTruce(e.code))))) return;
      const t={...tg,rank:i}; let ok=false;
      if(i===0) ok=raceDefend(e,t,cc);
      else { const k=wpick([{k:'open',w:3},{k:'war',w:2+amb*2},{k:'fleet',w:1+amb*3}]).k; ok=k==='open'?raceOpen(e,t,cc):k==='war'?raceWar(e,t,cc):raceFleet(e,cc); if(!ok) ok=raceFleet(e,cc); }
      if(ok) e.lastRace={t:S.time,tg:tg.code};
    });
  }
  raceFights();
}
// les guerres entre IA coûtent de l'argent ; à la fin, la plus faible abandonne la ligne
function raceFights(){
  const F=S.ai.fights||{};
  for(const [k,f] of Object.entries(F)){
    const A=aiBy(f.att), B=aiBy(f.def); if(!A||!B||A.status==='dead'||B.status==='dead'){ delete F[k]; continue; }
    const w=marketDemand(f.a,f.b)/400; A.cash-=Math.max(0.2e6,w*0.6e6); B.cash-=Math.max(0.15e6,w*0.45e6); A.rep=clamp(A.rep-0.1,10,95);
    if(f.until>S.time) continue; delete F[k];
    const sA=A.cash/Math.max(1,A.fleet)+A.rep*0.3e6, sB=B.cash/Math.max(1,B.fleet)+B.rep*0.3e6, lose=sA<sB?A:B, win=lose===A?B:A;
    if(carriersOn(f.a,f.b).includes(lose.code)&&lose.routes>2){ raceDropPair(lose,f.a,f.b);
      if(raceLoud(f.cc,win.fleet>=150||lose.fleet>=150)) aiNews(`🏳️ ${lose.name} jette l’éponge sur ${keyCity(f.a)}–${keyCity(f.b)} face à ${win.name}.`,'news'); }
  }
}

/* ---------- 🏁 onglet « Course » dans les actualités ---------- */
function raceTabHtml(){
  const tables=raceTables(), home=homeCC(), sel=UI.raceCC&&tables[UI.raceCC]?UI.raceCC:home;
  const ccs=Object.entries(tables).filter(([c,r])=>r.length>=2).sort((x,y)=>(y[0]===home)-(x[0]===home)||y[1].length-x[1].length).slice(0,24).map(x=>x[0]);
  const rows=tables[sel]||[], F=Object.values(S.ai.fights||{}).filter(f=>f.until>S.time&&f.cc===sel), W=Object.values(S.ai.wars||{}).filter(w=>w.until>S.time&&aiBy(w.code)&&aiBy(w.code).cc===sel);
  const dead=S.ai.list.filter(e=>e.status==='dead'&&e.cc===sel).sort((x,y)=>y.deadAt-x.deadAt).slice(0,6);
  return `<div class="simplehelp">Dans chaque pays, toutes les compagnies veulent être <b>n°1</b> — vous comprise. Chacune attaque celle juste au-dessus d’elle (nouvelles lignes, guerres des prix, avions achetés à crédit), la n°1 se défend. Celles qui se ruinent font faillite et disparaissent de la carte.</div>
  <div class="chips">${ccs.map(c=>`<button class="chip ${c===sel?'on':''}" data-act="raceCC" data-c="${c}">${COUNTRIES[c]?COUNTRIES[c][2]:''} ${esc(ccName(c))} · ${tables[c].length}</button>`).join('')}</div>
  <table class="tbl rank"><tr><th>#</th><th>Compagnie</th><th>Valeur</th><th>Flotte</th><th>État</th></tr>${rows.map((r,i)=>{ const e=r.e, st=r.me?'—':e.cash<0?'<span class="neg">endettée</span>':(e.debt||0)>0?'<span class="warnt">en difficulté</span>':e.lastRace&&S.time-e.lastRace.t<21*DAY?`<span class="warnt">⚔️ vise ${esc((rows.find(x=>x.code===e.lastRace.tg)||{name:'…'}).name)}</span>`:'<span class="pos">solide</span>';
    return `<tr class="${r.me?'me':'click'}" ${r.me?'':`data-act="airlineCard" data-c="${r.code}"`}><td>${['🥇','🥈','🥉'][i]||i+1}</td><td><span class="dot" style="background:${r.color}"></span>${esc(r.name)}</td><td>${fmtMoney(r.value)}</td><td>${r.fleet}</td><td>${st}</td></tr>`; }).join('')}</table>
  ${F.length||W.length?`<h3>⚔️ Guerres en cours</h3>${F.map(f=>`<div class="small">${esc(aiBy(f.att).name)} contre ${esc(aiBy(f.def).name)} · ${esc(keyCity(f.a))}–${esc(keyCity(f.b))} · jusqu’au ${fmtDate(f.until)}</div>`).join('')}${W.map(w=>`<div class="small">${esc(aiBy(w.code).name)} contre vous · ${esc(keyCity(w.a))}–${esc(keyCity(w.b))} · jusqu’au ${fmtDate(w.until)}</div>`).join('')}`:''}
  ${dead.length?`<h3>🪦 Compagnies disparues</h3>${dead.map(e=>`<div class="small">${esc(e.name)} — ${fmtDate(e.deadAt)}${e.acquiredBy?` (rachetée par ${esc((aiBy(e.acquiredBy)||{name:e.acquiredBy}).name)})`:' (faillite)'}</div>`).join('')}`:''}`;
}
function raceHook(){ if(raceHook.done) return; raceHook.done=true;
  if(typeof aiWeekly==='function'){ const _aw=aiWeekly; aiWeekly=function(){ const wk=S.ai&&S.ai.lastWeek; _aw(); try{ if(S.ai&&S.ai.lastWeek!==wk) raceWeekly(); }catch(e){ console.warn(e); } }; }
  if(typeof pNews==='function'){ const _pn=pNews; pNews=function(){ const h=_pn(); if(UI.newsTab!=='race') return h.replace('<button class="chip " data-act="newsTab" data-k="rank">','<button class="chip " data-act="newsTab" data-k="race">🏁 Course</button><button class="chip " data-act="newsTab" data-k="rank">');
    const i=h.indexOf('</div>'); const chips=h.slice(0,i+6).replace('<button class="chip " data-act="newsTab" data-k="rank">','<button class="chip on" data-act="newsTab" data-k="race">🏁 Course</button><button class="chip " data-act="newsTab" data-k="rank">');
    return chips+raceTabHtml(); }; }
  Object.assign(ACTIONS,{ raceCC:d=>{ UI.raceCC=d.c; renderPanel(); } });
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ raceHook(); }catch(e){ console.warn(e); } },0));
