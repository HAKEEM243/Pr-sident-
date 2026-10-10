/* ============================================================
   MOTEUR DE SIMULATION — état, vols, économie, IA
   ============================================================ */
const SAVE_KEY = 'congo-airways-tycoon-v1';
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const SPEEDS = { realiste:{label:'Réaliste', mult:1}, standard:{label:'Standard', mult:60}, rapide:{label:'Rapide', mult:600}, x4:{label:'×4',mult:4,hide:1}, x16:{label:'×16',mult:16,hide:1}, turbo:{label:'Turbo', mult:3600}, ultra:{label:'Ultra', mult:28800} };
const PHASES = ['Embarquement','Roulage','Décollage','Montée','Croisière','Descente','Approche','Atterrissage','Arrivé'];
const CLASS_MULT = { f:6, j:3.5, w:1.7, y:1 };
const CLASS_SPACE = { f:3, j:2.2, w:1.3 };
const SERVICE_COST = [3,6,10,16,26]; // $ par passager et par heure de vol
const SERVICE_ATTR = [0.85,0.95,1.05,1.15,1.27];

let S = null; // état du jeu

/* ---------- utilitaires ---------- */
const rnd = (a,b)=>a+Math.random()*(b-a);
const rndi = (a,b)=>Math.floor(rnd(a,b+1));
const pick = arr=>arr[Math.floor(Math.random()*arr.length)];
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const uid = ()=>Math.random().toString(36).slice(2,9);
const toRad = d=>d*Math.PI/180, toDeg = r=>r*180/Math.PI;

function gcDist(a,b){
  const dLat=toRad(b.lat-a.lat), dLon=toRad(b.lon-a.lon);
  const h=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return 2*6371*Math.asin(Math.min(1,Math.sqrt(h)));
}
function gcInterp(a,b,f){
  const φ1=toRad(a.lat),λ1=toRad(a.lon),φ2=toRad(b.lat),λ2=toRad(b.lon);
  const d=gcDist(a,b)/6371;
  if(d<1e-9) return {lat:a.lat,lon:a.lon};
  const A=Math.sin((1-f)*d)/Math.sin(d), B=Math.sin(f*d)/Math.sin(d);
  const x=A*Math.cos(φ1)*Math.cos(λ1)+B*Math.cos(φ2)*Math.cos(λ2);
  const y=A*Math.cos(φ1)*Math.sin(λ1)+B*Math.cos(φ2)*Math.sin(λ2);
  const z=A*Math.sin(φ1)+B*Math.sin(φ2);
  return {lat:toDeg(Math.atan2(z,Math.sqrt(x*x+y*y))), lon:toDeg(Math.atan2(y,x))};
}
function bearing(a,b){
  const φ1=toRad(a.lat),φ2=toRad(b.lat),Δλ=toRad(b.lon-a.lon);
  const y=Math.sin(Δλ)*Math.cos(φ2), x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
  return (toDeg(Math.atan2(y,x))+360)%360;
}
// Points d'un grand cercle, longitudes « dépliées » pour ne pas couper l'antiméridien
function gcPath(a,b,refLon){
  const d=gcDist(a,b), n=Math.max(2,Math.ceil(d/150));
  const pts=[]; let prev = refLon ?? a.lon;
  for(let i=0;i<=n;i++){
    const p=gcInterp(a,b,i/n); let lon=p.lon;
    while(lon-prev>180) lon-=360; while(lon-prev<-180) lon+=360;
    pts.push([p.lat,lon]); prev=lon;
  }
  return pts;
}
const unwrapLon = (lon,ref)=>{ while(lon-ref>180) lon-=360; while(lon-ref<-180) lon+=360; return lon; };

const AP = code=>AIRPORTS[code];
const dist = (a,b)=>gcDist(AP(a),AP(b));
const isDrc = code=>AP(code)?.drc;
const continentOf = code=>COUNTRIES[AP(code).cc][1];

function getModel(id){ return MODELS.find(m=>m.id===id) || (S && S.customModels.find(m=>m.id===id)); }
const modelOf = ac=>getModel(ac.model);
const isCargo = m=>m.seats===0 && m.cargo>0;

