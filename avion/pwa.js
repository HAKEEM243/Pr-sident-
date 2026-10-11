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
      <li>Dans <b>Safari</b> ou <b>Chrome</b>, touchez le bouton <b>Partager</b> <span class="ico">⬆️</span> (dans Chrome : en haut à droite, à côté de l’adresse).</li>
      <li>Faites défiler et touchez <b>« Sur l’écran d’accueil »</b> <span class="ico">➕</span>.</li>
      <li>Touchez <b>Ajouter</b>. L’icône <b>Sky Empire</b> ✈️ apparaît sur votre écran d’accueil.</li>
      <li>Ouvrez le jeu <b>depuis cette icône</b> : il s’affiche en plein écran, comme une vraie application, sans la barre de Safari.</li></ol>
      <p class="small mut">Marche avec Safari, et avec Chrome sur iOS 16.4 ou plus récent. Pas depuis l’appli Google ni depuis un lien ouvert dans une autre appli.</p>`
    : _installEvt? `<p>Touchez le bouton ci-dessous, puis <b>Installer</b>.</p><div class="btns"><button class="btn gold" data-act="pwaPrompt">📲 Installer Sky Empire</button></div>`
    : `<ol class="inst"><li>Ouvrez le menu du navigateur <b>⋮</b> (en haut à droite).</li><li>Touchez <b>« Installer l’application »</b> ou <b>« Ajouter à l’écran d’accueil »</b>.</li><li>Ouvrez ensuite le jeu depuis l’icône <b>Sky Empire</b> ✈️.</li></ol>`;
  return `${isStandalone()?`<div class="al ok">✅ Vous utilisez déjà l’application Sky Empire.</div>`:''}
    <p>Installez Sky Empire comme une <b>application</b> : icône sur l’écran d’accueil, plein écran, démarrage rapide, et le jeu marche même avec une connexion faible.</p>
    ${isStandalone()?'':steps}
    <h3>🔁 Garder ma partie</h3>
    <p class="small">${ios?'Sur iPhone, l’application installée, Safari et Chrome ont chacun leur propre mémoire.':'L’application et le navigateur peuvent avoir chacun leur mémoire.'} Pour retrouver votre compagnie dans l’application :</p>
    <ol class="inst"><li>${isStandalone()?'Dans le navigateur où vous jouiez avant (Chrome ou Safari)':'Ici, avant d’installer'} : touchez <b>📋 Copier ma partie</b>.</li><li>Dans l’application : <b>Plus → 📲 Application → 📥 Coller une partie</b>.</li></ol>
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

