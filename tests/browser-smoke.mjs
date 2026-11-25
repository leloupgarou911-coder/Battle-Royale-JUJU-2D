import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const pageErrors = [];
let overpassMode = 'normal';
let citySearchMode = 'normal';
const overpassCalls = [];
page.on('pageerror', error => pageErrors.push(error.message));

await page.route('https://nominatim.openstreetmap.org/**', async route => {
  if (citySearchMode === 'slow') {
    await new Promise(resolve => setTimeout(resolve, 12000));
    try { await route.fulfill({status:200,contentType:'application/json',body:'[]'}); } catch {}
    return;
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{lat:'35.6971',lon:'-0.6308',display_name:'Oran, Algeria'}])});
});
for (const endpoint of ['https://overpass-api.de/**','https://overpass.private.coffee/**','https://maps.mail.ru/osm/tools/overpass/**']) {
  await page.route(endpoint, async route => {
    const url = route.request().url();
    overpassCalls.push(url);
    const isPrimary = url.includes('overpass-api.de');
    const isSecondary = url.includes('overpass.private.coffee');
    if (overpassMode === 'fail-all' || (overpassMode === 'fail-first' && isPrimary) || (overpassMode === 'fail-first-two' && (isPrimary || isSecondary))) {
      await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Temporary test outage' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [] }) });
  });
}
await page.route('https://api.open-meteo.com/**', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ elevation: Array(25).fill(25) })
}));
await page.route('https://{s}.tile.openstreetmap.org/**', route => route.abort());

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  // Language toggle must translate real interface content, not merely relabel itself.
  await page.setViewportSize({ width: 390, height: 500 });
  assert.equal(await page.locator('#homeScreen').evaluate(el => getComputedStyle(el).overflowY), 'auto');
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.locator('#languageBtn').click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.match(await page.locator('.home-copy h1').textContent(), /YOUR WORLD/);
  assert.equal(await page.locator('#playBtn').innerText().then(v=>v.includes('PLAY')), true);
  await page.locator('#languageBtn').click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
  await page.locator('#profileBtn').click();
  await page.locator('#profileModal.open').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.profile-stat').count(), 4);
  await page.locator('#closeProfile').click();
  await page.locator('#playBtn').click();
  await page.locator('#cityModal.open').waitFor({ state: 'visible' });

  // Regression: letters used by game shortcuts must remain typeable in the city field.
  await page.locator('#cityInput').fill('');
  await page.locator('#cityInput').pressSequentially('Oran');
  assert.equal(await page.locator('#cityInput').inputValue(), 'Oran');

  await page.locator('#searchCity').click();
  await page.locator('.city-result').first().waitFor({ state: 'visible' });
  await page.locator('.city-result').first().click();
  await page.locator('body.game-active').waitFor({ state: 'attached' });

  // Regression: Leaflet raster tiles must not be hidden by a later CSS rule.
  const tileDisplay = await page.locator('#map .leaflet-tile-pane').evaluate(el => getComputedStyle(el).display);
  assert.notEqual(tileDisplay, 'none');

  // Periodic autosave must create a recoverable save even without clicking the save button.
  await page.waitForTimeout(6000);
  let autosaved = await page.evaluate(() => JSON.parse(localStorage.getItem('juju-world-saves-v2') || '[]'));
  assert.ok(autosaved[0]?.data, 'Expected periodic autosave during active gameplay');
  // Nominatim requests must time out cleanly and release the search button.
  await page.locator('#locate').click();
  citySearchMode = 'slow';
  await page.locator('#cityInput').fill('Very slow location');
  await page.locator('#searchCity').click();
  await page.getByText(/Recherche indisponible|City search unavailable/).waitFor({state:'visible',timeout:12000});
  assert.equal(await page.locator('#searchCity').isDisabled(), false);
  citySearchMode = 'normal';
  await page.locator('#closeModal').click();

  await page.locator('#saveGameBtn').click();
  const library = await page.evaluate(() => JSON.parse(localStorage.getItem('juju-world-saves-v2')));
  assert.equal(library.length, 6, 'Expected six independent save slots');
  assert.ok(library[0].data && Array.isArray(library[0].data.loot) && library[0].data.loot.length > 0);
  assert.ok(library[0].data.loot.every(item => typeof item.type === 'string' && item.type.length > 0));
  // Multiple slots are usable from the in-game manager and backups can move between devices.
  await page.locator('#manageSavesBtn').click();
  await page.locator('#saveLibraryModal.open').waitFor({ state: 'visible' });
  await page.locator('.save-slot').nth(1).getByRole('button', { name: 'Sauvegarder ici' }).click();
  const twoSlots = await page.evaluate(() => JSON.parse(localStorage.getItem('juju-world-saves-v2')));
  assert.ok(twoSlots[1].data, 'Expected second save slot to contain a game');
  const [backupDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#exportSaves').click()]);
  assert.equal(backupDownload.suggestedFilename(), 'juju-world-saves-backup.json');
  const backupPayload = await page.evaluate(() => {const slots=JSON.parse(localStorage.getItem('juju-world-saves-v2'));slots[1].data=null;slots[1].savedAt=null;return JSON.stringify({format:'juju-world-backup',version:1,slots});});
  await page.locator('#importSavesFile').setInputFiles({name:'juju-backup.json',mimeType:'application/json',buffer:Buffer.from(backupPayload)});
  await page.waitForFunction(() => {const slots=JSON.parse(localStorage.getItem('juju-world-saves-v2') || '[]');return slots.length===6 && slots[1].data===null;});
  await page.locator('#closeSaveLibrary').click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#savesBtn').click();
  await page.locator('#saveLibraryModal.open').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.save-slot').count(), 6);
  await page.locator('.save-slot').first().getByRole('button', { name: 'Charger' }).click();
  await page.locator('body.game-active').waitFor({ state: 'attached' });

  // Corrupt entries must be normalized instead of crashing the renderer.
  await page.evaluate(() => {
    const slots = JSON.parse(localStorage.getItem('juju-world-saves-v2'));
    slots[0].data.equipment = ['unknown-item'];
    slots[0].data.loot[0].type = 'unknown-item';
    slots[0].data.health = 0;
    localStorage.setItem('juju-world-saves-v2', JSON.stringify(slots));
    localStorage.setItem('juju-autosave', 'false'); // prevent the intentional pagehide backup from replacing the corrupted fixture
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#savesBtn').click();
  await page.locator('#saveLibraryModal.open').waitFor({ state: 'visible' });
  await page.locator('.save-slot').first().getByRole('button', { name: 'Charger' }).click();
  await page.locator('body.game-active').waitFor({ state: 'attached' });
  assert.equal(await page.locator('.weapon b').textContent(), 'Aucun équipement');
  assert.equal(await page.locator('.health b').textContent(), '0', 'A saved zero health value must not be restored as full health');
  await page.waitForFunction(() => document.querySelector('#terrainReadout')?.textContent.includes('ALT. 25 m'), null, { timeout: 15000 });

  // Regression: the mobile D-pad must follow the selected ZQSD layout.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.setViewportSize({ width: 390, height: 500 });
  await page.locator('#settingsBtn').click();
  const settingsBox = await page.locator('#settingsModal .settings-card').boundingBox();
  assert.ok(settingsBox && settingsBox.y >= 0 && settingsBox.y + settingsBox.height <= 500, 'Settings dialog should fit or scroll within a short mobile viewport');
  await page.locator('#movementLayout').selectOption('zqsd');
  await page.locator('#saveSettings').click();
  await page.locator('#playBtn').click();
  await page.locator('#cityInput').fill('Oran');
  await page.locator('#searchCity').click();
  await page.locator('.city-result').first().click();
  await page.setViewportSize({ width: 390, height: 844 });
  const up = page.locator('.mobile-pad [data-dir=up]');
  await up.waitFor({ state: 'visible' });
  await up.hover();
  await page.mouse.down();
  assert.equal(await up.getAttribute('data-active-key'), 'z');
  await page.mouse.up();
  assert.equal(await up.getAttribute('data-active-key'), null);

  // Fallback endpoint: the primary service fails, the secondary one succeeds.
  overpassMode = 'fail-first';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#playBtn').click();
  await page.locator('#cityInput').fill('Oran');
  await page.locator('#searchCity').click();
  await page.locator('.city-result').first().click();
  await page.waitForFunction(() => document.querySelector('[data-world-status]')?.textContent.includes('Carte prête'), null, { timeout: 15000 });
  assert.ok(overpassCalls.some(url => url.includes('overpass.private.coffee')), 'Expected independent secondary Overpass endpoint to be used');

  // If the first two independent services fail, the third must be tried.
  overpassMode = 'fail-first-two';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#playBtn').click();
  await page.locator('#cityInput').fill('Oran');
  await page.locator('#searchCity').click();
  await page.locator('.city-result').first().click();
  await page.waitForFunction(() => document.querySelector('[data-world-status]')?.textContent.includes('Carte prête'), null, { timeout: 15000 });
  assert.ok(overpassCalls.some(url => url.includes('maps.mail.ru')), 'Expected third independent Overpass endpoint to be used');

  // Total outage must expose a working retry control; the next attempt recovers.
  overpassMode = 'fail-all';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#playBtn').click();
  await page.locator('#cityInput').fill('Oran');
  await page.locator('#searchCity').click();
  await page.locator('.city-result').first().click();
  const retry = page.locator('[data-world-retry]');
  await retry.waitFor({ state: 'visible', timeout: 20000 });
  overpassMode = 'normal';
  await retry.click();
  await page.waitForFunction(() => document.querySelector('[data-world-status]')?.textContent.includes('Carte prête'), null, { timeout: 15000 });

  assert.deepEqual(pageErrors, [], `Unexpected browser errors: ${pageErrors.join('; ')}`);
  console.log('PASS: start flow, map/elevation, save restore, mobile controls, Overpass fallback, network failure and retry, browser console');
} finally {
  await browser.close();
}
