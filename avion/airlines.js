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
/* Espace aérien : géofences Natural Earth, règles bilatérales et itinéraires de contournement. */
const AIRSPACE_KP_EXEMPT=new Set(['CN','RU','CD','NG']);
const AIRSPACE_RW_DENY=new Set(['CD','KP','SD','PS','IR','UA']);
const AIRSPACE_CLOSED_TO_HOME={IR:new Set(['US']),UA:new Set(['RU'])};
const _airspaceRouteCache=new Map();
const _airspacePolygons={};
for(const [cc,g] of Object.entries(typeof AIRSPACE_ZONES!=='undefined'?AIRSPACE_ZONES:{})){
  const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  _airspacePolygons[cc]=polys.map(rings=>{ const outer=rings[0]; let minX=180,maxX=-180,minY=90,maxY=-90;
    for(const p of outer){ minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); }
    return {rings,minX,maxX,minY,maxY}; });
}
function airlineHomeCountry(code){
  const player=typeof S!=='undefined'&&S&&S.company;
  if(player&&player.code===code){ const hub=AP(player.hub); if(hub&&hub.cc) return hub.cc; }
  const a=typeof AIRLINE_DB!=='undefined'&&AIRLINE_DB[code]; if(a&&a[1]) return a[1];
  const e=typeof S!=='undefined'&&S&&S.ai&&S.ai.list&&S.ai.list.find(x=>x.code===code); if(e&&e.cc) return e.cc;
  const r=typeof S!=='undefined'&&S&&S.rivals&&S.rivals.find(x=>x.code===code); return r&&(r.cc||(AP(r.hub)||{}).cc)||'';
}
function airspacePolicyRev(){ return typeof S!=='undefined'&&S?S.airspacePolicyRev||0:0; }
function airspaceDefaultBan(zone,home){
  return (zone==='KP'&&!AIRSPACE_KP_EXEMPT.has(home)) || (home==='RW'&&AIRSPACE_RW_DENY.has(zone)) || !!(AIRSPACE_CLOSED_TO_HOME[zone]&&AIRSPACE_CLOSED_TO_HOME[zone].has(home));
}
function airspaceReason(cc){
  return cc==='KP'?'La Corée du Nord n’autorise que les compagnies de Chine, Russie, RDC et Nigeria.':cc==='CD'?'La RDC interdit le survol aux compagnies rwandaises.':cc==='IR'?'L’Iran ferme son espace aérien aux compagnies américaines.':cc==='UA'?'L’Ukraine ferme son espace aérien aux compagnies russes.':'La compagnie n’est pas autorisée dans cet espace aérien.';
}
// cache : les zones interdites ne dépendent que du pays de la compagnie et des règles en vigueur
let _azKey='', _azCache=new Map();
function airspaceZonesFor(code){
  const k=airspacePolicyRev()+'|'+JSON.stringify((typeof S!=='undefined'&&S&&S.airspaceBans)||0).length+'|'+airspaceWarZones().join(','); if(k!==_azKey){ _azKey=k; _azCache.clear(); }
  const home=airlineHomeCountry(code); let z=_azCache.get(home); if(!z){ z=airspaceZonesCalc(home); _azCache.set(home,z); } return z; }
