/* =========================================================
   Sky Empire — 🚢 bateaux sur le fleuve Congo en 3D (Kinshasa)
   Pirogues, bateaux de passagers entre Kinshasa et Brazzaville,
   convois de barges qui remontent le Pool Malebo. Si votre
   filiale 🚢 a des barges sur le fleuve, elles apparaissent aussi,
   avec des conteneurs aux couleurs de votre compagnie.
   Les couloirs restent dans l'eau (calculés sur le contour du fleuve).
   ========================================================= */
'use strict';
const BT_LANES={
  cross:[[-4.2975,15.323],[-4.2915,15.32],[-4.2855,15.314],[-4.2825,15.308],[-4.281,15.302],[-4.2795,15.296],[-4.275,15.2915]],
  west:[[-4.3215,15.2],[-4.3215,15.206],[-4.3185,15.212],[-4.317,15.218],[-4.3185,15.224],[-4.3185,15.236],[-4.317,15.242],[-4.3155,15.254],[-4.3095,15.26],[-4.3035,15.266],[-4.2975,15.272],[-4.2915,15.278],[-4.2885,15.29],[-4.287,15.302],[-4.287,15.314],[-4.2915,15.32],[-4.2975,15.323]],
  up:[[-4.2975,15.323],[-4.296,15.335],[-4.296,15.347],[-4.299,15.353],[-4.3035,15.359],[-4.308,15.371],[-4.314,15.383],[-4.3155,15.395],[-4.3155,15.437],[-4.3125,15.449],[-4.308,15.455],[-4.3065,15.467],[-4.3065,15.479],[-4.302,15.485],[-4.2915,15.497],[-4.2885,15.509],[-4.2765,15.521],[-4.2705,15.527],[-4.2465,15.5285],[-4.2405,15.533],[-4.2105,15.533],[-4.2,15.53]],
};
const BT={viewer:null, boats:[], z:null, zP:null, last:0};
// modèles : [x0,x1, y0,y1 (hauteur), z0,z1 (longueur, avant en +z), couleur]
const M_PIROGUE=()=>{ const w=C3('#6b4423'), d=C3('#3f2a17'), m=C3('#111827'), c=C3(['#dc2626','#2563eb','#16a34a','#f59e0b'][Math.floor(Math.random()*4)]);
  return [[-0.7,0.7,0,0.55,-7,7,w],[-0.5,0.5,0.55,0.6,-6.5,6.5,d],[-0.3,0.3,0.4,1.1,-7.6,-7,m],[-0.9,0.9,0.6,1.6,-1,1,c]]; };
const M_FERRY=()=>{ const h=C3('#f8fafc'), s=C3('#1d4ed8'), g=C3('#1f2a3a'), r=C3('#b91c1c');
  return [[-3,3,0,2.2,-14,14,h],[-3.05,3.05,1.2,1.7,-14,14,s],[-2.6,2.6,2.2,5,-9,7,h],[-2.65,2.65,3.2,4.3,-8.5,6.5,g],[-2.2,2.2,5,7,-4,3,h],[-2.25,2.25,5.6,6.6,-3.5,2.5,g],[-0.4,0.4,7,9,-3,-2,r]]; };
const M_CONVOY=col=>()=>{ const hull=C3('#7c2d12'), deck=C3('#57534e'), wh=C3('#f1f5f9'), g=C3('#1f2a3a'), k=C3(col||'#2563eb'), k2=C3('#e5e7eb'), k3=C3('#f59e0b');
  const b=[[-3.2,3.2,0,2.8,-28,-14,wh],[-2.8,2.8,2.8,6,-27,-21,wh],[-2.85,2.85,4.5,5.6,-26.5,-21.5,g],[-2,2,6,9,-26,-22,wh],[-2.05,2.05,7.2,8.4,-25.5,-22.5,g]];   // pousseur
  for(const z0 of [-13,4,21]){ b.push([-5,5,0,2.2,z0,z0+16,hull],[-4.8,4.8,2.2,2.3,z0+0.3,z0+15.7,deck]);
    for(let i=0;i<3;i++){ const c=[k,k2,k3][(i+(z0>0?1:0))%3]; b.push([-4.4,-0.2,2.3,4.9,z0+0.6+i*5,z0+5.3+i*5,c],[0.2,4.4,2.3,4.9,z0+0.6+i*5,z0+5.3+i*5,i===1?k:c]); } }
  return b; };

