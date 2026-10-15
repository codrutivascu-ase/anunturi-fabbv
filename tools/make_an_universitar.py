# -*- coding: utf-8 -*-
"""
Generează data/an-universitar.json din Calendarul Studentului 2026-2027
(Hotărârea CA nr. 751/21.09.2026) și din structura anului universitar.

Datele sunt transcrise manual din PDF. Când apare calendarul pentru anul
următor, se actualizează tabelele de mai jos și se rulează din nou.

Rulare:  python tools/make_an_universitar.py
"""
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "an-universitar.json"

# Lunile din calendar aparțin anului universitar: sept-dec = 2026, ian-sept = 2027
AN_PENTRU_LUNA = {9: 2026, 10: 2026, 11: 2026, 12: 2026}


def zi(text, an_implicit=2027):
    """'05.11' sau '21.12.2026' -> '2026-11-05'."""
    p = text.strip().split(".")
    d, m = int(p[0]), int(p[1])
    an = int(p[2]) if len(p) > 2 else AN_PENTRU_LUNA.get(m, an_implicit)
    return "%04d-%02d-%02d" % (an, m, d)


# ------------------------------------------------------------------
# Structura anului universitar (ase.ro)
# ------------------------------------------------------------------

PERIOADE = [
    ("deschidere", "Festivitatea de deschidere a anului universitar", "25.09", "25.09", "reper", 1,
     "",
     "Festivitatea de deschidere a anului universitar 2026-2027"),
    ("sem1-cursuri-a", "Activități didactice, semestrul I", "28.09", "20.12", "cursuri", 1,
     "",
     ""),
    ("vacanta-iarna", "Vacanța de iarnă", "21.12", "10.01.2027", "vacanta", 1,
     "",
     "Vacanța de iarnă"),
    ("sem1-cursuri-b", "Activități didactice, semestrul I", "11.01", "22.01", "cursuri", 1,
     "",
     "Prima zi de activități didactice după vacanța de iarnă"),
    ("sesiune-iarna", "Sesiunea de evaluare a cunoștințelor", "25.01", "13.02", "sesiune", 1,
     "",
     "Sesiunea de evaluare a cunoștințelor la programele de studii universitare de licență (IF, IFR, ID), de masterat (cu excepția programelor de masterat organizate modularizat pentru care evaluarea este prevăzută la finalul modulului), anul pregătitor de limba română pentru cetățenii străini, la programul de formare psihopedagogică în vederea certificării competențelor pentru profesia didactică"),
    ("vacanta-sem", "Vacanță după semestrul I", "15.02", "21.02", "vacanta", 1,
     "",
     "Vacanță după semestrul I"),
    ("sem2-cursuri-a", "Activități didactice, semestrul al II-lea", "22.02", "25.04", "cursuri", 2,
     "",
     "Prima zi a semestrului al II-lea pentru studiile universitare de licență (IF și IFR) și pentru studiile universitare de masterat, anul pregătitor de limba română pentru cetățenii străini, programul de formare psihopedagogică în vederea certificării competențelor pentru profesia didactică organizat la forma de învățământ cu frecvență"),
    ("vacanta-paste", "Vacanța de Paște", "26.04", "04.05", "vacanta", 2,
     "",
     "Vacanța de Paște"),
    ("sem2-cursuri-b", "Activități didactice, semestrul al II-lea", "05.05", "05.06", "cursuri", 2,
     "",
     ""),
    ("sesiune-vara", "Sesiunea de evaluare a cunoștințelor", "07.06", "26.06", "sesiune", 2,
     "",
     ""),
    ("disertatie", "Susținerea examenului de disertație", "30.06", "02.07", "finalizare", 2,
     "Cu excepția programelor de masterat de tip MBA",
     "Susținerea examenului de disertație (cu excepția programelor de masterat de tip MBA)"),
    ("restante-vara", "Sesiuni de reprogramare a examenelor", "05.07", "11.07", "restante", 2,
     "",
     ""),
    ("licenta", "Susținerea examenului de licență", "14.07", "16.07", "finalizare", 2,
     "Facultatea de Drept: Proba 1 pe 12.07, Proba 2 pe 15-16.07",
     ""),
    ("vacanta-vara", "Vacanța de vară", "17.07", "24.09.2027", "vacanta", 2,
     "Nu apare în Calendarul Studentului; intervalul rămas până la deschiderea anului următor",
     ""),
]

ZILE_LIBERE = [
    ("30.11", "Sfântul Andrei"),
    ("01.12", "Ziua Națională a României"),
    ("06.04", "Ziua ASE — 114 ani"),
    ("01.05", "Ziua Internațională a Muncii"),
    ("01.06", "Ziua Internațională a Copilului"),
]

# ------------------------------------------------------------------
# Acțiunile din Calendarul Studentului
# (start, final, titlu, temă, detaliu)
# ------------------------------------------------------------------

T_CAZARE, T_BURSE, T_ERASMUS = "cazare", "burse", "erasmus"
T_FINAL, T_EXAMENE, T_TAXE = "finalizare", "examene", "taxe"
T_ADMIN, T_EVENIM = "administrativ", "evenimente"

