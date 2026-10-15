# freehtml.dev → Cloudflare Pages · ghid de deploy

Ghid pentru mutarea sitului din `site/` pe Cloudflare Pages, cu domeniul `freehtml.dev`.
Tot ce e mai jos e verificat pe DNS-ul public la data de **2026-10-15**.

---

## 0. Starea reală a domeniului (înainte să atingi ceva)

| Ce | Valoare curentă | Ce înseamnă |
|---|---|---|
| Nameservere | `ns3.extreme-prohosting.com`, `ns4.extreme-prohosting.com` | Zona **NU** e încă pe Cloudflare. Domeniul e administrat de extreme-prohosting. |
| `A @` | `176.9.52.113` (Hetzner) | Un server de hosting clasic răspunde acum pe domeniu. |
| `A mail` | `176.9.52.113` | Același server. |
| `MX` | `0 freehtml.dev` | **Emailul e live pe acest domeniu**, servit de același server. |
| `TXT` (SPF) | `v=spf1 +a +mx +ip4:176.9.52.113 ~all` | Există configurare de email (SPF). Verifică și `_dmarc` / `default._domainkey` în panoul vechi. |

**Consecința importantă:** migrarea nameserverelor nu e doar „pun situl pe Cloudflare”,
ci o mutare care poate **opri emailul** dacă sari peste pasul 2. Fă pașii în ordine.

---

## UPDATE 2026-10-15 — zona e ACTIVĂ pe Cloudflare. Trei lucruri de făcut acum

Verificat din DNS-ul public după activare:

| Înregistrare | Ce am găsit | Corect |
|---|---|---|
| `SOA` | `carl.ns.cloudflare.com` | ✅ zona e activă (NS-ul la parent `.dev` se propagă încă câteva ore — normal) |
| `A mail` | `104.21.38.92` / `172.67.221.122` = **IP-uri de proxy Cloudflare** | ❌ înregistrarea `mail` a fost importată **proxată (nor portocaliu)**. SMTP-ul nu merge prin proxy → **pune-o DNS-only (nor gri)** |
| `MX` | `0 freehtml.dev` (apex, proxat) | ❌ schimbă-l în `mail.freehtml.dev`, prioritate `0` |
| `TXT` SPF | `v=spf1 +a +mx +ip4:176.9.52.113 ~all` | ✅ rămâne valid și după corecții (`+mx` și `+ip4` acoperă serverul) |
| `TXT _dmarc` | `v=DMARC1; p=none;` | ✅ importat corect |
| `TXT default._domainkey` | cheia DKIM completă | ✅ importat corect — emailul semnat continuă să funcționeze |
| `A @` | proxat, încă `176.9.52.113` dedesubt | ⏳ se înlocuiește cu CNAME-ul Pages la pasul 6 |

**De făcut în dashboard, în ordinea asta (2 minute):**

1. **DNS → Records → `mail`** → Edit → **Proxy status: OFF (DNS only)** → Save.
   Trebuie să rezolve din nou la `176.9.52.113`, nu la IP-uri Cloudflare.
2. **DNS → Records → `MX`** → Edit → Mail server: `mail.freehtml.dev`, prioritate `0` → Save.
3. Test: `dig MX freehtml.dev +short` → `0 mail.freehtml.dev`;
   `dig A mail.freehtml.dev +short` → `176.9.52.113`. Trimite-ți un email de test
   (Gmail → tine) și confirmă livrarea.

Abia după ce emailul e verde treci la pasul 5 (proiectul Pages) și pasul 6 (custom domain) —
pentru că pasul 6 înlocuiește `A @` cu un CNAME proxat, moment din care un MX spre apex
ar fi fost oricum imposibil.

---

## 1. Pas cu pas

### Pasul 1 — Adaugă zona în Cloudflare

1. În dashboard: **Websites → Add a site** → `freehtml.dev` → plan **Free** (e suficient pentru tot ce urmează).
2. Cloudflare scanează DNS-ul existent și importă înregistrările (`A`, `MX`, `TXT`).
3. **Nu apăsa încă pe „Done / Continue” la final** — mai întâi pasul 2.

### Pasul 2 — Salvează emailul (obligatoriu, înainte de mutarea NS)

În **DNS → Records** (zona proaspăt importată):

1. Adaugă/verifică: `A  mail  176.9.52.113`  cu **Proxy OFF** (nor gri, „DNS only”).
   Emailul nu poate trece niciodată prin proxy-ul Cloudflare — SMTP-ul are nevoie de IP-ul real.
2. Schimbă înregistrarea `MX` din `freehtml.dev` în `mail.freehtml.dev`, prioritate `0`.
   *De ce:* după migrare, apex-ul (`freehtml.dev`) devine un CNAME aplatizat către Pages, proxat.
   Un `MX` care arată spre o înregistrare proxată nu funcționează — serverele de mail nu pot
   livra SMTP către IP-urile de proxy Cloudflare.
3. Păstrează `TXT` cu SPF așa cum e (`+ip4:176.9.52.113` acoperă serverul indiferent de nume).
   Dacă în panoul vechi există și `DKIM` (`default._domainkey.freehtml.dev` etc.) sau `_dmarc`,
   copiază-le manual în Cloudflare — scanerul nu le vede întotdeauna.
4. Verificare după pasul 4: `dig MX freehtml.dev +short` trebuie să dea `0 mail.freehtml.dev`,
   iar `dig A mail.freehtml.dev +short` trebuie să dea `176.9.52.113`. Trimite-ți un email de test.

### Pasul 3 — Pregătește apex-ul pentru Pages

