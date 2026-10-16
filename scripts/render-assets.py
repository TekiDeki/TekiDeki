#!/usr/bin/env python3
"""Render the freeHTML.dev brand assets (icons + OG card) with Pillow.

    python3 scripts/render-assets.py

Everything is drawn geometrically (no text-in-icon), so the mark looks the
same in the SVG favicon, the PNG icons and the maskable icon.
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "site", "assets")
FONTS = "/usr/share/fonts/truetype/dejavu"

TEAL = (79, 209, 197)
TEAL_DARK = (13, 143, 133)
AMBER = (246, 173, 85)
INK = (6, 18, 15)
BG = (8, 10, 14)
PANEL = (16, 20, 27)
TEXT = (233, 238, 245)
MUTED = (154, 167, 184)
FAINT = (109, 122, 139)

os.makedirs(OUT, exist_ok=True)


# --------------------------------------------------------------------------
# the </> mark
# --------------------------------------------------------------------------
def gradient(size: int) -> Image.Image:
    """Diagonal teal -> amber gradient (rendered small, then upscaled)."""
    base = 96
    g = Image.new("RGB", (base, base))
    px = g.load()
    for y in range(base):
        for x in range(base):
            t = (x + y) / (2 * (base - 1))
            t = t ** 1.15
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(TEAL, AMBER))
    return g.resize((size, size), Image.BICUBIC)


def rounded_mask(size: int, radius: float) -> Image.Image:
    ss = 4
    m = Image.new("L", (size * ss, size * ss), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size * ss - 1, size * ss - 1], radius=radius * ss, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def draw_glyph(d: ImageDraw.ImageDraw, size: int, inset: float, color=INK, width_scale: float = 1.0) -> None:
    """Draw '<' '/' '>' centred in the square, honouring `inset` (0..0.5)."""
    lo = size * inset
    hi = size * (1 - inset)
    box = hi - lo
    cx, cy = size / 2, size / 2
    w = box * 0.085 * width_scale

    # left chevron  <
    lx = lo + box * 0.10
    d.line([(lx + box * 0.20, cy - box * 0.24), (lx, cy), (lx + box * 0.20, cy + box * 0.24)],
           fill=color, width=int(round(w)), joint="curve")
    # right chevron >
    rx = hi - box * 0.10
    d.line([(rx - box * 0.20, cy - box * 0.24), (rx, cy), (rx - box * 0.20, cy + box * 0.24)],
           fill=color, width=int(round(w)), joint="curve")
    # slash /
    d.line([(cx + box * 0.055, cy - box * 0.27), (cx - box * 0.055, cy + box * 0.27)],
           fill=color, width=int(round(w)))


def icon(size: int, maskable: bool = False) -> Image.Image:
    ss = 4
    big = size * ss
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    grad = gradient(big).convert("RGBA")

    if maskable:
        # full bleed, glyph inside the 80% safe zone
        canvas.paste(grad, (0, 0))
        d = ImageDraw.Draw(canvas)
        draw_glyph(d, big, inset=0.275, width_scale=1.12)
    else:
        radius = big * 0.20
        m = rounded_mask(big, radius)
        canvas.paste(grad, (0, 0), m)
        d = ImageDraw.Draw(canvas)
        draw_glyph(d, big, inset=0.205, width_scale=1.12)

    out = canvas.resize((size, size), Image.LANCZOS)
    if not maskable:
        # hairline inner highlight so it reads on both light and dark UIs
        ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        rd = ImageDraw.Draw(ring)
        rd.rounded_rectangle([0.5, 0.5, size - 1, size - 1], radius=size * 0.20,
                             outline=(255, 255, 255, 60), width=1)
        out = Image.alpha_composite(out, ring)
    return out


def save(img: Image.Image, name: str) -> None:
    path = os.path.join(OUT, name)
    img.save(path, optimize=True)
    print(f"  {name:<24} {img.size[0]}x{img.size[1]}  {os.path.getsize(path)/1024:5.1f} KB")


# --------------------------------------------------------------------------
# open-graph card (1200 x 630)
# --------------------------------------------------------------------------
def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def og() -> Image.Image:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img, "RGBA")

    # faint grid
    for x in range(0, W, 44):
        d.line([(x, 0), (x, H)], fill=(255, 255, 255, 7), width=1)
    for y in range(0, H, 44):
        d.line([(0, y), (W, y)], fill=(255, 255, 255, 7), width=1)

    # corner glows
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W - 560, -260, W + 260, 320], fill=(79, 209, 197, 46))
    gd.ellipse([-320, H - 260, 380, H + 300], fill=(246, 173, 85, 34))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    img = Image.alpha_composite(img.convert("RGBA"), glow)
    d = ImageDraw.Draw(img, "RGBA")

    # brand mark
    mark = icon(128).resize((62, 62), Image.LANCZOS)
    img.paste(mark, (78, 62), mark)
    f_brand = font("DejaVuSansMono-Bold.ttf", 34)
    d.text((158, 74), "free", font=font("DejaVuSansMono.ttf", 34), fill=MUTED)
    xw = d.textlength("free", font=font("DejaVuSansMono.ttf", 34))
    d.text((158 + xw, 74), "HTML", font=f_brand, fill=TEXT)
    xw2 = d.textlength("HTML", font=f_brand)
    d.text((158 + xw + xw2, 74), ".dev", font=f_brand, fill=TEAL)

    # headline
    f_h = font("DejaVuSans-Bold.ttf", 74)
    d.text((78, 190), "Small tools. One file.", font=f_h, fill=TEXT)
    d.text((78, 276), "Zero tracking.", font=f_h, fill=TEAL)

    # lede
    f_p = font("DejaVuSans.ttf", 27)
    d.text((78, 386), "Twelve single-file web apps that solve one problem well.", font=f_p, fill=MUTED)
    d.text((78, 424), "No backend. No analytics. No accounts. Works offline.", font=f_p, fill=MUTED)

    # pills
    f_pill = font("DejaVuSansMono-Bold.ttf", 21)
    pills = ["12 tools", "0 trackers", "0 cookies", "1 file each", "Apache-2.0"]
    x = 78
    y = 492
    for label in pills:
        w = d.textlength(label, font=f_pill) + 34
        d.rounded_rectangle([x, y, x + w, y + 44], radius=22, fill=PANEL, outline=(255, 255, 255, 26))
        d.text((x + 17, y + 10), label, font=f_pill, fill=TEAL)
        x += w + 12

    # footer
    d.line([(78, 566), (W - 78, 566)], fill=(255, 255, 255, 22), width=1)
    f_f = font("DejaVuSansMono.ttf", 22)
    d.text((78, 582), "Kristian Mario Mi\u0161kovi\u0107  \u00b7  @TekiDeki", font=f_f, fill=FAINT)
    d.text((W - 78 - d.textlength("freehtml.dev", font=f_f), 582), "freehtml.dev", font=f_f, fill=MUTED)

    return img.convert("RGB")


# --------------------------------------------------------------------------
def main() -> None:
    print("Rendering assets ->", OUT)
    save(icon(192), "icon-192.png")
    save(icon(512), "icon-512.png")
    save(icon(512, maskable=True), "maskable-512.png")
    save(icon(180), "apple-touch-icon.png")
    save(icon(32), "icon-32.png")

    # multi-resolution .ico for old browsers / crawlers
    ico = icon(64)
    ico.save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)], optimize=True)
    print(f"  {'favicon.ico':<24} 16/32/48        {os.path.getsize(os.path.join(OUT,'favicon.ico'))/1024:5.1f} KB")

    card = og()
    # keep the OG card small: flat colours compress well with a limited palette
    card_q = card.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    card_q.save(os.path.join(OUT, "og.png"), optimize=True)
    print(f"  {'og.png':<24} 1200x630        {os.path.getsize(os.path.join(OUT,'og.png'))/1024:5.1f} KB")


if __name__ == "__main__":
    main()
