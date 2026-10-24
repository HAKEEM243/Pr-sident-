/* =========================================================
   Sky Empire — 🎞️ rendu « cinéma » de la vue 3D
   • Étalonnage façon film / console : courbe de contraste douce, couleurs
     plus riches, ombres légèrement bleutées et lumières chaudes, coins
     assombris (vignettage), un soupçon de grain. Un seul passage d'image :
     léger, et coupé automatiquement si le téléphone rame.
   • Soleil dans l'objectif : halo, reflets de lentille et éblouissement
     quand on regarde vers le soleil (aussi au lever et au coucher).
   • Bouton 🎞️ Film : bandes noires de cinéma, caméra automatique qui
     change de plan, et tous les boutons cachés (touchez l'écran pour revenir).
   ========================================================= */
'use strict';
const CINE={on:(()=>{ try{ return localStorage.getItem('se-cine')!=='0'; }catch(e){ return true; } })(), stage:null, viewer:null, film:false, fl:null, t0:performance.now()};
const CINE_FS=`
uniform sampler2D colorTexture;
uniform float k;
uniform float t;
uniform float warm;
in vec2 v_textureCoordinates;
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 uv=v_textureCoordinates;
  vec4 src=texture(colorTexture,uv); vec3 c=src.rgb;
  // courbe de contraste « filmique » (épaule douce dans les lumières)
  c=mix(c,c*c*(3.0-2.0*c),0.32*k);
  float l=dot(c,vec3(0.2126,0.7152,0.0722));
  c=mix(vec3(l),c,1.0+0.16*k);                                   // couleurs plus riches
  c+=k*((1.0-l)*vec3(-0.010,0.004,0.022)+l*vec3(0.030,0.014,-0.018)*warm);   // ombres bleutées, lumières chaudes
  vec2 d=uv-0.5; c*=1.0-k*0.42*dot(d,d)*1.8;                      // vignettage
  c+=k*(hash(uv*1024.0+t)-0.5)*0.018;                              // grain très léger
  out_FragColor=vec4(clamp(c,0.0,1.0),src.a);
}`;
function cineLite(){ return (typeof P3!=='undefined'&&P3.lvl>=2)||(typeof VIS!=='undefined'&&VIS.mode&&VIS.mode!=='off'); }
function cineApply(){
  if(typeof G==='undefined'||!G||!G.viewer||typeof Cesium==='undefined') return; const V=G.viewer, PS=V.scene.postProcessStages, want=CINE.on&&!cineLite();
  if(CINE.stage&&CINE.viewer!==V){ CINE.stage=null; }
  if(want&&!CINE.stage){ try{ CINE.stage=PS.add(new Cesium.PostProcessStage({fragmentShader:CINE_FS, uniforms:{k:()=>CINE.film?1.0:0.8, t:()=>((performance.now()-CINE.t0)/1000)%100, warm:()=>CINE.warm==null?1:CINE.warm}})); CINE.viewer=V; }catch(e){ console.warn('cinéma',e); CINE.on=false; } }
  else if(!want&&CINE.stage){ try{ PS.remove(CINE.stage); }catch(e){} CINE.stage=null; }
}
// --- soleil dans l'objectif ---
function cineFlareEl(){
  if(CINE.fl&&document.body.contains(CINE.fl)) return CINE.fl; const host=document.getElementById('globe'); if(!host) return null;
  const el=document.createElement('div'); el.id='cineFlare'; el.innerHTML='<i class="sun"></i><i class="g1"></i><i class="g2"></i><i class="g3"></i><i class="streak"></i><i class="veil"></i>'; host.appendChild(el); CINE.fl=el;
  if(!document.getElementById('cineCss')){ const st=document.createElement('style'); st.id='cineCss'; st.textContent=`
#cineFlare{position:absolute;inset:0;pointer-events:none;z-index:5;overflow:hidden;opacity:0;transition:opacity .35s;mix-blend-mode:screen}
#cineFlare i{position:absolute;left:0;top:0;border-radius:50%;transform:translate(-50%,-50%)}
#cineFlare .sun{width:46vmin;height:46vmin;background:radial-gradient(circle,rgba(255,250,235,.95) 0,rgba(255,236,190,.55) 7%,rgba(255,210,140,.18) 22%,rgba(255,190,120,0) 55%)}
#cineFlare .streak{width:120vmax;height:2.2vmin;border-radius:50%;background:radial-gradient(ellipse at center,rgba(255,240,215,.55),rgba(255,220,170,0) 70%)}
#cineFlare .g1{width:9vmin;height:9vmin;background:radial-gradient(circle,rgba(120,200,255,0) 45%,rgba(120,200,255,.28) 60%,rgba(120,200,255,0) 72%)}
#cineFlare .g2{width:5vmin;height:5vmin;background:radial-gradient(circle,rgba(255,170,90,.32),rgba(255,170,90,0) 70%)}
#cineFlare .g3{width:16vmin;height:16vmin;background:radial-gradient(circle,rgba(170,255,200,0) 55%,rgba(170,255,200,.16) 66%,rgba(170,255,200,0) 76%)}
#cineFlare .veil{left:50%;top:50%;width:200vmax;height:200vmax;border-radius:0;background:rgba(255,236,200,1);opacity:0}
body.se-film #globeHud>*:not([data-act="cineFilm"]),body.se-film #rfsHud,body.se-film #minimap,body.se-film #radioBox,body.se-film #cabinPanel,body.se-film #detect,body.se-film #contacts,body.se-film .toast{display:none!important}
body.se-film #globeHud [data-act="cineFilm"]{opacity:.55}
#cineBars:before,#cineBars:after{content:"";position:absolute;left:0;right:0;height:0;background:#000;transition:height .8s ease}
#cineBars{position:absolute;inset:0;pointer-events:none;z-index:1050}
#cineBars:before{top:0}#cineBars:after{bottom:0}
body.se-film #cineBars:before,body.se-film #cineBars:after{height:max(9vh,calc((100vh - 100vw/2.39)/2))}
`; document.head.appendChild(st); }
  return el;
}
function cineFlare(){
  const el=cineFlareEl(); if(!el) return; let show=0;
  try{ if(CINE.on&&!cineLite()&&!(typeof VIS!=='undefined'&&VIS.mode!=='off')){ const V=G.viewer, sc=V.scene, us=sc.context&&sc.context.uniformState, sp=us&&us.sunPositionWC, cam=V.camera;
      if(sp&&sc.globe.enableLighting!==false){ const dir=Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(sp,cam.positionWC,new Cesium.Cartesian3()),new Cesium.Cartesian3()), dot=Cesium.Cartesian3.dot(dir,cam.directionWC);
        // le soleil est-il au-dessus de l'horizon pour la caméra ?
        const up=Cesium.Cartesian3.normalize(cam.positionWC,new Cesium.Cartesian3()), el_=Math.asin(Math.max(-1,Math.min(1,Cesium.Cartesian3.dot(dir,up))))*180/Math.PI, h=cam.positionCartographic?cam.positionCartographic.height:0, dip=-Math.sqrt(Math.max(0,2*h/6371000))*180/Math.PI;
        if(dot>0.55&&el_>dip-0.5){ const far=Cesium.Cartesian3.add(cam.positionWC,Cesium.Cartesian3.multiplyByScalar(dir,1e7,new Cesium.Cartesian3()),new Cesium.Cartesian3()), w=Cesium.SceneTransforms.worldToWindowCoordinates?Cesium.SceneTransforms.worldToWindowCoordinates(sc,far):Cesium.SceneTransforms.wgs84ToWindowCoordinates(sc,far);
          if(w){ const W=sc.canvas.clientWidth, H=sc.canvas.clientHeight, cx=W/2, cy=H/2, inside=w.x>-W*0.2&&w.x<W*1.2&&w.y>-H*0.2&&w.y<H*1.2;
            if(inside){ show=Math.min(1,(dot-0.55)/0.3)*Math.min(1,(el_-dip+0.5)/3);
              const pos=(c,f)=>{ c.style.left=(cx+(w.x-cx)*f)+'px'; c.style.top=(cy+(w.y-cy)*f)+'px'; }, q=el.children;
              pos(q[0],1); pos(q[4],1); pos(q[1],-0.35); pos(q[2],-0.75); pos(q[3],0.45);
              const center=1-Math.min(1,Math.hypot(w.x-cx,w.y-cy)/Math.hypot(cx,cy)); q[5].style.opacity=String(0.22*center*center*show);
              // coucher / lever de soleil : lumière plus chaude dans l'étalonnage
              CINE.warm=1+Math.max(0,1-Math.abs(el_)/12)*1.4; } } } }
      else CINE.warm=1; }
  }catch(e){}
  el.style.opacity=String(show.toFixed(2));
}
// --- mode film : bandes noires, caméra auto, boutons cachés ---
function cineFilm(on){
  if(on) toast('🎞️ Mode film : touchez l’écran deux fois pour revenir aux boutons','info');
  CINE.film=on; setTimeout(()=>document.body.classList.toggle('se-film',CINE.film),on?2600:0);
  let b=document.getElementById('cineBars'); if(!b){ const host=document.getElementById('globe'); if(host){ b=document.createElement('div'); b.id='cineBars'; host.parentNode.appendChild(b); } }
  if(on){ try{ if(G&&G.follow&&typeof ACTIONS.globeCam==='function'&&(!G.cam||G.cam.mode!=='auto')){ CINE.prevCam=G.cam&&G.cam.mode; ACTIONS.globeCam({k:'auto'}); } }catch(e){}
    toast('🎞️ Mode film : touchez l’écran deux fois pour revenir aux boutons','info'); }
  else { try{ if(CINE.prevCam&&CINE.prevCam!=='auto') ACTIONS.globeCam({k:CINE.prevCam}); }catch(e){} CINE.prevCam=null; }
}
Object.assign(ACTIONS,{
  cineFilm:()=>{ cineFilm(!CINE.film); if(typeof renderGlobeHud==='function') renderGlobeHud(); },
  cineToggle:()=>{ CINE.on=!CINE.on; try{ localStorage.setItem('se-cine',CINE.on?'1':'0'); }catch(e){} cineApply(); toast(CINE.on?'🎨 Rendu cinéma activé':'🎨 Rendu cinéma coupé','info'); if(typeof renderGlobeHud==='function') renderGlobeHud(); },
});
function cineHook(){ if(cineHook.done) return; cineHook.done=true;
  if(typeof renderGlobeHud==='function'){ const _rh=renderGlobeHud; renderGlobeHud=function(){ const r=_rh.apply(this,arguments); try{ const b=document.getElementById('globeHud'); if(b&&!b.querySelector('[data-act="cineFilm"]')) b.insertAdjacentHTML('afterbegin',`<button class="gh ${CINE.film?'on':''}" data-act="cineFilm" title="Mode film : bandes noires, caméra automatique, sans boutons">🎞️ Film</button><button class="gh ${CINE.on?'on':''}" data-act="cineToggle" title="Rendu cinéma (couleurs, reflets du soleil)">🎨 Ciné</button>`); }catch(e){} return r; }; }
  // en mode film, deux touches sur l'écran font revenir les boutons
  let last=0; document.addEventListener('pointerup',e=>{ if(!CINE.film) return; const now=performance.now(); if(now-last<380){ cineFilm(false); if(typeof renderGlobeHud==='function') renderGlobeHud(); } last=now; },true);
  let raf=0; const loop=()=>{ raf=requestAnimationFrame(loop); if(typeof G==='undefined'||!G||!G.viewer||document.getElementById('globe').hidden){ if(CINE.fl) CINE.fl.style.opacity='0'; if(CINE.film&&(!G||!G.viewer||document.getElementById('globe').hidden)) cineFilm(false); return; } cineFlare(); };
  raf=requestAnimationFrame(loop);
  setInterval(()=>{ try{ cineApply(); }catch(e){} },1000);
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ cineHook(); }catch(e){ console.warn(e); } },0));
