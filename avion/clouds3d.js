/* =========================================================
   Sky Empire — ☁️ nuages en 3D (légers, aussi sur téléphone)
   • Autour de l'avion suivi : cumulus (1 200–3 000 m), parfois une
     couche plus haute (5 500–8 000 m) ; sous un orage, gros nuages sombres.
   • Pas toujours : la couverture change selon la région et le jour
     (ciel dégagé, quelques nuages, ciel chargé, orage).
   • Ce sont des images de nuages posées dans le ciel à leur vraie
     taille : l'avion les traverse en montant, puis on les voit en dessous.
   Remplace les nuages volumineux de Cesium, trop lourds pour un iPhone.
   ========================================================= */
'use strict';
const CL={col:null, viewer:null, at:null, imgs:null, cov:0};
// réglage du joueur : auto (météo du jeu), aucun, quelques, nuageux, très nuageux (aussi à votre altitude), orage
const CL_MODES=[['auto','Nuages : météo'],['none','Pas de nuages'],['few','Quelques nuages'],['some','Nuageux'],['many','Très nuageux'],['storm','Orage']];
function clMode(){ if(CL.mode) return CL.mode; try{ CL.mode=localStorage.getItem('se-clouds')||'auto'; }catch(e){ CL.mode='auto'; } return CL.mode; }
function clModeLabel(){ const m=CL_MODES.find(x=>x[0]===clMode()); return m?m[1]:'Nuages'; }
function clNext(){ const i=CL_MODES.findIndex(x=>x[0]===clMode()); CL.mode=CL_MODES[(i+1)%CL_MODES.length][0]; try{ localStorage.setItem('se-clouds',CL.mode); }catch(e){} CL.at=null; CL.k=null; try{ clTick(); }catch(e){} }
function clImgs(){
  if(CL.imgs) return CL.imgs;
  // nuage peint : dizaines de boules douces, sommet éclairé par le soleil, base plus grise et plate
  const mk=(seed,kind)=>{ const W=384,H=192, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const g=cv.getContext('2d'); let s=seed;
    const r=()=>{ s=(s*9301+49297)%233280; return s/233280; }, dark=kind==='d', flat=kind==='f';
    const base=flat?H*0.62:H*0.78, n=flat?34:46;
    for(let i=0;i<n;i++){ const x=W*0.12+r()*W*0.76, cx=Math.abs(x-W/2)/(W/2), top=flat?H*0.45:H*(0.22+cx*0.4), y=top+r()*(base-top)*0.9, rad=(flat?14:20)+r()*(flat?26:44)*(1-cx*0.5);
      const lit=dark?[150,156,170]:[255,255,255], mid=dark?[96,102,116]:[226,231,240], sh=dark?[58,62,74]:[176,184,198];
      const gr=g.createRadialGradient(x-rad*0.25,y-rad*0.45,rad*0.08,x,y,rad); gr.addColorStop(0,`rgba(${lit},0.98)`); gr.addColorStop(0.45,`rgba(${mid},0.9)`); gr.addColorStop(0.85,`rgba(${sh},0.55)`); gr.addColorStop(1,`rgba(${sh},0)`);
      g.fillStyle=gr; g.beginPath(); g.arc(x,Math.min(y,base-rad*0.35),rad,0,7); g.fill(); }
    // base ombrée
    const b=g.createLinearGradient(0,base-30,0,base+12); b.addColorStop(0,'rgba(0,0,0,0)'); b.addColorStop(1,dark?'rgba(30,32,40,0.45)':'rgba(120,128,145,0.28)'); g.globalCompositeOperation='source-atop'; g.fillStyle=b; g.fillRect(0,0,W,H); g.globalCompositeOperation='source-over';
    return cv; };
  return CL.imgs={w:[mk(7),mk(41),mk(93),mk(211)], f:[mk(5,'f'),mk(77,'f')], d:[mk(17,'d'),mk(55,'d'),mk(131,'d')]};
}
// couverture nuageuse de la région (0 = ciel clair … 1 = très chargé), stable pour la journée
function clCover(lat,lon){ const day=Math.floor(S.time/DAY), cell=Math.floor(lat/4)*1000+Math.floor(lon/4);
  let h=(cell*7919+day*104729)%10007; h=((h*48271)%2147483647)/2147483647;
  const tropics=Math.abs(lat)<15?0.15:0; return h<0.15?0:Math.min(1,0.35+h*0.7+tropics); }   // ciel dégagé environ 1 fois sur 7
