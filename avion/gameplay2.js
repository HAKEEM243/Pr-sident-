/* =========================================================
   Sky Empire — le monde réagit : gouvernements et accidents
   • Chaque pays a un président (style, ambitions) qui commande des avions,
     subventionne sa compagnie nationale, change les taxes d'aéroport, signe des
     accords de ciel ouvert, ferme son espace aérien… et propose des contrats.
   • Votre flotte peut avoir des accidents (rares, mais réels) : l'entretien
     compte, l'assurance paie une partie, la presse et la carte s'en emparent.
   ========================================================= */
'use strict';
/* ---------- accidents de votre compagnie ---------- */
const ACC_LEVELS=[['Rares',0.4],['Réalistes',1],['Fréquents',3]];
const accMult=()=>S.accMult===undefined?1:S.accMult;
function accidentRisk(ac,leg,m){
  const B=AP(leg.to), over=maintOverdue(ac), storm=(typeof stormAt==='function')&&stormAt(B.lat,B.lon);
  let p=0.00012;
  if(ac.condition<55) p*=1+(55-ac.condition)/10;
  if(over) p*=4;
  if(storm) p*=2.5;
  if(B.cls<=2&&!B.ils) p*=1.5;
  if((ac.hours||0)>40000) p*=1.5;
  if(S.recallRisk&&S.recallRisk.fam===m.fam&&S.time<S.recallRisk.until) p*=3;
  p*=1+(typeof staffShortage==='function'?staffShortage('meca'):0)*2;
  return Math.min(0.05,p*accMult());
}
function playerAccident(ac,leg,m,pax){
  const A=AP(leg.from), B=AP(leg.to), over=maintOverdue(ac), r=Math.random();
  const kind=r<0.42?'excursion':r<0.68?'dur':r<0.86?'fatal':'evac';
  const lat=B.lat+(Math.random()-0.5)*0.05, lon=B.lon+(Math.random()-0.5)*0.05, value=m.price*1e6*Math.max(0.25,1-(ac.hours||0)/80000);
  let sev='incident', victims=0, title='', txt='', repair=0, out=0, loss=false, rep=0, comp=0;
  if(kind==='excursion'){ sev='hull'; loss=true; title='Sortie de piste : avion détruit'; txt=`Le ${m.name} ${ac.reg} sort de la piste à l’atterrissage à ${B.city} et prend feu. Passagers et équipage évacués, quelques blessés légers.`; rep=-12; }
  else if(kind==='fatal'){ sev='fatal'; loss=true; victims=Math.max(2,Math.round((pax+6)*rnd(0.3,0.95))); comp=victims*rnd(0.3e6,0.9e6); title='Accident mortel'; txt=`Le ${m.name} ${ac.reg} s’écrase à l’approche de ${B.city}. ${victims} personne${victims>1?'s':''} ne survivent pas.`; rep=-rnd(25,40); }
  else if(kind==='dur'){ repair=value*0.2; out=45; title='Atterrissage brutal : avion endommagé'; txt=`Le ${m.name} ${ac.reg} touche trop fort à ${B.city} : train endommagé, structure à contrôler. Pas de blessé grave.`; rep=-5; }
  else { repair=value*0.03; out=10; title='Évacuation d’urgence'; txt=`Fumée en cabine du ${m.name} ${ac.reg} à ${B.city} : évacuation par les toboggans, des blessés légers.`; rep=-3; }
  const insured=loss?value*(over?0.25:0.8):0;
  if(insured) book('assurance',insured); if(comp) book('incidents',-comp); if(repair) book('maintenance',-repair);
  S.reputation=clamp(S.reputation+rep,0,100);
  if(loss){ S.fleet=S.fleet.filter(x=>x!==ac); S.stats.crashes=(S.stats.crashes||0)+1;
    // enquête : tous les appareils du même type sont immobilisés quelques jours
    for(const x of S.fleet) if(modelOf(x).fam===m.fam&&x.status==='idle') x.readyAt=Math.max(x.readyAt||0,S.time+(kind==='fatal'?5:2)*DAY); }
  else { ac.readyAt=Math.max(ac.readyAt||0,S.time)+out*DAY; ac.condition=clamp(ac.condition-25,0,100); }
  S.stats.incidents=(S.stats.incidents||0)+1;
  // carte et presse
  if(S.ai){ (S.ai.crashes=S.ai.crashes||[]).unshift({t:S.time,code:S.company.code,name:S.company.name,model:m.name,a:leg.from,b:leg.to,sev,victims,lat:+lat.toFixed(3),lon:+lon.toFixed(3),id:'p'+Math.round(S.time/1000),mine:true});
    aiNews((sev==='fatal'?'💥':sev==='hull'?'🔥':'⚠️')+` ${S.company.name} : ${title.toLowerCase()} à ${B.city} (${m.name}${victims?`, ${victims} victimes`:''}).`,'bad',true);
    if(typeof crashSync==='function') crashSync(); }
  const detail=`<div class="card"><b>${esc(title)}</b><p>${esc(txt)}</p>
    <div class="small">${loss?`✈️ L’avion est perdu.`:`🔧 Immobilisé ${out} jours.`}${insured?` · 🛡️ L’assurance verse ${fmtMoney(insured)}${over?' (réduit : entretien en retard)':''}.`:''}${comp?` · 👪 Indemnisation des familles : ${fmtMoney(comp)}.`:''}${repair?` · Réparations : ${fmtMoney(repair)}.`:''} · Image ${rep}.</div>
    ${kind==='fatal'?'<div class="small mut">Une enquête est ouverte ; les appareils du même type restent au sol quelques jours.</div>':''}</div>`;
  logMsg(`${sev==='fatal'?'💥':sev==='hull'?'🔥':'⚠️'} ${title} — ${ac.reg} à ${B.city}.`,'bad');
  if(typeof notify==='function') notify(title,`${ac.reg} à ${B.city}`);
  if(typeof UI!=='undefined'&&!UI.silent&&typeof showModal==='function') showModal((sev==='fatal'?'💥 ':sev==='hull'?'🔥 ':'⚠️ ')+'Accident',detail);
}
{ const _cl=completeLeg; completeLeg=function(ac){
    const fl=ac.flight, leg=fl&&fl.legs[fl.li], m=leg&&modelOf(ac), pax=leg&&leg.pax?leg.pax.f+leg.pax.j+leg.pax.w+leg.pax.y:0, risk=leg?accidentRisk(ac,leg,m):0, B=leg&&AP(leg.to);
    _cl(ac);
    if(!leg) return;
    // taxes d'aéroport fixées par le gouvernement du pays d'arrivée
    const g=S.gov&&S.gov[B.cc]; if(g){ const mult=(g.feeUntil&&g.feeUntil>S.time&&g.feeCut)?g.feeCut:g.fee; if(mult&&mult!==1){ const size=Math.max(m.seats,m.cargo*3)/100, base=[0,60,150,300,550,900][B.cls]*Math.max(0.25,size)+pax*(AP(leg.from).cc!==B.cc?22:7); book('taxes',-base*(mult-1)); } }
    if(Math.random()<risk) playerAccident(ac,leg,m,pax); }; }

