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
    e={code:MSB, name:MSB_NAME, color:MSB_COLOR, hub:MSB_HUB, cc:AP(MSB_HUB).cc, real:false, startup:false, founded:S.time, fleet:24, cash:1e9, rep:82, skill:0.5, safety:1.5,
      amb:1, routes:0, crashes:0, incidents:0, status:'ok', debt:0, pax:0, hist:[], age:2, bigOnly:true, bases:[]};
    S.ai.list.push(e); S.ai.ver++; const R=cpR(e,'quad');
    // 10 lignes vers les plus grandes destinations du monde, pas plus de 2 par pays
    const per={}, picks=[];
    for(const c of cpBig()){ if(picks.length>=10) break; const cc=AP(c).cc; if(cc===e.cc||dist(MSB_HUB,c)>14000||(per[cc]||0)>=2) continue; if(cpOpen(e,MSB_HUB,c,1)){ per[cc]=(per[cc]||0)+1; picks.push(c); } }
    aiNews(`🟡 Naissance de ${MSB_NAME} à Goma : 1 milliard de dollars de fonds, ${e.fleet} gros porteurs jaunes (A380, 777, 747) et ${picks.length} lignes vers ${picks.slice(0,4).map(keyCity).join(', ')}… Objectif : le monde entier.`,'news',true);
  }
  const R=cpR(e,'quad'); R.color=MSB_COLOR; R.cat='quad'; for(const r of R.routes) r.cat='quad'; e.color=MSB_COLOR;
}
function msbWeekly(){
  const e=aiBy(MSB); if(!e||e.status==='dead'){ msbEnsure(); return; }
  e.amb=1; e.skill=Math.max(e.skill||0,0.45); e.safety=Math.max(e.safety||1,1.4); e.rep=Math.max(e.rep,75);
  if(e.cash<3e8){ e.cash+=5e8; aiNews(`💰 ${MSB_NAME} lève 500 millions de dollars pour continuer sa conquête du monde.`,'news'); }
  // flotte : de plus en plus de gros porteurs
  if(Math.random()<0.45){ const n=rndi(1,3); e.fleet+=n; e.cash-=n*rnd(9e7,1.5e8)*0.3; const R=(S.rivals||[]).find(x=>x.code===MSB); if(R) R.fleet=e.fleet;
    if(n>=2) aiNews(`🛬 ${MSB_NAME} reçoit ${n} nouveaux ${pick(['Airbus A380','Boeing 777-300ER','Boeing 747-8'])} jaunes : ${e.fleet} gros porteurs.`,'news'); }
  // expansion mondiale : 1 à 2 lignes par semaine, depuis Goma ou ses bases à l'étranger
  const n=e.routes<180?rndi(1,2):0;
  for(let i=0;i<n;i++){ const from=(e.bases||[]).length&&Math.random()<0.45?pick(e.bases):MSB_HUB;
    const cand=cpBig().filter(c=>c!==from&&AP(c).cc!==AP(from).cc&&dist(from,c)>1500&&dist(from,c)<14000&&!carriersOn(from,c).includes(MSB));
    if(!cand.length) continue; const to=cand.slice(0,40)[rndi(0,Math.min(39,cand.length-1))];
    if(cpOpen(e,from,to,1)) aiNews(`🟡 ${MSB_NAME} ouvre ${keyCity(from)} – ${keyCity(to)} en gros porteur.`,'news',from===MSB_HUB&&Math.random()<0.3);
    // une base à l'étranger quand elle a 3 lignes ou plus depuis une grande ville
    const nb=(S.ai.extra[MSB]||[]).filter(k=>k.includes(to)).length; e.bases=e.bases||[];
    if(nb>=3&&!e.bases.includes(to)&&AP(to).cc!==e.cc){ e.bases.push(to); aiNews(`🏴 ${MSB_NAME} installe une base à ${keyCity(to)} : les avions jaunes de Goma s’attaquent au marché de ${ccName(AP(to).cc)}.`,'news',true); }
  }
  // elle se bat contre le monde : guerre des prix contre la n°1 d'un grand marché où elle vole (jamais contre vous)
  if(typeof raceMarketMove==='function'&&Math.random()<0.6){ const ms=[...(e.bases||[]),...(S.ai.extra[MSB]||[]).map(k=>k.slice(3))].filter(c=>AP(c)&&!(typeof raceMine==='function'&&raceMine().has(c))); if(ms.length) raceMarketMove(e,pick(ms)); }
}

