# 🚆 Rail Empire — les bases pour faire « Sky Empire », mais en train

Ce document explique **comment Sky Empire est construit** et **comment le transformer en jeu de train**.
Le dossier contient aussi une **base jouable** (`index.html` + `game.js`, ~120 lignes utiles) : ouvrez-la, elle tourne déjà
(gares, lignes, calendrier, trains qui roulent sur la carte, argent, vitesses, rattrapage hors-jeu, sauvegarde).

---

## 1. Les 8 idées à garder (celles qui font la qualité de Sky Empire)

1. **Un seul état de jeu `S`** (objet JSON). Tout ce qui est sauvegardé est dedans ; l'interface se redessine à partir de `S`.
2. **La position est une fonction du temps** : `position(train, t)`. On ne stocke pas « le train est à 42 % du trajet » :
   on calcule où il est à partir de l'horaire. Conséquences : on peut accélérer, mettre en pause, fermer le jeu, rattraper le temps
   hors-jeu, et dessiner les trains des autres compagnies sans simulation lourde.
3. **Profil de trajet en phases** (avion : embarquement → roulage → décollage → montée → croisière → descente → approche → atterrissage ;
   train : arrêt en gare → accélération → palier → freinage → arrêt). Mis en cache par (modèle, distance).
4. **Horloge de jeu `S.time` avancée par pas de 5 minutes** (`advance(dt)` → `simStep()`), avec des vitesses (×1, ×60, ×600, ×3600…).
   Les événements (arrivée, revenu, panne) sont détectés dans la fenêtre `(t0, t1]` du pas, jamais « quand on regarde ».
5. **Calendrier fixe** : chaque train a des créneaux de départ (jour + heure locale), calculés de façon déterministe.
   Le départ tombe à l'heure ; seuls les conflits d'infrastructure retardent. Les autres compagnies ont leur horaire fixe aussi.
6. **Contrôle du trafic** (avion : une piste = un avion à la fois ; train : un **canton** = un train à la fois). Si c'est occupé : attente
   avant le signal. Les retards se calculent à la programmation, pas à chaque image.
