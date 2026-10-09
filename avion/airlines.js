/* ============================================================
   COMPAGNIES ET LIGNES RÉELLES
   Les concurrents sont les vraies compagnies (Air France, Emirates,
   Ethiopian…) avec leur vrai réseau ; un pays sans compagnie
   aérienne n'a pas de concurrent national.
   ============================================================ */

// Couleur principale des livrées (pour les avions sur la carte)
const AIRLINE_COLORS = {
  AF:'#002157', BA:'#075aaa', LH:'#05164d', KL:'#00a1de', EK:'#d71921', QR:'#5c0632', EY:'#bd8b13', TK:'#c70a0c',
  DL:'#003366', UA:'#005daa', AA:'#0078d2', WN:'#304cb2', B6:'#003876', AS:'#01426a', AC:'#d22630', WS:'#00a3ad',
  SQ:'#f99f1c', CX:'#006564', NH:'#13448f', JL:'#cc0000', KE:'#00256c', OZ:'#6b5e53', CA:'#e30613', MU:'#1f3d7a',
  CZ:'#0077c8', HU:'#c8102e', QF:'#e0001b', VA:'#e10a0a', NZ:'#111111', ET:'#2e8b57', KQ:'#c8102e', SA:'#002d62',
  AT:'#c8102e', MS:'#00265c', WB:'#00a1de', BU:'#1e40af', TP:'#d8262e', IB:'#d7192d', VY:'#ffcc00', FR:'#073590',
  U2:'#ff6600', W6:'#c6007e', LX:'#e2001a', OS:'#d81e05', SN:'#003d7c', AY:'#0b1560', SK:'#000080', LO:'#11397e',
  AZ:'#008a50', A3:'#0a2e6e', SU:'#003b8e', LA:'#1b0088', AV:'#da291c', CM:'#0e2245', AM:'#0b2343', G3:'#ff6600',
  AD:'#2d4f9e', AR:'#00a0dc', '6E':'#001b94', AI:'#d71920', SV:'#00563f', GF:'#c5a572', WY:'#a0763a', PK:'#006b3f',
  MH:'#003875', GA:'#005e6a', TG:'#4b1f6f', VN:'#0a6e8a', PR:'#003b7a', BR:'#0b6b3a', CI:'#e83f6f', FZ:'#0071bc',
  RJ:'#bf9b30', ME:'#00843d', HF:'#f47920', DT:'#d71920', TC:'#0a4f8f', UR:'#00843d', '5Z':'#e30613', P4:'#003b71',
};
function airlineColor(code){
  if(AIRLINE_COLORS[code]) return AIRLINE_COLORS[code];
  let h=0; for(const ch of code) h=(h*53+ch.charCodeAt(0))%360; return `hsl(${h},62%,46%)`;
}