/* ---------- gouvernements ---------- */
const GOV_STYLES={nationaliste:'🦅 nationaliste',liberal:'📈 libéral',autoritaire:'🪖 autoritaire',reformateur:'🌱 réformateur',populiste:'📣 populiste'};
const GOV_NAMES={AF:[['Félix','Amadou','Joseph','Ibrahim','Samuel','Fatima','Grace','Moussa','Kwame'],['Tshisekedi','Diallo','Mensah','Ouattara','Okonkwo','Kagame','Bongo','Traoré','Sy']],EU:[['Emmanuel','Olaf','Giorgia','Pedro','Mark','Sanna','Viktor','Andrzej','Maria'],['Laurent','Becker','Rossi','Santos','De Vries','Lindqvist','Novak','Kowalski','Costa']],AS:[['Narendra','Hiroshi','Min-jun','Anwar','Li','Sheikh','Joko','Priya','Tran'],['Rao','Tanaka','Park','Hamid','Wei','Al-Nahyan','Santoso','Singh','Nguyen']],NA:[['Joseph','Justin','Claudia','Miguel','Karen','Daniel'],['Walker','Tremblay','Sánchez','Rivera','Brooks','Hall']],SA:[['Luiz','Gabriel','Javier','Sofía','Camila','Rafael'],['Silva','Boric','Milei','Castro','Torres','Vega']],OC:[['Anthony','Jacinda','Peter','Mere'],['Albanese','Ardern','Brown','Tui']]};
let _govL=null; const govList=()=>_govL||(_govL=Object.keys(COUNTRIES).filter(cc=>typeof cAirports==='function'&&cAirports(cc).length&&countryTraffic(cc)>0.25).sort((a,b)=>countryTraffic(b)-countryTraffic(a)).slice(0,70));   // les 70 pays les plus fréquentés
function newLeader(cc){ const cont=(COUNTRIES[cc]&&COUNTRIES[cc][1])||'EU', N=GOV_NAMES[cont]||GOV_NAMES.EU, st=pick(Object.keys(GOV_STYLES));
  return {leader:pick(N[0])+' '+pick(N[1]),style:st,since:S.time,term:S.time+rndi(3,6)*365*DAY,fee:1,feeUntil:0,feeCut:0,log:[]}; }
