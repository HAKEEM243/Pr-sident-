/* =========================================================
   Sky Empire — 👨‍✈️ les équipages sont des personnes
   Chaque pilote a un grade, des heures de vol qui montent avec
   les vols de sa famille d'avions, et son propre moral.
   Chaque semaine : promotions possibles, pilotes débauchés par
   les concurrents (vous pouvez les retenir), préavis de grève
   du syndicat, actes héroïques. Messages dans 📬.
   ========================================================= */
'use strict';
const CREW_RANKS=[['Copilote','🧑‍✈️'],['Commandant','👨‍✈️'],['Instructeur','🎓'],['Chef pilote','⭐']];
const CREW_PROMO=[3000,8000];          // heures nécessaires pour devenir commandant, puis instructeur
const CREW_RAISE=[1.25,1.12,1.30];     // hausse de salaire à chaque promotion
function crewInit(p){ if(p.rank===undefined){ p.rank=p.hours>=9000?2:p.hours>=4000?1:0; } if(p.mo===undefined) p.mo=Math.round((S.staff&&S.staff.morale.pil)||70); if(p.since===undefined) p.since=S.time-Math.round(rnd(0,6)*365)*DAY; if(p.wait===undefined) p.wait=0; return p; }
const crewEligible=p=>!p.training&&p.rank<2&&p.hours>=CREW_PROMO[p.rank];
const crewRisk=p=>!p.training&&p.hours>=2500&&p.mo<45;
const crewYears=p=>Math.max(0,Math.floor((S.time-p.since)/(365*DAY)));
function crewChief(){ return (S.pilots||[]).find(p=>p.rank===3); }

/* ---------- chaque semaine ---------- */
function crewWeekly(){
  if(!S||!S.pilots||!S.pilots.length) return;
  for(const p of S.pilots) crewInit(p);
  // 1) heures de vol : les heures faites par chaque famille d'avions sont partagées entre ses pilotes (2 par vol)
  S.crewHw=S.crewHw||{}; const famH={};
  for(const ac of S.fleet){ const prev=S.crewHw[ac.id]; S.crewHw[ac.id]=ac.hours; if(prev===undefined) continue; const d=Math.max(0,ac.hours-prev); if(d>0){ const f=modelOf(ac).fam; famH[f]=(famH[f]||0)+d*2; } }
  for(const id of Object.keys(S.crewHw)) if(!S.fleet.some(a=>a.id===id)) delete S.crewHw[id];
  for(const [f,h] of Object.entries(famH)){ const L=S.pilots.filter(p=>!p.training&&p.quals.includes(f)); if(!L.length) continue; const each=h/L.length; for(const p of L) p.hours=Math.round(p.hours+each*rnd(0.7,1.3)); }
  // 2) moral de chacun : suit le moral général des pilotes, puni si une promotion méritée tarde
  const base=S.staff.morale.pil;
  for(const p of S.pilots){ if(crewEligible(p)) p.wait++; else p.wait=0;
    const target=clamp(base-(p.wait>2?Math.min(25,(p.wait-2)*4):0)+(p.rank===3?10:0),0,100);
    p.mo=Math.round(clamp(p.mo+(target-p.mo)*0.3+rnd(-3,3),0,100)); }
  // 3) mode simple : les promotions méritées se font toutes seules après 2 semaines
  if(typeof isSimple==='function'&&isSimple()){ let n=0; for(const p of S.pilots) if(crewEligible(p)&&p.wait>=2){ crewPromote(p,true); n++; } if(n) logMsg(`🎖️ ${n} pilote(s) promu(s) automatiquement.`,'ok'); }
  // 4) départs : les concurrents débauchent les pilotes expérimentés et mécontents
  crewPoach();
  // 5) préavis de grève du syndicat quand le moral général est bas
  crewUnion();
  // 6) acte héroïque
  if(S.stats.flights>50&&Math.random()<0.05){ const L=S.pilots.filter(p=>p.rank>=1&&!p.training); if(L.length){ const p=pick(L);
    p.mo=clamp(p.mo+15,0,100); p.hero=(p.hero||0)+1; S.reputation=clamp(S.reputation+1,0,100);
    const why=pick(['a posé son avion en douceur malgré un orage violent','a géré calmement une panne de moteur et ramené tout le monde sain et sauf','a dérouté son vol pour un passager malade, sauvé à temps','a évité une collision sur la piste grâce à sa vigilance']);
    logMsg(`🦸 ${CREW_RANKS[p.rank][0]} ${p.name} ${why}. Image +1.`,'ok'); if(typeof toast==='function') toast(`🦸 ${esc(p.name)} ${why} !`,'ok'); } }
  // 7) messages restés sans réponse : le pilote part
  for(const m of S.inbox||[]) if(m.kind==='crewPoach'&&m.st==='exp'&&!m.done){ m.done=1; const p=S.pilots.find(x=>x.id===m.pid); if(p) crewLeave(p,m.rival); }
}
function crewPromote(p,silent){
  if(p.rank>=2) return;
  const r=p.rank; p.rank=Math.min(2,r+1); p.salary=Math.round(p.salary*CREW_RAISE[r]/100)*100; p.mo=clamp(p.mo+20,0,100); p.wait=0;
  if(!silent) logMsg(`🎖️ ${p.name} devient ${CREW_RANKS[p.rank][0].toLowerCase()} (salaire ${fmtMoney(p.salary)}/mois).`,'ok');
}
function crewRivalFor(){ const L=(typeof aiAlive==='function'?aiAlive():[]).filter(e=>e.status!=='dead'&&!(typeof aiPeace==='function'&&aiPeace(e.code))); if(!L.length) return null; const cont=COUNTRIES[homeCC()][1];
  const near=L.filter(e=>COUNTRIES[e.cc]&&COUNTRIES[e.cc][1]===cont); return pick(near.length?near:L); }
