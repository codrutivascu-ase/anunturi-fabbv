/* Teste pentru motorul de notificări.
   Rulare:  node worker/test/test.mjs

   Testează codul real din src/index.js, nu o reimplementare:
   - criptarea, prin dus-întors (criptăm, apoi decriptăm ca un telefon)
   - antetul VAPID, verificând semnătura cu cheia publică
   - compunerea mesajului, pe datele reale din data/events.json
*/

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  cripteaza, vapidHeader, compuneMesaj, mesajAnunt, amprentaAnunt,
  b64urlDecode, b64urlEncode
} from '../src/index.js';

const AICI = dirname(fileURLToPath(import.meta.url));
const ute = new TextEncoder();
const utd = new TextDecoder();

let trecute = 0, picate = 0;

function verifica(nume, conditie, detaliu = '') {
  if (conditie) { trecute++; console.log(`  OK      ${nume}`); }
  else { picate++; console.log(`  PICAT   ${nume}${detaliu ? ' — ' + detaliu : ''}`); }
}

function concat(...b) {
  const out = new Uint8Array(b.reduce((n, x) => n + x.length, 0));
  let p = 0; for (const x of b) { out.set(x, p); p += x.length; }
  return out;
}

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
async function hkdfExpand(prk, info, len) {
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, len);
}

/* ---------------- 1. criptare dus-întors ---------------- */
/* Folosim perechea de chei a receptorului din RFC 8291 ca să jucăm
   rolul telefonului: criptăm cu codul Workerului, apoi decriptăm. */

async function testCriptare() {
  console.log('\nCriptarea mesajului (RFC 8291):');

  const UA_PRIVATE = b64urlDecode('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94');
  const UA_PUBLIC_B64 = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
  const AUTH_B64 = 'BTBZMqHH6r4Tts7J_aSIgg';
  const UA_PUBLIC = b64urlDecode(UA_PUBLIC_B64);

  const mesajOriginal = JSON.stringify({
    title: 'FABBV · 4 evenimente azi',
    body: '• 10:00 Open Course: Evaluarea instrumentelor derivate\n⏳ Ultima zi: Cazare'
  });

  const corp = await cripteaza(mesajOriginal, UA_PUBLIC_B64, AUTH_B64);

  // antetul aes128gcm
  const salt = corp.slice(0, 16);
  const rs = new DataView(corp.buffer, corp.byteOffset + 16, 4).getUint32(0);
  const idlen = corp[20];
  const asPublic = corp.slice(21, 21 + idlen);
  const ciphertext = corp.slice(21 + idlen);

  verifica('dimensiunea blocului e 4096', rs === 4096, 'am primit ' + rs);
  verifica('cheia efemeră are 65 de octeți', idlen === 65, 'am primit ' + idlen);
  verifica('cheia efemeră e punct necomprimat', asPublic[0] === 4);
  verifica('salt de 16 octeți', salt.length === 16);

  // partea telefonului: aceiași pași, dar cu cheia lui privată
  const uaKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC', crv: 'P-256', ext: true,
      d: b64urlEncode(UA_PRIVATE),
      x: b64urlEncode(UA_PUBLIC.slice(1, 33)),
      y: b64urlEncode(UA_PUBLIC.slice(33, 65))
    },
    { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);

  const asKey = await crypto.subtle.importKey(
    'raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  const shared = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: asKey }, uaKey, 256));

  const prkKey = await hmac(b64urlDecode(AUTH_B64), shared);
  const keyInfo = concat(ute.encode('WebPush: info\0'), UA_PUBLIC, asPublic);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);
  const prk = await hmac(salt, ikm);
  const cek = await hkdfExpand(prk, ute.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, ute.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);

  let desc;
  try {
    desc = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce }, aes, ciphertext));
  } catch (e) {
    verifica('decriptarea reușește', false, e.message);
    return;
  }

  verifica('decriptarea reușește', true);
  verifica('delimitatorul final e 0x02', desc[desc.length - 1] === 2);

  const recuperat = utd.decode(desc.slice(0, -1));
  verifica('textul recuperat e identic', recuperat === mesajOriginal,
    recuperat.slice(0, 40));

  // fiecare mesaj trebuie să folosească o cheie efemeră nouă
  const corp2 = await cripteaza(mesajOriginal, UA_PUBLIC_B64, AUTH_B64);
  const dif = corp2.slice(21, 86).some((v, i) => v !== asPublic[i]);
  verifica('cheia efemeră diferă la fiecare mesaj', dif);
}