/* ---------- temps ---------- */
const gameDate = t=>new Date(t);
const dayIndex = t=>Math.floor(t/DAY);
const monthKey = t=>{ const d=new Date(t); return d.getUTCFullYear()*12+d.getUTCMonth(); };
function fmtTime(t){ const d=new Date(t); return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0'); }
const MONTHS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
function fmtDate(t){ const d=new Date(t); return d.getUTCDate()+' '+MONTHS[d.getUTCMonth()]+' '+d.getUTCFullYear(); }
function fmtDur(ms){ ms=Math.max(0,ms); const h=Math.floor(ms/HOUR), m=Math.floor(ms%HOUR/MIN); if(h>=48) return Math.round(h/24)+' j'; return h? `${h} h ${String(m).padStart(2,'0')}` : `${m} min`; }

/* ---------- nouvelle partie ---------- */
function newGame(opts){
  const start = Date.UTC(2026,0,5,5,0);
  S = {
    time:start, startTime:start, speed:'standard', paused:false, lastReal:Date.now(),
    company:{ name:opts.name||'Sky Empire', code:(opts.code||'SE').toUpperCase().slice(0,3), color:opts.color||'#d4a72c', logo:opts.logo||'🐆', hub:opts.hub||'FIH' },
    cash:opts.capital||80e6, reputation:50, service:3,
    ancillary:{seat:true, bags:true, wifi:false, meals:false},
    oil:82, oilBase:82, fleet:[], customModels:[], pilots:[], candidates:[], cabinCrew:8, routes:[],
    v:2, simple:true, auto:{pil:true,pnc:true,meca:true,sol:true}, hubs:[opts.hub||'FIH'],
    fuel:{stock:400000, cap:1500000, auto:false, autoBelow:0.72, hist:[]},
    co2:{stock:300, cap:3000, price:85, base:85, hist:[]},
    staff:{pnc:8, meca:6, sol:18, sal:{pil:100,pnc:100,meca:100,sol:100}, morale:{pil:70,pnc:70,meca:70,sol:70}, strikeUntil:0},
    loans:[], campaigns:[], alliance:null, cargo:{offers:[], active:[], done:0},
    events:[], closed:[], history:[], log:[],
    led:{ day:{}, week:{}, prevWeek:{}, month:{}, prevMonth:{}, total:{} },
    stats:{ pax:0, flights:0, cargoT:0, incidents:0 },
    autoMaint:true, notifications:false, lastDay:dayIndex(start), lastMonth:monthKey(start),
    rivals:[], admin:false, seq:1,
  };
  const pack=START_PACKS[opts.pack||'regional'];
  S.packId=opts.pack||'regional';
  S.cash=pack.capital*(opts.diff||1);
  for(const id of pack.fleet) addAircraft(id,{owned:true});
  for(const [fam,n] of pack.pilots) for(let i=0;i<n;i++) S.pilots.push(makePilot([fam], true));
  Object.assign(S.staff, pack.staff);
  S.fuel.stock=Math.min(S.fuel.cap, pack.fuel);
  refreshCandidates();
  initRival();
  genCargoOffers(3);
  migrate();
  for(let i=0;i<6;i++) weatherTick();
  pushHistory();
  logMsg(`Bienvenue chez ${S.company.name} ! Votre hub est ${AP(S.company.hub).city} (${S.company.hub}).`,'ok');
  save();
}

const START_PACKS = {
  regional:{ name:'Compagnie régionale', desc:'1 ATR 72-600 + 1 Cessna Caravan · 6 pilotes', capital:80e6, fleet:['AT76','C208'], pilots:[['TURBO',6]], staff:{pnc:8,meca:6,sol:18}, fuel:400000 },
  national:{ name:'Compagnie nationale', desc:'2 Airbus A320neo + 1 ATR 72-600 · 14 pilotes', capital:150e6, fleet:['A20N','A20N','AT76'], pilots:[['A320',10],['TURBO',4]], staff:{pnc:16,meca:10,sol:26}, fuel:1000000 },
  major:{ name:'Grand transporteur', desc:'3 A320neo + 1 Boeing 787-9 · 22 pilotes', capital:350e6, fleet:['A20N','A20N','A20N','B789'], pilots:[['A320',14],['B787',8]], staff:{pnc:30,meca:14,sol:32}, fuel:1500000 },
};
const NAME_POOLS = {
  CD:[FIRST_NAMES_CD,LAST_NAMES_CD],
  AF:[['Kwame','Amina','Ibrahim','Fatou','Chinedu','Aïcha','Moussa','Grace','Tunde','Mariam','Kofi','Zainab'],['Okafor','Mensah','Diallo','Traoré','Ndiaye','Kamau','Mwangi','Adeyemi','Banda','Haile','Keita','Mbeki']],
  EU:[['Lucas','Emma','Thomas','Sofia','Marco','Anna','Jan','Elena','Pierre','Julia','Lars','Inès'],['Martin','Dubois','Müller','Rossi','García','Kowalski','Novak','Jansen','Lindqvist','Ferreira','Bernard','Schmidt']],
  AS:[['Wei','Yuki','Ravi','Aisha','Min-jun','Arjun','Mei','Omar','Hiroshi','Priya','Ahmed','Linh'],['Chen','Tanaka','Patel','Kim','Nguyen','Wang','Sato','Sharma','Haddad','Lee','Rahman','Singh']],
  NA:[['James','Emily','Michael','Olivia','Carlos','Sophia','Daniel','Grace','José','Chloe','Ethan','María'],['Johnson','Smith','Brown','Williams','Garcia','Martinez','Davis','Wilson','Lopez','Taylor','Moore','Clark']],
  SA:[['João','Ana','Mateo','Valentina','Pedro','Camila','Diego','Lucía','Rafael','Isabela','Santiago','Mariana'],['Silva','Santos','González','Rodríguez','Oliveira','Pérez','Costa','Fernández','Souza','Gómez','Lima','Torres']],
  OC:[['Jack','Mia','Oliver','Charlotte','Noah','Ruby','Liam','Isla','Tane','Aroha','Harry','Zoe'],['Smith','Jones','Williams','Brown','Wilson','Taylor','Ngata','Walker','White','Martin','Kelly','Ryan']],
};
const homeCC = ()=>S&&S.company? AP(S.company.hub).cc : 'CD';
function makePilot(quals, local){
  const cc=homeCC(), home = local || Math.random()<0.65;
  const pool = home? (NAME_POOLS[cc]||NAME_POOLS[COUNTRIES[cc][1]]||NAME_POOLS.EU) : NAME_POOLS[pick(['AF','EU','AS','NA','SA','OC'])];
  const name = `${pick(pool[0])} ${pick(pool[1])}`;
  const cd = home;
  const top = quals.reduce((m,q)=>Math.max(m,FAMILIES[q][3]),5000);
  return { id:uid(), name, nat: cd?cc:'INT', quals:[...quals], salary:Math.round(top*rnd(0.9,1.15)/100)*100, hours:rndi(1500,9000), training:null };
}
function refreshCandidates(){
  const famW = ['TURBO','TURBO','TURBO','CRJ','EMB','A220','A320','A320','B737','B737','B75X','A330','B787','A350','B777','B747','A380'];
  S.candidates = Array.from({length:6},()=>makePilot([pick(famW)]));
}

function nextReg(){
  const pre = COUNTRIES[AP(S.company.hub).cc][3];
  const n = S.seq++;
  const L='ABCDEFGHJKLMNPRSTUVWXYZ';
  return pre + (pre.endsWith('-')? '' : '') + 'C' + L[Math.floor(n/23)%23] + L[n%23];
}

function addAircraft(modelId, {owned=true, used=false, hub=null}={}){
  const m=getModel(modelId);
  const ac = {
    id:uid(), model:modelId, reg:nextReg(), name:'', owned, used,
    price: m.price*1e6*(used?0.55:1), lease: owned?0:Math.round(m.price*1e6*0.0085),
    bought:S.time, ageYears: used?12:0,
    hours: used?30000:0, cycles: used?15000:0, sinceA:used?300:0, sinceC:used?1500:0, sinceD:used?6000:0,
    condition: used?78:100, status:'idle', loc:S.company.hub, routeId:null, readyAt:S.time,
    flight:null, maintUntil:0, maintType:null, nextDir:1, hold:false,
    hub: hub||S.company.hub, cfg:{f:0,j:0}, plan:[], wk:{week:-1,c:{}}, pendingReturn:null,
  };
  ac.loc=ac.hub;
  S.fleet.push(ac);
  return ac;
}

/* ---------- registre comptable ---------- */
const LED_CATS = {
  billets:['Billets passagers',1], annexes:['Revenus annexes',1], cargo:['Fret & contrats cargo',1], ventes:['Ventes d’avions',1],
  carburant:['Carburant',-1], taxes:['Taxes aéroportuaires',-1], service:['Service à bord',-1], salaires:['Salaires',-1],
  leasing:['Leasing',-1], maintenance:['Maintenance',-1], interets:['Intérêts bancaires',-1], marketing:['Marketing',-1],
  alliance:['Cotisations alliance',-1], formation:['Formation',-1], incidents:['Incidents',-1], co2:['Quotas CO₂',-1], investissements:['Investissements aéroports',-1], licences:['Hubs & licences de lignes',-1], recrutement:['Recrutement',-1], admin:['Primes & bac à sable',1],
};
function book(cat, amount){ // montant signé : + revenu, - coût
  S.cash += amount;
  for(const k of ['day','week','month','total']){ const l=S.led[k]||(S.led[k]={}); l[cat]=(l[cat]||0)+amount; }
}
const ledSum = (l,sign)=>Object.entries(l).filter(([k])=>!['admin','ventes','investissements','licences'].includes(k)).reduce((s,[,v])=>s+(sign>0?Math.max(0,v):Math.min(0,v)),0);

function logMsg(text, kind='info'){
  S.log.unshift({t:S.time, text, kind});
  if(S.log.length>300) S.log.length=300;
  if(typeof onLog==='function') onLog(text, kind);
}

/* ---------- prix du carburant ---------- */
function oilMult(){ return S.events.reduce((m,e)=>m*(EV(e).oil||1),1); }
function fuelPrice(code){ // $ par litre
  let p = (S.oil/159*1.3 + 0.12)*(S.fuelDiscount&&S.fuelDiscount.until>S.time?S.fuelDiscount.f:1);
  if(code && !isDrc(code) && AP(code).traffic<0.15 && !AP(code).fuelDepot) p*=1.18; // petits aéroports isolés
  if(code && isDrc(code)){
    if(!['FIH','FBM','GOM','FKI'].includes(code) && !AP(code).fuelDepot) p*=1.35; // acheminement vers l'intérieur
    p *= S.events.reduce((m,e)=>m*(EV(e).drcFuel||1),1);
  }
  return p;
}
const EV = e=>EVENT_TYPES.find(t=>t.id===e.type)||{};

/* ---------- demande & parts de marché ---------- */
function seasonMult(t){ const m=new Date(t).getUTCMonth(); return [0.85,0.85,0.95,1.0,1.0,1.08,1.25,1.25,1.0,0.95,0.95,1.3][m]; }
function demandMult(a,b){
  let k = seasonMult(S.time);
  const A=AP(a), B=AP(b);
  if(typeof moodDemand==='function'&&S.ai) k*=Math.sqrt(moodDemand(A.cc)*moodDemand(B.cc));   // climat des pays (tension, essor)
  const domestic = A.drc&&B.drc, intl = A.cc!==B.cc, africa = continentOf(a)==='AF'&&continentOf(b)==='AF';
  for(const e of S.events){
    const t=EV(e);
    if(t.demand) k*=t.demand;
    if(t.regions && t.regionDemand){ if(t.regions.includes(A.prov)||t.regions.includes(B.prov)) k*=t.regionDemand; }
    const ccs=e.ccs||t.ccs; if(ccs && t.ccDemand && (ccs.includes(A.cc)||ccs.includes(B.cc))) k*=t.ccDemand;
    if(e.boostAirport && (a===e.boostAirport||b===e.boostAirport)) k*=t.boost||1.5;
  }
  for(const c of S.campaigns){
    const cp=CAMPAIGNS.find(x=>x.id===c.id); if(!cp) continue;
    const hc=homeCC();
    if(cp.scope==='all' || ((cp.scope==='home'||cp.scope==='drc')&&(A.cc===hc||B.cc===hc)) || (cp.scope==='intl'&&intl)) k*=1+cp.boost;
  }
  const cont=COUNTRIES[homeCC()][1], regional=continentOf(a)===cont&&continentOf(b)===cont;
  if(S.alliance){ const al=ALLIANCES.find(x=>x.id===S.alliance); if(al && (((al.scope==='africa'||al.scope==='region')&&regional&&intl)||(al.scope==='intl'&&intl))) k*=1+al.boost; }
  if(A.cc===B.cc && !A.drc) k*=1.2; // vols intérieurs
  if(S.codeshares && S.codeshares.length) for(const R of S.rivals||[]) if(S.codeshares.includes(R.code) && (a===R.hub||b===R.hub)) k*=1.15; // correspondances partenaires
  return k;
}
// Demande quotidienne totale (tous transporteurs) dans un sens
function marketDemand(a,b){
  const d=dist(a,b), A=AP(a), B=AP(b);
  const df = d<120?0.25 : d<300?0.8 : 1/(1+d/4500);
  let base = 230*Math.sqrt(A.traffic*B.traffic)*df;
  if(A.drc&&B.drc) base*=5; // routes quasi inexistantes : l'avion est vital en RDC
  else if(A.drc||B.drc) base*=1.3;
  if(A.terminal) base*=1.3; if(B.terminal) base*=1.3;
  return base*demandMult(a,b);
}
function baseFare(a,b){
  const d=dist(a,b);
  let f = d<3000 ? 30+0.11*d : 360+0.05*(d-3000);
  if(isDrc(a)&&isDrc(b)) f*=1.6; else if(isDrc(a)||isDrc(b)) f*=1.15;
  return f;
}
function ancillaryPenalty(){ const a=S.ancillary; return 1-(a.seat?0.02:0)-(a.bags?0.03:0)-(a.wifi?0.005:0)-(a.meals?(S.service>=4?0.04:0.01):0); }
function playerQuality(){ return (0.55+S.reputation/100)*SERVICE_ATTR[S.service-1]*ancillaryPenalty()*(S.loyalty?1.06:1); }
function rivalFreq(a,b){ return rivalsOn(a,b).reduce((s,x)=>s+x.freq,0); }
function rivalAttr(a,b){ return rivalsOn(a,b).reduce((s,x)=>s+x.R.quality*Math.sqrt(x.freq)*(typeof isPartner==='function'&&isPartner(x.R)?0.3:1)*(typeof warFactor==='function'?warFactor(x.R.code,a,b):1),0); }
function routeCycleHours(route, ac){
  const m=modelOf(ac); let h=0;
  for(let i=0;i<route.stops.length-1;i++){ const a=route.stops[i], b=route.stops[i+1], d=dist(a,b);
    h+=(legProfile(d,m,windKmh(a,b),a,b).total+legProfile(d,m,windKmh(b,a),b,a).total)/HOUR; }
  return h + 2*turnaround(m)/HOUR;
}
const MAX_WEEK_HOURS = 140; // heures de rotation programmables par avion et par semaine
const CLASS_NAMES={y:'Économique',j:'Affaires',f:'Première',c:'Fret'};
function routeAircraft(route){ return S.fleet.filter(ac=>(ac.plan||[]).some(p=>p.routeId===route.id)); }
function routeFreq(route){ // vols par jour et par sens, d'après le planning hebdomadaire
  let f=0; for(const ac of S.fleet) for(const p of ac.plan||[]) if(p.routeId===route.id) f+=p.weekly/7;
  return f;
}
function planHours(ac, plan=ac.plan){ let h=0; for(const p of plan||[]){ const r=S.routes.find(x=>x.id===p.routeId); if(r) h+=p.weekly*routeCycleHours(r,ac); } return h; }
function acSeats(ac){
  const m=modelOf(ac);
  if(isCargo(m)) return {f:0,j:0,w:0,y:0,total:0,cargo:m.cargo};
  const c=ac.cfg||{f:0,j:0};
  const f=Math.max(0,c.f|0), j=Math.max(0,c.j|0);
  const y=Math.max(0,m.seats-Math.round(f*CLASS_SPACE.f+j*CLASS_SPACE.j));
  const belly=+(m.seats*(m.seats>=150?0.04:0.012)).toFixed(1);
  return {f,j,w:0,y,total:f+j+y,cargo:belly};
}
function routeSeats(route, m){ const y=isCargo(m)?0:m.seats; return {f:0,j:0,w:0,y,total:y}; }
function classSplit(a,b){ const d=dist(a,b); const j=d>3000?0.12:d>1200?0.09:0.065; const f=d>4000?0.035:d>2000?0.015:0.004; return {y:1-j-f,j,f}; }
function idealPrice(a,b,k){ const y=baseFare(a,b); return k==='y'?y : k==='j'?y*3.2 : k==='f'?y*5.5 : 60+dist(a,b)*0.4; }
function cargoDemand(a,b){ return marketDemand(a,b)*0.012*cargoMult(a,b); }
function priceFactor(r){ return r<=1? 1+(1-r)*0.9 : Math.pow(r,-3); }
// Analyse d'un tronçon par classe : demande du marché, part captée, passagers par vol
function legMarket(route, a, b, freqOverride){
  const fp=Math.max(0.05, freqOverride ?? routeFreq(route));
  const base=marketDemand(a,b), split=classSplit(a,b), q=playerQuality(), rf=rivalFreq(a,b);
  // compagnies réelles présentes : elles remplacent une partie de la concurrence « anonyme »
  const attrC=Math.sqrt(Math.max(0.4,base/160))*(rf>0?0.55:1) + rivalAttr(a,b)*0.6;
  const transfer=connectingDemand(a,b);
  const out={freq:fp, rivalFreq:rf, market:base, transfer};
  let daily=0;
  for(const k of ['y','j','f','c']){
    const r=(route.pm&&route.pm[k])??route.price??1;
    const lounge=(k==='j'||k==='f')&&(AP(a).lounge||AP(b).lounge)?1.25:1;
    const D = k==='c'? cargoDemand(a,b) : base*split[k]*lounge;
    const attrP=q*Math.sqrt(fp)*priceFactor(r)*(k==='j'||k==='f'?SERVICE_ATTR[S.service-1]:1);
    const share=attrP/(attrP+attrC);
    let cap=D*(r<1?1+(1-r)*0.4:1)*share;
    if(k!=='c') cap+=transfer*split[k]*Math.min(1,share*1.5+0.2);
    out[k]={demand:D, share, daily:cap, perFlight:cap/fp, ideal:idealPrice(a,b,k), price:idealPrice(a,b,k)*r, ratio:r};
    if(k!=='c') daily+=cap;
  }
  out.share=out.y.share; out.daily=daily; out.perFlight=daily/fp;
  return out;
}
// Réseau du joueur : correspondances via les escales communes (effet hub)
function networkAdj(){
  const adj={};
  for(const r of S.routes){ if(!routeAircraft(r).length) continue;
    for(let i=0;i<r.stops.length-1;i++){ const a=r.stops[i], b=r.stops[i+1];
      (adj[a]=adj[a]||new Set()).add(b); (adj[b]=adj[b]||new Set()).add(a); } }
  return adj;
}
function connectingDemand(a,b){
  const adj=networkAdj(); let t=0;
  for(const c of adj[a]||[]) if(c!==b && !(adj[c]&&adj[c].has(b))) t+=marketDemand(c,b)*0.10;
  for(const c of adj[b]||[]) if(c!==a && !(adj[a]&&adj[a].has(c))) t+=marketDemand(a,c)*0.10;
  return t;
}
function sizingAdvice(perFlight, seats){
  if(!seats) return {cls:'ok', text:'Fret'};
  const r=perFlight/seats;
  if(r>1.4) return {cls:'warn', text:'Sous-capacité : ajoutez des vols ou un avion plus grand'};
  if(r>=0.72) return {cls:'ok', text:'Bien dimensionné'};
  if(r>=0.45) return {cls:'warn', text:'Un peu grand pour la demande'};
  return {cls:'bad', text:'Trop grand : remplissage faible'};
}

/* ---------- profil de vol ---------- */
function turnaround(m){ const s=Math.max(m.seats,m.cargo*3); return (s<60?30:s<200?45:s<350?70:90)*MIN; }
const _profCache=new Map();
// Roulage réaliste : plus long dans les grands aéroports encombrés (LHR, JFK, CDG ≈ 18-22 min)
function taxiTimes(a,b){
  const ta=(a&&AP(a)&&AP(a).traffic)||0, tb=(b&&AP(b)&&AP(b).traffic)||0;
  return [Math.round(clamp(7+ta*0.19,7,22)), Math.round(clamp(4+tb*0.09,4,11))];
}
function legProfile(d, m, w=0, a, b){
  w=Math.round(w||0); const tx=taxiTimes(a,b);
  const key=m.id+'|'+m.speed+'|'+Math.round(d*10)+'|'+w+'|'+tx;
  let c=_profCache.get(key); if(c) return c;
  if(_profCache.size>5000) _profCache.clear();
  c=computeProfile(d,m,w,tx); _profCache.set(key,c); return c;
}
function computeProfile(d, m, w=0, tx=[10,6]){
  // vent : moins fort à l'altitude des turbopropulseurs ; face au vent, les routes aériennes contournent le cœur du courant-jet
  const v=m.speed, turbo=m.fam==='TURBO', we=w*(turbo?0.55:1)*(w<0?0.75:1), vg=Math.max(v*0.5, v+we);
  const board=(Math.max(m.seats,m.cargo*3)<60?15:Math.max(m.seats,m.cargo*3)<200?25:40);
  const d0=d; d = d*1.03 + Math.min(25, d*0.08); // routes aériennes, départs (SID) et arrivées (STAR) : un peu plus long que l'orthodromie
  const taxiOut=tx[0], to=1.5, climb=turbo?14:(v>1500?28:20), desc=turbo?15:24, app=turbo?3.8:3.2, land=1.1, taxiIn=tx[1];
  const dTo=to/60*180, dClimb=climb/60*v*0.6, dDesc=desc/60*v*0.65, dApp=app/60*(turbo?250:320), dLand=land/60*150;
  const air=dTo+dClimb+dDesc+dApp+dLand;
  let f=1, cruiseD=d-air;
  if(cruiseD<0){ f=d/air; cruiseD=0; }
  const peak = m.alt*Math.min(1,0.25+f*0.9);
  const vApp = turbo?250:300;
  const raw=[
    [0,board,0,0,0,0,0,0],
    [1,taxiOut,0,0,0,0,0,25],
    [2,to,0,dTo*f,0,400,0,turbo?200:280],
    [3,climb*Math.max(f,0.35),dTo*f,(dTo+dClimb)*f,400,peak,turbo?200:280,v*0.85],
    [4,cruiseD/vg*60,(dTo+dClimb)*f,(dTo+dClimb)*f+cruiseD,peak,peak,v*0.85,v],
    [5,desc*Math.max(f,0.35),(dTo+dClimb)*f+cruiseD,(dTo+dClimb+dDesc)*f+cruiseD,peak,900,v,vApp+80],
    [6,app*Math.max(f,0.5),(dTo+dClimb+dDesc)*f+cruiseD,(dTo+dClimb+dDesc+dApp)*f+cruiseD,900,50,vApp+80,vApp-40],
    [7,land,(dTo+dClimb+dDesc+dApp)*f+cruiseD,d,50,0,vApp-40,40],
    [8,taxiIn,d,d,0,0,30,0],
  ];
  let t=0; const segs=[];
  for(const [ph,dur,d0_,d1,a0,a1,s0,s1] of raw){
    const ms=dur*MIN, k=d0/d; segs.push({ph,t0:t,t1:t+ms,d0:d0_*k,d1:d1*k,a0,a1,s0,s1}); t+=ms;
  }
  const airborne = segs.filter(s=>s.ph>=2&&s.ph<=7).reduce((s,x)=>s+(x.t1-x.t0),0);
  return {segs,total:t,airborne};
}
// Profil d'un tronçon avec les attentes imposées par la tour de contrôle :
// hOut = attente au point d'arrêt avant la piste, hIn = circuit d'attente avant l'approche
const _profH=new WeakMap();
function legProf(leg,m){
  const base=legProfile(leg.dist,m,leg.wind,leg.from,leg.to), ho=leg.hOut||0, hi=leg.hIn||0;
  if(!ho&&!hi) return base;
  const c=_profH.get(leg); if(c&&c.k===m.id+'|'+ho+'|'+hi) return c.p;
  const segs=[]; let sh=0;
  for(const sg of base.segs){
    if(sg.ph===6&&hi){ segs.push({ph:6,hold:'in',t0:sg.t0+sh,t1:sg.t0+sh+hi,d0:sg.d0,d1:sg.d0,a0:sg.a0,a1:sg.a0,s0:sg.s0,s1:sg.s0}); sh+=hi; }
    segs.push({...sg,t0:sg.t0+sh,t1:sg.t1+sh});
    if(sg.ph===1&&ho){ segs.push({ph:1,hold:'out',t0:sg.t1+sh,t1:sg.t1+sh+ho,d0:0,d1:0,a0:0,a1:0,s0:0,s1:0}); sh+=ho; }
  }
  const p={segs,total:base.total+ho+hi,airborne:base.airborne+hi};
  _profH.set(leg,{k:m.id+'|'+ho+'|'+hi,p}); return p;
}
const legEnd=(leg,m)=>leg.dep+legProf(leg,m).total;
// État instantané d'un avion en vol
function flightState(ac, t=S.time){
  const fl=ac.flight; if(!fl) return null;
  let leg=fl.legs[fl.li]; if(!leg) return null;
  const m=modelOf(ac), prof=legProf(leg,m);
  const rel=clamp(t-leg.dep,0,prof.total);
  let seg=prof.segs.find(s=>rel<s.t1) || prof.segs[prof.segs.length-1];
  const u = seg.t1>seg.t0 ? clamp((rel-seg.t0)/(seg.t1-seg.t0),0,1) : 1;
  // profil physique : au décollage, roulage en accélérant puis rotation ; à l'atterrissage, arrondi, toucher puis freinage
  let uD=u, alt=seg.a0+(seg.a1-seg.a0)*u, spd=seg.s0+(seg.s1-seg.s0)*u;
  if(seg.ph===2){ const R=0.45; if(u<R){ const k=u/R; uD=0.4*k*k; alt=0; spd=seg.s1*0.95*k; } else { const k=(u-R)/(1-R); uD=0.4+0.6*k; alt=seg.a1*Math.pow(k,1.3); spd=seg.s1*(0.95+0.05*k); } }
  else if(seg.ph===7){ uD=1-(1-u)*(1-u); alt=u<0.12? seg.a0*Math.pow(1-u/0.12,1.6) : 0; }
  const dd = seg.d0+(seg.d1-seg.d0)*uD;
  const A=AP(leg.from), B=AP(leg.to);
  const frac = leg.dist>0? clamp(dd/leg.dist,0,1) : 1;
  // trajectoire réelle : roulage vers la piste, décollage dans l'axe, route orthodromique, approche dans l'axe de la piste d'arrivée
  const path=legPath(leg,m); let pp;
  let holding=null, pushback=false;
  if(seg.hold==='out'){ const gp=gateSlot(leg.from,ac), left=seg.t1-rel;
    if(left<25000&&path.dep){ const h0=holdPoint(path,gp,0), k=1-left/25000; pp=polyAt([h0,path.dep.thr,destPt(path.dep.thr.lat,path.dep.thr.lon,path.dep.hdg,0.03)],k*0.9); spd=15; }   // s'aligne sur la piste
    else { pp=holdPoint(path,gp,Math.min(6,left/(2*MIN))); spd=0; }
    holding='out'; }
  else if(seg.hold==='in'){ // circuit d'attente : virages à droite autour d'un point près de l'approche
    const f=pointOnPath(path,clamp(seg.d0/leg.dist,0,1)*path.total), r=4.5, dur=seg.t1-seg.t0, orbits=Math.max(1,Math.round(dur/(4*MIN)));
    const c=destPt(f.lat,f.lon,(f.hdg||0)+90,r), b0=bearing(c,f), th=360*orbits*u, q=destPt(c.lat,c.lon,b0+th,r);
    pp={lat:q.lat,lon:q.lon,hdg:(b0+th+90)%360}; holding='in'; alt=seg.a0+Math.min(1830,305*(seg.t1-rel)/(4*MIN))*Math.min(1,(rel-seg.t0)/60000); }
  else if(seg.ph<=1){ const gp=gateSlot(leg.from,ac); if(seg.ph===0) pp=gp; else { const pts=taxiOutPts(path,gp); if(leg.hOut&&pts.length>2) pts.splice(-2,2,holdPoint(path,gp,Math.min(6,leg.hOut/(2*MIN))));
      // repoussage : le tracteur pousse l'avion en arrière (≈ 90 s), puis l'avion tourne vers le taxiway
      const pb=Math.min(0.3,90000/Math.max(1,seg.t1-seg.t0)), g0=gp.hdg||0, P1=destPt(gp.lat,gp.lon,g0+180,0.055);
      if(u<pb){ const k=u/pb, e=k*k*(3-2*k), q=destPt(gp.lat,gp.lon,g0+180,0.055*e), tgt=pts[1]?bearing(P1,pts[1]):g0, dh=((tgt-g0+540)%360)-180;
        pp={lat:q.lat,lon:q.lon,hdg:(g0+dh*Math.max(0,(k-0.5)*2)+360)%360}; spd=5; pushback=true; }
      else pp=polyAt([P1,...pts.slice(1)],(u-pb)/(1-pb)); } }
  else if(seg.ph>=8){ const gp=gateSlot(leg.to,ac); pp = rel>=prof.total? gp : polyAt(taxiInPts(path,gp), u); }
  else pp = pointOnPath(path, frac*path.total);
  const p={lat:pp.lat, lon:pp.lon}, hdg=pp.hdg;
  const totalDist = fl.legs.reduce((s,l)=>s+l.dist,0);
  const doneDist = fl.legs.slice(0,fl.li).reduce((s,l)=>s+l.dist,0)+dd;
  const last=fl.legs[fl.legs.length-1];
  const eta = legEnd(last,m);
  const phase = rel>=prof.total? 8 : seg.ph;
  return { lat:p.lat, lon:unwrapLon(p.lon, A.lon), hdg, alt, spd,
    phase, frac, progress: totalDist? doneDist/totalDist : 1, eta, leg, holding, pushback, holdEnd:holding?leg.dep+seg.t1:0, from:leg.from, to:leg.to, origin:fl.legs[0].from, dest:last.to,
    wind:leg.wind||0, gs:seg.ph===4? Math.max(0,spd+(leg.wind||0)) : spd, depRwy:path.dep&&path.dep.id, arrRwy:path.arr&&path.arr.id, remain:Math.max(0,totalDist-doneDist) };
}

/* ---------- équipage ---------- */
let _qp={t:-1,n:-1,m:{}};
function qualifiedPilots(fam){ // mis en cache : avec des milliers de pilotes, on ne recompte qu'une fois par pas de simulation
  if(_qp.t!==S.time||_qp.n!==S.pilots.length){ _qp={t:S.time,n:S.pilots.length,m:{}}; }
  return _qp.m[fam]!==undefined? _qp.m[fam] : (_qp.m[fam]=S.pilots.filter(p=>p.quals.includes(fam)&&!p.training).length);
}
function activeOfFamily(fam, except){ return S.fleet.filter(a=>a!==except && a.status==='flight' && modelOf(a)?.fam===fam).length; }
const cabinNeed = m=>isCargo(m)?0:Math.max(1,Math.ceil(m.seats/50));
function cabinBusy(except){ return S.fleet.filter(a=>a!==except&&a.status==='flight').reduce((s,a)=>s+cabinNeed(modelOf(a)),0); }
function crewCheck(ac){
  const m=modelOf(ac);
  if(qualifiedPilots(m.fam) < 2*(activeOfFamily(m.fam,ac)+1)) return `Pas assez de pilotes qualifiés ${m.fam} (2 par avion en vol)`;
  if(cabinBusy(ac)+cabinNeed(m) > S.staff.pnc) return 'Pas assez de personnel navigant commercial (PNC)';
  return null;
}

/* ---------- dispatch ---------- */
function legsFor(stops){ const L=[]; for(let i=0;i<stops.length-1;i++) L.push({from:stops[i],to:stops[i+1],dist:dist(stops[i],stops[i+1]),wind:windKmh(stops[i],stops[i+1])}); return L; }
function checkLegs(ac, legs){
  const m=modelOf(ac);
  for(const l of legs){
    if(l.dist>m.range) return `Tronçon ${l.from}→${l.to} (${Math.round(l.dist)} km) hors autonomie (${m.range} km)`;
    for(const c of [l.from,l.to]){
      const rw=runwayCheck(m,c); if(rw) return rw;
      if(airportClosed(c)) return `Aéroport ${AP(c).city} (${c}) fermé`;
    }
  }
  return null;
}
function airportClosed(code){
  if(S.closed.includes(code)) return true;
  if(S.ai&&S.ai.shut&&S.ai.shut[code]>S.time) return true;
  if(S.events.some(e=>EV(e).closeLaterite) && AP(code).surface==='Latérite') return true;
  return false;
}
function canFly(ac){
  if(ac.status==='maint') return 'En maintenance';
  if(ac.status==='flight') return 'Déjà en vol';
  if(ac.condition<15) return 'Condition technique critique : maintenance obligatoire';
  return crewCheck(ac);
}
function startFlight(ac, stops, kind, t, extra={}){
  const legs=legsFor(stops); const m=modelOf(ac);
  const err = canFly(ac) || checkLegs(ac,legs);
  if(err) return err;
  let dep=Math.max(t, ac.readyAt||0);
  const route = extra.routeId? S.routes.find(r=>r.id===extra.routeId) : null;
  for(const l of legs){
    l.dep=dep; if(typeof atcPlanLeg==='function') atcPlanLeg(l,m,ac); dep+=legProf(l,m).total;
    if(kind==='route'&&route){
      const mk=legMarket(route,l.from,l.to), seats0=acSeats(ac), n=()=>rnd(0.86,1.12), pf=payloadFactor(m,l.dist);
      const seats={...seats0, y:Math.floor(seats0.y*pf), j:Math.floor(seats0.j*Math.min(1,pf+0.15)), f:seats0.f, cargo:seats0.cargo*pf};
      if(!isCargo(m)){
        l.pax={ f:Math.min(seats.f,Math.round(mk.f.perFlight*n())), j:Math.min(seats.j,Math.round(mk.j.perFlight*n())), w:0,
                y:clamp(Math.round(mk.y.perFlight*n()),Math.min(2,seats.y),seats.y) };
        l.share=mk.share;
      }
      l.cargo=+Math.min(seats.cargo, mk.c.perFlight*n()).toFixed(1);
    }
  }
  ac.flight={kind, routeId:extra.routeId||null, dir:extra.dir||1, contractId:extra.contractId||null, legs, li:0, next:extra.next||null};
  ac.status='flight';
  return null;
}
function dispatchRoute(ac, r, dir, t=S.time){
  if(!r) return 'Ligne introuvable';
  const stops = dir>0? r.stops : [...r.stops].reverse();
  if(ac.loc!==stops[0]) return `L’avion est à ${ac.loc}, pas à ${stops[0]} — repositionnez-le`;
  const err=startFlight(ac, stops, 'route', t, {routeId:r.id, dir});
  if(!err) ac.nextDir=-dir;
  return err;
}
function ferry(ac, to, t=S.time, next=null){
  if(ac.loc===to) return 'Déjà sur place';
  const m=modelOf(ac);
  let stops=[ac.loc,to];
  if(dist(ac.loc,to)>m.range){ // escale technique automatique
    const mid = AIRPORT_CODES.filter(c=>AP(c).cls>=m.cls && dist(ac.loc,c)<=m.range && dist(c,to)<=m.range)
      .sort((x,y)=>(dist(ac.loc,x)+dist(x,to))-(dist(ac.loc,y)+dist(y,to)))[0];
    if(!mid) return 'Destination hors de portée, même avec une escale';
    stops=[ac.loc,mid,to];
  }
  return startFlight(ac, stops, 'ferry', t, {next});
}

/* ---------- arrivée d'un tronçon ---------- */
function completeLeg(ac){
  const fl=ac.flight, leg=fl.legs[fl.li], m=modelOf(ac), prof=legProf(leg,m);
  const hrs=prof.airborne/HOUR, arr=leg.dep+prof.total;
  const route=fl.routeId? S.routes.find(r=>r.id===fl.routeId):null;
  let rev=0, cost=0;
  // coûts
  const litres = m.burn*hrs*(m.custom?1.05:1);
  consumeFuel(litres, leg.from); consumeCO2(litres*0.00076);
  cost += litres*fuelPrice(leg.from) + litres*0.00076*S.co2.price;
  const B=AP(leg.to), size=Math.max(m.seats,m.cargo*3)/100;
  let fees = [0,60,150,300,550,900][B.cls]*Math.max(0.25,size);
  const paxCount = leg.pax? leg.pax.f+leg.pax.j+leg.pax.w+leg.pax.y : 0;
  fees += paxCount*(AP(leg.from).cc!==B.cc?22:7);
  if(S.events.some(e=>e.type==='insecurity') && ['Nord-Kivu','Ituri','Sud-Kivu'].includes(B.prov)) fees*=1.5;
  book('taxes',-fees); cost+=fees;
  const upkeep = Math.max(m.seats,m.cargo*3)*1.4*hrs*(1+staffShortage('meca'));
  book('maintenance',-upkeep); cost+=upkeep;
  // revenus
  if(fl.kind==='route' && route){
    if(leg.pax){
      const pr=k=>idealPrice(leg.from,leg.to,k)*((route.pm&&route.pm[k])??1);
      const tix = leg.pax.f*pr('f')+leg.pax.j*pr('j')+leg.pax.y*pr('y');
      const a=S.ancillary;
      const anc = paxCount*((a.seat?6*0.3:0)+(a.bags?25*0.35:0)+(a.wifi&&hrs>1.5?9*0.18:0)+(a.meals&&S.service<4?11*0.3:0));
      const svc = paxCount*SERVICE_COST[S.service-1]*Math.max(0.5,hrs) + (leg.pax.f*60+leg.pax.j*30)*Math.max(0.5,hrs);
      book('billets',tix); book('annexes',anc); book('service',-svc);
      rev+=tix+anc; cost+=svc;
      S.stats.pax+=paxCount;
      route.stats.pax+=paxCount; route.stats.seats+=acSeats(ac).total; route.stats.shareSum+=leg.share||0; route.stats.shareN++;
    }
    if(leg.cargo){ const c=leg.cargo*idealPrice(leg.from,leg.to,'c')*((route.pm&&route.pm.c)??1); book('cargo',c); rev+=c; S.stats.cargoT+=leg.cargo; route.stats.cargoT=(route.stats.cargoT||0)+leg.cargo; }
    route.stats.flights++; route.stats.rev+=rev; route.stats.cost+=cost;
    route.stats.recent.push(rev-cost); if(route.stats.recent.length>12) route.stats.recent.shift();
  }
  if(fl.kind==='cargo' && fl.contractId && fl.li===fl.legs.length-1){
    const c=S.cargo.active.find(x=>x.id===fl.contractId);
    if(c){
      const late = arr>c.deadline;
      const pay = late? c.reward*0.5 : c.reward;
      book('cargo',pay); rev+=pay; S.stats.cargoT+=c.tons; S.cargo.done++;
      S.cargo.active=S.cargo.active.filter(x=>x!==c);
      logMsg(`📦 Contrat livré : ${c.tons} t ${c.from}→${c.to} — ${fmtMoney(pay)}${late?' (retard, pénalité 50 %)':''}`, late?'warn':'ok');
      if(!late) S.reputation=clamp(S.reputation+0.5,0,100);
    }
  }
  if(fl.kind==='charter'&&typeof charterLegDone==='function') rev+=charterLegDone(ac,fl,leg,arr);
  S.stats.flights++;
  // usure
  ac.hours+=hrs; ac.cycles++; ac.sinceA+=hrs; ac.sinceC+=hrs; ac.sinceD+=hrs;
  const overdue = maintOverdue(ac);
  ac.condition=clamp(ac.condition-(hrs*(overdue?0.06:0.02)+0.03)*(1+staffShortage('meca')),0,100);
  ac.loc=leg.to;
  // retards : orages à l'arrivée, congestion des grands aéroports
  let delay=0;
  const storm=stormAt(B.lat,B.lon);
  if(storm){ delay+=rnd(10,40)*storm.power*(B.ils?0.4:1); const hold=m.burn*0.55*delay/60*fuelPrice(leg.to); book('carburant',-hold); cost+=hold; }
  if(B.cls>=5) delay+=Math.random()<0.3? rnd(0,18):0;
  if(delay>0) ac.readyAt=Math.max(ac.readyAt||0, arr+delay*MIN);
  if(fl.kind==='route'){ if(delay>15){ S.stats.late=(S.stats.late||0)+1; } else S.stats.onTime=(S.stats.onTime||0)+1; }
  if(delay>15 && route) route.stats.late=(route.stats.late||0)+1;
  // incidents
  let pInc = 0.0015 + (100-ac.condition)/100*0.02 + (overdue?0.03:0);
  if(S.recallRisk && S.recallRisk.fam===m.fam && S.time<S.recallRisk.until) pInc*=4;
  if(Math.random()<pInc) incident(ac, arr);
  if(typeof onFlightDone==='function') onFlightDone(ac,leg,{delay,rev,cost,route,paxCount,hrs});
  // tronçon suivant
  fl.li++;
  if(fl.li>=fl.legs.length){
    const next=fl.next; ac.flight=null; ac.status=ac.status==='flight'?'idle':ac.status;
    ac.readyAt=Math.max(ac.readyAt||0, arr+turnaround(m)*(1+staffShortage('sol')));
    if(next && next.kind==='cargo'){ const c=S.cargo.active.find(x=>x.id===next.contractId); if(c) startFlight(ac,[c.from,c.to],'cargo',ac.readyAt,{contractId:c.id}); }
  }
}
function incident(ac, t){
  const m=modelOf(ac);
  const types=[
    ['Panne technique au sol', 0.2, 6],
    ['Impact d’oiseau', 0.4, 12],
    ['Panne moteur, retour au parking', 1.0, 36],
    ['Problème hydraulique', 0.6, 24],
  ];
  const [name,sev,hours]=pick(types);
  const cost=(20000+m.price*1e6*0.002)*sev;
  book('incidents',-cost);
  S.reputation=clamp(S.reputation-1.2*sev,0,100);
  ac.readyAt=Math.max(ac.readyAt||0,t)+hours*HOUR;
  ac.condition=clamp(ac.condition-5*sev,0,100);
  S.stats.incidents++;
  logMsg(`⚠️ Incident ${ac.reg} (${m.name}) : ${name}. Coût ${fmtMoney(cost)}, immobilisé ${hours} h.`,'bad');
  notify('Incident technique', `${ac.reg} : ${name}`);
}

/* ---------- maintenance ---------- */
function maintDue(ac){ const d=[]; for(const k of ['D','C','A']) if(ac['since'+k]>=MAINT[k].every*0.9) d.push(k); return d; }
function maintOverdue(ac){ return ['A','C','D'].some(k=>ac['since'+k]>MAINT[k].every); }
function startMaint(ac, type, t=S.time){
  if(ac.status!=='idle') return 'L’avion doit être au sol et disponible';
  const m=modelOf(ac), base=AP(ac.loc)&&AP(ac.loc).mbase, cost=MAINT[type].cost(m)*(base?0.65:1);
  book('maintenance',-cost);
  ac.status='maint'; ac.maintType=type; ac.maintUntil=Math.max(t,ac.readyAt||0)+MAINT[type].days*(base?0.6:1)*DAY;
  return null;
}
function finishMaint(ac){
  const k=ac.maintType;
  if(k==='D'){ ac.sinceD=0; ac.sinceC=0; ac.sinceA=0; ac.condition=100; }
  else if(k==='C'){ ac.sinceC=0; ac.sinceA=0; ac.condition=clamp(ac.condition+25,0,100); }
  else { ac.sinceA=0; ac.condition=clamp(ac.condition+6,0,100); }
  ac.status='idle'; ac.readyAt=ac.maintUntil; ac.maintType=null;
  logMsg(`🔧 ${ac.reg} : ${MAINT[k].label} terminé. Condition ${Math.round(ac.condition)} %.`,'ok');
}

/* ---------- valeur ---------- */
function acAgeYears(ac){ return ac.ageYears + (S.time-ac.bought)/(365*DAY); }
function acValue(ac){ const m=modelOf(ac); return m.price*1e6*Math.pow(0.94,acAgeYears(ac))*(0.5+ac.condition/200)*(ac.used?0.6:1); }
function fleetValue(){ return S.fleet.filter(a=>a.owned).reduce((s,a)=>s+acValue(a),0); }
function debt(){ return S.loans.reduce((s,l)=>s+l.remaining,0); }
function netWorth(){ return S.cash+fleetValue()-debt()+(typeof holdingsValue==='function'?holdingsValue():0); }

/* ---------- boucle de simulation ---------- */
function advance(dtGame){
  let target=S.time+dtGame;
  while(S.time<target){
    const step=Math.min(5*MIN, target-S.time);
    S.time+=step;
    simStep();
    const di=dayIndex(S.time);
    while(S.lastDay<di){ S.lastDay++; dailyTick(); }
  }
}
function weekIndex(t){ return Math.floor((t+3*DAY)/(7*DAY)); }
function weekStart(t){ return weekIndex(t)*7*DAY-3*DAY; }
/* ---------- calendrier des vols : jours et heures de départ ---------- */
const WEEK_DAYS=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const SLOT_HOURS=[6.5,7.25,8.5,9.75,11,12.5,14,15.5,17,18.25,19.5,21];
const slotHash=str=>{ let h=17; for(const c of str) h=(h*33+c.charCodeAt(0))%100003; return h; };
// créneaux de départ (heure locale du hub, en ms depuis lundi 00:00) : chaque avion a ses propres jours et heures
function planSlots(ac,p){
  const w=Math.max(1,p.weekly), h=slotHash(ac.id+'|'+p.routeId), out=[], base=SLOT_HOURS[h%SLOT_HOURS.length]+((h>>4)%3)*0.25;
  if(w<=7){ const off=(h>>2)%7; for(let k=0;k<w;k++) out.push(((Math.floor(k*7/w)+off)%7)*DAY+base*HOUR); }
  else { const n=Math.ceil(w/7), step=Math.max(3,Math.floor(15/n)); for(let k=0;k<w;k++){ const d=k%7, i=Math.floor(k/7); out.push(d*DAY+Math.min(23,base-4+i*step+((h>>3)%2)*0.5)*HOUR+(base%1)*HOUR); } }
  return out.sort((a,b)=>a-b);
}
// fuseau du hub (décalage UTC réel de l'aéroport) ; l'embarquement dure `boardMs` avant l'heure de départ affichée
const hubTz=ac=>{ const A=AP(ac.hub); if(!A) return 0; return (A.utc!==undefined&&A.utc!==null&&A.utc!==''?+A.utc:A.lon/15)*HOUR; };
function boardMs(ac,r){ const m=modelOf(ac), a=r.stops[0], b=r.stops[1], sg=legProfile(dist(a,b),m,windKmh(a,b),a,b).segs[0]; return sg.t1-sg.t0; }
// heures de départ (départ du poste, repoussage) de la semaine locale du hub qui contient t, en temps absolu
function planSlotTimes(ac,p,t){ const tz=hubTz(ac), ws=weekStart(t+tz)-tz; return planSlots(ac,p).map(x=>ws+x); }
const fmtSlot=x=>{ const m=Math.round(x/MIN), d=Math.floor(m/1440)%7, mm=m%1440; return `${WEEK_DAYS[d]} ${String(Math.floor(mm/60)).padStart(2,'0')}:${String(mm%60).padStart(2,'0')}`; };
// résumé lisible du calendrier (heure locale du hub)
function planText(ac,p){ const sl=planSlots(ac,p), days=[...new Set(sl.map(x=>Math.floor(x/DAY)))], hh=x=>fmtSlot(x).slice(4);
  if(sl.length>=7&&days.length===7){ const per=sl.length/7; const times=[...new Set(sl.map(hh))]; return per===1?`chaque jour à ${times[0]}`:`${Math.round(per)}×/jour : ${times.slice(0,4).join(' · ')}`; }
  return sl.map(fmtSlot).join(' · '); }
function scheduleAircraft(ac, t, dep){
  if(ac.pendingReturn){
    const r=S.routes.find(x=>x.id===ac.pendingReturn);
    if(r && ac.loc===r.stops[r.stops.length-1] && ac.loc!==ac.hub){
      const err=dispatchRoute(ac,r,-1,dep); ac.blocked=err||null; if(!err) ac.pendingReturn=null; return;
    }
    ac.pendingReturn=null;
  }
  if(ac.loc!==ac.hub){ const e=ferry(ac,ac.hub,dep); ac.blocked=e&&e!=='Déjà sur place'?e:null; return; }
  if((S.staff.strikeUntil||0)>t){ ac.blocked='Grève du personnel : vols annulés'; return; }
  const wk=weekIndex(t+hubTz(ac)); if(!ac.wk||ac.wk.week!==wk) ac.wk={week:wk,c:{}};
  let best=null, bestAt=Infinity;
  for(const p of ac.plan){
    const done=ac.wk.c[p.routeId]||0; if(done>=p.weekly) continue;
    const r0=S.routes.find(x=>x.id===p.routeId); if(!r0) continue;
    const std=planSlotTimes(ac,p,t)[done]; if(std===undefined) continue;   // heure de départ du poste prévue
    const at=std-boardMs(ac,r0);                                          // début de l'embarquement : le départ du poste tombe pile à l'heure
    if(at>t) continue;                                                    // pas encore l'heure
    if(at<bestAt){ bestAt=at; best=p; }
  }
  if(!best){ ac.blocked=null; return; }
  const r=S.routes.find(x=>x.id===best.routeId);
  if(!r){ ac.plan=ac.plan.filter(x=>x!==best); return; }
  const err=dispatchRoute(ac,r,1,Math.max(dep,bestAt)); ac.blocked=err||null;
  if(!err){ ac.wk.c[r.id]=(ac.wk.c[r.id]||0)+1; if(r.stops[r.stops.length-1]!==ac.hub) ac.pendingReturn=r.id; }
}
function simStep(){
  const t=S.time;
  const wki=weekIndex(t);
  if(S.lastWeek===undefined) S.lastWeek=wki;
  if(S.lastWeek!==wki){ S.lastWeek=wki; weeklyTick(); }
  const hr=Math.floor(t/HOUR);
  if((S.wxHour||0)!==hr){ S.wxHour=hr; weatherTick(); if(typeof aiHourly==='function') aiHourly(); }
  for(const ac of S.fleet){
    // arrivées
    let guard=0;
    while(ac.flight && guard++<20){
      const leg=ac.flight.legs[ac.flight.li];
      const arr=legEnd(leg,modelOf(ac));
      if(arr<=t) completeLeg(ac); else break;
    }
    if(ac.status==='maint' && ac.maintUntil<=t) finishMaint(ac);
    if(ac.status!=='idle' || (ac.readyAt||0)>t) continue;
    // maintenance automatique
    if(S.autoMaint){
      const due=['D','C','A'].find(k=>ac['since'+k]>=MAINT[k].every*0.97);
      if(due){ startMaint(ac,due,t); continue; }
    }
    // charter réservé : priorité dès que l'avion est libre à sa base
    if(ac.charterQ && typeof charterQueued==='function' && charterQueued(ac,t)) continue;
    // planning hebdomadaire
    if(ac.plan && ac.plan.length && !ac.hold) scheduleAircraft(ac, t, Math.max(t-5*MIN, ac.readyAt||0));
  }
}

function dailyTick(){
  const t=S.time;
  // salaires, moral et grèves
  book('salaires',-monthlyPayroll()/30);
  if(typeof autoManage==='function') autoManage(); // mode simple : personnel, carburant et programmation automatiques
  staffDaily();
  const lease=S.fleet.filter(a=>!a.owned).reduce((s,a)=>s+a.lease,0);
  if(lease) book('leasing',-lease/30);
  // formations
  for(const p of S.pilots) if(p.training && p.training.until<=t){
    p.quals.push(p.training.fam); logMsg(`🎓 ${p.name} est désormais qualifié(e) ${FAMILIES[p.training.fam][0]}.`,'ok');
    p.salary=Math.max(p.salary, FAMILIES[p.training.fam][3]); p.training=null;
  }
  // campagnes
  S.campaigns=S.campaigns.filter(c=>c.until>t);
  // événements
  const before=S.events.length;
  S.events=S.events.filter(e=>e.until>t);
  if(S.events.length<before) recomputeClosed();
  for(const et of EVENT_TYPES){
    if(S.events.some(e=>e.type===et.id)) continue;
    let p=et.p;
    if(et.drc && !S.hubs.some(isDrc) && !S.routes.some(r=>r.stops.some(isDrc))) p*=0.15; // actualité congolaise surtout si vous y êtes
    if(et.winter){ const mo=new Date(S.time).getUTCMonth(); if(mo>2&&mo<10) p=0; }
    if(Math.random()<p) triggerEvent(et.id);
  }
  // réputation
  const fleetCond = S.fleet.length? S.fleet.reduce((s,a)=>s+a.condition,0)/S.fleet.length : 80;
  const base = 25 + S.service*9 + (fleetCond-70)*0.4 + S.campaigns.reduce((s,c)=>s+(CAMPAIGNS.find(x=>x.id===c.id)?.rep||0),0) + (S.alliance?5:0);
  const target = 0.55*base + 0.45*satisfaction();
  // projets d'aéroports
  S.projects=S.projects||[];
  for(const pr of S.projects.filter(p=>p.until<=t)){
    (S.upgrades[pr.code]=S.upgrades[pr.code]||[]).push(pr.type); applyUpgrades();
    logMsg(`🏗️ ${UPGRADES[pr.type].name} terminé à ${AP(pr.code).city} !`,'drc'); notify('Chantier terminé', `${UPGRADES[pr.type].name} — ${AP(pr.code).city}`);
  }
  S.projects=S.projects.filter(p=>p.until>t);
  S.reputation=clamp(S.reputation+(target-S.reputation)*0.02,0,100);
  // recrutement
  if(dayIndex(t)%7===0) refreshCandidates();
  // cargo
  S.cargo.offers=S.cargo.offers.filter(o=>o.expires>t);
  for(const c of S.cargo.active){ if(c.deadline<t && !c.lateWarned){ c.lateWarned=true; logMsg(`📦 Contrat ${c.from}→${c.to} en retard !`,'warn'); } }
  if(S.cargo.offers.length<6 && Math.random()<0.5) genCargoOffers(rndi(1,2));
  // rival
  rivalTick();
  // mois
  const mk=monthKey(t);
  if(mk!==S.lastMonth){ S.lastMonth=mk; monthlyTick(); }
  if(typeof businessDaily==='function') businessDaily();
  checkMissions();
  pushHistory();
  if(typeof dailyDigest==='function') dailyDigest();
  S.led.day={};
  // alertes
  if(S.cash<0) notify('Trésorerie négative', `Votre capital est de ${fmtMoney(S.cash)}. Empruntez ou réduisez les coûts.`);
  if(!S.autoMaint){ const due=S.fleet.filter(a=>maintOverdue(a)); if(due.length) notify('Maintenance en retard', `${due.length} avion(s) dépassent leur échéance d’entretien.`); }
}
function monthlyTick(){
  if(typeof businessMonthly==='function') businessMonthly();
  for(const l of S.loans){
    const interest=l.remaining*l.rate/12;
    const princ=Math.min(l.remaining, l.monthly-interest);
    book('interets',-interest); S.cash-=princ; l.remaining-=princ; l.monthsLeft--;
  }
  S.loans=S.loans.filter(l=>l.remaining>1);
  if(S.alliance){ const al=ALLIANCES.find(x=>x.id===S.alliance); book('alliance',-al.fee); }
  S.led.prevMonth=S.led.month; S.led.month={};
}
function pushHistory(){
  S.history.push({t:S.time, cash:Math.round(S.cash), net:Math.round(netWorth()), rev:Math.round(ledSum(S.led.day,1)), cost:Math.round(-ledSum(S.led.day,-1))});
  if(S.history.length>400) S.history.splice(0,S.history.length-400);
}

/* ---------- événements ---------- */
function triggerEvent(id){
  const et=EVENT_TYPES.find(e=>e.id===id); if(!et) return;
  const e={type:id, until:S.time+rndi(et.days[0],et.days[1])*DAY};
  if(et.closeRandom){ e.airport=pick(AIRPORT_CODES.filter(c=>AP(c).cls>=4 && c!==S.company.hub)); }
  if(et.closeZone){ const z=AIRPORT_CODES.filter(c=>et.closeZone(AP(c))); if(!z.length) return; e.airports=[]; for(let i=0;i<(et.closeCount||2)&&z.length;i++) e.airports.push(z.splice(Math.floor(Math.random()*z.length),1)[0]); }
  if(et.closeNear){ const c0=pick(et.closeNear.filter(c=>AIRPORTS[c])); e.airports=AIRPORT_CODES.filter(c=>dist(c0,c)<et.radius); e.center=c0; }
  if(et.boostRandom){ e.boostAirport=pick(AIRPORT_CODES.filter(c=>AP(c).traffic>=15)); }
  if(et.ccsRandom){ e.ccs=[pick([...new Set(AIRPORT_CODES.filter(c=>AP(c).traffic>=3).map(c=>AP(c).cc))])]; }
  S.events.push(e); recomputeClosed();
  S.oil=+(S.oilBase*oilMult()).toFixed(2);
  const where=e.airport?` (${AP(e.airport).city})` : e.airports?` (${e.airports.slice(0,3).map(c=>AP(c).city).join(', ')}${e.airports.length>3?'…':''})` : e.boostAirport?` à ${AP(e.boostAirport).city}` : e.ccs&&et.ccsRandom?` : ${COUNTRIES[e.ccs[0]][0]}`:'';
  e.where=where;
  logMsg(`${et.icon} ${et.name}${where} — ${et.desc}`, et.drc?'drc':'warn');
  notify(et.name+where, et.desc);
}
function recomputeClosed(){
  S.closed=[];
  for(const e of S.events){ const t=EV(e); if(t.close) S.closed.push(...t.close); if(e.airport) S.closed.push(e.airport); if(e.airports) S.closed.push(...e.airports); }
}

/* ---------- cargo ---------- */
function cargoMult(a,b){ let k=1; for(const e of S.events){ const t=EV(e); if(t.cargo && (t.regions.includes(AP(a).prov)||t.regions.includes(AP(b).prov))) k*=t.cargo; } return k; }
function genCargoOffers(n){
  const drcCodes=AIRPORT_CODES.filter(c=>isDrc(c));
  const inDrc = (S.hubs||[]).some(isDrc);
  const hubs=(S.hubs&&S.hubs.length)?S.hubs:[S.company.hub];
  const bigs=AIRPORT_CODES.filter(c=>AP(c).traffic>=10);
  const near=h=>AIRPORT_CODES.filter(c=>c!==h&&AP(c).cls>=3&&dist(h,c)<3000);
  const world=[
    ()=>{ const h=pick(hubs); return [h, pick(near(h).length?near(h):bigs), pick(['Pièces automobiles','Électronique','Produits frais','Courrier express','Textiles','Médicaments']), rnd(5,40)]; },
    ()=>{ const h=pick(hubs); return [pick(near(h).length?near(h):bigs), h, pick(['Fleurs coupées','Poissons & fruits de mer','Fruits tropicaux','Produits pharmaceutiques']), rnd(5,30)]; },
    ()=>{ const a=pick(bigs), b=pick(bigs.filter(c=>c!==a)); return [a,b,pick(['Fret général','E-commerce','Machines industrielles','Composants aéronautiques']),rnd(20,100)]; },
    ()=>{ const a=pick(hubs), b=pick(AIRPORT_CODES.filter(c=>AP(c).cls<=2&&dist(a,c)<2500)); return b?[a,b,'Aide humanitaire (ONG)',rnd(2,8)]:[a,pick(bigs),'Fret général',rnd(10,40)]; },
  ];
  const templates=inDrc?[...world,
    ()=>[pick(['KWZ','FBM']), pick(['DAR','JNB','LUN','NLA']), 'Cuivre & cobalt', rnd(10,60)],
    ()=>[pick(['FIH','FBM','GOM']), pick(drcCodes.filter(c=>AP(c).cls<=2)), 'Aide humanitaire (ONG)', rnd(2,8)],
    ()=>[pick(['FIH','GOM','BKY','BUX']), pick(['FKI','BNC','KND','FMI','MDK']), 'Médicaments & vaccins', rnd(1,6)],
    ()=>[pick(['CDG','BRU','DXB','IST','JNB']), pick(['FIH','FBM']), 'Biens de consommation', rnd(15,90)],
    ()=>[pick(['FIH','MJM','KGA']), pick(['BRU','DXB','JNB']), 'Diamants & café', rnd(1,10)],
    ()=>[pick(['GOM','BKY']), pick(['FIH','NBO','EBB']), 'Café du Kivu & thé', rnd(5,20)],
  ]:world;
  for(let i=0;i<n;i++){
    const [from,to,goods,tons]=pick(templates)();
    if(from===to) continue;
    const d=dist(from,to), t=Math.round(tons);
    const hum = /humanitaire|Médicaments/.test(goods);
    S.cargo.offers.push({ id:uid(), from, to, goods, tons:t, reward:Math.round(t*d*rnd(1.0,1.4)*(hum?1.6:1)+15000), deadline:S.time+rndi(3,10)*DAY, expires:S.time+rndi(3,7)*DAY, rep:hum?2:0 });
  }
}
function acceptCargo(offerId, acId){
  const o=S.cargo.offers.find(x=>x.id===offerId), ac=S.fleet.find(x=>x.id===acId);
  if(!o||!ac) return 'Introuvable';
  const m=modelOf(ac);
  if(m.cargo<o.tons) return `Capacité insuffisante (${m.cargo} t < ${o.tons} t)`;
  if(ac.plan&&ac.plan.length) return 'Videz d’abord le planning de cet avion';
  const legErr=checkLegs(ac, legsFor([o.from,o.to])); if(legErr) return legErr;
  const err=canFly(ac); if(err) return err;
  S.cargo.offers=S.cargo.offers.filter(x=>x!==o);
  S.cargo.active.push(o);
  if(o.rep) S.reputation=clamp(S.reputation+o.rep,0,100);
  if(ac.loc===o.from) return startFlight(ac,[o.from,o.to],'cargo',S.time,{contractId:o.id});
  const e=ferry(ac,o.from,S.time,{kind:'cargo',contractId:o.id});
  if(e){ S.cargo.active=S.cargo.active.filter(x=>x!==o); S.cargo.offers.push(o); }
  return e;
}

/* ---------- compagnies concurrentes (IA) ---------- */
const AI_MAJORS = [
  {name:'Atlantica Global', code:'AG', color:'#3b82f6', hub:'JFK'},
  {name:'EuroSky', code:'ES', color:'#8b5cf6', hub:'FRA'},
  {name:'Gulf Star', code:'GS', color:'#d97706', hub:'DXB'},
  {name:'Pacific Crown', code:'PC', color:'#14b8a6', hub:'SIN'},
  {name:'Jade Sky', code:'JS', color:'#ef4444', hub:'PEK'},
  {name:'Andes Air', code:'AA', color:'#22c55e', hub:'GRU'},
  {name:'Sahara Wings', code:'SW', color:'#f97316', hub:'ADD'},
];
const R0 = ()=>S.rivals&&(S.rivals.find(R=>R.local)||null); // compagnie nationale concurrente (aucune si le pays n'en a pas)
function makeRival(t, local){
  const R={ name:t.name, code:t.code, color:t.color, hub:t.hub, local:!!local, cash:local?140e6:900e6, fleet:local?7:60, quality:local?0.95:1.05, rep:local?55:68, paxDay:0, revDay:0, routes:[] };
  const H=AP(t.hub), maxD=local?2500:7000;
  const cands=AIRPORT_CODES.filter(c=>c!==t.hub && AP(c).cls>=3 && dist(t.hub,c)<maxD && dist(t.hub,c)>150)
    .map(c=>({c, s:marketDemand(t.hub,c)*(local&&AP(c).cc===H.cc?2:1)})).sort((x,y)=>y.s-x.s).slice(0, local?6:10);
  for(const x of cands) R.routes.push({a:t.hub,b:x.c,freq:rndi(1,local?3:4)});
  return R;
}
function initRivals(){
  if(typeof initRealRivals==='function' && typeof AIRLINE_DB!=='undefined') return initRealRivals();
  const H=AP(S.company.hub);
  // rival local : le plus grand autre aéroport du pays (ou de la région)
  let lh=AIRPORT_CODES.filter(c=>c!==S.company.hub && AP(c).cc===H.cc && AP(c).cls>=3).sort((x,y)=>AP(y).traffic-AP(x).traffic)[0];
  if(!lh) lh=AIRPORT_CODES.filter(c=>c!==S.company.hub && AP(c).cls>=3).sort((x,y)=>dist(S.company.hub,x)-dist(S.company.hub,y))[0];
  const localName = (H.cc==='CD'?'StarWing Airways':`StarWing ${COUNTRIES[H.cc][0]}`);
  S.rivals=[makeRival({name:localName, code:'SW', color:'#e5484d', hub:lh}, true)];
  for(const t of AI_MAJORS) if(t.hub!==S.company.hub) S.rivals.push(makeRival(t,false));
}
function initRival(){ initRivals(); }
function rivalTick(){ for(const R of S.rivals||[]) rivalStep(R); }
const _rdem=new WeakMap(); // demande des lignes concurrentes, recalculée une fois par semaine (évite les à-coups)
function rivalStep(R){
  let pax=0, rev=0;
  for(const r of R.routes){
    let c=_rdem.get(r); const wk=Math.floor((S.time+((r.a.charCodeAt(2)+r.b.charCodeAt(2))%7)*DAY)/(7*DAY)); // recalcul étalé sur la semaine
    if(!c||c.wk!==wk||c.f!==r.freq){
      const d=dist(r.a,r.b), dem=marketDemand(r.a,r.b)+marketDemand(r.b,r.a), seats = d<1200?70:d<4000?180:300;
      const p=Math.min(seats*r.freq*2*0.85, dem*0.3); c={wk, f:r.freq, p, rev:p*baseFare(r.a,r.b)}; _rdem.set(r,c);
    }
    pax+=c.p; rev+=c.rev;
  }
  const profit = rev*rnd(0.02,0.12);
  R.cash+=profit; R.paxDay=Math.round(pax); R.revDay=Math.round(rev);
  R.rep=clamp(R.rep+rnd(-0.6,0.7),30,92); R.quality=0.75+R.rep/200;
  // compagnies réelles : réseau réel ; elles renforcent leurs vols quand vous les attaquez sur leurs lignes
  if(R.real){
    if(Math.random()<0.05){
      const hit=S.routes.filter(r=>routeAircraft(r).length).map(r=>R.routes.find(x=>(x.a===r.stops[0]&&x.b===r.stops[1])||(x.a===r.stops[1]&&x.b===r.stops[0]))).filter(Boolean);
      if(hit.length){ const ex=pick(hit); if(ex.freq<12){ ex.freq++; R._v=(R._v||0)+1; logMsg(`🛩️ ${R.name} ajoute un vol sur ${AP(ex.a).city} – ${AP(ex.b).city} (votre ligne !).`,'rival'); } }
    }
    return;
  }
  // expansion : le rival local copie vos lignes, les majors s'attaquent à celles proches de leur hub
  if(R.cash>50e6 && Math.random()<(R.local?0.12:0.06)){
    let a,b;
    const player=S.routes.filter(r=>r.stops.length>=2 && (R.local || r.stops.some(c=>dist(c,R.hub)<3000)));
    if(player.length && !(typeof isPartner==='function'&&isPartner(R)) && Math.random()<(R.local?0.55:0.3)){ const r=pick(player); a=r.stops[0]; b=r.stops[1]; }
    else { a=R.hub; const opts=AIRPORT_CODES.filter(c=>c!==R.hub && AP(c).cls>=3 && dist(R.hub,c)<(R.local?4000:9000) && AP(c).traffic>=1); if(!opts.length) return; b=pick(opts); }
    const ex=R.routes.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));
    if(ex) ex.freq=Math.min(6,ex.freq+1); else R.routes.push({a,b,freq:1});
    R.cash-=40e6; R.fleet++;
    const mine=S.routes.some(r=>r.stops.includes(a)&&r.stops.includes(b));
    if(R.local || mine) logMsg(`🛩️ ${R.name} ${ex?'renforce':'ouvre'} la ligne ${AP(a).city} – ${AP(b).city}${mine?' (votre ligne !)':''}.`,'rival');
  }
  if(R.cash<0 && R.routes.length>2){ R.routes.sort((x,y)=>x.freq-y.freq).shift(); R.fleet=Math.max(3,R.fleet-1); R.cash+=25e6; }
}
if(typeof rivalsOn!=='function') var rivalsOn=function(a,b){ const out=[]; for(const R of S.rivals||[]) for(const r of R.routes) if((r.a===a&&r.b===b)||(r.a===b&&r.b===a)) out.push({R,freq:r.freq}); return out; };

