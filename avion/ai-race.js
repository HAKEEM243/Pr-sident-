/* =========================================================
   Sky Empire — 🏁 guerre des marchés
   La bataille ne se fait pas par nationalité mais par MARCHÉ (un
   aéroport et ses lignes). N'importe quelle compagnie peut venir se
   battre n'importe où : Qatar Airways peut s'installer à Kinshasa,
   une compagnie nigériane peut attaquer Paris. Chacune veut dominer
   les marchés où elle vole. Toutes contre toutes, vous comprise, sans
   que personne ne vous vise en particulier.
   Chaque semaine, chaque compagnie choisit un marché (le sien à
   défendre, un marché où elle est déjà, ou un marché à conquérir) et
   s'en prend à celle qui est juste devant elle sur ce marché :
   • nouvelles lignes au départ de cet aéroport (base à l'étranger) ;
   • guerres des prix (coûteuses pour les deux, la plus faible cède) ;
   • la n°1 du marché ajoute des vols pour se défendre.
   Une compagnie chassée de toutes les lignes de son hub disparaît.
   Tout est fictif (calculé par le jeu).
   ========================================================= */
'use strict';
function raceAmb(e){ if(e.amb===undefined) e.amb=Math.min(1,+(0.35+(hashStr(e.code)%65)/100+(e.startup?0.15:0)).toFixed(2)); return e.amb; }
const raceR=code=>(S.rivals||[]).find(x=>x.code===code);
const raceMine=()=>{ const s=new Set(S.hubs||[]); for(const r of S.routes||[]) for(const c of r.stops) s.add(c); return s; };
const raceLoud=(M,big)=>raceMine().has(M)||AP(M).cc===homeCC()||(big&&Math.random()<0.2);
const raceMaxD=e=>e.fleet>=60?9000:e.fleet>=25?5000:e.fleet>=8?3000:1800;
function raceMarket(M){ try{ return apMarket(M); }catch(err){ return null; } }
function raceAddPair(e,a,b,freq){ const key=pairKey(a,b); if(carriersOn(a,b).includes(e.code)) return false;
  (S.ai.extra[e.code]=S.ai.extra[e.code]||[]).push(key); if(S.ai.cut[e.code]) S.ai.cut[e.code]=S.ai.cut[e.code].filter(k=>k!==key); e.routes++; S.ai.ver++;
  const R=raceR(e.code); if(R&&!R.routes.some(x=>pairKey(x.a,x.b)===key)){ R.routes.push({a,b,freq:freq||2}); R._v=(R._v||0)+1; } return true; }
function raceDropPair(e,a,b){ const key=pairKey(a,b);
  if((S.ai.extra[e.code]||[]).includes(key)) S.ai.extra[e.code]=S.ai.extra[e.code].filter(k=>k!==key); else (S.ai.cut[e.code]=S.ai.cut[e.code]||[]).push(key);
  e.routes=Math.max(0,e.routes-1); S.ai.ver++; const R=raceR(e.code); if(R){ R.routes=R.routes.filter(x=>pairKey(x.a,x.b)!==key); R._v=(R._v||0)+1; } }
// lignes encore tenues par une compagnie au départ de son propre hub
const raceHubLines=e=>(AP_ROUTES[e.hub]||[]).filter(b=>AP(b)&&carriersOn(e.hub,b).includes(e.code)).length;

