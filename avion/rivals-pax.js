/* =========================================================
   Sky Empire — ✈️ les vols des AUTRES compagnies, passager par passager
   Un seul calcul pour chaque vol d'une autre compagnie (horaires du jeu) :
   numéro de vol, immatriculation, nombre de passagers et manifeste complet
   (mêmes fiches que vos vols). Le même vol est identique partout :
   • carte 2D (touchez l'avion → « 📋 Manifeste ») ;
   • 3D (touchez l'avion) ;
   • intérieur de l'aérogare (départs, arrivées, chaque personne a sa fiche).
   Passagers fictifs générés par le jeu à partir du marché.
   ========================================================= */
'use strict';
const RIV_AC=new Map();
// nombre de passagers d'un vol : même estimation que la fiche de l'avion sur la carte
function rivPax(R,r,K,from,to){
  const seats=Number(K&&K.m&&K.m.seats)||150; let pax=null;
  try{ const code=r.c||R.code, c=typeof lineAirlines==='function'?lineAirlines(from,to).find(x=>x.code===code):null, dem=typeof marketDemand==='function'?Math.max(0,marketDemand(from,to)):0,
      freq=Math.max(0,Number(c&&c.freq)||Number(r.freq)||Number(K&&K.nP)||0); if(c&&freq>0) pax=Math.min(seats,Math.max(0,Math.round(dem*(c.share||0)/freq))); }catch(e){}
  if(!pax||pax<seats*0.25) pax=Math.round(seats*(0.68+(hashStr(r.a+r.b)%22)/100));
  return pax; }
function rivReg(R,r,i){ const h=hashStr((R.code||'')+r.a+r.b+i), cc=(R.cc||(AP(r.a)||{}).cc||'CD'), pre=String((COUNTRIES[cc]&&COUNTRIES[cc][3])||'9Q-').replace(/-?$/,'-');
  return pre+String.fromCharCode(65+h%26)+String.fromCharCode(65+(h>>5)%26)+String.fromCharCode(65+(h>>10)%26); }
// le vol n° cyc, dans le sens dir ('AB' ou 'BA'), de la rotation i de la ligne r
function rivFlight(R,r,i,dir,cyc){
  const K=typeof rivalSched==='function'?rivalSched(r):null; if(!K) return null; i=Math.min(i,K.nP-1);
  const base=K.anchors[i]-K.bA+cyc*K.P, ab=dir==='AB', t0=base+(ab?0:K.pA.total+K.turn), dl=typeof rivDelays==='function'?rivDelays(r,i,dir,cyc):{dep:0,hIn:0,ga:0}, pr=typeof rivProf==='function'?rivProf(ab?K.pA:K.pB,dl):(ab?K.pA:K.pB);
  const P0=t0+(ab?K.bA:K.bB), P=P0+dl.dep, arr=t0+pr.total, sg=k=>pr.segs.find(k), s2=sg(x=>x.ph===2), s8=sg(x=>x.ph===8), sh=sg(x=>x.hold==='in'), sga=sg(x=>x.ga);   // mêmes retards que la carte et la 3D
  const tim={P0,tko:s2?t0+s2.t0:null,td:s8?t0+s8.t0:null,holdIn:sh?[t0+sh.t0,t0+sh.t1]:null,ga:sga?[t0+sga.t0,t0+sga.t1]:null,late:Math.round((dl.dep+dl.hIn+dl.ga)/MIN),depLate:Math.round(dl.dep/MIN),wxD:!!dl.wxD,wxA:!!dl.wxA};
  const from=ab?r.a:r.b, to=ab?r.b:r.a, key=(R.code||'')+r.a+r.b+i+dir+cyc, N=rivPax(R,r,K,from,to), j=Math.round(N*0.08);
  const fn=(r.c||R.code||'')+(100+hashStr(r.a+r.b+i+dir)%800), id='R'+key;
  let ac=RIV_AC.get(id); if(!ac){ const leg={from,to,dep:P,pax:{f:0,j,w:0,y:N-j},dist:K.d};
    ac={id,reg:rivReg(R,r,i),flight:{legs:[leg],li:0},_riv:1,_fn:fn,_R:R,model:K.m&&K.m.id,modelName:K.m&&K.m.name,status:'flight',condition:90,hub:from,loc:from,cfg:null}; RIV_AC.set(id,ac); if(RIV_AC.size>5000) RIV_AC.delete(RIV_AC.keys().next().value); }
  return {R,r,i,dir,cyc,K,P,arr,from,to,N,fn,key,ac,...tim,get man(){ try{ return manifestFor(ac,ac.flight.legs[0]); }catch(e){ return null; } }}; }
