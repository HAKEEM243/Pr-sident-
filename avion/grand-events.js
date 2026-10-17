/* =========================================================
   Sky Empire — 🏟️ GRANDS ÉVÉNEMENTS MONDIAUX, trophées et prestige
   Tous les 10 à 15 jours de jeu, une ville accueille un grand événement
   (CAN, Coupe du monde, JO, Hajj, carnaval, méga-concert…). Annoncé
   3 jours avant, il dure 6 jours : la demande vers cette ville explose
   et c'est la COURSE entre compagnies pour transporter le plus de
   voyageurs. Classement en direct, vraies compagnies qui ajoutent des
   vols, et vous : bouton « ✈️ Vols spéciaux » qui fait vraiment
   décoller vos avions libres vers l'événement.
   Récompenses qui comptent même quand on est milliardaire :
   🏆 trophées (salle des trophées), ⭐ points de prestige, et une
   boutique de prestige (avions légendaires, campagne mondiale,
   partenaire officiel…). Tout est fictif.
   ========================================================= */
'use strict';
const GE_CAT=[
  {k:'can',ic:'⚽',n:'Coupe d’Afrique des Nations',c:['FIH','ABJ','LOS','CAI','DSS','DLA','RAK','NBO','JNB','LAD'],m:4,why:'des milliers de supporters suivent leur équipe'},
  {k:'wc',ic:'🏆',n:'Coupe du monde de football',c:['DOH','JFK','CDG','GRU','MEX','MAD','LHR','YYZ'],m:3.5,why:'le monde entier vient voir les matchs'},
  {k:'jo',ic:'🏅',n:'Jeux olympiques',c:['CDG','LAX','BNE','NRT','DXB','CPT'],m:3.2,why:'athlètes, familles et touristes du monde entier'},
  {k:'hajj',ic:'🕋',n:'Hajj, le grand pèlerinage',c:['JED'],m:5,why:'des millions de pèlerins vers La Mecque'},
  {k:'rio',ic:'🎭',n:'Carnaval de Rio',c:['GIG'],m:3.5,why:'la plus grande fête du monde'},
  {k:'rumba',ic:'🎤',n:'Méga-concert de rumba au Stade des Martyrs',c:['FIH'],m:4,why:'la diaspora rentre pour le concert de l’année'},
  {k:'amani',ic:'🎶',n:'Festival Amani',c:['GOM'],m:4.5,why:'musique et paix au bord du lac Kivu'},
  {k:'au',ic:'🏛️',n:'Sommet de l’Union africaine',c:['ADD'],m:3,why:'chefs d’État, ministres, journalistes'},
  {k:'expo',ic:'🌍',n:'Exposition universelle',c:['DXB','KIX','RUH'],m:3,why:'pavillons de 190 pays'},
  {k:'fashion',ic:'👗',n:'Semaine de la mode',c:['CDG','MXP','JFK','LHR'],m:2.8,why:'créateurs, mannequins, acheteurs'},
  {k:'fikin',ic:'🎪',n:'Grande foire de Kinshasa',c:['FIH'],m:3.5,why:'commerçants de toute l’Afrique'},
];
const GE_ANN=3*DAY, GE_LEN=6*DAY;
const geS=()=>{ S.ge=S.ge||{cur:null,next:0,pp:0,trophies:[],perks:{},hist:[]}; return S.ge; };
const geActive=()=>{ const g=S&&S.ge&&S.ge.cur; return g&&S.time>=g.start&&S.time<g.end?g:null; };
const gePhase=g=>!g?'none':S.time<g.start?'ann':S.time<g.end?'on':'done';
const geSeats=()=>S.fleet.reduce((s,a)=>s+(modelOf(a).seats||0),0);