function btLaneInfo(name){ const pts=BT_LANES[name].map(([lat,lon])=>({lat,lon})), cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+gcDist(pts[i-1],pts[i])*1000); return {pts,cum,len:cum[cum.length-1]}; }
const _btLanes={};
const btLane=n=>_btLanes[n]||(_btLanes[n]=btLaneInfo(n));
function btClear(){ if(BT.viewer) for(const b of BT.boats) try{ BT.viewer.entities.remove(b.e); }catch(e){} BT.boats=[]; }
function btPlayerBarges(){ const X=S&&S.tr&&S.tr.boat; if(!X||!X.on) return 0; const riv=new Set(X.lines.filter(L=>{ const p=typeof trPath==='function'&&trPath('boat',L.a,L.b); return p&&p.kind==='river'&&p.pts.some(n=>n.id==='KIN'||n.id==='BZV'); }).map(L=>L.id));
  return Math.min(6,X.fleet.filter(v=>riv.has(v.line)).length); }
function btTick(){
  if(typeof rdOn!=='function'||!rdOn()) return;
  const V=G.viewer; if(BT.viewer!==V){ BT.boats=[]; BT.viewer=V; BT.z=null; V.scene.preRender.addEventListener(btFrame); }
  const cam=rdCam(), near=gcDist(cam,{lat:-4.29,lon:15.36})<35&&cam.h<8000&&!G.tiles;
  if(!near){ if(BT.boats.length) btClear(); return; }
  if(BT.z===null){ BT.z=0; if(typeof TERRAIN!=='undefined'&&TERRAIN.on&&typeof terrElevAsync==='function'){ BT.zP=terrElevAsync(-4.30,15.42).then(h=>{ BT.z=h!=null?h+0.9:272; }).catch(()=>{ BT.z=272; }); } }
  const amb=GQ.mini?4:GQ.mob?6:12, mine=btPlayerBarges(), want=amb+mine;
  if(BT.boats.length===want) return;
  btClear();
  const C=Cesium, col=S.company.color||'#2563eb';
  const spec=[]; for(let i=0;i<mine;i++) spec.push({m:'mine',lane:'up',v:3.2});
  for(let i=0;i<amb;i++){ const r=i%4; spec.push(r===0?{m:'ferry',lane:'cross',v:6}:r===1?{m:'convoy',lane:'up',v:2.8}:{m:'pirogue',lane:Math.random()<0.5?'west':'cross',v:4.5}); }
  for(const s of spec){ const url=s.m==='mine'?apModel('convoy-'+col,M_CONVOY(col)):s.m==='convoy'?apModel('convoy-std',M_CONVOY('#0f766e')):s.m==='ferry'?apModel('ferry',M_FERRY):apModel('pirogue'+Math.floor(Math.random()*3),M_PIROGUE);
    const L=btLane(s.lane);
    BT.boats.push({e:V.entities.add({position:C.Cartesian3.ZERO, show:false, model:{uri:url, scale:s.m==='pirogue'?1.4:1.2, minimumPixelSize:s.m==='pirogue'?10:18, maximumScale:30, distanceDisplayCondition:new C.DistanceDisplayCondition(0,14000)}, name:s.m==='mine'?`${S.company.name} — convoi de barges`:undefined}),
      L, d:Math.random()*L.len, dir:Math.random()<0.5?1:-1, v:s.v*(0.85+Math.random()*0.3), seg:1, mine:s.m==='mine'}); }
}
function btFrame(){
  if(!BT.boats.length||typeof rdOn!=='function'||!rdOn()) return;
  const now=performance.now(), dt=Math.min(0.2,(now-(BT.last||now))/1000); BT.last=now; const C=Cesium, z=BT.z||0;
  for(const b of BT.boats){ const L=b.L, cum=L.cum; b.d+=b.dir*b.v*dt; if(b.d>L.len||b.d<0){ b.dir=-b.dir; b.d=clamp(b.d,0,L.len); }
    let x=b.seg||1; while(x<cum.length-1&&cum[x]<b.d) x++; while(x>1&&cum[x-1]>b.d) x--; b.seg=x;
    const a=L.pts[x-1], c=L.pts[x], f=(b.d-cum[x-1])/Math.max(0.01,cum[x]-cum[x-1]), hd=bearing(a,c)+(b.dir<0?180:0);
    const off=(b.dir>0?1:-1)*(b.mine?45:25)/111320;   // chacun tient sa droite
    const lat=a.lat+(c.lat-a.lat)*f+Math.cos(toRad(hd+90))*off, lon=a.lon+(c.lon-a.lon)*f+Math.sin(toRad(hd+90))*off;
    const pos=C.Cartesian3.fromDegrees(lon,lat,z+Math.sin(now/900+b.d)*0.15); b.e.position=pos; b.e.show=true;
    b.e.orientation=C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(hd-90),0,Math.sin(now/1300+b.d)*0.01)); }
}
setInterval(()=>{ try{ btTick(); }catch(e){ console.warn('boats3d',e); } },1500);
