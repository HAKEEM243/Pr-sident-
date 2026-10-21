/* =========================================================
   Sky Empire — 🧠 stratégie des compagnies (IA)
   1. Les compagnies de votre pays (FlyCAA, Congo Airways, CAA…) et
      Masambukidi Fly sont vraiment protégées :
      • elles ne disparaissent plus (l'État et les banques du pays les
        renflouent) et ne sont plus rachetées par une compagnie étrangère ;
      • face à une compagnie étrangère, elles ne perdent plus leurs lignes ;
      • pas de « plan d'économies » qui vend leurs avions : elles investissent ;
      • une compagnie congolaise déjà disparue est relancée (une fois).
   2. Toutes les compagnies choisissent mieux leurs lignes, chaque semaine :
      • en croissance : elles ouvrent la ligne la plus prometteuse depuis
        leur hub (beaucoup de demande, peu de concurrents, distance adaptée) ;
      • en difficulté : elles ferment leur ligne la plus faible ;
      • les meilleures montent (image, savoir-faire), les mal gérées
        s'enfoncent jusqu'à la faillite.
   ========================================================= */
'use strict';
const asMine=e=>!!e&&typeof aiPeace==='function'&&aiPeace(e.code);
// meilleure nouvelle ligne depuis le hub
function asBestPair(e){
  const from=e.hub, A=AP(from); if(!A) return null; const maxD=e.fleet>=120?12000:e.fleet>=40?7000:e.fleet>=12?3500:1800;
  let best=null;
  for(const c of asTop()){ if(c===from) continue; const d=dist(from,c); if(d<250||d>maxD) continue;
    const car=carriersOn(from,c); if(car.includes(e.code)) continue; if(typeof airspaceViolation==='function'&&airspaceViolation(e.code,from,c)) continue;
    if(asMine(e)&&(S.routes||[]).some(r=>r.stops.includes(from)&&r.stops.includes(c))) continue;      // jamais sur vos lignes
    const sc=marketDemand(from,c)/(1+car.length*0.9)*(d<600?0.7:1);
    if(!best||sc>best.sc) best={c,sc}; }
  return best&&best.c; }
const asTop=()=>asTop.c||(asTop.c=AIRPORT_CODES.filter(c=>AP(c).cls>=3&&AP(c).traffic>=2).sort((x,y)=>AP(y).traffic-AP(x).traffic).slice(0,320));
// ligne la plus faible
function asWorstPair(e){ const L=(S.ai.extra[e.code]||[]); if(!L.length) return null;
  return L.map(k=>({k,s:marketDemand(k.slice(0,3),k.slice(3))/(1+carriersOn(k.slice(0,3),k.slice(3)).length)})).sort((a,b)=>a.s-b.s)[0].k; }
