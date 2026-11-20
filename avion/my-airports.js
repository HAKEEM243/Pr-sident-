/* =========================================================
   Sky Empire — 🏗️ Mes aéroports
   • Construire un nouvel aéroport dans votre pays : touchez l'endroit sur la carte,
     choisissez la taille, le chantier dure plusieurs mois ; une fois fini, l'aéroport
     existe partout (carte, 3D, lignes, aérogare) et il est gardé dans la sauvegarde.
   • Racheter la concession d'un aéroport existant (dans votre pays ou à l'étranger) :
     il vous rapporte des redevances chaque jour ; vous pouvez le revendre.
   • Photo dans l'aérogare : choisissez une image sur votre téléphone, elle est affichée
     en grand portrait encadré dans le hall des départs et des arrivées de cet aéroport.
   ========================================================= */
'use strict';
const MYAP_SIZES=[
  {k:'s', name:'Aéroport régional', cls:2, runway:1800, traffic:0.25, cost:60e6,  days:120, desc:'Piste de 1 800 m, avions régionaux et moyen-courriers légers.'},
  {k:'m', name:'Aéroport national',  cls:3, runway:2800, traffic:1.2,  cost:220e6, days:240, desc:'Piste de 2 800 m, moyen-courriers, aérogare avec passerelles.'},
  {k:'l', name:'Aéroport international', cls:4, runway:3600, traffic:4,  cost:650e6, days:420, desc:'Piste de 3 600 m, gros porteurs, grande aérogare avec jetée.'}];
const myApHomeCc=()=>{ try{ return AP(S.company.hub).cc; }catch(e){ return 'CD'; } };
// pays d'un point de la carte : celui de l'aéroport le plus proche
function myApNearest(lat,lon){ let best=null, bd=1e9; for(const c of AIRPORT_CODES){ const a=AP(c); if(!a) continue; const d=gcDist({lat,lon},a); if(d<bd){ bd=d; best=a; } } return {a:best,d:bd}; }
function myApCode(city){ const L='ABCDEFGHIJKLMNOPQRSTUVWXYZ'; let h=hashStr(city+Date.now()); for(let k=0;k<2000;k++){ const c='Z'+L[(h+k*7)%26]+L[Math.floor((h+k*13)/26)%26]; if(!AIRPORTS[c]) return c; } return 'ZZZ'; }
// enregistre un aéroport construit dans les données du jeu (au chargement de la partie et à la fin du chantier)
function myApRegister(m){ if(!m||m.done>((S&&S.time)||0)) return false; if(AIRPORTS[m.code]&&AIRPORTS[m.code]._mine) return true; const n=myApNearest(m.lat,m.lon).a||{};
  const o={code:m.code,icao:'FZ'+m.code.slice(1),name:m.name,city:m.city,cc:m.cc,prov:'',region:'',lat:m.lat,lon:m.lon,runway:m.runway,surface:'Asphalte',cls:m.cls,traffic:m.traffic,large:m.cls>=4,utc:n.utc!=null?n.utc:Math.round(m.lon/15),drc:m.cc==='CD',elev:n.elev||0,_mine:true};
  AIRPORTS[m.code]=o; try{ AP_BASE[m.code]=JSON.parse(JSON.stringify(o)); }catch(e){} if(!AIRPORT_CODES.includes(m.code)) AIRPORT_CODES.push(m.code);
  try{ if(typeof _cAP!=='undefined') delete _cAP[m.cc]; }catch(e){} return true; }
function myApRegisterAll(){ if(typeof S==='undefined'||!S) return; S.myAp=Array.isArray(S.myAp)?S.myAp:[]; S.ownedAp=S.ownedAp&&typeof S.ownedAp==='object'?S.ownedAp:{}; for(const m of S.myAp) myApRegister(m); }
// au chargement d'une partie : les aéroports construits existent AVANT que les lignes qui y vont soient utilisées
{ const _mg=migrate; migrate=function(){ try{ myApRegisterAll(); }catch(e){ console.warn('mes aéroports',e); } return _mg.apply(this,arguments); }; }
// chaque jour : fin des chantiers, redevances des aéroports possédés
{ const _dt=dailyTick; dailyTick=function(){ const r=_dt.apply(this,arguments); try{ myApDaily(); }catch(e){ console.warn('mes aéroports',e); } return r; }; }
function myApDaily(){ S.myAp=S.myAp||[]; S.ownedAp=S.ownedAp||{};
  for(const m of S.myAp) if(!m.ok&&m.done<=S.time){ m.ok=true; myApRegister(m); S.ownedAp[m.code]={t:S.time,price:m.cost,built:true}; logMsg(`🛫 Votre nouvel aéroport ${esc(m.name)} (${m.code}) est ouvert !`,'drc'); try{ notify('Aéroport ouvert',`${m.name} est prêt : ouvrez des lignes vers ${m.city}.`); }catch(e){} myApMap(); }
  let inc=0; for(const [c,o] of Object.entries(S.ownedAp)){ const a=AP(c); if(!a) continue; inc+=myApIncome(a); } if(inc>0) book('aéroports',Math.round(inc)); }
