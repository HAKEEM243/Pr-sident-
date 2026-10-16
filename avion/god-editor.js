/* =========================================================
   Sky Empire — 🧬 ÉDITEUR DIVIN (en direct)
   Tout se modifie en temps réel, pendant que le jeu tourne :
   • votre compagnie (argent, image, nom, couleur, limite de flotte…) ;
   • TOUS les avions (sièges, autonomie, vitesse, prix — même 1 $ —,
     consommation) et création d'avions sans aucune limite ;
   • les pays (nom, capitale, population, richesse, envie de voyager,
     économie, guerre) ;
   • les aéroports (nom, trafic, taille de piste, population, fermeture) ;
   • l'économie (demande mondiale, pétrole) et le temps ;
   • l'IA : niveau des compagnies de Débutant à Légendaire, et chaque
     compagnie (flotte, argent, image, talent, ambition, faillite…).
   Chaque modification est notée dans un journal et peut être annulée.
   ⚠️ LE REVERS : l'œil du monde. Chaque triche qui vous avantage fait
   monter la « vigilance mondiale ». Trop haut : enquête des autorités,
   vos alliés et compatriotes se retournent contre vous, coalition des
   compagnies du monde, boycott des passagers, vassales qui refusent de
   payer. La vigilance redescend avec le temps (et quand vous rendez le
   jeu plus dur). Tout est fictif.
   ========================================================= */
'use strict';
const GOD_AI=[['🐣 Débutant',0],['🙂 Normal',1],['💪 Fort',2],['🧠 Expert',3],['👑 Légendaire',4]];
const GOD_TABS=[['me','🏢 Ma compagnie'],['mdl','✈️ Avions'],['cc','🌍 Pays'],['ap','🛫 Aéroports'],['eco','📈 Économie & temps'],['ai','🤖 IA'],['eye','👁️ Vigilance & journal']];
const godS=()=>{ S.god=S.god||{heat:0,log:[],ov:{ap:{},mdl:{},cc:{}},dem:1,aiLvl:1,fleetCap:0,closed:{},tier:0}; S.god.ov=S.god.ov||{ap:{},mdl:{},cc:{}}; S.god.closed=S.god.closed||{}; return S.god; };
const godHeat=()=>S&&S.god?S.god.heat||0:0;
const godMine=()=>{ const s=new Set(S.hubs||[]); for(const r of S.routes||[]) for(const c of r.stops) s.add(c); return s; };
const godMineCc=()=>new Set([...godMine()].map(c=>AP(c)&&AP(c).cc));

/* ---------- valeurs d'origine (pour pouvoir tout restaurer) ---------- */
const _godOrig={ap:{},mdl:{},cc:{}};
function godKeep(t,id,f,cur){ const o=_godOrig[t][id]||(_godOrig[t][id]={}); if(!(f in o)) o[f]=cur; }
function godRestoreStatic(){
  for(const [id,o] of Object.entries(_godOrig.ap)) if(AP(id)) Object.assign(AIRPORTS[id],o);
  for(const [id,o] of Object.entries(_godOrig.mdl)){ const m=MODELS.find(x=>x.id===id); if(m) Object.assign(m,o); }
  for(const [id,o] of Object.entries(_godOrig.cc)) if(COUNTRIES[id]&&o.name!==undefined) COUNTRIES[id][0]=o.name;
}
// réapplique les modifications enregistrées dans la partie (au chargement)
function godReapply(){
  godRestoreStatic(); if(!S||!S.god) return; const ov=godS().ov;
  for(const [id,o] of Object.entries(ov.ap)) if(AP(id)) for(const [f,v] of Object.entries(o)){ godKeep('ap',id,f,AIRPORTS[id][f]); AIRPORTS[id][f]=v; }
  for(const [id,o] of Object.entries(ov.mdl)){ const m=MODELS.find(x=>x.id===id); if(m) for(const [f,v] of Object.entries(o)){ godKeep('mdl',id,f,m[f]); m[f]=v; } }
  for(const [id,o] of Object.entries(ov.cc)) if(COUNTRIES[id]&&o.name!==undefined){ godKeep('cc',id,'name',COUNTRIES[id][0]); COUNTRIES[id][0]=o.name; }
  if(typeof xpRefresh==='function') for(const id of Object.keys(ov.ap)) try{ xpRefresh(id); }catch(e){}
}

