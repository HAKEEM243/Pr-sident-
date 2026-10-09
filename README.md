# Hakvision Président

Simulateur de chef d'État jouable dans le navigateur : choisissez l'un des 195 pays du monde et gérez son économie, sa diplomatie, ses ressources, sa sécurité et ses institutions. Un mode Éditeur permet de tout modifier librement (bac à sable), et une carte du monde interactive permet de visualiser vos relations internationales.

## Lancer le jeu

Aucune installation n'est nécessaire : c'est une page HTML autonome (pas de build, pas de dépendances).

```bash
cd president-simulator
python3 -m http.server 8080
# puis ouvrir http://localhost:8080/index.html
```

Ou ouvrez directement `index.html` dans un navigateur.

## Déploiement

Ce dossier peut être déployé tel quel sur n'importe quel hébergeur de fichiers statiques (Netlify, Vercel, GitHub Pages...). La page est une PWA : sur mobile, le navigateur propose « Ajouter à l'écran d'accueil » pour l'installer comme une app.

## Fonctionnalités

- **195 pays jouables**, avec des données réelles approximatives (population, superficie, PIB, capitale).
- **RD Congo en profondeur** : 16 villes réelles (Kinshasa, Lubumbashi, Kisangani, Goma...) pour les infrastructures et le choix de capitale.
- **Économie** : fiscalité, budget par secteur, entreprises publiques/privées, contrats commerciaux internationaux.
- **Ressources naturelles** : exploitation, prospection, gisements.
- **Diplomatie** : relations avec les 194 autres nations (alliance, commerce, aide, sanctions, guerre, paix).
- **Social** : politique migratoire/visas, sécurité sociale, santé, éducation.
- **Sécurité** : police et armée (effectifs, équipement, recrutement).
- **Infrastructures** : routes, autoroutes, aéroports, ports par ville.
- **Institutions** : régime politique, capitale, hymne national, cabinet ministériel, mandat.
- **Mode Éditeur** : modification libre de tout champ de tout pays, création de ressources/entreprises/villes.
- Sauvegarde automatique (`localStorage`) + export/import de sauvegarde au format JSON.

## Portée & limites (volontaires)

Ce projet est un simulateur jouable et cohérent, pas une reconstitution économique réaliste au niveau d'un titre commercial (type Geopolitical Simulator / Power & Revolution). Les formules économiques sont simplifiées pour rester amusantes et compréhensibles. C'est une base solide, facilement extensible (le code est un seul fichier `index.html` commenté par sections).

## Bonus : Sky Empire (`avion/`)

Un second jeu, indépendant : simulateur de gestion de compagnie aérienne sur carte satellite (Leaflet + imagerie ESRI, Google Maps en option avec clé API), ouvert via `avion/index.html`.