7. **Hors-ligne honnête** : à la réouverture, `catchUp()` = `advance(temps réel écoulé)`. Garder l'heure de dernière présence
   à part de la sauvegarde. Sur iPhone, une appli en arrière-plan est **gelée** (les minuteries s'arrêtent) : détecter les trous d'horloge
   avec `Date.now()` et rattraper.
8. **IA des autres compagnies** hebdomadaire/mensuelle : stratégie (expansion, économies, renouvellement), commandes, rachats, accidents,
   alliances, guerres des prix, et des **challengers** qui poursuivent le premier (levées de fonds, commandes record…). Tout s'écrit dans un
   fil d'actualités : c'est ce qui rend le monde vivant.

## 2. Correspondance avion → train

| Sky Empire (avion) | Rail Empire (train) |
|---|---|
| Aéroport (classe, piste, altitude) | **Gare** (taille, nombre de quais, électrifiée ou non) |
| Piste, tour de contrôle (ATC) | **Voie, canton, signalisation** (un train par canton), aiguillages |
| Modèle d'avion (sièges, vitesse, autonomie, prix) | **Rame / locomotive** (places, vitesse max, accélération, prix, énergie) |
| Ligne ouverte entre deux villes | **Ligne** entre gares, avec arrêts intermédiaires |
| Vols par semaine | **Allers-retours par semaine** (sillons) |
| Carburant | **Énergie** (électrique : kWh et péage ; diesel : litres) |
| Pilotes, PNC, mécaniciens | **Conducteurs, contrôleurs, techniciens** |
| Check A / C / D | **Révisions** (visite légère, révision, grande révision) |
| Hubs | **Grandes gares / nœuds du réseau** |
| Demande (trafic des aéroports) | **Population des villes + distance** (modèle gravitaire) |
| Concurrents réels (Air France…) | **Opérateurs réels** (SNCF, DB, Trenitalia, Renfe, Eurostar…) + opérateurs privés |
| Accidents | **Déraillements, collisions aux passages à niveau, incendies** (rares, visibles sur la carte) |
| Météo, orages | **Neige, canicule, tempêtes, glissements de terrain** |
| Slots de l'aéroport | **Sillons** (créneaux horaires sur une ligne) |
| Cargo | **Fret** (conteneurs, céréales…) |

## 3. Ce qui change vraiment pour le train

- **Le réseau est un graphe**, pas un ciel libre : gares = nœuds, tronçons de voie = arêtes. Un trajet est un **chemin** (plus court chemin,
  Dijkstra) le long de tronçons. Chaque tronçon a : longueur, vitesse limite, électrifié oui/non, nombre de voies, cantons.
- **Profil de vitesse** : accélération `a` (m/s²), vitesse max du tronçon `v`, freinage. Distance de freinage `v²/(2a)`. Un train ne
  traverse pas une courbe à 300 km/h : prendre le minimum entre vitesse du modèle et limite du tronçon.
- **Capacité** : sur une voie unique, deux trains de sens contraires ne se croisent qu'en gare ou en évitement. Sur deux voies :
  distance de sécurité (headway) entre trains du même sens. C'est l'équivalent de l'ATC d'avion.
- **Électrification et écartement** : une locomotive électrique ne roule pas sur voie non électrifiée ; écartement différent
  (Espagne/France) = changement à la frontière. Cela crée de vraies décisions de compatibilité (comme « piste trop courte » pour un avion).
- **Arrêts intermédiaires** : temps d'arrêt (dwell) par gare, échange de voyageurs ; très important pour le réalisme et l'économie.
- **Infrastructure** : en avion, les pistes existent. En train, vous pouvez **construire** (coût au km) ou **louer les sillons**
  (péage au km). Deux modes possibles : « opérateur » (on loue) ou « magnat » (on construit).
- **Billetterie** : 1ʳᵉ/2ᵉ classe, tarifs dynamiques (yield), abonnements, jours de pointe (vendredi soir, dimanche soir, vacances).
- **Vue 3D** : le sol est une carte 2D + relief ; les trains suivent des polylignes. Les **tunnels** et **ponts** sont des cas à part.

## 4. Architecture des fichiers (même découpage que Sky Empire)

```
index.html      page, CSS, chargement des scripts (?v= pour casser le cache)
data.js         gares, pays, modèles de trains, familles, constantes
sim.js          état S, advance(), simStep(), dailyTick(), weeklyTick(), finances, maintenance
network.js      graphe de voies, plus court chemin, profils de vitesse, cantons (≈ realism.js + atc.js)
timetable.js    calendrier : créneaux, sillons, horaires des autres compagnies (≈ planSlots / rivalSched)
map.js          carte Leaflet : gares, lignes, trains (position(train, t))
ui.js           panneaux, fiches, modales ; actions via data-act="..." → ACTIONS[...]
world-ai.js     IA des compagnies : stratégie, commandes, rachats, accidents, actualités
saves.js        sauvegardes (localStorage + IndexedDB), export/import
pwa.js + sw.js  appli installable, hors-ligne, mise à jour
```

Conventions utiles : une seule boucle `setInterval` (200–250 ms) ; interface en délégation d'événements (`data-act`) ;
modales `MODALS[nom]` ; pas de dépendances à compiler (HTML + JS statiques, hébergés sur GitHub Pages).

## 5. Feuille de route conseillée (jalons)

1. **Base** (déjà dans ce dossier) : carte, gares, une ligne, un train animé, horloge, argent, sauvegarde, rattrapage.
2. **Données réelles** : gares et voies depuis OpenStreetMap (`railway=station`, `railway=rail` via Overpass) ou GTFS ; population (Natural Earth / GeoNames).
3. **Réseau en graphe** + plus court chemin + profil de vitesse par tronçon + arrêts intermédiaires.
4. **Signalisation** : cantons, attente avant signal, calendrier sans conflit (comme l'ATC).
5. **Économie complète** : billets 1ʳᵉ/2ᵉ, énergie, péages, personnel, révisions, prêts, pannes.
6. **Concurrents** : opérateurs réels avec horaires fixes, IA stratégique, challengers, actualités, classement.
7. **Passagers détaillés** (fiches, bagages, humeurs), **accidents**, **météo**, **mode nuit**.
8. **Mobile** : PWA, sauvegardes fiables, régulateur de fluidité, mises à jour automatiques.

## 6. Pièges rencontrés (à éviter dès le début)

- **Collisions de noms globaux** entre scripts (`simNow`, `MONTHS`, `bin`…) : préfixer (`gSimNow`, `PX_MONTHS`).
- **Mélange des fuseaux horaires** : stocker en UTC, afficher en local, et définir « semaine » dans le fuseau du hub.
- **Les minuteries gelées sur iPhone** : ne jamais compter les secondes avec `setInterval` seul ; comparer `Date.now()`.
- **Sauvegarde qui en écrase une autre** : un indicateur `_noUnloadSave` pendant l'import ; garder l'heure de dernière présence à part.
- **Cache de l'appli installée** : service worker « réseau d'abord » pour les fichiers du jeu, numéro de version dans la page, et un
  bouton « Vérifier la mise à jour » qui vide le cache.
- **Performance** : calculer ce qui ne dépend pas de l'heure une seule fois (cache par ligne), n'afficher que ce qui est à l'écran,
  prévoir un régulateur d'images/s sur téléphone.
- **Honnêteté** : données de passagers et d'accidents fictives ou estimées → le dire. Ne pas copier les noms, logos ou illustrations d'un jeu existant.
  Aucune clé d'API dans le code (elle reste dans le `localStorage` du joueur).
- **Tester vite** : Node pour la logique (`eval` des fichiers, simulation de plusieurs années), Playwright pour l'interface (captures,
  rechargement réel, simulation d'une absence en décalant `Date.now()`).

## 7. Prompt prêt à coller dans une nouvelle session

> Crée un jeu de gestion ferroviaire statique (HTML/JS, sans build) dans le dossier `train-starter/`, en partant de la base jouable
> et du fichier BLUEPRINT.md. Respecte l'architecture (état unique, position = fonction du temps, calendrier fixe, rattrapage hors-ligne).
> Étape 1 : charger de vraies gares européennes (OpenStreetMap), un graphe de voies et un plus court chemin. Étape 2 : arrêts
> intermédiaires et profil de vitesse par tronçon. Étape 3 : cantons de signalisation. Teste chaque étape (Node + Playwright), publie sur
> GitHub Pages à chaque étape, et sois honnête sur ce qui n'a pas pu être testé sur un vrai iPhone.
