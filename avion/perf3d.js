/* =========================================================
   Sky Empire — 🛟 3D toujours fluide (tous les modes, aussi Minimal)
   Mesure les images par seconde de la vue 3D. Si le téléphone n'arrive
   plus à suivre, on retire les décors dans cet ordre, sans fermer la 3D :
   1. trafic d'ambiance et aéroport vivant allégés, nuages réduits ;
   2. moins d'avions des autres compagnies, résolution un peu plus basse ;
   3. trafic d'ambiance et nuages coupés, aéroport en version simple.
   Si ça redevient fluide longtemps, le niveau redescend d'un cran.
   ========================================================= */
'use strict';
const P3={lvl:0, n:0, t0:0, low:0, good:0, raf:0, viewer:null};
function p3Apply(){
  const L=P3.lvl; window.SE_P3=L;
  try{ if(typeof TR!=='undefined'){ TR.cap=L>=3?0:L>=1?2:null; if(L>=3&&typeof trClear==='function') trClear(); } }catch(e){}
  try{ if(typeof CL!=='undefined'){ CL.cap=L>=3?0:L>=1?10:null; CL.at=null; } }catch(e){}
  try{ if(G&&G.viewer){ if(L>=2){ G.rivalCap=Math.min(G.rivalCap||99,L>=3?4:8); G.rivAt=0; G.viewer.resolutionScale=Math.max(0.6,(G.viewer.resolutionScale||1)*0.88); } if(L>=3&&!G.lite){ G.lite=true; try{ worldClear(); }catch(e){} } } }catch(e){}
}
function p3Frame(){
  P3.raf=0; if(typeof G==='undefined'||!G||!G.viewer||document.getElementById('globe').hidden){ P3.t0=0; return; }
  P3.raf=requestAnimationFrame(p3Frame);
  if(P3.viewer!==G.viewer){ P3.viewer=G.viewer; P3.lvl=0; P3.low=0; P3.good=0; p3Apply(); }
  const now=performance.now(); if(!P3.t0){ P3.t0=now; P3.n=0; return; } P3.n++;
  const el=now-P3.t0; if(el<3000) return; const fps=P3.n*1000/el; P3.t0=now; P3.n=0;
  if(document.hidden||el>8000) return;
  const mob=typeof GQ!=='undefined'&&GQ.mob, need=mob?18:15;
  if(fps<need){ P3.good=0; if(++P3.low>=2&&P3.lvl<3){ P3.low=0; P3.lvl++; p3Apply(); if(typeof toast==='function') toast(`🛟 3D allégée pour rester fluide (${Math.round(fps)} images/s)`,'info'); try{ log3D('allègement '+P3.lvl,Math.round(fps)+' i/s'); }catch(e){} } }
  else { P3.low=0; if(fps>need*1.8&&++P3.good>=20&&P3.lvl>0&&P3.lvl<3){ P3.good=0; P3.lvl--; p3Apply(); } }
}
function p3Hook(){ if(p3Hook.done) return; p3Hook.done=true;
  setInterval(()=>{ if(!P3.raf&&typeof G!=='undefined'&&G&&G.viewer&&!document.getElementById('globe').hidden) P3.raf=requestAnimationFrame(p3Frame); },1000); }
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ p3Hook(); }catch(e){ console.warn(e); } },0));
