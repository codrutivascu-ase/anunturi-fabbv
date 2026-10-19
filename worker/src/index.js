/* ===========================================================
   Anunțuri FABBV — motorul de notificări
   Cloudflare Worker. Face trei lucruri:

     POST /subscribe     salvează abonamentul unui telefon
     POST /unsubscribe   îl șterge
     cron (la 15 minute):
       - trimite o notificare pentru fiecare anunț nou publicat
       - la 9:00, ora României, trimite rezumatul zilei

   Nu folosește nicio bibliotecă externă: semnarea VAPID și criptarea
   mesajului (RFC 8291) sunt făcute cu WebCrypto, disponibil nativ.
   =========================================================== */

const ORA_TRIMITERII = 9;              // 9:xx, ora Bucureștiului
const TZ = 'Europe/Bucharest';
const TTL = 86400;                     // cât timp încearcă serverul de push să livreze

/* ------------------------------------------------------------------ */
/* ajutoare pe octeți                                                  */
/* ------------------------------------------------------------------ */

const ute = new TextEncoder();

function concat(...bucati) {
  const total = bucati.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of bucati) { out.set(b, p); p += b.length; }
  return out;
}

function b64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlEncode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

// HKDF-Expand pentru lungimi <= 32 octeți (singurele de care avem nevoie)
async function hkdfExpand(prk, info, len) {
  const out = await hmac(prk, concat(info, new Uint8Array([1])));
  return out.slice(0, len);
}

/* ------------------------------------------------------------------ */
/* VAPID: dovedește serverului de push cine trimite                    */
/* ------------------------------------------------------------------ */

