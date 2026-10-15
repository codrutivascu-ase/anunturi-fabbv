# -*- coding: utf-8 -*-
"""
Generează iconițele PWA în culorile FABBV: fundal bleumarin,
monogramă aurie, chenar discret.

Rulare:  python tools/make_icons.py
"""
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "icons"
ICONS.mkdir(exist_ok=True)

NAVY = (119, 1, 1)         # #770101 — burgundy de brand
NAVY_DEEP = (90, 0, 0)     # #5a0000 — capatul inchis al gradientului
GOLD = (255, 255, 255)     # inelul si monograma, albe pe burgundy
WHITE = (255, 255, 255)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\calibrib.ttf",
]


def font_at(size):
    for p in FONT_CANDIDATES:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                pass
    return ImageFont.load_default()


def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (1, size), top)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        d.point((0, y), tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img.resize((size, size), Image.BILINEAR)


def draw_icon(size, text="FABBV", padding_ratio=0.0, ring=True):
    """padding_ratio > 0 lasă margine pentru iconițele maskable."""
    img = vertical_gradient(size, NAVY, NAVY_DEEP).convert("RGBA")
    d = ImageDraw.Draw(img)

    inset = size * padding_ratio
    box = (inset, inset, size - inset, size - inset)

    if ring:
        w = max(3, round(size * 0.022))
        r = size * (0.5 - padding_ratio) * 0.78
        cx = cy = size / 2
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=GOLD, width=w)

    # monograma, dimensionată să încapă în cerc
    usable = (box[2] - box[0]) * 0.56
    fs = round(usable / max(len(text), 1) * 1.55)
    f = font_at(fs)
    while fs > 6:
        f = font_at(fs)
        bb = d.textbbox((0, 0), text, font=f)
        if bb[2] - bb[0] <= usable:
            break
        fs -= 2

    bb = d.textbbox((0, 0), text, font=f)
    x = (size - (bb[2] - bb[0])) / 2 - bb[0]
    y = (size - (bb[3] - bb[1])) / 2 - bb[1]
    # monograma alba pe navy: crimson pe navy ar avea contrast prea mic
    d.text((x, y), text, font=f, fill=WHITE)

    return img


def rounded(img, radius_ratio=0.22):
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1),
                                           radius=round(size * radius_ratio), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    made = []

    for s in (192, 512):
        p = ICONS / f"icon-{s}.png"
        draw_icon(s).convert("RGB").save(p, optimize=True)
        made.append(p)

    # maskable: conținutul stă în zona sigură (80%), fundalul umple tot
    p = ICONS / "icon-maskable-512.png"
    draw_icon(512, padding_ratio=0.12).convert("RGB").save(p, optimize=True)
    made.append(p)

    # apple-touch-icon: fără transparență, colțuri pătrate (iOS le rotunjește)
    p = ICONS / "apple-touch-icon.png"
    draw_icon(180).convert("RGB").save(p, optimize=True)
    made.append(p)

    # badge monocrom pentru notificări
    badge = Image.new("RGBA", (72, 72), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge)
    bd.ellipse((4, 4, 68, 68), fill=WHITE)
    f = font_at(30)
    bb = bd.textbbox((0, 0), "F", font=f)
    bd.text(((72 - (bb[2] - bb[0])) / 2 - bb[0], (72 - (bb[3] - bb[1])) / 2 - bb[1]),
            "F", font=f, fill=NAVY)  # burgundy pe disc alb
    p = ICONS / "badge-72.png"
    badge.save(p, optimize=True)
    made.append(p)

    # favicon
    p = ICONS / "favicon.ico"
    draw_icon(64).convert("RGB").save(p, sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    made.append(p)

    for f_ in made:
        print(f"  {f_.relative_to(ROOT)}  ({f_.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