/* ---------------- 2. antetul VAPID ---------------- */

async function testVapid() {
  console.log('\nAntetul VAPID:');

  const env = {
    // pereche generata doar pentru teste, fara nicio valoare in productie
    VAPID_PUBLIC_KEY: 'BKK-3UVttn6n0edbwYnqC0vmEwSB7w3yPH8snKd8dMN69Nci1MKIPJvpzlmSnC4tFxo1ML-0EmmxhDHxa2QhJE4',
    VAPID_PRIVATE_KEY: 'myjp_aQFSwn-GnmuyHJQYAPe5-jbaBx1HJPP9TFeTag',
    VAPID_SUBJECT: 'mailto:test@fabbv.ase.ro'
  };

  const antet = await vapidHeader('https://fcm.googleapis.com/fcm/send/abc123', env);

  verifica('începe cu "vapid t="', antet.startsWith('vapid t='));
  verifica('conține cheia publică', antet.includes('k=' + env.VAPID_PUBLIC_KEY));

  const jwt = antet.slice('vapid t='.length, antet.indexOf(', k='));
  const parti = jwt.split('.');
  verifica('JWT are trei părți', parti.length === 3, 'am ' + parti.length);

  const head = JSON.parse(utd.decode(b64urlDecode(parti[0])));
  const payload = JSON.parse(utd.decode(b64urlDecode(parti[1])));

  verifica('algoritmul e ES256', head.alg === 'ES256');
  verifica('aud e originea serverului de push',
    payload.aud === 'https://fcm.googleapis.com', payload.aud);
  verifica('exp e în viitor, sub 24h',
    payload.exp > Date.now() / 1000 && payload.exp < Date.now() / 1000 + 86400);
  verifica('sub e un mailto', String(payload.sub).startsWith('mailto:'));

  // semnătura trebuie să se verifice cu cheia publică
  const pub = b64urlDecode(env.VAPID_PUBLIC_KEY);
  const pubKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', ext: true,
      x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)) },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);

  const sig = b64urlDecode(parti[2]);
  verifica('semnătura are 64 de octeți', sig.length === 64, 'am ' + sig.length);

  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, pubKey, sig,
    ute.encode(parti[0] + '.' + parti[1]));
  verifica('semnătura se verifică cu cheia publică', valid);
}

/* ---------------- 3. compunerea mesajului ---------------- */

function testMesaj() {
  console.log('\nCompunerea mesajului:');

  const date = JSON.parse(readFileSync(join(AICI, '../../data/events.json'), 'utf8'));
  const azi = date.evenimente[0].data;   // ziua primului eveniment

  const m = compuneMesaj(date, azi);
  verifica('produce un mesaj pentru o zi cu evenimente', m !== null);
  if (m) {
    verifica('titlul numără evenimentele', /\d+ evenimente azi|1 eveniment azi/.test(m.title), m.title);
    verifica('corpul are linii', m.body.split('\n').length >= 1);
    verifica('tag-ul e legat de zi', m.tag === 'fabbv-' + azi);
    console.log('     titlu: ' + m.title);
    for (const l of m.body.split('\n')) console.log('     ' + l);
  }

  // zi fără nimic: nu trimitem notificare goală
  const gol = compuneMesaj({ evenimente: [], anunturi: [] }, azi);
  verifica('zi fără nimic → niciun mesaj', gol === null);

  // anunț în ziua termenului
  const term = compuneMesaj({
    evenimente: [],
    anunturi: [{ titlu: 'Cazare', valabil_pana_la: azi, adaugat_la: '2020-01-01' }]
  }, azi);
  verifica('anunț în ziua termenului → mesaj', term !== null);
  verifica('e marcat „Ultima zi”', term && term.body.includes('Ultima zi'), term && term.body);

  // Anunțurile proaspete NU mai intră în rezumat: primesc propria
  // notificare la publicare. În rezumat apar doar cele care expiră azi.
  const ieri = new Date(azi + 'T12:00:00Z');
  ieri.setUTCDate(ieri.getUTCDate() - 1);
  const proaspat = compuneMesaj({
    evenimente: [],
    anunturi: [{ titlu: 'Licență', valabil_pana_la: '2099-01-01', adaugat_la: ieri.toISOString().slice(0, 10) }]
  }, azi);
  verifica('anunț proaspăt → NU intră în rezumat', proaspat === null);

  const vechi = compuneMesaj({
    evenimente: [],
    anunturi: [{ titlu: 'Vechi', valabil_pana_la: '2099-01-01', adaugat_la: '2020-01-01' }]
  }, azi);
  verifica('anunț vechi, termen departe → nu apare', vechi === null);

  // anunț care nu a început încă
  const viitor = compuneMesaj({
    evenimente: [],
    anunturi: [{ titlu: 'Viitor', valabil_de_la: '2099-01-01', valabil_pana_la: '2099-02-01' }]
  }, azi);
  verifica('anunț care nu a început → nu apare', viitor === null);
}

