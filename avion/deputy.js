/* =========================================================
   Sky Empire — 🤝 adjoints
   On engage un adjoint pour un hub : on lui dit le pays visé (ou le
   monde entier) et l'argent qu'il peut dépenser. Il étudie chaque
   destination (demande, concurrence, distance, pistes), choisit
   l'avion le plus rentable, achète l'avion, ouvre la ligne,
   programme les rotations et recrute les pilotes.
   Il peut aussi continuer chaque semaine avec un budget fixé.
   Estimations du jeu : la rentabilité réelle dépend ensuite des prix,
   du service et des concurrents.
   ========================================================= */
'use strict';
const DEP_SAL=9000;   // salaire mensuel d'un adjoint
function depList(){ return (S.deputies=S.deputies||[]); }
function depModels(){ return [...MODELS,...(S.customModels||[])].filter(m=>!isCargo(m)&&m.seats>0&&m.fam!=='CONC'); }
// sièges que j'offre déjà par semaine (un sens) entre deux villes
function depMySeats(a,b){ let s=0; for(const r of S.routes){ const st=r.stops; if(!(st[0]===a&&st[st.length-1]===b)&&!(st[0]===b&&st[st.length-1]===a)) continue;
  for(const ac of S.fleet) for(const p of ac.plan||[]) if(p.routeId===r.id) s+=p.weekly*modelOf(ac).seats; } return s; }
