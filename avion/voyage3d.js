/* =========================================================
   Sky Empire — 🎬 Voyage en 3D : suivez un camion ou un train
   sur toute sa route, de la ville de départ à la ville d'arrivée.
   Le décor est construit au fil du voyage, le même style pour toutes
   les routes : route goudronnée ou voie ferrée, palmiers, manguiers,
   villages (maisons à toit de tôle, église, marché, terrain de foot,
   champs), parcs, petites villes aux arrêts, et la circulation.
   Près de Kinshasa, la vraie ville 3D apparaît en plus.
   ========================================================= */
'use strict';
const VY={on:false, mode:null, line:null, P:null, cum:null, len:0, d:0, dir:1, sp:10, chunks:new Map(), veh:[], traffic:[], last:0, cam:'chase', hud:null, stops:[]};
const VY_CH=1000;   // décor construit par tronçons de 1 km
const vyRnd=seed=>{ let s=(seed>>>0)||1; return ()=>{ s^=s<<13; s^=s>>>17; s^=s<<5; return (s>>>0)/4294967296; }; };
const vyHash=(a,b)=>{ let h=(a*374761393+b*668265263)|0; h=Math.imul(h^(h>>>13),1274126177); return (h^(h>>>16))>>>0; };

/* ---------- le tracé : la vraie route entre les villes, avec des courbes ---------- */
function vyBuildPath(mode,line){
  const p=trPath(mode,line.a,line.b); if(!p) return null;
  const nodes=p.pts, out=[], seed=vyHash(line.a.length*97+line.b.charCodeAt(0),line.b.length*31+line.a.charCodeAt(0));
  const amp=mode==='train'?180:420;
  for(let k=1;k<nodes.length;k++){ const A=nodes[k-1], B=nodes[k], D=trGc(A,B)*1000, n=Math.max(2,Math.ceil(D/200)), cl=Math.cos(A.lat*Math.PI/180);
    const ux=(B.lon-A.lon)*cl, uy=B.lat-A.lat, ul=Math.hypot(ux,uy)||1, px=-uy/ul, py=ux/ul;
    for(let i=(k===1?0:1);i<=n;i++){ const f=i/n, s=f*D, taper=Math.min(1,s/3000,(D-s)/3000);
      const o=taper*(amp*Math.sin(s/7300+seed%7)+amp*0.3*Math.sin(s/2100+seed%13));   // virages doux
      out.push({lat:A.lat+(B.lat-A.lat)*f+py*o/111320, lon:A.lon+(B.lon-A.lon)*f+px*o/(111320*cl)}); } }
  const cum=[0]; for(let i=1;i<out.length;i++) cum.push(cum[i-1]+trGc(out[i-1],out[i])*1000);
  // arrêts : villes de départ, d'arrivée et gares intermédiaires
  const stops=nodes.map(n=>{ let bi=0,bd=1e9; out.forEach((q,i)=>{ const dd=Math.abs(q.lat-n.lat)+Math.abs(q.lon-n.lon); if(dd<bd){ bd=dd; bi=i; } }); return {name:n.name, d:cum[bi], pop:n.popK||50}; });
  return {P:out,cum,len:cum[cum.length-1],stops};
}
function vyAt(d){ const P=VY.P, cum=VY.cum; let lo=0, hi=cum.length-1; d=clamp(d,0,VY.len); while(hi-lo>1){ const m=(lo+hi)>>1; if(cum[m]<=d) lo=m; else hi=m; }
  const a=P[lo], b=P[hi], f=(d-cum[lo])/Math.max(0.01,cum[hi]-cum[lo]); return {lat:a.lat+(b.lat-a.lat)*f, lon:a.lon+(b.lon-a.lon)*f, hd:bearing(a,b), i:lo}; }
const vyOff=(p,hd,m)=>{ const r=toRad(hd+90); return {lat:p.lat+Math.cos(r)*m/111320, lon:p.lon+Math.sin(r)*m/(111320*Math.cos(toRad(p.lat)))}; };
const vyFwd=(p,hd,m)=>{ const r=toRad(hd); return {lat:p.lat+Math.cos(r)*m/111320, lon:p.lon+Math.sin(r)*m/(111320*Math.cos(toRad(p.lat)))}; };

