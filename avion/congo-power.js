/* =========================================================
   Sky Empire — 🇨🇩 Masambukidi Fly et les compagnies de votre pays
   • Masambukidi Fly : compagnie congolaise basée à Goma, fonds de
     1 milliard de dollars, avions jaunes, uniquement de très gros
     porteurs (A380, 777, 747). Elle démarre avec 10 lignes vers les
     plus grandes destinations du monde puis s'étend partout.
   • Les compagnies de VOTRE pays ne vous font jamais la guerre : elles
     se battent contre le reste du monde (lignes internationales, bases
     à l'étranger) et sont soutenues pour rester fortes.
   Tout est fictif.
   ========================================================= */
'use strict';
const MSB='MSB', MSB_NAME='Masambukidi Fly', MSB_COLOR='#facc15', MSB_HUB='GOM';
// les compagnies de votre pays (et Masambukidi Fly) ne vous attaquent pas
function aiPeace(code){ if(!code) return false; if(code===MSB) return true; const e=typeof aiBy==='function'&&aiBy(code); return !!(e&&S&&S.company&&e.cc===homeCC()); }
const cpCompat=()=>aiAlive().filter(e=>e.code===MSB||e.cc===homeCC());
const cpBig=()=>cpBig.c||(cpBig.c=AIRPORT_CODES.filter(c=>AP(c).cls>=4&&AP(c).traffic>=8).sort((x,y)=>AP(y).traffic-AP(x).traffic).slice(0,260));
function cpR(e,cat){ S.rivals=S.rivals||[]; let R=S.rivals.find(x=>x.code===e.code); if(R) return R;
  R={name:e.name, code:e.code, color:e.color, hub:e.hub, local:false, real:false, cash:e.cash, fleet:e.fleet, quality:e.code===MSB?1.25:1.05, rep:e.rep, paxDay:0, revDay:0, network:e.routes, cat,
    routes:((S.ai.extra||{})[e.code]||[]).slice(0,40).map(k=>({a:k.slice(0,3),b:k.slice(3),freq:2,cat}))};
  S.rivals.push(R); S.ai.ver++; return R; }
// nouvelle ligne internationale (jamais sur une ligne que vous exploitez)
function cpOpen(e,from,to,freq){ const key=pairKey(from,to); if(from===to||carriersOn(from,to).includes(e.code)) return false;
  if((S.routes||[]).some(r=>r.stops.includes(from)&&r.stops.includes(to))) return false;
  if(typeof airspaceViolation==='function'&&airspaceViolation(e.code,from,to)) return false;
  (S.ai.extra[e.code]=S.ai.extra[e.code]||[]).push(key); e.routes++; S.ai.ver++;
  const R=(S.rivals||[]).find(x=>x.code===e.code); if(R){ R.routes.push({a:from,b:to,freq:freq||1,cat:R.cat}); R._v=(R._v||0)+1; }
  return true; }