/* ---------- lecture de la base ---------- */
const PAIR_DB=new Map(), AP_ROUTES={};
(function(){
  if(typeof ROUTE_DB==='undefined') return;
  for(const rec of ROUTE_DB.split('|')){
    const a=rec.slice(0,3), b=rec.slice(3,6), min=parseInt(rec.slice(6,8),36), cs=[];
    for(let i=8;i<rec.length;i+=2) cs.push(rec.slice(i,i+2));
    PAIR_DB.set(a+b,{min,c:cs});
    (AP_ROUTES[a]=AP_ROUTES[a]||[]).push(b); (AP_ROUTES[b]=AP_ROUTES[b]||[]).push(a);
  }
})();
const pairKey=(a,b)=>a<b?a+b:b+a;
function realPair(a,b){ return PAIR_DB.get(pairKey(a,b))||null; }
function realCarriers(a,b){ const p=realPair(a,b); return p?p.c:[]; }
function realMinutes(a,b){ const p=realPair(a,b); return p&&p.min||0; }
function airlineName(code){ const a=typeof AIRLINE_DB!=='undefined'&&AIRLINE_DB[code]; if(a) return a[0]; const e=typeof S!=='undefined'&&S&&S.ai&&S.ai.list.find(x=>x.code===code); return e?e.name:code; }
let _alIdx=null;
function airlinePairs(code){
  if(!_alIdx){ _alIdx={}; for(const [k,p] of PAIR_DB) for(const c of p.c) (_alIdx[c]=_alIdx[c]||[]).push([k.slice(0,3),k.slice(3)]); }
  return _alIdx[code]||[];
}
/* ---------- monde vivant : lignes ouvertes/fermées, compagnies disparues ---------- */
let _aiVer=-1, _aiSrc=null, _cutSet=new Set(), _extraMap=new Map(), _deadSet=new Set();
function aiIndexes(){
  const ai=typeof S!=='undefined'&&S&&S.ai; if(!ai) return false;
  if(_aiSrc===ai && _aiVer===ai.ver) return true;
  _aiSrc=ai; _aiVer=ai.ver; _cutSet=new Set(); _extraMap=new Map(); _deadSet=new Set(ai.list.filter(e=>e.status==='dead').map(e=>e.code));
  for(const [c,l] of Object.entries(ai.cut||{})) for(const k of l) _cutSet.add(c+k);
  for(const [c,l] of Object.entries(ai.extra||{})) for(const k of l){ (_extraMap.get(k)||_extraMap.set(k,[]).get(k)).push(c);
    const a=k.slice(0,3), b=k.slice(3); (AP_ROUTES[a]=AP_ROUTES[a]||[]); if(!AP_ROUTES[a].includes(b)) AP_ROUTES[a].push(b); (AP_ROUTES[b]=AP_ROUTES[b]||[]); if(!AP_ROUTES[b].includes(a)) AP_ROUTES[b].push(a); }
  _realOn.clear(); _ghostRoutes.clear();
  return true;
}
// Compagnies qui desservent réellement une ligne aujourd'hui (données réelles ± évolutions du monde vivant)
function carriersOn(a,b){
  const k=pairKey(a,b), base=realCarriers(a,b);
  if(!aiIndexes()) return base;
  const sp=S.ai.suspend, ca=AP(a).cc, cb=AP(b).cc, susp=sp&&((sp[ca]>S.time&&ca)||(sp[cb]>S.time&&cb));
  const out=base.filter(c=>!_deadSet.has(c)&&!_cutSet.has(c+k)&&(!susp||homeOf(c)===susp));
  for(const c of _extraMap.get(k)||[]) if(!out.includes(c)&&!_deadSet.has(c)) out.push(c);
  return out;
}
function airlinesOfCountry(cc, minPairs=3){
  if(typeof AIRLINE_DB==='undefined') return [];
  return Object.entries(AIRLINE_DB).filter(([c,a])=>a[1]===cc && AP(a[2]) && AP(a[2]).cc===cc && a[3]>=minPairs)
    .sort((x,y)=>y[1][3]-x[1][3]).map(([c])=>c);
}
function airlinesAt(code){
  aiIndexes(); const cnt={}; for(const b of AP_ROUTES[code]||[]) for(const c of carriersOn(code,b)) cnt[c]=(cnt[c]||0)+1;
  return Object.entries(cnt).sort((x,y)=>y[1]-x[1]);
}
// Fréquence quotidienne estimée d'une compagnie sur une ligne (par sens) : demande ÷ sièges ÷ nombre de compagnies
function realFreq(a,b,n){
  const d=dist(a,b), seats=d<800?150:d<3000?180:d<7000?260:300;
  const dem=marketDemand(a,b);
  return clamp(Math.round(dem/(seats*0.82)/Math.max(1,n||realCarriers(a,b).length)), 1, d>7000?3:d>3000?5:10);
}
// Flottes approximatives des grandes compagnies (ordre de grandeur public) ; estimation à partir du réseau pour les autres
const REAL_FLEET={AA:965,DL:975,UA:955,WN:800,FR:600,U2:340,LH:280,AF:220,BA:280,KL:115,EK:250,QR:230,TK:440,ET:150,SQ:150,CA:500,MU:600,CZ:650,
  AC:200,LA:330,NH:220,JL:190,KE:160,QF:130,EY:95,SV:145,CX:180,IB:85,AT:50,MS:80,KQ:40,SA:25,'6E':380,AI:200,W6:230,VY:125,TP:100,LX:90,
  SK:140,AS:300,B6:290,AV:150,CM:110,AM:120,G3:140,AD:190,HU:250,'3U':190,ZH:200,MF:210,PC:110,SU:180,AY:80,LO:80,OS:70,SN:45,AZ:95,A3:50,
  WS:180,F9:150,NK:200,G4:130,TO:110,EW:100,LS:120,FZ:85,WB:20,DT:30,BU:6};
const realFleet=(pairs,code)=>REAL_FLEET[code]||Math.max(4,Math.round(1.2*Math.pow(pairs,0.82)));

