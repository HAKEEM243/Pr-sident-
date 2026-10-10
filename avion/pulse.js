/* ============================================================
   LE POULS DU MONDE
   - chaque heure de jeu : 1 à 3 petits événements (retards, promos, pannes,
     records, nominations, météo…) dans le journal et le bandeau d'actualités
   - chaque semaine : les compagnies RÉAGISSENT à vous (guerre des prix,
     copie de vos lignes rentables, défense de leur hub, résultats financiers)
   ============================================================ */

/* ---------- aides ---------- */
const wpick=(items)=>{ let t=0; for(const it of items) t+=it.w; let r=Math.random()*t; for(const it of items){ r-=it.w; if(r<=0) return it; } return items[items.length-1]; };
function pickAir(filter){ const l=aiAlive().filter(filter||(()=>true)); if(!l.length) return null; return wpick(l.map(e=>({e,w:Math.pow(e.fleet,0.8)}))).e; }
// compagnie réellement présente dans un aéroport / aéroport réellement desservi par une compagnie (histoires plausibles)
function airAt(c){ const l=airlinesAt(c).slice(0,6).map(([k])=>aiBy(k)).filter(Boolean); return l.length?pick(l):null; }
function apOf(e){ const p=airlinePairs(e.code); return p.length? pick(pick(p)) : e.hub; }
// aéroport de déroutement réaliste : proche de la route
function divertTo(a,b){ const mid=gcInterp(AP(a),AP(b),rnd(0.25,0.75)); let best=null,bd=1e9; for(let i=0;i<120;i++){ const c=pick(AIRPORT_CODES); if(c===a||c===b||AP(c).cls<3) continue; const d=gcDist(mid,AP(c)); if(d<bd){ bd=d; best=c; } } return best||b; }
function pickAp(minT=1, filter){ for(let i=0;i<60;i++){ const c=pick(AIRPORT_CODES), a=AP(c); if(a.cls>=2&&a.traffic>=minT&&(!filter||filter(c))) return c; } return pick(AIRPORT_CODES); }
const FIRSTN={CD:['Fiston','Jean-Pierre','Patience','Gloria','Dieudonné','Rachel','Trésor','Merveille'],FR:['Camille','Antoine','Nathalie','Julien','Claire','Mathieu'],GB:['Oliver','Charlotte','James','Amelia','Harry'],US:['Michael','Jennifer','Robert','Linda','David'],DE:['Lukas','Anna','Felix','Katrin'],CN:['Wei','Li','Jing','Chen'],IN:['Rahul','Priya','Amit','Anjali'],AE:['Khalid','Fatima','Omar','Layla'],NG:['Chinedu','Ngozi','Emeka','Adaeze']};
const LASTN={CD:['Mulumba','Tshisekedi','Bokungu','Kabila','Mukendi','Ilunga'],FR:['Martin','Dubois','Lefèvre','Moreau'],GB:['Smith','Taylor','Brown','Wilson'],US:['Johnson','Miller','Davis','Clark'],DE:['Müller','Schmidt','Weber'],CN:['Wang','Zhang','Liu'],IN:['Sharma','Patel','Iyer'],AE:['Al Mansoori','Al Hashimi'],NG:['Okafor','Adeyemi','Balogun']};
function personName(cc){ const f=FIRSTN[cc]||FIRSTN.FR, l=LASTN[cc]||LASTN.FR; return pick(f)+' '+pick(l); }
const modelNameFor=e=>modelFor(e).name;
const hh=()=>S.ai.hourN||0;
function tag(a,b){ return touchesMe(a,b)? ' — sur votre marché' : ''; }
const CAUSE_DELAY=['orages','brouillard','vents violents','grève des bagagistes','panne informatique','neige','saturation du ciel','contrôle de sécurité renforcé'];
const CAUSE_DIV=['météo défavorable','un malaise d’un passager','une alerte technique mineure','une piste fermée','un oiseau dans un réacteur','un problème de pressurisation'];