// le vol en cours (ou le prochain) de la rotation i à l'instant t
function rivFlightAt(R,r,i,t){ const K=rivalSched(r); if(!K) return null; i=Math.min(i,K.nP-1);
  const x=t-K.anchors[i]+K.bA, cyc=Math.floor(x/K.P), rel=((x%K.P)+K.P)%K.P; return rivFlight(R,r,i,rel>=K.pA.total+K.turn?'BA':'AB',cyc); }
function rivOpenManifest(c,a,b,i){
  const R=(S.rivals||[]).find(x=>x.code===c), r=R&&(R.routes||[]).find(x=>x.a===a&&x.b===b); if(!r) return toast('Vol introuvable','bad');
  const f=rivFlightAt(R,r,+i||0,S.time); if(!f) return; ACTIONS.manifest({id:f.ac.id}); }
function rivHook(){ if(rivHook.done) return; rivHook.done=true;
  // les fiches, le manifeste et le contrôle aux frontières trouvent aussi les avions des autres compagnies
  if(typeof findAc==='function'){ const _f=findAc; findAc=function(id){ return _f(id)||RIV_AC.get(id); }; }
  if(typeof flightNumber==='function'){ const _n=flightNumber; flightNumber=function(ac){ return ac&&ac._riv?String(ac._fn).replace(/^[A-Z]+/i,''):_n.apply(this,arguments); }; }
  if(typeof manifestHtml==='function'){ const _m=manifestHtml; manifestHtml=function(ac){ let h=_m.apply(this,arguments); if(ac&&ac._riv){ const d=String(ac._fn).replace(/^[A-Z]+/i,''); h=h.split(esc(S.company.code)+d).join(`${esc(ac._fn)} · ${esc(ac._R&&ac._R.name||'')}${ac.modelName?' · '+esc(ac.modelName):''}`); } return h; }; }
  if(typeof passengerCardHtml==='function'){ const _p=passengerCardHtml; passengerCardHtml=function(ac){ const h=_p.apply(this,arguments); return ac&&ac._riv?String(h).split(esc(S.company.code)+String(ac._fn).replace(/^[A-Z]+/i,'')).join(esc(ac._fn)):h; }; }
  if(typeof bcFlight==='function'){ const _b=bcFlight; bcFlight=function(ac){ const r=_b.apply(this,arguments); if(r&&ac&&ac._riv) r.fno=ac._fn; return r; }; }
  // fiche de l'avion sur la carte 2D : accès au manifeste
  if(typeof rivalTip==='function'){ const _t=rivalTip; rivalTip=function(e){ let h=_t.apply(this,arguments); try{ const f=rivFlightAt(e.R,e.r,e.i,S.time); if(f) h=h.replace('<div class="rv-note">',`<div style="margin:6px 0"><b>${esc(f.fn)}</b> · ${esc(f.ac.reg)} · ${f.N} passagers${f.depLate?` · <b style="color:#f87171">retard +${f.depLate} min${f.wxD?' (météo au départ)':''}</b>`:''}${f.holdIn&&S.time>=f.holdIn[0]&&S.time<f.holdIn[1]?' · <b style="color:#f59e0b">circuit d’attente</b>':''}${f.ga&&S.time>=f.ga[0]&&S.time<f.ga[1]?' · <b style="color:#f87171">remise de gaz</b>':''} <button class="btn" data-act="manifest" data-id="${esc(f.ac.id)}">📋 Manifeste</button></div><div class="rv-note">`); }catch(x){} return h; }; }
  Object.assign(ACTIONS,{ rivMan:d=>{ try{ closeModal(); }catch(e){} rivOpenManifest(d.c,d.a,d.b,d.i); } });
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ rivHook(); }catch(e){ console.warn('vols des autres compagnies',e); } },20));