/* ---------- choisir un marché ---------- */
function racePickMarket(e){
  const amb=raceAmb(e), opts=[{k:'home',w:2}];
  if(e.routes>2) opts.push({k:'present',w:2});
  if(e.fleet>=20&&e.cash>0&&(e.debt||0)<2) opts.push({k:'conquest',w:0.6+amb*2.4});
  const k=wpick(opts).k;
  if(k==='home') return e.hub;
  if(k==='present'){ const pts=new Set(); for(const kk of (S.ai.extra[e.code]||[])){ pts.add(kk.slice(0,3)); pts.add(kk.slice(3)); } for(const [a,b] of airlinePairs(e.code).slice(0,60)){ pts.add(a); pts.add(b); }
    const L=[...pts].filter(c=>AP(c)&&AP(c).traffic>=0.5).sort((x,y)=>AP(y).traffic-AP(x).traffic).slice(0,12); return L.length?pick(L):e.hub; }
  // conquête : un grand aéroport à portée, n'importe où dans le monde (le vôtre peut tomber dessus, comme les autres)
  if(!racePickMarket.big) racePickMarket.big=AIRPORT_CODES.filter(c=>AP(c).traffic>=2&&AP(c).cls>=3).sort((x,y)=>AP(y).traffic-AP(x).traffic).slice(0,220);
  const extra=[...(S.hubs||[])].filter(c=>AP(c).cls>=2&&AP(c).traffic>=0.3);
  const cand=[...new Set([...racePickMarket.big,...extra])].filter(c=>c!==e.hub&&dist(e.hub,c)<=raceMaxD(e)&&(typeof aiAirportMarketOpen!=='function'||aiAirportMarketOpen(c)));
  if(!cand.length) return e.hub;
  const it=wpick(cand.map(c=>({c,w:Math.sqrt(AP(c).traffic)}))); return it.c;
}