/* ---------- catalogue des micro-événements ---------- */
const MICRO=[
 {id:'delay',w:12,cd:3,fn:()=>{ const c=pickAp(3), e=airAt(c)||pickAir(x=>x.fleet>=20); if(!e) return null; const n=rndi(8,60); const cause=pick(CAUSE_DELAY);
   return {text:vary('m_delay',[`⏱️ ${keyCity(c)} : ${n} vols retardés (${cause}), ${e.name} est la plus touchée.`,`⏱️ Retards en cascade à ${keyCity(c)} — ${cause}. ${e.name} annonce ${rndi(1,4)} h d’attente.`,`🌫️ ${keyCity(c)} : ${cause}, ${n} départs décalés.`])}; }},
 {id:'divert',w:7,cd:4,fn:()=>{ const e=pickAir(x=>x.fleet>=10); if(!e) return null; const pr=airlinePairs(e.code); if(!pr.length) return null; const [a,b]=pick(pr), c=divertTo(a,b);
   return {text:`🔀 Vol ${e.code}${rndi(100,999)} ${keyCity(a)}–${keyCity(b)} dérouté vers ${keyCity(c)} (${pick(CAUSE_DIV)}).`}; }},
 {id:'promo',w:9,cd:5,fn:()=>{ const e=pickAir(x=>x.fleet>=6); if(!e) return null; const pr=airlinePairs(e.code); if(!pr.length) return null; const [a,b]=pick(pr);
   const price=idealPrice(a,b,'y')*rnd(0.55,0.75); const ai=S.ai; (ai.promos=ai.promos||{})[e.code+pairKey(a,b)]={code:e.code,a,b,until:S.time+rndi(24,96)*HOUR};
   const mine=touchesMe(a,b); return {kind:mine?'rival':'news',text:`🏷️ ${e.name} brade ses prix : ${keyCity(a)}–${keyCity(b)} dès ${fmtMoney(price)}${tag(a,b)}.`}; }},
 {id:'record',w:5,cd:8,fn:()=>{ const e=pickAir(x=>x.fleet>=30); if(!e) return null; return {text:vary('m_rec',[`🏆 ${e.name} : record de ponctualité (${rndi(86,96)} %) ce mois-ci.`,`🏆 ${e.name} bat son record de passagers transportés en une journée.`,`🏆 Le classement des compagnies les plus ponctuelles couronne ${e.name}.`])}; }},
 {id:'terminal',w:4,cd:12,fn:()=>{ const c=pickAp(5); return {text:vary('m_term',[`🏗️ ${keyCity(c)} inaugure un nouveau terminal : capacité +${rndi(8,25)} %.`,`🏗️ ${keyCity(c)} : travaux de la piste terminés, le trafic reprend normalement.`,`📈 ${keyCity(c)} annonce un trafic record (${(AP(c).traffic*rnd(1.02,1.12)).toFixed(1)} M de passagers sur 12 mois).`])}; }},
 {id:'oil',w:6,cd:6,fn:()=>{ const d=S.oil-(S.ai.lastOil||S.oil); S.ai.lastOil=S.oil; if(Math.abs(d)<0.4) return {text:`⛽ Kérosène stable à ${S.oil.toFixed(0)} $ le baril.`};
   return {kind:d>0?'warn':'ok',text:d>0?`⛽ Le kérosène grimpe à ${S.oil.toFixed(0)} $ (+${d.toFixed(1)}) : les compagnies serrent les coûts.`:`⛽ Le kérosène recule à ${S.oil.toFixed(0)} $ (${d.toFixed(1)}) : bonne nouvelle pour les marges.`}; }},
 {id:'tech',w:8,cd:3,fn:()=>{ const e=pickAir(x=>x.fleet>=5); if(!e) return null; const c=apOf(e); const m=modelNameFor(e); return {text:`🔧 ${e.name} : un ${m} cloué au sol à ${keyCity(c)} (${pick(['panne hydraulique','capteur défectueux','fissure détectée en maintenance','problème de train d’atterrissage','alerte moteur'])}).`}; }},
 {id:'hire',w:4,cd:10,fn:()=>{ const e=pickAir(x=>x.fleet>=20); if(!e) return null; return {text:`👨‍✈️ ${e.name} recrute ${rndi(40,400)} pilotes et ${rndi(80,900)} personnels navigants pour la saison.`}; }},
 {id:'deliv',w:6,cd:5,fn:()=>{ const e=pickAir(x=>x.fleet>=8); if(!e) return null; e.fleet++; e.cash-=3e6; return {text:`🆕 ${e.name} réceptionne un ${modelNameFor(e)} neuf : flotte de ${e.fleet} appareils.`}; }},
 {id:'ceo',w:3,cd:30,fn:()=>{ const e=pickAir(x=>x.fleet>=25); if(!e) return null; const who=personName(e.cc); e.rep=clamp(e.rep+rnd(-2,3),10,95); return {text:vary('m_ceo',[`👔 ${e.name} nomme ${who} à sa direction générale.`,`👔 Changement de cap chez ${e.name} : ${who} prend la tête du groupe.`])}; }},
 {id:'angry',w:6,cd:6,fn:()=>{ const e=pickAir(x=>x.fleet>=15); if(!e) return null; const c=apOf(e); const n=rndi(6,45); e.rep=clamp(e.rep-rnd(0.5,2),10,95); return {kind:'warn',text:`😠 Passagers en colère à ${keyCity(c)} : ${e.name} annule ${n} vols, files d’attente devant les comptoirs.`}; }},
 {id:'bag',w:4,cd:8,fn:()=>{ const e=pickAir(x=>x.fleet>=20); if(!e) return null; return {text:`🧳 ${e.name} : ${rndi(300,4000)} bagages égarés après une panne du système de tri à ${keyCity(apOf(e))}.`}; }},
 {id:'lounge',w:3,cd:15,fn:()=>{ const e=pickAir(x=>x.fleet>=30); if(!e) return null; return {text:vary('m_prod',[`🥂 ${e.name} dévoile sa nouvelle classe affaires (lits plats sur ${rndi(6,40)} appareils).`,`📶 ${e.name} équipe sa flotte du Wi-Fi gratuit à bord.`,`🍽️ ${e.name} change de traiteur : nouveau menu signé par un chef étoilé.`])}; }},
 {id:'wx',w:8,cd:4,fn:()=>{ const W=(S.weather||[])[0]; if(W){ const near=AIRPORT_CODES.filter(c=>gcDist(AP(c),W)<W.r+60).sort((x,y)=>AP(y).traffic-AP(x).traffic)[0]; if(near) return {text:`🌩️ Cellule orageuse près de ${keyCity(near)} : les vols contournent la zone, +${rndi(10,35)} min de trajet.`}; }
   return {text:`🌦️ Météo : accalmie sur l’essentiel des routes, peu de perturbations ${pick(['en Europe','sur l’Atlantique Nord','en Afrique centrale','en Asie du Sud-Est'])}.`}; }},
 {id:'rumor',w:4,cd:10,fn:()=>{ const e=pickAir(x=>x.fleet>=30); if(!e) return null; return {text:vary('m_rum',[`🗞️ Selon la presse, ${e.name} hésiterait à passer une grosse commande d’avions.`,`🗞️ ${e.name} négocierait une nouvelle desserte de ${keyCity(pickAp(8))}.`,`🗞️ Des syndicats de ${e.name} demandent une revalorisation des salaires.`])}; }},
 {id:'sec',w:3,cd:12,fn:()=>{ const c=pickAp(5); return {text:vary('m_sec',[`🛃 Contrôles renforcés à ${keyCity(c)} : les voyageurs conseillés d’arriver 3 h à l’avance.`,`🛃 ${keyCity(c)} : un bagage suspect fait évacuer un terminal une heure.`])}; }},
 {id:'tourism',w:4,cd:10,fn:()=>{ const cc=pick(Object.keys(COUNTRIES).filter(k=>cAirports(k).length)); const c=mainAirport(cc); return {text:`📊 ${ccName(cc)} : le nombre de visiteurs internationaux ${Math.random()<0.5?'progresse':'recule'} de ${rndi(2,14)} % sur un an (${keyCity(c)}).`}; }},
 {id:'mine',w:7,cd:5,fn:()=>{ if(!S.routes.length) return null; const r=pick(S.routes), a=r.stops[0], b=r.stops[r.stops.length-1]; const cs=carriersOn(a,b); if(!cs.length) return {text:`📍 ${keyCity(a)}–${keyCity(b)} : vous êtes seul sur la ligne, la demande reste ${pick(['soutenue','stable','en légère hausse'])}.`};
   const c=aiBy(pick(cs)); return {kind:'rival',text:`📍 Sur ${keyCity(a)}–${keyCity(b)}, ${c?c.name:airlineName(cs[0])} ${pick(['ajoute un vol','change ses horaires','relève ses tarifs','remplace ses appareils par un modèle plus grand'])}.`}; }},
];
function microEvent(){
  const ai=S.ai, hr=hh(), cool=ai.cool||(ai.cool={});
  for(let t=0;t<10;t++){ const m=wpick(MICRO); if((cool[m.id]||-99)>hr-m.cd) continue; const r=m.fn(); if(!r) continue; cool[m.id]=hr; aiNews(r.text,r.kind||'news',true); return true; }
  return false;
}
function aiHourly(){
  if(!S.ai||!S.ai.list||!S.ai.news) return;
  S.ai.hourN=(S.ai.hourN||0)+1;
  const n=1+(Math.random()<0.55?1:0)+(Math.random()<0.2?1:0);
  for(let i=0;i<n;i++) microEvent();
  playerHourly();
  if(typeof paxCaseTick==='function') paxCaseTick();
  if(typeof chartersHourly==='function') chartersHourly();
  if(typeof ceoTick==='function') ceoTick();
  // promotions et guerres des prix expirées
  const ai=S.ai; for(const k of Object.keys(ai.promos||{})) if(ai.promos[k].until<S.time) delete ai.promos[k];
  for(const k of Object.keys(ai.wars||{})) if(ai.wars[k].until<S.time){ const w=ai.wars[k]; delete ai.wars[k]; aiNews(`🕊️ Fin de la guerre des prix ${keyCity(w.a)}–${keyCity(w.b)} : ${aiBy(w.code)?aiBy(w.code).name:w.code} remonte ses tarifs.`,'news',touchesMe(w.a,w.b)); }
}
// attractivité d'une compagnie sur une ligne en cas de promo / guerre des prix
function warFactor(code,a,b){
  const ai=S.ai; if(!ai) return 1; const k=code+pairKey(a,b); let f=1;
  const w=ai.wars&&ai.wars[k]; if(w&&w.until>S.time) f*=1.45;
  const p=ai.promos&&ai.promos[k]; if(p&&p.until>S.time) f*=1.15;
  return f;
}
function warNote(a,b){
  const ai=S.ai; if(!ai) return ''; const k=pairKey(a,b); const out=[];
  for(const w of Object.values(ai.wars||{})) if(w.until>S.time&&pairKey(w.a,w.b)===k) out.push(`⚔️ <b>Guerre des prix</b> : ${esc(aiBy(w.code)?aiBy(w.code).name:w.code)} casse ses tarifs jusqu’au ${fmtDate(w.until)}.`);
  for(const p of Object.values(ai.promos||{})) if(p.until>S.time&&pairKey(p.a,p.b)===k) out.push(`🏷️ Promotion en cours chez ${esc(aiBy(p.code)?aiBy(p.code).name:p.code)} jusqu’au ${fmtDate(p.until)}.`);
  return out.map(t=>`<div class="al warn">${t}</div>`).join('');
}

