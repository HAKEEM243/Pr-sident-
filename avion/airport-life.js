/* =========================================================
   Sky Empire — 🛬 aéroport 3D vivant
   Quand on regarde un aéroport en 3D, tout bouge :
   • plus d'avions des autres compagnies aux portes (à leurs couleurs),
     chacun entouré de son camion-citerne, camion-repas, tapis à bagages
     et petit train de chariots ;
   • des passagers qui descendent du bus et montent l'escalier ;
   • des tracteurs à bagages, citernes, bus et camions-repas qui
     circulent sur l'aire (aller-retour, ils tournent au bout) ;
   • des avions qui roulent sur la voie de circulation et s'arrêtent.
   Tout est animé en continu (même jeu en pause), moins sur mobile.
   ========================================================= */
'use strict';
const ALQ=()=>{ const mob=typeof GQ!=='undefined'&&GQ.mob&&!GQ.hq, mini=typeof GQ!=='undefined'&&GQ.mini; return {planes:mini?3:mob?6:12, veh:mini?3:mob?6:12, taxi:mini?0:mob?1:2, pax:mini?0:mob?4:8}; };
const alNow=()=>performance.now()/1000;
// point décalé : fwd mètres devant (cap hdg), right mètres à droite
function alOff(p,hdg,fwd,right){ const a=destPt(p.lat,p.lon,hdg,fwd/1000); return right?destPt(a.lat,a.lon,(hdg+90)%360,right/1000):a; }
function alOri(C,pos,hdg){ return C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(hdg-90),0,0)); }
// position sur une polyligne en aller-retour (renvoie le point et le cap)
function alPing(pts,len,speed,t0){ const L=len, tt=((alNow()+t0)*speed)%(2*L), d=tt<=L?tt:2*L-tt, back=tt>L;
  let acc=0; for(let i=1;i<pts.length;i++){ const sl=gcDist(pts[i-1],pts[i])*1000; if(acc+sl>=d||i===pts.length-1){ const u=sl?Math.min(1,(d-acc)/sl):0, a=pts[i-1], b=pts[i], h=bearing(a,b);
      return {lat:a.lat+(b.lat-a.lat)*u, lon:a.lon+(b.lon-a.lon)*u, hdg:back?(h+180)%360:h}; } acc+=sl; }
  return {lat:pts[0].lat,lon:pts[0].lon,hdg:0}; }

