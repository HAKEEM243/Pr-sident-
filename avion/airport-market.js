/* =========================================================
   Sky Empire — qui vole vraiment ici, en ce moment
   Classement vivant des compagnies d'un aéroport (dont la vôtre) :
   destinations, vols par jour, passagers par jour, part de marché,
   recettes estimées, situation (expansion, crise, guerre…).
   Les chiffres des autres compagnies sont des estimations du jeu.
   ========================================================= */
'use strict';
// force commerciale d'une compagnie, qui change chaque semaine avec ses décisions (IA) : expansion ou
// économies, réputation, rentabilité, savoir-faire, croissance de la flotte depuis le début de la partie
function aiStr(e){ if(!e) return 1; if(!e.fleet0) e.fleet0=e.fleet||1;
  const m=e.plan&&e.plan.mode, mode=m==='grow'?1.2:m==='retrench'?0.8:m==='renew'?1.05:1;
  return clamp(mode*(0.75+(e.rep||60)/200)*(1+clamp(e.mavg||0,-0.25,0.25))*(1+clamp(e.skill||0,-0.3,0.3))*Math.sqrt(Math.max(0.2,(e.fleet||1)/e.fleet0))*(e.status==='dead'?0:1),0.2,3); }
const apSeats=d=>d<800?150:d<3000?180:d<7000?260:300;
const _apmk=new Map();
function apMarket(code){ const key=code+'|'+(S.ai?S.ai.ver:0)+'|'+Math.floor(S.time/(6*HOUR))+'|'+S.routes.length; const c=_apmk.get(code); if(c&&c.key===key) return c.v;
  const v=apMarketCalc(code); _apmk.set(code,{key,v}); if(_apmk.size>40) _apmk.delete(_apmk.keys().next().value); return v; }
