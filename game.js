/* JUJU BR — isometric world prototype built from OpenStreetMap road/building geometry. */
const map=L.map('map',{zoomControl:false,worldCopyJump:true,preferCanvas:true}).setView([35.6971,-0.6308],17);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
const canvas=document.createElement('canvas');canvas.id='isoWorld';document.body.appendChild(canvas);const ctx=canvas.getContext('2d');
let player=map.getCenter(),zoneCenter=player,bots=[],loot=[],buildingPolys=[],roadLines=[],obstacles=[],eliminations=0,health=100,zoneRadius=2500,zoneCircle,inventory=0,gameEnded=false,countdown=120,interior=null;
const keys={};let walkCycle=0,heading=0,worldLoaded=false,fetchTimer,lastQuery='',toastTimer;
const scale=3.1; // screen pixels per local metre
function resize(){const d=Math.min(devicePixelRatio||1,2);canvas.width=innerWidth*d;canvas.height=innerHeight*d;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(d,0,0,d,0,0);render()}
window.addEventListener('resize',resize);
function local(p,origin=player){const lat=(p.lat-origin.lat)*111320,lng=(p.lng-origin.lng)*111320*Math.cos(origin.lat*Math.PI/180);return{lng:lng, north:lat}}
function project(p){const q=local(p);const z=scale*Math.pow(2,map.getZoom()-17);return{x:innerWidth/2+(q.lng-q.north)*z*.72,y:innerHeight/2+(q.lng+q.north)*z*.38}}
function unprojectScreen(dx,dy){const z=scale*Math.pow(2,map.getZoom()-17),a=dx/(z*.72),b=dy/(z*.38);const east=(a+b)/2,north=(b-a)/2;return L.latLng(player.lat+north/111320,player.lng+east/(111320*Math.cos(player.lat*Math.PI/180)))}
function distance(a,b){const q=local(b,a);return Math.hypot(q.lng,q.north)}
function offset(p,east,north){return L.latLng(p.lat+north/111320,p.lng+east/(111320*Math.cos(p.lat*Math.PI/180)))}
function pointInPoly(p,poly){const q=local(p),pts=poly.map(v=>local(L.latLng(v[0],v[1])));let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if(((a.north>q.north)!==(b.north>q.north))&&(q.lng<(b.lng-a.lng)*(q.north-a.north)/(b.north-a.north+1e-12)+a.lng))inside=!inside}return inside}
function isBlocked(p){return buildingPolys.some(poly=>pointInPoly(p,poly))||obstacles.some(o=>distance(p,o)<12)}
function path(points){if(!points.length)return;const p=points.map(v=>project(L.latLng(v[0],v[1])));ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);p.slice(1).forEach(v=>ctx.lineTo(v.x,v.y))}
function renderGround(){ctx.fillStyle='#17252a';ctx.fillRect(0,0,innerWidth,innerHeight);
 // iso terrain grid gives a clear game-world plane
 ctx.strokeStyle='#294047';ctx.lineWidth=1;const spacing=90;for(let x=-innerWidth;x<innerWidth*2;x+=spacing){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+innerHeight*.72,innerHeight);ctx.stroke()}for(let x=-innerWidth;x<innerWidth*2;x+=spacing){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-innerHeight*.72,innerHeight);ctx.stroke()}
 // mapped OSM roads become iso ground paths
 roadLines.forEach(road=>{path(road);ctx.strokeStyle='#47565b';ctx.lineWidth=road.width||7;ctx.lineCap='round';ctx.stroke();ctx.strokeStyle='#9a9a8870';ctx.lineWidth=1.2;ctx.stroke()});
}
function drawBuilding(poly,index){const pts=poly.map(v=>project(L.latLng(v[0],v[1])));if(pts.length<3)return;const center=pts.reduce((a,p)=>({x:a.x+p.x/pts.length,y:a.y+p.y/pts.length}),{x:0,y:0});const h=8+Math.abs(Math.sin(index*8.12))*17,dx=h*.8,dy=-h*.85;
 // ground shadow
 ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x+4,p.y+7):ctx.moveTo(p.x+4,p.y+7));ctx.closePath();ctx.fillStyle='#07101280';ctx.fill();
 // side faces
 for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(b.x+dx,b.y+dy);ctx.lineTo(a.x+dx,a.y+dy);ctx.closePath();ctx.fillStyle=(i%2)?'#435a62':'#354b53';ctx.strokeStyle='#172a30';ctx.lineWidth=1;ctx.fill();ctx.stroke()}
 ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x+dx,p.y+dy):ctx.moveTo(p.x+dx,p.y+dy));ctx.closePath();ctx.fillStyle=index%3===0?'#82959a':'#6b8188';ctx.strokeStyle='#b9c9c8';ctx.lineWidth=1.2;ctx.fill();ctx.stroke();
 // rooftop small details
 ctx.fillStyle='#455c63';ctx.fillRect(center.x+dx-3,center.y+dy-3,7,5);
}
function drawAvatar(p,color,cycle,face,playerChar=false){
 const moving=playerChar&&(keys.w||keys.a||keys.s||keys.d||keys.arrowup||keys.arrowdown||keys.arrowleft||keys.arrowright),step=moving?Math.sin(cycle)*3.4:0,bob=moving?Math.abs(Math.sin(cycle*2))*1.5:0;
 ctx.save();ctx.translate(p.x,p.y+bob);
 ctx.fillStyle='#050b1080';ctx.beginPath();ctx.ellipse(0,12,12,5,0,0,Math.PI*2);ctx.fill();
 // backpack, articulated legs, jacket, head and direction detail
 ctx.fillStyle='#263744';ctx.roundRect(-9,-1,18,15,4);ctx.fill();
 ctx.fillStyle='#16242d';ctx.roundRect(-6,8,5,10+step,2);ctx.roundRect(2,8,5,10-step,2);ctx.fill();
 ctx.fillStyle=color;ctx.roundRect(-8,-3,16,13,4);ctx.fill();
 ctx.fillStyle='#d8f4ff';ctx.fillRect(-1,-1,2,8);
 ctx.fillStyle='#efc39f';ctx.beginPath();ctx.arc(0,-9,6.5,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#29313a';ctx.beginPath();ctx.arc(0,-11,6.5,Math.PI,Math.PI*2);ctx.fill();
 ctx.fillStyle='#f5fbff';ctx.fillRect(face===1?4:-7,-5,3,2);
 ctx.fillStyle='#152936';ctx.roundRect(-10,-1,3,8,2);ctx.roundRect(7,-1,3,8,2);ctx.fill();
 ctx.strokeStyle='#e7fbff';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,1,9,0,Math.PI*2);ctx.stroke();ctx.restore()
}
function drawLoot(o){const p=project(o.pos);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.fillStyle='#ffd15c';ctx.shadowColor='#ffd15c';ctx.shadowBlur=12;ctx.fillRect(-5,-5,10,10);ctx.restore()}
function drawInterior(){
 const w=Math.min(innerWidth-70,760),h=Math.min(innerHeight-150,520),x=(innerWidth-w)/2,y=(innerHeight-h)/2;
 ctx.fillStyle='#080e14';ctx.fillRect(0,0,innerWidth,innerHeight);
 ctx.fillStyle='#b7a58b';ctx.fillRect(x,y,w,h);ctx.fillStyle='#ddc9a8';ctx.fillRect(x+12,y+12,w-24,h-24);
 // parquet/floor pattern
 ctx.strokeStyle='#c5b18e';ctx.lineWidth=1;for(let yy=y+22;yy<y+h-20;yy+=24){ctx.beginPath();ctx.moveTo(x+16,yy);ctx.lineTo(x+w-16,yy);ctx.stroke()}
 for(let xx=x+22;xx<x+w-18;xx+=48){ctx.beginPath();ctx.moveTo(xx,y+16);ctx.lineTo(xx,y+h-16);ctx.stroke()}
 // walls with room dividers, doors, windows
 ctx.fillStyle='#665747';ctx.fillRect(x,y,w,16);ctx.fillRect(x,y+h-16,w,16);ctx.fillRect(x,y,16,h);ctx.fillRect(x+w-16,y,16,h);
 ctx.fillStyle='#8b7761';ctx.fillRect(x+w*.48,y+16,12,h*.36);ctx.fillRect(x+w*.48,y+h*.58,12,h*.4);
 ctx.fillStyle='#bfe9f6';ctx.fillRect(x+38,y+5,90,6);ctx.fillRect(x+w-130,y+5,90,6);
 // furniture, layout varies deterministically with building index
 const variant=interior.index%4;
 ctx.fillStyle='#76533a';ctx.fillRect(x+40,y+45,w*.24,h*.18);ctx.fillStyle='#a98a65';ctx.fillRect(x+46,y+51,w*.24-12,h*.18-12);
 ctx.fillStyle='#5c6e70';ctx.fillRect(x+w*.65,y+42,w*.23,44);ctx.fillStyle='#879a9a';ctx.fillRect(x+w*.65+6,y+48,w*.23-12,32);
 ctx.fillStyle='#6a4a31';ctx.fillRect(x+40,y+h*.65,w*.2,18);ctx.fillRect(x+40,y+h*.65+18,8,20);ctx.fillRect(x+w*.75,y+h*.68,22,22);
 if(variant===1||variant===3){ctx.fillStyle='#6d5843';ctx.fillRect(x+w*.28,y+h*.42,60,26);ctx.fillStyle='#9d866b';ctx.fillRect(x+w*.28+5,y+h*.42+5,50,16)}
 if(variant===2){ctx.fillStyle='#3b5b68';ctx.fillRect(x+w*.72,y+h*.35,44,64);ctx.fillStyle='#d4e9ed';ctx.fillRect(x+w*.72+7,y+h*.35+8,30,48)}
 // door/exit marker and top-down player sprite
 ctx.fillStyle='#2d8c77';ctx.fillRect(x+w*.48-4,y+h-16,30,16);ctx.fillStyle='#dffcf5';ctx.font='bold 12px system-ui';ctx.fillText('F  SORTIR',x+w*.48-20,y+h+20);
 ctx.fillStyle='#f2e4cc';ctx.font='bold 16px system-ui';ctx.fillText('INTÉRIEUR • '+(variant===0?'APPARTEMENT':variant===1?'MAISON':'LOCAL'),x+24,y+35);
 drawAvatar({x:innerWidth/2,y:innerHeight/2+8},'#38a9ef',walkCycle,heading,true);
 ctx.fillStyle='#d7e9f4';ctx.font='12px system-ui';ctx.fillText('WASD : se déplacer  •  F : sortir',20,innerHeight-26);
}
function render(){if(!ctx)return;if(interior){drawInterior();return}renderGround();
 // painter order by screen depth: road/buildings, loot, bots, player
 const structures=buildingPolys.map((poly,i)=>({poly,i,y:poly.reduce((s,v)=>s+project(L.latLng(v[0],v[1])).y,0)/poly.length})).sort((a,b)=>a.y-b.y);
 structures.forEach(o=>drawBuilding(o.poly,o.i));loot.forEach(drawLoot);bots.forEach((b,i)=>drawAvatar(project(b.pos),'#f35d70',walkCycle*.4,i%4,false));drawAvatar(project(player),'#31a8ee',walkCycle,heading,true);
 const px=innerWidth/2,py=innerHeight/2;ctx.strokeStyle='#50e4bf';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py,22,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#e7fbff';ctx.beginPath();ctx.arc(px,py,2.5,0,Math.PI*2);ctx.fill();
}
function nearestBuilding(){let best=-1,dist=Infinity;buildingPolys.forEach((poly,i)=>{const c=poly.reduce((a,v)=>({lat:a.lat+v[0]/poly.length,lng:a.lng+v[1]/poly.length}),{lat:0,lng:0});const d=distance(player,L.latLng(c.lat,c.lng));if(d<dist){dist=d;best=i}});return{index:best,distance:dist}}
function toggleInterior(){if(interior){interior=null;player=offset(player,35,0);toast('Sortie du bâtiment');render();return}const n=nearestBuilding();if(n.index>=0&&n.distance<65){interior={index:n.index,roomX:0,roomY:0};toast('Entrée — F pour ressortir');render()}else toast('Approche d’un bâtiment pour entrer')}
function makeZone(){if(zoneCircle)map.removeLayer(zoneCircle);zoneCircle=L.circle(zoneCenter,{radius:zoneRadius,color:'#35e5b4',weight:2,fillColor:'#35e5b4',fillOpacity:.04,dashArray:'8 8'}).addTo(map)}
function toast(m){const el=document.getElementById('toast');el.textContent=m;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
async function loadWorld(){if(map.getZoom()<15){toast('Zoom pour charger les routes et bâtiments');return}const bounds=map.getBounds(),bbox=[bounds.getSouth(),bounds.getWest(),bounds.getNorth(),bounds.getEast()].join(','),key=bbox;if(key===lastQuery)return;lastQuery=key;
 const query='[out:json][timeout:20];(way[building]('+bbox+');way[highway]('+bbox+'););out geom;';
 try{const resp=await fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(query));if(!resp.ok)throw Error('Overpass');const data=await resp.json();buildingPolys=[];roadLines=[];obstacles=[];for(const way of data.elements||[]){if(!way.geometry||way.geometry.length<2)continue;const coords=way.geometry.map(p=>[p.lat,p.lon]);if(way.tags?.building&&coords.length>=4)buildingPolys.push(coords);else if(way.tags?.highway){roadLines.push(coords);const w=way.tags.highway==='footway'||way.tags.highway==='path'?3:way.tags.highway==='primary'||way.tags.highway==='trunk'?13:8;roadLines[roadLines.length-1].width=w}}
 worldLoaded=true;render();toast('Carte isométrique chargée • '+buildingPolys.length+' bâtiments / '+roadLines.length+' routes')}
 catch(e){toast('Données OSM momentanément indisponibles');render()}}