- **Le monde entier** : 3 200 aéroports avec vols réguliers dans 234 pays (n’importe lequel peut devenir votre hub), onglet 🌐 Monde pour explorer chaque pays (marché intérieur, régions, meilleures lignes).
- **Gestion façon « airline manager »** : hubs, licences de lignes, audit de marché, demande et prix par classe (Éco / Affaires / Première / Fret), configuration cabine, planning hebdomadaire, kérosène et quotas CO₂ à cours fluctuant, personnel (salaires, moral, grèves), bilan hebdomadaire, prêts, marketing, alliances, contrats cargo.
- **68 avions réels** avec leurs vraies photos (Wikimedia Commons), neufs, d’occasion ou en leasing, éditeur d’avion perso ; 3 tailles de départ (régionale, nationale, grand transporteur).
- **Les vraies compagnies aériennes** : 569 compagnies réelles et 26 900 lignes régulières réelles. Vos concurrents sont les compagnies de votre pays (aucune si le pays n’en a pas) et les grandes compagnies mondiales ; sur chaque ligne vous affrontez les compagnies qui la desservent vraiment, avec la durée de vol réelle ; le ciel affiche leur trafic (compagnie, ligne, durée au survol) ; classement mondial.
- **Événements mondiaux** : ouragans, typhons, tempêtes de neige, cendres volcaniques, mousson, grands événements sportifs, Hajj, Nouvel An lunaire, crises pétrolières… et le détail de la RD Congo (43 aéroports, provinces, pistes en latérite).
- **Réalisme** : 4 400 vraies pistes (position, orientation, longueur, revêtement, altitude) dessinées sur la carte au zoom ; décollages et atterrissages alignés sur la piste réelle avec approche finale dans l’axe ; distance de décollage réelle de chaque avion (corrigée de l’altitude : La Paz refuse un 787) ; courants-jets d’ouest (JFK → LHR ≈ 7 h, LHR → JFK ≈ 8 h) ; charge limitée près de l’autonomie maximale ; avions à l’échelle réelle (envergure, longueur) au zoom ; infobulle de vol avec niveau, vitesse sol, vent, pistes, distance restante en NM et heure d’arrivée locale ; fiche technique de chaque ligne.
- **Mode simple (par défaut)** : 5 onglets, tutoriel en 3 étapes ; personnel, carburant, maintenance et programmation des avions sont automatiques (avec des quotas de recrutement hebdomadaires) ; ouvrir une ligne programme tout seul un avion libre ; liste « Mes vols » façon Airline Manager. Le mode expert (tous les onglets) s’active dans « Plus ». Pour la RD Congo, la compagnie proposée s’appelle **Air Kongo**.
- **Passagers & immigration** (onglet 🛂) : pour chaque pays, combien de voyageurs arrivent (par jour, semaine, mois ou an), leur nationalité, leur richesse, le motif du voyage, la classe, la compagnie choisie et le prix payé, le nombre de voyages par an et les refus d’entrée ; profil des passagers de chaque ligne ; manifeste d’un vol en cours avec des fiches de passagers fictifs (nom, âge, métier, nationalité, billet payé, canal de réservation…). Estimations du modèle, personnes fictives.
- **Diagnostic financier** : dans Finances (et « Plus »), une carte « Pourquoi je suis dans le rouge ? » explique les causes du déficit (pilotes ou personnel en trop, avions sans ligne, lignes déficitaires, prix trop bas, carburant, location) avec un bouton de correction en un clic.
- **Fiches passagers détaillées** : prénom, nom, âge, lieu de résidence, situation familiale, profession, langues, motif du voyage raconté en une phrase, billet payé et canal de réservation, bagages, repas, fidélité (miles), humeur à bord, passeport et visa ; **avis des passagers** (1 à 5 étoiles) après les vols, qui influencent votre réputation.
- **Votre compagnie vit aussi à chaque heure** : pannes au sol, passagers célèbres, urgences médicales, turbulences, oiseaux dans un réacteur, scandales à bord, bilan quotidien dans le journal, arrivées en direct ; **fiche de chaque compagnie concurrente** (touchez-la dans le classement) ; **classement des aéroports du monde** avec le rang de vos hubs ; **export / import de sauvegarde**.
- **Conseiller** : dans « Lignes », les meilleures actions du moment (lignes à ouvrir en un clic avec leur demande et leurs concurrents, lignes pleines à renforcer, lignes déficitaires à alléger).
- **Recrutement libre** : jusqu’à des milliers de pilotes ou de personnel en un clic, ou recrutement automatique par catégorie.
- **Le monde bouge à chaque heure de jeu** : 1 à 3 événements par heure (retards, promos, pannes, nominations, météo…) dans le journal et un bandeau en direct sur la carte ; les compagnies réagissent à vous (guerre des prix sur vos lignes, copie de vos lignes rentables, défense de leur hub) et publient leurs résultats ; briefing du réveil détaillé après une absence.
- **Monde vivant** : le climat des pays évolue (colère sociale, grèves, crises, booms touristiques : demande, aéroports fermés, vols suspendus par les compagnies étrangères, bien plus d’avions dans les pays en essor) et les autres compagnies gagnent ou perdent de l’argent, commandent des avions, ouvrent et ferment des lignes (qui changent vraiment la concurrence), ont des incidents, des crashs ou font faillite ; de nouvelles compagnies apparaissent (surtout dans les pays peu desservis) ; classement mondial avec tendances ; onglet 📰 Actus (actualités, sécurité, nouvelles compagnies, faillites).
- **Fluidité et aéroports vivants** : avions animés en continu (60 images/s), roulage réel du poste de stationnement à la piste par la voie parallèle, postes alignés le long des pistes, balisage lumineux allumé à l’heure locale (feux de bord, rampes d’approche, seuils, PAPI), marquages au sol au zoom maximal ; durées de vol calées sur les horaires réels (roulage selon la taille de l’aéroport, routes aériennes, vents).
- **Mode pilote** : pilotez vous-même un vol sur la carte satellite, depuis la piste réelle (horizon artificiel, vitesse sol avec vent, guidage axe + plan de descente, pilote automatique avec atterrissage automatique sur la piste, sortie de piste possible, note d’atterrissage).
- **Affaires** : introduction en bourse, émission et rachat d’actions, dividendes, achat d’actions des concurrents et **rachat (OPA) à 51 %** qui intègre leur hub, leurs lignes et leurs avions ; commandes d’avions avec délais de livraison, remises sur volume ou livraison immédiate ; partages de codes avec les grandes compagnies ; décisions stratégiques (subventions, syndicats, vols VIP, rappels constructeur…) ; salons VIP et bases de maintenance dans les hubs ; statistiques hebdomadaires.
- **Vue 3D façon Google Earth** (CesiumJS) : globe satellite éclairé par le soleil à l’heure du jeu, avions 3D aux couleurs des compagnies, caméra de poursuite, et villes 3D photoréalistes de Google avec une clé Map Tiles API.
- **📲 Application mobile** : le jeu s’installe sur l’écran d’accueil (iPhone : Safari → Partager → « Sur l’écran d’accueil » ; Android : « Installer l’application »). Il s’ouvre alors en plein écran sans la barre du navigateur, démarre vite et fonctionne avec une connexion faible (service worker). Bouton « 📋 Copier ma partie / 📥 Coller une partie » pour transférer sa compagnie de Safari vers l’application (Plus → 📲 Application).
- **💾 Sauvegardes fiables** (Plus → 💾 Sauvegardes) : double enregistrement (localStorage + IndexedDB, qui ne sature pas avec une grosse compagnie), copie de secours automatique toutes les 10 minutes (4 gardées), emplacements nommés à recharger, export en fichier (sur iPhone : « Enregistrer dans Fichiers ») et import, copier/coller. L’écran « nouvelle partie » propose directement d’importer ou de reprendre une partie.
- **Trafic mondial réaliste sur la carte** : les avions de toutes les compagnies (pas seulement les vôtres) roulent sur les taxiways, décollent dans l’axe des vraies pistes, montent, approchent et atterrissent, puis roulent jusqu’au poste. Étiquettes « 🛫 décollage », « 🛬 finale », « 🛬 atterrit » en zoomant sur un aéroport, et phase + altitude dans l’infobulle. Visible aussi en vue 3D autour de l’avion suivi.
- **Vue de vol façon simulateur** (bouton « 🎥 Vue 3D » sur la fiche d’un vol) : plein écran immersif, avions 3D à l’échelle réelle et différents selon le modèle (A380 à deux ponts, 747 à bosse, MD-11 à moteur de queue, CRJ à moteurs arrière, ATR/Dash à hélices, Caravan, Concorde…), train d’atterrissage qui rentre, inclinaison en virage, traînée de condensation, nuages, 6 caméras (arrière, côté, avant, dessus, loin, cockpit) et HUD vert : cap, vitesse, altitude, Mach, vario, vent, carburant, destination.
  - Autour de l’avion : vrais bâtiments OpenStreetMap en 3D quand il vole bas (près des aéroports), aéroports voisins nommés, pistes dessinées avec balisage lumineux (bords, seuils verts/rouges, rampe d’approche). Décollage physique (roulage en accélérant, rotation, montée) et atterrissage (arrondi, toucher, freinage, roulage jusqu’au parking). Ralenti automatique 🎬 : temps réel au décollage et à l’atterrissage, accéléré en croisière (×1, ×4, ×16, ×60, ×600 au choix). À l’arrivée au parking, la caméra passe à un autre de vos vols.
