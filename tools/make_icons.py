# -*- coding: utf-8 -*-
"""
Generează iconițele PWA din marcajul oficial FABBV.

Sursa e logoul alb oficial (icons/logo-fabbv-alb.png). Din el se decupează
automat marcajul din stânga — pătratul cu „F” în negativ — pentru că sigla
întreagă e orizontală (3.7:1) și ar deveni ilizibilă într-o iconiță pătrată.

Rulare:  python tools/make_icons.py
"""
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "icons"
LOGO = ICONS / "logo-fabbv-alb.png"
ICONS.mkdir(exist_ok=True)

BURGUNDY = (119, 1, 1)      # #770101
WHITE = (255, 255, 255)


def extrage_marcaj():
    """Decupeaza marcajul patrat din stanga siglei orizontale.

    Sigla are un singur gol vertical transparent intre marcaj si text,
    asa ca il gasim programatic - fara coordonate fixe, ca sa supravietuiasca
    unei actualizari a logoului.
    """
    if not LOGO.exists():
        raise SystemExit("Lipseste %s" % LOGO)

    im = Image.open(LOGO).convert("RGBA")
    W, H = im.size
    alpha = im.split()[3]

    cols = [max(alpha.crop((x, 0, x + 1, H)).getextrema()) for x in range(W)]

    taie = None
    gol_start = None
    for x, v in enumerate(cols):
        if v < 8:
            if gol_start is None:
                gol_start = x
        else:
            if gol_start is not None and x - gol_start >= 4:
                taie = gol_start
                break
            gol_start = None

    if taie is None or taie < W * 0.05:
        # fara gol clar, pastram primul patrat din stanga
        taie = min(H, W)

    mark = im.crop((0, 0, taie, H))
    bb = mark.getbbox()
    return mark.crop(bb) if bb else mark


def compune(size, mark, scara=0.70, fundal=BURGUNDY):
    """Marcajul centrat pe fundal burgundy, la o fractiune din latura."""
    img = Image.new("RGBA", (size, size), fundal + (255,))

    tinta = round(size * scara)
    w, h = mark.size
    if w >= h:
        nw, nh = tinta, max(1, round(h * tinta / w))
    else:
        nh, nw = tinta, max(1, round(w * tinta / h))

    m = mark.resize((nw, nh), Image.LANCZOS)
    img.alpha_composite(m, ((size - nw) // 2, (size - nh) // 2))
    return img


def main():
    mark = extrage_marcaj()
    print("marcaj extras din logo: %dx%d" % mark.size)

    facute = []

    for s in (192, 512):
        p = ICONS / ("icon-%d.png" % s)
        compune(s, mark).convert("RGB").save(p, optimize=True)
        facute.append(p)

    # maskable: continutul sta in zona sigura (~56%), fundalul umple tot
    p = ICONS / "icon-maskable-512.png"
    compune(512, mark, scara=0.56).convert("RGB").save(p, optimize=True)
    facute.append(p)

    # apple-touch-icon: fara transparenta, iOS rotunjeste singur colturile
    p = ICONS / "apple-touch-icon.png"
    compune(180, mark).convert("RGB").save(p, optimize=True)
    facute.append(p)

    # badge de notificare: silueta alba pe transparent, Android o coloreaza singur
    badge = Image.new("RGBA", (72, 72), (0, 0, 0, 0))
    w, h = mark.size
    t = 58
    if w >= h:
        nw, nh = t, max(1, round(h * t / w))
    else:
        nh, nw = t, max(1, round(w * t / h))
    alb = Image.new("RGBA", mark.size, WHITE + (0,))
    alb.putalpha(mark.split()[3])
    badge.alpha_composite(alb.resize((nw, nh), Image.LANCZOS), ((72 - nw) // 2, (72 - nh) // 2))
    p = ICONS / "badge-72.png"
    badge.save(p, optimize=True)
    facute.append(p)

    p = ICONS / "favicon.ico"
    compune(64, mark).convert("RGB").save(p, sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    facute.append(p)

    for f in facute:
        print("  %-34s %d KB" % (f.relative_to(ROOT), f.stat().st_size // 1024))


if __name__ == "__main__":
    main()