// estimation hebdomadaire pour un avion du modèle m sur hub ⇄ dest
function depEval(hub,dest,m,extraSeats){
  const d=dist(hub,dest); if(d<80||d>m.range*0.97) return null;
  if(runwayCheck(m,hub)||runwayCheck(m,dest)) return null;
  if(checkLegs({model:m.id,ownerCode:S.company.code},legsFor([hub,dest]))) return null;
  const rotH=routeCycleHours({stops:[hub,dest]},{model:m.id}); const maxRot=Math.floor(MAX_WEEK_HOURS/rotH); if(maxRot<1) return null;
  const n=(typeof carriersOn==='function'?carriersOn(hub,dest):[]).filter(c=>c!==S.company.code).length;
  const share=1/(1+0.75*n), wk=marketDemand(hub,dest)*7*share*0.9 - depMySeats(hub,dest)*0.8 - (extraSeats||0)*0.8;   // voyageurs/semaine encore à prendre (un sens)
  if(wk<m.seats*0.5) return null;
  const rot=Math.max(1,Math.min(maxRot,Math.round(wk/(m.seats*0.8)))), pax=Math.min(wk,rot*m.seats*0.82);
  const fare=baseFare(hub,dest), rev=2*pax*fare*1.06;
  const fuel=rot*rotH*m.burn*fuelPrice(hub)*0.92, ops=rot*2*(350+m.seats*7+d*0.05*m.seats/10)+rot*rotH*(260+m.seats*3.2);
  const capital=m.price*1e6*0.0085/4.33;   // usure / immobilisation, comme un loyer
  const profit=rev-fuel-ops-capital, load=pax/(rot*m.seats);
  return {hub,dest,m,d,rot,pax,load,rev,profit,n,price:m.price*1e6};
}
// plan : liste de mouvements (avion libre ou achat) dans la limite du budget
function depPlan(D,budget){
  const hub=D.hub, cc=D.cc, out=[], used={};
  let dests=AIRPORT_CODES.filter(c=>c!==hub&&AP(c).cls>=1&&!airportClosed(c)&&(cc==='*'||(cc==='home'?AP(c).cc===AP(hub).cc:AP(c).cc===cc)));
  // par défaut : seulement des villes où je n'ai pas encore de ligne depuis ce hub
  const mine=new Set(S.routes.filter(r=>r.stops[0]===hub).flatMap(r=>r.stops.slice(1)));
  if(!D.reinforce) dests=dests.filter(c=>!mine.has(c));
  if(dests.length>160) dests=dests.sort((a,b)=>marketDemand(hub,b)-marketDemand(hub,a)).slice(0,160);
  const models=depModels().filter(m=>!D.modern||!/occasion/i.test(m.name)); let left=budget;
  const lineFee=dest=>S.routes.some(r=>r.stops.length===2&&r.stops[0]===hub&&r.stops[1]===dest)||out.some(o=>o.dest===dest)?0:lineCost([hub,dest]);
  // 1) avions libres du hub (rien à acheter)
  const idle=S.fleet.filter(a=>a.hub===hub&&a.status!=='manual'&&!(a.plan||[]).some(p=>p.weekly>0));
  for(const ac of idle){ let best=null; const m=modelOf(ac);
    for(const c of dests){ if(!D.reinforce&&used[c]) continue; const e=depEval(hub,c,m,used[c]); if(e&&e.profit>0&&(!best||e.profit>best.profit)) best=e; }
    if(best&&lineFee(best.dest)<=left){ left-=lineFee(best.dest); out.push({...best,ac:ac.id,fee:lineFee(best.dest)}); used[best.dest]=(used[best.dest]||0)+best.rot*m.seats; } }
  // 2) achats : à chaque tour, le meilleur rapport bénéfice / argent investi
  for(let guard=0;guard<(D.maxN||25);guard++){ let best=null;
    for(const c of dests){ const fee=lineFee(c); for(const m of models){ const cost=m.price*1e6*(D.lease?0.017:1)+fee; if(cost>left) continue;
        const e=depEval(hub,c,m,used[c]); if(!e||e.profit<=0) continue; const roi=e.profit*52/(m.price*1e6+fee);
        const k=out.filter(o=>o.dest===c).length; if(k>=(D.reinforce?3:1)) continue;       // une nouvelle ligne = un avion (jusqu'à 3 si on renforce)
        const sc=roi*(0.6+0.4*Math.min(1,e.load/0.7))*Math.pow(0.7,k)*Math.pow(0.85,out.filter(o=>o.m===m).length);
        if(!best||sc>best.sc) best={...e,sc,fee,cost}; } }
    if(!best) break;
    out.push(best); left-=best.cost; used[best.dest]=(used[best.dest]||0)+best.rot*best.m.seats; }
  return {moves:out, spent:budget-left};
}
// exécution du plan
function depRun(D,budget,silent){
  const P=depPlan(D,budget), done=[];
  for(const mv of P.moves){
    let r=S.routes.find(x=>x.stops.length===2&&x.stops[0]===mv.hub&&x.stops[1]===mv.dest);
    if(!r){ const o=openLine([mv.hub,mv.dest]); if(typeof o==='string') continue; r=o; }
    if(!r.audit) auditLine(r);                                        // audit fait par l'adjoint : demande et prix idéaux connus
    let ac=mv.ac?S.fleet.find(a=>a.id===mv.ac):null;
    if(!ac){ ac=addAircraft(mv.m.id,{owned:!D.lease,hub:mv.hub}); S.cash-=D.lease?mv.m.price*1e6*0.017:mv.m.price*1e6; }
    let e=setPlan(ac,r.id,mv.rot); if(e&&typeof autoPlan==='function') autoPlan(ac);
    mv._ac=ac; mv._r=r;
    done.push(mv);
  }
  depCare(D);
  // les avions décollent tout de suite (visibles en 2D et en 3D), puis suivent leur programme
  for(const mv of done){ const ac=mv._ac; if(ac&&ac.status==='idle'&&ac.loc===mv.hub&&!canFly(ac)) dispatchRoute(ac,mv._r,1,S.time); }
  if(done.length){
    // pilotes (2 par avion + 1 de réserve) et personnel au sol / cabine
    const cnt={}; for(const a of S.fleet){ const f=modelOf(a).fam; cnt[f]=(cnt[f]||0)+1; }
    for(const f of new Set(done.map(x=>x.m.fam))){ let q=qualifiedPilots(f)+S.pilots.filter(p=>p.training&&p.training.fam===f).length, g=0;
      while(q<2*cnt[f]+1&&g++<3000){ const p=makePilot([f],true); S.pilots.push(p); book('recrutement',-p.salary); q++; } }
    const need=staffNeed(); for(const k of ['pnc','meca','sol']){ const miss=need[k]-S.staff[k]; if(miss>0){ book('recrutement',-STAFF_CATS[k][1]*0.6*miss); S.staff[k]+=miss; } }
    if(typeof invalidateScheduleCache==='function') invalidateScheduleCache();
  }
  const spent=done.reduce((s,x)=>s+(x.ac?0:x.cost||0)+(x.ac?x.fee||0:0),0), gain=done.reduce((s,x)=>s+x.profit,0);
  D.log=D.log||[]; D.log.unshift({t:S.time,n:done.length,spent,gain,txt:(()=>{ const byM={}; for(const x of done){ const k=x.ac?'avion(s) libre(s)':x.m.name.replace(/ \(occasion\)/,''); byM[k]=(byM[k]||0)+1; } return Object.entries(byM).map(([k,n])=>n+'× '+k).join(', ')+' → '+[...new Set(done.map(x=>AP(x.dest).city))].join(', '); })()}); D.log=D.log.slice(0,12);
  D.spent=(D.spent||0)+spent;
  if(!silent||done.length) logMsg(`🤝 ${D.name} (${AP(D.hub).city}) : ${done.length?done.length+' avion(s) placé(s), '+fmtMoney(spent)+' dépensés':'rien de rentable trouvé'}.`,done.length?'ok':'info');
  return {done,spent,gain};
}
// entretien courant du hub : audits des lignes, pilotes, PNC, mécaniciens, personnel au sol
function depCare(D){ let n=0;
  for(const r of S.routes) if(r.stops[0]===D.hub&&!r.audit){ if(!auditLine(r)) n++; }
  const cnt={}; for(const a of S.fleet){ const f=modelOf(a).fam; cnt[f]=(cnt[f]||0)+1; }
  for(const f of new Set(S.fleet.filter(a=>a.hub===D.hub).map(a=>modelOf(a).fam))){ let q=qualifiedPilots(f)+S.pilots.filter(p=>p.training&&p.training.fam===f).length, g=0;
    while(q<2*cnt[f]+1&&g++<3000){ const p=makePilot([f],true); S.pilots.push(p); book('recrutement',-p.salary); q++; } }
  const need=staffNeed(); for(const k of ['pnc','meca','sol']){ const miss=need[k]-S.staff[k]; if(miss>0){ book('recrutement',-STAFF_CATS[k][1]*0.6*miss); S.staff[k]+=miss; } }
  return n; }
