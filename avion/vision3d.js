/* =========================================================
   Sky Empire — modes de vision de la vue 3D (FLIR, vision nocturne,
   écran CRT, noir), détection tactique des avions et liste « Contacts ».

   Les effets d'image sont adaptés (allégés pour téléphone) des shaders
   du projet « God's Eye View » de Bilawal Sidhu :
   https://github.com/bilawalsidhu/gods-eye-view
   ---------------------------------------------------------------
   MIT License — Copyright (c) 2026 Bilawal Sidhu
   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:
   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.
   ---------------------------------------------------------------
   Aucune donnée ni aucun modèle 3D de ce projet n'est repris (licences différentes).
   ========================================================= */
'use strict';
const VIS_NOISE=`
  float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y); }`;
const VIS_SHADERS={
  // FLIR : blanc = chaud, flou infrarouge léger, lignes de température, halo sur les points chauds, objectif circulaire
  flir:`uniform sampler2D colorTexture; uniform vec2 colorTextureDimensions; uniform float time; uniform float palette; uniform float blackHot; in vec2 v_textureCoordinates;
  ${VIS_NOISE}
  vec3 ironbow(float t){ t=clamp(t,0.0,1.0); float s=t*6.0;
    vec3 c0=vec3(0.0),c1=vec3(0.13,0.0,0.30),c2=vec3(0.49,0.0,0.45),c3=vec3(0.86,0.10,0.18),c4=vec3(1.0,0.55,0.0),c5=vec3(1.0,0.91,0.32),c6=vec3(1.0);
    if(s<1.0) return mix(c0,c1,s); if(s<2.0) return mix(c1,c2,s-1.0); if(s<3.0) return mix(c2,c3,s-2.0); if(s<4.0) return mix(c3,c4,s-3.0); if(s<5.0) return mix(c4,c5,s-4.0); return mix(c5,c6,s-5.0); }
  float lum(vec2 uv){ return dot(texture(colorTexture,uv).rgb,vec3(0.299,0.587,0.114)); }
  void main(){ vec2 uv=v_textureCoordinates, dims=colorTextureDimensions, tx=1.0/dims;
    vec2 c=uv*2.0-1.0; c.x*=dims.x/dims.y; float r=length(c); float lens=pow(1.0-smoothstep(0.75,1.25,r),0.7);
    float l=0.0; for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) l+=lum(uv+vec2(float(x),float(y))*tx*1.5); l/=9.0;
    float t=clamp((l-0.12)/0.8,0.0,1.0);
    float band=abs(fract(t*12.0)-0.5); t*=mix(1.0,smoothstep(0.04,0.06,band)*0.85+0.15,0.3);
    float hot=0.0; for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++){ float s=clamp((lum(uv+vec2(float(x),float(y))*tx*4.0)-0.12)/0.8,0.0,1.0); hot+=smoothstep(0.6,1.0,s); } hot/=25.0;
    float th=mix(t,1.0-t,blackHot);
    vec3 col=mix(vec3(th),ironbow(t),palette)+hot*0.35;
    col+=(vnoise(uv*80.0+vec2(time*0.3,time*0.2))-0.5)*0.07;
    col*=(1.0-r*r*0.2)*lens;
    out_FragColor=vec4(clamp(col,0.0,1.0),1.0); }`,
  // vision nocturne : vert phosphore P43, gain, halo des lumières, grain, lignes de balayage, tube circulaire
  nvg:`uniform sampler2D colorTexture; uniform vec2 colorTextureDimensions; uniform float time; in vec2 v_textureCoordinates;
  ${VIS_NOISE}
  void main(){ vec2 uv=v_textureCoordinates, dims=colorTextureDimensions, tx=1.0/dims;
    vec2 c=uv*2.0-1.0; c.x*=dims.x/dims.y; float r=length(c); float tube=pow(1.0-smoothstep(0.75,1.25,r),0.7);
    float l=dot(texture(colorTexture,uv).rgb,vec3(0.299,0.587,0.114));
    float a=pow(clamp(l*1.35,0.0,1.0),1.05);
    float b=0.0, w=0.0; for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++){ float s=dot(texture(colorTexture,uv+vec2(float(x),float(y))*tx*5.0).rgb,vec3(0.299,0.587,0.114)); float k=exp(-float(x*x+y*y)/4.0); b+=smoothstep(0.55,0.95,s*1.35)*k; w+=k; } b/=w;
    vec3 ph=vec3(0.16,1.0,0.22); vec3 col=ph*(a+b*0.45);
    col+=ph*(vnoise(uv*120.0+vec2(time*0.5,time*0.3))-0.5)*0.12;
    col+=ph*(1.0-a)*hash(uv*dims+vec2(time*200.0,time*300.0))*0.05;
    float sl=pow(sin(uv.y*dims.y*1.2+time*2.0)*0.5+0.5,2.5); col*=1.0-sl*0.12;
    col*=(1.0-r*r*0.3)*tube;
    out_FragColor=vec4(clamp(col,0.0,1.0),1.0); }`,
  // écran CRT : pixels, tramage, aberration chromatique, lignes de balayage, scintillement
  crt:`uniform sampler2D colorTexture; uniform vec2 colorTextureDimensions; uniform float time; in vec2 v_textureCoordinates;
  ${VIS_NOISE}
  void main(){ vec2 uv=v_textureCoordinates, dims=colorTextureDimensions;
    float line=floor(uv.y*dims.y); float j=step(0.985,hash(vec2(line,floor(time*8.0))))*(hash(vec2(line*7.0,floor(time*12.0)))-0.5)*0.006; uv.x+=j;
    float px=3.0; vec2 pu=floor(uv*dims/px)*px/dims;
    vec2 cc=uv-0.5; float ca=length(cc)*0.006;
    vec3 col=vec3(texture(colorTexture,pu+cc*ca).r,texture(colorTexture,pu).g,texture(colorTexture,pu-cc*ca).b);
    float d=hash(floor(uv*dims/px))-0.5; col=floor((col+d*0.08)*12.0+0.5)/12.0;
    col*=0.85+0.15*(sin(uv.y*dims.y*1.0+time*2.5)*0.5+0.5);
    col*=0.97+0.03*sin(time*60.0);
    vec2 v=uv*(1.0-uv); col*=pow(v.x*v.y*16.0,0.25);
    out_FragColor=vec4(clamp(col,0.0,1.0),1.0); }`,
  // noir : noir et blanc contrasté, grain, vignette, pointe de sépia
  noir:`uniform sampler2D colorTexture; uniform vec2 colorTextureDimensions; in vec2 v_textureCoordinates;
  void main(){ vec2 uv=v_textureCoordinates; vec4 c=texture(colorTexture,uv); float l=dot(c.rgb,vec3(0.299,0.587,0.114));
    vec3 g=clamp((vec3(l)-0.5)*2.2+0.5,0.0,1.0); g+=(fract(sin(dot(uv*colorTextureDimensions,vec2(12.9898,78.233)))*43758.5453)-0.5)*0.04;
    vec2 v=uv*(1.0-uv); g*=pow(v.x*v.y*16.0,0.5);
    vec3 sep=vec3(dot(g,vec3(0.393,0.769,0.189)),dot(g,vec3(0.349,0.686,0.168)),dot(g,vec3(0.272,0.534,0.131)));
    out_FragColor=vec4(mix(g,sep,0.15),c.a); }`,
};
const VIS_MODES=[['off','Normal'],['flir','FLIR'],['iron','FLIR couleur'],['nvg','Vision nocturne'],['crt','Écran CRT'],['noir','Noir']];
const VIS={mode:(()=>{ if(window.SE_SAFE) return 'off'; try{ return localStorage.getItem('se-vis')||'off'; }catch(e){ return 'off'; } })(), det:(()=>{ if(window.SE_SAFE) return false; try{ return localStorage.getItem('se-det')==='1'; }catch(e){ return false; } })(), contacts:false, stage:null, viewer:null, t0:performance.now(), at:0, list:[]};
function visApply(){
  if(typeof G==='undefined'||!G||!G.viewer) return; const C=Cesium, PS=G.viewer.scene.postProcessStages;
  if(VIS.stage&&VIS.viewer===G.viewer){ try{ PS.remove(VIS.stage); }catch(e){} } VIS.stage=null; VIS.viewer=G.viewer;
  const m=VIS.mode; if(m==='off') return;
  const src=VIS_SHADERS[m==='iron'?'flir':m]; if(!src) return;
  try{ VIS.stage=PS.add(new C.PostProcessStage({fragmentShader:src, uniforms:{time:()=>(performance.now()-VIS.t0)/1000, palette:m==='iron'?1:0, blackHot:0}})); }
  catch(e){ console.warn('vision',e); VIS.mode='off'; toast('⛔ Ce mode de vision ne marche pas sur cet appareil','warn'); }
}
function visionButtons(){
  const lab=(VIS_MODES.find(x=>x[0]===VIS.mode)||VIS_MODES[0])[1];
  return `<button class="gh ${VIS.mode!=='off'?'on':''}" data-act="visMode" title="Mode de vision">👁️ ${lab}</button><button class="gh ${VIS.det?'on':''}" data-act="visDet" title="Cadres de détection sur les avions">🎯 Détection</button><button class="gh ${VIS.contacts?'on':''}" data-act="visContacts" title="Avions autour de vous">📡 Contacts</button>`;
}

