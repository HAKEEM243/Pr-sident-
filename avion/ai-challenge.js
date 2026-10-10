/* =========================================================
   Sky Empire — des rivales qui veulent vous détrôner
   Quand vous êtes en tête, les plus grosses compagnies du monde
   entrent en « mode offensif » : levées de fonds, commandes record,
   nouvelles lignes jusque sur votre hub, guerres des prix, rachats
   de petites compagnies. L'intensité se règle dans Plus → Options.
   ========================================================= */
'use strict';
const RIVAL_DRIVES=[['Calme',0],['Normale',1],['Féroce',2],['Impitoyable',3]];
const drive=()=>S.rivalDrive===undefined?2:S.rivalDrive;
const Md=v=>fmtMoney(v);
const newModelFor=e=>{ for(let i=0;i<12;i++){ const m=modelFor(e); if(!/occasion/.test(m.name)&&m.price>=40) return m; } return modelFor(e); };
function aiChallengers(){
  const rows=aiRows(), me=rows.find(r=>r.me), lead=rows[0];
  const cands=rows.filter(r=>!r.me&&r.e&&r.e.fleet>=40);
  // en tête : les 3 plus fortes se mobilisent contre vous ; sinon les 3 qui sont derrière le leader
  const chals=(lead.me? cands.slice(0,3) : cands.filter(r=>r!==lead&&r.value<lead.value*1.02).slice(0,3));
  return {rows,me,lead,chals};
}
function aiChallenge(){
  const ai=S.ai; if(!ai||!drive()) return; const D=drive(), {me,chals,lead}=aiChallengers(); if(!chals.length) return;
  const V=me.value, myName=S.company.name;
  const target=(lead.me?V:lead.value)*1.02;
  for(const r of chals){ const e=r.e, gap=Math.max(0,target-r.value), tag=lead.me?`détrôner ${myName}`:`rattraper ${lead.name}`;
    e.chal=true;
    if(gap<=0) continue;                                                // déjà au niveau : plus d'offensive
    const heat=Math.min(1,gap/(0.12*target));                           // l'ardeur retombe quand l'écart se resserre
    // investissements pour combler l'écart : une part du retard chaque semaine (plafonnée pour rester crédible)
    const invest=Math.min(gap*0.003*D, r.value*0.012*D);
    if(invest>0){ e.cash+=invest*0.4; e.fAcc=(e.fAcc||0)+invest*0.6/40e6; const n=Math.floor(e.fAcc); if(n>0){ e.fAcc-=n; e.fleet+=n; const R=(S.rivals||[]).find(x=>x.code===e.code); if(R) R.fleet=e.fleet; } }
    e.rep=clamp(e.rep+0.25*D,20,90); e.skill=clamp((e.skill||0)+0.004*D,-0.6,0.6);
    // coup d'éclat 1 : commande record
    if(Math.random()<0.04*D*heat){ const n=Math.max(8,Math.round(e.fleet*rnd(0.03,0.08))), m=newModelFor(e); e.fleet+=n; e.cash-=n*rnd(3e6,6e6);
      aiNews(`🛒 Commande record : ${e.name} commande ${n} ${m.name.replace(/ \(occasion\)/,'')} pour ${tag}. Flotte : ${e.fleet} avions.`,'rival',true); }
    // coup d'éclat 2 : levée de fonds
    if(Math.random()<0.03*D*heat){ const k=Math.max(2e8,r.value*rnd(0.02,0.06)); e.cash+=k; aiNews(`💰 ${e.name} lève ${Md(k)} auprès d’investisseurs pour ${tag}.`,'rival',true); }
    // coup d'éclat 3 : nouvelle ligne jusque sur votre hub
    if(Math.random()<0.08*D*heat){ const mine=S.hubs[0]||S.company.hub, cand=AIRPORT_CODES.filter(c=>c!==mine&&AP(c).cls>=2&&dist(e.hub,c)>400&&dist(c,mine)>400&&dist(c,mine)<(e.fleet>=100?9000:4000)&&!carriersOn(c,mine).includes(e.code));
      if(cand.length){ const c=pick(cand), key=pairKey(c,mine); (ai.extra[e.code]=ai.extra[e.code]||[]).push(key); e.routes++; ai.ver++;
        const R=(S.rivals||[]).find(x=>x.code===e.code); if(R&&!R.routes.some(x=>pairKey(x.a,x.b)===key)) R.routes.push({a:c,b:mine,freq:3});
        aiNews(`🎯 ${e.name} attaque votre hub : nouvelle ligne ${keyCity(c)} → ${keyCity(mine)} (3 vols par jour).`,'rival',true); } }
    // coup d'éclat 4 : guerre des prix sur l'une de vos lignes
    if(Math.random()<0.06*D*heat&&S.routes.length){ const rt=pick(S.routes), a=rt.stops[0], b=rt.stops[rt.stops.length-1], key=pairKey(a,b); ai.wars=ai.wars||{};
      if(!ai.wars[e.code+key]&&!(typeof isAlly==='function'&&isAlly(e.code))){ ai.wars[e.code+key]={code:e.code,a,b,until:S.time+rndi(14,35)*DAY,kind:'prix'};
        aiNews(`⚔️ ${e.name} brade ses billets sur ${keyCity(a)}–${keyCity(b)} : guerre des prix contre vous.`,'rival',true); } }
    // coup d'éclat 5 : plus de vols sur ses lignes existantes
    if(Math.random()<0.12*D*heat){ const R=(S.rivals||[]).find(x=>x.code===e.code); if(R&&R.routes.length){ const rt=pick(R.routes); if((rt.freq||1)<9){ rt.freq=(rt.freq||1)+1; ai.ver++; } } }
  }
}
// outsiders : même les petites et moyennes compagnies tentent leur chance contre le leader
function aiOutsiders(){
  const ai=S.ai, D=drive(); if(!ai||D<2) return; const {lead,chals,me}=aiChallengers(), skip=new Set(chals.map(c=>c.code));
  const pool=aiAlive().filter(e=>e.fleet>=3&&e.fleet<=90&&e.status!=='dead'&&!skip.has(e.code)&&e.real!==undefined);
  const n=Math.min(pool.length,D===2?3:6), myName=S.company.name, tag=lead.me?`dépasser ${myName}`:`défier ${lead.name}`;
  for(let k=0;k<n;k++){ const e=pool[Math.floor(Math.random()*pool.length)]; e.ambition=Math.min(5,(e.ambition||0)+1);
    // croissance par paliers : location d'avions, petits financements
    if(Math.random()<0.35){ const add=Math.max(1,Math.round(e.fleet*rnd(0.04,0.1))); e.fleet+=add; e.cash-=add*rnd(1e6,3e6); e.cash+=add*rnd(2e6,5e6)*0.5; const R=(S.rivals||[]).find(x=>x.code===e.code); if(R) R.fleet=e.fleet;
      if(add>=3) aiNews(`🐜 ${e.name} (petite compagnie) s’agrandit : ${add} avions de plus, ${e.fleet} au total. Objectif : ${tag}.`,'rival'); }
    if(Math.random()<0.25){ const k2=Math.max(2e7,e.fleet*rnd(2e6,6e6)); e.cash+=k2; if(e.fleet>=10) aiNews(`💸 ${e.name} lève ${Md(k2)} auprès d’investisseurs locaux pour grandir vite.`,'rival'); }
    if(Math.random()<0.30) aiRoute(e,'open');
    e.rep=clamp(e.rep+0.3*D,20,85);
    // attaque d'un petit sur votre hub
    if(Math.random()<0.10*(D-1)&&S.hubs.length){ const mine=pick(S.hubs), cand=AIRPORT_CODES.filter(c=>c!==mine&&AP(c).cls>=2&&dist(e.hub,c)<(e.fleet>=20?5000:2500)&&dist(c,mine)>300&&dist(c,mine)<(e.fleet>=20?5000:2500)&&!carriersOn(c,mine).includes(e.code));
      if(cand.length){ const c=pick(cand), key=pairKey(c,mine); (ai.extra[e.code]=ai.extra[e.code]||[]).push(key); e.routes++; ai.ver++;
        const R=(S.rivals||[]).find(x=>x.code===e.code); if(R&&!R.routes.some(x=>pairKey(x.a,x.b)===key)) R.routes.push({a:c,b:mine,freq:2});
        aiNews(`🐜 David contre Goliath : ${e.name} ouvre ${keyCity(c)} → ${keyCity(mine)} et s’attaque à votre hub.`,'rival',true); } }
    // petite guerre des prix
    if(Math.random()<0.05*(D-1)&&S.routes.length){ const rt=pick(S.routes), a=rt.stops[0], b=rt.stops[rt.stops.length-1], key=pairKey(a,b); ai.wars=ai.wars||{};
      if(!ai.wars[e.code+key]&&!(typeof isAlly==='function'&&isAlly(e.code))){ ai.wars[e.code+key]={code:e.code,a,b,until:S.time+rndi(10,25)*DAY,kind:'prix'}; aiNews(`⚔️ ${e.name} casse ses prix sur ${keyCity(a)}–${keyCity(b)} pour vous prendre des clients.`,'rival',true); } }
  }
}
// rachats : les plus grosses avalent de petites compagnies pour grossir d'un coup
function aiChallengeMonthly(){
  const ai=S.ai; if(!ai||!drive()) return; const D=drive(), {chals}=aiChallengers();
  for(const r of chals){ const e=r.e; if(Math.random()>0.12*D) continue;
    const prey=aiAlive().filter(x=>x!==e&&x.fleet>=12&&x.fleet<=e.fleet*0.35&&dist(x.hub,e.hub)<9000&&!x.chal); if(!prey.length) continue;
    const w=pick(prey), price=w.fleet*rnd(6e6,12e6); e.cash-=price; e.fleet+=Math.round(w.fleet*0.8); e.routes+=Math.round(w.routes*0.6); w.status='dead'; w.deadAt=S.time; ai.ver++;
    if(S.rivals) S.rivals=S.rivals.filter(R=>R.code!==w.code);
    const R=(S.rivals||[]).find(x=>x.code===e.code); if(R) R.fleet=e.fleet;
    aiNews(`🏴‍☠️ ${e.name} rachète ${w.name} pour ${Md(price)} : flotte portée à ${e.fleet} avions.`,'rival',true); }
}
{ const _aw=aiWeekly; aiWeekly=function(){ _aw(); try{ aiChallenge(); aiOutsiders(); }catch(e){ console.warn(e); } }; }
{ const _am=aiMonthly; aiMonthly=function(){ _am(); try{ aiChallengeMonthly(); }catch(e){ console.warn(e); } }; }