// chaque semaine : les adjoints « actifs » réinvestissent leur budget hebdomadaire
function depWeekly(){
  let sal=0;
  for(const D of depList()){ sal+=DEP_SAL/4.33; if(!S.hubs.includes(D.hub)) continue; try{ depCare(D); }catch(e){} if(!D.auto) continue;
    const room=S.cash-(D.reserve||0); if(room<=0) continue;
    const r=depRun(D,Math.min(D.weekly||0,room),true);
    if(r.done.length) toast(`🤝 ${D.name} a placé ${r.done.length} avion(s) depuis ${AP(D.hub).city}`,'ok'); }
  if(sal) book('salaires',-sal);
}

/* ---------- fenêtre ---------- */
function depCountryOpts(sel,hub){
  const cs=[...new Set(AIRPORT_CODES.map(c=>AP(c).cc))].filter(c=>COUNTRIES[c]).sort((a,b)=>COUNTRIES[a][0].localeCompare(COUNTRIES[b][0],'fr'));
  return `<option value="home"${sel==='home'?' selected':''}>🏠 Le pays du hub (${esc(COUNTRIES[AP(hub).cc][0])})</option><option value="*"${sel==='*'?' selected':''}>🌍 Le monde entier</option>`+
    cs.map(c=>`<option value="${c}"${sel===c?' selected':''}>${COUNTRIES[c][2]} ${esc(COUNTRIES[c][0])}</option>`).join(''); }