function govOf(cc){ S.gov=S.gov||{}; return S.gov[cc]||(S.gov[cc]=newLeader(cc)); }
const flagOf=cc=>(aiAlive().filter(e=>e.cc===cc).sort((a,b)=>b.fleet-a.fleet)[0])||null;
function govNote(cc,txt,important){ const g=govOf(cc); g.log.unshift({t:S.time,txt}); if(g.log.length>8) g.log.length=8; aiNews(txt,'news',important||mineCountry(cc)); }
function govAction(cc){
  const g=govOf(cc), C=ccWith(cc), who=`${g.leader}`, e=flagOf(cc), lv=incomeOf(cc), st=g.style;
  // élection : la ligne politique change
  if(S.time>g.term){ const old=g.leader; const n=newLeader(cc); Object.assign(g,{leader:n.leader,style:n.style,since:S.time,term:n.term,fee:1,feeUntil:0});
    govNote(cc,`🗳️ ${C} : élections — ${g.leader} (${GOV_STYLES[g.style].slice(2)}) succède à ${old}.`,false); return; }
  const r=Math.random();
  if(e&&r<0.30&&(st==='nationaliste'||st==='populiste'||st==='reformateur')){ // le président commande des avions pour la compagnie nationale
    const n=Math.max(2,Math.round(Math.max(6,e.fleet)*rnd(0.05,0.2))), m=modelFor(e); e.fleet+=n; e.cash-=n*rnd(2e6,5e6); const R=(S.rivals||[]).find(x=>x.code===e.code); if(R) R.fleet=e.fleet;
    govNote(cc,`🏛️ Le président ${who} (${ccName(cc)}) annonce la commande de ${n} ${m.name.replace(/ \(occasion\)/,'')} pour ${e.name} : « la fierté nationale prend son envol ».`,n>=15); }
  else if(e&&r<0.45){ const k=Math.max(2e7,e.fleet*rnd(1e6,4e6)); e.cash+=k; e.rep=clamp(e.rep+1,20,95); govNote(cc,`💶 ${C} : l’État verse ${fmtMoney(k)} à ${e.name} pour soutenir son réseau.`,false); }
  else if(r<0.58){ // taxes d'aéroport
    if(st==='liberal'||st==='reformateur'){ g.fee=clamp(g.fee*0.88,0.7,1.7); govNote(cc,`📉 ${C} : ${who} baisse les taxes d’aéroport pour attirer les compagnies (−12 %).`,false); }
    else { g.fee=clamp(g.fee*1.18,0.7,1.7); govNote(cc,`📈 ${C} : ${who} augmente les taxes d’aéroport de 18 % — vos vols vers ${keyCity(mainAirport(cc))} coûtent plus cher.`,mineCountry(cc)); } }
  else if(r<0.70){ // ciel ouvert avec un autre pays
    const cc2=pick(govList().filter(x=>x!==cc)); if(cc2){ for(const c of [cc,cc2]){ const m=S.ai.mood[c]||(S.ai.mood[c]={tension:0,boom:0,note:''}); m.boom=clamp(m.boom+0.3,0,1); m.surge=S.time+rndi(30,60)*DAY; m.note='accord de ciel ouvert'; }
      const a=mainAirport(cc), b=mainAirport(cc2), cand=aiAlive().filter(x=>x.fleet>=10&&!carriersOn(a,b).includes(x.code)&&(x.cc===cc||x.cc===cc2)).slice(0,2);
      for(const x of cand){ (S.ai.extra[x.code]=S.ai.extra[x.code]||[]).push(pairKey(a,b)); x.routes++; S.ai.ver++; }
      govNote(cc,`🌐 Accord de ciel ouvert entre ${ccName(cc)} et ${ccName(cc2)} : plus de vols, plus de voyageurs${cand.length?` (${cand.map(x=>x.name).join(', ')} ajoutent des lignes)`:''}.`,mineCountry(cc)||mineCountry(cc2)); } }
  else if(r<0.78&&st!=='liberal'){ // visas
    const m=S.ai.mood[cc]||(S.ai.mood[cc]={tension:0,boom:0,note:''}); m.tension=clamp(m.tension+0.25,0,1); m.note='visas plus stricts';
    govNote(cc,`🛂 ${C} : ${who} durcit les conditions de visa — moins de voyageurs pendant quelques semaines.`,false); }
  else if(r<0.84&&(st==='autoritaire'||st==='populiste')&&lv<=2&&!mineCountry(cc)){   // jamais sur un pays où vous avez un hub ou une ligne // fermeture de l'espace aérien
    const hub=mainAirport(cc); shutAirport(hub,rndi(7,21)); const names=suspendFlights(cc,rndi(1,3));
    govNote(cc,`🚫 ${C} : ${who} ferme l’espace aérien ${st==='autoritaire'?'sur fond de tensions':'après une querelle diplomatique'}. L’aéroport de ${keyCity(hub)} est fermé${names.length?`, ${names.join(', ')} suspendent leurs vols`:''}.`,true); }
  else if(r<0.90){ // grand projet : nouvel aéroport / extension
    const m=S.ai.mood[cc]||(S.ai.mood[cc]={tension:0,boom:0,note:''}); m.boom=clamp(m.boom+0.35,0,1); m.surge=S.time+rndi(40,90)*DAY; m.note='grand projet aéroportuaire';
    govNote(cc,`🏗️ ${C} : ${who} lance un grand projet d’aéroport à ${keyCity(mainAirport(cc))} : travaux, tourisme, nouvelles lignes attendues.`,false); }
  else if(r<0.96&&!(S.hubs||[]).some(h=>AP(h)&&AP(h).cc===cc)&&S.routes.length>=1){ govOffer(cc); }
}
function govOffer(cc){
  const g=govOf(cc), hub=mainAirport(cc), city=keyCity(hub), sender={code:'GOV'+cc,name:`Gouvernement — ${ccName(cc)}`,color:'#16a34a',ceo:`Président ${g.leader}`};
  if(!hub||(S.inbox||[]).some(m=>m.st==='new'&&m.code===sender.code)) return;
  if(Math.random()<0.5){ const reward=Math.round(rnd(3e6,18e6)/1e5)*1e5;
    mailPush(sender,'gov-open',`Contrat de désenclavement : ${city}`,`Cher président-directeur général,<br>mon gouvernement souhaite relier <b>${city}</b> au reste du monde. Si vous ouvrez une ligne vers ${city} et la faites voler au moins <b>4 fois</b> dans les 60 jours, l’État vous versera <b>${fmtMoney(reward)}</b> de subvention.<br>— Président ${esc(g.leader)}`,[{k:'ok',l:`✅ Accepter (${fmtMoney(reward)})`},{k:'no',l:'Décliner'}],{cc,hub,reward}); }
  else { const fee=Math.round(rnd(1e6,4e6)/1e5)*1e5;
    mailPush(sender,'gov-tax',`Exonération des taxes d’aéroport en ${ccName(cc)}`,`Nous vous proposons une <b>réduction de 30 %</b> des taxes d’aéroport sur tous vos vols vers ${ccName(cc)} pendant 1 an, contre un droit d’entrée de <b>${fmtMoney(fee)}</b>.<br>— Président ${esc(g.leader)}`,[{k:'ok',l:`🤝 Payer ${fmtMoney(fee)}`},{k:'no',l:'Décliner'}],{cc,fee}); }
}
function govAnswer(m,k){
  if(k!=='ok') return 'Vous déclinez la proposition du gouvernement.';
  const g=govOf(m.cc);
  if(m.kind==='gov-open'){ S.govDeals=S.govDeals||[]; S.govDeals.push({cc:m.cc,hub:m.hub,reward:m.reward,until:S.time+60*DAY}); return `🏛️ Contrat signé : ouvrez une ligne vers ${keyCity(m.hub)} et volez-la 4 fois d’ici 60 jours pour toucher ${fmtMoney(m.reward)}.`; }
  if(m.kind==='gov-tax'){ if(S.cash<m.fee){ toast('Trésorerie insuffisante','bad'); return 'Trésorerie insuffisante.'; } book('taxes',-m.fee); g.feeCut=0.7; g.feeUntil=S.time+365*DAY; return `🤝 Taxes d’aéroport −30 % en ${ccName(m.cc)} pendant un an.`; }
  return '';
}
function govWeekly(){
  if(!S.ai) return; S.gov=S.gov||{};
  const ccs=govList(); for(const cc of ccs) govOf(cc);
  // quelques pays agissent chaque semaine
  const n=Math.min(ccs.length,3+Math.floor(Math.random()*3)); for(let i=0;i<n;i++) try{ govAction(pick(ccs)); }catch(e){ console.warn(e); }
  // contrats de désenclavement : on vérifie qu'une ligne vole vers le pays
  for(const d of S.govDeals||[]){ if(d.done||d.until<S.time) continue; const rt=S.routes.find(r=>r.stops.includes(d.hub)&&r.stats.flights>=4);
    if(rt){ d.done=true; book('subventions',d.reward); S.reputation=clamp(S.reputation+1.5,0,100); govNote(d.cc,`🏛️ ${ccName(d.cc)} verse ${fmtMoney(d.reward)} à ${S.company.name} pour la desserte de ${keyCity(d.hub)}.`,true); logMsg(`🏛️ Subvention de ${fmtMoney(d.reward)} versée par ${ccName(d.cc)}.`,'ok'); } }
  S.govDeals=(S.govDeals||[]).filter(d=>!d.done&&d.until>S.time);
}
{ const _aw=aiWeekly; aiWeekly=function(){ _aw(); try{ govWeekly(); }catch(e){ console.warn(e); } }; }

