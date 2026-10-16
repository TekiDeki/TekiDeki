# Unit Atlas - convertor de unități

## Livrabil

`site/convert/index.html` este întreaga aplicație: HTML, CSS, JavaScript, traduceri, factori de conversie și icon încorporat. Nu necesită build, biblioteci sau server de calcul. Fișierul poate fi deschis direct în browser. Butonul „Descarcă HTML” exportă documentul inițial, nu valorile introduse sau conversiile salvate.

Adresa prevăzută pentru producție: **https://freehtml.dev/convert/**.

Aplicația este găzduită în acest repository, nu în repository-ul separat `Unit-Converter`. Integrarea de publicare existentă pentru acest sit poate publica `site/` după includerea modificărilor în ramura de producție. Nu este nevoie de un al doilea deployment pentru convertor. Confirmarea unui build GitHub/Cloudflare nu înlocuiește verificarea adresei publice.

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

Fișierul descărcat funcționează offline fără service worker. La găzduirea pe sit, `/sw.js` cachează separat pagina principală, convertorul și pagina 404. Nu livrează convertorul în locul paginii principale și nu cachează instrumentele externe. Service worker-ul este infrastructura sitului, nu o dependență a fișierului portabil. Nu se promite instalarea convertorului ca PWA separat.

## Verificare locală

Aplicația nu necesită Node. Pentru vizualizare:

```sh
python3 -m http.server 8080 --bind 0.0.0.0 --directory site
```

Deschide `/convert/`. Pentru suita de dezvoltare, separată de aplicația livrată:

```sh
npm ci
npx playwright install --with-deps chromium
# Cu serverul de mai sus pornit într-un alt terminal:
npm test
```

Opțional: `ATLAS_BASE` schimbă adresa serverului; `ATLAS_CHROMIUM_PATH` alege un executabil Chromium existent.

Suita verifică 787 de perechi de conversie dus-întors, valori de referință, parsarea numerelor, traduceri, salvare, clipboard, linkuri, HTML portabil fără rețea, integrarea în pagina principală, navigarea offline, patru lățimi de ecran (320, 375, 768 și 1440 px) și audit axe WCAG A/AA pe ambele teme și dialog. Auditul automat nu înlocuiește evaluarea manuală cu tehnologii asistive. Workflow-ul GitHub rulează aceeași suită la PR și push relevant.

## Integrarea în pagina principală

Card și scurtătură nouă `/convert/`, texte în cele patru limbi, index de căutare existent reutilizat, contor actualizat de la 11 la 12, README și sitemap actualizate. Scurtăturile celorlalte unelte rămân neschimbate. Scriptul terț Cloudflare Web Analytics, incompatibil cu promisiunea „fără urmărire” și cu CSP-ul existent, a fost eliminat din HTML-ul paginii principale.