/* ---------- décor d'un tronçon ---------- */
const VY_COL={trunk:'#6b4f2e',palm:'#3f6b2a',mango:'#2f5d27',bush:'#4d7c2f',acacia:'#5f7f35',
  walls:['#e7d8bd','#d9c3a0','#f1e6d0','#c9a27e','#e9c9a6','#d8d2c4','#f5efe2','#b9c7d8','#e3b78f'],roofs:['#8c8f93','#7b2f22','#9a9da1','#a4552e','#6e7276','#3f5f7f'],stall:['#dc2626','#2563eb','#16a34a','#f59e0b','#7c3aed']};
function vyChunkBuild(ci){
  const C=Cesium, V=G.viewer, rnd=vyRnd(vyHash(ci+1,VY.seed)), d0=ci*VY_CH, d1=Math.min(VY.len,d0+VY_CH); if(d0>=VY.len) return null;
  const pts=[]; for(let d=d0; d<=d1+1; d+=100) pts.push(vyAt(Math.min(d,d1)));
  let s=90,w=180,n=-90,e=-180; for(const p of pts){ s=Math.min(s,p.lat); n=Math.max(n,p.lat); w=Math.min(w,p.lon); e=Math.max(e,p.lon); } s-=0.004; n+=0.004; w-=0.004; e+=0.004;
  const st={ci, prims:[], gb:null, ready:false};
  // la route ou la voie ferrée (posées sur le relief)
  const P3=C.Cartesian3.fromDegreesArray(pts.flatMap(p=>[p.lon,p.lat]));
  const gpl=(insts)=>{ const pr=V.scene.primitives.add(new C.GroundPolylinePrimitive({geometryInstances:insts, appearance:new C.PolylineColorAppearance(), asynchronous:true})); st.prims.push(pr); };
  const col=c=>C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString(c));
  if(VY.mode==='train'){ gpl([new C.GeometryInstance({geometry:new C.GroundPolylineGeometry({positions:P3,width:6}),attributes:{color:col('#7c6f64')}})]);
    const r1=pts.map(p=>vyOff(p,p.hd,0.75)), r2=pts.map(p=>vyOff(p,p.hd,-0.75));
    gpl([r1,r2].map(r=>new C.GeometryInstance({geometry:new C.GroundPolylineGeometry({positions:C.Cartesian3.fromDegreesArray(r.flatMap(p=>[p.lon,p.lat])),width:0.25}),attributes:{color:col('#1f2933')}}))); }
  else { gpl([new C.GeometryInstance({geometry:new C.GroundPolylineGeometry({positions:P3,width:13}),attributes:{color:col('#c9b48a')}}),   // accotements en latérite
             new C.GeometryInstance({geometry:new C.GroundPolylineGeometry({positions:P3,width:9}),attributes:{color:col('#3a3e44')}})]);
    try{ const pr=V.scene.primitives.add(new C.GroundPolylinePrimitive({geometryInstances:new C.GeometryInstance({geometry:new C.GroundPolylineGeometry({positions:P3,width:0.35})}),appearance:new C.PolylineMaterialAppearance({material:C.Material.fromType('PolylineDash',{color:C.Color.fromCssColorString('#f8fafc'),dashLength:24})}),asynchronous:true})); st.prims.push(pr); }catch(err){} }
  // le décor 3D, posé à la hauteur du sol
  const nearStop=VY.stops.find(x=>Math.abs(x.d-(d0+d1)/2)<2500), town=!!nearStop, big=nearStop&&nearStop.pop>=500;
  const village=!town&&(vyHash(ci,VY.seed)%5===0), side=rnd()<0.5?1:-1;
  (typeof cellGround==='function'?cellGround(s,w,n,e,0):Promise.resolve(()=>0)).then(gb=>{ if(!VY.on||!VY.chunks.has(ci)) return; st.gb=gb;
    const inst=[], VF=C.PerInstanceColorAppearance.VERTEX_FORMAT;
    const at=(p,h)=>C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(p.lon,p.lat,gb(p)+h));
    const rotZ=(m,deg)=>C.Matrix4.multiplyByMatrix3(m,C.Matrix3.fromRotationZ(C.Math.toRadians(deg)),new C.Matrix4());
    const add=(geo,m,c)=>inst.push(new C.GeometryInstance({geometry:geo,modelMatrix:m,attributes:{color:col(c)}}));
    const tree=(p,kind,sc)=>{ sc=sc||1; if(kind==='palm'){ const h=(7+rnd()*5)*sc; add(new C.CylinderGeometry({length:h,topRadius:0.18,bottomRadius:0.3,slices:6,vertexFormat:VF}),at(p,h/2),VY_COL.trunk); add(new C.EllipsoidGeometry({radii:new C.Cartesian3(3.2*sc,3.2*sc,1.1*sc),stackPartitions:4,slicePartitions:8,vertexFormat:VF}),at(p,h),VY_COL.palm); }
      else if(kind==='bush'){ add(new C.EllipsoidGeometry({radii:new C.Cartesian3(1.6*sc,1.6*sc,1.2*sc),stackPartitions:4,slicePartitions:6,vertexFormat:VF}),at(p,0.8*sc),VY_COL.bush); }
      else { const h=(2.5+rnd()*2)*sc, r=(3+rnd()*2.5)*sc; add(new C.CylinderGeometry({length:h,topRadius:0.3,bottomRadius:0.45,slices:6,vertexFormat:VF}),at(p,h/2),VY_COL.trunk); add(new C.EllipsoidGeometry({radii:new C.Cartesian3(r,r,r*0.75),stackPartitions:5,slicePartitions:8,vertexFormat:VF}),at(p,h+r*0.55),kind==='acacia'?VY_COL.acacia:VY_COL.mango); } };
    const house=(p,hd,lv)=>{ const wd=6+rnd()*5, ln=7+rnd()*6, h=3*(lv||1)+0.2, m=rotZ(at(p,h/2),-hd); add(C.BoxGeometry.fromDimensions({dimensions:new C.Cartesian3(wd,ln,h),vertexFormat:VF}),m,pick(VY_COL.walls));
      const rh=1.4+rnd()*0.8; add(new C.CylinderGeometry({length:rh,topRadius:0,bottomRadius:Math.hypot(wd,ln)/2*1.05,slices:4,vertexFormat:VF}),rotZ(at(p,h+rh/2),-hd+45),pick(VY_COL.roofs)); };
    const box=(p,hd,wd,ln,h,c,z)=>add(C.BoxGeometry.fromDimensions({dimensions:new C.Cartesian3(wd,ln,h),vertexFormat:VF}),rotZ(at(p,(z||0)+h/2),-hd),c);
    // arbres le long de la route
    const nT=GQ.mini?22:GQ.mob?34:60;
    for(let k=0;k<nT;k++){ const dd=d0+rnd()*(d1-d0), q=vyAt(dd), off=(14+Math.pow(rnd(),1.6)*170)*(rnd()<0.5?1:-1); const r=rnd(); tree(vyOff(q,q.hd,off), r<0.35?'palm':r<0.6?'mango':r<0.8?'acacia':'bush', 0.8+rnd()*0.5); }
    // poteaux électriques et petits kiosques au bord de la route
    for(let dd=d0+((ci*37)%50); dd<d1; dd+=(GQ.mob?110:70)){ const q=vyAt(dd), pp=vyOff(q,q.hd,VY.mode==='train'?-7:-9); add(new C.CylinderGeometry({length:9,topRadius:0.1,bottomRadius:0.14,slices:5,vertexFormat:VF}),at(pp,4.5),'#5b4636'); box(pp,q.hd,1.6,0.15,0.15,'#5b4636',8.4); }
    for(let k=0;k<(GQ.mob?1:3);k++){ if(rnd()<0.5) continue; const q=vyAt(d0+rnd()*(d1-d0)), kp=vyOff(q,q.hd,(rnd()<0.5?1:-1)*(12+rnd()*4)); box(kp,q.hd,2.6,2.6,2.3,pick(VY_COL.walls)); box(kp,q.hd,3.4,3.4,0.15,pick(VY_COL.stall),2.3); }
    // village : maisons, église, marché, terrain de foot, champs
    if(village||town){ const mid=vyAt((d0+d1)/2), nH=town?(big?(GQ.mob?50:90):(GQ.mob?28:50)):(GQ.mob?10:18), sd=town?0:side;
      for(let k=0;k<nH;k++){ const along=(rnd()-0.5)*(town?900:380), off=(sd||(rnd()<0.5?1:-1))*(20+rnd()*(town?320:150)); const q=vyAt((d0+d1)/2+along); house(vyOff(q,q.hd,off), q.hd+(rnd()<0.5?0:90)+rnd()*8-4, town&&big&&rnd()<0.3?2+Math.floor(rnd()*3):(rnd()<0.12?2:1)); }
      const cq=vyOff(mid,mid.hd,(sd||1)*70); box(cq,mid.hd,9,18,7,'#f5f5f4'); add(new C.CylinderGeometry({length:4,topRadius:0,bottomRadius:6.5,slices:4,vertexFormat:VF}),rotZ(at(cq,9),-mid.hd+45),'#7b2f22'); box(vyFwd(cq,mid.hd,10),mid.hd,3.2,3.2,13,'#f5f5f4'); box(vyFwd(cq,mid.hd,10),mid.hd,0.4,2.2,0.4,'#1f2933',13.4);   // église et clocher
      for(let k=0;k<(town?14:7);k++){ const q=vyAt((d0+d1)/2-60+k*9); const sp=vyOff(q,q.hd,(sd||-1)*-11); box(sp,q.hd,2.4,1.2,0.9,'#7c5a3a'); for(const dx of [-1.1,1.1]) box(vyFwd(sp,q.hd,dx),q.hd,0.12,0.12,2.2,'#4b3a2a'); box(sp,q.hd,3.2,2.6,0.12,pick(VY_COL.stall),2.2); box(vyOff(sp,q.hd,0.2),q.hd,1.8,0.8,0.35,pick(['#f59e0b','#16a34a','#dc2626','#facc15']),0.9); }   // étal : table, poteaux, bâche colorée, marchandises   // étals du marché au bord de la route
      const fq=vyOff(vyAt((d0+d1)/2+160),mid.hd,(sd||1)*95); try{ const pr=V.scene.primitives.add(new C.GroundPrimitive({geometryInstances:[new C.GeometryInstance({geometry:new C.EllipseGeometry({center:C.Cartesian3.fromDegrees(fq.lon,fq.lat),semiMajorAxis:48,semiMinorAxis:30,rotation:C.Math.toRadians(90-mid.hd)}),attributes:{color:col('#4d8b31')}})],asynchronous:true})); st.prims.push(pr); }catch(err){}   // terrain de foot
      box(vyFwd(fq,mid.hd,-28),mid.hd,7,0.3,2.4,'#f8fafc'); box(vyFwd(fq,mid.hd,28),mid.hd,7,0.3,2.4,'#f8fafc');   // buts
      for(let k=0;k<3;k++){ const q=vyAt(d0+rnd()*(d1-d0)); const c=vyOff(q,q.hd,-(sd||1)*(120+rnd()*150)); try{ const pr=V.scene.primitives.add(new C.GroundPrimitive({geometryInstances:[new C.GeometryInstance({geometry:new C.EllipseGeometry({center:C.Cartesian3.fromDegrees(c.lon,c.lat),semiMajorAxis:60+rnd()*50,semiMinorAxis:35+rnd()*25,rotation:rnd()*3}),attributes:{color:col(pick(['#7a8b3a','#94a23f','#8a6b3e','#5f8a3a']))}})],asynchronous:true})); st.prims.push(pr); }catch(err){} } }   // champs
    if(town){ for(let k=0;k<(GQ.mob?6:12);k++){ const q=vyAt((d0+d1)/2+(rnd()-0.5)*700); tree(vyOff(q,q.hd,(rnd()<0.5?1:-1)*(16+rnd()*8)),'palm',1.1); } }   // avenue de palmiers en ville
    if(inst.length){ try{ const pr=V.scene.primitives.add(new C.Primitive({geometryInstances:inst, appearance:new C.PerInstanceColorAppearance({translucent:false,closed:true}), asynchronous:true, shadows:C.ShadowMode.DISABLED})); st.prims.push(pr); }catch(err){ console.warn('voyage',err); } }
    st.ready=true; }).catch(e=>console.warn(e));
  return st;
}
function vyChunkDrop(st){ for(const p of st.prims) try{ G.viewer.scene.primitives.remove(p); }catch(e){} }

