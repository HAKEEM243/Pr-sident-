/* ============================================================
   ACTIONS, MODALES, TUTORIEL & BOUCLE PRINCIPALE
   ============================================================ */
function findAc(id){ return S.fleet.find(a=>a.id===id); }
function findRoute(id){ return S.routes.find(r=>r.id===id); }
function err(msg){ if(msg){ toast('⛔ '+msg,'bad'); return true; } return false; }
function parseAp(v){ const c=String(v||'').trim().slice(0,3).toUpperCase(); if(AIRPORTS[c]) return c; const low=String(v).toLowerCase().trim(); return AIRPORT_CODES.find(x=>AP(x).city.toLowerCase()===low)||null; }

// Modales « vivantes » : réaffichées après chaque action
const MODALS = {
  line:id=>{ const r=findRoute(id); if(!r) return closeModal(); showModal(`🧭 Ligne ${r.stops.join(' ⇄ ')}`, lineModalHtml(r), true); },
  openLine:()=>showModal('➕ Ouvrir une ligne', openLineHtml(), true),
  buyHub:()=>showModal('🏢 Acheter un hub', buyHubHtml(), true),
  plan:id=>{ const ac=findAc(id); showModal(`📅 Planning — ${ac.reg}`, planModalHtml(ac), true); },
  cfg:id=>{ const ac=findAc(id); showModal(`💺 Cabine — ${ac.reg} ${modelOf(ac).name}`, cfgModalHtml(ac)); },
  maint:id=>{ const ac=findAc(id); showModal(`🔧 Entretien — ${ac.reg}`, maintModalHtml(ac)); },
  more:id=>{ const ac=findAc(id); showModal(`${ac.reg} — ${modelOf(ac).name}`, moreModalHtml(ac)); },
  airport:code=>{ const a=AP(code); showModal(`${COUNTRIES[a.cc][2]} ${a.city} — ${a.code}`, airportHtml(code), true); },
  editor:()=>showModal('🛠️ Éditeur d’avion personnalisé', editorHtml(), true),
  mapstyle:()=>showModal('🗺️ Fond de carte', mapStyleHtml()),
  pilot:id=>{ const ac=findAc(id); showModal(`🕹️ Piloter ${ac.reg}`, pilotSetupHtml(ac), true); },
};
function openM(name, arg){ UI.modal=name; UI.modalArg=arg; MODALS[name](arg); }
function openAirport(code){ openM('airport',code); }
function after(){ renderPanel(); refreshModal(); renderTop(); drawRoutes(); drawAirports(); }