- Înregistrarea `A @ → 176.9.52.113` importată de Cloudflare **intră în conflict** cu custom domain-ul
  Pages. O ștergi la pasul 5, când Cloudflare îți cere explicit asta (îți arată el care).
- Până atunci, las-o proxată OFF sau ON — nu contează, situl vechi rămâne accesibil.

### Pasul 4 — Mută nameserverele la registrator

1. Cloudflare îți dă doi nameserveri (ex. `anna.ns.cloudflare.com` / `bob.ns.cloudflare.com`).
2. În panoul unde e cumpărat/administrat domeniul (extreme-prohosting sau registratorul),
   înlocuiește `ns3/ns4.extreme-prohosting.com` cu cei doi de la Cloudflare.
3. Dacă registratorul are **DNSSEC** activat pe `.dev`: dezactivează-l înainte de mutare,
   apoi reactivează-l din Cloudflare (îți dă DS records noi). Altfel domeniul poate rezolva „broken”.
4. Propagare: de obicei minute; oficial până la 24 h. Verifică cu `dig NS freehtml.dev +short`.

### Pasul 5 — Creează proiectul Pages din acest repo

**Workers & Pages → Create application → Pages → Connect to Git**

| Câmp | Valoare |
|---|---|
| Repository | `TekiDeki/TekiDeki` |
| Production branch | `main` (după ce branch-ul `arena/…` e combinat în `main`) |
| Framework preset | `None` |
| **Root directory** | `site` |
| Build command | *(gol — nu există build step, e HTML curat)* |
| Build output directory | *(gol)* |

Deploy. Primești imediat `https://<nume-proiect>.pages.dev`, cu `_headers`, `_redirects`,
`robots.txt`, `sitemap.xml` și `404.html` deja active — nu trebuie configurat nimic suplimentar.

> **Variantă fără Git** (deploy manual de pe laptopul tău):
> ```bash
> npx wrangler login
> npx wrangler pages deploy site --project-name freehtml-dev
> ```
> Fiecare rulare publică o versiune nouă; rollback = un click în dashboard.

### Pasul 6 — Leagă domeniul

1. În proiectul Pages: **Custom domains → Add custom domain** → `freehtml.dev`.
2. Cloudflare detectează conflictul cu `A @` și îți propune să-l înlocuiască cu CNAME-ul către
   `<nume-proiect>.pages.dev` (apex flattening). Acceptă.
3. SSL: Universal SSL se emite singur în câteva minute; TLS 1.3 + HTTP/3 active automat.
4. **www:** recomand o Redirect Rule (nu un al doilea custom domain):
   **Rules → Redirect Rules → Create rule**
   - *When:* `Hostname` `equals` `www.freehtml.dev`
   - *Then:* `Static` → `https://freehtml.dev/`, păstrează path + query, status **301**
   Dacă observi că Pages răspunde înainte de regulă, alternativ: adaugă și `www.freehtml.dev`
   ca al doilea custom domain în Pages.

### Pasul 7 — Checklist final

```bash
# situl răspunde și trimite header-ele din _headers
curl -sI https://freehtml.dev/ | grep -iE "HTTP/|content-security|x-content-type"

# scurtăturile fac 302 către uneltele de pe GitHub Pages
curl -sI https://freehtml.dev/cheaper | grep -i location

# 404-ul personalizat
curl -s -o /dev/null -w "%{http_code}\n" https://freehtml.dev/nu-exista

# emailul a supraviețuit mutării
dig MX freehtml.dev +short          # → 0 mail.freehtml.dev
dig A  mail.freehtml.dev +short     # → 176.9.52.113  (și proxy OFF în dashboard)
```

Apoi: PageSpeed Insights (țintă 100/100/100/100 — situl nu are niciun request terț)
și ssllabs.com (țintă A+).

---

## 2. Ce primești gratis de la Cloudflare aici

- **Pages:** bandwidth nelimitat, 500 build-uri/lună, deploy-uri cu URL propriu + rollback.
- **Edge:** CDN global, Brotli, HTTP/3, TLS 1.3, DDoS basic — fără niciun config.
- **`_headers` / `_redirects`:** respectate automat la fiecare deploy (CSP-ul și 302-urile din repo).
- **Zone analytics:** statistici de trafic *server-side*, fără niciun script în pagină —
  singura formă de „analitică” care nu contrazice principiul „zero tracking”.
  (Cloudflare Web Analytics ar băga un script terț în pagină → nu-l folosi.)
- **Redirect Rules / Cache Rules:** pentru www→apex și orice scurtătură viitoare.

## 3. De ce scurtăturile din `_redirects` sunt 302, nu 301

Uneltele rămân canonice pe `tekideki.github.io/…`, unde au service worker, manifest și
instalare PWA deja funcționale. Un 301 ar învăța browserele și Google că adresa de pe
GitHub Pages „a dispărut”. Când (dacă) muți uneltele *pe* freehtml.dev, ștergi liniile
corespunzătoare din `_redirects` și le servești direct din `site/`.

## 4. Rollback

- **Sit:** fiecare deploy Pages are URL propriu și buton de *Restore*; iar repo-ul e sursa
  adevărului (`site/` + branch istoric).
- **Domeniu:** nameserverele pot fi puse înapoi pe `ns3/ns4.extreme-prohosting.com` oricând;
  vechiul server rămâne neatins până confirmi că emailul și situl merg de pe Cloudflare.
- **Email:** dacă ceva e în neregulă după mutare, corectezi MX/A `mail` în Cloudflare DNS
  (propagare în minute, TTL mic recomandat: 300).
