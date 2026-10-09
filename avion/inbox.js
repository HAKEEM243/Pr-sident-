/* =========================================================
   Sky Empire — Messagerie des PDG rivaux
   Les autres compagnies vous écrivent : partage de codes,
   rachat de ligne, menaces de guerre des prix, alliances,
   avions d'occasion, piques et félicitations. Vos réponses
   ont de vraies conséquences.
   ========================================================= */
'use strict';
const CEO_FIRST=['Marc','Sofia','Kenji','Amara','Lars','Isabel','Omar','Grace','Viktor','Mei','Rafael','Nadia','Thomas','Aïcha','Hiroshi','Elena','Samuel','Leïla','Pedro','Ingrid','Kwame','Yuki','Diego','Fatou'];
const CEO_LAST=['Laurent','Okonkwo','Tanaka','Bergström','Haddad','Rossi','Mbeki','Novak','Chen','Alvarez','Kowalski','Diallo','Schneider','Sato','Moreau','Kariuki','Silva','Petrov','Mensah','Lindqvist'];
function ceoOf(e){ if(!e.ceo){ const h=hashStr(e.code); e.ceo=CEO_FIRST[h%CEO_FIRST.length]+' '+CEO_LAST[(h>>3)%CEO_LAST.length]; } return e.ceo; }
const isAlly=code=>!!(S.allies&&S.allies[code]>S.time);
const inTruce=code=>!!(S.truce&&S.truce[code]>S.time);
const mailOpen=()=>(S.inbox||[]).filter(m=>m.st==='new');
const lineName=r=>r.stops.map(keyCity).join(' – ');

function mailPush(e,kind,subj,body,opts,extra){
  S.inbox=S.inbox||[];
  if(extra&&extra.rid&&S.inbox.some(x=>x.st==='new'&&x.kind===kind&&x.rid===extra.rid)) return null;
  const m={id:uid(),t:S.time,code:e.code,from:e.name,ceo:ceoOf(e),color:e.color||'#64748b',kind,subj,body,opts,st:'new',exp:S.time+5*DAY,...(extra||{})};
  S.inbox.unshift(m); if(S.inbox.length>60) S.inbox.length=60;
  if(typeof UI!=='undefined'&&!UI.silent&&typeof toast==='function') toast(`📬 <b>${esc(m.ceo)}</b> (${esc(e.name)}) : ${esc(subj)} — ouvrez 📬 en haut`,'rival');
  renderMailBadge();
  return m;
}

