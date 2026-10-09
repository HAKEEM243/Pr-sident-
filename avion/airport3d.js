/* =========================================================
   Sky Empire — vie de l'aéroport en 3D
   Tour de contrôle, terminal vitré, passerelles, avions garés,
   véhicules de piste autour de l'avion suivi (tracteur, bagages,
   carburant, catering) et repoussage au départ.
   ========================================================= */
'use strict';
const AP3D={models:new Map(), veh:null};
// GLB à partir d'une liste de boîtes [x0,x1,y0,y1,z0,z1,[r,g,b],(metal)] — X droite, Y haut, Z avant (mètres)
function glbBoxes(boxes,nodeName,lit){
  // groupe principal + groupe « lit » (vitres éclairées la nuit : matériau émissif, masqué au repos)
  const groups=[{name:nodeName||'n',boxes,mat:0}]; if(lit&&lit.length) groups.push({name:'lit',boxes:lit,mat:1,hide:1});
  const chunks=[], views=[], accessors=[], meshes=[], nodes=[]; let off=0;
  const view=(a,t)=>{ const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength), pad=(4-b.length%4)%4; views.push({buffer:0,byteOffset:off,byteLength:b.length,target:t}); chunks.push(b); if(pad) chunks.push(new Uint8Array(pad)); off+=b.length+pad; return views.length-1; };
  for(const g of groups){
    const pos=[], nor=[], col=[], idx=[];
    const face=(a,b,c,d,n,k)=>{ const s=pos.length/3; for(const v of [a,b,c,d]){ pos.push(...v); nor.push(...n); col.push(...k); } idx.push(s,s+1,s+2,s,s+2,s+3); };
    for(const [x0,x1,y0,y1,z0,z1,k] of g.boxes){
      face([x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[0,1,0],k);
      face([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],k);
      face([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],k);
      face([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],k);
      face([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],k);
    }
    const P=new Float32Array(pos), N=new Float32Array(nor), Cc=new Uint8Array(col.map(v=>Math.round(Math.max(0,Math.min(1,v))*255))), I=new Uint32Array(idx);
    const mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9]; for(let i=0;i<P.length;i++){ mn[i%3]=Math.min(mn[i%3],P[i]); mx[i%3]=Math.max(mx[i%3],P[i]); }
    const a0=accessors.length;
    accessors.push({bufferView:view(P,34962),componentType:5126,count:P.length/3,type:'VEC3',min:mn,max:mx},{bufferView:view(N,34962),componentType:5126,count:N.length/3,type:'VEC3'},{bufferView:view(Cc,34962),componentType:5121,normalized:true,count:Cc.length/3,type:'VEC3'},{bufferView:view(I,34963),componentType:5125,count:I.length,type:'SCALAR'});
    meshes.push({primitives:[{attributes:{POSITION:a0,NORMAL:a0+1,COLOR_0:a0+2},indices:a0+3,material:g.mat}]});
    nodes.push({mesh:meshes.length-1,name:g.name,...(g.hide?{scale:[0.001,0.001,0.001]}:{})});
  }
  const gltf={asset:{version:'2.0'},scene:0,scenes:[{nodes:nodes.map((n,i)=>i)}],nodes,meshes,
    materials:[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0.15,roughnessFactor:0.55},doubleSided:true},
      {pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:0.9},emissiveFactor:[1,0.86,0.6],doubleSided:true}],
    accessors,bufferViews:views,buffers:[{byteLength:off}]};
  let js=new TextEncoder().encode(JSON.stringify(gltf)); const jp=(4-js.length%4)%4; if(jp){ const t=new Uint8Array(js.length+jp); t.set(js); t.fill(32,js.length); js=t; }
  const total=28+js.length+off, glb=new Uint8Array(total), dv=new DataView(glb.buffer);
  dv.setUint32(0,0x46546C67,true); dv.setUint32(4,2,true); dv.setUint32(8,total,true); dv.setUint32(12,js.length,true); dv.setUint32(16,0x4E4F534A,true); glb.set(js,20);
  let o=20+js.length; dv.setUint32(o,off,true); dv.setUint32(o+4,0x004E4942,true); o+=8; for(const c of chunks){ glb.set(c,o); o+=c.length; }
  return URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}));
}
const C3=(h)=>{ const n=parseInt(h.slice(1),16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; };
function apModel(key,fn,node){ let u=AP3D.models.get(key); if(!u){ const r=fn(); u=Array.isArray(r)? glbBoxes(r,node) : glbBoxes(r.b,node,r.lit); AP3D.models.set(key,u); } return u; }
// --- modèles ---
const M_TOWER=()=>{ const sh=C3('#d6d3cc'), gl=C3('#1e3a5f'), dk=C3('#334155'), wh=C3('#f8fafc'), rd=C3('#dc2626'); const b=[
  [-9,9,0,8,-9,9,C3('#a8a29e')],                // socle
  [-3.2,3.2,8,46,-3.2,3.2,sh],                  // fût
  [-4.2,4.2,22,23,-4.2,4.2,dk],[-4.2,4.2,34,35,-4.2,4.2,dk],
  [-7,7,46,48,-7,7,wh],                          // plancher de la vigie
  [-6.8,6.8,48,53.5,-6.8,6.8,gl],                // vigie vitrée
  [-7.6,7.6,53.5,55,-7.6,7.6,wh],                // toit
  [-0.3,0.3,55,64,-0.3,0.3,C3('#94a3b8')],[-0.6,0.6,63,64.2,-0.6,0.6,rd]];
  return {b, lit:[[-6.86,6.86,48.4,53.2,-6.86,6.86,C3('#d9f99d')],[-3.26,3.26,12,14,-3.26,3.26,C3('#fde68a')],[-3.26,3.26,28,30,-3.26,3.26,C3('#fde68a')]]}; };
const M_TERMINAL=L=>()=>{ const c=C3('#e7e5e4'), g=C3('#2b4f73'), g2=C3('#3a6a96'), r=C3('#cbd5e1'), d=C3('#78716c'), m=C3('#f1f5f9'), b=[
  [-L/2,L/2,0,4.2,-40,0,c],                       // rez-de-chaussée (bagages, services)
  [-L/2,L/2,4.2,4.8,-40,1.5,m],                   // dalle de l'étage départs
  [-L/2,L/2,4.8,14,-40,-1.2,c],                   // étage
  [-L/2,L/2,5.2,13.6,-1.4,-0.6,g],                // mur-rideau vitré côté pistes
  [-L/2,L/2,0.6,3.6,-0.5,0.1,g2],                 // vitrage du rez-de-chaussée
  [-L/2-2,L/2+2,14,15,-42,4,r],                   // toit avec grand auvent
  [-L/2-2,L/2+2,13.2,14,2.6,4,r]];
  for(let x=-L/2;x<=L/2;x+=6) b.push([x-0.18,x+0.18,4.8,14,-1.2,-0.2,m]);          // montants de façade
  for(let x=-L/2+10;x<L/2;x+=60) b.push([x-0.5,x+0.5,4.8,14,2.4,3.4,m]);           // poteaux de l'auvent
  for(let i=0;i<Math.max(2,Math.floor(L/120));i++){ const x=-L/2+L*(i+0.5)/Math.max(2,Math.floor(L/120)); b.push([x-7,x+7,15,18,-28,-12,d]); }  // locaux techniques
  // la nuit : façade vitrée éclairée de l'intérieur (quelques baies plus sombres)
  const lit=[], w=C3('#fff3c4'), w2=C3('#c7b98a');
  for(let x=-L/2,i=0;x<L/2;x+=24,i++) lit.push([x,Math.min(L/2,x+24),5.3,13.5,-0.58,-0.5,(i*7)%5===0?w2:w],[x,Math.min(L/2,x+24),0.7,3.5,0.1,0.16,(i*3)%4===0?w2:w]);
  return {b, lit}; };
const M_BRIDGE=()=>{ const g=C3('#cbd5e1'), d=C3('#475569'), gl=C3('#334155'); return {b:[[-1.6,1.6,4,7.4,0,38,g],[-1.65,1.65,5.2,6.4,2,36,gl],[-2.3,2.3,4.2,7.8,38,41.5,g],[-0.6,0.6,0,4.2,33,34.2,d],[-0.6,0.6,0,4.2,14,15.2,d],[-2.8,2.8,0,7,-4,0,d]], lit:[[-1.68,1.68,5.3,6.3,2.2,35.8,C3('#fff3c4')]]}; };
// mât d'éclairage de l'aire (projecteurs tournés vers les postes)
const M_MAST=()=>{ const g=C3('#9ca3af'), d=C3('#374151'); return {b:[[-0.8,0.8,0,0.6,-0.8,0.8,d],[-0.32,0.32,0.6,27,-0.32,0.32,g],[-2.6,2.6,26.4,27,-0.35,0.35,g],[-2.5,-0.9,27,28.3,-0.5,0.5,d],[-0.8,0.8,27,28.3,-0.5,0.5,d],[0.9,2.5,27,28.3,-0.5,0.5,d]],
  lit:[[-2.45,-0.95,27.1,28.2,0.5,0.6,C3('#fff1c1')],[-0.75,0.75,27.1,28.2,0.5,0.6,C3('#fff1c1')],[0.95,2.45,27.1,28.2,0.5,0.6,C3('#fff1c1')]]}; };
const M_TUG=()=>{ const y=C3('#facc15'), d=C3('#1f2937'); return [[-1.3,1.3,0.3,1.4,-2.4,2.4,y],[-1.1,1.1,1.4,2.3,-2.2,-0.6,d],[-1.35,-0.9,0,0.8,-1.8,-1.0,d],[0.9,1.35,0,0.8,-1.8,-1.0,d],[-1.35,-0.9,0,0.8,1.0,1.8,d],[0.9,1.35,0,0.8,1.0,1.8,d]]; };
const M_CART=()=>{ const g=C3('#9ca3af'), b=C3('#1e3a8a'); return [[-0.9,0.9,0.35,0.55,-1.4,1.4,g],[-0.85,0.85,0.55,1.5,-1.3,1.3,b],[-0.9,0.9,1.5,1.6,-1.4,1.4,g]]; };
const M_FUEL=()=>{ const w=C3('#f8fafc'), r=C3('#dc2626'), d=C3('#1f2937'); return [[-1.25,1.25,0.4,1.0,-4.6,4.6,d],[-1.25,1.25,1.0,3.0,2.2,4.6,r],[-1.2,1.2,1.0,3.1,-4.4,2.0,w],[-0.2,0.2,3.1,3.3,-4.2,1.8,C3('#9ca3af')]]; };
const M_CATER=()=>{ const w=C3('#f1f5f9'), b=C3('#0e7490'), d=C3('#1f2937'); return [[-1.2,1.2,0.4,1.0,-3.5,3.5,d],[-1.2,1.2,1.0,2.6,2,3.5,b],[-1.25,1.25,3.2,5.6,-3.3,1.6,w],[-1.1,1.1,1.0,3.2,-3,1.2,C3('#64748b')]]; };
const M_BELT=()=>{ const g=C3('#4b5563'), y=C3('#facc15'); return [[-0.8,0.8,0.3,1.0,-3,1,y],[-0.5,0.5,1.0,1.2,-3.2,4.5,g],[-0.5,0.5,1.2,3.4,4.0,4.6,g]]; };

/* ---------- nuit : projecteurs de l'aire, vitres éclairées, balisage des voies ---------- */
AP3D.night=false; AP3D.el=45;
function apLightInit(){ if(AP3D.lc) return; const C=Cesium;
  AP3D.lcv=new C.Color(2,2,2,1); AP3D.rcv=new C.Color(2,2,2,1); AP3D.ibv=new C.Cartesian2(1,1);   // lightColor : Cesium attend une Color (composantes HDR)
  AP3D.lc=new C.CallbackProperty(()=>AP3D.lcv,false); AP3D.rc=new C.CallbackProperty(()=>AP3D.rcv,false); AP3D.ib=new C.CallbackProperty(()=>AP3D.ibv,false);
  const on={lit:new C.TranslationRotationScale(C.Cartesian3.ZERO,C.Quaternion.IDENTITY,new C.Cartesian3(1000,1000,1000))}, off={lit:new C.TranslationRotationScale()};
  AP3D.nt=new C.CallbackProperty(()=>AP3D.night?on:off,false); }
// lumière reçue au sol selon la hauteur du soleil ; la nuit, lumière orangée des projecteurs (plus faible sur les pistes)
function apLightSet(el){ apLightInit(); const C=Cesium, k=Math.max(0.1,Math.min(1,(el+5)/13)), w=Math.max(0,1-Math.abs(el-3)/9)*0.35, n=Math.max(0,Math.min(1,-el/6));
  const d=[2*k,2*k*(1-w*0.45),2*k*(1-w)], mx=(a,b)=>[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.max(a[2],b[2])];
  const fl=mx(d,[0.85*n,0.68*n,0.46*n]), rw=mx(d,[0.3*n,0.3*n,0.34*n]);
  const set=(c,v)=>{ c.red=v[0]; c.green=v[1]; c.blue=v[2]; }; set(AP3D.lcv,fl); set(AP3D.rcv,rw); C.Cartesian2.fromElements(Math.max(k,0.3*n),Math.max(k,0.3*n),AP3D.ibv); }
// branche un modèle de l'aéroport sur cet éclairage ; kind 'lit' = vitres allumées la nuit, 'rwy' = piste
function apLit(ent,kind){ apLightInit(); if(!ent||!ent.model) return ent; ent.model.lightColor=kind==='rwy'?AP3D.rc:AP3D.lc; ent.model.imageBasedLightingFactor=AP3D.ib; if(kind==='lit') ent.model.nodeTransformations=AP3D.nt; return ent; }
function nightTick(p){
  const sc=G.viewer.scene, el=(sc.globe.enableLighting&&!G.forceDay&&typeof sunElevAt==='function')? sunElevAt(p.st.lat,p.st.lon) : 45;
  AP3D.el=el; apLightSet(el); const nt=el<-4;
  // nuages sombres la nuit, dorés au crépuscule
  const ck=Math.max(0.07,Math.min(1,(el+6)/12));
  if(G.clouds&&Math.abs((G.cloudK||1)-ck)>0.02){ const r=ck/(G.cloudK||1); for(let i=0;i<G.clouds.length;i++){ const c=G.clouds.get(i); c.brightness=Math.min(1,c.brightness*r); } }
  G.cloudK=ck;
  if(nt!==AP3D.night){ AP3D.night=nt; if(G.apNear) G.apNear.c={lat:999,lon:999}; }   // l'aéroport est reconstruit en version nuit / jour
}
function glowImage(){ if(AP3D._glow) return AP3D._glow; const cv=document.createElement('canvas'); cv.width=cv.height=64; const g=cv.getContext('2d'), gr=g.createRadialGradient(32,32,1,32,32,31);
  gr.addColorStop(0,'rgba(255,248,220,1)'); gr.addColorStop(0.18,'rgba(255,214,140,0.75)'); gr.addColorStop(0.5,'rgba(255,170,80,0.22)'); gr.addColorStop(1,'rgba(255,150,60,0)'); g.fillStyle=gr; g.fillRect(0,0,64,64); return AP3D._glow=cv; }
function poolImage(){ if(AP3D._pool) return AP3D._pool; const cv=document.createElement('canvas'); cv.width=cv.height=128; const g=cv.getContext('2d'), gr=g.createRadialGradient(64,64,2,64,64,63);
  gr.addColorStop(0,'rgba(255,205,130,0.55)'); gr.addColorStop(0.55,'rgba(255,185,105,0.28)'); gr.addColorStop(1,'rgba(255,170,90,0)'); g.fillStyle=gr; g.fillRect(0,0,128,128); return AP3D._pool=cv; }
// feux de voies de circulation : axe vert, bords bleus (la nuit)
function taxiLights(code,N,EL){
  const C=Cesium, ap=apronOf(code), r=ap.rw; if(!r) return;
  const tw=(ap.x>=0?1:-1)*Math.min(Math.abs(ap.x)*0.6,190), G_=C.Color.fromCssColorString('#4ade80'), B=C.Color.fromCssColorString('#3b82f6');
  const add=(q,col,sz)=>N.lights.add({position:C.Cartesian3.fromDegrees(q.lon,q.lat,0.9+EL), color:col, pixelSize:sz, disableDepthTestDistance:1500, scaleByDistance:new C.NearFarScalar(200,1.5,12000,0.4)});
  const seg=(a0,x0,a1,x1,edge)=>{ const L=Math.hypot(a1-a0,x1-x0), n=Math.max(1,Math.round(L/30)), ux=(x1-x0)/L, ua=(a1-a0)/L;
    for(let i=0;i<=n;i++){ const a=a0+(a1-a0)*i/n, x=x0+(x1-x0)*i/n; add(rwPt(r,a,x),G_,3); if(edge&&i%2===0){ add(rwPt(r,a-ux*11.5,x+ua*11.5),B,3); add(rwPt(r,a+ux*11.5,x-ua*11.5),B,3); } } };
  seg(-60,tw,r.len+60,tw,true);                                                   // voie parallèle à la piste
  seg(-40,tw,-25,tw*0.3); seg(-25,tw*0.3,0,0);                                    // entrée en bout de piste
  seg(r.len+40,tw,r.len+25,tw*0.3); seg(r.len+25,tw*0.3,r.len,0);
  for(const f of [0.45,0.62,0.78]) seg(r.len*f+180,tw,r.len*f,0);                   // sorties rapides
  const span=AP(code).cls>=3?1900:700, s=ap.side;
  seg(ap.a-span/2-60,ap.x-s*55,ap.a+span/2+60,ap.x-s*55);                         // voie de l'aire de stationnement
  for(const da of [-span/2,0,span/2]) seg(ap.a+da,ap.x-s*55,ap.a+da,tw);          // bretelles vers la voie parallèle
}

/* ---------- décor d'un aéroport ---------- */
function rwPt(r,a,x){ return fromRw(r,a,x); }
function airportProps(code,N){
  const C=Cesium, V=G.viewer, ap=apronOf(code), r=ap.rw; if(!r) return;
  const EL=typeof gElev==='function'?gElev(code):0;
  const mk=(p,hdg,url,minPx)=>{ const pos=C.Cartesian3.fromDegrees(p.lon,p.lat,0.2+EL); N.ents.push(apLit(V.entities.add({position:pos, orientation:C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(hdg-90),0,0)), model:{uri:url, minimumPixelSize:minPx||0, shadows:C.ShadowMode.ENABLED, distanceDisplayCondition:new C.DistanceDisplayCondition(0,30000)}}),'lit')); };
  const s=ap.side, gx=ap.x, a0=ap.a, A=AP(code), big=A.cls>=3, hdgOut=(r.hdg+90*s+360)%360;
  const span=big?1900:700, n=big?22:8;
  // terminal derrière la ligne de portes
  mk(rwPt(r,a0,gx+s*72),hdgOut+180,apModel('term'+span,M_TERMINAL(span)));
  // passerelles aux portes (positions de stationnement réelles du jeu)
  AP3D.bridges=AP3D.bridges||{}; AP3D.bridges[code]={};
  for(let k=0;k<n;k++){ const sp=slotPt(code,k); const q=destPt(sp.lat,sp.lon,hdgOut,0.062); mk(q,hdgOut+180,apModel('bridge',M_BRIDGE)); AP3D.bridges[code][k]=N.ents[N.ents.length-1]; }
  // aire de stationnement : béton, lignes jaunes de guidage et barres d'arrêt
  try{ apronGround(code,N,EL); }catch(e){ console.warn(e); }
  // nom de l'aéroport sur le toit, face aux pistes
  try{ const sg=rwPt(r,a0,gx+s*70), pos=C.Cartesian3.fromDegrees(sg.lon,sg.lat,15+EL); N.ents.push(V.entities.add({position:pos, orientation:C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(hdgOut+180-90),0,0)), model:{uri:signModel(A.city,code), distanceDisplayCondition:new C.DistanceDisplayCondition(0,12000)}})); }catch(e){ console.warn(e); }
  // tour de contrôle : au bout du terminal, un peu en retrait
  mk(rwPt(r,a0+span/2+120,gx+s*110),r.hdg,apModel('tower',M_TOWER),8);
  // avions d'autres compagnies garés aux premières portes
  if(typeof AC3D!=='undefined'){ const al=(typeof airlinesAt==='function'?airlinesAt(code):[]).slice(0,6).map(([c])=>c);
    for(let k=0;k<Math.min(6,n);k++){ if(!al.length) break; const c=al[k%al.length], sp=slotPt(code,k), m=getModel(k%3===0&&big?'B789':k%2?'A20N':'B738')||getModel('A20N');
      const mi=AC3D.uri(m,typeof airlineColor==='function'?airlineColor(c):'#64748b'), pos=C.Cartesian3.fromDegrees(sp.lon,sp.lat,mi.R+mi.gH+0.4+EL);
      N.ents.push(apLit(V.entities.add({position:pos, orientation:C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(hdgOut-90),0,0)), model:{uri:mi.uri, shadows:C.ShadowMode.CAST_ONLY, distanceDisplayCondition:new C.DistanceDisplayCondition(0,25000)}}))); } }
  // mâts d'éclairage le long de l'aire ; la nuit : halo des projecteurs et flaques de lumière sur le béton
  const nm=Math.max(3,Math.round(span/170));
  for(let i=0;i<=nm;i++){ const a=a0-span/2+span*i/nm, mp=rwPt(r,a,gx-s*66); mk(mp,hdgOut,apModel('mast',M_MAST),0);
    if(!AP3D.night) continue;
    const head=C.Cartesian3.fromDegrees(mp.lon,mp.lat,27.8+EL);
    N.ents.push(V.entities.add({position:head, billboard:{image:glowImage(), width:30, height:30, sizeInMeters:true, color:C.Color.WHITE.withAlpha(0.95)}, point:{pixelSize:5, color:C.Color.fromCssColorString('#fff7e0'), scaleByDistance:new C.NearFarScalar(200,1.4,15000,0.5)}}));
    const pool=rwPt(r,a,gx-s*20);
    N.ents.push(V.entities.add({position:C.Cartesian3.fromDegrees(pool.lon,pool.lat,EL+0.34), ellipse:{semiMajorAxis:95, semiMinorAxis:95, height:EL+0.34, material:new C.ImageMaterialProperty({image:poolImage(), transparent:true})}})); }
  if(AP3D.night) try{ taxiLights(code,N,EL); }catch(e){ console.warn(e); }
}

