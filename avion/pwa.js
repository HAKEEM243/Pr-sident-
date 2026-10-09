/* =========================================================
   Sky Empire — application mobile (PWA)
   Installation sur l'écran d'accueil, plein écran, hors ligne,
   transfert de la partie entre Safari et l'application.
   ========================================================= */
'use strict';
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches||window.navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let _installEvt=null;
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); _installEvt=e; });
window.addEventListener('appinstalled',()=>{ try{ localStorage.setItem('se-installed','1'); }catch(e){} toast('📲 Sky Empire est installé sur votre écran d’accueil !','ok'); });
if('serviceWorker' in navigator && location.protocol!=='file:'){
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}
if(isStandalone()) document.documentElement.classList.add('pwa');

function installHtml(){
  const ios=isIOS();
  const steps=ios? `<ol class="inst">
      <li>Dans <b>Safari</b>, touchez le bouton <b>Partager</b> <span class="ico">⬆️</span> (carré avec une flèche, en bas ou en haut de l’écran).</li>
      <li>Faites défiler et touchez <b>« Sur l’écran d’accueil »</b> <span class="ico">➕</span>.</li>
      <li>Touchez <b>Ajouter</b>. L’icône <b>Sky Empire</b> ✈️ apparaît sur votre écran d’accueil.</li>
      <li>Ouvrez le jeu <b>depuis cette icône</b> : il s’affiche en plein écran, comme une vraie application, sans la barre de Safari.</li></ol>
      <p class="small mut">Sur iPhone, cela ne marche qu’avec Safari (pas depuis Google, Chrome ou une autre appli). Si vous êtes dans un autre navigateur, ouvrez ce lien dans Safari.</p>`
    : _installEvt? `<p>Touchez le bouton ci-dessous, puis <b>Installer</b>.</p><div class="btns"><button class="btn gold" data-act="pwaPrompt">📲 Installer Sky Empire</button></div>`
    : `<ol class="inst"><li>Ouvrez le menu du navigateur <b>⋮</b> (en haut à droite).</li><li>Touchez <b>« Installer l’application »</b> ou <b>« Ajouter à l’écran d’accueil »</b>.</li><li>Ouvrez ensuite le jeu depuis l’icône <b>Sky Empire</b> ✈️.</li></ol>`;
  return `${isStandalone()?`<div class="al ok">✅ Vous utilisez déjà l’application Sky Empire.</div>`:''}
    <p>Installez Sky Empire comme une <b>application</b> : icône sur l’écran d’accueil, plein écran, démarrage rapide, et le jeu marche même avec une connexion faible.</p>
    ${isStandalone()?'':steps}
    <h3>🔁 Garder ma partie</h3>
    <p class="small">${ios?'Sur iPhone, l’application installée et Safari ont chacun leur propre mémoire.':'L’application et le navigateur peuvent avoir chacun leur mémoire.'} Pour retrouver votre compagnie dans l’application :</p>
    <ol class="inst"><li>${isStandalone()?'Dans Safari (l’ancien onglet du jeu)':'Ici, avant d’installer'} : touchez <b>📋 Copier ma partie</b>.</li><li>Dans l’application : <b>Plus → 📲 Application → 📥 Coller une partie</b>.</li></ol>
    <div class="btns"><button class="btn" data-act="pwaCopy">📋 Copier ma partie</button><button class="btn" data-act="pwaPaste">📥 Coller une partie</button></div>`;
}
function registerPwaActions(){
  MODALS.install=()=>showModal('📲 Application mobile', installHtml());
  Object.assign(ACTIONS,{
    install:()=>openM('install'),
    pwaPrompt:async()=>{ if(!_installEvt) return openM('install'); _installEvt.prompt(); try{ await _installEvt.userChoice; }catch(e){} _installEvt=null; closeModal(); },
    pwaCopy:async()=>{ save(); const data=localStorage.getItem(SAVE_KEY)||JSON.stringify(S);
      try{ await navigator.clipboard.writeText(data); toast(`📋 Partie copiée (${Math.round(data.length/1024)} Ko). Ouvrez l’application et touchez « Coller une partie ».`,'ok'); }
      catch(e){ showModal('📋 Copier ma partie',`<p class="small">Sélectionnez tout le texte ci-dessous et copiez-le :</p><textarea class="savebox" readonly onfocus="this.select()">${esc(data)}</textarea>`); } },
    pwaPaste:async()=>{ let txt='';
      try{ txt=await navigator.clipboard.readText(); }catch(e){}
      if(!txt||txt[0]!=='{'){ showModal('📥 Coller une partie',`<p class="small">Collez ici la partie copiée (appui long → Coller) :</p><textarea class="savebox" id="pasteBox"></textarea><div class="btns"><button class="btn gold" data-act="pwaPasteGo">✅ Charger cette partie</button></div>`); return; }
      pwaLoad(txt); },
    pwaPasteGo:()=>{ const t=(document.getElementById('pasteBox')||{}).value||''; pwaLoad(t.trim()); },
  });
}
function pwaLoad(txt){
  if(typeof applySave==='function') return applySave(txt,'Charger');
  try{ const o=JSON.parse(txt); if(!o||!o.company||!o.fleet||!o.time) throw new Error('ce n’est pas une partie Sky Empire');
    if(!confirm(`Charger la partie « ${o.company.name} » ? La partie actuelle de cet appareil sera remplacée.`)) return;
    localStorage.setItem(SAVE_KEY,txt); location.reload(); }
  catch(e){ toast('⛔ Partie illisible : '+e.message,'bad'); }
}
// Proposition d'installation : une fois, sur téléphone, dans le navigateur
function maybeInstallHint(){
  if(isStandalone()) return; if(!(UI&&UI.mobile)&&!isIOS()) return;
  let n=0; try{ n=+(localStorage.getItem('se-inst-hint')||0); }catch(e){}
  if(n>=3) return; try{ localStorage.setItem('se-inst-hint',String(n+1)); }catch(e){}
  setTimeout(()=>{ const b=document.createElement('div'); b.id='instBar';
    b.innerHTML=`<span>📲 Installez <b>Sky Empire</b> sur votre écran d’accueil : plein écran, comme une vraie appli.</span><button class="btn sm gold" data-act="install">Comment ?</button><button class="x" aria-label="Fermer">×</button>`;
    b.querySelector('.x').onclick=()=>b.remove(); b.querySelector('[data-act]').addEventListener('click',()=>setTimeout(()=>b.remove(),50));
    document.body.appendChild(b); setTimeout(()=>b.remove(),20000); },4000);
}
