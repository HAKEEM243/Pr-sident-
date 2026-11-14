/* =========================================================
   Sky Empire — 🌱 sol de l'aéroport (3D)
   • bande d'herbe autour de chaque piste : bandes de tonte, zones sèches,
     prolongements de piste avec chevrons jaunes aux deux bouts ;
   • circulation sur l'aire de trafic : voiture « Follow me », bus
     passagers, tracteur à bagages avec ses chariots, camion-citerne,
     qui roulent sur la voie de service (à droite, feux allumés la nuit).
   ========================================================= */
'use strict';
const GR3D={cache:new Map(), veh:{}, viewer:null};
function grassTexture(W,GW,GL,pad,seed0){
  const cw=256, ch=2048, cv=document.createElement('canvas'); cv.width=cw; cv.height=ch;
  const g=cv.getContext('2d'), sx=cw/GW, sy=ch/GL, X=m=>(m+GW/2)*sx, Y=m=>m*sy;
  let seed=seed0||12345; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
  g.fillStyle='#5d7a3a'; g.fillRect(0,0,cw,ch);
  // bandes de tonte dans le sens de la piste
  for(let x=-GW/2,i=0;x<GW/2;x+=14,i++){ g.fillStyle=i%2?'rgba(255,255,220,0.07)':'rgba(0,30,0,0.08)'; g.fillRect(X(x),0,14*sx+1,ch); }
  // bruit + zones sèches (savane) et plus vertes
  const img=g.getImageData(0,0,cw,ch), d=img.data;
  for(let i=0;i<d.length;i+=4){ const n=(rnd()-0.5)*22; d[i]+=n; d[i+1]+=n*1.1; d[i+2]+=n*0.6; }
  g.putImageData(img,0,0);
  for(let i=0;i<55;i++){ const r=6+rnd()*40; g.fillStyle=rnd()<0.6?`rgba(150,130,70,${0.12+rnd()*0.18})`:`rgba(30,70,20,${0.1+rnd()*0.15})`;
    g.beginPath(); g.ellipse(rnd()*cw,rnd()*ch,r*sx*2,r*sy*3,0,0,Math.PI*2); g.fill(); }
  // accotements stabilisés le long de la piste (gris clair, 7,5 m)
  g.fillStyle='rgba(120,118,108,0.85)'; g.fillRect(X(-W/2-7.5),Y(pad),7.5*sx,Y(GL-2*pad)); g.fillRect(X(W/2),Y(pad),7.5*sx,Y(GL-2*pad));
  // prolongements d'arrêt aux deux bouts : asphalte + chevrons jaunes
  for(const end of [0,1]){ const z0=end?GL-pad:pad-60, z1=z0+60;
    g.fillStyle='#55585e'; g.fillRect(X(-W/2),Y(z0),W*sx,60*sy);
    g.strokeStyle='rgba(250,204,21,0.9)'; g.lineWidth=Math.max(2,1.6*sx);
    for(let k=0;k<3;k++){ const zc=end?z0+12+k*18:z1-12-k*18, dz=end?-W*0.35:W*0.35; g.beginPath(); g.moveTo(X(-W/2+1),Y(zc+dz)); g.lineTo(X(0),Y(zc)); g.lineTo(X(W/2-1),Y(zc+dz)); g.stroke(); } }
  return cv;
}
function grassEntity(code,r,W){
  if(typeof rwyGlb!=='function'||(typeof GQ!=='undefined'&&GQ.mob&&!GQ.hq)) return null;   // téléphone : économise la mémoire
  const C=Cesium, side=120, pad=250, GW=W+2*side, GL=r.len+2*pad, key=code+'|'+r.id+'|'+Math.round(r.len);
  let url=GR3D.cache.get(key);
  if(!url){ url=rwyGlb(grassTexture(W,GW,GL,pad,(r.id||'x').charCodeAt(0)*131+Math.round(r.len)),GW,GL); GR3D.cache.set(key,url); }
  const q=destPt(r.thr.lat,r.thr.lon,r.hdg+180,pad/1000), pos=C.Cartesian3.fromDegrees(q.lon,q.lat,0.12+(typeof gElev==='function'?gElev(code):0));
  const e=G.viewer.entities.add({position:pos, orientation:C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(r.hdg-90),0,0)),
    model:{uri:url, minimumPixelSize:0, shadows:C.ShadowMode.RECEIVE_ONLY, distanceDisplayCondition:new C.DistanceDisplayCondition(0,30000)}});
  return typeof apLit==='function'?apLit(e,'rwy'):e;
}
/* ---------- véhicules de service sur l'aire de trafic ---------- */
const M_FOLLOW=()=>{ const y=C3('#facc15'), k=C3('#111827'), gl=C3('#1f2a3a'), o=C3('#f97316'), w=C3('#0b0f17');
  return [[-0.9,0.9,0.35,0.95,-2.2,2.2,y],[-0.8,0.8,0.95,1.45,-1.2,0.9,y],[-0.82,0.82,1.0,1.4,-1.1,0.8,gl],
    [-0.9,0.9,0.55,0.75,-2.21,2.21,k],[-0.5,0.5,1.45,1.75,-0.4,0.4,k],[-0.45,0.45,1.5,1.7,-0.41,0.41,y],[-0.25,0.25,1.75,1.88,-0.15,0.15,o],
    [-0.96,-0.72,0,0.62,1.1,1.7,w],[0.72,0.96,0,0.62,1.1,1.7,w],[-0.96,-0.72,0,0.62,-1.7,-1.1,w],[0.72,0.96,0,0.62,-1.7,-1.1,w]]; };