/* ---------- les compagnies de votre pays : fortes, tournées vers le monde ---------- */
function cpWeekly(){
  if(!S||!S.ai||!S.company) return; const cc=homeCC();
  for(const e of aiAlive().filter(x=>x.cc===cc&&x.code!==MSB)){
    e.amb=Math.max(raceAmb?raceAmb(e):0.8,0.85); e.skill=Math.max(e.skill||0,0.12);
    // soutien des investisseurs du pays : elles ne s'effondrent pas
    if(e.cash<e.fleet*6e6){ e.cash+=Math.max(8e6,e.fleet*4e6); if(e.debt) e.debt=Math.max(0,e.debt-1); }
    // plus d'avions
    if(Math.random()<0.3){ const n=Math.max(1,Math.round(e.fleet*rnd(0.04,0.1))); e.fleet+=n; e.cash-=n*rnd(3e6,6e6); const R=(S.rivals||[]).find(x=>x.code===e.code); if(R) R.fleet=e.fleet;
      if(n>=3) aiNews(`🇨🇩 ${e.name} s’agrandit : ${n} avions de plus (${e.fleet} au total) pour partir à l’assaut du monde.`,'news'); }
    // lignes vers l'étranger : Afrique d'abord pour les petites, le monde pour les grandes
    if(Math.random()<0.45){ const maxD=e.fleet>=40?11000:e.fleet>=15?6000:3500;
      const cand=(e.fleet>=15?cpBig():AIRPORT_CODES.filter(c=>AP(c).cls>=3&&AP(c).traffic>=1)).filter(c=>AP(c).cc!==cc&&dist(e.hub,c)>400&&dist(e.hub,c)<=maxD&&!carriersOn(e.hub,c).includes(e.code));
      if(cand.length){ const to=cand.sort((x,y)=>AP(y).traffic-AP(x).traffic).slice(0,25)[rndi(0,Math.min(24,cand.length-1))];
        if(cpOpen(e,e.hub,to,2)) aiNews(`🌍 ${e.name} (${ccName(cc)}) part à la conquête de l’étranger : nouvelle ligne ${keyCity(e.hub)} – ${keyCity(to)}.`,'news',e.fleet>=15); } }
  }
  // les plus grandes de votre pays deviennent visibles sur la carte
  for(const e of aiAlive().filter(x=>x.cc===cc&&x.code!==MSB).sort((x,y)=>y.fleet-x.fleet).slice(0,4)) if(e.fleet>=10) cpR(e,null);
}

/* ---------- branchements ---------- */
function cpHook(){ if(cpHook.done) return; cpHook.done=true;
  if(typeof AIRLINE_COLORS!=='undefined') AIRLINE_COLORS[MSB]=MSB_COLOR;
  // Masambukidi Fly ne meurt pas et ne se fait pas racheter
  { const _rt=retireAICorp; retireAICorp=function(e,b,p){ if(e&&e.code===MSB){ e.cash=Math.max(e.cash,6e8); e.debt=0; return; } return _rt(e,b,p); }; }
  { const _aq=aiAcquireCompany; aiAcquireCompany=function(buyer,target,kind){ if(target&&target.code===MSB) return false; return _aq(buyer,target,kind); }; }
  { const _bk=aiBankrupt; aiBankrupt=function(e){ if(e&&e.code===MSB){ e.cash=Math.max(e.cash,6e8); e.debt=0; return; } return _bk(e); }; }
  { const _aw=aiWeekly; aiWeekly=function(){ const wk=S.ai&&S.ai.lastWeek; _aw(); try{ if(S.ai&&S.ai.lastWeek!==wk){ msbEnsure(); msbWeekly(); cpWeekly(); } }catch(e){ console.warn(e); } }; }
  setTimeout(()=>{ try{ msbEnsure(); }catch(e){ console.warn(e); } },1500);
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ cpHook(); }catch(e){ console.warn(e); } },0));
