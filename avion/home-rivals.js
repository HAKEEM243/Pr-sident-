/* =========================================================
   Sky Empire — concurrence chez vous et chantiers immédiats
   • Les chantiers d'aéroport (piste, terminal, agrandissement…) sont
     terminés dès qu'on les paie.
   • Rival national : une compagnie de votre pays grandit avec vous,
     copie vos meilleures lignes, casse ses prix, s'installe dans vos hubs.
   • IA des chantiers : quand vous agrandissez un aéroport, des
     compagnies viennent s'y installer ; ailleurs, les États et les
     compagnies rivales agrandissent aussi leurs aéroports.
   Tout est simulé (estimations du jeu).
   ========================================================= */
'use strict';
/* ---------- chantiers immédiats ---------- */
startProject=function(code,type){
  const a=AP(code), u=UPGRADES[type]; if(!a||!u) return 'Projet inconnu';
  if(!u.can(a)) return 'Projet non disponible ici';
  const c=u.cost(a); book('investissements',-c);
  (S.upgrades[code]=S.upgrades[code]||[]).push(type); applyUpgrades();
  logMsg(`🏗️ ${u.name} à ${a.city} : terminé (${fmtMoney(c)}).`,'drc');
  try{ hrReactToBuild(code,type); }catch(e){ console.warn(e); }
  return null;
};

