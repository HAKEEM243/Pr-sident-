/* =========================================================
   Sky Empire — ✨ carte 2D épurée (activée par défaut, bouton dans ⚙️ Options)
   • les noms de villes ne se chevauchent plus : quand deux noms se
     touchent, on garde le plus important (hub, puis plus gros trafic) ;
   • vos lignes sont des traits fins et discrets ;
   • les avions des concurrents sont plus petits et un peu transparents,
     les vôtres restent bien visibles ;
   • fond de carte légèrement assombri pour faire ressortir les avions ;
   • à gauche, seulement « Carte », « Mes vols » et la 3D (le reste est
     dans le menu « Carte »).
   ========================================================= */
'use strict';
const mcOn=()=>typeof MAPOPT!=='undefined'&&MAPOPT.clean!==false;
function mcDeclutter(){
  if(typeof map==='undefined'||!map) return;
  const on=mcOn(); document.body.classList.toggle('mclean',on); document.body.classList.toggle('mc-lo',map.getZoom()<=4);
  const items=[];
  for(const [code,mk] of airportMk){ const el=mk.getElement(); if(!el) continue; const lb=el.querySelector('.ap-name'); if(!lb){ el.classList.remove('lbl-off'); continue; }
    const a=AP(code), hub=(S.hubs||[]).includes(code); items.push({el,lb,pri:(hub?1e6:0)+(code===S.company.hub?1e6:0)+(el.classList.contains('mine')?50:0)+(a.traffic||0)}); }
  if(!on){ for(const it of items) it.el.classList.remove('lbl-off'); return; }
  items.sort((a,b)=>b.pri-a.pri); const placed=[], pins=[];
  for(const mk of airportMk.values()){ const el=mk.getElement(); if(el){ const q=el.getBoundingClientRect(); pins.push({el,l:q.left,t:q.top,r:q.right,b:q.bottom}); } }
  for(const it of items){ const r=it.lb.getBoundingClientRect(), p=it.el.getBoundingClientRect(), box={l:Math.min(r.left,p.left)-3,t:Math.min(r.top,p.top)-2,r:r.right+4,b:Math.max(r.bottom,p.bottom)+2};
    const lr={l:r.left-2,t:r.top-1,r:r.right+2,b:r.bottom+1}, ov=(q,x)=>!(x.r<q.l||x.l>q.r||x.b<q.t||x.t>q.b);
    const hit=placed.some(q=>ov(q,box))||pins.some(q=>q.el!==it.el&&ov(q,lr)); it.el.classList.toggle('lbl-off',hit); if(!hit) placed.push(box); }
}
function mcRoutes(){
  if(!mcOn()||typeof L_routes==='undefined'||!L_routes) return;
  L_routes.eachLayer(l=>{ if(!(l instanceof L.Polyline)) return; const o=l.options;
    if(o.color==='#000') l.setStyle({opacity:0.25});
    else if(o.dashArray==='3 7') l.setStyle({opacity:0.4,weight:1.5});
    else if(o.className==='route-anim') l.setStyle({opacity:0.9,weight:2.4});
    else l.setStyle({opacity:0.72,weight:2.2,dashArray:null}); });
}
function mcHook(){ if(mcHook.done||typeof drawAirports!=='function') return; mcHook.done=true;
  if(MAPOPT.clean===undefined) MAPOPT.clean=true;
  const _da=drawAirports; drawAirports=function(){ const r=_da.apply(this,arguments); requestAnimationFrame(()=>{ try{ mcDeclutter(); }catch(e){} }); return r; };
  const _dr=drawRoutes; drawRoutes=function(){ const r=_dr.apply(this,arguments); try{ mcRoutes(); }catch(e){} return r; };
  // traînées : en vue épurée, seulement une petite queue (≈ 450 km) derrière chaque avion ; l'avion suivi garde toute sa trace
  const _ut=updateTrail; updateTrail=function(ac,st){ const r=_ut.apply(this,arguments); try{ if(!mcOn()||selectedPlane===ac.id) return r; const t=trails.get(ac.id); if(!t||t._mcAt===t.at) return r; t._mcAt=t.at;
      const ll=t.line.getLatLngs(); if(ll.length<2) return r; const out=[ll[ll.length-1]]; let d=0;
      for(let i=ll.length-2;i>=0&&d<450000;i--){ const sd=ll[i+1].distanceTo(ll[i]); if(d+sd>450000){ const u=(450000-d)/sd; out.unshift(L.latLng(ll[i+1].lat+(ll[i].lat-ll[i+1].lat)*u, ll[i+1].lng+(ll[i].lng-ll[i+1].lng)*u)); break; } out.unshift(ll[i]); d+=sd; }
      t.line.setLatLngs(out); t.line.setStyle({opacity:0.55,weight:2}); }catch(e){} return r; };
  const _zs=zoomScale; zoomScale=function(){ const k=_zs(); return k; };
  // avions concurrents : plus petits et transparents en vue épurée
  drawRivals=function(){
    if(!rivalCtx||!map) return; _rvDirty=false;
    const g=rivalCtx, d=rivalCv._d||1; g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,rivalCv.width,rivalCv.height);
    if(!MAPOPT.rival||!rivalPool.size) return;
    const on=mcOn(), sz=Math.round(19*zoomScale()*(on?0.82:1)), W=rivalCv.width/d, H=rivalCv.height/d; g.setTransform(d,0,0,d,0,0);
    for(const e of rivalPool.values()){
      const p=map.latLngToContainerPoint([e.lat,e.lon]); e.px=p.x; e.py=p.y;
      if(p.x<-30||p.y<-30||p.x>W+30||p.y>H+30) continue;
      const img=rivalSprite(e.R.color,e.cat); if(!img) continue;
      const k=e.gnd?0.72:1, z=Math.round(sz*k);
      g.save(); g.translate(p.x,p.y); g.rotate(e.hdg*Math.PI/180); g.globalAlpha=on?(e.gnd?0.8:0.62):(e.gnd?1:0.92); g.drawImage(img,-z/2,-z/2,z,z); g.restore();
      if(e.lbl&&sz>=22){ g.font='600 10px system-ui'; g.fillStyle='#fff'; g.strokeStyle='rgba(0,0,0,.75)'; g.lineWidth=3; g.strokeText(e.lbl,p.x+z/2+2,p.y+3); g.fillText(e.lbl,p.x+z/2+2,p.y+3); }
    }
  };
  const att=()=>{ if(typeof map==='undefined'||!map||att.done) return !!att.done; att.done=true; map.on('zoomend moveend',()=>requestAnimationFrame(()=>{ try{ mcDeclutter(); }catch(e){} })); return true; };
  if(!att()){ const iv=setInterval(()=>{ if(att()) clearInterval(iv); },1000); }
  // bouton dans les options de la carte
  const ctl=document.getElementById('mapctl'), ref=ctl&&ctl.querySelector('[data-act="mapStyle"]');
  if(ref&&!ctl.querySelector('[data-k="clean"]')){ const b=document.createElement('button'); b.className='adv'+(mcOn()?' on':''); b.dataset.act='mapToggle'; b.dataset.k='clean'; b.textContent='✨ Vue épurée'; ref.before(b); }
  const st=document.createElement('style'); st.textContent=`
body.mclean .ap-pin.lbl-off .ap-name{visibility:hidden}
body.mclean .ap-pin .ap-name{font-size:11px;font-weight:600}
body.mclean.mc-lo .ap-pin:not(.hub) span{opacity:.85}
body.mclean .leaflet-tile-pane{filter:saturate(.92) brightness(.93)}
body.mclean #mapctl:not(.open) button.keep:not(.primary){display:none}
body.mclean #mapctl button{font-size:11.5px;padding:5px 8px}`;
  document.head.appendChild(st);
  document.body.classList.toggle('mclean',mcOn());
  try{ drawRoutes(); drawAirports(); }catch(e){}
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ mcHook(); }catch(e){ console.warn(e); } },300));
