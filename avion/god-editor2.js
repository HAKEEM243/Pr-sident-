/* =========================================================
   Sky Empire — 🧬 éditeur divin, 2e partie
   • recherche par nom (pays, villes, aéroports) au lieu des codes ;
   • bouton « 🧬 Modifier » sur chaque fiche d'aéroport et de compagnie ;
   • 🎬 scénarios en un geste (boom africain, crise pétrolière, IA
     légendaire, Congo superpuissance…), annulables d'un coup ;
   • ✈️ vos avions un par un (état, nom, téléportation, modèle) ;
   • 🌐 code de monde : copier vos modifications et les partager.
   La vigilance mondiale s'applique à tout.
   ========================================================= */
'use strict';
// plusieurs changements d'un coup, une seule ligne au journal (annulable en bloc)
function godBatch(label,ops){
  const g=godS(), done=[]; let h=0;
  for(const [t,id,f,v] of ops){ const o=godGet(t,id,f); if(o===v) continue; godPut(t,id,f,v); done.push([t,id,f,o]); h+=godCheat(t,id,f,+o||0,+v||0); }
  h=clamp(h,-40,45); g.log.unshift({id:uid(),t:'scn',i:'',f:label,o:'',v:`${done.length} changements`,h:+h.toFixed(1),at:S.time,ops:done}); if(g.log.length>80) g.log.length=80;
  g.heat=clamp((g.heat||0)+h,0,120); return done.length;
}
const GOD_SCN=[
  ['africa','🌍 Afrique en plein essor','Tous les pays africains passent en plein essor, plus riches.',()=>Object.keys(COUNTRIES).filter(cc=>COUNTRIES[cc][1]==='AF'&&wdC(cc)).flatMap(cc=>[['cc',cc,'reg','boom'],['cc',cc,'rich',+(godGet('cc',cc,'rich')*1.3).toFixed(2)]])],
  ['congo','🇨🇩 Congo superpuissance','RD Congo : population +30 %, richesse ×2, envie de voyager ×1,8, Kinshasa et Goma triplent leur trafic.',()=>{ const o=[['cc','CD','pop',+(godGet('cc','CD','pop')*1.3).toFixed(1)],['cc','CD','rich',+(godGet('cc','CD','rich')*2).toFixed(2)],['cc','CD','dem',1.8],['cc','CD','reg','boom']]; for(const c of ['FIH','GOM','FBM','FKI']) if(AP(c)) o.push(['ap',c,'traffic',+(AP(c).traffic*3).toFixed(2)]); return o; }],
  ['travel','✈️ Tout le monde voyage','La demande mondiale double.',()=>[['eco','','dem',2]]],
  ['cheapoil','🕊️ Pétrole bon marché','Le baril tombe à 40 $.',()=>[['eco','','oil',40]]],
  ['oilcrisis','⛽ Crise pétrolière','Le baril grimpe à 190 $ (plus dur : la vigilance baisse).',()=>[['eco','','oil',190]]],
  ['recession','🧊 Récession mondiale','La demande mondiale tombe à 60 % (plus dur).',()=>[['eco','','dem',0.6]]],
  ['legend','🤖 Apocalypse : IA légendaire','Toutes les compagnies au niveau Légendaire et impitoyables (beaucoup plus dur).',()=>[['ai','','lvl',4],['ai','','drive',3]]],
  ['zen','😌 Mode zen','IA débutante et calme (facile : la vigilance monte).',()=>[['ai','','lvl',0],['ai','','drive',0]]],
  ['war','🔥 Le monde s’embrase','Cinq pays au hasard (pas le vôtre) entrent en guerre : leurs aéroports ferment.',()=>{ const L=Object.keys(COUNTRIES).filter(cc=>cc!==homeCC()&&wdC(cc)&&!wdC(cc).war); const o=[]; for(let i=0;i<5&&L.length;i++){ const cc=L.splice(rndi(0,L.length-1),1)[0]; o.push(['cc',cc,'reg','war']); } return o; }],
  ['peace','🕊️ Paix mondiale','Toutes les guerres s’arrêtent, tous les pays redeviennent normaux.',()=>Object.keys(COUNTRIES).filter(cc=>wdC(cc)&&(wdC(cc).war||wdC(cc).reg!=='normal')).map(cc=>['cc',cc,'reg','normal'])],
  ['reset','♻️ Monde d’origine','Annule TOUTES les modifications du journal.',null],
];
function godScnRun(k){ if(!S.wd&&typeof wdInit==='function') try{ wdInit(); }catch(e){}
  const s=GOD_SCN.find(x=>x[0]===k); if(!s) return;
  if(k==='reset'){ const g=godS(); for(const L of g.log.slice()) godUndo(L.id); toast('♻️ Monde d’origine restauré','ok'); return; }
  const n=godBatch(s[1],s[3]()); toast(`${s[1]} : ${n} changement(s)`,'ok'); aiNews(`🎬 ${s[1]} — ${s[2]}`,'news',true);
}
// ✈️ vos avions un par un
function godAcSet(id,f,v){ const ac=S.fleet.find(a=>a.id===id); if(!ac) return; const g=godS(); let h=0;
  if(f==='condition'){ h=Math.max(0,(v-ac.condition)/20); ac.condition=clamp(v,0,100); }
  else if(f==='name'){ ac.name=String(v).slice(0,30); }
  else if(f==='tp'){ if(ac.status==='flight'||ac.status==='manual') return toast('Cet avion est en vol','bad'); if(!AP(v)) return; ac.loc=v; if(S.hubs.includes(v)) ac.hub=v; ac.plan=[]; ac.readyAt=S.time; h=2; if(typeof invalidateScheduleCache==='function') invalidateScheduleCache(); }
  else if(f==='model'){ const m=getModel(v); if(!m) return; const o=getModel(ac.model); ac.model=v; h=o&&m.price>o.price?Math.min(15,Math.log2(m.price/Math.max(0.01,o.price))*4):0; }
  g.log.unshift({id:uid(),t:'acx',i:ac.reg,f,o:'',v:String(v),h:+h.toFixed(1),at:S.time}); g.heat=clamp(g.heat+h,0,120); }