/* ---------- rival national ---------- */
const homeCcOf=()=>AP(S.company.hub)&&AP(S.company.hub).cc;
function natRival(){
  if(!S.ai||!S.ai.list) return null; const cc=homeCcOf(); if(!cc) return null;
  let e=S.natRival&&aiBy(S.natRival);
  if(e&&e.status!=='dead') return e;
  // la plus grosse compagnie IA du pays ; sinon une nouvelle compagnie nationale créée par l'État
  e=S.ai.list.filter(x=>x.status!=='dead'&&(x.cc===cc||homeOf(x.code)===cc)).sort((x,y)=>y.fleet-x.fleet)[0];
  if(!e){ const hub=mainAirport(cc)||S.company.hub, code='N'+cc;
    e={code, name:`${ccName(cc)} Airways`, color:'#0ea5e9', hub, cc, real:false, fleet:8, cash:2e8, rep:58, pax:4000, skill:0.05, safety:1, routes:4, crashes:0, incidents:0, status:'ok', debt:0, hist:[], startup:true};
    S.ai.list.push(e); S.ai.ver++; aiNews(`🆕 ${ccWith(cc)} : l’État lance « ${e.name} », une compagnie nationale pour concurrencer ${S.company.name}.`,'rival',true); }
  S.natRival=e.code; e.natRival=true; return e;
}
function natRivalWeekly(){
  const e=natRival(); if(!e) return; const lvl=typeof drive==='function'?drive():2; if(!lvl) return;
  const me=S.fleet.length, target=Math.max(10,Math.round(me*(0.35+0.15*lvl)));
  // il grandit pour suivre votre taille (financé par l'État et des investisseurs)
  if(e.fleet<target){ const add=Math.max(1,Math.round((target-e.fleet)*0.08)); e.fleet+=add; e.cash+=add*6e6; e.fAcc=0; if(add>=3) aiNews(`✈️ ${e.name} reçoit ${add} avions de plus (${e.fleet} au total) pour rivaliser avec ${S.company.name}.`,'rival',false); }
  e.rep=clamp(e.rep+(e.cash>0?0.2:-0.4),25,90);
  // il copie une de vos lignes rentables qu'il ne dessert pas encore
  if(Math.random()<0.35+0.1*lvl){ const mine=S.routes.filter(r=>routeAircraft(r).length&&r.stats.flights>=4&&(r.stats.rev-r.stats.cost)>0).sort((x,y)=>(y.stats.rev-y.stats.cost)-(x.stats.rev-x.stats.cost));
    for(const r of mine){ const a=r.stops[0], b=r.stops[r.stops.length-1], k=pairKey(a,b); if(carriersOn(a,b).includes(e.code)) continue;
      (S.ai.extra[e.code]=S.ai.extra[e.code]||[]).push(k); e.routes++; S.ai.ver++;
      aiNews(`🎯 ${e.name}, votre rival national, ouvre ${keyCity(a)}–${keyCity(b)} juste en face de vous.`,'rival',true); break; } }
  // guerre des prix sur une ligne partagée
  if(Math.random()<0.12*lvl){ const shared=S.routes.filter(r=>{ const a=r.stops[0], b=r.stops[r.stops.length-1]; return carriersOn(a,b).includes(e.code); });
    if(shared.length){ const r=pick(shared), a=r.stops[0], b=r.stops[r.stops.length-1]; S.ai.duel=S.ai.duel||{}; const d=S.ai.duel[e.code+pairKey(a,b)]||(S.ai.duel[e.code+pairKey(a,b)]={px:1,fq:0,mode:'hold',t:S.time});
      d.px=Math.max(0.7,d.px-0.08); d.fq=Math.min(4,d.fq+1); d.mode='cut'; d.t=S.time; aiNews(`⚔️ ${e.name} baisse ses prix et ajoute un vol sur ${keyCity(a)}–${keyCity(b)} pour vous prendre des passagers.`,'rival',true); } }
}
function natRivalHtml(){
  const e=natRival(); if(!e) return '';
  const shared=S.routes.filter(r=>carriersOn(r.stops[0],r.stops[r.stops.length-1]).includes(e.code));
  let mk=null; try{ mk=typeof apMarket==='function'?apMarket(S.company.hub):null; }catch(err){}
  const me=mk&&mk.list.find(x=>x.me), them=mk&&mk.list.find(x=>x.code===e.code);
  const last=(S.ai.news||[]).find(n=>n.text.includes(e.name));
  return `<div class="card small rivalcard"><b>⚔️ Votre rival national : <span style="color:${e.color}">${esc(e.name)}</span></b>
    <div class="grid2"><div>Flotte : <b>${e.fleet}</b> avions <span class="mut">(vous : ${S.fleet.length})</span></div><div>Lignes face à vous : <b>${shared.length}</b></div>
    <div>Part à ${esc(AP(S.company.hub).city)} : <b>${them?Math.round(them.share*100):0} %</b> <span class="mut">(vous : ${me?Math.round(me.share*100):0} %)</span></div><div>Stratégie : <b>${typeof apStatus==='function'&&them?apStatus(them):'—'}</b></div></div>
    ${last?`<div class="mut">Dernier coup : ${last.text}</div>`:''}</div>`;
}

