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
