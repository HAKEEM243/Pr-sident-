/* =========================================================
   Sky Empire — effets de la vue de vol 3D
   • 👥 Cabine : l'intérieur de l'avion, sièges, hublots et
     passagers (ceux du manifeste sont à leur place).
   • Feux de navigation, anticollision, strobes, phares d'atterrissage.
   • Fumée des pneus au toucher des roues.
   • 🎬 Caméra auto : vue depuis le bord de piste au décollage et à l'atterrissage.
   • 🔊 Son des moteurs (synthétisé, suit la poussée).
   ========================================================= */
'use strict';
const FX={cabin:null, cabinFor:null, lights:null, smoke:null, puffs:[], wasAir:null, spot:null, sound:null, soundOn:false};

/* ---------- repère local de l'avion → monde ---------- */
// x : droite, y : haut, z : avant (mètres, par rapport à l'axe du fuselage)
function fxLocal(p,x,y,z){
  const C=Cesium, hd=C.Math.toRadians(p.st.hdg), pt=C.Math.toRadians(p.a.pitch||0);
  const zf=z*Math.cos(pt), up=y+z*Math.sin(pt);
  const e=zf*Math.sin(hd)+x*Math.cos(hd), n=zf*Math.cos(hd)-x*Math.sin(hd);
  const enu=FX._enu||(FX._enu=new C.Matrix4()); C.Transforms.eastNorthUpToFixedFrame(p.pos,undefined,enu);
  return C.Matrix4.multiplyByPoint(enu,new C.Cartesian3(e,n,up),new C.Cartesian3());
}

/* =========================================================
   CABINE (glTF éclairé « unlit », couleurs par sommet)
   ========================================================= */