/* ---------- déroulement ---------- */
function geNew(){
  const g=geS(); const cat=pick(GE_CAT), city=pick(cat.c.filter(c=>AP(c)))||'FIH'; if(!AP(city)) return;
  const start=S.time+GE_ANN, cc=AP(city).cc;
  // les concurrents : les plus grandes compagnies qui desservent la ville (vraies compagnies du jeu)
  const near=aiAlive().filter(e=>e.status!=='dead'&&(e.hub===city||e.cc===cc||(AP_ROUTES[city]||[]).some(b=>carriersOn(city,b).includes(e.code)))).sort((x,y)=>y.fleet-x.fleet).slice(0,5);
  // la vitesse des concurrents suit ce que VOTRE flotte peut transporter vers la ville (un quart des sièges, allers-retours compris)
  const d=Math.min(...(S.hubs||[S.company.hub]).map(h=>dist(h,city)).concat([12000])), rt=2*(d/800+1.5), base=Math.max(20,geSeats()*0.3/Math.max(3,rt));
  g.cur={id:uid(),k:cat.k,ic:cat.ic,n:cat.n,why:cat.why,city,m:cat.m,start,end:start+GE_LEN,me:0,ai:near.map(e=>({code:e.code,name:e.name,color:e.color||airlineColor(e.code),pts:0,rate:base*(0.45+Math.random()*0.9)*(e.fleet>=100?1.2:1)})),done:false};
  aiNews(`${cat.ic} Annonce : ${cat.n} à ${keyCity(city)} dans 3 jours ! ${cat.why[0].toUpperCase()+cat.why.slice(1)}. Les compagnies se préparent — touchez 🏟️ sur la carte.`,'rival',true);
  if(typeof toast==='function'&&!UI.silent) toast(`${cat.ic} ${cat.n} à ${keyCity(city)} dans 3 jours : la course aux voyageurs commence bientôt ! (🏟️ sur la carte)`,'ok');
}
function geHourly(){
  if(!S||!S.fleet||!S.ai) return; const g=geS();
  if(!g.cur&&!g.next) g.next=S.time+rndi(2,5)*DAY;
  if(!g.cur&&S.time>=g.next){ geNew(); return; }
  const e=g.cur; if(!e) return;
  if(!e.started&&S.time>=e.start){ e.started=true; aiNews(`${e.ic} C’est parti : ${e.n} à ${keyCity(e.city)} ! La demande vers la ville explose pendant 6 jours.`,'rival',true);
    if(typeof toast==='function'&&!UI.silent) toast(`${e.ic} ${e.n} commence ! Envoyez vos avions vers ${esc(keyCity(e.city))} (🏟️)`,'ok');
    // les concurrents ajoutent des vols visibles vers la ville
    for(const a of e.ai){ const R=(S.rivals||[]).find(x=>x.code===a.code); if(!R) continue; const rt=R.routes.find(x=>x.a===e.city||x.b===e.city); if(rt){ rt.freq=(rt.freq||1)+2; rt.geBoost=(rt.geBoost||0)+2; R._v=(R._v||0)+1; S.ai.ver++; } } }
  if(geActive()){ for(const a of e.ai) a.pts+=a.rate*(0.6+Math.random()*0.8); }
  if(S.time>=e.end&&!e.done) geEnd(e);
}
function geEnd(e){
  e.done=true; const g=geS();
  for(const R of S.rivals||[]) for(const rt of R.routes) if(rt.geBoost){ rt.freq=Math.max(1,rt.freq-rt.geBoost); rt.geBoost=0; R._v=(R._v||0)+1; }
  if(S.ai) S.ai.ver++;
  const rows=[{me:true,name:S.company.name,pts:e.me},...e.ai.map(a=>({name:a.name,pts:Math.round(a.pts)}))].sort((x,y)=>y.pts-x.pts), place=rows.findIndex(r=>r.me)+1;
  let pp=0, tro=null;
  if(e.me>0){ pp=place===1?30:place<=3?15:5; tro=place===1?'🥇':place===2?'🥈':place===3?'🥉':'🎖️';
    if(g.perks.sponsor){ pp=Math.round(pp*1.5); g.perks.sponsor=false; }
    g.pp+=pp; g.trophies.unshift({ic:e.ic,n:e.n,city:keyCity(e.city),place,tro,t:S.time,pax:e.me}); if(g.trophies.length>60) g.trophies.length=60;
    if(place===1){ S.reputation=clamp(S.reputation+3,0,100); } }
  g.hist.unshift({n:e.n,ic:e.ic,city:keyCity(e.city),rows:rows.slice(0,6)}); if(g.hist.length>12) g.hist.length=12;
  aiNews(`${e.ic} Fin de ${e.n} à ${keyCity(e.city)} : ${rows[0].me?`${S.company.name} gagne la course`:`${rows[0].name} gagne la course`} (${num(rows[0].pts)} voyageurs)${e.me>0?` · vous êtes ${place}ᵉ`:''}.`,'rival',true);
  if(typeof toast==='function'&&!UI.silent) toast(e.me>0?`${tro} ${e.n} : vous finissez ${place}ᵉ ! +${pp} ⭐ prestige (voir 🏟️)`:`${e.ic} ${e.n} terminé : vous n’avez transporté personne vers ${esc(keyCity(e.city))}.`,e.me>0?'ok':'info');
  g.cur=null; g.next=S.time+rndi(10,15)*DAY;
}
// vos voyageurs comptent quand vos avions se posent dans la ville pendant l'événement
function geCount(leg,n,sp){ let e=geActive(); const c=S.ge&&S.ge.cur; if(!e&&sp&&c&&c.id===sp&&gePhase(c)!=='done') e=c; if(!e||!leg||leg.to!==e.city||!n) return; e.me+=Math.round(n*(S.ge.perks.sponsorOn?1.3:1)); }