function crewLeave(p,rivalName){ S.pilots=S.pilots.filter(x=>x!==p); S.staff.morale.pil=clamp(S.staff.morale.pil-1,0,100);
  logMsg(`🚪 ${CREW_RANKS[p.rank][0]} ${p.name} (${num(p.hours)} h) quitte la compagnie pour ${rivalName||'un concurrent'}.`,'warn'); }
function crewPoach(){
  const drive=S.rivalDrive===undefined?3:S.rivalDrive; if(drive===0) return;
  const pending=(S.inbox||[]).some(m=>m.kind==='crewPoach'&&m.st==='new');
  const L=S.pilots.filter(crewRisk).sort((a,b)=>b.hours-a.hours); let gone=0, asked=pending;
  for(const p of L){ if(gone>=3) break; if(Math.random()>0.05*(45-p.mo)/45*(0.5+drive/3)) continue; const e=crewRivalFor(); if(!e) break;
    if(!asked&&typeof mailPush==='function'){ asked=true; const raise=Math.round(p.salary*0.2/100)*100;
      mailPush({code:'CREW',name:'Ressources humaines',ceo:'Votre DRH',color:'#0ea5e9'},'crewPoach',`${p.name} veut partir chez ${e.name}`,
        `${CREW_RANKS[p.rank][1]} <b>${esc(CREW_RANKS[p.rank][0])} ${esc(p.name)}</b> (${num(p.hours)} h de vol, ${crewYears(p)} an(s) chez vous, moral ${p.mo} %) a reçu une offre de <b>${esc(e.name)}</b>. Il partira dans 5 jours si vous ne faites rien.`,
        [{k:'keep',l:`💰 Augmenter de ${fmtMoney(raise)}/mois pour le garder`},{k:'go',l:'Le laisser partir'}],{pid:p.id,rival:e.name,raise});
    } else { crewLeave(p,e.name); gone++; } }
}
function crewUnion(){
  const st=S.staff; if(st.morale.pil>=35||(st.strikeUntil||0)>S.time||(S.inbox||[]).some(m=>m.kind==='crewStrike'&&m.st==='new')||typeof mailPush!=='function') return;
  if(S.crewUnionT&&S.time-S.crewUnionT<21*DAY) return; S.crewUnionT=S.time;
  const lead=S.pilots.filter(p=>p.rank>=1).sort((a,b)=>b.hours-a.hours)[0], who=lead?`le ${CREW_RANKS[lead.rank][0].toLowerCase()} ${lead.name}`:'un délégué';
  const bonus=Math.round(S.pilots.reduce((s,p)=>s+p.salary,0)*0.5/1e4)*1e4;
  mailPush({code:'UNION',name:'Syndicat des pilotes',ceo:'Le syndicat',color:'#ef4444'},'crewStrike','✊ Préavis de grève des pilotes',
    `Le syndicat, mené par ${esc(who)}, annonce une grève : le moral des pilotes est à <b>${Math.round(st.morale.pil)} %</b>. Pendant une grève, aucun avion ne décolle de vos hubs.`,
    [{k:'raise',l:'📈 Augmenter les salaires des pilotes de 10 %'},{k:'bonus',l:`💵 Verser une prime unique de ${fmtMoney(bonus)}`},{k:'no',l:'Refuser'}],{bonus});
}
function crewAnswer(m,k){
  if(m.kind==='crewPoach'){ m.done=1; const p=S.pilots.find(x=>x.id===m.pid); if(!p) return 'Le pilote est déjà parti.';
    if(k==='keep'){ p.salary+=m.raise; p.mo=clamp(p.mo+30,0,100); return `🤝 ${p.name} reste chez vous (+${fmtMoney(m.raise)}/mois).`; }
    crewLeave(p,m.rival); return `${p.name} rejoint ${m.rival}.`; }
  if(m.kind==='crewStrike'){ const st=S.staff;
    if(k==='raise'){ st.sal.pil=Math.min(160,st.sal.pil+10); st.morale.pil=clamp(st.morale.pil+15,0,100); for(const p of S.pilots) p.mo=clamp((p.mo||50)+15,0,100); return '📈 Salaires des pilotes +10 % : le syndicat lève son préavis.'; }
    if(k==='bonus'){ if(S.cash<m.bonus){ toast('Trésorerie insuffisante','bad'); return ''; } book('salaires',-m.bonus); st.morale.pil=clamp(st.morale.pil+10,0,100); for(const p of S.pilots) p.mo=clamp((p.mo||50)+10,0,100); return `💵 Prime de ${fmtMoney(m.bonus)} versée : la grève est évitée.`; }
    st.morale.pil=clamp(st.morale.pil-5,0,100); if(Math.random()<0.5){ st.strikeUntil=S.time+rndi(2,5)*DAY; logMsg(`✊ Les pilotes sont en grève jusqu’au ${fmtDate(st.strikeUntil)} : aucun départ depuis vos hubs.`,'bad'); return '✊ Le syndicat lance la grève.'; }
    return 'Le syndicat recule… pour cette fois.'; }
  return '';
}

