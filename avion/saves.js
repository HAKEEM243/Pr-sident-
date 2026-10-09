/* =========================================================
   Sky Empire — sauvegardes fiables
   • Double stockage : localStorage + IndexedDB (bien plus de place :
     une grosse compagnie avec des milliers de pilotes ne tient pas
     toujours dans localStorage, qui échouait sans prévenir).
   • Sauvegardes automatiques de secours (les 4 dernières).
   • Emplacements nommés, export en fichier (feuille de partage de
     l'iPhone → « Enregistrer dans Fichiers »), import de fichier,
     copier/coller.
   ========================================================= */
'use strict';
const SV_DB='sky-empire', SV_STORE='saves';
let _svDb=null, _svWarned=false, _svLastBk=0;
function svOpen(){
  if(_svDb) return _svDb;
  _svDb=new Promise((res,rej)=>{ try{ const rq=indexedDB.open(SV_DB,1); rq.onupgradeneeded=()=>rq.result.createObjectStore(SV_STORE); rq.onsuccess=()=>res(rq.result); rq.onerror=()=>rej(rq.error); }catch(e){ rej(e); } });
  _svDb.catch(()=>{ _svDb=null; });
  return _svDb;
}
async function svPut(key,val){ const db=await svOpen(); return new Promise((res,rej)=>{ const tx=db.transaction(SV_STORE,'readwrite'); tx.objectStore(SV_STORE).put(val,key); tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error); }); }
async function svGet(key){ const db=await svOpen(); return new Promise((res,rej)=>{ const rq=db.transaction(SV_STORE).objectStore(SV_STORE).get(key); rq.onsuccess=()=>res(rq.result); rq.onerror=()=>rej(rq.error); }); }
async function svDel(key){ const db=await svOpen(); return new Promise((res)=>{ const tx=db.transaction(SV_STORE,'readwrite'); tx.objectStore(SV_STORE).delete(key); tx.oncomplete=()=>res(true); tx.onerror=()=>res(false); }); }
async function svKeys(){ const db=await svOpen(); return new Promise((res)=>{ const rq=db.transaction(SV_STORE).objectStore(SV_STORE).getAllKeys(); rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>res([]); }); }

const svMeta=o=>({name:o.company&&o.company.name, code:o.company&&o.company.code, hub:o.company&&o.company.hub, cash:o.cash, time:o.time, fleet:(o.fleet||[]).length, real:o.lastReal||Date.now()});
function svValid(o){ return o&&o.company&&o.fleet&&o.time; }

/* sauvegarde principale : appelée par save() toutes les 10 s et à la mise en arrière-plan */
function saveAll(txt){
  if(!S) return;
  let lsOk=true;
  try{ localStorage.setItem(SAVE_KEY,txt); }catch(e){ lsOk=false; try{ localStorage.removeItem(SAVE_KEY); }catch(_){} }
  if(typeof indexedDB==='undefined'){ if(!lsOk) svWarn(); return; }
  svPut('main',{txt, meta:svMeta(S)}).catch(()=>{ if(!lsOk) svWarn(); });
  // secours automatique toutes les 10 minutes (4 derniers gardés)
  const now=Date.now();
  if(now-_svLastBk>10*60*1000){ _svLastBk=now; const k='bk:'+now;
    svPut(k,{txt, meta:svMeta(S)}).then(svKeys).then(ks=>{ const bk=ks.filter(x=>String(x).startsWith('bk:')).sort(); while(bk.length>4) svDel(bk.shift()); }).catch(()=>{}); }
}
function svWarn(){ if(_svWarned) return; _svWarned=true; if(typeof toast==='function') toast('⚠️ La sauvegarde automatique a échoué (mémoire du téléphone pleine ?). Exportez votre partie : Plus → 💾 Sauvegardes.','bad'); }