/* ---------- réactions des compagnies à votre jeu ---------- */
const personaOf=code=>LCC.has(code)?{k:'lcc',agg:0.75}:PREMIUM.has(code)?{k:'premium',agg:0.4}:(aiBy(code)&&aiBy(code).startup)?{k:'startup',agg:0.5}:{k:'legacy',agg:0.5};
function aiReact(){
  const ai=S.ai; ai.wars=ai.wars||{};
  for(const r of S.routes){
    if(!routeAircraft(r).length) continue;
    const a=r.stops[0], b=r.stops[r.stops.length-1], key=pairKey(a,b);
    let sh=0; try{ sh=legMarket(r,a,b).y.share; }catch(e){}
    const rivals=carriersOn(a,b).map(c=>aiBy(c)).filter(Boolean);
    // 1. guerre des prix : un rival agressif s'attaque à une ligne que vous dominez
    if(sh>0.3&&rivals.length&&Math.random()<0.12){
      const e=rivals.sort((x,y)=>personaOf(y.code).agg-personaOf(x.code).agg)[0];
      if(Math.random()<personaOf(e.code).agg&&!ai.wars[e.code+key]&&!(typeof isAlly==='function'&&(isAlly(e.code)||inTruce(e.code)))){
        ai.wars[e.code+key]={code:e.code,a,b,until:S.time+rndi(10,28)*DAY,kind:'prix'};
        aiNews(vary('war',[`⚔️ Guerre des prix : ${e.name} casse ses tarifs sur ${keyCity(a)}–${keyCity(b)}, face à vous. Votre part de marché va baisser.`,`⚔️ ${e.name} s’attaque à votre ligne ${keyCity(a)}–${keyCity(b)} avec des billets bradés.`,`⚔️ Offensive tarifaire de ${e.name} sur ${keyCity(a)}–${keyCity(b)} : à vous de répondre (prix, service ou fréquence).`]),'rival',true);
        continue; }
    }
    // 2. un rival copie votre ligne rentable
    const profit=r.stats.rev-r.stats.cost;
    if(r.stats.flights>=8&&profit>0&&Math.random()<0.08){
      const cand=aiAlive().filter(e=>e.fleet>=8&&!carriersOn(a,b).includes(e.code)&&dist(e.hub,a)<1200&&dist(a,b)<(e.fleet>=40?9000:3500));
      if(cand.length){ const e=pick(cand); (ai.extra[e.code]=ai.extra[e.code]||[]).push(key); e.routes++; ai.ver++;
        const R=(S.rivals||[]).find(x=>x.code===e.code); if(R&&!R.routes.some(x=>pairKey(x.a,x.b)===key)) R.routes.push({a,b,freq:2});
        aiNews(vary('copy',[`🎯 ${e.name} copie votre succès : une nouvelle ligne ${keyCity(a)}–${keyCity(b)} s’ouvre en concurrence directe.`,`🎯 Voyant votre ligne ${keyCity(a)}–${keyCity(b)} remplir ses avions, ${e.name} décide de s’y installer.`]),'rival',true); }
    }
    // 3. défense de hub : un rival dont le hub est une extrémité renforce ses vols
    const defenders=rivals.filter(e=>e.hub===a||e.hub===b);
    if(defenders.length&&Math.random()<0.08){ const e=pick(defenders), R=(S.rivals||[]).find(x=>x.code===e.code), tr=R&&R.routes.find(x=>pairKey(x.a,x.b)===key);
      if(tr&&tr.freq<8){ tr.freq++; ai.ver++; aiNews(`🛡️ ${e.name} défend son hub : un vol de plus par jour sur ${keyCity(a)}–${keyCity(b)}.`,'rival',true); } }
  }
  // résultats financiers trimestriels des plus grandes
  if(S.ai.lastMonth%3===0&&Math.random()<0.9){
    for(const e of aiAlive().sort((x,y)=>y.fleet-x.fleet).slice(0,40).filter(()=>Math.random()<0.12)){
      const base=e.qCash===undefined?e.cash:e.qCash, d=e.cash-base; e.qCash=e.cash;
      const rev=e.fleet*rnd(14e6,26e6)*0.25, margin=rev?d/rev:0;
      aiNews(d>=0?`📊 ${e.name} publie ses résultats : bénéfice de ${fmtMoney(Math.abs(d))} (marge ${(margin*100).toFixed(1).replace('.',',')} %).`:`📊 ${e.name} annonce une perte de ${fmtMoney(Math.abs(d))} ce trimestre.`, d>=0?'news':'warn', e.fleet>=60);
    }
  }
}

