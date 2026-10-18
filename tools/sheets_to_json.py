# -*- coding: utf-8 -*-
"""
Citește evenimentele și anunțurile direct din Google Sheets și
regenerează data/events.json.

Foile trebuie publicate pe web ca CSV:
  Fișier › Partajează › Publică pe web › foaia dorită › format CSV

Rulare:
  python tools/sheets_to_json.py <url_csv_evenimente> [url_csv_anunturi]

Sau cu variabile de mediu (așa face GitHub Actions):
  SHEET_EVENIMENTE_CSV=...  SHEET_ANUNTURI_CSV=...  python tools/sheets_to_json.py

Validarea e în tools/comun.py, aceeași folosită de convertorul din
Excel — ca Sheet-ul și Excelul să fie interpretate identic.
"""
import csv
import io
import json
import os
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

from comun import (                 # noqa: E402
    as_date, as_text, as_time, e_rand_de_indicatii,
    normalizeaza_categorie, normalizeaza_tip,
)

OUT = ROOT / "data" / "events.json"
TIMEOUT = 45


def descarca(url):
    cerere = urllib.request.Request(url, headers={"User-Agent": "anunturi-fabbv/1.0"})
    with urllib.request.urlopen(cerere, timeout=TIMEOUT) as r:
        brut = r.read()
    # Google trimite UTF-8, uneori cu BOM
    return brut.decode("utf-8-sig", errors="replace")


def citeste_tabel(text, obligatorii):
    """Întoarce (rânduri_ca_dicționare, numărul_rândului_de_cap).

    Capul de tabel e primul rând care conține toate coloanele cerute;
    rândurile de titlu și de indicații de deasupra sunt sărite.
    """
    randuri = list(csv.reader(io.StringIO(text)))

    for i, rand in enumerate(randuri):
        nume = [as_text(c).lower() for c in rand]
        if all(o in nume for o in obligatorii):
            indici = {n: j for j, n in enumerate(nume) if n}
            iesire = []
            for k, r in enumerate(randuri[i + 1:], start=i + 2):
                iesire.append((k, {n: (r[j] if j < len(r) else "") for n, j in indici.items()}))
            return iesire, i + 1

    raise SystemExit(
        "Nu am gasit capul de tabel (un rand cu: %s).\n"
        "Verifica daca linkul publicat arata spre foaia potrivita."
        % ", ".join(obligatorii)
    )


def citeste_evenimente(url, erori, etichete):
    randuri, cap = citeste_tabel(descarca(url), ("data", "titlu"))
    iesire, sarite = [], 0

    for nr, r in randuri:
        titlu = as_text(r.get("titlu"))
        data_bruta = as_text(r.get("data"))
        if not titlu or not data_bruta:
            continue
        # randul de indicatii de sub cap
        if nr == cap + 1 and not as_date(data_bruta):
            continue
        if e_rand_de_indicatii(titlu):
            continue
        if as_text(r.get("activ")).lower() == "nu":
            sarite += 1
            continue

        d = as_date(data_bruta)
        if not d:
            erori.append("Evenimente, randul %d: data '%s' nu e AAAA-LL-ZZ - sarit" % (nr, data_bruta))
            sarite += 1
            continue

        cat = normalizeaza_categorie(r.get("categorie"), erori, "Evenimente, randul %d" % nr, etichete)

        iesire.append({
            "id": as_text(r.get("id")) or "ev-%d" % nr,
            "data": d,
            "ora_start": as_time(r.get("ora_start")),
            "ora_final": as_time(r.get("ora_final")),
            "titlu": titlu,
            "descriere": as_text(r.get("descriere")),
            "locatie": as_text(r.get("locatie")),
            "organizator": as_text(r.get("organizator")),
            "categorie": cat,
            "link": as_text(r.get("link")),
            "important": "da" if as_text(r.get("important")).lower() == "da" else "",
        })

    iesire.sort(key=lambda e: (e["data"], e["ora_start"] or "99:99", e["titlu"]))
    return iesire, sarite


