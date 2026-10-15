# -*- coding: utf-8 -*-
"""
Generează evenimente_fabbv.xlsx — fișierul de lucru în care se introduc
evenimentele. Datele sunt relative la ziua rulării, ca demo-ul să arate
mereu populat.

Rulare:  python tools/make_sample_xlsx.py
"""
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from datetime import date, timedelta
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "evenimente_fabbv.xlsx"

NAVY = "770101"       # burgundy de brand
NAVY_SOFT = "5A0000"  # burgundy inchis, pentru capul de tabel
GOLD = "8E1013"       # burgundy deschis
GREY = "F4F1F2"       # off-white din materiale

CATEGORII = ["open-course", "conferinta", "workshop", "cariera", "deadline", "examen", "anunt"]

TIPURI_ANUNT = ["inscriere", "administrativ", "oportunitate", "urgent"]

COLS_ANUNT = [
    ("id", 10, "Identificator unic. Lasă necompletat și se generează automat."),
    ("adaugat_la", 13, "Data la care ai scris anunțul. Apare în Azi a doua zi. Gol = nu apare în Azi."),
    ("titlu", 46, "Titlul anunțului. Imperativ și scurt."),
    ("descriere", 64, "Ce trebuie făcut, de către cine și unde."),
    ("valabil_de_la", 14, "De când apare. Gol = imediat. Format AAAA-LL-ZZ."),
    ("valabil_pana_la", 15, "Ultima zi în care apare. După ea dispare singur. OBLIGATORIU."),
    ("tip", 15, "Una din: " + ", ".join(TIPURI_ANUNT)),
    ("link", 36, "Linkul de înscriere sau de detalii. Opțional."),
    ("text_buton", 20, "Textul butonului. Gol = „Detalii”."),
    ("persoana_contact", 30, "Cui îi scrii dacă ai întrebări. Opțional."),
    ("important", 11, "da = fixat sus și marcat vizibil."),
    ("activ", 9, "nu = ascuns din aplicație. Gol sau da = vizibil."),
]

# (offset_pana_la, offset_adaugat, titlu, descriere, tip, link, text_buton, contact, important)
# offset_adaugat e relativ la azi: -1 = scris ieri, deci apare azi in tabul Azi.
ANUNTURI = [
    (0, -9, "Depunerea cererilor de cazare în cămin",
     "Cererile se încarcă în platforma online.ase.ro, secțiunea Cazare. Dosarele incomplete nu intră în repartiție.",
     "urgent", "https://online.ase.ro/cazare", "Depune cererea",
     "Secretariat FABBV, cazare@ase.ro", "da"),

    (6, -1, "Înscrie-te la examenul de licență — sesiunea iulie 2027",
     "Înscrierile se fac la secretariat, cu dosarul complet: cerere tip, copie CI și dovada achitării taxei. Verifică din timp dacă ai toate creditele.",
     "inscriere", "https://fabbv.ase.ro/licenta-2027", "Vezi condițiile",
     "Secretariat FABBV, etaj 2", "da"),

    (12, -5, "Alege-ți coordonatorul pentru lucrarea de licență",
     "Discută cu profesorul dorit și completează formularul de confirmare. După termen, repartizarea se face automat, fără opțiunea ta.",
     "inscriere", "https://fabbv.ase.ro/coordonatori", "Alege coordonator",
     "Departamentul de Finanțe", ""),

    (18, -3, "Candidaturi pentru mobilitățile Erasmus+, semestrul II",
     "Destinații în Franța, Spania, Italia și Țările de Jos. Se cere media minimă 8 și un certificat de limbă B2.",
     "oportunitate", "https://ase.ro/erasmus", "Aplică acum",
     "Biroul Erasmus+, erasmus@ase.ro", ""),

    (25, -10, "Bursa de performanță științifică — depunere dosare",
     "Pentru studenții cu lucrări publicate sau premii la competiții de profil. Dosarul se depune fizic la secretariat.",
     "inscriere", "", "",
     "Secretariat FABBV", ""),

    (40, -20, "Actualizează-ți datele de contact în platforma online",
     "Adresa de email și numărul de telefon sunt folosite pentru comunicările oficiale ale facultății. Durează un minut.",
     "administrativ", "https://online.ase.ro/profil", "Actualizează",
     "", ""),
]