function clSpawn(c){
  const C=Cesium, V=G.viewer; if(!CL.col||CL.viewer!==V){ CL.col=V.scene.primitives.add(new C.BillboardCollection()); CL.viewer=V; }
  CL.col.removeAll(); const md=clMode(); if(md==='none'){ CL.cov=0; return; }
  const st=md==='storm'||(md==='auto'&&typeof stormAt==='function'&&stormAt(c.lat,c.lon)), cov=st?1:md==='few'?0.35:md==='some'?0.7:md==='many'?1:clCover(c.lat,c.lon); CL.cov=st?'orage':cov;
  if(!cov) return;
  const I=clImgs(), mob=typeof GQ!=='undefined'&&GQ.mob, n=CL.cap!=null?Math.min(CL.cap,Math.round((mob?22:40)*cov)):Math.round((mob?22:40)*cov*(st?1.4:1)), gr=typeof groundAt==='function'?Math.max(0,groundAt(c.lat,c.lon)):0;
  const put=(img,q,alt,w,h,a)=>CL.col.add({image:img, position:C.Cartesian3.fromDegrees(q.lon,q.lat,alt), width:w, height:h, sizeInMeters:true, color:C.Color.WHITE.withAlpha(a), distanceDisplayCondition:new C.DistanceDisplayCondition(0,120000)});
  for(let i=0;i<n;i++){
    const d=1+Math.random()*26, q=destPt(c.lat,c.lon,Math.random()*360,d), high=!st&&Math.random()<0.2;
    if(st&&i%5===0&&(CL.cap==null||CL.cap>=10)){   // cumulonimbus : tour sombre jusqu'à 11 km, enclume plate au sommet
      const w=5000+Math.random()*3000; for(let k=0;k<4;k++) put(I.d[(i+k)%I.d.length],destPt(q.lat,q.lon,Math.random()*360,Math.random()*0.6),gr+1800+k*2300,w*(1-k*0.12),w*0.62,0.97);
      put(I.f[i%I.f.length],q,gr+10800,w*2.4,w*0.55,0.8); continue; }
    const alt=gr+(st?1500+Math.random()*4000:high?5500+Math.random()*2500:1200+Math.random()*1800), w=st?3000+Math.random()*4000:high?2500+Math.random()*3500:1200+Math.random()*2400;
    const img=st?I.d[i%I.d.length]:high?I.f[i%I.f.length]:I.w[i%I.w.length];
    put(img,q,alt,w,w*(high?0.35:0.5),high?0.6:st?0.95:0.92);
    // grappe : 1 ou 2 morceaux autour du nuage principal pour lui donner du volume
    if(!high&&!(CL.cap!=null&&CL.cap<20)) for(let k=0;k<(st?2:1+(i%2));k++){ const q2=destPt(q.lat,q.lon,Math.random()*360,w*(0.25+Math.random()*0.3)/1000);
      put((st?I.d:I.w)[(i+k+1)%(st?I.d.length:I.w.length)],q2,alt+(Math.random()-0.3)*w*0.22,w*(0.55+Math.random()*0.3),w*0.3,st?0.92:0.88); }
  }
}
function clOwnLayer(c,alt){ if(clMode()!=='many'||!CL.col||!(alt>800)||(CL.cap!=null&&CL.cap<20)) return; const C=Cesium, I=clImgs(), n=typeof GQ!=='undefined'&&GQ.mob?8:14;
  for(let i=0;i<n;i++){ const q=destPt(c.lat,c.lon,Math.random()*360,1.5+Math.random()*14), a=alt+(Math.random()-0.5)*900, w=1500+Math.random()*2500;
    CL.col.add({image:I.w[i%I.w.length],position:C.Cartesian3.fromDegrees(q.lon,q.lat,a),width:w,height:w*0.5,sizeInMeters:true,color:C.Color.WHITE.withAlpha(0.85),distanceDisplayCondition:new C.DistanceDisplayCondition(0,120000)}); } }
function clTick(){
  if(typeof G==='undefined'||!G||!G.viewer||document.getElementById('globe').hidden){ return; }
  if(CL.viewer&&CL.viewer!==G.viewer){ CL.col=null; CL.at=null; }
  if(typeof P3!=='undefined'&&P3.since&&performance.now()-P3.since<8000) return;   // démarrage de la 3D d'abord
  const f=G.follow&&S.fleet.find(a=>a.id===G.follow), st=f&&f.flight&&flightState(f); let c=null;
  if(st){ const ah=destPt(st.lat,st.lon,st.hdg,18); c={lat:ah.lat,lon:ah.lon}; }   // nuages devant l'avion (sur sa route), pas derrière else { const cp=G.viewer.camera.positionCartographic; if(cp&&cp.height<40000) c={lat:Cesium.Math.toDegrees(cp.latitude),lon:Cesium.Math.toDegrees(cp.longitude)}; }
  if(!c) return; if(!CL.at||gcDist(CL.at,c)>(st?16:35)||(clMode()==='many'&&st&&Math.abs((CL.alt||0)-st.alt)>1500)){ CL.at=c; CL.alt=st?st.alt:0; try{ clSpawn(c); clOwnLayer(c,st&&st.alt); }catch(e){ console.warn('nuages',e); } }
  // nuit : nuages plus sombres
  try{ const el=typeof globeSunElevation==='function'?globeSunElevation(c.lat,c.lon):45, k=Math.max(0.18,Math.min(1,(el+6)/14)); if(CL.col&&Math.abs((CL.k||1)-k)>0.05){ CL.k=k; for(let i=0;i<CL.col.length;i++){ const b=CL.col.get(i), a=b.color.alpha; b.color=new Cesium.Color(k,k,k*1.05,a); } } }catch(e){}
}
function clHook(){ if(clHook.done) return; clHook.done=true;
  // les nuages volumineux de Cesium sont remplacés par ces nuages légers
  if(typeof spawnClouds==='function') spawnClouds=function(){ try{ if(G&&G.clouds) G.clouds.removeAll(); }catch(e){} };
  setInterval(()=>{ try{ clTick(); }catch(e){} },1500);
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ clHook(); }catch(e){ console.warn(e); } },0));
