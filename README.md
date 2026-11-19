# JUJU Battle Royale — Real World 2D prototype

Browser prototype for a top-down battle royale on real-world map data.

## Run locally
Open through a static server (city search uses fetch):
- Python: `python -m http.server 8000`
- Visit `http://localhost:8000`

## Prototype features
- Real geographic map tiles from OpenStreetMap with pan/zoom.
- Starts in Oran, Algeria; use **VILLE** to search for a real city.
- Player marker and WASD/arrow movement with camera following.
- Bot and loot placeholder markers.
- Shrinking safe-zone ring and HUD.

## Controls
W/A/S/D or arrows move; mouse drag pans; wheel/zoom buttons zoom; VILLE selects a city.

## Attribution
Map tiles © OpenStreetMap contributors. https://www.openstreetmap.org/copyright
Tile use policy: https://operations.osmfoundation.org/policies/tiles/

## Limitations
This is a basic prototype: no multiplayer, real combat, collision, or actual bot AI yet. It uses online map tiles and public geocoding; production should use a compliant tile provider or self-hosted map infrastructure and follow service policies.
