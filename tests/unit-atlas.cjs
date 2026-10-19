/* npm ci && npx playwright install --with-deps chromium
   Start: python -m http.server 8080 --directory site
   Run: npm test (optional ATLAS_BASE and ATLAS_CHROMIUM_PATH)
   The converter itself lives in TekiDeki/Unit-Converter and is tested there.
   This suite checks the hub integration: card, tools list, shortcut, cache,
   offline shell and the live deployment on GitHub Pages. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ATLAS_BASE || 'http://localhost:8080';
const APP = 'https://tekideki.github.io/Unit-Converter/';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
// Typography rule (docs/unit-atlas.md): project text uses '-', never the long dash.
function listFiles(dir) {
 return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? listFiles(full) : [full];
 });
}
(async () => {
 const EM_DASH = '\u2014';
 const scanned = [path.join(ROOT, 'README.md'), ...listFiles(path.join(ROOT, 'site')), ...listFiles(path.join(ROOT, 'docs'))];
 const longDashes = scanned.filter(file => fs.readFileSync(file, 'utf8').includes(EM_DASH)).map(file => path.relative(ROOT, file));
 assert.deepEqual(longDashes, [], 'long dash (U+2014) found, use "-" instead');
 const browser = await chromium.launch({executablePath: process.env.ATLAS_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote'], headless: true});
 const context = await browser.newContext({viewport: {width: 1440, height: 1100}, permissions: ['clipboard-read', 'clipboard-write']});
 const page = await context.newPage();
 const errors = []; page.on('pageerror', e => errors.push(e.message));
 await page.goto(base + '/');
 assert.equal(await page.locator('.card[data-slug]').count(), 21);
 // every number in the copy has to follow the cards, not a typed figure:
 // the hero button said 16 while the page listed 19.
 const cardTotal = await page.locator('.card[data-slug]').count();
 for (const lg of ['en', 'ro', 'sr-latn', 'sr-cyr']) {
  await page.locator('#langBtn').click();
  await page.locator('#langList button[data-lang="' + lg + '"]').click();
  const cta = await page.locator('[data-i18n="hero.cta1"]').innerText();
  assert.match(cta, new RegExp('\\b' + cardTotal + '\\b'), lg + ': the hero button must quote the real tool count, got ' + cta);
  assert.equal(await page.locator('#count').innerText(), cardTotal + ' / ' + cardTotal, lg + ': the counter must match the cards');
 }
 await page.locator('#langBtn').click();
 await page.locator('#langList button[data-lang="en"]').click();
 // the card points at the dedicated repository
 const card = page.locator('.card[data-slug="convert"]');
 assert.equal(await card.count(), 1);
 assert.equal(await card.locator('.card-title a').getAttribute('href'), APP);
 assert.equal(await card.locator('a.btn-primary').getAttribute('href'), APP);
 assert.equal(await card.locator('a[data-i18n="src"]').getAttribute('href'), 'https://github.com/TekiDeki/Unit-Converter');
 // the short address stays and still copies
 const row = page.locator('#shortcutList .sc-row').filter({hasText: 'freehtml.dev/convert/'});
 assert.equal(await row.count(), 1);
 assert.equal(await row.locator('.copy').getAttribute('data-copy'), 'https://freehtml.dev/convert/');
 await row.locator('.copy').click();
 assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://freehtml.dev/convert/');
 // the site no longer ships a copy of the converter
 const gone = await context.request.get(base + '/convert/index.html');
 assert.equal(gone.status(), 404);
 // the index finds Unit Atlas in all four languages
 for (const [language, query] of [['en', 'Unit Atlas'], ['ro', 'măsuri funciare'], ['sr-latn', 'mere zemljišta'], ['sr-cyr', 'мере земљишта']]) {
  await page.locator('#langBtn').click();
  await page.locator(`#langList button[data-lang="${language}"]`).click();
  await page.locator('#q').fill(query);
  assert.equal(await card.isVisible(), true, language);
 }
 await page.locator('#q').fill('');
 // the hub cache keeps the shell and leaves the converter alone
 await page.reload();
 await page.waitForFunction(() => !!navigator.serviceWorker.controller);
 const cached = await page.evaluate(async () => {
  const names = await caches.keys();
  const out = {};
  for (const name of names) {
   const cache = await caches.open(name);
   out[name] = (await cache.keys()).map(r => new URL(r.url).pathname);
  }
  return out;
 });
 const paths = Object.values(cached).flat();
 assert(paths.includes('/index.html'), 'hub shell cached: ' + JSON.stringify(cached));
 assert(!paths.some(p => p.startsWith('/convert')), 'converter must not be cached: ' + JSON.stringify(cached));
 // offline: the hub opens from the cache, the converter is not served from it
 await context.setOffline(true);
 await page.goto(base + '/');
 assert.equal(await page.locator('.card[data-slug]').count(), 21);
 await page.goto(base + '/convert/').catch(() => {});
 assert.equal(await page.locator('.category').count(), 0);
 await context.setOffline(false);
 // the dedicated deployment answers online
 const live = await context.request.get(APP, {timeout: 30000});
 assert.equal(live.status(), 200);
 const body = await live.text();
 assert(body.includes('const CATEGORIES='), 'the live deployment serves the converter');
 assert(body.includes('https://tekideki.github.io/Unit-Converter/'), 'the live deployment is canonical on its own repository');
 assert(body.includes('Српски'), 'the live deployment keeps the four languages');
 assert.deepEqual(errors, []);
 await browser.close();
 console.log('PASS: hub card, tools list, shortcut, cache, offline shell and the live dedicated deployment.');
})().catch(e => { console.error(e); process.exit(1); });
