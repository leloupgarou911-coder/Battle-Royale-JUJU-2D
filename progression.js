/* JUJU WORLD progression layer: multi-slot local saves, autosave, profile and real UI language toggle. */
(() => {
  'use strict';
  const SAVE_KEY = 'juju-world-saves-v2';
  const PROFILE_KEY = 'juju-world-profile-v1';
  const LANGUAGE_KEY = 'juju-language-v1';
  const MAX_SLOTS = 6;
  let activeSlotId = 'slot-1';
  const $ = (selector) => document.querySelector(selector);
  const safeRead = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  let language = safeRead(LANGUAGE_KEY) === 'en' ? 'en' : 'fr';
  let lastEliminations = 0;
  let lastAutoSaveAt = 0;
  let sessionStartedAt = Date.now();
  const safeWrite = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };
  const cloneButton = (id, handler) => {
    const old = document.getElementById(id);
    if (!old) return;
    const replacement = old.cloneNode(true);
    old.replaceWith(replacement);
    replacement.addEventListener('click', handler);
  };
  const getProfile = () => {
    try {
      const p = JSON.parse(safeRead(PROFILE_KEY) || '{}');
      return { matchesStarted: Number(p.matchesStarted)||0, totalEliminations: Number(p.totalEliminations)||0, manualSaves: Number(p.manualSaves)||0, playSeconds: Number(p.playSeconds)||0 };
    } catch { return { matchesStarted:0,totalEliminations:0,manualSaves:0,playSeconds:0 }; }
  };
  const setProfile = (p) => safeWrite(PROFILE_KEY, JSON.stringify(p));
  function readSlots() {
    try {
      const parsed = JSON.parse(safeRead(SAVE_KEY) || 'null');
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_SLOTS);
    } catch {}
    const legacy = safeRead('juju-world-save-v1');
    const slots = Array.from({length:MAX_SLOTS}, (_,i)=>({id:'slot-'+(i+1),name:'Emplacement '+(i+1),savedAt:null,data:null}));
    if (legacy) {
      try { const data=JSON.parse(legacy); if(data && data.player) slots[0]={...slots[0],savedAt:data.savedAt||new Date().toISOString(),data}; } catch {}
    }
    writeSlots(slots);
    return slots;
  }
  function writeSlots(slots) { return safeWrite(SAVE_KEY, JSON.stringify(slots)); }
  function snapshotGame() {
    return {
      version:2, savedAt:new Date().toISOString(),
      player:{lat:player.lat,lng:player.lng},
      zoneCenter:{lat:zoneCenter.lat,lng:zoneCenter.lng},
      mapCenter:{lat:map.getCenter().lat,lng:map.getCenter().lng}, mapZoom:map.getZoom(),
      bots:bots.map(b=>({pos:{lat:b.pos.lat,lng:b.pos.lng},health:b.health,insideBuilding:b.insideBuilding,floor:b.floor})),
      loot:loot.map(o=>({lat:o.pos.lat,lng:o.pos.lng,type:itemCatalog[o.type]?o.type:'bandage'})),
      health,inventory,eliminations,zoneRadius,countdown,
      equipment:Array.isArray(equipment)?equipment.map(v=>itemCatalog[v]?v:null):Array(6).fill(null),
      selectedSlot,waypoint:waypoint?{lat:waypoint.lat,lng:waypoint.lng}:null,
      locationName:window.jujuLocationName||'Lieu personnalisé'
    };
  }
  function notify(message) {
    if (document.body.classList.contains('game-active') && typeof toast === 'function') toast(message);
    else if (typeof showHomeNotice === 'function') showHomeNotice(message);
  }
  function saveToSlot(id, automatic=false) {
    if (!document.body.classList.contains('game-active')) { if(!automatic) notify('Lance une partie avant de la sauvegarder.'); return false; }
    const slots=readSlots(), index=slots.findIndex(s=>s.id===id);
    if(index<0) return false;
    const data=snapshotGame();
    slots[index]={...slots[index],savedAt:data.savedAt,data};
    if(!writeSlots(slots)){const msg='Sauvegarde impossible : stockage local saturé ou indisponible.';if($('#saveLibraryModal')?.classList.contains('open'))$('#saveLibraryFeedback').textContent=msg;else notify(msg);return false;}
    activeSlotId=id;
    if(!automatic){
      const p=getProfile();p.manualSaves++;setProfile(p);
      const msg=language==='fr'?'Partie sauvegardée dans '+slots[index].name+'.':'Game saved to '+slots[index].name+'.';
      if($('#saveLibraryModal')?.classList.contains('open'))$('#saveLibraryFeedback').textContent=msg;else notify(msg);
    }
    lastAutoSaveAt=Date.now();
    return true;
  }
  function validSnapshot(s) {
    return !!(s && (s.version===1 || s.version===2) && s.player && Number.isFinite(s.player.lat) && Number.isFinite(s.player.lng) && Math.abs(s.player.lat)<=90 && Math.abs(s.player.lng)<=180);
  }
  function loadSlot(id) {
    const slot=readSlots().find(s=>s.id===id);
    if(!slot || !validSnapshot(slot.data)){notify('Cet emplacement ne contient aucune sauvegarde valide.');return;}
    if(document.body.classList.contains('game-active')&&activeSlotId!==id)saveToSlot(activeSlotId,true);
    const s=slot.data;
    try {
      player=L.latLng(s.player.lat,s.player.lng);
      zoneCenter=L.latLng(s.zoneCenter?.lat??s.player.lat,s.zoneCenter?.lng??s.player.lng);
      bots=(Array.isArray(s.bots)?s.bots.slice(0,100):[]).map(b=>{const p=b?.pos||b;return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180?{pos:L.latLng(p.lat,p.lng),health:b.health}:null;}).filter(Boolean);
      loot=(Array.isArray(s.loot)?s.loot.slice(0,2000):[]).filter(o=>o&&Number.isFinite(o.lat)&&Number.isFinite(o.lng)&&Math.abs(o.lat)<=90&&Math.abs(o.lng)<=180).map(o=>({pos:L.latLng(o.lat,o.lng),type:itemCatalog[o.type]?o.type:'bandage'}));
      const savedHealth=Number(s.health);health=Number.isFinite(savedHealth)?Math.max(0,Math.min(100,savedHealth)):100;
      inventory=Math.max(0,Math.min(10000,Number(s.inventory)||0));
      equipment=Array.isArray(s.equipment)?s.equipment.slice(0,6).map(v=>itemCatalog[v]?v:null):Array(6).fill(null);
      while(equipment.length<6)equipment.push(null);
      selectedSlot=Math.max(0,Math.min(5,Number(s.selectedSlot)||0));
      waypoint=s.waypoint&&Number.isFinite(s.waypoint.lat)&&Number.isFinite(s.waypoint.lng)?L.latLng(s.waypoint.lat,s.waypoint.lng):null;
      eliminations=Math.max(0,Number(s.eliminations)||0);
      const savedRadius=Number(s.zoneRadius);zoneRadius=Number.isFinite(savedRadius)?Math.max(100,Math.min(100000,savedRadius)):2500;
      const savedCountdown=Number(s.countdown);countdown=Number.isFinite(savedCountdown)?Math.max(0,Math.min(86400,savedCountdown)):120;
      interior=null;gameEnded=false;worldLoaded=false;lastQuery='';
      const center=s.mapCenter&&Number.isFinite(s.mapCenter.lat)&&Number.isFinite(s.mapCenter.lng)?[s.mapCenter.lat,s.mapCenter.lng]:[player.lat,player.lng];
      map.setView(center,Math.max(15,Math.min(19,Number(s.mapZoom)||17)));
      document.body.classList.remove('home-active');document.body.classList.add('game-active');
      $('#cityModal')?.classList.remove('open');$('#gameOver')?.classList.remove('show');$('#saveLibraryModal')?.classList.remove('open');
      $('#kills').textContent=String(eliminations);$('#players').textContent=String(bots.length+1);
      updateInventoryUI();updateHealth();makeZone();render();scheduleGameLoop();
      activeSlotId=id;lastEliminations=eliminations;
      requestAnimationFrame(()=>{if(document.body.classList.contains('game-active')){loadWorld(true);loadElevation();}});
      notify('Sauvegarde chargée : '+slot.name+'.');
    } catch(error) { console.error('Save load failed',error);notify('Cette sauvegarde est endommagée ou incompatible.'); }
  }
  function openLibrary() { renderLibrary();$('#saveLibraryModal').classList.add('open'); }
  function renderLibrary() {
    const container=$('#saveSlots');if(!container)return;container.replaceChildren();
    const feedback=$('#saveLibraryFeedback');if(feedback)feedback.textContent='';
    readSlots().forEach(slot=>{
      const row=document.createElement('section');row.className='save-slot';
      const info=document.createElement('div');const title=document.createElement('strong');title.textContent=slot.name;
      const detail=document.createElement('small');detail.textContent=slot.data?((language==='fr'?'Dernière sauvegarde : ':'Last saved: ')+new Date(slot.savedAt||slot.data.savedAt).toLocaleString()+' · '+(slot.data.locationName||'Lieu personnalisé')):(language==='fr'?'Emplacement vide':'Empty slot');
      info.append(title,detail);
      const actions=document.createElement('div');actions.className='save-slot-actions';
      const save=document.createElement('button');save.textContent=slot.data?(language==='fr'?'Écraser':'Overwrite'):(language==='fr'?'Sauvegarder ici':'Save here');save.className='primary';save.addEventListener('click',()=>{if(saveToSlot(slot.id)){renderLibrary();}});
      const load=document.createElement('button');load.textContent=language==='fr'?'Charger':'Load';load.disabled=!validSnapshot(slot.data);load.addEventListener('click',()=>loadSlot(slot.id));
      const remove=document.createElement('button');remove.textContent=language==='fr'?'Supprimer':'Delete';remove.className='danger';remove.disabled=!slot.data;remove.addEventListener('click',()=>{if(!confirm('Supprimer '+slot.name+' ?'))return;const all=readSlots();const target=all.find(x=>x.id===slot.id);if(target){target.data=null;target.savedAt=null;writeSlots(all);renderLibrary();}});
      actions.append(save,load,remove);row.append(info,actions);container.append(row);
    });
  }
  function exportBackup() {
    const payload={format:'juju-world-backup',version:1,exportedAt:new Date().toISOString(),slots:readSlots()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='juju-world-saves-backup.json';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
    notify('Fichier de sauvegarde exporté.');
  }
  async function importBackup(file) {
    if(!file)return;
    if(file.size>5*1024*1024){notify('Fichier trop volumineux (maximum 5 Mo).');return;}
    try {
      const payload=JSON.parse(await file.text());
      if(payload?.format!=='juju-world-backup'||!Array.isArray(payload.slots))throw Error('Invalid backup');
      const imported=payload.slots.slice(0,MAX_SLOTS).map((slot,i)=>({
        id:'slot-'+(i+1),name:'Emplacement '+(i+1),
        savedAt:slot.savedAt||slot.data?.savedAt||null,
        data:validSnapshot(slot.data)?slot.data:null
      }));
      while(imported.length<MAX_SLOTS)imported.push({id:'slot-'+(imported.length+1),name:'Emplacement '+(imported.length+1),savedAt:null,data:null});
      if(!writeSlots(imported))throw Error('Storage unavailable');
      activeSlotId='slot-1';renderLibrary();notify('Sauvegardes importées sur cet appareil.');
    } catch(error) { console.error('Save import failed',error);notify('Fichier invalide ou stockage indisponible.'); }
  }
  function addSlot() {
    const slots=readSlots(),free=slots.find(s=>!s.data);
    if(!free){notify('Les six emplacements sont utilisés. Supprime ou écrase une sauvegarde.');return;}
    if(document.body.classList.contains('game-active'))saveToSlot(free.id);
    else {free.savedAt=null;writeSlots(slots);notify('Nouvel emplacement prêt : '+free.name+'.');}
    renderLibrary();
  }
  function openProfile() {
    const p=getProfile(),hours=Math.floor(p.playSeconds/3600),minutes=Math.floor((p.playSeconds%3600)/60);
    $('#profileStats').innerHTML='';
    const stats=language==='fr'?[['Parties lancées',p.matchesStarted],['Éliminations',p.totalEliminations],['Sauvegardes manuelles',p.manualSaves],['Temps de jeu',hours+' h '+minutes+' min']]:[['Matches started',p.matchesStarted],['Eliminations',p.totalEliminations],['Manual saves',p.manualSaves],['Play time',hours+' h '+minutes+' min']];
    stats.forEach(([label,value])=>{const card=document.createElement('div');card.className='profile-stat';const b=document.createElement('b');b.textContent=String(value);const span=document.createElement('span');span.textContent=label;card.append(b,span);$('#profileStats').append(card);});
    $('#profileModal').classList.add('open');
  }

  const translations = {
    fr:{
      'home-header':'JUJU WORLD','eyebrow':'LE MONDE T’ATTEND','home-title':'TON MONDE.\nTON AVENTURE.','home-desc':'Explore des lieux réels, découvre de nouvelles villes et crée ton propre parcours sur une carte vivante.','play':'JOUER','play-sub':'COMMENCER L’EXPLORATION','saves':'MES SAUVEGARDES','settings':'⚙ PARAMÈTRES','profile':'◉ PROFIL & PROGRESSION','world-explorer':'EXPLORATEUR DU MONDE','one-planet':'UNE PLANÈTE','endless':'DES LIEUX INFINIS','global-map':'CARTE MONDIALE','open-world':'EXPÉRIENCE MONDE OUVERT',
      'players':'JOUEURS','zone':'ZONE','kills':'ÉLIMINATIONS','equipment':'ÉQUIPEMENT','inventory':'INVENTAIRE','inventory-help':'1–6 équiper · G jeter','objective':'OBJECTIF','objective-text':'Reste dans la zone sûre. Explore la carte et récupère les objets.','safe-zone':'ZONE SÛRE','zone-status':'La zone se réduit bientôt','no-waypoint':'Aucun repère','clear-waypoint':'Effacer le repère','environment':'ENVIRONNEMENT','energy':'ÉNERGIE','action':'ACTION','save':'SAUVEGARDER','city':'⌖ VILLE','choose-city':'Choisir un lieu de départ','city-help':'Recherche une ville réelle pour lancer la partie.','search':'Rechercher','pick-map':'Choisir directement sur la carte','settings-title':'Paramètres','keyboard':'Disposition du clavier','autosave':'Sauvegarde automatique','save-settings':'Enregistrer les paramètres','save-title':'Mes sauvegardes','save-hint':'Choisis un emplacement pour charger, enregistrer ou supprimer une partie.','profile-title':'Profil & progression'
    },
    en:{
      'home-header':'JUJU WORLD','eyebrow':'THE WORLD IS WAITING','home-title':'YOUR WORLD.\nYOUR ADVENTURE.','home-desc':'Explore real places, discover new cities and create your own journey across a living world map.','play':'PLAY','play-sub':'START EXPLORING','saves':'MY SAVES','settings':'⚙ SETTINGS','profile':'◉ PROFILE & PROGRESSION','world-explorer':'WORLD EXPLORER','one-planet':'ONE PLANET','endless':'ENDLESS PLACES','global-map':'GLOBAL MAP','open-world':'OPEN WORLD EXPERIENCE',
      'players':'PLAYERS','zone':'ZONE','kills':'ELIMINATIONS','equipment':'EQUIPMENT','inventory':'INVENTORY','inventory-help':'1–6 equip · G drop','objective':'OBJECTIVE','objective-text':'Stay in the safe zone. Explore the map and collect items.','safe-zone':'SAFE ZONE','zone-status':'The zone will shrink soon','no-waypoint':'No waypoint','clear-waypoint':'Clear waypoint','environment':'ENVIRONMENT','energy':'ENERGY','action':'ACTION','save':'SAVE GAME','city':'⌖ CITY','choose-city':'Choose a starting location','city-help':'Search for a real city to start the game.','search':'Search','pick-map':'Pick a point directly on the map','settings-title':'Settings','keyboard':'Keyboard layout','autosave':'Automatic saving','save-settings':'Save settings','save-title':'My saves','save-hint':'Choose a slot to load, save or delete a game.','profile-title':'Profile & progression'
    }
  };
  function applyLanguage() {
    const t=translations[language],set=(selector,key)=>{const el=$(selector);if(el&&t[key]!==undefined)el.textContent=t[key];};
    document.documentElement.lang=language;
    set('.eyebrow','eyebrow');set('.home-copy h1','home-title');set('.home-copy>p','home-desc');
    const itemNames=language==='fr'?{bandage:'Bandage',medkit:'Kit de soin',water:'Eau',food:'Ravitaillement',battery:'Batterie',map:'Fragment de carte'}:{bandage:'Bandage',medkit:'Medkit',water:'Water',food:'Supplies',battery:'Battery',map:'Map fragment'};Object.keys(itemNames).forEach(k=>{if(itemCatalog[k])itemCatalog[k].name=itemNames[k];});
    const playButton=$('#playBtn');if(playButton)playButton.innerHTML='<span>▶</span> '+t.play+' <small>'+t['play-sub']+'</small>';
    set('#savesBtn','saves');set('#settingsBtn','settings');set('#profileBtn','profile');
    set('.card-top span','world-explorer');set('.world-caption small','one-planet');set('.world-caption b','endless');set('.card-bottom span:first-child','global-map');set('.card-bottom span:last-child','open-world');
    const statLabels=$$('.stats small');['players','zone','kills'].forEach((k,i)=>{if(statLabels[i])statLabels[i].textContent=t[k];});
    const panels=$$('.left-panel .panel-title');['equipment','inventory','objective'].forEach((k,i)=>{if(panels[i])panels[i].textContent=t[k];});
    set('.inventory-help','inventory-help');set('.left-panel>p','objective-text');
    const weaponTitle=$('.weapon b'),weaponSub=$('.weapon small');if(weaponTitle)weaponTitle.textContent=language==='fr'?'Équipement de départ':'Starting equipment';if(weaponSub)weaponSub.textContent=language==='fr'?'Mode prototype':'Prototype mode';
    const env=Array.from(document.querySelectorAll('.right-panel p'));const envFr=['Routes : déplacement accéléré','Forêts : déplacement ralenti','Pentes : vitesse adaptée au relief','Rivières : traversée par les ponts OSM','Tunnels : tracés différenciés','Altitude : Copernicus DEM (90 m)','Bâtiments : formes OSM, étages et hauteurs lorsqu’ils sont renseignés','Patios : cours intérieures des bâtiments multipolygones','Voies ferrées : tracés cartographiques détaillés','Arbres OSM : végétation ponctuelle dessinée','Trottoirs et chemins : tracés piétons visibles','Parkings : surfaces cartographiées','Passages piétons : marquages aux nœuds OSM','Eau et falaises : zones bloquées','Fonds carte, satellite et relief'];const envEn=['Roads: faster movement','Forests: slower movement','Slopes: speed adapts to terrain','Rivers: cross using OSM bridges','Tunnels: distinct map rendering','Elevation: Copernicus DEM (90 m)','Buildings: OSM footprints, floors and heights when available','Courtyards: building multipolygon interiors','Railways: detailed mapped tracks','OSM trees: individually rendered vegetation','Sidewalks and paths: visible pedestrian routes','Parking areas: mapped surfaces','Crossings: markings at OSM nodes','Water and cliffs: blocked areas','Map, satellite and terrain layers'];env.forEach((el,i)=>{if(i<15)el.textContent=(language==='fr'?envFr:envEn)[i];});
    const hint=$('.hint');if(hint)hint.textContent=language==='fr'?'WASD • E récupérer • Q action':'WASD • E collect • Q action';
    const cityInput=$('#cityInput');if(cityInput)cityInput.placeholder=language==='fr'?'Ex. Oran, Algérie':'e.g. Oran, Algeria';
    const settingHelp=$('#settingsModal .settings-card p');if(settingHelp)settingHelp.textContent=language==='fr'?'Ramasser : E · Action : Q · Bâtiment : F · Zoom : + / −':'Collect: E · Action: Q · Building: F · Zoom: + / −';
    const layoutOptions=$('#movementLayout option');if(layoutOptions.length===3){layoutOptions[0].textContent='WASD — QWERTY';layoutOptions[1].textContent='ZQSD — AZERTY';layoutOptions[2].textContent=language==='fr'?'Flèches directionnelles':'Arrow keys';}
    const rightPanels=$$('.right-panel .panel-title');['safe-zone','environment'].forEach((k,i)=>{if(rightPanels[i])rightPanels[i].textContent=t[k];});
    set('#zoneStatus','zone-status');set('#routeDistance','no-waypoint');set('#clearWaypoint','clear-waypoint');set('.health>span','energy');set('#actionBtn','action');set('#saveGameBtn','save');set('#locate','city');
    set('#cityModal h2','choose-city');set('#cityModal p','city-help');set('#searchCity','search');set('#pickMapLocation','pick-map');
    set('#settingsModal h2','settings-title');set('label[for="movementLayout"]','keyboard');set('label:has(#autoSaveToggle)','autosave');set('#saveSettings','save-settings');
    const manage=$('#manageSavesBtn');if(manage)manage.textContent=language==='fr'?'EMPLACEMENTS':'SLOTS';
    set('#saveLibraryTitle','save-title');set('#saveLibraryHint','save-hint');set('#profileTitle','profile-title');
    const exportBtn=$('#exportSaves'),importBtn=$('#importSaves'),newSlot=$('#newSaveSlot');
    if(exportBtn)exportBtn.textContent=language==='fr'?'Exporter mes sauvegardes':'Export my saves';
    if(importBtn)importBtn.textContent=language==='fr'?'Importer une sauvegarde':'Import saves';
    if(newSlot)newSlot.textContent=language==='fr'?'Nouvel emplacement':'New slot';
    const saveLabel=$('#saveGameBtn');if(saveLabel)saveLabel.textContent=t.save;
    const languageBtn=$('#languageBtn');if(languageBtn)languageBtn.textContent=language==='fr'?'EN':'FR';
  }
  function $$(selector){return Array.from(document.querySelectorAll(selector));}

  // Replace the legacy single-save and placeholder actions with the working library/profile.
  cloneButton('savesBtn',openLibrary);
  cloneButton('profileBtn',openProfile);
  cloneButton('saveGameBtn',()=>saveToSlot(activeSlotId));
  cloneButton('saveSettings',()=>{movementLayout=$('#movementLayout').value;const saved=writeLocalStorage('juju-movement-layout',movementLayout);settingsModal.classList.remove('open');notify(saved?(language==='fr'?'Paramètres enregistrés.':'Settings saved.'):(language==='fr'?'Stockage indisponible : paramètres non enregistrés.':'Storage unavailable: settings were not saved.'));});
  $('#manageSavesBtn').addEventListener('click',openLibrary);
  cloneButton('languageBtn',()=>{language=language==='fr'?'en':'fr';safeWrite(LANGUAGE_KEY,language);applyLanguage();notify(language==='fr'?'Interface en français.':'Interface in English.');});
  $('#closeSaveLibrary').addEventListener('click',()=>$('#saveLibraryModal').classList.remove('open'));
  $('#closeProfile').addEventListener('click',()=>$('#profileModal').classList.remove('open'));
  $('#newSaveSlot').addEventListener('click',addSlot);
  $('#exportSaves').addEventListener('click',exportBackup);
  $('#importSaves').addEventListener('click',()=>$('#importSavesFile').click());
  $('#importSavesFile').addEventListener('change',e=>{importBackup(e.target.files?.[0]);e.target.value='';});
  ['saveLibraryModal','profileModal'].forEach(id=>$('#'+id).addEventListener('click',e=>{if(e.target.id===id)e.currentTarget.classList.remove('open');}));

  const originalToast=toast;
  toast=function(message){if(language==='en'&&typeof message==='string'){const pairs=[['Inventaire plein — G pour jeter','Inventory full — press G to drop'],['Emplacement vide','Empty slot'],['Soin utilisé','Healing item used'],['Sortie du bâtiment','Exited the building'],['Entrée — F pour ressortir','Entered building — press F to exit'],['Approche la façade d’un bâtiment pour entrer','Approach a building facade to enter'],['Porte ouverte','Door opened'],['Porte fermée','Door closed'],['Approche de l’escalier pour changer d’étage','Approach the stairs to change floors'],['Repère ajouté','Waypoint added'],['Destination atteinte — repère effacé','Destination reached — waypoint cleared'],['Obstacle — contourne le bâtiment','Obstacle — go around the building'],['Bandage récupéré !','Bandage collected!'],['Approche l’objet lumineux puis appuie E','Approach the glowing item and press E'],['Approche un objet puis appuie E','Approach an item and press E'],['Bot retiré du match — action réussie','Bot removed from the match'],['Action effectuée — aucun bot à proximité','Action performed — no bot nearby'],['Zone sûre qui rétrécit','The safe zone is shrinking'],['Monde isométrique prêt — recherche des données réelles','Isometric world ready — loading real-world data']];for(const [fr,en] of pairs)message=message.replace(fr,en);message=message.replace('Géographie chargée','Geography loaded').replace('bâtiments','buildings').replace('routes','roads').replace('voies ferrées','railways');}return originalToast(message);};
  const originalFinish=finish;
  finish=function(message){return originalFinish(language==='en'&&message==='Tu es resté hors de la zone sûre'?'You stayed outside the safe zone':message);};
  const originalCycleMapStyle=cycleMapStyle;
  cycleMapStyle=function(){originalCycleMapStyle();const b=$('#mapStyle');if(b&&language==='en')b.textContent=mapStyle==='street'?'MAP':mapStyle==='satellite'?'SATELLITE':'TERRAIN';};
  const originalSetWorldLoadState=setWorldLoadState;
  setWorldLoadState=function(message,loading=false,failed=false){if(language==='en'){const mapText={'Zoom insuffisant pour charger les données.':'Zoom in to load map data.','Connexion aux données géographiques…':'Connecting to geographic data…','Récupération des routes et bâtiments…':'Loading roads and buildings…','Carte prête':'Map ready','Carte géographique chargée.':'Geographic map loaded.','Chargement des éléments':'Loading map features','Données géographiques indisponibles.':'Geographic data unavailable.'};for(const [fr,en] of Object.entries(mapText))message=message.replace(fr,en);}return originalSetWorldLoadState(message,loading,failed);};
  // The game itself calls startCity; count sessions without changing its core behavior.
  const originalStartCity=startCity;
  startCity=function(lat,lon,name){originalStartCity(lat,lon,name);window.jujuLocationName=name||'Lieu personnalisé';const p=getProfile();p.matchesStarted++;setProfile(p);sessionStartedAt=Date.now();lastEliminations=eliminations;};
  // Save frequently during play; pagehide is only a final best-effort backup, not the primary save.
  setInterval(()=>{
    if(!document.body.classList.contains('game-active'))return;
    const now=Date.now(),p=getProfile();p.playSeconds+=Math.max(0,Math.round((now-sessionStartedAt)/1000));sessionStartedAt=now;
    if(eliminations>lastEliminations){p.totalEliminations+=eliminations-lastEliminations;lastEliminations=eliminations;}
    setProfile(p);
    if(safeRead('juju-autosave')!=='false'&&now-lastAutoSaveAt>=12000)saveToSlot(activeSlotId,true);
  },5000);
  const finalBackup=()=>{if(document.body.classList.contains('game-active')&&safeRead('juju-autosave')!=='false')saveToSlot(activeSlotId,true);};
  window.addEventListener('pagehide',finalBackup);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finalBackup();});
  applyLanguage();
  // Ensure the default save slot exists and migrate the old single-save format once.
  readSlots();
})();
