#!/usr/bin/env python3
"""Local Playwright checks for the PDF to Images hub integration.

    python3 tools/hub_pdf_to_images_test.py

Every count is read from the page, never typed in here: the card total, the
visible counter, the hero stat and the heading all have to agree.
"""
import re
import threading
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
APP = "https://tekideki.github.io/PDF-to-Images/"
SOURCE = "https://github.com/TekiDeki/PDF-to-Images"
SHORT = "https://freehtml.dev/pdfimg"
checks = [0]


def check(condition, message):
    checks[0] += 1
    if not condition:
        raise AssertionError(message)


@contextmanager
def serve_site():
    handler = partial(SimpleHTTPRequestHandler, directory=str(SITE))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        thread.join(timeout=3)
        server.server_close()


def main():
    html = (SITE / "index.html").read_text(encoding="utf-8")
    total = len(re.findall(r'<article class="card reveal"[^>]*data-slug="', html))
    slugs = re.findall(r'<article class="card reveal"[^>]*data-slug="([^"]+)"', html)
    shortcuts = re.findall(r'data-copy="https://freehtml\.dev/([a-z0-9-]+)"', html)
    check(total > 0, "the source lists cards")
    check(len(slugs) == total, "every card carries a slug")
    check(set(shortcuts) <= set(slugs), "every shortcut belongs to a card: %s" % (set(shortcuts) - set(slugs)))
    check("pdfimg" in shortcuts, "the PDF to Images shortcut is in the list")

    with serve_site() as base, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True,
                                            args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page_errors, console_errors = [], []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on("console",
                lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.goto(base + "/", wait_until="networkidle")

        cards = page.locator(".card[data-slug]").count()
        check(cards == total, "the hub lists every card (found %d, expected %d)" % (cards, total))
        check(page.locator("#count").inner_text() == "%d / %d" % (total, total),
              "the visible counter matches the card count")
        check(page.locator("#statTools").inner_text() == str(total), "the hero stat shows the same number")
        check(page.locator("#tools-h").inner_text().startswith(str(total)),
              "the tools heading shows the same number")

        card = page.locator('.card[data-slug="pdfimg"]')
        check(card.count() == 1, "exactly one PDF to Images card exists")
        check(card.locator(".card-title a").get_attribute("href") == APP, "the card title links to the app")
        check(card.locator(".card-title a").inner_text() == "PDF to Images", "the card title is right")
        check(card.locator("a.btn-primary").get_attribute("href") == APP, "the Open button links to the app")
        check(card.locator('a[data-i18n="src"]').get_attribute("href") == SOURCE,
              "the Source button links to the repo")
        check(card.get_attribute("data-tags") in ("media", "dev", "media dev"),
              "the card uses an existing tag")
        check(card.locator(".feats li").count() >= 4, "the card lists its features")
        check(len(card.locator(".card-desc").inner_text()) > 60, "the card has a real description")

        row = page.locator("#shortcutList .sc-row").filter(has_text="freehtml.dev/pdfimg")
        check(row.count() == 1, "exactly one shortcut row for /pdfimg")
        check(row.locator(".target").inner_text() == "PDF to Images", "the shortcut names the tool")
        check(row.locator(".copy").get_attribute("data-copy") == SHORT, "the copy button carries the short url")

        redirects = (SITE / "_redirects").read_text(encoding="utf-8")
        lines = [entry for entry in redirects.splitlines() if entry.split() and entry.split()[0] in ("/pdfimg", "/pdfimg/")]
        check(len(lines) == 2, "_redirects has the /pdfimg and /pdfimg/ rules")
        for line in lines:
            check(line.split()[1] == APP, "the redirect points at the GitHub Pages app")
            check(line.strip().endswith("302"), "the redirect is a 302, not a 301")
        for slug in shortcuts:
            pair = [e for e in redirects.splitlines()
                    if e.split() and e.split()[0] in ("/" + slug, "/" + slug + "/")]
            check(len(pair) == 2, "the /%s shortcut has both lines, with and without the slash" % slug)

        sw = (SITE / "sw.js").read_text(encoding="utf-8")
        check("'/pdfimg'" in sw, "the service worker knows the /pdfimg shortcut")
        check(re.search(r"const VERSION = 'fhd-v\d+-[a-z0-9]+';", sw) is not None,
              "the cache version is a named fhd build")

        expected = [
            ("en", "Every page as a JPG or PNG, made in the tab."),
            ("ro", "Fiecare pagină ca JPG sau PNG, făcută în tab."),
            ("sr-latn", "Svaka stranica kao JPG ili PNG, u tabu."),
            ("sr-cyr", "Свака страница као JPG или PNG, у табу."),
        ]
        for language, tag in expected:
            page.locator("#langBtn").click()
            page.locator('#langList button[data-lang="%s"]' % language).click()
            page.wait_for_timeout(150)
            check(card.locator(".card-title a").inner_text() == "PDF to Images",
                  "%s: the card title is right" % language)
            check(card.locator(".card-tag").inner_text() == tag, "%s: the card tag is translated" % language)
            check(len(card.locator(".card-desc").inner_text()) > 60,
                  "%s: the card description is translated" % language)
            check(card.locator(".size").inner_text() != "", "%s: the badge is translated" % language)
            check(page.locator("#count").inner_text() == "%d / %d" % (total, total),
                  "%s: the counter keeps up" % language)

        searches = (("en", "ZIP"), ("ro", "Tragi"), ("sr-latn", "Ubaci"), ("sr-cyr", "Убаци"))
        for language, query in searches:
            page.locator("#langBtn").click()
            page.locator('#langList button[data-lang="%s"]' % language).click()
            page.wait_for_timeout(150)
            page.locator("#q").fill(query)
            page.wait_for_timeout(200)
            check(card.is_visible(), "%s: search finds the card for %r" % (language, query))
            shown = int(page.locator("#count").inner_text().split("/")[0])
            check(shown < total, "%s: search narrows the counter to %d" % (language, shown))
        page.locator("#q").fill("")
        page.wait_for_timeout(150)

        page.locator('#chips .chip[data-filter="dev"]').click()
        page.wait_for_timeout(200)
        check(card.is_visible(), "the dev filter shows the card")
        page.locator('#chips .chip[data-filter="all"]').click()

        check(not page_errors, "no page errors: %s" % page_errors[:3])
        check(not console_errors, "no console errors: %s" % console_errors[:3])
        browser.close()

    print("hub pdf to images test: %d checks passed" % checks[0])


if __name__ == "__main__":
    main()