/* ---------- lire / écrire une valeur ---------- */
function godGet(t,id,f){
  const g=godS();
  if(t==='me'){ if(f==='cash') return Math.round(S.cash); if(f==='rep') return Math.round(S.reputation); if(f==='name') return S.company.name; if(f==='color') return S.company.color||'#ffd60a'; if(f==='fleetCap') return g.fleetCap||0; if(f==='fuel') return Math.round(S.fuel.stock); }
  if(t==='mdl'){ const m=getModel(id); return m?m[f]:''; }
  if(t==='ap'){ const A=AP(id); if(!A) return ''; if(f==='closed') return !!g.closed[id]; return A[f]; }
  if(t==='cc'&&!S.wd&&typeof wdInit==='function') try{ wdInit(); }catch(e){}
  if(t==='cc'){ const x=typeof wdC==='function'&&wdC(id), ov=g.ov.cc[id]||{};
    if(f==='name') return COUNTRIES[id]?COUNTRIES[id][0]:''; if(f==='cap') return ov.cap||(typeof mainAirport==='function'?mainAirport(id):'');
    if(f==='pop') return x?+(x.pop*(WD_POP[id]||1)).toFixed(2):''; if(f==='rich') return x?+x.rich.toFixed(2):''; if(f==='dem') return ov.dem||1; if(f==='reg') return x?(x.war?'war':x.reg):'normal'; }
  if(t==='eco'){ if(f==='dem') return g.dem||1; if(f==='oil') return Math.round(S.oilBase||S.oil); }
  if(t==='ai'){ if(f==='lvl') return g.aiLvl??1; if(f==='drive') return S.rivalDrive===undefined?3:S.rivalDrive; const e=aiBy(id); return e?(f==='amb'?(e.amb??0.6):e[f]):''; }
  return '';
}
function godPut(t,id,f,v){
  const g=godS();
  if(t==='me'){ if(f==='cash'){ book('admin',v-S.cash); } else if(f==='rep') S.reputation=clamp(v,0,100); else if(f==='name') S.company.name=String(v).slice(0,40)||S.company.name; else if(f==='color') S.company.color=v; else if(f==='fleetCap') g.fleetCap=Math.max(0,v|0); else if(f==='fuel') S.fuel.stock=clamp(v,0,S.fuel.cap); return; }
  if(t==='mdl'){ const m=getModel(id); if(!m) return; const isBase=MODELS.includes(m); if(isBase){ godKeep('mdl',id,f,m[f]); (g.ov.mdl[id]=g.ov.mdl[id]||{})[f]=v; } m[f]=v; return; }
  if(t==='ap'){ const A=AP(id); if(!A) return; if(f==='closed'){ if(v) g.closed[id]=true; else delete g.closed[id]; return; } godKeep('ap',id,f,A[f]); A[f]=v; (g.ov.ap[id]=g.ov.ap[id]||{})[f]=v; if(f==='cls'&&typeof xpRefresh==='function') try{ xpRefresh(id); }catch(e){} return; }
  if(t==='cc'&&!S.wd&&typeof wdInit==='function') try{ wdInit(); }catch(e){}
  if(t==='cc'){ const x=typeof wdC==='function'&&wdC(id), ov=g.ov.cc[id]=g.ov.cc[id]||{};
    if(f==='name'){ godKeep('cc',id,'name',COUNTRIES[id][0]); COUNTRIES[id][0]=v; ov.name=v; }
    else if(f==='cap') ov.cap=v; else if(f==='dem') ov.dem=Math.max(0,v);
    else if(x&&f==='pop') x.pop=Math.max(0.01,v/(WD_POP[id]||1)); else if(x&&f==='rich') x.rich=Math.max(0.05,v);
    else if(x&&f==='reg'){ if(v==='war'){ x.war=1; x.closed=false; } else { x.war=0; x.closed=false; x.reg=v; x.regUntil=S.time+365*DAY; } }
    if(x&&typeof wdCompute==='function') x.f=wdCompute(id); return; }
  if(t==='eco'){ if(f==='dem') g.dem=Math.max(0,v); else if(f==='oil'){ S.oilBase=v; S.oil=+(v*(typeof oilMult==='function'?oilMult():1)).toFixed(2); } return; }
  if(t==='ai'){ if(f==='lvl'){ g.aiLvl=v|0; return; } if(f==='drive'){ S.rivalDrive=v|0; return; }
    const e=aiBy(id); if(!e) return; e[f]=v; const R=(S.rivals||[]).find(x=>x.code===id); if(R){ if(f==='fleet') R.fleet=v; if(f==='cash') R.cash=v; if(f==='rep') R.rep=v; } if(S.ai) S.ai.ver++; }
}

/* ---------- la triche se paie : combien chaque modification vous avantage ---------- */
function godCheat(t,id,f,o,v){
  const r=(a,b)=>b>0&&a>0?a/b:1, mineAp=godMine(), mineCc=godMineCc();
  if(t==='me'){ if(f==='cash') return v>o?Math.log10((v-o)/1e6+1)*7:-Math.log10((o-v)/1e6+1)*3; if(f==='rep') return (v-o)/3; if(f==='fuel') return v>o?(v-o)/2e5:0; return 0; }
  if(t==='mdl'){ const owned=S.fleet.some(a=>a.model===id)?1.5:1;
    if(f==='price') return v<o?Math.min(25,(1-r(v,o))*25)*owned:-(r(v,o)-1)*2; if(f==='range'||f==='seats'||f==='speed'||f==='cargo') return (r(v,o)-1)*10*owned; if(f==='burn') return v<o?(1-r(v,o))*15*owned:0; return 0; }
  if(t==='ap'){ if(f==='traffic'||f==='popK') return mineAp.has(id)?(r(v,o)-1)*8:0; if(f==='cls') return mineAp.has(id)&&v>o?(v-o)*3:0; if(f==='closed') return 4; return 0; }
  if(t==='cc'){ const m=mineCc.has(id)?1:0.2; if(f==='pop'||f==='rich'||f==='dem') return (r(v,o)-1)*8*m; if(f==='reg') return v==='war'?6:v==='boom'&&m===1?4:0; return 0; }
  if(t==='eco'){ if(f==='dem') return (v-o)*25; if(f==='oil') return (o-v)/8; }
  if(t==='ai'){ if(f==='lvl') return (o-v)*8; if(f==='drive') return (o-v)*4; if(f==='cash') return (o-v)/1e8; if(f==='fleet') return (o-v)/5; if(f==='rep'||f==='skill') return (o-v)*(f==='skill'?20:0.3); return 0; }
  return 0;
}
function godSet(t,id,f,v,opt){
  const g=godS(), o=godGet(t,id,f); if(o===v) return;
  godPut(t,id,f,v);
  const h=opt&&opt.undo?0:clamp(godCheat(t,id,f,+o||0,+v||0),-30,40);
  if(!opt||!opt.undo){ g.log.unshift({id:uid(),t,i:id,f,o,v,h:+h.toFixed(1),at:S.time}); if(g.log.length>80) g.log.length=80; }
  g.heat=clamp((g.heat||0)+h,0,120); godBadge();
}
function godUndo(lid){ const g=godS(), L=g.log.find(x=>x.id===lid); if(!L) return; godSet(L.t,L.i,L.f,L.o,{undo:true}); g.heat=clamp(g.heat-Math.max(0,L.h)*0.7,0,120); g.log=g.log.filter(x=>x!==L); godBadge(); }

