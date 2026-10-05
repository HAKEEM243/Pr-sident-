/* ============================================================
   MOTEUR DE SIMULATION — état, vols, économie, IA
   ============================================================ */
const SAVE_KEY = 'congo-airways-tycoon-v1';
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const SPEEDS = { realiste:{label:'Réaliste', mult:1}, standard:{label:'Standard', mult:60}, rapide:{label:'Rapide', mult:600} };
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
    v:1, time:start, startTime:start, speed:'standard', paused:false, lastReal:Date.now(),
    company:{ name:opts.name||'Congo Sky', code:(opts.code||'CS').toUpperCase().slice(0,3), color:opts.color||'#d4a72c', logo:opts.logo||'🐆', hub:opts.hub||'FIH' },
    cash:opts.capital||80e6, reputation:50, service:3,
    ancillary:{seat:true, bags:true, wifi:false, meals:false},
    oil:82, oilBase:82, fleet:[], customModels:[], pilots:[], candidates:[], cabinCrew:8, routes:[],
    loans:[], campaigns:[], alliance:null, cargo:{offers:[], active:[], done:0},
    events:[], closed:[], history:[], log:[],
    led:{ day:{}, month:{}, prevMonth:{}, total:{} },
    stats:{ pax:0, flights:0, cargoT:0, incidents:0 },
    autoMaint:true, notifications:false, lastDay:dayIndex(start), lastMonth:monthKey(start),
    rival:null, admin:false, seq:1,
  };
  const reg = COUNTRIES[AP(S.company.hub).cc][3];
  addAircraft('AT76', {owned:true});
  addAircraft('C208', {owned:true});
  for(let i=0;i<6;i++) S.pilots.push(makePilot(['TURBO'], true));
  refreshCandidates();
  initRival();
  genCargoOffers(3);
  pushHistory();
  logMsg(`Bienvenue chez ${S.company.name} ! Votre hub est ${AP(S.company.hub).city} (${S.company.hub}).`,'ok');
  save();
}

