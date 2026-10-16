# Unit Atlas - convertor de unități

## Unde stă aplicația

Aplicația Unit Atlas trăiește în repository-ul dedicat [TekiDeki/Unit-Converter](https://github.com/TekiDeki/Unit-Converter), în rădăcina lui, ca `index.html`. Publicarea se face prin GitHub Pages, din ramura `main`, la adresa:

**https://tekideki.github.io/Unit-Converter/**

În acest repository (TekiDeki/TekiDeki) nu mai există copia locală `site/convert/index.html`. După ce publicarea nouă a fost verificată online și offline, copia a fost eliminată, iar adresa scurtă `freehtml.dev/convert/` a rămas: ea redirectează 302 către deployment-ul de pe GitHub Pages.

Redirecționarea este 302, nu 301, din același motiv ca la celelalte unelte: aplicația rămâne canonică pe `tekideki.github.io`, unde service worker-ul, cache-ul offline și instalarea trăiesc. Un 301 ar învăța browserele și Google că adresa de pe GitHub Pages a dispărut.

Ce s-a schimbat în acest repository:

- `site/_redirects`: `/convert` și `/convert/` redirectează 302 către `https://tekideki.github.io/Unit-Converter/`.
- `site/sw.js`: versiunea cache a crescut la `fhd-v7-unit-atlas`; convertorul a ieșit din shell-ul cache-uit, iar `/convert` intră în lista de scurtături, deci redirecționarea nu este interceptată de service worker.
- `site/sitemap.xml`: pagina `/convert/` a fost eliminată; aplicația are propriul sitemap în repository-ul dedicat.
- `site/index.html`: cardul, lista de unelte și tabelul de scurtături trimit către repository-ul dedicat. Textele rămân în cele patru limbi: engleză, română, sârbă latină și sârbă chirilică.
- `README.md`: secțiunea Unit Atlas și tabelul cu adresele live trimit către repository-ul dedicat.
- `tests/` și `.github/workflows/unit-atlas.yml`: suita verifică acum integrarea din pagina principală, nu aplicația mutată. Suita aplicației trăiește în repository-ul dedicat.

## Livrabil

`index.html` din repository-ul dedicat este întreaga aplicație: HTML, CSS, JavaScript, traduceri, factori de conversie și icon încorporat. Nu necesită build, biblioteci sau server de calcul. Fișierul poate fi deschis direct în browser. Butonul „Descarcă HTML” exportă documentul inițial, nu valorile introduse sau conversiile salvate.

Repository-ul dedicat publică și el un `sw.js` propriu: shell-ul aplicației (`./` și `./index.html`) este cache-uit sub cheia `atlas-v1`, cu navigare network-first și rezervă offline. Cache-ul acesta este independent de cache-ul sitului, care nu mai conține convertorul.

## Funcții

- 11 categorii internaționale: lungime, suprafață, volum, masă, temperatură, viteză, timp, presiune, energie, putere și stocare digitală.
- O categorie regională de teren, cu pogon, jugăr cadastral, lanac, jutro, dunum metric și stânjen vienez pătrat, alături de m², ar și hectar.
- 93 de intrări în listele de unități, incluzând unitățile de referință repetate în categoria regională.
- Engleză, română, sârbă latină și sârbă chirilică; numere formatate potrivit limbii.
- Căutare în categorii și unități, inclusiv în celelalte limbi.
- Conversie instantanee, inversare cu păstrarea rezultatului numeric complet și echivalente pentru întreaga categorie.
- 6, 10 sau 15 cifre semnificative; notație științifică pentru valori foarte mici sau mari.
- Maximum 20 de conversii salvate explicit, exclusiv în browser. Ștergere individuală sau totală cu confirmare.
- Copiere rezultat și link partajabil cu fragment URL, fără server sau scurtător de linkuri.
- Teme închisă și deschisă, suport tastatură, dialog explicativ, aspect pentru imprimare.

## Date, precizie și limite

`CATEGORIES` este sursa unică pentru unități și factori. Factorii au ca referință unitatea SI din categorie, cu excepția stocării digitale (octet). Temperatura folosește formule directe pentru fiecare pereche, nu un simplu raport.

Măsurile regionale sunt **convenții declarate**, nu afirmații despre orice document istoric:

- pogon metric: 5000 m²;
- jugăr / lanac / jutro cadastral: 1600 de stânjeni vienezi pătrați;
- stânjen vienez: 1,89648384 m;
- dunum metric: 1000 m².

Denumirile tradiționale au variații istorice și regionale. Pentru terenuri, tranzacții și acte juridice trebuie consultate actul original și cadastrul local. Aplicația afișează acest avertisment direct în categoria regională și în dialogul explicativ.

Aritmetica este IEEE 754. Valorile din afara intervalului numeric, numerele nevalide și temperaturile sub zero absolut sunt respinse. Virgula este separator zecimal, nu separator de mii. Spațiile de grupare sunt acceptate. Nu se folosesc cursuri valutare, valori culinare nedefinite sau luni/ani cu durată ambiguă.

## Confidențialitate și offline

Nu există cereri pentru fonturi, biblioteci, API-uri sau analytics în aplicație. Legăturile către surse sunt accesate numai dacă utilizatorul le deschide. Tema, limba și conversiile salvate folosesc cheile `atlas-*` din localStorage. Dacă stocarea este blocată, salvările rămân în fila curentă, cu avertisment.

Linkurile partajate includ valoarea și unitățile în fragment. Nu sunt trimise serverului ca parte a cererii HTTP, dar destinatarul linkului le vede. Descărcările HTML nu includ datele utilizatorului.

Fișierul descărcat funcționează offline fără service worker. La găzduire pe GitHub Pages, `sw.js` din repository-ul dedicat cache-uie shell-ul aplicației și servește pagina din cache când rețeaua lipsește. Service worker-ul sitului cache-uie doar pagina principală, pagina 404 și manifestul: nu livrează convertorul și nu cache-uie instrumentele externe. Nu se promite instalarea convertorului ca PWA separat.

## Verificare

Online, după deploy:

```sh
curl -sI https://tekideki.github.io/Unit-Converter/ | head -1        # 200
curl -s  https://tekideki.github.io/Unit-Converter/ | grep -c 'CATEGORIES'
curl -sI https://tekideki.github.io/Unit-Converter/sw.js | head -1    # 200
curl -sI https://freehtml.dev/convert | grep -i location              # 302 către GitHub Pages
```

Offline: după o primă vizită, aplicația se deschide din cache-ul `atlas-v1` al propriului service worker. Suita de teste din repository-ul dedicat comută contextul în mod offline și verifică acest lucru, alături de conversii, traduceri, accesibilitate și fișierul HTML descărcabil.

## Verificare locală

Aplicația nu necesită Node. Pentru vizualizare, din repository-ul dedicat:

```sh
python3 -m http.server 8080 --bind 0.0.0.0
```

Deschide `/`. Pentru suita de dezvoltare, separată de aplicația livrată:

```sh
npm ci
npx playwright install --with-deps chromium
# Cu serverul de mai sus pornit într-un alt terminal:
npm test
```

Opțional: `ATLAS_BASE` schimbă adresa serverului; `ATLAS_CHROMIUM_PATH` alege un executabil Chromium existent.

Suita verifică 787 de perechi de conversie dus-întors, valori de referință, parsarea numerelor, traduceri, salvare, clipboard, linkuri, HTML portabil fără rețea, shell-ul offline, patru lățimi de ecran (320, 375, 768 și 1440 px) și audit axe WCAG A/AA pe ambele teme și dialog. Auditul automat nu înlocuiește evaluarea manuală cu tehnologii asistive. Workflow-ul GitHub rulează aceeași suită la PR și push relevant.

În acest repository, suita verifică pagina principală: cele 12 carduri, căutarea Unit Atlas în cele patru limbi, scurtătura `/convert/`, cache-ul shell-ului și faptul că pagina principală nu mai conține copia convertorului.

## Convenție de tipografie

În tot ce se scrie pentru acest proiect se folosește „-” (cratime), nu linia lungă. Fișierul HTML livrat nu conține cratime lungă (U+2014), iar suita de teste verifică acest lucru la fiecare descărcare.
