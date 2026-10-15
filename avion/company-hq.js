/* =========================================================
   Sky Empire — 🏢 Ma compagnie (le siège)
   Tout ce qui concerne la compagnie est rangé au même endroit,
   en sous-onglets, chacun avec son explication :
   Résumé · Améliorer (service, VIP, aéroports) · Clients ·
   Concurrents (compagnies IA) · Espace aérien · Partenaires · Réglages
   ========================================================= */
'use strict';
const CO_TABS=[['home','🏢','Résumé'],['up','✨','Améliorer'],['pax','👥','Clients'],['crew','👨‍✈️','Équipages'],['land','🏛️','Mon pays'],['trans','🚚','Transport'],['rivals','⚔️','Concurrents'],['air','🛂','Espace aérien'],['deals','🤝','Partenaires'],['set','⚙️','Réglages']];
const coHelp=(t)=>`<div class="simplehelp">💡 ${t}</div>`;
const coSeen=k=>{ S.seen=S.seen||{}; if(!S.seen[k]){ S.seen[k]=1; setTimeout(()=>{ try{ renderGuide(); }catch(e){} },0); } };

function pCompany(){
  const t=CO_TABS.some(x=>x[0]===UI.coTab)?UI.coTab:'home'; coSeen('co'); coSeen(t);
  const bar=`<div class="chips cotabs">${CO_TABS.map(([k,i,l])=>`<button class="chip ${k===t?'on':''}" data-act="coTab" data-k="${k}">${i} ${l}</button>`).join('')}</div>`;
  const fn={trans:()=>typeof trHtml==='function'?trHtml():'', land:()=>typeof devHtml==='function'?devHtml():'', crew:coCrew, home:coHome, up:coUpgrade, pax:coClients, rivals:coRivals, air:coAirspace, deals:coDeals, set:coSettings}[t];
  return bar+fn();
}

/* ---------- 🏢 Résumé ---------- */
function coReviewAvg(){ const L=S.reviews||[]; return L.length? L.reduce((s,x)=>s+x.stars,0)/L.length : null; }
function coLoadFactor(){ let p=0,se=0; for(const r of S.routes){ p+=r.stats.pax; se+=r.stats.seats; } return se? p/se : null; }
function coLounges(){ return S.hubs.filter(h=>AP(h).lounge); }
function coTodo(){
  const out=[], sat=satisfaction(), open=(S.inbox||[]).filter(m=>m.st==='new'&&m.kind&&m.kind.startsWith('pax')).length;
  if(!S.routes.length) out.push(['🧭','Ouvrez une première ligne','Sans ligne, aucun client ne voyage.','openLine','']);
  if(open) out.push(['📬',`${open} client(s) attendent une réponse`,'Un client bien traité améliore l’image de la compagnie.','coGo','pax']);
  if(sat<55) out.push(['⭐','Vos clients sont peu satisfaits','Montez le service à bord ou réduisez les retards.','coGo','up']);
  const noLounge=S.hubs.filter(h=>UPGRADES.lounge.can(AP(h)));
  if(noLounge.length&&S.cash>UPGRADES.lounge.cost(AP(noLounge[0]))*2) out.push(['🥂',`Construisez un salon VIP à ${AP(noLounge[0]).city}`,'Plus de passagers en Affaires et en Première.','coGo','up']);
  if(!S.loyalty&&S.cash>9e6) out.push(['💳','Lancez votre programme de fidélité','+6 % d’attractivité sur tout le réseau.','coGo','up']);
  if(typeof crewEligible==='function'){ const el=S.pilots.filter(p=>crewInit(p)&&crewEligible(p)).length, rk=S.pilots.filter(p=>crewRisk(p)).length;
    if(el>=3) out.push(['🎖️',`${el} pilotes attendent une promotion`,'Une promotion qui tarde fait baisser leur moral.','coGo','crew']);
    if(rk>=3) out.push(['🚪',`${rk} pilotes risquent de partir`,'Les concurrents débauchent les pilotes mécontents.','coGo','crew']); }
  if(typeof devTier==='function'&&S.dev&&S.dev.rel){ const cc=homeCC(), r=S.dev.rel[cc]; if(r!==undefined&&r<40) out.push(['🏛️','Le gouvernement vous voit d’un mauvais œil','Taxe spéciale chaque mois : voyez comment regagner sa confiance.','coGo','land']); }
  if(typeof TR_MODES!=='undefined'&&!(S.tr&&(S.tr.truck.on||S.tr.boat.on||(S.tr.train&&S.tr.train.on)))&&S.cash>40e6&&S.fleet.length>=4) out.push(['🚚','Créez une filiale de transport','Camions, bateaux ou trains : du fret dans tout le Congo, en plus de vos avions.','coGo','trans']);
  const thr=coThreats(); if(thr.size) out.push(['⚔️',`${thr.size} compagnie(s) vous concurrencent sur vos lignes`,'Voyez qui, et comment répondre.','coGo','rivals']);
  return out.slice(0,4);
}
function coHome(){
  const c=S.company, sat=satisfaction(), avg=coReviewAvg(), lf=coLoadFactor(), rows=typeof aiRows==='function'?aiRows():[], me=rows.find(r=>r.me);
  const kpi=(l,v,cls='')=>`<div class="kpi"><div class="kl">${l}</div><div class="kv ${cls}">${v}</div></div>`;
  const todo=coTodo();
  return `<div class="hero"><div class="biglogo" style="background:${c.color}">${esc(c.logo)}</div><div class="grow"><h2>${esc(c.name)} <span class="mut">${esc(c.code)}</span></h2><div>${stars(S.reputation)} <span class="small mut">image ${Math.round(S.reputation)}/100</span></div>
    <div class="small mut">Hubs : ${S.hubs.map(h=>`${flag(h)} ${esc(AP(h).city)}`).join(' · ')}${me?` · ${me.rank}ᵉ compagnie mondiale`:''}</div></div></div>
  ${coHelp('Ici se trouve tout ce qui concerne votre compagnie. Chaque sous-onglet explique ce qu’il fait : <b>Améliorer</b> (service, VIP, terminaux), <b>Clients</b> (avis, réclamations), <b>Concurrents</b> (compagnies du jeu), <b>Espace aérien</b> (qui peut survoler votre pays).')}
  <div class="kpis">${kpi('Satisfaction',Math.round(sat)+' %',sat<50?'neg':sat>70?'pos':'')}${kpi('Note des clients',avg==null?'—':avg.toFixed(1).replace('.',',')+' ★')}${kpi('Ponctualité',Math.round(punctuality()*100)+' %')}${kpi('Remplissage',lf==null?'—':Math.round(lf*100)+' %')}${kpi('Service à bord','★'.repeat(S.service))}${kpi('Avions / lignes',`${S.fleet.length} / ${S.routes.length}`)}</div>
  <h3>✅ Ce qui fait venir vos clients</h3>
  <div class="card">${[
      [S.service>=4,`Service à bord ${'★'.repeat(S.service)}`,'×'+SERVICE_ATTR[S.service-1]+' d’attractivité','up'],
      [!!S.loyalty,'Programme de fidélité','+6 % sur tout le réseau','up'],
      [coLounges().length>0,`Salons VIP (${coLounges().length}/${S.hubs.length} hubs)`,'Affaires et Première +25 % depuis ce hub','up'],
      [!!S.alliance,'Alliance internationale','plus de voyageurs internationaux','deals'],
      [(S.campaigns||[]).some(x=>x.until>S.time),'Campagne de publicité en cours','demande en hausse pendant la campagne','deals'],
      [ancillaryPenalty()>0.985,'Peu d’options payantes','chaque option payante rend la compagnie un peu moins attirante','up'],
    ].map(([ok,l,d,go])=>`<div class="row" style="padding:3px 0">${ok?'✅':'⬜'} <span class="grow"><b>${l}</b> <span class="small mut">${d}</span></span>${ok?'':`<button class="btn sm" data-act="coGo" data-k="${go}">Améliorer</button>`}</div>`).join('')}</div>
  <h3>🎯 À faire maintenant</h3>
  ${todo.length?todo.map(([i,t,d,a,k])=>`<div class="card row"><div class="grow">${i} <b>${t}</b><br><span class="small mut">${d}</span></div><button class="btn sm gold" data-act="${a}" data-k="${k}">Y aller</button></div>`).join(''):'<div class="al ok">Tout va bien : continuez à ouvrir des lignes et à agrandir la flotte.</div>'}`;
}

