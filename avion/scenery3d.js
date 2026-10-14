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
  // la plupart des immeubles font quelques étages ; seules quelques grandes emprises du centre montent haut
  const big=Math.min(1,area/1500), core=Math.max(0,1-bd/(1.5+Math.sqrt(best.pop)*0.5)), mid=Math.max(0,1-bd/8);
  const maxH=25+Math.sqrt(best.pop)*13;   // Kinshasa (17 M) : ~80 m au plus pour un bâtiment sans hauteur connue
  if(core>0&&big>0.5&&r<0.3) return Math.max(h,10+maxH*core*(0.3+0.7*r)*big);
  if(core>0&&r<0.7) return Math.max(h,6+core*18*(0.4+r));
  if(mid>0&&r<0.5) return Math.max(h,5+mid*9*(0.4+r));
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
  } else {
    color.rgb = mix(color.rgb, vec3(0.60, 0.60, 0.58), 0.55);   // toit-terrasse en béton
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
const WALLS=['#f3ead8','#e9dcc0','#f1e4c8','#e2d3b5','#d9c7a3','#efe7da','#e6e1d7','#d6d9dc','#cfd8e0','#f2d9c4','#e8cfa8','#dcc9a8','#f5f0e6','#c9b79c','#e5d8c8'];
const ROOF_TIN=['#8b4a2b','#9a5634','#7c8288','#5d6b78','#3f5f86','#a33b2b','#6b7280','#b45309'];
function osmBuildCell(elements,gb,pinned){
  const C=Cesium, V=G.viewer, inst=[], roofs=[], VF=C.PerInstanceColorAppearance.VERTEX_FORMAT, FL=C.ComponentDatatype.FLOAT;
  const attr=v=>new C.GeometryInstanceAttribute({componentDatatype:FL,componentsPerAttribute:3,value:v});
  for(const el of elements){
    const g=el.geometry; if(!g||g.length<4) continue;
    const t=el.tags||{}; if(!t.building) continue;
    if(!pinned&&typeof osmSkip==='function'&&osmSkip(g[0].lat,g[0].lon)) continue;   // déjà dessiné par la case de la rive
    let h=parseFloat(t.height)||(parseFloat(t['building:levels'])||0)*3.2;
    const b=t.building;
    if(!h) h=b==='house'||b==='residential'||b==='detached'?6:b==='hangar'||b==='industrial'||b==='warehouse'?11:b==='terminal'||b==='transportation'?16:b==='apartments'?15:b==='commercial'||b==='office'?18:4+((el.id%7));
    if(!t.height&&!t['building:levels']) h=sceneryHeight(el,g,t,h);
    h=Math.min(h,450);
    const shade=0.78+((el.id%13)/13)*0.16, tall=Math.min(1,h/80);
    let col=new C.Color(shade-0.1*tall,shade-0.06*tall,shade-0.02*tall+(b==='hangar'?0.05:0),1);
    try{ col=sceneryColor(el,t,h,col); }catch(err){}
    if(h<=40){ const W=WALLS[(el.id*7)%WALLS.length]; col=C.Color.fromCssColorString(W); }   // murs peints (crème, beige, ocre, pastel…)
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
  // nom des bâtiments connus (hôtels, galeries, ministères…) au-dessus du toit
  if(!GQ.mini){ const lab=col.add(new C.LabelCollection()); let nL=0;
    for(const el of elements){ const t=el.tags||{}, g=el.geometry; if(!t.name||!g||nL>=40) continue; const lv=parseFloat(t['building:levels'])||0; if(lv<4&&!/hotel|commercial|office|public|government|hospital|church|cathedral|retail|civic/.test(t.building||'')&&!t.amenity) continue;
      let la=0,lo=0; for(const q of g){ la+=q.lat; lo+=q.lon; } la/=g.length; lo/=g.length; const hh=parseFloat(t.height)||lv*3.2||14; nL++;
      lab.add({position:C.Cartesian3.fromDegrees(lo,la,gb(g[0])+hh+8), text:t.name.length>34?t.name.slice(0,32)+'…':t.name, font:'600 12px system-ui', fillColor:C.Color.fromCssColorString('#fde68a'), outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, distanceDisplayCondition:new C.DistanceDisplayCondition(0,2200), translucencyByDistance:new C.NearFarScalar(800,1,2200,0)}); } }
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

/* ---------- parcs, jardins, terrains, marchés (OpenStreetMap) et monuments ---------- */
const X3D={cells:new Map(), busy:false, fail:0, lmCity:new Map()};
const X_COL={park:'#4f8f3c',garden:'#5a9a45',pitch:'#3f9d4a',playground:'#6aa84f',grass:'#5f9a4a',recreation_ground:'#5a9445',forest:'#2f6b2a',wood:'#2f6b2a',cemetery:'#6b8f5a',marketplace:'#a88a5c'};
function cityExtrasTick(v,agl){
  if(agl>5000||X3D.busy||X3D.fail>=4||typeof OSM_CELL==='undefined') return;
  try{ landmarksTick(v); }catch(e){ console.warn(e); }
  const i=Math.floor(v.lat/OSM_CELL), j=Math.floor(v.lon/OSM_CELL), R=GQ.mini?0:1, want=[];
  for(let di=-R;di<=R;di++) for(let dj=-R;dj<=R;dj++) want.push([i+di,j+dj,di*di+dj*dj]);
  want.sort((x,y)=>x[2]-y[2]);
  const c=want.find(([a,b])=>!X3D.cells.has(a+','+b)); if(c) extrasLoad(c[0],c[1],v);
  // ménage
  const cap=GQ.mini?2:GQ.mob&&!GQ.hq?9:16;
  while(X3D.cells.size>cap){ let far=null, fd=-1; for(const k of X3D.cells.keys()){ const [a,b]=k.split(',').map(Number), d=(a-i)**2+(b-j)**2; if(d>fd){ fd=d; far=k; } }
    const old=X3D.cells.get(far); X3D.cells.delete(far); if(old) for(const p of old) G.viewer.scene.primitives.remove(p); }
}
async function extrasLoad(i,j,v){
  const key=i+','+j; X3D.cells.set(key,[]); X3D.busy=true;
  const s=i*OSM_CELL, w=j*OSM_CELL, n=s+OSM_CELL, e=w+OSM_CELL, bb=`(${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)})`;
  const q=`[out:json][timeout:25];(way["leisure"~"^(park|garden|pitch|playground)$"]${bb};way["landuse"~"^(grass|recreation_ground|forest|cemetery)$"]${bb};way["natural"="wood"]${bb};way["amenity"="marketplace"]${bb};);out geom 500;`;
  let js=null;
  for(const ep of (typeof OSM_EP!=='undefined'?OSM_EP:['https://overpass-api.de/api/interpreter'])){ try{ const r=await fetch(ep,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'}}); if(r.ok){ js=await r.json(); break; } }catch(err){} }
  X3D.busy=false;
  if(!js){ X3D.fail++; X3D.cells.delete(key); return; }
  X3D.fail=0; if(!G||!G.viewer||!X3D.cells.has(key)) return;
  const C=Cesium, V=G.viewer, ground=[], obj=[], VF=C.PerInstanceColorAppearance.VERTEX_FORMAT, e0=typeof groundAt==='function'?groundAt(v.lat,v.lon):0;
  const gh=(lat,lon)=>{ const h=typeof groundAt==='function'?groundAt(lat,lon):0; return h>0?h:e0; };
  const treeCap=GQ.mini?0:GQ.mob&&!GQ.hq?350:1000, stallCap=GQ.mini?0:GQ.mob&&!GQ.hq?250:600; let trees=0, stalls=0;
  const enu=(lat,lon,z,rot)=>{ let m=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(lon,lat,z)); if(rot) m=C.Matrix4.multiply(m,C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationZ(rot)),new C.Matrix4()); return m; };
  const colA=(h,a)=>({color:C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString(h).withAlpha(a==null?1:a))});
  for(const el of js.elements||[]){
    const g=el.geometry, t=el.tags||{}; if(!g||g.length<4) continue;
    const kind=t.amenity==='marketplace'?'marketplace':t.leisure||t.landuse||t.natural, col=X_COL[kind]; if(!col) continue;
    try{ ground.push(new C.GeometryInstance({geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(g.slice(0,-1).flatMap(p=>[p.lon,p.lat])))}),attributes:colA(col,0.92)})); }catch(err){ continue; }
    // surface (m²) et tirage de points à l'intérieur
    const lat0=g[0].lat, kx=111320*Math.cos(lat0*Math.PI/180), ky=110540; let area=0, s0=g[0].lat, n0=s0, w0=g[0].lon, e1=w0;
    for(let x=0;x<g.length-1;x++){ area+=(g[x].lon*g[x+1].lat-g[x+1].lon*g[x].lat); s0=Math.min(s0,g[x].lat); n0=Math.max(n0,g[x].lat); w0=Math.min(w0,g[x].lon); e1=Math.max(e1,g[x].lon); }
    area=Math.abs(area/2)*kx*ky;
    const inside=(la,lo)=>{ let c=false; for(let a=0,b=g.length-2;a<g.length-1;b=a++){ if((g[a].lat>la)!==(g[b].lat>la)&&lo<(g[b].lon-g[a].lon)*(la-g[a].lat)/(g[b].lat-g[a].lat)+g[a].lon) c=!c; } return c; };
    let seed=el.id%100000; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
    if(kind==='marketplace'){   // étals couverts de bâches colorées, en rangées
      const tarps=['#2563eb','#dc2626','#f59e0b','#16a34a','#0ea5e9','#e11d48','#f8fafc'];
      for(let la=s0+3/ky;la<n0&&stalls<stallCap;la+=5/ky) for(let lo=w0+3/kx;lo<e1&&stalls<stallCap;lo+=4.5/kx){ if(!inside(la,lo)||rnd()<0.12) continue; const z=gh(la,lo); stalls++;
        obj.push(new C.GeometryInstance({geometry:C.BoxGeometry.fromDimensions({dimensions:new C.Cartesian3(3.4,3.4,0.25),vertexFormat:VF}),modelMatrix:C.Matrix4.multiplyByTranslation(enu(la,lo,z),new C.Cartesian3(0,0,2.5),new C.Matrix4()),attributes:colA(tarps[Math.floor(rnd()*tarps.length)])}));
        obj.push(new C.GeometryInstance({geometry:C.BoxGeometry.fromDimensions({dimensions:new C.Cartesian3(2.6,1.2,1.0),vertexFormat:VF}),modelMatrix:C.Matrix4.multiplyByTranslation(enu(la,lo,z),new C.Cartesian3(0,0,0.5),new C.Matrix4()),attributes:colA('#7c5a3a')})); }
      continue;
    }
    if(kind==='pitch') continue;   // terrain de sport : pelouse seulement
    const dens=kind==='forest'||kind==='wood'?1/90:kind==='cemetery'?1/400:1/220, nT=Math.min(160,Math.round(area*dens));
    for(let x=0,tries=0;x<nT&&trees<treeCap&&tries<nT*4;tries++){ const la=s0+(n0-s0)*rnd(), lo=w0+(e1-w0)*rnd(); if(!inside(la,lo)) continue; x++; trees++;
      const z=gh(la,lo), hgt=6+rnd()*9, cr=2.5+rnd()*2.5, palm=rnd()<0.3;
      obj.push(new C.GeometryInstance({geometry:new C.CylinderGeometry({length:hgt*0.6,topRadius:0.25,bottomRadius:0.35,slices:6,vertexFormat:VF}),modelMatrix:C.Matrix4.multiplyByTranslation(enu(la,lo,z),new C.Cartesian3(0,0,hgt*0.3),new C.Matrix4()),attributes:colA('#6b4423')}));
      obj.push(new C.GeometryInstance({geometry:new C.EllipsoidGeometry({radii:palm?new C.Cartesian3(cr*1.2,cr*1.2,cr*0.45):new C.Cartesian3(cr,cr,cr*0.85),stackPartitions:5,slicePartitions:7,vertexFormat:VF}),modelMatrix:C.Matrix4.multiplyByTranslation(enu(la,lo,z),new C.Cartesian3(0,0,hgt*0.6+cr*0.4),new C.Matrix4()),attributes:colA(['#2f6b2a','#3a7d32','#4a8c3a','#2c5f2d'][Math.floor(rnd()*4)])})); }
  }
  const prims=X3D.cells.get(key);
  if(ground.length) prims.push(V.scene.primitives.add(new C.GroundPrimitive({geometryInstances:ground, appearance:new C.PerInstanceColorAppearance({flat:true,translucent:false}), asynchronous:true})));
  if(obj.length) prims.push(V.scene.primitives.add(new C.Primitive({geometryInstances:obj, appearance:new C.PerInstanceColorAppearance({flat:false,closed:true,translucent:false}), asynchronous:true})));
}
// monuments connus (même liste que la vue Ville 3D) : modélisés en 3D avec leur nom
function landmarksTick(v){
  if(typeof LANDMARKS==='undefined') return;
  const C=Cesium, V=G.viewer;
  for(const [k,st] of X3D.lmCity){ if(st.viewer!==V) X3D.lmCity.delete(k); }
  for(const L of LANDMARKS){ const city=L[1]; if(X3D.lmCity.has(city)) continue; if(Math.abs(L[2]-v.lat)>0.35||Math.abs(L[3]-v.lon)>0.35) continue;
    const inst=[], ents=[], VF=C.PerInstanceColorAppearance.VERTEX_FORMAT;
    for(const [name,c2,lat,lon,parts,color] of LANDMARKS){ if(c2!==city) continue;
      const z0=typeof groundAt==='function'?Math.max(0,groundAt(lat,lon)):0, base=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(lon,lat,z0)), col={color:C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString(color))};
      const at=(dx,dy,dz)=>C.Matrix4.multiplyByTranslation(base,new C.Cartesian3(dx,dy,dz),new C.Matrix4());
      for(const [sh,w,b,t,dx=0,dy=0,l] of parts){ const H=t-b;
        if(sh==='s') inst.push(new C.GeometryInstance({geometry:C.BoxGeometry.fromDimensions({dimensions:new C.Cartesian3(2*w,2*(l||w),H),vertexFormat:VF}),modelMatrix:at(dx,dy,b+H/2),attributes:col}));
        else if(sh==='c') inst.push(new C.GeometryInstance({geometry:new C.CylinderGeometry({length:H,topRadius:w,bottomRadius:w,slices:24,vertexFormat:VF}),modelMatrix:at(dx,dy,b+H/2),attributes:col}));
        else if(sh==='r'){ const n=28; for(let q=0;q<n;q++){ const a=q/n*Math.PI*2, rx=w*1.05, ry=w*0.82; const m=C.Matrix4.multiply(at(dx+Math.cos(a)*rx,dy+Math.sin(a)*ry,b+H/2),C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationZ(a)),new C.Matrix4());
            inst.push(new C.GeometryInstance({geometry:C.BoxGeometry.fromDimensions({dimensions:new C.Cartesian3(w*0.32,2*Math.PI*rx/n*1.05,H),vertexFormat:VF}),modelMatrix:m,attributes:col})); }
          inst.push(new C.GeometryInstance({geometry:new C.CylinderGeometry({length:0.4,topRadius:w*0.62,bottomRadius:w*0.62,slices:32,vertexFormat:VF}),modelMatrix:C.Matrix4.multiply(at(dx,dy,b+0.2),C.Matrix4.fromScale(new C.Cartesian3(1.15,0.8,1)),new C.Matrix4()),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString('#2f8f3a'))}})); }
      }
      const top=Math.max(...parts.map(p=>p[3]));
      ents.push(V.entities.add({position:C.Cartesian3.fromDegrees(lon,lat,z0+top+12), label:{text:'🏛️ '+name, font:'600 13px system-ui', fillColor:C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, distanceDisplayCondition:new C.DistanceDisplayCondition(0,9000), disableDepthTestDistance:Number.POSITIVE_INFINITY}}));
    }
    const prim=inst.length?V.scene.primitives.add(new C.Primitive({geometryInstances:inst, appearance:new C.PerInstanceColorAppearance({flat:false,closed:true,translucent:false}), asynchronous:true})):null;
    X3D.lmCity.set(city,{viewer:V,prim,ents});
  }
}
