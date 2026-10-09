/* =========================================================
   Sky Empire — ⛰️ relief réel du monde (sans clé)
   Tuiles d'altitude « Terrarium » (SRTM / GMTED, AWS Open Data,
   accessibles librement) décodées dans le navigateur et données
   à Cesium : montagnes, volcans, vallées, falaises.
   Tout ce qui est au sol (avions, pistes, bâtiments, feux,
   véhicules) est posé à l'altitude réelle du terrain.
   ========================================================= */
'use strict';
const TERRAIN={on:true, elev:{}, pending:{}, prov:null, tiles:new Map()};
try{ TERRAIN.on=localStorage.getItem('se-relief')!=='0'; }catch(e){}
const TERR_URL='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
function terrTile(z,x,y){
  const k=z+'/'+x+'/'+y; let p=TERRAIN.tiles.get(k);
  if(p) return p;
  p=fetch(TERR_URL+k+'.png').then(r=>{ if(!r.ok) throw new Error(r.status); return r.blob(); }).then(b=>createImageBitmap(b)).then(img=>{
    const cv=(typeof OffscreenCanvas!=='undefined')? new OffscreenCanvas(256,256) : Object.assign(document.createElement('canvas'),{width:256,height:256});
    const g=cv.getContext('2d'); g.drawImage(img,0,0); const d=g.getImageData(0,0,256,256).data, h=new Float32Array(256*256);
    const wm=new Uint8Array(256*256);
    for(let i=0;i<h.length;i++){ const v=d[i*4]*256+d[i*4+1]+d[i*4+2]/256-32768; h[i]=v<0?0:v; if(v<-0.5) wm[i]=255; }   // la mer reste au niveau 0 ; masque d'eau : fonds marins
    h.wm=wm; return h; }).catch(()=>null);
  TERRAIN.tiles.set(k,p); if(TERRAIN.tiles.size>160) TERRAIN.tiles.delete(TERRAIN.tiles.keys().next().value);
  return p;
}
// zones aplanies (pistes, aires de stationnement) : enregistrées pour les aéroports proches
TERRAIN.flats=[];
function terrFlatten(code){
  if(!TERRAIN.on||TERRAIN.flats.some(f=>f.code===code)) return false; const rws=(typeof runwaysOf==='function'?runwaysOf(code):[]); if(!rws.length) return;
  const ap=typeof apronOf==='function'?apronOf(code):null, e=gElev(code), seen=new Set(), parts=[];
  for(const r of rws){ const k=[r.thr.lat.toFixed(4),r.end.lat.toFixed(4)].sort().join(); if(seen.has(k)) continue; seen.add(k);
    const lat=(ap&&ap.rw===r)?Math.max(260,Math.abs(ap.x)+260):260; parts.push({r,lat}); }
  const lats=rws.map(r=>[r.thr.lat,r.end.lat]).flat(), lons=rws.map(r=>[r.thr.lon,r.end.lon]).flat(), pad=0.035;
  TERRAIN.flats.push({code,e,parts,box:[Math.min(...lats)-pad,Math.max(...lats)+pad,Math.min(...lons)-pad,Math.max(...lons)+pad]});
  return true;
}
// recharge le relief (les tuiles déjà décodées sont réutilisées : rapide)
function terrReload(){ if(!G||!TERRAIN.on) return; clearTimeout(TERRAIN._rl); TERRAIN._rl=setTimeout(()=>{ TERRAIN.prov=null; G.viewer.scene.globe.terrainProvider=terrainProvider(); },400); }
// aéroports de votre réseau : aplanis dès l'ouverture de la vue 3D
function terrFlattenNetwork(){ if(!TERRAIN.on||!S) return; for(const c of new Set([...(S.hubs||[]),...(S.routes||[]).flatMap(r=>r.stops)])) terrFlatten(c); }
function flatWeight(f,lat,lon){ // 0 = totalement aplani, 1 = relief naturel
  let w=1; for(const {r,lat:lw} of f.parts){ const q=toRw(r,{lat,lon}), da=Math.max(0,-400-q.a,q.a-(r.len+400)), dx=Math.max(0,Math.abs(q.x)-lw), d=Math.hypot(da,dx); w=Math.min(w,Math.min(1,d/300)); }
  return w*w*(3-2*w);
}
function terrCallback(x,y,level){
  const Z=Math.min(level,14), f=1<<(level-Z), tx=Math.floor(x/f), ty=Math.floor(y/f), ox=(x%f)/f*256, oy=(y%f)/f*256, span=256/f;
  return terrTile(Z,tx,ty).then(h=>{
    const out=new Float32Array(65*65); if(!h) return {out,mask:undefined};
    const at=(px,py)=>{ px=Math.max(0,Math.min(255,px)); py=Math.max(0,Math.min(255,py)); const x0=Math.floor(px), y0=Math.floor(py), x1=Math.min(255,x0+1), y1=Math.min(255,y0+1), fx=px-x0, fy=py-y0;
      return h[y0*256+x0]*(1-fx)*(1-fy)+h[y0*256+x1]*fx*(1-fy)+h[y1*256+x0]*(1-fx)*fy+h[y1*256+x1]*fx*fy; };
    for(let j=0;j<65;j++) for(let i=0;i<65;i++) out[j*65+i]=at(ox+i/64*span-0.5, oy+j/64*span-0.5);
    // aplanir les aéroports présents dans la tuile
    if(TERRAIN.flats.length&&level>=8){ const n=1<<level, lon0=x/n*360-180, lon1=(x+1)/n*360-180, my0=Math.PI*(1-2*y/n), my1=Math.PI*(1-2*(y+1)/n), mlat=m=>Math.atan(Math.sinh(m))*180/Math.PI, la0=mlat(my1), la1=mlat(my0);
      for(const f of TERRAIN.flats){ if(f.box[1]<la0||f.box[0]>la1||f.box[3]<lon0||f.box[2]>lon1) continue;
        for(let j=0;j<65;j++){ const lat=mlat(my0+(my1-my0)*j/64); if(lat<f.box[0]||lat>f.box[1]) continue;
          for(let i=0;i<65;i++){ const lon=lon0+(lon1-lon0)*i/64; if(lon<f.box[2]||lon>f.box[3]) continue; const w=flatWeight(f,lat,lon); if(w<1){ const k=j*65+i; out[k]=f.e-0.6+(out[k]-f.e+0.6)*w; } } } } }
    // masque d'eau 256×256 (mers et océans) : active les vagues animées et le reflet du soleil de Cesium
    let mask; if(h.wm){ let any=0; mask=new Uint8Array(256*256); for(let j=0;j<256;j++){ const sy=Math.min(255,Math.floor(oy+(j+0.5)/256*span)); for(let i=0;i<256;i++){ const v=h.wm[sy*256+Math.min(255,Math.floor(ox+(i+0.5)/256*span))]; mask[j*256+i]=v; any|=v; } }
      if(!any) mask=new Uint8Array([0]); else if(mask.every(v=>v===255)) mask=new Uint8Array([255]); }
    return {out,mask}; });
}
// fournisseur de relief avec masque d'eau (Cesium n'en propose pas pour un relief personnalisé)
function SeTerrainProvider(){ const C=Cesium; this.tilingScheme=new C.WebMercatorTilingScheme(); this.errorEvent=new C.Event(); this.credit=new C.Credit('Relief : SRTM / GMTED — Mapzen Terrain Tiles (AWS Open Data)');
  this.hasWaterMask=true; this.hasVertexNormals=false; this.availability=undefined; this._e0=C.TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(this.tilingScheme.ellipsoid,65,this.tilingScheme.getNumberOfXTilesAtLevel(0)); this.ready=true; }