/* chargement : la plus récente entre localStorage et IndexedDB */
async function loadAsync(){
  let best=null;
  try{ const raw=localStorage.getItem(SAVE_KEY); if(raw){ const o=JSON.parse(raw); if(svValid(o)) best={o,real:o.lastReal||0}; } }catch(e){}
  try{ const r=await Promise.race([svGet('main'), new Promise(res=>setTimeout(()=>res(null),2500))]);
    if(r&&r.txt){ const real=(r.meta&&r.meta.real)||0; if(!best||real>best.real){ const o=JSON.parse(r.txt); if(svValid(o)) best={o,real}; } } }catch(e){}
  if(!best) return false;
  S=best.o; migrate(); return true;
}
function applySave(txt, how){
  let o; try{ o=JSON.parse(txt); }catch(e){ toast('⛔ Ce n’est pas une sauvegarde valide (texte illisible)','bad'); return false; }
  if(!svValid(o)){ toast('⛔ Ce fichier n’est pas une partie Sky Empire','bad'); return false; }
  if(S&&S.company&&!confirm(`${how||'Charger'} la partie « ${o.company.name} » (${fmtMoney(o.cash)}, ${(o.fleet||[]).length} avions) ?\nLa partie en cours sur cet appareil sera remplacée (une copie de secours est gardée).`)) return false;
  const go=()=>{ o.lastReal=Date.now(); const t=JSON.stringify(o); try{ localStorage.setItem(SAVE_KEY,t); }catch(e){}
    const done=()=>{ window._svNoUnloadSave=true; location.reload(); };
    if(typeof indexedDB!=='undefined') svPut('main',{txt:t,meta:svMeta(o)}).then(done,done); else done(); };
  // copie de secours de la partie actuelle avant de la remplacer
  if(S&&S.company&&typeof indexedDB!=='undefined') svPut('bk:'+Date.now(),{txt:JSON.stringify(S),meta:svMeta(S)}).then(go,go); else go();
  return true;
}

