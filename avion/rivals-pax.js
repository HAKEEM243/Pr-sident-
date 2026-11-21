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
const _rivPaxC=new Map();
function rivPax(R,r,K,from,to){ const ck=(R.code||'')+'|'+(r.c||'')+from+to+'|'+((K&&K.m&&K.m.id)||''), hit=_rivPaxC.get(ck), now=(typeof S!=='undefined'&&S)?S.time:0; if(hit&&Math.abs(now-hit.at)<6*HOUR) return hit.v; const v=rivPax0(R,r,K,from,to); _rivPaxC.set(ck,{v,at:now}); if(_rivPaxC.size>3000) _rivPaxC.clear(); return v; }
function rivPax0(R,r,K,from,to){
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
  const tim={P0,tko:s2?t0+s2.t0:null,td:s8?t0+s8.t0:null,holdIn:sh?[t0+sh.t0,t0+sh.t1]:null,ga:sga?[t0+sga.t0,t0+sga.t1]:null,late:Math.round((dl.dep+dl.hIn+dl.ga)/MIN),depLate:Math.round(dl.dep/MIN),wxD:!!dl.wxD,wxA:!!dl.wxA,vip:!!dl.vip,fuel:!!dl.fuel};
  const from=ab?r.a:r.b, to=ab?r.b:r.a, key=(R.code||'')+r.a+r.b+i+dir+cyc, N=Math.max(4,Math.min(Number(K.m&&K.m.seats)||180,Math.round(rivPax(R,r,K,from,to)*(typeof ahDemand==='function'?ahDemand(from,to,P0):1)))), j=Math.round(N*0.08);   /* passagers selon le jour, la saison et l'heure */
  const fn=(r.c||R.code||'')+(100+hashStr(r.a+r.b+i+dir)%800), id='R'+key;
  let ac=RIV_AC.get(id); if(!ac){ const leg={from,to,dep:P,pax:{f:0,j,w:0,y:N-j},dist:K.d};
    ac={id,reg:rivReg(R,r,i),flight:{legs:[leg],li:0},_riv:1,_fn:fn,_R:R,model:K.m&&K.m.id,modelName:K.m&&K.m.name,status:'flight',condition:90,hub:from,loc:from,cfg:null}; RIV_AC.set(id,ac); if(RIV_AC.size>5000) RIV_AC.delete(RIV_AC.keys().next().value); }
  return {R,r,i,dir,cyc,K,P,arr,from,to,N,fn,key,ac,...tim,ops:typeof rivOps==='function'?rivOps(K,r,i,cyc):true,get man(){ try{ return manifestFor(ac,ac.flight.legs[0]); }catch(e){ return null; } }}; }
// le vol en cours (ou le prochain) de la rotation i à l'instant t
function rivTimes(K,r,i,dir,cyc){ const ab=dir==='AB', t0=K.anchors[i]-K.bA+cyc*K.P+(ab?0:K.pA.total+K.turn), dl=typeof rivDelays==='function'?rivDelays(r,i,dir,cyc):{dep:0,hIn:0,ga:0}, base=ab?K.pA:K.pB, pr=typeof rivProf==='function'?rivProf(base,dl):base;
  return {P:t0+(ab?K.bA:K.bB)+dl.dep, arr:t0+pr.total}; }
// prochain départ (et dernière arrivée) d'une rotation en sautant les rotations annulées (aéroport fermé)
function rivNextDep(K,r,i,c,t){ for(let k=0;k<8;k++,c++) if(typeof rivOps!=='function'||rivOps(K,r,i,c)) return rivTimes(K,r,i,'AB',c).P; return t+DAY; }
function rivLastArr(K,r,i,c,t){ for(let k=0;k<8;k++,c--) if(typeof rivOps!=='function'||rivOps(K,r,i,c)) return rivTimes(K,r,i,'BA',c).arr; return t-DAY; }
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
/* ---------- postes des autres compagnies : premier arrivé, premier servi ----------
   Chaque escale (de l'arrivée au départ) reçoit un poste libre pendant toute sa durée : jamais deux avions au même poste.
   Les mêmes postes servent à la carte, à la 3D et à l'aérogare. Les postes « préférés » de vos avions sont laissés libres
   tant qu'il en reste d'autres. Les escales sont réparties par blocs de midi à midi (heure locale) : les avions qui
   passent la nuit ne changent jamais de poste. Horaires prévus + 75 min de marge pour les retards. */