COLS = [
    ("id", 10, "Identificator unic. Lasă necompletat și se generează automat."),
    ("data", 12, "Data evenimentului, format AAAA-LL-ZZ (ex. 2026-10-20)."),
    ("ora_start", 11, "Ora de început HH:MM. Gol = eveniment pe toată ziua."),
    ("ora_final", 11, "Ora de final HH:MM. Opțional."),
    ("titlu", 42, "Titlul afișat în listă. Scurt și clar."),
    ("descriere", 60, "Detalii: ce se întâmplă, cui se adresează."),
    ("locatie", 26, "Sala / clădirea / linkul de Teams."),
    ("organizator", 26, "Cine susține evenimentul."),
    ("categorie", 15, "Una din: " + ", ".join(CATEGORII)),
    ("link", 34, "Link de înscriere sau detalii. Opțional."),
    ("important", 11, "da = marcat cu stea și pus primul. Gol sau nu = normal."),
    ("activ", 9, "nu = ascuns din aplicație. Gol sau da = vizibil."),
]

# (offset_zile, ora_start, ora_final, titlu, descriere, locatie, organizator, categorie, link, important)
EVENIMENTE = [
    (0, "10:00", "12:00",
     "Open Course: Evaluarea instrumentelor derivate",
     "Curs deschis despre pricing-ul opțiunilor și contractelor futures, cu aplicații pe date reale de la BVB. Deschis tuturor anilor.",
     "Sala 2104, Clădirea Ion N. Angelescu", "Prof. univ. dr. Andrei Popescu",
     "open-course", "https://fabbv.ase.ro/open-course-derivate", "da"),

    (0, "13:00", "14:30",
     "Workshop Bloomberg Terminal — nivel început",
     "Sesiune practică pe terminalele din laboratorul de piețe financiare: funcții de bază, screening, construirea unui watchlist. Locuri limitate la 20.",
     "Laborator 1308", "Centrul de Analiză Financiară FABBV",
     "workshop", "https://fabbv.ase.ro/bloomberg-intro", ""),

    (0, "16:00", "18:00",
     "Întâlnire cu angajatorii: Banca Transilvania",
     "Prezentarea programului de internship pentru vara 2027 și sesiune de întrebări cu recrutorii. Aduceți CV-ul tipărit.",
     "Aula Magna", "Centrul de Consiliere și Orientare în Carieră",
     "cariera", "", ""),

    (0, "", "",
     "Deadline: depunerea cererilor pentru bursa de merit",
     "Ultima zi pentru încărcarea dosarelor în platforma online. După ora 23:59 nu se mai pot depune documente.",
     "Platforma online.ase.ro", "Secretariatul FABBV",
     "deadline", "https://online.ase.ro/burse", "da"),

    (1, "12:00", "14:00",
     "Open Course: Managementul riscului bancar",
     "Cum măsoară băncile riscul de credit și de piață. Studii de caz pe cerințele Basel III.",
     "Sala 2016", "Conf. univ. dr. Maria Ionescu",
     "open-course", "", ""),

    (1, "18:00", "20:00",
     "Clubul de Investiții FABBV — ședința săptămânală",
     "Analiza portofoliului simulat al clubului și prezentarea a două idei de investiții de către membri. Intrarea liberă.",
     "Sala 2102", "Clubul de Investiții FABBV",
     "anunt", "", ""),

    (2, "09:00", "17:00",
     "Conferința Națională de Finanțe și Asigurări, ediția a XII-a",
     "Trei paneluri: stabilitatea sistemului financiar, digitalizarea asigurărilor, finanțarea tranziției verzi. Participare gratuită pentru studenții ASE, cu înscriere prealabilă.",
     "Aula Magna + Sălile 2104, 2105", "Facultatea FABBV",
     "conferinta", "https://fabbv.ase.ro/conferinta-2026", "da"),

    (3, "14:00", "16:00",
     "Workshop: Modelare financiară în Excel",
     "Construirea unui model DCF de la zero. Vino cu laptopul propriu și Excel instalat.",
     "Laborator 1306", "Asociația Studenților Finanțiști",
     "workshop", "https://fabbv.ase.ro/workshop-dcf", ""),

    (3, "17:00", "18:30",
     "Prezentare program de masterat: Finanțe Corporative",
     "Pentru studenții de anul III: structura programului, criteriile de admitere, oportunități de carieră.",
     "Sala 2104", "Departamentul de Finanțe",
     "anunt", "", ""),

    (4, "10:00", "12:00",
     "Open Course: Piața asigurărilor în România",
     "Panoramă a pieței locale, rolul ASF, tendințe în asigurările de viață și de sănătate. Invitat din industrie.",
     "Sala 2016", "Prof. univ. dr. Elena Dumitrescu",
     "open-course", "", ""),

    (6, "11:00", "13:00",
     "Sesiune de pregătire pentru certificarea CFA Nivel I",
     "Recapitulare pe modulul Ethical and Professional Standards, cu întrebări de tip examen.",
     "Sala 2105", "CFA Society Romania & FABBV",
     "workshop", "https://fabbv.ase.ro/cfa-prep", ""),

    (7, "15:00", "17:00",
     "Open Course: Introducere în fintech și plăți digitale",
     "Cum funcționează infrastructura plăților, open banking și reglementarea PSD2.",
     "Sala 2104", "Lect. univ. dr. Radu Marinescu",
     "open-course", "", ""),

    (8, "", "",
     "Deadline: înscrierea la proiectele de cercetare studențească",
     "Termen final pentru alegerea temei și a coordonatorului pentru sesiunea de comunicări științifice.",
     "Secretariat / email", "Secretariatul FABBV",
     "deadline", "", ""),

    (9, "09:00", "11:00",
     "Examen restanță: Statistică financiară",
     "Pentru studenții din anii II și III cu restanță. Prezentarea cu carnetul de student este obligatorie.",
     "Amfiteatrul 2105", "Departamentul de Finanțe",
     "examen", "", "da"),

    (10, "13:00", "15:00",
     "Masă rotundă: Cariera în audit și consultanță",
     "Discuție cu absolvenți FABBV care lucrează în Big Four. Despre primii doi ani, examene profesionale și echilibrul muncă-studiu.",
     "Sala 2102", "Alumni FABBV",
     "cariera", "", ""),

    (11, "16:00", "19:00",
     "Simulare de interviu pentru poziții în banking",
     "Interviuri de probă de 20 de minute cu feedback imediat. Programare obligatorie pe slot.",
     "Sălile 1308, 1310", "Centrul de Consiliere și Orientare în Carieră",
     "cariera", "https://fabbv.ase.ro/mock-interviews", ""),

    (13, "10:00", "14:00",
     "Ziua Porților Deschise FABBV",
     "Vizite ghidate în laboratoarele de piețe financiare, prezentarea programelor de licență și discuții cu studenții actuali.",
     "Clădirea Ion N. Angelescu, hol principal", "Facultatea FABBV",
     "conferinta", "", "da"),

    (15, "12:00", "13:30",
     "Open Course: Analiza bilanțului bancar",
     "Cum se citește raportul anual al unei bănci. Aplicație pe datele unei bănci listate la BVB.",
     "Sala 2016", "Conf. univ. dr. Maria Ionescu",
     "open-course", "", ""),

    (18, "", "",
     "Anunț: program special al secretariatului",
     "În perioada sesiunii, secretariatul are program cu publicul doar între 10:00 și 13:00.",
     "Secretariat FABBV, etaj 2", "Secretariatul FABBV",
     "anunt", "", ""),

    (21, "09:00", "18:00",
     "Hackathon FinTech FABBV 2026",
     "48 de ore de dezvoltat soluții pentru provocări reale din industria financiară. Echipe de 3-5 studenți, premii oferite de partenerii bancari.",
     "Laboratoarele 1306-1310", "FABBV & partenerii din industrie",
     "conferinta", "https://fabbv.ase.ro/hackathon", "da"),
]