/* ---------- ✈️ avions des autres compagnies PRÉSENTS à un aéroport (un seul calcul pour la 3D et l'aérogare) ----------
   Un avion concurrent est soit en mouvement (rivalPos le donne : roulage, vol), soit garé à l'aéroport où il s'est posé
   en dernier. Ici on liste ceux qui sont garés à « code » à l'instant t, avec leur porte 3D (la même que celle où ils roulent). */
function rivRoutesAt(code){ const L=[], seen=new Set();
  for(const R of S.rivals||[]) for(const r of R.routes||[]) if(r.a===code||r.b===code){ const k=(r.c||R.code)+pairKey(r.a,r.b); if(!seen.has(k)){ seen.add(k); L.push([R,r]); } }
  try{ if(typeof AP_ROUTES!=='undefined'&&AP_ROUTES[code]&&typeof carriersOn==='function') for(const b of AP_ROUTES[code]) for(const c of carriersOn(code,b)){ if(c===S.company.code) continue; const k=c+pairKey(code,b); if(seen.has(k)) continue; seen.add(k); const R=ghostAirline(c); if(R) L.push([R,ghostRouteOf(c,code,b)]); } }catch(e){}
  return L; }
function rivPresent(code,t){ const out=[]; if(typeof rivalSched!=='function'||typeof rivalPos!=='function') return out;
  for(const [R,r] of rivRoutesAt(code)){ const K=rivalSched(r); if(!K) continue;
    for(let i=0;i<K.nP;i++){ let mv=null; try{ mv=rivalPos(r,i,t); }catch(e){} if(mv) continue;   // en mouvement : la 3D le dessine déjà
      const T=K.P, rel=((t-K.anchors[i]+K.bA)%T+T)%T, cyc=Math.floor((t-K.anchors[i]+K.bA)/T); let at;
      let nx=null, lr=null;   /* prochain départ et dernière arrivée de cet avion, pour classer les plus utiles d'abord */
      if(rel<K.pA.total+K.turn){ const dl=rivDelays(r,i,'AB',cyc); if(rel<K.bA+dl.dep){ at=r.a; nx=['AB',cyc]; lr=['BA',cyc-1]; } else { at=r.b; nx=['BA',cyc]; lr=['AB',cyc]; } }
      else { const dl=rivDelays(r,i,'BA',cyc); if((rel-(K.pA.total+K.turn))<K.bB+dl.dep){ at=r.b; nx=['BA',cyc]; lr=['AB',cyc]; } else { at=r.a; nx=['AB',cyc+1]; lr=['BA',cyc]; } }
      if(at!==code) continue;
      let nP=t+DAY, lA=t-DAY; try{ const a=rivFlight(R,r,i,nx[0],nx[1]); if(a) nP=a.P; const b=rivFlight(R,r,i,lr[0],lr[1]); if(b) lA=b.arr; }catch(e){}
      const intl=AP(r.a)&&AP(r.b)&&AP(r.a).cc!==AP(r.b).cc, gate=typeof gateSlot==='function'?gateSlot(code,{id:r.a+r.b+i},intl):null;
      out.push({R,r,i,reg:rivReg(R,r,i),col:R.color||'#64748b',name:R.name||R.code,cat:K.cat,gate,nextDep:nP,lastArr:lA,prio:Math.min(nP-t,t-lA)}); } }
  return out.sort((a,b)=>a.prio-b.prio||(a.reg<b.reg?-1:1)); }