function depHtml(){
  const L=depList(), U=UI.dep||(UI.dep={});
  const card=D=>`<div class="card"><div class="row" style="justify-content:space-between;gap:6px"><b>🧑‍💼 ${esc(D.name)}</b><span class="small">${flag(D.hub)} ${AP(D.hub).city} → ${D.cc==='*'?'🌍 monde':D.cc==='home'?'🏠 '+esc(COUNTRIES[AP(D.hub).cc][0]):COUNTRIES[D.cc][2]+' '+esc(COUNTRIES[D.cc][0])}</span></div>
    <div class="small mut">${D.reinforce?'Nouvelles lignes et renfort':'Uniquement de nouvelles lignes'} · ${D.lease?'loue les avions':'achète les avions'}${D.modern?' récents':''} · ${D.auto?`chaque semaine jusqu’à <b>${fmtMoney(D.weekly||0)}</b>, garde ${fmtMoney(D.reserve||0)} en caisse`:'seulement quand vous le lui demandez'} · déjà dépensé ${fmtMoney(D.spent||0)}</div>
    ${(D.log||[]).slice(0,3).map(l=>`<div class="small">• ${l.n?`<b>${l.n}</b> avion(s), ${fmtMoney(l.spent)} → ≈ ${fmtMoney(l.gain)}/sem de bénéfice prévu<br><span class="mut">${esc(l.txt)}</span>`:'<span class="mut">rien de rentable trouvé</span>'}</div>`).join('')}
    <div class="btns sm"><button class="btn sm gold" data-act="depAsk" data-id="${D.id}">💰 Lui donner de l’argent</button><button class="btn sm" data-act="depAuto" data-id="${D.id}">${D.auto?'⏸️ Arrêter le mode automatique':'🔁 Mode automatique'}</button><button class="btn sm" data-act="depFire" data-id="${D.id}">👋 Renvoyer</button></div></div>`;
  let prev='';
  if(U.prev){ const D=L.find(x=>x.id===U.prev.id), P=U.prev.P;
    prev=`<div class="card gold-b"><b>📋 Proposition de ${esc(D.name)}</b> (budget ${fmtMoney(U.prev.budget)})${P.moves.length?'':'<div class="mut">Rien de rentable avec ce budget dans cette zone (les villes où vous avez déjà une ligne sont laissées de côté). Essayez un autre pays ou plus d’argent.</div>'}
      ${P.moves.length?`<div class="small">${P.moves.map(x=>`<div style="padding:5px 0;border-bottom:1px solid #ffffff14">${x.ac?'♻️ '+esc((S.fleet.find(a=>a.id===x.ac)||{}).reg||'')+' <span class="mut">(avion libre)</span>':'🛒 <b>'+esc(x.m.name)+'</b> <span class="mut">'+fmtMoney(x.price*(D.lease?0.017:1))+(D.lease?' (location)':'')+'</span>'}<br>→ ${flag(x.dest)} <b>${AP(x.dest).city}</b> <span class="mut">${num(x.d)} km${x.n?' · '+x.n+' concurrent(s)':''}</span> · ${x.rot} vols/sem · ${Math.round(x.load*100)} % plein · <b style="color:${x.profit>=0?'#4ade80':'#f87171'}">${x.profit>=0?'+':''}${fmtMoney(x.profit)}/sem</b></div>`).join('')}</div>
      <div class="small">Dépense : <b>${fmtMoney(P.spent)}</b> · bénéfice prévu ≈ <b>${fmtMoney(P.moves.reduce((s,x)=>s+x.profit,0))}</b>/semaine <span class="mut">(estimation)</span></div>
      <div class="btns"><button class="btn gold" data-act="depGo">✅ D’accord, vas-y</button><button class="btn sm" data-act="depCancel">✖ Annuler</button></div>`:''}</div>`; }
  const hub=U.hub&&S.hubs.includes(U.hub)?U.hub:S.hubs[0];
  return `<div class="simplehelp">🤝 Un <b>adjoint</b> gère un hub pour vous : dites-lui le pays et l’argent, il cherche les lignes les plus rentables, achète les avions, ouvre les lignes, fait les audits, programme les vols (les avions décollent tout de suite) et recrute pilotes, PNC, mécaniciens et personnel au sol. Chaque semaine il audite les nouvelles lignes du hub et complète le personnel. Salaire : ${fmtMoney(DEP_SAL)}/mois.</div>
  ${prev}${L.map(card).join('')}
  <div class="card"><b>➕ Engager un adjoint</b>
    <label class="small">Hub<select id="dep-hub" onchange="UI.dep.hub=this.value;refreshModal()">${S.hubs.map(h=>`<option value="${h}"${h===hub?' selected':''}>${AP(h).city} (${h})</option>`).join('')}</select></label>
    <label class="small">Pays visé<select id="dep-cc">${depCountryOpts('home',hub)}</select></label>
    <label class="small"><input type="checkbox" id="dep-modern"> Avions récents seulement (pas de vieux avions d’occasion, moins rentables mais plus modernes)</label>
    <label class="small"><input type="checkbox" id="dep-lease"> Louer les avions au lieu de les acheter (moins d’argent au départ)</label>
    <div class="btns"><button class="btn gold" data-act="depHire">🧑‍💼 Engager</button></div></div>`;
}
function depAskHtml(D){ const c=Math.max(0,S.cash);
  return `<div class="small">Capital : <b>${fmtMoney(S.cash)}</b>. ${esc(D.name)} ne dépensera jamais plus que ce montant.</div>
  <label>Budget (millions $)<input id="dep-b" type="number" min="1" step="1" value="${Math.max(1,Math.floor(c*0.5/1e6))}"></label>
  <div class="chips">${[0.25,0.5,0.75,1].map(f=>`<button class="chip" onclick="document.getElementById('dep-b').value=${Math.max(1,Math.floor(c*f/1e6))}">${f*100} %</button>`).join('')}</div>
  <label class="small">Pays visé<select id="dep-cc2">${depCountryOpts(D.cc,D.hub)}</select></label>
  <label class="small"><input type="checkbox" id="dep-mod2"${D.modern?' checked':''}> Avions récents seulement</label>
  <label class="small"><input type="checkbox" id="dep-rf2"${D.reinforce?' checked':''}> Aussi ajouter des avions sur mes lignes existantes <span class="mut">(sinon : uniquement des villes nouvelles, un avion par nouvelle ligne)</span></label>
  <div class="btns"><button class="btn gold" data-act="depPlanGo" data-id="${D.id}">🔍 Voir ce qu’il propose</button><button class="btn" data-act="depDirect" data-id="${D.id}">⚡ Qu’il le fasse directement</button></div>`; }
