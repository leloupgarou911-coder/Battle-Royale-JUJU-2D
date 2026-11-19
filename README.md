# JUJU Battle Royale — Real World 2D

Prototype top-down sur carte géographique OpenStreetMap.

### Jouer
Serveur local: `python -m http.server 8000`, puis ouvrir `http://localhost:8000`.

### Commandes
- WASD / flèches : déplacement.
- E : récupérer un objet proche.
- Q ou bouton ACTION : neutraliser abstraitement un bot proche (interaction arcade).
- Souris : déplacer la carte; molette ou boutons : zoom.
- Sur téléphone : boutons directionnels.
- VILLE : rechercher et démarrer dans une ville réelle.

### Mise à jour gameplay
- Personnage stylisé animé (CSS), bots stylisés.
- Chargement des empreintes de bâtiments OpenStreetMap via Overpass lorsque le zoom est proche.
- Collision simplifiée: déplacement bloqué si le point joueur entre dans une empreinte.
- Impulsion arcade visuelle (Q / ACTION) et interaction avec bots proches.

### Prototype actuel
- Carte OSM, zoom et déplacement.
- Joueur et caméra qui suivent.
- 18 bots avec déplacement aléatoire et réaction simplifiée à proximité.
- 24 objets récupérables et inventaire visuel.
- Zone sûre rétrécissante; énergie qui baisse hors zone; fin de partie et bouton rejouer.
- Choix d'une ville via géocodage Nominatim.

### Données
© OpenStreetMap contributors. Attribution et conditions: https://www.openstreetmap.org/copyright. Les tuiles standard OSM ne sont pas un service illimité; respecter https://operations.osmfoundation.org/policies/tiles/.

### Limites connues
Prototype solo uniquement: interactions arcade simplifiées, bots rudimentaires, pas de vrai multijoueur, pas encore de collisions bâtiment, pas d'animations sprites ni de système de matchmaking. Internet requis pour les cartes et la recherche de villes.


## Rendu de jeu — nouvelle passe

- Couche canvas dédiée aux personnages et objets, au lieu des icônes Leaflet visibles.
- Personnage dessiné avec ombre, corps, tête et jambes animées pendant le déplacement.
- Bâtiments OSM extrudés en pseudo-3D (façades + toit) au-dessus de leurs empreintes.
- Le rendu suit la caméra centrée sur le joueur et se redessine lors du déplacement/zoom.
- Correctif de syntaxe dans la conversion GeoJSON des bâtiments.

**Limite actuelle :** il s'agit d'un rendu 2D canvas avec extrusion graphique, pas de véritables modèles 3D ni d'une vue isométrique libre. Les données bâtiments restent dépendantes d'Overpass/OSM. La version n'a pas été testée dans un navigateur dans cette session.
