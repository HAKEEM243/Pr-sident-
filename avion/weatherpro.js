/* =========================================================
   Sky Empire — 🌦️ météo réaliste en 3D, branchée sur la météo du jeu
   • près des aéroports : vent, rafales, visibilité et orage de la tour
     (towerWx) ; en route : cellules orageuses du jeu (stormAt) et
     averses sous les ciels très couverts ;
   • pluie qui tombe vraiment vers le sol, poussée par le vent (de biais),
     plus ou moins dense selon l'intensité : averse, pluie, déluge d'orage ;
   • orage : ciel très sombre, éclairs à l'intérieur des nuages
     (le cumulonimbus s'illumine), tonnerre qui roule ;
   • brouillard / brume selon la visibilité annoncée ;
   • manches à air au bord des pistes : orientées selon le vent, gonflées
     par vent fort, pendantes par vent calme.
   ========================================================= */
'use strict';
const WP={cur:{rain:0,storm:false,we:0,wn:0,vis:10000}, at:0, fl:null, flImg:null};
function wpHash(a){ let h=(a*2654435761)>>>0; h^=h>>>15; return (h%10000)/10000; }
function wpCompute(st){
  const o={rain:0,storm:false,we:0,wn:0,vis:10000}; if(!st) return o;
  const code=st.phase<=3?st.from:st.phase>=6?st.to:null, A=code&&AP(code), near=A&&gcDist(A,st)<70&&(st.alt||0)<4500;
  const w=near&&typeof wndWx==='function'?wndWx(code):null, cell=typeof stormAt==='function'?stormAt(st.lat,st.lon):null;
  if(w){ const ms=w.spd*0.514, d=w.dir*Math.PI/180; o.we=-Math.sin(d)*ms; o.wn=-Math.cos(d)*ms; o.vis=w.vis; if(w.gust){ const g=(w.gust-w.spd)*0.514*(0.5+0.5*Math.sin(performance.now()/2300)); o.we+=-Math.sin(d)*g; o.wn+=-Math.cos(d)*g; } }
  o.storm=!!(cell||(w&&w.st)); if(typeof clMode==='function'&&clMode()==='storm') o.storm=true;
  if(o.storm) o.rain=1;
  else { let showers=0; try{ const cov=typeof clCover==='function'?clCover(st.lat,st.lon):0, day=Math.floor(S.time/DAY), hr=Math.floor(S.time/HOUR);
      if(cov>0.88&&wpHash(Math.floor(st.lat/2)*977+Math.floor(st.lon/2)*131+day*7+Math.floor(hr/3))<0.35) showers=0.4; }catch(e){}
    o.rain=Math.max(showers,o.vis<2500?0.6:o.vis<5000?0.35:0); }
  if(typeof clMode==='function'&&clMode()==='none') o.rain=o.storm?o.rain:0;
  return o;
}
// éclair dans le nuage : halo blanc qui s'allume deux fois au cœur d'un cumulonimbus
function wpFlashImg(){ if(WP.flImg) return WP.flImg; const cv=document.createElement('canvas'); cv.width=cv.height=128; const g=cv.getContext('2d'), gr=g.createRadialGradient(64,64,4,64,64,64);
  gr.addColorStop(0,'rgba(240,244,255,0.95)'); gr.addColorStop(0.35,'rgba(200,215,255,0.5)'); gr.addColorStop(1,'rgba(180,200,255,0)'); g.fillStyle=gr; g.fillRect(0,0,128,128); return WP.flImg=cv; }
