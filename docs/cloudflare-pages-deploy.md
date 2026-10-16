# freeHTML.dev - Cloudflare, ghid de deploy

Ghid pentru publicarea sitului din `site/` pe Cloudflare, pentru domeniul `freehtml.dev`.

Valorile specifice infrastructurii (IP-uri, furnizorul de hosting, serverul de e-mail) nu sunt scrise în repository. Acolo unde apar, folosește placeholderele din tabelul de mai jos.

| Placeholder | Ce reprezintă |
|---|---|
| `<IP-MAIL>` | adresa IPv4 a serverului de e-mail, cea din înregistrarea `A mail` din zona veche |
| `<NS-VECHI-1>`, `<NS-VECHI-2>` | nameserverele actuale ale domeniului, la registrator |
| `<NS-CF-1>`, `<NS-CF-2>` | nameserverele primite de la Cloudflare la adăugarea zonei |

**Regula de bază:** emailul se mută înainte de nameserverele. Fă pașii în ordinea de mai jos. Dacă sari peste pasul 2, migrarea poate opri e-mailul domeniului.

---

## 0. Inventar înainte de orice modificare

Înainte să atingi ceva, notează înregistrările existente din panoul DNS actual:

| Înregistrare | De ce contează |
|---|---|
| `A @` | serverul care răspunde acum pe domeniu |
| `A mail` | serverul de e-mail (`<IP-MAIL>`), trebuie să rămână DNS-only |
| `MX` | serverul care primește e-mailul domeniului |
| `TXT` SPF | autorizează serverele care trimit e-mail |
| `TXT _dmarc` și `TXT default._domainkey` | semnătura și politica DMARC/DKIM, dacă există |
| subdomeniile de servicii (calendar, contacte, webmail) | de verificat dacă sunt folosite |

---

## 1. Pas cu pas

### Pasul 1 - Adaugă zona în Cloudflare

1. În dashboard: **Websites → Add a site** → `freehtml.dev` → planul **Free**.
2. Cloudflare scanează DNS-ul existent și importă înregistrările.
3. **Nu apăsa încă pe „Done / Continue” la final.** Mai întâi fă pasul 2.

### Pasul 2 - Salvează e-mailul (obligatoriu, înainte de mutarea nameserverelor)

În **DNS → Records**, pentru zona proaspăt importată:

1. Verifică `A mail` → `<IP-MAIL>` cu **Proxy OFF** (nor gri, „DNS only”).
   Traficul SMTP nu trece prin proxy-ul Cloudflare, deci are nevoie de IP-ul real.
2. Schimbă `MX` din `freehtml.dev` în `mail.freehtml.dev`, prioritate `0`.
   *De ce:* după migrare, apexul (`freehtml.dev`) devine o înregistrare proxată către Pages.
   Un `MX` care arată spre o înregistrare proxată nu funcționează, pentru că serverele de e-mail
   nu pot livra SMTP către IP-urile proxy-ului Cloudflare.
3. Păstrează SPF așa cum e, dacă `+ip4:<IP-MAIL>` sau `+mx` acoperă serverul. Copiază manual în Cloudflare
   înregistrările DKIM (`default._domainkey`) și DMARC (`_dmarc`), dacă există. Scanerul nu le vede întotdeauna.
4. Verificare, după pasul 4 (când propagarea e gata):
   - `dig MX freehtml.dev +short` → `0 mail.freehtml.dev`
   - `dig A mail.freehtml.dev +short` → `<IP-MAIL>`

   Trimite un e-mail de test și confirmă livrarea (inclusiv în Gmail sau Outlook).

### Pasul 3 - Pregătește apexul pentru Pages

- Înregistrarea `A @` importată de Cloudflare intră în conflict cu domeniul personalizat al Pages.
  O ștergi la pasul 6, când Cloudflare îți cere explicit asta și îți arată care înregistrare.
- Până atunci, poți lăsa `A @` cu proxy OFF sau ON. Situl vechi rămâne accesibil.

### Pasul 4 - Mută nameserverele la registrator

1. Cloudflare îți dă doi nameserveri (`<NS-CF-1>`, `<NS-CF-2>`).
2. În panoul unde e administrat domeniul, înlocuiește `<NS-VECHI-1>` și `<NS-VECHI-2>` cu cei de la Cloudflare.
3. Dacă registratorul are **DNSSEC** activat pe `.dev`, dezactivează-l înainte de mutare, apoi reactivează-l
   din Cloudflare (care îți dă înregistrările DS noi). Altfel, domeniul poate rezolva ca „broken”.
4. Propagarea durează de obicei minute, oficial până la 24 de ore. Verifică cu `dig NS freehtml.dev +short`.

### Pasul 5 - Creează proiectul Pages din acest repository