/* ---------- conséquences : l'œil du monde ---------- */
const GOD_TIERS=[[0,'😇 Personne ne remarque rien','#22c55e'],[25,'👀 Des rumeurs circulent','#eab308'],[50,'⚖️ Enquête internationale','#f97316'],[75,'🔥 Coalition mondiale contre vous','#ef4444'],[100,'🚨 Le monde entier vous déteste','#b91c1c']];
const godTier=()=>{ const h=godHeat(); let k=0; GOD_TIERS.forEach((t,i)=>{ if(h>=t[0]) k=i; }); return k; };
function godWeekly(){
  const g=godS(), k=godTier(), was=g.tier||0;
  if(k>was){ const msg=['','👀 Les journaux parlent de « chiffres impossibles » chez '+S.company.name+'. Les compagnies vous observent.','⚖️ Les autorités de l’aviation ouvrent une enquête sur '+S.company.name+' : vos compatriotes et vos alliés prennent leurs distances.','🔥 Coalition : les compagnies du monde entier s’unissent contre '+S.company.name+'. Les passagers commencent à vous boycotter.','🚨 Scandale mondial : plus personne ne fait confiance à '+S.company.name+'.'][k];
    aiNews(msg,'rival',true); if(typeof toast==='function'&&!UI.silent) toast(msg,'bad'); }
  g.tier=k;
  // la vigilance retombe doucement
  g.heat=Math.max(0,(g.heat||0)-(k>=3?1:2));
  if(k>=1&&S.ai) for(const e of aiAlive().slice(0,40)) e.amb=Math.min(1,(e.amb??0.6)+0.01*k);
  // enquête : amende proposée
  if(k>=2&&Math.random()<0.35&&typeof mailPush==='function'&&!(S.inbox||[]).some(m=>m.kind==='godFine'&&m.st==='new')){ const fine=Math.round(Math.max(1e6,Math.abs(S.cash)*0.04*k)/1e5)*1e5;
    mailPush({code:'AUTH',name:'Autorité de l’aviation civile',ceo:'L’inspecteur général',color:'#64748b'},'godFine','⚖️ Enquête sur vos comptes',`Nos inspecteurs relèvent des chiffres « impossibles » chez ${esc(S.company.name)} (vigilance mondiale : ${Math.round(godHeat())} %). Payez une amende de <b>${fmtMoney(fine)}</b> pour clore l’enquête (vigilance −20), ou refusez (image −6, vigilance +5).`,
      [{k:'pay',l:`💸 Payer ${fmtMoney(fine)}`},{k:'no',l:'Refuser'}],{fine}); }
  // coalition : des compagnies du monde s'installent sur vos lignes et cassent les prix
  if(k>=3&&S.routes.length&&S.ai){ const n=k>=4?3:2;
    for(let i=0;i<n;i++){ const r=pick(S.routes), a=r.stops[0], b=r.stops[r.stops.length-1], key=pairKey(a,b), e=pick(aiAlive().filter(x=>x.fleet>=10)); if(!e) break;
      S.ai.wars=S.ai.wars||{}; if(S.ai.wars[e.code+key]) continue; S.ai.wars[e.code+key]={code:e.code,a,b,until:S.time+21*DAY,kind:'prix'};
      if(!carriersOn(a,b).includes(e.code)&&typeof raceAddPair==='function') raceAddPair(e,a,b,2);
      aiNews(`🔥 Coalition : ${e.name} attaque votre ligne ${keyCity(a)}–${keyCity(b)} (prix cassés).`,'rival',true); } }
  if(k>=4){ S.reputation=clamp(S.reputation-1.5,0,100); }
  // le niveau de l'IA : les compagnies apprennent plus ou moins vite
  const L=g.aiLvl??1; if(S.ai&&L!==1) for(const e of aiAlive()){ e.skill=clamp((e.skill||0)+(L-1)*0.003,-0.6,0.6); e.rep=clamp((e.rep||60)+(L-1)*0.05,10,95); if(L>=3&&(e.mavg||0)>0&&Math.random()<0.05*(L-2)){ e.fleet++; } }
}