/* ---------- onglet « Pays » ---------- */
function govTabHtml(){
  const ccs=govList().filter(cc=>S.gov&&S.gov[cc]).sort((a,b)=>countryTraffic(b)-countryTraffic(a)).slice(0,40);
  const rows=ccs.map(cc=>{ const g=S.gov[cc], m=(S.ai.mood&&S.ai.mood[cc])||{}, fee=(g.feeUntil>S.time&&g.feeCut)?g.feeCut:g.fee;
    return `<tr><td>${COUNTRIES[cc][2]} ${esc(ccName(cc))}</td><td>${esc(g.leader)}<br><span class="small mut">${GOV_STYLES[g.style]}</span></td><td>${fee>1.02?`<span class="neg">taxes ×${fee.toFixed(2).replace('.',',')}</span>`:fee<0.98?`<span class="pos">taxes ×${fee.toFixed(2).replace('.',',')}</span>`:'taxes normales'}${m.tension>0.4?'<br>🟠 tendu':m.boom>0.4?'<br>🟢 en essor':''}</td></tr>`; }).join('');
  const log=ccs.flatMap(cc=>S.gov[cc].log.map(l=>({...l,cc}))).sort((a,b)=>b.t-a.t).slice(0,10);
  return `<div class="simplehelp">🏛️ Chaque pays a un président avec sa ligne politique : il commande des avions, change les taxes d’aéroport, signe des accords de ciel ouvert, ferme son espace aérien… ou vous propose des contrats (📬).</div>
    ${(S.govDeals||[]).length?`<div class="al ok">📜 Contrats d’État en cours : ${S.govDeals.map(d=>`${keyCity(d.hub)} (${fmtMoney(d.reward)}, ${Math.max(0,Math.ceil((d.until-S.time)/DAY))} j)`).join(' · ')}</div>`:''}
    <div class="tblwrap"><table class="tbl"><tr><th>Pays</th><th>Président</th><th>Politique</th></tr>${rows}</table></div>
    <h3>Dernières décisions</h3><div class="log">${log.map(l=>`<div class="lg"><span class="mut">${fmtDate(l.t)}</span> ${l.txt}</div>`).join('')||'<div class="mut small">Rien pour l’instant.</div>'}</div>`;
}
function registerGameplayActions(){ Object.assign(ACTIONS,{
  uneClose:()=>{ const el=$('#une'); if(el) el.hidden=true; if(UI.une) UI.une.list=[]; },
  uneOpen:()=>{ const n=UI.une&&UI.une.list[0]; UI.newsTab=n&&/président|gouvernement|ministre|état |ciel ouvert|taxe|🏛️/i.test(n.text)?'pays':n&&/accident|crash|victimes|💥|🔥/i.test(n.text)?'crash':'actu'; setTab('news'); if(typeof renderPanel==='function') renderPanel(); },
  // voir un décollage / atterrissage depuis la carte 2D ou la liste des vols : ouvre la 3D puis saute au moment
  watchGo:async d=>{ if(typeof fxAudioUnlock==='function') fxAudioUnlock(); if($('#globe').hidden){ const ok=await open3D(); if(!ok) return; } UI.fl=false; if(typeof renderFlightList==='function') renderFlightList(); setTimeout(()=>ACTIONS.watchEvent({k:d.k}),250); },
  accLevel:d=>{ S.accMult=+d.k; toast('⚠️ Accidents : '+(ACC_LEVELS.find(x=>x[1]===S.accMult)||['—'])[0],'info'); if(typeof renderPanel==='function') renderPanel(); } }); }