/* ---------- vos vols spéciaux : de vrais vols vers l'événement ---------- */
// itinéraire vers l'événement : direct, ou avec 1 ou 2 escales techniques si l'avion n'a pas l'autonomie
const _geIt={};
function geItin(ac,to){ const m=modelOf(ac), from=ac.loc, k=from+'>'+to+'|'+m.id; if(_geIt[k]!==undefined) return _geIt[k];
  const R=m.range*0.95, ok=st=>!checkLegs(ac,legsFor(st));
  if(dist(from,to)<=R&&ok([from,to])) return _geIt[k]=[from,to];
  const pool=AIRPORT_CODES.filter(c=>c!==from&&c!==to&&AP(c).cls>=3&&!airportClosed(c)&&!runwayCheck(m,c));
  let best=null; for(const x of pool){ const a=dist(from,x), b=dist(x,to); if(a<=R&&b<=R){ const t=a+b; if(!best||t<best.t) best={t,st:[from,x,to]}; } }
  if(best&&ok(best.st)) return _geIt[k]=best.st;
  // deux escales : on avance le plus possible vers la destination
  const hop=pool.filter(c=>dist(from,c)<=R).sort((u,v)=>dist(u,to)-dist(v,to)).slice(0,25);
  for(const x of hop){ let b2=null; for(const y of pool){ if(y===x) continue; const a=dist(x,y), b=dist(y,to); if(a<=R&&b<=R){ const t=dist(from,x)+a+b; if(!b2||t<b2.t) b2={t,st:[from,x,y,to]}; } }
    if(b2&&ok(b2.st)) return _geIt[k]=b2.st; }
  return _geIt[k]=null; }
function geCandidates(e){ return S.fleet.filter(a=>a.status==='idle'&&(a.readyAt||0)<=S.time+10*MIN&&!a.charterQ&&(modelOf(a).seats||0)>=50&&S.hubs.includes(a.loc)&&a.loc!==e.city); }
// recrute ce qui manque pour faire partir l'avion (PNC et pilotes qualifiés)
function geCrew(ac){ const m=modelOf(ac);
  let g=0; while(qualifiedPilots(m.fam)<2*(activeOfFamily(m.fam,ac)+1)&&g++<20){ const p=makePilot([m.fam],true); S.pilots.push(p); book('recrutement',-p.salary); }
  const miss=cabinBusy(ac)+cabinNeed(m)-S.staff.pnc; if(miss>0){ book('recrutement',-STAFF_CATS.pnc[1]*0.6*miss); S.staff.pnc+=miss; geCrew.n=(geCrew.n||0)+miss; } }
