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

## Bonus : Congo Sky Tycoon (`avion/`)

Un second jeu, indépendant : simulateur de gestion de compagnie aérienne sur carte satellite (Leaflet + imagerie ESRI, Google Maps en option avec clé API), ouvert via `avion/index.html`.

- **Gestion façon « airline manager »** : achat de hubs, licences de lignes, audit de marché, demande et prix par classe (Éco / Affaires / Première / Fret), configuration cabine par avion, planning hebdomadaire (un avion peut desservir plusieurs lignes de son hub), achat de kérosène et de quotas CO₂ à cours fluctuant, personnel (pilotes, PNC, mécaniciens, sol) avec salaires, moral et grèves, bilan hebdomadaire.
- **142 aéroports** dont **43 en RD Congo** (25 provinces, pistes asphalte/latérite) et chantiers d’aéroports (bitumage, allongement de piste, dépôts de carburant, terminaux, ILS).
- **42 avions réels**, neufs, d’occasion ou en leasing, éditeur d’avion perso.
- **Mode pilote** : pilotez vous-même un vol sur la carte satellite (horizon artificiel, badins, pilote automatique avec atterrissage automatique, note d’atterrissage).
- Vols en temps réel (9 phases), orages, traînées de condensation, tutoriel guidé, 21 objectifs, rival IA, événements (Nyiragongo, Ebola, boom minier…), interface mobile.

## Crédits

Carte du monde SVG : « Simple World Map » par Al MacDonald, éditée par Fritz Lekschas ([flekschas/simple-world-map](https://github.com/flekschas/simple-world-map)), sous licence [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

Congo Sky Tycoon : imagerie satellite © Esri ; frontière de la RDC issue de Natural Earth (domaine public) via `world-atlas` ; [Leaflet](https://leafletjs.com) (BSD-2).

## Structure

```
index.html    Application complète (HTML + CSS + JS, un seul fichier)
manifest.json Manifeste PWA (icône, nom, couleurs)
sw.js         Service worker (mise en cache, fonctionnement hors-ligne)
avion/        Congo Sky Tycoon (index.html, data.js, sim.js, map.js, ui.js)
```
