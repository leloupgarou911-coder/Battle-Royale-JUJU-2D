# JUJU WORLD — Explore Beyond the Map

Prototype de jeu solo sur une scène isométrique basée sur les données géographiques OpenStreetMap.

## Jouer
Pour lancer localement, utiliser un serveur HTTP (ex. `python -m http.server 8000`) puis ouvrir `http://localhost:8000`.

## Commandes
- WASD / flèches : se déplacer.
- E : récupérer un objet à proximité.
- Q / bouton ACTION : interaction arcade abstraite avec un bot proche.
- + / - : zoom de la zone.
- VILLE : chercher une ville réelle et y commencer.
- Téléphone : boutons directionnels.

## Rendu actuel
- Scène Canvas en projection isométrique fixe; les tuiles cartographiques plates sont masquées.
- Routes et empreintes de bâtiments récupérées depuis OpenStreetMap / Overpass et rendues dans la scène.
- Bâtiments dessinés avec toits, façades et ombres (extrusion graphique pseudo-3D).
- Personnage dessiné avec animation de marche, bots et objets dans la même scène.
- Caméra centrée sur le personnage; obstacles bâtiments bloquent le déplacement.
- Zone sûre, énergie, inventaire, recherche de ville et HUD conservés.

## Relief et topographie
- Altitudes échantillonnées à la demande via l'API Elevation d'Open-Meteo, basée sur le modèle Copernicus DEM GLO-90 (résolution de 90 m).
- La grille d'altitude colore légèrement le terrain et adapte la vitesse selon la pente estimée; les descentes douces peuvent accélérer le déplacement.
- Les cours d'eau OSM deviennent des obstacles, sauf au voisinage des ponts OSM. Les routes marquées `bridge` et `tunnel` ont un style différencié.
- Attribution des données d'altitude : Open-Meteo et Copernicus DEM. Voir https://open-meteo.com/en/docs/elevation-api.

## Limites
C'est un prototype 2D canvas avec projection isométrique, pas un moteur 3D: modèles 3D et spritesheet d'animation non présents, caméra fixe, IA rudimentaire, pas de multijoueur. Les données OSM/Overpass et le géocodage demandent Internet; Overpass peut être temporairement indisponible. Le rendu n'a pas été vérifié dans un navigateur pour ce commit.

## Données
© OpenStreetMap contributors. Respecter l'attribution et les politiques de service: https://www.openstreetmap.org/copyright et https://operations.osmfoundation.org/policies/tiles/.


## Bâtiments et géométrie urbaine
- Empreintes OSM des bâtiments individuels et des relations multipolygones (anneaux extérieurs).
- Hauteur réelle lorsqu'un tag `height` est disponible; sinon estimation à partir de `building:levels`, puis hauteur visuelle de secours.
- Couleurs de façade et de toiture utilisées lorsqu'elles sont renseignées dans OpenStreetMap.
- Fenêtres stylisées générées à partir du nombre d'étages estimé.
- Les relations multipolygones avec trous intérieurs ne sont pas encore évidées dans le rendu Canvas.
- Les demandes Overpass sont sérialisées pour éviter plusieurs téléchargements concurrents pendant les déplacements.

- Parties de bâtiments (`building:part`) prises en compte lorsqu'elles sont cartographiées.
- Les cours intérieures des relations multipolygones OSM sont conservées comme trous dans les toitures et restent accessibles au déplacement.
- Les voies ferrées sont dessinées séparément des routes.
- Le culling utilise les boîtes géographiques des géométries afin de conserver les longues routes et grands bâtiments qui traversent l'écran sans sommet visible.