// 🌐 code de monde
function godExport(){ const g=godS(); const x={v:1,ov:g.ov,dem:g.dem,aiLvl:g.aiLvl,closed:g.closed,wd:{}};
  for(const cc of Object.keys(g.ov.cc||{})){ const w=wdC(cc); if(w) x.wd[cc]={pop:w.pop,rich:w.rich,reg:w.reg,war:w.war}; }
  return btoa(unescape(encodeURIComponent(JSON.stringify(x)))); }
function godImport(code){ let x; try{ x=JSON.parse(decodeURIComponent(escape(atob(code.trim())))); }catch(e){ return 'Code invalide'; } if(!x||x.v!==1) return 'Code invalide';
  const g=godS(); g.ov=x.ov||{ap:{},mdl:{},cc:{}}; g.dem=x.dem??1; g.aiLvl=x.aiLvl??1; g.closed=x.closed||{};
  if(!S.wd&&typeof wdInit==='function') try{ wdInit(); }catch(e){}
  for(const [cc,w] of Object.entries(x.wd||{})){ const t=wdC(cc); if(t) Object.assign(t,w); }
  godReapply(); g.log.unshift({id:uid(),t:'scn',i:'',f:'Code de monde importé',o:'',v:'',h:10,at:S.time,ops:[]}); g.heat=clamp(g.heat+10,0,120); return null; }