/* ---------- plus de nouvelles compagnies automatiques (sauf si vous l'autorisez) ---------- */
function godNoNewAI(){
  { const _st=aiStartup; aiStartup=function(...a){ if(!S||!S.allowNewAI) return false; return _st(...a); }; }
  { const _wg=aiWorldGrow; aiWorldGrow=function(){ if(!S||!S.allowNewAI) return; return _wg(); }; }
  { const _pb=hrPlayerBuildRouteTick; hrPlayerBuildRouteTick=function(){ if(!S||!S.allowNewAI){ if(S) S.playerBuildRouteQueue=[]; return; } return _pb(); }; }
}
// ménage : supprimer d'un coup les petites compagnies inventées par le jeu
function godCleanup(){ const cc=homeCC(); let n=0;
  for(const e of aiAlive()){ if(e.real||e.code==='MSB'||e.code==='KVA'||(S.vassals&&S.vassals[e.code])||e.godMade) continue; if(e.cc===cc&&!UI.godCleanHome) continue;
    if(typeof retireAICorp==='function'){ retireAICorp(e); e.deathWhy='retirée par l’éditeur'; n++; } }
  return n; }

/* ---------- branchements ---------- */
function godHook(){ if(godHook.done) return; godHook.done=true;
  try{ godNoNewAI(); }catch(e){ console.warn(e); }
  // demande : mondiale, par pays, et boycott si vous trichez trop
  { const _dm=demandMult; demandMult=function(a,b){ let k=_dm(a,b); if(!S||!S.god) return k; const g=S.god, A=AP(a), B=AP(b), ca=g.ov.cc[A.cc], cb=g.ov.cc[B.cc];
      k*=(g.dem??1)*Math.sqrt((ca&&ca.dem!==undefined?ca.dem:1)*(cb&&cb.dem!==undefined?cb.dem:1)); const h=g.heat||0; if(h>75) k*=1-Math.min(0.4,(h-75)/100); return k; }; }
  { const _ac=airportClosed; airportClosed=function(code){ if(S&&S.god&&S.god.closed&&S.god.closed[code]) return true; return _ac(code); }; }
  // vos compatriotes et alliés se retournent contre vous pendant l'enquête
  if(typeof aiPeace==='function'){ const _ap=aiPeace; aiPeace=function(code){ if(godHeat()>=50) return false; return _ap(code); }; }
  if(typeof isAlly==='function'){ /* isAlly est une constante : l'enquête agit via aiPeace et la coalition */ }
  if(typeof vassWeekly==='function'){ const _vw=vassWeekly; vassWeekly=function(){ if(godHeat()>=75){ if(Object.keys(S.vassals||{}).length) logMsg('🔥 Vos vassales refusent de payer tant que dure le scandale.','bad'); return; } return _vw(); }; }
  // niveau de l'IA : les marges de toutes les compagnies
  if(typeof aiOperatingMargin==='function'){ const _om=aiOperatingMargin; aiOperatingMargin=function(e,oilF){ const L=S&&S.god?(S.god.aiLvl??1):1; return _om(e,oilF)+(L-1)*0.025; }; }
  if(typeof aiWeekly==='function'){ const _aw=aiWeekly; aiWeekly=function(){ const wk=S.ai&&S.ai.lastWeek; _aw(); try{ if(S.ai&&S.ai.lastWeek!==wk) godWeekly(); }catch(e){ console.warn(e); } }; }
  { const _ma=mailAnswer; mailAnswer=function(id,k){ const m=(S.inbox||[]).find(x=>x.id===id); if(!m||m.kind!=='godFine'||m.st!=='new') return _ma(id,k); const g=godS();
      if(k==='pay'){ book('incidents',-m.fine); g.heat=Math.max(0,g.heat-20); m.res=`💸 Amende payée (${fmtMoney(m.fine)}) : l’enquête est close, vigilance −20.`; }
      else { S.reputation=clamp(S.reputation-6,0,100); g.heat=Math.min(120,g.heat+5); m.res='Vous refusez de payer : image −6, vigilance +5.'; }
      m.st='done'; logMsg(m.res,k==='pay'?'ok':'warn'); renderMailBadge(); if(UI.modal==='inbox') openM('inbox'); godBadge(); }; }
  // limite de flotte
  { const _buy=ACTIONS.buy; if(_buy) ACTIONS.buy=d=>{ const cap=S.god&&S.god.fleetCap; if(cap&&S.fleet.length>=cap) return toast(`Limite de flotte atteinte (${cap} avions) — modifiable dans l’éditeur`,'bad'); return _buy(d); }; }
  // l'éditeur remplace l'ancien onglet « Outils de test »
  if(typeof pAdmin==='function') pAdmin=function(){ return `<div class="card"><b>🧬 L’éditeur divin</b><div class="small">Modifiez tout le jeu en direct : pays, aéroports, avions, économie, IA…</div><button class="btn gold" data-act="godOpen">Ouvrir l’éditeur</button></div>`; };
  MODALS.god=()=>showModal('🧬 Éditeur divin — en direct', godHtml(), true);
  Object.assign(ACTIONS,{
    godOpen:()=>openM('god'), godTab:d=>{ UI.godTab=d.k; refreshModal(); }, godPick:d=>{ UI['god_'+d.t]=d.v; refreshModal(); },
    godUndo:d=>{ godUndo(d.id); refreshModal(); }, godUndoAll:()=>{ if(!confirm('Annuler toutes les modifications du journal ?')) return; const g=godS(); for(const L of g.log.slice()) godUndo(L.id); refreshModal(); },
    godDo:d=>{ godDo(d.k,d); refreshModal(); if(typeof renderTop==='function') renderTop(); },
  });
  INPUTS.gd=el=>{ const t=el.dataset.t, id=el.dataset.id||'', f=el.dataset.f, num=el.type==='number'||el.type==='range';
    let v=el.type==='checkbox'?el.checked:num?+el.value:el.value; if(num&&!Number.isFinite(v)) return;
    if(el.dataset.mul) v=v*+el.dataset.mul; godSet(t,id,f,v); const lab=el.closest('label')&&el.closest('label').querySelector('.gv'); if(lab) lab.textContent=godFmt(f,v);
    if(typeof renderTop==='function') renderTop(); const hb=$('#godHeat'); if(hb) hb.outerHTML=godHeatHtml(); };
  INPUTS.gdNewAi=el=>{ S.allowNewAI=el.checked; toast(el.checked?'🆕 De nouvelles compagnies pourront naître':'🚫 Plus aucune nouvelle compagnie automatique','info'); };
  INPUTS.gdq=el=>{ UI['god_'+el.dataset.t]=el.value.trim().toUpperCase(); };
  godReapply(); godBadge();
  // une autre partie est chargée : on réapplique ses modifications
  let lastS=S; setInterval(()=>{ if(typeof S!=='undefined'&&S!==lastS){ lastS=S; try{ godReapply(); godBadge(); }catch(e){} } },1500);
  // bouton « 🧬 Éditeur » dans le menu Plus
  if(typeof pMore==='function'){ const _pm=pMore; pMore=function(){ const h=_pm(); return h.replace('<div class="morelist">','<div class="morelist"><button data-act="godOpen">🧬 <b>Éditeur divin</b><small>Tout modifier en direct… mais le monde vous surveille</small></button>'); }; }
}
// actions rapides
function godDo(k,d){
  if(k==='fix'){ for(const a of S.fleet){ a.condition=100; a.sinceA=a.sinceC=a.sinceD=0; } godS().heat+=2; }
  else if(k==='fuel'){ godSet('me','','fuel',S.fuel.cap); }
  else if(k==='cash'){ godSet('me','','cash',S.cash+(+d.v)); }
  else if(k==='time'){ UI.silent=true; advance(+d.v*HOUR); UI.silent=false; }
  else if(k==='newModel'){ const E=UI.godNew||{}; const m={id:'X'+uid(), name:(E.name||'Avion libre').slice(0,30), maker:'Éditeur', fam:E.fam||'A320', seats:+E.seats||0, cargo:+E.seats>0?0:(+E.cargo||20), range:Math.max(100,+E.range||8000), speed:Math.max(150,+E.speed||850), price:Math.max(0.000001,(+E.price||1)/1e6), burn:Math.max(1,+E.burn||2500), cls:clamp(+E.cls||3,1,5), alt:11500, color:'#a855f7', logo:'🧬', custom:true, god:true};
    S.customModels.push(m); const base=customSpecs({seats:m.seats,cargo:m.cargo,range:m.range,speed:m.speed}); const h=clamp((1-m.price/Math.max(0.01,base.price))*20+(base.burn>m.burn?(1-m.burn/base.burn)*10:0),0,35);
    const g=godS(); g.log.unshift({id:uid(),t:'new',i:m.id,f:'modèle',o:'',v:m.name,h:+h.toFixed(1),at:S.time}); g.heat=clamp(g.heat+h,0,120); toast(`🧬 « ${m.name} » ajouté au catalogue (${fmtMoney(m.price*1e6)})`,'ok'); }
  else if(k==='clean'){ if(!confirm('Supprimer toutes les petites compagnies inventées par le jeu (hors de votre pays, hors vassales, Masambukidi Fly et celles que vous avez créées) ?')) return; const n=godCleanup(); toast(`🧹 ${n} compagnie(s) supprimée(s)`,'ok'); }
  else if(k==='kill'){ const e=aiBy(d.c); if(e&&confirm(`Faire disparaître ${e.name} ?`)){ aiBankrupt(e); godS().heat+=8; } }
  else if(k==='newAi'){ const E=UI.godAi||{}, hub=(E.hub||'').toUpperCase(); if(!AP(hub)) return toast('Code d’aéroport inconnu','bad');
    let code=(E.code||'').toUpperCase().slice(0,3); if(!code||aiBy(code)||(typeof AIRLINE_DB!=='undefined'&&AIRLINE_DB[code])) code='G'+String.fromCharCode(65+rndi(0,25))+String.fromCharCode(65+rndi(0,25));
    const e={godMade:true, code, name:(E.name||'Nouvelle compagnie').slice(0,30), color:E.color||'#0ea5e9', hub, cc:AP(hub).cc, real:false, startup:true, founded:S.time, fleet:Math.max(1,+E.fleet||10), cash:Math.max(0,+E.cash||5e8), rep:60, skill:0.1, safety:1.1, routes:0, crashes:0, incidents:0, status:'ok', debt:0, pax:0, hist:[]};
    if(typeof AIRLINE_COLORS!=='undefined') AIRLINE_COLORS[code]=e.color; S.ai.list.push(e); S.ai.ver++; for(let i=0;i<Math.min(8,Math.ceil(e.fleet/2));i++) aiRoute(e,'open');
    aiNews(`🆕 ${e.name} naît à ${keyCity(hub)} avec ${e.fleet} avions.`,'news',true); toast(`🆕 ${e.name} créée`,'ok'); }
}
function godBadge(){ /* rien à afficher en barre : la jauge est dans l'éditeur */ }

