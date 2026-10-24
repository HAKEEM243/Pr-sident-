/* =========================================================
   Sky Empire — 👷 personnel au sol autour de votre avion (3D)
   À la porte d'embarquement :
   • mécanicien au nez de l'avion, casque radio sur les oreilles ;
   • deux bagagistes en gilet fluo qui font la navette entre le chariot
     et le tapis de la soute ;
   • l'agent d'avitaillement près de l'aile, le chef d'escale qui fait le tour.
   Au repoussage : deux agents marchent au bout des ailes.
   À l'arrivée : le placier, bâtons orange levés, guide l'avion jusqu'à la porte.
   Les passagers, eux, montent par la passerelle ou l'escalier (déjà dans le jeu).
   ========================================================= */
'use strict';
const PPL={ents:{}, viewer:null};
// personnage : pantalon, chaussures, buste, gilet haute visibilité avec bandes réfléchissantes, bras, tête, casque ou casquette
const M_CREW=(vest,skin,head,pose)=>()=>{ const V=C3(vest), K=C3(skin), T=C3('#1f2a44'), S_=C3('#111827'), R=C3('#e5e7eb'), H=C3(head), O=C3('#f97316');
  const b=[[-0.19,-0.03,0.08,0.86,-0.09,0.09,T],[0.03,0.19,0.08,0.86,-0.09,0.09,T],[-0.2,-0.02,0,0.09,-0.1,0.16,S_],[0.02,0.2,0,0.09,-0.1,0.16,S_],
    [-0.23,0.23,0.86,1.47,-0.13,0.13,T],[-0.25,0.25,0.9,1.45,-0.145,0.145,V],[-0.255,0.255,1.02,1.07,-0.15,0.15,R],[-0.255,0.255,1.22,1.27,-0.15,0.15,R],
    [-0.1,0.1,1.47,1.53,-0.08,0.08,K],[-0.12,0.12,1.53,1.79,-0.12,0.12,K],[-0.13,0.13,1.76,1.88,-0.14,0.14,H]];
  if(pose==='marshal'){ b.push([-0.36,-0.25,1.3,2.1,-0.06,0.06,V],[0.25,0.36,1.3,2.1,-0.06,0.06,V],[-0.34,-0.27,2.1,2.62,-0.035,0.035,O],[0.27,0.34,2.1,2.62,-0.035,0.035,O]); }
  else if(pose==='marshal2'){ b.push([-0.66,-0.25,1.36,1.46,-0.06,0.06,V],[0.25,0.66,1.36,1.46,-0.06,0.06,V],[-1.12,-0.66,1.38,1.44,-0.035,0.035,O],[0.66,1.12,1.38,1.44,-0.035,0.035,O]); }
  else { b.push([-0.32,-0.24,0.95,1.45,-0.07,0.07,V],[0.24,0.32,0.95,1.45,-0.07,0.07,V],[-0.32,-0.24,0.86,0.96,-0.06,0.06,K],[0.24,0.32,0.86,0.96,-0.06,0.06,K]); }
  if(pose==='headset') b.push([-0.16,-0.12,1.6,1.74,-0.05,0.05,S_],[0.12,0.16,1.6,1.74,-0.05,0.05,S_],[-0.14,0.14,1.82,1.85,-0.03,0.03,S_]);
  return b; };
const PPL_SK=['#5b3a24','#7a4a2a','#3f2516','#8d5a3b','#c99a73'];
function pplEnt(key,url){
  const V=G.viewer; if(PPL.viewer!==V){ PPL.ents={}; PPL.viewer=V; }
  let e=PPL.ents[key]; if(!e){ e=V.entities.add({position:Cesium.Cartesian3.ZERO, model:{uri:url, minimumPixelSize:0, shadows:Cesium.ShadowMode.CAST_ONLY}, show:false}); if(typeof apLit==='function') apLit(e); PPL.ents[key]=e; }
  return e; }