/* ---------- véhicules ---------- */
const M_LOCO=()=>{ const y=C3('#f59e0b'), r=C3('#b91c1c'), g=C3('#1f2a3a'), d=C3('#374151'), w=C3('#0b0f17');
  return [[-1.5,1.5,0.9,4.2,-8,8,y],[-1.52,1.52,1.6,2.4,-8,8,r],[-1.3,1.3,3.0,3.9,5.5,7.8,g],[-1.2,1.2,4.2,4.5,-6,6,d],[-1.4,1.4,0,0.9,-7.5,7.5,w]]; };
const M_WAGON=c=>()=>{ const b=C3(c), d=C3('#3f3f46'), w=C3('#0b0f17'); return [[-1.45,1.45,0.9,3.9,-7,7,b],[-1.5,1.5,3.9,4.1,-7,7,d],[-1.3,1.3,0,0.9,-6.5,6.5,w]]; };
const M_TANK=()=>{ const s=C3('#d4d4d8'), d=C3('#3f3f46'), w=C3('#0b0f17'); return [[-1.3,1.3,1.0,3.6,-6.5,6.5,s],[-0.4,0.4,3.6,4.0,-0.4,0.4,d],[-1.3,1.3,0,1.0,-6,6,w]]; };
function vySpawnVehicles(){
  const C=Cesium, V=G.viewer, col=S.company.color||'#2563eb'; VY.veh=[];
  if(VY.mode==='train'){ const parts=[apModel('loco',M_LOCO)]; for(let k=0;k<(GQ.mob?5:8);k++) parts.push(k%3===2?apModel('tank',M_TANK):apModel('wag-'+(k%2?'#7c2d12':col),M_WAGON(k%2?'#7c2d12':col)));
    parts.forEach((u,k)=>VY.veh.push({e:V.entities.add({position:C.Cartesian3.ZERO, model:{uri:u, scale:1, minimumPixelSize:12}}), back:k*15.5})); }
  else { const semi=(trVeh('truck',(VY.vk||'semi'))||{cap:30}).cap>=20; VY.veh.push({e:V.entities.add({position:C.Cartesian3.ZERO, model:{uri:apModel('truckco-'+col+(semi?'-s':''),typeof M_TRUCK_CO==='function'?M_TRUCK_CO(col,semi):M_TRUCK), scale:1, minimumPixelSize:12}}), back:0}); }
  // circulation en face (camions et voitures de la région)
  VY.traffic=[]; if(VY.mode!=='train'&&typeof RD!=='undefined'&&RD.models!==undefined){ const models=[apModel('truck',M_TRUCK),apModel('bus2',M_BUS),apModel('car2'+0,M_CAR(RD_COLORS[0])),apModel('car2'+3,M_CAR(RD_COLORS[3]))];
    for(let k=0;k<(GQ.mob?4:8);k++) VY.traffic.push({e:V.entities.add({position:C.Cartesian3.ZERO, model:{uri:models[k%models.length], scale:1.2, minimumPixelSize:8}}), d:VY.d+300+k*450, v:18+Math.random()*8}); }
}
function vyGround(p){ for(const st of VY.chunks.values()) if(st.gb){ const m=st.ci*VY_CH; return st.gb(p); } return typeof groundAt==='function'?groundAt(p.lat,p.lon):0; }
function vyGroundAt(d,p){ const st=VY.chunks.get(Math.floor(d/VY_CH)); return st&&st.gb?st.gb(p):(typeof terrElevSync==='function'&&terrElevSync(p.lat,p.lon))||vyGround(p); }