function apMarketCalc(code){
  const A=AP(code), closed=airportClosed(code), rows=new Map();
  // vous
  const me={me:true, code:S.company.code, name:S.company.name, color:S.company.color||'#ffd60a', dests:new Set(), fl:0, pax:0, rev:0, routes:[], legs:{}};
  for(const r of S.routes){ if(!r.stops.includes(code)||!routeAircraft(r).length) continue; const f=routeFreq(r);
    for(let i=0;i<r.stops.length-1;i++){ const a=r.stops[i], b=r.stops[i+1]; if(a!==code&&b!==code) continue; const o=a===code?b:a; me.dests.add(o);
      for(const [x,y] of [[a,b],[b,a]]){ let mk=null; try{ mk=legMarket(r,x,y); }catch(e){ continue; }
        const pax=Math.min(mk.daily, f*acSeatsAvg(r)); me.pax+=pax; me.fl+=f; me.rev+=pax*(mk.y?mk.y.price:baseFare(x,y)); const L=me.legs[o]=me.legs[o]||{b:o,f:0,pax:0}; L.f+=f; L.pax+=pax; } }
    me.routes.push(r); }
  if(me.dests.size) rows.set('__me',me);
  // les autres compagnies (vrai réseau ± monde vivant : faillites, lignes fermées, suspensions, nouvelles lignes)
  for(const b of AP_ROUTES[code]||[]){ if(!AP(b)) continue; const cs=carriersOn(code,b); if(!cs.length) continue; const d=dist(code,b);
    const mood=Math.sqrt((typeof moodTraffic==='function'?moodTraffic(A.cc):1)*(typeof moodTraffic==='function'?moodTraffic(AP(b).cc):1));
    for(const c of cs){ const f=closed||airportClosed(b)?0:realFreq(code,b,cs.length)*mood*(typeof duelFq==='function'?1+duelFq(c,code,b)/Math.max(1,realFreq(code,b,cs.length)):1);
      const e=aiBy(c), R=rows.get(c)||{code:c, name:airlineName(c), color:airlineColor(c), e, dests:new Set(), fl:0, pax:0, rev:0, legs:{}};
      const lf=clamp(0.72+((e&&e.rep)||60)/1000,0.6,0.9), px=(typeof duelOf==='function'&&duelOf(c,code,b))?duelOf(c,code,b).px:1;
      const pax=f*2*apSeats(d)*lf*aiStr(e); R.dests.add(b); R.fl+=f*2; R.pax+=pax; R.legs[b]={b,f:f*2,pax}; R.rev+=pax*baseFare(code,b)*px; rows.set(c,R); } }
  // calage sur le trafic réel de l'aéroport (millions de passagers par an) : les estimations des autres compagnies sont ramenées à ce total
  const others=[...rows.values()].filter(x=>!x.me), est=others.reduce((t,x)=>t+x.pax,0);
  // le total suit la vie du pays : demande du directeur du monde, saison, tensions ou essor ; aéroport fermé = zéro
  const cf=(typeof wdF==='function'?wdF(A.cc):1)*(typeof seasonMult==='function'?seasonMult(S.time):1)*(typeof moodDemand==='function'?moodDemand(A.cc):1);
  // vos vols attirent aussi de nouveaux voyageurs : les autres compagnies gardent au moins 35 % du marché de base
  const base0=closed?0:(A.traffic||0)*1e6/365*cf, real=closed?0:Math.max(base0*0.35, base0-(me.pax||0)*0.6);
  if(est>0){ const k=Math.min(1.5,real/est); for(const x of others){ x.pax*=k; x.fl*=k; x.rev*=k; for(const L of Object.values(x.legs)){ L.pax*=k; L.f*=k; } } }
  const list=[...rows.values()], tot=list.reduce((s,x)=>s+x.pax,0)||1;
  for(const x of list) x.share=x.pax/tot;
  list.sort((x,y)=>y.pax-x.pax);
  // évolution d'une semaine sur l'autre (instantanés gardés dans la partie)
  S.apSnap=S.apSnap||{}; let sn=S.apSnap[code]; const cur={}; for(const x of list) cur[x.me?'__me':x.code]=Math.round(x.pax);
  if(!sn) sn=S.apSnap[code]={t:S.time,cur,tot:Math.round(tot),prev:null,ptot:0};
  else if(S.time-sn.t>=7*DAY){ sn.prev=sn.cur; sn.ptot=sn.tot; sn.cur=cur; sn.tot=Math.round(tot); sn.t=S.time; }
  const ks=Object.keys(S.apSnap); if(ks.length>60) delete S.apSnap[ks[0]];
  for(const x of list){ const p=sn.prev&&sn.prev[x.me?'__me':x.code]; x.trend=p?(x.pax-p)/p:null; }
  return {list, tot, closed, ttrend:sn.prev&&sn.ptot?(tot-sn.ptot)/sn.ptot:null, cf};
}
const flTxt=f=>f>=1?Math.round(f)+'/j':Math.max(1,Math.round(f*7))+'/sem';
// trajets d'une compagnie depuis cet aéroport (et ceux où vous êtes face à face)
function legsRow(code,R){ const mine=new Set(); for(const r of S.routes) if(routeAircraft(r).length){ const i=r.stops.indexOf(code); if(i<0) continue; if(i>0) mine.add(r.stops[i-1]); if(i<r.stops.length-1) mine.add(r.stops[i+1]); }
  const L=Object.values(R.legs||{}).sort((x,y)=>y.pax-x.pax), k=x=>x>=1e3?Math.round(x/1e3)+' k':Math.round(x);
  return `<tr><td></td><td colspan="7"><div class="small">${L.length?L.map(l=>{ const B=AP(l.b); return `<div data-act="openAp" data-c="${l.b}" style="cursor:pointer;padding:3px 0;border-bottom:1px solid #ffffff14">✈️ ${esc(AP(code).city)} ⇄ <b>${esc(B?B.city:l.b)}</b> <span class="mut">${l.b}${B&&B.cc!==AP(code).cc?' · '+esc(ccName(B.cc)):''}</span> · ${flTxt(l.f)} · ${k(l.pax)} pax/j${!R.me&&mine.has(l.b)?' · <b class="neg">⚔️ face à vous</b>':''}</div>`; }).join(''):'<span class="mut">Aucun trajet en ce moment.</span>'}</div></td></tr>`; }
