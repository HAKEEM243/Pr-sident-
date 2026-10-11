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
  if(e.fleet<target){ const add=Math.max(1,Math.round((target-e.fleet)*0.08)); e.fleet+=add; e.cash+=add*6e6; if(add>=3) aiNews(`✈️ ${e.name} reçoit ${add} avions neufs (${e.fleet} au total).`,'rival',false); }
  // il ne vous copie pas : il s'améliore et ouvre SES propres destinations
  aiImprove(e,lvl,true);
}
// une compagnie IA s'améliore : nouvelles destinations à elle, flotte modernisée, meilleur service, fidélité, hub agrandi
function aiImprove(e,lvl,isNat){
  if(Math.random()>0.25+0.12*lvl) return;
  const mineSet=new Set(S.routes.flatMap(r=>r.stops));
  const r=Math.random(), cc=e.cc||homeOf(e.code);
  if(r<0.35){ // une destination que vous ne desservez pas
    const cand=AIRPORT_CODES.filter(c=>c!==e.hub&&AP(c).cls>=1&&!mineSet.has(c)&&!carriersOn(e.hub,c).includes(e.code)&&dist(e.hub,c)>150&&dist(e.hub,c)<(e.fleet>=60?7000:isNat?2600:3500))
      .sort((x,y)=>(AP(y).cc===cc)-(AP(x).cc===cc)||marketDemand(e.hub,y)-marketDemand(e.hub,x)).slice(0,12);
    if(cand.length){ const c=pick(cand); (S.ai.extra[e.code]=S.ai.extra[e.code]||[]).push(pairKey(e.hub,c)); e.routes++; S.ai.ver++;
      aiNews(`🆕 ${e.name} ouvre une nouvelle destination : ${keyCity(e.hub)} → ${keyCity(c)}.`,'rival',isNat); }
  } else if(r<0.55){ e.skill=clamp((e.skill||0)+0.04,-0.6,0.6); e.age=Math.max(2,(e.age||8)-1.5);
    aiNews(`🛩️ ${e.name} modernise sa flotte : avions plus récents, moins de pannes, moins de carburant.`,'rival',isNat);
  } else if(r<0.75){ e.rep=clamp((e.rep||60)+3,10,95);
    aiNews(pick([`🍽️ ${e.name} améliore son service à bord : repas, sièges, Wi-Fi. Les passagers apprécient.`,`🥂 ${e.name} lance une nouvelle classe Affaires et un salon VIP.`,`⏱️ ${e.name} devient plus ponctuelle : nouveaux horaires et équipes au sol renforcées.`]),'rival',isNat);
  } else if(r<0.9){ e.rep=clamp((e.rep||60)+1.5,10,95); e.cash+=e.fleet*0.5e6;
    aiNews(`💳 ${e.name} lance un programme de fidélité : miles, surclassements, partenaires.`,'rival',isNat);
  } else { const a=AP(e.hub); if(a&&!S.hubs.includes(e.hub)){ const st=[['terminal',x=>!x.terminal],['extend',x=>x.cls<5&&x.surface==='Asphalte'],['ils',x=>!x.ils&&x.surface==='Asphalte']].find(([k,ok])=>UPGRADES[k]&&ok(a));
      if(st){ (S.upgrades[e.hub]=S.upgrades[e.hub]||[]).push(st[0]); applyUpgrades(); aiNews(`🏗️ ${e.name} finance des travaux à ${keyCity(e.hub)} (${UPGRADES[st[0]].name.toLowerCase()}).`,'rival',isNat); } } }
}
// plus de compagnies IA dans le monde : de nouvelles entrent sur le marché chaque semaine
function aiWorldGrow(){
  if(!S.ai||typeof AIRLINE_DB==='undefined') return; const target=120; if(S.ai.list.length>=target) return;
  const have=new Set(S.ai.list.map(e=>e.code)), mine=S.company.code;
  const cand=Object.entries(AIRLINE_DB).filter(([c,a])=>!have.has(c)&&c!==mine&&AP(a[2])&&a[3]>=3).sort((x,y)=>y[1][3]-x[1][3]).slice(0,30);
  for(let i=0;i<3&&cand.length;i++){ const [c]=cand.splice(Math.floor(Math.random()*Math.min(10,cand.length)),1)[0]; const e=makeAI(c); S.ai.list.push(e); S.ai.ver++;
    aiNews(`🆕 ${e.name} (${ccName(e.cc)}) entre dans la course : ${e.fleet} avions au départ de ${keyCity(e.hub)}.`,'rival',mineCountry(e.cc)); }
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
{ const _aw=aiWeekly; aiWeekly=function(){ _aw(); if(window.SE_SAFE) return; try{ natRivalWeekly(); }catch(e){ console.warn(e); } try{ aiWorldGrow(); const lv=typeof drive==='function'?drive():2; for(const e of aiAlive().sort((x,y)=>y.fleet-x.fleet).slice(0,6)) aiImprove(e,lv,false); }catch(e){ console.warn(e); } try{ if(Math.floor(S.time/(7*DAY))%4===0) hrAiBuilds(); }catch(e){ console.warn(e); } }; }

/* ---------- population du pays et des villes ---------- */
// population du pays (estimation de départ × évolution du directeur du monde) et part qui vit autour de l'aéroport
function apPopHtml(code){
  const A=AP(code); if(!A||typeof wdC!=='function') return ''; const x=wdC(A.cc); if(!x) return '';
  const base=typeof WD_POP!=='undefined'&&WD_POP[A.cc], pop=base?base*x.pop:null, yr=x.pr*100;
  const city=cityPop(code)||(pop?Math.max(0.05,pop*Math.min(0.16,(A.traffic||0.05)/Math.max(1,countryTraffic(A.cc))*0.5)):null);
  return `<div class="small">👥 ${pop?`${esc(ccName(A.cc))} : <b>${pop.toFixed(pop<20?1:0).replace('.',',')} M</b> d’habitants`:`Population de ${esc(ccName(A.cc))} : indice ${(x.pop*100).toFixed(1).replace('.',',')}`} · <span class="${yr>=0?'pos':'neg'}">${yr>=0?'+':''}${yr.toFixed(1).replace('.',',')} %/an</span>${city?` · région de ${esc(A.city)} ≈ <b>${city.toFixed(city<2?2:1).replace('.',',')} M</b>`:''} · richesse ${x.rich>=1?'+':'−'}${Math.abs(Math.round((x.rich-1)*100))} %</div>`;
}

/* ---------- pistes : allonger jusqu'aux plus gros avions ---------- */
if(UPGRADES.extend){ UPGRADES.extend.can=a=>a.surface==='Asphalte'&&a.cls<5; UPGRADES.extend.desc='+1 classe et +700 m de piste : A320/737 en classe 3, gros-porteurs en 4, A380 et 747 en 5.';
  const ap0=UPGRADES.extend.apply; UPGRADES.extend.apply=a=>{ a.cls=Math.min(5,a.cls+1); a.runway+=700; if(typeof xpRefresh==='function') xpRefresh(a.code); }; }
UPGRADES.rwlong={name:'Piste géante 4 000 m (A380, 747)', icon:'🛬', days:0, cost:a=>Math.round((25e6+a.traffic*4e6)/1e5)*1e5, can:a=>a.surface==='Asphalte'&&a.cls>=4&&a.runway<4000,
  desc:'La piste passe à 4 000 m et 60 m de large : tous les avions du monde peuvent se poser, même pleins de carburant.', apply:a=>{ a.runway=Math.max(a.runway,4000); a.cls=5; if(typeof xpRefresh==='function') xpRefresh(a.code); }};

/* ---------- population des villes ---------- */
function cityPop(code){ const A=AP(code); if(!A) return null; const x=typeof wdC==='function'&&wdC(A.cc);
  if(A.popK) return A.popK/1000*(x?Math.pow(x.pop,1.3):1);   // les villes grandissent un peu plus vite que le pays (exode rural)
  return null; }
function cityPopTxt(code){ const p=cityPop(code); if(!p) return ''; return (p>=1?p.toFixed(p<10?1:0).replace('.',',')+' M':Math.round(p*1000)+' k')+' hab.'; }
// la piste allongée apparaît aussi en 3D et sert aux décollages et atterrissages
{ const _r=runwaysOf; runwaysOf=function(code){ const out=_r(code), a=AP(code); if(!a||!out.length||out._ext) return out; out._ext=true;
  const real=out.filter(r=>!r.xp); if(!real.length) return out; const main=real.reduce((x,y)=>y.len>x.len?y:x,real[0]), ext=a.runway-main.len;
  if(ext>50){ const twin=real.find(r=>r.thr===main.end), np=fromRw(main,main.len+ext,0); main.end.lat=np.lat; main.end.lon=np.lon; main.len+=ext; if(twin) twin.len+=ext; }
  return out; }; }