/* ---------- météo : cellules orageuses ---------- */
function stormAt(lat,lon){ for(const c of S.weather||[]){ if(gcDist(c,{lat,lon})<c.r) return c; } return null; }
function marketTick(){
  // kérosène : cotation horaire ; quotas CO₂ : marché carbone
  S.oilBase=clamp(S.oilBase+(82-S.oilBase)*0.002+rnd(-0.45,0.45),45,140);
  S.oil=+(S.oilBase*oilMult()).toFixed(2);
  const c=S.co2; c.base=clamp(c.base+(85-c.base)*0.003+rnd(-0.7,0.7),40,160); c.price=+c.base.toFixed(2);
  const h=Math.floor(S.time/HOUR);
  if(h%6===0){ S.fuel.hist.push({t:S.time,p:+fuelPrice().toFixed(4)}); c.hist.push({t:S.time,p:c.price}); if(S.fuel.hist.length>120) S.fuel.hist.shift(); if(c.hist.length>120) c.hist.shift(); }
  if(S.fuel.auto && fuelPrice()<=S.fuel.autoBelow && S.fuel.stock<S.fuel.cap*0.95){
    const need=S.fuel.cap-S.fuel.stock; if(S.cash>need*fuelPrice()*1.5) buyFuel(need, true);
  }
}
function weatherTick(){
  marketTick();
  S.weather=(S.weather||[]).filter(c=>c.until>S.time);
  for(const c of S.weather){ c.lat+=c.vlat; c.lon+=c.vlon; c.r=clamp(c.r+rnd(-4,4),20,140); }
  const utcH=new Date(S.time).getUTCHours();
  const spawn=(lat0,lat1,lon0,lon1,big)=>{
    const lon=rnd(lon0,lon1), local=(utcH+lon/15+24)%24;
    const conv = local>=13&&local<=21 ? 1 : 0.35; // orages tropicaux surtout l'après-midi
    if(Math.random()>conv) return;
    S.weather.push({id:uid(), lat:rnd(lat0,lat1), lon, r:rnd(30,big?120:70), vlat:rnd(-0.15,0.15), vlon:rnd(-0.5,-0.05), power:rnd(0.6,1.4), until:S.time+rndi(3,9)*HOUR});
  };
  const n=S.weather.length;
  if(n<45){
    for(let i=0;i<2;i++) spawn(-10,6,13,31,true);          // bassin du Congo (très orageux)
    spawn(-15,15,-80,150,false); spawn(-15,15,-80,150,false); // zone de convergence intertropicale
    if(Math.random()<0.4) spawn(30,60,-120,40,true);        // fronts des latitudes moyennes
  }
}
function satisfaction(){
  const on=S.stats.onTime||0, late=S.stats.late||0, punct = on+late? on/(on+late) : 0.9;
  const cond = S.fleet.length? S.fleet.reduce((s,a)=>s+a.condition,0)/S.fleet.length : 85;
  let p=0,se=0; for(const r of S.routes){ p+=r.stats.pax; se+=r.stats.seats; } const lf=se?p/se:0.7;
  const age = S.fleet.length? S.fleet.reduce((s,a)=>s+acAgeYears(a),0)/S.fleet.length : 0;
  let v = 52 + (S.service-3)*11 + (punct-0.85)*90 + (cond-80)*0.35 - Math.max(0,lf-0.92)*80 - age*0.6
    - (S.ancillary.bags?3:0) - (S.ancillary.seat?2:0) + (S.ancillary.wifi?2:0);
  return clamp(v,0,100);
}
function punctuality(){ const on=S.stats.onTime||0, late=S.stats.late||0; return on+late? on/(on+late) : 1; }

