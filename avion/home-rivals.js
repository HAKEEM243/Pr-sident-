/* =========================================================
   Sky Empire — concurrence chez vous et chantiers immédiats
   • Les chantiers d'aéroport (piste, terminal, agrandissement…) sont
     terminés dès qu'on les paie.
   • Rival national : une compagnie de votre pays grandit avec vous,
     copie vos meilleures lignes, casse ses prix, s'installe dans vos hubs.
   • Après un chantier joueur, une compagnie existante peut ouvrir une
     ligne vers l’aéroport ; une seule réaction est autorisée tous les 3 jours.
   Tout est simulé (estimations du jeu).
   ========================================================= */
'use strict';
/* ---------- chantiers immédiats ---------- */
startProject=function(code,type){
  const a=AP(code), u=UPGRADES[type]; if(!a||!u) return 'Projet inconnu';
  if(!u.can(a)) return 'Projet non disponible ici';
  const c=u.cost(a); book('investissements',-c);
  (S.upgrades[code]=S.upgrades[code]||[]).push(type); applyUpgrades();
  if(type.startsWith('xp')||type==='terminal'||type==='extend') (S.playerAirportBuilds=S.playerAirportBuilds||{})[code]=S.time;
  if(S.ai){ S.playerBuildRouteQueue=S.playerBuildRouteQueue||[]; S.playerBuildRouteQueue=S.playerBuildRouteQueue.filter(x=>x.code!==code); S.playerBuildRouteQueue.push({code,type,t:S.time}); if(S.playerBuildRouteQueue.length>20) S.playerBuildRouteQueue.shift(); }
  logMsg(`🏗️ ${u.name} à ${a.city} : terminé (${fmtMoney(c)}).`,'drc');
  return null;
};

/* ---------- réactions espacées aux investissements du joueur ---------- */
function hrPlayerBuildRouteTick(){
  if(!S.ai||!S.playerBuildRouteQueue||!S.playerBuildRouteQueue.length) return;
  const now=S.time, interval=3*DAY;
  S.playerBuildRouteQueue=S.playerBuildRouteQueue.filter(x=>now-x.t<=60*DAY);
  if(!S.playerBuildRouteQueue.length||now-(S.ai.lastPlayerBuildRouteAt??-Infinity)<interval) return;
  const task=S.playerBuildRouteQueue.find(x=>now-x.t>=interval); if(!task) return;
  if(now-(task.lastTry??-Infinity)<DAY) return; task.lastTry=now;
  const target=task.code, A=AP(target); if(!A||A.cls<2) { S.playerBuildRouteQueue=S.playerBuildRouteQueue.filter(x=>x!==task); return; }
  const viable=aiAlive().filter(e=>e.fleet>=5&&e.cash>e.fleet*3e6&&e.routes<e.fleet*0.9&&dist(e.hub,target)>200)
    .sort((x,y)=>marketDemand(y.hub,target)/(1+aiOpenRoutes(y)*0.1)-marketDemand(x.hub,target)/(1+aiOpenRoutes(x)*0.1)).slice(0,8);
  for(const e of viable) if(aiRoute(e,'open',target)){
    S.ai.lastPlayerBuildRouteAt=now; S.playerBuildRouteQueue=S.playerBuildRouteQueue.filter(x=>x!==task); return;
  }
}