const SKIN={AF:[[0.36,0.22,0.14],[0.45,0.29,0.18],[0.29,0.18,0.11]],EU:[[0.93,0.78,0.67],[0.87,0.69,0.57]],NA:[[0.91,0.76,0.64],[0.62,0.43,0.3],[0.4,0.26,0.17]],SA:[[0.76,0.57,0.42],[0.66,0.47,0.33]],AS:[[0.92,0.8,0.65],[0.8,0.63,0.47]],OC:[[0.9,0.75,0.62],[0.6,0.42,0.3]]};
const SHIRT=[[0.85,0.2,0.2],[0.15,0.35,0.75],[0.95,0.95,0.95],[0.1,0.1,0.12],[0.2,0.6,0.35],[0.95,0.75,0.2],[0.55,0.3,0.65],[0.9,0.5,0.6],[0.35,0.35,0.4],[0.0,0.55,0.6],[0.95,0.45,0.15]];
const HAIR=[[0.05,0.04,0.04],[0.12,0.08,0.05],[0.3,0.2,0.1],[0.7,0.55,0.3],[0.55,0.55,0.55]];
function cabinBuild(ac,mi){
  const m=modelOf(ac), R=mi.R, L=mi.L, Ri=R*0.94, fl=-R*0.38, cargo=typeof isCargo==='function'&&isCargo(m);
  const pos=[], col=[], idx=[];
  const quad=(a,b,c,d,k)=>{ const s=pos.length/3; for(const v of [a,b,c,d]){ pos.push(...v); col.push(...k); } idx.push(s,s+1,s+2,s,s+2,s+3); };
  const shade=(k,f)=>[k[0]*f,k[1]*f,k[2]*f];
  const box=(x0,x1,y0,y1,z0,z1,k)=>{
    quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],shade(k,1.08)); // dessus
    quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],shade(k,1));    // avant
    quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],shade(k,0.84)); // côtés
    quad([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],shade(k,0.84));
  };
  const wx=y=>Math.sqrt(Math.max(0.01,Ri*Ri-y*y));
  const zF=L/2-L*0.15, zR=-L/2+L*0.24, yC=Math.min(Ri*0.8, fl+2.15);
  const wall=[0.86,0.85,0.8], carpet=[0.22,0.26,0.36], aisle=[0.32,0.24,0.3], ceil=[0.94,0.94,0.92], binC=[0.9,0.9,0.88];
  // plancher et allée
  quad([-wx(fl),fl,zR],[wx(fl),fl,zR],[wx(fl),fl,zF],[-wx(fl),fl,zF],carpet);
  // parois avec hublots (vides : on voit dehors)
  const pitch=0.81, wyc=fl+1.12, wh=0.21, ww=0.15;
  const panel=(s,za,zb,ya,yb,k)=>{ const n=3; for(let i=0;i<n;i++){ const y0=ya+(yb-ya)*i/n, y1=ya+(yb-ya)*(i+1)/n; quad([s*wx(y0),y0,za],[s*wx(y0),y0,zb],[s*wx(y1),y1,zb],[s*wx(y1),y1,za],shade(k,0.92+0.08*i/n)); } };
  for(const s of [-1,1]) for(let z=zR;z<zF-0.01;z+=pitch){ const zb=Math.min(zF,z+pitch), zc=(z+zb)/2;
    panel(s,z,zb,fl,wyc-wh,wall); panel(s,z,zb,wyc+wh,yC,wall);
    panel(s,z,zc-ww,wyc-wh,wyc+wh,wall); panel(s,zc+ww,zb,wyc-wh,wyc+wh,wall);
    // cadre du hublot
    box(s*wx(wyc)-0.02*s,s*wx(wyc)-0.05*s,wyc-wh-0.03,wyc-wh,zc-ww,zc+ww,[0.6,0.6,0.62]); }
  // plafond, rampe lumineuse, coffres à bagages
  quad([-wx(yC),yC,zR],[wx(yC),yC,zR],[wx(yC),yC,zF],[-wx(yC),yC,zF],ceil);
  quad([-0.25,yC-0.01,zR],[0.25,yC-0.01,zR],[0.25,yC-0.01,zF],[-0.25,yC-0.01,zF],[1,1,0.96]);
  if(Ri>1.3) for(const s of [-1,1]){ const xo=s*wx(yC-0.25), xi=xo-s*0.6; box(Math.min(xo,xi),Math.max(xo,xi),yC-0.48,yC,zR,zF,binC); }
  // cloisons avant / arrière
  quad([-Ri,fl,zR],[Ri,fl,zR],[Ri,yC,zR],[-Ri,yC,zR],[0.55,0.52,0.5]);
  quad([-Ri,fl,zF],[Ri,fl,zF],[Ri,yC,zF],[-Ri,yC,zF],[0.62,0.6,0.58]);
  const seats=[], info={rows:0, abreast:0};
  if(!cargo){
    const leg=ac.flight&&ac.flight.legs[ac.flight.li], pax=(leg&&leg.pax)||{f:0,j:0,w:0,y:0};
    const groups=R<1.0?[1,1]:R<1.5?[2,2]:R<2.3?[3,3]:R<3.2?[3,3,3]:[3,4,3], prem=pax.f+pax.j>0;
    const bGroups=groups.length===2?groups.map(g=>Math.max(1,g-1)):groups.map(g=>Math.max(1,g-1));
    const mf=typeof flightManifest==='function'?flightManifest(ac):null, bySeat={};
    if(mf&&mf.rows) for(const r of mf.rows) bySeat[r.seat]=r;
    let rnd=seeded?seeded(hashS(ac.id+'cab')):Math.random;
    const totalSeats=m.seats||150, occ=Math.min(1,((pax.f+pax.j+pax.w+pax.y)||totalSeats*0.8)/totalSeats);
    let z=zF-0.9, row=1;
    const layRow=(gs,sw,pitchR,cls)=>{
      const aisles=gs.length-1, W=gs.reduce((a,b)=>a+b,0)*sw+aisles*0.5; let x=-W/2, letter=0;
      const seatK=cls==='j'?[0.55,0.42,0.3]:[0.13,0.2,0.42];
      gs.forEach((g,gi)=>{ for(let i=0;i<g;i++){ const xc=x+sw/2, L_='ABCDEFGHJK'[letter++]; const seatId=`${(cls==='j'?1:20)+row-1}${L_}`;
          box(xc-sw/2+0.03,xc+sw/2-0.03,fl+0.38,fl+0.5,z-0.28,z+0.2,seatK);                    // assise
          box(xc-sw/2+0.03,xc+sw/2-0.03,fl+0.45,fl+1.18,z-0.34,z-0.24,seatK);                  // dossier
          box(xc-sw/2+0.07,xc+sw/2-0.07,fl+1.0,fl+1.16,z-0.24,z-0.22,[0.95,0.95,0.95]);       // têtière
          box(xc+sw/2-0.04,xc+sw/2-0.01,fl+0.55,fl+0.62,z-0.25,z+0.15,[0.2,0.2,0.22]);        // accoudoir
          const known=bySeat[seatId], here=known|| (rnd()<occ);
          if(here){ const reg=known&&COUNTRIES[known.nat]?COUNTRIES[known.nat][1]:pickR(rnd,['AF','AF','EU','AS','NA']);
            const skin=pickR(rnd,SKIN[reg]||SKIN.EU), shirt=pickR(rnd,SHIRT), hair=pickR(rnd,HAIR), F=known?known.F:rnd()<0.5, kid=known&&known.age<13, sc=kid?0.78:1;
            const pants=pickR(rnd,[[0.12,0.14,0.22],[0.2,0.2,0.22],[0.45,0.38,0.28],[0.1,0.25,0.45]]);
            box(xc-0.16*sc,xc+0.16*sc,fl+0.5,fl+0.5+0.52*sc,z-0.22,z-0.02,shirt);                 // buste
            box(xc-0.15*sc,xc+0.15*sc,fl+0.46,fl+0.58,z-0.05,z+0.36,pants);                       // cuisses
            box(xc-0.14*sc,xc+0.14*sc,fl+0.02,fl+0.5,z+0.3,z+0.42,pants);                         // jambes
            box(xc-0.2*sc,xc-0.13*sc,fl+0.72,fl+0.98,z-0.16,z+0.1,shirt); box(xc+0.13*sc,xc+0.2*sc,fl+0.72,fl+0.98,z-0.16,z+0.1,shirt); // bras
            const hy=fl+0.5+0.55*sc, hs=0.1*sc;
            box(xc-hs,xc+hs,hy,hy+0.24*sc,z-0.17,z+0.03,skin);                                     // tête
            box(xc-0.055*sc,xc-0.025*sc,hy+0.13*sc,hy+0.16*sc,z+0.03,z+0.035,[0.05,0.05,0.05]);   // yeux
            box(xc+0.025*sc,xc+0.055*sc,hy+0.13*sc,hy+0.16*sc,z+0.03,z+0.035,[0.05,0.05,0.05]);
            box(xc-hs-0.01,xc+hs+0.01,hy+0.2*sc,hy+0.27*sc,z-0.19,z+0.03,hair);                     // cheveux
            if(F) box(xc-hs-0.015,xc+hs+0.015,hy-0.08,hy+0.22*sc,z-0.21,z-0.13,hair);
            if(known) seats.push({seat:seatId,r:known,z}); }
          x+=sw; }
        x+=0.5; });
      z-=pitchR; row++; };
    const nB=prem? Math.min(Math.ceil((pax.f+pax.j)/bGroups.reduce((a,b)=>a+b,0)), 6) : 0;
    for(let i=0;i<nB&&z>zR+1;i++) layRow(bGroups,0.62,1.2,'j');
    row=1; if(nB) z-=0.6;
    let n=0; while(z>zR+0.8&&n<30){ layRow(groups,0.46,0.81,'y'); n++; }
    if(z>zR+0.8) quad([-Ri,fl,z-0.2],[Ri,fl,z-0.2],[Ri,yC,z-0.2],[-Ri,yC,z-0.2],[0.3,0.32,0.45]);   // rideau de séparation
    info.rows=row-1; info.abreast=groups.reduce((a,b)=>a+b,0);
  }
  // GLB binaire (pas de base64 : léger et rapide à charger)
  const P=new Float32Array(pos), Cc=new Uint8Array(col.map(v=>Math.max(0,Math.min(255,Math.round(v*255))))), I=new Uint32Array(idx);
  const mn=[Infinity,Infinity,Infinity], mx=[-Infinity,-Infinity,-Infinity]; for(let i=0;i<P.length;i++){ mn[i%3]=Math.min(mn[i%3],P[i]); mx[i%3]=Math.max(mx[i%3],P[i]); }
  const chunks=[], views=[]; let off=0;
  for(const [arr,target] of [[P,34962],[Cc,34962],[I,34963]]){ const b=new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength), pad=(4-b.length%4)%4; views.push({buffer:0,byteOffset:off,byteLength:b.length,target}); chunks.push(b); if(pad) chunks.push(new Uint8Array(pad)); off+=b.length+pad; }
  const gltf={asset:{version:'2.0'},extensionsUsed:['KHR_materials_unlit'],scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],
    meshes:[{primitives:[{attributes:{POSITION:0,COLOR_0:1},indices:2,material:0}]}],
    materials:[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:1},extensions:{KHR_materials_unlit:{}},doubleSided:true}],
    accessors:[{bufferView:0,componentType:5126,count:P.length/3,type:'VEC3',min:mn,max:mx},{bufferView:1,componentType:5121,normalized:true,count:Cc.length/3,type:'VEC3'},{bufferView:2,componentType:5125,count:I.length,type:'SCALAR'}],
    bufferViews:views, buffers:[{byteLength:off}]};
  let js=new TextEncoder().encode(JSON.stringify(gltf)); const jp=(4-js.length%4)%4; if(jp){ const t=new Uint8Array(js.length+jp); t.set(js); t.fill(32,js.length); js=t; }
  const total=12+8+js.length+8+off, glb=new Uint8Array(total), dv=new DataView(glb.buffer);
  dv.setUint32(0,0x46546C67,true); dv.setUint32(4,2,true); dv.setUint32(8,total,true);
  dv.setUint32(12,js.length,true); dv.setUint32(16,0x4E4F534A,true); glb.set(js,20);
  let o=20+js.length; dv.setUint32(o,off,true); dv.setUint32(o+4,0x004E4942,true); o+=8; for(const c of chunks){ glb.set(c,o); o+=c.length; }
  if(FX._cabUrl) URL.revokeObjectURL(FX._cabUrl);
  const url=FX._cabUrl=URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}));
  return {uri:url, bytes:total, fl, zF, zR, seats, info, cargo};
}
const pickR=(rnd,a)=>a[Math.floor(rnd()*a.length)];
function fxCabinOn(ac){
  const C=Cesium, V=G.viewer, mi=modelInfo(modelOf(ac),liveryOf(ac));
  if(FX.cabin&&FX.cabinFor===ac.id) return;
  fxCabinOff();
  const cb=cabinBuild(ac,mi); FX.cabinInfo=cb; FX.cabinFor=ac.id;
  let pose=null, at=-1; const P=()=>{ const n=performance.now(); if(n!==at){ pose=acPose(ac); at=n; } return pose; };
  FX.cabin=V.entities.add({position:new C.CallbackProperty(()=>{ const p=P(); return p&&p.pos; },false), orientation:new C.CallbackProperty(()=>{ const p=P(); return p&&p.q; },false),
    model:{uri:cb.uri, scale:1, minimumPixelSize:0, shadows:C.ShadowMode.DISABLED}});
  FX.near=V.camera.frustum.near; V.camera.frustum.near=0.05;
  document.body.classList.add('cabin-on');
  renderCabinPanel(ac);
}
function fxCabinOff(){
  if(!G) return;
  if(FX.cabin){ G.viewer.entities.remove(FX.cabin); FX.cabin=null; FX.cabinFor=null; }
  if(FX.near!==undefined){ G.viewer.camera.frustum.near=FX.near; FX.near=undefined; }
  document.body.classList.remove('cabin-on'); const pnl=document.getElementById('cabinPanel'); if(pnl) pnl.remove();
}
function renderCabinPanel(ac){
  let el=document.getElementById('cabinPanel'); if(!el){ el=document.createElement('div'); el.id='cabinPanel'; $('#main').appendChild(el); }
  const cb=FX.cabinInfo; if(!cb) return;
  if(cb.cargo){ el.innerHTML=`<b>📦 Vol cargo</b><div class="small">Pas de passagers : la soute est pleine de fret.</div>`; return; }
  const list=cb.seats.slice().sort((a,b)=>b.z-a.z).slice(0,6);
  const moodI=r=>r.mood==='énervé(e)'?'😠':r.mood==='ravi(e)'?'😄':r.mood==='impatient(e)'?'😬':'🙂';
  el.innerHTML=`<div class="cp-h"><b>👥 Cabine</b> <span class="mut small">${cb.info.rows} rangs · ${cb.info.abreast} de front</span></div>
    ${list.map(s=>`<div class="cp-r" data-act="paxCard" data-id="${ac.id}" data-i="${s.r.i}"><span class="cp-av">${s.r.avatar||'🧑'}</span><span class="grow"><b>${esc(s.r.first)} ${esc(s.r.last)}</b> <span class="mut">${s.seat}</span><br><small>${esc(s.r.job)} · ${moodI(s.r)}</small></span></div>`).join('')}
    <button class="btn sm" data-act="manifest" data-id="${ac.id}">📋 Tous les passagers</button>`;
}

