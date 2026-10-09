/* =========================================================
   Sky Empire — pistes réalistes en 3D
   Texture dessinée à la volée (asphalte, gomme des pneus,
   bandes de seuil, numéros, axe, zones de toucher, points
   de visée, bords) posée sur un modèle glTF aligné sur la
   vraie piste (coordonnées OurAirports).
   ========================================================= */
'use strict';
const RWY3D={cache:new Map()};
function rwyNum(id){ return String(id||'').replace(/^0(?=\d)/,''); }
function rwyTexture(r,W,L,hard){
  const cw=256, ch=4096, cv=document.createElement('canvas'); cv.width=cw; cv.height=ch;
  const g=cv.getContext('2d'), sx=cw/W, sy=ch/L, X=m=>(m+W/2)*sx, Y=m=>m*sy;
  // fond : asphalte (ou terre battue)
  g.fillStyle=hard?'#5b5e64':'#8a7458'; g.fillRect(0,0,cw,ch);
  const img=g.getImageData(0,0,cw,ch), d=img.data;
  let seed=(r.id||'x').charCodeAt(0)*977+L; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
  for(let i=0;i<d.length;i+=4){ const n=(rnd()-0.5)*(hard?26:40); d[i]+=n; d[i+1]+=n; d[i+2]+=n*(hard?1:0.7); }
  g.putImageData(img,0,0);
  // dalles / rapiéçages plus clairs ou plus sombres
  for(let i=0;i<70;i++){ g.fillStyle=`rgba(${rnd()<0.5?'20,20,22':'120,120,125'},${0.05+rnd()*0.08})`; g.fillRect(rnd()*cw,rnd()*ch,8+rnd()*60,20+rnd()*260); }
  if(!hard){ // piste en terre : ornières
    g.fillStyle='rgba(60,45,30,0.35)'; g.fillRect(X(-4),0,6,ch); g.fillRect(X(3),0,6,ch); return cv; }
  // gomme des pneus dans les zones de toucher (les deux bouts)
  for(const [a,b] of [[250,1000],[L-1000,L-250]]){ for(let k=0;k<160;k++){ const z=a+rnd()*(b-a), x=(rnd()-0.5)*14, len=20+rnd()*120;
      g.fillStyle=`rgba(12,12,14,${0.12+rnd()*0.2})`; g.fillRect(X(x),Y(z),2+rnd()*4,len*sy*4); } }
  g.fillStyle='rgba(20,20,22,0.18)'; g.fillRect(X(-7),Y(250),14*sx,Y(L-500));
  const W_=(x0,x1,z0,z1)=>{ g.fillStyle='rgba(245,245,245,0.92)'; g.fillRect(X(x0),Y(z0),Math.max(1,(x1-x0)*sx),Math.max(1,(z1-z0)*sy)); };
  // bords de piste
  W_(-W/2+1,-W/2+1.9,0,L); W_(W/2-1.9,W/2-1,0,L);
  // axe : traits de 30 m, espaces de 20 m
  for(let z=100;z<L-100;z+=50) W_(-0.45,0.45,z,z+30);
  // bandes de seuil (« touches de piano »), points de visée, zones de toucher — aux deux bouts
  const stripes=W>=45?16:W>=30?8:6, sw=(W-6)/(stripes*2);
  for(const end of [0,1]){
    const zz=(z0,z1)=>end?[L-z1,L-z0]:[z0,z1];
    for(let i=0;i<stripes;i++){ const x=-W/2+3+sw*0.5+i*sw*2+(i>=stripes/2?sw*0.2:0); const [a,b]=zz(6,36); W_(x,x+sw,a,b); }
    { const [a,b]=zz(400,445); W_(-W/2+5,-W/2+14,a,b); W_(W/2-14,W/2-5,a,b); }
    for(const z of [150,300,600,750,900]){ const n=z<=300?3:z<=600?2:1, [a,b]=zz(z,z+22); for(let k=0;k<n;k++){ const off=W/2-6-k*3; W_(-off,-off+1.8,a,b); W_(off-1.8,off,a,b); } }
  }
  // numéros (lisibles depuis l'approche de chaque bout)
  const ids=[rwyNum(r.id), rwyNum(r.twinId)];
  g.fillStyle='rgba(245,245,245,0.92)'; g.textAlign='center'; g.textBaseline='middle';
  for(const end of [0,1]){
    const txt=ids[end]; if(!txt) continue;
    g.save(); const zc=end?L-60:60; g.translate(cw/2,Y(zc)); if(!end) g.rotate(Math.PI);
    g.scale(1,(18*sy)/(18*sx)*1.0); g.font=`bold ${Math.round(18*sx)}px Arial, sans-serif`; g.fillText(txt,0,0); g.restore();
  }
  return cv;
}
function rwyGlb(cv,W,L){
  const b64=cv.toDataURL('image/jpeg',0.82).split(',')[1], bin=atob(b64), jpg=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) jpg[i]=bin.charCodeAt(i);
  const P=new Float32Array([-W/2,0,0, W/2,0,0, W/2,0,L, -W/2,0,L]), N=new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]), T=new Float32Array([0,0, 1,0, 1,1, 0,1]), I=new Uint16Array([0,2,1,0,3,2]);
  const parts=[[P,34962],[N,34962],[T,34962],[I,34963],[jpg,null]], views=[], chunks=[]; let off=0;
  for(const [a,t] of parts){ const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength), pad=(4-b.length%4)%4; const v={buffer:0,byteOffset:off,byteLength:b.length}; if(t) v.target=t; views.push(v); chunks.push(b); if(pad) chunks.push(new Uint8Array(pad)); off+=b.length+pad; }
  const gltf={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],
    meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3,material:0}]}],
    materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:0.92},doubleSided:true}],
    textures:[{source:0,sampler:0}], samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}], images:[{bufferView:4,mimeType:'image/jpeg'}],
    accessors:[{bufferView:0,componentType:5126,count:4,type:'VEC3',min:[-W/2,0,0],max:[W/2,0,L]},{bufferView:1,componentType:5126,count:4,type:'VEC3'},{bufferView:2,componentType:5126,count:4,type:'VEC2'},{bufferView:3,componentType:5123,count:6,type:'SCALAR'}],
    bufferViews:views, buffers:[{byteLength:off}]};
  let js=new TextEncoder().encode(JSON.stringify(gltf)); const jp=(4-js.length%4)%4; if(jp){ const t=new Uint8Array(js.length+jp); t.set(js); t.fill(32,js.length); js=t; }
  const total=12+8+js.length+8+off, glb=new Uint8Array(total), dv=new DataView(glb.buffer);
  dv.setUint32(0,0x46546C67,true); dv.setUint32(4,2,true); dv.setUint32(8,total,true); dv.setUint32(12,js.length,true); dv.setUint32(16,0x4E4F534A,true); glb.set(js,20);
  let o=20+js.length; dv.setUint32(o,off,true); dv.setUint32(o+4,0x004E4942,true); o+=8; for(const c of chunks){ glb.set(c,o); o+=c.length; }
  return URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}));
}
// entité 3D d'une piste physique (thr → end), cache par aéroport + piste
function runwayEntity(code,r,W){
  const C=Cesium, key=code+'|'+r.id+'|'+Math.round(r.len);
  let url=RWY3D.cache.get(key);
  if(!url){ const twin=runwaysOf(code).find(x=>x!==r&&x.thr===r.end); const cv=rwyTexture({...r,twinId:twin&&twin.id},W,r.len,r.hard); url=rwyGlb(cv,W,r.len); RWY3D.cache.set(key,url); }
  const pos=C.Cartesian3.fromDegrees(r.thr.lon,r.thr.lat,0.3+(typeof gElev==='function'?gElev(code):0));
  return G.viewer.entities.add({position:pos, orientation:C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(r.hdg-90),0,0)),
    model:{uri:url, scale:1, minimumPixelSize:0, shadows:C.ShadowMode.RECEIVE_ONLY, distanceDisplayCondition:new C.DistanceDisplayCondition(0,90000)}});
}