/* ---------- véhicules autour de l'avion suivi ---------- */
function groundVehicles(ac,p){
  const C=Cesium, V=G.viewer, st=p.st, mi=p.mi;
  const show=(st.phase===0||st.phase===8&&st.alt<1)||(st.phase===1&&st.pushback);
  if(!AP3D.veh){ AP3D.veh={}; const add=(k,url)=>{ AP3D.veh[k]=apLit(V.entities.add({position:C.Cartesian3.ZERO, model:{uri:url, shadows:C.ShadowMode.ENABLED}, show:false})); };
    add('tug',apModel('tug',M_TUG)); add('fuel',apModel('fuel',M_FUEL)); add('cater',apModel('cater',M_CATER)); add('belt',apModel('belt',M_BELT)); for(let i=0;i<4;i++) add('cart'+i,apModel('cart',M_CART)); }
  const Vh=AP3D.veh, inside=G.cam.mode==='cabin'||G.cam.mode==='cockpit';
  for(const e of Object.values(Vh)) e.show=show&&!inside;
  if(!show||inside) return;
  const place=(e,x,z,dh)=>{ const pos=fxLocal(p,x,-(mi.R+mi.gH)+0.25,z); e.position=pos; e.orientation=C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(st.hdg+(dh||0)-90),0,0)); };
  const L=mi.L, half=mi.span/2;
  if(st.phase===1){ place(Vh.tug,0,L*0.5+3.2,0); for(const k of ['fuel','cater','belt','cart0','cart1','cart2','cart3']) Vh[k].show=false; return; }
  place(Vh.tug,0,L*0.5+5,0);
  if((modelOf(ac).seats||0)<50){ place(Vh.fuel,half+4,-L*0.05,90); for(const k of ['cater','belt','cart0','cart1','cart2','cart3']) Vh[k].show=false; return; }   // petit avion : pas de camion de repas ni de tapis
  place(Vh.fuel,half*0.55,-L*0.02,90);
  place(Vh.cater,mi.R+3.2,L*0.36,0);
  place(Vh.belt,-(mi.R+1.6),-L*0.12,-35);
  for(let i=0;i<4;i++) place(Vh['cart'+i],-(mi.R+5),-L*0.12-6-i*3.4,0);
}
function groundClear(){ if(AP3D.veh&&G){ for(const e of Object.values(AP3D.veh)) G.viewer.entities.remove(e); } AP3D.veh=null; }