// pays en guerre (directeur du monde) : le ciel est fermé à toutes les compagnies étrangères
let _awT=-1, _awZ=[];
function airspaceWarZones(){ const W=typeof S!=='undefined'&&S&&S.wd; if(!W||!Array.isArray(W.wars)) return [];
  const t=Math.floor(S.time/HOUR); if(t===_awT) return _awZ; _awT=t;
  return _awZ=[...new Set(W.wars.filter(w=>w.stage==='war').flatMap(w=>w.ccs||[]))].filter(cc=>_airspacePolygons[cc]).sort(); }
{ const _ar=airspaceReason; airspaceReason=function(cc){ return airspaceWarZones().includes(cc)?`⚔️ ${COUNTRIES[cc]?COUNTRIES[cc][0]:cc} est en guerre : son espace aérien est fermé aux compagnies étrangères.`:_ar(cc); }; }
function airspaceZonesCalc(home){
  const zones=airspaceWarZones().filter(cc=>cc!==home);
  for(const cc of Object.keys(_airspacePolygons)){
    const custom=typeof S!=='undefined'&&S&&S.airspaceBans&&S.airspaceBans[cc];
    if(!zones.includes(cc)&&(airspaceDefaultBan(cc,home)||(Array.isArray(custom)&&custom.includes(home)))) zones.push(cc);
  }
  return zones;
}
function airspacePointInRing(lon,lat,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const xi=ring[i][0], yi=ring[i][1], xj=ring[j][0], yj=ring[j][1];
    if((yi>lat)!==(yj>lat) && lon<(xj-xi)*(lat-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
function airspaceContainsPoly(poly,lon,lat){
    if(!poly||lon<poly.minX||lon>poly.maxX||lat<poly.minY||lat>poly.maxY||!airspacePointInRing(lon,lat,poly.rings[0])) return false;
    let hole=false; for(let i=1;i<poly.rings.length;i++) if(airspacePointInRing(lon,lat,poly.rings[i])){ hole=true; break; }
    return !hole;
}
function airspaceContains(cc,lon,lat){ return (_airspacePolygons[cc]||[]).some(poly=>airspaceContainsPoly(poly,lon,lat));
}
function airspaceNear(cc,lon,lat,pad){
  return (_airspacePolygons[cc]||[]).some(poly=>lon>=poly.minX-pad&&lon<=poly.maxX+pad&&lat>=poly.minY-pad&&lat<=poly.maxY+pad);
}
// test rapide : distance du grand cercle a→b au cercle qui englobe la zone (la plupart des lignes passent très loin)
function _asV(lat,lon){ const r=Math.PI/180, c=Math.cos(lat*r); return [c*Math.cos(lon*r),c*Math.sin(lon*r),Math.sin(lat*r)]; }
function _asCircle(poly){ if(poly._c) return poly._c; const lat=(poly.minY+poly.maxY)/2, lon=(poly.minX+poly.maxX)/2;
  const rad=Math.max(gcDist({lat,lon},{lat:poly.minY,lon:poly.minX}),gcDist({lat,lon},{lat:poly.maxY,lon:poly.maxX}),gcDist({lat,lon},{lat:poly.minY,lon:poly.maxX}),gcDist({lat,lon},{lat:poly.maxY,lon:poly.minX}));
  return poly._c={v:_asV(lat,lon),lat,lon,rad:rad+60}; }
function _asFar(poly,pa,pb){ const C=_asCircle(poly), a=_asV(pa.lat,pa.lon), b=_asV(pb.lat,pb.lon), c=C.v;
  const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], nl=Math.hypot(n[0],n[1],n[2]);
  const dEnd=Math.min(gcDist(pa,C),gcDist(pb,C)); if(nl<1e-9) return dEnd>C.rad;
  const cn=(c[0]*n[0]+c[1]*n[1]+c[2]*n[2])/nl, ct=Math.abs(Math.asin(clamp(cn,-1,1)))*6371;
  const ac=[a[1]*c[2]-a[2]*c[1],a[2]*c[0]-a[0]*c[2],a[0]*c[1]-a[1]*c[0]], cb=[c[1]*b[2]-c[2]*b[1],c[2]*b[0]-c[0]*b[2],c[0]*b[1]-c[1]*b[0]];
  const within=(ac[0]*n[0]+ac[1]*n[1]+ac[2]*n[2])>0&&(cb[0]*n[0]+cb[1]*n[1]+cb[2]*n[2])>0;
  return (within?ct:dEnd)>C.rad; }
function airspaceSegmentCrosses(cc,pa,pb,onlyPoly){
  if(!_airspacePolygons[cc]) return false;
  if(!pa||!pb||!Number.isFinite(pa.lat)||!Number.isFinite(pa.lon)||!Number.isFinite(pb.lat)||!Number.isFinite(pb.lon)) return false;
  if(onlyPoly?_asFar(onlyPoly,pa,pb):_airspacePolygons[cc].every(poly=>_asFar(poly,pa,pb))) return false;
  const rad=Math.PI/180,p1=pa.lat*rad,l1=pa.lon*rad,p2=pb.lat*rad,l2=pb.lon*rad;
  const v1=[Math.cos(p1)*Math.cos(l1),Math.cos(p1)*Math.sin(l1),Math.sin(p1)];
  const v2=[Math.cos(p2)*Math.cos(l2),Math.cos(p2)*Math.sin(l2),Math.sin(p2)];
  const dot=clamp(v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2],-1,1), angle=Math.acos(dot), sin=Math.sin(angle);
  const total=angle*6371, pointAt=t=>{ let x,y,z;
    if(Math.abs(sin)<1e-7){ x=v1[0]*(1-t)+v2[0]*t; y=v1[1]*(1-t)+v2[1]*t; z=v1[2]*(1-t)+v2[2]*t; }
    else{ const u=Math.sin((1-t)*angle)/sin,v=Math.sin(t*angle)/sin; x=u*v1[0]+v*v2[0]; y=u*v1[1]+v*v2[1]; z=u*v1[2]+v*v2[2]; }
    return [Math.atan2(y,x)/rad,Math.atan2(z,Math.hypot(x,y))/rad];
  };
  // La plupart des routes sont loin de ces pays : échantillonnage grossier avant le test précis à 20 km.
  const coarse=Math.max(1,Math.ceil(total/500)); let near=false;
  for(let i=0;i<=coarse;i++){ const p=pointAt(i/coarse); if(onlyPoly?(p[0]>=onlyPoly.minX-5&&p[0]<=onlyPoly.maxX+5&&p[1]>=onlyPoly.minY-5&&p[1]<=onlyPoly.maxY+5):airspaceNear(cc,p[0],p[1],5)){ near=true; break; } }
  if(!near) return false;
  const steps=Math.max(1,Math.ceil(total/(cc==='PS'?3:20)));
  for(let i=0;i<=steps;i++){
    const p=pointAt(i/steps); if(onlyPoly?airspaceContainsPoly(onlyPoly,p[0],p[1]):airspaceContains(cc,p[0],p[1])) return true;
  }
  return false;
}
function airspaceRouteCrosses(cc,a,b){ return airspaceSegmentCrosses(cc,AP(a),AP(b)); }
function airspacePoint(p){ return {lat:p.lat,lon:p.lon}; }
function airspaceFindCrossing(cc,a,b){
  const poly=(_airspacePolygons[cc]||[]).find(p=>airspaceSegmentCrosses(cc,a,b,p)); if(!poly) return null;
  const total=gcDist(a,b), steps=Math.max(1,Math.ceil(total/20)); let first=-1,last=-1;
  for(let i=0;i<=steps;i++){ const p=gcInterp(a,b,i/steps); if(airspaceContainsPoly(poly,p.lon,p.lat)){ if(first<0) first=i; last=i; } }
  if(first<0) return null;
  let lo=Math.max(0,first-2), hi=Math.min(steps,last+2), before=gcInterp(a,b,lo/steps), after=gcInterp(a,b,hi/steps), guard=0;
  while(airspaceContainsPoly(poly,before.lon,before.lat)&&lo>0&&guard++<8){ lo=Math.max(0,lo-2); before=gcInterp(a,b,lo/steps); }
  guard=0; while(airspaceContainsPoly(poly,after.lon,after.lat)&&hi<steps&&guard++<8){ hi=Math.min(steps,hi+2); after=gcInterp(a,b,hi/steps); }
  return {poly,before:airspacePoint(before),after:airspacePoint(after)};
}
function airspaceDetourCandidates(poly){
  const groups=[],mid=(poly.minY+poly.maxY)/2;
  for(const margin of [1.2,2.5,5]){
    const padLon=margin/Math.max(0.35,Math.cos(toRad(mid))),x0=poly.minX-padLon,x1=poly.maxX+padLon,y0=poly.minY-margin,y1=poly.maxY+margin;
    const corners=[{lat:y1,lon:x0},{lat:y1,lon:x1},{lat:y0,lon:x1},{lat:y0,lon:x0}], paths=[];
    for(let start=0;start<4;start++) for(let end=0;end<4;end++) if(start!==end) for(const dir of [1,-1]){
      const via=[corners[start]]; let k=start,guard=0;
      while(k!==end&&guard++<4){ k=(k+dir+4)%4; via.push(corners[k]); }
      paths.push(via);
    }
    groups.push(paths);
  }
  return groups;
}
function airspaceRoutePlan(code,a,b){
  // le trajet ne dépend que des zones interdites : toutes les compagnies d'un même pays partagent le calcul
  const zones=airspaceZonesFor(code), key=`${zones.join(',')}:${a}>${b}:p${airspacePolicyRev()}`;
  if(_airspaceRouteCache.has(key)) return _airspaceRouteCache.get(key);
  const A=AP(a),B=AP(b); if(!A||!B) return {points:[],distance:0,violation:null};
  if(!zones.length){ const plan={points:[airspacePoint(A),airspacePoint(B)],distance:gcDist(A,B),violation:null}; _airspaceRouteCache.set(key,plan); return plan; }
  const blocked=zones.find(cc=>A.cc===cc||B.cc===cc);
  if(blocked){ const plan={points:[airspacePoint(A),airspacePoint(B)],distance:gcDist(A,B),violation:{country:blocked,reason:airspaceReason(blocked)}}; _airspaceRouteCache.set(key,plan); return plan; }
  let points=[airspacePoint(A),airspacePoint(B)], failure=null;
  for(let pass=0;pass<Math.max(4,zones.length*3);pass++){
    let hit=null;
    outer: for(let i=0;i<points.length-1;i++) for(const cc of zones){
      const crossing=airspaceFindCrossing(cc,points[i],points[i+1]); if(crossing){ hit={i,cc,...crossing}; break outer; }
    }
    if(!hit) break;
    let best=null; const segA=points[hit.i],segB=points[hit.i+1],segD=gcDist(segA,segB);
    const tBefore=segD?gcDist(segA,hit.before)/segD:0,tAfter=segD?gcDist(segA,hit.after)/segD:1;
    for(const extra of [0,250,500,1000,2000]){
      const before=gcInterp(segA,segB,Math.max(0,tBefore-extra/Math.max(1,segD))),after=gcInterp(segA,segB,Math.min(1,tAfter+extra/Math.max(1,segD)));
      let bestAtMargin=null;
      for(const group of airspaceDetourCandidates(hit.poly)){
        for(const via of group){
          const candidate=[segA,before,...via,after,segB];
          let safe=true; for(let j=0;j<candidate.length-1;j++) if(airspaceSegmentCrosses(hit.cc,candidate[j],candidate[j+1])){ safe=false; break; }
          if(!safe) continue;
          const km=candidate.slice(1).reduce((sum,p,j)=>sum+gcDist(candidate[j],p),0);
          if(!bestAtMargin||km<bestAtMargin.km) bestAtMargin={km,via,before:airspacePoint(before),after:airspacePoint(after)};
        }
        if(bestAtMargin) break;
      }
      if(bestAtMargin&&(!best||bestAtMargin.km<best.km)) best=bestAtMargin;
    }
    if(!best){ failure={country:hit.cc,reason:`Aucun contournement sûr n’a été trouvé autour de ${COUNTRIES[hit.cc]?.[0]||hit.cc}.`}; break; }
    const replacement=[segA,best.before,...best.via,best.after,segB], clean=[];
    for(const p of replacement) if(!clean.length||gcDist(clean[clean.length-1],p)>1) clean.push(p);
    points.splice(hit.i,2,...clean);
  }
  if(!failure){ outer: for(let i=0;i<points.length-1;i++) for(const cc of zones) if(airspaceSegmentCrosses(cc,points[i],points[i+1])){ failure={country:cc,reason:`Aucun contournement sûr n’a été trouvé autour de ${COUNTRIES[cc]?.[0]||cc}.`}; break outer; } }
  const plan={points,distance:points.slice(1).reduce((sum,p,i)=>sum+gcDist(points[i],p),0),violation:failure};
  if(_airspaceRouteCache.size>150000) _airspaceRouteCache.clear(); _airspaceRouteCache.set(key,plan); return plan;
}
function airspaceRouteDistance(code,a,b){ const p=airspaceRoutePlan(code,a,b); return p.distance||dist(a,b); }
function airspacePathCoordinates(code,a,b,refLon){
  const plan=airspaceRoutePlan(code,a,b); if(plan.violation||plan.points.length<2) return [];
  const out=[]; let ref=refLon===undefined?AP(a).lon:refLon;
  for(let i=1;i<plan.points.length;i++){
    const seg=gcPath(plan.points[i-1],plan.points[i],ref);
    for(let j=i===1?0:1;j<seg.length;j++) out.push(seg[j]);
    if(seg.length) ref=seg[seg.length-1][1];
  }
  return out;
}
function airspaceViolation(code,a,b){
  const p=airspaceRoutePlan(code,a,b); return p.violation;
}
function airspacePolicyChanged(){
  if(!S) return; S.airspacePolicyRev=(S.airspacePolicyRev||0)+1; _airspaceRouteCache.clear();
  if(typeof invalidateAirspacePathCache==='function') invalidateAirspacePathCache();
  for(const ac of S.fleet||[]) if(ac.status==='flight'&&ac.flight&&Array.isArray(ac.flight.legs)){
    const carrier=ac.ownerCode||S.company.code, start=Math.max(0,ac.flight.li||0); let model=null,oldProfile=null,current=ac.flight.legs[start];
    if(current) try{ model=modelOf(ac); oldProfile=legProf(current,model); }catch(_){}
    for(let i=start;i<ac.flight.legs.length;i++){
      const leg=ac.flight.legs[i],plan=airspaceRoutePlan(carrier,leg.from,leg.to); if(plan.violation) continue;
      if(i===start&&oldProfile&&model){ const elapsed=clamp(S.time-leg.dep,0,oldProfile.total),progress=oldProfile.total?elapsed/oldProfile.total:0;
        leg.dist=plan.distance; leg.wind=windKmh(leg.from,leg.to); leg.ownerCode=carrier;
        const next=legProf(leg,model); leg.dep=S.time-progress*next.total;
      }else{ leg.dist=plan.distance; leg.wind=windKmh(leg.from,leg.to); leg.ownerCode=carrier; }
    }
  }
  for(const R of S.rivals||[]) for(const r of R.routes||[]){ delete r._tk; delete r._bb; }
  if(typeof invalidateScheduleCache==='function') invalidateScheduleCache();
  if(S.ai) S.ai.ver=(S.ai.ver||0)+1;
  if(typeof _rvIdx!=='undefined'){ _rvIdx=null; _rvSig=''; }
  if(typeof _realOn!=='undefined') _realOn.clear(); if(typeof _ghostRoutes!=='undefined') _ghostRoutes.clear();
  airspacePruneRivals();
  if(typeof drawRoutes==='function') drawRoutes(); if(typeof updateRival==='function') updateRival();
  if(typeof G!=='undefined'&&G.viewer&&typeof drawGlobeRivals==='function') drawGlobeRivals();
}
function airspacePruneRivals(){
  if(typeof S==='undefined'||!S) return 0;
  let removed=0;
  for(const R of S.rivals||[]){ const routes=Array.isArray(R.routes)?R.routes:[], kept=routes.filter(r=>!airspaceViolation(R.code,r.a,r.b)); R.routes=kept; if(kept.length!==routes.length){ removed+=routes.length-kept.length; R._v=(R._v||0)+1; } }
  if(S.ai&&S.ai.extra) for(const [code,routes] of Object.entries(S.ai.extra)){ const old=Array.isArray(routes)?routes:[], kept=old.filter(k=>!airspaceViolation(code,k.slice(0,3),k.slice(3))); if(kept.length!==old.length){ removed+=old.length-kept.length; S.ai.extra[code]=kept; } }
  if(removed){ if(S.ai){ S.ai.ver=(S.ai.ver||0)+1; if(typeof aiOpenRoutes==='function') for(const e of S.ai.list||[]) e.routes=aiOpenRoutes(e); } if(typeof _rvIdx!=='undefined'){ _rvIdx=null; _rvSig=''; } if(typeof _realOn!=='undefined') _realOn.clear(); if(typeof _ghostRoutes!=='undefined') _ghostRoutes.clear(); if(typeof aiNews==='function') aiNews(`⛔ ${removed} liaison(s) de compagnie non autorisée(s) retirée(s) des réseaux enregistrés.`,'warn'); }
  return removed;
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
  const out=base.filter(c=>!_deadSet.has(c)&&!_cutSet.has(c+k)&&(!susp||homeOf(c)===susp)&&!airspaceViolation(c,a,b));
  for(const c of _extraMap.get(k)||[]) if(!out.includes(c)&&!_deadSet.has(c)&&!airspaceViolation(c,a,b)) out.push(c);
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
  const a=AIRLINE_DB[code], pairs=airlinePairs(code).filter(([x,y])=>AP(x)&&AP(y)&&!airspaceViolation(code,x,y));
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
function rivalSig(){ return (S.rivals||[]).map(R=>R.code+R.routes.length+'.'+(R._v||0)).join()+'|p'+airspacePolicyRev(); }
function rivalIndex(){
  const sig=rivalSig(); if(_rvIdx && sig===_rvSig && _rvIdx._S===S) return _rvIdx;
  const m=new Map(); m._S=S;
  for(const R of S.rivals||[]) for(const r of R.routes){ if(airspaceViolation(R.code,r.a,r.b)) continue; const k=pairKey(r.a,r.b); (m.get(k)||m.set(k,[]).get(k)).push({R,freq:r.freq}); }
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
