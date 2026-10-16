/* ============================================================
   RÉALISME — dimensions et performances réelles des avions,
   pistes réelles, courants-jets, charge marchande / distance,
   trajectoires alignées sur les pistes
   ============================================================ */

// [envergure m, longueur m, distance de décollage à la masse max (m, niveau de la mer, ISA)]
const AC_SPECS = {
  L410:[19.98,14.4,690], C408:[22,16.8,1000], D328:[21,21.3,1090], MA60:[29.2,24.7,1100], J328:[21,21.3,1370], RJ85:[26.3,28.6,1600], AN48:[28.9,29.1,1885], B722:[32.9,46.7,2600], TU54:[37.5,47.9,2300], A21F:[35.8,44.5,2200], A30F:[44.8,54.1,2400], B4BF:[64.4,70.7,3300],
  C208:[15.9,11.5,630], DHC6:[19.8,15.8,400], Q400:[28.4,32.8,1425], AT46:[24.6,22.7,1165], AT76:[27.1,27.2,1367], AT7F:[27.1,27.2,1400],
  CRJ2:[21.2,26.8,1920], CRJ7:[23.2,32.5,1605], CRJ9:[24.9,36.2,1939], E175:[26,31.7,2244], E190:[28.7,36.2,2056], E295:[35.1,41.5,1970],
  BCS1:[35.1,35,1463], BCS3:[35.1,38.7,1890], A19N:[35.8,33.8,2000], A20N:[35.8,37.6,2100], A21N:[35.8,44.5,2400], A21X:[35.8,44.5,2700],
  B738:[35.8,39.5,2316], B38M:[35.9,39.5,2500], B3XM:[35.9,43.8,2700], B38F:[35.8,39.5,2400], B752:[38,47.3,2100], B763:[47.6,54.9,2740],
  B76F:[47.6,54.9,2800], A333:[60.3,63.7,2770], A339:[64,63.7,2800], A33F:[60.3,58.8,2700], B788:[60.1,56.7,2600], B789:[60.1,62.8,2800],
  B78X:[60.1,68.3,2900], A359:[64.8,66.8,2600], A35K:[64.8,73.8,2700], B77E:[60.9,63.7,3000], B77W:[64.8,73.9,3100], B779:[71.8,76.7,3100],
  B77F:[64.8,63.7,3050], B744:[64.4,70.7,3300], B748:[68.4,76.3,3100], B74F:[68.4,76.3,3150], A388:[79.8,72.7,3000], CONC:[25.6,61.7,3400],
  SF34:[21.4,19.7,1300], DH8C:[27.4,25.7,1200], E145:[20,29.9,1970], E170:[26,29.9,1650], E195:[28.7,38.7,2180], E290:[33.7,36.2,1700],
  SU95:[27.8,29.9,1730], AJ27:[27.3,33.5,1700], C919:[35.8,38.9,2200], MC21:[35.9,42.3,2200], A318:[34.1,31.4,1780], A320:[35.8,37.6,2100],
  A321:[35.8,44.5,2400], B737:[35.8,33.6,2000], B39M:[35.9,42.2,2600], B712:[28.5,37.8,1950], B753:[38,54.4,2550], B75F:[38,47.3,2150],
  B764:[51.9,61.4,3100], A332:[60.3,58.8,2600], A343:[60.3,63.7,3000], A346:[63.5,75.4,3100], A35F:[64.8,70.8,2800], B77L:[64.8,63.7,3050],
  B778:[71.8,70.9,3000], MD11:[51.7,61.6,3100],
  PC12:[16.3,14.4,700], B190:[17.7,17.6,1100], E120:[19.8,20,1420], DH8A:[25.9,22.3,950], SB20:[24.8,27.3,1300], CRJX:[26.2,39.1,2000], F100:[28.1,35.5,1800],
  MD83:[32.9,45.1,2200], B733:[28.9,33.4,1900], B739:[34.3,42.1,2500], TU204:[42,46,2000], B762:[47.6,48.5,2500], A310:[43.9,46.7,2300], A338:[64,58.8,2600],
  DC10:[50.4,55.5,3000], IL96:[60.1,55.3,3100], B742:[59.6,70.5,3200],
};
function acSpec(m){
  const s=AC_SPECS[m.id]; if(s) return {span:s[0], len:s[1], tod:s[2]};
  const u=Math.max(m.seats,m.cargo*3,10); // modèles personnalisés : estimation à partir de la capacité
  return {span:Math.min(80,12+u*0.13), len:Math.min(80,10+u*0.14), tod:Math.min(3400,500+u*7)};
}
// Longueur de piste nécessaire : +7 % par 1 000 ft d'altitude, +20 % sur piste non revêtue
// masse au décollage typique ≈ 85 % de la distance à masse maximale
function runwayNeeded(m, code){ const el=(AP(code)&&AP(code).elev)||0; return Math.round(acSpec(m).tod*0.85*(1+Math.max(0,el)/1000*0.07)); }
function runwayCheck(m, code){
  const a=AP(code); const rws=runwaysOf(code);
  const need=runwayNeeded(m,code);
  if(!rws.length) return a.cls<m.cls? `Piste de ${a.city} (${code}) trop courte pour un ${m.name}` : null;
  const hard=rws.filter(r=>r.hard), best=Math.max(...(hard.length?hard:rws).map(r=>r.len));
  if(!hard.length && m.fam!=='TURBO') return `${a.city} (${code}) n’a qu’une piste non revêtue : réservée aux turbopropulseurs`;
  const need2=hard.length? need : need*1.2;
  if(best<need2) return `Piste de ${a.city} (${code}) : ${num0(best)} m, le ${m.name} a besoin de ${num0(need2)} m${a.elev>3000?` (altitude ${num0(a.elev)} ft)`:''}`;
  return null;
}