/* ---------- panneau texturé (nom de l'aéroport) ---------- */
function signModel(city,code){
  const key='sign'+code; let u=AP3D.models.get(key); if(u) return u;
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=128; const g=cv.getContext('2d');
  g.fillStyle='#0b2545'; g.fillRect(0,0,1024,128); g.fillStyle='#f8fafc'; g.font='bold 72px Arial, sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  const txt=(city||'').toUpperCase()+'  ✈  '+code; let fs=72; while(g.measureText(txt).width>980&&fs>30){ fs-=4; g.font=`bold ${fs}px Arial, sans-serif`; } g.fillText(txt,512,68);
  const W=80, H=10, b64=cv.toDataURL('image/png').split(',')[1], bin=atob(b64), img=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) img[i]=bin.charCodeAt(i);
  const P=new Float32Array([-W/2,0,0.2, W/2,0,0.2, W/2,H,0.2, -W/2,H,0.2]), Nn=new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]), T=new Float32Array([1,1, 0,1, 0,0, 1,0]), I=new Uint16Array([0,1,2,0,2,3]);
  const parts=[[P,34962],[Nn,34962],[T,34962],[I,34963],[img,null]], views=[], chunks=[]; let off=0;
  for(const [a,t] of parts){ const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength), pad=(4-b.length%4)%4; const v={buffer:0,byteOffset:off,byteLength:b.length}; if(t) v.target=t; views.push(v); chunks.push(b); if(pad) chunks.push(new Uint8Array(pad)); off+=b.length+pad; }
  const gltf={asset:{version:'2.0'},extensionsUsed:['KHR_materials_unlit'],scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3,material:0}]}],
    materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:1},extensions:{KHR_materials_unlit:{}},doubleSided:true}],textures:[{source:0}],images:[{bufferView:4,mimeType:'image/png'}],
    accessors:[{bufferView:0,componentType:5126,count:4,type:'VEC3',min:[-W/2,0,0.2],max:[W/2,H,0.2]},{bufferView:1,componentType:5126,count:4,type:'VEC3'},{bufferView:2,componentType:5126,count:4,type:'VEC2'},{bufferView:3,componentType:5123,count:6,type:'SCALAR'}],bufferViews:views,buffers:[{byteLength:off}]};
  let js=new TextEncoder().encode(JSON.stringify(gltf)); const jp=(4-js.length%4)%4; if(jp){ const t=new Uint8Array(js.length+jp); t.set(js); t.fill(32,js.length); js=t; }
  const total=28+js.length+off, glb=new Uint8Array(total), dv=new DataView(glb.buffer);
  dv.setUint32(0,0x46546C67,true); dv.setUint32(4,2,true); dv.setUint32(8,total,true); dv.setUint32(12,js.length,true); dv.setUint32(16,0x4E4F534A,true); glb.set(js,20);
  let o=20+js.length; dv.setUint32(o,off,true); dv.setUint32(o+4,0x004E4942,true); o+=8; for(const c of chunks){ glb.set(c,o); o+=c.length; }
  u=URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'})); AP3D.models.set(key,u); return u;
}
/* ---------- aire de stationnement : béton + marquages ---------- */
function apronGround(code,N,EL){
  const C=Cesium, V=G.viewer, ap=apronOf(code), r=ap.rw, s=ap.side, gx=ap.x, a0=ap.a, big=AP(code).cls>=3, span=big?1900:700, n=big?22:8, hdgOut=(r.hdg+90*s+360)%360;
  const c1=rwPt(r,a0-span/2-60,gx-s*70), c2=rwPt(r,a0+span/2+60,gx-s*70), c3=rwPt(r,a0+span/2+60,gx+s*70), c4=rwPt(r,a0-span/2-60,gx+s*70);
  const geo=[new C.GeometryInstance({geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray([c1,c2,c3,c4].flatMap(q=>[q.lon,q.lat]))),height:EL+0.18,vertexFormat:C.PerInstanceColorAppearance.VERTEX_FORMAT}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(AP3D.night?new C.Color(0.4,0.35,0.28,1):new C.Color(0.72,0.72,0.70,1))}})];
  const lines=[], Y=C.Color.fromCssColorString(AP3D.night?'#b8901a':'#facc15');
  const ln=(a,b,col,w)=>lines.push(new C.GeometryInstance({geometry:new C.PolylineGeometry({positions:C.Cartesian3.fromDegreesArrayHeights([a.lon,a.lat,EL+0.3,b.lon,b.lat,EL+0.3]),width:w||3,vertexFormat:C.PolylineColorAppearance.VERTEX_FORMAT}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(col||Y)}}));
  ln(rwPt(r,a0-span/2-60,gx-s*55),rwPt(r,a0+span/2+60,gx-s*55));                     // voie de circulation de l'aire
  for(let k=0;k<n;k++){ const sp=slotPt(code,k), a=destPt(sp.lat,sp.lon,hdgOut+180,0.055), b=destPt(sp.lat,sp.lon,hdgOut,0.026);
    ln(a,b);                                                                          // ligne d'entrée au poste
    const st=destPt(sp.lat,sp.lon,hdgOut,0.022); ln(destPt(st.lat,st.lon,hdgOut+90,0.004),destPt(st.lat,st.lon,hdgOut-90,0.004),AP3D.night?C.Color.fromCssColorString('#a8a29e'):C.Color.WHITE,4); }   // barre d'arrêt
  N.rwy.push(V.scene.primitives.add(new C.Primitive({geometryInstances:geo,appearance:new C.PerInstanceColorAppearance({flat:true}),asynchronous:true})));
  N.rwy.push(V.scene.primitives.add(new C.Primitive({geometryInstances:lines,appearance:new C.PolylineColorAppearance(),asynchronous:true})));
}