def thin_border(color="D5CFD1"):
    s = Side(style="thin", color=color)
    return Border(left=s, right=s, top=s, bottom=s)


def build():
    wb = Workbook()

    # ---------------- foaia de evenimente ----------------
    ws = wb.active
    ws.title = "Evenimente"

    # titlu
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(COLS))
    t = ws.cell(row=1, column=1, value="ANUNȚURI FABBV — registru de evenimente")
    t.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    t.fill = PatternFill("solid", fgColor=NAVY)
    t.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 30

    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(COLS))
    s = ws.cell(row=2, column=1,
                value="Completează un rând pe eveniment. Nu redenumi și nu reordona coloanele — aplicația le citește după nume.")
    s.font = Font(size=9, italic=True, color="FFFFFF")
    s.fill = PatternFill("solid", fgColor=NAVY_SOFT)
    s.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[2].height = 20

    # cap de tabel
    HEADER_ROW = 3
    for i, (name, width, hint) in enumerate(COLS, start=1):
        c = ws.cell(row=HEADER_ROW, column=i, value=name)
        c.font = Font(bold=True, color="FFFFFF", size=10)
        c.fill = PatternFill("solid", fgColor=NAVY_SOFT)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = thin_border(NAVY)
        c.comment = None
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.row_dimensions[HEADER_ROW].height = 26

    # rândul de indicații
    HINT_ROW = 4
    for i, (name, width, hint) in enumerate(COLS, start=1):
        c = ws.cell(row=HINT_ROW, column=i, value=hint)
        c.font = Font(size=8, italic=True, color="6A666B")
        c.fill = PatternFill("solid", fgColor=GREY)
        c.alignment = Alignment(wrap_text=True, vertical="top")
        c.border = thin_border()
    ws.row_dimensions[HINT_ROW].height = 42

    # date
    today = date.today()
    first_data_row = HINT_ROW + 1

    for n, ev in enumerate(EVENIMENTE):
        off, h1, h2, titlu, desc, loc, org, cat, link, imp = ev
        r = first_data_row + n
        d = today + timedelta(days=off)
        values = [
            f"ev-{n + 1:03d}",
            d.isoformat(),
            h1, h2, titlu, desc, loc, org, cat, link,
            imp, "da",
        ]
        for i, v in enumerate(values, start=1):
            c = ws.cell(row=r, column=i, value=v)
            c.border = thin_border()
            c.font = Font(size=10)
            c.alignment = Alignment(
                vertical="top",
                wrap_text=i in (5, 6, 7, 8),
                horizontal="center" if i in (2, 3, 4, 11, 12) else "left",
            )
            if n % 2 == 1:
                c.fill = PatternFill("solid", fgColor="FAF8F9")
        ws.row_dimensions[r].height = 30

    last_row = first_data_row + len(EVENIMENTE) - 1

    # validări pe 400 de rânduri, ca să acopere și rândurile viitoare
    val_end = first_data_row + 400

    dv_cat = DataValidation(type="list", formula1='"' + ",".join(CATEGORII) + '"',
                            allow_blank=False, showDropDown=False)
    dv_cat.error = "Alege o categorie din listă."
    dv_cat.errorTitle = "Categorie invalidă"
    ws.add_data_validation(dv_cat)
    dv_cat.add(f"I{first_data_row}:I{val_end}")

    dv_yn = DataValidation(type="list", formula1='"da,nu"', allow_blank=True, showDropDown=False)
    ws.add_data_validation(dv_yn)
    dv_yn.add(f"K{first_data_row}:K{val_end}")
    dv_yn.add(f"L{first_data_row}:L{val_end}")

    # îngheață capul de tabel și pune autofiltru
    ws.freeze_panes = f"A{first_data_row}"
    ws.auto_filter.ref = f"A{HEADER_ROW}:L{last_row}"

    # ---------------- foaia de instrucțiuni ----------------
    wsi = wb.create_sheet("Instrucțiuni")
    wsi.column_dimensions["A"].width = 100

    lines = [
        ("ANUNȚURI FABBV — cum se completează", "h1"),
        ("", ""),
        ("Reguli de bază", "h2"),
        ("Un rând = un eveniment. Nu redenumi, nu șterge și nu reordona coloanele din foaia „Evenimente”.", ""),
        ("Coloana „data” trebuie scrisă ca text în format AAAA-LL-ZZ, de exemplu 2026-10-20.", ""),
        ("Dacă lași „ora_start” gol, evenimentul apare ca „Toată ziua” — util pentru deadline-uri.", ""),
        ("Pune „activ” pe „nu” ca să ascunzi un eveniment fără să-l ștergi.", ""),
        ("Pune „important” pe „da” pentru evenimentele care primesc o stea în listă.", ""),
        ("", ""),
        ("Categorii disponibile", "h2"),
        ("open-course — cursuri deschise, la care poate veni oricine", ""),
        ("conferinta — conferințe, simpozioane, porți deschise, hackathon", ""),
        ("workshop — sesiuni practice, ateliere, laboratoare", ""),
        ("cariera — întâlniri cu angajatori, interviuri, internshipuri", ""),
        ("deadline — termene limită pentru dosare, cereri, înscrieri", ""),
        ("examen — examene, restanțe, colocvii", ""),
        ("anunt — orice altceva (program secretariat, ședințe de club)", ""),
        ("", ""),
        ("Foaia „Anunturi”", "h2"),
        ("Pentru anunțuri fără oră, care trebuie să rămână vizibile până la un termen.", ""),
        ("Exemplu: înscrierea la examenul de licență — rămâne până la data limită.", ""),
        ("Coloana valabil_pana_la e obligatorie. În ultima zi apare ULTIMA ZI, apoi anunțul dispare singur.", ""),
        ("Anunțul apare în tabul Azi doar în două zile: a doua zi după adaugat_la, și în ziua termenului.", ""),
        ("Restul timpului stă în tabul Anunțuri. Așa nu aglomerează lista zilnică.", ""),
        ("Nu șterge rândurile expirate — doar nu mai sunt afișate.", ""),
        ("Tipuri: inscriere, administrativ, oportunitate, urgent.", ""),
        ("", ""),
        ("Cum ajung datele în aplicație", "h2"),
        ("1. Completezi acest fișier și îl salvezi.", ""),
        ("2. Rulezi:  python tools/xlsx_to_json.py", ""),
        ("3. Se regenerează data/events.json, pe care îl citește aplicația.", ""),
        ("4. Faci commit și push — GitHub Pages publică noua versiune în 1-2 minute.", ""),
        ("", ""),
        ("Când treci pe Google Sheets", "h2"),
        ("Încarci acest fișier în Google Drive și îl deschizi ca Google Sheet — structura se păstrează.", ""),
        ("Un Apps Script publicat ca Web App va servi direct JSON-ul, iar pasul 2 dispare.", ""),
        ("Detaliile sunt în README.md, secțiunea „Trecerea pe Google Sheets”.", ""),
    ]

    r = 1
    for text, kind in lines:
        c = wsi.cell(row=r, column=1, value=text)
        c.alignment = Alignment(wrap_text=True, vertical="center")
        if kind == "h1":
            c.font = Font(size=14, bold=True, color="FFFFFF")
            c.fill = PatternFill("solid", fgColor=NAVY)
            wsi.row_dimensions[r].height = 30
        elif kind == "h2":
            c.font = Font(size=11, bold=True, color=NAVY)
            wsi.row_dimensions[r].height = 24
        else:
            c.font = Font(size=10)
            wsi.row_dimensions[r].height = 18
        r += 1

    # ---------------- foaia de anunturi ----------------
    wsa = wb.create_sheet("Anunturi", 1)

    wsa.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(COLS_ANUNT))
    ta = wsa.cell(row=1, column=1, value="ANUNȚURI GENERALE — valabile până la un termen")
    ta.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    ta.fill = PatternFill("solid", fgColor=NAVY)
    ta.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    wsa.row_dimensions[1].height = 30

    wsa.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(COLS_ANUNT))
    sa = wsa.cell(row=2, column=1,
                  value="Anunțuri fără oră, de tipul „nu uita să te înscrii la licență”. "
                        "Dispar singure după data din valabil_pana_la.")
    sa.font = Font(size=9, italic=True, color="FFFFFF")
    sa.fill = PatternFill("solid", fgColor=NAVY_SOFT)
    sa.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    wsa.row_dimensions[2].height = 20

    for i, (name, width, hint) in enumerate(COLS_ANUNT, start=1):
        c = wsa.cell(row=3, column=i, value=name)
        c.font = Font(bold=True, color="FFFFFF", size=10)
        c.fill = PatternFill("solid", fgColor=NAVY_SOFT)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = thin_border(NAVY)
        wsa.column_dimensions[get_column_letter(i)].width = width
    wsa.row_dimensions[3].height = 26

    for i, (name, width, hint) in enumerate(COLS_ANUNT, start=1):
        c = wsa.cell(row=4, column=i, value=hint)
        c.font = Font(size=8, italic=True, color="6A666B")
        c.fill = PatternFill("solid", fgColor=GREY)
        c.alignment = Alignment(wrap_text=True, vertical="top")
        c.border = thin_border()
    wsa.row_dimensions[4].height = 42

    for n, an in enumerate(ANUNTURI):
        off, add_off, titlu, desc, tip, link, buton, contact, imp = an
        r = 5 + n
        values = [
            "an-%03d" % (n + 1),
            (today + timedelta(days=add_off)).isoformat(),
            titlu, desc,
            "",
            (today + timedelta(days=off)).isoformat(),
            tip, link, buton, contact, imp, "da",
        ]
        for i, v in enumerate(values, start=1):
            c = wsa.cell(row=r, column=i, value=v)
            c.border = thin_border()
            c.font = Font(size=10)
            c.alignment = Alignment(
                vertical="top",
                wrap_text=i in (3, 4, 10),
                horizontal="center" if i in (2, 5, 6, 11, 12) else "left",
            )
            if n % 2 == 1:
                c.fill = PatternFill("solid", fgColor="FAF8F9")
        wsa.row_dimensions[r].height = 34

    dv_tip = DataValidation(type="list", formula1='"' + ",".join(TIPURI_ANUNT) + '"',
                            allow_blank=False, showDropDown=False)
    dv_tip.error = "Alege un tip din listă."
    dv_tip.errorTitle = "Tip invalid"
    wsa.add_data_validation(dv_tip)
    dv_tip.add("G5:G400")

    dv_yn2 = DataValidation(type="list", formula1='"da,nu"', allow_blank=True, showDropDown=False)
    wsa.add_data_validation(dv_yn2)
    dv_yn2.add("K5:K400")
    dv_yn2.add("L5:L400")

    wsa.freeze_panes = "A5"
    wsa.auto_filter.ref = "A3:L%d" % (4 + len(ANUNTURI))

    wb.save(OUT)
    print(f"Scris: {OUT}")
    print(f"  {len(EVENIMENTE)} evenimente, {len(ANUNTURI)} anunturi")


if __name__ == "__main__":
    build()
