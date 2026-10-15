/* =========================================================
   Sky Empire — 🏛️ Mon pays : vos vols font grandir les villes,
   et l'État vous juge chaque mois.
   - Chaque passager transporté vers une ville de vos pays (pays
     de vos hubs) la fait grandir un peu : plus d'habitants, plus
     de voyageurs. Par paliers, l'État bitume ou allonge sa piste,
     puis agrandit son terminal.
   - Chaque mois, le gouvernement note votre compagnie (villes
     desservies, petites villes désenclavées, pilotes du pays,
     sécurité, grèves, ponctualité) : subvention si vous êtes bien
     vu, taxe spéciale si vous êtes mal vu.
   ========================================================= */
'use strict';
const DEV_LVL=[[5e3,'🌱 La ville se réveille'],[25e3,'🛣️ Piste modernisée par l’État'],[100e3,'🏗️ Terminal agrandi par l’État'],[400e3,'🌆 Métropole régionale']];
function devS(){ S.dev=S.dev||{c:{},rel:{},log:[],wk:0,tier:{},last:{}}; return S.dev; }
const devCountries=()=>[...new Set((S.hubs||[]).map(h=>AP(h)&&AP(h).cc).filter(Boolean))];
const devSmall=c=>{ const A=AP(c), p=typeof cityPop==='function'?cityPop(c):null; return p!=null?p<0.4:A.cls<=2; };
function devServed(cc){ const set=new Set(); for(const r of S.routes||[]){ if(typeof routeAircraft==='function'&&!routeAircraft(r).length) continue; for(const s of r.stops) if(AP(s)&&AP(s).cc===cc) set.add(s); } return set; }

/* ---------- la croissance des villes s'applique au trafic et à la population ---------- */
function devApply(){ const D=devS(); for(const [code,d] of Object.entries(D.c)){ const A=AIRPORTS[code]; if(!A||!(d.g>1)) continue;
  if(A._dt!==undefined){ A.traffic=A._dt; if(A._dp!==undefined) A.popK=A._dp; }
  A._dt=A.traffic; A._dp=A.popK; A.traffic=+(A._dt*d.g).toFixed(4); if(A.popK) A.popK=Math.round(A._dp*d.g); } }
{ const _ap=applyUpgrades; applyUpgrades=function(){ const D=S&&S.dev; if(D) for(const code of Object.keys(D.c)){ const A=AIRPORTS[code]; if(A&&A._dt!==undefined){ A.traffic=A._dt; if(A._dp!==undefined) A.popK=A._dp; delete A._dt; delete A._dp; } }
  const r=_ap.apply(this,arguments); if(D) devApply(); return r; }; }

/* ---------- chaque vol compte les passagers déposés et embarqués ---------- */
{ const _cl=completeLeg; completeLeg=function(ac){ const fl=ac&&ac.flight, leg=fl&&fl.legs&&fl.legs[fl.li]; const r=_cl.apply(this,arguments);
  try{ if(leg&&leg.pax&&!ac.ownerCode){ const n=(leg.pax.f||0)+(leg.pax.j||0)+(leg.pax.w||0)+(leg.pax.y||0); if(n>0){ const ccs=devCountries(), D=devS();
    for(const c of [leg.from,leg.to]){ const A=AP(c); if(!A||!ccs.includes(A.cc)) continue; const d=D.c[c]||(D.c[c]={pax:0,wk:0,lvl:0,g:1}); d.wk+=n; } } } }catch(e){}
  return r; }; }