/* ---------- investissements aéroportuaires ---------- */
const AP_BASE = JSON.parse(JSON.stringify(AIRPORTS));
const UPGRADES = {
  pave:{name:'Bitumer la piste', icon:'🛣️', days:60, cost:a=>8e6, can:a=>a.surface==='Latérite', desc:'Asphalte : plus de fermeture pendant les pluies, classe 2 minimum (ATR 72, Dash 8).', apply:a=>{ a.surface='Asphalte'; a.cls=Math.max(a.cls,2); a.runway=Math.max(a.runway,1800); }},
  extend:{name:'Allonger la piste', icon:'📏', days:90, cost:a=>12e6*a.cls, can:a=>a.surface==='Asphalte'&&a.cls<4, desc:'+1 classe : accueille des avions plus gros (A320/737 en classe 3, gros-porteurs en 4).', apply:a=>{ a.cls=Math.min(4,a.cls+1); a.runway+=700; }},
  fuel:{name:'Dépôt de carburant Jet A1', icon:'⛽', days:30, cost:a=>5e6, can:a=>!a.fuelDepot&&!['FIH','FBM','GOM','FKI'].includes(a.code), desc:'Supprime la surtaxe de 35 % sur le kérosène acheminé à l’intérieur.', apply:a=>{ a.fuelDepot=true; }},
  terminal:{name:'Terminal passagers moderne', icon:'🏢', days:75, cost:a=>Math.round(6e6+a.traffic*25e6), can:a=>!a.terminal, desc:'Demande +30 % sur toutes les lignes de cet aéroport.', apply:a=>{ a.terminal=true; }},
  lounge:{name:'Salon VIP (hub)', icon:'🥂', days:40, cost:a=>Math.round(3e6+a.traffic*0.4e6), can:a=>S.hubs.includes(a.code)&&!a.lounge, desc:'Demande Affaires & Première +25 % sur les lignes de ce hub.', apply:a=>{ a.lounge=true; }},
  mbase:{name:'Base de maintenance (hub)', icon:'🛠️', days:90, cost:a=>25e6, can:a=>S.hubs.includes(a.code)&&!a.mbase, desc:'Checks A/C/D 35 % moins chers et 40 % plus rapides pour les avions entretenus ici.', apply:a=>{ a.mbase=true; }},
  ils:{name:'Balisage lumineux & ILS', icon:'💡', days:45, cost:a=>4e6, can:a=>!a.ils&&a.surface==='Asphalte', desc:'Divise par 2,5 les retards dus aux orages, limite les incidents.', apply:a=>{ a.ils=true; }},
};
function applyUpgrades(){
  for(const code of Object.keys(S.upgrades||{})){
    const a=AIRPORTS[code]; Object.assign(a, JSON.parse(JSON.stringify(AP_BASE[code])));
    for(const t of S.upgrades[code]) UPGRADES[t].apply(a);
  }
}
function startProject(code,type){
  const a=AP(code), u=UPGRADES[type];
  if(!u.can(a)) return 'Projet non disponible ici';
  S.projects=S.projects||[];
  if(S.projects.some(p=>p.code===code&&p.type===type)) return 'Chantier déjà en cours';
  const c=u.cost(a); book('investissements',-c);
  S.projects.push({code,type,until:S.time+u.days*DAY,start:S.time});
  logMsg(`🏗️ Chantier lancé : ${u.name} à ${a.city} (${fmtMoney(c)}, ${u.days} j).`,'drc');
  return null;
}

