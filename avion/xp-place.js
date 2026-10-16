/* =========================================================
   Sky Empire — les nouveaux terminaux ne coupent plus les routes
   • Placement : quand un aéroport a des terminaux 2, 3 ou 4, le jeu
     télécharge les routes autour (OpenStreetMap, une seule fois) et
     décale chaque terminal à l'endroit qui en coupe le moins. Le choix
     est gardé dans la partie ; la 2D et la 3D l'utilisent.
   • En 3D, une route qui passe encore sous un terminal (ou son aire de
     stationnement) le contourne par le bord ; les voitures suivent.
   ========================================================= */
'use strict';
const XPP={busy:false, fail:0, failT:0, roads:new Map()};
const XPP_EP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
// emprise au sol d'un terminal et de son aire (repère de la piste : a le long, x de côté)
function xpRect(t){ const s=t.s, x1=t.x-s*150, x2=t.x+s*60; return {a0:t.a-t.L/2-50, a1:t.a+t.L/2+50, x0:Math.min(x1,x2), x1:Math.max(x1,x2)}; }
function xpRects(code){ const T=typeof apTerminals==='function'?apTerminals(code):[]; const out=T.filter(t=>t.n!=='T1').map(t=>({r:t.r,R:xpRect(t),n:t.n}));
  const t4=T.find(t=>t.n==='T4'), t1=T[0]; if(t4&&t1){ const ap=apronOf(code), aC=ap.a-t1.L/2-130, ax=t4.x-t4.s*72; out.push({r:t4.r,R:{a0:aC-30,a1:aC+30,x0:Math.min(ap.x,ax),x1:Math.max(ap.x,ax)},n:'T4b'}); }
  return out; }
// un segment touche-t-il le rectangle ? (Liang-Barsky)
function xpSegHit(p,q,R){ let t0=0,t1=1; const dx=q.a-p.a, dy=q.x-p.x;
  for(const [pp,qq] of [[-dx,p.a-R.a0],[dx,R.a1-p.a],[-dy,p.x-R.x0],[dy,R.x1-p.x]]){ if(pp===0){ if(qq<0) return false; } else { const r=qq/pp; if(pp<0){ if(r>t1) return false; if(r>t0) t0=r; } else { if(r<t0) return false; if(r<t1) t1=r; } } }
  return true; }