/* ---------- bandeau d'actualités (interface) ---------- */
let _tkAt=0;
// les grandes nouvelles (présidents, accidents, attaques des rivaux) passent toujours et restent « À la une »
const UNE_RX=/président|gouvernement|ministre|état |ciel ouvert|taxe|accident|crash|victimes|détruit|sortie de piste|tragédie|💥|🔥|🏛️|attaque|guerre des prix|rachète|commande record|alliance|faillite/i;
function tickerPush(text,kind,important){
  if(typeof UI==='undefined'||typeof document==='undefined') return;
  const big=important||kind==='bad'||kind==='rival'||UNE_RX.test(text);
  if(big) unePush(text,kind);
  if(UI.silent||big) return;                                          // les grandes nouvelles vont dans « À la une », pas en double ici
  const box=document.getElementById('ticker'); if(!box) return;
  const now=performance.now(); if(now-_tkAt<2500 && kind==='news' && !big) return; _tkAt=now;   // pas de clignotement en vitesse rapide
  const d=document.createElement('div'); d.className='tk '+(kind||'news'); d.textContent=text; d.onclick=()=>setTab('news');
  box.prepend(d); while(box.children.length>3) box.lastChild.remove();
  setTimeout(()=>d.classList.add('old'),9000); setTimeout(()=>{ d.remove(); },24000);
}

