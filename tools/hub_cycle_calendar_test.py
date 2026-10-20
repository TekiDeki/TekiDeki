#!/usr/bin/env python3
"""Local Playwright checks for the Cycle Calendar hub integration.

    python3 tools/hub_cycle_calendar_test.py

Verifies the card, the shortcut, the counter, the translations in all four
languages, the redirect and the cache version, and that nothing throws in the
page or the console.
"""
import os
import re
import threading
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
APP = "https://tekideki.github.io/Cycle-Calendar/"
SOURCE = "https://github.com/TekiDeki/Cycle-Calendar"
SHORT = "https://freehtml.dev/cycle-calendar"
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
    with serve_site() as base, sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_PATH") or None,
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--no-zygote"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page_errors = []
        console_errors = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.goto(base + "/", wait_until="networkidle")

        # ------------------------------------------------------- counter + card
        cards = page.locator(".card[data-slug]").count()
        check(cards > 0, "the hub shows its cards")
        check(page.locator("#count").inner_text() == "%d / %d" % (cards, cards),
              "the visible counter matches the card count")
        check(page.locator(".stat b").first.inner_text() == str(cards),
              "the stat block shows the card count")

        card = page.locator('.card[data-slug="cycle-calendar"]')
        check(card.count() == 1, "exactly one Cycle Calendar card exists")
        check(card.locator(".card-title a").get_attribute("href") == APP, "the card title links to the app")
        check(card.locator(".card-title a").inner_text() == "Cycle Calendar", "the card title is right")
        check(card.locator("a.btn-primary").get_attribute("href") == APP, "the Open button links to the app")
        check(card.locator('a[data-i18n="src"]').get_attribute("href") == SOURCE, "the Source button links to the repo")
        check(card.get_attribute("data-tags") == "health", "the card uses the existing health tag")
        check(card.locator(".feats li").count() == 4, "the card lists four features")
        check(len(card.locator(".card-desc").inner_text()) > 60, "the card has a real description")

        # ---------------------------------------------------------- the shortcut
        row = page.locator("#shortcutList .sc-row").filter(has_text="freehtml.dev/cycle-calendar")
        check(row.count() == 1, "exactly one shortcut row for /cycle-calendar")
        check(row.locator(".target").inner_text() == "Cycle Calendar", "the shortcut names the tool")
        check(row.locator(".copy").get_attribute("data-copy") == SHORT, "the copy button carries the short url")

        # -------------------------------------------------------------- redirect
        redirects = (SITE / "_redirects").read_text(encoding="utf-8")
        lines = [entry for entry in redirects.splitlines() if entry.startswith("/cycle-calendar")]
        check(len(lines) == 2, "_redirects has the /cycle-calendar and /cycle-calendar/ rules")
        for line in lines:
            check(line.split()[1] == APP, "the redirect points at the GitHub Pages app")
            check(line.strip().endswith("302"), "the redirect is a 302, not a 301")

        # ------------------------------------------------------------- sw version
        sw = (SITE / "sw.js").read_text(encoding="utf-8")
        check("'/cycle-calendar'" in sw, "the service worker knows the /cycle-calendar shortcut")
        version = re.search(r"const VERSION = '([^']+)'", sw)
        check(version is not None, "the service worker declares a cache version")
        check(re.fullmatch(r"fhd-v\d+-[a-z0-9-]+", version.group(1)) is not None,
              "the cache version follows the fhd-vN-name shape")

        # --------------------------------------------------------- four locales
        expected = [
            ("en", "Your cycle, on your device."),
            ("ro", "Ciclul tău, pe dispozitivul tău."),
            ("sr-latn", "Tvoj ciklus, na tvom uređaju."),
            ("sr-cyr", "Твој циклус, на твом уређају."),
        ]
        for language, tag in expected:
            page.locator("#langBtn").click()
            page.locator('#langList button[data-lang="%s"]' % language).click()
            page.wait_for_timeout(150)
            check(card.locator(".card-title a").inner_text() == "Cycle Calendar", "%s: the card title is right" % language)
            check(card.locator(".card-tag").inner_text() == tag, "%s: the card tag is translated" % language)
            check(len(card.locator(".card-desc").inner_text()) > 60, "%s: the card description is translated" % language)
            check(card.locator(".size").inner_text() != "", "%s: the badge is translated" % language)

        # the search finds the new tool in every language
        for language, query in (("en", "cycle"), ("ro", "ciclul"), ("sr-latn", "ciklus"), ("sr-cyr", "циклус")):
            page.locator("#langBtn").click()
            page.locator('#langList button[data-lang="%s"]' % language).click()
            page.wait_for_timeout(150)
            page.locator("#q").fill(query)
            check(card.is_visible(), "%s: search finds the card for %r" % (language, query))
        page.locator("#q").fill("")

        # ------------------------------------------------------------ no errors
        check(not page_errors, "no page errors: %s" % page_errors[:3])
        check(not console_errors, "no console errors: %s" % console_errors[:3])
        browser.close()

    print("hub cycle calendar test: %d checks passed" % checks[0])


if __name__ == "__main__":
    main()
