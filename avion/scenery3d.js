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
  if(typeof AP3D!=='undefined'&&AP3D.night&&typeof osmBuildCell!=='function'){ const lit=h>15?0.75:0.45; if(r<lit){ const w=0.55+0.4*_scRnd(el.id+11); return new C.Color(w,w*0.82,w*0.5,1); } return new C.Color(0.10,0.11,0.14,1); }
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
  const prim=V.scene.primitives.add(new C.Primitive({geometryInstances:inst, appearance:new C.PerInstanceColorAppearance({flat:false,closed:true,translucent:false}), asynchronous:true, shadows:GQ.hq?C.ShadowMode.ENABLED:C.ShadowMode.DISABLED}));
  N.rwy.push(prim);
}
if(typeof airportProps==='function'){ const _ap=airportProps; airportProps=function(code,N){ _ap(code,N); try{ if(!window.SE_SAFE) airportScenery(code,N); }catch(e){ console.warn(e); } }; }

/* ---------- bâtiments détaillés : façades avec fenêtres, toits en pente ----------
   Les formes au sol sont les vraies (OpenStreetMap). Un petit shader dessine sur les murs
   les étages, les fenêtres et les vitrines ; la nuit, une partie des fenêtres s'allume
   (selon la position réelle du soleil). Les maisons basses reçoivent un toit à 4 pans. */