/* ---------- se battre sur un marché ---------- */
function raceMarketMove(e,M){
  const mk=raceMarket(M); if(!mk||mk.closed) return false;
  const list=mk.list, i=list.findIndex(x=>x.code===e.code&&!x.me);
  const tg=i===0?list[1]:i>0?list[i-1]:list[0]; if(!tg) return raceOpen(e,M,null);
  if(tg.me&&typeof isAlly==='function'&&(isAlly(e.code)||(typeof inTruce==='function'&&inTruce(e.code)))) return false;
  if(i===0) return raceDefend(e,M,tg);
  const amb=raceAmb(e), k=wpick([{k:'open',w:3},{k:'war',w:i>0?2+amb*2:0}]).k;
  return k==='war'?(raceWar(e,M,tg)||raceOpen(e,M,tg)):raceOpen(e,M,tg);
}
// nouvelle ligne au départ de M, de préférence là où vole la cible
function raceOpen(e,M,tg){
  const dests=(AP_ROUTES[M]||[]).filter(b=>AP(b)&&b!==M&&dist(M,b)>150&&dist(M,b)<=raceMaxD(e)&&!carriersOn(M,b).includes(e.code)&&!airspaceViolation(e.code,M,b)&&(typeof aiAirportMarketOpen!=='function'||aiAirportMarketOpen(b)));
  if(!dests.length) return false;
  const tl=tg&&tg.legs?tg.legs:{}, sc=b=>marketDemand(M,b)*(tl[b]?1.6:1);
  const b=dests.sort((x,y)=>sc(y)-sc(x)).slice(0,5)[rndi(0,Math.min(4,dests.length-1))];
  const cost=e.fleet<10?0.8e6:e.fleet<40?2e6:4e6; if(e.cash<-e.fleet*3e6*raceAmb(e)) return false;
  e.cash-=cost; if(!raceAddPair(e,M,b,2)) return false;
  S.ai.mHot=S.ai.mHot||{}; S.ai.mHot[M]=S.time;
  const foreign=AP(M).cc!==e.cc, n=(AP_ROUTES[M]||[]).filter(x=>carriersOn(M,x).includes(e.code)).length; e.bases=e.bases||[];
  if(foreign&&n>=3&&!e.bases.includes(M)&&M!==e.hub){ e.bases.push(M); aiNews(`🏴 ${e.name} (${ccName(e.cc)}) installe une base à ${keyCity(M)} : ${n} lignes au départ de là-bas. Les compagnies locales vont souffrir.`,raceMine().has(M)?'rival':'news',raceLoud(M,e.fleet>=60)); }
  else if(raceLoud(M,e.fleet>=150)) aiNews(`🛫 ${e.name} s’attaque au marché de ${keyCity(M)} : nouvelle ligne ${keyCity(M)}–${keyCity(b)}${tg?` face à ${tg.me?'vous':tg.name}`:''}.`,tg&&tg.me?'rival':'news',!!(tg&&tg.me));
  return true;
}
// guerre des prix sur une ligne partagée au départ de M
function raceWar(e,M,tg){
  const shared=Object.keys(tg.legs||{}).filter(b=>carriersOn(M,b).includes(e.code)); if(!shared.length) return false;
  const b=pick(shared), key=pairKey(M,b), until=S.time+rndi(14,35)*DAY; S.ai.mHot=S.ai.mHot||{}; S.ai.mHot[M]=S.time;
  if(tg.me){ S.ai.wars=S.ai.wars||{}; if(S.ai.wars[e.code+key]) return false; S.ai.wars[e.code+key]={code:e.code,a:M,b,until,kind:'prix'}; }
  else { if(!tg.e) return false; const F=S.ai.fights=S.ai.fights||{}, fk=e.code+'>'+tg.code+key; if(F[fk]) return false; F[fk]={att:e.code,def:tg.code,a:M,b,until,M}; }
  if(raceLoud(M,e.fleet>=150||(tg.e&&tg.e.fleet>=150))) aiNews(`⚔️ Guerre des prix ${keyCity(M)}–${keyCity(b)} : ${e.name} contre ${tg.me?'vous':tg.name} pour le marché de ${keyCity(M)}.`,tg.me?'rival':'news',tg.me||raceMine().has(M));
  return true;
}
// la n°1 du marché se défend : riposte, vols en plus, service
function raceDefend(e,M,ch){
  const F=S.ai.fights||{}, hit=Object.values(F).find(f=>f.def===e.code&&f.M===M&&f.until>S.time);
  if(hit){ const fk=e.code+'>'+hit.att+pairKey(hit.a,hit.b); if(!F[fk]){ F[fk]={att:e.code,def:hit.att,a:hit.a,b:hit.b,until:hit.until,M}; if(raceLoud(M,e.fleet>=150)) aiNews(`🛡️ ${e.name}, n°1 à ${keyCity(M)}, riposte : prix cassés contre ${aiBy(hit.att)?aiBy(hit.att).name:hit.att} sur ${keyCity(hit.a)}–${keyCity(hit.b)}.`,'news'); return true; } }
  const R=raceR(e.code); if(R){ const rt=R.routes.filter(x=>x.a===M||x.b===M).sort((x,y)=>marketDemand(y.a,y.b)-marketDemand(x.a,x.b))[0]; if(rt&&(rt.freq||1)<9){ rt.freq=(rt.freq||1)+1; R._v=(R._v||0)+1; S.ai.ver++; return true; } }
  if(Math.random()<0.5) return raceOpen(e,M,ch);
  e.rep=clamp((e.rep||60)+0.8,10,95); e.cash-=e.fleet*0.15e6; return true;
}

