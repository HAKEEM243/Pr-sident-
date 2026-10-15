/* =========================================================
   Sky Empire — 🚚 vos camions en 3D sur les routes congolaises
   Quand la 3D regarde une ville de vos lignes de camions (Kinshasa,
   Matadi, Lubumbashi…), vos camions roulent sur les vraies routes,
   aux couleurs de votre compagnie. Touchez-en un : chauffeur,
   chargement, ligne, état… et « Suivre en 3D » pour rouler avec lui.
   Sur la carte 2D, les camions se touchent aussi.
   ========================================================= */
'use strict';
const TK={viewer:null, list:[], last:0, follow:null, handler:null};
const TK_GOODS=['ciment','farine de maïs','sacs de riz','bière et boissons','carburant','tôles et fer à béton','manioc','huile de palme','médicaments','matériel de construction','produits d’épicerie','pièces détachées','cuivre (cathodes)','cobalt','bois','sucre','engrais','charbon de bois'];
const tkPool=()=>{ const cc=homeCC(); return NAME_POOLS[cc]||NAME_POOLS[COUNTRIES[cc]&&COUNTRIES[cc][1]]||NAME_POOLS.EU||Object.values(NAME_POOLS)[0]; };
const tkHash=s=>{ let h=7; for(const ch of String(s)) h=(h*31+ch.charCodeAt(0))|0; return Math.abs(h); };
// camion aux couleurs de la compagnie : cabine colorée, remorque blanche avec bande, roues
const M_TRUCK_CO=(col,semi)=>()=>{ const cab=C3(col), box=C3('#f1f5f9'), band=C3(col), g=C3('#1f2a3a'), w=C3('#0b0f17'), ch=C3('#4b5563'), hl=C3('#fff7d6');
  const L=semi?9:5.2;
  const b=[[-1.25,1.25,0.6,3.0,L-2.2,L,cab],[-1.2,1.2,1.9,2.7,L,L+0.05,g],[-1.0,-0.6,0.8,1.05,L,L+0.06,hl],[0.6,1.0,0.8,1.05,L,L+0.06,hl],
    [-0.4,0.4,0.4,0.7,-L,L-2.2,ch],[-1.3,1.3,0.75,3.9,-L,L-2.5,box],[-1.32,1.32,2.6,3.0,-L+0.3,L-2.8,band],
    [-1.35,-1.0,0,1.0,L-1.9,L-0.9,w],[1.0,1.35,0,1.0,L-1.9,L-0.9,w]];
  for(const z of semi?[-L+0.6,-L+1.8,-L+3.0]:[-L+0.8,-L+2.0]) b.push([-1.35,-1.0,0,1.0,z,z+0.95,w],[1.0,1.35,0,1.0,z,z+0.95,w]);
  return b; };
function tkLinesNear(v){ const X=S&&S.tr&&S.tr.truck; if(!X||!X.on) return []; const out=[];
  for(const L of X.lines){ const vs=X.fleet.filter(f=>f.line===L.id); if(!vs.length) continue; for(const end of [L.a,L.b]){ const n=typeof trNode==='function'&&trNode('truck',end); if(n&&gcDist(v,n)<35){ out.push({L,vs,end}); break; } } }
  return out; }