function pplPut(e,pos,hdg){ e.position=pos; e.orientation=Cesium.Transforms.headingPitchRollQuaternion(pos,new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(hdg-90),0,0)); e.show=true; }
function pplTick(ac,p){
  if(typeof apModel!=='function'||typeof C3!=='function'||typeof fxLocal!=='function') return;
  const st=p.st, mi=p.mi, inside=G.cam&&(G.cam.mode==='cabin'||G.cam.mode==='cockpit'), t=performance.now()/1000, used=new Set();
  const gy=-(mi.R+(mi.gH||2)+0.4)+0.03, L=mi.L, R=mi.R, span=mi.span||30, hdg=st.hdg;
  const mdl=(k,vest,pose,i)=>apModel('crew-'+k,M_CREW(vest,PPL_SK[i%PPL_SK.length],k==='sup'?'#f8fafc':k==='fuel'?'#dc2626':'#facc15',pose));
  const put=(key,url,x,z,h,bob)=>{ used.add(key); const e=pplEnt(key,url); pplPut(e,fxLocal(p,x,gy+(bob?Math.abs(Math.sin(t*7+x))*0.04:0),z),h); };
  const lite=typeof P3!=='undefined'&&P3.lvl>=3;
  if(!inside&&!lite&&st.phase===0){
    put('nose',mdl('nose','#facc15','headset',0),0.9,L*0.5+2.6,hdg+180);
    // bagagistes : navette chariot ↔ tapis de la soute arrière (côté droit)
    for(let i=0;i<2;i++){ const ph=(t*0.12+i*0.5)%1, k=ph<0.5?ph*2:2-ph*2, x=R+1.6+k*5.5, z=-L*0.2+i*0.9-k*1.5, back=ph>=0.5;
      put('bag'+i,mdl('bag','#facc15','',i+1),x,z,hdg+90+(back?180:0)-15,true); }
    put('fuel',mdl('fuel','#f97316','',3),span*0.24,-L*0.02,hdg+120);
    { const ph=(t*0.03)%1, a=ph*Math.PI*2, x=Math.cos(a)*(R+9), z=Math.sin(a)*L*0.62; put('sup',mdl('sup','#84cc16','',4),x,z,hdg+Math.atan2(-Math.sin(a)*(R+9),Math.cos(a)*L*0.62)*180/Math.PI,true); }
  }
  // repoussage : agents au bout des ailes
  if(!inside&&!lite&&st.pushback){ for(const sx of [-1,1]) put('wing'+sx,mdl('wing','#facc15','',sx>0?1:2),sx*(span/2+1.4),-1.5,hdg+180,true); }
  // arrivée : le placier guide l'avion jusqu'à la porte
  if(!inside&&!lite&&st.phase===8&&typeof gateSlot==='function'){ try{ const gp=gateSlot(st.to,ac,typeof legIntl==='function'?legIntl(st.leg):false), d=gcDist(gp,st)*1000;
      if(d<160){ const q=destPt(gp.lat,gp.lon,gp.hdg,(L*0.5+16)/1000), pos=Cesium.Cartesian3.fromDegrees(q.lon,q.lat,(typeof gElev==='function'?gElev(st.to):0)+0.03), up=Math.floor(t*1.6)%2===0;
        used.add('m1'); used.add('m2'); const a=pplEnt('m1',mdl('m1','#f97316','marshal',2)), b=pplEnt('m2',mdl('m2','#f97316','marshal2',2));
        pplPut(a,pos,gp.hdg+180); pplPut(b,pos,gp.hdg+180); a.show=d>4&&up; b.show=d>4?!up:true; } }catch(e){} }
  for(const [k,e] of Object.entries(PPL.ents)) if(!used.has(k)) e.show=false;
}
function pplClear(){ if(PPL.viewer) for(const e of Object.values(PPL.ents)) try{ PPL.viewer.entities.remove(e); }catch(x){} PPL.ents={}; }
function pplHook(){ if(pplHook.done||typeof fxTick!=='function') return; pplHook.done=true;
  { const _t=fxTick; fxTick=function(ac,p){ const r=_t.apply(this,arguments); try{ pplTick(ac,p); }catch(e){ if(!pplHook.w){ pplHook.w=1; console.warn('personnel',e); } } return r; }; }
  if(typeof fxClear==='function'){ const _c=fxClear; fxClear=function(){ try{ pplClear(); }catch(e){} return _c.apply(this,arguments); }; }
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ pplHook(); }catch(e){ console.warn(e); } },0));