const _rgM=new Map(), RIV_REMOTE=60;
const rivGateN=code=>{ const g=typeof apGates==='function'?apGates(code):null; return g&&g.length?g.length:22; };
// vos avions (aux aéroports où les postes sont attribués) : un poste à chacun, unique et fixe ; au-delà, une place réservée sur l'aire éloignée
let _ogM={key:'',m:new Map(),used:new Set(),rem:0}; const RIV_PRES_K=13;   /* Kinshasa : poste devant le pavillon présidentiel */
function ownGateMap(code){ const F=S.fleet||[], key=code+'|'+F.length+'|'+(F[0]&&F[0].id)+'|'+(F[F.length-1]&&F[F.length-1].id)+'|'+rivGateN(code); if(_ogM.key===key) return _ogM;
  const n=rivGateN(code), used=new Set(code==='FIH'?[RIV_PRES_K]:[]), m=new Map(); let rem=0;   /* poste réservé à l'avion présidentiel */
  for(const ac of F.slice().sort((a,b)=>a.id<b.id?-1:1)){ let k=gateIdx(code,ac,!!ac.gIntl), t=0; while(used.has(k)&&t++<n) k=(k+1)%n; if(used.has(k)) m.set(ac.id,{rem:rem++}); else { used.add(k); m.set(ac.id,{k}); } }
  return _ogM={key,m,used,rem}; }
function ownGatePt(code,ac){ const v=ownGateMap(code).m.get(ac.id); if(!v) return slotPt(code,gateIdx(code,ac,!!ac.gIntl)); return v.k!=null?slotPt(code,v.k):rivRemotePt(code,v.rem); }
function rivOwnRes(code){ return ownGateMap(code).used; }
function rivGateBlock(code,x,seed){ const res=rivOwnRes(code), oRem=ownGateMap(code).rem, ck=code+'|'+x+'|'+(seed?1:0)+'|'+oRem+'|'+[...res].sort((a,b)=>a-b).join(','); let M=_rgM.get(ck); if(M) return M;
  const off=(typeof ahStd==='function'?ahStd(code):0)*HOUR, b0=x*DAY+12*HOUR-off, b1=b0+DAY, V=[], n=rivGateN(code);
  for(const [R,r] of rivRoutesAt(code)){ const K=rivalSched(r); if(!K) continue; const rk=(r.c||'')+r.a+r.b, intl=AP(r.a)&&AP(r.b)&&AP(r.a).cc!==AP(r.b).cc;
    for(let i=0;i<K.nP;i++){ const c0=Math.floor((b0-K.anchors[i])/K.P)-2, c1=Math.floor((b1-K.anchors[i])/K.P)+2;
      for(let c=c0;c<=c1;c++){ if(typeof rivOps==='function'&&!rivOps(K,r,i,c)) continue; const base=K.anchors[i]-K.bA+c*K.P; let s0,e0;
        if(r.b===code){ s0=base+K.pA.total-15*MIN; e0=base+K.pA.total+K.turn+K.bB+75*MIN; }
        else { e0=base+K.bA+75*MIN; let cp=c-1, m=0; while(m++<8&&typeof rivOps==='function'&&!rivOps(K,r,i,cp)) cp--; s0=K.anchors[i]-K.bA+cp*K.P+K.pA.total+K.turn+K.pB.total-15*MIN; }
        if(s0>=b0&&s0<b1) V.push({rk,i,s:s0,e:e0,pref:gateIdx(code,{id:r.a+r.b+i},intl)}); } } }
  V.sort((a,b)=>Math.min(a.e-a.s,4*HOUR)-Math.min(b.e-b.s,4*HOUR)||a.s-b.s||(a.rk<b.rk?-1:a.rk>b.rk?1:a.i-b.i));   /* escales courtes d'abord : les avions garés toute la journée prennent ce qui reste */
  const occ=new Map(), add=(k,s0,e0)=>(occ.get(k)||occ.set(k,[]).get(k)).push([s0,e0]);
  if(seed){ const P0=rivGateBlock(code,x-1,false); for(const L of P0.values()) for(const v of L) if(v.e>b0) add(v.k,v.s,v.e); }
  M=new Map(); let cur=null; const free=k=>!(occ.get(k)||[]).some(([s0,e0])=>s0<cur.e&&e0>cur.s), put=(v,k)=>{ v.k=k; add(k,v.s,v.e); const kk=v.rk+'|'+v.i; (M.get(kk)||M.set(kk,[]).get(kk)).push(v); };
  // moments où l'avion est montré (juste après l'arrivée, avant le départ) : deux avions peuvent partager une place éloignée s'ils ne sont jamais montrés en même temps
  const win=v=>v.e-v.s<5*HOUR?[[v.s,v.e]]:[[v.s,v.s+125*MIN],[v.e-185*MIN,v.e]], wocc=new Map(), freeW=k=>{ const W=win(cur); return !(wocc.get(k)||[]).some(([a,b])=>W.some(([c,d])=>a<d&&b>c)); };
  for(const v of V){ cur=v; let k=null; for(let j=0;j<n&&k==null;j++){ const c=(v.pref+j)%n; if(res.has(c)) continue; if(free(c)) k=c; }   /* jamais le poste d'un de vos avions */
    if(k==null){ for(let c=n+oRem;c<n+oRem+RIV_REMOTE;c++) if(free(c)){ k=c; break; } }   /* tout est pris : aire de stationnement éloignée (rangées au bout de l'aire) */
    if(k==null){ for(let c=n+oRem;c<n+oRem+RIV_REMOTE;c++) if(freeW(c)){ k=c; break; } }   /* aire éloignée pleine : place partagée avec un avion qui attend toute la journée */
    if(k==null){ let best=n+oRem, bo=1e18; for(let c=n+oRem;c<n+oRem+RIV_REMOTE;c++){ const o=(occ.get(c)||[]).reduce((t,[a,b])=>t+Math.max(0,Math.min(b,v.e)-Math.max(a,v.s)),0); if(o<bo){ bo=o; best=c; } } k=best; }
    put(v,k); for(const w of win(v)) (wocc.get(k)||wocc.set(k,[]).get(k)).push(w); }
  _rgM.set(ck,M); if(_rgM.size>80) _rgM.delete(_rgM.keys().next().value); return M; }
