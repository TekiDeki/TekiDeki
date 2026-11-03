/* sitemap-index.cjs - fiecare unealta publicata trebuie sa fie in sitemapindex-ul gazdei.

   De ce exista: in 3 noiembrie 2026 indexul din `TekiDeki.github.io/sitemap.xml` avea 29 de
   intrari, iar pe `tekideki.github.io` erau publicate 32 de unelte. CSV-Desk si Hash-Desk
   fusesera publicate in zilele dinainte, Icon-Desk chiar in ziua aceea, si niciuna nu fusese
   trecuta in index. Fiecare unealta isi avea sitemap.xml propriu si valid, `robots.txt` trimitea
   la index, dar un crawler nu ajungea la ele. Lipsa nu aparea in niciun test, fiindca testele
   din repo-ul asta priveau doar `tools.json`, `_redirects` si pagina.

   Defectul e tacut prin fire: nimic nu se strica vizibil, doar paginile nu sint anuntate.

   Se citeste indexul PUBLICAT, nu o copie din repo (R17): ce conteaza e ce vede un crawler.
   Pentru rulare pe un fisier local:  SITEMAP_INDEX=/cale/sitemap.xml node tests/sitemap-index.cjs

   Ce verifica:
     1. indexul raspunde si este XML valid cu radacina <sitemapindex>;
     2. fiecare unealta din tools.json gazduita pe tekideki.github.io apare in index;
     3. nicio intrare din index nu trimite la o unealta care nu e in registru;
     4. cu --live: fiecare sitemap referit raspunde 200, este XML valid si contine adresa uneltei.

   Rulare: node tests/sitemap-index.cjs [--live]
*/
const fs = require('node:fs');

const ROOT = __dirname.replace(/\/tests$/, '');
const REGISTRU = JSON.parse(fs.readFileSync(ROOT + '/tools.json', 'utf8')).tools;
const GAZDA = 'https://tekideki.github.io/';
const INDEX_LIVE = 'https://tekideki.github.io/sitemap.xml';
const INDEX_LOCAL = process.env.SITEMAP_INDEX || '';

let ok = 0;
const rau = [];
const check = (cond, mesaj) => { if (cond) ok += 1; else rau.push(mesaj); };

async function text(sursa) {
  if (sursa.startsWith('http')) {
    const r = await fetch(sursa, { headers: { 'user-agent': 'TekiDeki-hub-tests' } });
    if (!r.ok) throw new Error(`${sursa} a raspuns ${r.status}`);
    return r.text();
  }
  return fs.readFileSync(sursa, 'utf8');
}

(async () => {
  const sursa = INDEX_LOCAL || INDEX_LIVE;
  let brut;
  try {
    brut = await text(sursa);
  } catch (e) {
    console.error(`sitemap-index: nu pot citi indexul (${sursa}): ${e.message}`);
    console.error('  Fara index nu se poate verifica nimic. Pentru offline: SITEMAP_INDEX=<fisier>');
    process.exit(1);
  }
  console.log(`  index citit din: ${sursa}`);

  // 1. radacina
  check(/<sitemapindex[\s>]/.test(brut), 'radacina nu este <sitemapindex>');
  const locuri = [...brut.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
  check(locuri.length > 0, 'indexul nu are nicio intrare');

  // o intrare de index trebuie sa fie <gazda><Repo>/sitemap.xml
  const repoDinIndex = new Map();
  for (const u of locuri) {
    const m = /^https:\/\/tekideki\.github\.io\/([^/]+)\/sitemap\.xml$/.exec(u);
    check(!!m, `intrare nerecunoscuta in index: ${u}`);
    if (!m) continue;
    check(!repoDinIndex.has(m[1]), `intrare dubla in index: ${m[1]}`);
    repoDinIndex.set(m[1], u);
  }

  // uneltele din registru care stau pe aceasta gazda
  const gazduite = REGISTRU
    .filter(t => (t.url || '').startsWith(GAZDA))
    .map(t => ({ slug: t.slug, repo: t.url.slice(GAZDA.length).replace(/\/.*$/, ''), url: t.url }));
  check(gazduite.length > 0, 'nicio unealta gazduita pe ' + GAZDA);

  // 2. fiecare unealta gazduita e in index
  for (const t of gazduite) {
    check(repoDinIndex.has(t.repo),
      `lipseste din sitemapindex: ${t.repo} (unealta ${t.slug}) - publicata, dar neanuntata`);
  }

  // 3. nicio intrare orfana
  const cunoscute = new Set(gazduite.map(t => t.repo));
  for (const repo of repoDinIndex.keys()) {
    check(cunoscute.has(repo),
      `intrare in index fara unealta in registru: ${repo} (sitemapindex si tools.json nu spun acelasi lucru)`);
  }

  // 4. --live: fiecare sitemap referit chiar exista si isi descrie pagina
  if (process.argv.includes('--live')) {
    for (const t of gazduite) {
      const u = repoDinIndex.get(t.repo);
      if (!u) continue;                       // lipsa e deja raportata la 2
      let s;
      try {
        s = await text(u);
      } catch (e) {
        check(false, `${u} nu raspunde: ${e.message}`);
        continue;
      }
      check(/<urlset[\s>]/.test(s), `${u} nu are radacina <urlset>`);
      check(s.includes(t.url) || s.includes(t.url.replace(/\/$/, '')),
        `${u} nu contine adresa uneltei (${t.url})`);
    }
  }

  if (rau.length) {
    console.error(`\nsitemap-index: ${rau.length} verificari esuate, ${ok} trecute`);
    for (const m of rau) console.error('  RAU  ' + m);
    process.exit(1);
  }
  console.log(`sitemap-index: ${ok} verificari trecute, 0 esuate (` +
    `${gazduite.length} unelte gazduite, ${repoDinIndex.size} intrari in index` +
    `${process.argv.includes('--live') ? ', verificat pe viu' : ''})`);
})().catch(e => { console.error('sitemap-index: ' + e.message); process.exit(1); });