/* ---------- boucle ---------- */
function vyFrame(){
  if(!VY.on||!G||!G.viewer) return;
  const now=performance.now(), dt=Math.min(0.2,(now-(VY.last||now))/1000); VY.last=now; const C=Cesium;
  const base=VY.mode==='train'?16:20; VY.d+=base*VY.sp*dt; if(VY.d>=VY.len){ VY.d=VY.len; vyArrive(); return; }
  // tronçons : 1 derrière, 4 devant
  const ci=Math.floor(VY.d/VY_CH); for(let k=ci-1;k<=ci+4;k++) if(k>=0&&!VY.chunks.has(k)){ const st=vyChunkBuild(k); if(st) VY.chunks.set(k,st); break; }
  for(const [k,st] of VY.chunks) if(k<ci-1||k>ci+6){ vyChunkDrop(st); VY.chunks.delete(k); }
  let lead=null;
  for(const v of VY.veh){ const dd=Math.max(0,VY.d-v.back), q=vyAt(dd), side=VY.mode==='train'?0:2.4, p=vyOff(q,q.hd,side), h=vyGroundAt(dd,p);
    const pos=C.Cartesian3.fromDegrees(p.lon,p.lat,h+0.3); v.e.position=pos; v.e.orientation=C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(q.hd-90),0,0)); if(!lead) lead={pos,hd:q.hd}; }
  for(const t of VY.traffic){ t.d-=t.v*dt*Math.max(1,VY.sp*0.3); if(t.d<VY.d-400) t.d=VY.d+1500+Math.random()*1500; const q=vyAt(t.d), p=vyOff(q,q.hd,-2.4), h=vyGroundAt(t.d,p); const pos=C.Cartesian3.fromDegrees(p.lon,p.lat,h+0.3);
    t.e.position=pos; t.e.orientation=C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(q.hd+90),0,0)); }
  if(lead){ const cam={chase:[0,-12,VY.mode==='train'?70:40],side:[80,-8,55],drone:[20,-38,260],front:[180,-6,45]}[VY.cam]||[0,-12,40];
    try{ G.viewer.camera.lookAt(lead.pos,new C.HeadingPitchRange(C.Math.toRadians(lead.hd+cam[0]),C.Math.toRadians(cam[1]),cam[2])); }catch(e){} }
  if(now-(VY.hudT||0)>500){ VY.hudT=now; vyHud(); }
}
function vyHud(){
  let el=document.getElementById('vyHud'); if(!el){ el=document.createElement('div'); el.id='vyHud'; document.body.appendChild(el); }
  const A=VY.stops[0], B=VY.stops[VY.stops.length-1], next=VY.stops.find(x=>x.d>VY.d+50), km=Math.round(VY.d/1000), tot=Math.round(VY.len/1000);
  el.innerHTML=`<div><b>${VY.mode==='train'?'🚆':'🚚'} ${esc(A.name)} → ${esc(B.name)}</b> <br>${km}/${tot} km${next&&next!==VY.stops[VY.stops.length-1]?` · arrêt ${esc(next.name)} dans ${Math.max(0,Math.round((next.d-VY.d)/1000))} km`:''}</div>
    <div class="vybtns">${[1,10,50].map(x=>`<button class="chip ${VY.sp===x?'on':''}" data-act="vySp" data-k="${x}">×${x}</button>`).join('')}<button class="chip" data-act="vyCam">🎥 ${({chase:'Derrière',side:'Côté',drone:'Drone',front:'Devant'})[VY.cam]}</button><button class="chip" data-act="vyStop">✖</button></div>`;
}
function vyArrive(){ const B=VY.stops[VY.stops.length-1]; toast(`🏁 Arrivée à ${esc(B.name)} ! Le chargement est livré.`,'ok'); vyStop(); }
function vyStop(){ VY.on=false; for(const st of VY.chunks.values()) vyChunkDrop(st); VY.chunks.clear();
  if(G&&G.viewer){ for(const v of VY.veh.concat(VY.traffic)) try{ G.viewer.entities.remove(v.e); }catch(e){} try{ G.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); }catch(e){} }
  VY.veh=[]; VY.traffic=[]; const el=document.getElementById('vyHud'); if(el) el.remove(); document.body.classList.remove('voyage'); }