/* ---------- carte « Rivalité » dans le classement ---------- */
function challengerCard(){
  if(!S.ai) return ''; const {me,chals,lead}=aiChallengers(), D=drive();
  const bar=(r)=>{ const pc=Math.min(100,Math.round(r.value/Math.max(1,me.value)*100)); return `<div class="small" style="margin:6px 0"><span class="dot" style="background:${r.color}"></span><b>${esc(r.name)}</b> · ${num(r.e.fleet)} avions · ${Md(r.value)}<div class="pbar-row"><span class="pb"><i style="width:${pc}%;background:${r.value>=me.value?'var(--bad,#ef4444)':'var(--gold)'}"></i></span><b>${pc} %</b></div></div>`; };
  return `<div class="card"><h3 style="margin-top:0">⚔️ Rivalité · ${RIVAL_DRIVES.find(x=>x[1]===D)[0]}</h3>
    ${lead.me?`<div class="small">👑 Vous êtes <b>premier</b> (${Md(me.value)}). Les challengers se mobilisent pour vous détrôner :</div>`:`<div class="small">Vous êtes <b>${me.rank}ᵉ</b>. Le leader : <b>${esc(lead.name)}</b> (${Md(lead.value)}).</div>`}
    ${chals.map(bar).join('')||'<div class="mut small">Aucun challenger actif.</div>'}
    <div class="small mut" style="margin-top:6px">Niveau de rivalité (touchez pour changer) :</div>
    <div class="btns">${RIVAL_DRIVES.map(([l,v])=>`<button class="btn sm ${D===v?'gold':''}" data-act="rivalDrive" data-k="${v}">${l}</button>`).join('')}</div>
    <div class="small mut">${D>=2?'Même les petites compagnies tentent de vous dépasser. ':''}Barre = valeur de la compagnie par rapport à la vôtre.</div></div>`;
}
function registerChallengeActions(){ Object.assign(ACTIONS,{ rivalDrive:d=>{ S.rivalDrive=+d.k; toast('⚔️ Rivalité : '+RIVAL_DRIVES.find(x=>x[1]===S.rivalDrive)[0],'info'); if(typeof renderPanel==='function') renderPanel(); } }); }