/* ---------- mises à jour et nouveautés ---------- */
const GAME_VER='20261100';
async function checkUpdate(manual){
  try{
    const r=await fetch('index.html?cb='+Date.now(),{cache:'no-store'}), t=await r.text(), m=t.match(/name="se-ver" content="(\d+)"/), cur=(document.querySelector('meta[name="se-ver"]')||{}).content;
    if(m&&cur&&m[1]!==cur){
      if(sessionStorage.getItem('se-upd')===m[1]){ if(manual) toast('Mise à jour déjà demandée : fermez complètement l’appli puis rouvrez-la.','warn'); return; }
      sessionStorage.setItem('se-upd',m[1]); toast('🔄 Mise à jour du jeu…','ok'); try{ save(); }catch(e){}
      if('serviceWorker' in navigator){ const rg=await navigator.serviceWorker.getRegistrations(); for(const x of rg) await x.unregister(); }
      if(window.caches){ for(const k of await caches.keys()) await caches.delete(k); }
      location.reload(); return;
    }
    if(manual) toast('✅ Le jeu est à jour (version '+cur+')','ok');
  }catch(e){ if(manual) toast('Impossible de vérifier : pas de connexion ?','warn'); }
}
const WHATS_NEW=[
  ['📈 Classements vivants + vitesse Lent','Fiche d’un aéroport : la demande du pays (essor, récession, saison, guerre) fait monter ou baisser le trafic, et les parts des compagnies bougent chaque semaine selon leurs décisions (IA) — flèches ▲▼ sur une semaine. Nouvelle vitesse <b>Lent</b> : une heure de jeu toutes les 2 minutes.'],
  ['🛫 Qui vole vraiment ici','Fiche d’un aéroport : classement en direct de toutes les compagnies présentes, <b>la vôtre comprise</b> (⭐) — destinations, vols et passagers par jour, part de marché, recettes par jour, situation (expansion, crise, guerre, faillite). Estimations calées sur le trafic réel de l’aéroport.'],
  ['⏱️ Notifications et vitesses','Le jeu s’ouvre en Réaliste s’il était resté en Turbo/Ultra. Sur téléphone, les notifications s’affichent en bas (elles ne cachent plus les boutons de vitesse) ; en Rapide, Turbo et Ultra, seules les importantes apparaissent.'],
  ['🐢 Ultra ne fige plus le jeu','Avec une grande flotte, le téléphone ne suivait pas la vitesse Ultra et le jeu s’emballait jusqu’à se figer. Maintenant le calcul a un budget : le jeu ralentit un peu (« 🐢 limité par l’appareil ») mais reste fluide.'],
  ['🧠 Concurrents plus réalistes','Le résultat hebdomadaire dépend du réseau, des lignes réellement exploitées, du pays, du carburant, de la réputation, de l’âge et de la dette. Les compagnies fragiles peuvent restructurer, être rachetées ou faire faillite ; les rachats coûtent vraiment de l’argent et règlent votre participation.'],
  ['📊 Parts passagers expliquées','La part affichée porte sur les 70 routes les plus demandées, pas sur tous les voyageurs du pays. Le panneau sépare votre part de ce volume, votre part sur les routes directes desservies, les routes sans vol direct identifié et la couverture de l’échantillon. Les correspondances ne sont pas inventées.'],
  ['🧳 Contrôle passagers avec choix réels','Passagers → choisissez Économique (attractivité −5 %, satisfaction −5), Équilibrée (neutre) ou Assistance+ (+2,50 $ par passager et par tronçon, attractivité +8 %, satisfaction +6). Les frais et les avis des prochains vols suivent ce choix.'],
  ['🧑‍✈️ Équipe d’escale pour vos hubs','Dans la fiche d’un hub, investissez dans une équipe d’escale : rotations −15 %, retards de congestion −40 %, avec un entretien mensuel affiché.'],
  ['🛠️ Reprise de partie réparée','Le jeu rouvrait l’écran « Fondez votre compagnie » par-dessus votre partie : corrigé. Les très grosses compagnies se chargent sans limite de temps, et « Reprendre » ouvre la partie directement.'],
  ['🏗️ Agrandir vos aéroports','Plus → <b>🏗️ Agrandir mes aéroports</b> : dans les pays où vous avez un hub, 5 étapes (extension du terminal, jetée, 2e piste, Terminal 2, ville aéroportuaire). Plus de voyageurs, plus de portes, une piste réservée aux arrivées (moins de retards), avions plus gros, et l’aéroport grandit en 3D.'],
  ['🪶 3D stable sur iPhone','Sur téléphone, la 3D démarre en mode Minimal (sans relief ni nuages) pour ne plus couper ; ⚙️ dans la 3D pour essayer Éco ou Haute. Correction : en Minimal, avions et aéroports flottaient au-dessus du sol.'],
  ['📱 3D beaucoup plus légère sur téléphone','Mémoire graphique réduite (pas d’anticrénelage du tampon principal, transparence simplifiée, mode 3D seul). Si la 3D se ferme quand même, une fenêtre explique pourquoi et propose de voir les avions en 🏙️ Ville 3D, plus légère.'],
  ['🛠️ Démarrage réparé','Après une longue absence, le jeu s’affiche tout de suite et rattrape le temps passé en arrière-plan (barre de progression, bouton ⏭️ Passer) au lieu de rester bloqué sur un écran vide.'],
  ['📡 Le monde réel en direct','Vue 3D → <b>📡 Trafic réel</b> : les vrais avions en vol en ce moment autour de la caméra (bleu clair, heure réelle). <b>🌧️ Radar réel</b> : la vraie pluie (carte 2D aussi, dans ☰ Carte). <b>🌀 Cyclones réels</b> sur la carte et en 3D ; un vrai cyclone près de vos aéroports peut les fermer 24 h. État des sources dans Actus → 🌍 Monde.'],
  ['👁️ Vision « œil de Dieu »','En vue 3D : bouton <b>👁️</b> pour la caméra thermique FLIR (noir et blanc ou couleur), la vision nocturne, l’écran CRT ou le noir ; <b>🎯 Détection</b> encadre chaque avion avec son identifiant, son altitude et sa vitesse ; <b>📡 Contacts</b> liste les avions autour (touchez un des vôtres pour le suivre). Effets adaptés du projet libre God’s Eye View (licence MIT).'],
  ['✈️ Missions réelles','Guerre ou catastrophe : le président vous demande un avion (📬). Choisissez-le : il quitte vraiment ses lignes, décolle, se pose dans le pays en crise et ramène les évacués (visible sur la carte, en 3D, liste de passagers). Payé à chaque retour. Valise perdue : elle voyage sur votre prochain vol. Surréservation : les passagers prennent des sièges sur votre vol suivant.'],
  ['🎬 Directeur du monde','Une IA fait vivre la planète : population et richesse des pays, essor et récessions, guerres qui ferment l’espace aérien (réfugiés vers les voisins), séismes, cyclones, éruptions, épidémies… et des missions d’évacuation payées (📬). Elle dose le rythme selon votre partie. Actus → <b>🌍 Monde</b>.'],
  ['🪶 3D qui ne se coupe plus','Si le téléphone manque de mémoire graphique, la 3D se relance toute seule en mode <b>Minimal</b> au lieu de se fermer. Plus → Options → 🌍 Vue 3D : mode Minimal et 🩺 Diagnostic 3D.'],
  ['🛬 Décollages et atterrissages réparés','Sol de nouveau précis autour des pistes ; si le téléphone a un souci d’affichage, l’aéroport passe en version allégée au lieu de disparaître ; « Voir décoller / atterrir » attend moins longtemps.'],
  ['📱 3D allégée sur téléphone','Mémoire réduite d’environ un tiers : 30 images/s en Éco, moins d’avions et de décor au loin, carte 2D en pause pendant la 3D, sauvegarde moins fréquente, villes Google 3D allégées (et coupées si la 3D a planté).'],
  ['🛠️ 3D plus stable','Sur téléphone, la 3D démarre en <b>Éco</b> (plus fluide, moins de mémoire). Si elle se ferme toute seule, le jeu repasse en Éco automatiquement. ⚙️ en 3D pour changer.'],
  ['📰 À la une','En haut de la carte : les grandes nouvelles (présidents, accidents, attaques des rivaux). Touchez pour lire. Actus → <b>🏛️ Présidents</b> et <b>💥 Accidents</b>.'],
  ['🎬 Voir décoller / atterrir','Sur la carte 2D et dans 🛫 Mes vols : un bouton ouvre la 3D au moment du prochain décollage ou atterrissage.'],
  ['🧠 Duel sur vos lignes','Les compagnies présentes sur vos lignes réagissent chaque semaine : elles s’alignent sur vos prix, ajoutent des vols, ou remontent leurs tarifs. Détail d’une ligne → « Ce que font vos concurrents ».'],
  ['✈️ Concevoir mon avion','Plus → <b>✈️ Concevoir mon avion</b> ; et 13 nouveaux modèles (L-410, MA60, 727, Tu-154, A300F, 747-400F…).'],
  ['🧳 Passagers','Nouvelles rubriques : son séjour (programme, hôtel, budget) et ce vol en chiffres (distance, CO₂, miles, avis).'],
  ['🎮 Tour de contrôle en direct','Accueil : suivi des vols actifs, étape, progression et nombre de passagers, avec accès direct au suivi et au manifeste.'],
  ['🛂 Contrôle des passagers plus poussé','Arrivées en cours par pays, estimations d’assistance et de vérifications, recherche de fiches et filtres par profil dans les manifestes. Les voyageurs et contrôles sont simulés.'],
  ['🏆 Classements plus détaillés','Nouveau tri par croissance patrimoniale sur environ quatre semaines ; le classement des aéroports distingue désormais trafic de base, flotte et lignes du joueur et des IA.'],
  ['🌍 Classements plus vivants','Le classement mondial des compagnies se trie par patrimoine, flotte, réseau, passagers ou réputation. Le rang d’influence des aéroports tient maintenant compte des avions et lignes présents, en plus du bonus de scénario de Kinshasa.'],
  ['🛂 Passagers plus pertinents','Les raccourcis de pays suivent désormais les principales provenances de la destination choisie, au lieu d’afficher une liste figée.'],
  ['⚙️ Vue 3D plus sûre','La qualité Auto est équilibrée dès le lancement ; le mode Éco est choisi par défaut sur mobile pour limiter les plantages.'],
  ['📰 Actualités et présidents','Les boutons toujours visibles en haut ouvrent directement le fil des actualités ou les décisions des présidents.'],
  ['⚙️ Vue 3D plus fluide','Le réglage « Éco » réduit maintenant vraiment le nombre de pixels rendus pour soulager les appareils mobiles.'],
  ['⏩ Progression hors ligne','La partie avance maintenant à la vitesse choisie en votre absence (plafond ×60 et 30 jours), sauf si vous l’avez mise en pause.'],
  ['🤝 Concurrents plus vivants','Les jeunes compagnies ont davantage de chances de grandir ; les compagnies en difficulté peuvent être rachetées plus tôt par un concurrent solide.'],
  ['⚔️ Concurrence renforcée','Les nouvelles parties et les anciennes sauvegardes sans réglage démarrent en mode Impitoyable. Les challengers investissent davantage et leurs changements de flotte/réseau sont mieux synchronisés. Vous pouvez choisir Calme, Normale ou Féroce à tout moment.'],
  ['📈 Créations, rachats et faillites','Davantage de jeunes compagnies peuvent entrer sur le marché avec un capital proportionnel à leur flotte, grandir puis devenir des transporteurs établis. Les rachats de compagnies fragiles sont plus fréquents. Les grandes compagnies ne sont plus automatiquement sauvées : l’aide publique est conditionnelle, limitée à une seule fois et impose une réduction de flotte et de lignes.'],
  ['🌍 Pays qui pèsent sur les compagnies','Les périodes de crise et de boom affectent aussi les résultats des transporteurs IA, en plus de la demande et des restrictions déjà appliquées aux vols.'],
  ['📷 Photos des avions plus justes','Le jeu demande des pages photo plus précises par modèle/variante. En attendant la photo, il affiche une silhouette plutôt qu’une photo de famille potentiellement trompeuse.'],
  ['🗺️ Fond de carte 3D','En vue 3D : bouton <b>🗺️ Fond</b> (satellite, Sentinel-2, plan, relief, sombre…).'],
  ['🛫 Décollage / 🛬 atterrissage','En vue 3D sans avion suivi : <b>Prochain décollage</b> et <b>Prochain atterrissage</b>.'],
  ['🗓️ Calendrier des vols','Bouton <b>🗓️ Calendrier</b> (onglet Lignes, ou la liste des vols) : la semaine quadrillée, un bloc par rotation.'],
  ['⏩ Vitesses Turbo et Ultra','En haut : <b>Turbo</b> (un jour en 24 s) et <b>Ultra</b> (un jour en 3 s) pour que les jours passent vite.'],
  ['✈️ 17 nouveaux avions','Onglet <b>Acheter</b> : PC-12, Fokker 100, MD-83, DC-10, A310, Il-96, 747-200…'],
  ['💥 Accidents','Carte 2D et 3D : 💥 🔥 ⚠️ au lieu d’accident ; fiche d’une compagnie dans <b>Actus → Sécurité</b>.'],
  ['🏛️ Pays et présidents','Actus → 🏛️ Pays : chaque pays a un président qui commande des avions, change les taxes, ferme son ciel… et vous écrit (📬) pour des contrats.'],
  ['⚠️ Accidents','Votre flotte peut avoir des accidents (rares) : entretenez vos avions ! Niveau réglable dans Plus → Options.'],
  ['⚔️ Rivalité','Actus → Classement : les 3 plus grosses compagnies se mobilisent pour vous détrôner (levées de fonds, commandes record, guerres des prix, rachats). Réglable dans Plus → Options.'],
  ['🧑‍🤝‍🧑 Passagers','Touchez un vol → <b>📋 Passagers</b> → un passager : carte d’embarquement, bagages, santé, contact…'],
  ['🌊 Mers, 🌙 nuit','Vagues et reflets en 3D ; la nuit, villes et aéroports éclairés.'],
];
MODALS.whatsnew=()=>showModal('🆕 Nouveautés (version '+GAME_VER+')', `<ul class="inst">${WHATS_NEW.map(([a,b])=>`<li><b>${a}</b><br><span class="small">${b}</span></li>`).join('')}</ul><div class="btns"><button class="btn gold" data-act="checkUpdate">🔄 Vérifier la mise à jour</button></div><p class="small mut">Si une nouveauté n’apparaît pas, touchez « Vérifier la mise à jour » : le jeu vide son cache et se recharge (votre partie est gardée).</p>`);
document.addEventListener('DOMContentLoaded',()=>{ setTimeout(()=>{ try{ Object.assign(ACTIONS,{ checkUpdate:()=>checkUpdate(true), whatsNew:()=>openM('whatsnew') });
  checkUpdate(false);
  if(typeof S!=='undefined'&&S&&localStorage.getItem('se-seen-ver')!==GAME_VER){ localStorage.setItem('se-seen-ver',GAME_VER); setTimeout(()=>{ const g=document.getElementById('globe'); if(!UI.modal&&!(g&&!g.hidden)) openM('whatsnew'); },2500); } }catch(e){} },2500); });
