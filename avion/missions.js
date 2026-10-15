/* =========================================================
   Sky Empire — 🎯 Campagne : de petite compagnie à géant de l'Afrique
   Une suite de missions qui fait découvrir chaque partie du jeu
   (lignes, provinces, clients, VIP, équipages, gouvernement,
   filiales de transport, classement). Chaque mission réussie
   donne une récompense à récupérer.
   ========================================================= */
'use strict';
const msServed=cc=>{ const set=new Set(); for(const r of S.routes||[]){ if(typeof routeAircraft==='function'&&!routeAircraft(r).length) continue; for(const s of r.stops){ const A=AP(s); if(A&&A.cc===cc) set.add(s); } } return set; };
const msProv=cc=>new Set([...msServed(cc)].map(c=>AP(c).prov||AP(c).city));
const msRank=()=>{ try{ const r=aiRows().find(x=>x.me); return r?r.rank:999; }catch(e){ return 999; } };
const msRankCont=()=>{ try{ const cont=COUNTRIES[homeCC()][1]; const rows=aiRows().filter(r=>r.me||(AP(r.hub)&&COUNTRIES[AP(r.hub).cc]&&COUNTRIES[AP(r.hub).cc][1]===cont)); return rows.findIndex(r=>r.me)+1; }catch(e){ return 999; } };
const msAvg=()=>{ const L=(S.reviews||[]).slice(0,30); return L.length<15?0:L.reduce((s,x)=>s+x.stars,0)/L.length; };
const msTrLines=()=>{ const T=S.tr||{}; return ['truck','boat','train'].reduce((s,k)=>s+(T[k]&&T[k].on?T[k].lines.length:0),0); };
const CAMPAIGN_MS=[
  {id:'m1',i:'🧭',t:'Premiers pas',d:'Ouvrez 3 lignes et faites-les voler.',p:()=>[Math.min(3,S.routes.filter(r=>typeof routeAircraft!=='function'||routeAircraft(r).length).length),3],cash:5e6,rep:1,go:['tab','network']},
  {id:'m2',i:'🌍',t:'Désenclaver le pays',d:'Desservez 10 villes de votre pays.',p:()=>[Math.min(10,msServed(homeCC()).size),10],cash:15e6,rep:2,go:['co','land']},
  {id:'m3',i:'⭐',t:'Des clients contents',d:'Obtenez une note moyenne d’au moins 4 ★ sur vos 30 derniers avis (15 avis minimum).',p:()=>[+msAvg().toFixed(1),4],cash:10e6,rep:2,go:['co','pax']},
  {id:'m4',i:'🥂',t:'Le salon VIP',d:'Ouvrez un salon VIP dans votre hub principal.',p:()=>[AP(S.company.hub)&&AP(S.company.hub).lounge?1:0,1],cash:8e6,rep:1,go:['co','up']},
  {id:'m5',i:'👨‍✈️',t:'Équipage d’élite',d:'Ayez 10 commandants (ou plus gradés) et nommez un chef pilote.',p:()=>{ const n=(S.pilots||[]).filter(p=>(p.rank||0)>=1).length, ch=(S.pilots||[]).some(p=>p.rank===3); return [Math.min(10,n)+(ch?1:0),11]; },cash:12e6,rep:1,go:['co','crew']},
  {id:'m6',i:'🏛️',t:'L’ami du gouvernement',d:'Atteignez 70/100 de relation avec le gouvernement de votre pays.',p:()=>[Math.min(70,(S.dev&&S.dev.rel&&S.dev.rel[homeCC()])||0),70],cash:20e6,rep:2,go:['co','land']},
  {id:'m7',i:'🏙️',t:'Une ville qui grandit',d:'Faites atteindre le palier « Piste modernisée » (25 000 passagers) à une ville de votre pays.',p:()=>[Math.min(2,Math.max(0,...Object.values((S.dev&&S.dev.c)||{}).map(d=>d.lvl||0))),2],cash:15e6,rep:2,go:['co','land']},
  {id:'m8',i:'🚚',t:'Groupe de transport',d:'Créez une filiale (camions, bateaux ou trains) et ouvrez 3 lignes de fret.',p:()=>[Math.min(3,msTrLines()),3],cash:10e6,rep:1,go:['co','trans']},
  {id:'m9',i:'🗺️',t:'Tout le pays',d:'Desservez des villes dans 12 provinces différentes de votre pays.',p:()=>[Math.min(12,msProv(homeCC()).size),12],cash:40e6,rep:3,go:['co','land']},
  {id:'m10',i:'🚢',t:'Le fleuve',d:'Faites naviguer une ligne de bateaux de Kinshasa à Kisangani (ou Mbandaka).',p:()=>{ const X=S.tr&&S.tr.boat; return [X&&X.on&&X.lines.some(L=>['KIS','MBA'].includes(L.b)||['KIS','MBA'].includes(L.a))&&X.fleet.some(v=>X.lines.some(L=>L.id===v.line&&(['KIS','MBA'].includes(L.b)||['KIS','MBA'].includes(L.a))))?1:0,1]; },cash:25e6,rep:2,go:['co','trans']},
  {id:'m11',i:'📈',t:'Dans le top 50 mondial',d:'Entrez dans les 50 premières compagnies du monde (classement par valeur).',p:()=>{ const r=msRank(); return [r<=50?1:0,1,r]; },cash:60e6,rep:3,go:['tab','news']},
  {id:'m12',i:'👑',t:'Le géant du continent',d:'Devenez la première compagnie de votre continent.',p:()=>{ const r=msRankCont(); return [r===1?1:0,1,r]; },cash:150e6,rep:5,go:['tab','news']},
];
const msDone=m=>{ const [a,b]=m.p(); return a>=b; };
function msCheck(silent){ const first=!S.ms; if(first) silent=true; S.ms=S.ms||{done:{},got:{}}; let n=0;
  for(const m of CAMPAIGN_MS){ if(S.ms.done[m.id]) continue; let ok=false; try{ ok=msDone(m); }catch(e){} if(ok){ S.ms.done[m.id]=S.time; n++; if(!silent){ logMsg(`🎯 Mission accomplie : ${m.t} ! Récompense à récupérer dans 🏢 Compagnie → 🎯 Missions.`,'ok'); if(typeof toast==='function') toast(`🎯 Mission accomplie : <b>${esc(m.t)}</b> — récupérez ${fmtMoney(m.cash)} dans 🏢 Compagnie → Missions`,'ok'); } } }
  if(first&&n&&typeof toast==='function') setTimeout(()=>toast(`🎯 Nouvelle campagne : vous avez déjà réussi ${n} mission(s) ! Récupérez vos récompenses dans 🏢 Compagnie → 🎯 Missions.`,'ok'),3000);
  return n; }
