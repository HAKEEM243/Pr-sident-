/* =========================================================
   Sky Empire — cerveau des compagnies, sécurité et accidents visibles
   • Chaque compagnie a un indice de sécurité (estimation de jeu, pas une
     note officielle) : les moins bien notées ont plus d'accidents.
   • Les compagnies décident comme un joueur : croître, se serrer la
     ceinture, renouveler la flotte, vendre / racheter des avions
     d'occasion, investir dans la sécurité, ou dériver et régresser.
   • Les accidents apparaissent sur la carte 2D (💥 🔥 ⚠️) et en vue 3D
     (flammes et colonne de fumée), pendant quelques semaines.
   ========================================================= */
'use strict';
// indice de sécurité du jeu (1 = moyenne). Estimation fictive inspirée de la réputation publique ; modifiable.
const AI_SAFE={AI:0.5,IX:0.6,PK:0.4,PA:0.55,PF:0.5,'9P':0.55,SG:0.55,RA:0.4,YT:0.5,U4:0.55,N9:0.5,H9:0.6,FG:0.35,RQ:0.35,JS:0.3,IR:0.45,W5:0.4,B9:0.5,IS:0.5,QB:0.5,SD:0.4,UM:0.4,FN:0.55,J4:0.4,'3T':0.45,JT:0.5,SJ:0.45,IL:0.4,IN:0.5,GA:0.75,ID:0.8,QG:0.8,UB:0.55,'7Y':0.5,'8M':0.55,DH:0.4,IY:0.4,NB:0.45,UZ:0.45,YL:0.4,LN:0.45,W3:0.5,QI:0.6,R4:0.5,VK:0.5,P4:0.7,OF:0.6,NA:0.55,UN:0.6,TC:0.7,'2J':0.6,DT:0.45,CU:0.5,V0:0.5,'9V':0.5,'5R':0.5,QL:0.5,T9:0.5,RB:0.35,IA:0.5,DV:0.6,DN:0.7,MS:0.9,SU:0.95,
  QF:1.6,SQ:1.5,CX:1.45,NH:1.5,JL:1.5,EK:1.35,EY:1.35,QR:1.4,LH:1.4,AF:1.3,KL:1.4,AY:1.5,BA:1.35,DL:1.45,UA:1.3,AA:1.3,WN:1.35,AC:1.4,LX:1.5,OS:1.4,KE:1.15,CI:1.05,TK:1.2,ET:1.0,AT:1.0,KQ:0.85,SA:0.95,AI_:0.5};
function aiSafetyOf(code){ if(AI_SAFE[code]!==undefined) return AI_SAFE[code]; let h=0; for(const c of code) h=(h*31+c.charCodeAt(0))%97; return +(0.9+h/97*0.45).toFixed(2); }
const aiHash=s=>{ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))%1009; return h; };
function aiBrainInit(){
  if(!S||!S.ai) return;
  // les compagnies réputées moins sûres font partie du jeu même si leur réseau est petit (elles peuvent avoir des accidents)
  if(!S.ai.weakAdded){ S.ai.weakAdded=1; const mine=S.company.code;
    for(const [c,v] of Object.entries(AI_SAFE)) if(v<=0.6&&c!==mine&&typeof AIRLINE_DB!=='undefined'&&AIRLINE_DB[c]&&AP(AIRLINE_DB[c][2])&&!S.ai.list.some(e=>e.code===c)) S.ai.list.push(makeAI(c)); }
  for(const e of S.ai.list){
    if(!e.safeSet&&e.real){ e.safety=aiSafetyOf(e.code); e.safeSet=1; }
    if(e.age===undefined) e.age=+(5+aiHash(e.code)%100/10).toFixed(1);
    if(!e.plan) e.plan={mode:'steady',until:0};
  }
}
// probabilité d'accident par semaine : plus haute pour les compagnies peu sûres et à flotte vieillissante
function aiRisk(e){ return Math.min(0.05,0.0055*Math.sqrt(Math.max(1,e.fleet)/100)*Math.pow(1/Math.max(0.25,e.safety||1),1.5)*(e.startup?1.4:1)*(1+Math.max(0,(e.age||8)-12)*0.05)); }

