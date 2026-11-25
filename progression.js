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
    if(!writeSlots(slots)){notify('Sauvegarde impossible : stockage local saturé ou indisponible.');return false;}
    activeSlotId=id;
    if(!automatic){
      const p=getProfile();p.manualSaves++;setProfile(p);
      notify('Partie sauvegardée dans '+slots[index].name+'.');
    }
    lastAutoSaveAt=Date.now();
    return true;
  }
  function validSnapshot(s) {
    return !!(s && s.version>=1 && s.player && Number.isFinite(s.player.lat) && Number.isFinite(s.player.lng) && Math.abs(s.player.lat)<=90 && Math.abs(s.player.lng)<=180);
  }
  function loadSlot(id) {
    const slot=readSlots().find(s=>s.id===id);
    if(!slot || !validSnapshot(slot.data)){notify('Cet emplacement ne contient aucune sauvegarde valide.');return;}
    const s=slot.data;
    try {
      player=L.latLng(s.player.lat,s.player.lng);
      zoneCenter=L.latLng(s.zoneCenter?.lat??s.player.lat,s.zoneCenter?.lng??s.player.lng);
      bots=(Array.isArray(s.bots)?s.bots:[]).map(b=>{const p=b?.pos||b;return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)?{pos:L.latLng(p.lat,p.lng),health:b.health}:null;}).filter(Boolean);
      loot=(Array.isArray(s.loot)?s.loot:[]).filter(o=>o&&Number.isFinite(o.lat)&&Number.isFinite(o.lng)).map(o=>({pos:L.latLng(o.lat,o.lng),type:itemCatalog[o.type]?o.type:'bandage'}));
      health=Math.max(0,Math.min(100,Number(s.health)||100));
      inventory=Math.max(0,Number(s.inventory)||0);
      equipment=Array.isArray(s.equipment)?s.equipment.slice(0,6).map(v=>itemCatalog[v]?v:null):Array(6).fill(null);
      while(equipment.length<6)equipment.push(null);
      selectedSlot=Math.max(0,Math.min(5,Number(s.selectedSlot)||0));
      waypoint=s.waypoint&&Number.isFinite(s.waypoint.lat)&&Number.isFinite(s.waypoint.lng)?L.latLng(s.waypoint.lat,s.waypoint.lng):null;
      eliminations=Math.max(0,Number(s.eliminations)||0);
      zoneRadius=Math.max(100,Number(s.zoneRadius)||2500);
      countdown=Math.max(0,Number(s.countdown)||120);
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
    readSlots().forEach(slot=>{
      const row=document.createElement('section');row.className='save-slot';
      const info=document.createElement('div');const title=document.createElement('strong');title.textContent=slot.name;
      const detail=document.createElement('small');detail.textContent=slot.data?('Dernière sauvegarde : '+new Date(slot.savedAt||slot.data.savedAt).toLocaleString()+' · '+(slot.data.locationName||'Lieu personnalisé')):'Emplacement vide';
      info.append(title,detail);
      const actions=document.createElement('div');actions.className='save-slot-actions';
      const save=document.createElement('button');save.textContent=slot.data?'Écraser':'Sauvegarder ici';save.className='primary';save.addEventListener('click',()=>{if(saveToSlot(slot.id)){renderLibrary();}});
      const load=document.createElement('button');load.textContent='Charger';load.disabled=!validSnapshot(slot.data);load.addEventListener('click',()=>loadSlot(slot.id));
      const remove=document.createElement('button');remove.textContent='Supprimer';remove.className='danger';remove.disabled=!slot.data;remove.addEventListener('click',()=>{if(!confirm('Supprimer '+slot.name+' ?'))return;const all=readSlots();const target=all.find(x=>x.id===slot.id);if(target){target.data=null;target.savedAt=null;writeSlots(all);renderLibrary();}});
      actions.append(save,load,remove);row.append(info,actions);container.append(row);
    });
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
    const stats=[['Parties lancées',p.matchesStarted],['Éliminations',p.totalEliminations],['Sauvegardes manuelles',p.manualSaves],['Temps de jeu',hours+' h '+minutes+' min']];
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
    const playButton=$('#playBtn');if(playButton)playButton.innerHTML='<span>▶</span> '+t.play+' <small>'+t['play-sub']+'</small>';
    set('#savesBtn','saves');set('#settingsBtn','settings');set('#profileBtn','profile');
    set('.card-top span','world-explorer');set('.world-caption small','one-planet');set('.world-caption b','endless');set('.card-bottom span:first-child','global-map');set('.card-bottom span:last-child','open-world');
    const statLabels=$$('.stats small');['players','zone','kills'].forEach((k,i)=>{if(statLabels[i])statLabels[i].textContent=t[k];});
    const panels=$$('.left-panel .panel-title');['equipment','inventory','objective'].forEach((k,i)=>{if(panels[i])panels[i].textContent=t[k];});
    set('.inventory-help','inventory-help');set('.left-panel>p','objective-text');
    const rightPanels=$$('.right-panel .panel-title');['safe-zone','environment'].forEach((k,i)=>{if(rightPanels[i])rightPanels[i].textContent=t[k];});
    set('#zoneStatus','zone-status');set('#routeDistance','no-waypoint');set('#clearWaypoint','clear-waypoint');set('.health>span','energy');set('#actionBtn','action');set('#saveGameBtn','save');set('#locate','city');
    set('#cityModal h2','choose-city');set('#cityModal p','city-help');set('#searchCity','search');set('#pickMapLocation','pick-map');
    set('#settingsModal h2','settings-title');set('label[for="movementLayout"]','keyboard');set('label:has(#autoSaveToggle)','autosave');set('#saveSettings','save-settings');
    set('#saveLibraryTitle','save-title');set('#saveLibraryHint','save-hint');set('#profileTitle','profile-title');
    const saveLabel=$('#saveGameBtn');if(saveLabel)saveLabel.textContent=t.save;
    const languageBtn=$('#languageBtn');if(languageBtn)languageBtn.textContent=language==='fr'?'EN':'FR';
  }
  function $$(selector){return Array.from(document.querySelectorAll(selector));}

  // Replace the legacy single-save and placeholder actions with the working library/profile.
  cloneButton('savesBtn',openLibrary);
  cloneButton('profileBtn',openProfile);
  cloneButton('saveGameBtn',()=>saveToSlot(activeSlotId));
  cloneButton('languageBtn',()=>{language=language==='fr'?'en':'fr';safeWrite(LANGUAGE_KEY,language);applyLanguage();notify(language==='fr'?'Interface en français.':'Interface in English.');});
  $('#closeSaveLibrary').addEventListener('click',()=>$('#saveLibraryModal').classList.remove('open'));
  $('#closeProfile').addEventListener('click',()=>$('#profileModal').classList.remove('open'));
  $('#newSaveSlot').addEventListener('click',addSlot);
  ['saveLibraryModal','profileModal'].forEach(id=>$('#'+id).addEventListener('click',e=>{if(e.target.id===id)e.currentTarget.classList.remove('open');}));

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