/* ---------- ✨ Améliorer ---------- */
function coUpgrade(){
  const a=S.ancillary;
  return `${coHelp('Trois façons d’améliorer la compagnie : <b>1. le service à bord</b> (les passagers paient plus volontiers), <b>2. le programme VIP</b> (fidélité et salons pour la clientèle Affaires), <b>3. vos aéroports</b> (terminaux, pistes : plus de voyageurs et de plus gros avions). Tout est immédiat.')}
  <h3>1. 🍽️ Service à bord</h3>
  <div class="chips">${[1,2,3,4,5].map(n=>`<button class="chip ${S.service===n?'on':''}" data-act="service" data-n="${n}">${'★'.repeat(n)}</button>`).join('')}</div>
  <div class="small mut">Actuel : coût ${fmtMoney(SERVICE_COST[S.service-1])} par passager et par heure de vol · attractivité ×${SERVICE_ATTR[S.service-1]}. À partir de 4★, les repas sont offerts. Les clients Affaires et Première y sont encore plus sensibles.</div>
  <div class="small" style="margin:8px 0 2px"><b>Options payantes</b> <span class="mut">(rapportent de l’argent, mais rendent la compagnie un peu moins attirante : ×${ancillaryPenalty().toFixed(3)})</span></div>
  ${[['seat','Choix du siège','6 $, 30 % des passagers'],['bags','Bagage en soute','25 $, 35 % des passagers'],['wifi','Wi-Fi à bord','9 $, vols de plus de 1 h 30'],['meals','Repas payants','11 $, sans effet si service ≥ 4★']].map(([k,l,d])=>`<label class="tog"><input type="checkbox" data-in="anc" data-k="${k}" ${a[k]?'checked':''}> <b>${l}</b> <span class="mut small">${d}</span></label>`).join('')}
  ${typeof paxPolicyHtml==='function'?paxPolicyHtml():''}
  <h3>2. 👑 Programme VIP</h3>
  <div class="card row ${S.loyalty?'gold-b':''}"><div class="grow">💳 <b>Programme de fidélité « ${esc(S.company.name)} Miles »</b><br><span class="small mut">Les clients fidèles reviennent : attractivité +6 % sur tout le réseau, image +3. Les passagers « ⭐ Fidèles » apparaissent dans la liste des passagers de chaque vol.</span></div>${S.loyalty?'<span class="badge ok">Actif</span>':`<button class="btn sm gold" data-act="coLoyalty">Lancer · 3 M$</button>`}</div>
  ${S.hubs.map(h=>{ const A=AP(h), done=A.lounge, can=UPGRADES.lounge.can(A); return `<div class="card row ${done?'gold-b':''}"><div class="grow">🥂 <b>Salon VIP de ${esc(A.city)}</b><br><span class="small mut">Demande Affaires et Première +25 % sur toutes vos lignes au départ de ce hub.</span></div>${done?'<span class="badge ok">Ouvert</span>':can?`<button class="btn sm gold" data-act="project" data-c="${h}" data-k="lounge">Construire · ${fmtMoney(UPGRADES.lounge.cost(A))}</button>`:'<span class="small mut">—</span>'}</div>`; }).join('')}
  <h3>3. 🏗️ Vos aéroports et terminaux</h3>
  <div class="small mut">Pour chaque hub : les 7 étapes d’agrandissement (T1 agrandi → jetée → 2ᵉ piste → T2 → ville aéroportuaire → T3 → T4), puis les équipements. Chaque étape apporte plus de voyageurs et se voit en 2D et en 3D.</div>
  ${S.hubs.map(coHubCard).join('')}
  <div class="btns"><button class="btn" data-act="xpOpen">🏗️ Agrandir d’autres aéroports de mes pays</button></div>`;
}
function coHubCard(h){
  const A=AP(h), lv=A.xp||0, nx=typeof XP_STEPS!=='undefined'?XP_STEPS[lv]:null, N=typeof XPN!=='undefined'?XPN:7, U=UPGRADES;
  const term=typeof apTerminals==='function'?apTerminals(h).map(t=>t.n).join(' · '):'T1';
  const extras=['ground','pave','extend','ils','mbase','fuel','terminal'].filter(k=>U[k]&&U[k].can(A));
  const done=['ground','ils','mbase','fuel','terminal','lounge'].filter(k=>({ground:A.groundOps,ils:A.ils,mbase:A.mbase,fuel:A.fuelDepot,terminal:A.terminal,lounge:A.lounge})[k]);
  return `<div class="card"><div class="row"><b class="grow">${flag(h)} ${esc(A.city)} <span class="mut">${h}</span></b><span class="small mut">${term} · classe ${A.cls}${A.rw2?' · 2 pistes':''}</span></div>
    <div class="small">${'▰'.repeat(lv)}${'▱'.repeat(Math.max(0,N-lv))} étape ${lv}/${N} · ${A.traffic>=1?A.traffic.toFixed(1)+' M':Math.round(A.traffic*1000)+' k'} voyageurs/an</div>
    ${nx&&U[nx.k]&&U[nx.k].can(A)?`<div class="row" style="margin-top:6px"><div class="grow small">Prochaine étape : ${nx.icon} <b>${nx.name}</b><br><span class="mut">${nx.desc}</span></div><button class="btn sm gold" data-act="project" data-c="${h}" data-k="${nx.k}">${fmtMoney(U[nx.k].cost(A))}</button></div>`:nx?`<div class="small mut" style="margin-top:6px">Prochaine étape : ${nx.icon} ${nx.name} (piste en dur et classe 2 nécessaires)</div>`:'<div class="al ok">✅ Aéroport complètement agrandi</div>'}
    ${done.length?`<div class="small" style="margin-top:6px">Déjà construit : ${done.map(k=>U[k].icon+' '+U[k].name.replace(/ \(.*\)/,'')).join(' · ')}</div>`:''}
    ${extras.map(k=>`<div class="row" style="margin-top:6px"><div class="grow small">${U[k].icon} <b>${U[k].name}</b><br><span class="mut">${U[k].desc}</span></div><button class="btn sm" data-act="project" data-c="${h}" data-k="${k}">${fmtMoney(U[k].cost(A))}</button></div>`).join('')}</div>`;
}

