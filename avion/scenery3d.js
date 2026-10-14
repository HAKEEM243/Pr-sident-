/* =========================================================
   Sky Empire — décor 3D plus vivant, sans alourdir le jeu
   1. Villes : les bâtiments OpenStreetMap sans hauteur connue
      prennent une hauteur plausible (tours au centre des grandes
      villes, maisons en périphérie) ; la nuit, fenêtres allumées.
   2. Aéroports : hangars, gare cargo et conteneurs, dépôt de
      carburant, parkings et voitures, hôtel, arbres — tout dans
      UN SEUL dessin (une primitive Cesium) par aéroport.
   Décor généré (formes simples), pas des modèles des vrais bâtiments.
   ========================================================= */
'use strict';
// centres-villes (lat, lon) : tours et immeubles autour
const CITY_CENTERS={Kinshasa:[-4.3195,15.3070],Lubumbashi:[-11.6640,27.4790],Goma:[-1.6790,29.2260],'Mbuji-Mayi':[-6.1360,23.5900],Kisangani:[0.5150,25.1910],
  Bukavu:[-2.5080,28.8610],Kananga:[-5.8960,22.4170],Kolwezi:[-10.7160,25.4740],Matadi:[-5.8170,13.4500],Brazzaville:[-4.2660,15.2830],Luanda:[-8.8150,13.2300],
  Lagos:[6.4500,3.4000],Nairobi:[-1.2860,36.8170],Johannesburg:[-26.2040,28.0470],Addis:[9.0100,38.7600],'Addis-Abeba':[9.0100,38.7600],Abidjan:[5.3200,-4.0200],Dakar:[14.6930,-17.4470],
  Accra:[5.5560,-0.1970],'Le Caire':[30.0440,31.2360],Casablanca:[33.5950,-7.6190],Paris:[48.8566,2.3522],Londres:[51.5072,-0.1276],Bruxelles:[50.8467,4.3525],
  Dubaï:[25.1972,55.2744],Doha:[25.2854,51.5310],Istanbul:[41.0082,28.9784],'New York':[40.7128,-74.0060],Tokyo:[35.6812,139.7671],Pékin:[39.9042,116.4074],
  Shanghai:[31.2304,121.4737],'Hong Kong':[22.2800,114.1600],Singapour:[1.2840,103.8510],Francfort:[50.1109,8.6821],Madrid:[40.4168,-3.7038],Rome:[41.9028,12.4964]};
