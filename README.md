# Anunțuri FABBV

PWA cu evenimentele Facultății de Finanțe, Asigurări, Bănci și Burse de Valori (ASE București).
Datele se introduc într-un Excel (ulterior Google Sheet) și ajung în aplicație ca JSON.

## Ce conține

```
index.html                 interfața
css/styles.css             design system (culori FABBV în :root)
js/app.js                  logica: filtre, căutare, detaliu, .ics, notificări
sw.js                      service worker: offline + primirea push-ului
manifest.webmanifest       metadatele PWA
data/events.json           datele citite de aplicație (generat)
evenimente_fabbv.xlsx      fișierul în care introduci evenimentele
icons/                     iconițele PWA (generate)
data/an-universitar.json   structura anului, zilele libere, termenele (generat)
tools/make_an_universitar.py  Calendarul Studentului -> data/an-universitar.json
tools/make_sample_xlsx.py  creează Excel-ul cu exemple
tools/xlsx_to_json.py      Excel -> data/events.json
tools/make_icons.py        generează iconițele
```

## Fluxul de lucru

1. Deschizi `evenimente_fabbv.xlsx` și completezi un rând pe eveniment.
2. `python tools/xlsx_to_json.py`
3. `git add -A && git commit -m "evenimente" && git push`
4. GitHub Pages publică în 1–2 minute.

Coloanele sunt citite **după nume**, nu după poziție — poți adăuga coloane proprii fără să strici nimic, dar nu redenumi cele existente. `data` trebuie în format `AAAA-LL-ZZ`. `activ = nu` ascunde un rând fără să-l ștergi.

## Test local

```bash
python -m http.server 8000
```

Apoi `http://localhost:8000`. Service worker-ul și manifestul cer un server real — nu funcționează deschizând `index.html` direct cu dublu-click.

## Publicare pe GitHub Pages

```bash
git init
git add -A
git commit -m "Anunțuri FABBV — versiunea inițială"
git branch -M main
git remote add origin https://github.com/<user>/anunturi-fabbv.git
git push -u origin main
```

Apoi în repo: **Settings › Pages › Source: Deploy from a branch › main / (root)**.
URL-ul va fi `https://<user>.github.io/anunturi-fabbv/`. Toate căile din proiect sunt relative, deci funcționează din subdirector.

## Test pe telefon

**Android (Chrome)** — deschizi linkul, meniul ⋮ › *Instalează aplicația*. Notificările funcționează și din tab normal.

**iPhone (Safari, obligatoriu Safari)** — deschizi linkul, butonul *Partajare* › *Adaugă la ecranul principal* › *Adaugă*. Apoi deschizi aplicația **de pe ecranul principal** și apeși clopoțelul. Fără pasul de instalare, iOS nu permite nicio notificare. Aplicația detectează situația și afișează instrucțiunile automat.

Butonul de test trimite o notificare locală cu evenimentele zilei — confirmă că permisiunea și service worker-ul funcționează, dar nu testează push-ul de la server.

## Cum ajunge pe telefon ultima versiune

Aplicația e un PWA cu service worker, deci telefonul poate rula luni întregi un cod
vechi fără să bănuiești nimic. Regulile din `sw.js` sunt alese ca asta să nu se mai
întâmple:

| Ce se cere | Strategie | De ce |
|---|---|---|
| pagina (`index.html`) | rețea întâi, 3,5 s, apoi cache | să nu rămâi pe o interfață veche |
| `css/`, `js/`, `data/`, manifestul | rețea întâi, 3,5 s, apoi cache | codul și datele se schimbă des |
| iconițe, imagini | cache întâi, reîmprospătate în fundal | se schimbă rar, pornirea rămâne instant |

Offline merge în continuare: dacă rețeaua tace, răspunde cache-ul, iar pentru pagini
cade pe `index.html`.

În plus, `js/app.js` cere `reg.update()` la pornire și la fiecare revenire în aplicație,
iar când un worker nou preia controlul pagina se reîncarcă o singură dată.

**Deci, după un push obișnuit nu ai nimic de făcut** — nici reinstalare, nici bump de
versiune. GitHub Pages publică în 1–2 minute, iar următoarea deschidere a aplicației
aduce noul cod.