/* ---------- génération ---------- */
function myLines(){ return (S.routes||[]).filter(r=>typeof routeAircraft!=='function'||routeAircraft(r).length); }
function rivalsOnLine(r){ const a=r.stops[0], b=r.stops[r.stops.length-1]; return carriersOn(a,b).map(aiBy).filter(e=>e&&e.status!=='dead'); }
function ceoTick(){
  if(!S.ai||!S.ai.list||!S.routes) return;
  // expirations : un silence vaut refus (et parfois provoque la colère)
  for(const m of S.inbox||[]) if(m.st==='new'&&m.exp<S.time){ m.st='exp'; if(m.kind==='threat') threatOutcome(m,'ignore'); }
  if(mailOpen().length>=4||Math.random()>0.035) return; // ≈ 1 message par jour
  const lines=myLines();
  const gens=[
    {w:lines.length?3:0, f:mkCodeshare},
    {w:lines.some(r=>r.stats.flights>=6)?2:0, f:mkBuyLine},
    {w:lines.length?2.4:0, f:mkThreat},
    {w:S.fleet.length>=3&&!Object.keys(S.allies||{}).some(isAlly)?1:0.3, f:mkAlliance},
    {w:1.4, f:mkUsedPlane},
    {w:1.6, f:mkBanter},
  ];
  for(let i=0;i<3;i++){ const g=wpick(gens); if(g.w>0&&g.f()) return; }
}
function mkCodeshare(){
  const r=pick(myLines()); if(!r) return false;
  const a=r.stops[0], b=r.stops[r.stops.length-1];
  const cand=aiAlive().filter(e=>!carriersOn(a,b).includes(e.code)&&(dist(e.hub,a)<3000||dist(e.hub,b)<3000));
  const e=cand.length?pick(cand):null; if(!e||(S.deals||[]).some(d=>d.rid===r.id&&d.until>S.time)) return false;
  const pct=rndi(5,12);
  mailPush(e,'codeshare',`Partage de codes sur ${lineName(r)}`,
    `Bonjour,<br>Nos passagers de ${keyCity(e.hub)} cherchent à rejoindre ${keyCity(b)}. Nous vous proposons un <b>partage de codes</b> sur votre ligne <b>${lineName(r)}</b> pendant 3 mois : nous vendons vos sièges dans notre réseau.<br>Vous toucherez environ <b>+${pct} %</b> des recettes de la ligne chaque semaine.`,
    [{k:'ok',l:'🤝 Accepter'},{k:'no',l:'Refuser'}],{rid:r.id,pct});
  return true;
}
function mkBuyLine(){
  const cand=myLines().filter(r=>r.stats.flights>=6); const r=pick(cand); if(!r) return false;
  const a=r.stops[0], b=r.stops[r.stops.length-1];
  const e=pick(aiAlive().filter(x=>x.fleet>=10&&(dist(x.hub,a)<2500||dist(x.hub,b)<2500)))||pick(aiAlive()); if(!e) return false;
  const weeks=Math.max(4,(S.time-(r.opened||0))/(7*DAY)), wkProfit=(r.stats.rev-r.stats.cost)/weeks;
  const price=Math.round(Math.max(1.5e6*(1+legsFor(r.stops).reduce((s,l)=>s+l.dist,0)/3000), Math.min(90e6,wkProfit*52*rnd(0.9,1.5)))/1e4)*1e4;
  mailPush(e,'buy',`Offre de rachat : ${lineName(r)}`,
    `Cher confrère,<br>${e.name} souhaite <b>racheter vos droits</b> sur la ligne <b>${lineName(r)}</b> (créneaux, clientèle, contrats).<br>Notre offre : <b>${fmtMoney(price)}</b>, payés comptant. La ligne serait fermée de votre côté et vos avions libérés pour d’autres routes.`,
    [{k:'ok',l:`💰 Vendre ${fmtMoney(price)}`},{k:'counter',l:'↗️ Demander +30 %'},{k:'no',l:'Refuser'}],{rid:r.id,price});
  return true;
}
function mkThreat(){
  const lines=myLines().filter(r=>rivalsOnLine(r).length); const r=pick(lines); if(!r) return false;
  const e=rivalsOnLine(r).filter(x=>!isAlly(x.code)&&!inTruce(x.code)).sort((x,y)=>personaOf(y.code).agg-personaOf(x.code).agg)[0]; if(!e) return false;
  const fee=Math.round(rnd(0.4e6,2.2e6)/1e4)*1e4;
  mailPush(e,'threat',`Avertissement sur ${lineName(r)}`,
    `${pick(['Soyons francs.','Je vais être direct.','Un conseil amical.'])} Votre arrivée sur <b>${lineName(r)}</b> nous coûte des passagers. Si vous ne réduisez pas la voilure, <b>${e.name}</b> lancera une <b>guerre des prix</b> sur cette ligne.<br>Nous pouvons aussi signer une trêve commerciale de 4 mois contre une compensation de <b>${fmtMoney(fee)}</b>.`,
    [{k:'resist',l:'💪 Tenir bon'},{k:'pay',l:`🕊️ Trêve (${fmtMoney(fee)})`},{k:'quit',l:'🚪 Quitter la ligne'}],{rid:r.id,fee});
  return true;
}
function mkAlliance(){
  const e=pick(aiAlive().filter(x=>x.fleet>=40&&!isAlly(x.code))); if(!e) return false;
  const fee=Math.round(rnd(1e6,4e6)*(1+S.fleet.length/40)/1e4)*1e4;
  mailPush(e,'alliance',`Proposition d’alliance stratégique`,
    `Madame, Monsieur,<br>Votre croissance impressionne notre conseil d’administration. ${e.name} (${e.fleet} avions) vous propose une <b>alliance d’un an</b> : programmes de fidélité communs, salons partagés, aucune guerre des prix entre nous.<br>Droit d’entrée : <b>${fmtMoney(fee)}</b>. Effets : image <b>+3</b>, et un bonus de recettes de <b>+3 %</b> sur toutes vos lignes chaque semaine.`,
    [{k:'ok',l:`🤝 Rejoindre (${fmtMoney(fee)})`},{k:'no',l:'Décliner'}],{fee});
  return true;
}
function mkUsedPlane(){
  const e=pick(aiAlive().filter(x=>x.fleet>=6)); if(!e) return false;
  const m=modelFor(e); if(!m) return false;
  const price=Math.round(m.price*1e6*rnd(0.38,0.52)/1e4)*1e4;
  mailPush(e,'plane',`À vendre : ${m.name} d’occasion`,
    `Bonjour,<br>Nous renouvelons notre flotte. Un <b>${m.name}</b> (≈ 12 ans, entretien à jour, ${m.seats} sièges) est disponible pour <b>${fmtMoney(price)}</b>, soit ${Math.round(price/(m.price*1e6)*100)} % du prix neuf. Livraison immédiate à votre hub.`,
    [{k:'ok',l:`🛒 Acheter ${fmtMoney(price)}`},{k:'no',l:'Non merci'}],{mid:m.id,price});
  return true;
}
function mkBanter(){
  const rk=S.ai.myRank||0, e=pick(aiAlive().filter(x=>x.fleet>=5)); if(!e) return false;
  const msgs=[
    [`Félicitations`,`Bravo pour votre progression${rk?` : vous voilà ${rk}ᵉ au classement mondial`:''}. On se retrouvera sur les mêmes lignes, que le meilleur gagne !`],
    [`Petite pique`,`J’ai vu vos tarifs… Courageux. Chez ${e.name}, on préfère gagner de l’argent. 😉`],
    [`Salon de Dubaï`,`Vous serez au salon aéronautique ? Je vous offre un café sur notre stand, on parlera de l’avenir de l’aviation en Afrique et ailleurs.`],
    [`Météo et solidarité`,`La saison des orages commence. Si l’un de vos avions doit dérouter vers ${keyCity(e.hub)}, nos équipes au sol vous aideront.`],
    [`Défi`,`Mes équipages disent que vos hôtesses ont le plus beau sourire du ciel. Les miens jurent qu’on servira un meilleur repas que vous d’ici la fin de l’année. Pari tenu ?`],
  ];
  const [s,b]=pick(msgs);
  mailPush(e,'banter',s,b,[{k:'nice',l:'🙂 Répondre poliment'},{k:'tease',l:'😏 Répliquer'}]);
  return true;
}