/* ---------- chaque semaine : croissance ; chaque mois : bulletin de l'État ---------- */
function devWeekly(){
  const D=devS(), changed=[];
  for(const [code,d] of Object.entries(D.c)){ if(!d.wk) continue; const A=AP(code); if(!A){ d.wk=0; continue; }
    d.pax+=d.wk; const size=Math.max(2e3,(A.popK||A.traffic*1e4)*2);   // une petite ville grandit plus vite pour le même nombre de passagers
    const rate=0.0004+0.004*Math.min(1,d.wk/size); const g0=d.g; d.g=+Math.min(2.5,d.g*(1+rate)).toFixed(5); d.wk=0; if(d.g!==g0) changed.push(code);
    while(d.lvl<DEV_LVL.length&&d.pax>=DEV_LVL[d.lvl][0]){ d.lvl++; devLevelUp(code,d.lvl); } }
  if(changed.length){ devApply(); if(typeof xpRefresh==='function') for(const c of changed.slice(0,30)) try{ xpRefresh(c); }catch(e){} }
  D.wk=(D.wk||0)+1; if(D.wk%4===0) for(const cc of devCountries()) try{ devMonthly(cc); }catch(e){ console.warn('dev',e); }
}
function devLevelUp(code,lvl){
  const A=AP(code), cc=A.cc, g=typeof govOf==='function'?govOf(cc):{leader:'—'}, txt=DEV_LVL[lvl-1][1];
  let extra='';
  if(lvl===2){ const t=A.surface!=='Asphalte'?'pave':(UPGRADES.extend&&UPGRADES.extend.can(A)&&A.cls<3?'extend':null); if(t){ (S.upgrades[code]=S.upgrades[code]||[]).push(t); applyUpgrades(); extra=t==='pave'?' L’État bitume la piste : plus de fermetures sous la pluie.':' L’État allonge la piste : des avions plus gros peuvent venir.'; } }
  if(lvl===3){ const t=(UPGRADES.xp1&&UPGRADES.xp1.can(A))?'xp1':(UPGRADES.terminal&&UPGRADES.terminal.can(A))?'terminal':null; if(t){ (S.upgrades[code]=S.upgrades[code]||[]).push(t); applyUpgrades(); if(typeof xpRefresh==='function') xpRefresh(code); extra=' L’État agrandit le terminal : plus de voyageurs.'; } }
  if(lvl===4){ const k=Math.round((1e6+(A.traffic||0)*2e6)/1e5)*1e5; book('subventions',k); extra=` Le président ${g.leader} vous remercie : prime de ${fmtMoney(k)}.`; }
  const msg=`${txt} à ${A.city} grâce à ${S.company.name} (${num(devS().c[code].pax)} passagers transportés).${extra}`;
  devLog(cc,msg); logMsg('🏙️ '+msg,'ok'); if(typeof toast==='function') toast('🏙️ '+esc(msg),'ok');
}
function devLog(cc,txt){ const D=devS(); D.log.unshift({t:S.time,cc,txt}); if(D.log.length>20) D.log.length=20; }