function tkClear(){ if(TK.viewer) for(const t of TK.list) try{ TK.viewer.entities.remove(t.e); }catch(e){} TK.list=[]; }
function tkTick(){
  if(typeof rdOn!=='function'||!rdOn()) return;
  const V=G.viewer, C=Cesium;
  if(TK.viewer!==V){ TK.list=[]; TK.viewer=V; TK.follow=null; V.scene.preRender.addEventListener(tkFrame);
    TK.handler=new C.ScreenSpaceEventHandler(V.scene.canvas); TK.handler.setInputAction(e=>{ const p=V.scene.pick(e.position); const t=p&&p.id&&p.id._truck; if(t) tkInfo(t); }, C.ScreenSpaceEventType.LEFT_CLICK); }
  const cam=rdCam(), v=rdView(cam), agl=cam.h-(typeof groundAt==='function'?groundAt(cam.lat,cam.lon):0);
  const near=agl<6000&&!G.tiles?tkLinesNear(v):[];
  if(!near.length||!RD.paths.length){ if(TK.list.length&&!TK.follow) tkClear(); return; }
  const cap=GQ.mini?4:GQ.mob?8:16, total=Math.min(cap,near.reduce((s,x)=>s+x.vs.length,0));
  if(TK.list.length===total&&TK.list.every(t=>t.p&&RD.paths.includes(t.p))) return;
  if(TK.follow&&TK.list.includes(TK.follow)) return;
  tkClear(); const col=S.company.color||'#2563eb', big=RD.paths.filter(p=>p.v>=12); const pool=big.length?big:RD.paths;
  let k=0; for(const {L,vs} of near) for(const veh of vs){ if(k>=total) break; k++;
    const V0=trVeh('truck',veh.k)||{n:'Camion',cap:12}, semi=V0.cap>=20, p=pool[Math.floor(Math.random()*pool.length)];
    const url=apModel('truckco-'+col+(semi?'-s':''),M_TRUCK_CO(col,semi));
    const h=tkHash(veh.id), pool2=tkPool();
    const info={veh, L, model:V0.n, cargo:TK_GOODS[h%TK_GOODS.length], tons:Math.round(V0.cap*(0.6+(h%40)/100)), driver:`${pool2[0][h%pool2[0].length]} ${pool2[1][(h>>3)%pool2[1].length]}`};
    const t={info, p, d:Math.random()*p.len, dir:p.oneway||Math.random()<0.5?1:-1, v:p.v*0.7*(0.85+Math.random()*0.2), seg:1};
    t.e=V.entities.add({position:C.Cartesian3.ZERO, show:false, model:{uri:url, scale:1.8, minimumPixelSize:24, maximumScale:50, distanceDisplayCondition:new C.DistanceDisplayCondition(0,12000)}});
    t.e._truck=t; TK.list.push(t); }
}
function tkFrame(){
  if(!TK.list.length||typeof rdOn!=='function'||!rdOn()) return;
  const now=performance.now(), dt=Math.min(0.2,(now-(TK.last||now))/1000); TK.last=now; const C=Cesium;
  for(const t of TK.list){ const P=t.p, cum=P.cum; if(!P||!cum) continue;
    t.d+=t.dir*t.v*dt; if(t.d>P.len||t.d<0){ t.dir=-t.dir; t.d=clamp(t.d,0,P.len); }
    let x=t.seg||1; while(x<cum.length-1&&cum[x]<t.d) x++; while(x>1&&cum[x-1]>t.d) x--; t.seg=x;
    const a=P.pts[x-1], b=P.pts[x], f=(t.d-cum[x-1])/Math.max(0.01,cum[x]-cum[x-1]);
    const lat0=a.lat+(b.lat-a.lat)*f, lon0=a.lon+(b.lon-a.lon)*f, hd=bearing(a,b)+(t.dir<0?180:0), off=(P.oneway?2:3.2)/111320;
    const lat=lat0+Math.cos(toRad(hd+90))*off, lon=lon0+Math.sin(toRad(hd+90))*off/Math.max(0.2,Math.cos(toRad(lat0)));
    if(t.gx!==x||t.gh==null){ const g=typeof terrElevSync==='function'?terrElevSync(lat,lon):null; if(g!=null||t.gh==null){ t.gx=g!=null?x:-1; t.gh=g!=null?g:(typeof groundAt==='function'?groundAt(lat,lon):0); } }
    const pos=C.Cartesian3.fromDegrees(lon,lat,t.gh+0.3); t.e.position=pos; t.e.show=true; t.hd=hd; t.pos=pos;
    t.e.orientation=C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(hd-90),0,0)); }
  // suivi d'un camion : la caméra roule derrière lui
  const f=TK.follow; if(f&&f.pos){ if(G.follow){ tkUnfollow(); return; } try{ G.viewer.camera.lookAt(f.pos,new C.HeadingPitchRange(C.Math.toRadians(f.hd),C.Math.toRadians(-14),38)); }catch(e){} }
}
function tkInfoHtml(t){ const I=t.info, L=I.L, A=trNode('truck',L.a), B=trNode('truck',L.b), cond=Math.round(I.veh.cond??100);
  return `<div class="card"><div class="row"><div class="biglogo" style="background:${S.company.color}">${esc(S.company.logo)}</div><div class="grow"><b>${esc(S.company.name)} ${TR_MODES.truck.name}</b><br><span class="small mut">${esc(I.model)}</span></div></div></div>
  <div class="card small">👷 Chauffeur : <b>${esc(I.driver)}</b><br>📦 Chargement : <b>${num(I.tons)} t de ${esc(I.cargo)}</b><br>🛣️ Ligne : <b>${esc(A.name)} → ${esc(B.name)}</b>${L.last?`<br>📈 Semaine dernière sur la ligne : ${num(L.last.tons)} t livrées · ${L.last.rev-L.last.cost>=0?'+':''}${fmtMoney(L.last.rev-L.last.cost)}`:''}<br>🔧 État du camion : ${bar(cond/100,cond<40?'bad':cond<60?'warn':'')} <b>${cond} %</b>${I.veh.down>0?' · en panne cette semaine':''}</div>
  <div class="btns">${t.e?`<button class="btn gold" data-act="tkFollow">🎥 Suivre en 3D</button>`:''}<button class="btn gold" data-act="vyGo" data-m="truck" data-id="${L.id}" data-k="${I.veh.k}">🎬 Faire tout le voyage</button><button class="btn" data-act="tkLine">🚚 Gérer la ligne</button></div>`; }