function rivGateK(code,r,i,t){ const rk=(r.c||'')+r.a+r.b, off=(typeof ahStd==='function'?ahStd(code):0)*HOUR, x=Math.floor((t+off-12*HOUR)/DAY);
  for(const xx of [x,x-1,x-2]){ const L=rivGateBlock(code,xx,true).get(rk+'|'+i); if(L) for(const v of L) if(t>=v.s-30*MIN&&t<=v.e+30*MIN) return v.k; } return null; }
// aire éloignée : aux deux bouts de l'aire principale, 2 rangées (la seconde côté piste), avions espacés de 75 m
const _rgEnd={};
function rivGateEnds(code,ap){ const k=code+'|'+rivGateN(code); if(_rgEnd[k]) return _rgEnd[k]; let lo=0, hi=0; const g=(typeof apGates==='function'&&apGates(code))||[]; for(const p of g){ const o=toRw(ap.rw,p).a-ap.a; lo=Math.min(lo,o); hi=Math.max(hi,o); } if(!g.length){ hi=Math.ceil(rivGateN(code)/2)*85; lo=-hi; } return _rgEnd[k]={lo,hi}; }   /* bout de la dernière porte de chaque côté (terminaux 2 à 4 compris) */
function rivRemotePt(code,j){ const ap=apronOf(code), rw=ap&&ap.rw, n=rivGateN(code); if(!rw) return slotPt0(code,n+j); const sd=j%2?1:-1, jj=Math.floor(j/2), col=Math.floor(jj/2), row=jj%2, E=rivGateEnds(code,ap);
  const a=ap.a+(sd>0?E.hi+150+col*75:E.lo-150-col*75), x=ap.x-ap.side*row*95; return {...fromRw(rw,a,x), hdg:(rw.hdg+90*ap.side+360)%360, code, remote:1}; }