/* ---------- hubs & lignes ---------- */
function hubCost(code){ const a=AP(code); return Math.round([0,0.4,1.2,3,8,20][a.cls]*1e6*(a.drc?0.5:1)); }
function buyHub(code){
  const a=AP(code);
  if(S.hubs.includes(code)) return 'C’est déjà un de vos hubs';
  if(a.cls<2) return 'Aéroport trop petit pour devenir un hub (classe 2 minimum)';
  const c=hubCost(code); book('licences',-c); S.hubs.push(code);
  logMsg(`🏢 Nouveau hub : ${a.city} (${code}) pour ${fmtMoney(c)}.`,'ok');
  return null;
}
function lineCost(stops){ let c=0; for(let i=0;i<stops.length-1;i++){ const a=stops[i], b=stops[i+1], d=dist(a,b); let x=20000+d*35; if(isDrc(a)&&isDrc(b)) x*=0.6; if(AP(b).cls>=5) x*=1.5; c+=x; } return Math.round(c/1000)*1000; }
function auditCost(route){ const d=legsFor(route.stops).reduce((s,l)=>s+l.dist,0); return Math.round((5000+d*6)/500)*500; }
function openLine(stops){
  if(!S.hubs.includes(stops[0])) return 'Une ligne doit partir d’un de vos hubs';
  if(stops.length<2) return 'Choisissez une destination';
  for(let i=1;i<stops.length;i++) if(stops[i]===stops[i-1]) return 'Deux escales identiques consécutives';
  if(S.routes.some(r=>r.stops.join()===stops.join())) return 'Vous exploitez déjà cette ligne';
  const c=lineCost(stops); book('licences',-c);
  const r={id:uid(), stops:[...stops], pm:{y:1,j:1,f:1,c:1}, audit:false, opened:S.time, stats:{flights:0,pax:0,seats:0,rev:0,cost:0,recent:[],shareSum:0,shareN:0}};
  S.routes.push(r);
  logMsg(`🧭 Ligne ouverte : ${stops.map(c=>AP(c).city).join(' → ')} (${fmtMoney(c)}).`,'ok');
  return r;
}
function closeLine(id){
  for(const ac of S.fleet){ ac.plan=(ac.plan||[]).filter(p=>p.routeId!==id); if(ac.pendingReturn===id) ac.pendingReturn=null; }
  S.routes=S.routes.filter(r=>r.id!==id);
}
function auditLine(route){ if(route.audit) return 'Audit déjà réalisé'; book('licences',-auditCost(route)); route.audit=true; return null; }
function setPlan(ac, routeId, weekly){
  const r=S.routes.find(x=>x.id===routeId); if(!r) return 'Ligne introuvable';
  if(r.stops[0]!==ac.hub) return `Cet avion est basé à ${ac.hub} : il ne peut desservir que les lignes de ce hub`;
  const e=checkLegs(ac,legsFor(r.stops)); if(e && weekly>0) return e;
  const plan=(ac.plan||[]).filter(p=>p.routeId!==routeId);
  if(weekly>0) plan.push({routeId, weekly});
  const h=planHours(ac,plan);
  if(h>MAX_WEEK_HOURS+0.01) return `Planning plein : ${Math.round(h)} h / ${MAX_WEEK_HOURS} h par semaine`;
  ac.plan=plan; return null;
}
function maxWeekly(ac, route){ const other=(ac.plan||[]).filter(p=>p.routeId!==route.id); return Math.floor((MAX_WEEK_HOURS-planHours(ac,other))/routeCycleHours(route,ac)); }

