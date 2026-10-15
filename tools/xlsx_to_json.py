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

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "evenimente_fabbv.xlsx"
OUT = ROOT / "data" / "events.json"

CATEGORII = {"open-course", "conferinta", "workshop", "cariera", "deadline", "examen", "anunt"}
CAMPURI = ["id", "data", "ora_start", "ora_final", "titlu", "descriere",
           "locatie", "organizator", "categorie", "link", "important", "activ"]
TIPURI_ANUNT = {"inscriere", "administrativ", "oportunitate", "urgent"}


def fara_diacritice(t):
    """Pentru comparatii robuste: textul din foi poate avea sau nu diacritice."""
    return (t.replace("ă", "a").replace("â", "a").replace("î", "i")
             .replace("ș", "s").replace("ş", "s")
             .replace("ț", "t").replace("ţ", "t"))


def as_text(v):
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    return str(v).strip()


def as_date(v):
    """Acceptă atât text AAAA-LL-ZZ cât și o dată reală din Excel."""
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    s = as_text(v)
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return s
    # formate tolerate: 20.10.2026 / 20/10/2026
    m = re.fullmatch(r"(\d{1,2})[./](\d{1,2})[./](\d{4})", s)
    if m:
        d, mo, y = (int(x) for x in m.groups())
        return f"{y:04d}-{mo:02d}-{d:02d}"
    return None


def as_time(v):
    if isinstance(v, datetime):
        return v.strftime("%H:%M")
    if isinstance(v, time):
        return v.strftime("%H:%M")
    s = as_text(v)
    if not s:
        return ""
    m = re.fullmatch(r"(\d{1,2})[:.](\d{2})", s)
    if m:
        h, mi = int(m.group(1)), int(m.group(2))
        if 0 <= h < 24 and 0 <= mi < 60:
            return f"{h:02d}:{mi:02d}"
    return ""


def find_header(ws, *obligatorii):
    """Capul de tabel e primul rand care contine toate coloanele cerute."""
    for row in ws.iter_rows(min_row=1, max_row=12):
        names = [as_text(c.value).lower() for c in row]
        if all(o in names for o in obligatorii):
            return row[0].row, {n: i for i, n in enumerate(names) if n}
    raise SystemExit("Nu am gasit capul de tabel (un rand cu: %s)." % ", ".join(obligatorii))


def citeste_anunturi(wb):
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
        if fara_diacritice(titlu.lower()).startswith(("titlul anuntului", "identificator")):
            continue
        if as_text(get("activ")).lower() == "nu":
            continue

        pana = as_date(pana_raw)
        if not pana:
            erori.append("Anunturi, randul %d: valabil_pana_la invalid - sarit" % nr)
            continue

        tip = as_text(get("tip")).lower()
        if tip not in TIPURI_ANUNT:
            if tip:
                erori.append("Anunturi, randul %d: tipul '%s' nu exista - pus pe 'administrativ'" % (nr, tip))
            tip = "administrativ"

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
        if fara_diacritice(titlu.lower()).startswith(("titlul afisat", "identificator")):
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

        cat = as_text(get("categorie")).lower()
        if cat not in CATEGORII:
            if cat:
                erori.append(f"rândul {nr}: categoria „{cat}” nu există — pusă pe „anunt”")
            cat = "anunt"

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

    anunturi, erori_anunt = citeste_anunturi(wb)
    erori.extend(erori_anunt)

    payload = {
        "actualizat_la": datetime.now().strftime("%d.%m.%Y, %H:%M"),
        "sursa": SRC.name,
        "evenimente": evenimente,
        "anunturi": anunturi,
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
