/* ============================================================
   VUE 3D — globe CesiumJS (imagerie satellite, soleil réel,
   avions 3D, caméra de poursuite, villes 3D Google en option)
   ============================================================ */
const CESIUM_VER='1.146.0', CESIUM_BASE=`https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VER}/Build/Cesium/`;
let G=null;

function loadCesium(){
  if(window.Cesium) return Promise.resolve();
  if(loadCesium.p) return loadCesium.p;
  window.CESIUM_BASE_URL=CESIUM_BASE;
  loadCesium.p=new Promise((res,rej)=>{
    const l=document.createElement('link'); l.rel='stylesheet'; l.href=CESIUM_BASE+'Widgets/widgets.css'; document.head.appendChild(l);
    const s=document.createElement('script'); s.src=CESIUM_BASE+'Cesium.js'; s.onload=res; s.onerror=()=>{ loadCesium.p=null; rej(new Error('cesium')); }; document.head.appendChild(s);
  });
  return loadCesium.p;
}

/* ---------- avion 3D low-poly généré en glTF ----------
   Repère glTF : +Z vers l'avant, +Y vers le haut, X le long des ailes. */
const _gltfCache={};
function planeGltf(color){
  if(_gltfCache[color]) return _gltfCache[color];
  const hex=c=>{ const n=parseInt(c.replace('#',''),16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255,1]; };
  // hexaèdre défini par 8 coins : bas (0-3) puis haut (4-7), chacun dans l'ordre arrière-gauche, arrière-droit, avant-droit, avant-gauche
  const hexa=(c)=>{ const F=[[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]; const pos=[], nor=[], idx=[];
    for(const f of F){ const p=f.map(i=>c[i]); const u=p[1].map((v,k)=>v-p[0][k]), w=p[3].map((v,k)=>v-p[0][k]);
      let n=[u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]]; const L=Math.hypot(...n)||1; n=n.map(v=>v/L);
      const b=pos.length/3; p.forEach(q=>{ pos.push(...q); nor.push(...n); }); idx.push(b,b+2,b+1,b,b+3,b+2); }
    return {pos,nor,idx}; };
  const box=(x0,x1,y0,y1,z0,z1)=>hexa([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]]);
  // aile en flèche : emplanture (xr) → saumon (xt), bords d'attaque/de fuite
  const wing=(side,xr,xt,zrLE,zrTE,ztLE,ztTE,y,th)=>{ const s=side; return hexa([
    [s*xr,y,zrTE],[s*xt,y,ztTE],[s*xt,y,ztLE],[s*xr,y,zrLE],[s*xr,y+th,zrTE],[s*xt,y+th,ztTE],[s*xt,y+th,ztLE],[s*xr,y+th,zrLE]].map((p,i)=>side<0&&[0,1,2,3,4,5,6,7].includes(i)?p:p)); };
  const merge=(...parts)=>{ const o={pos:[],nor:[],idx:[]}; for(const p of parts){ const b=o.pos.length/3; o.pos.push(...p.pos); o.nor.push(...p.nor); o.idx.push(...p.idx.map(i=>i+b)); } return o; };
  const flip=(p)=>{ // miroir pour l'aile gauche : on inverse l'ordre des triangles
    const idx=[]; for(let i=0;i<p.idx.length;i+=3) idx.push(p.idx[i],p.idx[i+2],p.idx[i+1]); return {pos:p.pos, nor:p.nor.map((v,i)=>i%3===0?v:v), idx}; };
  const parts={
    white: merge(box(-2,2,-2,2.2,-17,17), hexa([[-2,-2,17],[2,-2,17],[1.1,-1.2,22],[-1.1,-1.2,22],[-2,2.2,17],[2,2.2,17],[1.1,1.4,22],[-1.1,1.4,22]]),
                 hexa([[-1.3,-0.6,-22],[1.3,-0.6,-22],[2,-2,-17],[-2,-2,-17],[-0.6,1.4,-22],[0.6,1.4,-22],[2,2.2,-17],[-2,2.2,-17]])),
    grey: merge(wing(1,1.8,17,4,-3,-6,-8.5,-1.2,0.6), flip(wing(-1,1.8,17,4,-3,-6,-8.5,-1.2,0.6)), wing(1,0.5,6.5,-16.5,-20,-19.5,-21.5,1,0.35), flip(wing(-1,0.5,6.5,-16.5,-20,-19.5,-21.5,1,0.35))),
    tail: hexa([[-0.25,2,-21.5],[0.25,2,-21.5],[0.25,2,-15],[-0.25,2,-15],[-0.25,9,-22.5],[0.25,9,-22.5],[0.25,9,-19.5],[-0.25,9,-19.5]]),
    eng: merge(box(5.2,7.4,-2.6,-0.9,-1,4.5), box(-7.4,-5.2,-2.6,-0.9,-1,4.5)),
    glass: hexa([[-1.25,1.0,18.6],[1.25,1.0,18.6],[0.9,0.7,20.4],[-0.9,0.7,20.4],[-1.15,1.6,18.6],[1.15,1.6,18.6],[0.8,1.05,20.4],[-0.8,1.05,20.4]]),
  };
  const mats={white:[0.96,0.97,0.98,1], grey:[0.78,0.81,0.86,1], tail:hex(color), eng:[0.17,0.2,0.26,1], glass:[0.05,0.08,0.15,1]};
  const chunks=[], gltf={asset:{version:'2.0',generator:'Sky Empire'}, scene:0, scenes:[{nodes:[0]}], nodes:[{mesh:0}], meshes:[{primitives:[]}], materials:[], accessors:[], bufferViews:[], buffers:[]};
  let off=0;
  const addView=(arr,target)=>{ const bytes=new Uint8Array(arr.buffer); const pad=(4-bytes.length%4)%4; chunks.push(bytes); if(pad) chunks.push(new Uint8Array(pad));
    gltf.bufferViews.push({buffer:0,byteOffset:off,byteLength:bytes.length,target}); off+=bytes.length+pad; return gltf.bufferViews.length-1; };
  for(const [k,p] of Object.entries(parts)){
    const P=new Float32Array(p.pos), N=new Float32Array(p.nor), I=new Uint16Array(p.idx);
    const mn=[Infinity,Infinity,Infinity], mx=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<P.length;i++){ mn[i%3]=Math.min(mn[i%3],P[i]); mx[i%3]=Math.max(mx[i%3],P[i]); }
    const vp=addView(P,34962), vn=addView(N,34962), vi=addView(I,34963);
    gltf.accessors.push({bufferView:vp,componentType:5126,count:P.length/3,type:'VEC3',min:mn,max:mx},{bufferView:vn,componentType:5126,count:N.length/3,type:'VEC3'},{bufferView:vi,componentType:5123,count:I.length,type:'SCALAR'});
    const a=gltf.accessors.length;
    gltf.materials.push({pbrMetallicRoughness:{baseColorFactor:mats[k],metallicFactor:k==='glass'?0.6:0.15,roughnessFactor:k==='glass'?0.2:0.55},doubleSided:true});
    gltf.meshes[0].primitives.push({attributes:{POSITION:a-3,NORMAL:a-2},indices:a-1,material:gltf.materials.length-1});
  }
  const all=new Uint8Array(off); let o=0; for(const c of chunks){ all.set(c,o); o+=c.length; }
  let bin=''; for(let i=0;i<all.length;i+=0x8000) bin+=String.fromCharCode.apply(null,all.subarray(i,i+0x8000));
  gltf.buffers.push({byteLength:off, uri:'data:application/octet-stream;base64,'+btoa(bin)});
  return _gltfCache[color]='data:model/gltf+json;base64,'+btoa(unescape(encodeURIComponent(JSON.stringify(gltf))));
}
const MODEL_SCALE={prop:0.7, rj:0.8, nb:1, wb:1.55, quad:1.75, conc:1.1};