/* ---------- compagnies réelles comme concurrents ---------- */
// Compagnies qui ne sont pas dans S.rivals : présentes sur leurs lignes, sans gestion détaillée
const _ghost=new Map();
function ghostAirline(code){
  let R=_ghost.get(code); if(R) return R;
  const ai=typeof S!=='undefined'&&S&&S.ai&&S.ai.list.find(x=>x.code===code);
  const a=(typeof AIRLINE_DB!=='undefined'&&AIRLINE_DB[code])||(ai?[ai.name,ai.cc,ai.hub,ai.routes||1]:[code,'',null,1]);
  R={name:a[0], code, color:ai?ai.color:airlineColor(code), hub:a[2], real:true, ghost:true, quality:1, rep:62, fleet:realFleet(a[3],code), routes:[]};
  _ghost.set(code,R); return R;
}
function makeRealRival(code, local){
  const a=AIRLINE_DB[code], pairs=airlinePairs(code).filter(([x,y])=>AP(x)&&AP(y));
  const scored=pairs.map(([x,y])=>({a:x,b:y,s:marketDemand(x,y)})).sort((p,q)=>q.s-p.s).slice(0, local?400:260);
  const fleet=realFleet(a[3],code);
  return { name:a[0], code, color:airlineColor(code), hub:a[2], local:!!local, real:true, cash:fleet*22e6, fleet,
    quality:local?0.95:1.05, rep:local?58:70, paxDay:0, revDay:0, network:a[3],
    routes:scored.map(p=>({a:p.a, b:p.b, freq:realFreq(p.a,p.b)})) };
}
const WORLD_MAJORS=['EK','QR','TK','LH','AF','BA','DL','UA','AA','ET','SQ','CA','KL','QF','LA','NH','EY','KE','CX','SV','AC','IB','AT','MS','KQ'];
function initRealRivals(){
  const cc=homeCC(), mine=S.company.code;
  const locals=airlinesOfCountry(cc).filter(c=>c!==mine).slice(0,4);
  S.rivals=locals.map(c=>makeRealRival(c,true));
  // grandes compagnies mondiales, en priorité celles qui desservent votre pays
  const touch=c=>airlinePairs(c).filter(([x,y])=>AP(x)&&AP(y)&&(AP(x).cc===cc||AP(y).cc===cc)).length;
  const majors=WORLD_MAJORS.filter(c=>AIRLINE_DB[c] && !locals.includes(c) && AIRLINE_DB[c][1]!==cc)
    .map((c,i)=>({c, s:touch(c)*10+(WORLD_MAJORS.length-i)})).sort((x,y)=>y.s-x.s).slice(0,8);
  for(const {c} of majors) S.rivals.push(makeRealRival(c,false));
  S.rivalsReal=true;
}

/* ---------- index des lignes concurrentes ---------- */
let _rvIdx=null, _rvSig='';
function rivalSig(){ return (S.rivals||[]).map(R=>R.code+R.routes.length+'.'+(R._v||0)).join(); }
function rivalIndex(){
  const sig=rivalSig(); if(_rvIdx && sig===_rvSig && _rvIdx._S===S) return _rvIdx;
  const m=new Map(); m._S=S;
  for(const R of S.rivals||[]) for(const r of R.routes){ const k=pairKey(r.a,r.b); (m.get(k)||m.set(k,[]).get(k)).push({R,freq:r.freq}); }
  _rvIdx=m; _rvSig=sig; return m;
}
const _realOn=new Map();
// Toutes les compagnies présentes sur une ligne : vos concurrents suivis + les autres compagnies réelles
function rivalsOn(a,b){
  const k=pairKey(a,b), own=rivalIndex().get(k)||[]; aiIndexes();
  let rest=_realOn.get(k);
  if(!rest){ const cs=carriersOn(a,b); rest=cs.map(c=>({c, freq:realFreq(a,b,cs.length)})); _realOn.set(k,rest); }
  if(!rest.length) return own;
  const out=own.slice(), seen=new Set(own.map(x=>x.R.code));
  for(const x of rest) if(!seen.has(x.c) && !(S.absorbed||[]).includes(x.c)) out.push({R:ghostAirline(x.c), freq:x.freq});
  return out;
}

/* ---------- trafic réel visible sur la carte ---------- */
const _ghostRoutes=new Map();
// Lignes réelles autour des aéroports visibles (toutes compagnies), pour peupler le ciel
let _busyAps=null;
// route « fantôme » d'une compagnie (la même que celle dessinée sur la carte), pour lire son horaire
function ghostRouteOf(c,a,b){ const k=pairKey(a,b), key=c+k; let r=_ghostRoutes.get(key); if(!r){ r={a:k.slice(0,3), b:k.slice(3), freq:Math.min(3,realFreq(a,b)), c}; _ghostRoutes.set(key,r); } return r; }
function visibleRealRoutes(bounds, c0, limitAirports=50){
  aiIndexes();
  if(!_busyAps) _busyAps=AIRPORT_CODES.filter(c=>AP(c).traffic>=0.3).sort((x,y)=>AP(y).traffic-AP(x).traffic);
  const aps=[];
  for(const code of _busyAps){ if(!AP_ROUTES[code]) continue; const a=AP(code);
    if(bounds.contains([a.lat,unwrapLon(a.lon,c0)])){ aps.push(code); if(aps.length>=limitAirports) break; } }
  const out=[], seen=new Set();
  for(const code of aps.slice(0,limitAirports)) for(const b of AP_ROUTES[code]){
    const k=pairKey(code,b); if(seen.has(k)) continue; seen.add(k);
    for(const c of carriersOn(code,b).slice(0,3)){
      const key=c+k; let r=_ghostRoutes.get(key);
      if(!r){ r={a:k.slice(0,3), b:k.slice(3), freq:Math.min(3,realFreq(code,b)), c}; _ghostRoutes.set(key,r); }
      out.push({R:ghostAirline(c), r});
    }
  }
  return out;
}