/* Air Kivu choisit et finance son réseau ; ses résultats hebdomadaires restent calculés par aiStep. */
function hrAirKivuRouteTick(){
  const e=aiBy('KVA'); if(!e||e.status==='dead') return;
  const now=S.time; if(now-(e.lastStartupRouteAttempt??e.founded??now)<3*DAY) return;
  e.lastStartupRouteAttempt=now;
  if((e.lastMargin||0)<=0.025||e.cash<=e.fleet*14e6) return;
  const cap=Math.max(2,Math.floor(e.fleet*0.8)); if(aiOpenRoutes(e)>=cap) return;
  aiRoute(e,'open');
}

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
  if(r<0.35&&aiAirportMarketOpen(e.hub)){ // une destination que vous ne desservez pas
    const cand=AIRPORT_CODES.filter(c=>c!==e.hub&&aiAirportMarketOpen(c)&&AP(c).cls>=1&&!mineSet.has(c)&&!carriersOn(e.hub,c).includes(e.code)&&dist(e.hub,c)>150&&dist(e.hub,c)<(e.fleet>=60?7000:isNat?2600:3500))
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
  const cand=Object.entries(AIRLINE_DB).filter(([c,a])=>!have.has(c)&&c!==mine&&AP(a[2])&&a[3]>=3&&aiAirlineMarketOpen(c)).sort((x,y)=>y[1][3]-x[1][3]).slice(0,30);
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

/* ---------- l’IA des chantiers ---------- */
// Les projets joueurs n’ajoutent pas de lignes IA ; leur entrée reste progressive et indépendante.
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
{ const _dt=dailyTick; dailyTick=function(){ _dt(); if(window.SE_SAFE) return; try{ hrPlayerBuildRouteTick(); hrAirKivuRouteTick(); }catch(e){ console.warn(e); } }; }

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

/* =========================================================
   Le gouvernement de votre pays bâtit des aéroports (IA),
   saisons de la diaspora, villes qui grandissent.
   ========================================================= */
// chaque semaine, l'État de votre hub peut bitumer ou allonger la piste d'une ville, puis vous proposer de la desservir
function homeGovBuilds(){
  const cc=homeCcOf(); if(!cc||!S.ai||typeof govOf!=='function'||Math.random()>0.3) return;
  const g=govOf(cc), cand=AIRPORT_CODES.filter(c=>AP(c).cc===cc&&!S.hubs.includes(c)).map(c=>({c,a:AP(c),p:cityPop(c)||AP(c).traffic*10}))
    .filter(x=>x.a.surface!=='Asphalte'||x.a.cls<3).sort((x,y)=>y.p-x.p).slice(0,15);
  if(!cand.length) return; const {c,a}=pick(cand);
  const type=a.surface!=='Asphalte'?'pave':(UPGRADES.extend&&UPGRADES.extend.can(a)?'extend':null); if(!type||!UPGRADES[type]) return;
  (S.upgrades[c]=S.upgrades[c]||[]).push(type); applyUpgrades(); if(typeof xpRefresh==='function') xpRefresh(c);
  const what=type==='pave'?'bitume la piste':'allonge la piste';
  govNote(cc,`🏛️ ${ccWith(cc)} : le gouvernement du président ${g.leader} ${what} de ${a.city}${cityPopTxt(c)?` (${cityPopTxt(c)})`:''} — les avions de ligne peuvent désormais s’y poser.`,true);
  // contrat pour être la première compagnie à relier la ville (déjà géré par les contrats d'État existants)
  if(!(S.inbox||[]).some(m=>m.st==='new'&&m.code==='GOV'+cc)&&S.fleet.length){ const reward=Math.round((2e6+(cityPop(c)||0.05)*4e6)/1e5)*1e5;
    mailPush({code:'GOV'+cc,name:`Gouvernement — ${ccName(cc)}`,color:'#16a34a',ceo:`Président ${g.leader}`},'gov-open',`Nouvel aéroport : ${a.city}`,
      `Cher président-directeur général,<br>nous venons de moderniser l’aéroport de <b>${a.city}</b>${cityPopTxt(c)?` (${cityPopTxt(c)})`:''}. Si vous ouvrez une ligne vers ${a.city} et la faites voler au moins <b>4 fois</b> dans les 60 jours, l’État vous versera <b>${fmtMoney(reward)}</b>. Votre rival national est aussi sur les rangs.<br>— Président ${esc(g.leader)}`,
      [{k:'ok',l:'🤝 J’accepte'},{k:'no',l:'Refuser'}],{cc,hub:c,reward});
  }
  // le rival national s'y installe s'il est en forme
  const nr=natRival(); if(nr&&Math.random()<0.5&&aiAirportMarketOpen(nr.hub)&&aiAirportMarketOpen(c)&&!carriersOn(nr.hub,c).includes(nr.code)){ (S.ai.extra[nr.code]=S.ai.extra[nr.code]||[]).push(pairKey(nr.hub,c)); nr.routes++; S.ai.ver++;
    aiNews(`🆕 ${nr.name} annonce des vols vers ${a.city}, le nouvel aéroport.`,'rival',true); }
}
// saisons de la diaspora : à Noël et l'été, les familles rentrent au pays
const DIASPORA={CD:['FR','BE','ZA','US','CA','GB','DE','CH','AO','CG'],CG:['FR','BE','CD'],SN:['FR','IT','ES','US'],CI:['FR','BE','US'],CM:['FR','BE','DE','US'],NG:['GB','US'],MA:['FR','ES','BE','NL','IT'],DZ:['FR'],TN:['FR']};
const diasporaSeason=t=>{ const m=new Date(t).getUTCMonth(); return m===11||m===6||m===7; };
{ const _dm=demandMult; demandMult=function(a,b){ let k=_dm(a,b); const A=AP(a), B=AP(b); if(!A||!B) return k;
  if(diasporaSeason(S.time)){ const d1=DIASPORA[A.cc], d2=DIASPORA[B.cc]; if((d1&&d1.includes(B.cc))||(d2&&d2.includes(A.cc))) k*=1.35; }
  // les grandes villes qui grandissent attirent un peu plus de voyageurs que le seul pays
  for(const X of [A,B]) if(X.popK){ const p=cityPop(X.code); if(p) k*=Math.pow(Math.max(0.5,p/(X.popK/1000)),0.3); }
  return k; }; }
function diasporaNews(){ const cc=homeCcOf(); if(!cc||!DIASPORA[cc]) return; const m=new Date(S.time).getUTCMonth(), key=new Date(S.time).getUTCFullYear()+'-'+(m===11?'d':'s');
  if(!diasporaSeason(S.time)||(S.diaNews||'')===key) return; S.diaNews=key;
  aiNews(`✈️ ${m===11?'Fêtes de fin d’année':'Vacances d’été'} : la diaspora de ${ccName(cc)} rentre au pays (${DIASPORA[cc].slice(0,4).map(ccName).join(', ')}…). Demande +35 % sur ces lignes : avions pleins et billets plus chers possibles.`,'news',true); }
{ const _aw2=aiWeekly; aiWeekly=function(){ _aw2(); if(window.SE_SAFE) return; try{ homeGovBuilds(); diasporaNews(); }catch(e){ console.warn(e); } }; }

/* ---------- habitants et voyageurs en avion ---------- */
// voyages par an dans un aéroport : trafic de base × demande du pays (directeur du monde) × croissance de la ville
function paxYear(code){ const A=AP(code); if(!A) return 0; const x=typeof wdC==='function'&&wdC(A.cc);
  return (A.traffic||0)*1e6*(typeof wdF==='function'?wdF(A.cc):1)*(A.popK&&x?Math.pow(x.pop,1.3):1); }
const fmtN=n=>n>=1e6?(n/1e6).toFixed(n<1e7?1:0).replace('.',',')+' M':n>=1e3?Math.round(n/1e3)+' k':String(Math.round(n));
function countryAirHtml(cc){
  cc=cc||homeCC(); const x=typeof wdC==='function'&&wdC(cc), base=typeof WD_POP!=='undefined'&&WD_POP[cc]; if(!x||!base) return '';
  const pop=base*x.pop*1e6, aps=AIRPORT_CODES.filter(c=>AP(c).cc===cc), tot=aps.reduce((t,c)=>t+paxYear(c),0)/2;   // un voyage = un départ + une arrivée
  // une ligne par ville (aéroport principal), les plus fréquentées d'abord
  const byCity=new Map(); for(const c of aps){ const A=AP(c), k=A.city, cur=byCity.get(k); if(!cur||A.traffic>AP(cur).traffic) byCity.set(k,c); }
  const top=[...byCity.values()].sort((a,b)=>paxYear(b)-paxYear(a)), n=UI.cityAll?top.length:8;
  const meDay=c=>{ try{ const M=apMarket(c), m=M.list.find(r=>r.me); return m?m.pax:0; }catch(e){ return 0; } };
  return `<div class="card"><h3>👥 ${esc(ccName(cc))} : ${fmtN(pop)} d’habitants · ✈️ ${fmtN(tot)} voyages en avion par an</h3>
    <div class="small mut">Soit environ 1 voyage par an pour ${Math.max(1,Math.round(pop/Math.max(1,tot)))} habitants. Les chiffres bougent avec la population, l’économie, la saison et les crises du pays.</div>
    <div style="overflow-x:auto"><table class="tbl small"><tr><th>Ville</th><th>Habitants</th><th>Voyageurs/an</th><th>Vous/an</th></tr>
    ${top.slice(0,n).map(c=>{ const A=AP(c), p=cityPop(c), me=meDay(c)*365; return `<tr data-act="openAp" data-c="${c}" style="cursor:pointer"><td><b>${esc(A.city)}</b> <span class="mut">${c}</span></td><td>${p?fmtN(p*1e6):'—'}</td><td><b>${fmtN(paxYear(c))}</b></td><td class="${me?'pos':'mut'}">${me?fmtN(me):'—'}</td></tr>`; }).join('')}</table></div>
    ${top.length>8?`<div class="btns"><button class="btn sm" data-act="cityAll">${UI.cityAll?'Réduire':`Voir les ${top.length} villes`}</button></div>`:''}</div>`;
}
function registerCityActions(){ ACTIONS.cityAll=()=>{ UI.cityAll=!UI.cityAll; renderPanel(); }; }
{ const _ap=apPopHtml; apPopHtml=function(code){ const h=_ap(code), A=AP(code); if(!A) return h; const p=cityPop(code), py=paxYear(code);
  return h+`<div class="small">✈️ ≈ <b>${fmtN(py)}</b> voyageurs par an dans cet aéroport${p?` (${(py/(p*1e6)).toFixed(2).replace('.',',')} passage par habitant de la ville)`:''}.</div>`; }; }