function makePilot(quals, local){
  const cd = local || Math.random()<0.6;
  const name = cd ? `${pick(FIRST_NAMES_CD)} ${pick(LAST_NAMES_CD)}` : `${pick(FIRST_NAMES_W)} ${pick(LAST_NAMES_W)}`;
  const top = quals.reduce((m,q)=>Math.max(m,FAMILIES[q][3]),5000);
  return { id:uid(), name, nat: cd?'CD':'INT', quals:[...quals], salary:Math.round(top*rnd(0.9,1.15)/100)*100, hours:rndi(1500,9000), training:null };
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

function addAircraft(modelId, {owned=true, used=false}={}){
  const m=getModel(modelId);
  const ac = {
    id:uid(), model:modelId, reg:nextReg(), name:'', owned, used,
    price: m.price*1e6*(used?0.55:1), lease: owned?0:Math.round(m.price*1e6*0.0085),
    bought:S.time, ageYears: used?12:0,
    hours: used?30000:0, cycles: used?15000:0, sinceA:used?300:0, sinceC:used?1500:0, sinceD:used?6000:0,
    condition: used?78:100, status:'idle', loc:S.company.hub, routeId:null, readyAt:S.time,
    flight:null, maintUntil:0, maintType:null, nextDir:1, hold:false,
  };
  S.fleet.push(ac);
  return ac;
}

/* ---------- registre comptable ---------- */
const LED_CATS = {
  billets:['Billets passagers',1], annexes:['Revenus annexes',1], cargo:['Fret & contrats cargo',1], ventes:['Ventes d’avions',1],
  carburant:['Carburant',-1], taxes:['Taxes aéroportuaires',-1], service:['Service à bord',-1], salaires:['Salaires',-1],
  leasing:['Leasing',-1], maintenance:['Maintenance',-1], interets:['Intérêts bancaires',-1], marketing:['Marketing',-1],
  alliance:['Cotisations alliance',-1], formation:['Formation',-1], incidents:['Incidents',-1], recrutement:['Recrutement',-1], admin:['Bac à sable',1],
};
function book(cat, amount){ // montant signé : + revenu, - coût
  S.cash += amount;
  for(const k of ['day','month','total']) S.led[k][cat]=(S.led[k][cat]||0)+amount;
}
const ledSum = (l,sign)=>Object.entries(l).filter(([k])=>k!=='admin'&&k!=='ventes').reduce((s,[,v])=>s+(sign>0?Math.max(0,v):Math.min(0,v)),0);

function logMsg(text, kind='info'){
  S.log.unshift({t:S.time, text, kind});
  if(S.log.length>80) S.log.length=80;
  if(typeof onLog==='function') onLog(text, kind);
}

/* ---------- prix du carburant ---------- */
function oilMult(){ return S.events.reduce((m,e)=>m*(EV(e).oil||1),1); }
function fuelPrice(code){ // $ par litre
  let p = S.oil/159*1.3 + 0.12;
  if(code && isDrc(code)){
    if(!['FIH','FBM','GOM','FKI'].includes(code)) p*=1.35; // acheminement vers l'intérieur
    p *= S.events.reduce((m,e)=>m*(EV(e).drcFuel||1),1);
  }
  return p;
}
const EV = e=>EVENT_TYPES.find(t=>t.id===e.type)||{};

/* ---------- demande & parts de marché ---------- */
function seasonMult(t){ const m=new Date(t).getUTCMonth(); return [0.85,0.85,0.95,1.0,1.0,1.08,1.25,1.25,1.0,0.95,0.95,1.3][m]; }
function demandMult(a,b){
  let k = seasonMult(S.time);
  const A=AP(a), B=AP(b), domestic = A.drc&&B.drc, intl = A.cc!==B.cc, africa = continentOf(a)==='AF'&&continentOf(b)==='AF';
  for(const e of S.events){
    const t=EV(e);
    if(t.demand) k*=t.demand;
    if(t.regions && t.regionDemand){ if(t.regions.includes(A.prov)||t.regions.includes(B.prov)) k*=t.regionDemand; }
  }
  for(const c of S.campaigns){
    const cp=CAMPAIGNS.find(x=>x.id===c.id); if(!cp) continue;
    if(cp.scope==='all' || (cp.scope==='drc'&&(A.drc||B.drc)) || (cp.scope==='intl'&&intl)) k*=1+cp.boost;
  }
  if(S.alliance){ const al=ALLIANCES.find(x=>x.id===S.alliance); if(al && ((al.scope==='africa'&&africa&&intl)||(al.scope==='intl'&&intl))) k*=1+al.boost; }
  return k;
}
// Demande quotidienne totale (tous transporteurs) dans un sens
function marketDemand(a,b){
  const d=dist(a,b), A=AP(a), B=AP(b);
  const df = d<120?0.25 : d<300?0.8 : 1/(1+d/4500);
  let base = 230*Math.sqrt(A.traffic*B.traffic)*df;
  if(A.drc&&B.drc) base*=5; // routes quasi inexistantes : l'avion est vital en RDC
  else if(A.drc||B.drc) base*=1.3;
  return base*demandMult(a,b);
}
function baseFare(a,b){
  const d=dist(a,b);
  let f = d<3000 ? 30+0.11*d : 360+0.05*(d-3000);
  if(isDrc(a)&&isDrc(b)) f*=1.6; else if(isDrc(a)||isDrc(b)) f*=1.15;
  return f;
}
function ancillaryPenalty(){ const a=S.ancillary; return 1-(a.seat?0.02:0)-(a.bags?0.03:0)-(a.wifi?0.005:0)-(a.meals?(S.service>=4?0.04:0.01):0); }
function playerQuality(){ return (0.55+S.reputation/100)*SERVICE_ATTR[S.service-1]*ancillaryPenalty(); }
function rivalFreq(a,b){
  if(!S.rival) return 0; let f=0;
  for(const r of S.rival.routes) if((r.a===a&&r.b===b)||(r.a===b&&r.b===a)) f+=r.freq;
  return f;
}
function routeCycleHours(route, ac){
  const m=modelOf(ac); let h=0;
  for(let i=0;i<route.stops.length-1;i++) h+=legProfile(dist(route.stops[i],route.stops[i+1]),m).total/HOUR;
  return 2*h + 2*turnaround(m)/HOUR;
}
function routeFreq(route){ // vols par jour et par sens
  let f=0;
  for(const id of route.aircraft){ const ac=S.fleet.find(x=>x.id===id); if(ac) f+=24/routeCycleHours(route,ac)*(route.auto?1:0.6); }
  return Math.max(f,0.05);
}
function routeSeats(route, m){
  if(isCargo(m)) return {f:0,j:0,w:0,y:0,total:0};
  const c=route.cabin, u=m.seats;
  const f=Math.floor(u*c.f/100/CLASS_SPACE.f), j=Math.floor(u*c.j/100/CLASS_SPACE.j), w=Math.floor(u*c.w/100/CLASS_SPACE.w);
  const y=Math.max(0,Math.floor(u*(100-c.f-c.j-c.w)/100));
  return {f,j,w,y,total:f+j+w+y};
}
// Analyse d'un tronçon : demande, part de marché, passagers par vol
function legMarket(route, a, b, freqOverride){
  const fp = freqOverride ?? routeFreq(route);
  const price = route.price;
  const market = marketDemand(a,b)*Math.pow(price,-0.7);
  const compFreq = Math.max(0.4, marketDemand(a,b)/160);
  const rf = rivalFreq(a,b);
  const attrP = playerQuality()*Math.sqrt(fp)/Math.pow(price,1.6);
  const attrC = Math.sqrt(compFreq) + (S.rival? S.rival.quality*Math.sqrt(rf) : 0);
  const share = attrP/(attrP+attrC);
  const daily = market*share;
  return { market, share, daily, perFlight: daily/fp, freq:fp, rivalFreq:rf };
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
function legProfile(d, m){
  const key=m.id+'|'+m.speed+'|'+Math.round(d*10);
  let c=_profCache.get(key); if(c) return c;
  if(_profCache.size>5000) _profCache.clear();
  c=computeProfile(d,m); _profCache.set(key,c); return c;
}
function computeProfile(d, m){
  const v=m.speed, turbo=m.fam==='TURBO';
  const board=(Math.max(m.seats,m.cargo*3)<60?15:Math.max(m.seats,m.cargo*3)<200?25:40);
  const taxiOut=10, to=1.5, climb=turbo?14:(v>1500?28:20), desc=turbo?14:22, app=8, land=1.5, taxiIn=6;
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
    [4,cruiseD/v*60,(dTo+dClimb)*f,(dTo+dClimb)*f+cruiseD,peak,peak,v*0.85,v],
    [5,desc*Math.max(f,0.35),(dTo+dClimb)*f+cruiseD,(dTo+dClimb+dDesc)*f+cruiseD,peak,900,v,vApp+80],
    [6,app*Math.max(f,0.5),(dTo+dClimb+dDesc)*f+cruiseD,(dTo+dClimb+dDesc+dApp)*f+cruiseD,900,50,vApp+80,vApp-40],
    [7,land,(dTo+dClimb+dDesc+dApp)*f+cruiseD,d,50,0,vApp-40,40],
    [8,taxiIn,d,d,0,0,30,0],
  ];
  let t=0; const segs=[];
  for(const [ph,dur,d0,d1,a0,a1,s0,s1] of raw){
    const ms=dur*MIN; segs.push({ph,t0:t,t1:t+ms,d0,d1,a0,a1,s0,s1}); t+=ms;
  }
  const airborne = segs.filter(s=>s.ph>=2&&s.ph<=7).reduce((s,x)=>s+(x.t1-x.t0),0);
  return {segs,total:t,airborne};
}
// État instantané d'un avion en vol
function flightState(ac, t=S.time){
  const fl=ac.flight; if(!fl) return null;
  let leg=fl.legs[fl.li]; if(!leg) return null;
  const m=modelOf(ac), prof=legProfile(leg.dist,m);
  const rel=clamp(t-leg.dep,0,prof.total);
  let seg=prof.segs.find(s=>rel<s.t1) || prof.segs[prof.segs.length-1];
  const u = seg.t1>seg.t0 ? clamp((rel-seg.t0)/(seg.t1-seg.t0),0,1) : 1;
  const dd = seg.d0+(seg.d1-seg.d0)*u;
  const A=AP(leg.from), B=AP(leg.to);
  const frac = leg.dist>0? clamp(dd/leg.dist,0,1) : 1;
  const p = gcInterp(A,B,frac);
  const ahead = gcInterp(A,B,Math.min(1,frac+0.01));
  const hdg = frac<0.99 ? bearing(p,ahead) : bearing(A,B);
  const totalDist = fl.legs.reduce((s,l)=>s+l.dist,0);
  const doneDist = fl.legs.slice(0,fl.li).reduce((s,l)=>s+l.dist,0)+dd;
  const last=fl.legs[fl.legs.length-1];
  const eta = last.dep+legProfile(last.dist,m).total;
  const phase = rel>=prof.total? 8 : seg.ph;
  return { lat:p.lat, lon:unwrapLon(p.lon, A.lon), hdg, alt:seg.a0+(seg.a1-seg.a0)*u, spd:seg.s0+(seg.s1-seg.s0)*u,
    phase, progress: totalDist? doneDist/totalDist : 1, eta, leg, from:leg.from, to:leg.to, origin:fl.legs[0].from, dest:last.to };
}

/* ---------- équipage ---------- */
function qualifiedPilots(fam){ return S.pilots.filter(p=>p.quals.includes(fam)&&!p.training).length; }
function activeOfFamily(fam, except){ return S.fleet.filter(a=>a!==except && a.status==='flight' && modelOf(a)?.fam===fam).length; }
const cabinNeed = m=>isCargo(m)?0:Math.max(1,Math.ceil(m.seats/50));
function cabinBusy(except){ return S.fleet.filter(a=>a!==except&&a.status==='flight').reduce((s,a)=>s+cabinNeed(modelOf(a)),0); }
function crewCheck(ac){
  const m=modelOf(ac);
  if(qualifiedPilots(m.fam) < 2*(activeOfFamily(m.fam,ac)+1)) return `Pas assez de pilotes qualifiés ${m.fam} (2 par avion en vol)`;
  if(cabinBusy(ac)+cabinNeed(m) > S.cabinCrew) return 'Pas assez de personnel navigant commercial';
  return null;
}

/* ---------- dispatch ---------- */
function legsFor(stops){ const L=[]; for(let i=0;i<stops.length-1;i++) L.push({from:stops[i],to:stops[i+1],dist:dist(stops[i],stops[i+1])}); return L; }
function checkLegs(ac, legs){
  const m=modelOf(ac);
  for(const l of legs){
    if(l.dist>m.range) return `Tronçon ${l.from}→${l.to} (${Math.round(l.dist)} km) hors autonomie (${m.range} km)`;
    for(const c of [l.from,l.to]){
      if(AP(c).cls<m.cls) return `Piste de ${AP(c).city} (${c}) trop courte pour un ${m.name}`;
      if(airportClosed(c)) return `Aéroport ${AP(c).city} (${c}) fermé`;
    }
  }
  return null;
}
function airportClosed(code){
  if(S.closed.includes(code)) return true;
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
    l.dep=dep; dep+=legProfile(l.dist,m).total;
    if(kind==='route'&&route){
      if(isCargo(m)){ l.cargo=+(m.cargo*clamp(rnd(0.55,0.9)*cargoMult(l.from,l.to),0.2,1)).toFixed(1); }
      else {
        const mk=legMarket(route,l.from,l.to), seats=routeSeats(route,m);
        let P=mk.perFlight*rnd(0.88,1.1);
        const pf=Math.min(seats.f,Math.round(P*0.03)), pj=Math.min(seats.j,Math.round(P*0.09)), pw=Math.min(seats.w,Math.round(P*0.12));
        const py=clamp(Math.round(P-pf-pj-pw),Math.min(2,seats.y),seats.y);
        l.pax={f:pf,j:pj,w:pw,y:py}; l.share=mk.share;
      }
    }
  }
  ac.flight={kind, routeId:extra.routeId||null, dir:extra.dir||1, contractId:extra.contractId||null, legs, li:0, next:extra.next||null};
  ac.status='flight';
  return null;
}
function dispatchRoute(ac, dir, t=S.time){
  const r=S.routes.find(x=>x.id===ac.routeId); if(!r) return 'Avion non affecté à une route';
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
  const fl=ac.flight, leg=fl.legs[fl.li], m=modelOf(ac), prof=legProfile(leg.dist,m);
  const hrs=prof.airborne/HOUR, arr=leg.dep+prof.total;
  const route=fl.routeId? S.routes.find(r=>r.id===fl.routeId):null;
  let rev=0, cost=0;
  // coûts
  const fuel = m.burn*hrs*fuelPrice(leg.from)*(m.custom?1.05:1);
  book('carburant',-fuel); cost+=fuel;
  const B=AP(leg.to), size=Math.max(m.seats,m.cargo*3)/100;
  let fees = [0,60,150,300,550,900][B.cls]*Math.max(0.25,size);
  const paxCount = leg.pax? leg.pax.f+leg.pax.j+leg.pax.w+leg.pax.y : 0;
  fees += paxCount*(AP(leg.from).cc!==B.cc?22:7);
  if(S.events.some(e=>e.type==='insecurity') && ['Nord-Kivu','Ituri','Sud-Kivu'].includes(B.prov)) fees*=1.5;
  book('taxes',-fees); cost+=fees;
  const upkeep = Math.max(m.seats,m.cargo*3)*1.4*hrs;
  book('maintenance',-upkeep); cost+=upkeep;
  // revenus
  if(fl.kind==='route' && route){
    if(leg.pax){
      const fare=baseFare(leg.from,leg.to)*route.price;
      const tix = (leg.pax.f*CLASS_MULT.f+leg.pax.j*CLASS_MULT.j+leg.pax.w*CLASS_MULT.w+leg.pax.y)*fare;
      const a=S.ancillary;
      const anc = paxCount*((a.seat?6*0.3:0)+(a.bags?25*0.35:0)+(a.wifi&&hrs>1.5?9*0.18:0)+(a.meals&&S.service<4?11*0.3:0));
      const svc = paxCount*SERVICE_COST[S.service-1]*Math.max(0.5,hrs) + (leg.pax.f*60+leg.pax.j*30)*Math.max(0.5,hrs);
      book('billets',tix); book('annexes',anc); book('service',-svc);
      rev+=tix+anc; cost+=svc;
      S.stats.pax+=paxCount;
      route.stats.pax+=paxCount; route.stats.seats+=routeSeats(route,m).total; route.stats.shareSum+=leg.share||0; route.stats.shareN++;
    }
    if(leg.cargo){ const c=leg.cargo*leg.dist*0.42; book('cargo',c); rev+=c; S.stats.cargoT+=leg.cargo; route.stats.seats+=0; }
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
  S.stats.flights++;
  // usure
  ac.hours+=hrs; ac.cycles++; ac.sinceA+=hrs; ac.sinceC+=hrs; ac.sinceD+=hrs;
  const overdue = maintOverdue(ac);
  ac.condition=clamp(ac.condition-hrs*(overdue?0.06:0.02)-0.03,0,100);
  ac.loc=leg.to;
  // incidents
  const pInc = 0.0015 + (100-ac.condition)/100*0.02 + (overdue?0.03:0);
  if(Math.random()<pInc) incident(ac, arr);
  // tronçon suivant
  fl.li++;
  if(fl.li>=fl.legs.length){
    const next=fl.next; ac.flight=null; ac.status=ac.status==='flight'?'idle':ac.status;
    ac.readyAt=Math.max(ac.readyAt||0, arr+turnaround(m));
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
  S.reputation=clamp(S.reputation-2*sev,0,100);
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
  const m=modelOf(ac), cost=MAINT[type].cost(m);
  book('maintenance',-cost);
  ac.status='maint'; ac.maintType=type; ac.maintUntil=Math.max(t,ac.readyAt||0)+MAINT[type].days*DAY;
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
function netWorth(){ return S.cash+fleetValue()-debt(); }

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
function simStep(){
  const t=S.time;
  for(const ac of S.fleet){
    // arrivées
    let guard=0;
    while(ac.flight && guard++<20){
      const leg=ac.flight.legs[ac.flight.li];
      const arr=leg.dep+legProfile(leg.dist,modelOf(ac)).total;
      if(arr<=t) completeLeg(ac); else break;
    }
    if(ac.status==='maint' && ac.maintUntil<=t) finishMaint(ac);
    if(ac.status!=='idle' || (ac.readyAt||0)>t) continue;
    // maintenance automatique
    if(S.autoMaint){
      const due=['D','C','A'].find(k=>ac['since'+k]>=MAINT[k].every*0.97);
      if(due){ startMaint(ac,due,t); continue; }
    }
    // rotation automatique
    if(ac.routeId && !ac.hold){
      const r=S.routes.find(x=>x.id===ac.routeId);
      if(!r){ ac.routeId=null; continue; }
      if(!r.auto) continue;
      const first=r.stops[0], last=r.stops[r.stops.length-1];
      let dir = ac.loc===first? 1 : ac.loc===last? -1 : 0;
      if(dir===0){ ferry(ac, first, Math.max(t-5*MIN, ac.readyAt||0)); continue; }
      const err=dispatchRoute(ac, dir, Math.max(t-5*MIN, ac.readyAt||0));
      if(err) ac.blocked=err; else ac.blocked=null;
    }
  }
}

function dailyTick(){
  const t=S.time;
  // pétrole
  S.oilBase=clamp(S.oilBase+(82-S.oilBase)*0.02+rnd(-1.6,1.6),45,140);
  S.oil=+(S.oilBase*oilMult()).toFixed(2);
  // salaires et leasing
  const sal=S.pilots.reduce((s,p)=>s+p.salary,0)+S.cabinCrew*2400;
  book('salaires',-sal/30);
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
    if(Math.random()<et.p) triggerEvent(et.id);
  }
  // réputation
  const fleetCond = S.fleet.length? S.fleet.reduce((s,a)=>s+a.condition,0)/S.fleet.length : 80;
  const target = 25 + S.service*9 + (fleetCond-70)*0.4 + S.campaigns.reduce((s,c)=>s+(CAMPAIGNS.find(x=>x.id===c.id)?.rep||0),0) + (S.alliance?5:0);
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
  pushHistory();
  S.led.day={};
  // alertes
  if(S.cash<0) notify('Trésorerie négative', `Votre capital est de ${fmtMoney(S.cash)}. Empruntez ou réduisez les coûts.`);
  if(!S.autoMaint){ const due=S.fleet.filter(a=>maintOverdue(a)); if(due.length) notify('Maintenance en retard', `${due.length} avion(s) dépassent leur échéance d’entretien.`); }
}
function monthlyTick(){
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
  S.events.push(e); recomputeClosed();
  S.oil=+(S.oilBase*oilMult()).toFixed(2);
  const where=e.airport?` (${AP(e.airport).city})`:'';
  logMsg(`${et.icon} ${et.name}${where} — ${et.desc}`, et.drc?'drc':'warn');
  notify(et.name+where, et.desc);
}
function recomputeClosed(){
  S.closed=[];
  for(const e of S.events){ const t=EV(e); if(t.close) S.closed.push(...t.close); if(e.airport) S.closed.push(e.airport); }
}

/* ---------- cargo ---------- */
function cargoMult(a,b){ let k=1; for(const e of S.events){ const t=EV(e); if(t.cargo && (t.regions.includes(AP(a).prov)||t.regions.includes(AP(b).prov))) k*=t.cargo; } return k; }
function genCargoOffers(n){
  const drcCodes=AIRPORT_CODES.filter(c=>isDrc(c));
  const templates=[
    ()=>[pick(['KWZ','FBM']), pick(['DAR','JNB','LUN','NLA']), 'Cuivre & cobalt', rnd(10,60)],
    ()=>[pick(['FIH','FBM','GOM']), pick(drcCodes.filter(c=>AP(c).cls<=2)), 'Aide humanitaire (ONG)', rnd(2,8)],
    ()=>[pick(['FIH','GOM','BKY','BUX']), pick(['FKI','BNC','KND','FMI','MDK']), 'Médicaments & vaccins', rnd(1,6)],
    ()=>[pick(['CDG','BRU','DXB','IST','JNB']), pick(['FIH','FBM']), 'Biens de consommation', rnd(15,90)],
    ()=>[pick(['FIH','MJM','KGA']), pick(['BRU','DXB','JNB']), 'Diamants & café', rnd(1,10)],
    ()=>[pick(['GOM','BKY']), pick(['FIH','NBO','EBB']), 'Café du Kivu & thé', rnd(5,20)],
    ()=>{ const a=pick(AIRPORT_CODES), b=pick(AIRPORT_CODES.filter(c=>c!==a)); return [a,b,'Fret général',rnd(10,100)]; },
  ];
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
  if(ac.routeId) return 'Retirez d’abord l’avion de sa route';
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

/* ---------- rival IA ---------- */
function initRival(){
  const hub = S.company.hub==='FBM'? 'FIH' : 'FBM';
  S.rival={ name:'StarWing Airways', code:'SW', hub, cash:140e6, fleet:7, quality:0.95, rep:55, paxDay:0, revDay:0, routes:[] };
  const cands = ['FIH','FBM','GOM','JNB','NBO','LAD','KWZ','MJM','FKI','ADD','BZV','LUN'].filter(c=>c!==hub);
  for(const c of cands.slice(0,6)) S.rival.routes.push({a:hub,b:c,freq:rndi(1,3)});
}
function rivalTick(){
  const R=S.rival; if(!R) return;
  let pax=0, rev=0;
  for(const r of R.routes){
    const d=dist(r.a,r.b), dem=marketDemand(r.a,r.b)+marketDemand(r.b,r.a);
    const seats = d<1200?70:d<4000?180:300;
    const p = Math.min(seats*r.freq*2*0.85, dem*0.3);
    pax+=p; rev+=p*baseFare(r.a,r.b);
  }
  const profit = rev*rnd(0.02,0.12);
  R.cash+=profit; R.paxDay=Math.round(pax); R.revDay=Math.round(rev);
  R.rep=clamp(R.rep+rnd(-0.6,0.7),30,90); R.quality=0.75+R.rep/200;
  // expansion
  if(R.cash>50e6 && Math.random()<0.12){
    let a,b;
    const player=S.routes.filter(r=>r.stops.length>=2);
    if(player.length && Math.random()<0.55){ const r=pick(player); a=r.stops[0]; b=r.stops[1]; }
    else { a=R.hub; b=pick(AIRPORT_CODES.filter(c=>c!==R.hub && AP(c).cls>=3 && dist(R.hub,c)<5000)); }
    const ex=R.routes.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));
    if(ex) ex.freq=Math.min(6,ex.freq+1); else R.routes.push({a,b,freq:1});
    R.cash-=40e6; R.fleet++;
    logMsg(`🛩️ ${R.name} ${ex?'renforce':'ouvre'} la ligne ${AP(a).city} – ${AP(b).city}.`,'rival');
  }
  if(R.cash<0 && R.routes.length>2){ R.routes.sort((x,y)=>x.freq-y.freq).shift(); R.fleet=Math.max(3,R.fleet-1); R.cash+=25e6; }
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
  const realDt=Date.now()-(S.lastReal||Date.now());
  S.lastReal=Date.now();
  if(S.paused || realDt<5000) return null;
  const gameDt=Math.min(realDt*SPEEDS[S.speed].mult, 30*DAY);
  const before={cash:S.cash, flights:S.stats.flights, pax:S.stats.pax, rev:ledSum(S.led.total,1), cost:ledSum(S.led.total,-1), time:S.time};
  advance(gameDt);
  return { real:realDt, game:S.time-before.time, flights:S.stats.flights-before.flights, pax:S.stats.pax-before.pax,
    rev:ledSum(S.led.total,1)-before.rev, cost:ledSum(S.led.total,-1)-before.cost, cash:S.cash-before.cash };
}

function save(){ if(!S) return; S.lastReal=Date.now(); try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
function load(){ try{ const raw=localStorage.getItem(SAVE_KEY); if(raw){ S=JSON.parse(raw); return true; } }catch(e){} return false; }

function fmtMoney(v){
  const s=v<0?'-':''; v=Math.abs(v);
  if(v>=1e9) return s+'$'+(v/1e9).toFixed(2)+' Md';
  if(v>=1e6) return s+'$'+(v/1e6).toFixed(v>=1e8?0:1)+' M';
  if(v>=1e3) return s+'$'+(v/1e3).toFixed(v>=1e5?0:1)+' k';
  return s+'$'+Math.round(v);
}
