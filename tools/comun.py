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


def slug(valoare):
    """'Seminar Stiintific' -> 'seminar-stiintific'.

    Diacriticele cad, ca 'inscriere' si 'inscriere' sa fie acelasi lucru,
    iar orice nu e litera sau cifra devine o cratima.
    """
    t = fara_diacritice(as_text(valoare).lower())
    t = re.sub(r"[^a-z0-9]+", "-", t)
    return t.strip("-")


def _normalizeaza(valoare, cunoscute, implicita, etichete):
    """Intoarce cheia sub care se salveaza valoarea.

    Valorile din liste se recunosc chiar daca sunt scrise cu diacritice.
    O valoare noua nu se mai pierde: se pastreaza ca atare, iar textul
    exact din foaie se tine minte in `etichete`, ca aplicatia sa-l poata
    afisa asa cum l-ai scris.
    """
    brut = as_text(valoare)
    if not brut:
        return implicita

    cheie = slug(brut)
    if not cheie:
        return implicita
    if cheie in cunoscute:
        return cheie

    if etichete is not None and cheie not in etichete:
        etichete[cheie] = brut
    return cheie


def normalizeaza_categorie(valoare, erori, unde, etichete=None):
    return _normalizeaza(valoare, CATEGORII, "anunt", etichete)


def normalizeaza_tip(valoare, erori, unde, etichete=None):
    return _normalizeaza(valoare, TIPURI_ANUNT, "administrativ", etichete)