/* ---------- détection tactique : cadres et identifiants sur les avions ---------- */
function visCanvas(){ let cv=document.getElementById('detect'); if(!cv){ cv=document.createElement('canvas'); cv.id='detect'; } const host=document.getElementById('globe'); if(host&&cv.parentNode!==host) host.appendChild(cv); return cv; }
function visTargets(){
  const C=Cesium, V=G.viewer, now=C.JulianDate.now(), out=[];
  for(const [id,e] of G.planes){ const ac=S.fleet.find(a=>a.id===id); if(!ac||!ac.flight) continue; const p=e.position&&e.position.getValue(now); if(!p) continue;
    const st=flightState(ac,gSimNow()); out.push({p,own:true,id,tag:`${S.company.code}${flightNumber(ac)}`,sub:`${ac.reg} · ${modelOf(ac).name.replace(/^(Airbus|Boeing|Embraer|Bombardier|ATR|De Havilland) /,'')}`,alt:st?st.alt:0,spd:st?st.spd:0,ph:st?st.phase:0,span:acSpec(modelOf(ac)).span}); }
  for(const e of G.rivals){ if(!e._riv) continue; const p=e.position&&e.position.getValue(now); if(!p) continue; let v=null; try{ v=e._riv.Q(); }catch(_){}
    out.push({p,own:false,tag:e._riv.code,sub:e._riv.name,alt:v?v.alt||0:0,spd:v&&v.spd||0,ph:v?v.ph:0,span:(e._riv.mi&&e._riv.mi.span)||35}); }
  return out;
}
function visDraw(){
  const cv=visCanvas(), on=(VIS.det||VIS.mode!=='off')&&G&&!$('#globe').hidden; cv.style.display=on?'block':'none'; if(!on) return;
  const now=performance.now(); if(now-VIS.at<70) return; VIS.at=now;
  const V=G.viewer, sc=V.scene, dpr=Math.min(window.devicePixelRatio||1,2), W=V.canvas.clientWidth, H=V.canvas.clientHeight;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); cv.style.width=W+'px'; cv.style.height=H+'px'; }
  const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  const col=VIS.mode==='nvg'?'#7dff8a':VIS.mode==='flir'||VIS.mode==='noir'?'#ffffff':'#ffd60a', red='#ff5a5a';
  g.font='600 10px ui-monospace,Menlo,monospace'; g.lineWidth=1.2;
  // cadres
  if(VIS.det){ const cam=V.camera.positionWC, fov=(V.camera.frustum.fovy||1), list=visTargets();
    VIS.list=list.map(t=>({...t,d:Cesium.Cartesian3.distance(cam,t.p)})).sort((a,b)=>a.d-b.d);
    let shown=0;
    for(const t of VIS.list){ if(shown>=40) break; const w=Cesium.SceneTransforms.worldToWindowCoordinates(sc,t.p); if(!w||w.x<-40||w.y<-40||w.x>W+40||w.y>H+40) continue;
      // derrière la Terre : pas de cadre
      if(t.d>2e6) continue;
      const sz=Math.max(14,Math.min(160,t.span*1.3*H/(2*t.d*Math.tan(fov/2))));
      const c=t.own?col:t.live?'#7dd3fc':red, x=w.x-sz/2, y=w.y-sz/2, k=Math.max(4,sz*0.25);
      g.strokeStyle=c; g.beginPath();
      g.moveTo(x,y+k); g.lineTo(x,y); g.lineTo(x+k,y); g.moveTo(x+sz-k,y); g.lineTo(x+sz,y); g.lineTo(x+sz,y+k);
      g.moveTo(x+sz,y+sz-k); g.lineTo(x+sz,y+sz); g.lineTo(x+sz-k,y+sz); g.moveTo(x+k,y+sz); g.lineTo(x,y+sz); g.lineTo(x,y+sz-k); g.stroke();
      g.fillStyle=c; g.fillText(`${t.own?'■':'▲'} ${t.tag}`,x,y-14); g.globalAlpha=0.8;
      g.fillText(`${Math.round((t.alt||0)*3.281/100)*100} ft · ${Math.round((t.spd||0)/1.852)} kt · ${t.d<10000?Math.round(t.d)+' m':(t.d/1852).toFixed(1)+' NM'}`,x,y-3); g.globalAlpha=1; shown++; }
  }
  // HUD tactique
  if(VIS.mode!=='off'){ g.fillStyle=col; g.font='700 11px ui-monospace,Menlo,monospace';
    const lab=(VIS_MODES.find(x=>x[0]===VIS.mode)||['',''])[1].toUpperCase(), d=new Date(S.time);
    g.fillText(`SKY EMPIRE · ${lab}${VIS.mode==='flir'?' · WHOT':''}`,12,H-200);
    g.fillText(`${d.toISOString().slice(0,10)} ${d.toISOString().slice(11,19)}Z`,12,H-186);
    if(Math.floor(now/600)%2){ g.fillStyle=red; g.beginPath(); g.arc(W-24,H-198,4,0,7); g.fill(); g.fillStyle=col; g.fillText('REC',W-60,H-194); }
    g.strokeStyle=col; g.beginPath(); const cx=W/2, cy=H/2; g.moveTo(cx-24,cy); g.lineTo(cx-8,cy); g.moveTo(cx+8,cy); g.lineTo(cx+24,cy); g.moveTo(cx,cy-24); g.lineTo(cx,cy-8); g.moveTo(cx,cy+8); g.lineTo(cx,cy+24); g.stroke(); }
}
// liste « Contacts » : les avions les plus proches de la caméra, à toucher pour les suivre
function visContactsRender(){
  let box=document.getElementById('contacts'); if(!box){ box=document.createElement('div'); box.id='contacts'; document.body.appendChild(box); }
  const on=VIS.contacts&&G&&!$('#globe').hidden; box.hidden=!on; if(!on) return;
  if(!VIS.det) VIS.list=visTargets().map(t=>({...t,d:Cesium.Cartesian3.distance(G.viewer.camera.positionWC,t.p)})).sort((a,b)=>a.d-b.d);
  const L=VIS.list.filter(t=>t.d<250000).slice(0,UI.mobile?5:8);
  const html=`<div class="ct-h">📡 CONTACTS · ${L.length} dans 250 km</div>${L.map(t=>`<div class="ct ${t.own?'own':''}" ${t.own?`data-act="visFollow" data-id="${t.id}"`:''}><b>${t.own?'■':'▲'} ${esc(t.tag)}</b> <span>${esc(t.sub)}</span><i>${t.d<10000?Math.round(t.d)+' m':(t.d/1852).toFixed(0)+' NM'} · ${Math.round((t.alt||0)*3.281/100)*100} ft${t.own?' · suivre':''}</i></div>`).join('')||'<div class="ct">Aucun avion proche. Rapprochez-vous d’un aéroport.</div>'}`;
  if(box._h!==html){ box._h=html; box.innerHTML=html; }
}
let _visHooked=null;
function visTick(){
  if(typeof G==='undefined'||!G||!G.viewer) return;
  if(_visHooked!==G.viewer){ _visHooked=G.viewer; VIS.stage=null; visApply(); G.viewer.scene.postRender.addEventListener(()=>{ try{ visDraw(); }catch(e){ console.warn(e); } }); }
  if(VIS.contacts&&performance.now()-(VIS.cAt||0)>1000){ VIS.cAt=performance.now(); try{ visContactsRender(); }catch(e){ console.warn(e); } }
}
setInterval(()=>{ try{ visTick(); const cv=document.getElementById('detect'); if(cv&&(!G||$('#globe').hidden)) cv.style.display='none'; const b=document.getElementById('contacts'); if(b&&(!G||$('#globe').hidden)) b.hidden=true; }catch(e){} },250);
Object.assign(ACTIONS,{
  visMode:()=>{ const i=VIS_MODES.findIndex(x=>x[0]===VIS.mode); VIS.mode=VIS_MODES[(i+1)%VIS_MODES.length][0]; try{ localStorage.setItem('se-vis',VIS.mode); }catch(e){}
    visApply(); toast('👁️ Vision : '+VIS_MODES.find(x=>x[0]===VIS.mode)[1],'info'); renderGlobeHud(); },
  visDet:()=>{ VIS.det=!VIS.det; try{ localStorage.setItem('se-det',VIS.det?'1':'0'); }catch(e){} toast(VIS.det?'🎯 Détection : cadres et identifiants sur tous les avions (■ les vôtres, ▲ les autres)':'🎯 Détection coupée','info'); renderGlobeHud(); },
  visContacts:()=>{ VIS.contacts=!VIS.contacts; VIS.cAt=0; visContactsRender(); renderGlobeHud(); },
  visFollow:d=>{ if(!S.fleet.some(a=>a.id===d.id)) return; selectPlane(d.id); globeFollow(d.id); },
});