function depAutoHtml(D){ return `<div class="small">Chaque semaine, ${esc(D.name)} réinvestit jusqu’à ce montant si la caisse reste au-dessus de la réserve.</div>
  <label>Budget par semaine (millions $)<input id="dep-w" type="number" min="1" value="${Math.round((D.weekly||Math.max(1e6,S.cash*0.1))/1e6)}"></label>
  <label>Réserve à toujours garder (millions $)<input id="dep-r" type="number" min="0" value="${Math.round((D.reserve||Math.max(0,S.cash*0.2))/1e6)}"></label>
  <div class="btns"><button class="btn gold" data-act="depAutoOn" data-id="${D.id}">🔁 Activer</button></div>`; }

function depHook(){ if(depHook.done||typeof ACTIONS==='undefined') return; depHook.done=true;
  MODALS.deputy=()=>showModal('🤝 Mes adjoints',depHtml(),true);
  const back=()=>{ UI.modal='deputy'; refreshModal(); };
  const get=id=>depList().find(x=>x.id===id);
  const budget=()=>Math.max(0,(+($('#dep-b')||{}).value||0)*1e6);
  Object.assign(ACTIONS,{
    depOpen:()=>{ UI.dep=UI.dep||{}; openM('deputy'); },
    depHire:()=>{ const hub=$('#dep-hub').value, cc=$('#dep-cc').value, lease=$('#dep-lease').checked, modern=$('#dep-modern').checked, p=makePilot(['A320'],true);
      const D={id:uid(),name:p.name,hub,cc,lease,modern,auto:false,log:[],spent:0}; depList().push(D); book('recrutement',-DEP_SAL);
      toast(`🧑‍💼 ${D.name} est votre adjoint à ${AP(hub).city}`,'ok'); ACTIONS.depAsk({id:D.id}); },
    depAsk:d=>{ const D=get(d.id); UI.modal=null; showModal(`💰 Budget pour ${esc(D.name)}`,depAskHtml(D)); },
    depPlanGo:d=>{ const D=get(d.id), b=budget(); D.cc=$('#dep-cc2').value; D.modern=$('#dep-mod2').checked; D.reinforce=$('#dep-rf2').checked; if(b<=0) return err('Indiquez un budget');
      UI.dep=UI.dep||{}; UI.dep.prev={id:D.id,budget:b,P:depPlan(D,Math.min(b,Math.max(0,S.cash)))}; back(); },
    depDirect:d=>{ const D=get(d.id), b=budget(); D.cc=$('#dep-cc2').value; D.modern=$('#dep-mod2').checked; D.reinforce=$('#dep-rf2').checked; if(b<=0) return err('Indiquez un budget');
      const r=depRun(D,Math.min(b,Math.max(0,S.cash))); toast(r.done.length?`🤝 ${r.done.length} avion(s) placé(s) pour ${fmtMoney(r.spent)}`:'🤝 Rien de rentable trouvé avec ce budget',r.done.length?'ok':'info'); back(); renderTop(); },
    depGo:()=>{ const U=UI.dep, D=U&&U.prev&&get(U.prev.id); if(!D) return; const r=depRun(D,Math.min(U.prev.budget,Math.max(0,S.cash))); U.prev=null;
      toast(r.done.length?`🤝 ${r.done.length} avion(s) placé(s) pour ${fmtMoney(r.spent)}`:'🤝 Rien de rentable trouvé','ok'); back(); renderTop(); if(typeof renderPanel==='function') renderPanel(); },
    depCancel:()=>{ if(UI.dep) UI.dep.prev=null; back(); },
    depAuto:d=>{ const D=get(d.id); if(D.auto){ D.auto=false; back(); return; } UI.modal=null; showModal(`🔁 Mode automatique — ${esc(D.name)}`,depAutoHtml(D)); },
    depAutoOn:d=>{ const D=get(d.id); D.weekly=Math.max(1,+$('#dep-w').value||1)*1e6; D.reserve=Math.max(0,+$('#dep-r').value||0)*1e6; D.auto=true; toast(`🔁 ${D.name} réinvestira chaque semaine`,'ok'); back(); },
    depFire:d=>{ const D=get(d.id); if(!confirm(`Renvoyer ${D.name} ? Les avions et les lignes restent à vous.`)) return; S.deputies=depList().filter(x=>x!==D); back(); },
  });
  // boutons dans l'onglet Réseau
  if(typeof pNetwork==='function'){ const _pn=pNetwork; pNetwork=function(){ const h=_pn(); return h.replace('🏢 Acheter un hub</button>','🏢 Acheter un hub</button><button class="btn '+(isSimple()?'sm':'big')+'" data-act="depOpen">🤝 Mes adjoints'+(depList().length?' ('+depList().length+')':'')+'</button>'); }; }
  if(typeof simpleTop==='function'){ const _st=simpleTop; simpleTop=function(tab){ const h=_st(tab); return tab==='network'?h.replace('<div class="bigcta">','<div class="bigcta"><button class="btn" data-act="depOpen">🤝 Mes adjoints<small>Il achète les avions et ouvre les lignes pour vous</small></button>'):h; }; }
  if(typeof weeklyTick==='function'){ const _wt=weeklyTick; weeklyTick=function(){ const r=_wt.apply(this,arguments); try{ depWeekly(); }catch(e){ console.warn('depWeekly',e); } return r; }; }
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ depHook(); }catch(e){ console.warn(e); } },0));