/* ---------- décisions des compagnies ---------- */
const PLAN_TXT={grow:'accélère son expansion',retrench:'se serre la ceinture',renew:'prépare le renouvellement de sa flotte',steady:'garde le cap'};
function aiSell(e,n,why){
  const ai=S.ai; n=Math.min(n,Math.max(0,e.fleet-(e.fleet>5?3:1))); if(n<=0) return 0;
  e.fleet-=n; e.cash+=n*rnd(4e6,11e6)*Math.max(0.3,1-(e.age||8)/35);
  const buyers=aiAlive().filter(b=>b!==e&&b.cash>b.fleet*18e6&&b.fleet<Math.max(300,e.fleet*4)), b=buyers.length&&Math.random()<0.6?pick(buyers):null;
  let txt;
  if(b){ b.fleet+=n; b.cash-=n*rnd(3e6,7e6); b.age=Math.max(2,(b.age||8)+n/Math.max(1,b.fleet)*(9-(b.age||8))); const RB=(S.rivals||[]).find(x=>x.code===b.code); if(RB) RB.fleet=b.fleet;
    txt=`🔁 ${e.name} cède ${n} avion${n>1?'s':''} d’occasion à ${b.name}${why?` (${why})`:''}.`; }
  else txt=`📉 ${e.name} met ${n} avion${n>1?'s':''} en vente${why?` (${why})`:''}.`;
  if(e.fleet>=40||n>=4||(b&&b.fleet>=40)) aiNews(txt,'news',e.fleet>=100&&n>=6);
  return n;
}
function aiBrain(e,oilF,margin){
  const ai=S.ai, plan=e.plan||(e.plan={mode:'steady',until:0});
  e.mavg=(e.mavg===undefined?margin:e.mavg)*0.9+margin*0.1; e.age=Math.min(30,(e.age||8)+1/52);
  const poor=e.cash<e.fleet*3e6, rich=e.cash>e.fleet*(e.startup?10e6:24e6);
  // 1. cap stratégique, revu toutes les 6 à 14 semaines
  if(S.time>plan.until){
    const old=plan.mode;
    const mode=(e.cash<0||e.mavg<-0.15||(oilF<0.8&&poor))?'retrench':(rich&&e.mavg>0.15)?'grow':(e.age>13&&!poor)?'renew':'steady';
    e.plan={mode,until:S.time+rndi(6,14)*7*DAY};
    if(mode!==old&&e.fleet>=60&&mode!=='steady'&&Math.random()<0.5) aiNews(`🧠 ${e.name} ${PLAN_TXT[mode]}.`,'news');
  }
  const m=e.plan.mode;
  // 2. actions selon le cap
  if(m==='retrench'){
    if(Math.random()<0.22) aiSell(e,Math.max(1,Math.ceil(e.fleet*rnd(0.02,0.06))),poor?'crise de trésorerie':oilF<0.8?'carburant trop cher':'rationalisation');
    if(Math.random()<0.1) e.safety=Math.max(0.3,(e.safety||1)-0.02);                 // économies sur la maintenance : le risque monte
  } else if(m==='grow'){
    if(Math.random()<0.2){ const n=Math.max(1,Math.round(e.fleet*rnd(0.02,0.06))); e.fleet+=n; e.cash-=n*rnd(2e6,5e6); e.age=Math.max(2,e.age-n/e.fleet*e.age*0.6);
      if(n>=4) aiNews(`🛫 ${e.name} loue ${n} avions pour absorber la demande : ${e.fleet} appareils.`,'news',e.fleet>=100&&n>=8); }
  } else if(m==='renew'){
    if(Math.random()<0.22){ const n=Math.max(1,Math.ceil(e.fleet*rnd(0.05,0.1))); e.cash-=n*rnd(4e6,8e6); e.age=Math.max(3,e.age-n/e.fleet*(e.age-3)*1.4); e.safety=Math.min(1.6,(e.safety||1)+0.02); e.rep=clamp(e.rep+0.6,20,95);
      if(e.fleet>=60) aiNews(`🆕 ${e.name} renouvelle sa flotte : ${n} appareils récents remplacent des avions de ${Math.round(e.age+3)} ans.`,'news'); }
  } else if(e.rep<50&&e.cash>e.fleet*8e6&&Math.random()<0.05){ e.cash-=e.fleet*0.4e6; e.rep=clamp(e.rep+2.5,20,95); if(e.fleet>=60) aiNews(`📣 ${e.name} lance une campagne pour redorer son image.`,'news'); }
  // 3. la sécurité revient lentement vers sa valeur de base (investissements) ; apprendre ou régresser
  if(e.real){ const base=aiSafetyOf(e.code); e.safety=+((e.safety||base)+(base-(e.safety||base))*0.01).toFixed(3); }
  e.skill=clamp((e.skill||0)+(e.mavg>0.15?0.004:e.mavg<-0.1?-0.005:0)+rnd(-0.003,0.003),-0.6,0.5);
}
// patch : lors d'un accident, position sur la route, retour d'expérience
{ const _aa=aiAccident; aiAccident=function(e){ const prev=S.ai.crashes[0]; _aa(e); const c=S.ai.crashes[0]; if(!c||c===prev) return;
    const A=AP(c.a), B=AP(c.b), f=c.sev==='incident'?rnd(0.9,0.99):c.sev==='hull'?(Math.random()<0.5?rnd(0.01,0.04):rnd(0.96,0.99)):rnd(0.12,0.88);
    const p=A&&B?gcInterp(A,B,f):{lat:0,lon:0}; c.lat=+p.lat.toFixed(3); c.lon=+p.lon.toFixed(3); c.id='c'+Math.round(S.time/1000);
    e.safety=Math.min(1.6,(e.safety||1)+(c.sev==='fatal'?0.12:0.05)); e.lastCrash=S.time; e.plan={mode:'steady',until:S.time+10*7*DAY};
    if(c.sev==='fatal'&&typeof toast==='function'&&!UI.silent) toast(`💥 Accident : ${e.name} — voir la carte`,'bad'); crashSync(); }; }
{ const _aw=aiWeekly; aiWeekly=function(){ aiBrainInit(); _aw(); }; }