/* ---------- réponses ---------- */
function threatOutcome(m,how){
  const r=(S.routes||[]).find(x=>x.id===m.rid), e=aiBy(m.code); if(!e) return;
  const a=r?r.stops[0]:null, b=r?r.stops[r.stops.length-1]:null;
  const war=()=>{ if(!r) return; S.ai.wars=S.ai.wars||{}; S.ai.wars[e.code+pairKey(a,b)]={code:e.code,a,b,until:S.time+rndi(14,30)*DAY,kind:'prix'};
    aiNews(`⚔️ ${e.name} met sa menace à exécution : guerre des prix sur ${keyCity(a)}–${keyCity(b)} contre vous.`,'rival',true); };
  if(how==='resist'){ if(Math.random()<0.6) war(); else { S.reputation=clamp(S.reputation+1,0,100); logMsg(`😎 ${e.name} bluffait : face à votre fermeté, ${m.ceo} renonce à la guerre des prix. Image +1.`,'ok'); } }
  else if(how==='ignore'){ if(Math.random()<0.8) war(); }
}
function mailAnswer(id,k){
  const m=(S.inbox||[]).find(x=>x.id===id); if(!m||m.st!=='new') return;
  const e=aiBy(m.code)||{name:m.from,code:m.code}, r=m.rid&&(S.routes||[]).find(x=>x.id===m.rid);
  let res='';
  if(m.kind==='codeshare'){
    if(k==='ok'){ if(!r){ res='La ligne n’existe plus.'; } else { S.deals=(S.deals||[]).filter(d=>d.until>S.time); S.deals.push({k:'cs',code:e.code,rid:r.id,pct:m.pct,until:S.time+90*DAY,rev:r.stats.rev}); res=`🤝 Partage de codes signé avec ${e.name} sur ${lineName(r)} (+${m.pct} % des recettes chaque semaine pendant 3 mois).`; aiNews(`🤝 ${S.company.name} et ${e.name} signent un partage de codes sur ${lineName(r)}.`,'news',true); } }
    else res=`Vous déclinez l’offre de ${e.name}.`;
  } else if(m.kind==='buy'){
    if(k==='ok'){ if(!r) res='La ligne n’existe plus.'; else { book('ventes',m.price); closeLine(r.id); const a=r.stops[0], b=r.stops[r.stops.length-1]; if(S.ai.extra){ (S.ai.extra[e.code]=S.ai.extra[e.code]||[]).push(pairKey(a,b)); S.ai.ver++; }
        res=`💰 Ligne ${lineName(r)} vendue à ${e.name} pour ${fmtMoney(m.price)}. Vos avions sont libres.`; aiNews(`💼 ${e.name} rachète la ligne ${lineName(r)} à ${S.company.name} pour ${fmtMoney(m.price)}.`,'news',true); } }
    else if(k==='counter'){ if(Math.random()<0.45&&r){ const p=Math.round(m.price*1.3/1e4)*1e4; mailPush(e,'buy',`Contre-offre acceptée : ${lineName(r)}`,`D’accord, vous négociez bien. Dernière offre : <b>${fmtMoney(p)}</b> pour ${lineName(r)}. À prendre ou à laisser.`,[{k:'ok',l:`💰 Vendre ${fmtMoney(p)}`},{k:'no',l:'Refuser'}],{rid:r.id,price:p}); res=`${m.ceo} réfléchit… et revient avec une nouvelle offre (voir messagerie).`; }
      else res=`${m.ceo} refuse de monter : « Notre offre était déjà généreuse. »`; }
    else res=`Vous gardez votre ligne.`;
  } else if(m.kind==='threat'){
    if(k==='pay'){ if(S.cash<m.fee){ toast('Trésorerie insuffisante','bad'); return; } book('incidents',-m.fee); S.truce=S.truce||{}; S.truce[e.code]=S.time+120*DAY; for(const w of Object.keys(S.ai.wars||{})) if(S.ai.wars[w].code===e.code) delete S.ai.wars[w]; res=`🕊️ Trêve signée avec ${e.name} pour 4 mois (${fmtMoney(m.fee)}).`; }
    else if(k==='quit'){ if(r){ closeLine(r.id); res=`🚪 Vous quittez ${lineName(r)}. ${e.name} reprend la ligne.`; S.reputation=clamp(S.reputation-1,0,100); } }
    else { threatOutcome(m,'resist'); res=`💪 Vous refusez de céder à ${e.name}.`; }
  } else if(m.kind==='alliance'){
    if(k==='ok'){ if(S.cash<m.fee){ toast('Trésorerie insuffisante','bad'); return; } book('alliance',-m.fee); S.allies=S.allies||{}; S.allies[e.code]=S.time+365*DAY; S.reputation=clamp(S.reputation+3,0,100);
      for(const w of Object.keys(S.ai.wars||{})) if(S.ai.wars[w].code===e.code) delete S.ai.wars[w];
      res=`🌐 Vous rejoignez l’alliance de ${e.name} pour un an. Image +3, recettes +3 % chaque semaine.`; aiNews(`🌐 ${S.company.name} s’allie avec ${e.name} : une nouvelle force dans le ciel.`,'news',true); }
    else res=`Vous restez indépendant.`;
  } else if(m.kind==='plane'){
    if(k==='ok'){ if(S.cash<m.price){ toast('Trésorerie insuffisante','bad'); return; } const ac=addAircraft(m.mid,{owned:true,used:true}); ac.price=m.price; book('investissements',-m.price); res=`🛬 ${getModel(m.mid).name} acheté à ${e.name} (${ac.reg}). Il vous attend à votre hub.`; }
    else res='Offre déclinée.';
  } else if(m.kind==='banter'){
    if(k==='nice'){ S.reputation=clamp(S.reputation+0.3,0,100); res=`🙂 Échange cordial avec ${m.ceo}. Image +0,3.`; }
    else { res=`😏 Votre réplique fait le tour des réseaux sociaux !`; S.reputation=clamp(S.reputation+(Math.random()<0.6?0.8:-0.8),0,100);
      if(Math.random()<0.3) aiNews(`🗯️ Passe d’armes publique entre ${S.company.name} et ${e.name} : les internautes adorent.`,'news',true); }
  }
  m.st='done'; m.res=res||'Répondu.';
  if(res) logMsg(res,'ok');
  renderMailBadge(); if(UI.modal==='inbox') openM('inbox');
  if(typeof renderPanel==='function') renderPanel();
}