/* ---------- 👥 Clients ---------- */
const CO_COMPLAINTS=[['⏱️ Retards',/Retard/,'Gardez des avions de réserve, construisez une équipe d’escale et le balisage ILS.'],['💸 Prix trop élevés',/Prix trop/,'Baissez un peu les prix de la ligne concernée (onglet Lignes).'],['🧳 Bagages',/Bagage/,'Répondez vite aux cas « bagage perdu » dans 📬.'],['💺 Confort et avions âgés',/inconfortable|vieillissant|serré/,'Montez le service à bord, remplacez les vieux avions, mettez moins de sièges.'],['👥 Personnel débordé',/débordé|attente/,'Embauchez du personnel (onglet Personnel) ou passez en mode simple.']];
function coClients(){
  const L=S.reviews||[], avg=coReviewAvg(), sat=satisfaction(), open=(S.inbox||[]).filter(m=>m.st==='new'&&m.kind&&m.kind.startsWith('pax'));
  const bad=L.filter(x=>x.stars<=2), good=L.filter(x=>x.stars>=4), cls={f:0,j:0,w:0,y:0}; for(const x of L) cls[x.cls]=(cls[x.cls]||0)+1;
  const comp=CO_COMPLAINTS.map(([l,re,tip])=>[l,bad.filter(x=>re.test(x.text)).length,tip]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
  const flying=S.fleet.filter(a=>a.status==='flight'&&!isCargo(modelOf(a))).slice(0,6);
  const kpi=(l,v,cls='')=>`<div class="kpi"><div class="kl">${l}</div><div class="kv ${cls}">${v}</div></div>`;
  return `${coHelp('Vos clients donnent une note après leur vol (★ à ★★★★★). Ces avis font monter ou baisser votre <b>image</b>, et l’image fait venir de nouveaux passagers. Les clients mécontents ou les célébrités (VIP) vous écrivent dans 📬 : répondez-leur.')}
  <div class="kpis">${kpi('Satisfaction',Math.round(sat)+' %',sat<50?'neg':sat>70?'pos':'')}${kpi('Note moyenne',avg==null?'—':avg.toFixed(1).replace('.',',')+' ★')}${kpi('Clients ravis',L.length?Math.round(good.length/L.length*100)+' %':'—','pos')}${kpi('Mécontents',L.length?Math.round(bad.length/L.length*100)+' %':'—',bad.length?'neg':'')}${kpi('À traiter (📬)',open.length,open.length?'neg':'')}</div>
  <h3>📬 Clients qui attendent une réponse</h3>
  ${open.length?open.slice(0,5).map(m=>`<div class="card row"><div class="grow">${m.kind==='paxVip'?'⭐ <b>VIP</b> · ':''}<b>${esc(m.subj)}</b><br><span class="small mut">reçu le ${fmtDate(m.t)} · répondre avant le ${fmtDate(m.exp)}</span></div><button class="btn sm gold" data-act="inbox">Répondre</button></div>`).join(''):'<div class="mut small">Personne n’attend : bravo !</div>'}
  <h3>😠 Pourquoi certains clients sont mécontents</h3>
  ${comp.length?comp.map(([l,n,tip])=>`<div class="card"><b>${l}</b> <span class="badge bad">${n} avis</span><br><span class="small mut">Que faire : ${tip}</span></div>`).join(''):'<div class="mut small">Pas assez d’avis négatifs pour en tirer des leçons.</div>'}
  <h3>👑 Qui voyage avec vous</h3>
  <div class="card small">${L.length?`Sur les ${L.length} derniers avis : 👑 Première ${cls.f||0} · 💼 Affaires ${cls.j||0} · 💺 Premium ${cls.w||0} · 💺 Économique ${cls.y||0}`:'Les avis arrivent après vos premiers vols.'}<br><span class="mut">Les clients Affaires et Première rapportent beaucoup plus : salons VIP et service 4★–5★ les attirent (sous-onglet ✨ Améliorer).</span></div>
  ${flying.length?`<div class="small" style="margin:8px 0 4px"><b>Voir la liste des passagers d’un vol en cours :</b></div><div class="btns">${flying.map(a=>`<button class="btn sm" data-act="manifest" data-id="${a.id}">📋 ${esc(a.reg)} ${(()=>{ const l=a.flight&&a.flight.legs&&a.flight.legs[a.flight.li]; return l?esc(l.from+'→'+l.to):''; })()}</button>`).join('')}</div>`:''}
  <h3>💬 Derniers avis</h3>
  ${typeof reviewsHtml==='function'?reviewsHtml():''}
  <div class="btns"><button class="btn" data-tab="pax">🛂 Statistiques détaillées des voyageurs (pays, richesse, motifs)</button></div>`;
}

/* ---------- 👨‍✈️ Équipages ---------- */
function coCrew(){ const st=S.staff, strike=(st.strikeUntil||0)>S.time;
  return `${strike?`<div class="al bad">✊ <b>Grève des pilotes</b> jusqu’au ${fmtDate(st.strikeUntil)} : aucun départ depuis vos hubs.</div>`:''}${typeof crewHtml==='function'?crewHtml():''}
  <div class="btns"><button class="btn" data-tab="staff">👥 Tout le personnel (hôtesses, mécaniciens, sol), salaires et recrutement</button></div>`; }

/* ---------- ⚔️ Concurrents ---------- */
function coThreats(){ const m=new Map(); if(typeof carriersOn!=='function') return m;
  for(const r of S.routes||[]){ const a=r.stops[0], b=r.stops[r.stops.length-1]; for(const code of carriersOn(a,b)||[]) if(code!==S.company.code) m.set(code,(m.get(code)||0)+1); }
  return m; }
function coRivals(){
  const rows=typeof aiRows==='function'?aiRows():[], me=rows.find(r=>r.me), thr=coThreats(), hc=homeCC();
  const F=UI.coRf||(thr.size?'lines':'home'), cont=COUNTRIES[hc][1];
  const filt={lines:r=>thr.has(r.code), home:r=>AP(r.hub).cc===hc, region:r=>COUNTRIES[AP(r.hub).cc]&&COUNTRIES[AP(r.hub).cc][1]===cont, all:()=>true}[F]||(()=>true);
  const list=rows.filter(r=>!r.me&&filt(r)).slice(0,40);
  const drive=S.rivalDrive===undefined?3:S.rivalDrive;
  return `${coHelp('Les autres compagnies du jeu sont dirigées par l’ordinateur. Elles ouvrent des lignes, achètent des avions, baissent leurs prix pour vous prendre des clients, s’allient entre elles et peuvent faire faillite. Vous pouvez les surveiller, signer un <b>partage de codes</b> avec les grandes, ou <b>racheter leurs actions</b> (à 51 %, la compagnie est à vous).')}
  <div class="card">Votre rang : <b>${me?me.rank:'—'}ᵉ</b> sur ${rows.length} compagnies · ${thr.size} concurrent(s) sur vos lignes.</div>
  <div class="small" style="margin:8px 0 2px"><b>⚔️ Agressivité des concurrents</b> <span class="mut">(à quel point ils cherchent à vous dépasser)</span></div>
  <div class="btns">${(typeof RIVAL_DRIVES!=='undefined'?RIVAL_DRIVES:[]).map(([l,v])=>`<button class="btn sm ${drive===v?'gold':''}" data-act="rivalDrive" data-k="${v}">${l}</button>`).join('')}</div>
  <div class="chips" style="margin-top:8px">${[['lines','Sur mes lignes'],['home',COUNTRIES[hc][2]+' Mon pays'],['region','Mon continent'],['all','Monde entier']].map(([k,l])=>`<button class="chip ${F===k?'on':''}" data-act="coRf" data-k="${k}">${l}</button>`).join('')}</div>
  ${list.length?list.map(r=>{ const R=r.R, e=r.e||{}, n=thr.get(r.code)||0, partner=R&&typeof isPartner==='function'&&isPartner(R), st=e.status==='dead'?'<span class="badge bad">en faillite</span>':e.debt>0?'<span class="badge bad">endettée</span>':'';
    return `<div class="card"><div class="row"><div class="grow"><span class="dot" style="background:${r.color}"></span><b>${esc(r.name)}</b> <span class="mut small">${r.rank}ᵉ</span> ${r.startup?'<span class="badge">🆕 nouvelle</span>':''} ${st} ${partner?'<span class="badge ok">🤝 partenaire</span>':''}<br>
      <span class="small mut">${flag(r.hub)} ${esc(AP(r.hub).city)} · ${num(r.fleet)} avions · ${num(r.routes)} lignes · ${num(r.pax||0)} passagers/jour · ${stars(r.rep)}${r.crashes?` · 💥 ${r.crashes} accident(s)`:''}</span>
      ${n?`<br><span class="small warnt">⚔️ Présente sur ${n} de vos lignes</span>`:''}</div></div>
      <div class="btns"><button class="btn sm" data-act="airlineCard" data-c="${r.code}">📋 Fiche et lignes</button>${R&&!R.local?(partner?`<button class="btn sm danger" data-act="csCancel" data-c="${R.code}">Rompre le partage</button>`:`<button class="btn sm" data-act="csSign" data-c="${R.code}">🤝 Partage de codes</button>`):''}${R?`<button class="btn sm" data-tab="bourse">📈 Racheter</button>`:''}</div></div>`; }).join(''):`<div class="mut small">${F==='lines'?'Aucune autre compagnie sur vos lignes pour l’instant.':'Aucune compagnie ici.'}</div>`}`;
}

/* ---------- 🛂 Espace aérien ---------- */
function coAirOrigins(cc){ const o=new Set(Object.values(AIRLINE_DB||{}).map(a=>a[1]).filter(k=>COUNTRIES[k]&&k!==cc));
  for(const e of S.ai&&S.ai.list||[]) if(e.cc&&COUNTRIES[e.cc]&&e.cc!==cc) o.add(e.cc);
  for(const R of S.rivals||[]){ const k=AP(R.hub)&&AP(R.hub).cc; if(k&&COUNTRIES[k]&&k!==cc) o.add(k); }
  return [...o]; }
function coAirspace(){
  const cc=homeCC(), poly=typeof _airspacePolygons!=='undefined'&&_airspacePolygons[cc], bans=(S.airspaceBans&&S.airspaceBans[cc])||[];
  const wars=(S.wd&&S.wd.wars||[]).map(w=>w.ccs.filter(c=>COUNTRIES[c]).map(c=>COUNTRIES[c][2]+' '+COUNTRIES[c][0]).join(' ⚔️ ')).filter(Boolean);
  const shut=Object.entries(S.ai&&S.ai.shut||{}).filter(([c,u])=>u>S.time&&AP(c)), susp=Object.entries(S.ai&&S.ai.suspend||{}).filter(([c,u])=>u>S.time&&COUNTRIES[c]);
  return `${coHelp(`Vous décidez quelles compagnies étrangères ont le droit de passer au-dessus de ${esc(COUNTRIES[cc][0])}. Une compagnie interdite <b>ne peut plus atterrir</b> chez vous (ses lignes vers votre pays s’arrêtent) et ses vols qui traversaient votre pays font un <b>détour</b> (plus long, plus cher pour elle). Vos propres vols ne sont jamais bloqués.`)}
  ${poly?`<div class="card"><div class="row"><b class="grow">Ciel de ${COUNTRIES[cc][2]} ${esc(COUNTRIES[cc][0])}</b><span class="badge ${bans.length?'bad':'ok'}">${bans.length?bans.length+' pays interdits':'ouvert à tous'}</span></div>
    <div class="btns"><button class="btn sm danger" data-act="coAirAll" data-k="close">🚫 Fermer à toutes les compagnies étrangères</button><button class="btn sm" data-act="coAirAll" data-k="open">✅ Rouvrir à tous</button></div></div>
    ${typeof airspacePolicyHtml==='function'?airspacePolicyHtml(cc):''}`
  :`<div class="card">Le réglage de l’espace aérien n’est disponible que pour les pays dont la frontière est dessinée dans le jeu (RD Congo, Iran, Corée du Nord, Palestine, Soudan, Ukraine). Votre pays suit les règles automatiques ci-dessous.</div>`}
  <h3>🌍 Fermetures en cours dans le monde</h3>
  <div class="card small">
    ${wars.length?wars.map(w=>`<div>⚔️ Guerre : ${w} — espace aérien évité par les compagnies</div>`).join(''):'<div class="mut">Aucune guerre en cours.</div>'}
    ${susp.map(([c,u])=>`<div>⛔ Vols suspendus vers ${COUNTRIES[c][2]} ${esc(COUNTRIES[c][0])} jusqu’au ${fmtDate(u)}</div>`).join('')}
    ${shut.map(([c,u])=>`<div>🛬 Aéroport de ${esc(AP(c).city)} fermé jusqu’au ${fmtDate(u)}</div>`).join('')}
    <div class="mut" style="margin-top:6px">Règles permanentes : les compagnies rwandaises n’entrent pas en RD Congo, les compagnies iraniennes ne vont pas aux États-Unis, les ukrainiennes pas en Russie ; le ciel nord-coréen est presque fermé.</div></div>`;
}

/* ---------- 🤝 Partenaires ---------- */
function coDeals(){
  return `${coHelp('Pour trouver plus de passagers sans acheter d’avions : la <b>publicité</b> (quelques semaines), une <b>alliance</b> (abonnement mensuel, plus de voyageurs internationaux), un <b>partage de codes</b> avec une grande compagnie, ou des <b>contrats cargo</b> pour vos avions-cargos.')}
  <h3>📣 Publicité</h3>
  ${CAMPAIGNS.map(cp=>{ const on=(S.campaigns||[]).find(x=>x.id===cp.id&&x.until>S.time); return `<div class="card row"><div class="grow"><b>${cp.name}</b> — ${fmtMoney(cp.cost)} · ${cp.days} jours · demande +${Math.round(cp.boost*100)} % · image +${cp.rep}<br><span class="mut small">${cp.desc}</span></div>${on?`<span class="badge ok">Jusqu’au ${fmtDate(on.until)}</span>`:`<button class="btn sm gold" data-act="campaign" data-id="${cp.id}">Lancer</button>`}</div>`; }).join('')}
  <h3>🌐 Alliances</h3>
  ${ALLIANCES.map(al=>{ const ok=S.reputation>=al.minRep&&S.fleet.length>=al.minFleet, mine=S.alliance===al.id; return `<div class="card row ${mine?'gold-b':''}"><div class="grow"><b>${al.name}</b> — ${fmtMoney(al.fee)}/mois · demande +${Math.round(al.boost*100)} %<br><span class="mut small">${al.desc} · conditions : image ${al.minRep}, ${al.minFleet} avions</span></div>${mine?`<button class="btn sm danger" data-act="leaveAlliance">Quitter</button>`:`<button class="btn sm ${ok?'gold':''}" data-act="joinAlliance" data-id="${al.id}" ${ok&&!S.alliance?'':'disabled'}>Rejoindre</button>`}</div>`; }).join('')}
  <h3>🤝 Partages de codes</h3>
  <div class="small mut">Accord avec une grande compagnie : +15 % de demande sur vos lignes vers son hub, et elle arrête de vous attaquer (3 accords maximum, image 45 et 4 avions requis).</div>
  ${(S.rivals||[]).filter(R=>!R.local).map(R=>{ const on=isPartner(R); return `<div class="card row ${on?'gold-b':''}"><div class="grow"><span class="dot" style="background:${R.color}"></span><b>${esc(R.name)}</b> — hub ${flag(R.hub)} ${esc(AP(R.hub).city)} · ${R.fleet} avions<br><span class="small mut">${fmtMoney(codeshareFee(R))}/mois</span></div>${on?`<button class="btn sm danger" data-act="csCancel" data-c="${R.code}">Rompre</button>`:`<button class="btn sm gold" data-act="csSign" data-c="${R.code}">Signer</button>`}</div>`; }).join('')}
  <h3>📦 Contrats cargo</h3>${cargoHtml()}`;
}

/* ---------- ⚙️ Réglages ---------- */
function coSettings(){
  const c=S.company;
  return `<h3>🎨 Identité</h3>
  <div class="form"><label>Nom<input data-in="co.name" value="${esc(c.name)}"></label><label>Code IATA<input data-in="co.code" maxlength="3" value="${esc(c.code)}"></label><label>Livrée (couleur)<input type="color" data-in="co.color" value="${c.color}"></label><label>Logo<input data-in="co.logo" maxlength="3" value="${esc(c.logo)}"></label></div>
  <div class="card row"><div class="biglogo" style="background:${c.color}">${esc(c.logo)}</div><div>${PLANE_SVG(c.color,64,'wb')}</div><div><b>${esc(c.name)}</b><br><span class="mut">Hub principal ${apName(c.hub)}</span></div></div>
  <div class="btns"><button class="btn sm" data-act="livery">🎨 Atelier de livrée</button></div>
  <h3>⏱️ Temps et jeu</h3>
  <div class="card"><div class="chips">${Object.entries(SPEEDS).filter(([k,v])=>!v.hide).map(([k,v])=>`<button class="chip ${S.speed===k?'on':''}" data-speed="${k}">${v.label} (×${v.mult})</button>`).join('')}</div>
    <div class="mut small">Réaliste = temps réel. Standard : 1 s = 1 min. Rapide : 1 s = 10 min. Le jeu continue quand la page est fermée (jusqu’à 30 jours rattrapés).</div>
    <label class="tog"><input type="checkbox" data-in="simple" ${S.simple?'checked':''}> <b>Mode simple</b> : personnel, carburant, maintenance et programmation automatiques</label>
    <label class="tog"><input type="checkbox" data-in="notif" ${S.notifications?'checked':''}> Notifications du navigateur</label></div>
  <div class="btns"><button class="btn sm" data-act="guideReset">🎓 Recommencer le tutoriel</button><button class="btn sm" data-act="manual">📖 Guide du jeu</button><button class="btn sm" data-act="saves">💾 Sauvegardes</button><button class="btn sm danger" data-act="reset">Nouvelle partie</button></div>`;
}

/* ---------- 📖 Guide du jeu (manuel complet) ---------- */
const MANUAL=[
  ['🚀','Le but du jeu','Vous dirigez une compagnie aérienne. Elle gagne de l’argent en transportant des passagers (et du fret) sur des <b>lignes</b> entre deux villes. Plus elle est appréciée, plus elle attire de clients. Objectif : devenir la première compagnie du monde.'],
  ['🧭','Les lignes','Onglet <b>Lignes</b> → « Ouvrir une ligne » : choisissez une ville. Un avion libre y est programmé (en mode simple, automatiquement). Une bonne ligne relie deux grandes villes, à une distance adaptée à l’avion. Le <b>remplissage</b> indique la part de sièges vendus : au-dessus de 90 %, montez les prix ou ajoutez des vols ; en dessous de 50 %, baissez les prix.'],
  ['✈️','Les avions','Onglet <b>Acheter</b> : neuf, d’occasion ou en location. Un petit avion (ATR 72) va sur des lignes courtes ; un gros (A320, 787…) demande une piste plus longue. Chaque avion s’use : l’entretien est automatique en mode simple. Un avion âgé déçoit les clients.'],
  ['👥','Les clients','Chaque passager a une classe (Économique, Premium, Affaires, Première), une nationalité, un motif de voyage. Après le vol, certains laissent un <b>avis</b>. Les avis font l’<b>image</b> de la compagnie. Les clients en difficulté (bagage perdu, malade, VIP) vous écrivent dans 📬 : votre réponse compte. Tout est dans <b>🏢 Compagnie → 👥 Clients</b>.'],
  ['👑','VIP et service','Le <b>service à bord</b> (1★ à 5★) coûte plus cher mais attire. Le <b>programme de fidélité</b> fait revenir les clients. Les <b>salons VIP</b> attirent la clientèle Affaires et Première, la plus rentable. Tout est dans <b>🏢 Compagnie → ✨ Améliorer</b>.'],
  ['🏗️','Aéroports et terminaux','Dans votre pays, vous pouvez agrandir vos aéroports en 7 étapes : terminal agrandi, jetée, deuxième piste, Terminal 2, ville aéroportuaire, Terminal 3, Terminal 4. Plus de voyageurs, plus de portes, plus gros avions : et c’est visible en 2D et en 3D.'],
  ['👨‍✈️','Les équipages','Chaque pilote a un nom, un grade (copilote, commandant, instructeur, chef pilote), des heures de vol et un moral. Promouvez ceux qui le méritent ; sinon, les concurrents les débauchent (un message 📬 vous permet de les retenir). Si le moral général est trop bas, le syndicat menace de faire grève. Voir <b>🏢 Compagnie → 👨‍✈️ Équipages</b>.'],
  ['🏛️','Votre pays','Chaque passager que vous transportez vers une ville de votre pays la fait grandir : plus d’habitants, plus de voyageurs. Par paliers, l’État bitume ou allonge sa piste, agrandit son terminal, puis vous verse une prime. Chaque mois, le gouvernement juge votre compagnie (villes desservies, petites villes, pilotes du pays, sécurité, grèves, ponctualité) : subvention si vous êtes bien vu, taxe spéciale sinon. Voir <b>🏢 Compagnie → 🏛️ Mon pays</b>.'],
  ['🚚','Camions et bateaux','Créez des filiales de fret. 🚆 <b>Trains</b> : le vrai réseau ferré (Matadi–Kinshasa, Katanga, Kasaï, vers Lobito et la Zambie), avec le cuivre et le cobalt ; réhabilitez les voies. 🚚 <b>Camions</b> : vers toutes les villes de la RDC (routes goudronnées rapides, pistes lentes et coupées par les pluies). 🚢 <b>Bateaux</b> : barges sur le fleuve Congo et le Kasaï, bateaux sur les lacs Kivu et Tanganyika, caboteurs de Matadi vers les ports du monde. Ouvrez un dépôt ou un port, achetez des véhicules, ouvrez des lignes : chaque semaine ils livrent et rapportent. Voir <b>🏢 Compagnie → 🚚 Transport</b>.'],
  ['⚔️','Les concurrents','Les autres compagnies sont jouées par l’ordinateur : elles viennent sur vos lignes, baissent leurs prix, peuvent faire faillite. Leurs patrons vous écrivent parfois (menaces, propositions). Vous pouvez signer un partage de codes ou racheter leurs actions (51 % = la compagnie est à vous). Voir <b>🏢 Compagnie → ⚔️ Concurrents</b>.'],
  ['🛂','L’espace aérien','Vous pouvez interdire le ciel de votre pays aux compagnies d’autres pays : elles ne peuvent plus y atterrir et font un détour. Les guerres ferment aussi des espaces aériens. Voir <b>🏢 Compagnie → 🛂 Espace aérien</b>.'],
  ['💰','L’argent','Recettes : billets, options payantes, fret. Dépenses : kérosène, salaires, entretien, location, aéroports. Si l’argent manque, un prêt est possible (onglet Finances). Une compagnie en négatif trop longtemps fait faillite.'],
  ['⏱️','Le temps','Choisissez la vitesse en haut (Réaliste, Standard, Rapide…). Le jeu continue même téléphone fermé : à votre retour, les jours passés sont rattrapés.'],
];
function manualHtml(){ return `<div class="small mut" style="margin-bottom:8px">Touchez un chapitre pour l’ouvrir.</div>${MANUAL.map(([i,t,d],k)=>`<details class="card" ${k===0?'open':''}><summary><b>${i} ${t}</b></summary><div style="margin-top:6px">${d}</div></details>`).join('')}
  <div class="btns"><button class="btn gold" data-act="guideReset">🎓 Recommencer le tutoriel pas à pas</button></div>`; }
function welcomeHtml(){ return `<p>Bienvenue, PDG de <b>${esc(S.company.name)}</b> ! Votre compagnie démarre à <b>${esc(AP(S.company.hub).city)}</b> avec ${S.fleet.length} avion(s) et ${fmtMoney(S.cash)}.</p>
  <div class="card">1️⃣ <b>Ouvrez une ligne</b> vers une ville : vos avions transportent des passagers.<br>2️⃣ <b>Regardez vos vols</b> sur la carte (2D ou 3D).<br>3️⃣ <b>Soignez vos clients</b> : service, salons VIP, réponses aux réclamations.<br>4️⃣ <b>Grandissez</b> : avions, aéroports, terminaux… et dépassez les concurrents.</div>
  <p class="small mut">Le bandeau 🎓 en bas de l’écran vous guide étape par étape. Touchez « Montre-moi » à chaque étape. Le 📖 <b>Guide du jeu</b> explique tout en détail (dans 🏢 Compagnie → Réglages, ou dans Plus).</p>
  <div class="btns"><button class="btn gold" data-act="closeWelcome">C’est parti !</button><button class="btn" data-act="manual">📖 Lire le guide</button></div>`; }

function registerCompanyActions(){
  MODALS.manual=()=>showModal('📖 Guide du jeu', manualHtml(), true);
  MODALS.welcome=()=>showModal('✈️ Bienvenue dans Sky Empire', welcomeHtml(), true);
  Object.assign(ACTIONS,{
    coTab:d=>{ UI.coTab=d.k; renderPanel(); const b=$('#panelBody'); if(b) b.scrollTop=0; },
    coGo:d=>{ UI.coTab=d.k; if(UI.tab!=='company') setTab('company'); else { renderPanel(); const b=$('#panelBody'); if(b) b.scrollTop=0; } },
    coRf:d=>{ UI.coRf=d.k; renderPanel(); },
    coLoyalty:()=>{ if(S.loyalty) return; if(S.cash<3e6) return err('Il faut 3 M$ pour lancer le programme.'); book('marketing',-3e6); S.loyalty=true; S.reputation=clamp(S.reputation+3,0,100); logMsg('💳 Programme de fidélité lancé !','ok'); toast('💳 Programme de fidélité lancé : +6 % d’attractivité','ok'); renderTop(); renderPanel(); },
    coAirAll:d=>{ const cc=homeCC(); if(typeof _airspacePolygons==='undefined'||!_airspacePolygons[cc]) return err('Réglage indisponible pour votre pays.');
      S.airspaceBans=S.airspaceBans||{};
      if(d.k==='close'){ if(!confirm('Fermer le ciel de votre pays à toutes les compagnies étrangères ? Leurs lignes vers votre pays s’arrêteront.')) return; const list=coAirOrigins(cc).filter(o=>!airspaceDefaultBan(cc,o)).sort(); if(list.length) S.airspaceBans[cc]=list; }
      else delete S.airspaceBans[cc];
      airspacePolicyChanged(); save(); renderPanel(); renderTop(); toast(d.k==='close'?'⛔ Ciel fermé aux compagnies étrangères':'✅ Ciel rouvert à toutes les compagnies',d.k==='close'?'warn':'ok'); },
    manual:()=>openM('manual'),
    closeWelcome:()=>{ closeModal(); renderGuide(); },
  });
}