/* =========================================================
   CAMÉRAS : cabine et auto (bord de piste)
   ========================================================= */
function fxCamera(ac,p,c){
  const C=Cesium, cam=G.viewer.camera;
  const unzoom=()=>{ if(FX.zoomed){ cam.frustum.fov=C.Math.toRadians(60); FX.zoomed=false; } };
  if(c.mode!=='auto') unzoom();
  if(c.mode==='cabin'){
    fxCabinOn(ac); const cb=FX.cabinInfo; if(!cb) return false;
    const aisleX=(cb.info.abreast===9?0.96:cb.info.abreast===10?1.15:0)*(c.side||1);
    const eye=fxLocal(p,aisleX,cb.fl+1.58,cb.zF-0.35);
    cam.lookAtTransform(C.Matrix4.IDENTITY);
    cam.setView({destination:eye, orientation:{heading:C.Math.toRadians(p.st.hdg+180+c.h), pitch:C.Math.toRadians(c.p-(p.a.pitch||0)), roll:C.Math.toRadians(-(p.a.bank||0))}});
    return true;
  }
  if(FX.cabin) fxCabinOff();
  if(c.mode!=='auto') return false;
  const st=p.st, ph=st.phase;
  const spotPhase=ph===2||ph===7||(ph===6&&st.alt<260)||(ph===3&&st.alt<180);
  if(spotPhase){
    const leg=st.leg, path=legPath(leg,modelOf(ac)), rw=(ph===2||ph===3)?path.dep:path.arr;
    if(rw){
      const key=(ph<=3?'d':'a')+leg.from+leg.to+leg.dep;
      if(!FX.spot||FX.spot.key!==key){ const along=(ph<=3?0.62:0.28)*rw.len/1000, q=destPt(rw.thr.lat,rw.thr.lon,rw.hdg,along), s=destPt(q.lat,q.lon,rw.hdg+90,0.16);
        FX.spot={key, pos:C.Cartesian3.fromDegrees(s.lon,s.lat,14)}; }
      const dir=C.Cartesian3.normalize(C.Cartesian3.subtract(p.pos,FX.spot.pos,new C.Cartesian3()),new C.Cartesian3());
      const up=C.Ellipsoid.WGS84.geodeticSurfaceNormal(FX.spot.pos,new C.Cartesian3());
      const right=C.Cartesian3.normalize(C.Cartesian3.cross(dir,up,new C.Cartesian3()),new C.Cartesian3()), up2=C.Cartesian3.cross(right,dir,new C.Cartesian3());
      const dist=C.Cartesian3.distance(p.pos,FX.spot.pos);
      cam.lookAtTransform(C.Matrix4.IDENTITY);
      cam.setView({destination:FX.spot.pos, orientation:{direction:dir, up:up2}});
      cam.frustum.fov=C.Math.toRadians(clamp(60*120/Math.max(120,dist),9,60));   // zoom comme une caméra de télévision
      FX.zoomed=true;
      return true;
    }
  }
  if(FX.zoomed){ cam.frustum.fov=C.Math.toRadians(60); FX.zoomed=false; }
  cam.lookAt(p.pos, new C.HeadingPitchRange(C.Math.toRadians(st.hdg+c.h), C.Math.toRadians(c.p), c.range*((ph===1||ph===8)?1.12:1)));
  return true;
}

