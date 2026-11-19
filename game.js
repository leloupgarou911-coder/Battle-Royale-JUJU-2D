/* JUJU BR — Real-world map prototype. Map data © OpenStreetMap contributors. */
const map=L.map('map',{zoomControl:false,worldCopyJump:true,preferCanvas:true}).setView([35.6971,-0.6308],16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
const playerIcon=L.divIcon({className:'',html:'<div class="player-marker"></div>',iconSize:[22,22],iconAnchor:[11,11]});
const botIcon=L.divIcon({className:'',html:'<div class="bot-marker"></div>',iconSize:[15,15],iconAnchor:[7,7]});
const lootIcon=L.divIcon({className:'',html:'<div class="loot-marker"></div>',iconSize:[13,13],iconAnchor:[6,6]});
let player=map.getCenter(), playerMarker=L.marker(player,{icon:playerIcon,zIndexOffset:1000}).addTo(map);
let bots=[], loot=[], kills=0, seconds=120, radius=2600, initialCenter=player, zoneCircle;
function makeZone(){if(zoneCircle)map.removeLayer(zoneCircle);zoneCircle=L.circle(initialCenter,{radius,color:'#35e5b4',weight:2,fillColor:'#35e5b4',fillOpacity:.055,dashArray:'8 8'}).addTo(map)}
makeZone();
function randomOffset(m){const a=Math.random()*Math.PI*2,r=Math.random()*m;return [r*Math.cos(a)/111320,r*Math.sin(a)/(111320*Math.cos(player.lat*Math.PI/180))]}
function spawn(){for(let i=0;i<25;i++){const o=randomOffset(2300);const p=[player.lat+o[0],player.lng+o[1]];bots.push({pos:p,marker:L.marker(p,{icon:botIcon}).addTo(map)})}for(let i=0;i<35;i++){const o=randomOffset(1700);const p=[player.lat+o[0],player.lng+o[1]];loot.push(L.marker(p,{icon:lootIcon}).addTo(map).bindTooltip('Objet à récupérer'))}}
spawn();
const keys={};window.addEventListener('keydown',e=>{if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keys[e.key.toLowerCase()]=true;e.preventDefault()}if(e.key==='+')map.zoomIn();if(e.key==='-')map.zoomOut()});
window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
let last=0;function tick(ts){if(ts-last>35){last=ts;let dx=0,dy=0;if(keys.w||keys.arrowup)dy=1;if(keys.s||keys.arrowdown)dy=-1;if(keys.a||keys.arrowleft)dx=-1;if(keys.d||keys.arrowright)dx=1;if(dx||dy){const z=map.getZoom(),metersPerPixel=156543.03392*Math.cos(player.lat*Math.PI/180)/Math.pow(2,z),speed=metersPerPixel*3.5;player=L.latLng(player.lat+dy*speed/111320,player.lng+dx*speed/(111320*Math.cos(player.lat*Math.PI/180)));map.panTo(player,{animate:false});playerMarker.setLatLng(player)}}
requestAnimationFrame(tick)}requestAnimationFrame(tick);
let countdown=120;setInterval(()=>{countdown--;if(countdown<0){radius=Math.max(120,radius-90);zoneCircle.setRadius(radius);countdown=30;document.getElementById('zoneStatus').textContent='La zone se contracte !';showToast('La zone sûre rétrécit !')}document.getElementById('clock').textContent=String(Math.floor(countdown/60)).padStart(2,'0')+':'+String(countdown%60).padStart(2,'0');document.getElementById('zoneLabel').textContent=Math.round(radius/2600*100)+'%';},1000);
setInterval(()=>{bots.forEach(b=>{const o=randomOffset(18);b.pos=[b.pos[0]+o[0],b.pos[1]+o[1]];b.marker.setLatLng(b.pos)});document.getElementById('players').textContent=Math.max(1,26-Math.floor((120-seconds)/12));seconds--;if(seconds<0)seconds=0},4000);
let toastTimer;function showToast(t){const el=document.getElementById('toast');el.textContent=t;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
document.getElementById('locate').onclick=()=>document.getElementById('cityModal').classList.add('open');document.getElementById('closeModal').onclick=()=>document.getElementById('cityModal').classList.remove('open');
document.getElementById('searchCity').onclick=searchCity;document.getElementById('cityInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchCity()});
async function searchCity(){const q=document.getElementById('cityInput').value.trim();if(!q)return;const out=document.getElementById('cityResults');out.textContent='Recherche…';try{const url='https://nominatim.openstreetmap.org/search?format=json&limit=5&q='+encodeURIComponent(q);const r=await fetch(url);const data=await r.json();out.innerHTML='';if(!data.length){out.textContent='Aucun résultat';return}data.forEach(d=>{const el=document.createElement('div');el.className='city-result';el.textContent=d.display_name;el.onclick=()=>{player=L.latLng(+d.lat,+d.lon);initialCenter=player;map.setView(player,16);playerMarker.setLatLng(player);bots.forEach(b=>map.removeLayer(b.marker));loot.forEach(l=>map.removeLayer(l));bots=[];loot=[];spawn();makeZone();document.getElementById('cityModal').classList.remove('open');showToast('Départ déplacé : '+d.name)};out.appendChild(el)})}catch(e){out.textContent='Recherche indisponible. Réessaie.'}}
map.on('move',()=>{player=map.getCenter();playerMarker.setLatLng(player)});
showToast('Carte réelle chargée — WASD pour se déplacer');