/* ---------- ouverture / fermeture ---------- */
async function open3D(){
  toast('🌍 Chargement du globe 3D…','info');
  try{ await loadCesium(); }catch(e){ return toast('⛔ Impossible de charger le moteur 3D (connexion Internet ?)','bad'); }
  if(UI.mobile) setTab('map');
  document.body.classList.add('globe-on'); $('#globe').hidden=false; $('#globeHud').hidden=false;
  if(!G) initGlobe(); else G.viewer.resize();
  globeSync(true);
  renderGlobeHud();
}
function close3D(){
  document.body.classList.remove('globe-on'); $('#globe').hidden=true; $('#globeHud').hidden=true;
  if(G){ G.follow=null; G.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); }
  setTimeout(()=>map&&map.invalidateSize(),60);
}
function initGlobe(){
  const C=Cesium; C.Ion.defaultAccessToken='';
  const esriImg=new C.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maximumLevel:18, credit:'Imagerie © Esri, Maxar, Earthstar Geographics'});
  const viewer=new C.Viewer('globe',{ baseLayer:new C.ImageryLayer(esriImg), baseLayerPicker:false, geocoder:false, homeButton:false, sceneModePicker:false,
    navigationHelpButton:false, animation:false, timeline:false, fullscreenButton:false, infoBox:false, selectionIndicator:false, msaaSamples:4 });
  viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', maximumLevel:18}));
  const sc=viewer.scene;
  sc.globe.enableLighting=true; sc.globe.dynamicAtmosphereLighting=true; sc.skyAtmosphere.show=true; sc.fog.enabled=true;
  sc.globe.depthTestAgainstTerrain=false; sc.highDynamicRange=false;
  viewer.clock.shouldAnimate=false;
  G={viewer, planes:new Map(), rivals:[], routes:[], airports:[], follow:null, range:450, lighting:true, tiles:null, simAt:performance.now(), simTime:S.time};
  // sélection d'un avion au clic
  const h=new C.ScreenSpaceEventHandler(sc.canvas);
  h.setInputAction(e=>{ const p=sc.pick(e.position); const id=p&&p.id&&p.id._acId; if(id){ selectPlane(id); renderGlobeHud(); } }, C.ScreenSpaceEventType.LEFT_CLICK);
  const hub=AP(S.company.hub);
  viewer.camera.setView({destination:C.Cartesian3.fromDegrees(hub.lon, hub.lat-18, 7.5e6), orientation:{heading:0, pitch:C.Math.toRadians(-70), roll:0}});
  const key=localStorage.getItem(GKEY);
  if(key && localStorage.getItem('cst-3dtiles')==='1') toggleGoogle3D(true);
  G.loop=setInterval(()=>{ if(!$('#globe').hidden) globeSync(false); },1000);
  sc.preRender.addEventListener(globeFollowTick);
}