/* =========================================================
   FEUX, FUMÉE, SON
   ========================================================= */
function puffImage(){
  if(FX._puff) return FX._puff; const cv=document.createElement('canvas'); cv.width=cv.height=64; const g=cv.getContext('2d');
  const gr=g.createRadialGradient(32,32,2,32,32,30); gr.addColorStop(0,'rgba(235,235,235,0.9)'); gr.addColorStop(0.6,'rgba(210,210,210,0.45)'); gr.addColorStop(1,'rgba(200,200,200,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64); return FX._puff=cv;
}
function fxTick(ac,p){
  const C=Cesium, V=G.viewer, now=performance.now(), mi=p.mi, st=p.st, inside=G.cam.mode==='cabin'||G.cam.mode==='cockpit';
  // --- feux de l'avion ---
  if(!FX.lights) FX.lights=V.scene.primitives.add(new C.PointPrimitiveCollection());
  const Lc=FX.lights; Lc.show=!inside;
  if(G.apNear){ for(const e of G.apNear.ents) e.show=!inside; }
  if(!inside){
    if(Lc.length===0){ for(let i=0;i<7;i++) Lc.add({pixelSize:6,color:C.Color.WHITE,scaleByDistance:new C.NearFarScalar(30,2.2,6000,0.6)}); }
    const half=mi.span/2*0.97, zw=-mi.L*0.06, yw=-mi.R*0.45, night=G.viewer.scene.globe.enableLighting&&!G.forceDay&&sunElevAt(st.lat,st.lon)<0;
    const set=(i,x,y,z,color,size,show)=>{ const pt=Lc.get(i); pt.position=fxLocal(p,x,y,z); pt.color=color; pt.pixelSize=size; pt.show=show; };
    const blink=(now%1100)<70, beacon=(now%1000)<120;
    set(0,-half,yw,zw,C.Color.RED,night?7:5,true);
    set(1,half,yw,zw,C.Color.LIME,night?7:5,true);
    set(2,-half,yw,zw-0.4,C.Color.WHITE,night?13:9,blink);
    set(3,half,yw,zw-0.4,C.Color.WHITE,night?13:9,blink);
    set(4,0,mi.R*1.02,0,C.Color.RED,night?9:6,beacon);
    set(5,0,-mi.R*1.02,-mi.L*0.1,C.Color.RED,night?9:6,!beacon&&(now%1000)<240);
    set(6,mi.R*0.9,-mi.R*0.6,mi.L*0.05,C.Color.fromCssColorString('#fffbe6').withAlpha(0.95),night?26:12,st.alt<3000&&st.phase>=1&&st.phase<=7);
  }
  // --- fumée des pneus au toucher ---
  const air=st.alt>0.6;
  if(FX.wasAir===true&&!air&&st.phase===7){
    if(!FX.smoke) FX.smoke=V.scene.primitives.add(new C.BillboardCollection());
    for(const sx of [-1,1]) for(let i=0;i<5;i++) FX.puffs.push({b:FX.smoke.add({image:puffImage(), position:fxLocal(p,sx*mi.R*1.1,-(mi.R+mi.gH)+0.5,-mi.L*0.04-i*1.5), scale:0.4, color:C.Color.WHITE.withAlpha(0.85)}), t0:now+i*60, s:0.4+Math.random()*0.3});
  }
  FX.wasAir=air;
  if(FX.puffs.length){ FX.puffs=FX.puffs.filter(u=>{ const age=(now-u.t0)/1000; if(age>3.2){ FX.smoke.remove(u.b); return false; } if(age>0){ u.b.scale=u.s+age*1.6; u.b.color=C.Color.WHITE.withAlpha(Math.max(0,0.85-age*0.27)); } return true; }); }
  // --- son ---
  if(FX.soundOn) fxSound(st,inside);
  if(G.cam.mode==='cabin'&&(!FX.cpAt||now-FX.cpAt>4000)){ FX.cpAt=now; renderCabinPanel(ac); }
}
function sunElevAt(lat,lon){ if(typeof sunElev==='function') return sunElev(lat,lon,G.forceDay?fxNoon(lon):S.time); const t=new Date(G.forceDay?fxNoon(lon):S.time), h=t.getUTCHours()+t.getUTCMinutes()/60+lon/15; return 60*Math.cos((h-12)/12*Math.PI); }
function fxNoon(lon){ const d=new Date(S.time); d.setUTCHours(12,0,0,0); return d.getTime()-lon/15*HOUR; }

/* ---------- son des moteurs (bruit filtré, sans fichier audio) ---------- */
function fxSoundInit(){
  const A=window.AudioContext||window.webkitAudioContext; if(!A) return null;
  const ctx=new A(), len=ctx.sampleRate*2, buf=ctx.createBuffer(1,len,ctx.sampleRate), d=buf.getChannelData(0);
  let last=0; for(let i=0;i<len;i++){ const w=Math.random()*2-1; last=(last+0.02*w)/1.02; d[i]=last*3.5; }   // bruit brun
  const src=ctx.createBufferSource(); src.buffer=buf; src.loop=true;
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=500;
  const gain=ctx.createGain(); gain.gain.value=0;
  const whine=ctx.createOscillator(); whine.type='sine'; whine.frequency.value=2400; const wg=ctx.createGain(); wg.gain.value=0;
  src.connect(lp); lp.connect(gain); whine.connect(wg); wg.connect(gain); gain.connect(ctx.destination); src.start(); whine.start();
  return {ctx,lp,gain,whine,wg};
}
function fxSound(st,inside){
  const s=FX.sound; if(!s) return; const t=s.ctx.currentTime, ph=st.phase;
  const thrust= ph===2?1 : ph===3?0.8 : ph===4?0.45 : ph===5?0.25 : ph===6?0.4 : ph===7?(st.alt<0.6&&st.spd>90?0.85:0.35) : ph===1||ph===8?0.3 : 0.12;
  const muff=inside?0.55:1;
  s.gain.gain.setTargetAtTime(0.06+thrust*0.55*muff,t,0.6);
  s.lp.frequency.setTargetAtTime((inside?220:320)+thrust*(inside?500:1300),t,0.6);
  s.whine.frequency.setTargetAtTime(1800+thrust*1500,t,0.8);
  s.wg.gain.setTargetAtTime(inside?0.004:0.012*thrust,t,0.6);
}
function fxToggleSound(){
  FX.soundOn=!FX.soundOn;
  if(FX.soundOn){ if(!FX.sound) FX.sound=fxSoundInit(); if(FX.sound&&FX.sound.ctx.state==='suspended') FX.sound.ctx.resume(); if(!FX.sound) toast('Son non disponible sur ce navigateur','bad'); }
  else if(FX.sound){ FX.sound.gain.gain.setTargetAtTime(0,FX.sound.ctx.currentTime,0.2); }
  renderGlobeHud();
}
function fxClear(){
  fxCabinOff();
  if(FX.lights){ FX.lights.removeAll(); }
  if(FX.smoke){ FX.smoke.removeAll(); FX.puffs=[]; }
  FX.spot=null; FX.wasAir=null;
  if(FX.zoomed&&G){ G.viewer.camera.frustum.fov=Cesium.Math.toRadians(60); FX.zoomed=false; }
  if(FX.sound&&FX.soundOn){ FX.soundOn=false; FX.sound.gain.gain.setTargetAtTime(0,FX.sound.ctx.currentTime,0.2); }
}