const ACTIONS = {
  closeModal, closeCard:()=>selectPlane(null),
  followCam:()=>{ followPlane=!followPlane; updateFlightCard(); },
  zoomPlane:()=>zoomPlane(), zoomRoute:()=>zoomRoute(),
  mapStyle:()=>openM('mapstyle'),
  setStyle:async d=>{ const id=await setMapStyle(d.id); if(id===d.id) toast('🗺️ '+MAP_STYLES[id].label,'ok'); refreshModal(); },
  saveGKey:async()=>{ const k=$('#gkey').value.trim(); if(!k){ localStorage.removeItem(GKEY); toast('Clé supprimée','ok'); return; }
    localStorage.setItem(GKEY,k); Object.keys(localStorage).filter(x=>x.startsWith('cst-gsess-')).forEach(x=>localStorage.removeItem(x));
    const id=await setMapStyle('google_sat'); if(id==='google_sat') toast('✅ Google Maps activé !','ok'); refreshModal(); },
  mapToggle:d=>{ MAPOPT[d.k]=!MAPOPT[d.k]; try{ localStorage.setItem('cst-mapopt',JSON.stringify(MAPOPT)); }catch(e){} document.querySelector(`[data-k="${d.k}"]`).classList.toggle('on',MAPOPT[d.k]); drawAirports(); drawRoutes(); drawNight(); updateRival(); drawWeather(true);
    if(d.k==='trails' && !MAPOPT.trails){ for(const [,t] of trails){ L_trails.removeLayer(t.line); if(t.ahead) L_trails.removeLayer(t.ahead); } trails.clear(); } },
  mapMenu:()=>$('#mapctl').classList.toggle('open'),
  focusDRC:()=>{ if(UI.mobile) setTab('map'); focusCountry(homeCC()); },
  focusHome:()=>{ if(UI.mobile) setTab('map'); focusCountry(homeCC()); },
  focusCountry:d=>{ if(UI.mobile) setTab('map'); focusCountry(d.cc); },
  country:d=>{ UI.country=d.cc; renderPanel(); },
  focusWorld:()=>focusWorld(),
  focusHub:()=>{ if(UI.mobile) setTab('map'); focusAirport(S.company.hub); },
  apZoom:d=>{ closeModal(); if(UI.mobile) setTab('map'); focusAirport(d.c); },
  openAp:d=>openAirport(d.c),

  // réseau
  openLine:()=>{ UI.ol={stops:[S.hubs[0]],q:'',f:'all'}; openM('openLine'); },
  draftPair:d=>{ UI.ol={stops:[d.a,d.b],q:'',f:'all'}; openM('openLine'); },
  olHub:d=>{ UI.ol.stops=[d.c]; refreshModal(); },
  olFilter:d=>{ UI.ol.f=d.f; refreshModal(); },
  olPick:d=>{ UI.ol.stops.push(d.c); refreshModal(); $('#modal .mbody').scrollTop=0; },
  olPop:()=>{ if(UI.ol.stops.length>1) UI.ol.stops.pop(); refreshModal(); },
  buyLine:()=>{ const r=openLine(UI.ol.stops); if(typeof r==='string') return err(r); S.tutoLine=true; drawRoutes();
    if(isSimple()){ r.audit=true; const n=autoPlanAll(); closeModal(); toast(n?`🧭 Ligne ${r.stops.join('⇄')} ouverte : ${n} avion(s) programmé(s) automatiquement !`:`🧭 Ligne ${r.stops.join('⇄')} ouverte. Achetez un avion : il sera programmé tout seul.`,'ok'); renderPanel(); return; }
    toast(`🧭 Ligne ${r.stops.join('⇄')} achetée !`,'ok'); openM('line',r.id); renderPanel(); },
  line:d=>openM('line',d.id),
  audit:d=>{ if(!err(auditLine(findRoute(d.id)))){ toast('🔍 Audit terminé : prix idéaux disponibles','ok'); after(); } },
  price:d=>{ const r=findRoute(d.id); if(d.set) r.pm[d.k]=1; else r.pm[d.k]=clamp(+(((r.pm[d.k]??1)+(+d.d)).toFixed(3)),0.3,3); after(); },
  closeLine:d=>{ const r=findRoute(d.id); if(!confirm(`Fermer la ligne ${r.stops.join('-')} ? La licence n’est pas remboursée.`)) return; closeLine(r.id); closeModal(); after(); },
  showLineMap:d=>{ const r=findRoute(d.id); closeModal(); if(UI.mobile) setTab('map'); map.flyToBounds(r.stops.map(c=>[AP(c).lat,unwrapLon(AP(c).lon,AP(r.stops[0]).lon)]),{padding:[60,60],duration:1}); },
  buyHubModal:()=>openM('buyHub'),
  buyHub:d=>{ if(!confirm(`Acheter le hub de ${AP(d.c).city} pour ${fmtMoney(hubCost(d.c))} ?`)) return; if(!err(buyHub(d.c))){ toast(`🏢 Hub ${AP(d.c).city} acheté`,'ok'); drawAirports(); after(); } },

  // planning & flotte
  plan:d=>{ const ac=findAc(d.ac), r=findRoute(d.r); const cur=(ac.plan||[]).find(p=>p.routeId===r.id)?.weekly||0;
    const w = d.max? maxWeekly(ac,r) : Math.max(0,cur+(+d.d));
    if(!err(setPlan(ac,r.id,w))){ if(w>0) S.tutoPlan=true; after(); } },
  planModal:d=>openM('plan',d.id),
  cfgModal:d=>openM('cfg',d.id),
  maintModal:d=>openM('maint',d.id),
  moreModal:d=>openM('more',d.id),
  maint:d=>{ const ac=findAc(d.id); if(!err(startMaint(ac,d.k))){ toast(`🔧 ${ac.reg} : ${MAINT[d.k].label} commencé`,'ok'); after(); } },
  follow:d=>{ if(UI.mobile) setTab('map'); selectPlane(d.id); followPlane=true; },
  ferry:d=>{ const ac=findAc(d.id);
    showModal(`Convoyer ${ac.reg}`, `<datalist id="aplist2">${AIRPORT_CODES.map(c=>`<option value="${c} — ${esc(AP(c).city)}">`).join('')}</datalist>
      <label>Destination<input list="aplist2" id="ferryTo" placeholder="Code ou ville"></label>
      <div class="btns"><button class="btn gold" data-act="doFerry" data-id="${ac.id}">Convoyer (sans passagers)</button></div>`); UI.modal=null; },
  doFerry:d=>{ const code=parseAp($('#ferryTo').value); if(!code) return err('Aéroport inconnu'); const ac=findAc(d.id); if(!err(ferry(ac,code))){ closeModal(); toast(`${ac.reg} en route vers ${AP(code).city}`,'ok'); } },
  rename:d=>{ const ac=findAc(d.id); const n=prompt('Nom de baptême de l’avion :', ac.name||''); if(n!==null){ ac.name=n.slice(0,30); after(); } },
  sell:d=>{
    const ac=findAc(d.id), m=modelOf(ac);
    if(ac.owned){ const v=acValue(ac); if(!confirm(`Vendre ${ac.reg} (${m.name}) pour ${fmtMoney(v)} ?`)) return; S.cash+=v; S.led.total.ventes=(S.led.total.ventes||0)+v; }
    else { if(!confirm(`Rendre ${ac.reg} au loueur (frais : 1 mois, ${fmtMoney(ac.lease)}) ?`)) return; book('leasing',-ac.lease); }
    S.fleet=S.fleet.filter(x=>x!==ac); logMsg(`${ac.owned?'💵 Vente':'↩ Restitution'} de ${ac.reg} (${m.name}).`,'info'); closeModal(); after();
  },
  catFam:d=>{ UI.catFam=d.f; renderPanel(); },
  buy:d=>{
    const m=getModel(d.m), mode=d.mode, hub=UI.buyHub&&S.hubs.includes(UI.buyHub)?UI.buyHub:S.hubs[0];
    const cost = mode==='new'? m.price*1e6 : mode==='used'? m.price*1e6*0.55 : m.price*1e6*0.0085*2;
    if(S.cash<cost && !confirm(`Coût ${fmtMoney(cost)} > capital ${fmtMoney(S.cash)}. Acheter quand même (capital négatif) ?`)) return;
    const ac=addAircraft(m.id,{owned:mode!=='lease', used:mode==='used', hub});
    S.cash-=cost;
    logMsg(`🛬 ${mode==='lease'?'Leasing':'Achat'} : ${m.name}${mode==='used'?' (occasion)':''} ${ac.reg}, livré à ${AP(hub).city}.`,'ok');
    if(isSimple()){ const r=autoPlan(ac); toast(r?`✈️ ${m.name} ${ac.reg} livré et programmé sur ${r.stops.join('⇄')} !`:`✈️ ${m.name} ${ac.reg} livré à ${AP(hub).city}. Ouvrez une ligne : il y volera tout seul.`,'ok'); }
    else { toast(`✈️ ${m.name} ${ac.reg} livré à ${AP(hub).city} ! Programmez-le dans 📅 Planning.`,'ok');
    if(qualifiedPilots(m.fam)<2) toast(`⚠️ Il vous faut 2 pilotes qualifiés ${m.fam} (onglet 👥 Personnel)`,'warn'); }
    renderTop(); renderPanel();
  },
  editor:()=>openM('editor'),
  saveCustom:()=>{
    const d=UI.edit, e=customSpecs(d);
    if(!(+d.seats>0||+d.cargo>0)) return err('Indiquez des sièges ou une capacité cargo');
    const m={id:'X'+uid(), name:d.name.slice(0,30)||'Avion perso', maker:'Personnalisé', fam:d.fam, seats:+d.seats>0?+d.seats:0, cargo:+d.seats>0?0:+d.cargo, range:clamp(+d.range,500,20000), speed:clamp(+d.speed,250,2500), burn:e.burn, price:e.price, cls:e.cls, alt:e.alt, custom:true, color:d.color, logo:d.logo};
    S.customModels.push(m); toast(`Modèle « ${m.name} » ajouté au catalogue`,'ok'); refreshModal();
  },
  delCustom:d=>{ if(S.fleet.some(a=>a.model===d.m)) return err('Des avions de ce modèle sont en flotte'); S.customModels=S.customModels.filter(m=>m.id!==d.m); refreshModal(); },

  // pilote
  pilot:d=>openM('pilot',d.id),
  pilotGo:d=>{ const to=d.c||parseAp($('#pilotTo')?.value); if(!to) return err('Choisissez une destination');
    const com=$('#pilotPax')?$('#pilotPax').checked:true; err(startPilot(d.id,to,com)); },

  // personnel
  train:d=>{ const p=S.pilots.find(x=>x.id===d.id);
    showModal(`Former ${esc(p.name)}`, `<div class="mut small">Qualifications actuelles : ${p.quals.join(', ')}. Le pilote est indisponible pendant la formation.</div>
    ${Object.entries(FAMILIES).filter(([f])=>!p.quals.includes(f)).map(([f,[n,c,days,sal]])=>`<div class="card row"><div class="grow"><b>${n}</b><br><span class="mut small">${fmtMoney(c)} · ${days} jours · salaire ensuite ≥ ${fmtMoney(sal)}/mois</span></div><button class="btn sm gold" data-act="doTrain" data-id="${p.id}" data-f="${f}">Former</button></div>`).join('')}`); UI.modal=null; },
  doTrain:d=>{ const p=S.pilots.find(x=>x.id===d.id), [n,c,days]=FAMILIES[d.f]; book('formation',-c); p.training={fam:d.f,start:S.time,until:S.time+days*DAY}; logMsg(`🎓 ${p.name} commence la qualification ${d.f} (${days} j).`,'info'); closeModal(); renderPanel(); },
  fire:d=>{ const p=S.pilots.find(x=>x.id===d.id); if(!confirm(`Licencier ${p.name} ? Indemnité : 2 mois de salaire.`)) return; book('salaires',-p.salary*2); S.pilots=S.pilots.filter(x=>x!==p); renderPanel(); },
  hire:d=>{ const p=S.candidates.find(x=>x.id===d.id); if(!p) return; book('recrutement',-p.salary); S.pilots.push(p); S.candidates=S.candidates.filter(x=>x!==p); logMsg(`👨‍✈️ ${p.name} rejoint la compagnie (${p.quals.join(', ')}).`,'ok'); renderPanel(); },
  hireBulk:d=>{ const k=d.k, inp=document.getElementById('hn-'+k); let n=Math.max(1,Math.min(100000,Math.floor(+(inp&&inp.value))||1));
    (UI.hn=UI.hn||{})[k]=n;
    if(k==='pil'){ const fam=(document.getElementById('hf')||{}).value||'A320'; UI.hfam=fam; let cost=0; for(let i=0;i<n;i++){ const p=makePilot([fam],i%3!==0); S.pilots.push(p); cost+=p.salary; } book('recrutement',-cost);
      logMsg(`👨‍✈️ ${num(n)} pilote${n>1?'s':''} ${fam} recruté${n>1?'s':''} (${fmtMoney(cost)}).`,'ok'); toast(`✅ ${num(n)} pilote${n>1?'s':''} recruté${n>1?'s':''}`,'ok'); }
    else { const base=STAFF_CATS[k][1], cost=base*0.6*n; book('recrutement',-cost); S.staff[k]+=n; logMsg(`${STAFF_CATS[k][0]} : ${num(n)} recrue${n>1?'s':''} (${fmtMoney(cost)}).`,'ok'); toast(`✅ ${num(n)} recrue${n>1?'s':''}`,'ok'); }
    renderPanel(); renderTop(); },
  hireStaff:d=>{ const k=d.k; let n=+d.n||0; if(d.fill) n=Math.max(0,staffNeed()[k]-S.staff[k]); if(!n) return;
    const base=STAFF_CATS[k][1]; if(n>0) book('recrutement',-base*0.6*n); else book('salaires',-base*Math.min(-n,S.staff[k]));
    S.staff[k]=Math.max(0,S.staff[k]+n); if(n<0){ S.staff.morale[k]=clamp(S.staff.morale[k]-4,0,100); } renderPanel(); },

  // carburant
  buyFuel:d=>{ if(!err(buyFuel(+d.l))){ S.tutoFuel=true; toast(`⛽ ${num(+d.l)} L achetés`,'ok'); renderPanel(); renderTop(); } },
  buyCO2:d=>{ if(!err(buyCO2(+d.t))) renderPanel(); },
  tank:()=>{ if(!confirm(`Agrandir le réservoir pour ${fmtMoney(tankUpgradeCost())} ?`)) return; if(!err(upgradeTank())) renderPanel(); },

  // finances & compagnie
  loan:d=>{ if(!err(takeLoan(d.id))) renderPanel(); },
  repay:d=>{ if(!err(repayLoan(d.id))) renderPanel(); },
  service:d=>{ S.service=+d.n; renderPanel(); },
  campaign:d=>{ const cp=CAMPAIGNS.find(x=>x.id===d.id); book('marketing',-cp.cost); S.campaigns.push({id:cp.id,until:S.time+cp.days*DAY}); S.reputation=clamp(S.reputation+cp.rep*0.3,0,100); logMsg(`📣 Campagne « ${cp.name} » lancée.`,'ok'); renderPanel(); },
  joinAlliance:d=>{ const al=ALLIANCES.find(x=>x.id===d.id); S.alliance=al.id; book('alliance',-al.fee); logMsg(`🤝 ${S.company.name} rejoint ${al.name} !`,'ok'); renderPanel(); },
  leaveAlliance:()=>{ if(confirm('Quitter l’alliance ?')){ S.alliance=null; renderPanel(); } },
  project:d=>{ const u=UPGRADES[d.k]; if(!confirm(`${u.name} à ${AP(d.c).city} : ${fmtMoney(u.cost(AP(d.c)))}, ${u.days} jours. Lancer ?`)) return; if(!err(startProject(d.c,d.k))){ toast('🏗️ Chantier lancé','ok'); after(); } },
  export:()=>{ const b=new Blob([JSON.stringify(S)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`sauvegarde-${S.company.code}-${fmtDate(S.time).replace(/ /g,'-')}.json`; a.click(); },
  import:()=>{ const i=document.createElement('input'); i.type='file'; i.accept='.json,application/json'; i.onchange=()=>{ const f=i.files[0]; if(!f) return; f.text().then(t=>{ try{ const o=JSON.parse(t); if(!o.fleet||!o.company) throw 0; S=o; save(); location.reload(); }catch(e){ err('Fichier de sauvegarde invalide'); } }); }; i.click(); },
  reset:()=>{ if(confirm('Effacer la partie et recommencer ?')){ booted=false; localStorage.removeItem(SAVE_KEY); location.reload(); } },
  guideReset:()=>{ S.tuto=0; renderGuide(); toast('Tutoriel relancé','ok'); },
  guideGo:()=>{ const st=guideSteps()[S.tuto]; if(st) st.go(); },
  guideSkip:()=>{ S.tuto=99; renderGuide(); },

  // admin
  adCash:d=>{ book('admin',+d.v); renderTop(); renderPanel(); },
  adTime:d=>{ UI.silent=true; advance(+d.v*HOUR); UI.silent=false; toast(`⏩ +${d.v} h`,'ok'); renderPanel(); drawNight(); },
  adEvent:d=>{ triggerEvent(d.id); drawAirports(); renderPanel(); },
  adClearEv:()=>{ S.events=[]; recomputeClosed(); S.oil=S.oilBase; drawAirports(); renderPanel(); },
  adQual:()=>{ for(const p of S.pilots) p.quals=Object.keys(FAMILIES); renderPanel(); toast('Tous les pilotes sont qualifiés','ok'); },
  adFix:()=>{ for(const a of S.fleet){ a.condition=100; a.sinceA=a.sinceC=a.sinceD=0; } toast('Flotte remise à neuf','ok'); },
  adCrew:()=>{ const n=staffNeed(); for(const k of ['pnc','meca','sol']) S.staff[k]=Math.max(S.staff[k],n[k]+5); for(const k of Object.keys(S.staff.morale)) S.staff.morale[k]=90; S.staff.strikeUntil=0; toast('Personnel au complet','ok'); },
  adFuel:()=>{ S.fuel.stock=S.fuel.cap; S.co2.stock=S.co2.cap; toast('Réservoirs pleins','ok'); },
  adCargo:()=>{ genCargoOffers(4); toast('Nouvelles offres cargo','ok'); },
  adRival:d=>{ const R=R0()||(S.rivals||[])[0]; if(!R) return toast('Aucun concurrent','bad'); if(+d.v>0) R.cash+=100e6; else { R.cash=-5e6; R.rep=35; } toast('Rival modifié','ok'); },
};

/* ---------- saisies ---------- */
const INPUTS = {
  autoMaint:el=>{ S.autoMaint=el.checked; },
  autoK:el=>{ (S.auto=S.auto||{})[el.dataset.k]=el.checked; if(el.checked) autoManage(); renderPanel(); },
  hn:el=>{ (UI.hn=UI.hn||{})[el.dataset.k]=Math.max(1,Math.min(100000,Math.floor(+el.value)||1)); },
  'ed.name':el=>{ UI.edit.name=el.value; }, 'ed.fam':el=>{ UI.edit.fam=el.value; }, 'ed.seats':el=>{ UI.edit.seats=el.value; },
  'ed.cargo':el=>{ UI.edit.cargo=el.value; }, 'ed.range':el=>{ UI.edit.range=el.value; }, 'ed.speed':el=>{ UI.edit.speed=el.value; },
  'ed.color':el=>{ UI.edit.color=el.value; }, 'ed.logo':el=>{ UI.edit.logo=el.value; },
  price:el=>{ const r=findRoute(el.dataset.id), k=el.dataset.k, ip=idealPrice(r.stops[0],r.stops[1],k); if(+el.value>0) r.pm[k]=clamp(+el.value/ip,0.3,3); after(); },
  addPlan:el=>{ if(!el.value) return; const ac=findAc(el.value), r=findRoute(el.dataset.id); if(!err(setPlan(ac,r.id,Math.max(1,Math.min(7,maxWeekly(ac,r)))))){ S.tutoPlan=true; after(); } },
  hold:el=>{ findAc(el.dataset.id).hold=el.checked; after(); },
  cfg:el=>{ const ac=findAc(el.dataset.id); if(ac.status==='flight'){ el.value=ac.cfg[el.dataset.k]; return err('Reconfiguration impossible en vol'); } ac.cfg[el.dataset.k]=+el.value; refreshModal(); renderPanel(); },
  transfer:el=>{ if(!el.value) return; const ac=findAc(el.dataset.id); if(!confirm(`Transférer ${ac.reg} à ${AP(el.value).city} ? Son planning sera vidé.`)) return; ac.hub=el.value; ac.plan=[]; ac.pendingReturn=null; if(ac.status==='idle') ferry(ac,ac.hub); closeModal(); after(); },
  country:el=>{ UI.country=el.value; renderPanel(); },
  hq:el=>{ UI.hq=el.value; const pos=el.selectionStart; refreshModal(); const n=$('#hq'); if(n){ n.focus(); n.setSelectionRange(pos,pos); } },
  olq:el=>{ UI.ol.q=el.value; const pos=el.selectionStart; refreshModal(); const n=$('#olq'); if(n){ n.focus(); n.setSelectionRange(pos,pos); } },
  buyHub:el=>{ UI.buyHub=el.value; }, catSort:el=>{ UI.catSort=el.value; renderPanel(); }, catRdc:el=>{ UI.catRdc=el.checked; renderPanel(); },
  sal:el=>{ S.staff.sal[el.dataset.k]=+el.value; },
  fuelAuto:el=>{ S.fuel.auto=el.checked; }, fuelBelow:el=>{ S.fuel.autoBelow=+el.value; },
  'co.name':el=>{ S.company.name=el.value.slice(0,40)||'Ma compagnie'; renderTop(); },
  'co.code':el=>{ S.company.code=el.value.toUpperCase().slice(0,3)||'XX'; },
  'co.color':el=>{ S.company.color=el.value; renderTop(); drawRoutes(); for(const [,mk] of planeMarkers) L_planes.removeLayer(mk); planeMarkers.clear(); },
  'co.logo':el=>{ S.company.logo=el.value||'✈'; renderTop(); },
  anc:el=>{ S.ancillary[el.dataset.k]=el.checked; },
  notif:el=>{ S.notifications=el.checked; if(el.checked && 'Notification' in window) Notification.requestPermission().then(p=>{ if(p!=='granted'){ S.notifications=false; el.checked=false; err('Notifications refusées par le navigateur'); } }); },
  cargoAssign:el=>{ if(!el.value) return; if(!err(acceptCargo(el.dataset.id, el.value))){ toast('📦 Contrat accepté','ok'); } renderPanel(); },
  adOil:el=>{ S.oilBase=+el.value; S.oil=+(S.oilBase*oilMult()).toFixed(2); },
  adRep:el=>{ S.reputation=+el.value; },
};
const LIVE_INPUTS=/^(sal|fuelBelow|cfg|adOil|adRep)$/;
function onInput(e){
  const el=e.target.closest('[data-in]'); if(!el) return;
  const fn=INPUTS[el.dataset.in]; if(!fn) return;
  if(e.type==='input' && !(el.type==='range'||el.dataset.in.startsWith('ed.')||['olq','hq','ngq'].includes(el.dataset.in))) return;
  if(e.type==='change' && ['olq','hq','ngq'].includes(el.dataset.in)) return;
  fn(el);
  if(UI.modal==='editor' && $('#edEst')) $('#edEst').innerHTML=editorEst(customSpecs(UI.edit),UI.edit);
  if(e.type==='change' && LIVE_INPUTS.test(el.dataset.in)) renderPanel();
}

/* ---------- tutoriel ---------- */
const GUIDE = [
  {t:'Ouvrez votre première ligne', d:'Choisissez une destination proche et très demandée depuis votre hub.', done:()=>S.routes.length>0,
   go:()=>{ const h=S.hubs[0], best=AIRPORT_CODES.filter(c=>c!==h&&AP(c).cls>=2&&dist(h,c)>250&&dist(h,c)<1400).sort((x,y)=>marketDemand(h,y)-marketDemand(h,x))[0];
     UI.ol={stops:[h,best].filter(Boolean),q:'',f:'home'}; openM('openLine'); }},
  {t:'Programmez un avion', d:'Indiquez combien de rotations par semaine votre ATR 72 doit faire sur la ligne.', done:()=>S.fleet.some(a=>a.plan&&a.plan.length),
   go:()=>{ const ac=S.fleet.find(a=>!isCargo(modelOf(a))&&S.routes.some(r=>r.stops[0]===a.hub&&!checkLegs(a,legsFor(r.stops))))||S.fleet[0]; if(ac) openM('plan',ac.id); }},
  {t:'Regardez votre avion décoller', d:'Passez en vitesse « Rapide » et suivez le vol sur la carte satellite.', done:()=>S.stats.flights>0||UI.followed,
   go:()=>{ S.speed='rapide'; const ac=S.fleet.find(a=>a.status==='flight'); setTab(UI.mobile?'map':UI.tab); if(ac){ selectPlane(ac.id); followPlane=true; UI.followed=true; } else focusCountry(homeCC()); }},
  {t:'Achetez du kérosène pas cher', d:'Le prix change toutes les heures : remplissez le réservoir quand il est bas.', done:()=>S.tutoFuel,
   go:()=>setTab('fuel')},
  {t:'Pilotez vous-même un vol', d:'Prenez les commandes d’un de vos avions et posez-le en douceur.', done:()=>(S.stats.manual||0)>0,
   go:()=>{ const ac=S.fleet.find(a=>a.status==='idle')||S.fleet[0]; openM('pilot',ac.id); }},
  {t:'Agrandissez votre flotte', d:'Achetez ou louez un nouvel avion dans la boutique.', done:()=>S.fleet.length+(S.orders||[]).length>=(START_PACKS[S.packId||'regional']?START_PACKS[S.packId||'regional'].fleet.length+1:3),
   go:()=>setTab('shop')},
];
const guideSteps=()=>isSimple()&&typeof SIMPLE_GUIDE!=='undefined'?SIMPLE_GUIDE:GUIDE;
function renderGuide(){
  const box=$('#guide'); if(!box||!S) return;
  if(S.tuto===undefined) S.tuto=0;
  const G=guideSteps();
  while(S.tuto<G.length && G[S.tuto].done()){ S.tuto++; if(S.tuto<G.length) toast(`🎓 Étape réussie ! Suivante : ${G[S.tuto].t}`,'ok'); }
  const st=G[S.tuto];
  if(!st || document.body.classList.contains('piloting')){ box.hidden=true; return; }
  box.hidden=false;
  box.innerHTML=`<div class="g-step">🎓 ${S.tuto+1}/${G.length}</div><div class="g-txt"><b>${st.t}</b><span>${st.d}</span></div><button class="btn sm gold" data-act="guideGo">Montre-moi</button><button class="x" data-act="guideSkip" title="Passer le tutoriel">×</button>`;
}

/* ---------- démarrage ---------- */
const POPULAR_HUBS=['FIH','CDG','JFK','LHR','DXB','IST','ADD','JNB','LOS','NBO','CMN','ABJ','GRU','MEX','YUL','SIN','HND','PEK','DEL','SYD'];
function guessHub(){
  try{ const reg=(navigator.languages||[navigator.language]).map(l=>(l.split('-')[1]||'').toUpperCase()).find(r=>COUNTRIES[r]);
    if(reg){ const c=countryAirports(reg).find(x=>AP(x).cls>=3); if(c) return c; } }catch(e){}
  return 'FIH';
}
function ngHtml(){
  const ng=UI.ng, q=(ng.q||'').toLowerCase().trim();
  let res=[];
  if(q.length>=2) res=AIRPORT_CODES.filter(c=>AP(c).cls>=2&&(c.toLowerCase()===q||AP(c).city.toLowerCase().includes(q)||AP(c).name.toLowerCase().includes(q)||COUNTRIES[AP(c).cc][0].toLowerCase().includes(q))).sort((x,y)=>AP(y).traffic-AP(x).traffic).slice(0,14);
  const H=AP(ng.hub);
  const packOk=k=>START_PACKS[k].fleet.every(id=>getModel(id).cls<=H.cls);
  if(!packOk(ng.pack)) ng.pack='regional';
  return `<div class="ng-hero">${PLANE_SVG('#f5c518',90,'wb')}<div class="small">Créez votre compagnie n’importe où dans le monde : <b>3 200 aéroports</b>, <b>${Object.keys(COUNTRIES).length} pays</b>, 68 avions réels et les vraies compagnies. C’est simple : <b>1.</b> choisissez votre hub, <b>2.</b> ouvrez une ligne, <b>3.</b> vos avions volent tout seuls.</div></div>
  <div class="form">
    <label>Nom de la compagnie<input id="ng-name" value="${esc(ng.name)}" data-in="ngName"></label>
    <label>Code (2-3 lettres)<input id="ng-code" maxlength="3" value="${esc(ng.code)}" data-in="ngCode"></label>
  </div>
  <h3>Votre hub de départ</h3>
  <div class="hubpick card gold-b"><div class="cflag">${COUNTRIES[H.cc][2]}</div><div class="grow"><b>${esc(H.city)}</b> <span class="mut">${H.code}</span><br><span class="small mut">${esc(H.name)} · ${COUNTRIES[H.cc][0]} · piste ${num(H.runway)} m · ${H.traffic>=1?H.traffic+' M':Math.round(H.traffic*1000)+' k'} pax/an</span></div></div>
  <input id="ngq" placeholder="🔍 Chercher une ville, un aéroport ou un pays…" value="${esc(ng.q||'')}" data-in="ngq">
  <div class="chips">${(res.length?res:POPULAR_HUBS.filter(c=>AIRPORTS[c])).map(c=>`<button class="chip ${c===ng.hub?'on':''}" data-act="ngHub" data-c="${c}">${flag(c)} ${esc(AP(c).city)} <span class="mut">${c}</span></button>`).join('')}</div>
  <h3>Taille de départ</h3>
  <div class="packs">${Object.entries(START_PACKS).map(([k,p])=>`<button class="card pack ${ng.pack===k?'gold-b':''}" data-act="ngPack" data-k="${k}" ${packOk(k)?'':'disabled'}><b>${p.name}</b><br><span class="small">${p.desc}</span><br><span class="small mut">Capital ${fmtMoney(p.capital*ng.diff)}${packOk(k)?'':' · piste trop courte ici'}</span></button>`).join('')}</div>
  <div class="row wrap"><span>Difficulté</span>${[[2,'Facile'],[1,'Normal'],[0.5,'Difficile']].map(([v,l])=>`<button class="chip ${ng.diff===v?'on':''}" data-act="ngDiff" data-v="${v}">${l}</button>`).join('')}
    <label class="row">Livrée<input type="color" value="${ng.color}" data-in="ngColor" style="width:60px"></label><label class="row">Logo<input maxlength="3" value="${esc(ng.logo)}" data-in="ngLogo" style="width:70px"></label></div>
  <div class="btns"><button class="btn gold big" data-act="ngGo">🛫 Créer la compagnie à ${esc(H.city)}</button></div>`;
}
// Nom de compagnie proposé selon le hub : Air Kongo pour la RD Congo
function ngBrand(){ const ng=UI.ng; if(ng.edited) return; const cd=AP(ng.hub).cc==='CD';
  Object.assign(ng, cd? {name:'Air Kongo', code:'KO', color:'#0b6bcb', logo:'🐆'} : {name:'Sky Empire', code:'SE', color:'#d4a72c', logo:'✈️'}); }
function newGameModal(){
  if(!UI.ng){ UI.ng={hub:guessHub(), pack:'regional', diff:1, q:''}; ngBrand(); }
  $('#modal').hidden=false;
  $('#modal').innerHTML=`<div class="mbox wide"><div class="mhead"><h2>✈️ Fondez votre compagnie aérienne</h2></div><div class="mbody" id="ngBody">${ngHtml()}</div></div>`;
  hydratePhotos&&hydratePhotos();
}
function refreshNg(focusId){ const b=$('#ngBody'); if(!b) return; const el=focusId&&$('#'+focusId), pos=el?el.selectionStart:0; b.innerHTML=ngHtml(); if(focusId){ const n=$('#'+focusId); if(n){ n.focus(); n.setSelectionRange(pos,pos); } } }
Object.assign(ACTIONS,{
  ngHub:d=>{ UI.ng.hub=d.c; UI.ng.q=''; ngBrand(); refreshNg(); },
  ngPack:d=>{ UI.ng.pack=d.k; refreshNg(); },
  ngDiff:d=>{ UI.ng.diff=+d.v; refreshNg(); },
  ngGo:()=>{ const ng=UI.ng;
    newGame({name:ng.name||'Sky Empire', code:ng.code||'SE', hub:ng.hub, pack:ng.pack, diff:ng.diff, color:ng.color, logo:ng.logo});
    UI.modal=null; closeModal(); boot(); focusAirport(S.company.hub); },
});
Object.assign(INPUTS,{
  ngq:el=>{ UI.ng.q=el.value; refreshNg('ngq'); },
  ngName:el=>{ UI.ng.name=el.value.slice(0,40); UI.ng.edited=true; }, ngCode:el=>{ UI.ng.code=el.value.toUpperCase().slice(0,3); UI.ng.edited=true; },
  ngColor:el=>{ UI.ng.color=el.value; }, ngLogo:el=>{ UI.ng.logo=el.value||'✈️'; },
});
function offlineReport(r){
  if(!r || r.game<HOUR) return;
  // briefing du réveil : ce qui s'est passé dans le monde pendant l'absence
  const since=S.awayFrom||(S.time-r.game), news=(S.ai&&S.ai.news||[]).filter(n=>n.t>=since);
  const key=news.filter(n=>n.kind!=='news'), rest=news.filter(n=>n.kind==='news');
  const shown=[...key.slice(0,9),...rest.slice(0,Math.max(0,12-Math.min(9,key.length)))].sort((a,b)=>b.t-a.t);
  const crashes=(S.ai&&S.ai.crashes||[]).filter(c=>c.t>=since).length;
  const al=typeof alerts==='function'?alerts().slice(0,4):[];
  showModal('🌅 Pendant votre absence…', `<div class="card"><div>Temps réel écoulé : <b>${fmtDur(r.real)}</b> · temps de jeu simulé : <b>${fmtDur(r.game)}</b></div>
  <div class="grid2"><div>Vols effectués : <b>${num(r.flights)}</b></div><div>Passagers : <b>${num(r.pax)}</b></div>
  <div>Revenus : <b class="pos">${fmtMoney(r.rev)}</b></div><div>Coûts : <b class="neg">${fmtMoney(r.cost)}</b></div></div>
  <div>Variation de trésorerie : <b class="${r.cash<0?'neg':'pos'}">${fmtMoney(r.cash)}</b></div></div>
  ${al.length?`<h3>À régler</h3>${al.map(([k,t])=>`<div class="al ${k}">${t}</div>`).join('')}`:''}
  <h3>Dans le monde (${news.length} nouvelles${crashes?` · ${crashes} accident(s)`:''})</h3>
  <div class="log">${shown.map(n=>`<div class="lg ${n.kind}"><span class="mut">${fmtDate(n.t)} ${fmtTime(n.t)}</span> ${n.text}</div>`).join('')||'<div class="mut small">Journée calme.</div>'}</div>
  <div class="btns"><button class="btn gold" data-act="closeModal">Reprendre les commandes</button><button class="btn" data-tab="news">📰 Toutes les actus</button></div>`, true);
}

/* ---------- panneau mobile glissant ---------- */
function initSheet(){
  const h=$('#sheetHandle'), panel=$('#panel'); if(!h) return;
  let startY=0, startH=0, drag=false;
  const set=v=>{ panel.style.setProperty('--sheet', clamp(v, 120, window.innerHeight-110)+'px'); };
  h.addEventListener('pointerdown',e=>{ drag=true; startY=e.clientY; startH=panel.getBoundingClientRect().height; h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove',e=>{ if(drag) set(startH+(startY-e.clientY)); });
  h.addEventListener('pointerup',()=>{ drag=false; const hh=panel.getBoundingClientRect().height, vh=window.innerHeight;
    const snaps=[vh*0.32, vh*0.58, vh-120]; set(snaps.reduce((a,b)=>Math.abs(b-hh)<Math.abs(a-hh)?b:a)); setTimeout(()=>map&&map.invalidateSize(),80); });
}

let booted=false;
function boot(){
  if(booted) return; booted=true;
  initMap(); renderTabs();
  if(localStorage.getItem('se-news')!=='v8'){ try{ localStorage.setItem('se-news','v8'); }catch(e){} setTimeout(()=>toast('Nouveau : 🎥 vue de vol 3D façon simulateur (bouton sur la fiche d’un vol), 🏙️ Ville 3D avec monuments, et 📬 messagerie : les PDG rivaux vous écrivent !','ok'),1500); }
  renderTop(); setTab(window.innerWidth<820?'map':(isSimple()?'network':'dash'));
  updatePlanes(); updateRival();
  let last=performance.now(), acc1=0, acc2=0, acc30=0, acc10=0;
  setInterval(()=>{
    const now=performance.now(), dt=Math.min(now-last, 3600000); last=now;
    if(!S.paused){ advance(dt*SPEEDS[S.speed].mult); }
    if(typeof globeNoteSim==='function') globeNoteSim();
    pilotBackground(dt);
    updatePlanes();
    acc1+=dt; acc2+=dt; acc30+=dt; acc10+=dt;
    if(acc1>=1000){ acc1=0; checkMissions(); renderTop(); updateRival(); drawWeather(); if(typeof maybeShowDecision==='function') maybeShowDecision(); }
    if(acc2>=2000){ acc2=0; if(!P||P.hidden) liveRefresh(); }
    if(acc30>=20000){ acc30=0; drawNight(); drawAirports(); }
    if(acc10>=10000){ acc10=0; save(); }
  },200);
  const pn=document.getElementById('panel'); if(pn) for(const ev of ['pointerdown','wheel','touchstart','scroll','keydown']) pn.addEventListener(ev,()=>{ UI.touchAt=performance.now(); },{capture:true,passive:true});
  window.addEventListener('beforeunload',save);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) save(); });
}

document.addEventListener('DOMContentLoaded',()=>{
  UI.mobile = window.matchMedia('(max-width: 820px)').matches;
  renderTabs();
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-tab]'); if(t){ e.preventDefault(); if($('#modal').contains(t)) closeModal(); setTab(t.dataset.tab); return; }
    const sp=e.target.closest('[data-speed]'); if(sp){ S.speed=sp.dataset.speed; S.paused=false; renderTop(); if(UI.tab==='company') renderPanel(); return; }
    const a=e.target.closest('[data-act]'); if(a && ACTIONS[a.dataset.act]){ e.preventDefault(); ACTIONS[a.dataset.act](a.dataset); if(S) renderTop(); }
  });
  document.addEventListener('change',onInput);
  document.addEventListener('input',onInput);
  $('#tb-pause').onclick=()=>{ S.paused=!S.paused; renderTop(); };
  $('#modal').addEventListener('click',e=>{ if(e.target.id==='modal' && UI.modal!=='newgame' && S) closeModal(); });
  initSheet();
  if(typeof L==='undefined'){ document.body.insertAdjacentHTML('beforeend','<div class="fatal">Impossible de charger la carte (Leaflet). Vérifiez votre connexion Internet puis rechargez.</div>'); }
  if(load()){
    UI.silent=true; const rep=catchUp(); UI.silent=false;
    boot(); offlineReport(rep);
  } else { UI.modal='newgame'; newGameModal(); }
});