ACTIUNI = [
    ("15.09", "15.09", "Afișarea repartizării la cazare", T_CAZARE,
     "Afișarea repartizării studenților de la toate ciclurile de studii, care au depus cerere de "
     "cazare, pe site-ul http://cazare.ase.ro"),
    ("15.09", "16.09", "Depunerea contestațiilor privind repartizarea locurilor de cazare", T_CAZARE,
     "Depunerea eventualelor contestații privind modul de repartizare a locurilor de cazare"),
    ("17.09", "17.09", "Afișarea rezultatului contestațiilor privind repartizarea locurilor de cazare", T_CAZARE,
     "Afișarea rezultatului privind soluționarea contestațiilor privind repartizarea locurilor de "
     "cazare, pe site-ul http://cazare.ase.ro"),
    ("21.09", "24.09", "Eliberarea legitimațiilor de cămin și a contractelor de cazare", T_CAZARE,
     "Eliberarea legitimațiilor de cămin și a contractelor de cazare, de la Compartimentul Cazare "
     "Studenți (Strada Frumoasă, nr. 31, sala 12)"),
    ("21.09", "27.09", "Ocuparea locurilor în cămine", T_CAZARE,
     "Ocuparea locurilor în cămine de către studenții beneficiari, indiferent de anul de studiu. "
     "(Inclusiv studenții care și-au ridicat legitimațiile de cămin și contractele de cazare în luna "
     "mai a anului 2026)"),
    ("25.09", "27.09", "Eliberarea legitimațiilor de cămin de la administrația căminului", T_CAZARE,
     "Eliberarea legitimațiilor de cămin și a contractelor de cazare, de la administrația căminului "
     "unde studenții au fost repartizați, pentru anul universitar 2026-20"),
    ("25.09", "09.10", "Afișarea propunerilor de teme de disertație — Facultatea de Drept", T_FINAL,
     "Stabilirea la nivelul departamentului de Drept și afișarea, pe web-site-ul Facultății de Drept "
     "a listei cu propunerile de teme pentru lucrările de disertație pentru programele de masterat "
     "Dreptul european al afacerilor și Carieră judiciară, aferente examenului de disertație sesiunea "
     "iulie 2026 și a capacității maxime de coordonare pentru fiecare coordonator științific"),
    ("25.09", "16.10", "Plata taxei de școlarizare aferentă semestrului I", T_TAXE,
     "Plata taxei de școlarizare aferentă semestrului I, pentru studiile universitare de licență "
     "(anul I – pentru programele de studii a căror taxă de școlarizare semestrială este mai mare de "
     "3250 lei - taxa trebuie achitată anterior semnării contractului de studii -, anii II, III, IV, "
     "III suplimentar și IV suplimentar), masterat (anul I – pentru programele de studii a căror taxă "
     "de școlarizare semestrială este mai mare de 4000 lei - taxa trebuie achitată anterior semnării "
     "contractului de studii, anii II, I suplimentar și II suplimentar) și doctorat, cu excehpţia "
     "programelor de masterat de tip MBA, a căror taxă de şcolarizare este achitată conform "
     "contractului de studii"),
    ("26.09", "28.09", "Depunerea adeverințelor de către studenții copii ai personalului didactic", T_CAZARE,
     "Depunerea adeverințelor (eliberate după 1 septembrie 2026) de către studenții copii ai "
     "personalului didactic aflat în activitate, care vor fi cazați începând cu semestrul I sau care "
     "se află în mobilitate Erasmus în primul semestru și doresc să ocupe un loc de cazare începând "
     "cu semestrul al II-lea, pentru a beneficia în semestrul I de facilități la cazare, prevăzute de "
     "legislația în vigoare"),
    ("28.09", "16.10", "Semnarea contractelor de studii universitare — anul I", T_ADMIN,
     "Semnarea contractelor de studii universitare pentru întreaga perioadă de școlarizare pentru "
     "studenții anului I: 1) de la programele de studii universitare de licență și masterat și a "
     "contractului anual de studii (în cazul studenților de la ID), depunerea documentelor de studii "
     "și a Declarației pe proprie răspundere (Anexa 7), în original; 2) de la programul de formare "
     "psihopedagogică în vederea certificării competențelor pentru profesia didactică (nivelul I, "
     "respectiv nivelul II), forma de invățământ cu frecvență"),
    ("08.10", "15.10", "Transmiterea dosarelor de candidatură ale studenților care reprezintă cazuri sociale", T_BURSE,
     "Transmiterea, în format electronic, la adresa burse@ase.ro, a dosarelor de candidatură ale "
     "studenților, reprezentând cazuri sociale, care doresc să desfășoare activități în cadrul "
     "universității și să primească burse semestriale din venituri proprii ale ASE București care să "
     "le permită plata taxei de școlarizare"),
    ("08.10", "15.10", "Transmiterea dosarelor de candidatură pentru activități în interesul ASE", T_BURSE,
     "Depunerea, în format electronic, la adresa burse@ase.ro, a dosarelor de candidatură ale "
     "studenților care doresc să se implice în activități în interesul Academiei de Studii Economice "
     "din București"),
    ("12.10", "16.10", "Transmiterea dosarelor pentru bursele de excelență ASE", T_BURSE,
     "Transmiterea, în format electronic, la adresa burse@ase.ro, a dosarelor de candidatură pentru "
     "obținerea burselor de excelență acordate din fonduri proprii ale ASE"),
    ("12.10", "16.10", "Transmiterea dosarelor pentru bursele speciale pentru rezultate deosebite", T_BURSE,
     "Transmiterea, în format electronic, la adresele de email ale secretariatelor facultăților sau "
     "prin completarea formularului electronic(după caz), a dosarelor de candidatură pentru obținerea "
     "burselor speciale pentru rezultate deosebite în activitățile culturale și organizatorice și de "
     "performanță pentru activitatea de cercetare științifică"),
    ("12.10", "23.10", "Transmiterea dosarelor pentru bursa de ajutor social ocazional", T_BURSE,
     "Transmiterea, în format electronic, la adresa burse@ase.ro, a dosarelor pentru obținerea bursei "
     "de ajutor social ocazional pentru îmbrăcăminte și încălțăminte, pentru semestrul I al anului "
     "universitar 2026-2027"),
    ("19.10", "23.10", "Transmiterea dosarelor pentru bursele de performanță sportivă", T_BURSE,
     "Transmiterea, în format electronic, la adresele de email ale secretariatelor facultăților sau "
     "prin completarea formularului electronic(după caz), a dosarelor de candidatură pentru obținerea "
     "burselor de performanță sportivă"),
    ("31.10", "31.10", "Termenul final pentru alegerea temei lucrării de licență și a coordonatorului științific", T_FINAL,
     "Termenul final de transmitere, în format electronic, la adresele de email ale secretariatelor "
     "facultăților sau prin completarea formularului electronic (după caz), a cererilor pentru "
     "alegerea temei lucrării de licență și a coordonatorului științific, pentru sesiunea iulie 2027, "
     "aprobarea acestora și stabilirea coordonatorului științific"),
    ("05.11", "05.11", "Afișarea rezultatelor pentru bursele speciale și bursele de excelență", T_BURSE,
     "Afișarea, pe pagina webstudent.ase.ro, a rezultatelor concursurilor de obținere a burselor "
     "speciale pentru rezultate deosebite în activitățile culturale și organizatorice, de performanță "
     "pentru activitatea de cercetare științifică și de performanță sportivă\nAfișarea, pe site-ul "
     "social.ase.ro, a rezultatelor concursului pentru obținerea burselor de excelență acordate din "
     "fonduri proprii ale ASE"),
    ("05.11", "06.11", "Transmiterea contestațiilor privind bursele speciale și bursele de excelență", T_BURSE,
     "Transmiterea, în format electronic, la adresele de email ale secretariatelor facultăților, a "
     "contestațiilor privind acordarea burselor speciale pentru rezultate deosebite în activitățile "
     "culturale, organizatorice și de performanță pentru activitatea de cercetare științifică și de "
     "performanță sportivă\nTransmiterea, în format electronic, la adresa burse@ase.ro, a "
     "contestațiilor privind acordarea burselor de excelență acordate din fonduri proprii ale ASE"),
    ("12.11", "12.11", "Afișarea listelor cu beneficiarii burselor sociale și de performanță I și II", T_BURSE,
     "Afișarea, pe pagina webstudent.ase.ro, a listelor cu studenții beneficiari ai burselor sociale, "
     "de performanță I și II și a celor pentru implicarea în activități extracurriculare în cadrul "
     "ASE București"),
    ("12.11", "12.11", "Afișarea rezultatelor finale pentru bursele speciale și bursele de excelență", T_BURSE,
     "Afișarea, pe pagina webstudent.ase.ro, a rezultatelor finale ale concursului pentru obținerea "
     "burselor speciale pentru rezultate deosebite în activitățile culturale și organizatorice, de "
     "performanță pentru activitatea de cercetare științifică și de performanță sportivă\nAfișarea, pe "
     "site-ul social.ase.ro, a rezultatelor finale ale concursului pentru obținerea burselor de "
     "excelență, acordate din fonduri proprii ale ASE"),
    ("12.11", "13.11", "Transmiterea contestațiilor privind bursele sociale și de performanță", T_BURSE,
     "Transmiterea, în format electronic, la adresele de email ale secretariatelor facultăților, a "
     "contestațiilor privind acordarea burselor sociale, de performanță I și II, și a celor pentru "
     "implicarea în activități extracurriculare în cadrul ASE București"),
    ("19.11", "19.11", "Afișarea listelor finale și a răspunsurilor la contestații", T_BURSE,
     "Afișarea, pe pagina webstudent.ase.ro, a listelor finale cu studenții beneficiari ai burselor "
     "sociale, de performanță I și II și a celor pentru implicarea în activități extracurriculare în "
     "cadrul ASE București, afișarea răspunsurilor la contestații"),
    ("27.11", "27.11", "Termenul final pentru alegerea temei de disertație și a coordonatorului științific", T_FINAL,
     "Termenul final de transmitere, în format electronic, la adresele de email ale secretariatelor "
     "facultăților sau prin completarea formularului electronic (după caz), a cererilor pentru "
     "alegerea temei de disertație și a coordonatorului științific pentru sesiunea iulie 2027, "
     "aprobarea acestora și stabilirea coordonatorului științific"),
    ("07.12", "20.12", "Evaluarea cadrelor didactice de către studenți", T_ADMIN,
     "Evaluarea cadrelor didactice de către studenții din anul I, II, III și IV de la studiile "
     "universitare de licență și anul I și II de la studiile universitare de masterat"),
    ("11.01", "22.01", "Finalizarea evaluărilor pentru disciplinele cu forma de evaluare verificare", T_EXAMENE,
     "Finalizarea evaluărilor pentru disciplinele cu forma de evaluare verificare și comunicarea "
     "rezultatelor"),
    ("29.01", "29.01", "Afișarea ofertei de mobilități Erasmus și asimilate", T_ERASMUS,
     "Afișarea ofertei de mobilități Erasmus și asimilate pentru anul universitar 2027 - 2028"),
    ("08.02", "12.02", "Transmiterea dosarelor pentru bursele sociale disponibilizate", T_BURSE,
     "Transmiterea, în format electronic, la adresele de email ale secretariatelor facultăților sau "
     "prin completarea formularului electronic (după caz), dosarelor pentru obținerea burselor "
     "sociale disponibilizate, de către toți studenții de la studiile universitare de licență și "
     "masterat"),
    ("15.02", "15.02", "Transmiterea cererilor pentru mobilități definitive", T_ADMIN,
     "Transmiterea cererilor pentru mobilități definitive de către studenții înmatriculați în: ● anii "
     "I, II și III programul de studii universitare licență organizat de Facultatea de Drept; ● anii "
     "I și II - celelalte programe de studii universitare de licență; ● anul I programe de studii "
     "universitare de masterat, la adresele de e-mail ale secretariatelor facultăților unde sunt "
     "studenți, respectiv la adresa de e-mail a secretariatului facultății pentru care solicită "
     "mobilitatea (în cazul studenților altor universități)"),
    ("15.02", "26.02", "Depunerea dosarelor de candidatură pentru mobilități Erasmus", T_ERASMUS,
     "Depunerea dosarelor de candidatură pentru mobilități Erasmus și asimilate pentru anul "
     "universitar 2027-2028"),
    ("16.02", "16.02", "Soluționarea cererilor pentru mobilități definitive", T_ADMIN,
     "Soluționarea cererilor pentru mobilități definitive"),
    ("19.02", "20.02", "Afișarea orarului pentru semestrul al II-lea", T_ADMIN,
     "Afișarea orarului pentru semestrul al II-lea al anului universitar 2026-2027"),
    ("22.02", "22.02", "Afișarea statutului financiar al studenților din anul I de licență IF", T_ADMIN,
     "Afișarea pe pagina personală a studenților (webstudent.ase.ro) a statutului financiar (buget "
     "sau taxă) al studenților înmatriculați în anul I de studii la programele de studii universitare "
     "de licență IF, ca urmare a ierarhizării acestora pentru ocuparea locurilor finanțate de la "
     "bugetul de stat, pentru semestrul al II-lea"),
    ("22.02", "22.02", "Aprobarea listei studenților care beneficiază de reducerea taxei de școlarizare", T_TAXE,
     "Aprobarea listei studenților din anii I-III, studii universitare de licență, forma de "
     "învățământ cu frecvență, de la Facultatea de Economie Agroalimentară și a Mediului, care "
     "beneficiază de reducerea taxei de școlarizare pentru semestrul al II-lea conform prevederilor "
     "Metodologiei privind taxele aplicate în Academia de Studii Economice din București"),
    ("22.02", "26.02", "Transmiterea cererilor de implicare în activități în interesul ASE", T_BURSE,
     "Transmiterea, în format electronic, la adresa burse@ase.ro, a cererilor și dosarelor de "
     "implicare în activități în interesul ASE București în vederea obținerii unor burse speciale "
     "pentru implicarea în activități extracurriculare în cadrul ASE"),
    ("22.02", "26.02", "Transmiterea dosarelor pentru bursele speciale și de performanță sportivă disponibilizate", T_BURSE,
     "Transmiterea, în format electronic, la adresele de email ale secretariatelor facultăților, a "
     "dosarelor de candidatură pentru obținerea burselor speciale pentru rezultate deosebite în "
     "activitățile culturale și organizatorice, de performanță pentru activitatea de cercetare "
     "științifică și burselor de performanță sportivă disponibilizate"),
    ("22.02", "12.03", "Plata taxei de școlarizare aferentă semestrului al II-lea", T_TAXE,
     "Plata taxei de școlarizare aferentă semestrului al II-lea, pentru studiile universitare de "
     "licență, masterat și doctorat, anul pregătitor de limba română pentru cetățenii străini, pentru "
     "programul de formare psihopedagogică în vederea certificării competențelor pentru profesia "
     "didactică (Nivelul I, respectiv Nivelul II cu excepţia programelor de masterat de tip MBA, a "
     "căror taxă de şcolarizare se achită conform contractului de studii"),
    ("26.02", "26.02", "Prima zi a semestrului al II-lea pentru studiile universitare de licență ID", T_EVENIM,
     "Prima zi a semestrului al II-lea pentru studiile universitare de licență ID"),
    ("01.03", "12.03", "Transmiterea dosarelor pentru bursa de ajutor social ocazional", T_BURSE,
     "Transmiterea, în format electronic, la adresa burse@ase.ro, a dosarelor pentru obținerea bursei "
     "de ajutor social ocazional pentru îmbrăcăminte și încălțăminte, pentru semestrul II al anului "
     "universitar 2026-2027"),
    ("04.03", "04.03", "Afișarea rezultatelor pentru bursele pentru rezultate deosebite disponibilizate", T_BURSE,
     "Afișarea, pe pagina webstudent.ase.ro, a rezultatelor concursului privind acordarea burselor "
     "pentru rezultate deosebite în activitățile culturale și organizatorice, de performanță pentru "
     "activitatea de cercetare științifică și burselor de performanță sportivă disponibilizate"),
    ("04.03", "05.03", "Transmiterea contestațiilor privind bursele pentru rezultate deosebite disponibilizate", T_BURSE,
     "Transmiterea, în format electronic, la adresele de email a secretariatelor facultăților, a "
     "contestațiilor privind acordarea burselor pentru rezultate deosebite în activitățile culturale "
     "și organizatorice, de performanță pentru activitatea de cercetare științifică și burselor de "
     "performanță sportivă disponibilizate"),
    ("07.03", "07.03", "Afișarea rezultatelor finale pentru bursele pentru rezultate deosebite disponibilizate", T_BURSE,
     "Afișarea pe pagina webstudent.ase.ro a rezultatelor finale ale concursului privind acordarea "
     "burselor pentru rezultate deosebite în activitățile culturale și organizatorice, de performanță "
     "pentru activitatea de cercetare științifică și burselor de performanță sportivă disponibilizate"),
    ("08.03", "21.03", "Înscrierea lucrărilor pentru Sesiunea științifică studențească", T_EVENIM,
     "Înscrierea lucrărilor pentru Sesiunea științifică studențească (la departamente sau conform "
     "informațiilor publicate de prodecanul de resort), faza locală a Olimpiadei Naționale a "
     "Economiștilor în Formare (ONEF)"),
    ("09.03", "09.03", "Afișarea listelor nominale cu candidații Erasmus+ înscriși", T_ERASMUS,
     "Afișarea listelor nominale cu candidații Erasmus+ înscriși (rezultate academice)"),
    ("12.03", "12.03", "Afișarea repartizării pe comisii a candidaților pentru interviul Erasmus+", T_ERASMUS,
     "Afișarea repartizării pe comisii a candidaților pentru interviul de selecție pentru "
     "mobilitățile Erasmus+ și asimilate pentru anul universitar 2027-2028"),
    ("15.03", "19.03", "Interviuri de selecție Erasmus", T_ERASMUS,
     "Interviuri de selecție Erasmus"),
    ("16.03", "16.03", "Afișarea listelor cu beneficiarii burselor sociale și de performanță disponibilizate", T_BURSE,
     "Afișarea pe pagina webstudent.ase.ro a listelor cu studenții beneficiari ai burselor sociale, "
     "de performanță I și II și speciale pentru implicarea în activități extracurriculare în cadrul "
     "ASE București disponibilizate"),
    ("16.03", "17.03", "Transmiterea contestațiilor privind bursele sociale disponibilizate", T_BURSE,
     "Transmiterea, în format electronic, la adresele de email ale secretariatelor facultăților, a "
     "contestațiilor privind acordarea burselor sociale,de performanță I și II, speciale pentru "
     "implicarea în activități extracurriculare în cadrul ASE București disponibilizate"),
    ("22.03", "22.03", "Afișarea listelor finale și a răspunsurilor la contestații", T_BURSE,
     "Afișarea răspunsurilor la contestațiile privind acordarea burselor și afișarea listelor finale "
     "cu studenții beneficiari ai burselor sociale, de performanță I și II, speciale pentru "
     "implicarea în activități extracurriculare în cadrul ASE București pe pagina webstudent.ase.ro"),
    ("22.03", "22.03", "Afișarea rezultatelor interviului de selecție pentru mobilități Erasmus+", T_ERASMUS,
     "Afișarea rezultatelor interviului de selecție pentru mobilități Erasmus+ și asimilate pentru "
     "anul universitar 2027-2028"),
    ("24.03", "26.03", "Transmiterea programului secțiunilor Sesiunii științifice studențești", T_EVENIM,
     "Transmiterea programului secțiunilor Sesiunii științifice studențești de către Prodecanul "
     "responsabil cu cercetarea științifică la Direcția Managementul Cercetării și Inovării"),
    ("26.03", "26.03", "Afișarea rezultatelor selecției pentru mobilități Erasmus+", T_ERASMUS,
     "Afișarea rezultatelor selecției pentru mobilități Erasmus+ și asimilate pentru anul universitar "
     "2027-2028"),
    ("26.03", "29.03", "Aprobarea și afișarea numărului și cuantumului premiilor Sesiunii științifice studențești", T_EVENIM,
     "Aprobarea și afișarea numărului și cuantumului premiilor Sesiunii științifice studențești"),
    ("29.03", "02.04", "Afișarea listelor cu propunerile de teme pentru lucrările de licență și disertație", T_FINAL,
     "Afișarea listelor cu propunerile de teme pentru lucrările de licență și disertație (cu excepția "
     "programului de masterat Dreptul european al afacerilor și Carieră judiciară) pentru anul "
     "universitar 2027-2028, sesiunea iulie 2028 și a capacității maxime de coordonare pentru fiecare "
     "cadru didactic pe website-urile facultăților"),
    ("30.03", "20.04", "Depunerea cererilor de cazare de către studenții care provin din aceeași familie", T_CAZARE,
     "Depunerea cererilor de cazare de către studenții care provin din aceeași familie (frați sau "
     "surori) în variantă electronică, accesând site-ul https://asecommodation.ase.ro/"),
    ("30.03", "20.04", "Depunerea cererilor de cazare de către studenții reveniți din mobilități Erasmus+", T_CAZARE,
     "Depunerea cererilor de cazare de către studenții străini din anii I și II de la programele de "
     "licență și doctorat, respectiv anul III în cadrul Facultății de Drept și studenții anului I de "
     "la programele de masterat, în format electronic, la adresa oana.carnicianu@ase.ro"),
    ("30.03", "20.04", "Depunerea cererilor de cazare de către studenții străini", T_CAZARE,
     "Depunrea cererii de cazare împreună cu situația școlară din care să rezulte notele necesare "
     "calculului mediei de cazare la adresa contact@cazare.ase.ro. de către studenții care au "
     "beneficiat de mobilități Erasmus+ pe primul semestru"),
    ("31.03", "31.03", "Afișarea locurilor rămase disponibile după prima etapă a selecției Erasmus+", T_ERASMUS,
     "Afișarea eventualelor locuri rămase disponibile în urma primei etape a selecției pentru "
     "mobilități Erasmus+ și asimilate în anul universitar 2027-2028"),
    ("31.03", "01.04", "Desfășurarea lucrărilor Sesiunii științifice studențești", T_EVENIM,
     "Desfășurarea lucrărilor Sesiunii științifice studențești, faza locală a Olimpiadei Naționale a "
     "Economiștilor în Formare (ONEF)"),
    ("01.04", "02.04", "Etapa de redistribuire a locurilor pentru mobilități Erasmus+", T_ERASMUS,
     "Etapa de redistribuire a eventualelor locuri pentru mobilități Erasmus+ rămase disponibile"),
    ("05.04", "07.05", "Alegerea disciplinelor opționale și facultative", T_ADMIN,
     "Alegerea disciplinelor opționale și facultative prevăzute în planurile de învățământ aferente "
     "programelor de studii universitare de licență, pentru anul universitar 2027-2028, prin "
     "exprimarea opțiunii pe pagina personala (webstudent.ase.ro)"),
    ("06.04", "06.04", "Afișarea rezultatelor finale ale selecției pentru mobilități Erasmus+", T_ERASMUS,
     "Afișarea rezultatelor finale ale selecției pentru mobilități Erasmus+ și asimilate pentru anul "
     "universitar 2027-2028"),
    ("09.04", "09.04", "Data până la care se poate solicita modificarea titlului lucrării de disertație", T_FINAL,
     "Data până la care studenții anului terminal de la programele de studii universitare de "
     "masterat, respectiv absolvenții ale căror cereri de alegere a lucrării de disertație pentru "
     "sesiunea iulie 2027 au fost aprobate conform termenelor stipulate de reglementările ASE, pot "
     "solicita aprobarea modificării titlului lucrării de disertație"),
    ("21.04", "19.10.2027", "Alegerea temei lucrării de disertație și a coordonatorului științific", T_FINAL,
     "Alegerea temei lucrării de finalizare a studiilor universitare de masterat și a cadrului "
     "didactic coordonator științific pentru anul universitar 2027-2028 de către studenții din anul I "
     "la programele de studii universitare de masterat și absolvenții promoțiilor anterioare care nu "
     "au susținut examenul de finalizare (cu excepția studenților/absolvenților programelor de "
     "masterat organizate de Facultatea de Drept)"),
    ("21.04", "22.10.2027", "Alegerea temei lucrării de licență și a cadrului didactic coordonator", T_FINAL,
     "Alegerea temei lucrării de finalizare a studiilor universitare de licență și a cadrului "
     "didactic coordonator nominalizat în listele de coordonatori științifici, pentru anul "
     "universitar 2027-2028 de către studenții din anul al II-lea la programele de studii "
     "universitare de licență, respectiv studenții din anul al III-lea ai Facultății de Drept și "
     "absolvenții promoțiilor anterioare care nu au susținut examenul de finalizare"),
    ("28.04", "28.04", "Data până la care se poate solicita modificarea titlului lucrării de licență", T_FINAL,
     "Data până la care studenții anului terminal de la programele de studii universitare de licență, "
     "respectiv absolvenții ale căror cereri de alegere a lucrării de licență pentru sesiunea iulie "
     "2027 au fost aprobate conform termenelor stipulate de reglementările ASE pot solicita aprobarea "
     "modificării titlului lucrării de licență"),
    ("03.05", "28.05", "Depunerea rapoartelor de progres al cercetării — studenți doctoranzi", T_ADMIN,
     "Depunerea online și în format fizic a rapoartelor de progres al cercetării, cu avizul "
     "conducătorului științific, pentru studenții doctoranzi"),
    ("10.05", "23.05", "Evaluarea calității activităților didactice de către studenți", T_ADMIN,
     "Evaluarea calității activităților didactice de către studenții programelor de studii "
     "universitare de licență și masterat"),
    ("24.05", "06.06", "Evaluarea studenților reprezentanți", T_ADMIN,
     "Evaluarea studenților reprezentanți de către toți studenții înmatriculați la învățământ cu "
     "frecvență și cu frecvență redusă de la programele de studii universitare de licență, masterat "
     "și doctorat"),
    ("28.05", "28.05", "Afișarea ofertei de mobilități Erasmus pentru semestrul al II-lea", T_ERASMUS,
     "Afișarea ofertei de mobilități Erasmus disponibile după prima selecție pentru semestrul al "
     "II-lea din anul universitar 2027-2028"),
    ("28.05", "28.05", "Comunicarea tematicii pentru Proba 1 — Anul pregătitor de limba română", T_FINAL,
     "Comunicarea tematicii pentru Proba 1 a examenului de finalizare a studiilor în cazul Anului "
     "pregătitor de limba română pentru cetățenii străini"),
    ("31.05", "06.06", "Susținerea ultimelor probe la disciplinele cu forma de evaluare verificare", T_EXAMENE,
     "Perioada destinată susținerii ultimelor probe aferente disciplinelor a căror formă de evaluare "
     "este verificare și comunicarea rezultatelor pentru aceste discipline (excepție fac programele "
     "de masterat organizate modularizat)"),
    ("31.05", "11.06", "Evaluarea rapoartelor de progres al cercetării — studenți doctoranzi", T_ADMIN,
     "Evaluarea online și orală a rapoartelor de progres al cercetării științifice, pentru studenții "
     "doctoranzi"),
    ("04.06", "11.06", "Depunerea dosarelor de candidatură Erasmus pentru semestrul al II-lea", T_ERASMUS,
     "Depunerea dosarelor de candidatură pentru mobilități Erasmus pentru semestrul II din anul "
     "universitar 2027-2028"),
    ("05.06", "05.06", "Finalizarea activităților didactice aferente semestrului al II-lea", T_EVENIM,
     "Finalizarea activităților didactice aferente semestrului al doilea pentru studenții programelor "
     "de studii universitare de licență și masterat, ai anului pregătitor de limba română pentru "
     "cetățenii străini, respectiv ai programului de formare psihopedagogică în vederea certificării "
     "competențelor pentru profesia didactică (Nivelul I, repsctiv Nivelul II)"),
    ("07.06", "11.06", "Sesiune de evaluare a cunoștințelor — anul terminal Nivel II", T_EXAMENE,
     "Sesiune de evaluare a cunoștințelor pentru anul terminal Nivel II – program de formare "
     "psihopedagogică în vederea certificării competențelor pentru profesia didactică, forma de "
     "învățământ cu frecvență"),
    ("07.06", "11.06", "Încărcarea lucrării de disertație în vederea verificării antiplagiat", T_FINAL,
     "Încărcarea, pe pagina webstudent.ase.ro, a lucrării de disertație, în vederea acordării "
     "calificativului și a completării declarației de originalitate (verificare antiplagiat)"),
    ("07.06", "19.06", "Sesiune de evaluare a cunoștințelor — anul terminal de licență și anul pregătitor", T_EXAMENE,
     "Sesiune de evaluare a cunoștințelor, pentru studenții din anul terminal de la programele de "
     "studii universitare de licență, ai anului pregătitor de limbă română pentru cetățenii străini, "
     "din anul terminal de la Nivelul I al programului de formare psihopedagogică în vedererea "
     "certificării competențelor pentru profesia didactică"),
    ("07.06", "20.06", "Stagiu pentru elaborarea lucrării de disertație", T_FINAL,
     "Stagiu pentru elaborarea lucrării de disertaţie pentru studenţii din anul terminal, de la "
     "programele de studii universitare de masterat"),
    ("07.06", "26.06", "Sesiune de evaluare a cunoștințelor — licență anii I–III și masterat anul I", T_EXAMENE,
     "Sesiune de evaluare a cunoștințelor la programele de studii universitare de licență: anii I, II "
     "și III – licență Facultatea de Drept anii I și II pentru celelalte programe de studii "
     "universitare de licență anul I programe de studii universitare de masterat (excepție programele "
     "de masterat organizate de Facultatea de Drept) nivelul I (anii I și II de licență) și nivelul "
     "II (anul I masterat)– programul de formare psihopedagogică în vederea certificării "
     "competențelor pentru profesia didactică, forma de învățământ cu frecvență"),
    ("14.06", "18.06", "Verificarea antiplagiat a lucrărilor de disertație", T_FINAL,
     "Verificarea antiplagiat a lucrărilor de disertație și acordarea calificativului Admis/Respins, "
     "de către conducătorii științifici pentru lucrările de disertație încărcăte"),
    ("18.06", "18.06", "Afișarea listelor nominale cu candidații Erasmus+ pentru a doua selecție", T_ERASMUS,
     "Afișarea listelor nominale cu candidații Erasmus+ înscriși pentru a doua selecție (rezultate "
     "academice)"),
    ("21.06", "25.06", "Încărcarea lucrării de licență în vederea verificării antiplagiat", T_FINAL,
     "Încărcarea pe pagina webstudent.ase.ro, a lucrării de licență, în vederea acordării "
     "calificativului și a completării declarației de originalitate (verificare antiplagiat)"),
    ("21.06", "03.07", "Sesiune de reprogramare — anul terminal Nivel I", T_EXAMENE,
     "Sesiune de reprogramare pentru anul terminal Nivel I de la programele de formare "
     "psihopedagogică în vedererea certificării competențelor pentru profesia didactică, forma de "
     "învățământ cu frecvență"),
    ("22.06", "22.06", "Afișarea calificativului Admis/Respins pentru lucrarea de disertație", T_FINAL,
     "Afișarea pe pagina webstudent.ase.ro a calificativului Admis/Respins pentru lucrarea de "
     "disertație, sesiunea iulie 2027"),
    ("22.06", "22.06", "Afișarea repartizării pe comisii pentru interviul Erasmus — a doua selecție", T_ERASMUS,
     "Afișarea repartizării pe comisii a candidaților pentru interviul de selecție Erasmus pentru a "
     "doua selecție"),
    ("22.06", "23.06", "Sesiune de reprogramare a examenelor — anul terminal de masterat", T_EXAMENE,
     "Sesiune de reprogramare a examenelor pentru studenții din anul terminal al programelor de "
     "studii universitare de masterat"),
    ("22.06", "26.06", "Sesiune de reprogramare a examenelor — anul pregătitor de limba română", T_EXAMENE,
     "Sesiune de reprogramare a examenelor pentru studenții anului pregătitor de limbă română pentru "
     "cetățenii străini"),
    ("22.06", "30.06", "Sesiune de reprogramare a examenelor (prima sesiune) — anul terminal de licență", T_EXAMENE,
     "Sesiune de reprogramare a examenelor (prima sesiune), pentru studenții din anul terminal de la "
     "programele de studii universitare de licență"),
    ("23.06", "25.06", "Interviuri de selecție Erasmus+ pentru semestrul al II-lea", T_ERASMUS,
     "Interviuri de selecție pentru mobilitățile Erasmus+ și asimilate pentru semestrul II din anul "
     "universitar 2027-2028"),
    ("24.06", "25.06", "Înscrieri pentru susținerea examenului de disertație", T_FINAL,
     "Înscrieri pentru susținerea examenului de disertație, prin transmiterea documentelor aferente "
     "înscrierii la adresa de email a secretariatului facultății și transmiterea lucrării de "
     "disertație, versiunea validată în urma verificării antiplagiat, la adresa de email a "
     "departamentului din care face parte coordonatorul științific"),
    ("28.06", "28.06", "Afișarea rezultatelor interviului Erasmus+ pentru semestrul al II-lea", T_ERASMUS,
     "Afișarea rezultatelor interviului pentru mobilități Erasmus+ și asimilate pentru semestrul II "
     "din anul universitar 2027-2028"),
    ("28.06", "28.06", "Transmiterea lucrării pentru Proba 1 — Anul pregătitor de limba română", T_FINAL,
     "Transmiterea prin e-mailul instituțional a lucrării de finalizare care face obiectul probei 1 a "
     "examenului de finalizare a studiilor pentru programul de studii Anul pregătitor de limba română "
     "pentru cetățenii străini, la Departamentul de Limbi Moderne și Comunicare în Afaceri"),
    ("28.06", "29.06", "Înscrierea pentru examenul de finalizare — Anul pregătitor de limba română", T_FINAL,
     "Înscrierea pentru susținerea examenului de finalizare a studiilor pentru absolvenții Anului "
     "pregătitor de limbă română pentru cetățenii străini, la secretariatul Facultăţii de Relaţii "
     "Economice Internaţionale"),
    ("28.06", "01.07", "Înscrierea pentru examenul de absolvire — Nivel II", T_FINAL,
     "Înscrierea pentru examenul de absolvire a programului de formare psihopedagogică în vederea "
     "certificării competențelor pentru profesia didactică Nivel II, forma de învățământ cu frecvență"),
    ("28.06", "02.07", "Reevaluarea rapoartelor de progres al cercetării — studenți doctoranzi", T_ADMIN,
     "Reevaluarea rapoartelor de progres al cercetării științifice pentru studenții doctoranzi"),
    ("28.06", "02.07", "Verificarea antiplagiat a lucrărilor de licență", T_FINAL,
     "Verificarea antiplagiat a lucrărilor de licență și acordarea calificativului Admis/Respins, de "
     "către coordonatorii științifici, pentru lucrările de licență încărcate"),
    ("28.06", "30.07", "Depunerea documentelor de studii în original", T_ADMIN,
     "Depunerea, la secretariatul facultății, a documentelor de studii în original (după caz: diploma "
     "de bacalaureat însoțită de foaia matricolă în original, respectiv diploma de bacalaureat "
     "însoțită de foaia matricolă și diploma de licență însoțită de foaia matricolă/suplimentul la "
     "diplomă în original) conform reglementărilor în vigoare de studenții care îndeplinesc "
     "condițiile și doresc ocuparea unui loc finanțat de la bugetul de stat"),
    ("30.06", "30.06", "Afișarea programării absolvenților Anului pregătitor de limba română", T_FINAL,
     "Afișarea listei cu programarea absolvenţilor Anului pregătitor de limba română pentru cetățenii "
     "străini pentru susţinerea examenului de finalizare"),
    ("01.07", "02.07", "Susținerea examenului de finalizare — Anul pregătitor de limba română", T_FINAL,
     "Susținerea examenului de finalizare a studiilor pentru programul de studii Anul pregătitor de "
     "limba română pentru cetățenii străini"),
    ("02.07", "02.07", "Afișarea calificativului Admis/Respins pentru lucrarea de licență", T_FINAL,
     "Afișarea pe pagina webstudent.ase.ro a calificativului Admis/Respins pentru lucrarea de "
     "licență, sesiunea iulie 2027"),
    ("02.07", "02.07", "Afișarea rezultatelor selecției Erasmus pentru semestrul al II-lea", T_ERASMUS,
     "Afișarea rezultatelor selecției pentru mobilități Erasmus și asimilate asimilate pentru "
     "semestrul II din universitar 2027-2028"),
    ("05.07", "09.07", "Sesiune de reprogramare a examenelor (a doua sesiune) — anul terminal de licență", T_EXAMENE,
     "Sesiune de reprogramare a examenelor (a doua sesiune) pentru studenţii din anul terminal al "
     "programelor de studii universitare de licență"),
    ("05.07", "09.07", "Înscrieri pentru susținerea examenului de licență", T_FINAL,
     "Înscrieri pentru susținerea examenului de licență, prin depunerea documentelor aferente "
     "înscrierii la secretariatul facultății și transmiterea lucrării de licență, versiunea validată, "
     "la adresa de email a departamentului din care face parte conducătorul științific: - Facultatea "
     "de Drept - Celelalte facultăți"),
    ("05.07", "11.07", "Sesiune de reprogramare a examenelor — Nivel I și Nivel II", T_EXAMENE,
     "Sesiunea de reprogramare a examenelor pentru studenții de la Nivelul I (anii I și II de "
     "licență), respectiv de la Nivelul II (anul I masterat) de la programul de formare "
     "psihopedagogică în vederea certificării competențelor pentru profesia didactică, forma de "
     "învățământ cu frecvență"),
    ("05.07", "11.07", "Sesiune de reprogramare a examenelor — licență anii I–III și masterat anul I", T_EXAMENE,
     "Sesiune de reprogramare a examenelor pentru programele de studii universitare de licență: - "
     "anii I, II și III - programul de licență Drept - anii I și II - celelalte programe de studii "
     "universitare de licență anul I – programele de studii universitare de masterat"),
    ("06.07", "06.07", "Afișarea locurilor rămase disponibile pentru mobilități Erasmus, semestrul al II-lea", T_ERASMUS,
     "Afișarea eventualelor locuri rămase disponibile pentru mobilități Erasmus și asimilate pentru "
     "semestrul II din universitar 2027-2028"),
    ("07.07", "08.07", "Etapa de redistribuire a locurilor Erasmus rămase după a doua selecție", T_ERASMUS,
     "Etapa de redistribuire a eventualelor locuri pentru mobilități Erasmus rămase disponibile după "
     "a doua selecție"),
    ("08.07", "09.07", "Susținerea examenului de absolvire — Nivel II", T_FINAL,
     "Susținerea examenului de absolvire a programului de formare psihopedagogică în vedererea "
     "certificării competențelor pentru profesia didactică Nivel II, forma de învățământ cu frecvență"),
    ("12.07", "12.07", "Afișarea rezultatelor finale ale selecției Erasmus pentru semestrul al II-lea", T_ERASMUS,
     "Afișarea rezultatelor finale ale selecției pentru mobilități Erasmus și asimilate pentru "
     "semestrul II din universitar 2027-2028"),
    ("12.07", "12.07", "Susținerea Probei 1 a examenului de LICENȚĂ — Facultatea de Drept", T_FINAL,
     "Susţinerea probei 1 a examenului de LICENŢĂ de către absolvenții Facultății de Drept și "
     "afișarea punctajului"),
    ("12.07", "16.07", "Înscrierea pentru examenul de absolvire — Nivel I", T_FINAL,
     "Înscrierea pentru examenul de absolvire a programului de formare psihopedagogică în vedererea "
     "certificării competențelor pentru profesia didactică - Nivel I, forma de învățământ cu "
     "frecvență"),
    ("13.07", "13.07", "Depunerea contestațiilor aferente Probei 1 — Facultatea de Drept", T_FINAL,
     "Depunerea contestațiilor aferente Probei 1 (electronic, pe adresa de email a secretariatului "
     "Facultății de Drept"),
    ("14.07", "14.07", "Soluționarea contestațiilor și afișarea listei pentru Proba 2 — Facultatea de Drept", T_FINAL,
     "Soluționarea și afișarea rezultatelor contestațiilor depuse și afișarea listei cu absolvenții "
     "Facultății de Drept care pot susține Proba 2: prezentarea și susţinerea lucrării de licenţă"),
    ("14.07", "16.07", "Susținerea examenului de LICENȚĂ", T_FINAL,
     "Susţinerea examenului de LICENŢĂ de absolvenții programelor de studii universitare de licență "
     "organizate de facultățile din cadrul ASE, altele decât Facultatea de Drept"),
    ("15.07", "16.07", "Susținerea Probei 2 — Facultatea de Drept", T_FINAL,
     "Susținerea Probei 2: prezentarea și susţinerea lucrării de licenţă de către absolvenții "
     "Facultății de Drept"),
    ("16.07", "16.07", "Eliberarea adeverinței de absolvire — masterat", T_ADMIN,
     "Eliberarea, la solicitarea absolventului, a documentelor de absolvire a studiilor universitare "
     "de masterat (adeverință de absolvire)"),
    ("19.07", "23.07", "Transmiterea cererilor pentru mobilități definitive și reînmatriculări", T_ADMIN,
     "Transmiterea, în format electronic, la adresa de email a secretariatului facultății, a "
     "cererilor pentru mobilități definitive, reînmatriculări, reluarea studiilor la buget, înscrieri "
     "în anul suplimentar și plata taxelor de reînmatriculare, respectiv de înscriere în anul "
     "suplimentar, după caz"),
    ("19.07", "22.10.2027", "Transmiterea cererilor privind coordonatorul și tema lucrării de licență", T_FINAL,
     "Completarea şi transmiterea, în format electronic, la adresa de email a secretariatul "
     "facultății, a cererilor privind alegerea conducătorului științific și temei lucrării de "
     "licență, de către studenții promoției curente, respectiv de către absolvenții promoțiilor "
     "anterioare, care nu au susținut/promovat examenul de finalizare a studiilor, pentru anul "
     "universitar 2027-2028"),
    ("19.07", "19.11.2027", "Transmiterea cererilor privind coordonatorul și tema lucrării de disertație", T_FINAL,
     "Completarea şi transmiterea, în format electronic, la adresa de email a la secretariatul "
     "facultății, a cererilor privind alegerea conducătorului științific și temei lucrării de "
     "disertație, de către studenții promoției curente, respectiv absolvenții promoțiilor anterioare, "
     "care nu au susținut/promovat examenul de finalizare a studiilor (cu excepția programului de "
     "studii universitare de masterat Dreptul european al afacerilor), pentru anul universitar "
     "2027-2028"),
    ("21.07", "21.07", "Eliberarea adeverinței de absolvire — licență", T_ADMIN,
     "Eliberarea, la solicitarea absolventului, a documentelor de absolvire a studiilor universitare "
     "de licență (adeverință de absolvire)"),
    ("22.07", "22.07", "Stabilirea și afișarea numărului de locuri disponibile pentru mobilități definitive", T_ADMIN,
     "Stabilirea și afișarea numărului de locuri disponibile pentru mobilități definitive, reluarea "
     "studiilor după întrerupere, respectiv reînmatriculare"),
    ("26.07", "29.07", "Soluționarea cererilor pentru mobilități definitive și reînmatriculări", T_ADMIN,
     "Soluționarea cererilor pentru mobilități definitive, reînmatriculări, înscrieri în anul "
     "suplimentar și reluarea studiilor la buget.Orice solicitare depusă după 23 iulie nu mai este "
     "aprobată"),
    ("28.07", "30.07", "Susținerea examenului de absolvire — Nivel I", T_FINAL,
     "Susținerea examenului de absolvire a programului de formare psihopedagogică în vedererea "
     "certificării competențelor pentru profesia didactică - Nivel I, forma de învățământ cu "
     "frecvență"),
    ("10.08", "22.08", "Transmiterea dosarelor sociale pentru semestrul I al anului 2027–2028", T_BURSE,
     "Transmiterea exclusiv online, la adresa de email a secretariatelor facultăților sau prin "
     "completarea formularului electronic (după caz), a dosarelor sociale pentru obținerea unei burse "
     "sociale pe semestrul I al anului universitar 2027-2028 (pentru anii II și III/respectiv anul IV "
     "pentru Facultatea de Drept de la programele de studii universitare de licență și pentru anul II "
     "de la programele de studii universitare de masterat)"),
    ("23.08", "23.08", "Încărcarea lucrării de licență sau disertație — mobilitate internațională", T_FINAL,
     "Încărcarea pe pagina webstudent.ase.ro, a lucrării de licență/disertație în vederea acordării "
     "calificativului și a completării declarației de originalitate (verificare antiplagiat) de către "
     "studenţii participanţi la programe de mobilitate internaţională / dublă diplomă"),
    ("24.08", "24.08", "Verificarea antiplagiat — mobilitate internațională", T_FINAL,
     "Verificarea antiplagiat a lucrărilor de licență și disertație și acordarea calificativului "
     "Admis/Respins de către conducătorii științifici pentru lucrările de licență depuse"),
    ("25.08", "25.08", "Afișarea listei cu calificativele și înscrierea online pentru examen", T_FINAL,
     "Afișarea listei cu absolvenții care au obținut calificativul Admis/Respins pentru lucrarea de "
     "licență/disertație și înscrierea online pentru susținerea examenului de licență/disertație, la "
     "adresa de email a secretariatului facultății și transmiterea lucrării de licență/disertație, "
     "versiunea validată, la adresa de email a departamentului din care face parte coordonatorul "
     "științific"),
    ("26.08", "26.08", "Susținerea examenului de licență și de disertație — mobilitate internațională", T_FINAL,
     "Susţinerea examenului de licenţă şi a examenului de disertaţie de către studenţii participanţi "
     "la programe de mobilitate internaţională/dublă diplomă"),
    ("13.09.2027", "24.09.2027", "Transmiterea dosarelor sociale pentru anul I, semestrul I 2027–2028", T_BURSE,
     "Transmiterea exclusiv online, la adresa de email a secretariatelor facultăților sau prin "
     "completarea formularului electronic (după caz), a dosarelor sociale pentru obținerea unei burse "
     "sociale pe semestrul I al anului universitar 2027-2028 (pentru anul I licență și I masterat)"),
    ("20.09.2027", "20.09.2027", "Afișarea grupelor de studiu și a orarului pentru semestrul I", T_ADMIN,
     "Afișarea grupelor de studiu și a orarului semestrului I la studiile universitare de licență și "
     "masterat"),
]

