# Motorul de notificări

Un singur Cloudflare Worker care face tot: păstrează abonamentele, și trimite rezumatul zilnic la 9:00.

Nu folosește nicio bibliotecă externă. Semnarea VAPID și criptarea mesajului (RFC 8291) sunt scrise direct peste WebCrypto. Pașii de criptare au fost verificați împotriva vectorului de test oficial din RFC 8291 — toate cele 7 valori intermediare coincid.

## Ce trebuie să faci o singură dată

### 1. Node.js

Wrangler (unealta Cloudflare) are nevoie de el:

```powershell
winget install OpenJS.NodeJS.LTS
```

Apoi **închide și redeschide terminalul**, altfel `node` nu e găsit.

### 2. Cont Cloudflare

Gratuit, la [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up). Nu cere card.

```bash
cd worker
npx wrangler login
```

Se deschide browserul, aprobi, gata.

### 3. Sertarul cu abonamente

```bash
npx wrangler kv namespace create ABONAMENTE
```

Îți răspunde cu un `id`. Îl copiezi în `wrangler.toml`, peste `PUNE_AICI_ID_UL_PRIMIT`.

### 4. Secretele

Cheia privată VAPID e în `.secrete/vapid.txt` (ignorat de git, nu ajunge niciodată pe GitHub). Copiezi valoarea de după `VAPID_PRIVATE_KEY=`:

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
```

Și o parolă inventată de tine, pentru declanșarea manuală la testare:

```bash
npx wrangler secret put CHEIE_TEST
```

### 5. Publici

```bash
npx wrangler deploy
```

Primești o adresă de forma `https://anunturi-fabbv-push.<contul-tău>.workers.dev`.

### 6. Conectezi aplicația

În `js/app.js`, pui adresa primită în `PUSH_API`:

```js
const PUSH_API = 'https://anunturi-fabbv-push.contul-tau.workers.dev';
```

Urci și `VERSION` din `sw.js`, apoi commit și push.

## Verificare

**Workerul trăiește:**
```bash
curl https://anunturi-fabbv-push.<contul-tău>.workers.dev/stare
```
Îți arată câte abonamente are, ora de la București și dacă a trimis azi.

**Te abonezi:** deschizi aplicația pe telefon, apeși clopoțelul, accepți. Apoi `/stare` ar trebui să arate `abonamente: 1`.

**Forțezi rezumatul, fără să aștepți dimineața:**
```bash
curl "https://anunturi-fabbv-push.<contul-tău>.workers.dev/trimite-acum?cheie=PAROLA_TA"
```
Răspunde cu câte au plecat, câte abonamente moarte a șters și câte au eșuat.

**Vezi ce face cron-ul:**
```bash
npx wrangler tail
```

## Cum funcționează trimiterea

Cron-ul rulează **la 15 minute**, nu o dată pe zi. Motivul: Cloudflare programează în UTC, iar 9:00 la București cade la 6:00 UTC vara și 7:00 UTC iarna. Workerul verifică singur ora locală și iese imediat dacă nu e 9:xx.

Un marcaj în KV (`ultima-trimitere`) garantează o singură rundă pe zi, chiar dacă cron-ul se declanșează de mai multe ori.

**În zilele fără evenimente și fără anunțuri, nu se trimite nimic.** O notificare goală e cel mai rapid mod de a face oamenii să dezactiveze notificările.

## Două feluri de notificări

**Rezumatul zilnic, la 9:00** — primele 4 evenimente ale zilei, plus anunțurile care expiră chiar azi (`⏳ Ultima zi`). Dacă nu e nimic, nu pleacă nimic.

**Câte una per anunț nou** — la fiecare rulare, Workerul compară anunțurile active cu cele deja notificate (marcaje `notificat:<id>` în KV) și trimite pentru cele noi. Fiecare are `tag` propriu, deci nu se suprascriu pe telefon.

Trei protecții:

- **Un anunț pleacă abia după ce a stat neschimbat între două citiri** (deci cel puțin 15 minute). Google Sheets salvează la fiecare tastă, fără buton de save: fără verificarea asta, un rând surprins pe jumătate scris ar genera o notificare greșită — iar o notificare trimisă nu se mai poate retrage. Amprenta acoperă titlul, descrierea, termenul, tipul, linkul și persoana de contact.

- **La prima rulare după publicare** se marchează toate anunțurile existente fără să se trimită nimic, altfel abonații ar primi deodată o notificare pentru fiecare anunț vechi.
- **Maximum 3 anunțuri pe rundă și 3 pe zi.** Dacă secretariatul adaugă zece deodată, primele trei pleacă azi, restul în zilele următoare. Un anunț neanunțat încă rămâne nemarcat, deci nu se pierde.

Anunțurile proaspete nu mai intră în rezumatul zilnic: și-au primit deja notificarea la publicare.

## Întreținere

Abonamentele moarte se șterg singure: când serverul de push răspunde 404 sau 410 (telefon dezinstalat, permisiune revocată), Workerul șterge rândul în aceeași rundă.

Nivelul gratuit acoperă 100.000 de cereri pe zi. O facultate cu 2.000 de abonați consumă ~2.000 pe zi.

**Verifici dacă există anunțuri nenotificate:**
```bash
curl "https://anunturi-fabbv-push.fabbv-ase.workers.dev/anunturi-noi?cheie=PAROLA_TA"
```