function asStep(e){
  if(!e||e.status==='dead'||typeof raceAddPair!=='function') return;
  const mode=e.plan&&e.plan.mode, mine=asMine(e);
  if(mine&&mode==='retrench'){ e.plan={mode:'grow',until:S.time+8*7*DAY}; e.cash=Math.max(e.cash,e.fleet*8e6); }
  const m=(e.plan&&e.plan.mode)||'steady';
  // ouvrir : en croissance (ou compagnie de votre pays) si le réseau est plus petit que la flotte ne le permet
  if((m==='grow'||mine||(m==='steady'&&(e.mavg||0)>0.05))&&e.routes<e.fleet*(mine?2:1.6)&&Math.random()<(mine?0.6:m==='grow'?0.3:0.08)){
    const to=asBestPair(e); if(to&&raceAddPair(e,e.hub,to,2)&&(e.fleet>=40||mine))
      aiNews(`${mine?'🇨🇩':'🧭'} ${e.name} ouvre ${keyCity(e.hub)} – ${keyCity(to)} (forte demande, ${carriersOn(e.hub,to).length-1} concurrent${carriersOn(e.hub,to).length>2?'s':''}).`,'news',mine);
  }
  // fermer : compagnie en difficulté avec trop de lignes pour sa flotte (jamais celles de votre pays)
  if(!mine&&m==='retrench'&&e.routes>Math.max(2,e.fleet*1.1)&&Math.random()<0.5){ const k=asWorstPair(e); if(k){ raceDropPair(e,k.slice(0,3),k.slice(3)); if(e.fleet>=40) aiNews(`✂️ ${e.name} ferme ${keyCity(k.slice(0,3))} – ${keyCity(k.slice(3))}, trop peu rentable.`,'news'); } }
  // les meilleures s'envolent, les mal gérées s'enfoncent
  if((e.mavg||0)>0.12&&e.cash>e.fleet*15e6){ e.skill=Math.min(0.5,(e.skill||0)+0.004); e.rep=clamp((e.rep||60)+0.15,10,95); }
  else if(!mine&&(e.mavg||0)<-0.12){ e.rep=clamp((e.rep||60)-0.2,10,95); }
  if(mine){ e.cash=Math.max(e.cash,e.fleet*5e6); if((e.debt||0)>0) e.debt=0; e.rep=Math.max(e.rep||60,58);
    if(e.code!=='MSB'&&e.fleet<25){ e.fleet+=1; const R=(S.rivals||[]).find(x=>x.code===e.code); if(R) R.fleet=e.fleet; } }   // les petites compagnies du pays grandissent chaque semaine
}
// une compagnie de votre pays disparue revient (une seule fois)
function asRevive(){
  if(!S||!S.ai||!S.company) return; const cc=homeCC(); S.asRevived=S.asRevived||{};
  for(const e of S.ai.list){ if(e.status!=='dead'||e.cc!==cc||S.asRevived[e.code]||e.acquiredBy===S.company.code||!AP(e.hub)) continue;
    S.asRevived[e.code]=S.time; e.status='ok'; delete e.deadAt; delete e.acquiredBy; delete e.deathWhy;
    e.fleet=Math.max(10,e.fleet||0); e.cash=Math.max(e.cash||0,4e8); e.debt=0; e.rep=Math.max(e.rep||0,62); e.skill=Math.max(e.skill||0,0.15); e.safety=Math.max(e.safety||1,1); e.plan={mode:'grow',until:S.time+12*7*DAY};
    const R=(S.rivals||[]).find(x=>x.code===e.code); if(R) R.fleet=e.fleet;
    let n=0; for(let i=0;i<8&&n<6;i++){ const to=asBestPair(e); if(to&&raceAddPair(e,e.hub,to,2)) n++; else break; }
    S.ai.ver++; aiNews(`🇨🇩 ${e.name} renaît : l’État congolais et des investisseurs injectent ${fmtMoney(4e8)}. ${e.fleet} avions, ${n} lignes depuis ${keyCity(e.hub)}.`,'news',true); }
}
function asHook(){ if(asHook.done||typeof aiStep!=='function') return; asHook.done=true;
  { const _st=aiStep; aiStep=function(e,oilF){ const r=_st.apply(this,arguments); try{ asStep(e); }catch(x){ console.warn('asStep',x); } return r; }; }
  { const _rt=retireAICorp; retireAICorp=function(e,b,p){ if(asMine(e)){ e.cash=Math.max(e.cash,e.fleet*8e6,1e8); e.debt=0; e.plan={mode:'grow',until:S.time+8*7*DAY}; if(e.routes<3&&typeof raceAddPair==='function'){ const to=asBestPair(e); if(to) raceAddPair(e,e.hub,to,2); } return; } return _rt.apply(this,arguments); }; }
  { const _bk=aiBankrupt; aiBankrupt=function(e){ if(asMine(e)){ e.cash=Math.max(e.cash,e.fleet*8e6,1e8); e.debt=0; aiNews(`🇨🇩 ${e.name} évite la faillite : l’État congolais la renfloue.`,'news'); return; } return _bk.apply(this,arguments); }; }
  { const _aq=aiAcquireCompany; aiAcquireCompany=function(buyer,target,kind){ if(asMine(target)&&!asMine(buyer)) return false; return _aq.apply(this,arguments); }; }
  if(typeof aiSell==='function'){ const _sl=aiSell; aiSell=function(e,n,why){ if(asMine(e)) return 0; return _sl.apply(this,arguments); }; }
  if(typeof aiWeekly==='function'){ const _aw=aiWeekly; aiWeekly=function(){ const r=_aw.apply(this,arguments); try{ asRevive(); }catch(x){ console.warn(x); } return r; }; }
  setTimeout(()=>{ try{ asRevive(); }catch(x){} },2500);
  // trésorerie des compagnies du pays : jamais dans le rouge (l'État et les banques du pays suivent)
  if(typeof aiHourly==='function'){ const _ah=aiHourly; aiHourly=function(){ const r=_ah.apply(this,arguments); try{ if(S&&S.ai&&S.company) for(const e of aiAlive()) if(asMine(e)&&e.cash<e.fleet*2e6) e.cash=e.fleet*5e6; }catch(x){} return r; }; }
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ asHook(); }catch(e){ console.warn(e); } },0));
