/* =========================================================
   Sky Empire — 👥 entre amis (multijoueur sans serveur)
   - Votre carte de score se partage (WhatsApp, SMS…) sous forme d'un code.
   - Collez le code d'un ami : il entre dans votre classement entre amis.
   - Défi de la semaine : le même pour tout le monde (semaine réelle du
     calendrier) ; on compare le score de la semaine avec ses amis.
   Pas de serveur : les codes voyagent par vos messages. Un code est
   vérifié (somme de contrôle) mais pas inviolable.
   ========================================================= */
'use strict';
const FR_CHAL=[
  {k:'pax',i:'🧳',t:'Le plus de passagers transportés',u:'passagers',v:()=>S.stats.pax||0},
  {k:'profit',i:'💰',t:'Le plus gros bénéfice',u:'$',v:()=>typeof netWorth==='function'?netWorth():S.cash,money:true},
  {k:'flights',i:'🛫',t:'Le plus de vols réalisés',u:'vols',v:()=>S.stats.flights||0},
  {k:'freight',i:'🚚',t:'Le plus de fret par camion, bateau ou train',u:'t',v:()=>{ const T=S.tr||{}; let n=0; for(const k of ['truck','boat','train']) for(const L of (T[k]&&T[k].lines)||[]) n+=L.tot||0; return n; }},
  {k:'lines',i:'🧭',t:'Le plus de nouvelles lignes ouvertes',u:'lignes',v:()=>(S.routes||[]).length},
];
const frWeek=()=>{ const d=new Date(), t=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()), day=(new Date(t).getUTCDay()+6)%7, th=new Date(t-day*864e5+3*864e5), y0=Date.UTC(th.getUTCFullYear(),0,4); return th.getUTCFullYear()*100+1+Math.round((th-y0)/(7*864e5)); };
const frChal=w=>FR_CHAL[(w||frWeek())%FR_CHAL.length];
function frState(){ S.fr=S.fr||{friends:[]}; const w=frWeek(), C=frChal(w); if(S.fr.week!==w){ S.fr.week=w; S.fr.base=C.v(); } return S.fr; }
const frWeekScore=()=>{ const F=frState(), C=frChal(F.week); return Math.max(0,Math.round(C.v()-(F.base||0))); };
const frSum=s=>{ let h=2166136261; for(const ch of s+'|sky-empire') { h^=ch.charCodeAt(0); h=Math.imul(h,16777619); } return (h>>>0).toString(36); };
function frMine(){ let rank=0; try{ const r=aiRows().find(x=>x.me); rank=r?r.rank:0; }catch(e){}
  const F=frState(); return {n:S.company.name, c:S.company.code, col:S.company.color, lg:S.company.logo, hub:S.company.hub, v:Math.round(typeof netWorth==='function'?netWorth():S.cash), r:rank, f:S.fleet.length, l:(S.routes||[]).length,
    p:Math.round(S.stats.pax||0), m:S.ms?Object.keys(S.ms.done||{}).length:0, w:F.week, ws:frWeekScore(), t:Date.now()}; }
function frEncode(o){ const j=JSON.stringify(o), b=btoa(unescape(encodeURIComponent(j))); return 'SKY1-'+b+'-'+frSum(b); }
function frDecode(code){ const m=String(code||'').trim().match(/SKY1-([A-Za-z0-9+/=]+)-([a-z0-9]+)/); if(!m) return null; if(frSum(m[1])!==m[2]) return {bad:true};
  try{ return JSON.parse(decodeURIComponent(escape(atob(m[1])))); }catch(e){ return null; } }
function frShareText(){ const o=frMine(), C=frChal(o.w);
  return `✈️ Sky Empire — ${o.n} (${o.c})\n🏆 ${o.r?o.r+'ᵉ compagnie mondiale':'—'} · valeur ${fmtMoney(o.v)}\n✈️ ${o.f} avions · ${o.l} lignes · ${num(o.p)} passagers\n🎯 Défi de la semaine (${C.t}) : ${C.money?fmtMoney(o.ws):num(o.ws)+' '+C.u}\nMon code (colle-le dans Sky Empire → Compagnie → 👥 Amis) :\n${frEncode(o)}`; }