function airportLife(code,N){
  if(typeof AC3D==='undefined'||!G||!G.viewer||G.lite) return;
  const C=Cesium, V=G.viewer, ap=apronOf(code), r=ap&&ap.rw; if(!r) return;
  const A=AP(code), EL=typeof gElev==='function'?gElev(code):0, s=ap.side, gx=ap.x, a0=ap.a, big=A.cls>=3, hdgOut=(r.hdg+90*s+360)%360, Q=ALQ();
  const span=Math.round((big?1900:700)*(1+0.1*Math.min(5,A.xp||0)));
  const add=(e)=>{ N.ents.push(e); return e; };
  const stat=(p,hdg,url,h)=>{ const pos=C.Cartesian3.fromDegrees(p.lon,p.lat,(h||0.25)+EL); return add(apLit(V.entities.add({position:pos, orientation:alOri(C,pos,hdg), model:{uri:url, shadows:C.ShadowMode.CAST_ONLY, distanceDisplayCondition:new C.DistanceDisplayCondition(0,6000)}}))); };
  const mov=(fn,url,h,maxD)=>{ const posCB=new C.CallbackProperty(()=>{ const q=fn(); return C.Cartesian3.fromDegrees(q.lon,q.lat,(h||0.25)+EL); },false);
    const oriCB=new C.CallbackProperty(()=>{ const q=fn(); const pos=C.Cartesian3.fromDegrees(q.lon,q.lat,(h||0.25)+EL); return alOri(C,pos,q.hdg); },false);
    return add(apLit(V.entities.add({position:posCB, orientation:oriCB, model:{uri:url, shadows:C.ShadowMode.CAST_ONLY, distanceDisplayCondition:new C.DistanceDisplayCondition(0,maxD||6000)}}))); };
  // ---------- 1. avions des autres compagnies aux portes, avec leurs véhicules ----------
  const gates=(typeof apGates==='function'?apGates(code):null)||[]; if(!gates.length) return;
  const mine=new Set(); for(const ac of S.fleet||[]){ if(ac.loc===code||(ac.flight&&ac.flight.legs.some(l=>l.from===code||l.to===code))) try{ mine.add(gateIdx(code,ac,!!ac.gIntl)); }catch(e){} }
  const al=(typeof airlinesAt==='function'?airlinesAt(code):[]).map(([c])=>c).slice(0,12); if(!al.length) return;
  const want=Math.min(Q.planes,Math.max(3,Math.round(Math.sqrt(A.traffic||1)*3)));
  const free=gates.map((g,i)=>i).filter(i=>i>=6&&!mine.has(i)); const used=[];
  for(let k=0;k<want&&free.length;k++){ const i=free.splice(Math.floor((k*7919)%free.length),1)[0]; used.push(i); }
  const parked=[];
  used.forEach((gi,k)=>{ const g=gates[gi], c=al[(k+6)%al.length], m=getModel(k%4===0&&big?'B789':k%3===0?'B738':k%5===0&&big?'A359':'A20N')||getModel('A20N');
    const mi=AC3D.uri(m,typeof airlineColor==='function'?airlineColor(c):'#64748b'); stat(g,g.hdg,mi.uri,mi.R+mi.gH+0.4); parked.push({g,mi,m,k});
    // véhicules de service autour de l'avion (côté droit = côté service)
    const L=mi.L||38, half=(mi.span||34)/2, h=g.hdg;
    stat(alOff(g,h,-L*0.02,half*0.55),(h+90)%360,apModel('fuel',M_FUEL));
    if((m.seats||0)>=70){ stat(alOff(g,h,L*0.36,mi.R+3.2),h,apModel('cater',M_CATER)); stat(alOff(g,h,-L*0.12,mi.R+1.6),(h+35)%360,apModel('belt',M_BELT));
      for(let j=0;j<3;j++) stat(alOff(g,h,-L*0.12-6-j*3.4,mi.R+5),h,apModel('cart',M_CART)); }
    if(k%2===0) stat(alOff(g,h,L*0.5+5,0),h,apModel('tug',M_TUG));
  });
  // ---------- 2. passagers : bus → escalier → avion (en boucle) ----------
  if(Q.pax&&typeof M_STAIRS==='function'&&typeof M_PAX==='function'){
    for(const P of parked.filter(x=>(x.m.seats||0)>=70).slice(0,2)){ const {g,mi}=P, L=mi.L||38, h=g.hdg, dz=-L*0.33, foot=alOff(g,h,dz,-(mi.R+6.5)), bus=alOff(g,h,dz-6,-(mi.R+17));   // porte arrière gauche (la passerelle prend l'avant)
      stat(alOff(g,h,dz,-(mi.R+2.6)),(h+270)%360,apModel('stairs'+Math.round(mi.R*2),M_STAIRS(Math.max(2.5,mi.R*1.3+mi.gH))));
      if(typeof M_BUS==='function') stat(bus,h,apModel('apbus',M_BUS));
      const path=[bus,foot], len=gcDist(bus,foot)*1000;
      for(let j=0;j<Q.pax;j++){ const sh=SHIRTS[(j*3+P.k)%SHIRTS.length], sk=SKINS[(j+P.k)%SKINS.length], off=j*(len/Q.pax)/1.3;
        mov(()=>{ const t=((alNow()*1.3+off)%len); const u=t/len; return {lat:bus.lat+(foot.lat-bus.lat)*u, lon:bus.lon+(foot.lon-bus.lon)*u, hdg:bearing(bus,foot)}; },apModel('pax'+sh+sk,M_PAX(sh,sk)),0.2,1500); } } }
  // ---------- 3. véhicules qui circulent sur l'aire (derrière les queues des avions) ----------
  // route de service le long de l'aire, côté piste (les véhicules ne passent plus sous les ailes ni dans les queues)
  const RX=gx-s*77, road=[rwPt(r,a0-span/2-40,RX),rwPt(r,a0+span/2+40,RX)], rlen=gcDist(road[0],road[1])*1000;
  try{ const q=[rwPt(r,a0-span/2-60,RX-7),rwPt(r,a0+span/2+60,RX-7),rwPt(r,a0+span/2+60,RX+7),rwPt(r,a0-span/2-60,RX+7)];
    add(V.entities.add({polygon:{hierarchy:C.Cartesian3.fromDegreesArray(q.flatMap(v=>[v.lon,v.lat])), height:EL+0.16, material:C.Color.fromCssColorString('#5b5f66')}}));
    add(V.entities.add({polyline:{positions:C.Cartesian3.fromDegreesArrayHeights([road[0].lon,road[0].lat,EL+0.3,road[1].lon,road[1].lat,EL+0.3]), width:1.5, material:new C.PolylineDashMaterialProperty({color:C.Color.WHITE,dashLength:24})}})); }catch(e){}
  const kinds=[['tug',M_TUG,7],['fuel',M_FUEL,6],['cater',M_CATER,6],['apbus',typeof M_BUS==='function'?M_BUS:M_CATER,7]];
  for(let i=0;i<Q.veh;i++){ const [kk,fn,sp]=kinds[i%kinds.length], t0=i*rlen/Q.veh/sp*1.7, lane=(i%2?1:-1)*3;
    const pts=road.map(p=>alOff(p,(r.hdg+90)%360,0,0)); const shift=p=>destPt(p.lat,p.lon,(hdgOut+(lane>0?0:180))%360,Math.abs(lane)/1000);
    const lp=[shift(pts[0]),shift(pts[1])];
    mov(()=>alPing(lp,rlen,sp,t0),apModel(kk,fn),0.25);
    if(kk==='tug') for(let j=1;j<=3;j++) mov(()=>{ const q=alPing(lp,rlen,sp,t0), b=destPt(q.lat,q.lon,(q.hdg+180)%360,(3.6*j)/1000); return {lat:b.lat,lon:b.lon,hdg:q.hdg}; },apModel('cart',M_CART),0.25); }
  // ---------- 4. avions qui roulent sur la voie de circulation ----------
  const tw=[rwPt(r,a0-span/2-30,gx-s*55),rwPt(r,a0+span/2+30,gx-s*55)], tlen=gcDist(tw[0],tw[1])*1000;
  for(let i=0;i<Q.taxi;i++){ const c=al[(i+3)%al.length], m=getModel(i%2?'A20N':'B738')||getModel('A20N'), mi=AC3D.uri(m,typeof airlineColor==='function'?airlineColor(c):'#64748b');
    // il roule, s'arrête un moment (autorisation), puis repart
    const run=tlen/8, cyc=2*run+40;
    mov(()=>{ const T=(alNow()+i*run*0.9)%cyc; let d, back=false;
      if(T<run) d=T*8; else if(T<run+20) d=tlen; else if(T<2*run+20){ d=tlen-(T-run-20)*8; back=true; } else { d=0; back=true; }
      const u=Math.max(0,Math.min(1,d/tlen)), h=bearing(tw[0],tw[1]); return {lat:tw[0].lat+(tw[1].lat-tw[0].lat)*u, lon:tw[0].lon+(tw[1].lon-tw[0].lon)*u, hdg:back?(h+180)%360:h}; },mi.uri,mi.R+mi.gH+0.4,15000); }
}
function alHook(){ if(alHook.done||typeof airportProps!=='function') return; alHook.done=true;
  const _ap=airportProps; airportProps=function(code,N){ _ap(code,N); try{ airportLife(code,N); }catch(e){ console.warn('airportLife',e); } }; }
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ alHook(); }catch(e){ console.warn(e); } },0));
