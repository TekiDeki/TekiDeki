#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build-tools.py - cardurile din hub, generate dintr-un registru.

De ce exista: pina acum fiecare unealta insemna 17,6 linii de HTML scrise de mina in
site/index.html - 30 de carduri, 528 de linii, cu cinci cimpuri usor de uitat pe fiecare
(data-tags, --hue, glyph, url, repo). Registrul `tools.json` tine datele o singura data,
iar scriptul de fata scrie HTML-ul. Pagina livrata ramine HTML static, fara un rind de
JavaScript nou: generarea se face la build, nu in browser.

Ce NU face: nu inventeaza text. Textele vin din dicționarele paginii, iar registrul pastreaza
cheia plus textul englez de rezerva (cel care se vede fara JavaScript). Ca sa nu se desparta
in timp, tests/tools-registry.cjs compara textul din registru cu dicționarul `en` al paginii.

Folosire:
  python3 scripts/build-tools.py --check   # 0 daca pagina e identica cu registrul, 1 daca nu
  python3 scripts/build-tools.py --write   # rescrie blocul de carduri in site/index.html

Comparatia din --check ignora spatiile dintre taguri: ele nu schimba ce se vede (lista de
features e `display:flex`, iar spatiile dintre elemente nu se randeaza), iar mina le-a pus
cind pe un rind, cind pe mai multe.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "site" / "index.html"
REGISTRU = ROOT / "tools.json"

START = '      <div class="grid" id="grid">\n\n'
END = '\n      </div>\n\n      <p class="empty" id="empty">'

CARD = '''        <article class="card reveal" data-tags="{tags}" data-slug="{slug}" style="--hue:{hue}">
          <div class="card-top">
            <span class="glyph" aria-hidden="true">{glyph}</span>
            <div>
              <h3 class="card-title"><a href="{url}" target="_blank" rel="noopener noreferrer">{name}</a></h3>
              <p class="card-tag" data-i18n="{tag_key}">{tag_text}</p>
            </div>
          </div>
          <p class="card-desc" data-i18n="{desc_key}">{desc_text}</p>
          <ul class="feats">{features}</ul>
          <div class="card-foot">
            <a class="btn btn-sm btn-primary" href="{url}" target="_blank" rel="noopener noreferrer" data-i18n="open">Open</a>
            <a class="btn btn-sm" href="{repo}" target="_blank" rel="noopener noreferrer" data-i18n="src">Source</a>
            <span class="size"{size_attr}>{size_text}</span>
          </div>
        </article>'''

CIMPURI = ("slug", "name", "url", "repo", "tags", "hue", "glyph", "tag", "desc", "features", "size")


def eroare(mesaj: str) -> None:
    print("build-tools: " + mesaj, file=sys.stderr)
    raise SystemExit(1)