// bandeau « À la une » en haut de la carte : la dernière grande nouvelle reste affichée, même en vitesse rapide
function unePush(text,kind){
  const U=UI.une||(UI.une={list:[]}); U.list.unshift({text,kind,t:S.time}); if(U.list.length>6) U.list.length=6; U.at=performance.now(); U.dirty=true;
  if(!UI._uneT&&typeof document.getElementById==='function') UI._uneT=setTimeout(()=>{ UI._uneT=null; uneRender(); },UI.silent?600:0);
}
function uneRender(){
  const el=document.getElementById('une'), U=UI.une; if(!el||!U||!U.list.length){ if(el) el.hidden=true; return; }
  const n=U.list[0], more=U.list.length-1;
  el.className='une '+(n.kind||'news'); el.hidden=false;
  el.innerHTML=`<b data-act="uneOpen">À LA UNE</b><span data-act="uneOpen">${esc(n.text)}</span>${more>0?`<i data-act="uneOpen">+${more}</i>`:''}<button data-act="uneClose" aria-label="Fermer">✕</button>`;
  clearTimeout(UI._uneHide); UI._uneHide=setTimeout(()=>{ el.hidden=true; },60000);
}

/* ============================================================
   VOTRE COMPAGNIE AUSSI VIT À CHAQUE HEURE
   Pannes au sol, passagers célèbres, urgences médicales, turbulences,
   oiseaux dans un réacteur… + bilan quotidien dans le journal.
   ============================================================ */
