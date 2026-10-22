/* =========================================================
   Sky Empire — ⛈️ pluie et orage en 3D
   • Pluie : en plus des gouttes 3D, des traits de pluie sur tout l'écran
     (inclinés selon la vitesse de l'avion), plus denses sous l'orage,
     et des gouttes qui ruissellent sur le pare-brise en vue cockpit.
   • Orage : vrais éclairs en 3D (zigzag avec ramifications, du nuage au
     sol), à quelques kilomètres ; flash de l'écran selon la distance ;
     tonnerre qui arrive après l'éclair (plus tard si l'éclair est loin) ;
     ciel assombri.
   • Le bouton ☁️ « Orage » déclenche la pluie et les éclairs.
   ========================================================= */
'use strict';
const WX={bolts:[], next:0, el:null};
function wxStorm(){ try{ if(typeof clMode==='function'&&clMode()==='storm') return true; if(typeof CL!=='undefined'&&CL.cov==='orage') return true; }catch(e){} return false; }
function wxRainOn(){ return !!(typeof FX!=='undefined'&&FX.rain); }
// traits de pluie à l'écran
function wxOverlay(on,storm,spd,inside){
  const host=document.getElementById('globe'); if(!host) return;
  if(!WX.el){ WX.el=document.createElement('div'); WX.el.id='rainfx'; WX.el.innerHTML='<i class="r1"></i><i class="r2"></i><i class="drops"></i>'; host.appendChild(WX.el);
    const st=document.createElement('style'); st.textContent=`
#rainfx{position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden;opacity:0;transition:opacity 1.2s}
#rainfx.on{opacity:1}
#rainfx i{position:absolute;inset:-50% -50%;transform:rotate(var(--rot,12deg))}
#rainfx .r1{background-image:repeating-linear-gradient(90deg,transparent 0 13px,rgba(210,225,255,.30) 13px 14px,transparent 14px 37px);background-size:37px 120px;-webkit-mask:repeating-linear-gradient(180deg,#000 0 26px,transparent 26px 70px);mask:repeating-linear-gradient(180deg,#000 0 26px,transparent 26px 70px);animation:rf1 .32s linear infinite}
#rainfx .r2{background-image:repeating-linear-gradient(90deg,transparent 0 21px,rgba(200,215,245,.22) 21px 22px,transparent 22px 53px);background-size:53px 160px;-webkit-mask:repeating-linear-gradient(180deg,#000 0 40px,transparent 40px 110px);mask:repeating-linear-gradient(180deg,#000 0 40px,transparent 40px 110px);animation:rf2 .5s linear infinite;opacity:.8}
#rainfx.light .r2{display:none}
#rainfx .drops{inset:0;transform:none;display:none;background:radial-gradient(circle at 12% 30%,rgba(255,255,255,.35) 0 3px,transparent 4px),radial-gradient(circle at 63% 18%,rgba(255,255,255,.3) 0 2px,transparent 3px),radial-gradient(circle at 80% 62%,rgba(255,255,255,.32) 0 4px,transparent 5px),radial-gradient(circle at 34% 74%,rgba(255,255,255,.28) 0 3px,transparent 4px),radial-gradient(circle at 48% 44%,rgba(255,255,255,.25) 0 2px,transparent 3px);background-size:260px 220px;animation:rfd 2.6s linear infinite}
#rainfx.inside .drops{display:block}
#rainfx.storm{background:rgba(20,26,40,.18)}
@keyframes rf1{from{background-position:0 0}to{background-position:-8px 120px}}
@keyframes rf2{from{background-position:0 0}to{background-position:-10px 160px}}
@keyframes rfd{from{background-position:0 0}to{background-position:0 220px}}
.bolt2{position:absolute;inset:0;z-index:1055;pointer-events:none;background:rgba(225,232,255,var(--a,.6));animation:bolt .42s ease-out forwards}`; document.head.appendChild(st); }
  WX.el.classList.toggle('on',on); WX.el.classList.toggle('storm',on&&storm); WX.el.classList.toggle('light',on&&!storm); WX.el.classList.toggle('inside',on&&inside);
  if(on) WX.el.style.setProperty('--rot',Math.round(Math.min(55,6+(spd||0)/9))+'deg');
}
// éclair 3D : zigzag de la base du nuage au sol, avec deux ramifications
function wxBolt(c){
  const C=Cesium, V=G.viewer, d=3+Math.random()*14, q=destPt(c.lat,c.lon,Math.random()*360,d), gr=typeof groundAt==='function'?Math.max(0,groundAt(q.lat,q.lon)):0;
  const top=gr+2600+Math.random()*1800, pts=[], br=[]; let la=q.lat, lo=q.lon;
  for(let k=0;k<=14;k++){ const h=top-(top-gr)*k/14; pts.push(C.Cartesian3.fromDegrees(lo,la,h)); if(k===4||k===8){ let bl=la, bo=lo; const b=[C.Cartesian3.fromDegrees(lo,la,h)]; for(let j=1;j<=4;j++){ bl+=(Math.random()-0.5)*0.004; bo+=(Math.random()-0.2)*0.005; b.push(C.Cartesian3.fromDegrees(bo,bl,h-j*(top-gr)/22)); } br.push(b); }
    la+=(Math.random()-0.5)*0.0035; lo+=(Math.random()-0.5)*0.0035; }
  const mat=new C.PolylineGlowMaterialProperty({glowPower:0.35,color:C.Color.fromCssColorString('#dbe6ff')});
  const ents=[V.entities.add({polyline:{positions:pts,width:9,material:mat}}),...br.map(b=>V.entities.add({polyline:{positions:b,width:5,material:mat}}))];
  WX.bolts.push({ents,until:performance.now()+260});
  setTimeout(()=>{ for(const e of ents) e.show=false; },110); setTimeout(()=>{ for(const e of ents) e.show=true; },170);
  const f=document.createElement('div'); f.className='bolt2'; f.style.setProperty('--a',String(Math.max(0.18,0.75-d*0.035))); (document.getElementById('globe')||document.body).appendChild(f); setTimeout(()=>f.remove(),450);
  if(typeof fxBurst==='function') setTimeout(()=>{ try{ fxBurst('thunder'); }catch(e){} },Math.min(6000,d*1000/0.343));
}
function wxTick(){
  if(typeof G==='undefined'||!G||!G.viewer||document.getElementById('globe').hidden){ if(WX.el) wxOverlay(false); return; }
  const now=performance.now();
  for(const b of WX.bolts.slice()) if(now>b.until){ for(const e of b.ents) try{ G.viewer.entities.remove(e); }catch(x){} WX.bolts.splice(WX.bolts.indexOf(b),1); }
  const storm=wxStorm(), rain=wxRainOn()||storm, inside=G.cam&&(G.cam.mode==='cockpit'||G.cam.mode==='cabin');
  const f=G.follow&&S.fleet.find(a=>a.id===G.follow), st=f&&f.flight&&flightState(f);
  const cp=G.viewer.camera.positionCartographic, camH=cp?cp.height:0;
  wxOverlay(rain&&camH<9000,storm,st?st.spd:0,inside);
  if(storm&&camH<14000&&now>WX.next&&(typeof P3==='undefined'||P3.lvl<3)){ WX.next=now+3000+Math.random()*7000;
    const c=st?{lat:st.lat,lon:st.lon}:cp?{lat:Cesium.Math.toDegrees(cp.latitude),lon:Cesium.Math.toDegrees(cp.longitude)}:null; if(c) try{ wxBolt(c); }catch(e){ console.warn('éclair',e); } }
}
function wxHook(){ if(wxHook.done) return; wxHook.done=true;
  // le mode « Orage » déclenche la pluie 3D ; l'ancien flash d'écran est remplacé par les vrais éclairs
  if(typeof fxRain==='function'){ const _fr=fxRain; fxRain=function(p,on){ const r=_fr.call(this,p,on||wxStorm()); try{ if(typeof FX!=='undefined') FX.boltAt=performance.now()+1e9; }catch(e){} return r; }; }
  setInterval(()=>{ try{ wxTick(); }catch(e){} },250);
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ wxHook(); }catch(e){ console.warn(e); } },0));