/* ---------- effets hebdomadaires (partage de codes, alliance) ---------- */
function inboxWeekly(){
  let tot=0;
  for(const d of S.deals||[]){
    if(d.until<S.time) continue; const r=(S.routes||[]).find(x=>x.id===d.rid); if(!r){ d.until=0; continue; }
    const delta=Math.max(0,r.stats.rev-(d.rev||0)); d.rev=r.stats.rev; tot+=delta*d.pct/100;
  }
  if(Object.keys(S.allies||{}).some(isAlly)){ let wk=0; for(const [k,v] of Object.entries((S.led&&S.led.week)||{})) if(k==='billets') wk+=v; tot+=Math.max(0,wk)*0.03; }
  if(tot>1000){ book('billets',tot); logMsg(`🤝 Partenariats (partage de codes, alliance) : ${fmtMoney(tot)} de recettes en plus cette semaine.`,'ok'); }
}

/* ---------- interface ---------- */
function renderMailBadge(){
  if(typeof document==='undefined') return;
  const el=document.getElementById('tb-mail'); if(!el||typeof S==='undefined'||!S) return;
  const n=mailOpen().length; el.innerHTML=`📬${n?`<i>${n}</i>`:''}`; el.classList.toggle('has',n>0);
}
function inboxHtml(){
  const L=S.inbox||[];
  if(!L.length) return `<p class="mut">Aucun message pour l’instant. Les PDG des autres compagnies vous écriront au fil de votre croissance : offres de partage de codes, rachats, menaces, alliances…</p>`;
  const ally=Object.entries(S.allies||{}).filter(([c,u])=>u>S.time).map(([c,u])=>`🌐 Allié : <b>${esc((aiBy(c)||{}).name||c)}</b> jusqu’au ${fmtDate(u)}`);
  const cs=(S.deals||[]).filter(d=>d.until>S.time).map(d=>{ const r=(S.routes||[]).find(x=>x.id===d.rid); return r?`🤝 Partage de codes ${esc(lineName(r))} avec ${esc((aiBy(d.code)||{}).name||d.code)} (+${d.pct} %) jusqu’au ${fmtDate(d.until)}`:''; }).filter(Boolean);
  const tr=Object.entries(S.truce||{}).filter(([c,u])=>u>S.time).map(([c,u])=>`🕊️ Trêve avec ${esc((aiBy(c)||{}).name||c)} jusqu’au ${fmtDate(u)}`);
  const head=[...ally,...cs,...tr].length?`<div class="simplehelp">${[...ally,...cs,...tr].join('<br>')}</div>`:'';
  return head+L.slice(0,25).map(m=>`<div class="mail ${m.st}">
    <div class="mail-h"><span class="mail-av" style="background:${m.color}">${esc(m.ceo.split(' ').map(x=>x[0]).join(''))}</span>
      <div><b>${esc(m.subj)}</b><br><small class="mut">${esc(m.ceo)}, PDG de ${esc(m.from)} · ${fmtDate(m.t)} ${fmtTime(m.t)}</small></div></div>
    <div class="mail-b">${m.body}</div>
    ${m.st==='new'?`<div class="mail-a">${m.opts.map(o=>`<button class="btn sm${o.k==='ok'||o.k==='resist'||o.k==='nice'?' gold':''}" data-act="mailAns" data-id="${m.id}" data-k="${o.k}">${o.l}</button>`).join('')}<small class="mut">Réponse attendue avant le ${fmtDate(m.exp)}</small></div>`
      : `<div class="mail-r">${m.st==='exp'?'⌛ Sans réponse — offre expirée.':esc(m.res||'')}</div>`}
  </div>`).join('');
}
function registerInboxActions(){
  MODALS.inbox=()=>showModal('📬 Messagerie — PDG des autres compagnies', inboxHtml(), true);
  Object.assign(ACTIONS,{
    inbox:()=>openM('inbox'),
    mailAns:d=>mailAnswer(d.id,d.k),
  });
  renderMailBadge();
}
