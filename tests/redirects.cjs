/* redirects.cjs - regulile de redirectare din hub, verificate inainte de deploy.

   De ce exista: site/_redirects are 142 de reguli, majoritatea legaturi scurte (/convert, /money)
   si redirectari de la adrese vechi. Pina acum nimic nu le verifica: o regula stearsa din greseala
   se vedea abia cind Google intilnea un 404, iar un card fara legatura scurta se vedea doar daca
   incerca cineva adresa. Am gasit asa o asimetrie reala: cardul video-trim are legatura scurta /trim.

   Ce verifica, fara retea:
     1. fiecare linie are sursa, tinta si un cod valid (301 sau 302);
     2. nicio sursa repetata (a doua regula nu se aplica niciodata - capcana tacuta);
     3. fiecare unealta din tools.json are ambele forme ale legaturii scurte, spre adresa ei;
     4. fiecare legatura scurta duce la o unealta din registru sau la un link cunoscut;
     5. nicio regula nu trimite o adresa in ea insasi si nici intr-o alta regula sursa (lant);
     6. tintele sint https.

   Cu --live verifica si pe viu: cere fiecare adresa si compara codul si Location. Dureaza.
   Rulare: node tests/redirects.cjs [--live]
*/
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FISIER = path.join(ROOT, 'site', '_redirects');
const UNELTE = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools.json'), 'utf8')).tools;

let ok = 0;
const rau = [];
const check = (cond, mesaj) => { if (cond) ok += 1; else rau.push(mesaj); };

const reguli = [];
fs.readFileSync(FISIER, 'utf8').split('\n').forEach((linieBruta, i) => {
  const linie = linieBruta.trim();
  if (!linie || linie.startsWith('#')) return;
  const p = linie.split(/\s+/);
  check(p.length >= 3, `linia ${i + 1}: nu are sursa, tinta si cod (${linie})`);
  if (p.length < 3) return;
  const [sursa, tinta, cod] = p;
  check(['301', '302'].includes(cod), `linia ${i + 1}: cod neobisnuit ${cod}`);
  check(sursa.startsWith('/'), `linia ${i + 1}: sursa nu incepe cu / (${sursa})`);
  check(tinta.startsWith('https://'), `linia ${i + 1}: tinta nu e https (${tinta})`);
  reguli.push({ sursa, tinta: tinta.replace(/\/$/, ''), cod, linie: i + 1 });
});

const peSursa = new Map();
for (const r of reguli) {
  check(!peSursa.has(r.sursa), `sursa repetata: ${r.sursa} (liniile ${peSursa.get(r.sursa)?.linie} si ${r.linie})`);
  peSursa.set(r.sursa, r);
}

const adreseUnelte = new Set(UNELTE.map(u => u.url.replace(/\/$/, '')));
const cunoscute = new Set([...adreseUnelte,
  'https://github.com/TekiDeki', 'https://github.com/TekiDeki/TekiDeki']);

for (const u of UNELTE) {
  if (!u.path) continue;
  for (const forma of [u.path, u.path + '/']) {
    const r = peSursa.get(forma);
    check(!!r, `${u.slug}: lipsește regula pentru ${forma}`);
    if (r) {
      check(r.cod === '302', `${u.slug}: ${forma} ar trebui sa fie 302, e ${r.cod}`);
      check(r.tinta === u.url.replace(/\/$/, ''),
        `${u.slug}: ${forma} duce la ${r.tinta}, cardul spune ${u.url}`);
    }
  }
}

for (const r of reguli) {
  if (r.cod !== '302') continue;
  check(cunoscute.has(r.tinta),
    `linia ${r.linie}: legatura scurta ${r.sursa} duce la o adresa necunoscuta (${r.tinta})`);
}

for (const r of reguli) {
  check(r.tinta !== 'https://freehtml.dev' + r.sursa, `linia ${r.linie}: ${r.sursa} se trimite in ea insasi`);
  const urmatoare = peSursa.get(r.tinta.replace('https://freehtml.dev', ''));
  check(!urmatoare || urmatoare.sursa === r.sursa,
    `linia ${r.linie}: ${r.sursa} duce intr-o alta regula (${urmatoare?.sursa}), adica un lant`);
}

// --- optional: verificarea pe viu
if (process.argv.includes('--live')) {
  (async () => {
    const deVerificat = reguli.slice();
    let i = 0;
    const muncitor = async () => {
      while (i < deVerificat.length) {
        const r = deVerificat[i++];
        const url = 'https://freehtml.dev' + r.sursa;
        try {
          const res = await fetch(url, { redirect: 'manual' });
          const loc = (res.headers.get('location') || '').replace(/\/$/, '');
          check([301, 302].includes(res.status), `live ${r.sursa}: cod ${res.status}`);
          check(loc === r.tinta, `live ${r.sursa}: Location ${loc}, regula spune ${r.tinta}`);
        } catch (e) {
          check(false, `live ${r.sursa}: ${e.message}`);
        }
      }
    };
    await Promise.all([muncitor(), muncitor(), muncitor(), muncitor()]);
    raporteaza();
  })();
} else {
  raporteaza();
}

function raporteaza() {
  if (rau.length) {
    console.error(`\nredirects: ${rau.length} verificate esuate, ${ok} trecute`);
    for (const m of rau.slice(0, 20)) console.error('  RĂU  ' + m);
    process.exit(1);
  }
  console.log(`redirects: ${ok} verificari trecute, 0 esuate (${reguli.length} reguli, ` +
    `${UNELTE.filter(u => u.path).length} legaturi scurte)`);
}