const RIV_GATE_AP=new Set(['FIH']);   /* N'Djili : postes attribués comme dans l'aérogare du jeu (ailleurs : poste habituel de la ligne) */
function rivGatePt(code,r,i,t,intl){ if(!RIV_GATE_AP.has(code)) return gateSlot(code,{id:r.a+r.b+i},intl); try{ const k=rivGateK(code,r,i,t); if(k!=null){ const n=rivGateN(code); return k<n?slotPt(code,k):rivRemotePt(code,k-n); } }catch(e){} return gateSlot(code,{id:r.a+r.b+i},intl); }
const _rivPresC=new Map();
function rivPresent(code,t){ const ck=code+'|'+Math.floor(t/15000); let c=_rivPresC.get(ck); if(c) return c; c=rivPresent0(code,t); _rivPresC.set(ck,c); if(_rivPresC.size>40) _rivPresC.delete(_rivPresC.keys().next().value); return c; }
function rivPresent0(code,t){ const out=[]; if(typeof rivalSched!=='function') return out;
  for(const [R,r] of rivRoutesAt(code)){ const K=rivalSched(r); if(!K) continue;
    for(let i=0;i<K.nP;i++){ const T=K.P, rel=((t-K.anchors[i]+K.bA)%T+T)%T, cyc=Math.floor((t-K.anchors[i]+K.bA)/T); let at;
      if((K.cf||K.fu)&&typeof rivOps==='function'&&!rivOps(K,r,i,cyc)){ if(r.a!==code) continue; const intl=AP(r.a)&&AP(r.b)&&AP(r.a).cc!==AP(r.b).cc, gate=typeof gateSlot==='function'?rivGatePt(code,r,i,t,intl):null; const nP2=rivNextDep(K,r,i,cyc+1,t), lA2=rivLastArr(K,r,i,cyc-1,t); out.push({R,r,i,reg:rivReg(R,r,i),col:R.color||'#64748b',name:R.name||R.code,cat:K.cat,gate,nextDep:nP2,lastArr:lA2,prio:Math.min(nP2-t,t-lA2),night:1}); continue; }   /* rotation annulée : reste garé à sa base */
      { const ab=rel<K.pA.total+K.turn, dir=ab?'AB':'BA', rr=ab?rel:rel-(K.pA.total+K.turn), dl=rivDelays(r,i,dir,cyc), b0=ab?K.bA:K.bB, tot=rivProf(ab?K.pA:K.pB,dl).total; if(rr>=b0+dl.dep&&rr<tot) continue; }   // en mouvement (roulage, vol) : même règle que rivalPos
      let nx=null, lr=null;   /* prochain départ et dernière arrivée de cet avion, pour classer les plus utiles d'abord */
      if(rel<K.pA.total+K.turn){ const dl=rivDelays(r,i,'AB',cyc); if(rel<K.bA+dl.dep){ at=r.a; nx=['AB',cyc]; lr=['BA',cyc-1]; } else { at=r.b; nx=['BA',cyc]; lr=['AB',cyc]; } }
      else { const dl=rivDelays(r,i,'BA',cyc); if((rel-(K.pA.total+K.turn))<K.bB+dl.dep){ at=r.b; nx=['BA',cyc]; lr=['AB',cyc]; } else { at=r.a; nx=['AB',cyc+1]; lr=['BA',cyc]; } }
      if(at!==code) continue;
      let nP=t+DAY, lA=t-DAY; try{ nP=nx[0]==='AB'&&nx[1]>cyc?rivNextDep(K,r,i,nx[1],t):rivTimes(K,r,i,nx[0],nx[1]).P; lA=lr[0]==='BA'&&lr[1]<cyc?rivLastArr(K,r,i,lr[1],t):rivTimes(K,r,i,lr[0],lr[1]).arr; }catch(e){}
      const intl=AP(r.a)&&AP(r.b)&&AP(r.a).cc!==AP(r.b).cc, gate=typeof gateSlot==='function'?rivGatePt(code,r,i,t,intl):null;
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
    if(code==='FIH'&&typeof tmPresAt==='function'&&tmPresAt(t)) list.unshift({reg:'RDC 001',col:'#0369a1',stripe:'#facc15',name:'République démocratique du Congo',cat:'nb',model:'B737',gate:slotPt('FIH',RIV_PRES_K),pres:1});   /* avion présidentiel garé (même poste que dans l'aérogare) */
    for(const x of list){ let g=x.gate; const gk=g.lat.toFixed(5)+','+g.lon.toFixed(5); if(used.has(gk)){ const gs=typeof apGates==='function'?apGates(code):null; if(gs&&gs.length){ for(const y of gs){ const k2=y.lat.toFixed(5)+','+y.lon.toFixed(5); if(!used.has(k2)){ g=y; break; } } } } used.add(g.lat.toFixed(5)+','+g.lon.toFixed(5));
      want.add(x.reg); if(RIV3D.ents.has(x.reg)) continue;
      const m=getModel(x.model||(typeof REP_MODEL!=='undefined'&&REP_MODEL[x.cat])||'A20N')||getModel('A20N'), lt=typeof acLite==='function'&&acLite(), mi=AC3D.uri(m,lt?x.col:{tail:x.col,stripe:x.stripe||x.col,title:x.name},lt), pos=C.Cartesian3.fromDegrees(g.lon,g.lat,mi.R+mi.gH+0.4+EL);
      const e=V.entities.add({position:pos, orientation:C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians((g.hdg||0)-90),0,0)), model:{uri:mi.uri, shadows:C.ShadowMode.CAST_ONLY, distanceDisplayCondition:new C.DistanceDisplayCondition(0,26000)},
        label:{text:x.reg+' · '+x.name, font:'600 12px system-ui', fillColor:C.Color.WHITE, outlineColor:C.Color.BLACK, outlineWidth:3, style:C.LabelStyle.FILL_AND_OUTLINE, pixelOffset:new C.Cartesian2(0,-26), distanceDisplayCondition:new C.DistanceDisplayCondition(0,1600), disableDepthTestDistance:Number.POSITIVE_INFINITY}});
      if(x.R) e._rv={R:x.R,r:x.r,i:x.i}; try{ if(typeof apLit==='function') apLit(e); }catch(_){} RIV3D.ents.set(x.reg,e); }
    for(const [k,e] of RIV3D.ents) if(!want.has(k)){ V.entities.remove(e); RIV3D.ents.delete(k); }   // parti (repoussé : il roule maintenant)
  }catch(e){ console.warn('avions garés 3D',e); } }
if(typeof window!=='undefined') setInterval(riv3dTick,3000);