// redevances : selon le trafic de l'aéroport (environ 10 % par an de sa valeur)
const myApPrice=a=>Math.round((a.traffic*45e6+(a.cls||2)*30e6)/1e6)*1e6;
const myApIncome=a=>myApPrice(a)*0.10/365;
/* ---------- carte : chantiers en cours ---------- */
let _myApLayer=null;
function myApMap(){ try{ if(typeof map==='undefined'||!map||typeof L==='undefined') return; if(!_myApLayer) _myApLayer=L.layerGroup().addTo(map); _myApLayer.clearLayers();
    for(const m of S.myAp||[]) if(!m.ok&&m.done>S.time) L.marker([m.lat,m.lon],{icon:L.divIcon({className:'',html:`<div style="font:700 12px system-ui;background:#f59e0b;color:#111;border-radius:10px;padding:2px 6px;white-space:nowrap;box-shadow:0 1px 4px #0006">🏗️ ${esc(m.city)} · ${Math.max(1,Math.ceil((m.done-S.time)/DAY))} j</div>`,iconAnchor:[10,10]})}).addTo(_myApLayer);
    if(typeof drawAirports==='function') drawAirports(); }catch(e){ console.warn(e); } }
/* ---------- construire : toucher la carte ---------- */
function myApStartPick(){ try{ closeModal(); }catch(e){} if(typeof map==='undefined'||!map){ toast('Ouvrez la carte 2D pour choisir l’emplacement','bad'); return; }
  toast(`🏗️ Touchez sur la carte l’endroit où construire votre aéroport (${esc((COUNTRIES[myApHomeCc()]||[myApHomeCc()])[0])})`);
  setTimeout(()=>map.once('click',ev=>myApPicked(ev.latlng.lat,ev.latlng.lng)),300); }
function myApPicked(lat,lon){ const cc=myApHomeCc(), n=myApNearest(lat,lon);
  if(!n.a||n.a.cc!==cc||n.d>450) return toast(`Cet endroit n’est pas dans votre pays. On ne peut construire qu’en ${esc((COUNTRIES[cc]||[cc])[0])} ; à l’étranger, rachetez un aéroport existant.`,'bad');
  if(n.d<25) return toast(`Trop près de ${esc(n.a.name||n.a.city)} (${Math.round(n.d)} km) : choisissez un endroit à plus de 25 km d’un aéroport.`,'bad');
  UI.myApPick={lat,lon,near:n.a.city,dist:Math.round(n.d)}; showModal('🏗️ Construire un aéroport',myApFormHtml(),true); }
function myApFormHtml(){ const p=UI.myApPick||{};
  return `<div class="small mut">Emplacement choisi : ${p.lat.toFixed(3)}, ${p.lon.toFixed(3)} · à ${p.dist} km de ${esc(p.near)}</div>
    <label class="small" style="display:block;margin-top:8px">Ville desservie<input id="myApCity" class="inp" style="width:100%" value="${esc(p.near)} Nord" maxlength="30"></label>
    <label class="small" style="display:block;margin-top:6px">Nom de l’aéroport<input id="myApName" class="inp" style="width:100%" value="Aéroport international" maxlength="40"></label>
    ${MYAP_SIZES.map(z=>`<div class="card row" style="margin-top:6px"><div class="grow"><b>${z.name}</b><br><span class="small">${z.desc}</span><br><span class="small mut">${fmtMoney(z.cost)} · chantier ${z.days} jours · ${z.traffic>=1?z.traffic+' M':Math.round(z.traffic*1000)+' k'} voyageurs/an au départ</span></div><button class="btn ${S.cash>=z.cost?'gold':''}" data-act="myApBuild" data-k="${z.k}">Construire</button></div>`).join('')}`; }
function myApBuild(k,city,name,lat,lon){ const z=MYAP_SIZES.find(x=>x.k===k); if(!z) return 'taille inconnue'; if(S.cash<z.cost) return 'Trésorerie insuffisante';
  city=String(city||'').trim().slice(0,30)||'Nouvelle ville'; name=String(name||'').trim().slice(0,40)||('Aéroport de '+city);
  const m={code:myApCode(city),name,city,lat,lon,cc:myApHomeCc(),cls:z.cls,runway:z.runway,traffic:z.traffic,cost:z.cost,start:S.time,done:S.time+z.days*DAY,ok:false};
  book('investissements',-z.cost); (S.myAp=S.myAp||[]).push(m); myApMap(); return m; }