/* ---------- interface ---------- */
function godFmt(f,v){ if(f==='cash'||f==='fine') return fmtMoney(v); if(f==='dem'||f==='rich') return '×'+(+v).toFixed(2).replace('.',','); if(f==='lvl') return (GOD_AI[v]||GOD_AI[1])[0]; if(f==='drive') return typeof RIVAL_DRIVES!=='undefined'?(RIVAL_DRIVES.find(x=>x[1]===+v)||['?'])[0]:v; if(f==='oil') return '$'+v; return String(v); }
function godHeatHtml(){ const h=Math.round(godHeat()), k=godTier(), T=GOD_TIERS[k];
  return `<div id="godHeat" class="card" style="border-color:${T[2]}"><b>👁️ Vigilance mondiale : <span style="color:${T[2]}">${h} %</span></b> — ${T[1]}
    <div style="height:10px;border-radius:6px;background:#33415555;overflow:hidden;margin:4px 0"><div style="height:100%;width:${Math.min(100,h)}%;background:linear-gradient(90deg,#22c55e,#eab308,#f97316,#ef4444)"></div></div>
    <details class="small mut"><summary>Comment ça marche ?</summary>Chaque triche qui vous avantage la fait monter. 25 % : rumeurs · 50 % : enquête, vos compatriotes et alliés se retournent contre vous · 75 % : coalition mondiale, boycott, vassales qui ne paient plus · 100 % : scandale. Elle redescend chaque semaine, ou quand vous rendez le jeu plus dur.</details></div>`; }