- **Ville 3D** (bouton « 🏙️ Ville 3D ») : bâtiments OpenStreetMap en relief (OpenFreeMap, sans clé), mode satellite, plus de 50 monuments modélisés (Tour de l’Échangeur et Palais du Peuple à Kinshasa, Tour Eiffel, Burj Khalifa, pyramides, Petronas, Ryugyong à Pyongyang…), visite « Monument suivant », rotation automatique et vos avions en direct. Chargée seulement à la demande : la carte 2D reste fluide.
- **📬 Messagerie des PDG rivaux** : les patrons des autres compagnies vous écrivent (partage de codes, offre de rachat d’une ligne avec contre-offre, menace de guerre des prix avec trêve possible, alliance d’un an, avion d’occasion à vendre, piques et félicitations). Chaque réponse a des conséquences : recettes en plus, guerre des prix, image, ligne vendue… Sans réponse sous 5 jours, l’offre expire, et une menace ignorée est souvent mise à exécution.

## Crédits

Carte du monde SVG : « Simple World Map » par Al MacDonald, éditée par Fritz Lekschas ([flekschas/simple-world-map](https://github.com/flekschas/simple-world-map)), sous licence [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

Sky Empire : imagerie satellite © Esri ; aéroports et pistes [OurAirports](https://ourairports.com) (domaine public) ; lignes aériennes réelles [Jonty/airline-route-data](https://github.com/Jonty/airline-route-data) ; pays des compagnies [OpenFlights](https://openflights.org/data) (ODbL) ; longueurs de piste et fuseaux [airport-data-js](https://github.com/aashishvanand/airport-data-js) (CC BY 4.0) ; photos d’avions Wikimedia Commons (licences libres, crédit sur chaque photo) ; frontière de la RDC Natural Earth (domaine public) ; [Leaflet](https://leafletjs.com) (BSD-2) ; [CesiumJS](https://cesium.com/platform/cesiumjs/) (Apache 2.0).

## Structure

```
index.html    Application complète (HTML + CSS + JS, un seul fichier)
manifest.json Manifeste PWA (icône, nom, couleurs)
sw.js         Service worker (mise en cache, fonctionnement hors-ligne)
avion/        Sky Empire (index.html, airports-db.js, runways-db.js, airlines-db.js, data.js, sim.js, realism.js, airlines.js, world-ai.js, passengers.js, pulse.js, simple.js, map.js, ui.js, ui-biz.js, business.js, pilot.js, actions.js, globe.js)
```
