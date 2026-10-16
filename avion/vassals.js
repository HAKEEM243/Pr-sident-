/* =========================================================
   Sky Empire — 👑 compagnies vassales
   Quand vous détenez 51 % d'une compagnie, vous choisissez :
   • 👑 VASSALE : elle garde son nom, ses avions et ses lignes, l'IA la
     dirige, mais ses bénéfices vous reviennent chaque semaine (100 %,
     ou 50 % si vous la laissez réinvestir). Elle ne vous attaque jamais.
     Elle reste à vous tant que vous ne la vendez pas : les autres
     compagnies peuvent faire des offres de rachat, c'est vous qui
     décidez.
   • 🔗 INTÉGRÉE : ses avions, ses lignes et son hub deviennent les
     vôtres : vous dirigez les avions, en achetez, en vendez, ajoutez
     des lignes.
   Une vassale peut être intégrée plus tard. Tout est fictif.
   ========================================================= */
'use strict';
// bénéfice hebdomadaire d'une vassale : sur sa marge moyenne (lissée), aidée par votre gestion (+5 points)
const vassProfit=e=>Math.max(0,Math.round(e.fleet*0.45e6*((e.mavg===undefined?(e.lastMargin||0):e.mavg)+0.05)));
const vassOf=code=>S&&S.vassals&&S.vassals[code];
const vassAll=()=>Object.entries(S.vassals||{}).map(([code,v])=>({code,v,e:aiBy(code),R:(S.rivals||[]).find(x=>x.code===code)}));
function vassMake(code){
  const R=(S.rivals||[]).find(x=>x.code===code), e=aiBy(code); if(!R||!e) return 'Compagnie introuvable';
  if((S.stock.holdings[code]||0)<0.51-1e-9) return 'Il faut 51 % du capital';
  S.vassals=S.vassals||{}; S.vassals[code]={since:S.time, share:1, total:0, week:0};
  delete S.vassPending;
  if(S.truce) S.truce[code]=0; for(const k of Object.keys(S.ai.wars||{})) if(S.ai.wars[k].code===code) delete S.ai.wars[k];
  logMsg(`👑 ${R.name} devient votre vassale : elle continue de voler sous son nom, et ses bénéfices vous reviennent chaque semaine.`,'ok');
  aiNews(`👑 ${R.name} passe sous le contrôle de ${S.company.name} et devient sa compagnie vassale.`,'news',true);
  return null;
}
function vassIntegrate(code){
  const R=(S.rivals||[]).find(x=>x.code===code), e=aiBy(code); if(!R) return 'Compagnie introuvable';
  if((S.stock.holdings[code]||0)<0.51-1e-9) return 'Il faut 51 % du capital';
  if(S.vassals) delete S.vassals[code]; delete S.vassPending;
  S._vassInt=true; try{ absorbRival(R); } finally{ S._vassInt=false; }
  if(e){ e.status='dead'; e.deadAt=S.time; e.acquiredBy=S.company.code; e.deathWhy=`intégrée à ${S.company.name}`; if(S.ai.extra) delete S.ai.extra[code]; S.ai.ver++; }
  return null;
}
function vassRelease(code){ if(S.vassals) delete S.vassals[code]; }
// chaque semaine : les bénéfices de vos vassales vous sont versés
function vassWeekly(){
  let tot=0; const names=[];
  for(const {code,v,e,R} of vassAll()){
    if(!e||e.status==='dead'){ delete S.vassals[code]; logMsg(`💥 Votre vassale ${R?R.name:code} a disparu.`,'bad'); continue; }
    if((S.stock.holdings[code]||0)<0.51-1e-9){ delete S.vassals[code]; logMsg(`👑 ${e.name} n’est plus votre vassale (participation sous 51 %).`,'warn'); continue; }
    e.skill=Math.min(0.3,(e.skill||0)+0.002); const prof=vassProfit(e), pay=Math.round(prof*(v.share||1));
    v.week=pay; if(pay>0){ e.cash-=pay; v.total+=pay; tot+=pay; names.push(e.name); }
    // une vassale reste en bonne santé : elle n'est jamais laissée à sec
    if(e.cash<e.fleet*2e6) e.cash+=e.fleet*1e6;
  }
  if(tot>0){ book('participations',tot); logMsg(`👑 Vos vassales vous versent ${fmtMoney(tot)} cette semaine (${names.slice(0,3).join(', ')}${names.length>3?'…':''}).`,'ok'); }
}
// de temps en temps, une autre compagnie veut racheter votre vassale : c'est vous qui décidez
function vassOffers(){
  const L=vassAll().filter(x=>x.e&&x.R); if(!L.length||Math.random()>0.25||typeof mailPush!=='function') return;
  const {code,e,R}=pick(L); if((S.inbox||[]).some(m=>m.kind==='vassBuy'&&m.code2===code&&m.st==='new')) return;
  const buyers=aiAlive().filter(x=>x.code!==code&&!vassOf(x.code)&&x.cash>rivalValue(R)*0.6&&x.fleet>=e.fleet); if(!buyers.length) return;
  const b=pick(buyers), stake=S.stock.holdings[code]||0.51, price=Math.round(stake*rivalValue(R)*rnd(1.2,1.6)/1e5)*1e5;
  mailPush(b,'vassBuy',`Offre pour votre vassale ${R.name}`,`${esc(b.name)} souhaite racheter vos <b>${Math.round(stake*100)} %</b> de <b>${esc(R.name)}</b> pour <b>${fmtMoney(price)}</b>.<br>Si vous acceptez, la compagnie ne vous versera plus ses bénéfices (${fmtMoney((S.vassals[code]||{}).week||0)} la semaine dernière).`,
    [{k:'ok',l:`💰 Vendre ${fmtMoney(price)}`},{k:'no',l:'👑 Garder ma vassale'}],{code2:code,price,buyer:b.code});
}
function vassHook(){ if(vassHook.done) return; vassHook.done=true;
  // à 51 % : on choisit vassale ou intégration (au lieu d'une intégration automatique)
  { const _ab=absorbRival; absorbRival=function(R){ if(S._vassInt||!aiBy(R.code)) return _ab(R);
      S.vassPending=R.code; setTimeout(()=>{ try{ showModal('👑 Vous contrôlez '+esc(R.name), vassChoiceHtml(R.code), true); }catch(e){} },50); }; }
  { const _ap=aiPeace; aiPeace=function(code){ return !!vassOf(code)||_ap(code); }; }
  { const _aq=aiAcquireCompany; aiAcquireCompany=function(buyer,target,kind){ if(target&&vassOf(target.code)) return false; return _aq(buyer,target,kind); }; }
  { const _aw=aiWeekly; aiWeekly=function(){ const wk=S.ai&&S.ai.lastWeek; _aw(); try{ if(S.ai&&S.ai.lastWeek!==wk){ vassWeekly(); vassOffers(); } }catch(e){ console.warn(e); } }; }
  { const _ma=mailAnswer; mailAnswer=function(id,k){ const m=(S.inbox||[]).find(x=>x.id===id); if(!m||m.kind!=='vassBuy'||m.st!=='new') return _ma(id,k);
      const R=(S.rivals||[]).find(x=>x.code===m.code2), e=aiBy(m.code2), b=aiBy(m.buyer);
      if(k==='ok'&&R&&e){ const stake=S.stock.holdings[m.code2]||0; book('participations',m.price); delete S.stock.holdings[m.code2]; vassRelease(m.code2);
        if(b&&b.status!=='dead'){ b.cash+=rivalValue(R); try{ aiAcquireCompany(b,e,'merger'); }catch(x){} }
        m.res=`💰 ${R.name} vendue ${fmtMoney(m.price)} à ${b?b.name:'un acheteur'}.`; }
      else m.res=`👑 Vous gardez ${R?R.name:'votre vassale'}.`;
      m.st='done'; logMsg(m.res,'ok'); renderMailBadge(); if(UI.modal==='inbox') openM('inbox'); if(typeof renderPanel==='function') renderPanel(); }; }
  // bourse : badge vassale, choix et réglages
  if(typeof pBourse==='function'){ const _pb=pBourse; pBourse=function(){ let h=_pb(); const L=vassAll().filter(x=>x.R);
      const pend=S.vassPending&&(S.rivals||[]).find(x=>x.code===S.vassPending)&&!vassOf(S.vassPending);
      const card=`<h3>👑 Vos compagnies vassales</h3>${pend?`<div class="al warn">Vous contrôlez <b>${esc(S.rivals.find(x=>x.code===S.vassPending).name)}</b> : choisissez son sort. <button class="btn sm gold" data-act="vassChoose" data-c="${S.vassPending}">Choisir</button></div>`:''}
        ${L.length?L.map(({code,v,e,R})=>`<div class="card rivalcard"><div class="row"><span class="dot" style="background:${R.color}"></span><div class="grow"><b>${esc(R.name)}</b> <span class="badge ok">👑 vassale</span><br><span class="small mut">${flag(R.hub)} ${esc(AP(R.hub).city)} · ${e?e.fleet:R.fleet} avions · ${e?e.routes:R.routes.length} lignes</span></div>
          <div class="right"><b class="pos">${fmtMoney(v.week||0)}</b><br><span class="small mut">la semaine dernière</span></div></div>
          <div class="small">Total versé depuis le ${fmtDate(v.since)} : <b>${fmtMoney(v.total||0)}</b> · vous prenez <b>${Math.round((v.share||1)*100)} %</b> de ses bénéfices${(v.share||1)<1?' (le reste est réinvesti : elle grandit plus vite)':''}</div>
          <div class="btns sm"><button class="btn sm" data-act="vassShare" data-c="${code}">${(v.share||1)<1?'💰 Tout encaisser (100 %)':'🌱 Laisser réinvestir (50 %)'}</button><button class="btn sm gold" data-act="vassInt" data-c="${code}">🔗 Intégrer : diriger ses avions</button></div></div>`).join(''):'<div class="small mut">Aucune vassale. Achetez 51 % d’une compagnie ci-dessous pour en faire votre vassale ou l’intégrer.</div>'}`;
      return h.replace('<h3>Marché des compagnies</h3>',card+'<h3>Marché des compagnies</h3>'); }; }
  Object.assign(ACTIONS,{
    vassChoose:d=>showModal('👑 Vous contrôlez '+esc((S.rivals.find(x=>x.code===d.c)||{name:''}).name), vassChoiceHtml(d.c), true),
    vassMake:d=>{ const e=vassMake(d.c); if(e) return toast(e,'bad'); closeModal(); toast('👑 Nouvelle vassale','ok'); if(typeof renderPanel==='function') renderPanel(); },
    vassInt:d=>{ if(!confirm('Intégrer cette compagnie ? Ses avions et ses lignes deviennent les vôtres (vous les dirigez). Elle ne vous versera plus ses bénéfices automatiquement.')) return; const e=vassIntegrate(d.c); if(e) return toast(e,'bad'); closeModal(); if(typeof renderPanel==='function') renderPanel(); if(typeof renderTop==='function') renderTop(); },
    vassShare:d=>{ const v=vassOf(d.c); if(!v) return; v.share=(v.share||1)<1?1:0.5; if(typeof renderPanel==='function') renderPanel(); },
  });
}
function vassChoiceHtml(code){ const R=(S.rivals||[]).find(x=>x.code===code), e=aiBy(code); if(!R) return '';
  const wk=e?vassProfit(e):0;
  return `<p>Vous détenez <b>${Math.round((S.stock.holdings[code]||0)*100)} %</b> de <b>${esc(R.name)}</b> (${e?e.fleet:R.fleet} avions, ${e?e.routes:R.routes.length} lignes, hub ${esc(AP(R.hub).city)}). Que voulez-vous en faire ?</p>
    <div class="card"><b>👑 En faire votre vassale</b><div class="small">Elle garde son nom, sa couleur, ses avions et ses lignes, et continue de voler seule. <b>Tous ses bénéfices vous sont versés chaque semaine</b> (estimation actuelle : ≈ ${fmtMoney(wk)} par semaine ; rien les semaines où elle perd de l’argent). Elle ne vous attaque jamais et reste à vous tant que vous ne la vendez pas.</div><button class="btn gold" data-act="vassMake" data-c="${code}">👑 Vassale</button></div>
    <div class="card"><b>🔗 L’intégrer à votre compagnie</b><div class="small">Son hub, ses lignes et ses avions deviennent les vôtres : vous dirigez les avions, vous en achetez, en vendez, vous ajoutez des lignes.</div><button class="btn" data-act="vassInt" data-c="${code}">🔗 Intégrer</button></div>`; }
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ vassHook(); }catch(e){ console.warn(e); } },0));
