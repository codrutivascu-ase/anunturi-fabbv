# -*- coding: utf-8 -*-
"""
Convertește evenimente_fabbv.xlsx în data/events.json.

Rulare:  python tools/xlsx_to_json.py
Opțional: python tools/xlsx_to_json.py cale/catre/alt_fisier.xlsx
"""
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import json
import re
import sys
from datetime import date, datetime, time
from pathlib import Path

from openpyxl import load_workbook

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import (                                      # noqa: E402
    CATEGORII, TIPURI_ANUNT, as_date, as_text, as_time,
    e_rand_de_indicatii, normalizeaza_categorie, normalizeaza_tip,
)

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "evenimente_fabbv.xlsx"
OUT = ROOT / "data" / "events.json"


def find_header(ws, *obligatorii):
    """Capul de tabel e primul rand care contine toate coloanele cerute."""
    for row in ws.iter_rows(min_row=1, max_row=12):
        names = [as_text(c.value).lower() for c in row]
        if all(o in names for o in obligatorii):
            return row[0].row, {n: i for i, n in enumerate(names) if n}
    raise SystemExit("Nu am gasit capul de tabel (un rand cu: %s)." % ", ".join(obligatorii))


def citeste_anunturi(wb, etichete):
    """Foaia Anunturi e optionala: fara ea, aplicatia merge fara tabul de anunturi."""
    if "Anunturi" not in wb.sheetnames:
        return [], []

    ws = wb["Anunturi"]
    header_row, idx = find_header(ws, "titlu", "valabil_pana_la")
    anunturi, erori = [], []

    for row in ws.iter_rows(min_row=header_row + 1):
        cells = list(row)

        def get(name):
            i = idx.get(name)
            return cells[i].value if i is not None and i < len(cells) else None

        titlu = as_text(get("titlu"))
        pana_raw = get("valabil_pana_la")
        if not titlu or not as_text(pana_raw):
            continue
        nr = cells[0].row
        if nr == header_row + 1 and not as_date(pana_raw):
            continue
        if e_rand_de_indicatii(titlu):
            continue
        if as_text(get("activ")).lower() == "nu":
            continue

        pana = as_date(pana_raw)
        if not pana:
            erori.append("Anunturi, randul %d: valabil_pana_la invalid - sarit" % nr)
            continue

        tip = normalizeaza_tip(get("tip"), erori, "Anunturi, randul %d" % nr, etichete)

        anunturi.append({
            "id": as_text(get("id")) or "an-%d" % nr,
            "adaugat_la": as_date(get("adaugat_la")) or "",
            "titlu": titlu,
            "descriere": as_text(get("descriere")),
            "valabil_de_la": as_date(get("valabil_de_la")) or "",
            "valabil_pana_la": pana,
            "tip": tip,
            "link": as_text(get("link")),
            "text_buton": as_text(get("text_buton")),
            "persoana_contact": as_text(get("persoana_contact")),
            "important": "da" if as_text(get("important")).lower() == "da" else "",
        })

    anunturi.sort(key=lambda a: (a["valabil_pana_la"], a["titlu"]))
    return anunturi, erori


def main():
    if not SRC.exists():
        raise SystemExit(f"Lipsește {SRC}. Rulează mai întâi tools/make_sample_xlsx.py")

    wb = load_workbook(SRC, data_only=True)
    ws = wb["Evenimente"] if "Evenimente" in wb.sheetnames else wb.worksheets[0]

    header_row, idx = find_header(ws, "data", "titlu")
    lipsa = [c for c in ("data", "titlu", "categorie") if c not in idx]
    if lipsa:
        raise SystemExit("Coloane obligatorii lipsă: " + ", ".join(lipsa))

    evenimente, erori, sarite = [], [], 0
    et_cat, et_tip = {}, {}

    for row in ws.iter_rows(min_row=header_row + 1):
        cells = list(row)

        def get(name):
            i = idx.get(name)
            return cells[i].value if i is not None and i < len(cells) else None

        titlu = as_text(get("titlu"))
        data_raw = get("data")

        # rândul de indicații și rândurile goale
        if not titlu or not as_text(data_raw):
            continue
        nr = cells[0].row
        # randul de indicatii de sub capul de tabel nu e un eveniment
        if nr == header_row + 1 and not as_date(data_raw):
            continue
        if e_rand_de_indicatii(titlu):
            continue

        d = as_date(data_raw)
        if not d:
            erori.append(f"rândul {nr}: data „{as_text(data_raw)}” nu e în format AAAA-LL-ZZ — sărit")
            sarite += 1
            continue

        activ = as_text(get("activ")).lower()
        if activ == "nu":
            sarite += 1
            continue

        cat = normalizeaza_categorie(get("categorie"), erori, "Evenimente, randul %d" % nr, et_cat)

        ev = {
            "id": as_text(get("id")) or f"ev-{nr}",
            "data": d,
            "ora_start": as_time(get("ora_start")),
            "ora_final": as_time(get("ora_final")),
            "titlu": titlu,
            "descriere": as_text(get("descriere")),
            "locatie": as_text(get("locatie")),
            "organizator": as_text(get("organizator")),
            "categorie": cat,
            "link": as_text(get("link")),
            "important": "da" if as_text(get("important")).lower() == "da" else "",
        }
        evenimente.append(ev)

    # important întâi, apoi cronologic
    evenimente.sort(key=lambda e: (e["data"], e["ora_start"] or "99:99", e["titlu"]))

    anunturi, erori_anunt = citeste_anunturi(wb, et_tip)
    erori.extend(erori_anunt)

    payload = {
        "actualizat_la": datetime.now().strftime("%d.%m.%Y, %H:%M"),
        "sursa": SRC.name,
        "evenimente": evenimente,
        "anunturi": anunturi,
        "categorii_noi": et_cat,
        "tipuri_noi": et_tip,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Scris: {OUT}")
    print(f"  {len(evenimente)} evenimente, {sarite} sarite")
    print(f"  {len(anunturi)} anunturi")
    for e in erori:
        print("  ! " + e)


if __name__ == "__main__":
    main()