/* ---------- affichage ---------- */
function crewCard(p){
  const R=CREW_RANKS[p.rank], next=p.rank<2?CREW_PROMO[p.rank]:null, el=crewEligible(p), risk=crewRisk(p);
  return `<div class="card pilot"><div class="grow"><b>${R[1]} ${esc(p.name)}</b> ${COUNTRIES[p.nat]?COUNTRIES[p.nat][2]:'🌍'} <span class="badge ${p.rank>=2?'ok':''}">${R[0]}</span>${p.hero?` <span class="badge ok">🦸 ${p.hero}</span>`:''}${risk?' <span class="badge bad">risque de départ</span>':''}${el?' <span class="badge ok">à promouvoir</span>':''}<br>
    <span class="small mut">${num(p.hours)} h de vol${next?` (${CREW_RANKS[p.rank+1][0].toLowerCase()} à ${num(next)} h)`:''} · ${crewYears(p)} an(s) chez vous · ${fmtMoney(p.salary)}/mois</span>
    <div class="cond small">Moral ${bar(p.mo/100,p.mo<30?'bad':p.mo<50?'warn':'')} <b>${p.mo} %</b></div>
    ${p.quals.map(q=>`<span class="chip">${q}</span>`).join('')}
    ${p.training?`<div class="small">⏳ Formation ${p.training.fam} — fin le ${fmtDate(p.training.until)}</div>`:''}</div>
    <div class="btns sm col">${el?`<button class="btn sm gold" data-act="crewPromo" data-id="${p.id}">🎖️ Promouvoir</button>`:''}${p.rank>=1&&p.rank<3&&!crewChief()?`<button class="btn sm" data-act="crewChief" data-id="${p.id}">⭐ Chef pilote</button>`:''}<button class="btn sm" data-act="train" data-id="${p.id}" ${p.training?'disabled':''}>🎓 Former</button><button class="btn sm danger" data-act="fire" data-id="${p.id}">Licencier</button></div></div>`;
}
function crewHtml(){
  for(const p of S.pilots) crewInit(p);
  const F=UI.crF||'all', L=S.pilots, el=L.filter(crewEligible), risk=L.filter(crewRisk), tr=L.filter(p=>p.training), chief=crewChief();
  const cnt=[0,0,0,0]; for(const p of L) cnt[p.rank]++;
  const list=(F==='promo'?el:F==='risk'?risk:F==='train'?tr:L.slice()).sort((a,b)=>F==='risk'?a.mo-b.mo:b.rank-a.rank||b.hours-a.hours);
  const avg=L.length?Math.round(L.reduce((s,p)=>s+p.mo,0)/L.length):0;
  return `<h3>👨‍✈️ Vos pilotes (${num(L.length)})</h3>
  <div class="simplehelp">💡 Chaque pilote gagne des heures de vol en volant. Avec assez d’heures, il mérite une <b>promotion</b> (copilote → commandant à ${num(CREW_PROMO[0])} h → instructeur à ${num(CREW_PROMO[1])} h). Une promotion qui tarde fait baisser son moral. Un pilote expérimenté et mécontent peut être <b>débauché</b> par un concurrent : vous recevez un message 📬 pour tenter de le garder. Si le moral général chute, le <b>syndicat</b> menace de faire grève.</div>
  <div class="kpis"><div class="kpi"><div class="kl">Moral moyen</div><div class="kv ${avg<40?'neg':avg>65?'pos':''}">${avg} %</div></div><div class="kpi"><div class="kl">Grades</div><div class="kv small">${cnt[0]} cop. · ${cnt[1]} cdt · ${cnt[2]} instr.</div></div><div class="kpi"><div class="kl">Chef pilote</div><div class="kv small">${chief?esc(chief.name):'— à nommer'}</div></div><div class="kpi"><div class="kl">À promouvoir</div><div class="kv ${el.length?'neg':''}">${el.length}</div></div><div class="kpi"><div class="kl">Risque de départ</div><div class="kv ${risk.length?'neg':''}">${risk.length}</div></div></div>
  ${el.length?`<div class="btns"><button class="btn gold" data-act="crewPromoAll">🎖️ Promouvoir les ${el.length} pilotes méritants</button></div>`:''}
  ${!chief&&L.some(p=>p.rank>=1)?'<div class="al">⭐ Nommez un <b>chef pilote</b> parmi vos commandants ou instructeurs : moral de tous les pilotes +5.</div>':''}
  <div class="chips">${[['all','Tous'],['promo',`À promouvoir (${el.length})`],['risk',`Risque de départ (${risk.length})`],['train',`En formation (${tr.length})`]].map(([k,l])=>`<button class="chip ${F===k?'on':''}" data-act="crF" data-k="${k}">${l}</button>`).join('')}</div>
  ${list.slice(0,40).map(crewCard).join('')||'<div class="mut small">Personne dans cette liste.</div>'}
  ${list.length>40?`<div class="small mut">… et ${num(list.length-40)} autres.</div>`:''}`;
}