function geSpecials(){ geSpecials.why=null; geCrew.n=0;
  const e=S.ge&&S.ge.cur; if(!e||gePhase(e)==='done') return 'Aucun événement en cours';
  const idle=geCandidates(e); if(!idle.length) return 'Aucun avion de passagers libre au sol dans vos hubs';
  let n=0, far=0, stops=new Set(); const max=idle.length;   // tous les avions libres partent
  for(const ac of idle){ if(n>=max) break; const go=geItin(ac,e.city); if(!go){ far++; continue; }
    const st=[...go,...go.slice(0,-1).reverse()];                 // aller puis retour par le même chemin
    let err=startFlight(ac,st,'charter',S.time,{});                                   // départ tout de suite
    if(err&&/PNC|pilotes/.test(err)){ geCrew(ac); err=startFlight(ac,st,'charter',S.time,{}); }   // équipage manquant : on recrute pour ce vol
    if(err){ geSpecials.why=err; continue; }
    const seats=modelOf(ac).seats||100, iArr=go.length-2; ac.flight.ge=e.id;
    ac.flight.legs.forEach((l,i)=>{ l.pax={f:0,j:0,w:0,y:Math.round(seats*(i<=iArr?0.97:0.55))}; });
    go.slice(1,-1).forEach(c=>stops.add(AP(c).city)); n++; }
  if(!n&&geSpecials.why) return 'Aucun avion n’a pu partir : '+geSpecials.why;
  if(!n) return far?`Vos ${far} avion(s) libre(s) n’ont pas l’autonomie pour rejoindre ${keyCity(e.city)}, même avec des escales`:'Aucun avion n’a pu partir';
  geSpecials.last=`✈️ ${n} avion${n>1?'s':''} parti${n>1?'s':''} vers ${keyCity(e.city)}${stops.size?` (escale${stops.size>1?'s':''} : ${[...stops].slice(0,4).join(', ')})`:''}${far?` · ${far} trop court${far>1?'s':''} en autonomie`:''}${geCrew.n?` · ${geCrew.n} PNC recrutés`:''}`;
  logMsg(`${geSpecials.last} pour ${e.n}.`,'ok'); return null;
}

/* ---------- boutique de prestige ---------- */
const GE_SHOP=[
  {k:'amb',ic:'🎙️',n:'Ambassadeur star',d:'Une célébrité devient le visage de la compagnie : image +5.',c:20,run:()=>{ S.reputation=clamp(S.reputation+5,0,100); }},
  {k:'camp',ic:'📣',n:'Campagne mondiale',d:'+15 % de demande sur toutes vos lignes pendant 30 jours.',c:30,run:g=>{ g.perks.camp=S.time+30*DAY; }},
  {k:'sponsor',ic:'🏟️',n:'Partenaire officiel',d:'Au prochain grand événement : vos voyageurs comptent +30 % et votre prestige gagné ×1,5.',c:35,run:g=>{ g.perks.sponsor=true; }},
  {k:'gold',ic:'🌟',n:'Avion légendaire « Léopard d’Or »',d:'Un A380 doré unique, livré gratuitement à votre hub.',c:80,run:()=>{ const ac=addAircraft('A388',{owned:true,hub:S.company.hub}); ac.name='Léopard d’Or'; ac.livery={body:'#d4a017',tail:'#111827',stripe:'#fde68a'}; ac.legend=true; }},
  {k:'conc',ic:'🚀',n:'Concorde de collection',d:'Un Concorde restauré, livré à votre hub : Paris–Kinshasa en 3 h.',c:120,run:()=>{ const ac=addAircraft('CONC',{owned:true,hub:S.company.hub}); ac.name='Concorde Kongo'; ac.legend=true; }},
];
function geBuy(k){ const g=geS(), it=GE_SHOP.find(x=>x.k===k); if(!it) return 'Article inconnu'; if(g.pp<it.c) return `Il faut ${it.c} ⭐ (vous en avez ${g.pp})`;
  g.pp-=it.c; it.run(g); logMsg(`${it.ic} Prestige : ${it.n} obtenu (−${it.c} ⭐).`,'ok'); return null; }