/* ---------- carburant & CO₂ ---------- */
function buyFuel(litres, auto){
  litres=Math.max(0,Math.min(litres, S.fuel.cap-S.fuel.stock));
  if(!litres) return 'Réservoir plein';
  const cost=litres*fuelPrice(); book('carburant',-cost); S.fuel.stock+=litres;
  if(!auto) logMsg(`⛽ Achat de ${num0(litres)} L de kérosène à $${fuelPrice().toFixed(3)}/L (${fmtMoney(cost)}).`,'info');
  else logMsg(`⛽ Achat automatique : ${num0(litres)} L à $${fuelPrice().toFixed(3)}/L.`,'info');
  return null;
}
function consumeFuel(litres, from){
  const use=Math.min(litres,S.fuel.stock); S.fuel.stock-=use;
  let cost=(litres-use)*fuelPrice()*1.2;                       // achat d'urgence au prix fort
  const sur=litres*(fuelPrice(from)-fuelPrice()); if(sur>0) cost+=sur; // acheminement (intérieur RDC, pénuries)
  if(cost>0) book('carburant',-cost);
  if(litres>use && !S.fuelWarned){ S.fuelWarned=true; notify('Réservoir vide','Votre stock de kérosène est épuisé : achats d’urgence +20 %.'); logMsg('⛽ Réservoir vide ! Le carburant est acheté au comptant avec 20 % de surcoût.','warn'); }
  if(S.fuel.stock>0) S.fuelWarned=false;
}
function upgradeTank(){ const cost=1.5e6+S.fuel.cap*0.6; if(S.fuel.cap>=20e6) return 'Capacité maximale atteinte'; book('licences',-cost); S.fuel.cap+=1e6; return null; }
const tankUpgradeCost=()=>1.5e6+S.fuel.cap*0.6;
function buyCO2(t){ t=Math.max(0,Math.min(t,S.co2.cap-S.co2.stock)); if(!t) return 'Stock plein'; book('co2',-t*S.co2.price); S.co2.stock+=t; return null; }
function consumeCO2(t){ const use=Math.min(t,S.co2.stock); S.co2.stock-=use; if(t>use) book('co2',-(t-use)*S.co2.price*1.3); }
const num0=v=>Math.round(v).toLocaleString('fr-FR');