/* ---------- semaine ---------- */
function raceWeekly(){
  const ai=S.ai; if(!ai||!ai.list) return; const D=typeof drive==='function'?drive():2;
  for(const e of aiAlive()){ if((e.debt||0)>=4) continue;
    const p=(0.06+0.26*raceAmb(e))*(0.35+D/3)*(e.cash<0?0.6:1); if(Math.random()>p) continue;
    const M=racePickMarket(e); if(M&&raceMarketMove(e,M)) e.lastRace={t:S.time,M}; }
  raceFights(); raceLeaders();
}
// guerres entre IA : coûteuses ; à la fin la plus faible cède la ligne — et celle qui perd tout son hub disparaît
function raceFights(){
  const F=S.ai.fights||{};
  for(const [k,f] of Object.entries(F)){
    const A=aiBy(f.att), B=aiBy(f.def); if(!A||!B||A.status==='dead'||B.status==='dead'){ delete F[k]; continue; }
    const w=Math.max(0.3,marketDemand(f.a,f.b)/400); A.cash-=w*0.6e6; B.cash-=w*0.45e6; A.rep=clamp(A.rep-0.1,10,95);
    if(f.until>S.time) continue; delete F[k];
    const sA=A.cash/Math.max(1,A.fleet)+A.rep*0.3e6+A.fleet*0.05e6, sB=B.cash/Math.max(1,B.fleet)+B.rep*0.3e6+B.fleet*0.05e6, lose=sA<sB?A:B, win=lose===A?B:A;
    if(!carriersOn(f.a,f.b).includes(lose.code)) continue;
    raceDropPair(lose,f.a,f.b);
    if(raceLoud(f.M||f.a,win.fleet>=150||lose.fleet>=150)) aiNews(`🏳️ ${lose.name} abandonne ${keyCity(f.a)}–${keyCity(f.b)} face à ${win.name}.`,'news',raceMine().has(f.M||f.a));
    if(lose.routes<=1||raceHubLines(lose)===0){ lose.deathWhy=`chassée de ses lignes par ${win.name}`; const was=lose.name; retireAICorp(lose); lose.deathWhy=`chassée par ${win.name}`;
      aiNews(`☠️ ${was} n’a plus de lignes à ${keyCity(lose.hub)} : ${win.name} lui a tout pris. La compagnie disparaît.`,'bad',true); }
  }
}
// qui domine les marchés chauds (et les vôtres)
function raceLeaders(){
  const ai=S.ai, L=ai.mLead=ai.mLead||{}, hot=Object.entries(ai.mHot||{}).filter(([,t])=>S.time-t<60*DAY).map(([c])=>c), mine=[...raceMine()].filter(c=>(S.hubs||[]).includes(c));
  for(const M of [...new Set([...mine,...hot])].slice(0,30)){ const mk=raceMarket(M); if(!mk||!mk.list.length) continue; const top=mk.list[0], code=top.me?'__me':top.code;
    if(L[M]&&L[M]!==code&&raceLoud(M,false)) aiNews(`👑 ${top.me?'Vous prenez':top.name+' prend'} la tête du marché de ${keyCity(M)} (${Math.round(top.share*100)} % des passagers).`,top.me||L[M]==='__me'?'rival':'news',true);
    L[M]=code; }
  for(const k of Object.keys(ai.mHot||{})) if(S.time-ai.mHot[k]>120*DAY) delete ai.mHot[k];
}