/* =========================================================
   EMBARQUEMENT : passerelle mobile ou escalier, passagers qui marchent
   ========================================================= */
const M_TUBE=()=>{ const g=C3('#d1d5db'), gl=C3('#1e3a5f'), d=C3('#6b7280'); return [[-1.7,1.7,0,0.25,0,1,d],[-1.7,1.7,2.6,2.9,0,1,g],[-1.75,-1.6,0.25,2.6,0,1,g],[1.6,1.75,0.25,2.6,0,1,g],[-1.8,-1.55,1.1,2.1,0,1,gl],[1.55,1.8,1.1,2.1,0,1,gl]]; };
const M_ROTUNDA=()=>{ const g=C3('#cbd5e1'), d=C3('#475569'); return [[-2.6,2.6,0,3.3,-2.6,2.6,g],[-0.6,0.6,-30,0,-0.6,0.6,d]]; };
const M_CAB=()=>{ const g=C3('#e5e7eb'), d=C3('#374151'), b=C3('#111827'); return [[-1.9,1.9,-0.1,3.0,0,2.2,g],[-1.95,1.95,0.4,2.5,2.2,2.6,b],[-0.5,0.5,-20,-0.1,0.6,1.4,d]]; };
const M_STAIRS=h=>()=>{ const w=C3('#f8fafc'), y=C3('#facc15'), d=C3('#1f2937'), b=[[-1.3,1.3,0.4,1.1,-6.5,2.5,d],[-1.3,1.3,1.1,2.2,-6.5,-3.8,w]]; const n=Math.max(4,Math.round(h/0.25)), run=5.2;
  for(let i=0;i<n;i++){ const y0=1.1+i*(h-1.1)/n; b.push([-0.75,0.75,y0,y0+0.12,-3.5+i*run/n,-3.5+(i+1)*run/n,i%2?w:y]); }
  b.push([-0.8,-0.72,1.1,h+1,-3.5,1.8,w],[0.72,0.8,1.1,h+1,-3.5,1.8,w],[-0.85,0.85,h-0.05,h+0.08,1.7,2.6,w]); return b; };
