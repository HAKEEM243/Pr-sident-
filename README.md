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
- **Fluidité et aéroports vivants** : avions animés en continu (60 images/s), roulage réel du poste de stationnement à la piste par la voie parallèle, postes alignés le long des pistes, balisage lumineux allumé à l’heure locale (feux de bord, rampes d’approche, seuils, PAPI), marquages au sol au zoom maximal ; durées de vol calées sur les horaires réels (roulage selon la taille de l’aéroport, routes aériennes, vents).
- **Mode pilote** : pilotez vous-même un vol sur la carte satellite, depuis la piste réelle (horizon artificiel, vitesse sol avec vent, guidage axe + plan de descente, pilote automatique avec atterrissage automatique sur la piste, sortie de piste possible, note d’atterrissage).
- **Affaires** : introduction en bourse, émission et rachat d’actions, dividendes, achat d’actions des concurrents et **rachat (OPA) à 51 %** qui intègre leur hub, leurs lignes et leurs avions ; commandes d’avions avec délais de livraison, remises sur volume ou livraison immédiate ; partages de codes avec les grandes compagnies ; décisions stratégiques (subventions, syndicats, vols VIP, rappels constructeur…) ; salons VIP et bases de maintenance dans les hubs ; statistiques hebdomadaires.
- **Vue 3D façon Google Earth** (CesiumJS) : globe satellite éclairé par le soleil à l’heure du jeu, avions 3D aux couleurs des compagnies, caméra de poursuite, et villes 3D photoréalistes de Google avec une clé Map Tiles API.

## Crédits

Carte du monde SVG : « Simple World Map » par Al MacDonald, éditée par Fritz Lekschas ([flekschas/simple-world-map](https://github.com/flekschas/simple-world-map)), sous licence [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

Sky Empire : imagerie satellite © Esri ; aéroports et pistes [OurAirports](https://ourairports.com) (domaine public) ; lignes aériennes réelles [Jonty/airline-route-data](https://github.com/Jonty/airline-route-data) ; pays des compagnies [OpenFlights](https://openflights.org/data) (ODbL) ; longueurs de piste et fuseaux [airport-data-js](https://github.com/aashishvanand/airport-data-js) (CC BY 4.0) ; photos d’avions Wikimedia Commons (licences libres, crédit sur chaque photo) ; frontière de la RDC Natural Earth (domaine public) ; [Leaflet](https://leafletjs.com) (BSD-2) ; [CesiumJS](https://cesium.com/platform/cesiumjs/) (Apache 2.0).

## Structure

```
index.html    Application complète (HTML + CSS + JS, un seul fichier)
manifest.json Manifeste PWA (icône, nom, couleurs)
sw.js         Service worker (mise en cache, fonctionnement hors-ligne)
avion/        Sky Empire (index.html, airports-db.js, runways-db.js, airlines-db.js, data.js, sim.js, realism.js, airlines.js, map.js, ui.js, ui-biz.js, business.js, pilot.js, actions.js, globe.js)
```