/* ---------- accidents sur la carte 2D ---------- */
const CRASH_TTL={fatal:35,hull:21,incident:6};
const crashAlive=c=>c.lat!==undefined&&(S.time-c.t)<CRASH_TTL[c.sev]*DAY;
const CRASH_ICON={fatal:'💥',hull:'🔥',incident:'⚠️'};
function crashSync(){
  if(typeof S==='undefined'||!S||!S.ai) return; const list=(S.ai.crashes||[]).filter(crashAlive);
  if(typeof map!=='undefined'&&map&&typeof L!=='undefined'){
    if(!crashSync.layer) crashSync.layer=L.layerGroup().addTo(map);
    const key=list.map(c=>c.id).join(); if(crashSync.key!==key){ crashSync.key=key; crashSync.layer.clearLayers();
      for(const c of list){ const ic=L.divIcon({className:'crash-ic '+c.sev, html:`<span>${CRASH_ICON[c.sev]}</span>`, iconSize:[34,34]});
        L.marker([c.lat,c.lon],{icon:ic,zIndexOffset:900}).addTo(crashSync.layer).bindPopup(`<b>${CRASH_ICON[c.sev]} ${esc(c.name)}</b><br>${c.model} · ${esc(keyCity(c.a))} → ${esc(keyCity(c.b))}<br>${c.sev==='fatal'?`${c.victims} victimes`:c.sev==='hull'?'Avion détruit, pas de victime':'Incident, sans blessé'}<br><span class="small">${fmtDate(c.t)}</span>`); } } }
  crash3D(list);
}
/* ---------- accidents en vue 3D ---------- */
function crashImg(e){ crashImg.c=crashImg.c||{}; if(crashImg.c[e]) return crashImg.c[e]; const cv=document.createElement('canvas'); cv.width=cv.height=96; const g=cv.getContext('2d'); g.font='72px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(e,48,52); return crashImg.c[e]=cv; }
function crash3D(list){
  if(typeof G==='undefined'||!G||!G.viewer) return; const C=Cesium, V=G.viewer; G.crashE=G.crashE||new Map();
  const ids=new Set(list.map(c=>c.id));
  for(const [id,es] of G.crashE) if(!ids.has(id)){ for(const x of es) V.entities.remove(x); G.crashE.delete(id); }
  for(const c of list){ if(G.crashE.has(c.id)) continue;
    const gh=Math.max(0,typeof groundAt==='function'?groundAt(c.lat,c.lon):0), pos=C.Cartesian3.fromDegrees(c.lon,c.lat,gh);
    const big=c.sev==='fatal', es=[];
    es.push(V.entities.add({position:C.Cartesian3.fromDegrees(c.lon,c.lat,gh+(big?500:250)), cylinder:{length:big?1000:500, topRadius:big?110:70, bottomRadius:big?25:15, material:C.Color.fromCssColorString('#2b2b2b').withAlpha(0.45)}}));
    es.push(V.entities.add({position:C.Cartesian3.fromDegrees(c.lon,c.lat,gh+4), ellipsoid:{radii:new C.Cartesian3(big?35:20,big?35:20,big?14:9), material:C.Color.fromCssColorString('#ff6a00').withAlpha(0.85)},
      billboard:{image:crashImg(CRASH_ICON[c.sev]), scale:0.9, verticalOrigin:C.VerticalOrigin.BOTTOM, pixelOffset:new C.Cartesian2(0,-6), disableDepthTestDistance:Number.POSITIVE_INFINITY, scaleByDistance:new C.NearFarScalar(500,1.4,4e6,0.5)},
      label:{text:`${c.name}\n${c.model}`, font:'600 12px system-ui', fillColor:C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new C.Cartesian2(0,-52), disableDepthTestDistance:Number.POSITIVE_INFINITY, distanceDisplayCondition:new C.DistanceDisplayCondition(0,300000)}}));
    G.crashE.set(c.id,es); }
}
setInterval(()=>{ try{ crashSync(); }catch(e){} },6000);