const gIn=(t,id,f,type,extra)=>`<input type="${type}" data-in="gd" data-t="${t}" data-id="${id}" data-f="${f}" value="${esc(String(godGet(t,id,f)))}" ${extra||''}>`;
const gRow=(lab,inp)=>`<label>${lab}${inp}</label>`;
function godHtml(){
  const tab=UI.godTab||'me', chips=GOD_TABS.map(([k,l])=>`<button class="chip ${tab===k?'on':''}" data-act="godTab" data-k="${k}">${l}</button>`).join('');
  let body='';
  if(tab==='me'){ body=`<div class="form">
      ${gRow('Trésorerie ($)',gIn('me','','cash','number','step="1000000"'))}
      ${gRow(`Image <b class="gv">${godGet('me','','rep')}</b>`,gIn('me','','rep','range','min="0" max="100"'))}
      ${gRow('Nom de la compagnie',gIn('me','','name','text'))}
      ${gRow('Couleur',gIn('me','','color','color'))}
      ${gRow('Limite de flotte (0 = illimitée)',gIn('me','','fleetCap','number','min="0"'))}
      ${gRow('Kérosène en stock (L)',gIn('me','','fuel','number','step="10000"'))}</div>
    <div class="btns sm">${[1e6,1e8,1e9,1e10].map(v=>`<button class="btn sm" data-act="godDo" data-k="cash" data-v="${v}">+${fmtMoney(v)}</button>`).join('')}<button class="btn sm danger" data-act="godDo" data-k="cash" data-v="-100000000">−$100 M</button><button class="btn sm" data-act="godDo" data-k="fix">🔧 Flotte à neuf</button><button class="btn sm" data-act="godDo" data-k="fuel">⛽ Plein</button></div>`; }
  else if(tab==='mdl'){ const all=[...MODELS,...(S.customModels||[])], sel=getModel(UI.god_mdl)?UI.god_mdl:(S.fleet[0]&&S.fleet[0].model)||all[0].id, m=getModel(sel), N=UI.godNew||(UI.godNew={name:'Mon avion libre',seats:300,range:8000,speed:900,price:1,burn:2000,cls:3});
    body=`<label>Modèle à modifier<select data-in="gdsel" data-t="mdl">${all.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(x.name)}${x.custom?' (perso)':''}</option>`).join('')}</select></label>
      <div class="form">${gRow('Nom',gIn('mdl',sel,'name','text'))}${gRow('Sièges',gIn('mdl',sel,'seats','number','min="0"'))}${gRow('Fret (t)',gIn('mdl',sel,'cargo','number','min="0"'))}${gRow('Autonomie (km)',gIn('mdl',sel,'range','number','min="100"'))}${gRow('Vitesse (km/h)',gIn('mdl',sel,'speed','number','min="100"'))}
      ${gRow('Prix (millions $ — 0,000001 = 1 $)',gIn('mdl',sel,'price','number','min="0" step="any"'))}${gRow('Consommation (L/h)',gIn('mdl',sel,'burn','number','min="1"'))}${gRow('Classe de piste (1-5)',gIn('mdl',sel,'cls','number','min="1" max="5"'))}</div>
      <div class="small mut">${S.fleet.filter(a=>a.model===sel).length} avion(s) de ce modèle dans votre flotte · les changements s’appliquent tout de suite à tous les avions de ce type.</div>
      <h3>➕ Créer un avion sans limite</h3><div class="form">${['name','seats','cargo','range','speed','price','burn','cls'].map(k=>`<label>${{name:'Nom',seats:'Sièges',cargo:'Fret (t)',range:'Autonomie (km)',speed:'Vitesse (km/h)',price:'Prix ($ — même 1 $)',burn:'Consommation (L/h)',cls:'Classe de piste'}[k]}<input ${k==='name'?'':'type="number" step="any"'} data-in="gdnew" data-k="${k}" value="${esc(String(N[k]??''))}"></label>`).join('')}</div>
      <div class="btns"><button class="btn gold" data-act="godDo" data-k="newModel">🧬 Créer l’avion</button></div>`; }
  else if(tab==='cc'){ const cc=COUNTRIES[UI.god_cc]?UI.god_cc:homeCC(), aps=(typeof cAirports==='function'?cAirports(cc):[]).slice(0,40), x=typeof wdC==='function'&&wdC(cc);
    body=`<label>Pays (code à 2 lettres, ex. CD, FR, NG)<input data-in="gdq" data-t="cc" value="${cc}" maxlength="2"></label><div class="btns sm"><button class="btn sm" data-act="godTab" data-k="cc">Afficher</button></div>
      <h3>${COUNTRIES[cc][2]} ${esc(COUNTRIES[cc][0])}</h3><div class="form">
      ${gRow('Nom du pays',gIn('cc',cc,'name','text'))}
      <label>Capitale (aéroport principal)<select data-in="gd" data-t="cc" data-id="${cc}" data-f="cap">${aps.map(c=>`<option value="${c}" ${c===godGet('cc',cc,'cap')?'selected':''}>${esc(AP(c).city)} (${c})</option>`).join('')}</select></label>
      ${x?gRow(`Population (${WD_POP[cc]?'millions':'indice'})`,gIn('cc',cc,'pop','number','step="any" min="0"')):''}
      ${x?gRow(`Richesse <b class="gv">${godFmt('rich',godGet('cc',cc,'rich'))}</b>`,gIn('cc',cc,'rich','range','min="0.1" max="5" step="0.05"')):''}
      ${gRow(`Envie de voyager (part de la population qui prend l’avion) <b class="gv">${godFmt('dem',godGet('cc',cc,'dem'))}</b>`,gIn('cc',cc,'dem','range','min="0" max="5" step="0.05"'))}
      ${x?`<label>Situation<select data-in="gd" data-t="cc" data-id="${cc}" data-f="reg">${[['normal','Normale'],['boom','En plein essor'],['recession','Récession'],['reconstruction','Reconstruction'],['war','🔥 Guerre']].map(([k,l])=>`<option value="${k}" ${godGet('cc',cc,'reg')===k?'selected':''}>${l}</option>`).join('')}</select></label>`:''}</div>`; }
  else if(tab==='ap'){ const code=AP(UI.god_ap)?UI.god_ap:(S.company.hub), A=AP(code);
    body=`<label>Aéroport (code à 3 lettres, ex. FIH, CDG, GOM)<input data-in="gdq" data-t="ap" value="${code}" maxlength="3"></label><div class="btns sm"><button class="btn sm" data-act="godTab" data-k="ap">Afficher</button></div>
      <h3>${flag(code)} ${esc(A.city)} <span class="mut">${code}</span></h3><div class="form">
      ${gRow('Nom de la ville',gIn('ap',code,'city','text'))}${gRow('Trafic (millions de passagers / an)',gIn('ap',code,'traffic','number','step="any" min="0"'))}
      ${gRow('Classe de piste (1 = petite, 5 = géante)',gIn('ap',code,'cls','number','min="1" max="5"'))}${gRow('Longueur de piste (m)',gIn('ap',code,'runway','number','min="300"'))}
      ${gRow('Population de la ville (milliers)',gIn('ap',code,'popK','number','min="0"'))}
      <label class="tog"><input type="checkbox" data-in="gd" data-t="ap" data-id="${code}" data-f="closed" ${godGet('ap',code,'closed')?'checked':''}> <b>Fermer l’aéroport</b></label></div>`; }
  else if(tab==='eco'){ body=`<div class="form">
      ${gRow(`Demande mondiale (tous les passagers) <b class="gv">${godFmt('dem',godGet('eco','','dem'))}</b>`,gIn('eco','','dem','range','min="0" max="4" step="0.05"'))}
      ${gRow(`Pétrole <b class="gv">$${godGet('eco','','oil')}</b>`,gIn('eco','','oil','range','min="5" max="300" step="1"'))}</div>
      <h3>⏩ Le temps</h3><div class="btns sm">${[[1,'+1 h'],[24,'+1 jour'],[168,'+7 jours'],[720,'+30 jours']].map(([v,l])=>`<button class="btn sm" data-act="godDo" data-k="time" data-v="${v}">${l}</button>`).join('')}</div>
      <h3>⚡ Événements</h3><div class="chips">${(typeof EVENT_TYPES!=='undefined'?EVENT_TYPES:[]).map(e=>`<button class="chip" data-act="adEvent" data-id="${e.id}">${e.icon} ${e.name}</button>`).join('')}</div>`; }
  else if(tab==='ai'){ const L=godGet('ai','','lvl'), list=aiAlive().slice().sort((x,y)=>y.fleet-x.fleet), sel=aiBy(UI.god_ai)&&aiBy(UI.god_ai).status!=='dead'?UI.god_ai:(list[0]&&list[0].code), e=aiBy(sel), A=UI.godAi||(UI.godAi={name:'Nova Congo Air',hub:'FKI',fleet:12,cash:3e8,color:'#0ea5e9'});
    body=`${gRow(`Niveau de l’IA de toutes les compagnies <b class="gv">${godFmt('lvl',L)}</b>`,gIn('ai','','lvl','range','min="0" max="4" step="1"'))}
      <div class="small mut">Plus le niveau est haut, plus les compagnies gagnent d’argent, apprennent vite et grandissent. Monter le niveau fait baisser la vigilance (vous jouez plus dur).</div>
      ${gRow(`Agressivité <b class="gv">${godFmt('drive',godGet('ai','','drive'))}</b>`,gIn('ai','','drive','range','min="0" max="3" step="1"'))}
      <label class="tog"><input type="checkbox" data-in="gdNewAi" ${S.allowNewAI?'checked':''}> <b>Laisser naître de nouvelles compagnies</b> <span class="mut small">(désactivé : aucune compagnie ne se crée toute seule, ni quand vous agrandissez un aéroport)</span></label>
      <div class="btns sm"><button class="btn sm danger" data-act="godDo" data-k="clean">🧹 Supprimer les petites compagnies inventées (${aiAlive().filter(e=>!e.real&&e.code!=='MSB'&&e.code!=='KVA'&&e.cc!==homeCC()&&!(S.vassals&&S.vassals[e.code])&&!e.godMade).length} hors de votre pays)</button></div>
      <h3>Une compagnie</h3><label>Compagnie<select data-in="gdsel" data-t="ai">${list.slice(0,300).map(x=>`<option value="${x.code}" ${x.code===sel?'selected':''}>${esc(x.name)} · ${x.fleet} av.</option>`).join('')}</select></label>
      ${e?`<div class="form">${gRow('Flotte',gIn('ai',sel,'fleet','number','min="1"'))}${gRow('Trésorerie ($)',gIn('ai',sel,'cash','number','step="1000000"'))}${gRow(`Image <b class="gv">${Math.round(e.rep)}</b>`,gIn('ai',sel,'rep','range','min="10" max="95"'))}${gRow(`Talent de gestion <b class="gv">${(+e.skill||0).toFixed(2)}</b>`,gIn('ai',sel,'skill','range','min="-0.6" max="0.6" step="0.05"'))}${gRow(`Ambition <b class="gv">${(+(e.amb??0.6)).toFixed(2)}</b>`,gIn('ai',sel,'amb','range','min="0" max="1" step="0.05"'))}</div>
        <div class="btns sm"><button class="btn sm danger" data-act="godDo" data-k="kill" data-c="${sel}">💥 Faire disparaître</button><button class="btn sm" data-act="airlineCard" data-c="${sel}">Voir la fiche</button></div>`:''}
      <h3>🆕 Créer une compagnie</h3><div class="form">${['name','code','hub','fleet','cash','color'].map(k=>`<label>${{name:'Nom',code:'Code (2-3 lettres)',hub:'Hub (code aéroport)',fleet:'Avions',cash:'Trésorerie ($)',color:'Couleur'}[k]}<input ${k==='color'?'type="color"':k==='fleet'||k==='cash'?'type="number"':''} data-in="gdai" data-k="${k}" value="${esc(String(A[k]??''))}"></label>`).join('')}</div>
      <div class="btns"><button class="btn gold" data-act="godDo" data-k="newAi">🆕 Créer</button></div>`; }
  else { const g=godS();
    body=`<h3>📜 Journal des modifications</h3>${g.log.length?`<div class="btns sm"><button class="btn sm danger" data-act="godUndoAll">↩️ Tout annuler</button></div>`+g.log.slice(0,40).map(L=>`<div class="row small" style="justify-content:space-between;gap:6px;border-bottom:1px solid #ffffff14;padding:3px 0"><span>${fmtDate(L.at)} · ${({me:'🏢',mdl:'✈️',cc:'🌍',ap:'🛫',eco:'📈',ai:'🤖',new:'🧬'})[L.t]||''} ${esc(L.i||'')} <b>${esc(L.f)}</b> : ${esc(String(L.o).slice(0,14))} → ${esc(String(L.v).slice(0,14))} <span class="${L.h>0?'neg':'pos'}">${L.h>0?'+':''}${L.h}</span></span>${L.t!=='new'?`<button class="btn sm" data-act="godUndo" data-id="${L.id}">↩️</button>`:''}</div>`).join(''):'<div class="small mut">Aucune modification.</div>'}`; }
  return `${godHeatHtml()}<div class="chips">${chips}</div><div class="small mut">✨ Tout s’applique en direct, le jeu continue de tourner.</div>${body}`;
}
// sélections et formulaires de création
function godInputs(){
  INPUTS.gdsel=el=>{ UI['god_'+el.dataset.t]=el.value; refreshModal(); };
  INPUTS.gdnew=el=>{ (UI.godNew=UI.godNew||{})[el.dataset.k]=el.value; };
  INPUTS.gdai=el=>{ (UI.godAi=UI.godAi||{})[el.dataset.k]=el.value; };
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ godHook(); godInputs(); }catch(e){ console.warn(e); } },0));
