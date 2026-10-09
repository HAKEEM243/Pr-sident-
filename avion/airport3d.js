/* =========================================================
   Sky Empire — vie de l'aéroport en 3D
   Tour de contrôle, terminal vitré, passerelles, avions garés,
   véhicules de piste autour de l'avion suivi (tracteur, bagages,
   carburant, catering) et repoussage au départ.
   ========================================================= */
'use strict';
const AP3D={models:new Map(), veh:null};
// GLB à partir d'une liste de boîtes [x0,x1,y0,y1,z0,z1,[r,g,b],(metal)] — X droite, Y haut, Z avant (mètres)
function glbBoxes(boxes){
  const pos=[], nor=[], col=[], idx=[];
  const face=(a,b,c,d,n,k)=>{ const s=pos.length/3; for(const v of [a,b,c,d]){ pos.push(...v); nor.push(...n); col.push(...k); } idx.push(s,s+1,s+2,s,s+2,s+3); };
  for(const [x0,x1,y0,y1,z0,z1,k] of boxes){
    face([x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[0,1,0],k);
    face([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],k);
    face([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],k);
    face([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],k);
    face([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],k);
  }
  const P=new Float32Array(pos), N=new Float32Array(nor), Cc=new Uint8Array(col.map(v=>Math.round(Math.max(0,Math.min(1,v))*255))), I=new Uint32Array(idx);
  const mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9]; for(let i=0;i<P.length;i++){ mn[i%3]=Math.min(mn[i%3],P[i]); mx[i%3]=Math.max(mx[i%3],P[i]); }
  const chunks=[], views=[]; let off=0;
  for(const [a,t] of [[P,34962],[N,34962],[Cc,34962],[I,34963]]){ const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength), pad=(4-b.length%4)%4; views.push({buffer:0,byteOffset:off,byteLength:b.length,target:t}); chunks.push(b); if(pad) chunks.push(new Uint8Array(pad)); off+=b.length+pad; }
  const gltf={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,COLOR_0:2},indices:3,material:0}]}],
    materials:[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0.15,roughnessFactor:0.55},doubleSided:true}],
    accessors:[{bufferView:0,componentType:5126,count:P.length/3,type:'VEC3',min:mn,max:mx},{bufferView:1,componentType:5126,count:N.length/3,type:'VEC3'},{bufferView:2,componentType:5121,normalized:true,count:Cc.length/3,type:'VEC3'},{bufferView:3,componentType:5125,count:I.length,type:'SCALAR'}],
    bufferViews:views,buffers:[{byteLength:off}]};
  let js=new TextEncoder().encode(JSON.stringify(gltf)); const jp=(4-js.length%4)%4; if(jp){ const t=new Uint8Array(js.length+jp); t.set(js); t.fill(32,js.length); js=t; }
  const total=28+js.length+off, glb=new Uint8Array(total), dv=new DataView(glb.buffer);
  dv.setUint32(0,0x46546C67,true); dv.setUint32(4,2,true); dv.setUint32(8,total,true); dv.setUint32(12,js.length,true); dv.setUint32(16,0x4E4F534A,true); glb.set(js,20);
  let o=20+js.length; dv.setUint32(o,off,true); dv.setUint32(o+4,0x004E4942,true); o+=8; for(const c of chunks){ glb.set(c,o); o+=c.length; }
  return URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}));
}
const C3=(h)=>{ const n=parseInt(h.slice(1),16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; };
function apModel(key,fn){ let u=AP3D.models.get(key); if(!u){ u=glbBoxes(fn()); AP3D.models.set(key,u); } return u; }
// --- modèles ---
const M_TOWER=()=>{ const sh=C3('#d6d3cc'), gl=C3('#1e3a5f'), dk=C3('#334155'), wh=C3('#f8fafc'), rd=C3('#dc2626'); const b=[
  [-9,9,0,8,-9,9,C3('#a8a29e')],                // socle
  [-3.2,3.2,8,46,-3.2,3.2,sh],                  // fût
  [-4.2,4.2,22,23,-4.2,4.2,dk],[-4.2,4.2,34,35,-4.2,4.2,dk],
  [-7,7,46,48,-7,7,wh],                          // plancher de la vigie
  [-6.8,6.8,48,53.5,-6.8,6.8,gl],                // vigie vitrée
  [-7.6,7.6,53.5,55,-7.6,7.6,wh],                // toit
  [-0.3,0.3,55,64,-0.3,0.3,C3('#94a3b8')],[-0.6,0.6,63,64.2,-0.6,0.6,rd]]; return b; };
const M_TERMINAL=L=>()=>{ const c=C3('#e7e5e4'), g=C3('#27445f'), r=C3('#9ca3af'), d=C3('#57534e'); return [
  [-L/2,L/2,0,4,-32,0,c],[-L/2,L/2,4,13,-32,-1,c],
  [-L/2,L/2,4.5,12,-0.6,0.4,g],                  // façade vitrée côté pistes
  [-L/2-1,L/2+1,13,14.2,-33,1,r],                 // toit
  ...[...Array(Math.max(2,Math.floor(L/90)))].map((_,i,a)=>{ const x=-L/2+L*(i+0.5)/a.length; return [x-6,x+6,14.2,17,-20,-8,d]; })]; };   // blocs techniques
const M_BRIDGE=()=>{ const g=C3('#cbd5e1'), d=C3('#475569'), gl=C3('#334155'); return [[-1.6,1.6,4,7.4,0,38,g],[-1.65,1.65,5.2,6.4,2,36,gl],[-2.3,2.3,4.2,7.8,38,41.5,g],[-0.6,0.6,0,4.2,33,34.2,d],[-0.6,0.6,0,4.2,14,15.2,d],[-2.8,2.8,0,7,-4,0,d]]; };
const M_TUG=()=>{ const y=C3('#facc15'), d=C3('#1f2937'); return [[-1.3,1.3,0.3,1.4,-2.4,2.4,y],[-1.1,1.1,1.4,2.3,-2.2,-0.6,d],[-1.35,-0.9,0,0.8,-1.8,-1.0,d],[0.9,1.35,0,0.8,-1.8,-1.0,d],[-1.35,-0.9,0,0.8,1.0,1.8,d],[0.9,1.35,0,0.8,1.0,1.8,d]]; };
const M_CART=()=>{ const g=C3('#9ca3af'), b=C3('#1e3a8a'); return [[-0.9,0.9,0.35,0.55,-1.4,1.4,g],[-0.85,0.85,0.55,1.5,-1.3,1.3,b],[-0.9,0.9,1.5,1.6,-1.4,1.4,g]]; };
const M_FUEL=()=>{ const w=C3('#f8fafc'), r=C3('#dc2626'), d=C3('#1f2937'); return [[-1.25,1.25,0.4,1.0,-4.6,4.6,d],[-1.25,1.25,1.0,3.0,2.2,4.6,r],[-1.2,1.2,1.0,3.1,-4.4,2.0,w],[-0.2,0.2,3.1,3.3,-4.2,1.8,C3('#9ca3af')]]; };
const M_CATER=()=>{ const w=C3('#f1f5f9'), b=C3('#0e7490'), d=C3('#1f2937'); return [[-1.2,1.2,0.4,1.0,-3.5,3.5,d],[-1.2,1.2,1.0,2.6,2,3.5,b],[-1.25,1.25,3.2,5.6,-3.3,1.6,w],[-1.1,1.1,1.0,3.2,-3,1.2,C3('#64748b')]]; };
const M_BELT=()=>{ const g=C3('#4b5563'), y=C3('#facc15'); return [[-0.8,0.8,0.3,1.0,-3,1,y],[-0.5,0.5,1.0,1.2,-3.2,4.5,g],[-0.5,0.5,1.2,3.4,4.0,4.6,g]]; };

/* ---------- décor d'un aéroport ---------- */
function rwPt(r,a,x){ return fromRw(r,a,x); }
function airportProps(code,N){
  const C=Cesium, V=G.viewer, ap=apronOf(code), r=ap.rw; if(!r) return;
  const EL=typeof gElev==='function'?gElev(code):0;
  const mk=(p,hdg,url,minPx)=>{ const pos=C.Cartesian3.fromDegrees(p.lon,p.lat,0.2+EL); N.ents.push(V.entities.add({position:pos, orientation:C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(hdg-90),0,0)), model:{uri:url, minimumPixelSize:minPx||0, shadows:C.ShadowMode.ENABLED, distanceDisplayCondition:new C.DistanceDisplayCondition(0,30000)}})); };
  const s=ap.side, gx=ap.x, a0=ap.a, A=AP(code), big=A.cls>=3, hdgOut=(r.hdg+90*s+360)%360;
  const span=big?1900:700, n=big?22:8;
  // terminal derrière la ligne de portes
  mk(rwPt(r,a0,gx+s*72),hdgOut+180,apModel('term'+span,M_TERMINAL(span)));
  // passerelles aux portes (positions de stationnement réelles du jeu)
  for(let k=0;k<n;k++){ const sp=slotPt(code,k); const q=destPt(sp.lat,sp.lon,hdgOut,0.062); mk(q,hdgOut+180,apModel('bridge',M_BRIDGE)); }
  // tour de contrôle : au bout du terminal, un peu en retrait
  mk(rwPt(r,a0+span/2+120,gx+s*110),r.hdg,apModel('tower',M_TOWER),8);
  // avions d'autres compagnies garés aux premières portes
  if(typeof AC3D!=='undefined'){ const al=(typeof airlinesAt==='function'?airlinesAt(code):[]).slice(0,6).map(([c])=>c);
    for(let k=0;k<Math.min(6,n);k++){ if(!al.length) break; const c=al[k%al.length], sp=slotPt(code,k), m=getModel(k%3===0&&big?'B789':k%2?'A20N':'B738')||getModel('A20N');
      const mi=AC3D.uri(m,typeof airlineColor==='function'?airlineColor(c):'#64748b'), pos=C.Cartesian3.fromDegrees(sp.lon,sp.lat,mi.R+mi.gH+0.4+EL);
      N.ents.push(V.entities.add({position:pos, orientation:C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(hdgOut-90),0,0)), model:{uri:mi.uri, shadows:C.ShadowMode.CAST_ONLY, distanceDisplayCondition:new C.DistanceDisplayCondition(0,25000)}})); } }
}