def citeste_anunturi(url, erori, etichete):
    if not url:
        return []

    randuri, cap = citeste_tabel(descarca(url), ("titlu", "valabil_pana_la"))
    iesire = []

    for nr, r in randuri:
        titlu = as_text(r.get("titlu"))
        pana_brut = as_text(r.get("valabil_pana_la"))
        if not titlu or not pana_brut:
            continue
        if nr == cap + 1 and not as_date(pana_brut):
            continue
        if e_rand_de_indicatii(titlu):
            continue
        if as_text(r.get("activ")).lower() == "nu":
            continue

        pana = as_date(pana_brut)
        if not pana:
            erori.append("Anunturi, randul %d: valabil_pana_la invalid - sarit" % nr)
            continue

        tip = normalizeaza_tip(r.get("tip"), erori, "Anunturi, randul %d" % nr, etichete)

        iesire.append({
            "id": as_text(r.get("id")) or "an-%d" % nr,
            "adaugat_la": as_date(r.get("adaugat_la")) or "",
            "titlu": titlu,
            "descriere": as_text(r.get("descriere")),
            "valabil_de_la": as_date(r.get("valabil_de_la")) or "",
            "valabil_pana_la": pana,
            "tip": tip,
            "link": as_text(r.get("link")),
            "text_buton": as_text(r.get("text_buton")),
            "persoana_contact": as_text(r.get("persoana_contact")),
            "important": "da" if as_text(r.get("important")).lower() == "da" else "",
        })

    iesire.sort(key=lambda a: (a["valabil_pana_la"], a["titlu"]))
    return iesire


def main():
    url_ev = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SHEET_EVENIMENTE_CSV", "")).strip()
    url_an = (sys.argv[2] if len(sys.argv) > 2 else os.environ.get("SHEET_ANUNTURI_CSV", "")).strip()

    if not url_ev:
        raise SystemExit(
            "Lipseste linkul CSV al foii Evenimente.\n"
            "Fie ca argument, fie in variabila SHEET_EVENIMENTE_CSV."
        )

    erori = []
    et_cat, et_tip = {}, {}
    evenimente, sarite = citeste_evenimente(url_ev, erori, et_cat)
    anunturi = citeste_anunturi(url_an, erori, et_tip)

    # Plasa de siguranta: un Sheet gol sau stricat nu trebuie sa goleasca
    # aplicatia. Mai bine pastram datele vechi si semnalam problema.
    if not evenimente and not anunturi:
        raise SystemExit(
            "Sheet-ul nu a produs niciun eveniment si niciun anunt.\n"
            "Nu suprascriu data/events.json. Verifica linkurile publicate."
        )

    # Daca datele sunt identice cu cele publicate, nu rescriem fisierul.
    # Altfel doar marca de timp s-ar schimba, iar sincronizarea ar face
    # un commit la fiecare rulare, la nesfarsit.
    if OUT.exists():
        try:
            vechi = json.loads(OUT.read_text(encoding="utf-8"))
            if (vechi.get("evenimente") == evenimente
                    and vechi.get("anunturi") == anunturi
                    and vechi.get("categorii_noi", {}) == et_cat
                    and vechi.get("tipuri_noi", {}) == et_tip):
                print("Nicio schimbare: %d evenimente, %d anunturi."
                      % (len(evenimente), len(anunturi)))
                for e in erori:
                    print("  ! " + e)
                return
        except (ValueError, OSError):
            pass    # fisier lipsa sau stricat: il rescriem

    payload = {
        "actualizat_la": datetime.now().strftime("%d.%m.%Y, %H:%M"),
        "sursa": "Google Sheets",
        "evenimente": evenimente,
        "anunturi": anunturi,
        # categoriile si tipurile pe care le-ai inventat in foaie, cu textul
        # exact scris de tine; aplicatia le afiseaza cu o culoare implicita
        "categorii_noi": et_cat,
        "tipuri_noi": et_tip,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Scris: %s" % OUT)
    print("  %d evenimente, %d sarite" % (len(evenimente), sarite))
    print("  %d anunturi" % len(anunturi))
    for k, v in sorted(et_cat.items()):
        print("  + categorie noua: %s (%s)" % (k, v))
    for k, v in sorted(et_tip.items()):
        print("  + tip nou de anunt: %s (%s)" % (k, v))
    for e in erori:
        print("  ! " + e)


if __name__ == "__main__":
    main()