function wpCloudFlash(c){
  const C=Cesium, V=G.viewer; if(!WP.fl||WP.flV!==V){ WP.fl=V.scene.primitives.add(new C.BillboardCollection()); WP.flV=V; WP.flB=WP.fl.add({image:wpFlashImg(), position:C.Cartesian3.ZERO, width:6000, height:5000, sizeInMeters:true, show:false}); }
  const q=destPt(c.lat,c.lon,Math.random()*360,4+Math.random()*18), gr=typeof groundAt==='function'?Math.max(0,groundAt(q.lat,q.lon)):0, b=WP.flB;
  b.position=C.Cartesian3.fromDegrees(q.lon,q.lat,gr+3000+Math.random()*5000); const s=4000+Math.random()*6000; b.width=s; b.height=s*0.8;
  const on=a=>{ b.color=C.Color.WHITE.withAlpha(a); b.show=true; }, off=()=>{ b.show=false; };
  on(0.9); setTimeout(off,90); setTimeout(()=>on(0.6),160); setTimeout(off,260); if(Math.random()<0.5){ setTimeout(()=>on(0.75),420); setTimeout(off,520); }
  const d=gcDist(c,q); if(typeof fxBurst==='function'&&Math.random()<0.6) setTimeout(()=>{ try{ fxBurst('thunder'); }catch(e){} },Math.min(7000,d*1000/0.343));
}
function wpTick(){
  if(typeof G==='undefined'||!G||!G.viewer) return; const host=document.getElementById('globe'); if(!host||host.hidden) return;
  const f=G.follow&&S.fleet.find(a=>a.id===G.follow), st=f&&f.flight&&flightState(f); WP.cur=wpCompute(st);
  const sc=G.viewer.scene, now=performance.now(), cp=G.viewer.camera.positionCartographic, camH=cp?cp.height:0;
  // pluie : densité selon l'intensité
  if(FX&&FX.rain){ const em=(typeof GQ!=='undefined'&&GQ.hq?1:GQ.mob?0.3:0.5)*(WP.cur.storm?1100:250+WP.cur.rain*700); if(Math.abs((FX.rain.emissionRate||0)-em)>20) FX.rain.emissionRate=em;
    // vitesse des gouttes (repère terrestre) calculée une fois ici : vers le sol + vent (amplifié pour que la pente se voie)
    const C=Cesium, P=G.viewer.camera.positionWC, up=C.Cartesian3.normalize(P,new C.Cartesian3()), lon=Math.atan2(P.y,P.x), E=new C.Cartesian3(-Math.sin(lon),Math.cos(lon),0), N=C.Cartesian3.cross(up,E,new C.Cartesian3());
    const v=WP.cur.storm?165:130, we=WP.cur.we*2.2, wn=WP.cur.wn*2.2; WP.vel={x:-up.x*v+E.x*we+N.x*wn, y:-up.y*v+E.y*we+N.y*wn, z:-up.z*v+E.z*we+N.z*wn};
    if(!FX.rain._wp){ FX.rain._wp=true; FX.rain.updateCallback=(pt,dt)=>{ const p=pt.position, w=WP.vel; if(!w) return; p.x+=w.x*dt; p.y+=w.y*dt; p.z+=w.z*dt; }; }
  }
  // orage : éclairs dans les nuages (plus fréquents que les éclairs au sol)
  if(WP.cur.storm&&camH<16000&&now>(WP.flNext||0)&&(typeof P3==='undefined'||P3.lvl<3)){ WP.flNext=now+1500+Math.random()*4500;
    const c=st?{lat:st.lat,lon:st.lon}:null; if(c) try{ wpCloudFlash(c); }catch(e){} }
  if(WP.flB&&!WP.cur.storm&&WP.flB.show) WP.flB.show=false;
}
/* ---------- manches à air ---------- */
const M_SOCKPOLE=()=>{ const g=C3('#e5e7eb'), d=C3('#4b5563'); return [[-0.6,0.6,0,0.3,-0.6,0.6,d],[-0.07,0.07,0.3,6.2,-0.07,0.07,g],[-0.5,0.5,5.9,6.0,-0.05,0.05,g]]; };
const M_SOCK=()=>{ const o=C3('#f97316'), w=C3('#f8fafc'), b=[]; for(let k=0;k<5;k++){ const r=0.5-k*0.07; b.push([-r,r,-r,r,k*0.75,k*0.75+0.75,k%2?w:o]); } return b; };
function windsockEntity(code,r,W){
  if(typeof apModel!=='function'||(typeof GQ!=='undefined'&&GQ.mob&&!GQ.hq)) return []; const C=Cesium, V=G.viewer, EL=typeof gElev==='function'?gElev(code):0, out=[];
  for(const [a,side] of [[300,1],[r.len-300,-1]]){ const q=destPt(r.thr.lat,r.thr.lon,r.hdg,a/1000), s=destPt(q.lat,q.lon,r.hdg+90*side,(W/2+80)/1000);
    const base=C.Cartesian3.fromDegrees(s.lon,s.lat,EL+0.1), top=C.Cartesian3.fromDegrees(s.lon,s.lat,EL+5.95);
    out.push(V.entities.add({position:base, model:{uri:apModel('sockpole',M_SOCKPOLE), minimumPixelSize:0, distanceDisplayCondition:new C.DistanceDisplayCondition(0,6000)}}));
    const ori=new C.CallbackProperty(()=>{ const w=typeof wndWx==='function'?wndWx(code):null, spd=w?w.spd:5, dir=w?w.dir:0, t=performance.now()/1000;
        const flap=Math.sin(t*(2+spd*0.25)+a)*(3+spd*0.4), gu=w&&w.gust?Math.sin(t*0.7+a)*0.5+0.5:0;
        const droop=-Math.max(0,1-(spd+gu*((w&&w.gust||spd)-spd))/15)*70;
        return C.Transforms.headingPitchRollQuaternion(top,new C.HeadingPitchRoll(C.Math.toRadians(dir+180+flap-90),C.Math.toRadians(droop),0)); },false);
    out.push(V.entities.add({position:top, orientation:ori, model:{uri:apModel('sock',M_SOCK), minimumPixelSize:0, distanceDisplayCondition:new C.DistanceDisplayCondition(0,6000)}})); }
  if(typeof apLit==='function') out.forEach(e=>apLit(e));
  return out;
}
function wpHook(){ if(wpHook.done) return; wpHook.done=true;
  // 📱 téléphone : pluie et orage allégés (sinon iOS coupe la 3D) — pas de traits de pluie CSS par-dessus la 3D,
  // éclairs sans géométrie 3D (flash + tonnerre seulement), moins de nuages d'orage
  const mob=typeof GQ!=='undefined'&&GQ.mob&&!GQ.hq;
  if(mob&&typeof wxOverlay==='function'){ const _o=wxOverlay; wxOverlay=function(on,storm,spd,inside){ return _o.call(this,on&&!!inside,false,spd,inside); }; }
  if(mob&&typeof wxBolt==='function'){ wxBolt=function(c){ const d=3+Math.random()*14; try{ wpCloudFlash(c); }catch(e){}
      const f=document.createElement('div'); f.className='bolt2'; f.style.setProperty('--a',String(Math.max(0.15,0.55-d*0.03))); (document.getElementById('globe')||document.body).appendChild(f); setTimeout(()=>f.remove(),450); }; }
  if(mob&&typeof clSpawn==='function'){ const _c=clSpawn; clSpawn=function(c){ const st=(typeof clMode==='function'&&clMode()==='storm')||(typeof stormAt==='function'&&stormAt(c.lat,c.lon)), old=CL.cap;
      if(st) CL.cap=Math.min(old==null?99:old,12); try{ return _c.apply(this,arguments); } finally{ CL.cap=old; } }; }
  // la pluie suit la météo du jeu (et plus seulement les cellules orageuses)
  if(typeof fxRain==='function'){ const _f=fxRain; fxRain=function(p,on){ const inside=G&&G.cam&&(G.cam.mode==='cabin'||G.cam.mode==='cockpit'); const r=_f.call(this,p,on||(!inside&&WP.cur.rain>0.2));
      try{ if(FX.rain){ const sc=G.viewer.scene, k=WP.cur.storm?1:Math.min(1,WP.cur.rain*1.2);   // ciel plus sombre et brume selon la pluie et la visibilité
        sc.skyAtmosphere.brightnessShift=-0.2-0.38*k; sc.skyAtmosphere.saturationShift=-0.35-0.35*k;
        sc.fog.density=Math.max(0.00025,Math.min(0.0016,0.54/Math.max(600,WP.cur.vis)*(WP.cur.storm?1.6:1))); } }catch(e){}
      return r; }; }
  setInterval(()=>{ try{ wpTick(); }catch(e){ if(!wpHook.w){ wpHook.w=1; console.warn('météo',e); } } },300);
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ wpHook(); }catch(e){ console.warn(e); } },50));