/* ---------- l'IA des chantiers ---------- */
// quand vous agrandissez un aéroport, il attire des compagnies (vos concurrents viennent s'y battre)
function hrReactToBuild(code,type){
  if(!S.ai) return; const A=AP(code), big=type.startsWith('xp')||type==='terminal'||type==='extend';
  if(!big) return;
  const cand=aiAlive().filter(e=>e.fleet>=15&&!carriersOn(code,e.hub).includes(e.code)&&dist(e.hub,code)>250&&dist(e.hub,code)<(e.fleet>=60?9000:3500)).sort((x,y)=>y.fleet-x.fleet).slice(0,8);
  const n=Math.min(cand.length,1+Math.floor(Math.random()*2)), names=[];
  for(let i=0;i<n;i++){ const e=cand[Math.floor(Math.random()*cand.length)]; if(names.includes(e.name)) continue; (S.ai.extra[e.code]=S.ai.extra[e.code]||[]).push(pairKey(e.hub,code)); e.routes++; names.push(e.name); }
  const nr=natRival(); if(nr&&nr.hub!==code&&!carriersOn(nr.hub,code).includes(nr.code)&&A.cc===homeCcOf()){ (S.ai.extra[nr.code]=S.ai.extra[nr.code]||[]).push(pairKey(nr.hub,code)); names.push(nr.name); }
  if(names.length){ S.ai.ver++; aiNews(`🏗️ Le nouvel aéroport de ${keyCity(code)} attire la concurrence : ${names.join(', ')} ${names.length>1?'ouvrent':'ouvre'} des vols.`,'rival',true); }
}
// ailleurs, États et compagnies rivales agrandissent aussi leurs aéroports (tous les mois)
function hrAiBuilds(){
  if(!S.ai||Math.random()>0.55) return;
  const pool=aiAlive().filter(e=>e.fleet>=30).map(e=>e.hub).filter(c=>AP(c)&&!S.hubs.includes(c));
  const boom=typeof wdC==='function'?Object.entries(S.wd&&S.wd.c||{}).filter(([cc,x])=>x.reg==='boom').map(([cc])=>mainAirport(cc)).filter(Boolean):[];
  const all=[...pool,...boom]; if(!all.length) return; const code=pick(all), a=AP(code);
  const steps=[['terminal',a=>!a.terminal,'un terminal moderne'],['ils',a=>!a.ils&&a.surface==='Asphalte','un balisage ILS'],['extend',a=>a.cls<4&&a.surface==='Asphalte','une piste allongée pour les gros-porteurs'],['xp1',a=>(a.xp||0)===0,'un terminal agrandi'],['xp2',a=>(a.xp||0)===1,'une nouvelle jetée'],['xp3',a=>(a.xp||0)===2,'une deuxième piste']];
  const st=steps.find(([k,ok])=>UPGRADES[k]&&ok(a)); if(!st) return;
  (S.upgrades[code]=S.upgrades[code]||[]).push(st[0]); applyUpgrades();
  const owner=aiAlive().filter(e=>e.hub===code).sort((x,y)=>y.fleet-x.fleet)[0];
  if(owner){ owner.rep=clamp(owner.rep+1,10,95); owner.fleet+=Math.round(owner.fleet*0.02); }
  aiNews(`🏗️ ${ccWith(a.cc)} : ${keyCity(code)} inaugure ${st[2]}${owner?` — ${owner.name} en profite pour grandir`:''}.`,'rival',mineCountry(a.cc));
}
{ const _aw=aiWeekly; aiWeekly=function(){ _aw(); if(window.SE_SAFE) return; try{ natRivalWeekly(); }catch(e){ console.warn(e); } try{ if(Math.floor(S.time/(7*DAY))%4===0) hrAiBuilds(); }catch(e){ console.warn(e); } }; }

/* ---------- population du pays et des villes ---------- */
// population du pays (estimation de départ × évolution du directeur du monde) et part qui vit autour de l'aéroport
function apPopHtml(code){
  const A=AP(code); if(!A||typeof wdC!=='function') return ''; const x=wdC(A.cc); if(!x) return '';
  const base=typeof WD_POP!=='undefined'&&WD_POP[A.cc], pop=base?base*x.pop:null, yr=x.pr*100;
  const city=pop?Math.max(0.05,pop*Math.min(0.16,(A.traffic||0.05)/Math.max(1,countryTraffic(A.cc))*0.5)):null;
  return `<div class="small">👥 ${pop?`${esc(ccName(A.cc))} : <b>${pop.toFixed(pop<20?1:0).replace('.',',')} M</b> d’habitants`:`Population de ${esc(ccName(A.cc))} : indice ${(x.pop*100).toFixed(1).replace('.',',')}`} · <span class="${yr>=0?'pos':'neg'}">${yr>=0?'+':''}${yr.toFixed(1).replace('.',',')} %/an</span>${city?` · région de ${esc(A.city)} ≈ <b>${city.toFixed(city<2?2:1).replace('.',',')} M</b>`:''} · richesse ${x.rich>=1?'+':'−'}${Math.abs(Math.round((x.rich-1)*100))} %</div>`;
}