const SHIRTS=['#dc2626','#2563eb','#f8fafc','#111827','#16a34a','#eab308','#9333ea','#ec4899','#0891b2','#ea580c'], SKINS=['#5b3a24','#7a4a2a','#3f2516','#e8c2a0','#c99a73'];
const M_PAX=(sh,sk)=>()=>{ const S_=C3(sh), K=C3(sk), P=C3('#1f2937'), B=C3('#78350f'); return [[-0.17,-0.03,0,0.85,-0.08,0.08,P],[0.03,0.17,0,0.85,-0.08,0.08,P],[-0.22,0.22,0.85,1.45,-0.12,0.12,S_],[-0.29,-0.22,0.9,1.4,-0.07,0.07,S_],[0.22,0.29,0.9,1.4,-0.07,0.07,S_],[-0.11,0.11,1.47,1.72,-0.11,0.11,K],[0.3,0.5,0.25,0.75,-0.12,0.12,B]]; };
// durée de l'escale au poste (segment « embarquement » du profil de vol)
function prof0(leg,m){ try{ const sg=legProf(leg,m).segs[0]; return sg.t1-sg.t0; }catch(e){ return 25*MIN; } }
function gateFx(ac,p){
  const C=Cesium, V=G.viewer, st=p.st, mi=p.mi, m=modelOf(ac), inside=G.cam.mode==='cabin'||G.cam.mode==='cockpit';
  const atGate=st.phase===0&&!inside, code=st.from;
  const G3=AP3D.gate||(AP3D.gate={ents:{},pax:[],k:null,spawn:0});
  const bigAp=AP(code)&&AP(code).cls>=3, jet=bigAp&&(m.seats||0)>=70&&!(typeof isCargo==='function'&&isCargo(m));
  // passerelle fixe de ce poste masquée (remplacée par la passerelle mobile)
  const k=8+acSlotHash(ac.id)%14, br=AP3D.bridges&&AP3D.bridges[code]&&AP3D.bridges[code][k]; if(br) br.show=!atGate;
  const ensure=(name,url,extra)=>G3.ents[name]||(G3.ents[name]=apLit(V.entities.add({position:C.Cartesian3.ZERO, model:{uri:url, shadows:C.ShadowMode.ENABLED, ...(extra||{})}, show:false})));
  for(const e of Object.values(G3.ents)) e.show=false;
  if(!atGate){ for(const x of G3.pax) V.entities.remove(x.e); G3.pax=[]; return; }
  const sill=-mi.R*0.32, door=fxLocal(p,-mi.R*1.0,sill,mi.L*0.36);                  // porte avant gauche
  const groundY=-(mi.R+mi.gH+0.4), tf=x=>fxLocal(p,x[0],x[1],x[2]);
  let path;
  const toCart=c=>C.Cartographic.fromCartesian(c);
  if(jet){
    const rot=fxLocal(p,-mi.R-6,groundY+4.9,58), cab=door;                       // rotonde au pied de la façade, à l'étage des départs
    const a=toCart(rot), b=toCart(cab), hd=bearing({lat:C.Math.toDegrees(a.latitude),lon:C.Math.toDegrees(a.longitude)},{lat:C.Math.toDegrees(b.latitude),lon:C.Math.toDegrees(b.longitude)});
    const len=Math.max(4,C.Cartesian3.distance(rot,cab)-2.4), pitch=Math.atan2(b.height-a.height,len);
    G3.len=len; const tube=ensure('tube',apModel('tube',M_TUBE,'tube'),{nodeTransformations:new C.PropertyBag({tube:new C.CallbackProperty(()=>new C.TranslationRotationScale(C.Cartesian3.ZERO,C.Quaternion.IDENTITY,new C.Cartesian3(1,1,AP3D.gate?AP3D.gate.len:10)),false)})});
    const q=(pos,h,pt)=>C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(h-90),pt||0,0));
    tube.position=rot; tube.orientation=q(rot,hd,pitch); tube.show=true;
    const ro=ensure('rot',apModel('rotunda',M_ROTUNDA)); ro.position=rot; ro.orientation=q(rot,hd); ro.show=true;
    const cb=ensure('cab',apModel('cab',M_CAB)); const cpos=C.Cartesian3.lerp(rot,cab,(len)/(len+2.4),new C.Cartesian3()); cb.position=cpos; cb.orientation=q(cpos,hd,pitch); cb.show=true;
    const term=fxLocal(p,-mi.R-6,groundY+4.9,71);
    path=[term,rot,door];
  } else {
    const h=Math.max(1.6,mi.R+mi.gH+0.4+sill-0.0);
    const stz=fxLocal(p,-mi.R-2.6,groundY+0.05,mi.L*0.36);
    const sr=ensure('stairs'+Math.round(h*4),apModel('stairs'+Math.round(h*4),M_STAIRS(Math.round(h*4)/4)));
    sr.position=stz; sr.orientation=C.Transforms.headingPitchRollQuaternion(stz,new C.HeadingPitchRoll(C.Math.toRadians(st.hdg+90-90),0,0)); sr.show=true;
    const foot=fxLocal(p,-mi.R-7.5,groundY+0.2,mi.L*0.36), term=fxLocal(p,-mi.R-14,groundY+0.2,mi.L*0.5+40), top=fxLocal(p,-mi.R-0.3,sill,mi.L*0.36);
    path=[term,foot,top];
  }
  // escale : d'abord le débarquement (les passagers du vol précédent descendent), nettoyage de la cabine, puis l'embarquement
  const now=performance.now(), bs=prof0(st.leg,m), bu=(gSimNow()-st.leg.dep)/Math.max(1,bs), stage=bu<0.3?'off':bu<0.37?'clean':'on';
  G3.stage=stage;
  if(stage!=='clean'&&now>G3.spawn&&G3.pax.length<26){ G3.spawn=now+(stage==='off'?650:900)+Math.random()*900; const sh=SHIRTS[Math.floor(Math.random()*SHIRTS.length)], sk=SKINS[Math.floor(Math.random()*SKINS.length)], rev=stage==='off';
    G3.pax.push({e:apLit(V.entities.add({position:rev?path[path.length-1]:path[0], model:{uri:apModel('pax'+sh+sk,M_PAX(sh,sk)), minimumPixelSize:0}})), t0:now, v:(rev?1.35:1.25)+Math.random()*0.35, rev}); }
  const paths={f:path, r:path.slice().reverse()}, lens={};
  for(const [k,pa] of Object.entries(paths)){ const L=[]; let tot=0; for(let i=1;i<pa.length;i++){ const d=C.Cartesian3.distance(pa[i-1],pa[i]); L.push(d); tot+=d; } lens[k]={L,tot}; }
  G3.pax=G3.pax.filter(x=>{ const pa=x.rev?paths.r:paths.f, {L,tot}=lens[x.rev?'r':'f']; let sd=(now-x.t0)/1000*x.v; if(sd>=tot){ V.entities.remove(x.e); return false; }
    let i=0; while(i<L.length-1&&sd>L[i]){ sd-=L[i]; i++; } const a=pa[i], b=pa[i+1], u=Math.min(1,sd/L[i]);
    const pos=C.Cartesian3.lerp(a,b,u,new C.Cartesian3()); const ca=toCart(a), cbb=toCart(b);
    const hd=bearing({lat:C.Math.toDegrees(ca.latitude),lon:C.Math.toDegrees(ca.longitude)},{lat:C.Math.toDegrees(cbb.latitude),lon:C.Math.toDegrees(cbb.longitude)});
    x.e.position=pos; x.e.orientation=C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(hd-90),0,0)); x.e.show=true; return true; });
}
function gateClear(){ if(AP3D.bridges) for(const g of Object.values(AP3D.bridges)) for(const e of Object.values(g)) e.show=true; if(!G||!AP3D.gate) return; for(const e of Object.values(AP3D.gate.ents)) G.viewer.entities.remove(e); for(const x of AP3D.gate.pax) G.viewer.entities.remove(x.e); AP3D.gate=null; }