function registerCrewActions(){
  Object.assign(ACTIONS,{
    crF:d=>{ UI.crF=d.k; renderPanel(); },
    crewPromo:d=>{ const p=S.pilots.find(x=>x.id===d.id); if(p&&crewEligible(p)){ crewPromote(p); toast(`🎖️ ${esc(p.name)} est promu ${CREW_RANKS[p.rank][0].toLowerCase()}`,'ok'); renderPanel(); } },
    crewPromoAll:()=>{ const L=S.pilots.filter(crewEligible); for(const p of L) crewPromote(p,true); logMsg(`🎖️ ${L.length} pilotes promus.`,'ok'); toast(`🎖️ ${L.length} pilotes promus : leur moral remonte`,'ok'); renderPanel(); },
    crewChief:d=>{ if(crewChief()) return; const p=S.pilots.find(x=>x.id===d.id); if(!p) return; p.rank=3; p.salary=Math.round(p.salary*CREW_RAISE[2]/100)*100; p.mo=100;
      S.staff.morale.pil=clamp(S.staff.morale.pil+5,0,100); for(const q of S.pilots) q.mo=clamp((q.mo||50)+5,0,100);
      logMsg(`⭐ ${p.name} est nommé chef pilote de ${S.company.name}.`,'ok'); toast(`⭐ ${esc(p.name)} devient chef pilote : moral des pilotes +5`,'ok'); renderPanel(); },
  });
}
// branchements : semaine du jeu, réponses aux messages
{ const _w=weeklyTick; weeklyTick=function(){ const r=_w.apply(this,arguments); try{ crewWeekly(); }catch(e){ console.warn('crew',e); } return r; }; }
{ const _a=mailAnswer; mailAnswer=function(id,k){ const m=(S.inbox||[]).find(x=>x.id===id); if(m&&m.st==='new'&&m.kind&&m.kind.startsWith('crew')){ const res=crewAnswer(m,k); if(res===''&&m.kind==='crewStrike'&&k==='bonus') return; m.st='done'; m.res=res||'Traité.'; if(res) logMsg(res,'ok'); renderMailBadge(); if(UI.modal==='inbox') openM('inbox'); if(typeof renderTop==='function') renderTop(); return; } return _a(id,k); }; }
// nouveaux pilotes : arrivés aujourd'hui, grade selon l'expérience
{ const _m=makePilot; makePilot=function(){ const p=_m.apply(this,arguments); p.since=S?S.time:0; p.rank=p.hours>=4000?1:0; p.mo=Math.round((S&&S.staff&&S.staff.morale.pil)||70); p.wait=0; return p; }; }
