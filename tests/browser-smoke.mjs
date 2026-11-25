import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify([{ lat: '35.6971', lon: '-0.6308', display_name: 'Oran, Algeria' }])
}));
await page.route('https://overpass-api.de/**', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ elements: [] })
}));
await page.route('https://api.open-meteo.com/**', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ elevation: Array(25).fill(25) })
}));
await page.route('https://{s}.tile.openstreetmap.org/**', route => route.abort());

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
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

  await page.locator('#saveGameBtn').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('juju-world-save-v1')));
  assert.ok(Array.isArray(saved.loot) && saved.loot.length > 0);
  assert.ok(saved.loot.every(item => typeof item.type === 'string' && item.type.length > 0));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#savesBtn').click();
  await page.locator('body.game-active').waitFor({ state: 'attached' });
  await page.waitForTimeout(250);
  assert.deepEqual(pageErrors, [], `Unexpected browser errors: ${pageErrors.join('; ')}`);
  console.log('PASS: city typing, city selection, visible map tiles, loot save/restore, and browser console');
} finally {
  await browser.close();
}