/* ---------- interface ---------- */
function geHtml(){
  const g=geS(), e=g.cur, ph=gePhase(e);
  let ev='';
  if(e){ const rows=[{me:true,name:S.company.name,pts:e.me,color:S.company.color||'#ffd60a'},...e.ai.map(a=>({name:a.name,pts:Math.round(a.pts),color:a.color}))].sort((x,y)=>y.pts-x.pts), mx=Math.max(1,...rows.map(r=>r.pts));
    const left=ph==='ann'?e.start-S.time:e.end-S.time, idle=geCandidates(e).length;
    ev=`<div class="card" style="border-color:#facc15"><div style="font-size:30px">${e.ic}</div><b style="font-size:17px">${esc(e.n)}</b><div>📍 ${flag(e.city)} <b>${esc(keyCity(e.city))}</b> · ${esc(e.why)}</div>
      <div class="${ph==='on'?'pos':'warnt'}"><b>${ph==='ann'?`Commence dans ${Math.ceil(left/HOUR)} h`:`En cours · fin dans ${Math.ceil(left/HOUR)} h`}</b> · demande vers la ville ×${e.m}</div>
      <h3>🏁 Classement : voyageurs transportés vers ${esc(keyCity(e.city))}</h3>
      ${rows.map((r,i)=>`<div class="small" style="margin:3px 0">${['🥇','🥈','🥉'][i]||i+1+'.'} <b>${esc(r.name)}</b>${r.me?' (vous)':''} · ${num(r.pts)}<div style="height:8px;border-radius:5px;background:#33415555"><div style="height:100%;width:${r.pts/mx*100}%;background:${r.color};border-radius:5px"></div></div></div>`).join('')}
      <div class="btns"><button class="btn gold" data-act="geGo">✈️ Lancer des vols spéciaux (${idle} avion${idle>1?'s':''} libre${idle>1?'s':''})</button></div>
      <div class="small mut">Les vols spéciaux partent tout de suite, avec des escales techniques si l’avion n’a pas l’autonomie ; leurs passagers comptent dès l’arrivée (supporters en avance). Sur vos lignes régulières, les passagers comptent pendant l’événement. Ouvrez aussi des lignes vers la ville. Récompenses : 🥇 30 ⭐ · 🥈🥉 15 ⭐ · participation 5 ⭐ + trophée.</div></div>`; }
  else ev=`<div class="card">Prochain grand événement annoncé ${g.next?`vers le ${fmtDate(g.next)}`:'bientôt'}.</div>`;
  const shop=GE_SHOP.map(it=>`<div class="card row" style="gap:8px;align-items:center"><div style="font-size:24px">${it.ic}</div><div class="grow"><b>${it.n}</b><div class="small mut">${it.d}</div></div><button class="btn sm ${g.pp>=it.c?'gold':''}" data-act="geBuy" data-k="${it.k}">${it.c} ⭐</button></div>`).join('');
  const tro=g.trophies.length?`<div class="chips">${g.trophies.slice(0,30).map(t=>`<span class="chip" title="${esc(t.n)} · ${esc(t.city)}">${t.tro} ${t.ic} ${esc(t.city)} · ${t.place}ᵉ</span>`).join('')}</div>`:'<div class="small mut">Aucun trophée pour l’instant : participez au prochain événement !</div>';
  return `${ev}<h3>⭐ Prestige : ${g.pp} points</h3>${g.perks.camp>S.time?`<div class="small pos">📣 Campagne mondiale active jusqu’au ${fmtDate(g.perks.camp)}</div>`:''}${g.perks.sponsor?'<div class="small pos">🏟️ Partenaire officiel du prochain événement</div>':''}
    <h3>🏆 Salle des trophées (${g.trophies.length})</h3>${tro}<h3>🛍️ Boutique de prestige</h3>${shop}`;
}
// marqueur sur la carte 2D + bouton flottant
function geMapTick(){
  if(typeof map==='undefined'||!map||typeof S==='undefined'||!S) return; const e=S.ge&&S.ge.cur, ph=gePhase(e);
  if(!geMapTick.layer) geMapTick.layer=L.layerGroup().addTo(map);
  const key=e?e.id+ph:''; if(geMapTick.key!==key){ geMapTick.key=key; geMapTick.layer.clearLayers();
    if(e){ const A=AP(e.city); L.marker([A.lat,A.lon],{icon:L.divIcon({className:'ge-ic',html:`<div style="font-size:30px;filter:drop-shadow(0 0 8px #facc15);animation:crashPulse 1.4s ease-in-out infinite">${e.ic}</div>`,iconSize:[40,40]}),zIndexOffset:950}).addTo(geMapTick.layer).on('click',()=>openM('ge')); } }
  let b=document.getElementById('geBtn');
  if(!e){ if(b) b.remove(); return; }
  if(!b){ b=document.createElement('button'); b.id='geBtn'; b.className='btn sm gold'; b.style.cssText='position:fixed;right:10px;top:calc(env(safe-area-inset-top) + 200px);z-index:900;box-shadow:0 4px 14px #0008'; b.onclick=()=>openM('ge'); document.body.appendChild(b); }
  const left=ph==='ann'?e.start-S.time:e.end-S.time; b.textContent=`🏟️ ${e.ic} ${keyCity(e.city)} · ${ph==='ann'?'dans':'fin'} ${Math.ceil(left/HOUR)} h`;
  b.style.display=document.body.classList.contains('voyage2d')||document.body.classList.contains('globe-on')?'none':'';
}
function geHook(){ if(geHook.done) return; geHook.done=true;
  { const _ah=aiHourly; aiHourly=function(){ _ah(); try{ geHourly(); }catch(e){ console.warn(e); } }; }
  { const _cl=completeLeg; completeLeg=function(ac){ const fl=ac.flight, leg=fl&&fl.legs[fl.li], pax=leg&&leg.pax?leg.pax.f+leg.pax.j+(leg.pax.w||0)+leg.pax.y:0;
      // vols spéciaux : billets vendus à prix d'événement
      if(fl&&fl.ge&&leg&&pax){ const o=fl.legs[0].from, c=(fl.legs.find(l=>l.to!==o&&fl.legs.indexOf(l)>=0&&S.ge&&S.ge.cur&&l.to===S.ge.cur.city)||{}).to||leg.to;   // escales : un seul billet par trajet complet
        if(leg.to===c||fl.li===fl.legs.length-1) book('billets',pax*(typeof baseFare==='function'?baseFare(o,c):300)*1.6); }
      _cl(ac); try{ geCount(leg,pax,fl&&fl.ge); }catch(e){} }; }
  { const _dm=demandMult; demandMult=function(a,b){ let k=_dm(a,b); const e=geActive(); if(e&&(a===e.city||b===e.city)) k*=e.m; if(S&&S.ge&&S.ge.perks.camp>S.time) k*=1.15; return k; }; }
  MODALS.ge=()=>showModal('🏟️ Grands événements & prestige', geHtml(), true);
  Object.assign(ACTIONS,{ geOpen:()=>openM('ge'), geGo:()=>{ const e=geSpecials(); if(e) toast(e,'bad'); else toast(geSpecials.last||'✈️ Vos avions décollent vers l’événement !','ok'); refreshModal(); },
    geBuy:d=>{ const e=geBuy(d.k); if(e) return toast(e,'bad'); toast('⭐ Achat effectué','ok'); refreshModal(); if(typeof renderTop==='function') renderTop(); } });
  if(typeof pMore==='function'){ const _pm=pMore; pMore=function(){ return _pm().replace('<div class="morelist">','<div class="morelist"><button data-act="geOpen">🏟️ <b>Grands événements & prestige</b><small>Course aux voyageurs, trophées, boutique</small></button>'); }; }
  // le sponsor s'active au début du prochain événement
  setInterval(()=>{ try{ const e=S&&S.ge&&S.ge.cur; if(e&&S.ge.perks.sponsor&&gePhase(e)==='on') S.ge.perks.sponsorOn=true; else if(!e) S.ge&&(S.ge.perks.sponsorOn=false); geMapTick(); }catch(err){} },3000);
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ geHook(); }catch(e){ console.warn(e); } },0));