async function vapidHeader(endpoint, env) {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = b64urlEncode(ute.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64urlEncode(ute.encode(JSON.stringify({
    aud, exp, sub: env.VAPID_SUBJECT || 'mailto:contact@fabbv.ase.ro'
  })));
  const semnat = `${header}.${payload}`;

  // cheia privată e scalarul brut de 32 de octeți; o importăm ca JWK
  const pub = b64urlDecode(env.VAPID_PUBLIC_KEY);
  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC', crv: 'P-256', ext: true,
      d: env.VAPID_PRIVATE_KEY,
      x: b64urlEncode(pub.slice(1, 33)),
      y: b64urlEncode(pub.slice(33, 65))
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, ute.encode(semnat)));

  return `vapid t=${semnat}.${b64urlEncode(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

/* ------------------------------------------------------------------ */
/* criptarea mesajului (RFC 8291, aes128gcm)                           */
/* ------------------------------------------------------------------ */

async function cripteaza(text, p256dhB64, authB64) {
  const uaPublic = b64urlDecode(p256dhB64);   // 65 octeți, cheia telefonului
  const authSecret = b64urlDecode(authB64);   // 16 octeți

  // pereche efemeră, nouă la fiecare mesaj
  const efemer = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', efemer.publicKey));

  const uaKey = await crypto.subtle.importKey(
    'raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaKey }, efemer.privateKey, 256));

  // secretul comun devine material de cheie, legat de ambele chei publice
  const prkKey = await hmac(authSecret, shared);
  const keyInfo = concat(ute.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = await hkdfExpand(prk, ute.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, ute.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  // 0x02 = delimitatorul de final din specificație
  const plaintext = concat(ute.encode(text), new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aes, plaintext));

  // antetul aes128gcm: salt | dimensiune bloc | lungime cheie | cheie | continut
  const rs = new Uint8Array([0, 0, 0x10, 0]);          // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

/* ------------------------------------------------------------------ */
/* trimiterea către un singur telefon                                  */
/* ------------------------------------------------------------------ */

async function trimite(sub, mesaj, env) {
  const body = await cripteaza(JSON.stringify(mesaj), sub.keys.p256dh, sub.keys.auth);

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': await vapidHeader(sub.endpoint, env),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': String(TTL)
    },
    body
  });

  return res.status;
}

/* ------------------------------------------------------------------ */
/* ce scrie în notificare                                              */
/* ------------------------------------------------------------------ */

function ziLocala(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

function oraLocala(d = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', hour12: false
  }).format(d));
}

function adunaZile(key, n) {
  const d = new Date(key + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function compuneMesaj(date, azi) {
  const evenimente = (date.evenimente || []).filter((e) => e.data === azi);

  // Anunțurile proaspete își primesc propria notificare la publicare,
  // deci în rezumat intră doar cele care expiră azi — ca memento final.
  const anunturi = (date.anunturi || []).filter((a) => {
    if (a.valabil_de_la && azi < a.valabil_de_la) return false;
    return azi === a.valabil_pana_la;
  });

  if (!evenimente.length && !anunturi.length) return null;   // zi liberă: nu trimitem nimic

  const linii = [];
  for (const e of evenimente.slice(0, 4)) {
    linii.push(`• ${e.ora_start || 'Toată ziua'} ${e.titlu}`);
  }
  if (evenimente.length > 4) linii.push(`…și încă ${evenimente.length - 4}`);

  for (const a of anunturi.slice(0, 2)) {
    linii.push('⏳ Ultima zi: ' + a.titlu);
  }

  const n = evenimente.length;
  const titlu = n === 0 ? 'FABBV · anunțuri'
    : n === 1 ? 'FABBV · 1 eveniment azi'
    : `FABBV · ${n} evenimente azi`;

  return { title: titlu, body: linii.join('\n'), tag: 'fabbv-' + azi, url: './' };
}

/* ------------------------------------------------------------------ */
/* difuzare către toate abonamentele                                   */
/* ------------------------------------------------------------------ */

async function difuzeaza(mesaj, env) {
  let trimise = 0, sterse = 0, esuate = 0;
  let cursor;

  do {
    const lot = await env.ABONAMENTE.list({ prefix: 'sub:', cursor });
    cursor = lot.list_complete ? null : lot.cursor;

    for (const cheie of lot.keys) {
      const brut = await env.ABONAMENTE.get(cheie.name);
      if (!brut) continue;

      try {
        const stare = await trimite(JSON.parse(brut), mesaj, env);
        if (stare === 404 || stare === 410) {
          // telefonul a dezinstalat aplicația sau a revocat permisiunea
          await env.ABONAMENTE.delete(cheie.name);
          sterse++;
        } else if (stare >= 200 && stare < 300) {
          trimise++;
        } else {
          esuate++;
        }
      } catch (e) {
        esuate++;
      }
    }
  } while (cursor);

  return { trimise, sterse, esuate };
}

/* ------------------------------------------------------------------ */
/* anunțuri noi: o notificare pentru fiecare, la publicare             */
/* ------------------------------------------------------------------ */

const LIMITA_ANUNTURI_PE_RUNDA = 3;   // cate pot pleca intr-o singura rulare
const PLAFON_ZILNIC = 3;              // cate notificari de anunt, cel mult, intr-o zi

// Amprenta campurilor care conteaza. Daca se schimba intre doua
// citiri, inseamna ca randul inca se scrie.
async function amprentaAnunt(a) {
  const text = [a.titlu, a.descriere, a.valabil_pana_la, a.valabil_de_la,
                a.tip, a.link, a.text_buton, a.persoana_contact].join('\u0000');
  const h = await crypto.subtle.digest('SHA-256', ute.encode(text));
  return b64urlEncode(new Uint8Array(h)).slice(0, 16);
}

function mesajAnunt(a) {
  const termen = new Date(a.valabil_pana_la + 'T12:00:00Z');
  const zi = termen.getUTCDate();
  const luni = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

  return {
    title: 'FABBV · anunț nou',
    body: a.titlu + `\nTermen: ${zi} ${luni[termen.getUTCMonth()]}`,
    tag: 'fabbv-anunt-' + a.id,
    url: './?an=' + encodeURIComponent(a.id)
  };
}

async function anunturiNoi(env, date, azi) {
  const active = (date.anunturi || []).filter((a) => {
    if (a.valabil_de_la && azi < a.valabil_de_la) return false;
    return azi <= a.valabil_pana_la;
  });

  // La prima rulare după publicarea Workerului marcăm tot ce există
  // deja, fără să trimitem nimic. Altfel abonații ar primi deodată
  // o notificare pentru fiecare anunț vechi.
  const initializat = await env.ABONAMENTE.get('anunturi-initializate');
  if (!initializat) {
    for (const a of active) await env.ABONAMENTE.put('notificat:' + a.id, azi);
    await env.ABONAMENTE.put('anunturi-initializate', new Date().toISOString());
    return { initializare: active.length };
  }

  // Daca un anunt a disparut din Sheet inainte sa apuce sa fie trimis,
  // nu lasam amprenta in urma.
  const idActive = new Set(active.map((a) => a.id));
  const urme = await env.ABONAMENTE.list({ prefix: 'vazut:' });
  for (const u of urme.keys) {
    if (!idActive.has(u.name.slice('vazut:'.length))) await env.ABONAMENTE.delete(u.name);
  }

  // Un anunt pleaca abia dupa ce a fost vazut de doua ori la rand cu
  // acelasi continut. Google Sheets salveaza la fiecare tasta, deci un
  // rand surprins la jumatate ar genera o notificare gresita - si o
  // notificare trimisa nu se mai poate retrage.
  const noi = [];
  let inAsteptare = 0;

  for (const a of active) {
    if (await env.ABONAMENTE.get('notificat:' + a.id)) continue;

    const amprenta = await amprentaAnunt(a);
    const vazut = await env.ABONAMENTE.get('vazut:' + a.id);

    if (vazut === amprenta) {
      noi.push(a);
    } else {
      // prima aparitie, sau s-a modificat de la ultima citire
      await env.ABONAMENTE.put('vazut:' + a.id, amprenta, { expirationTtl: 2592000 });
      inAsteptare++;
    }
  }

  if (!noi.length) {
    return inAsteptare ? { seStabilizeaza: inAsteptare } : null;
  }

  // Plafon pe zi: chiar daca secretariatul publica multe, telefoanele
  // nu primesc mai mult de PLAFON_ZILNIC notificari de anunt. Ce ramane
  // nemarcat pleaca in zilele urmatoare, cate putin.
  const cheieZi = 'trimise-azi:' + azi;
  const trimiseAzi = Number(await env.ABONAMENTE.get(cheieZi) || 0);
  const ramase = Math.max(0, PLAFON_ZILNIC - trimiseAzi);

  if (ramase === 0) {
    return { amanate: noi.length, motiv: 'plafonul zilnic de ' + PLAFON_ZILNIC + ' atins' };
  }

  const acum = noi.slice(0, Math.min(LIMITA_ANUNTURI_PE_RUNDA, ramase));
  const rezultate = [];

  for (const a of acum) {
    const r = await difuzeaza(mesajAnunt(a), env);
    await env.ABONAMENTE.put('notificat:' + a.id, azi);
    await env.ABONAMENTE.delete('vazut:' + a.id);
    rezultate.push({ id: a.id, ...r });
  }

  // contorul expira singur dupa doua zile
  await env.ABONAMENTE.put(cheieZi, String(trimiseAzi + acum.length), { expirationTtl: 172800 });

  return {
    anunturiTrimise: rezultate,
    seStabilizeaza: inAsteptare,
    amanate: noi.length - acum.length,
    trimiseAzi: trimiseAzi + acum.length,
    plafon: PLAFON_ZILNIC
  };
}

/* ------------------------------------------------------------------ */
/* cron: rulează la 15 minute; rezumatul pleacă o singură dată pe zi   */
/* ------------------------------------------------------------------ */

async function citesteDate(env) {
  const res = await fetch(env.EVENTS_URL, { cf: { cacheTtl: 0 } });
  return res.ok ? res.json() : null;
}

async function rundaZilnica(env, fortat = false) {
  const azi = ziLocala();

  if (!fortat) {
    if (oraLocala() !== ORA_TRIMITERII) return { sarit: 'nu e ora' };
    if (await env.ABONAMENTE.get('ultima-trimitere') === azi) return { sarit: 'deja trimis azi' };
  }

  const date = await citesteDate(env);
  if (!date) return { eroare: 'nu pot citi events.json' };

  const mesaj = compuneMesaj(date, azi);
  if (!mesaj) {
    if (!fortat) await env.ABONAMENTE.put('ultima-trimitere', azi);
    return { sarit: 'nimic de anunțat azi' };
  }

  const r = await difuzeaza(mesaj, env);
  if (!fortat) await env.ABONAMENTE.put('ultima-trimitere', azi);
  return { ...r, titlu: mesaj.title };
}

/* ------------------------------------------------------------------ */
/* vizite și instalări                                                 */
/* ------------------------------------------------------------------ */

// KV nu are increment atomic; la traficul aplicatiei asta e o aproximare
// acceptabila, la fel ca si contorul "trimise-azi" de mai sus.
async function incrementeaza(env, cheie, ttl) {
  const curent = Number(await env.ABONAMENTE.get(cheie) || 0);
  await env.ABONAMENTE.put(cheie, String(curent + 1), ttl ? { expirationTtl: ttl } : undefined);
}

// id-ul e generat de telefon si tinut in localStorage, nu identifica
// persoana - doar nu numaram de doua ori acelasi telefon.
async function inregistreazaInstalare(env, idVizitator) {
  if (idVizitator) {
    const cheie = 'instalat:' + idVizitator;
    if (await env.ABONAMENTE.get(cheie)) return;   // acelasi telefon, nu numaram de doua ori
    await env.ABONAMENTE.put(cheie, ziLocala(), { expirationTtl: 31536000 });
  }
  await incrementeaza(env, 'instalari-total');
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ORIGIN_PERMIS || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

const json = (obj, env, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json', ...cors(env) }
});

// cheia în KV e amprenta endpointului: același telefon nu se dublează
async function cheiaPentru(endpoint) {
  const h = await crypto.subtle.digest('SHA-256', ute.encode(endpoint));
  return 'sub:' + b64urlEncode(new Uint8Array(h)).slice(0, 32);
}

/* Exporturi pentru teste. Workerul foloseste doar exportul implicit de mai jos;
   acestea permit incarcarea functiilor individual, din afara. */
export { cripteaza, vapidHeader, compuneMesaj, mesajAnunt, amprentaAnunt, ziLocala, oraLocala, b64urlDecode, b64urlEncode };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(env) });

    if (url.pathname === '/subscribe' && req.method === 'POST') {
      let sub;
      try { sub = await req.json(); } catch { return json({ eroare: 'JSON invalid' }, env, 400); }
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
        return json({ eroare: 'abonament incomplet' }, env, 400);
      }
      await env.ABONAMENTE.put(await cheiaPentru(sub.endpoint), JSON.stringify({
        endpoint: sub.endpoint, keys: sub.keys, creat: new Date().toISOString()
      }));
      return json({ ok: true }, env);
    }

    if (url.pathname === '/unsubscribe' && req.method === 'POST') {
      let sub;
      try { sub = await req.json(); } catch { return json({ eroare: 'JSON invalid' }, env, 400); }
      if (sub?.endpoint) await env.ABONAMENTE.delete(await cheiaPentru(sub.endpoint));
      return json({ ok: true }, env);
    }

    // declanșare manuală, pentru testare: /trimite-acum?cheie=...
    if (url.pathname === '/trimite-acum' && url.searchParams.get('cheie') === env.CHEIE_TEST) {
      return json(await rundaZilnica(env, true), env);
    }

    // verifica acum daca exista anunturi nenotificate
    if (url.pathname === '/anunturi-noi' && url.searchParams.get('cheie') === env.CHEIE_TEST) {
      const date = await citesteDate(env);
      if (!date) return json({ eroare: 'nu pot citi events.json' }, env, 500);
      return json(await anunturiNoi(env, date, ziLocala()) || { noi: 0 }, env);
    }

    // vizitele nu se mai numara (consumau scrieri KV); ruta ramane pentru
    // versiunile vechi ale aplicatiei, ramase in cache pe telefoane
    if (url.pathname === '/vizita') return json({ ok: true }, env);

    if (url.pathname === '/instalare') {
      await inregistreazaInstalare(env, url.searchParams.get('v'));
      return json({ ok: true }, env);
    }

    if (url.pathname === '/stare') {
      const lot = await env.ABONAMENTE.list({ prefix: 'sub:' });
      const notif = await env.ABONAMENTE.list({ prefix: 'notificat:' });
      return json({
        abonamente: lot.keys.length + (lot.list_complete ? 0 : '+'),
        anunturiNotificate: notif.keys.length,
        anunturiTrimiseAzi: Number(await env.ABONAMENTE.get('trimise-azi:' + ziLocala()) || 0),
        plafonZilnic: PLAFON_ZILNIC,
        ultimaTrimitere: await env.ABONAMENTE.get('ultima-trimitere'),
        oraBucuresti: oraLocala(),
        ziua: ziLocala(),
        instalariTotal: Number(await env.ABONAMENTE.get('instalari-total') || 0)
      }, env);
    }

    return new Response('Anunțuri FABBV — motorul de notificări', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const azi = ziLocala();
      const date = await citesteDate(env);

      if (date) {
        const noi = await anunturiNoi(env, date, azi);
        if (noi) console.log('anunțuri:', JSON.stringify(noi));
      }

      console.log('rezumat:', JSON.stringify(await rundaZilnica(env)));
    })());
  }
};