/* ---------- Masambukidi Fly ---------- */
function msbEnsure(){
  if(!S||!S.ai||!S.ai.list||!AP(MSB_HUB)) return; if(typeof AIRLINE_COLORS!=='undefined') AIRLINE_COLORS[MSB]=MSB_COLOR;
  let e=aiBy(MSB);
  if(e&&e.status==='dead'){ e.status='ok'; delete e.deadAt; delete e.acquiredBy; e.cash=Math.max(e.cash,1e9); }
  if(!e){
    e={code:MSB, name:MSB_NAME, color:MSB_COLOR, hub:MSB_HUB, cc:AP(MSB_HUB).cc, real:false, startup:false, founded:S.time, fleet:10, cash:1e9, rep:70, skill:0.2, safety:1.25,
      amb:1, routes:0, crashes:0, incidents:0, status:'ok', debt:0, pax:0, hist:[], age:2, bigOnly:true, bases:[]};
    S.ai.list.push(e); S.ai.ver++; const R=cpR(e,'quad');
    // 10 lignes vers les plus grandes destinations du monde, pas plus de 2 par pays
    const per={}, picks=[];
    for(const c of cpBig()){ if(picks.length>=10) break; const cc=AP(c).cc; if(cc===e.cc||dist(MSB_HUB,c)>14000||(per[cc]||0)>=2) continue; if(cpOpen(e,MSB_HUB,c,1)){ per[cc]=(per[cc]||0)+1; picks.push(c); } }
    aiNews(`🟡 Naissance de ${MSB_NAME} à Goma : 1 milliard de dollars de fonds, ${e.fleet} gros porteurs jaunes (A380, 777, 747) et ${picks.length} lignes vers ${picks.slice(0,4).map(keyCity).join(', ')}… Objectif : le monde entier.`,'news',true);
  }
  const R=cpR(e,'quad'); R.color=MSB_COLOR; R.cat='quad'; for(const r of R.routes) r.cat='quad'; e.color=MSB_COLOR;
  // version 2 : elle redémarre petite (10 gros porteurs, ses 10 lignes de départ) et grandit peu à peu
  if(!S.msbV2){ S.msbV2=true; if(e.fleet>10){ const keep=(S.ai.extra[MSB]||[]).slice(0,10); S.ai.extra[MSB]=keep; R.routes=R.routes.filter(x=>keep.includes(pairKey(x.a,x.b))).slice(0,10); R._v=(R._v||0)+1;
    e.fleet=10; R.fleet=10; e.routes=keep.length; e.bases=[]; e.rep=Math.min(e.rep,72); e.skill=Math.min(e.skill||0,0.25); e.cash=Math.max(e.cash,1e9); S.ai.ver++; } }
}
function msbWeekly(){
  const e=aiBy(MSB); if(!e||e.status==='dead'){ msbEnsure(); return; }
  e.amb=1; e.skill=Math.min(0.5,(e.skill||0)+0.006); e.safety=Math.min(1.6,(e.safety||1)+0.01); e.rep=Math.min(90,(e.rep||60)+0.15);   // elle progresse semaine après semaine
  if(e.cash<2e8){ e.cash+=3e8; aiNews(`💰 ${MSB_NAME} lève 300 millions de dollars pour continuer sa conquête du monde.`,'news'); }
  // flotte : de plus en plus de gros porteurs
  if(Math.random()<0.22){ const n=1; e.fleet+=n; e.cash-=n*rnd(9e7,1.5e8)*0.3; const R=(S.rivals||[]).find(x=>x.code===MSB); if(R) R.fleet=e.fleet;
    aiNews(`🛬 ${MSB_NAME} reçoit ${n} nouveaux ${pick(['Airbus A380','Boeing 777-300ER','Boeing 747-8'])} jaunes : ${e.fleet} gros porteurs.`,'news'); }
  // expansion mondiale : 1 à 2 lignes par semaine, depuis Goma ou ses bases à l'étranger
  const n=e.routes<e.fleet*1.3&&Math.random()<0.5?1:0;   // une nouvelle ligne de temps en temps, quand la flotte suit
  for(let i=0;i<n;i++){ const from=(e.bases||[]).length&&Math.random()<0.45?pick(e.bases):MSB_HUB;
    const cand=cpBig().filter(c=>c!==from&&AP(c).cc!==AP(from).cc&&dist(from,c)>1500&&dist(from,c)<14000&&!carriersOn(from,c).includes(MSB));
    if(!cand.length) continue; const to=cand.slice(0,40)[rndi(0,Math.min(39,cand.length-1))];
    if(cpOpen(e,from,to,1)) aiNews(`🟡 ${MSB_NAME} ouvre ${keyCity(from)} – ${keyCity(to)} en gros porteur.`,'news',from===MSB_HUB&&Math.random()<0.3);
    // une base à l'étranger quand elle a 3 lignes ou plus depuis une grande ville
    const nb=(S.ai.extra[MSB]||[]).filter(k=>k.includes(to)).length; e.bases=e.bases||[];
    if(nb>=3&&!e.bases.includes(to)&&AP(to).cc!==e.cc){ e.bases.push(to); aiNews(`🏴 ${MSB_NAME} installe une base à ${keyCity(to)} : les avions jaunes de Goma s’attaquent au marché de ${ccName(AP(to).cc)}.`,'news',true); }
  }
  // elle se bat contre le monde : guerre des prix contre la n°1 d'un grand marché où elle vole (jamais contre vous)
  if(typeof raceMarketMove==='function'&&Math.random()<0.3){ const ms=[...(e.bases||[]),...(S.ai.extra[MSB]||[]).map(k=>k.slice(3))].filter(c=>AP(c)&&!(typeof raceMine==='function'&&raceMine().has(c))); if(ms.length) raceMarketMove(e,pick(ms)); }
}