/* ---------- le jugement de l'État ---------- */
function devFactors(cc){
  const g=typeof govOf==='function'?govOf(cc):{style:'reformateur'}, st=g.style, served=devServed(cc), small=[...served].filter(devSmall);
  const loc=S.pilots.length?S.pilots.filter(p=>p.nat===cc).length/S.pilots.length:0;
  const D=devS(), crashes=(S.stats.crashes||0)-(D.last.crashes===undefined?(S.stats.crashes||0):D.last.crashes);
  const strike=(S.staff.strikeUntil||0)>S.time-30*DAY, punct=typeof punctuality==='function'?punctuality():0.9;
  const w=(k)=>({nationaliste:{loc:2,small:1},populiste:{loc:1.5,small:1.5},liberal:{loc:0.5,small:0.7},autoritaire:{loc:1.2,small:1},reformateur:{loc:1,small:1.3}}[st]||{})[k]||1;
  return [
    ['🛫',`Villes du pays desservies : ${served.size}`, Math.min(30,served.size*3), 'Ouvrez des lignes vers d’autres villes du pays.'],
    ['🌱',`Petites villes désenclavées : ${small.length}`, Math.round(Math.min(20,small.length*4)*w('small')), 'Desservez des petites villes (pistes courtes, Caravan, ATR).'],
    ['👨‍✈️',`Pilotes du pays : ${Math.round(loc*100)} %`, Math.round(15*loc*w('loc')), 'Recrutez des pilotes du pays (onglet Personnel).'],
    ['⏱️',`Ponctualité : ${Math.round(punct*100)} %`, Math.round(clamp((punct-0.8)/0.2,-1,1)*10), 'Gardez des avions de réserve, équipe d’escale, ILS.'],
    ['💥',crashes>0?`${crashes} accident(s) ce mois-ci`:'Aucun accident ce mois-ci', crashes>0?-15*crashes:5, 'Entretenez vos avions.'],
    ['✊',strike?'Grève récente':'Pas de grève', strike?-10:3, 'Soignez le moral de vos équipages.'],
    ['🏢',`Taille de la compagnie : ${S.fleet.length} avions`, Math.min(10,Math.round(S.fleet.length/10)), 'Grandissez : l’État aime les grandes compagnies nationales.'],
  ];
}
const devTarget=cc=>clamp(25+devFactors(cc).reduce((s,f)=>s+f[2],0),0,100);
const devTier=r=>r>=70?2:r>=40?1:r>=20?0:-1;
const DEV_TIER={2:['🟢','Très bien vu','subvention chaque mois et taxes d’aéroport réduites'],1:['🟡','Bien vu','ni subvention ni taxe spéciale'],0:['🟠','Mal vu','taxe spéciale chaque mois'],[-1]:['🔴','Très mal vu','taxe spéciale lourde et contrôles']};
function devMonthly(cc){
  const D=devS(), g=typeof govOf==='function'?govOf(cc):{leader:'—'}, old=D.rel[cc]===undefined?55:D.rel[cc];
  const rel=Math.round(old+(devTarget(cc)-old)*0.5); D.rel[cc]=rel; D.last.crashes=S.stats.crashes||0;
  const tier=devTier(rel), served=devServed(cc), small=[...served].filter(devSmall).length; let txt='';
  if(tier===2){ const k=Math.round((small*250e3+served.size*100e3)/1e4)*1e4; if(k>0) book('subventions',k); if(g.fee!==undefined){ g.feeCut=Math.min(g.feeCut||1,0.85); g.feeUntil=Math.max(g.feeUntil||0,S.time+35*DAY); }
    txt=`🏛️ ${ccName(cc)} : le président ${g.leader} salue votre travail — subvention de ${fmtMoney(k)} et taxes d’aéroport −15 % ce mois-ci.`; D.last[cc]={sub:k,tax:0}; }
  else if(tier<=0){ const k=Math.round(S.fleet.length*(tier<0?80e3:35e3)/1e4)*1e4; book('taxes',-k);
    txt=`🏛️ ${ccName(cc)} : le gouvernement vous reproche votre comportement — taxe spéciale de ${fmtMoney(k)}.${tier<0?' Des inspecteurs contrôlent vos avions.':''}`; D.last[cc]={sub:0,tax:k};
    if(tier<0) for(const ac of S.fleet.slice(0,3)) ac.condition=Math.max(0,ac.condition-2); }
  else D.last[cc]={sub:0,tax:0};
  if(txt){ devLog(cc,txt); logMsg(txt,tier===2?'ok':'warn'); }
  // lettre du président quand votre statut change
  const prev=D.tier[cc]; D.tier[cc]=tier;
  if(prev!==undefined&&prev!==tier&&typeof mailPush==='function'){ const [i,l,d]=DEV_TIER[tier];
    mailPush({code:'GOV'+cc,name:`Gouvernement — ${ccName(cc)}`,color:'#16a34a',ceo:`Président ${g.leader}`},'gov-info',`${i} Votre compagnie est désormais « ${l} »`,
      `Cher président-directeur général,<br>après examen de votre activité dans notre pays, votre compagnie est <b>${l.toLowerCase()}</b> par le gouvernement : ${d}.<br>Détails dans 🏢 Compagnie → 🏛️ Mon pays.<br>— Président ${esc(g.leader)}`,[{k:'ok',l:'Bien reçu'}],{cc}); }
}

