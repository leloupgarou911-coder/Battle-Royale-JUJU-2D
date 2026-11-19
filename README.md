# JUJU Battle Royale — Real World

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

## Limites
C'est un prototype 2D canvas avec projection isométrique, pas un moteur 3D: modèles 3D et spritesheet d'animation non présents, caméra fixe, IA rudimentaire, pas de multijoueur. Les données OSM/Overpass et le géocodage demandent Internet; Overpass peut être temporairement indisponible. Le rendu n'a pas été vérifié dans un navigateur pour ce commit.

## Données
© OpenStreetMap contributors. Respecter l'attribution et les politiques de service: https://www.openstreetmap.org/copyright et https://operations.osmfoundation.org/policies/tiles/.