map.on('moveend zoomend',()=>{clearTimeout(fetchTimer);fetchTimer=setTimeout(loadWorld,700)});loadWorld();
function spawn(){for(let i=0;i<12;i++)bots.push({pos:offset(player,...randomOffset(900))});for(let i=0;i<18;i++)loot.push({pos:offset(player,...randomOffset(700))})}
function randomOffset(r){const a=Math.random()*Math.PI*2,d=Math.sqrt(Math.random())*r;return[Math.cos(a)*d,Math.sin(a)*d]}
spawn();resize();
function move(dir){keys[dir]=true}
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e','q','f'].includes(k)){e.preventDefault();keys[k]=true;if(k==='e'&&!e.repeat&&!interior)collect();if(k==='q'&&!e.repeat&&!interior)arcadeAction();if(k==='f'&&!e.repeat)toggleInterior()}if(k==='+'||k==='=')map.zoomIn();if(k==='-')map.zoomOut()});window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);window.addEventListener('blur',()=>Object.keys(keys).forEach(k=>keys[k]=false));
document.querySelectorAll('.mobile-pad button').forEach(btn=>{const key={up:'w',left:'a',down:'s',right:'d'}[btn.dataset.dir];btn.addEventListener('pointerdown',e=>{e.preventDefault();keys[key]=true;btn.setPointerCapture(e.pointerId)});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,()=>keys[key]=false))});
let lastFrame=0;function loop(ts){if(!gameEnded&&ts-lastFrame>25){lastFrame=ts;let east=0,north=0;if(keys.w||keys.arrowup)north=1;if(keys.s||keys.arrowdown)north=-1;if(keys.a||keys.arrowleft)east=-1;if(keys.d||keys.arrowright)east=1;if(east||north){walkCycle+=.28;heading=east?east>0?1:3:north>0?0:2;const len=Math.hypot(east,north),speed=4.2;if(interior){interior.roomX=Math.max(-1,Math.min(1,interior.roomX+east/len*.045));interior.roomY=Math.max(-1,Math.min(1,interior.roomY+north/len*.045));render()}else{const candidate=offset(player,east/len*speed,north/len*speed);if(!isBlocked(candidate)){player=candidate;map.panTo(player,{animate:false});render()}else toast('Obstacle — contourne le bâtiment')}}else render()}requestAnimationFrame(loop)}requestAnimationFrame(loop);
function collect(){let best=-1,near=1e9;loot.forEach((o,i)=>{const d=distance(player,o.pos);if(d<near){near=d;best=i}});if(best>=0&&near<35){loot.splice(best,1);inventory++;const slots=document.querySelectorAll('.inventory .slot');if(inventory<=slots.length){slots[inventory-1].textContent='✦';slots[inventory-1].classList.add('active')}toast('Objet ramassé');render()}else toast('Approche un objet puis appuie E')}
function arcadeAction(){if(gameEnded)return;let ix=-1,min=1e9;bots.forEach((b,i)=>{const d=distance(player,b.pos);if(d<min){min=d;ix=i}});if(ix>=0&&min<95){bots.splice(ix,1);eliminations++;document.getElementById('kills').textContent=eliminations;toast('Bot retiré du match — action réussie')}else toast('Action effectuée — aucun bot à proximité');render()}
document.getElementById('actionBtn').onclick=arcadeAction;
setInterval(()=>{if(gameEnded)return;countdown--;if(countdown<=0){zoneRadius=Math.max(180,zoneRadius-220);zoneCircle.setRadius(zoneRadius);countdown=30;toast('Zone sûre qui rétrécit')}document.getElementById('clock').textContent=String(Math.floor(countdown/60)).padStart(2,'0')+':'+String(countdown%60).padStart(2,'0');document.getElementById('zoneLabel').textContent=Math.round(zoneRadius/2500*100)+'%';if(distance(player,zoneCenter)>zoneRadius){health=Math.max(0,health-2);updateHealth();document.getElementById('zoneStatus').textContent='Hors zone — énergie diminue';if(health<=0)finish('Tu es resté hors de la zone sûre')}},1000);
setInterval(()=>{if(gameEnded)return;bots.forEach(b=>{const [e,n]=randomOffset(16),p=offset(b.pos,e,n);if(!isBlocked(p))b.pos=p});document.getElementById('players').textContent=Math.max(1,bots.length+1);render()},2300);
function updateHealth(){document.querySelector('.health .bar i').style.width=health+'%';document.querySelector('.health b').textContent=health}
function finish(m){gameEnded=true;document.getElementById('gameOverText').textContent=m;document.getElementById('gameOver').classList.add('show')}
document.getElementById('restart').onclick=()=>location.reload();document.getElementById('locate').onclick=()=>document.getElementById('cityModal').classList.add('open');document.getElementById('closeModal').onclick=()=>document.getElementById('cityModal').classList.remove('open');document.getElementById('searchCity').onclick=searchCity;document.getElementById('cityInput').addEventListener('keydown',e=>{if(e.key==='Enter')searchCity()});
async function searchCity(){const q=document.getElementById('cityInput').value.trim();if(!q)return;const box=document.getElementById('cityResults');box.textContent='Recherche…';try{const resp=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&q='+encodeURIComponent(q));const data=await resp.json();box.replaceChildren();if(!data.length){box.textContent='Aucun résultat';return}data.forEach(p=>{const btn=document.createElement('button');btn.className='city-result';btn.textContent=p.display_name;btn.onclick=()=>startCity(+p.lat,+p.lon,p.display_name);box.appendChild(btn)})}catch{box.textContent='Recherche indisponible'}}
function startCity(lat,lon,name){interior=null;player=L.latLng(lat,lon);zoneCenter=player;map.setView(player,17);bots=[];loot=[];spawn();zoneRadius=2500;countdown=120;health=100;inventory=0;eliminations=0;document.getElementById('kills').textContent='0';document.querySelectorAll('.inventory .slot').forEach(s=>{s.textContent='＋';s.classList.remove('active')});updateHealth();makeZone();buildingPolys=[];roadLines=[];lastQuery='';loadWorld();document.getElementById('cityModal').classList.remove('open');document.getElementById('gameOver').classList.remove('show');gameEnded=false;render();toast('Nouvelle zone: '+name)}
render();toast('Monde isométrique prêt — recherche des données réelles');