/* ---------- 🏁 onglet « Marchés » ---------- */
function raceTabHtml(){
  const hot=Object.entries(S.ai.mHot||{}).sort((x,y)=>y[1]-x[1]).map(x=>x[0]);
  const ms=[...new Set([...(S.hubs||[]),...hot])].filter(c=>AP(c)).slice(0,18), sel=UI.raceM&&AP(UI.raceM)?UI.raceM:ms[0];
  const mk=sel&&raceMarket(sel), F=Object.values(S.ai.fights||{}).filter(f=>f.until>S.time&&f.M===sel), W=Object.values(S.ai.wars||{}).filter(w=>w.until>S.time&&(w.a===sel||w.b===sel));
  const bases=aiAlive().filter(e=>(e.bases||[]).includes(sel));
  const dead=S.ai.list.filter(e=>e.status==='dead').sort((x,y)=>y.deadAt-x.deadAt).slice(0,8);
  return `<div class="simplehelp">La guerre se fait <b>par marché</b>, pas par pays : n’importe quelle compagnie peut venir se battre sur n’importe quel aéroport — vous comprise. Chacune vise celle qui est juste devant elle sur ce marché (nouvelles lignes, guerres des prix), la n°1 se défend. Celle qui perd toutes les lignes de son hub disparaît.</div>
  <div class="chips">${ms.map(c=>`<button class="chip ${c===sel?'on':''}" data-act="raceM" data-c="${c}">${flag(c)} ${esc(AP(c).city)}${(S.hubs||[]).includes(c)?' 🏢':''}</button>`).join('')}</div>
  ${mk?`<h3>Marché de ${esc(AP(sel).city)} <span class="mut small">${sel}</span></h3><table class="tbl rank"><tr><th>#</th><th>Compagnie</th><th>Part</th><th>Vols/j</th><th></th></tr>${mk.list.slice(0,12).map((r,i)=>{ const e=r.e, tag=r.me?'':e&&(e.bases||[]).includes(sel)?'🏴 base étrangère':e&&e.lastRace&&e.lastRace.M===sel&&S.time-e.lastRace.t<30*DAY?'⚔️ à l’attaque':e&&e.cash<0?'<span class="neg">endettée</span>':'';
    return `<tr class="${r.me?'me':'click'}" ${r.me?'':`data-act="airlineCard" data-c="${r.code}"`}><td>${['🥇','🥈','🥉'][i]||i+1}</td><td><span class="dot" style="background:${r.color}"></span>${esc(r.name)}${e&&e.cc!==AP(sel).cc?` <span class="mut">${COUNTRIES[e.cc]?COUNTRIES[e.cc][2]:''}</span>`:''}</td><td>${Math.round(r.share*100)} %</td><td>${Math.round(r.fl||0)}</td><td class="small">${tag}</td></tr>`; }).join('')}</table>`:''}
  ${bases.length?`<div class="small">🏴 Bases étrangères ici : ${bases.map(e=>esc(e.name)).join(', ')}</div>`:''}
  ${F.length||W.length?`<h3>⚔️ Guerres sur ce marché</h3>${F.map(f=>`<div class="small">${esc(aiBy(f.att).name)} contre ${esc(aiBy(f.def).name)} · ${esc(keyCity(f.a))}–${esc(keyCity(f.b))} · jusqu’au ${fmtDate(f.until)}</div>`).join('')}${W.map(w=>`<div class="small">${esc((aiBy(w.code)||{name:w.code}).name)} contre vous · ${esc(keyCity(w.a))}–${esc(keyCity(w.b))} · jusqu’au ${fmtDate(w.until)}</div>`).join('')}`:''}
  ${dead.length?`<h3>🪦 Compagnies disparues</h3>${dead.map(e=>`<div class="small">${esc(e.name)} (${esc(ccName(e.cc))}) — ${fmtDate(e.deadAt)} · ${e.acquiredBy?`rachetée par ${esc((aiBy(e.acquiredBy)||{name:e.acquiredBy}).name)}`:esc(e.deathWhy||'faillite')}</div>`).join('')}`:''}`;
}
function raceHook(){ if(raceHook.done) return; raceHook.done=true;
  if(typeof aiWeekly==='function'){ const _aw=aiWeekly; aiWeekly=function(){ const wk=S.ai&&S.ai.lastWeek; _aw(); try{ if(S.ai&&S.ai.lastWeek!==wk) raceWeekly(); }catch(e){ console.warn(e); } }; }
  if(typeof pNews==='function'){ const _pn=pNews, chip=on=>`<button class="chip ${on?'on':''}" data-act="newsTab" data-k="race">🏁 Marchés</button>`, anchor='<button class="chip " data-act="newsTab" data-k="rank">';
    pNews=function(){ const h=_pn(); if(UI.newsTab!=='race') return h.replace(anchor,chip(false)+anchor); const i=h.indexOf('</div>'); return h.slice(0,i+6).replace(anchor,chip(true)+anchor)+raceTabHtml(); }; }
  Object.assign(ACTIONS,{ raceM:d=>{ UI.raceM=d.c; renderPanel(); } });
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ raceHook(); }catch(e){ console.warn(e); } },0));