// nombre d'avions garés montrés : le même pour la 3D et l'aérogare (téléphone : moins, pour la fluidité)
function rivPresentCap(){ try{ if(typeof GQ!=='undefined'&&GQ&&GQ.mob&&!GQ.hq) return 26; }catch(e){} try{ if(typeof UI!=='undefined'&&UI.mobile) return 26; }catch(e){} return 34; }
function rivPresentShown(code,t){ const all=rivPresent(code,t), must=all.filter(x=>x.nextDep-t<95*MIN||t-x.lastArr<110*MIN), rest=all.filter(x=>!must.includes(x)); return must.concat(rest).slice(0,Math.max(rivPresentCap(),must.length)); }   /* toujours ceux que l'aérogare peut mettre à une porte */

/* ---------- 3D : ces avions garés aux vraies portes (remplacent les avions décoratifs) ---------- */
const RIV3D={ents:new Map(),code:null,at:0};
function riv3dClear(){ try{ for(const e of RIV3D.ents.values()) G.viewer.entities.remove(e); }catch(e){} RIV3D.ents.clear(); RIV3D.code=null; }
function riv3dTick(){ try{ if(typeof G==='undefined'||!G||!G.viewer||!document.body.classList.contains('globe-on')){ if(RIV3D.ents.size) riv3dClear(); return; }
    const C=Cesium, V=G.viewer, cg=V.camera.positionCartographic; if(!cg) return; const lat=C.Math.toDegrees(cg.latitude), lon=C.Math.toDegrees(cg.longitude);
    let code=null, bd=1e9; if(cg.height<40000) for(const c of AIRPORT_CODES){ const a=AP(c); if(!a||Math.abs(a.lat-lat)>0.3||Math.abs(a.lon-lon)>0.3) continue; const d=gcDist(a,{lat,lon}); if(d<bd&&d<18){ bd=d; code=c; } }
    if(code!==RIV3D.code){ riv3dClear(); RIV3D.code=code; } if(!code) return;
    const t=typeof gSimNow==='function'?gSimNow():S.time, list=rivPresentShown(code,t).filter(x=>x.gate), want=new Set(), used=new Set(), EL=typeof gElev==='function'?gElev(code):0;
    for(const x of list){ let g=x.gate; const gk=g.lat.toFixed(5)+','+g.lon.toFixed(5); if(used.has(gk)){ const gs=typeof apGates==='function'?apGates(code):null; if(gs&&gs.length){ for(const y of gs){ const k2=y.lat.toFixed(5)+','+y.lon.toFixed(5); if(!used.has(k2)){ g=y; break; } } } } used.add(g.lat.toFixed(5)+','+g.lon.toFixed(5));
      want.add(x.reg); if(RIV3D.ents.has(x.reg)) continue;
      const m=getModel((typeof REP_MODEL!=='undefined'&&REP_MODEL[x.cat])||'A20N')||getModel('A20N'), lt=typeof acLite==='function'&&acLite(), mi=AC3D.uri(m,lt?x.col:{tail:x.col,stripe:x.col,title:x.name},lt), pos=C.Cartesian3.fromDegrees(g.lon,g.lat,mi.R+mi.gH+0.4+EL);
      const e=V.entities.add({position:pos, orientation:C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians((g.hdg||0)-90),0,0)), model:{uri:mi.uri, shadows:C.ShadowMode.CAST_ONLY, distanceDisplayCondition:new C.DistanceDisplayCondition(0,26000)},
        label:{text:x.reg+' · '+x.name, font:'600 12px system-ui', fillColor:C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new C.Cartesian2(0,-26), distanceDisplayCondition:new C.DistanceDisplayCondition(0,1600), disableDepthTestDistance:Number.POSITIVE_INFINITY}});
      e._rv={R:x.R,r:x.r,i:x.i}; try{ if(typeof apLit==='function') apLit(e); }catch(_){} RIV3D.ents.set(x.reg,e); }
    for(const [k,e] of RIV3D.ents) if(!want.has(k)){ V.entities.remove(e); RIV3D.ents.delete(k); }   // parti (repoussé : il roule maintenant)
  }catch(e){ console.warn('avions garés 3D',e); } }
if(typeof window!=='undefined') setInterval(riv3dTick,2000);