def build():
    perioade = []
    for pid, titlu, start, final, tip, sem, nota, text_pdf in PERIOADE:
        p = {"id": pid, "titlu": titlu, "start": zi(start), "final": zi(final),
             "tip": tip, "semestru": sem}
        if nota:
            p["nota"] = nota
        if text_pdf and text_pdf.lower() != titlu.lower():
            p["detaliu"] = text_pdf
        perioade.append(p)

    actiuni = []
    for i, (start, final, titlu, tema, detaliu) in enumerate(ACTIUNI, start=1):
        a = {"id": "act-%03d" % i, "titlu": titlu, "start": zi(start),
             "final": zi(final), "tema": tema}
        if detaliu:
            a["detaliu"] = detaliu
        actiuni.append(a)

    actiuni.sort(key=lambda a: (a["start"], a["final"], a["titlu"]))

    date = {
        "an": "2026–2027",
        "sursa": "Calendarul Studentului, Hotărârea CA nr. 751/21.09.2026",
        "sursa_url": "https://www.ase.ro",
        "perioade": perioade,
        "zile_libere": [{"data": zi(d), "titlu": t} for d, t in ZILE_LIBERE],
        "actiuni": actiuni,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(date, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Scris: %s" % OUT)
    print("  %d perioade, %d zile libere, %d acțiuni" %
          (len(perioade), len(ZILE_LIBERE), len(actiuni)))

    from collections import Counter
    for tema, n in Counter(a["tema"] for a in actiuni).most_common():
        print("    %-14s %d" % (tema, n))

    probleme = 0
    # Unele cereri pentru anul urmator se depun pana in toamna lui 2027,
    # deci limita de sus depaseste intentionat finalul anului universitar.
    LIMITA_JOS, LIMITA_SUS = "2026-09-01", "2027-11-30"

    for a in actiuni + perioade:
        nume = a["titlu"]
        if a["start"] > a["final"]:
            print("  ! interval inversat: %s (%s -> %s)" % (nume, a["start"], a["final"]))
            probleme += 1
        for capat in ("start", "final"):
            if not (LIMITA_JOS <= a[capat] <= LIMITA_SUS):
                print("  ! data in afara anului universitar: %s (%s)" % (nume, a[capat]))
                probleme += 1

    for z in date["zile_libere"]:
        if not (LIMITA_JOS <= z["data"] <= LIMITA_SUS):
            print("  ! zi libera in afara anului: %s (%s)" % (z["titlu"], z["data"]))
            probleme += 1

    print("  %s" % ("toate datele sunt coerente" if not probleme
                    else "%d probleme de rezolvat" % probleme))
    return probleme


if __name__ == "__main__":
    build()