// population de la ville (millions) pour la hauteur des tours : population du jeu si connue, sinon trafic de l'aéroport
function _scCityPop(city){ let best=0; for(const c of AIRPORT_CODES){ const a=AP(c); if(a.city!==city) continue; const p=typeof cityPop==='function'?cityPop(c):null; best=Math.max(best,p||Math.min(20,(a.traffic||0)*0.4)); } return best||1; }
let _scCC=null;
function _scCenters(){ if(_scCC) return _scCC; _scCC=Object.entries(CITY_CENTERS).map(([n,[lat,lon]])=>({n,lat,lon,pop:_scCityPop(n)})); return _scCC; }
const _scRnd=id=>{ let x=(id*2654435761)>>>0; x^=x>>>15; x=(x*2246822519)>>>0; x^=x>>>13; return (x>>>0)/4294967296; };
function sceneryHeight(el,g,t,h){
  const b=t.building; if(b==='house'||b==='detached'||b==='hut'||b==='garage'||b==='shed'||b==='roof') return h;
  const p=g[0], r=_scRnd(el.id); let best=null, bd=1e9;
  for(const c of _scCenters()){ if(Math.abs(c.lat-p.lat)>0.4||Math.abs(c.lon-p.lon)>0.4) continue; const d=gcDist(c,p); if(d<bd){ bd=d; best=c; } }
  if(!best||bd>14) return h;
  // aire au sol (m²) : les grandes emprises deviennent des immeubles, les petites restent basses
  let area=0; for(let i=0;i<g.length-1;i++){ area+=(g[i].lon*g[i+1].lat-g[i+1].lon*g[i].lat); } area=Math.abs(area/2)*111320*111320*Math.cos(p.lat*Math.PI/180);
  const big=Math.min(1,area/1500), core=Math.max(0,1-bd/(2+Math.sqrt(best.pop)*1.2)), mid=Math.max(0,1-bd/9);
  const maxH=40+Math.sqrt(best.pop)*35;   // Kinshasa (17 M) : tours jusqu'à ~180 m
  if(core>0&&big>0.3&&r<0.55) return Math.max(h,12+maxH*core*(0.35+0.65*r)*big);
  if(mid>0&&r<0.6) return Math.max(h,6+mid*22*(0.4+r)*(0.5+big));
  return h;
}
function sceneryColor(el,t,h,col){
  const C=Cesium, r=_scRnd(el.id+7);
  if(typeof AP3D!=='undefined'&&AP3D.night){   // la nuit : fenêtres éclairées, plus nombreuses dans les grands immeubles
    const lit=h>15?0.75:0.45; if(r<lit){ const w=0.55+0.4*_scRnd(el.id+11); return new C.Color(w,w*0.82,w*0.5,1); }
    return new C.Color(0.10,0.11,0.14,1); }
  if(h<9&&r<0.55){ const k=_scRnd(el.id+3); return k<0.35?new C.Color(0.55,0.33,0.22,1):k<0.6?new C.Color(0.62,0.64,0.66,1):k<0.8?new C.Color(0.30,0.42,0.58,1):new C.Color(0.78,0.74,0.66,1); }   // toits de tôle (rouille, gris, bleu)
  if(h>40){ const k=_scRnd(el.id+5); return k<0.5?new C.Color(0.42,0.55,0.66,1):k<0.8?new C.Color(0.70,0.74,0.78,1):new C.Color(0.86,0.84,0.78,1); }   // tours de verre
  return col;
}

