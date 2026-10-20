#!/usr/bin/env python3
"""Local Playwright checks for the Text-to-Speech Reader hub integration."""
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


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
    with serve_site() as base, sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_PATH") or None,
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--no-zygote"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page_errors = []
        console_errors = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.goto(base, wait_until="networkidle")

        cards = page.locator('.card[data-slug]').count()
        assert cards > 0
        card = page.locator('.card[data-slug="tts-reader"]')
        assert card.count() == 1
        assert card.locator(".card-title a").get_attribute("href") == "https://tekideki.github.io/Text-to-Speech-Reader/"
        assert card.locator('a[data-i18n="src"]').get_attribute("href") == "https://github.com/TekiDeki/Text-to-Speech-Reader"
        assert card.locator(".size").inner_text().lower() == "no audio export"
        assert page.locator("#count").inner_text() == "%d / %d" % (cards, cards)

        shortcut = page.locator("#shortcutList .sc-row").filter(has_text="freehtml.dev/tts-reader")
        assert shortcut.count() == 1
        assert shortcut.locator(".copy").get_attribute("data-copy") == "https://freehtml.dev/tts-reader"
        redirects = (ROOT / "site" / "_redirects").read_text(encoding="utf-8")
        assert any(line.split() == ["/tts-reader", "https://tekideki.github.io/Text-to-Speech-Reader/", "302"] for line in redirects.splitlines())
        service_worker = (ROOT / "site" / "sw.js").read_text(encoding="utf-8")
        assert "'/tts-reader'" in service_worker

        expected = {
            "en": ("en", "Listen to your text"),
            "ro": ("ro", "Ascultă textul"),
            "sr-latn": ("sr-Latn", "Slušaj tekst"),
            "sr-cyr": ("sr-Cyrl", "Слушај текст"),
        }
        for language, (html_lang, phrase) in expected.items():
            page.locator("#langBtn").click()
            page.locator(f'#langList button[data-lang="{language}"]').click()
            assert page.locator("html").get_attribute("lang") == html_lang
            assert page.locator("#count").inner_text() == "%d / %d" % (cards, cards)
            assert phrase in card.locator(".card-tag").inner_text(), language
            assert card.is_visible(), language

        assert page_errors == [], page_errors
        assert console_errors == [], console_errors
        browser.close()
    print("PASS: hub card, links, shortcut, counted card counter, four locales, and zero browser errors.")


if __name__ == "__main__":
    main()
