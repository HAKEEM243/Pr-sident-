/* =========================================================
   Sky Empire — ✈️ trafic des autres compagnies autour de vous en 3D
   Quand on suit un avion en 3D, d'autres avions volent à proximité, aux
   couleurs des compagnies qui desservent la région :
   • en croisière : des avions qui croisent ou longent votre route, à
     d'autres niveaux de vol (séparation de 300 à 1 500 m) ;
   • près d'un aéroport : un avion en finale derrière vous, aligné sur la
     piste et qui descend sur le plan de 3°, et un autre qui décolle.
   Trafic d'ambiance (simulé) en plus des vols des compagnies suivies.
   ========================================================= */
'use strict';
const TR={list:[], viewer:null, at:0};
const TR_MODELS={nb:['A20N','B738','A321'],wb:['B789','A359','B77W'],prop:['AT76']};
function trClear(){ if(TR.viewer) for(const x of TR.list) try{ TR.viewer.entities.remove(x.ent); }catch(e){} TR.list=[]; }
function trAirlines(code){ const L=(typeof airlinesAt==='function'?airlinesAt(code):[]).map(([c])=>c).filter(c=>typeof c==='string'&&c&&c!==S.company.code); return L.length?L:['ET','KQ','SA','AF','EK','QR']; }
function trPos(x,t){ const dt=(t-x.t0)/1000, d=x.spd*dt/1000; const p=destPt(x.lat,x.lon,x.hdg,d); let alt=x.alt+x.vs*dt; if(x.floor!==undefined) alt=Math.max(x.floor,alt); return {lat:p.lat,lon:p.lon,alt,d}; }
function trAdd(x){
  const C=Cesium, V=G.viewer, m=getModel(x.mid)||getModel('A20N'), name=(typeof aiBy==='function'&&aiBy(x.code)&&aiBy(x.code).name)||x.code, col=typeof airlineColor==='function'?airlineColor(x.code):'#94a3b8', lt=typeof acLite==='function'&&acLite(), mi=AC3D.uri(m,lt?col:{tail:col,stripe:col,title:name},lt);
  let cq=null, ct=-1; const Q=()=>{ const t=gSimNow(); if(t!==ct){ ct=t; cq=trPos(x,t); } return cq; };
  const pos=()=>{ const q=Q(); return C.Cartesian3.fromDegrees(q.lon,q.lat,Math.max(q.alt,mi.R+mi.gH+0.4)); };
  x.ent=V.entities.add({position:new C.CallbackProperty(pos,false),
    orientation:new C.CallbackProperty(()=>C.Transforms.headingPitchRollQuaternion(pos(),new C.HeadingPitchRoll(C.Math.toRadians(x.hdg-90),C.Math.toRadians(x.vs>2?7:x.vs<-1?-2.5:0),0)),false),
    model:{uri:mi.uri,scale:1,minimumPixelSize:24,maximumScale:20000,runAnimations:false},
    label:{text:name,font:'600 11px system-ui',fillColor:C.Color.WHITE,outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-26),distanceDisplayCondition:new C.DistanceDisplayCondition(200,25000),scale:0.9}});
  x.Q=Q; TR.list.push(x);
}
function trTick(){
  if(typeof G==='undefined'||!G||!G.viewer||document.getElementById('globe').hidden||!G.follow||(typeof MAPOPT!=='undefined'&&MAPOPT.rival===false)){ if(TR.list.length&&(!G||!G.viewer||!G.follow)) trClear(); return; }
  if(TR.viewer!==G.viewer){ TR.list=[]; TR.viewer=G.viewer; }
  if(typeof P3!=='undefined'&&P3.since&&performance.now()-P3.since<12000) return;   // laisser la 3D démarrer avant d'ajouter le trafic
  const ac=S.fleet.find(a=>a.id===G.follow), st=ac&&ac.flight&&flightState(ac,gSimNow()); if(!st){ trClear(); return; }
  const t=gSimNow(), me={lat:st.lat,lon:st.lon};
  // on retire ceux qui sont trop loin ou arrivés
  for(const x of TR.list.slice()){ const q=x.Q(); if(gcDist(me,q)>70||(x.end&&q.d>x.end)||q.alt<0){ try{ G.viewer.entities.remove(x.ent); }catch(e){} TR.list.splice(TR.list.indexOf(x),1); } }
  const mob=typeof GQ!=='undefined'&&GQ.mob&&!GQ.hq, want=TR.cap!=null?TR.cap:(mob?4:8);   // plafond abaissé si la 3D rame (perf3d.js)
  const near=st.alt<3500||st.phase<=2||st.phase>=6, apc=st.phase<=3?st.from:st.to, codes=trAirlines(apc||S.company.hub), pick1=()=>codes[Math.floor(Math.random()*Math.min(codes.length,8))];
  let guard=0;
  while(TR.list.length<want&&guard++<6){
    const code=pick1();
    if(near&&apc&&runwaysOf(apc).length&&Math.random()<0.6){
      // trafic d'aéroport : finale (alignée sur la piste, plan de 3°) ou décollage
      const rws=runwaysOf(apc), rw=rws[Math.floor(Math.random()*rws.length)], A=AP(apc), el=typeof gElev==='function'?gElev(apc):0;
      if(Math.random()<0.6){ const d=8+Math.random()*12, s0=destPt(rw.thr.lat,rw.thr.lon,(rw.hdg+180)%360,d); if(gcDist(me,s0)<5) continue;   // jamais collé à votre avion
        trAdd({code,mid:TR_MODELS.nb[Math.floor(Math.random()*3)],lat:s0.lat,lon:s0.lon,hdg:rw.hdg,alt:el+d*1000*0.0524,vs:-75*0.0524,spd:75,floor:el,t0:t,end:d*1000+rw.len*0.4}); }
      else { trAdd({code,mid:TR_MODELS.nb[Math.floor(Math.random()*3)],lat:rw.thr.lat,lon:rw.thr.lon,hdg:rw.hdg,alt:el,vs:9,spd:85,t0:t-Math.random()*40000,end:30000}); }
    } else {
      // croisière : à un autre niveau de vol, qui croise ou longe votre route
      const b=Math.random()*360, d=8+Math.random()*30, p=destPt(st.lat,st.lon,b,d), sep=(Math.random()<0.5?-1:1)*(300+Math.round(Math.random()*4)*300);
      const hdg=Math.random()<0.5?(st.hdg+180+(Math.random()-0.5)*40)%360:(b+180+(Math.random()-0.5)*90)%360;
      trAdd({code,mid:Math.random()<0.35?TR_MODELS.wb[Math.floor(Math.random()*3)]:TR_MODELS.nb[Math.floor(Math.random()*3)],lat:p.lat,lon:p.lon,hdg:(hdg+360)%360,alt:Math.max(1500,(st.alt>6000?st.alt:9500)+sep),vs:0,spd:235,t0:t});
    }
  }
}
function trHook(){ if(trHook.done) return; trHook.done=true; setInterval(()=>{ try{ trTick(); }catch(e){ console.warn('trafic 3D',e); } },2000); }
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ trHook(); }catch(e){ console.warn(e); } },0));