**Workers & Pages → Create application → Pages → Connect to Git**

| Câmp | Valoare |
|---|---|
| Repository | `TekiDeki/TekiDeki` |
| Production branch | `main` |
| Framework preset | `None` |
| **Root directory** | `site` |
| Build command | *(gol: nu există pas de build, e HTML static)* |
| Build output directory | *(gol)* |

Deploy. Primești imediat o adresă `https://<nume-proiect>.pages.dev`. `_headers`, `_redirects`,
`robots.txt`, `sitemap.xml` și `404.html` sunt active fără configurare suplimentară.

> **Notă:** repository-ul conține și `wrangler.jsonc`, cu `assets.directory` pe `./site`, adică o configurație de Workers cu assets.
> Înainte de a conecta proiectul, confirmă în dashboard ce produs Cloudflare deservește `main` (Pages sau Workers),
> ca să nu existe două deploy-uri concurente pentru același site.

> **Variantă fără Git** (deploy manual, de pe calculatorul tău):
> ```bash
> npx wrangler login
> npx wrangler pages deploy site --project-name freehtml-dev
> ```
> Fiecare rulare publică o versiune nouă. Rollback-ul e un click în dashboard.

### Pasul 6 - Leagă domeniul

1. În proiectul Pages: **Custom domains → Add custom domain** → `freehtml.dev`.
2. Cloudflare detectează conflictul cu `A @` și propune înlocuirea lui cu un CNAME către
   `<nume-proiect>.pages.dev` (apex flattening). Acceptă.
3. SSL: certificatul Universal SSL se emite singur în câteva minute. TLS 1.3 și HTTP/3 sunt active automat.
4. **www:** recomandat este o regulă de redirect (nu un al doilea domeniu personalizat):
   **Rules → Redirect Rules → Create rule**
   - *When:* `Hostname` `equals` `www.freehtml.dev`
   - *Then:* `Static` → `https://freehtml.dev/`, cu path și query păstrate, status **301**

   Dacă Pages răspunde înaintea regulii, alternativ adaugă `www.freehtml.dev` ca al doilea domeniu personalizat în Pages.

### Pasul 7 - Verificare finală

```bash
# situl răspunde și trimite header-ele din _headers
curl -sI https://freehtml.dev/ | grep -iE "HTTP/|content-security|x-content-type"

# scurtăturile fac 302 către uneltele de pe GitHub Pages
curl -sI https://freehtml.dev/cheaper | grep -i location

# 404-ul personalizat
curl -s -o /dev/null -w "%{http_code}\n" https://freehtml.dev/nu-exista

# e-mailul a supraviețuit mutării
dig MX freehtml.dev +short          # → 0 mail.freehtml.dev
dig A  mail.freehtml.dev +short     # → <IP-MAIL>, cu proxy OFF în dashboard
```

Apoi: PageSpeed Insights (țintă 100/100/100/100; situl nu are niciun request terț) și ssllabs.com (țintă A+).

---

## 2. Ce primești gratuit de la Cloudflare

- **Pages:** lățime de bandă nelimitată, 500 de build-uri pe lună, deploy-uri cu URL propriu și rollback.
- **Edge:** CDN global, Brotli, HTTP/3, TLS 1.3 și protecție DDoS de bază, fără configurare.
- **`_headers` și `_redirects`:** respectate automat la fiecare deploy (CSP-ul și redirecturile 302 din repository).
- **Statistici de zonă:** trafic măsurat pe server, fără niciun script în pagină. Este singura formă de analitică
  compatibilă cu principiul „zero tracking”. Cloudflare Web Analytics adaugă un script terț în pagină, deci nu se folosește.
- **Redirect Rules și Cache Rules:** pentru www → apex și pentru orice scurtătură viitoare.

## 3. De ce scurtăturile din `_redirects` sunt 302, nu 301

Uneltele rămân canonice pe `tekideki.github.io/...`, unde sunt deja funcționale service worker-ul, manifestul și
instalarea ca PWA. Un 301 ar învăța browserele și motoarele de căutare că adresa de pe GitHub Pages a dispărut.
Când (dacă) o unealtă se mută pe `freehtml.dev`, se șterg liniile ei din `_redirects` și se servește direct din `site/`.

## 4. Rollback

- **Sit:** fiecare deploy Pages are URL propriu și buton de *Restore*. Repository-ul este sursa adevărului (`site/` din `main`).
- **Domeniu:** nameserverele vechi (notate la pasul 0) pot fi puse înapoi oricând. Serverul vechi rămâne neatins
  până când e-mailul și situl merg de pe Cloudflare.
- **E-mail:** dacă ceva nu merge după mutare, corectezi `MX` și `A mail` în Cloudflare DNS.
  Propagarea durează câteva minute, cu TTL mic recomandat (300 de secunde).