const msClaimable=()=>{ const M=S.ms||{done:{},got:{}}; return CAMPAIGN_MS.filter(m=>M.done[m.id]&&!M.got[m.id]).length; };
function msHtml(){
  msCheck(true); const M=S.ms, nDone=Object.keys(M.done).length;
  return `<div class="simplehelp">💡 La <b>campagne</b> vous guide de petite compagnie à géant du continent. Chaque mission fait découvrir une partie du jeu ; réussie, elle rapporte de l’argent et de l’image. Touchez « Comment ? » pour aller au bon endroit.</div>
  <div class="card"><b>${nDone}/${CAMPAIGN_MS.length} missions réussies</b> ${bar(nDone/CAMPAIGN_MS.length)}</div>
  ${CAMPAIGN_MS.map((m,i)=>{ let pr=[0,1]; try{ pr=m.p(); }catch(e){} const done=!!M.done[m.id], got=!!M.got[m.id], prev=i===0||M.done[CAMPAIGN_MS[i-1].id];
    return `<div class="card ${got?'':done?'gold-b':''}" style="${!done&&!prev?'opacity:.75':''}"><div class="row"><div class="grow">${m.i} <b>${m.t}</b> ${got?'<span class="badge ok">✅ récupérée</span>':done?'<span class="badge ok">réussie !</span>':''}<br><span class="small mut">${m.d}</span>
      ${!done?`<div class="small">${bar(Math.min(1,pr[0]/pr[1]))} ${pr[2]!==undefined?`rang actuel : ${pr[2]}ᵉ`:`${String(pr[0]).replace('.',',')} / ${pr[1]}`}</div>`:''}
      <div class="small">Récompense : <b>${fmtMoney(m.cash)}</b> · image +${m.rep}</div></div>
      ${done&&!got?`<button class="btn sm gold" data-act="msClaim" data-id="${m.id}">🎁 Récupérer</button>`:!done?`<button class="btn sm" data-act="msGo" data-id="${m.id}">Comment ?</button>`:''}</div></div>`; }).join('')}`;
}
function registerMissionActions(){
  Object.assign(ACTIONS,{
    msClaim:d=>{ const m=CAMPAIGN_MS.find(x=>x.id===d.id); S.ms=S.ms||{done:{},got:{}}; if(!m||!S.ms.done[m.id]||S.ms.got[m.id]) return; S.ms.got[m.id]=S.time; book('subventions',m.cash); S.reputation=clamp(S.reputation+m.rep,0,100);
      toast(`🎁 ${esc(m.t)} : +${fmtMoney(m.cash)}, image +${m.rep}`,'ok'); logMsg(`🎁 Récompense de mission « ${m.t} » : ${fmtMoney(m.cash)}.`,'ok'); renderTop(); renderPanel(); },
    msGo:d=>{ const m=CAMPAIGN_MS.find(x=>x.id===d.id); if(!m) return; if(m.go[0]==='co'){ UI.coTab=m.go[1]; setTab('company'); } else { if(m.go[1]==='news') UI.newsTab='rank'; setTab(m.go[1]); } const b=$('#panelBody'); if(b) b.scrollTop=0; },
  });
}
{ const _w=weeklyTick; weeklyTick=function(){ const r=_w.apply(this,arguments); try{ msCheck(false); }catch(e){ console.warn('missions',e); } return r; }; }
setInterval(()=>{ try{ if(typeof S!=='undefined'&&S&&S.fleet&&typeof booted!=='undefined'&&booted&&!UI.modal) msCheck(false); }catch(e){} },20000);   // seulement dans une partie lancée