/* ---------- synchronisation avec la simulation ---------- */
function globeNoteSim(){ if(G){ G.simAt=performance.now(); G.simTime=S.time; } }
function simNow(){ // temps de jeu interpolé image par image, pour un mouvement fluide à toute vitesse
  if(!G||S.paused) return S.time;
  return G.simTime + Math.min(400,performance.now()-G.simAt)*SPEEDS[S.speed].mult;
}
function acPose(ac){
  const st=flightState(ac, simNow()); if(!st) return null;
  const pos=Cesium.Cartesian3.fromDegrees(st.lon, st.lat, Math.max(st.alt, 2));
  const pitch = st.phase===3? 0.12 : st.phase===5||st.phase===6? -0.05 : 0;
  const q=Cesium.Transforms.headingPitchRollQuaternion(pos, new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(st.hdg-90), pitch, 0));
  return {pos,q,st};
}
function globeSync(full){
  if(!G) return;
  const C=Cesium, V=G.viewer;
  V.clock.currentTime=C.JulianDate.fromDate(new Date(S.time));
  V.scene.globe.enableLighting=G.lighting;
  // avions du joueur
  const seen=new Set();
  for(const ac of S.fleet){
    if(ac.status!=='flight'||!ac.flight) continue;
    seen.add(ac.id);
    if(G.planes.has(ac.id)) continue;
    const m=modelOf(ac), cat=planeCat(m), col=m.color||S.company.color;
    const ent=V.entities.add({
      position:new C.CallbackProperty(()=>{ const p=acPose(ac); return p&&p.pos; },false),
      orientation:new C.CallbackProperty(()=>{ const p=acPose(ac); return p&&p.q; },false),
      model:{uri:planeGltf(col), scale:MODEL_SCALE[cat]||1, minimumPixelSize:46, maximumScale:60000},
      label:{text:`${S.company.code}${flightNumber(ac)}`, font:'600 13px system-ui', fillColor:C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new C.Cartesian2(0,-34), distanceDisplayCondition:new C.DistanceDisplayCondition(0,4e6), scale:0.9},
    });
    ent._acId=ac.id; G.planes.set(ac.id,ent);
  }
  for(const [id,ent] of G.planes) if(!seen.has(id)){ V.entities.remove(ent); G.planes.delete(id); if(G.follow===id) G.follow=null; }
  // poursuite
  if(G.follow){
    const ac=S.fleet.find(a=>a.id===G.follow);
    if(!ac||ac.status!=='flight'){ G.follow=null; V.camera.lookAtTransform(C.Matrix4.IDENTITY); }
  }
  if(full || (G.netKey!==netKey())){ drawGlobeNetwork(); }
  if(full || !G.rivAt || performance.now()-G.rivAt>3000){ G.rivAt=performance.now(); drawGlobeRivals(); }
}
const netKey=()=>S.routes.map(r=>r.id).join()+'|'+S.hubs.join()+'|'+S.company.color;
function drawGlobeNetwork(){
  const C=Cesium, V=G.viewer; G.netKey=netKey();
  for(const e of [...G.routes,...G.airports]) V.entities.remove(e); G.routes=[]; G.airports=[];
  const col=C.Color.fromCssColorString(S.company.color);
  for(const r of S.routes){
    const pts=r.stops.flatMap(c=>[AP(c).lon,AP(c).lat]);
    G.routes.push(V.entities.add({polyline:{positions:C.Cartesian3.fromDegreesArray(pts), width:3, arcType:C.ArcType.GEODESIC, material:new C.PolylineGlowMaterialProperty({glowPower:0.25, color:col.withAlpha(0.9)})}}));
  }
  const codes=new Set([...S.hubs, ...S.routes.flatMap(r=>r.stops)]);
  for(const c of codes){ const a=AP(c), hub=S.hubs.includes(c);
    G.airports.push(V.entities.add({position:C.Cartesian3.fromDegrees(a.lon,a.lat,30), point:{pixelSize:hub?12:8, color:hub?C.Color.fromCssColorString('#ffd60a'):C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:2},
      label:{text:a.city, font:`${hub?'700 15px':'600 12px'} system-ui`, fillColor:hub?C.Color.fromCssColorString('#ffe066'):C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new C.Cartesian2(10,-10), horizontalOrigin:C.HorizontalOrigin.LEFT, distanceDisplayCondition:new C.DistanceDisplayCondition(0,9e6)}}));
  }
}
function drawGlobeRivals(){
  const C=Cesium, V=G.viewer;
  for(const e of G.rivals) V.entities.remove(e); G.rivals=[];
  if(!MAPOPT.rival) return;
  let n=0;
  for(const R of S.rivals||[]) for(const r of R.routes){
    if(n>=70) return;
    const A=AP(r.a), B=AP(r.b), d=gcDist(A,B), v=d<1200?520:850, T=2*(d/v*HOUR+1.2*HOUR);
    const ph=((S.time+hashStr(r.a+r.b)*1000)%T)/T; let f, from=A, to=B;
    if(ph<0.5) f=ph*2; else { f=(ph-0.5)*2; from=B; to=A; }
    f=clamp((f-0.08)/0.84,0,1); if(f<=0||f>=1) continue;
    const p=gcInterp(from,to,f), q=gcInterp(from,to,Math.min(1,f+0.01));
    const pos=C.Cartesian3.fromDegrees(p.lon,p.lat,10500);
    const cat=d<1200?'prop':d<5000?'nb':'wb';
    G.rivals.push(V.entities.add({position:pos, orientation:C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(bearing(p,q)-90),0,0)),
      model:{uri:planeGltf(R.color), scale:MODEL_SCALE[cat], minimumPixelSize:26, maximumScale:40000}}));
    n++;
  }
}