function acSeatsAvg(r){ const acs=routeAircraft(r); if(!acs.length) return 150; return acs.reduce((s,a)=>s+(modelOf(a).seats||0),0)/acs.length; }
function apStatus(R){
  if(R.me) return R.routes.some(r=>(r.stats.rev-r.stats.cost)<0)?'⚠️ lignes déficitaires':'✅ vos lignes';
  const e=R.e; if(!e) return '';
  if(e.status==='dead') return '💀 faillite';
  const cc=homeOf(R.code), x=typeof wdC==='function'&&wdC(cc);
  if(x&&x.war) return '⚔️ pays en guerre'; if(x&&x.dis) return `🌪️ ${x.dis.name.toLowerCase()}`;
  if((e.debt||0)>=3) return '🔴 en difficulté';
  const m=e.plan&&e.plan.mode; if(m==='grow') return '📈 en expansion'; if(m==='retrench') return '📉 réduit la voilure'; if(m==='renew') return '🆕 renouvelle sa flotte';
  return e.mavg>0.12?'💰 très rentable':e.mavg<-0.05?'🔻 perd de l’argent':'⚖️ stable';
}
function apMarketHtml(code){
  let M; try{ M=apMarket(code); }catch(e){ console.warn(e); return ''; }
  if(!M.list.length) return '<div class="small mut">Aucune compagnie ne dessert cet aéroport en ce moment.</div>';
  const n=UI.apAll===code?M.list.length:10, k=x=>x>=1e6?(x/1e6).toFixed(1).replace('.',',')+' M':x>=1e3?Math.round(x/1e3)+' k':Math.round(x);
  const meIdx=M.list.findIndex(x=>x.me);
  const key=R=>R.me?'__me':R.code, open=R=>UI.apCo===code+'|'+key(R);
  const row=(R,i)=>`<tr class="${R.me?'me':''}" data-act="apCo" data-c="${code}" data-k="${key(R)}" style="cursor:pointer"><td>${i+1}</td><td><span class="dot" style="background:${R.color}"></span><b>${R.me?'⭐ '+esc(R.name):esc(R.name)}</b>${R.e&&R.e.fleet?`<br><small class="mut">${R.e.fleet} avions${R.e.alliance?' · '+esc(R.e.alliance):''}</small>`:''}</td>
    <td>${R.dests.size}</td><td>${flTxt(R.fl)}</td><td>${k(R.pax)}${R.trend!=null&&Math.abs(R.trend)>=0.01?`<br><small class="${R.trend>0?'pos':'neg'}">${R.trend>0?'▲':'▼'} ${Math.abs(Math.round(R.trend*100))} %</small>`:''}</td><td><b>${Math.round(R.share*100)} %</b><div class="pbar"><i style="width:${Math.min(100,R.share*100).toFixed(0)}%;background:${R.color}"></i></div></td><td>${fmtMoney(R.rev)}</td><td class="small">${apStatus(R)}<br><span class="mut">${open(R)?'▲ fermer':'▼ trajets'}</span></td></tr>${open(R)?legsRow(code,R):''}`;
  const A=AP(code), wx=typeof wdC==='function'&&wdC(A.cc), reg=wx&&wx.reg&&wx.reg!=='normal'?(wx.reg==='boom'?'en plein essor':wx.reg==='recession'?'en récession':'en reconstruction'):'';
  const dem=`<div class="mut">📊 Demande de voyages en ${esc(ccName(A.cc))} : <b class="${M.cf>=1?'pos':'neg'}">${M.cf>=1?'+':'−'}${Math.abs(Math.round((M.cf-1)*100))} %</b> par rapport à la normale${typeof seasonMult==='function'&&seasonMult(S.time)<0.97?' (basse saison)':typeof seasonMult==='function'&&seasonMult(S.time)>1.03?' (haute saison)':''}${reg?` (pays ${reg})`:''}${wx&&wx.war?' · ⚔️ guerre':''}${wx&&wx.dis?' · '+esc(wx.dis.name):''}${M.ttrend!=null?` · trafic de l’aéroport <b class="${M.ttrend>=0?'pos':'neg'}">${M.ttrend>=0?'▲':'▼'} ${Math.abs(Math.round(M.ttrend*100))} %</b> en une semaine`:''}. Le classement bouge chaque semaine selon les décisions des compagnies (IA). Touchez une compagnie pour voir ses trajets.</div>`;
  return `<div class="card small apmk"><b>🛫 Qui vole ici en ce moment</b> · ${M.list.length} compagnie${M.list.length>1?'s':''} · ≈ ${k(M.tot)} passagers/jour${M.closed?' · <b class="neg">aéroport fermé</b>':''}
    ${dem}
    ${meIdx>=0?`<div class="al ok">⭐ Vous êtes <b>${meIdx+1}ᵉ</b> sur ${M.list.length} ici : ${Math.round(M.list[meIdx].share*100)} % des passagers, ≈ ${fmtMoney(M.list[meIdx].rev)} de recettes par jour.</div>`:`<div class="al">Vous ne desservez pas encore cet aéroport.</div>`}
    <div style="overflow-x:auto"><table class="tbl"><tr><th>#</th><th>Compagnie</th><th>Dest.</th><th>Vols</th><th>Pax/j</th><th>Part</th><th>Recettes/j</th><th>Situation</th></tr>
    ${M.list.slice(0,n).map(row).join('')}${meIdx>=n?row(M.list[meIdx],meIdx):''}</table></div>
    ${M.list.length>10?`<div class="btns"><button class="btn sm" data-act="apAll" data-c="${code}">${UI.apAll===code?'Réduire':`Voir les ${M.list.length} compagnies`}</button></div>`:''}
    <div class="mut" style="margin-top:4px">Vos chiffres viennent de vos lignes ; ceux des autres compagnies sont des estimations (réseau réel, demande, fréquences, guerres et suspensions en cours).</div></div>`;
}
function registerApMarketActions(){ Object.assign(ACTIONS,{ apCo:d=>{ const v=d.c+'|'+d.k; UI.apCo=UI.apCo===v?null:v; if(typeof openAirport==='function') openAirport(d.c); }, apPil:d=>{ UI.apPil=d.c; if(typeof openAirport==='function') openAirport(d.c); }, apAll:d=>{ UI.apAll=UI.apAll===d.c?null:d.c; if(typeof openAirport==='function') openAirport(d.c); } }); }