/* ---------- interface ---------- */
const svLine=m=>m?`<b>${esc(m.name||'?')}</b> <span class="mut">${esc(m.code||'')}</span> · ${fmtMoney(m.cash||0)} · ${m.fleet||0} avions · ${fmtDate(m.time)}<br><small class="mut">enregistrée le ${new Date(m.real).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</small>`:'';
async function savesHtml(){
  let slots=[], bks=[];
  try{ const ks=await svKeys();
    for(const k of ks){ const ks2=String(k); if(!ks2.startsWith('slot:')&&!ks2.startsWith('bk:')) continue; const r=await svGet(k); if(!r) continue; (ks2.startsWith('slot:')?slots:bks).push({k:ks2, m:r.meta, label:r.label}); } }catch(e){}
  slots.sort((a,b)=>b.m.real-a.m.real); bks.sort((a,b)=>b.m.real-a.m.real);
  const cur=S&&S.company? `<div class="svcur">${svLine(svMeta(S))}</div>` : '';
  return `${cur}
  <div class="btns"><button class="btn gold" data-act="svNow">💾 Sauvegarder maintenant</button><button class="btn" data-act="svSlot">➕ Nouvel emplacement</button></div>
  <h3>📤 Mettre ma partie à l’abri</h3>
  <p class="small mut">Le fichier exporté vous permet de retrouver votre compagnie sur n’importe quel appareil, dans Safari ou dans l’application. Sur iPhone : <b>Exporter</b> → <b>« Enregistrer dans Fichiers »</b>.</p>
  <div class="btns"><button class="btn" data-act="svExport">📤 Exporter (fichier)</button><button class="btn" data-act="svImport">📥 Importer un fichier</button></div>
  <div class="btns"><button class="btn" data-act="pwaCopy">📋 Copier (texte)</button><button class="btn" data-act="pwaPaste">📋 Coller (texte)</button></div>
  <h3>🗂️ Mes emplacements</h3>
  ${slots.length? slots.map(s=>`<div class="svrow"><div>${s.label?`<b>${esc(s.label)}</b><br>`:''}${svLine(s.m)}</div><div class="svb"><button class="btn sm gold" data-act="svLoad" data-k="${s.k}">Charger</button><button class="btn sm" data-act="svDelete" data-k="${s.k}">🗑️</button></div></div>`).join('') : '<p class="small mut">Aucun emplacement. « ➕ Nouvel emplacement » garde une copie de votre partie que vous pourrez recharger plus tard.</p>'}
  <h3>♻️ Secours automatiques</h3>
  ${bks.length? bks.map(s=>`<div class="svrow"><div>${svLine(s.m)}</div><div class="svb"><button class="btn sm" data-act="svLoad" data-k="${s.k}">Restaurer</button></div></div>`).join('') : '<p class="small mut">Une copie de secours est faite toutes les 10 minutes de jeu (les 4 dernières sont gardées).</p>'}
  <p class="small mut" style="margin-top:12px">ℹ️ Sur iPhone, l’application installée et Safari ont chacun leur propre mémoire : pour passer de l’un à l’autre, exportez dans l’un et importez dans l’autre.</p>`;
}
async function openSaves(){ UI.modal='saves'; showModal('💾 Sauvegardes', '<p class="mut">Chargement…</p>'); const h=await savesHtml(); if(UI.modal==='saves'||!UI.modal) showModal('💾 Sauvegardes', h); }
async function svExport(){
  save(); const txt=JSON.stringify(S), name=`sky-empire-${(S.company.code||'SE')}-${new Date().toISOString().slice(0,10)}.json`;
  try{
    const file=new File([txt],name,{type:'application/json'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:'Sauvegarde Sky Empire'}); toast('📤 Sauvegarde partagée : gardez ce fichier précieusement','ok'); return; }
  }catch(e){ if(e&&e.name==='AbortError') return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'application/json'})); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500);
  toast('💾 Sauvegarde téléchargée : gardez ce fichier précieusement','ok');
}
function svImport(){
  const i=document.createElement('input'); i.type='file'; i.accept='.json,application/json,text/plain,*/*';
  i.style.display='none'; document.body.appendChild(i);
  i.onchange=()=>{ const f=i.files&&i.files[0]; i.remove(); if(!f) return; f.text().then(t=>applySave(t,'Importer')).catch(()=>toast('⛔ Impossible de lire ce fichier','bad')); };
  i.click();
}
function registerSaveActions(){
  MODALS.saves=()=>openSaves();
  Object.assign(ACTIONS,{
    saves:()=>openSaves(),
    svNow:()=>{ save(); toast(`💾 Partie sauvegardée (${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})})`,'ok'); openSaves(); },
    svSlot:async()=>{ save(); const label=prompt('Nom de cet emplacement :', `${S.company.name} — ${fmtDate(S.time)}`); if(label===null) return;
      try{ await svPut('slot:'+Date.now(),{txt:JSON.stringify(S),meta:svMeta(S),label:label.slice(0,60)}); toast('🗂️ Emplacement enregistré','ok'); }catch(e){ toast('⛔ Impossible d’enregistrer (mémoire pleine ?) : utilisez Exporter','bad'); }
      openSaves(); },
    svLoad:async d=>{ const r=await svGet(d.k).catch(()=>null); if(!r||!r.txt) return toast('⛔ Sauvegarde introuvable','bad'); applySave(r.txt, d.k.startsWith('bk:')?'Restaurer':'Charger'); },
    svDelete:async d=>{ if(!confirm('Supprimer cet emplacement ?')) return; await svDel(d.k); openSaves(); },
    svExport:()=>svExport(),
    svImport:()=>svImport(),
    exportSave:()=>svExport(),
    importSave:()=>svImport(),
  });
}
/* écran « nouvelle partie » : retrouver une partie existante */
async function ngRestoreHtml(){
  let bks=[]; try{ const ks=await svKeys(); for(const k of ks){ const s=String(k); if(s.startsWith('slot:')||s.startsWith('bk:')){ const r=await svGet(k); if(r&&r.meta) bks.push({k:s,m:r.meta}); } } }catch(e){}
  bks.sort((a,b)=>b.m.real-a.m.real);
  return `<div class="ngrestore"><b>📂 Vous avez déjà une partie ?</b>
    <div class="btns"><button class="btn gold" data-act="svImport">📥 Importer un fichier</button><button class="btn" data-act="pwaPaste">📋 Coller une partie</button></div>
    ${bks.slice(0,3).map(s=>`<div class="svrow"><div>${svLine(s.m)}</div><div class="svb"><button class="btn sm gold" data-act="svLoad" data-k="${s.k}">Reprendre</button></div></div>`).join('')}
    ${typeof isStandalone==='function'&&isStandalone()?`<small class="mut">Votre partie était dans Safari ? Ouvrez le jeu dans Safari → Plus → 💾 Sauvegardes → <b>Exporter</b>, puis ici : <b>Importer un fichier</b>.</small>`:''}</div>`;
}
async function decorateNewGame(){
  const b=document.getElementById('ngBody'); if(!b||b.querySelector('.ngrestore')) return;
  const h=await ngRestoreHtml(); const b2=document.getElementById('ngBody'); if(!b2||b2.querySelector('.ngrestore')) return;
  b2.insertAdjacentHTML('afterbegin',h);
}
if(typeof document!=='undefined') document.addEventListener('DOMContentLoaded',()=>{ if(typeof ACTIONS!=='undefined') registerSaveActions(); });