/* ---------- décor des aéroports ---------- */
function airportScenery(code,N){
  const C=Cesium, V=G.viewer, A=AP(code), ap=apronOf(code), r=ap&&ap.rw; if(!A||!r) return;
  const EL=typeof gElev==='function'?gElev(code):0, s=ap.side, gx=ap.x, a0=ap.a, big=A.cls>=3, lite=GQ.mini||G.lite, night=!!AP3D.night;
  const span=Math.round((big?1900:700)*(1+0.1*Math.min(5,A.xp||0))), inst=[], hdg=r.hdg, hR=C.Math.toRadians(hdg);
  const col=(h,a=1)=>C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString(h).withAlpha(a));
  const at=(along,side,z)=>{ const p=fromRw(r,along,side); return C.Cartesian3.fromDegrees(p.lon,p.lat,EL+(z||0)); };
  const frame=(along,side,z,rot)=>C.Transforms.headingPitchRollToFixedFrame(at(along,side,z),new C.HeadingPitchRoll(hR+(rot||0),0,0));
  // boîte : longueur le long de la piste (L), profondeur (W), hauteur (H)
  const box=(along,side,L,W,H,c,rot,z0)=>{ const m=frame(along,side,(z0||0)+H/2,rot); inst.push(new C.GeometryInstance({geometry:C.BoxGeometry.fromDimensions({dimensions:new C.Cartesian3(W,L,H),vertexFormat:C.PerInstanceColorAppearance.VERTEX_FORMAT}),modelMatrix:m,attributes:{color:col(c)}})); };
  const cyl=(along,side,R,H,c,top,z0)=>{ const m=frame(along,side,(z0||0)+H/2); inst.push(new C.GeometryInstance({geometry:new C.CylinderGeometry({length:H,topRadius:top==null?R:top,bottomRadius:R,slices:lite?8:14,vertexFormat:C.PerInstanceColorAppearance.VERTEX_FORMAT}),modelMatrix:m,attributes:{color:col(c)}})); };
  const land=x=>gx+s*x;   // côté ville (derrière le terminal)
  const win=night?'#ffd98a':'#2b4f73';
  // hangars de maintenance, du côté des pistes, au-delà du bout du terminal
  const nH=big?3:1;
  const cc=(S.company&&S.company.color)||'#ffd60a';
  for(let i=0;i<nH;i++){ const a=a0-span/2-280-i*170, L=big?140:90, W=big?100:70, H=big?30:20; box(a,land(70),L,W,H,'#d1d5db'); box(a,land(70),L*0.9,W*0.7,H+5,'#e5e7eb'); box(a,land(70)-s*(W/2+0.6),L*0.92,1.2,H-4,night?'#fef3c7':'#475569'); box(a,land(70)-s*(W/2+0.8),L*0.94,1,3,cc,0,H-6); }
  // gare cargo + conteneurs, de l'autre côté
  if(big){ const a=a0+span/2+(A.xp>=4?span*0.55+700:420); box(a,land(70),200,60,14,'#e5e7eb'); box(a,land(70),204,62,1.5,'#f97316');
    if(!lite) for(let i=0;i<10;i++) for(let j=0;j<2;j++) box(a-80+i*17,land(20)-s*j*4,12,2.4,2.6+(i%3===0?2.6:0),['#dc2626','#2563eb','#16a34a','#f59e0b','#475569'][(i+j*3)%5]); }
  // dépôt de carburant : cuves rondes
  const fa=a0-span/2-120, fx=land(380);
  for(let i=0;i<(big?4:2);i++) for(let j=0;j<2;j++){ cyl(fa-i*48,fx+s*j*48,17,15,'#f1f5f9'); cyl(fa-i*48,fx+s*j*48,17.3,1.4,'#dc2626',null,11); cyl(fa-i*48,fx+s*j*48,17,1.2,'#cbd5e1',12,15); }
  // parkings avec voitures, devant le terminal côté ville
  const pk=land(230), pl=Math.min(span*0.8,900);
  box(a0,pk,pl,90,0.25,'#374151');
  if(!lite){ const cars=['#f8fafc','#111827','#9ca3af','#b91c1c','#1d4ed8','#e5e7eb','#78716c']; let k=0;
    for(let x=-pl/2+10;x<pl/2-10;x+=6.5) for(const row of [-32,-10,10,32]) if(_scRnd(k++ + code.charCodeAt(0)*97)<0.72) box(a0+x,pk+s*row,4.5,1.9,1.5,cars[k%cars.length]); }
  // route d'accès et tour de bureaux / hôtel
  box(a0,land(300),span+600,16,0.3,'#4b5563');
  const hh=big?(A.xp>=5?75:45):18;
  box(a0+span*0.3,land(330),40,26,hh,'#cbd5e1'); box(a0+span*0.3,land(330)-s*13.2,36,0.6,hh-4,win);
  if(big&&A.xp>=5){ box(a0-span*0.3,land(340),34,24,hh*0.8,'#e2e8f0'); box(a0-span*0.3,land(340)-s*12.2,30,0.6,hh*0.8-4,win); }
  // arbres le long de la route
  if(!lite) for(let x=-span/2-250;x<span/2+250;x+=28){ const z=_scRnd(Math.round(x)+code.charCodeAt(1)); cyl(a0+x,land(312)+s*(z*6),0.8,5,'#78350f'); cyl(a0+x,land(312)+s*(z*6),6+z*3,10+z*5,z<0.5?'#166534':'#15803d',0.5,4); }
  if(!inst.length) return;
  const prim=V.scene.primitives.add(new C.Primitive({geometryInstances:inst, appearance:new C.PerInstanceColorAppearance({flat:false,closed:true}), asynchronous:true, shadows:GQ.hq?C.ShadowMode.ENABLED:C.ShadowMode.DISABLED}));
  N.rwy.push(prim);
}
if(typeof airportProps==='function'){ const _ap=airportProps; airportProps=function(code,N){ _ap(code,N); try{ if(!window.SE_SAFE) airportScenery(code,N); }catch(e){ console.warn(e); } }; }
