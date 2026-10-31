/* tools-registry.cjs - cardurile din hub vin din tools.json, si se verifica.

   De ce exista: inainte, fiecare unealta insemna 17,6 linii de HTML scrise de mina. Un cimp
   uitat (data-tags, --hue, glyph, url, repo) nu se vedea nicaieri: pagina arata bine, doar
   filtrul sau culoarea erau altfel. Testul asta tine registrul si pagina legate.

   Ce verifica:
     1. pagina este exact ce iese din registru (scripts/build-tools.py --check);
     2. toate cheile de traducere din registru exista in toate cele 4 limbi ale paginii;
     3. textul englez de rezerva din registru este identic cu dictionarul `en` al paginii
        (altfel fara JavaScript se citeste altceva decit cu el);
     4. in pagina sint exact atitea carduri cite intrari, cu acelasi slug, etichete si adresa.

   Rulare: node tests/tools-registry.cjs   (sau npm test)
*/
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REGISTRU = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools.json'), 'utf8')).tools;
const PAGINA = path.join(ROOT, 'site', 'index.html');
const LIMBI = ['en', 'ro', 'sr-latn', 'sr-cyr'];

let ok = 0;
const rau = [];
function check(cond, mesaj) {
  if (cond) { ok += 1; } else { rau.push(mesaj); }
}

(async () => {
  // 1. pagina = registru
  try {
    execFileSync('python3', [path.join(ROOT, 'scripts', 'build-tools.py'), '--check'],
      { cwd: ROOT, stdio: 'pipe' });
    check(true, 'pagina se potriveste cu registrul');
  } catch (e) {
    check(false, 'pagina nu se potriveste cu registrul, ruleaza: python3 scripts/build-tools.py --write\n' +
      String(e.stderr || e.stdout || e));
  }

  // 2 + 3. chei si text de rezerva, citite din pagina
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + PAGINA);
  await page.waitForTimeout(300);
  const i18n = await page.evaluate('window.I18N');

  const chei = [];
  for (const u of REGISTRU) {
    for (const bucata of [u.tag, u.desc, u.size, ...u.features]) {
      if (bucata.key) chei.push([u.slug, bucata.key, bucata.text]);
    }
  }
  check(chei.length > 0, 'registrul are chei de traducere');
  for (const limba of LIMBI) {
    const lipsa = chei.filter(([, k]) => !i18n[limba] || !(k in i18n[limba])).map(([, k]) => k);
    check(lipsa.length === 0, `chei lipsa in ${limba}: ${[...new Set(lipsa)].slice(0, 6).join(', ')}`);
  }
  const diferite = chei.filter(([, k, text]) => i18n.en[k] !== text);
  check(diferite.length === 0,
    'text de rezerva diferit de dictionarul en: ' +
    diferite.slice(0, 3).map(([s, k]) => `${s}.${k}`).join(', '));

  // 4. cardurile din pagina, fata in fata cu registrul
  const carduri = await page.evaluate(() => [...document.querySelectorAll('#grid .card')].map(c => {
    const stil = c.getAttribute('style') || '';
    const hue = (/--hue:\s*([^;]+)/.exec(stil) || [, ''])[1].trim();
    return {
      slug: c.getAttribute('data-slug'),
      tags: (c.getAttribute('data-tags') || '').split(' ').filter(Boolean),
      hue,
      url: c.querySelector('.card-title a').getAttribute('href'),
    };
  }));
  check(carduri.length === REGISTRU.length,
    `carduri in pagina: ${carduri.length}, intrari in registru: ${REGISTRU.length}`);
  for (const u of REGISTRU) {
    const c = carduri.find(x => x.slug === u.slug);
    check(!!c, `card lipsa pentru ${u.slug}`);
    if (!c) continue;
    check(JSON.stringify(c.tags) === JSON.stringify(u.tags), `${u.slug}: etichete diferite (${c.tags})`);
    check(c.hue === u.hue, `${u.slug}: --hue diferit (${c.hue} vs ${u.hue})`);
    check(c.url === u.url, `${u.slug}: adresa diferita (${c.url})`);
  }
  await browser.close();

  if (rau.length) {
    console.error(`\n${rau.length} verificari esuate, ${ok} trecute`);
    for (const m of rau) console.error('  RĂU  ' + m);
    process.exit(1);
  }
  console.log(`tools-registry: ${ok} verificari trecute, 0 esuate (${REGISTRU.length} unelte, ` +
    `${LIMBI.length} limbi, ${chei.length} chei)`);
})().catch(e => { console.error('tools-registry: ' + e.message); process.exit(1); });