def citeste_registru() -> list[dict]:
    try:
        date = json.loads(REGISTRU.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        eroare("tools.json nu e JSON valid: %s" % e)
    unelte = date.get("tools")
    if not isinstance(unelte, list) or not unelte:
        eroare("tools.json nu are lista `tools`")
    for i, u in enumerate(unelte):
        lipsa = [c for c in CIMPURI if c not in u]
        if lipsa:
            eroare("intrarea %d (%s) nu are: %s" % (i, u.get("slug", "?"), ", ".join(lipsa)))
        if not re.fullmatch(r"[a-z0-9-]+", u["slug"]):
            eroare("slug nepermis: %r" % u["slug"])
        if u["tags"] and not all(re.fullmatch(r"[a-z]+", t) for t in u["tags"]):
            eroare("%s: eticheta nepermisa in %s" % (u["slug"], u["tags"]))
        if not re.fullmatch(r"#[0-9a-f]{6}", u["hue"]):
            eroare("%s: --hue trebuie sa fie #rrggbb, e %r" % (u["slug"], u["hue"]))
        for cheie in ("url", "repo"):
            if not u[cheie].startswith("https://"):
                eroare("%s: %s trebuie sa fie https" % (u["slug"], cheie))
        if u["path"] and not re.fullmatch(r"/[a-z0-9-]+", u["path"]):
            eroare("%s: link scurt nepermis: %r" % (u["slug"], u["path"]))
    sluguri = [u["slug"] for u in unelte]
    if len(sluguri) != len(set(sluguri)):
        repetate = sorted({s for s in sluguri if sluguri.count(s) > 1})
        eroare("slug repetat: %s" % ", ".join(repetate))
    return unelte


def text_sau_cheie(valoare: dict, unde: str) -> tuple[str, str]:
    """(cheie, text) - cheia poate lipsi la textele care nu se traduc."""
    if not isinstance(valoare, dict) or not valoare.get("text"):
        eroare("%s: lipseste textul" % unde)
    return valoare.get("key") or "", valoare["text"]


def escapa(text: str) -> str:
    """Registrul tine textul curat (cu &, nu cu &amp;); pagina are nevoie de entitati."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def card_html(u: dict) -> str:
    tag_key, tag_text = text_sau_cheie(u["tag"], u["slug"] + ".tag")
    desc_key, desc_text = text_sau_cheie(u["desc"], u["slug"] + ".desc")
    size_key, size_text = text_sau_cheie(u["size"], u["slug"] + ".size")
    bucati = []
    for i, f in enumerate(u["features"], 1):
        cheie, text = text_sau_cheie(f, "%s.features[%d]" % (u["slug"], i))
        if cheie:
            bucati.append('<li data-i18n="%s">%s</li>' % (cheie, escapa(text)))
        else:
            bucati.append("<li>%s</li>" % escapa(text))
    return CARD.format(
        tags=" ".join(u["tags"]), slug=u["slug"], hue=u["hue"],
        # glifa e fie un caracter, fie un SVG scris de mina: doar textul se escapeaza
        glyph=(u["glyph"] if u["glyph"].lstrip().startswith("<") else escapa(u["glyph"])),
        name=escapa(u["name"]), url=u["url"], repo=u["repo"],
        tag_key=tag_key, tag_text=escapa(tag_text), desc_key=desc_key, desc_text=escapa(desc_text),
        features="".join(bucati),
        size_attr=' data-i18n="%s"' % size_key if size_key else "", size_text=escapa(size_text),
    )


def bloc_generat(unelte: list[dict]) -> str:
    return "\n\n".join(card_html(u) for u in unelte)


def imparte(pagina: str) -> tuple[str, str, str]:
    if START not in pagina:
        eroare("nu gasesc începutul listei de carduri în site/index.html")
    cap, rest = pagina.split(START, 1)
    if END not in rest:
        eroare("nu gasesc sfîrșitul listei de carduri în site/index.html")
    bloc, coada = rest.split(END, 1)
    return cap + START, bloc, END + coada


def normalizeaza(html: str) -> str:
    """Compara ce se vede, nu cum a fost asezat textul in editor."""
    return re.sub(r"\s+", " ", re.sub(r">\s+<", "><", html)).strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--lista", action="store_true", help="tipareste slugurile, cite unul pe rind")
    args = ap.parse_args()
    if not (args.check or args.write or args.lista):
        ap.print_help()
        raise SystemExit(2)

    unelte = citeste_registru()
    if args.lista:
        print("\n".join(u["slug"] for u in unelte))
        return

    pagina = INDEX.read_text(encoding="utf-8")
    cap, bloc_vechi, coada = imparte(pagina)
    bloc_nou = bloc_generat(unelte)

    if args.write:
        # scrie mereu: fisierul commit-uit trebuie sa fie exact ce iese din registru, nu o
        # varianta "echivalenta" pusa de mina - altfel --check si --write nu mai spun acelasi lucru
        inainte = pagina
        INDEX.write_text(cap + bloc_nou + coada, encoding="utf-8")
        stare = "neschimbat" if inainte == cap + bloc_nou + coada else "rescris"
        print("site/index.html %s: %d carduri din tools.json" % (stare, len(unelte)))
        return

    vechi, nou = normalizeaza(bloc_vechi), normalizeaza(bloc_nou)
    if vechi == nou:
        print("--check ok: %d carduri, pagina si registrul spun acelasi lucru" % len(unelte))
        return

    # prima diferenta, in context, ca sa se poata repara
    i = next((k for k in range(min(len(vechi), len(nou))) if vechi[k] != nou[k]), min(len(vechi), len(nou)))
    print("--check EȘUAT: cardurile din pagina nu se potrivesc cu tools.json")
    print("  în pagina : ..." + vechi[max(0, i - 60):i + 90].replace("\n", " "))
    print("  în registru: ..." + nou[max(0, i - 60):i + 90].replace("\n", " "))
    raise SystemExit(1)


if __name__ == "__main__":
    main()