/* ---------- personnel ---------- */
const STAFF_CATS={ pil:['Pilotes',0], pnc:['Personnel navigant (PNC)',2400], meca:['Mécaniciens',3200], sol:['Personnel au sol',1400] };
function staffNeed(){
  const pnc=S.fleet.reduce((s,a)=>s+cabinNeed(modelOf(a)),0);
  const meca=S.fleet.reduce((s,a)=>s+(modelOf(a).fam==='TURBO'?2:3),0);
  const sol=S.hubs.length*12+S.fleet.length*3;
  const pil=S.fleet.reduce((s,a)=>s+2,0);
  return {pil,pnc,meca,sol};
}
// Recrutement libre (en masse possible)
function hireQuota(k){ return {max:Infinity, used:0, left:1e9}; }   // plus de limite : recrutez autant que vous voulez
function useHire(k,n){}
function staffCount(k){ return k==='pil'? S.pilots.filter(p=>!p.training).length : S.staff[k]; }
function staffShortage(k){ const need=staffNeed()[k]; return need? clamp((need-staffCount(k))/need,0,1) : 0; }
function monthlyPayroll(){
  const sal=S.staff.sal;
  return S.pilots.reduce((s,p)=>s+p.salary,0)*sal.pil/100 + S.staff.pnc*2400*sal.pnc/100 + S.staff.meca*3200*sal.meca/100 + S.staff.sol*1400*sal.sol/100;
}
function staffDaily(){
  const st=S.staff;
  for(const k of Object.keys(STAFF_CATS)){
    const target=clamp(62+(st.sal[k]-100)*1.3-staffShortage(k)*45+(S.reputation-50)*0.2,0,100);
    st.morale[k]=clamp(st.morale[k]+(target-st.morale[k])*0.08,0,100);
  }
  const worst=Object.keys(STAFF_CATS).sort((a,b)=>st.morale[a]-st.morale[b])[0];
  if(st.morale[worst]<28 && (st.strikeUntil||0)<S.time && Math.random()<0.1){
    st.strikeUntil=S.time+rndi(1,3)*DAY; S.reputation=clamp(S.reputation-3,0,100);
    logMsg(`✊ Grève : ${STAFF_CATS[worst][0]} (moral ${Math.round(st.morale[worst])} %). Les départs depuis vos hubs sont annulés jusqu’au ${fmtDate(st.strikeUntil)}.`,'bad');
    notify('Grève du personnel', `${STAFF_CATS[worst][0]} en grève`);
  }
}

/* ---------- bilan hebdomadaire ---------- */
function weeklyTick(){
  const w=S.led.week||{}, rev=ledSum(w,1), cost=-ledSum(w,-1);
  const snap=S.weekSnap||{pax:0,flights:0};
  S.lastWeekReport={rev, cost, profit:rev-cost, pax:S.stats.pax-snap.pax, flights:S.stats.flights-snap.flights, t:S.time};
  S.weekSnap={pax:S.stats.pax, flights:S.stats.flights};
  if(typeof businessWeekly==='function') businessWeekly(S.lastWeekReport);
  if(typeof aiWeekly==='function') aiWeekly();
  S.led.prevWeek=w; S.led.week={};
  logMsg(`📅 Bilan de la semaine : bénéfice ${fmtMoney(rev-cost)} · ${num0(S.lastWeekReport.pax)} passagers · ${S.lastWeekReport.flights} vols.`, rev>=cost?'ok':'warn');
}

