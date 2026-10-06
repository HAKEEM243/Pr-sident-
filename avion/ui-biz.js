/* ============================================================
   ÉCRANS AFFAIRES — bourse, statistiques, décisions
   ============================================================ */
function pBourse(){
  ensureBiz(); const st=S.stock, v=companyValue(), price=sharePrice(), own=1-st.public;
  const h=st.hist, prev=h.length>7?h[h.length-8].p:price, ch=prev?price/prev-1:0;
  const comp=(S.rivals||[]).slice().sort((a,b)=>rivalValue(b)-rivalValue(a));
  return `<div class="card stockcard"><div class="row"><div class="grow"><div class="kl">${esc(S.company.code)} · ${st.ipo?'cotée':'non cotée'}</div>
    <div class="kv">$${price.toFixed(2)} <small class="${ch<0?'neg':'pos'}">${ch>=0?'▲':'▼'} ${(ch*100).toFixed(1)} % (7 j)</small></div>
    <div class="small mut">Capitalisation ${fmtMoney(v*(1+st.sentiment))} · bénéfice moyen ${fmtMoney(avgWeeklyProfit())}/semaine</div></div>
    <div class="ownring" style="--p:${own*100}"><span>${Math.round(own*100)} %<small>à vous</small></span></div></div>
    <canvas id="stockChart" height="130"></canvas>
    ${!st.ipo?`<div class="al">🔔 <b>Introduction en bourse</b> : vendez une partie du capital pour lever des fonds (valeur nette ≥ $40 M, image ≥ 40).</div>
      <div class="btns sm"><button class="btn sm gold" data-act="ipo" data-p="0.25">Vendre 25 % · ≈ ${fmtMoney(0.25*v*0.95)}</button><button class="btn sm" data-act="ipo" data-p="0.4">Vendre 40 % · ≈ ${fmtMoney(0.4*v*0.95)}</button></div>`
     :`<div class="btns sm"><button class="btn sm gold" data-act="issue" data-p="0.05" ${st.public+0.05>0.49?'disabled':''}>Émettre 5 % · ≈ ${fmtMoney(0.05*v*0.93)}</button><button class="btn sm" data-act="buyback" data-p="0.05" ${st.public<0.05?'disabled':''}>Racheter 5 % · ${fmtMoney(0.05*v*1.05)}</button>
       <button class="btn sm" data-act="dividend" data-v="${Math.max(1e6,Math.round(Math.max(0,avgWeeklyProfit())*2/1e6)*1e6)}">💸 Dividende ${fmtMoney(Math.max(1e6,Math.round(Math.max(0,avgWeeklyProfit())*2/1e6)*1e6))}</button></div>
       <div class="small mut">Flottant : ${Math.round(st.public*100)} % · vous devez garder 51 % · un dividende soutient le cours et l’image.</div>`}
  </div>
  <h3>Marché des compagnies</h3>
  <div class="mut small">Achetez des actions de vos concurrents. À <b>51 %</b>, vous les rachetez : leur hub, leurs lignes et leurs avions deviennent les vôtres.</div>
  ${comp.map(R=>{ const pct=st.holdings[R.code]||0, val=rivalValue(R), cost5=0.05*val*(1.1+pct*0.6);
    return `<div class="card rivalcard"><div class="row"><span class="dot" style="background:${R.color}"></span><div class="grow"><b>${R.name}</b>${R.local?' <span class="badge bad">rival local</span>':''}${isPartner(R)?' <span class="badge ok">partenaire</span>':''}<br><span class="small mut">${flag(R.hub)} ${AP(R.hub).city} · ${R.fleet} avions · ${R.routes.length} lignes · ${stars(R.rep)}</span></div><div class="right"><b>${fmtMoney(val)}</b><br><span class="small mut">valeur</span></div></div>
      <div class="cond">Votre part ${bar(pct/0.51, pct>=0.4?'warn':'')} <b>${Math.round(pct*100)} % / 51 %</b></div>
      <div class="btns sm"><button class="btn sm gold" data-act="stake" data-c="${R.code}" data-p="0.05">+5 % · ${fmtMoney(cost5)}</button><button class="btn sm" data-act="stake" data-c="${R.code}" data-p="0.1">+10 %</button>
      ${pct>=0.25?`<button class="btn sm gold" data-act="stake" data-c="${R.code}" data-p="${(0.51-pct).toFixed(4)}">🏆 OPA : passer à 51 % · ${fmtMoney((0.51-pct)*val*(1.1+pct*0.6))}</button>`:''}
      ${pct>0?`<button class="btn sm danger" data-act="unstake" data-c="${R.code}" data-p="${Math.min(0.05,pct).toFixed(4)}">Vendre ${Math.round(Math.min(0.05,pct)*100)} %</button>`:''}</div></div>`; }).join('')}
  <div class="small mut">Valeur de vos participations : ${fmtMoney(holdingsValue())} (incluse dans votre valeur nette).</div>`;
}
function drawWeeksChart(){
  const cv=document.getElementById('weeksChart'); if(!cv) return;
  const W=(S.weeks||[]).slice(-16), w=cv.clientWidth||360, h=170, dpr=window.devicePixelRatio||1;
  cv.width=w*dpr; cv.height=h*dpr; const g=cv.getContext('2d'); g.scale(dpr,dpr);
  if(!W.length){ g.fillStyle='#8fa0b8'; g.font='12px system-ui'; g.fillText('Premier bilan à la fin de la semaine de jeu',10,90); return; }
  const mx=Math.max(1,...W.map(x=>Math.max(x.rev,x.cost,Math.abs(x.profit)))), mn=Math.min(0,...W.map(x=>x.profit));
  const Y=v=>h-22-(v-mn)/(mx-mn)*(h-40), bw=(w-40)/W.length;
  g.strokeStyle='rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(36,Y(0)); g.lineTo(w,Y(0)); g.stroke();
  g.fillStyle='#8fa0b8'; g.font='10px system-ui'; g.fillText(fmtMoney(mx).replace('$',''),0,Y(mx)+8); if(mn<0) g.fillText(fmtMoney(mn).replace('$',''),0,Y(mn));
  W.forEach((x,i)=>{ const X=38+i*bw;
    g.fillStyle='rgba(125,211,252,.35)'; g.fillRect(X,Y(x.rev),bw*0.42,Y(0)-Y(x.rev));
    g.fillStyle='rgba(248,113,113,.35)'; g.fillRect(X+bw*0.42,Y(x.cost),bw*0.42,Y(0)-Y(x.cost));
  });
  g.strokeStyle='#f5c518'; g.lineWidth=2.5; g.beginPath(); W.forEach((x,i)=>{ const X=38+i*bw+bw*0.42; i?g.lineTo(X,Y(x.profit)):g.moveTo(X,Y(x.profit)); }); g.stroke();
  W.forEach((x,i)=>{ g.fillStyle=x.profit<0?'#f87171':'#f5c518'; g.beginPath(); g.arc(38+i*bw+bw*0.42,Y(x.profit),3,0,7); g.fill(); });
  g.font='10.5px system-ui'; g.fillStyle='#7dd3fc'; g.fillText('■ Recettes',40,12); g.fillStyle='#f87171'; g.fillText('■ Charges',110,12); g.fillStyle='#f5c518'; g.fillText('● Bénéfice',175,12);
}
function decisionHtml(d){
  return `<div class="decision"><div class="dicon">${d.icon}</div><div class="small">${d.text}</div></div>
  <div class="btns">${d.options.map((o,i)=>`<button class="btn ${i===0?'gold':''} big" data-act="decide" data-i="${i}">${o}</button>`).join('')}</div>
  <div class="mut small">Sans réponse avant le ${fmtDate(d.until)}, le choix « ${d.options[d.options.length-1]} » s’appliquera.</div>`;
}
function maybeShowDecision(){
  if(!S||!S.decision||UI.modal||!$('#modal').hidden||document.body.classList.contains('piloting')) return;
  UI.modal='decision'; showModal(`${S.decision.icon} ${S.decision.title}`, decisionHtml(S.decision));
}
Object.assign(ACTIONS,{
  decide:d=>{ resolveDecision(+d.i); closeModal(); renderPanel(); renderTop(); },
  order:d=>{ const q=UI.qty||1, m=getModel(d.m), hub=UI.buyHub&&S.hubs.includes(UI.buyHub)?UI.buyHub:S.hubs[0];
    const dep=m.price*1e6*(1-volumeDiscount(q))*q*0.2;
    if(S.cash<dep && !confirm(`Acompte ${fmtMoney(dep)} > capital. Commander quand même ?`)) return;
    if(!err(orderAircraft(m.id,q,hub,false))){ toast(`📝 Commande passée : ${q} × ${m.name}, livraison dans ${leadDays(m)} jours`,'ok'); if(qualifiedPilots(m.fam)<2) toast(`⚠️ Formez ou recrutez des pilotes ${m.fam} d’ici la livraison`,'warn'); renderPanel(); } },
  orderExpress:d=>{ const q=UI.qty||1, m=getModel(d.m), hub=UI.buyHub&&S.hubs.includes(UI.buyHub)?UI.buyHub:S.hubs[0], cost=m.price*1e6*(1-volumeDiscount(q))*1.12*q;
    if(S.cash<cost && !confirm(`Coût ${fmtMoney(cost)} > capital. Acheter quand même ?`)) return;
    if(!err(orderAircraft(m.id,q,hub,true))){ toast(`✈️ ${q} × ${m.name} livré(s) à ${AP(hub).city} !`,'ok'); renderPanel(); } },
  cancelOrder:d=>{ if(confirm('Annuler cette commande ? L’acompte de 20 % est perdu.')){ cancelOrder(d.id); renderPanel(); } },
  csSign:d=>{ if(!err(signCodeshare(d.c))){ toast('🤝 Partage de codes signé','ok'); renderPanel(); } },
  csCancel:d=>{ if(confirm('Rompre cet accord ?')){ cancelCodeshare(d.c); renderPanel(); } },
  ipo:d=>{ if(!confirm(`Introduire la compagnie en bourse en vendant ${Math.round(+d.p*100)} % du capital ?`)) return; if(!err(ipo(+d.p))){ toast('🔔 Bienvenue en bourse !','ok'); renderPanel(); renderTop(); } },
  issue:d=>{ if(!err(issueShares(+d.p))) renderPanel(); },
  buyback:d=>{ if(!err(buyback(+d.p))) renderPanel(); },
  dividend:d=>{ if(!err(payDividend(+d.v))) renderPanel(); },
  stake:d=>{ const R=S.rivals.find(x=>x.code===d.c); const cur=S.stock.holdings[d.c]||0;
    if(cur+(+d.p)>=0.51 && !confirm(`Prendre le contrôle de ${R.name} ? Sa flotte, ses lignes et son hub vous reviendront.`)) return;
    if(!err(buyStake(d.c,+d.p))){ renderPanel(); renderTop(); } },
  unstake:d=>{ if(!err(sellStake(d.c,+d.p))) renderPanel(); },
});
Object.assign(INPUTS,{ qty:el=>{ UI.qty=+el.value; renderPanel(); } });