/* ---------- caméra ---------- */
function globeFollowTick(){
  if(!G||!G.follow||$('#globe').hidden) return;
  const ac=S.fleet.find(a=>a.id===G.follow); if(!ac) return;
  const p=acPose(ac); if(!p) return;
  const C=Cesium;
  G.viewer.camera.lookAt(p.pos, new C.HeadingPitchRange(C.Math.toRadians(p.st.hdg), C.Math.toRadians(G.pitch??-12), G.range));
}
function globeFollow(id){
  if(!G) return;
  if(!id || G.follow===id){ G.follow=null; G.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); renderGlobeHud(); return; }
  G.follow=id; G.range=450; G.pitch=-12; renderGlobeHud();
  if(SPEEDS[S.speed].mult>60) toast('💡 Astuce : en vitesse « Standard » ou « Réaliste », la poursuite est plus spectaculaire','info');
}
async function toggleGoogle3D(on){
  const C=Cesium, key=localStorage.getItem(GKEY);
  if(on===undefined) on=!G.tiles;
  if(on && !key){ toast('🔑 Ajoutez d’abord une clé Google dans « 🗺️ Fond de carte »','warn'); return; }
  if(on){
    try{
      G.tiles=await C.Cesium3DTileset.fromUrl(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`,{showCreditsOnScreen:true, maximumScreenSpaceError:12});
      G.viewer.scene.primitives.add(G.tiles); G.viewer.scene.globe.show=false;
      localStorage.setItem('cst-3dtiles','1'); toast('🏙️ Villes 3D Google activées','ok');
    }catch(e){ G.tiles=null; toast('⛔ Villes 3D Google : clé refusée (activez « Map Tiles API »)','bad'); }
  } else if(G.tiles){
    G.viewer.scene.primitives.remove(G.tiles); G.tiles=null; G.viewer.scene.globe.show=true; localStorage.setItem('cst-3dtiles','0');
  }
  renderGlobeHud();
}
function renderGlobeHud(){
  const box=$('#globeHud'); if(!box||!G) return;
  const sel=selectedPlane && S.fleet.find(a=>a.id===selectedPlane && a.status==='flight');
  const flying=S.fleet.filter(a=>a.status==='flight');
  box.innerHTML=`<button class="gh" data-act="close3D">✖ Carte 2D</button>
    <button class="gh ${G.follow?'on':''}" data-act="globeFollow" ${flying.length?'':'disabled'}>🎥 ${G.follow?'Caméra libre':'Poursuite'}${!sel&&flying.length&&!G.follow?' (au hasard)':''}</button>
    ${G.follow?`<button class="gh" data-act="globeZoom" data-d="0.6">🔍＋</button><button class="gh" data-act="globeZoom" data-d="1.7">🔍－</button><button class="gh" data-act="globePitch" data-d="-8">⤵</button><button class="gh" data-act="globePitch" data-d="8">⤴</button>`:''}
    <button class="gh" data-act="globeHome">🏠 Mon hub</button>
    <button class="gh ${G.lighting?'on':''}" data-act="globeLight">🌗 Soleil</button>
    <button class="gh ${G.tiles?'on':''}" data-act="google3D">🏙️ Villes 3D Google</button>`;
}
Object.assign(ACTIONS,{
  open3D:()=>open3D(),
  close3D:()=>close3D(),
  globeFollow:()=>{ const sel=selectedPlane&&S.fleet.find(a=>a.id===selectedPlane&&a.status==='flight'); const ac=sel||pick(S.fleet.filter(a=>a.status==='flight')); if(G.follow) globeFollow(null); else if(ac){ selectPlane(ac.id); globeFollow(ac.id); } },
  globeZoom:d=>{ G.range=clamp(G.range*(+d.d),80,60000); },
  globePitch:d=>{ G.pitch=clamp((G.pitch??-12)+(+d.d),-85,-2); },
  globeHome:()=>{ globeFollow(null); const a=AP(S.company.hub); G.viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(a.lon,a.lat-6,2.2e6), orientation:{heading:0,pitch:Cesium.Math.toRadians(-55),roll:0}, duration:2}); },
  globeLight:()=>{ G.lighting=!G.lighting; G.viewer.scene.globe.enableLighting=G.lighting; renderGlobeHud(); },
  google3D:()=>toggleGoogle3D(),
});