/* ---------------- 4. notificarea individuală de anunț ---------------- */

function testAnuntIndividual() {
  console.log('\nNotificarea de anunț nou:');

  const m = mesajAnunt({
    id: 'an-002',
    titlu: 'Înscrie-te la examenul de licență',
    valabil_pana_la: '2026-10-21'
  });

  verifica('titlul spune că e anunț', m.title.includes('anunț'), m.title);
  verifica('corpul conține titlul anunțului', m.body.includes('Înscrie-te'));
  verifica('corpul conține termenul în cuvinte', m.body.includes('21 octombrie'), m.body);
  verifica('tag unic per anunț', m.tag === 'fabbv-anunt-an-002', m.tag);
  verifica('linkul deschide anunțul', m.url.includes('an-002'), m.url);

  // două anunțuri diferite nu trebuie să se suprascrie pe telefon
  const m2 = mesajAnunt({ id: 'an-003', titlu: 'Altul', valabil_pana_la: '2026-11-01' });
  verifica('tag-urile diferă între anunțuri', m.tag !== m2.tag);

  console.log('     titlu: ' + m.title);
  for (const l of m.body.split('\n')) console.log('     ' + l);
}

/* ---------------- ---------------- */

async function testAmprenta() {
  console.log('\nAmprenta de stabilitate:');

  const a = {
    id: 'an-010', titlu: 'Înscriere licență', descriere: 'Dosar complet',
    valabil_pana_la: '2026-11-01', tip: 'inscriere', link: '', text_buton: '',
    persoana_contact: 'Secretariat'
  };

  const h1 = await amprentaAnunt(a);
  const h2 = await amprentaAnunt({ ...a });
  verifica('aceleași date → aceeași amprentă', h1 === h2);

  const titluSchimbat = await amprentaAnunt({ ...a, titlu: 'Înscriere licenț' });
  verifica('titlu pe jumătate → altă amprentă', h1 !== titluSchimbat);

  const descSchimbata = await amprentaAnunt({ ...a, descriere: 'Dosar compl' });
  verifica('descriere pe jumătate → altă amprentă', h1 !== descSchimbata);

  const termenSchimbat = await amprentaAnunt({ ...a, valabil_pana_la: '2026-11-02' });
  verifica('termen schimbat → altă amprentă', h1 !== termenSchimbat);

  // id-ul nu intra in amprenta: conteaza doar continutul
  const altId = await amprentaAnunt({ ...a, id: 'an-999' });
  verifica('id-ul nu schimbă amprenta', h1 === altId);

  verifica('amprenta e scurtă și stabilă', h1.length === 16, h1);
}

console.log('Teste pentru motorul de notificări');
await testCriptare();
await testVapid();
testMesaj();
testAnuntIndividual();
await testAmprenta();

console.log(`\n${trecute} trecute, ${picate} picate`);
process.exit(picate ? 1 : 0);