function frHtml(){
  const F=frState(), me=frMine(), C=frChal(F.week);
  const all=[{...me,me:true},...F.friends.filter(x=>x.c!==me.c||x.n!==me.n)];
  const byVal=all.slice().sort((a,b)=>b.v-a.v), byWeek=all.filter(x=>x.w===F.week).sort((a,b)=>b.ws-a.ws);
  const row=(x,i,val)=>`<div class="card row ${x.me?'gold-b':''}"><div style="width:26px;font-weight:800">${['🥇','🥈','🥉'][i]||i+1}</div><div class="biglogo" style="background:${esc(x.col||'#334155')};width:34px;height:34px;font-size:18px">${esc(x.lg||'✈️')}</div><div class="grow"><b>${esc(x.n)}</b> <span class="mut small">${esc(x.c||'')}${x.me?' · vous':''}</span><br><span class="small mut">${x.f} avions · ${x.l} lignes${x.r?' · '+x.r+'ᵉ mondial':''} · mis à jour ${new Date(x.t).toLocaleDateString('fr-FR')}</span></div><b>${val(x)}</b>${x.me?'':`<button class="btn sm danger" data-act="frDel" data-c="${esc(x.c)}" data-n="${esc(x.n)}">×</button>`}</div>`;
  return `<div class="simplehelp">💡 <b>Jouez entre amis</b> : partagez votre carte de score (WhatsApp, SMS…). Vos amis collent votre code dans leur jeu, vous collez le leur : vous voyez qui a la plus grosse compagnie, et qui gagne le <b>défi de la semaine</b> (le même pour tout le monde, il change chaque lundi). Pas besoin de compte ni d’Internet permanent.</div>
  <div class="card"><b>${C.i} Défi de la semaine : ${C.t}</b><br><span class="small">Votre score depuis lundi : <b>${C.money?fmtMoney(me.ws):num(me.ws)+' '+C.u}</b></span></div>
  <div class="btns"><button class="btn gold" data-act="frShare">📤 Partager ma carte de score</button><button class="btn" data-act="frCopy">📋 Copier mon code</button></div>
  <h3>📥 Ajouter le score d’un ami</h3>
  <div class="row"><input id="frIn" class="grow" placeholder="Collez ici le code SKY1-… de votre ami"><button class="btn sm gold" data-act="frAdd">Ajouter</button></div>
  <h3>🎯 Classement du défi de la semaine</h3>${byWeek.map((x,i)=>row(x,i,y=>C.money?fmtMoney(y.ws):num(y.ws))).join('')}${byWeek.length<2?'<div class="mut small">Ajoutez les codes de vos amis de cette semaine pour vous comparer.</div>':''}
  <h3>🏆 Classement général (valeur de la compagnie)</h3>${byVal.map((x,i)=>row(x,i,y=>fmtMoney(y.v))).join('')}`;
}
function registerFriendActions(){
  Object.assign(ACTIONS,{
    frShare:()=>{ const txt=frShareText(); if(navigator.share) navigator.share({title:'Sky Empire',text:txt}).catch(()=>{}); else ACTIONS.frCopy(); },
    frCopy:()=>{ const txt=frShareText(); (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('📋 Carte de score copiée : collez-la dans WhatsApp ou un SMS','ok'),()=>{ showModal('📋 Votre carte de score',`<textarea style="width:100%;height:180px">${esc(txt)}</textarea>`); }); },
    frAdd:()=>{ const v=(document.getElementById('frIn')||{}).value, o=frDecode(v); if(!o) return err('Code introuvable : collez le message complet de votre ami (il contient SKY1-…).'); if(o.bad) return err('Ce code a été modifié : il n’est pas valable.');
      const F=frState(); F.friends=F.friends.filter(x=>!(x.c===o.c&&x.n===o.n)); F.friends.push(o); toast(`👥 ${esc(o.n)} ajouté à votre classement`,'ok'); renderPanel(); },
    frDel:d=>{ const F=frState(); F.friends=F.friends.filter(x=>!(x.c===d.c&&x.n===d.n)); renderPanel(); },
  });
}