async function vyStart(mode,lineId,vk){
  const X=S.tr&&S.tr[mode], line=X&&X.lines.find(l=>l.id===lineId); if(!line) return err('Ligne introuvable');
  if(typeof ACTIONS!=='undefined'&&$('#globe').hidden){ ACTIONS.open3D(); }
  const wait=t=>new Promise(r=>setTimeout(r,t)); for(let i=0;i<40&&(!G||!G.viewer);i++) await wait(150); if(!G||!G.viewer) return err('La 3D ne s’est pas ouverte.');
  if(VY.on) vyStop(); if(G.follow&&typeof globeFollow==='function') globeFollow(null); if(typeof tkUnfollow==='function') tkUnfollow();
  const path=vyBuildPath(mode,line); if(!path) return err('Route introuvable');
  Object.assign(VY,{on:true,mode,line,P:path.P,cum:path.cum,len:path.len,stops:path.stops,d:0,sp:VY.sp||10,cam:'chase',seed:vyHash(line.id.length,lineId.charCodeAt(1)||7),last:0,vk});
  closeModal(); document.body.classList.add('voyage'); vySpawnVehicles();
  if(!VY.hooked||VY.hooked!==G.viewer){ G.viewer.scene.preRender.addEventListener(vyFrame); VY.hooked=G.viewer; }
  toast(`🎬 Voyage ${mode==='train'?'en train':'en camion'} : ${esc(path.stops[0].name)} → ${esc(path.stops[path.stops.length-1].name)}`,'info');
}
function registerVoyageActions(){
  Object.assign(ACTIONS,{
    vyGo:d=>vyStart(d.m,d.id,d.k),
    vySp:d=>{ VY.sp=+d.k; vyHud(); },
    vyCam:()=>{ const L=['chase','side','drone','front']; VY.cam=L[(L.indexOf(VY.cam)+1)%L.length]; vyHud(); },
    vyStop:()=>vyStop(),
  });
}
// en quittant la 3D, le voyage s'arrête
{ const _c3=close3D; close3D=function(){ if(VY.on) vyStop(); return _c3.apply(this,arguments); }; }