function tkInfo(t){ TK.sel=t; showModal('🚚 Votre camion', tkInfoHtml(t)); }
function tkUnfollow(){ TK.follow=null; try{ G.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); }catch(e){} const b=document.getElementById('tkStop'); if(b) b.remove(); }
function registerTruck3dActions(){
  Object.assign(ACTIONS,{
    tkFollow:()=>{ const t=TK.sel; closeModal(); if(!t||!t.e) return; TK.follow=t;
      let b=document.getElementById('tkStop'); if(!b){ b=document.createElement('button'); b.id='tkStop'; b.className='btn gold'; b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 90px);z-index:1200'; b.dataset.act='tkStop'; document.body.appendChild(b); }
      b.textContent=`🚚 Vous suivez ${t.info.driver} · ✖ Arrêter`; },
    tkStop:()=>tkUnfollow(),
    tkLine:()=>{ closeModal(); UI.coTab='trans'; UI.trM='truck'; if(typeof close3D==='function'&&!$('#globe').hidden) try{ close3D(); }catch(e){} setTab('company'); },
  });
}
// carte 2D : les camions se touchent aussi
{ const _md=typeof trMapDraw==='function'?trMapDraw:null; if(_md){ trMapDraw=function(){ _md(); try{ if(typeof L_trans!=='undefined'&&L_trans&&L_trans._mov) for(const m of L_trans._mov){ if(m._tk||m.mode!=='truck') continue; m._tk=1; const el=m.mk.getElement&&m.mk.getElement(); if(el){ el.style.pointerEvents='auto'; el.style.cursor='pointer'; }
    m.mk.on('click',()=>{ const X=S.tr.truck, Ln=X.lines.find(l=>{ const p=trLinePath('truck',l); return p&&p.pts[0].lat===m.ll[0][0]&&p.pts[0].lon===m.ll[0][1]&&p.pts[1].lat===m.ll[1][0]; }); if(!Ln) return; const vs=X.fleet.filter(v=>v.line===Ln.id); const veh=vs[Math.floor(m.off*vs.length)]||vs[0]; if(!veh) return;
      const V0=trVeh('truck',veh.k), h=tkHash(veh.id), pool2=tkPool();
      tkInfo({info:{veh,L:Ln,model:V0.n,cargo:TK_GOODS[h%TK_GOODS.length],tons:Math.round(V0.cap*(0.6+(h%40)/100)),driver:`${pool2[0][h%pool2[0].length]} ${pool2[1][(h>>3)%pool2[1].length]}`}}); }); } }catch(e){} }; } }
setInterval(()=>{ try{ tkTick(); }catch(e){ console.warn('trucks3d',e); } },1500);