/* ---------- les compagnies de votre pays : fortes, tournées vers le monde ---------- */
function cpWeekly(){
  if(!S||!S.ai||!S.company) return; const cc=homeCC();
  for(const e of aiAlive().filter(x=>x.cc===cc&&x.code!==MSB)){
    e.amb=Math.max(raceAmb?raceAmb(e):0.8,0.85); e.skill=Math.max(e.skill||0,0.12);
    // soutien des investisseurs du pays : elles ne s'effondrent pas
    if(e.cash<e.fleet*3e6){ e.cash+=Math.max(5e6,e.fleet*2.5e6); if(e.debt) e.debt=Math.max(0,e.debt-1); }
    // plus d'avions
    if(Math.random()<0.2){ const n=Math.max(1,Math.round(e.fleet*rnd(0.03,0.06))); e.fleet+=n; e.cash-=n*rnd(3e6,6e6); const R=(S.rivals||[]).find(x=>x.code===e.code); if(R) R.fleet=e.fleet;
      if(n>=3) aiNews(`🇨🇩 ${e.name} s’agrandit : ${n} avions de plus (${e.fleet} au total) pour partir à l’assaut du monde.`,'news'); }
    // lignes vers l'étranger : Afrique d'abord pour les petites, le monde pour les grandes
    if(Math.random()<0.25){ const maxD=e.fleet>=40?11000:e.fleet>=15?6000:3500;
      const cand=(e.fleet>=15?cpBig():AIRPORT_CODES.filter(c=>AP(c).cls>=3&&AP(c).traffic>=1)).filter(c=>AP(c).cc!==cc&&dist(e.hub,c)>400&&dist(e.hub,c)<=maxD&&!carriersOn(e.hub,c).includes(e.code));
      if(cand.length){ const to=cand.sort((x,y)=>AP(y).traffic-AP(x).traffic).slice(0,25)[rndi(0,Math.min(24,cand.length-1))];
        if(cpOpen(e,e.hub,to,2)) aiNews(`🌍 ${e.name} (${ccName(cc)}) part à la conquête de l’étranger : nouvelle ligne ${keyCity(e.hub)} – ${keyCity(to)}.`,'news',e.fleet>=15); } }
  }
  // les plus grandes de votre pays deviennent visibles sur la carte
  for(const e of aiAlive().filter(x=>x.cc===cc&&x.code!==MSB).sort((x,y)=>y.fleet-x.fleet).slice(0,6)) if(e.fleet>=8) cpR(e,null);
}

/* ---------- vraiment fortes, dans tous les domaines ---------- */
function cpStrong(){
  const cc=homeCC();
  for(const e of cpCompat()){ const msb=e.code===MSB;
    // croissance progressive : au plus ~1,5 % de flotte en plus par semaine (les avions en trop sont revendus)
    if(e.lastF){ e.fAcc=(e.fAcc||0)+e.lastF*0.015; const add=Math.floor(e.fAcc), allow=e.lastF+add; if(e.fleet>=allow) e.fAcc-=add; if(e.fleet>allow){ e.cash+=(e.fleet-allow)*5e6; e.fleet=allow; const R=(S.rivals||[]).find(x=>x.code===e.code); if(R) R.fleet=e.fleet; } }
    e.lastF=e.fleet;
    // pas plus de ~2 lignes par avion : les moins rentables sont abandonnées
    if(e.routes>e.fleet*2.2&&typeof raceDropPair==='function'){ const ex=(S.ai.extra[e.code]||[]).slice(msb?10:0).sort((x,y)=>marketDemand(x.slice(0,3),x.slice(3))-marketDemand(y.slice(0,3),y.slice(3)));
      while(e.routes>e.fleet*2&&ex.length){ const k=ex.shift(); raceDropPair(e,k.slice(0,3),k.slice(3)); } }
    // gestion : rentables, sans dettes, en mode croissance
    e.skill=Math.min(msb?0.5:0.35,(e.skill||0)+0.005); if((e.debt||0)>0&&e.cash>0) e.debt=0;
    if(e.cash>0) e.plan={mode:'grow',until:S.time+8*7*DAY}; e.cash+=e.fleet*0.12e6;
    // image et service : parmi les meilleures du monde
    e.rep=clamp(Math.max(e.rep||60,55)+0.2,10,msb?90:85);   // l'image monte peu à peu
    // sécurité : flotte neuve, maintenance irréprochable, très peu d'accidents
    e.safety=Math.min(msb?1.6:1.4,Math.max(e.safety||1,0.9)+0.01); e.age=Math.max(msb?3:4,(e.age||8)-0.05);
    // réseau : les grandes ouvrent des bases à l'étranger (jamais sur vos marchés)
    if(!msb&&e.fleet>=25&&typeof raceOpen==='function'&&Math.random()<0.15){ const ms=cpBig().filter(c=>AP(c).cc!==cc&&dist(e.hub,c)<(e.fleet>=60?11000:6000)&&!(typeof raceMine==='function'&&raceMine().has(c)));
      if(ms.length){ const M=ms.slice(0,40)[rndi(0,Math.min(39,ms.length-1))]; raceOpen(e,M,null); } }
  }
}
// elles rachètent des compagnies étrangères en difficulté
function cpMonthly(){
  const cc=homeCC(), strong=cpCompat().filter(e=>e.cash>e.fleet*12e6&&e.fleet>=25);
  if(!strong.length||Math.random()>0.15||typeof aiAcquireCompany!=='function') return;
  const buyer=pick(strong), prey=aiAlive().filter(x=>x.cc!==cc&&x.code!==MSB&&x.fleet>=5&&x.fleet<=buyer.fleet*0.6&&((x.debt||0)>=1||x.cash<x.fleet*3e6||(x.mavg||0)<-0.08)&&dist(x.hub,buyer.hub)<9000);
  if(!prey.length) return; const t=prey.sort((a,b)=>b.fleet-a.fleet)[0];
  if(buyer.cash<t.fleet*9e6+t.fleet*1e6) buyer.cash+=t.fleet*10e6;   // financement des banques du pays
  if(aiAcquireCompany(buyer,t,'merger')) aiNews(`🇨🇩 ${buyer.name} rachète ${t.name} (${ccName(t.cc)}) : la puissance congolaise s’étend.`,'news',true);
}
// fiche « Compagnies de votre pays » (onglet 🏁 Marchés)
function cpCardHtml(){
  const rows=aiRows(), cc=homeCC(), mine=rows.filter(r=>!r.me&&r.e&&(r.e.cc===cc||r.code===MSB));
  if(!mine.length) return '';
  return `<div class="card small"><b>${COUNTRIES[cc]?COUNTRIES[cc][2]:''} Les compagnies de votre pays dans le monde</b> <span class="mut">(elles ne vous attaquent jamais)</span>
    <table class="tbl"><tr><th>Rang mondial</th><th>Compagnie</th><th>Flotte</th><th>Lignes</th><th>Image</th><th>Bases</th></tr>${mine.slice(0,10).map(r=>`<tr class="click" data-act="airlineCard" data-c="${r.code}"><td>#${r.rank}</td><td><span class="dot" style="background:${r.color}"></span>${esc(r.name)}</td><td>${r.fleet}</td><td>${r.routes}</td><td>${Math.round(r.rep)}</td><td>${(r.e.bases||[]).slice(0,3).map(keyCity).join(', ')||'—'}</td></tr>`).join('')}</table></div>`;
}