function godHook2(){ if(godHook2.done||typeof godHtml!=='function') return; godHook2.done=true;
  // onglets supplémentaires
  GOD_TABS.splice(GOD_TABS.findIndex(x=>x[0]==='eye'),0,['scn','🎬 Scénarios'],['fleet','✈️ Mes avions'],['share','🌐 Code de monde']);
  const _gh=godHtml; godHtml=function(){ const tab=UI.godTab||'me';
    if(!['scn','fleet','share'].includes(tab)){ let h=_gh(); if(tab==='cc'||tab==='ap') h=h.replace(/<label>(Pays|Aéroport) \(code[^<]*<input data-in="gdq"[^>]*><\/label><div class="btns sm"><button class="btn sm" data-act="godTab" data-k="(cc|ap)">Afficher<\/button><\/div>/,godFindHtml(tab)); return h; }
    const head=_gh().split('<div class="small mut">✨')[0]; let body='';
    if(tab==='scn') body=`<div class="small mut">Un geste, plusieurs changements. Chaque scénario s’annule d’un coup dans le journal. Les scénarios qui rendent le jeu plus dur font baisser la vigilance.</div>${GOD_SCN.map(([k,n,d])=>`<div class="card row" style="gap:8px;align-items:center"><div class="grow"><b>${n}</b><div class="small mut">${d}</div></div><button class="btn sm ${k==='reset'?'danger':'gold'}" data-act="godScn" data-k="${k}">Lancer</button></div>`).join('')}`;
    else if(tab==='fleet'){ const L=S.fleet.slice(0,60), all=[...MODELS,...(S.customModels||[])];
      body=`<div class="small mut">${S.fleet.length} avion(s). Téléportation : uniquement un avion au sol (il devient basé là si c’est un de vos hubs).</div>${L.map(ac=>{ const m=modelOf(ac);
        return `<details class="card"><summary><b>${esc(ac.reg)}</b> ${esc(ac.name||'')} · ${esc(m.name)} · ${AP(ac.loc)?esc(AP(ac.loc).city):''} · ${Math.round(ac.condition)} %</summary>
          <div class="form"><label>Nom<input data-in="gdac" data-id="${ac.id}" data-f="name" value="${esc(ac.name||'')}"></label>
          <label>État technique <b>${Math.round(ac.condition)} %</b><input type="range" min="0" max="100" data-in="gdac" data-id="${ac.id}" data-f="condition" value="${Math.round(ac.condition)}"></label>
          <label>🚀 Téléporter vers (code aéroport)<input data-in="gdac" data-id="${ac.id}" data-f="tp" placeholder="ex. ${S.hubs[0]}" maxlength="3"></label>
          <label>Changer de modèle<select data-in="gdac" data-id="${ac.id}" data-f="model">${all.map(x=>`<option value="${x.id}" ${x.id===ac.model?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div></details>`; }).join('')}`; }
    else body=`<div class="small mut">Copiez ce code pour garder ou partager votre monde modifié (avions, pays, aéroports, économie, niveau de l’IA). Collez le code d’un ami pour jouer dans son monde.</div>
      <textarea id="godCode" rows="4" style="width:100%" readonly>${godExport()}</textarea><div class="btns sm"><button class="btn sm gold" data-act="godCopy">📋 Copier</button></div>
      <h3>Importer un code</h3><textarea id="godImp" rows="4" style="width:100%" placeholder="Collez un code de monde ici"></textarea><div class="btns sm"><button class="btn sm" data-act="godImp">📥 Importer</button></div>`;
    return head+`<div class="small mut">✨ Tout s’applique en direct, le jeu continue de tourner.</div>`+body; };
  // annulation d'un scénario entier
  const _gu=godUndo; godUndo=function(lid){ const g=godS(), L=g.log.find(x=>x.id===lid); if(!L||L.t!=='scn') return _gu(lid); for(const [t,id,f,o] of (L.ops||[]).slice().reverse()) godPut(t,id,f,o); g.heat=clamp(g.heat-Math.max(0,L.h)*0.7,0,120); g.log=g.log.filter(x=>x!==L); };
  // recherche par nom
  INPUTS['ed.godfind']=el=>{ UI.godFind=el.value; const r=document.getElementById('godFindRes'); if(r) r.innerHTML=godFindRes(el.dataset.t); };
  INPUTS.gdac=el=>{ const v=el.type==='range'?+el.value:el.value.trim().toUpperCase&&el.dataset.f==='tp'?el.value.trim().toUpperCase():el.value; godAcSet(el.dataset.id,el.dataset.f,v); const hb=$('#godHeat'); if(hb) hb.outerHTML=godHeatHtml(); if(el.dataset.f!=='condition') refreshModal(); };
  Object.assign(ACTIONS,{
    godScn:d=>{ const s=GOD_SCN.find(x=>x[0]===d.k); if(s&&!confirm(`${s[1]} ?\n${s[2]}`)) return; godScnRun(d.k); refreshModal(); if(typeof renderTop==='function') renderTop(); },
    godEdit:d=>{ UI.godTab=d.t; UI['god_'+d.t]=d.c; try{ closeModal(); }catch(e){} openM('god'); },
    godCopy:()=>{ const t=$('#godCode'); if(!t) return; t.select(); try{ navigator.clipboard.writeText(t.value); }catch(e){ document.execCommand('copy'); } toast('📋 Code copié','ok'); },
    godImp:()=>{ const t=$('#godImp'); const e=godImport(t?t.value:''); if(e) return toast(e,'bad'); toast('🌐 Monde importé','ok'); refreshModal(); },
  });
  // boutons « 🧬 Modifier » sur les fiches
  if(typeof airportHtml==='function'){ const _ah=airportHtml; airportHtml=function(code){ return _ah(code)+`<div class="btns sm"><button class="btn sm" data-act="godEdit" data-t="ap" data-c="${code}">🧬 Modifier cet aéroport</button><button class="btn sm" data-act="godEdit" data-t="cc" data-c="${AP(code).cc}">🧬 Modifier le pays</button></div>`; }; }
  if(typeof airlineCardHtml==='function'){ const _ac=airlineCardHtml; airlineCardHtml=function(code){ return _ac(code)+(aiBy(code)?`<div class="btns sm"><button class="btn sm" data-act="godEdit" data-t="ai" data-c="${code}">🧬 Modifier cette compagnie</button></div>`:''); }; }
}
function godFindHtml(t){ return `<label>🔎 ${t==='cc'?'Chercher un pays':'Chercher une ville ou un aéroport'}<input data-in="ed.godfind" data-t="${t}" value="${esc(UI.godFind||'')}" placeholder="${t==='cc'?'ex. Nigeria, France, Congo':'ex. Paris, Goma, Lagos'}"></label><div id="godFindRes" class="chips">${godFindRes(t)}</div>`; }
function godFindRes(t){ const q=(UI.godFind||'').trim().toLowerCase(); if(q.length<2) return '<span class="small mut">Tapez au moins 2 lettres…</span>';
  const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''), nq=norm(q);
  if(t==='cc') return Object.keys(COUNTRIES).filter(cc=>norm(COUNTRIES[cc][0]).includes(nq)||cc.toLowerCase()===q).slice(0,12).map(cc=>`<button class="chip" data-act="godPick" data-t="cc" data-v="${cc}">${COUNTRIES[cc][2]} ${esc(COUNTRIES[cc][0])}</button>`).join('')||'<span class="small mut">Aucun pays.</span>';
  return AIRPORT_CODES.filter(c=>norm(AP(c).city).includes(nq)||c.toLowerCase()===q).sort((x,y)=>AP(y).traffic-AP(x).traffic).slice(0,12).map(c=>`<button class="chip" data-act="godPick" data-t="ap" data-v="${c}">${flag(c)} ${esc(AP(c).city)} <span class="mut">${c}</span></button>`).join('')||'<span class="small mut">Aucun aéroport.</span>'; }
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ godHook2(); }catch(e){ console.warn(e); } },20));