`VERSION` din `sw.js` rămâne doar numele cache-ului. Îl urci când vrei să **ștergi**
ce e în cache pe telefoanele oamenilor — de exemplu după ce redenumești fișiere din
`SHELL` sau schimbi strategiile de mai sus. Altfel îl poți lăsa în pace.

Dacă totuși un telefon pare blocat pe o versiune veche: închizi complet aplicația și
o redeschizi de două ori. Pe Android, `chrome://serviceworker-internals` arată ce
worker rulează efectiv.

## Ce mai lipsește pentru notificările zilnice reale

Butonul de clopoțel cere acum permisiunea și trimite o notificare locală de test. Pentru rezumatul automat de dimineață mai trebuie:

1. **Chei VAPID** — `npx web-push generate-vapid-keys`. Cheia publică intră în `js/app.js`, cea privată în secretele GitHub.
2. **Stocarea abonamentelor** — în `app.js`, funcția `subscribeToPush()` (comentată la `requestPermission`) trimite obiectul de subscripție către un endpoint. Cel mai simplu: un Apps Script care scrie într-o a doua foaie a sheet-ului; mai curat: Supabase.
3. **Cron-ul** — un GitHub Actions cu `schedule: cron: "30 4 * * 1-5"` (04:30 UTC = 07:30 vara, atenție la ora de iarnă) care citește `events.json`, filtrează ziua curentă și trimite push cu `web-push`.
4. **Curățarea abonamentelor expirate** — la răspuns 404/410, ștergi subscripția. Altfel statisticile de livrare devin ficțiune.

Spune-mi când ajungem aici și scriu workflow-ul și scriptul de trimitere.

## Trecerea pe Google Sheets

Încarci `evenimente_fabbv.xlsx` în Drive și îl deschizi ca Google Sheet — structura se păstrează. Apoi, în *Extensions › Apps Script*:

```js
function doGet() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Evenimente');
  const rows = sh.getDataRange().getValues();
  const head = rows.findIndex(r => r.includes('titlu'));
  const keys = rows[head].map(String);
  const out = rows.slice(head + 1)
    .map(r => Object.fromEntries(keys.map((k, i) => [k, r[i]])))
    .filter(o => o.titlu && o.data && String(o.activ).toLowerCase() !== 'nu')
    .map(o => ({ ...o, data: Utilities.formatDate(new Date(o.data), 'Europe/Bucharest', 'yyyy-MM-dd') }));
  return ContentService
    .createTextOutput(JSON.stringify({ actualizat_la: new Date().toISOString(), evenimente: out }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Publici ca Web App cu acces *Anyone*, apoi schimbi `DATA_URL` din `js/app.js` cu URL-ul primit. Pasul de conversie manuală dispare, iar aplicația se actualizează imediat după fiecare editare a sheet-ului.

## Paleta

Eșantionată din materialele oficiale ale facultății (afișul „Elevii de astăzi, profesioniștii de mâine"):

| Token | Hex | Rol |
|---|---|---|
| `--brand` | `#770101` | burgundy de brand — header, footer, butoane, accente |
| `--brand-light` | `#8e1013` | burgundy deschis, titluri pe fundal alb |
| `--brand-dark` | `#5a0000` | stare hover |
| `--bg` | `#f8f6f7` | off-white, fundalul listei |
| `--surface` | `#ffffff` | cardurile |
| `--text-head` | `#0d0d0f` | titluri |
| `--ink-2` | `#1a1e28` | charcoal rece, text secundar |

Cromatica principală e strict **roșu și alb**. Categoriile de evenimente folosesc tonuri închise, temperate, ca să rămână distincte fără să concureze burgundy-ul; open-course primește chiar culoarea de brand.

Fontul e **Poppins**. Logoul din `icons/logo-fabbv-alb.png` e varianta albă oficială, decupată și redimensionată.

Toate culorile sunt tokeni în `:root` din `css/styles.css` și se propagă inclusiv în dark mode. Constantele `NAVY` / `GOLD` din `tools/make_icons.py` și `tools/make_sample_xlsx.py` sunt aliniate la aceeași paletă — după ce le schimbi, rulezi scripturile din nou.

> Notă: site-ul fabbv.ase.ro folosea la data scrierii un alt roșu (`#c50227`) și un header bleumarin. Paleta de aici urmează materialele tipărite, nu site-ul.
