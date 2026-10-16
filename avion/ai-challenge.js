/* =========================================================
   Sky Empire — des rivales qui veulent vous détrôner
   Quand vous êtes en tête, les plus grosses compagnies du monde
   entrent en « mode offensif » : levées de fonds, commandes record,
   nouvelles lignes jusque sur votre hub, guerres des prix, rachats
   de petites compagnies. L'intensité se règle dans Plus → Options.
   ========================================================= */
'use strict';
const RIVAL_DRIVES=[['Calme',0],['Normale',1],['Féroce',2],['Impitoyable',3]];
const drive=()=>S.rivalDrive===undefined?3:S.rivalDrive;
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
    if(e.debt>=1||e.cash<0||(e.mavg||0)<-0.12||e.rep<25) continue;
    if(gap<=0) continue;                                                // déjà au niveau : plus d'offensive
    const heat=Math.min(1,gap/(0.12*target));                           // l'ardeur retombe quand l'écart se resserre
    // investissements pour combler l'écart : une part du retard chaque semaine (plafonnée pour rester crédible)
    const invest=Math.min(gap*0.0009*D, r.value*0.002*D);
    if(invest>0){ e.cash+=invest*0.4; e.fAcc=(e.fAcc||0)+invest*0.6/40e6; const n=Math.floor(e.fAcc); if(n>0){ e.fAcc-=n; e.fleet+=n; const R=(S.rivals||[]).find(x=>x.code===e.code); if(R) R.fleet=e.fleet; } }
    e.rep=clamp(e.rep+0.08*D,20,90); e.skill=clamp((e.skill||0)+0.0015*D,-0.6,0.6);
    // coup d'éclat 1 : commande record
    if(Math.random()<0.04*D*heat){ const n=Math.max(8,Math.round(e.fleet*rnd(0.03,0.08))), m=newModelFor(e); e.fleet+=n; e.cash-=n*rnd(3e6,6e6);
      aiNews(`🛒 Commande record : ${e.name} commande ${n} ${m.name.replace(/ \(occasion\)/,'')} pour ${tag}. Flotte : ${e.fleet} avions.`,'rival',true); }
    // coup d'éclat 2 : levée de fonds
    if(Math.random()<0.03*D*heat){ const k=Math.max(2e8,r.value*rnd(0.02,0.06)); e.cash+=k; aiNews(`💰 ${e.name} lève ${Md(k)} auprès d’investisseurs pour ${tag}.`,'rival',true); }
    // coup d'éclat 3 : nouvelle ligne jusque sur votre hub
    const mine=lead.me?(S.hubs.slice().sort((a,b)=>AP(b).traffic-AP(a).traffic)[0]||S.company.hub):lead.e&&lead.e.hub;   // le hub du n°1 mondial, quel qu'il soit
    if(mine&&(!lead.me||S.noCopy===false)&&aiAirportMarketOpen(mine)&&Math.random()<0.08*D*heat){ const cand=AIRPORT_CODES.filter(c=>c!==mine&&aiAirportMarketOpen(c)&&AP(c).cls>=2&&dist(e.hub,c)>400&&dist(c,mine)>400&&dist(c,mine)<(e.fleet>=100?9000:4000)&&!carriersOn(c,mine).includes(e.code)&&!airspaceViolation(e.code,c,mine));
      const setup=e.fleet<30?1.5e6:3.5e6;
      if(cand.length&&e.cash>=setup){ const c=cand.sort((x,y)=>marketDemand(e.hub,y)-marketDemand(e.hub,x))[0], key=pairKey(c,mine); e.cash-=setup; (ai.extra[e.code]=ai.extra[e.code]||[]).push(key); e.routes++; ai.ver++;
        const R=(S.rivals||[]).find(x=>x.code===e.code); if(R&&!R.routes.some(x=>pairKey(x.a,x.b)===key)) R.routes.push({a:c,b:mine,freq:3});
        aiNews(`🎯 ${e.name} attaque le hub du n°1 mondial (${lead.me?'vous':lead.name}) : nouvelle ligne ${keyCity(c)} → ${keyCity(mine)} (3 vols par jour).`,lead.me?'rival':'news',true); } }
    // coup d'éclat 4 : guerre des prix sur l'une de vos lignes
    if(Math.random()<0.06*D*heat&&!lead.me&&lead.e&&typeof raceWar==='function'){ raceWar(e,{...lead,rank:1},lead.e.cc); }
    else if(lead.me&&Math.random()<0.06*D*heat&&S.routes.length){ const rt=pick(S.routes), a=rt.stops[0], b=rt.stops[rt.stops.length-1], key=pairKey(a,b); ai.wars=ai.wars||{};
      if(!ai.wars[e.code+key]&&!(typeof isAlly==='function'&&isAlly(e.code))){ ai.wars[e.code+key]={code:e.code,a,b,until:S.time+rndi(14,35)*DAY,kind:'prix'};
        aiNews(`⚔️ ${e.name} brade ses billets sur ${keyCity(a)}–${keyCity(b)} : guerre des prix contre vous.`,'rival',true); } }
    // coup d'éclat 5 : plus de vols sur ses lignes existantes
    if(Math.random()<0.12*D*heat){ const R=(S.rivals||[]).find(x=>x.code===e.code); if(R&&R.routes.length){ const rt=pick(R.routes); if((rt.freq||1)<9){ rt.freq=(rt.freq||1)+1; ai.ver++; } } }
    const rival=(S.rivals||[]).find(x=>x.code===e.code); if(rival){ rival.fleet=e.fleet; rival.cash=e.cash; rival.rep=e.rep; rival.network=e.routes; }
  }
}
// outsiders : même les petites et moyennes compagnies tentent leur chance contre le leader
function aiOutsiders(){
  const ai=S.ai, D=drive(); if(!ai||D<2) return; const {lead,chals,me}=aiChallengers(), skip=new Set(chals.map(c=>c.code));
  const pool=aiAlive().filter(e=>e.fleet>=3&&e.fleet<=90&&e.status!=='dead'&&!skip.has(e.code)&&e.real!==undefined&&e.debt<2&&e.cash>e.fleet*2e6&&e.rep>=35&&(e.mavg===undefined||e.mavg>-0.12));
  const strength=e=>e.cash/Math.max(1,e.fleet)/1e6+e.rep*0.2+Math.min(40,e.routes)*0.1-(e.debt||0)*20;
  pool.sort((a,b)=>strength(b)-strength(a)||b.fleet-a.fleet||a.code.localeCompare(b.code));
  const n=Math.min(pool.length,D===2?2:4), tag='devenir n°1 de son pays';
  for(let k=0;k<n;k++){ const e=pool[k]; if(!e) break; e.ambition=Math.min(5,(e.ambition||0)+1);
    // croissance par paliers : location d'avions, petits financements
    if(Math.random()<0.28){ const add=Math.max(1,Math.round(e.fleet*rnd(0.04,0.1))); e.fleet+=add; e.cash-=add*rnd(3e6,6e6); const R=(S.rivals||[]).find(x=>x.code===e.code); if(R) R.fleet=e.fleet;
      if(add>=3) aiNews(`🐜 ${e.name} (petite compagnie) s’agrandit : ${add} avions de plus, ${e.fleet} au total. Objectif : ${tag}.`,'rival'); }
    if(Math.random()<0.18){ const k2=Math.max(2e6,e.fleet*rnd(0.15e6,0.45e6)); e.cash+=k2; if(e.fleet>=10) aiNews(`💸 ${e.name} lève ${Md(k2)} auprès d’investisseurs locaux pour grandir vite.`,'rival'); }
    if(Math.random()<0.30) aiRoute(e,'open');
    e.rep=clamp(e.rep+0.06*D,20,85);
    // les petits attaquent celle juste au-dessus d'eux dans leur pays (une IA ou vous, sans distinction)
    if(typeof raceTables==='function'&&Math.random()<0.15*(D-1)){ const rows=raceTables()[e.cc]||[], k=rows.findIndex(x=>x.code===e.code), tg=k>0?rows[k-1]:null;
      if(tg&&!(tg.me&&typeof isAlly==='function'&&isAlly(e.code))) (Math.random()<0.5?raceOpen:raceWar)(e,{...tg,rank:k},e.cc); }
    const rival=(S.rivals||[]).find(x=>x.code===e.code); if(rival){ rival.fleet=e.fleet; rival.cash=e.cash; rival.rep=e.rep; rival.network=e.routes; }
  }
}
// rachats : les plus grosses avalent de petites compagnies pour grossir d'un coup
function aiChallengeMonthly(){
  const ai=S.ai; if(!ai||!drive()) return; const D=drive(), {chals}=aiChallengers();
  if(ai.acquisitionMonth===monthKey(S.time)) return;
  for(const r of chals){ const e=r.e; if(e.debt>0||e.cash<e.fleet*8e6||(e.mavg||0)<-0.05||Math.random()>0.08*D) continue;
    const prey=aiAlive().filter(x=>x!==e&&x.fleet>=12&&x.fleet<=e.fleet*0.35&&dist(x.hub,e.hub)<9000&&!x.chal&&(x.debt>=1||(x.cash<x.fleet*3e6&&x.rep<45)||((x.mavg||0)<-0.18&&x.cash<x.fleet*8e6)));
    if(prey.length&&aiAcquireCompany(e,pick(prey),'rival')) break;
  }
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