SeTerrainProvider.prototype.requestTileGeometry=function(x,y,level){ const C=Cesium; return terrCallback(x,y,level).then(r=>new C.HeightmapTerrainData({buffer:r.out,width:65,height:65,waterMask:r.mask})); };
SeTerrainProvider.prototype.getLevelMaximumGeometricError=function(level){ return this._e0/(1<<level); };
SeTerrainProvider.prototype.getTileDataAvailable=function(){ return undefined; };
SeTerrainProvider.prototype.loadTileDataAvailability=function(){ return undefined; };
function terrainProvider(){
  if(TERRAIN.prov) return TERRAIN.prov;
  const C=Cesium;
  TERRAIN.prov=new SeTerrainProvider();
  return TERRAIN.prov;
}
// altitude du terrain (m) à un aéroport — valeur échantillonnée, sinon altitude officielle de la base
function gElev(code){
  if(!TERRAIN.on||!code) return 0;
  const v=TERRAIN.elev[code]; if(v!==undefined) return v;
  const a=AP(code), est=a&&a.elev?a.elev*0.3048:0;
  if(a&&a.elev){ TERRAIN.elev[code]=est; return est; }
  if(!TERRAIN.pending[code]&&a&&typeof Cesium!=='undefined'){ TERRAIN.pending[code]=1;
    const rw=(typeof runwaysOf==='function'?runwaysOf(code):[])[0], pt=rw?{lat:(rw.thr.lat+rw.end.lat)/2,lon:(rw.thr.lon+rw.end.lon)/2}:a;
    Cesium.sampleTerrain(terrainProvider(),13,[Cesium.Cartographic.fromDegrees(pt.lon,pt.lat)]).then(r=>{ const h=r&&r[0]&&r[0].height; if(h===undefined||isNaN(h)) return;
      const old=TERRAIN.elev[code]; TERRAIN.elev[code]=Math.max(0,h);
      if(Math.abs(TERRAIN.elev[code]-est)>2&&old===undefined&&G&&G.apNear) G.apNear.c={lat:999,lon:999};   // reconstruire pistes et décor à la bonne hauteur
    }).catch(()=>{});
  }
  return est;
}
// altitude du sol sous un avion entre deux aéroports (fond de vallée lissé)
function legElev(from,to,frac){ if(!TERRAIN.on) return 0; const a=gElev(from), b=gElev(to), k=Math.max(0,Math.min(1,(frac-0.15)/0.7)); return a+(b-a)*k*k*(3-2*k); }
function terrainApply(){
  if(!G) return; const C=Cesium, sc=G.viewer.scene;
  if(TERRAIN.on) terrFlattenNetwork();
  sc.globe.terrainProvider=TERRAIN.on? terrainProvider() : new C.EllipsoidTerrainProvider();
  sc.globe.depthTestAgainstTerrain=TERRAIN.on;
  if(G.apNear){ G.apNear.c={lat:999,lon:999}; }
  if(G.osm){ for(const prim of G.osm.cells.values()) if(prim) sc.primitives.remove(prim); G.osm.cells.clear(); }
  if(G.planes){ for(const e of G.planes.values()) G.viewer.entities.remove(e); G.planes.clear(); globeSync(true); }
}
// sol réel sous un point (tuiles chargées) — pour ne jamais traverser une montagne
function groundAt(lat,lon){ if(!TERRAIN.on||!G) return 0; const h=G.viewer.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(lon,lat)); return (h===undefined||h<-450||h>9000)?0:h; }