const FACADE_VS=`in vec3 position3DHigh;
in vec3 position3DLow;
in vec3 normal;
in vec4 color;
in float batchId;
out vec3 v_positionEC;
out vec3 v_normalEC;
out vec4 v_color;
out vec3 v_fac;
out vec3 v_sty;
out float v_night;
void main(){
  vec4 p = czm_computePosition();
  vec3 orgh = czm_batchTable_orgh(batchId), orgl = czm_batchTable_orgl(batchId), sty = czm_batchTable_sty(batchId);
  vec3 local = (position3DHigh - orgh) + (position3DLow - orgl);
  vec3 up = normalize(orgh + orgl);
  float wall = 1.0 - step(0.6, abs(dot(normal, up)));
  vec3 tg = cross(up, normal); float tl = length(tg); tg = tl > 1e-4 ? tg / tl : vec3(1.0, 0.0, 0.0);
  v_fac = vec3(dot(local, up), dot(local, tg), wall);
  v_sty = sty;
  v_night = 1.0 - step(-0.04, dot(czm_sunDirectionWC, up));
  v_positionEC = (czm_modelViewRelativeToEye * p).xyz;
  v_normalEC = czm_normal * normal;
  v_color = color;
  gl_Position = czm_modelViewProjectionRelativeToEye * p;
}`;
const FACADE_FS=`in vec3 v_positionEC;
in vec3 v_normalEC;
in vec4 v_color;
in vec3 v_fac;
in vec3 v_sty;
in float v_night;
float hsh(vec2 q){ return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 positionToEyeEC = -v_positionEC;
  vec3 normalEC = normalize(v_normalEC);
  vec4 color = czm_gammaCorrect(v_color);
  vec3 emis = vec3(0.0);
  float d = length(v_positionEC);
  if (v_fac.z > 0.5) {
    float fh = v_sty.x, h = v_fac.x, s = v_fac.y, dens = v_sty.y, seed = v_sty.z;
    float fl = floor(h / fh), fy = fract(h / fh), cx = floor(s / 2.8), fx = fract(s / 2.8);
    float near = clamp(1.0 - (d - 700.0) / 2600.0, 0.0, 1.0);
    bool curtain = dens > 0.9;
    float wx0 = curtain ? 0.05 : 0.2, wy0 = curtain ? 0.12 : 0.3, wy1 = curtain ? 0.94 : 0.82;
    bool inWin = fy > wy0 && fy < wy1 && fx > wx0 && fx < 1.0 - wx0 && h > 0.9;
    float r = hsh(vec2(fl, cx) + seed);
    vec3 base = color.rgb;
    if (fy < 0.07 && !curtain) base *= 0.80;                          // bandeau entre les étages
    if (h < fh && dens > 0.3 && !curtain) base *= 0.9;                // rez-de-chaussée
    vec3 c = base;
    if (inWin && r < dens) {
      vec3 glass = mix(vec3(0.13, 0.18, 0.25), vec3(0.42, 0.52, 0.62), hsh(vec2(cx * 1.7, fl) + seed) * 0.7);
      if (fl < 0.5 && dens > 0.3 && !curtain) glass = mix(glass, vec3(0.55, 0.45, 0.30), 0.35); // vitrines
      c = glass;
      if (v_night > 0.5 && r < dens * 0.62) emis = vec3(1.0, 0.80, 0.48) * (0.55 + 0.45 * hsh(vec2(fl * 3.1, cx))) * clamp(1.0 - (d - 4000.0) / 8000.0, 0.0, 1.0);
    }
    color.rgb = mix(base, c, near);
    if (v_night > 0.5 && near < 1.0 && dens > 0.2) emis = max(emis, vec3(1.0, 0.82, 0.5) * 0.18 * dens * (1.0 - near));
  }
  czm_materialInput materialInput;
  materialInput.normalEC = normalEC;
  materialInput.positionToEyeEC = positionToEyeEC;
  czm_material material = czm_getDefaultMaterial(materialInput);
  material.diffuse = color.rgb;
  material.alpha = 1.0;
  material.emission = emis;
  out_FragColor = czm_phong(normalize(positionToEyeEC), material, czm_lightDirectionEC);
}`;
let _facadeApp=null;
function facadeAppearance(){ const C=Cesium; return new C.PerInstanceColorAppearance({flat:false, closed:true, translucent:false, vertexShaderSource:FACADE_VS, fragmentShaderSource:FACADE_FS}); }
const ROOF_TIN=['#8b4a2b','#9a5634','#7c8288','#5d6b78','#3f5f86','#a33b2b','#6b7280','#b45309'];
function osmBuildCell(elements,gb){
  const C=Cesium, V=G.viewer, inst=[], roofs=[], VF=C.PerInstanceColorAppearance.VERTEX_FORMAT, FL=C.ComponentDatatype.FLOAT;
  const attr=v=>new C.GeometryInstanceAttribute({componentDatatype:FL,componentsPerAttribute:3,value:v});
  for(const el of elements){
    const g=el.geometry; if(!g||g.length<4) continue;
    const t=el.tags||{}; if(!t.building) continue;
    let h=parseFloat(t.height)||(parseFloat(t['building:levels'])||0)*3.2;
    const b=t.building;
    if(!h) h=b==='house'||b==='residential'||b==='detached'?6:b==='hangar'||b==='industrial'||b==='warehouse'?11:b==='terminal'||b==='transportation'?16:b==='apartments'?15:b==='commercial'||b==='office'?18:4+((el.id%7));
    if(!t.height&&!t['building:levels']) h=sceneryHeight(el,g,t,h);
    h=Math.min(h,450);
    const shade=0.78+((el.id%13)/13)*0.16, tall=Math.min(1,h/80);
    let col=new C.Color(shade-0.1*tall,shade-0.06*tall,shade-0.02*tall+(b==='hangar'?0.05:0),1);
    try{ col=sceneryColor(el,t,h,col); }catch(err){}
    const base=gb(g[0]), enc=C.EncodedCartesian3.fromCartesian(C.Cartesian3.fromDegrees(g[0].lon,g[0].lat,base-1));
    const indus=/hangar|industrial|warehouse|garage|shed|roof/.test(b), dens=indus?0.06:h>40?0.95:h>14?0.82:0.6;
    try{ inst.push(new C.GeometryInstance({id:'b'+el.id, geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(g.slice(0,-1).flatMap(v=>[v.lon,v.lat]))), height:base-1, extrudedHeight:base+h, vertexFormat:VF}),
      attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(col), orgh:attr([enc.high.x,enc.high.y,enc.high.z]), orgl:attr([enc.low.x,enc.low.y,enc.low.z]), sty:attr([h>40?3.7:3.1, dens, (el.id%997)/7.3])}})); }catch(err){ continue; }
    // toit à 4 pans sur les maisons rectangulaires (tôle de couleur)
    if(h<=9&&!GQ.mini&&g.length>=5&&g.length<=8) try{ const r=_roofFrame(g); if(r&&r.L*r.W<450&&r.fill>0.78){
      const rh=Math.min(2.6,0.32*Math.min(r.L,r.W)), ctr=C.Cartesian3.fromDegrees(r.lon,r.lat,base+h);
      let m=C.Transforms.eastNorthUpToFixedFrame(ctr); m=C.Matrix4.multiply(m,C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationZ(r.ang)),new C.Matrix4());
      m=C.Matrix4.multiply(m,C.Matrix4.fromScale(new C.Cartesian3(r.L+0.6,r.W+0.6,rh)),new C.Matrix4());
      m=C.Matrix4.multiply(m,C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationZ(Math.PI/4),new C.Cartesian3(0,0,0.5)),new C.Matrix4());
      const rc=C.Color.fromCssColorString(ROOF_TIN[el.id%ROOF_TIN.length]);
      roofs.push(new C.GeometryInstance({geometry:new C.CylinderGeometry({length:1,topRadius:0,bottomRadius:Math.SQRT1_2,slices:4,vertexFormat:VF}),modelMatrix:m,attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(rc)}})); } }catch(err){}
  }
  if(!inst.length) return null;
  const col=new C.PrimitiveCollection();
  col.add(new C.Primitive({geometryInstances:inst, appearance:facadeAppearance(), asynchronous:true, shadows:C.ShadowMode.DISABLED}));
  if(roofs.length) col.add(new C.Primitive({geometryInstances:roofs, appearance:new C.PerInstanceColorAppearance({flat:false,closed:true,translucent:false}), asynchronous:true}));
  V.scene.primitives.add(col); return col;
}
// rectangle orienté d'une emprise (axe = plus long côté) : centre, longueur, largeur, angle, taux de remplissage
function _roofFrame(g){
  const lat0=g[0].lat, kx=111320*Math.cos(lat0*Math.PI/180), ky=110540, P=g.slice(0,-1).map(q=>[(q.lon-g[0].lon)*kx,(q.lat-lat0)*ky]);
  let best=0, ang=0; for(let i=0;i<P.length;i++){ const a=P[i], b=P[(i+1)%P.length], l=Math.hypot(b[0]-a[0],b[1]-a[1]); if(l>best){ best=l; ang=Math.atan2(b[1]-a[1],b[0]-a[0]); } }
  const ca=Math.cos(ang), sa=Math.sin(ang); let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9, area=0;
  for(let i=0;i<P.length;i++){ const [x,y]=P[i], u=x*ca+y*sa, v=-x*sa+y*ca; u0=Math.min(u0,u); u1=Math.max(u1,u); v0=Math.min(v0,v); v1=Math.max(v1,v); const n=P[(i+1)%P.length]; area+=x*n[1]-n[0]*y; }
  const L=u1-u0, W=v1-v0; if(L<3||W<3) return null;
  const uc=(u0+u1)/2, vc=(v0+v1)/2, x=uc*ca-vc*sa, y=uc*sa+vc*ca;
  return {L,W,ang,fill:Math.abs(area/2)/(L*W),lat:lat0+y/ky,lon:g[0].lon+x/kx};
}
