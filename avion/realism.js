/* ============================================================
   RÉALISME — dimensions et performances réelles des avions,
   pistes réelles, courants-jets, charge marchande / distance,
   trajectoires alignées sur les pistes
   ============================================================ */

// [envergure m, longueur m, distance de décollage à la masse max (m, niveau de la mer, ISA)]
const AC_SPECS = {
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
function legPath(leg, m){
  const key=leg.from+'>'+leg.to+'|'+(m?m.id:'');
  if(_pathCache.has(key)) return _pathCache.get(key);
  if(_pathCache.size>3000) _pathCache.clear();
  const A=AP(leg.from), B=AP(leg.to);
  const dep=bestRunway(leg.from, bearing(A,B), m);
  const arrCourse=(bearing(B,A)+180)%360;
  const arr=bestRunway(leg.to, arrCourse, m);
  const short=leg.dist<60;
  const air=[];
  if(dep){ air.push(dep.thr, destPt(dep.thr.lat,dep.thr.lon,dep.hdg,dep.len/1000*0.55), dep.end, destPt(dep.end.lat,dep.end.lon,dep.hdg,short?2:6)); }
  else air.push({lat:A.lat,lon:A.lon});
  const faf = arr? destPt(arr.thr.lat,arr.thr.lon,(arr.hdg+180)%360, short?4:14) : {lat:B.lat,lon:B.lon};
  const s=air[air.length-1], gd=gcDist(s,faf), n=Math.max(2,Math.ceil(gd/120));
  for(let i=1;i<=n;i++){ const p=gcInterp(s,faf,i/n); air.push({lat:p.lat,lon:p.lon}); }
  if(arr){ air.push(arr.thr, destPt(arr.thr.lat,arr.thr.lon,arr.hdg,Math.min(arr.len/1000*0.65,2.2))); }
  else air.push({lat:B.lat,lon:B.lon});
  const cum=[0]; for(let i=1;i<air.length;i++) cum.push(cum[i-1]+gcDist(air[i-1],air[i]));
  const p={air, cum, total:cum[cum.length-1]||1, dep, arr,
    gateA:{lat:A.lat,lon:A.lon}, gateB:{lat:B.lat,lon:B.lon}};
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
function slotPt(code,k){
  const ap=apronOf(code), off=((k%2)?1:-1)*Math.ceil(k/2)*85;
  if(!ap.rw) return {lat:ap.g.lat, lon:ap.g.lon+off/(M_DEG*Math.cos(toRad(ap.g.lat))), hdg:0};
  return {...fromRw(ap.rw, ap.a+off, ap.x), hdg:(ap.rw.hdg+90*ap.side+360)%360};
}
const acSlotHash=id=>{ let h=7; for(const c of id) h=(h*31+c.charCodeAt(0))%9973; return h; };
function gateSlot(code, ac){ return slotPt(code, 8+acSlotHash(ac.id)%14); }
// Roulage : poste → voie de circulation parallèle → point d'attente → seuil de piste
function taxiOutPts(path, gp){
  const r=path.dep; if(!r) return [gp, path.air[0]];
  const f=toRw(r,gp), tw=(f.x>=0?1:-1)*Math.min(Math.abs(f.x)*0.6,190);
  if(Math.abs(f.x)<40) return [gp, r.thr];
  return [gp, fromRw(r,f.a,tw), fromRw(r,-40,tw), fromRw(r,-25,tw*0.3), r.thr];
}
// Dégagement : sortie rapide → voie parallèle → poste
function taxiInPts(path, gp){
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