/* ---------- placement : on choisit l'emplacement qui coupe le moins de routes ---------- */
async function xpPlace(code){
  const A=AP(code); if(!A||!(A.xp>=4)||XPP.busy) return; const ap=apronOf(code), r=ap&&ap.rw; if(!r) return;
  XPP.busy=true; let js=null; const d=0.07, q=`[out:json][timeout:25];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|service)$"](${(A.lat-d).toFixed(4)},${(A.lon-d).toFixed(4)},${(A.lat+d).toFixed(4)},${(A.lon+d).toFixed(4)});out geom 1500;`;
  for(const ep of XPP_EP){ try{ const res=await fetch(ep,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'}}); if(res.ok){ js=await res.json(); break; } }catch(e){} }
  XPP.busy=false; if(!js){ XPP.fail++; XPP.failT=Date.now(); return; }
  const segs=[]; for(const el of js.elements||[]){ const g=el.geometry, hw=(el.tags||{}).highway||''; if(!g||g.length<2) continue; const w=/motorway|trunk|primary/.test(hw)?4:/secondary|tertiary/.test(hw)?2:hw==='service'?0.4:1;
    for(let i=1;i<g.length;i++) segs.push({p:toRw(r,g[i-1]),q:toRw(r,g[i]),w}); }
  const S0=S.xpPlace=S.xpPlace||{}; const prev=S0[code]; delete S0[code];
  const base=apTerminals(code).filter(t=>t.n!=='T1'), t1=apTerminals(code)[0], R1=t1?{a0:t1.a-t1.L/2-60,a1:t1.a+t1.L/2+60,x0:Math.min(ap.x-t1.s*80,t1.x+t1.s*45),x1:Math.max(ap.x-t1.s*80,t1.x+t1.s*45)}:null;
  const out={}, taken=R1?[R1]:[];
  const cost=R=>{ let c=0; for(const sg of segs) if(xpSegHit(sg.p,sg.q,R)) c+=sg.w; return c; };
  const overlap=(P,Q)=>!(P.a1<Q.a0||Q.a1<P.a0||P.x1<Q.x0||Q.x1<P.x0);
  for(const t of base){ let best=null;
    for(const da of [0,-250,250,-500,500,-800,800]) for(const dxk of [0,120,250,400,600]){ const tt={...t,a:t.a+da,x:t.x+t.s*dxk}, R=xpRect(tt);
      if(Math.min(Math.abs(R.x0),Math.abs(R.x1))<160&&Math.sign(R.x0)!==Math.sign(R.x1)) continue;            // jamais sur la piste
      if(taken.some(Q=>overlap(R,Q))) continue;
      const sc=cost(R)*10+Math.abs(da)/400+dxk/300; if(!best||sc<best.sc) best={sc,da,dx:dxk,R}; }
    if(best){ out[t.n]={da:best.da,dx:best.dx}; taken.push(best.R); } }
  S0[code]={v:(prev&&prev.v||0)+1,o:out,t:Date.now()};
  if(typeof xpRefresh==='function') xpRefresh(code);
  const moved=Object.entries(out).filter(([,o])=>o.da||o.dx).map(([n])=>n);
  if(moved.length&&typeof logMsg==='function') logMsg(`🏗️ ${A.city} : ${moved.join(', ')} déplacé${moved.length>1?'s':''} pour ne pas couper les routes.`,'info');
}
function xpPlaceTick(){ if(typeof S==='undefined'||!S||XPP.busy) return; if(XPP.fail>=3&&Date.now()-XPP.failT<10*60e3) return;
  const todo=AIRPORT_CODES.filter(c=>AP(c).xp>=4&&!(S.xpPlace&&S.xpPlace[c]&&S.xpPlace[c].xp===AP(c).xp)); if(!todo.length) return;
  const c=todo[0]; xpPlace(c).then(()=>{ if(S.xpPlace&&S.xpPlace[c]) S.xpPlace[c].xp=AP(c).xp; }); }

/* ---------- en 3D : la route contourne le terminal ---------- */
function xpRoadAvoid(g){
  if(!g||g.length<2||typeof S==='undefined'||!S) return g; const p0=g[0];
  const near=AIRPORT_CODES.filter(c=>{ const A=AP(c); return A.xp>=4&&Math.abs(A.lat-p0.lat)<0.12&&Math.abs(A.lon-p0.lon)<0.12; });
  let out=g;
  for(const code of near) for(const {r,R} of xpRects(code)){ const E={a0:R.a0-15,a1:R.a1+15,x0:R.x0-15,x1:R.x1+15}; out=xpReroute(out,r,E); }
  return out; }
function xpReroute(g,r,R){
  const L=g.map(p=>toRw(r,p)); let hit=false; for(let i=1;i<L.length;i++) if(xpSegHit(L[i-1],L[i],R)){ hit=true; break; } if(!hit) return g;
  // points tous les 20 m
  const D=[L[0]]; for(let i=1;i<L.length;i++){ const p=L[i-1], q=L[i], n=Math.max(1,Math.ceil(Math.hypot(q.a-p.a,q.x-p.x)/20)); for(let k=1;k<=n;k++) D.push({a:p.a+(q.a-p.a)*k/n,x:p.x+(q.x-p.x)*k/n}); }
  const inR=p=>p.a>R.a0&&p.a<R.a1&&p.x>R.x0&&p.x<R.x1, W=R.a1-R.a0, H=R.x1-R.x0, P=2*(W+H);
  const edge=p=>{ const c={a:clamp(p.a,R.a0,R.a1),x:clamp(p.x,R.x0,R.x1)}, d=[[c.x-R.x0,'b'],[R.a1-c.a,'r'],[R.x1-c.x,'t'],[c.a-R.a0,'l']].sort((u,v)=>u[0]-v[0])[0][1];
    if(d==='b') return {a:c.a,x:R.x0,t:c.a-R.a0}; if(d==='r') return {a:R.a1,x:c.x,t:W+(c.x-R.x0)}; if(d==='t') return {a:c.a,x:R.x1,t:W+H+(R.a1-c.a)}; return {a:R.a0,x:c.x,t:2*W+H+(R.x1-c.x)}; };
  const corners=[{a:R.a0,x:R.x0,t:0},{a:R.a1,x:R.x0,t:W},{a:R.a1,x:R.x1,t:W+H},{a:R.a0,x:R.x1,t:2*W+H}];
  const around=(e1,e2)=>{ const f=((e2.t-e1.t)%P+P)%P, b=P-f, fw=f<=b, res=[];
    for(let k=0;k<8;k++){ const c=corners[(k)%4]; const dt=fw?((c.t-e1.t)%P+P)%P:((e1.t-c.t)%P+P)%P; if(dt>0&&dt<(fw?f:b)) res.push({...c,dt}); }
    return res.sort((u,v)=>u.dt-v.dt).filter((c,i,a)=>i===0||a[i-1].t!==c.t); };
  const out=[]; let i=0;
  while(i<D.length){ if(!inR(D[i])){ out.push(D[i]); i++; continue; }
    let j=i; while(j<D.length&&inR(D[j])) j++;
    if(i>0&&j<D.length){ const e1=edge(D[i]), e2=edge(D[j-1]); out.push(e1,...around(e1,e2),e2); }
    i=j; }
  if(out.length<2) return g;
  return out.map(p=>fromRw(r,p.a,p.x)).map(q=>({lat:q.lat,lon:q.lon}));
}

/* ---------- branchements ---------- */
function xppHook(){ if(xppHook.done||typeof apTerminals!=='function') return; xppHook.done=true;
  const _at=apTerminals; apTerminals=function(code){ const out=_at(code), P=typeof S!=='undefined'&&S&&S.xpPlace&&S.xpPlace[code]; if(!P||!P.o) return out;
    return out.map(t=>{ const o=P.o[t.n]; return o?{...t,a:t.a+(o.da||0),x:t.x+t.s*(o.dx||0)}:t; }); };
  // le cache des portes dépend du placement
  if(typeof apGates==='function'){ const _ag=apGates; apGates=function(code){ const P=S&&S.xpPlace&&S.xpPlace[code], v=P?P.v:0; if(typeof _gates!=='undefined'&&_gates[code]&&_gates[code].pv!==v){ delete _gates[code]; } const g=_ag(code); if(typeof _gates!=='undefined'&&_gates[code]) _gates[code].pv=v; return g; }; }
  setInterval(()=>{ try{ xpPlaceTick(); }catch(e){} },20000); setTimeout(()=>{ try{ xpPlaceTick(); }catch(e){} },4000);
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ xppHook(); }catch(e){ console.warn(e); } },0));