/* ---------- affichage : 🏢 Compagnie → 🏛️ Mon pays ---------- */
function devHtml(){
  const ccs=devCountries(); if(!ccs.length) return '<div class="mut">Achetez un hub pour avoir un pays.</div>';
  const cc=ccs.includes(UI.devCc)?UI.devCc:(ccs.includes(homeCC())?homeCC():ccs[0]), D=devS(), g=typeof govOf==='function'?govOf(cc):{leader:'—',style:'reformateur'};
  const rel=D.rel[cc]===undefined?Math.round((55+devTarget(cc))/2):D.rel[cc], tier=devTier(rel), T=DEV_TIER[tier], F=devFactors(cc), target=devTarget(cc), last=D.last[cc];
  const served=devServed(cc), filt=UI.devF||'all';
  const towns=AIRPORT_CODES.filter(c=>AP(c).cc===cc&&AP(c).cls>=1).map(c=>({c,A:AP(c),p:typeof cityPop==='function'?cityPop(c):null,d:D.c[c]})).filter(x=>filt==='all'||(filt==='served'?served.has(x.c):!served.has(x.c)))
    .sort((a,b)=>(b.p||b.A.traffic*10)-(a.p||a.A.traffic*10)).slice(0,40);
  const hub=S.hubs.find(h=>AP(h).cc===cc)||S.hubs[0];
  return `<div class="simplehelp">💡 Vos vols font <b>grandir les villes</b> de ${esc(ccName(cc))} : chaque passager compte. Par paliers, la ville gagne des habitants et des voyageurs, puis l’État modernise sa piste et son terminal. Chaque mois, le <b>gouvernement</b> juge votre compagnie : bien vu, il vous verse une subvention ; mal vu, il vous taxe.</div>
  ${ccs.length>1?`<div class="chips">${ccs.map(c=>`<button class="chip ${c===cc?'on':''}" data-act="devCc" data-k="${c}">${COUNTRIES[c][2]} ${esc(ccName(c))}</button>`).join('')}</div>`:''}
  <div class="card"><div class="row"><div class="grow"><b>${COUNTRIES[cc][2]} Gouvernement du président ${esc(g.leader)}</b><br><span class="small mut">${typeof GOV_STYLES!=='undefined'?GOV_STYLES[g.style]||'':''}</span></div><div style="font-size:26px">${T[0]}</div></div>
    <div class="cond">Relation ${bar(rel/100,rel<20?'bad':rel<40?'warn':'')} <b>${rel}/100</b> · ${T[1]}</div>
    <div class="small mut">Effet : ${T[2]}. Tendance : ${target>rel+2?'📈 en hausse':target<rel-2?'📉 en baisse':'➡️ stable'} (vers ${target}). Le bilan est fait toutes les 4 semaines.${last?` Dernier bilan : ${last.sub?'subvention '+fmtMoney(last.sub):last.tax?'taxe '+fmtMoney(last.tax):'rien'}.`:''}</div></div>
  <h3>Ce que pense le gouvernement</h3>
  ${F.map(([i,l,pt,tip])=>`<div class="card row"><div class="grow">${i} <b>${l}</b>${pt<=0?`<br><span class="small mut">${tip}</span>`:''}</div><span class="badge ${pt>0?'ok':pt<0?'bad':''}">${pt>0?'+':''}${pt}</span></div>`).join('')}
  <h3>🏙️ Les villes de ${esc(ccName(cc))}</h3>
  <div class="chips">${[['all','Toutes'],['served',`Desservies (${served.size})`],['todo','Pas encore desservies']].map(([k,l])=>`<button class="chip ${filt===k?'on':''}" data-act="devF" data-k="${k}">${l}</button>`).join('')}</div>
  ${towns.map(({c,A,p,d})=>{ const lv=d?d.lvl:0, gr=d&&d.g>1?Math.round((d.g-1)*1000)/10:0, nx=DEV_LVL[lv];
    return `<div class="card row"><div class="grow"><b>${esc(A.city)}</b> <span class="mut small">${c}${devSmall(c)?' · petite ville':''}</span>${served.has(c)?' <span class="badge ok">desservie</span>':''}<br>
      <span class="small mut">${p?(typeof cityPopTxt==='function'?cityPopTxt(c):''):''}${gr?` · <span class="pos">+${String(gr).replace('.',',')} % grâce à vous</span>`:''} · piste ${num(A.runway)} m ${A.surface==='Latérite'?'(latérite)':''}</span><br>
      <span class="small">${'★'.repeat(lv)}${'☆'.repeat(DEV_LVL.length-lv)} ${lv?DEV_LVL[lv-1][1]:'pas encore de développement'}${nx?` · prochain palier : ${num(nx[0])} passagers (${num(d?d.pax:0)} transportés)`:''}</span></div>
      ${served.has(c)||c===hub?'':`<button class="btn sm gold" data-act="draftPair" data-a="${hub}" data-b="${c}">➕ Ligne</button>`}</div>`; }).join('')||'<div class="mut small">Aucune ville ici.</div>'}
  <h3>📜 Journal</h3>${D.log.filter(l=>l.cc===cc).slice(0,8).map(l=>`<div class="small"><span class="mut">${fmtDate(l.t)}</span> ${l.txt}</div>`).join('')||'<div class="mut small">Rien pour l’instant : le premier bilan arrive dans 4 semaines.</div>'}`;
}
function registerDevActions(){ Object.assign(ACTIONS,{ devCc:d=>{ UI.devCc=d.k; renderPanel(); }, devF:d=>{ UI.devF=d.k; renderPanel(); } }); }
{ const _w=weeklyTick; weeklyTick=function(){ const r=_w.apply(this,arguments); try{ devWeekly(); }catch(e){ console.warn('dev',e); } return r; }; }