/* ---------- racheter / revendre ---------- */
function myApBuy(code){ const a=AP(code); if(!a) return 'aéroport inconnu'; S.ownedAp=S.ownedAp||{}; if(S.ownedAp[code]) return 'déjà à vous'; const p=myApPrice(a); if(S.cash<p) return 'Trésorerie insuffisante';
  book('investissements',-p); S.ownedAp[code]={t:S.time,price:p}; logMsg(`🏦 Vous rachetez la concession de ${esc(a.name||a.city)} pour ${fmtMoney(p)}.`,'good'); return true; }
function myApSell(code){ const o=(S.ownedAp||{})[code], a=AP(code); if(!o||!a) return 'pas à vous'; const p=Math.round(myApPrice(a)*0.85); book('investissements',p); delete S.ownedAp[code]; logMsg(`🏦 Concession de ${esc(a.name||a.city)} revendue ${fmtMoney(p)}.`,'good'); return true; }
/* ---------- photo dans l'aérogare (choisie sur le téléphone) ---------- */
const myApPicKey=c=>'se-appic-'+c, myApCapKey=c=>'se-appcap-'+c;
const MYAP_DEFAULT_PIC={FIH:'img/portrait-fih.jpg'};   /* portrait installé d'origine à N'Djili (Kinshasa) */
function myApPic(code){ let v=null; try{ v=localStorage.getItem(myApPicKey(code)); }catch(e){} if(v==='none') return null; return v||MYAP_DEFAULT_PIC[code]||null; }
function myApCap(code){ try{ return localStorage.getItem(myApCapKey(code))||''; }catch(e){ return ''; } }
function myApChoosePic(code){ const i=document.createElement('input'); i.type='file'; i.accept='image/*';
  i.onchange=()=>{ const f=i.files&&i.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ const im=new Image(); im.onload=()=>{ try{
        const S2=320, c=document.createElement('canvas'), sc=Math.max(S2/im.width,S2/im.height), w=im.width*sc, h=im.height*sc; c.width=S2; c.height=Math.round(S2*1.25);
        const x=c.getContext('2d'); x.fillStyle='#111'; x.fillRect(0,0,c.width,c.height); const sc2=Math.max(c.width/im.width,c.height/im.height); x.drawImage(im,(c.width-im.width*sc2)/2,(c.height-im.height*sc2)/2,im.width*sc2,im.height*sc2);
        const url=c.toDataURL('image/jpeg',0.82); localStorage.setItem(myApPicKey(code),url);
        const cap=prompt('Texte sous la photo (par exemple le nom de la personne) :',myApCap(code)||''); if(cap!=null) localStorage.setItem(myApCapKey(code),String(cap).slice(0,60));
        if(typeof TM!=='undefined'){ TM.picImg=null; TM.mural=null; TM.scKey=null; } toast('🖼️ Photo installée dans l’aérogare de '+esc(AP(code).city),'good'); try{ closeModal(); }catch(e){} }catch(e){ toast('Impossible d’enregistrer cette photo (mémoire du téléphone pleine ?)','bad'); } }; im.onerror=()=>toast('Image illisible','bad'); im.src=rd.result; }; rd.readAsDataURL(f); };
  i.click(); }
function myApRemovePic(code){ try{ if(MYAP_DEFAULT_PIC[code]) localStorage.setItem(myApPicKey(code),'none'); else localStorage.removeItem(myApPicKey(code)); localStorage.removeItem(myApCapKey(code)); }catch(e){} if(typeof TM!=='undefined'){ TM.picImg=null; TM.mural=null; TM.scKey=null; } toast('Photo retirée'); try{ closeModal(); }catch(e){} }
// image prête pour l'aérogare (chargée une fois, puis le décor est redessiné)
function myApPicImg(code){ if(typeof TM==='undefined') return null; if(TM.picImg&&TM.picImg.code===code) return TM.picImg.ok?TM.picImg.im:null; const url=myApPic(code); TM.picImg={code,ok:false,im:null}; if(!url) return null;
  const im=new Image(); im.onload=()=>{ if(TM.picImg&&TM.picImg.code===code){ TM.picImg.ok=true; TM.picImg.im=im; TM.scKey=null; } }; im.src=url; return null; }
