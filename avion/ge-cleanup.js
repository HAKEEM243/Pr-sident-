/* =========================================================
   Sky Empire — 🧹 fin d'un grand événement : on range tout
   • Une ligne ouverte vers la ville d'un grand événement (annonce ou
     pendant l'événement) est une « ligne d'événement ».
   • Un avion acheté ou loué pendant l'événement et programmé sur ces
     lignes est un « avion d'événement ».
   • À la fin de l'événement : ces lignes sont fermées et ces avions
     vendus (ou rendus au loueur) ; un avion en vol est vendu à son
     atterrissage. Les avions qui volent aussi sur d'autres lignes sont
     gardés. Une case permet de tout garder.
   • Anciens événements (avant cette version) : dans 🏟️, liste à cocher
     des lignes vers les villes des événements passés.
   ========================================================= */
'use strict';
const gcSell=ac=>{ ac.plan=[]; ac.pendingReturn=null; if(ac.status==='flight'||ac.status==='manual'){ ac.sellOnLand=true; return 0; } const v=ac.owned?acValue(ac):0; hubSellAc(ac); return v||1e-9; };
// ferme les lignes et vend les avions qui ne servaient qu'à elles
function gcClose(lines,markId){
  const ids=new Set(lines.map(r=>r.id));
  const planes=S.fleet.filter(a=>(markId&&a.ge===markId)||((a.plan||[]).length&&(a.plan||[]).every(p=>ids.has(p.routeId))));
  const only=planes.filter(a=>(a.plan||[]).every(p=>ids.has(p.routeId)));
  for(const r of lines) closeLine(r.id);
  let sold=0, later=0, cash=0; for(const a of only){ const v=gcSell(a); if(v){ sold++; cash+=v; } else later++; }
  for(const a of planes) if(!only.includes(a)) delete a.ge;
  invalidateScheduleCache(); if(typeof drawRoutes==='function') try{ drawRoutes(); }catch(e){}
  return {lines:lines.length,sold,later,cash};
}
function gcAfter(e){
  const g=geS(); if(g.hist&&g.hist[0]&&!g.hist[0].code) g.hist[0].code=e.city;
  if(g.keep) return;
  const lines=S.routes.filter(r=>r.ge&&r.ge.id===e.id); const marked=S.fleet.some(a=>a.ge===e.id); if(!lines.length&&!marked) return;
  const r=gcClose(lines,e.id);
  const txt=`🧹 Fin de ${e.n} à ${keyCity(e.city)} : ${r.lines} ligne${r.lines>1?'s':''} fermée${r.lines>1?'s':''}, ${r.sold} avion${r.sold>1?'s':''} vendu${r.sold>1?'s':''}${r.cash>1?` (+${fmtMoney(r.cash)})`:''}${r.later?`, ${r.later} vendu${r.later>1?'s':''} à l’atterrissage`:''}.`;
  logMsg(txt,'info'); if(typeof toast==='function'&&!UI.silent) toast(txt,'ok');
}
// lignes vers les villes des événements déjà terminés (pour les parties d'avant cette version)
function gcOld(){
  const g=geS(), cur=g.cur&&!g.cur.done?g.cur.city:null, codes=new Set((g.hist||[]).map(h=>h.code).filter(Boolean)), names=new Set([...(g.hist||[]).map(h=>h.city),...(g.trophies||[]).map(t=>t.city)]);
  return S.routes.filter(r=>{ const d=r.stops[r.stops.length-1]; if(d===cur||(r.ge&&g.cur&&r.ge.id===g.cur.id)) return false; return codes.has(d)||names.has(keyCity(d)); });
}
function gcOldHtml(){
  const L=gcOld(); if(!L.length) return '';
  const used=r=>S.fleet.filter(a=>(a.plan||[]).some(p=>p.routeId===r.id));
  return `<h3>🧹 Lignes des anciens événements</h3><div class="small mut">Lignes vers les villes d’événements déjà terminés. Cochez celles à fermer : leurs avions qui ne volent que sur ces lignes seront vendus (en vol : à l’atterrissage).</div>
  ${L.map(r=>{ const u=used(r); return `<label style="display:flex;gap:9px;align-items:flex-start;padding:6px 0;border-bottom:1px solid #ffffff14"><input type="checkbox" class="gc-pick" data-id="${r.id}" checked style="width:22px;height:22px;flex:none"><span class="small"><b>${esc(r.stops.map(c=>keyCity(c)).join(' → '))}</b><br><span class="mut">${u.length} avion${u.length>1?'s':''} : ${u.slice(0,6).map(a=>esc(a.reg)).join(', ')}${u.length>6?'…':''}</span></span></label>`; }).join('')}
  <div class="btns"><button class="btn gold" data-act="gcOldGo">🧹 Fermer les lignes cochées et vendre leurs avions</button></div>`;
}
function gcHook(){ if(gcHook.done||typeof geEnd!=='function'||typeof openLine!=='function') return; gcHook.done=true;
  const _ol=openLine; openLine=function(stops){ const r=_ol.apply(this,arguments); try{ const e=S.ge&&S.ge.cur; if(r&&typeof r==='object'&&e&&!e.done&&r.stops.slice(1).includes(e.city)) r.ge={id:e.id,city:e.city}; }catch(x){} return r; };
  const _sp=setPlan; setPlan=function(ac,routeId,weekly){ const err=_sp.apply(this,arguments); try{ const e=S.ge&&S.ge.cur, r=S.routes.find(x=>x.id===routeId);
      if(!err&&weekly>0&&r&&r.ge&&e&&e.id===r.ge.id&&(ac.bought||0)>=e.start-GE_ANN-HOUR) ac.ge=e.id; }catch(x){} return err; };
  const _ge=geEnd; geEnd=function(e){ const r=_ge.apply(this,arguments); try{ gcAfter(e); }catch(x){ console.warn('gcAfter',x); } return r; };
  const _gh=geHtml; geHtml=function(){ const h=_gh.apply(this,arguments), g=geS();
    const opt=`<label class="small" style="display:block;margin:8px 0"><input type="checkbox" ${g.keep?'checked':''} onchange="geS().keep=this.checked"> Garder les lignes et les avions après la fin d’un événement <span class="mut">(sinon : lignes fermées et avions achetés pour l’événement vendus automatiquement)</span></label>`;
    let cur=''; const e=g.cur; if(e&&!e.done){ const L=S.routes.filter(r=>r.ge&&r.ge.id===e.id), P=S.fleet.filter(a=>a.ge===e.id); if(L.length||P.length) cur=`<div class="small">🧹 À la fin : ${L.length} ligne${L.length>1?'s':''} fermée${L.length>1?'s':''} et ${P.length} avion${P.length>1?'s':''} vendu${P.length>1?'s':''}${g.keep?' <b>(désactivé : vous gardez tout)</b>':''}.</div>`; }
    return h+cur+opt+gcOldHtml(); };
  Object.assign(ACTIONS,{ gcOldGo:()=>{ const ids=[...document.querySelectorAll('.gc-pick')].filter(c=>c.checked).map(c=>c.dataset.id); const L=S.routes.filter(r=>ids.includes(r.id)); if(!L.length) return err('Cochez au moins une ligne');
    if(!confirm(`Fermer ${L.length} ligne(s) et vendre les avions qui ne volent que sur elles ?`)) return;
    const r=gcClose(L,null); toast(`🧹 ${r.lines} ligne(s) fermée(s), ${r.sold} avion(s) vendu(s)${r.cash>1?` (+${fmtMoney(r.cash)})`:''}${r.later?`, ${r.later} à l’atterrissage`:''}`,'ok'); renderTop(); refreshModal(); } });
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ gcHook(); }catch(e){ console.warn(e); } },0));