function playerHourly(){
  if(!S.fleet||!S.fleet.length||S.fleet.length>400) return;
  for(const ac of S.fleet){
    const m=modelOf(ac), reg=ac.reg;
    if(ac.status==='flight'&&ac.flight){
      const leg=ac.flight.legs[ac.flight.li]; if(!leg||!leg.pax||Math.random()>0.0035) continue;
      const A=AP(leg.from), B=AP(leg.to), fn=S.company.code+(typeof flightNumber==='function'?flightNumber(ac):'');
      const r=Math.random();
      if(r<0.28){ const who=personName(A.cc), job=pick(['ministre','chanteur populaire','footballeur international','homme d’affaires','présentatrice télé','évêque','champion olympique']);
        S.reputation=clamp(S.reputation+0.15,0,100); logMsg(`🌟 ${who}, ${job}, voyage sur votre vol ${fn} (${A.city} → ${B.city}) : de la publicité gratuite.`,'ok'); }
      else if(r<0.52){ book('incidents',-rnd(4e3,15e3)); S.reputation=clamp(S.reputation+0.25,0,100);
        logMsg(`🩺 Vol ${fn} : un passager se sent mal ; ${pick(['un médecin à bord','l’équipage formé aux premiers secours'])} intervient. Pris en charge à l’arrivée à ${B.city}.`,'ok'); }
      else if(r<0.74){ S.reputation=clamp(S.reputation-0.1,0,100); logMsg(`🌀 Vol ${fn} : fortes turbulences au-dessus de ${pick(['la forêt équatoriale','les Alpes','l’océan','les montagnes','un orage'])}. Quelques passagers secoués, rien de grave.`,'warn'); }
      else if(r<0.9){ ac.condition=clamp(ac.condition-rnd(1,4),0,100); logMsg(`🐦 ${reg} : impact d’oiseau pendant l’approche vers ${B.city}. Inspection prévue à l’arrivée.`,'warn'); }
      else { S.reputation=clamp(S.reputation-0.2,0,100); logMsg(`😠 Vol ${fn} : un passager énervé fait un scandale à bord (${pick(['siège échangé','refus de boire','bagage cabine refusé'])}). L’équipage reprend la main.`,'warn'); }
    } else if(ac.status==='idle'&&(ac.readyAt||0)<=S.time&&Math.random()<0.0016){
      const h=rndi(3,14), cost=rnd(15e3,120e3)*(m.seats>=250?3:1);
      book('maintenance',-cost); ac.readyAt=S.time+h*HOUR;
      logMsg(`🔧 ${reg} (${m.name}) cloué au sol à ${AP(ac.loc).city} : ${pick(['panne hydraulique','capteur défectueux','pneu à remplacer','alerte moteur','porte de soute bloquée'])}. Réparé en ${h} h (${fmtMoney(cost)}).`,'warn');
    }
  }
}
function dailyDigest(){
  const d=S.led.day||{}, res=ledSum(d,1)+ledSum(d,-1); const sn=S.dayStat||{flights:S.stats.flights,pax:S.stats.pax};
  const fl=S.stats.flights-sn.flights, px=S.stats.pax-sn.pax; S.dayStat={flights:S.stats.flights,pax:S.stats.pax};
  if(!fl&&!S.fleet.length) return;
  logMsg(`📅 Bilan du jour : ${fl} vols, ${num0(px)} passagers, résultat ${res>=0?'+':''}${fmtMoney(res)}.`, res>=0?'ok':'warn');
}