/* ---------- pistes ---------- */
const _rwCache={};
function destPt(lat,lon,hdg,km){
  const δ=km/6371, θ=toRad(hdg), φ1=toRad(lat), λ1=toRad(lon);
  const φ2=Math.asin(Math.sin(φ1)*Math.cos(δ)+Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
  const λ2=λ1+Math.atan2(Math.sin(θ)*Math.sin(δ)*Math.cos(φ1),Math.cos(δ)-Math.sin(φ1)*Math.sin(φ2));
  return {lat:toDeg(φ2), lon:toDeg(λ2)};
}
// Chaque piste physique donne deux sens d'utilisation (ex. 06 et 24)
function runwaysOf(code){
  if(_rwCache[code]) return _rwCache[code];
  const raw=(typeof RUNWAY_DB!=='undefined'&&RUNWAY_DB[code])||[], a=AP(code), out=[];
  for(const [le,he,la1,lo1,la2,lo2,hdg0,len,wid,hard] of raw){
    let p1,p2,h;
    if(la1!==null&&la2!==null){ p1={lat:la1,lon:lo1}; p2={lat:la2,lon:lo2}; h=bearing(p1,p2); }
    else if(hdg0!==null){ h=hdg0; p1=destPt(a.lat,a.lon,h+180,len/2000); p2=destPt(a.lat,a.lon,h,len/2000); }
    else continue;
    const L=gcDist(p1,p2)*1000||len;
    out.push({id:le, hdg:h, thr:p1, end:p2, len:Math.max(len,L), wid, hard:!!hard});
    out.push({id:he, hdg:(h+180)%360, thr:p2, end:p1, len:Math.max(len,L), wid, hard:!!hard});
  }
  return _rwCache[code]=out;
}
const angDiff=(a,b)=>Math.abs(((a-b+540)%360)-180);
// Piste la mieux orientée pour un cap donné (en pratique le vent décide ; ici la direction du vol)
function bestRunway(code, course, m){
  const rws=runwaysOf(code); if(!rws.length) return null;
  const need=m? runwayNeeded(m,code) : 0;
  const ok=rws.filter(r=>r.len>=need*(r.hard?1:1.2)); const list=ok.length?ok:rws;
  return list.slice().sort((x,y)=>(angDiff(x.hdg,course)-y.len/400)-(angDiff(y.hdg,course)-x.len/400))[0];
}

/* ---------- vents en altitude (courants-jets) ---------- */
const _windCache={};
// Composante de vent sur la route (km/h, + = vent arrière) : courants-jets d'ouest autour de 35° de latitude
function windKmh(a,b){
  const k=a+b; if(_windCache[k]!==undefined) return _windCache[k];
  const A=AP(a), B=AP(b); let s=0, n=0;
  for(let i=1;i<=7;i++){
    const p=gcInterp(A,B,i/8), q=gcInterp(A,B,Math.min(1,i/8+0.02));
    const jet=180*Math.exp(-Math.pow((Math.abs(p.lat)-40)/13,2)) - 18*Math.exp(-Math.pow(p.lat/14,2)); // jets d'ouest / alizés d'est
    s+=jet*Math.sin(toRad(bearing(p,q))); n++;
  }
  return _windCache[k]=Math.round(n?s/n:0);
}

/* ---------- charge marchande selon la distance ---------- */
function payloadFactor(m, d){ const R=m.range; if(d<=0.82*R) return 1; return clamp(1-(d-0.82*R)/(0.18*R)*0.45, 0.5, 1); }

/* ---------- trajectoires alignées sur les pistes ---------- */
const _pathCache=new Map();
function invalidateAirspacePathCache(){ _pathCache.clear(); }
// ---------- points de passage ----------
const navHash=str=>{ let h=2166136261; for(const ch of str) h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0; return h; };
function navRng(seed){ let a=seed>>>0||1; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
let _navFix=null;
function navFixes(){ if(_navFix) return _navFix; _navFix=AIRPORT_CODES.filter(c=>AP(c).traffic>=0.04).map(c=>({lat:AP(c).lat,lon:AP(c).lon,name:AP(c).city})); return _navFix; }
// 1 à 3 points de passage : petit écart (4-8 %) ou variante (8-20 %), toujours d'un côté choisi au hasard
function navVia(A,B,seed){
  const D=gcDist(A,B); if(D<350) return [];
  const rng=navRng(seed), r0=rng();
  // trois styles de route, tirés à chaque vol : près du direct, variante, ou par une tout autre région
  // deux styles, tirés à chaque vol : un petit écart (4-8 %) ou une variante plus marquée (8-20 %), jamais plus de 20 %
  const mode=D<900||r0<0.3?'near':'mid';
  const eps=mode==='near'?0.04+rng()*0.04:0.08+rng()*0.12, max=D*(1+eps);
  const n=D<1500?1:D<4500?1+(rng()<0.5?1:0):2+(rng()<0.5?1:0);
  const pad=D*(mode==='mid'?0.45:0.25)/111, wide=Math.abs(A.lon-B.lon)>180;
  const la0=Math.min(A.lat,B.lat)-pad, la1=Math.max(A.lat,B.lat)+pad, lo0=Math.min(A.lon,B.lon)-pad*1.5, lo1=Math.max(A.lon,B.lon)+pad*1.5;
  const cands=navFixes().filter(f=>f.lat>la0&&f.lat<la1&&(wide||(f.lon>lo0&&f.lon<lo1)));
  const side=rng()<0.5?1:-1, brg=bearing(A,B);
  const sideOf=P=>{ const d=((bearing(A,P)-brg+540)%360)-180; return d>=0?1:-1; };   // à droite ou à gauche de la route directe
  const out=[]; let prev=A, used=0;
  for(let k=1;k<=n;k++){
    const first=k===1;
    const fT=first?0.25+rng()*0.5:Math.min(0.85,Math.max(0.15,k/(n+1)+(rng()-0.5)*0.14));
    const ok=P=>{ if(out.includes(P)||out.some(q=>q.name&&q.name===P.name)) return false; const a=gcDist(A,P), b=gcDist(P,B), f=a/(a+b); if(first){ const det=(a+b)/D-1; return f>0.18&&f<0.82&&det>=eps*0.45&&used+gcDist(prev,P)+b<=max&&sideOf(P)===side; }
      return Math.abs(f-fT)<0.13&&used+gcDist(prev,P)+b<=max&&a>gcDist(A,prev)-50; };
    let P=null;
    if(first||rng()<0.75){ const L=cands.filter(ok); if(L.length) P=L[Math.floor(rng()*L.length)]; }
    if(!P){ const base=gcInterp(A,B,fT), hd=(brg+(first?side*90:(rng()<0.5?90:-90))+360)%360; let off=D*eps*(first?0.9:0.4+rng()*0.9);
      for(let t=0;t<7;t++){ const q=destPt(base.lat,base.lon,hd,off); if(used+gcDist(prev,q)+gcDist(q,B)<=max){ P={lat:q.lat,lon:q.lon,name:null}; break; } off*=0.65; } }
    if(!P) continue; used+=gcDist(prev,P); prev=P; out.push(P);
  }
  return out;
}
function legPath(leg, m){
  const carrier=leg.ownerCode||(S&&S.company&&S.company.code)||'', rev=typeof airspacePolicyRev==='function'?airspacePolicyRev():0;
  // chaque vol a sa propre route (aller, retour, et chaque nouveau départ) : graine propre au vol
  const seed=leg.seed!==undefined?leg.seed:(leg.dep?Math.floor(leg.dep/60000):0);
  const key=leg.from+'>'+leg.to+'|'+(m?m.id:'')+'|'+carrier+'|'+rev+'|'+seed;
  if(_pathCache.has(key)) return _pathCache.get(key);
  if(_pathCache.size>3000) _pathCache.clear();
  const A=AP(leg.from), B=AP(leg.to);
  const plan=typeof airspaceRoutePlan==='function'?airspaceRoutePlan(carrier,leg.from,leg.to):null;
  const route=plan&&plan.points&&plan.points.length>1?plan.points:[A,B];
  const dep=bestRunway(leg.from, bearing(A,route[1]||B), m);
  const arrCourse=bearing(route[route.length-2]||A,B);
  const arr=bestRunway(leg.to, arrCourse, m);
  const short=leg.dist<60;
  const air=[];
  if(dep){ air.push(dep.thr, destPt(dep.thr.lat,dep.thr.lon,dep.hdg,dep.len/1000*0.55), dep.end, destPt(dep.end.lat,dep.end.lon,dep.hdg,short?2:6)); }
  else air.push({lat:A.lat,lon:A.lon});
  const faf = arr? destPt(arr.thr.lat,arr.thr.lon,(arr.hdg+180)%360, short?4:14) : {lat:B.lat,lon:B.lon};
  const anchors=[air[air.length-1],...route.slice(1,-1),faf];
  // les avions ne volent pas en ligne droite : ils suivent des points de passage (villes, îles, balises),
  // différents à chaque vol, avec un détour limité ; les détours d'espace aérien interdit restent prioritaires
  const via=route.length>2?[]:navVia(air[air.length-1],faf,(seed*2654435761+navHash(leg.from+'>'+leg.to+carrier))>>>0);
  let nodes=[air[air.length-1],...route.slice(1,-1),...via,faf];
  for(let it=0;it<2&&nodes.length>2;it++){ const sm=[nodes[0]]; for(let i=0;i<nodes.length-1;i++){ const P=nodes[i], Q=nodes[i+1]; if(i>0) sm.push(gcInterp(P,Q,0.25)); if(i<nodes.length-2) sm.push(gcInterp(P,Q,0.75)); } sm.push(nodes[nodes.length-1]); nodes=sm; }   // virages adoucis
  for(let j=1;j<nodes.length;j++){ const s=nodes[j-1], e=nodes[j], n=Math.max(1,Math.ceil(gcDist(s,e)/120));
    for(let i=1;i<=n;i++){ const p=gcInterp(s,e,i/n); air.push({lat:p.lat,lon:p.lon}); } }
  if(arr){ air.push(arr.thr, destPt(arr.thr.lat,arr.thr.lon,arr.hdg,Math.min(arr.len/1000*0.65,2.2))); }
  else air.push({lat:B.lat,lon:B.lon});
  const cum=[0]; for(let i=1;i<air.length;i++) cum.push(cum[i-1]+gcDist(air[i-1],air[i]));
  const p={air, cum, total:cum[cum.length-1]||1, dep, arr,
    gateA:{lat:A.lat,lon:A.lon}, gateB:{lat:B.lat,lon:B.lon}, route, via:[...new Set(via.map(v=>v.name).filter(Boolean))]};
  _pathCache.set(key,p); return p;
}
function pointOnPath(p, s){
  s=clamp(s,0,p.total); const c=p.cum;
  let i=1; while(i<c.length-1 && c[i]<s) i++;
  const seg=c[i]-c[i-1]||1, u=clamp((s-c[i-1])/seg,0,1);
  const a=p.air[i-1], b=p.air[i];
  const pt=gcInterp(a,b,u);
  return {lat:pt.lat, lon:pt.lon, hdg:bearing(a,b)};
}
const lerpPt=(a,b,u)=>({lat:a.lat+(b.lat-a.lat)*u, lon:a.lon+(b.lon-a.lon)*u, hdg:bearing(a,b)});

/* ---------- aires de stationnement et roulage ---------- */
const M_DEG=111320;
// repère local d'une piste : a = distance le long de l'axe depuis le seuil, x = écart latéral (m, + à droite)
function toRw(r,p){ const k=Math.cos(toRad(r.thr.lat)), dx=(p.lon-r.thr.lon)*M_DEG*k, dy=(p.lat-r.thr.lat)*M_DEG, h=toRad(r.hdg);
  return {a:dx*Math.sin(h)+dy*Math.cos(h), x:dx*Math.cos(h)-dy*Math.sin(h)}; }
function fromRw(r,a,x){ const h=toRad(r.hdg), dx=a*Math.sin(h)+x*Math.cos(h), dy=a*Math.cos(h)-x*Math.sin(h);
  return {lat:r.thr.lat+dy/M_DEG, lon:r.thr.lon+dx/(M_DEG*Math.cos(toRad(r.thr.lat)))}; }
const _apron={};
// Aire de trafic : le point de référence de l'aéroport, décalé hors des pistes s'il tombe dessus
function apronOf(code){
  if(_apron[code]) return _apron[code];
  const A=AP(code), rws=runwaysOf(code), ref={lat:A.lat,lon:A.lon};
  if(!rws.length) return _apron[code]={g:ref, rw:null, side:1, a:0, x:0};
  const clear=p=>rws.every(r=>{ const f=toRw(r,p); return f.a<-200 || f.a>r.len+200 || Math.abs(f.x)>(r.wid||45)/2+170; });
  let main=rws[0], best=1e12;
  for(const r of rws){ const f=toRw(r,ref), dd=Math.abs(f.x)+Math.max(0,-f.a,f.a-r.len); if(dd<best-1){ best=dd; main=r; } }
  let g=ref;
  if(!clear(ref)){
    const f=toRw(main,ref), sg=f.x>=0?1:-1, a=clamp(f.a,main.len*0.3,main.len*0.7);
    search: for(const off of [330,450,600,800,1000]) for(const s of [sg,-sg]){ const p=fromRw(main,a,s*off); if(clear(p)){ g=p; break search; } }
    if(g===ref) g=fromRw(main,a,sg*330);
  }
  const f=toRw(main,g);
  return _apron[code]={g, rw:main, side:f.x>=0?1:-1, a:f.a, x:f.x};
}
// Poste de stationnement n° k (rangée parallèle à la piste, nez vers l'aérogare)
function slotPt0(code,k){
  const ap=apronOf(code), off=((k%2)?1:-1)*Math.ceil(k/2)*85;
  if(!ap.rw) return {lat:ap.g.lat, lon:ap.g.lon+off/(M_DEG*Math.cos(toRad(ap.g.lat))), hdg:0};
  return {...fromRw(ap.rw, ap.a+off, ap.x), hdg:(ap.rw.hdg+90*ap.side+360)%360};
}
// portes de tous les terminaux (T1 puis T2, T3, T4 construits par le joueur)
function slotPt(code,k){ const g=typeof apGates==='function'?apGates(code):null; return g&&g.length? {...g[((k%g.length)+g.length)%g.length]} : slotPt0(code,k); }
const acSlotHash=id=>{ let h=7; for(const c of id) h=(h*31+c.charCodeAt(0))%9973; return h; };
const legIntl=l=>!!(l&&AP(l.from)&&AP(l.to)&&AP(l.from).cc!==AP(l.to).cc);
// vol international → T2/T4 s'ils existent ; vol intérieur → T1/T3
function gateIdx(code, ac, intl){
  const g=typeof apGates==='function'?apGates(code):null, h0=acSlotHash(ac.id), h=(Math.imul(h0+1,2654435761)>>>8)%100003;
  if(!g||!g.length) return 8+h0%14;
  const terms=[...new Set(g.map(x=>x.t))], want=intl?['T2','T4']:['T1','T3'];
  let pool=terms.filter(t=>want.includes(t)); if(!pool.length) pool=terms;
  const t=pool[h%pool.length], idx=[]; g.forEach((x,i)=>{ if(x.t===t) idx.push(i); });
  const free=t==='T1'&&idx.length>8? idx.slice(6) : idx;     // T1 : les 6 premières portes servent aux autres compagnies
  return free[Math.floor(h/7)%free.length];
}
function gateSlot(code, ac, intl){ return slotPt(code, gateIdx(code, ac, intl===undefined?!!ac.gIntl:intl)); }
// porte de départ : celle où l'avion est garé (fixée par son dernier vol arrivé)
const depIntl=(ac,fl)=>fl&&fl.li>0? legIntl(fl.legs[fl.li-1]) : !!ac.gIntl;
// Roulage : poste → voie de circulation parallèle → point d'attente → seuil de piste
function taxiOutPts(path, gp){
  if(gp.via&&gp.via.length){ const v=gp.via, rest=taxiOutPts(path, v[v.length-1]); return [gp, ...v, ...rest.slice(1)]; }
  const r=path.dep; if(!r) return [gp, path.air[0]];
  const f=toRw(r,gp), tw=(f.x>=0?1:-1)*Math.min(Math.abs(f.x)*0.6,190);
  if(Math.abs(f.x)<40) return [gp, r.thr];
  return [gp, fromRw(r,f.a,tw), fromRw(r,-40,tw), fromRw(r,-25,tw*0.3), r.thr];
}
// Dégagement : sortie rapide → voie parallèle → poste
function taxiInPts(path, gp){
  if(gp.via&&gp.via.length){ const v=gp.via, rest=taxiInPts(path, v[v.length-1]); return [...rest, ...v.slice(0,-1).reverse(), gp]; }
  const r=path.arr, E=path.air[path.air.length-1]; if(!r) return [E, gp];
  const f=toRw(r,gp), aE=toRw(r,E).a, tw=(f.x>=0?1:-1)*Math.min(Math.abs(f.x)*0.6,190);
  if(Math.abs(f.x)<40) return [E, gp];
  return [E, fromRw(r,aE+260,tw), fromRw(r,f.a,tw), gp];
}
// Point d'attente : sur le taxiway parallèle, avant le seuil, jamais sur la piste ; file d'attente vers l'arrière
function holdPoint(path,gp,rank){
  const r=path.dep; if(!r) return {lat:gp.lat,lon:gp.lon,hdg:gp.hdg||0};
  const f=toRw(r,gp), s=f.x>=0?1:-1, lat=s*Math.max(75,Math.min(Math.abs(f.x)*0.6,190)), a=-70-(rank||0)*80;
  const q=fromRw(r,a,lat); return {lat:q.lat,lon:q.lon,hdg:r.hdg};
}
function polyAt(pts,u){
  let tot=0; const seg=[]; for(let i=1;i<pts.length;i++){ const d=gcDist(pts[i-1],pts[i]); seg.push(d); tot+=d; }
  let s=clamp(u,0,1)*tot, i=0; while(i<seg.length-1 && s>seg[i]){ s-=seg[i]; i++; }
  const a=pts[i], b=pts[i+1]||a, v=seg[i]? clamp(s/seg[i],0,1) : 1;
  return {lat:a.lat+(b.lat-a.lat)*v, lon:a.lon+(b.lon-a.lon)*v, hdg:bearing(a,b)};
}
// Hauteur du soleil (degrés) en un point, pour l'éclairage des pistes
function sunElev(lat, lon, t){ const {decl,lon:sl}=sunPosition(t);
  return toDeg(Math.asin(Math.sin(toRad(lat))*Math.sin(toRad(decl))+Math.cos(toRad(lat))*Math.cos(toRad(decl))*Math.cos(toRad(lon-sl)))); }