/* ---------- véhicules autour de l'avion suivi ---------- */
function groundVehicles(ac,p){
  const C=Cesium, V=G.viewer, st=p.st, mi=p.mi;
  const show=(st.phase===0||st.phase===8&&st.alt<1)||(st.phase===1&&st.pushback);
  if(!AP3D.veh){ AP3D.veh={}; const add=(k,url)=>{ AP3D.veh[k]=V.entities.add({position:C.Cartesian3.ZERO, model:{uri:url, shadows:C.ShadowMode.ENABLED}, show:false}); };
    add('tug',apModel('tug',M_TUG)); add('fuel',apModel('fuel',M_FUEL)); add('cater',apModel('cater',M_CATER)); add('belt',apModel('belt',M_BELT)); for(let i=0;i<4;i++) add('cart'+i,apModel('cart',M_CART)); }
  const Vh=AP3D.veh, inside=G.cam.mode==='cabin'||G.cam.mode==='cockpit';
  for(const e of Object.values(Vh)) e.show=show&&!inside;
  if(!show||inside) return;
  const place=(e,x,z,dh)=>{ const pos=fxLocal(p,x,-(mi.R+mi.gH)+0.25,z); e.position=pos; e.orientation=C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(st.hdg+(dh||0)-90),0,0)); };
  const L=mi.L, half=mi.span/2;
  if(st.phase===1){ place(Vh.tug,0,L*0.5+3.2,0); for(const k of ['fuel','cater','belt','cart0','cart1','cart2','cart3']) Vh[k].show=false; return; }
  place(Vh.tug,0,L*0.5+5,0);
  place(Vh.fuel,half*0.55,-L*0.02,90);
  place(Vh.cater,mi.R+3.2,L*0.36,0);
  place(Vh.belt,-(mi.R+1.6),-L*0.12,-35);
  for(let i=0;i<4;i++) place(Vh['cart'+i],-(mi.R+5),-L*0.12-6-i*3.4,0);
}
function groundClear(){ if(AP3D.veh&&G){ for(const e of Object.values(AP3D.veh)) G.viewer.entities.remove(e); } AP3D.veh=null; }