// la photo devient une grande peinture (coups de pinceau), calculée une seule fois
function myApMural(code){ const im=myApPicImg(code); if(!im) return null; if(TM.mural&&TM.mural.code===code) return TM.mural.cv;
  try{ const sw=96, sh=120, s=document.createElement('canvas'); s.width=sw; s.height=sh; const sx=s.getContext('2d'); sx.drawImage(im,0,0,sw,sh); const px=sx.getImageData(0,0,sw,sh).data;
    const W=480, H=600, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const x=cv.getContext('2d'), k=W/sw; let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
    x.fillStyle='#f5ecd7'; x.fillRect(0,0,W,H); x.globalAlpha=0.85; x.drawImage(im,0,0,W,H); x.globalAlpha=1;   /* fond : l'image elle-même */
    for(let j=0;j<sh;j++) for(let i=0;i<sw;i++){ if(rnd()<0.35) continue; const o=(j*sw+i)*4; x.fillStyle=`rgba(${Math.min(255,px[o]+10)},${Math.min(255,px[o+1]+4)},${Math.max(0,px[o+2]-6)},0.55)`;   /* coups de pinceau fins, couleurs chaudes */
      x.save(); x.translate((i+0.5)*k,(j+0.5)*k); x.rotate(-0.6+(rnd()-0.5)*0.5); x.beginPath(); x.ellipse(0,0,k*0.95,k*0.38,0,0,6.283); x.fill(); x.restore(); }
    const gr=x.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,H*0.75); gr.addColorStop(0,'rgba(245,236,215,0)'); gr.addColorStop(1,'rgba(245,236,215,0.65)'); x.fillStyle=gr; x.fillRect(0,0,W,H);   /* bords fondus, comme une fresque */
    x.strokeStyle='#7c5a2b'; x.lineWidth=10; x.strokeRect(5,5,W-10,H-10);
    TM.mural={code,cv}; return cv; }catch(e){ console.warn('peinture',e); TM.mural={code,cv:null}; return null; } }
/* ---------- fiche d'un aéroport : mes aéroports ---------- */
function myApCardHtml(code){ const a=AP(code); if(!a) return ''; const own=(S.ownedAp||{})[code], p=myApPrice(a), pic=!!myApPic(code), home=a.cc===myApHomeCc();
  return `<div class="card" style="margin:6px 0"><b>🏗️ Mes aéroports</b>
    <div class="small" style="margin-top:4px">${own?`✅ ${own.built?'Construit par vous':'Concession à vous'} · redevances ≈ ${fmtMoney(myApIncome(a)*30)} / mois`:`Concession : ${fmtMoney(p)} · rapporterait ≈ ${fmtMoney(myApIncome(a)*30)} / mois`}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${own?(own.built?'':`<button class="btn" data-act="myApSell" data-c="${code}">Revendre (${fmtMoney(p*0.85)})</button>`):`<button class="btn ${S.cash>=p?'gold':''}" data-act="myApBuy" data-c="${code}">🏦 Racheter l’aéroport</button>`}
      <button class="btn" data-act="myApPic" data-c="${code}">🖼️ ${pic?'Changer la photo':'Photo dans l’aérogare'}</button>${pic?`<button class="btn" data-act="myApPicDel" data-c="${code}">Retirer la photo</button>`:''}
      ${home?`<button class="btn" data-act="myApNew">🏗️ Construire un nouvel aéroport</button>`:''}</div>
    ${(S.myAp||[]).filter(m=>!m.ok).map(m=>`<div class="small warnt" style="margin-top:4px">🏗️ Chantier ${esc(m.name)} (${esc(m.city)}) : ouverture le ${fmtDate(m.done)}</div>`).join('')}</div>`; }
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{
  if(typeof airportHtml==='function'){ const _a=airportHtml; airportHtml=function(code){ const h=_a.apply(this,arguments); try{ return h+myApCardHtml(code); }catch(e){ return h; } }; }
  Object.assign(ACTIONS,{
    myApNew:()=>myApStartPick(),
    myApBuild:d=>{ const p=UI.myApPick; if(!p) return; const r=myApBuild(d.k,(document.getElementById('myApCity')||{}).value,(document.getElementById('myApName')||{}).value,p.lat,p.lon); if(typeof r==='string') return toast(r,'bad'); try{ closeModal(); }catch(e){} toast(`🏗️ Chantier lancé : ${esc(r.name)} ouvrira le ${fmtDate(r.done)}`,'good'); try{ renderTop(); }catch(e){} },
    myApBuy:d=>{ const r=myApBuy(d.c); if(r!==true) return toast(r,'bad'); try{ closeModal(); }catch(e){} toast('🏦 Aéroport racheté','good'); try{ renderTop(); }catch(e){} },
    myApSell:d=>{ const r=myApSell(d.c); if(r!==true) return toast(r,'bad'); try{ closeModal(); }catch(e){} toast('🏦 Concession revendue','good'); },
    myApPic:d=>myApChoosePic(d.c), myApPicDel:d=>myApRemovePic(d.c) });
  myApMap(); }catch(e){ console.warn('mes aéroports',e); } },60));
