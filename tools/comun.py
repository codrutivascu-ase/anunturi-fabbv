# -*- coding: utf-8 -*-
"""
Definiții și validări folosite de ambele convertoare.

Nu importă nimic din afara bibliotecii standard. Convertorul din Google
Sheets nu are nevoie de openpyxl, iar dacă ar importa din xlsx_to_json
ar trage după el o dependență pe care nu o folosește.

Tot ce ține de „cum arată o dată corectă” sau „ce categorii există” stă
aici, ca Excelul și Sheet-ul să fie interpretate identic.
"""
import re
from datetime import date, datetime, time

CATEGORII = {"open-course", "conferinta", "workshop", "cariera",
             "deadline", "examen", "anunt"}

TIPURI_ANUNT = {"inscriere", "administrativ", "oportunitate", "urgent"}

CAMPURI = ["id", "data", "ora_start", "ora_final", "titlu", "descriere",
           "locatie", "organizator", "categorie", "link", "important", "activ"]

CAMPURI_ANUNT = ["id", "adaugat_la", "titlu", "descriere", "valabil_de_la",
                 "valabil_pana_la", "tip", "link", "text_buton",
                 "persoana_contact", "important", "activ"]


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
    """Acceptă text AAAA-LL-ZZ, o dată reală din Excel, sau 20.10.2026."""
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()

    s = as_text(v)
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return s

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


def e_rand_de_indicatii(titlu):
    """Rândul de sub capul de tabel explică fiecare coloană; nu e dată."""
    return fara_diacritice(titlu.lower()).startswith(
        ("titlul afisat", "titlul anuntului", "identificator"))


def normalizeaza_categorie(valoare, erori, unde):
    cat = as_text(valoare).lower()
    if cat in CATEGORII:
        return cat
    if cat:
        erori.append("%s: categoria '%s' nu exista - pusa pe 'anunt'" % (unde, cat))
    return "anunt"


def normalizeaza_tip(valoare, erori, unde):
    tip = as_text(valoare).lower()
    if tip in TIPURI_ANUNT:
        return tip
    if tip:
        erori.append("%s: tipul '%s' nu exista - pus pe 'administrativ'" % (unde, tip))
    return "administrativ"
