/* =========================================================
   Sky Empire — 🛂 le poste frontière relié au reste du jeu
   Ce que vous décidez au poste frontière se voit dans le jeu :
   • un passager refoulé repart vraiment sur VOTRE prochain vol retour
     (même ligne, sens inverse) : il apparaît dans le manifeste de ce vol,
     siège au fond « sous escorte », avec sa fiche et le motif du refus ;
     en 3D, un policier l'accompagne au pied de l'avion à l'embarquement ;
   • l'Aérogare en direct reprend vos décisions (refus, saisies, médical)
     au lieu des chiffres estimés ; pas de double amende ;
   • la fiche passager et le manifeste montrent le résultat du contrôle ;
   • un registre des vols contrôlés (onglet Passagers) : passagers, refus,
     saisies, ce que ça a coûté à la compagnie.
   ========================================================= */
'use strict';
function bcDeport(f,c){
  S.bcDeport=S.bcDeport||[]; const id=f.key+'|'+c.i; if(S.bcDeport.some(d=>d.id===id)) return;
  let row; try{ row=JSON.parse(JSON.stringify(c.x)); }catch(e){ row={first:c.x.first,last:c.x.last,nat:c.x.nat,age:c.x.age,F:c.x.F}; }
  S.bcDeport.push({id,row,face:c.face,why:c.imm?BC_WHY[c.imm]:'refus contesté (documents en règle)',from:f.B.code,to:f.A.code,t:S.time,fno:f.fno,legKey:null,done:false});
  const open=S.bcDeport.filter(d=>!d.done), done=S.bcDeport.filter(d=>d.done).slice(-10); S.bcDeport=done.concat(open.slice(-25));
}
// rattache les refoulés au premier vol de la compagnie qui fait le trajet retour après le refus
function bcDeportFor(ac,leg){
  const L=S.bcDeport; if(!L||!L.length||!leg||!ac) return []; const key=pfK(ac,leg), out=[];
  for(const d of L){ if(d.done) continue; if(d.legKey){ if(d.legKey===key) out.push(d); continue; }
    if(leg.from===d.from&&leg.to===d.to&&leg.dep>=d.t){ d.legKey=key; d.acId=ac.id; d.fno2=`${S.company.code}${flightNumber(ac)}`; out.push(d); } }
  return out;
}
const bcStatusTxt=(v,cu,med)=>v==='ref'?'⛔ entrée refusée — refoulé(e)':cu==='seize'?'🚫 admis(e), marchandises saisies en douane':v==='ok'&&cu?'✅ admis(e) · sorti(e) de l’aéroport':v==='ok'?'🛃 admis(e) · en douane':med?'🏥 au service médical':'⏳ pas encore contrôlé(e)';
function blHook(){ if(blHook.done) return; blHook.done=true;
  // 1. manifeste : les refoulés à bord du vol retour
  if(typeof flightManifest==='function'){ const _fm=flightManifest; flightManifest=function(ac,maxN){ const m=_fm.apply(this,arguments);
      try{ if(m&&m.rows&&ac&&ac.flight){ const leg=ac.flight.legs[ac.flight.li];
          for(const d of bcDeportFor(ac,leg)) m.rows.push({...d.row, i:m.rows.length, seat:'fond · sous escorte', deport:d, avatar:d.face||d.row.avatar,
            story:`Refoulé${d.row.F?'e':''} à l’arrivée à ${AP(d.from).city} (${d.why}) sur le vol ${d.fno}, renvoyé${d.row.F?'e':''} par votre compagnie, accompagné${d.row.F?'e':''} d’un agent de police.`,
            bags:0, bag:0, bagList:[], price:0, control:'👮 Passager refoulé sous escorte', declare:'—', visa:'—' }); } }catch(e){}
      return m; }; }
  // 2. aérogare : vos décisions remplacent les estimations
  if(typeof pfData==='function'){ const _pd=pfData; pfData=function(ac,leg){ const D=_pd.apply(this,arguments);
      try{ const s=S.bc&&S.bc[D.key], f=BC.cache[D.key];
        if(s&&Object.keys(s.imm).length){ const ref=Object.entries(s.imm).filter(([,v])=>v==='ref');
          D.imm.refused=ref.length; D.imm.why=ref.map(([i])=>{ const c=f&&bcCase(f,+i); return c&&c.imm?BC_WHY[c.imm]:'refus de votre agent'; }); D.imm.byYou=true;
          const sz=Object.entries(s.cus).filter(([,v])=>v==='seize'); D.cus.nSz=sz.length; D.cus.sz={}; for(const [i] of sz){ const c=f&&bcCase(f,+i), k=c&&c.cus?(c.cus.kind==='cash'?'💵 Devises non déclarées':c.cus.item):'🚫 Saisie sans motif'; D.cus.sz[k]=(D.cus.sz[k]||0)+1; }
          D.byYou={done:Object.keys(s.imm).length, ok:Object.values(s.imm).filter(v=>v==='ok').length, ref:ref.length, sz:sz.length, med:Object.keys(s.med).length}; }
        D.deport=bcDeportFor(ac,leg); }catch(e){}
      return D; }; }
  if(typeof pfAuto==='function'){ const _pa=pfAuto; pfAuto=function(D){ try{ const s=S.bc&&S.bc[D.key]; if(s&&Object.keys(s.imm).length) D={...D,lite:{fee:(D.lite?D.lite.fee:D.ci.fee),refused:0}}; }catch(e){} return _pa.call(this,D); }; }   // vos refus sont déjà comptés : pas de double amende
  if(typeof pfHtml==='function'){ const _ph=pfHtml; pfHtml=function(D,side){ let h=_ph.apply(this,arguments);
      try{ let add='';
        if(side==='arr'&&D.byYou) add+=`<div class="card" style="margin:6px 0;border-left:5px solid #38bdf8">🛂 <b>Contrôlé à votre poste frontière</b> : ${D.byYou.done} passagers vus · ✅ ${D.byYou.ok} admis · ⛔ ${D.byYou.ref} refoulés · 🚫 ${D.byYou.sz} saisies · 🏥 ${D.byYou.med} au médical</div>`;
        if(D.deport&&D.deport.length) add+=`<div class="card" style="margin:6px 0;border-left:5px solid #1e3a8a">👮 <b>${D.deport.length} passager${D.deport.length>1?'s':''} refoulé${D.deport.length>1?'s':''} à bord, sous escorte</b><div class="small">${D.deport.map(d=>`${d.face||'🧑'} ${esc(d.row.first)} ${esc(d.row.last)} — ${esc(d.why)} (refoulé${d.row.F?'e':''} à ${esc(AP(d.from).city)}, vol ${esc(d.fno)})`).join('<br>')}</div></div>`;
        if(add){ const k=h.indexOf('</div>'); h=k>0?h.slice(0,k+6)+add+h.slice(k+6):add+h; } }catch(e){}
      return h; }; }
  // 3. fiche passager et manifeste
  if(typeof passengerCardHtml==='function'){ const _pc=passengerCardHtml; passengerCardHtml=function(ac,i){ let h=_pc.apply(this,arguments);
      try{ const leg=ac.flight&&ac.flight.legs[ac.flight.li], key=leg&&pfK(ac,leg), m=flightManifest(ac), r=m&&m.rows&&m.rows[i]; let add='';
        if(r&&r.deport) add+=`<div class="card" style="border-left:5px solid #1e3a8a;margin-bottom:8px">👮 <b>Passager refoulé sous escorte</b><br><span class="small">${esc(r.story)}</span></div>`;
        const s=key&&S.bc&&S.bc[key]; if(s&&(s.imm[i]||s.med[i])) add+=`<div class="card" style="border-left:5px solid #38bdf8;margin-bottom:8px">🛂 <b>Votre poste frontière à ${esc(AP(leg.to).city)}</b> : ${bcStatusTxt(s.imm[i],s.cus[i],s.med[i])}</div>`;
        if(add) h=add+h; }catch(e){}
      return h; }; }
  if(typeof manifestHtml==='function'){ const _mh=manifestHtml; manifestHtml=function(ac){ let h=_mh.apply(this,arguments);
      try{ const leg=ac.flight&&ac.flight.legs[ac.flight.li], key=leg&&pfK(ac,leg), s=key&&S.bc&&S.bc[key], dep=bcDeportFor(ac,leg); let add='';
        if(s&&Object.keys(s.imm).length){ const v=Object.values(s.imm); add+=`<div class="card" style="border-left:5px solid #38bdf8">🛂 Contrôle frontière à ${esc(AP(leg.to).city)} : ${v.length} contrôlés · ✅ ${v.filter(x=>x==='ok').length} admis · ⛔ ${v.filter(x=>x==='ref').length} refoulés · 🚫 ${Object.values(s.cus).filter(x=>x==='seize').length} saisies</div>`; }
        if(dep.length) add+=`<div class="card" style="border-left:5px solid #1e3a8a">👮 ${dep.length} passager${dep.length>1?'s':''} refoulé${dep.length>1?'s':''} voyage${dep.length>1?'nt':''} sur ce vol sous escorte (en fin de liste).</div>`;
        if(add) h=add+h; }catch(e){}
      return h; }; }
  // 4. registre des vols contrôlés (onglet Passagers)
  if(typeof pfCardHtml==='function'){ const _c=pfCardHtml; pfCardHtml=function(){ const h=_c.apply(this,arguments);
      try{ const L=Object.entries(S.bc||{}).filter(([,s])=>s.fno&&Object.keys(s.imm).length).sort((a,b)=>b[1].t-a[1].t).slice(0,8), dp=(S.bcDeport||[]);
        if(!L.length&&!dp.length) return h;
        return h+`<div class="card"><b>📒 Registre du poste frontière</b>${L.map(([k,s])=>{ const v=Object.values(s.imm); return `<div class="row" style="gap:6px;margin:4px 0"><span class="grow"><b>${esc(s.fno)}</b> ${esc(AP(s.from)?AP(s.from).city:s.from)} → ${esc(AP(s.to)?AP(s.to).city:s.to)}<br><small class="mut">${v.length} contrôlés · ✅ ${v.filter(x=>x==='ok').length} · ⛔ ${v.filter(x=>x==='ref').length} · 🚫 ${Object.values(s.cus).filter(x=>x==='seize').length} · coût ${fmtMoney(s.cost||0)}</small></span>${BC.cache[k]?`<button class="btn sm" data-act="bcOpenKey" data-k="${esc(k)}">Revoir</button>`:''}</div>`; }).join('')}
          ${dp.length?`<div class="small" style="margin-top:6px"><b>👮 Passagers refoulés</b><br>${dp.slice(-8).reverse().map(d=>`${d.face||'🧑'} ${esc(d.row.first)} ${esc(d.row.last)} — ${esc(d.why)} · ${d.done?`✈️ renvoyé${d.row.F?'e':''} par ${esc(d.fno2||'une autre compagnie')}`:d.legKey?`🎫 réservé${d.row.F?'e':''} sur ${esc(d.fno2)}`:`⏳ attend votre prochain vol ${esc(d.from)} → ${esc(d.to)}`}`).join('<br>')}</div>`:''}</div>`; }catch(e){ return h; } }; }
  // 5. fin du vol retour : les refoulés sont rentrés ; sans vol retour pendant 5 jours, une autre compagnie les ramène (à vos frais)
  if(typeof onFlightDone==='function'){ const _o=onFlightDone; onFlightDone=function(ac,leg){ try{ for(const d of bcDeportFor(ac,leg)){ d.done=true; d.doneT=S.time; } }catch(e){} return _o.apply(this,arguments); }; }
  setInterval(()=>{ try{ if(!S||!S.bcDeport) return; for(const d of S.bcDeport) if(!d.done&&!d.legKey&&S.time-d.t>5*DAY){ d.done=true; d.fno2='une autre compagnie'; book('incidents',-650); logMsg(`👮 ${d.row.first} ${d.row.last} renvoyé${d.row.F?'e':''} de ${AP(d.from).city} par une autre compagnie (pas de vol retour chez vous) : 650 $.`,'info'); } }catch(e){} },5000);
  // 6. en 3D : à l'embarquement du vol retour, un policier accompagne le passager refoulé au pied de l'avion
  if(typeof fxTick==='function'){ const _t=fxTick; fxTick=function(ac,p){ const r=_t.apply(this,arguments);
      try{ const st=p.st; if(st.phase===0&&typeof pplEnt==='function'&&typeof M_CREW==='function'&&typeof M_PAX==='function'&&G.cam&&G.cam.mode!=='cabin'&&G.cam.mode!=='cockpit'){ const dep=bcDeportFor(ac,st.leg);
          if(dep.length){ const R=p.mi.R, L=p.mi.L, gy=-(R+(p.mi.gH||2)+0.4)+0.03, sway=Math.sin(performance.now()/1500)*0.6;
            pplPut(pplEnt('esc-pol',apModel('crew-police',M_CREW('#1e3a8a','#5b3a24','#0f172a',''))),fxLocal(p,-(R+6)+sway,gy,L*0.42),st.hdg+90);
            pplPut(pplEnt('esc-pax',apModel('pax#f8fafc#7a4a2a',M_PAX('#f8fafc','#7a4a2a'))),fxLocal(p,-(R+6.9)+sway,gy,L*0.42),st.hdg+90); } } }catch(e){}
      return r; }; }
  Object.assign(ACTIONS,{ bcOpenKey:d=>{ if(!BC.cache[d.k]) return toast('Ce vol n’est plus en mémoire.','info'); BC.view={key:d.k,i:null}; BC.flt='all'; BC.q=''; BC.lim=40; BC.msg=''; closeModal(); bcRender(true); } });
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ blHook(); }catch(e){ console.warn(e); } },0));