/* ---------- objectifs ---------- */
function servedAirports(){ const set=new Set(); for(const r of S.routes) if(routeAircraft(r).length) r.stops.forEach(c=>set.add(c)); return set; }
function servedProvinces(){ const set=new Set(); for(const c of servedAirports()) if(isDrc(c)) set.add(AP(c).prov); return set; }
const hasRouteBetween=(A,B)=>S.routes.some(r=>routeAircraft(r).length && r.stops.some(c=>A.includes(c)) && r.stops.some(c=>B.includes(c)));
const MISSIONS = [
  {id:'first', name:'Premier décollage', desc:'Réaliser un premier vol commercial', cash:1e6, rep:1, done:()=>S.stats.flights>=1},
  {id:'kin_lub', cc:'CD', name:'L’axe Kinshasa – Lubumbashi', desc:'Relier la capitale au Katanga', cash:3e6, rep:2, done:()=>hasRouteBetween(['FIH','NLO'],['FBM'])},
  {id:'kivu', cc:'CD', name:'Pont aérien vers le Kivu', desc:'Desservir Goma ou Bukavu depuis Kinshasa', cash:3e6, rep:2, done:()=>hasRouteBetween(['FIH','NLO'],['GOM','BKY'])},
  {id:'big5', cc:'CD', name:'Les cinq grandes villes', desc:'Desservir Kinshasa, Lubumbashi, Mbuji-Mayi, Kisangani et Goma', cash:6e6, rep:3, done:()=>{ const s=servedAirports(); return ['FIH','FBM','MJM','FKI','GOM'].every(c=>s.has(c)); }},
  {id:'drc10', cc:'CD', name:'Réseau national', desc:'Desservir 10 aéroports congolais', cash:5e6, rep:3, done:()=>[...servedAirports()].filter(isDrc).length>=10},
  {id:'prov15', cc:'CD', name:'Unir le Congo', desc:'Desservir 15 provinces de la RDC', cash:12e6, rep:5, done:()=>servedProvinces().size>=15},
  {id:'prov25', cc:'CD', name:'Tout le Congo', desc:'Desservir les 25 provinces dotées d’un aéroport', cash:40e6, rep:8, done:()=>servedProvinces().size>=25},
  {id:'bush', cc:'CD', name:'Pilote de brousse', desc:'Desservir 5 pistes en latérite', cash:2e6, rep:2, done:()=>[...servedAirports()].filter(c=>AP(c).surface==='Latérite').length>=5},
  {id:'humani', name:'Ailes humanitaires', desc:'Livrer 3 contrats cargo', cash:4e6, rep:4, done:()=>S.cargo.done>=3},
  {id:'home5', name:'Réseau national', desc:'Desservir 5 aéroports de votre pays', cash:3e6, rep:2, done:()=>[...servedAirports()].filter(c=>AP(c).cc===homeCC()).length>=5},
  {id:'home15', name:'Couvrir tout le pays', desc:'Desservir 15 aéroports de votre pays', cash:12e6, rep:4, done:()=>[...servedAirports()].filter(c=>AP(c).cc===homeCC()).length>=15},
  {id:'hubs3', name:'Trois hubs', desc:'Posséder 3 hubs', cash:6e6, rep:3, done:()=>S.hubs.length>=3},
  {id:'longhaul', name:'Premier long-courrier', desc:'Ouvrir une ligne de plus de 6 000 km', cash:5e6, rep:3, done:()=>S.routes.some(r=>routeAircraft(r).length&&legsFor(r.stops).some(l=>l.dist>6000))},
  {id:'world50', name:'Réseau mondial', desc:'Desservir 50 aéroports', cash:25e6, rep:6, done:()=>servedAirports().size>=50},
  {id:'africa', name:'Champion continental', desc:'Desservir 8 pays de votre continent', cash:8e6, rep:4, done:()=>new Set([...servedAirports()].filter(c=>continentOf(c)===COUNTRIES[homeCC()][1]).map(c=>AP(c).cc)).size>=8},
  {id:'fleet5', name:'Petite flotte', desc:'Posséder ou louer 5 avions', cash:2e6, rep:2, done:()=>S.fleet.length>=5},
  {id:'fleet20', name:'Grande compagnie', desc:'Exploiter 20 avions', cash:15e6, rep:5, done:()=>S.fleet.length>=20},
  {id:'pax10k', name:'10 000 passagers', desc:'Transporter 10 000 passagers', cash:2e6, rep:2, done:()=>S.stats.pax>=1e4},
  {id:'pax100k', name:'100 000 passagers', desc:'Transporter 100 000 passagers', cash:10e6, rep:4, done:()=>S.stats.pax>=1e5},
  {id:'pax1m', name:'Un million de passagers', desc:'Transporter 1 000 000 de passagers', cash:50e6, rep:8, done:()=>S.stats.pax>=1e6},
  {id:'alliance', name:'Membre d’alliance', desc:'Rejoindre une alliance', cash:5e6, rep:3, done:()=>!!S.alliance},
  {id:'fivestar', name:'Compagnie 5 étoiles', desc:'Atteindre 90 de réputation', cash:20e6, rep:0, done:()=>S.reputation>=90},
  {id:'top3', name:'Top 3 mondial', desc:'Entrer dans le top 3 du classement des compagnies', cash:50e6, rep:6, done:()=>typeof competitors==='function' && competitors().findIndex(x=>x.me)<3},
  {id:'beat', name:'Détrôner la compagnie nationale', desc:'Avoir plus d’avions que la première compagnie de votre pays (après 200 vols)', cash:25e6, rep:5, done:()=>R0() && S.fleet.length>R0().fleet && S.stats.flights>200},
  {id:'continents', name:'Tour du monde', desc:'Desservir les 6 continents', cash:60e6, rep:8, done:()=>new Set([...servedAirports()].map(continentOf)).size>=6},
  {id:'ipo', name:'Introduction en bourse', desc:'Faire coter votre compagnie', cash:0, rep:5, done:()=>S.stock&&S.stock.ipo},
  {id:'codeshare', name:'Premier partage de codes', desc:'Signer un accord avec une grande compagnie', cash:2e6, rep:3, done:()=>S.codeshares&&S.codeshares.length>0},
  {id:'takeover', name:'Prédateur', desc:'Racheter une compagnie concurrente', cash:0, rep:8, done:()=>(S.takeovers||0)>0},
  {id:'billion', name:'Milliardaire de l’aviation', desc:'Valeur nette de 1 milliard $', cash:0, rep:10, done:()=>netWorth()>=1e9},
];
const missionAvail = m=>!m.cc || m.cc===homeCC();
function checkMissions(){
  S.missions=S.missions||[];
  for(const m of MISSIONS){
    if(S.missions.includes(m.id) || !missionAvail(m)) continue;
    let ok=false; try{ ok=m.done(); }catch(e){}
    if(!ok) continue;
    S.missions.push(m.id);
    if(m.cash) book('admin',m.cash);
    S.reputation=clamp(S.reputation+m.rep,0,100);
    logMsg(`🏆 Objectif atteint : ${m.name}${m.cash?` — prime ${fmtMoney(m.cash)}`:''}${m.rep?`, image +${m.rep}`:''}`,'ok');
    if(typeof toast==='function' && !(typeof UI!=='undefined'&&UI.silent)) toast(`🏆 <b>${m.name}</b>${m.cash?' — '+fmtMoney(m.cash):''}${m.rep?' · image +'+m.rep:''}`,'ok');
    notify('Objectif atteint', m.name);
  }
}

/* ---------- finances ---------- */
function takeLoan(pid){
  const p=LOAN_PRODUCTS.find(x=>x.id===pid);
  if(netWorth()<p.minNet) return `Valeur nette minimale requise : ${fmtMoney(p.minNet)}`;
  if(S.loans.filter(l=>l.product===pid).length>=2) return 'Maximum 2 prêts de ce type';
  const r=p.rate/12, monthly=p.amount*r/(1-Math.pow(1+r,-p.months));
  S.loans.push({id:uid(), product:pid, name:p.name, principal:p.amount, remaining:p.amount, monthly, monthsLeft:p.months, rate:p.rate});
  S.cash+=p.amount;
  logMsg(`🏦 Prêt obtenu : ${p.name}, ${fmtMoney(p.amount)} sur ${p.months} mois.`,'ok');
  return null;
}
function repayLoan(id){
  const l=S.loans.find(x=>x.id===id); if(!l) return;
  if(S.cash<l.remaining) return 'Trésorerie insuffisante';
  S.cash-=l.remaining; S.loans=S.loans.filter(x=>x!==l);
  logMsg(`🏦 Prêt « ${l.name} » remboursé par anticipation.`,'ok');
}

/* ---------- hors-ligne ---------- */
function catchUp(){
  let lr=S.lastReal||Date.now(); try{ const b=+localStorage.getItem('se-lr'); if(b&&b>lr&&b<=Date.now()) lr=b; }catch(e){}   // la dernière heure vue, même si la dernière sauvegarde a échoué
  const realDt=Date.now()-lr;
  S.lastReal=Date.now();
  if(S.paused || realDt<5000) return null;
  const gameDt=Math.min(realDt, 30*DAY);   // absent : le temps passe en temps réel (1 h absent = 1 h de jeu), vos vols continuent sans tout terminer d'un coup
  S.awayFrom=S.time; const before={cash:S.cash, flights:S.stats.flights, pax:S.stats.pax, rev:ledSum(S.led.total,1), cost:ledSum(S.led.total,-1), time:S.time};
  advance(gameDt);
  return { real:realDt, game:S.time-before.time, flights:S.stats.flights-before.flights, pax:S.stats.pax-before.pax,
    rev:ledSum(S.led.total,1)-before.rev, cost:ledSum(S.led.total,-1)-before.cost, cash:S.cash-before.cash };
}

function save(){ if(!S||(typeof window!=='undefined'&&window._svNoUnloadSave)) return; S.lastReal=Date.now(); const txt=JSON.stringify(S); if(typeof saveAll==='function') return saveAll(txt); try{ localStorage.setItem(SAVE_KEY, txt); }catch(e){} }
function migrate(){
  if(typeof ensureBiz==='function') ensureBiz();
  if(S.simple===undefined) S.simple=true;
  if(!S.auto) S.auto={pil:!!S.simple,pnc:!!S.simple,meca:!!S.simple,sol:!!S.simple};
  if(S.rival && !S.rivals){ Object.assign(S.rival,{local:true,color:'#e5484d'}); S.rivals=[S.rival]; for(const t of AI_MAJORS) if(t.hub!==S.company.hub) S.rivals.push(makeRival(t,false)); delete S.rival; }
  if(!S.rivals||!S.rivals.length) initRivals();
  if(!S.ai && typeof initWorldAI==='function' && typeof AIRLINE_DB!=='undefined') initWorldAI();
  // anciennes parties : les compagnies fictives sont remplacées par les vraies compagnies
  if(!S.rivalsReal && typeof initRealRivals==='function' && typeof AIRLINE_DB!=='undefined'){
    let refund=0; if(S.stock&&S.stock.holdings) for(const [code,pct] of Object.entries(S.stock.holdings)){ const R=S.rivals.find(x=>x.code===code); if(R&&typeof rivalValue==='function') refund+=pct*rivalValue(R); }
    if(S.stock) S.stock.holdings={}; S.codeshares=[];
    initRealRivals(); S.cash+=refund;
    logMsg(`✈️ Le ciel est désormais celui du monde réel : vos concurrents sont les vraies compagnies${refund?` (participations remboursées : ${fmtMoney(refund)})`:''}.`,'info');
  }
  if(!S.v || S.v<2){
    S.v=2; S.hubs=S.hubs||[S.company.hub];
    S.fuel=S.fuel||{stock:400000, cap:1500000, auto:false, autoBelow:0.72, hist:[]};
    S.co2=S.co2||{stock:300, cap:3000, price:85, base:85, hist:[]};
    S.staff=S.staff||{pnc:S.cabinCrew||8, meca:Math.max(6,S.fleet.length*3), sol:12+S.fleet.length*3, sal:{pil:100,pnc:100,meca:100,sol:100}, morale:{pil:70,pnc:70,meca:70,sol:70}, strikeUntil:0};
    S.led.week=S.led.week||{}; S.led.prevWeek=S.led.prevWeek||{};
    for(const r of S.routes){ const k=r.price||1; r.pm=r.pm||{y:k,j:k,f:k,c:1}; r.audit=!!r.audit; if(!S.hubs.includes(r.stops[0])) S.hubs.push(r.stops[0]); }
    for(const ac of S.fleet){
      ac.hub=ac.hub||S.company.hub; ac.cfg=ac.cfg||{f:0,j:0}; ac.wk=ac.wk||{week:-1,c:{}}; ac.plan=ac.plan||[];
      const r=ac.routeId&&S.routes.find(x=>x.id===ac.routeId);
      if(r){ ac.hub=r.stops[0]; ac.plan=[{routeId:r.id, weekly:Math.max(1,Math.floor(MAX_WEEK_HOURS/routeCycleHours(r,ac)))}]; }
      ac.routeId=null;
    }
  }
  S.weather=S.weather||[]; S.projects=S.projects||[]; S.upgrades=S.upgrades||{}; S.missions=S.missions||[];
  S.stats.onTime=S.stats.onTime||0; S.stats.late=S.stats.late||0; S.stats.manual=S.stats.manual||0;
  if(S.tuto===undefined) S.tuto=0;
  for(const ac of S.fleet) if(ac.status==='manual'){ ac.status='idle'; }
  applyUpgrades();
}
function load(){ try{ const raw=localStorage.getItem(SAVE_KEY); if(raw){ S=JSON.parse(raw); migrate(); return true; } }catch(e){} return false; }

function fmtMoney(v){
  const s=v<0?'-':''; v=Math.abs(v);
  if(v>=1e9) return s+'$'+(v/1e9).toFixed(2)+' Md';
  if(v>=1e6) return s+'$'+(v/1e6).toFixed(v>=1e8?0:1)+' M';
  if(v>=1e3) return s+'$'+(v/1e3).toFixed(v>=1e5?0:1)+' k';
  return s+'$'+Math.round(v);
}
