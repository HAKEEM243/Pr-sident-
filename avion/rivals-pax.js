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
  const base=K.anchors[i]-K.bA+cyc*K.P, ab=dir==='AB', P=base+(ab?K.bA:K.pA.total+K.turn+K.bB), arr=base+(ab?K.pA.total:K.pA.total+K.turn+K.pB.total);
  const from=ab?r.a:r.b, to=ab?r.b:r.a, key=(R.code||'')+r.a+r.b+i+dir+cyc, N=rivPax(R,r,K,from,to), j=Math.round(N*0.08);
  const fn=(r.c||R.code||'')+(100+hashStr(r.a+r.b+i+dir)%800), id='R'+key;
  let ac=RIV_AC.get(id); if(!ac){ const leg={from,to,dep:P,pax:{f:0,j,w:0,y:N-j},dist:K.d};
    ac={id,reg:rivReg(R,r,i),flight:{legs:[leg],li:0},_riv:1,_fn:fn,_R:R,model:K.m&&K.m.id,modelName:K.m&&K.m.name,status:'flight',condition:90,hub:from,loc:from,cfg:null}; RIV_AC.set(id,ac); if(RIV_AC.size>300) RIV_AC.delete(RIV_AC.keys().next().value); }
  return {R,r,i,dir,cyc,K,P,arr,from,to,N,fn,key,ac,get man(){ try{ return manifestFor(ac,ac.flight.legs[0]); }catch(e){ return null; } }}; }
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
  if(typeof rivalTip==='function'){ const _t=rivalTip; rivalTip=function(e){ let h=_t.apply(this,arguments); try{ const f=rivFlightAt(e.R,e.r,e.i,S.time); if(f) h=h.replace('<div class="rv-note">',`<div style="margin:6px 0"><b>${esc(f.fn)}</b> · ${esc(f.ac.reg)} · ${f.N} passagers <button class="btn" data-act="manifest" data-id="${esc(f.ac.id)}">📋 Manifeste</button></div><div class="rv-note">`); }catch(x){} return h; }; }
  Object.assign(ACTIONS,{ rivMan:d=>{ try{ closeModal(); }catch(e){} rivOpenManifest(d.c,d.a,d.b,d.i); } });
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ rivHook(); }catch(e){ console.warn('vols des autres compagnies',e); } },20));
