/* =========================================================
   Sky Empire — 🗑️ fermer un hub
   On peut se séparer d'un hub acheté : toutes les lignes qui en partent
   sont fermées, et ses avions sont soit vendus (ou rendus au loueur),
   soit déplacés vers un autre hub (ils y volent à vide). Un avion en
   vol est vendu à son atterrissage. Le hub est revendu 25 % de son prix.
   ========================================================= */
'use strict';
function hubSellAc(ac){ const m=modelOf(ac);
  if(ac.owned){ const v=acValue(ac); book('ventes',v); } else book('leasing',-(ac.lease||0));
  S.fleet=S.fleet.filter(x=>x!==ac); return m; }
function closeHub(code, mode, to){
  if(!S.hubs.includes(code)) return 'Ce n’est pas un de vos hubs';
  if(S.hubs.length<=1) return 'Vous devez garder au moins un hub';
  if(mode==='move'&&(!to||to===code||!S.hubs.includes(to))) return 'Choisissez un autre de vos hubs';
  const lines=S.routes.filter(r=>r.stops[0]===code), planes=S.fleet.filter(a=>a.hub===code);
  for(const r of lines) closeLine(r.id);
  let sold=0, later=0, moved=0, cash0=S.cash;
  for(const ac of planes){ ac.plan=[]; ac.pendingReturn=null;
    if(mode==='move'){ ac.hub=to; moved++; if(ac.status==='idle'&&ac.loc!==to) try{ ferry(ac,to); }catch(e){} }
    else if(ac.status==='flight'||ac.status==='manual'){ ac.sellOnLand=true; later++; }
    else { hubSellAc(ac); sold++; } }
  const refund=Math.round(hubCost(code)*0.25); book('ventes',refund);
  S.hubs=S.hubs.filter(h=>h!==code);
  if(S.company.hub===code){ const cc=AP(code).cc; S.company.hub=S.hubs.find(h=>AP(h).cc===cc)||S.hubs[0]; }
  invalidateScheduleCache();
  logMsg(`🗑️ Hub ${AP(code).city} fermé : ${lines.length} ligne${lines.length>1?'s':''} fermée${lines.length>1?'s':''}, ${mode==='move'?`${moved} avion${moved>1?'s':''} déplacé${moved>1?'s':''} vers ${AP(to).city}`:`${sold} avion${sold>1?'s':''} vendu${sold>1?'s':''}${later?`, ${later} en vol vendu${later>1?'s':''} à l’atterrissage`:''}`}. ${fmtMoney(S.cash-cash0)} récupérés.`,'ok');
  return null;
}
// avions vendus à l'atterrissage
function hubCloseTick(){ for(const ac of (S.fleet||[]).slice()) if(ac.sellOnLand&&ac.status!=='flight'&&ac.status!=='manual'){ const m=hubSellAc(ac); logMsg(`💵 ${ac.reg} (${m.name}) vendu à son atterrissage.`,'info'); } }
function closeHubHtml(code){
  const lines=S.routes.filter(r=>r.stops[0]===code), planes=S.fleet.filter(a=>a.hub===code), val=planes.reduce((s,a)=>s+(a.owned?acValue(a):0),0), others=S.hubs.filter(h=>h!==code);
  return `<p>Fermer le hub de <b>${esc(AP(code).city)}</b> (${code}) :</p>
    <ul class="small"><li>${lines.length} ligne${lines.length>1?'s':''} fermée${lines.length>1?'s':''} : ${lines.map(r=>esc(lineName(r))).join(', ')||'aucune'}</li>
    <li>${planes.length} avion${planes.length>1?'s':''} basé${planes.length>1?'s':''} ici (${planes.filter(a=>a.owned).length} à vous, ${planes.filter(a=>!a.owned).length} en location)</li>
    <li>Revente du hub : ${fmtMoney(Math.round(hubCost(code)*0.25))} (25 % du prix)</li></ul>
    ${others.length?`<div class="btns" style="flex-direction:column;align-items:stretch;gap:8px">
      <button class="btn bad" data-act="hubCloseGo" data-c="${code}" data-m="sell">💵 Fermer et vendre ses avions (≈ ${fmtMoney(val)}, locations rendues)</button>
      <label class="small">Ou déplacer les avions vers : <select id="hubTo">${others.map(h=>`<option value="${h}">${esc(AP(h).city)} (${h})</option>`).join('')}</select></label>
      <button class="btn gold" data-act="hubCloseGo" data-c="${code}" data-m="move">✈️ Fermer et déplacer les avions</button></div>`:'<p class="neg">C’est votre seul hub : achetez-en un autre avant de fermer celui-ci.</p>'}
    <p class="small mut">Les avions en vol terminent leur vol avant d’être vendus. Les avions déplacés volent à vide vers leur nouveau hub ; il faudra leur donner de nouvelles lignes.</p>`;
}
function hubCloseHook(){ if(hubCloseHook.done) return; hubCloseHook.done=true;
  if(typeof buyHubHtml==='function'){ const _b=buyHubHtml; buyHubHtml=function(){ const mine=S.hubs.map(h=>`<div class="row" style="justify-content:space-between;align-items:center;gap:6px;margin:4px 0"><span>${flag(h)} <b>${esc(AP(h).city)}</b> <span class="mut">${h} · ${S.fleet.filter(a=>a.hub===h).length} avions · ${S.routes.filter(r=>r.stops[0]===h).length} lignes</span></span>${S.hubs.length>1?`<button class="btn sm bad" data-act="hubClose" data-c="${h}">🗑️ Fermer</button>`:''}</div>`).join('');
    return `<h3 style="margin-top:0">Vos hubs</h3>${mine}<h3>Acheter un hub</h3>`+_b(); }; }
  if(typeof aiHourly==='function'){ const _ah=aiHourly; aiHourly=function(){ _ah(); try{ hubCloseTick(); }catch(e){ console.warn(e); } }; }
  Object.assign(ACTIONS,{ hubClose:d=>showModal('🗑️ Fermer un hub', closeHubHtml(d.c), true),
    hubCloseGo:d=>{ const to=d.m==='move'?($('#hubTo')||{}).value:null; if(!confirm(`Fermer le hub de ${AP(d.c).city} ? C’est définitif.`)) return;
      const e=closeHub(d.c,d.m,to); if(e) return toast(e,'bad'); toast(`🗑️ Hub ${AP(d.c).city} fermé`,'ok'); closeModal(); try{ drawAirports(); }catch(x){} if(typeof renderPanel==='function') renderPanel(); if(typeof renderTop==='function') renderTop(); } });
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ hubCloseHook(); }catch(e){ console.warn(e); } },0));
