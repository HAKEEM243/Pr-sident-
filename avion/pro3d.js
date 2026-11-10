/* =========================================================
   Sky Empire — 🎛️ finition « pro » de la vue 3D et de l'écran
   1. Tableau de bord 3D rangé : au lieu de 38 boutons en vrac, une barre
      de 7 boutons (Carte, Vue, Temps, Météo, Options, Film, Avion suivant) ;
      chaque bouton ouvre son panneau. Toucher la 3D referme le panneau.
   2. Téléphone : plus rien ne se chevauche. Les deux échelles vertes
      (vitesse, altitude) ne s'affichent qu'en vue cockpit (les mêmes
      chiffres sont dans la barre du bas) ; la radio de la tour passe
      au-dessus de la barre du bas ; la mini-carte est plus petite.
   3. Ombre de l'avion au sol (roulage, décollage, atterrissage) : elle
      suit l'avion, s'éclaircit et s'élargit quand il monte.
   4. Feux de bout d'aile plus fins. Carte 2D : boutons + / − retirés sur
      téléphone (on pince pour zoomer), bandeau d'installation plus discret.
   ========================================================= */
'use strict';
const HUD3={open:null, sh:null, shKey:null, viewer:null};
const HUD3_GROUPS={
  cam:{ic:'🎥',label:'Vue',acts:['globeCam','globeZoom']},
  time:{ic:'⏱️',label:'Temps',acts:['globeTime']},
  wx:{ic:'🌦️',label:'Météo',acts:['globeDay','globeRain','globeClouds','globeSnow','liveRadar']},
  opt:{ic:'⚙️',label:'Options',acts:null},   // tout le reste
};
const HUD3_KEEP=['close3D','cineFilm','globeNext'];
const HUD3_TITLES={cam:'Caméra',time:'Vitesse du temps',wx:'Ciel et météo',opt:'Affichage, son et outils'};
function hud3Css(){ if(document.getElementById('pro3dCss')) return; const st=document.createElement('style'); st.id='pro3dCss'; st.textContent=`
body.globe-follow #globeHud.h3{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;gap:6px;max-width:calc(100% - 12px);padding:5px;border-radius:14px;background:rgba(8,14,26,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(148,163,184,.22)}
#globeHud.h3::-webkit-scrollbar{display:none}
#globeHud.h3>button{flex:0 0 auto;white-space:nowrap}
#globeHud.h3>button.grp.open{background:var(--gold);color:#111;border-color:var(--gold)}
#globeHud.h3>button small{opacity:.8;font-weight:600;margin-left:3px}
#hudPanel{position:absolute;left:8px;right:8px;top:calc(58px + env(safe-area-inset-top));z-index:1061;max-width:560px;background:rgba(8,14,26,.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(148,163,184,.28);border-radius:14px;padding:10px;box-shadow:0 12px 32px rgba(0,0,0,.5)}
#hudPanel[hidden]{display:none}
#hudPanel h4{margin:0 0 8px;font:700 12px system-ui;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8}
#hudPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:6px}
#hudPanel .grid button{white-space:normal;text-align:left;min-height:38px}
body.se-film #hudPanel,body.photo-on #hudPanel,body:not(.globe-follow) #hudPanel{display:none!important}
@media (max-width:820px){
  body.globe-follow:not(.hud-cockpit) #rfsHud .rf-tape{display:none}
  body.globe-follow #radioBox{top:auto!important;bottom:calc(150px + env(safe-area-inset-bottom));max-height:70px}
  #minimap.mm-m #mmMap{width:min(150px,38vw);height:min(84px,11vh)} #minimap.mm-m .mmtitle{max-width:min(150px,38vw)} #minimap .mmbar button{padding:2px 0;font-size:13px}
  body.globe-follow #rfsHud .rf-dest{right:8px;bottom:calc(168px + env(safe-area-inset-bottom));font-size:11px;text-align:right}
  .leaflet-control-zoom{display:none!important}
  #instBar{padding:6px 9px;font-size:12px;border-radius:10px}
}`; document.head.appendChild(st); }
function hud3Regroup(){
  const box=document.getElementById('globeHud'); if(!box||typeof G==='undefined'||!G) return;
  let pan=document.getElementById('hudPanel');
  if(!G.follow){ box.classList.remove('h3'); if(pan) pan.hidden=true; return; }
  hud3Css(); document.body.classList.toggle('hud-cockpit',!!(G.cam&&G.cam.mode==='cockpit'));
  const btns=[...box.querySelectorAll('button')], by={cam:[],time:[],wx:[],opt:[]}, keep={};
  for(const b of btns){ const a=b.dataset.act; if(HUD3_KEEP.includes(a)){ keep[a]=b; continue; }
    const g=Object.keys(HUD3_GROUPS).find(k=>HUD3_GROUPS[k].acts&&HUD3_GROUPS[k].acts.includes(a))||'opt'; by[g].push(b); }
  if(!pan){ pan=document.createElement('div'); pan.id='hudPanel'; pan.hidden=true; box.parentNode.appendChild(pan); }
  // barre principale
  const cur=g=>{ const on=by[g].find(b=>b.classList.contains('on')); if(!on) return ''; const t=on.textContent.trim().replace(/^[^\wÀ-ÿ×]+/u,''); return g==='time'||g==='cam'?`<small>${t}</small>`:''; };
  box.textContent=''; box.classList.add('h3');
  if(keep.close3D) box.appendChild(keep.close3D);
  for(const [k,d] of Object.entries(HUD3_GROUPS)){ if(!by[k].length) continue; const b=document.createElement('button'); b.className='gh grp'+(HUD3.open===k?' open':''); b.dataset.act='hudGrp'; b.dataset.g=k; b.innerHTML=`${d.ic} ${d.label}${cur(k)}`; box.appendChild(b); }
  if(keep.cineFilm) box.appendChild(keep.cineFilm);
  if(keep.globeNext){ keep.globeNext.textContent='⏭ Suivant'; box.appendChild(keep.globeNext); }
  // panneau du groupe ouvert
  if(HUD3.open&&by[HUD3.open]&&by[HUD3.open].length){ pan.innerHTML=`<h4>${HUD3_TITLES[HUD3.open]}</h4><div class="grid"></div>`; const g=pan.firstChild.nextSibling; for(const b of by[HUD3.open]) g.appendChild(b); pan.hidden=false; }
  else { pan.hidden=true; pan.textContent=''; }
}
// --- ombre de l'avion au sol ---
function shadowUri(span,len){
  const key=Math.round(span)+'x'+Math.round(len); HUD3.shCache=HUD3.shCache||{}; if(HUD3.shCache[key]) return HUD3.shCache[key];
  const cv=document.createElement('canvas'); cv.width=256; cv.height=256; const g=cv.getContext('2d'), W=256, cx=128;
  const shape=(k)=>{ g.save(); g.translate(cx,128); g.scale(k,k); g.translate(-cx,-128); g.beginPath();
    g.ellipse(cx,128,9,118,0,0,7);                                                        // fuselage
    g.moveTo(cx,96); g.lineTo(cx+118,150); g.lineTo(cx+118,166); g.lineTo(cx,150); g.lineTo(cx-118,166); g.lineTo(cx-118,150); g.closePath();   // ailes en flèche
    g.moveTo(cx,218); g.lineTo(cx+44,240); g.lineTo(cx+44,248); g.lineTo(cx,238); g.lineTo(cx-44,248); g.lineTo(cx-44,240); g.closePath();     // empennage
    g.fill(); g.restore(); };
  g.fillStyle='rgba(0,0,0,0.085)'; for(let k=0;k<7;k++) shape(0.9+k*0.022);
  const img=cv.toDataURL('image/png'), hx=span/2*1.12, hz=len/2*1.08;
  const P=new Float32Array([-hx,0,hz, hx,0,hz, hx,0,-hz, -hx,0,-hz]), N=new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]), T=new Float32Array([0,0, 1,0, 1,1, 0,1]), I=new Uint16Array([0,1,2,0,2,3]);
  const parts=[P,N,T,I], total=parts.reduce((a,b)=>a+b.byteLength+(4-b.byteLength%4)%4,0), all=new Uint8Array(total), views=[]; let off=0;
  for(const a of parts){ all.set(new Uint8Array(a.buffer),off); views.push({buffer:0,byteOffset:off,byteLength:a.byteLength}); off+=a.byteLength+(4-a.byteLength%4)%4; }
  let bin=''; for(let i=0;i<all.length;i++) bin+=String.fromCharCode(all[i]);
  const gltf={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3,material:0}]}],
    materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:1},alphaMode:'BLEND',doubleSided:true,extensions:{KHR_materials_unlit:{}}}],extensionsUsed:['KHR_materials_unlit'],
    textures:[{source:0,sampler:0}],samplers:[{magFilter:9729,minFilter:9729,wrapS:33071,wrapT:33071}],images:[{uri:img}],
    accessors:[{bufferView:0,componentType:5126,count:4,type:'VEC3',min:[-hx,0,-hz],max:[hx,0,hz]},{bufferView:1,componentType:5126,count:4,type:'VEC3'},{bufferView:2,componentType:5126,count:4,type:'VEC2'},{bufferView:3,componentType:5123,count:6,type:'SCALAR'}],
    bufferViews:views,buffers:[{byteLength:total,uri:'data:application/octet-stream;base64,'+btoa(bin)}]};
  return HUD3.shCache[key]='data:model/gltf+json;base64,'+btoa(JSON.stringify(gltf));
}
function shadowTick(ac,p){
  const C=Cesium, V=G.viewer, st=p.st, mi=p.mi; if(HUD3.viewer!==V){ HUD3.sh=null; HUD3.viewer=V; }
  const inside=G.cam&&(G.cam.mode==='cabin'||G.cam.mode==='cockpit'), night=typeof AP3D!=='undefined'&&AP3D.night, alt=Math.max(0,st.alt||0);
  const real=typeof GQ!=='undefined'&&GQ.hq&&!(typeof FX!=='undefined'&&FX.noShadows);   // qualité haute : les vraies ombres du soleil sont déjà là
  const on=!real&&!inside&&!night&&alt<220&&(st.phase<=3||st.phase>=6)&&!(typeof P3!=='undefined'&&P3.lvl>=3)&&!(typeof FX!=='undefined'&&FX.rain);
  if(!on){ if(HUD3.sh) HUD3.sh.show=false; return; }
  const key=ac.model+'|'+Math.round(mi.span||30)+'|'+Math.round(mi.L);
  if(!HUD3.sh||HUD3.shKey!==key){ if(HUD3.sh) try{ V.entities.remove(HUD3.sh); }catch(e){} HUD3.shKey=key;
    HUD3.sh=V.entities.add({position:p.pos, model:{uri:shadowUri(mi.span||30,mi.L), shadows:C.ShadowMode.DISABLED, color:new C.Color(1,1,1,0.9)}}); }
  const c=C.Cartographic.fromCartesian(p.pos), body=mi.R+(mi.gH||2)+0.4, gh=c.height-Math.max(alt,body)+0.46, pos=C.Cartesian3.fromRadians(c.longitude,c.latitude,gh);
  const k=alt/220, e=HUD3.sh; e.position=pos; e.orientation=C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(st.hdg-90),0,0));
  e.model.scale=1+k*0.9; e.model.color=new C.Color(1,1,1,Math.max(0,0.95*(1-k)*(1-k))); e.show=true;
}
Object.assign(ACTIONS,{ hudGrp:d=>{ HUD3.open=HUD3.open===d.g?null:d.g; if(typeof renderGlobeHud==='function') renderGlobeHud(); } });
function pro3dHook(){ if(pro3dHook.done) return; pro3dHook.done=true; hud3Css();
  if(typeof renderGlobeHud==='function'){ const _r=renderGlobeHud; renderGlobeHud=function(){ const r=_r.apply(this,arguments); try{ hud3Regroup(); }catch(e){ console.warn('hud3',e); } return r; }; }
  // toucher la 3D referme le panneau ouvert
  const gl=document.getElementById('globe'); if(gl) gl.addEventListener('pointerdown',()=>{ if(HUD3.open){ HUD3.open=null; try{ renderGlobeHud(); }catch(e){} } });
  if(typeof fxTick==='function'){ const _t=fxTick; fxTick=function(ac,p){ const r=_t.apply(this,arguments); try{ shadowTick(ac,p); }catch(e){ if(!pro3dHook.w){ pro3dHook.w=1; console.warn('ombre',e); } } return r; }; }
  if(typeof fxClear==='function'){ const _c=fxClear; fxClear=function(){ try{ if(HUD3.sh&&HUD3.viewer) HUD3.viewer.entities.remove(HUD3.sh); HUD3.sh=null; HUD3.open=null; const pan=document.getElementById('hudPanel'); if(pan) pan.hidden=true; }catch(e){} return _c.apply(this,arguments); }; }
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ pro3dHook(); }catch(e){ console.warn(e); } },0));