// les compagnies étrangères deviennent fortes aussi : elles apprennent de leurs bons résultats et les jeunes sont soutenues la 1re année
function cpWorld(){ const cc=homeCC();
  for(const e of aiAlive()){ if(e.code===MSB||e.cc===cc) continue;
    if((e.mavg||0)>0){ e.skill=Math.min(0.3,(e.skill||0)+0.003); e.rep=Math.min(88,(e.rep||60)+0.06); }
    if(e.startup&&S.time-(e.founded||0)<365*DAY&&e.cash<e.fleet*3e6) e.cash+=e.fleet*1.5e6;
    e.safety=Math.max(e.safety||1,0.8); }
}

/* ---------- branchements ---------- */
function cpHook(){ if(cpHook.done) return; cpHook.done=true;
  if(typeof AIRLINE_COLORS!=='undefined') AIRLINE_COLORS[MSB]=MSB_COLOR;
  // Masambukidi Fly ne meurt pas et ne se fait pas racheter
  { const _rt=retireAICorp; retireAICorp=function(e,b,p){ if(e&&e.code===MSB){ e.cash=Math.max(e.cash,6e8); e.debt=0; return; } return _rt(e,b,p); }; }
  { const _aq=aiAcquireCompany; aiAcquireCompany=function(buyer,target,kind){ if(target&&target.code===MSB) return false; return _aq(buyer,target,kind); }; }
  { const _bk=aiBankrupt; aiBankrupt=function(e){ if(e&&e.code===MSB){ e.cash=Math.max(e.cash,6e8); e.debt=0; return; } return _bk(e); }; }
  { const _aw=aiWeekly; aiWeekly=function(){ const wk=S.ai&&S.ai.lastWeek; _aw(); try{ if(S.ai&&S.ai.lastWeek!==wk){ msbEnsure(); msbWeekly(); cpWeekly(); cpStrong(); cpWorld(); } }catch(e){ console.warn(e); } }; }
  setTimeout(()=>{ try{ msbEnsure(); }catch(e){ console.warn(e); } },1500);
  { const _am=aiMonthly; aiMonthly=function(){ _am(); try{ cpMonthly(); }catch(e){ console.warn(e); } }; }
  if(typeof raceTabHtml==='function'){ const _rt=raceTabHtml; raceTabHtml=function(){ let c=''; try{ c=cpCardHtml(); }catch(e){} return c+_rt(); }; }
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ cpHook(); }catch(e){ console.warn(e); } },0));