const M_APBUS=()=>{ const b=C3('#e5e7eb'), s=C3('#1d4ed8'), g=C3('#1f2a3a'), w=C3('#0b0f17');
  return [[-1.5,1.5,0.35,3.0,-6.8,6.8,b],[-1.52,1.52,1.3,2.6,-6.4,6.4,g],[-1.53,1.53,0.6,0.95,-6.8,6.8,s],[-1.4,1.4,1.2,2.7,6.8,6.85,g],[-1.4,1.4,3.0,3.15,-6.5,6.5,C3('#cbd5e1')],
    [-1.55,-1.2,0,0.8,4.2,5.2,w],[1.2,1.55,0,0.8,4.2,5.2,w],[-1.55,-1.2,0,0.8,-5.2,-4.2,w],[1.2,1.55,0,0.8,-5.2,-4.2,w]]; };
function grTraffic(ac,p){
  if(typeof apronOf!=='function'||typeof apModel!=='function'||typeof rwPt!=='function') return;
  const V=G.viewer; if(GR3D.viewer!==V){ GR3D.veh={}; GR3D.viewer=V; }
  const st=p.st, inside=G.cam&&(G.cam.mode==='cabin'||G.cam.mode==='cockpit'), lite=typeof P3!=='undefined'&&P3.lvl>=3;
  const code=st.phase<=2?st.from:st.phase>=7?st.to:null, used=new Set();
  if(code&&!inside&&!lite&&!(typeof GQ!=='undefined'&&GQ.mob&&!GQ.hq)){ const A=AP(code), ap=apronOf(code), r=ap.rw;
    if(r&&A){ const s=ap.side, big=A.cls>=3, span=Math.round((big?1900:700)*(1+0.1*(A.xp||0))), a0=ap.a-span/2-40, len=span+80, lane=ap.x-s*55, EL=typeof gElev==='function'?gElev(code):0, t=performance.now()/1000;
      const night=typeof AP3D!=='undefined'&&AP3D.night;
      const fleet=[['fm',M_FOLLOW,9,0.1],['bus',M_APBUS,7,0.45],['tug',M_TUG,6,0.7,3],['fuel',M_FUEL,7,0.25],['bus2',M_APBUS,7,0.85]];
      for(const [k,mf,v,ph,carts] of fleet){
        const per=2*len/v, u=((t/per)+ph)%1, fwd=u<0.5, d=fwd?u*2*len:(1-u)*2*len, off=fwd?3.2:-3.2, hd=fwd?r.hdg:r.hdg+180;
        const place=(key,url,dd)=>{ used.add(key); let e=GR3D.veh[key]; if(!e){ e=V.entities.add({position:Cesium.Cartesian3.ZERO, model:{uri:url, minimumPixelSize:0, shadows:Cesium.ShadowMode.CAST_ONLY}, show:false}); if(typeof apLit==='function') apLit(e); GR3D.veh[key]=e; }
          const q=rwPt(r,a0+Math.max(0,Math.min(len,dd)),lane-s*off), pos=Cesium.Cartesian3.fromDegrees(q.lon,q.lat,EL+0.2);
          e.position=pos; e.orientation=Cesium.Transforms.headingPitchRollQuaternion(pos,new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(hd-90),0,0)); e.show=true; };
        place(k,apModel('gv-'+k,mf),d);
        for(let i=0;i<(carts||0);i++) place(k+'c'+i,apModel('cart',M_CART),d+(fwd?-1:1)*(4.6+i*3.4));
        if(night){ const lk=k+'L'; used.add(lk); let e=GR3D.veh[lk]; const q=rwPt(r,a0+Math.max(0,Math.min(len,d+(fwd?3:-3))),lane-s*off);
          if(!e) e=GR3D.veh[lk]=V.entities.add({position:Cesium.Cartesian3.ZERO, point:{pixelSize:5, color:Cesium.Color.fromCssColorString(k==='fm'?'#f97316':'#fff7d6'), disableDepthTestDistance:400}});
          e.position=Cesium.Cartesian3.fromDegrees(q.lon,q.lat,EL+(k==='fm'?1.9:1)); e.point.pixelSize=k==='fm'&&Math.floor(t*3)%2?2:5; e.show=true; } }
    } }
  for(const [k,e] of Object.entries(GR3D.veh)) if(!used.has(k)) e.show=false;
}
function grClear(){ if(GR3D.viewer) for(const e of Object.values(GR3D.veh)) try{ GR3D.viewer.entities.remove(e); }catch(x){} GR3D.veh={}; }
function grHook(){ if(grHook.done||typeof fxTick!=='function') return; grHook.done=true;
  { const _t=fxTick; fxTick=function(ac,p){ const r=_t.apply(this,arguments); try{ grTraffic(ac,p); }catch(e){ if(!grHook.w){ grHook.w=1; console.warn('trafic aire',e); } } return r; }; }
  if(typeof fxClear==='function'){ const _c=fxClear; fxClear=function(){ try{ grClear(); }catch(e){} return _c.apply(this,arguments); }; }
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ grHook(); }catch(e){ console.warn(e); } },0));
