/* ===========================================================
   Anunțuri FABBV — logica aplicației
   Sursa de date: data/events.json (generat din Excel/Google Sheet)
   =========================================================== */

(() => {
  'use strict';

  const DATA_URL = 'data/events.json';
  const AN_URL = 'data/an-universitar.json';

  /* ===== configurarea notificarilor =====================================
     PUSH_API: adresa Workerului de pe Cloudflare. Cat timp e gol,
     clopotelul cere permisiunea si trimite doar notificarea de test,
     fara sa inregistreze telefonul pentru rezumatul zilnic.
     ===================================================================== */
  const PUSH_API = 'https://anunturi-fabbv-push.fabbv-ase.workers.dev';
  const VAPID_PUBLIC_KEY =
    'BOnTwlO3AcECZxwvsL_L-3iDX9vyZKWVCiltB0k4J7udveP0k9NGYnXiUInvyhLXIzFuYkBwV4WeShv2MVT5WRY';
  const TZ = 'Europe/Bucharest';

  /* ---------- categorii ---------- */
  const CATEGORIES = {
    'open-course': { label: 'Open Course', color: 'var(--cat-open-course)' },
    'conferinta':  { label: 'Conferință',  color: 'var(--cat-conferinta)'  },
    'workshop':    { label: 'Workshop',    color: 'var(--cat-workshop)'    },
    'cariera':     { label: 'Carieră',     color: 'var(--cat-cariera)'     },
    'deadline':    { label: 'Deadline',    color: 'var(--cat-deadline)'    },
    'examen':      { label: 'Examen',      color: 'var(--cat-examen)'      },
    'anunt':       { label: 'Anunț',       color: 'var(--cat-anunt)'       }
  };
  /* Categoriile si tipurile pe care le adaugi in foaie nu sunt cunoscute
     dinainte. Vin din events.json si primesc culoarea implicita. */
  const CULOARE_IMPLICITA = 'var(--cat-open-course)';
  const CATEGORII_EXTRA = {};
  const TIPURI_EXTRA = {};

  /* 'seminar-stiintific' -> 'Seminar stiintific', daca foaia nu da altceva */
  function etichetaDinCheie(k) {
    const t = k.replace(/-/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function adaugăExtra(tinta, brute) {
    Object.keys(tinta).forEach((k) => delete tinta[k]);
    Object.entries(brute || {}).forEach(([cheie, eticheta]) => {
      const e = String(eticheta || '').trim() || etichetaDinCheie(cheie);
      tinta[cheie] = {
        label: e.charAt(0).toUpperCase() + e.slice(1),
        color: CULOARE_IMPLICITA
      };
    });
  }

  const catOf = (k) => CATEGORIES[k] || CATEGORII_EXTRA[k] || CATEGORIES['anunt'];

  /* ---------- tipuri de anunț ---------- */
  const TIPURI_ANUNT = {
    'urgent':        { label: 'Urgent',        color: 'var(--an-urgent)' },
    'inscriere':     { label: 'Înscriere',     color: 'var(--an-inscriere)' },
    'oportunitate':  { label: 'Oportunitate',  color: 'var(--an-oportunitate)' },
    'administrativ': { label: 'Administrativ', color: 'var(--an-administrativ)' }
  };
  const tipOf = (k) => TIPURI_ANUNT[k] || TIPURI_EXTRA[k] || TIPURI_ANUNT['administrativ'];

  /* ---------- stare ---------- */
  const state = {
    events: [],
    anunturi: [],
    an: null,
    abonat: false,
    range: 'azi',
    cats: new Set(),
    q: '',
    updatedAt: null
  };

  /* ---------- helperi DOM ---------- */
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls) => `<svg class="${cls || ''}" aria-hidden="true"><use href="#${id}"/></svg>`;

  /* ---------- date ---------- */

  // "azi" în fusul Bucureștiului, ca string YYYY-MM-DD (fără derapaje de UTC)
  function todayKey() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    return parts; // en-CA dă deja YYYY-MM-DD
  }

  const addDays = (key, n) => {
    const d = new Date(key + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const DOW = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
  const MON = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
               'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

  function fmtLong(key) {
    const d = new Date(key + 'T12:00:00Z');
    return `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  function fmtDayHead(key) {
    const t = todayKey();
    if (key === t) return 'Astăzi · ' + fmtLong(key);
    if (key === addDays(t, 1)) return 'Mâine · ' + fmtLong(key);
    return fmtLong(key);
  }

  function fmtTime(ev) {
    if (!ev.ora_start) return 'Toată ziua';
    return ev.ora_final ? `${ev.ora_start}–${ev.ora_final}` : ev.ora_start;
  }

  /* ---------- încărcare date ---------- */

  async function loadEvents({ fresh = false } = {}) {
    const url = DATA_URL + (fresh ? '?t=' + Date.now() : '');
    const res = await fetch(url, { cache: fresh ? 'reload' : 'default' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();

    const raw = Array.isArray(json) ? json : (json.evenimente || json.events || []);
    state.updatedAt = json.actualizat_la || null;
    adaugăExtra(CATEGORII_EXTRA, json.categorii_noi);
    adaugăExtra(TIPURI_EXTRA, json.tipuri_noi);

    state.events = raw
      .filter((e) => e && e.titlu && e.data)
      .filter((e) => String(e.activ ?? 'da').toLowerCase() !== 'nu')
      .map((e, i) => ({
        id: e.id || 'ev-' + i,
        titlu: String(e.titlu).trim(),
        descriere: String(e.descriere || '').trim(),
        data: String(e.data).slice(0, 10),
        ora_start: (e.ora_start || '').trim(),
        ora_final: (e.ora_final || '').trim(),
        locatie: String(e.locatie || '').trim(),
        organizator: String(e.organizator || '').trim(),
        categorie: String(e.categorie || 'anunt').trim().toLowerCase(),
        link: String(e.link || '').trim(),
        important: String(e.important ?? '').toLowerCase() === 'da'
      }))
      .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.data))
      .sort((a, b) =>
        a.data.localeCompare(b.data) ||
        (a.ora_start || '99').localeCompare(b.ora_start || '99') ||
        a.titlu.localeCompare(b.titlu, 'ro'));

    const rawAn = json.anunturi || [];
    state.anunturi = rawAn
      .filter((a) => a && a.titlu && a.valabil_pana_la)
      .map((a, i) => ({
        id: a.id || 'an-' + i,
        titlu: String(a.titlu).trim(),
        descriere: String(a.descriere || '').trim(),
        adaugat_la: String(a.adaugat_la || '').slice(0, 10),
        valabil_de_la: String(a.valabil_de_la || '').slice(0, 10),
        valabil_pana_la: String(a.valabil_pana_la).slice(0, 10),
        tip: String(a.tip || 'administrativ').trim().toLowerCase(),
        link: String(a.link || '').trim(),
        text_buton: String(a.text_buton || '').trim(),
        persoana_contact: String(a.persoana_contact || '').trim(),
        important: String(a.important ?? '').toLowerCase() === 'da'
      }))
      .filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.valabil_pana_la))
      .sort((a, b) =>
        a.valabil_pana_la.localeCompare(b.valabil_pana_la) ||
        a.titlu.localeCompare(b.titlu, 'ro'));
  }

  /* ---------- anunțuri: valabilitate și afișare ---------- */

  const zileIntre = (a, b) =>
    Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);

  // activ = în fereastra de valabilitate
  function anuntActiv(a) {
    const t = todayKey();
    if (a.valabil_de_la && t < a.valabil_de_la) return false;
    return t <= a.valabil_pana_la;
  }

  // Anunțurile nu apar în lista de evenimente — stau doar în tabul lor.
  // Funcția e folosită exclusiv de notificarea zilnică, ca să amintească
  // de un anunț în două momente: a doua zi după ce a fost scris și în ziua
  // termenului.
  function anuntInAzi(a) {
    if (!anuntActiv(a)) return null;
    const t = todayKey();
    if (t === a.valabil_pana_la) return 'deadline';
    if (a.adaugat_la && t === addDays(a.adaugat_la, 1)) return 'nou';
    return null;
  }

  function countdown(a) {
    const n = zileIntre(todayKey(), a.valabil_pana_la);
    if (n <= 0) return { text: 'Ultima zi', urgent: true };
    if (n === 1) return { text: 'Mâine', urgent: true };
    if (n <= 3) return { text: n + ' zile', urgent: true };
    return { text: n + ' zile', urgent: false };
  }

  /* ---------- filtrare ---------- */

  function inRange(ev, range) {
    const t = todayKey();
    if (range === 'azi') return ev.data === t;
    return ev.data >= t; // "toate" = de azi înainte
  }

  function visible() {
    const q = state.q.trim().toLowerCase();
    return state.events.filter((ev) => {
      if (!inRange(ev, state.range)) return false;
      if (state.cats.size && !state.cats.has(ev.categorie)) return false;
      if (!q) return true;
      return [ev.titlu, ev.descriere, ev.locatie, ev.organizator, catOf(ev.categorie).label]
        .join(' ').toLowerCase().includes(q);
    });
  }

  /* ---------- randare ---------- */

  function renderCounts() {
    const t = todayKey();
    const counts = {
      azi: state.events.filter((e) => e.data === t).length,
      toate: state.events.filter((e) => e.data >= t).length
    };
    counts.anunturi = state.anunturi.filter(anuntActiv).length;

    document.querySelectorAll('[data-count]').forEach((n) => {
      const v = counts[n.dataset.count] || 0;
      n.textContent = v > 99 ? '99+' : v;
      n.hidden = v === 0;
    });

    $('#today-date').textContent = fmtLong(t);
    const n = counts.azi;
    $('#today-count').textContent =
      n === 0 ? 'Nimic programat azi' :
      n === 1 ? '1 eveniment azi' : `${n} evenimente azi`;
  }

  function renderCatBar() {
    const bar = $('#cat-bar');
    bar.textContent = '';
    const present = [...new Set(state.events.map((e) => e.categorie))]
      .filter((k) => CATEGORIES[k] || CATEGORII_EXTRA[k]);

    const order = Object.keys(CATEGORIES).filter((k) => present.includes(k))
      .concat(present.filter((k) => !CATEGORIES[k]).sort());

    order.forEach((key) => {
      const c = catOf(key);
      const b = el('button', 'chip');
      b.type = 'button';
      b.setAttribute('aria-pressed', state.cats.has(key) ? 'true' : 'false');
      b.style.setProperty('color', state.cats.has(key) ? '#fff' : c.color);
      b.innerHTML = `<span class="dot" style="background:${c.color}"></span>${esc(c.label)}`;
      b.addEventListener('click', () => {
        state.cats.has(key) ? state.cats.delete(key) : state.cats.add(key);
        renderCatBar();
        renderList();
      });
      bar.appendChild(b);
    });
  }

  function eventCard(ev) {
    const c = catOf(ev.categorie);
    const card = el('button', 'event');
    card.type = 'button';
    card.style.setProperty('--cat', c.color);

    const meta = [];
    if (ev.locatie) meta.push(`<span>${icon('i-pin')}${esc(ev.locatie)}</span>`);
    if (ev.organizator) meta.push(`<span>${icon('i-user')}${esc(ev.organizator)}</span>`);

    card.innerHTML = `
      <div class="event-top">
        <span class="badge">${esc(c.label)}</span>
        <span class="event-time">${icon('i-clock')}${esc(fmtTime(ev))}</span>
        ${ev.important ? `<span class="pin" title="Important">${icon('i-star')}</span>` : ''}
      </div>
      <h3 class="event-title">${esc(ev.titlu)}</h3>
      ${ev.descriere ? `<p class="event-desc">${esc(ev.descriere)}</p>` : ''}
      ${meta.length ? `<div class="event-meta">${meta.join('')}</div>` : ''}
    `;
    card.addEventListener('click', () => openSheet(ev));
    return card;
  }

  function anuntCard(a) {
    const tip = tipOf(a.tip);
    const cd = countdown(a);
    const card = el('article', 'anunt' + (a.important ? ' is-important' : ''));
    card.style.setProperty('--an', tip.color);

    const buton = a.link
      ? `<a class="btn btn-primary" href="${esc(a.link)}" target="_blank" rel="noopener">
           ${esc(a.text_buton || 'Detalii')}${icon('i-link')}</a>`
      : '';

    card.innerHTML = `
      <div class="anunt-top">
        <span class="anunt-tip">${esc(tip.label)}</span>
        <span class="anunt-countdown${cd.urgent ? ' is-urgent' : ''}">
          ${icon('i-hourglass')}${esc(cd.text)}
        </span>
      </div>
      <h3 class="anunt-title">${esc(a.titlu)}</h3>
      ${a.descriere ? `<p class="anunt-desc is-clamped">${esc(a.descriere)}</p>
        <button class="anunt-more" type="button" aria-expanded="false" hidden>
          <span>Vezi detalii</span>${icon('i-chevron-down')}</button>` : ''}
      <div class="anunt-foot">
        <span class="anunt-termen">${icon('i-calendar')}Termen: ${esc(fmtLong(a.valabil_pana_la))}</span>
        ${a.persoana_contact ? `<span>${icon('i-user')}${esc(a.persoana_contact)}</span>` : ''}
      </div>
      ${buton}
    `;

    const desc = card.querySelector('.anunt-desc');
    const mai = card.querySelector('.anunt-more');
    if (desc && mai) {
      mai.addEventListener('click', () => {
        const strans = desc.classList.toggle('is-clamped');
        mai.setAttribute('aria-expanded', String(!strans));
        mai.querySelector('span').textContent = strans ? 'Vezi detalii' : 'Mai puțin';
      });
    }
    return card;
  }

  /* Butonul „Vezi detalii” are rost doar daca textul chiar nu incape.
     Masurarea cere elementul in pagina, deci se face dupa randare. */
  function aratăButoaneleDeExtindere(rădăcină) {
    rădăcină.querySelectorAll('.anunt-desc.is-clamped').forEach((desc) => {
      const mai = desc.nextElementSibling;
      if (!mai || !mai.classList.contains('anunt-more')) return;
      mai.hidden = desc.scrollHeight <= desc.clientHeight + 1;
    });
  }

  /* O singura masuratoare nu e de ajuns: fontul Poppins se incarca dupa
     prima randare si schimba inaltimea randurilor, iar rotirea telefonului
     schimba latimea cardului. Remasuram la ambele. */
  function programeazăMăsurarea() {
    const main = $('#list');
    requestAnimationFrame(() => aratăButoaneleDeExtindere(main));
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => aratăButoaneleDeExtindere(main));
    }
  }

  let reMăsurare;
  window.addEventListener('resize', () => {
    clearTimeout(reMăsurare);
    reMăsurare = setTimeout(() => {
      if (state.range === 'anunturi') aratăButoaneleDeExtindere($('#list'));
    }, 150);
  });

  function renderAnunturiTab() {
    const main = $('#list');
    main.setAttribute('aria-busy', 'false');
    main.textContent = '';

    const q = state.q.trim().toLowerCase();
    const list = state.anunturi.filter(anuntActiv).filter((a) => {
      if (!q) return true;
      return [a.titlu, a.descriere, a.persoana_contact, tipOf(a.tip).label]
        .join(' ').toLowerCase().includes(q);
    });

    if (!list.length) {
      const e = el('div', 'empty');
      e.innerHTML = `${icon('i-megafon')}<h3>Niciun anunț activ</h3>
        <p>${esc(q ? 'Niciun anunț nu corespunde căutării.' : 'Nu există anunțuri în desfășurare.')}</p>`;
      main.appendChild(e);
      return;
    }

    const intro = el('p', 'anunt-intro');
    intro.textContent = 'Anunțuri valabile până la termenul indicat. Dispar automat după ce expiră.';
    main.appendChild(intro);

    list.forEach((a) => main.appendChild(anuntCard(a)));
    programeazăMăsurarea();
  }

  /* ---------- structura anului universitar ---------- */

  const TEME_ACTIUNE = {
    burse:         { eticheta: 'Burse',      culoare: 'var(--t-burse)' },
    cazare:        { eticheta: 'Cazare',     culoare: 'var(--t-cazare)' },
    finalizare:    { eticheta: 'Licență',    culoare: 'var(--t-finalizare)' },
    examene:       { eticheta: 'Examene',    culoare: 'var(--t-examene)' },
    erasmus:       { eticheta: 'Erasmus',    culoare: 'var(--t-erasmus)' },
    taxe:          { eticheta: 'Taxe',       culoare: 'var(--t-taxe)' },
    administrativ: { eticheta: 'Administrativ', culoare: 'var(--t-admin)' },
    evenimente:    { eticheta: 'Evenimente', culoare: 'var(--t-evenim)' }
  };
  const temaOf = (k) => TEME_ACTIUNE[k] || TEME_ACTIUNE.administrativ;

  // tema selectata in tabul An universitar; null = toate
  let temaActiva = null;

  const TIPURI_PERIOADA = {
    cursuri:    { eticheta: 'Cursuri',   culoare: 'var(--p-cursuri)' },
    sesiune:    { eticheta: 'Sesiune',   culoare: 'var(--p-sesiune)' },
    restante:   { eticheta: 'Restanțe',  culoare: 'var(--p-restante)' },
    vacanta:    { eticheta: 'Vacanță',   culoare: 'var(--p-vacanta)' },
    finalizare: { eticheta: 'Finalizare', culoare: 'var(--p-finalizare)' },
    reper:      { eticheta: 'Reper',     culoare: 'var(--p-reper)' }
  };

  async function incarcaAn() {
    if (state.an) return state.an;
    const res = await fetch(AN_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    state.an = await res.json();
    return state.an;
  }

  function stareaPerioadei(p, azi) {
    if (azi < p.start) return 'viitoare';
    if (azi > p.final) return 'trecuta';
    return 'curenta';
  }

  function durataZile(p) {
    return zileIntre(p.start, p.final) + 1;
  }

  function intervalText(p) {
    if (p.start === p.final) return fmtLong(p.start);
    const a = new Date(p.start + 'T12:00:00Z');
    const b = new Date(p.final + 'T12:00:00Z');
    const acelasiAn = a.getUTCFullYear() === b.getUTCFullYear();
    const stangaLuna = MON[a.getUTCMonth()];
    const dreaptaLuna = MON[b.getUTCMonth()];
    if (acelasiAn && stangaLuna === dreaptaLuna) {
      return `${a.getUTCDate()}–${b.getUTCDate()} ${stangaLuna} ${b.getUTCFullYear()}`;
    }
    if (acelasiAn) {
      return `${a.getUTCDate()} ${stangaLuna} – ${b.getUTCDate()} ${dreaptaLuna} ${b.getUTCFullYear()}`;
    }
    return `${a.getUTCDate()} ${stangaLuna} ${a.getUTCFullYear()} – ${b.getUTCDate()} ${dreaptaLuna} ${b.getUTCFullYear()}`;
  }

  // textul din Calendarul Studentului, ascuns sub semnul +
  function pliant(text) {
    if (!text) return '';
    return `<details class="pliant">
        <summary><span class="pliant-eticheta">Detalii</span></summary>
        <p class="pliant-text">${esc(text)}</p>
      </details>`;
  }

  // o zi libera care pica in vacanta sau in weekend nu schimba nimic in program
  const eInVacanta = (z, perioade) => perioade.some(
    (p) => p.tip === 'vacanta' && z.data >= p.start && z.data <= p.final);

  function notaZiLibera(z) {
    const zi = new Date(z.data + 'T12:00:00Z').getUTCDay();
    return (zi === 0 || zi === 6) ? 'cade în weekend' : '';
  }

  function cardPerioada(p, azi) {
    const t = TIPURI_PERIOADA[p.tip] || TIPURI_PERIOADA.reper;
    const stare = stareaPerioadei(p, azi);

    const art = el('article', 'perioada is-' + stare);
    art.style.setProperty('--p', t.culoare);

    let marcaj = '';
    if (stare === 'curenta') {
      const ramase = zileIntre(azi, p.final);
      marcaj = `<span class="perioada-acum">Acum${ramase > 0 ? ' · încă ' + ramase + (ramase === 1 ? ' zi' : ' zile') : ' · ultima zi'}</span>`;
    } else if (stare === 'viitoare') {
      const pana = zileIntre(azi, p.start);
      marcaj = `<span class="perioada-cand">în ${pana} ${pana === 1 ? 'zi' : 'zile'}</span>`;
    }

    art.innerHTML = `
      <div class="perioada-punct"></div>
      <div class="perioada-corp">
        <div class="perioada-sus">
          <span class="perioada-tip">${esc(t.eticheta)}</span>
          ${marcaj}
        </div>
        <h3 class="perioada-titlu">${esc(p.titlu)}</h3>
        <p class="perioada-interval">${esc(intervalText(p))}
          <span class="perioada-durata">· ${durataZile(p)} zile</span></p>
        ${p.nota ? `<p class="perioada-nota">${esc(p.nota)}</p>` : ''}
        ${pliant(p.detaliu)}
      </div>`;
    return art;
  }

  function cardActiune(a, azi) {
    const t = temaOf(a.tema);
    const stare = stareaPerioadei(a, azi);

    const art = el('article', 'actiune is-' + stare);
    art.style.setProperty('--t', t.culoare);

    let cand = '';
    if (stare === 'curenta') {
      const r = zileIntre(azi, a.final);
      cand = `<span class="actiune-cand is-acum">${r === 0 ? 'Ultima zi' : 'încă ' + r + (r === 1 ? ' zi' : ' zile')}</span>`;
    } else if (stare === 'viitoare') {
      const p = zileIntre(azi, a.start);
      cand = `<span class="actiune-cand">în ${p} ${p === 1 ? 'zi' : 'zile'}</span>`;
    }

    art.innerHTML = `
      <div class="actiune-sus">
        <span class="actiune-tema">${esc(t.eticheta)}</span>
        ${cand}
      </div>
      <h4 class="actiune-titlu">${esc(a.titlu)}</h4>
      <p class="actiune-interval">${esc(intervalText(a))}</p>
      ${pliant(a.detaliu)}`;
    return art;
  }

  function barabTeme(actiuni, azi) {
    const prezente = [...new Set(actiuni.map((a) => a.tema))]
      .filter((k) => TEME_ACTIUNE[k]);
    const ordine = Object.keys(TEME_ACTIUNE).filter((k) => prezente.includes(k));

    const bar = el('div', 'teme-bar');
    const toate = el('button', 'chip');
    toate.type = 'button';
    toate.textContent = 'Toate';
    toate.setAttribute('aria-pressed', temaActiva === null ? 'true' : 'false');
    toate.addEventListener('click', () => { temaActiva = null; renderAnTab(); });
    bar.appendChild(toate);

    ordine.forEach((k) => {
      const t = temaOf(k);
      const n = actiuni.filter((a) => a.tema === k).length;
      const b = el('button', 'chip');
      b.type = 'button';
      b.setAttribute('aria-pressed', temaActiva === k ? 'true' : 'false');
      b.style.setProperty('color', temaActiva === k ? '#fff' : t.culoare);
      b.innerHTML = `<span class="dot" style="background:${t.culoare}"></span>${esc(t.eticheta)} <span class="chip-n">${n}</span>`;
      b.addEventListener('click', () => {
        temaActiva = (temaActiva === k) ? null : k;
        renderAnTab();
      });
      bar.appendChild(b);
    });
    return bar;
  }

  function renderAnTab() {
    const main = $('#list');
    main.setAttribute('aria-busy', 'false');
    main.textContent = '';

    const date = state.an;
    if (!date) {
      main.innerHTML = `<div class="empty">${icon('i-busola')}
        <h3>Calendarul nu s-a încărcat</h3><p>Încearcă să reîmprospătezi.</p></div>`;
      return;
    }

    const azi = todayKey();
    const perioade = [...date.perioade].sort((a, b) => a.start.localeCompare(b.start));

    // unde suntem acum
    const curente = perioade.filter((p) => stareaPerioadei(p, azi) === 'curenta');
    const urmatoarea = perioade.find((p) => p.start > azi);

    const antet = el('section', 'an-antet');
    const liniiAcum = curente.length
      ? curente.map((p) => esc(p.titlu)).join(' · ')
      : 'În afara perioadelor de activitate';
    antet.innerHTML = `
      <p class="an-eticheta">Anul universitar ${esc(date.an)}</p>
      <h2 class="an-acum">${liniiAcum}</h2>
      ${urmatoarea ? `<p class="an-urmeaza">Urmează <strong>${esc(urmatoarea.titlu)}</strong>
         în ${zileIntre(azi, urmatoarea.start)} zile</p>` : ''}
      ${bandaAn(perioade, azi)}
      ${(() => {
        const act = (date.actiuni || []).filter((a) => a.final >= azi);
        const urgent = act.filter((a) => a.final >= azi && zileIntre(azi, a.final) <= 7).length;
        if (!act.length) return '';
        return `<p class="an-termene">${act.length} termene urmează` +
          (urgent ? ` · <strong>${urgent}</strong> se încheie în 7 zile` : '') + `</p>`;
      })()}`;
    main.appendChild(antet);

    // structura anului
    const titluStructura = el('h3', 'an-sectiune');
    titluStructura.textContent = 'Structura anului universitar';
    main.appendChild(titluStructura);

    const lista = el('div', 'an-cronologie');
    perioade.forEach((p) => lista.appendChild(cardPerioada(p, azi)));
    main.appendChild(lista);

    // zile libere
    // O zi libera care cade intr-o vacanta nu spune nimic nou — tot liber
    // era. Raman doar cele care intrerup o perioada de activitate.
    const libere = (date.zile_libere || [])
      .filter((z) => z.data >= azi)
      .filter((z) => !eInVacanta(z, perioade));
    if (libere.length) {
      const sec = el('section', 'an-libere');
      sec.innerHTML = `<h3>Zile libere ce urmează</h3>` +
        libere.map((z) => {
          const nota = notaZiLibera(z);
          return `<div class="zi-libera">
            <span class="zi-data">${esc(fmtLong(z.data))}</span>
            <span class="zi-corp">
              <span class="zi-titlu">${esc(z.titlu)}</span>
              ${nota ? `<span class="zi-nota">${esc(nota)}</span>` : ''}
            </span>
          </div>`;
        }).join('') +
        `<p class="zi-sursa">Sărbătorile legale sunt cele din art. 139 din Codul muncii;
          Calendarul Studentului le menționează doar pe unele dintre ele.</p>`;
      main.appendChild(sec);
    }

    // termene administrative din Calendarul Studentului
    const toateActiunile = (date.actiuni || []).filter((a) => a.final >= azi);
    if (toateActiunile.length) {
      const titluTermene = el('h3', 'an-sectiune');
      titluTermene.textContent = 'Acțiuni, termene și perioade de realizare';
      main.appendChild(titluTermene);

      main.appendChild(barabTeme(toateActiunile, azi));

      const vizibile = temaActiva
        ? toateActiunile.filter((a) => a.tema === temaActiva)
        : toateActiunile;

      if (!vizibile.length) {
        const gol = el('p', 'an-gol');
        gol.textContent = 'Niciun termen pe tema aleasă.';
        main.appendChild(gol);
      } else {
        // grupate pe luni
        const peLuni = new Map();
        vizibile.forEach((a) => {
          const d = new Date(a.start + 'T12:00:00Z');
          const cheie = a.start.slice(0, 7);
          if (!peLuni.has(cheie)) {
            peLuni.set(cheie, { eticheta: MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(), items: [] });
          }
          peLuni.get(cheie).items.push(a);
        });

        peLuni.forEach((grup) => {
          const sec = el('section', 'luna-grup');
          const cap = el('div', 'luna-cap');
          cap.innerHTML = `<h4>${esc(grup.eticheta)}</h4><span class="rule"></span>
            <span class="luna-n">${grup.items.length}</span>`;
          sec.appendChild(cap);
          grup.items.forEach((a) => sec.appendChild(cardActiune(a, azi)));
          main.appendChild(sec);
        });
      }
    }

    const sursa = el('p', 'an-sursa');
    sursa.innerHTML = `Date oficiale: <a href="${esc(date.sursa_url)}" target="_blank" rel="noopener">${esc(date.sursa)}</a>`;
    main.appendChild(sursa);
  }

  // bara care arata cat din an a trecut
  function bandaAn(perioade, azi) {
    const start = perioade[0].start;
    const final = perioade[perioade.length - 1].final;
    const total = zileIntre(start, final);
    const trecut = Math.max(0, Math.min(total, zileIntre(start, azi)));
    const procent = Math.round((trecut / total) * 100);

    const segmente = perioade.map((p) => {
      const t = TIPURI_PERIOADA[p.tip] || TIPURI_PERIOADA.reper;
      const lat = Math.max(0.6, (durataZile(p) / total) * 100);
      const stanga = (zileIntre(start, p.start) / total) * 100;
      return `<span class="banda-seg" style="left:${stanga}%;width:${lat}%;background:${t.culoare}"></span>`;
    }).join('');

    return `<div class="an-banda" role="img" aria-label="${procent}% din anul universitar a trecut">
        ${segmente}
        <span class="banda-acum" style="left:${(trecut / total) * 100}%"></span>
      </div>
      <p class="an-procent">${procent}% din anul universitar a trecut</p>`;
  }

  function renderList() {
    if (state.range === 'anunturi') { renderAnunturiTab(); return; }
    if (state.range === 'an') { renderAnTab(); return; }

    const main = $('#list');
    main.setAttribute('aria-busy', 'false');
    main.textContent = '';

    const list = visible();

    if (!list.length) {
      const e = el('div', 'empty');
      const why = state.q || state.cats.size
        ? 'Niciun eveniment nu corespunde filtrelor. Încearcă să le resetezi.'
        : state.range === 'azi'
          ? 'Nu e programat nimic astăzi. Vezi „Evenimente” pentru zilele următoare.'
          : 'Nu există evenimente viitoare.';
      e.innerHTML = `${icon('i-inbox')}<h3>Niciun eveniment</h3><p>${esc(why)}</p>`;
      main.appendChild(e);
      return;
    }

    // grupare pe zile
    const byDay = new Map();
    list.forEach((ev) => {
      if (!byDay.has(ev.data)) byDay.set(ev.data, []);
      byDay.get(ev.data).push(ev);
    });

    const t = todayKey();
    byDay.forEach((evs, day) => {
      const group = el('section', 'day-group');
      const head = el('div', 'day-head' + (day === t ? ' is-today' : ''));
      head.innerHTML = `<h2>${esc(fmtDayHead(day))}</h2><span class="rule"></span>`;
      group.appendChild(head);
      evs.forEach((ev) => group.appendChild(eventCard(ev)));
      main.appendChild(group);
    });
  }

  /* ---------- detaliu ---------- */

  function openSheet(ev) {
    const c = catOf(ev.categorie);
    const rows = [
      ['i-calendar', 'Data', fmtLong(ev.data)],
      ['i-clock', 'Ora', fmtTime(ev)],
      ev.locatie ? ['i-pin', 'Locație', ev.locatie] : null,
      ev.organizator ? ['i-user', 'Organizator', ev.organizator] : null,
      ['i-tag', 'Categorie', c.label]
    ].filter(Boolean);

    $('#sheet-body').innerHTML = `
      <span class="badge" style="--cat:${c.color}">${esc(c.label)}</span>
      <h2 id="sheet-title">${esc(ev.titlu)}</h2>
      ${ev.descriere ? `<p class="event-desc">${esc(ev.descriere)}</p>` : ''}
      <dl class="detail-rows">
        ${rows.map(([ic, k, v]) => `
          <div class="detail-row">${icon(ic)}<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div></div>
        `).join('')}
      </dl>
      <div class="sheet-actions">
        <button class="btn btn-primary" id="btn-ics">${icon('i-calendar')}Adaugă în calendar</button>
        ${ev.link ? `<a class="btn btn-ink" href="${esc(ev.link)}" target="_blank" rel="noopener">${icon('i-link')}Detalii / înscriere</a>` : ''}
        <button class="btn btn-ghost" id="btn-share">${icon('i-share')}Trimite mai departe</button>
        <button class="btn btn-ghost" id="btn-close-sheet">Închide</button>
      </div>
    `;

    $('#sheet').classList.add('open');
    $('#sheet').setAttribute('aria-hidden', 'false');
    $('#scrim').classList.add('open');
    document.body.style.overflow = 'hidden';

    $('#btn-ics').addEventListener('click', () => downloadIcs(ev));
    $('#btn-close-sheet').addEventListener('click', closeSheet);
    $('#btn-share').addEventListener('click', () => shareEvent(ev));
  }

  function closeSheet() {
    $('#sheet').classList.remove('open');
    $('#sheet').setAttribute('aria-hidden', 'true');
    $('#scrim').classList.remove('open');
    document.body.style.overflow = '';
  }

  async function shareEvent(ev) {
    const text = `${ev.titlu}\n${fmtLong(ev.data)}, ${fmtTime(ev)}` +
      (ev.locatie ? `\n${ev.locatie}` : '') +
      (ev.link ? `\n${ev.link}` : '');
    try {
      if (navigator.share) {
        await navigator.share({ title: ev.titlu, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast('Copiat în clipboard');
      }
    } catch (_) { /* utilizatorul a anulat */ }
  }

  /* ---------- export .ics ---------- */

  function downloadIcs(ev) {
    const pad = (n) => String(n).padStart(2, '0');
    const dateOnly = ev.data.replace(/-/g, '');
    let dtStart, dtEnd, allDay = !ev.ora_start;

    if (allDay) {
      dtStart = `;VALUE=DATE:${dateOnly}`;
      dtEnd = `;VALUE=DATE:${addDays(ev.data, 1).replace(/-/g, '')}`;
    } else {
      const [h, m] = ev.ora_start.split(':').map(Number);
      let eh = h + 2, em = m;
      if (ev.ora_final) { [eh, em] = ev.ora_final.split(':').map(Number); }
      dtStart = `;TZID=${TZ}:${dateOnly}T${pad(h)}${pad(m)}00`;
      dtEnd = `;TZID=${TZ}:${dateOnly}T${pad(eh)}${pad(em)}00`;
    }

    const fold = (s) => s.replace(/[,;\\]/g, (c) => '\\' + c).replace(/\n/g, '\\n');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FABBV ASE//Anunturi//RO',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${ev.id}@fabbv.ase.ro`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART${dtStart}`,
      `DTEND${dtEnd}`,
      `SUMMARY:${fold(ev.titlu)}`,
      ev.descriere ? `DESCRIPTION:${fold(ev.descriere)}` : '',
      ev.locatie ? `LOCATION:${fold(ev.locatie)}` : '',
      ev.link ? `URL:${ev.link}` : '',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${fold(ev.titlu)}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = ev.titlu.replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 50) + '.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- notificări ---------- */

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function openNotifyModal() {
    const box = $('#notify-content');
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

    // iOS cere instalarea pe ecranul principal înainte de orice notificare
    if (isIOS() && !isStandalone()) {
      box.innerHTML = `
        <p>Pe iPhone, notificările funcționează doar dacă adaugi aplicația pe ecranul principal. Durează 15 secunde:</p>
        <ol class="steps">
          <li>Apasă butonul <strong>Partajare</strong> ${icon('i-share')} din bara Safari (jos).</li>
          <li>Alege <kbd>Adaugă la ecranul principal</kbd> ${icon('i-plus-square')}</li>
          <li>Confirmă cu <kbd>Adaugă</kbd>.</li>
          <li>Deschide aplicația <strong>de pe ecranul principal</strong> și apasă din nou clopoțelul.</li>
        </ol>
        <p class="note">Trebuie să folosești <strong>Safari</strong>, nu Chrome — pe iOS doar Safari poate instala aplicația.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="notify-ok">Am înțeles</button>
        </div>`;
    } else if (!supported) {
      box.innerHTML = `
        <p>Browserul tău nu suportă notificări push. Încearcă Chrome pe Android sau Safari pe iOS 16.4+.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="notify-ok">Închide</button>
        </div>`;
    } else if (Notification.permission === 'granted') {
      box.innerHTML = `
        <p>Notificările sunt <strong>active</strong>: rezumatul zilei la 9:00 și câte o notificare la fiecare anunț nou.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="notify-test">Trimite o notificare de test</button>
          <button class="btn btn-ghost" id="notify-ok">Închide</button>
        </div>`;
    } else if (Notification.permission === 'denied') {
      box.innerHTML = `
        <p>Notificările au fost blocate. Le poți reactiva din setările browserului pentru acest site.</p>
        <p class="note">iPhone: <kbd>Setări › Notificări › FABBV</kbd>. Android: apasă lacătul din bara de adrese › Notificări.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="notify-ok">Închide</button>
        </div>`;
    } else {
      box.innerHTML = `
        <p>Dimineața la ora 9:00 primești un rezumat cu ce se întâmplă azi la FABBV, plus o notificare separată când apare un anunț nou. În zilele fără nimic, nu primești nimic.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="notify-enable">Activează notificările</button>
          <button class="btn btn-ghost" id="notify-ok">Mai târziu</button>
        </div>`;
    }

    const modal = $('#modal-notify');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    $('#scrim').classList.add('open');

    box.querySelector('#notify-ok')?.addEventListener('click', closeNotifyModal);
    box.querySelector('#notify-enable')?.addEventListener('click', requestPermission);
    box.querySelector('#notify-test')?.addEventListener('click', testNotification);
  }

  function closeNotifyModal() {
    const modal = $('#modal-notify');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (!$('#sheet').classList.contains('open')) $('#scrim').classList.remove('open');
  }

  /* ---------- abonarea la rezumatul zilnic ---------- */

  // cheia VAPID se trimite catre browser ca octeti, nu ca text
  function cheieInOcteti(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const brut = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(brut, (c) => c.charCodeAt(0));
  }

  // Inregistreaza telefonul la Worker. Rulam asta si la fiecare pornire
  // cand permisiunea e deja data: abonamentele expira, iar reinstalarea
  // aplicatiei genereaza unul nou.
  async function subscribeToPush({ tacut = false } = {}) {
    if (!PUSH_API) return false;
    if (!('PushManager' in window)) return false;
    if (Notification.permission !== 'granted') return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: cheieInOcteti(VAPID_PUBLIC_KEY)
        });
      }

      const res = await fetch(PUSH_API + '/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      return true;
    } catch (e) {
      console.warn('abonarea la push a esuat:', e);
      if (!tacut) toast('Notificarile zilnice nu au putut fi activate');
      return false;
    }
  }

  // Oprirea notificarilor. Permisiunea data browserului nu poate fi
  // retrasa din cod, dar abonamentul poate fi anulat - iar fara el
  // serverul nu mai are unde trimite.
  async function unsubscribeFromPush() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return true;

      if (PUSH_API) {
        // anuntam serverul inainte sa pierdem endpointul
        await fetch(PUSH_API + '/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint })
        }).catch(() => {});
      }
      await sub.unsubscribe();
      return true;
    } catch (e) {
      console.warn('dezabonarea a esuat:', e);
      return false;
    }
  }

  async function esteAbonat() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      return !!(await reg.pushManager.getSubscription());
    } catch (_) {
      return false;
    }
  }

  async function requestPermission() {
    try {
      const p = await Notification.requestPermission();
      if (p === 'granted') {
        closeNotifyModal();
        const abonat = await subscribeToPush();
        await syncBellState();
        toast(abonat ? 'Notificări activate' : 'Notificări permise');
        testNotification();
      } else {
        toast('Notificările nu au fost permise');
        closeNotifyModal();
      }
    } catch (e) {
      toast('Nu am putut activa notificările');
    }
  }

  async function testNotification() {
    const t = todayKey();
    const today = state.events.filter((e) => e.data === t);
    const anunturiAzi = state.anunturi
      .map((a) => [a, anuntInAzi(a)])
      .filter(([, f]) => f);

    const linii = today.slice(0, 3).map((e) => `• ${fmtTime(e)} ${e.titlu}`);
    anunturiAzi.slice(0, 2).forEach(([a, f]) => {
      linii.push((f === 'deadline' ? '⏳ Ultima zi: ' : '📣 ') + a.titlu);
    });

    const body = linii.length ? linii.join('\n') : 'Nimic programat azi la FABBV.';
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(
        today.length
          ? `FABBV · ${today.length} evenimente azi`
          : (anunturiAzi.length ? 'FABBV · anunțuri noi' : 'FABBV · zi liberă'),
        {
          body,
          icon: 'icons/icon-192.png',
          badge: 'icons/badge-72.png',
          tag: 'fabbv-daily',
          data: { url: './' }
        });
    } catch (e) {
      toast('Notificarea de test a eșuat');
    }
  }

  async function syncBellState() {
    const btn = $('#btn-notify');
    state.abonat = await esteAbonat();
    btn.classList.toggle('is-on', state.abonat);
    btn.setAttribute('aria-pressed', String(state.abonat));
    btn.setAttribute('aria-label', state.abonat
      ? 'Notificări active — apasă pentru a le opri'
      : 'Activează notificările zilnice');
  }

  // Clopotelul comuta direct cand nu e nimic de explicat. Deschide
  // fereastra doar cand utilizatorul trebuie sa afle ceva: pe iPhone
  // neinstalat, la prima cerere de permisiune, sau dupa un refuz.
  async function onBellClick() {
    const btn = $('#btn-notify');

    if (isIOS() && !isStandalone()) { openNotifyModal(); return; }
    if (!('Notification' in window) || !('PushManager' in window)) { openNotifyModal(); return; }
    if (Notification.permission === 'default') { openNotifyModal(); return; }
    if (Notification.permission === 'denied') { openNotifyModal(); return; }

    btn.disabled = true;
    try {
      if (state.abonat) {
        const ok = await unsubscribeFromPush();
        await syncBellState();
        toast(ok ? 'Notificări oprite' : 'Nu am putut opri notificările');
      } else {
        const ok = await subscribeToPush();
        await syncBellState();
        toast(ok ? 'Notificări pornite' : 'Nu am putut porni notificările');
      }
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- toast ---------- */

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- evenimente UI ---------- */

  function wireUI() {
    document.querySelectorAll('.nav-item').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach((t) =>
          t.setAttribute('aria-selected', String(t === tab)));
        state.range = tab.dataset.range;
        // categoriile sunt ale evenimentelor
        document.querySelector('.cat-bar').hidden =
          (state.range === 'anunturi' || state.range === 'an');

        if (state.range === 'an' && !state.an) {
          $('#list').setAttribute('aria-busy', 'true');
          $('#list').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
          incarcaAn().then(renderList).catch(() => renderList());
        } else {
          renderList();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    let searchTimer;
    $('#search').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.q = e.target.value;
        renderList();
      }, 160);
    });

    $('#btn-notify').addEventListener('click', onBellClick);

    $('#btn-refresh').addEventListener('click', async () => {
      toast('Se actualizează…');
      try {
        await loadEvents({ fresh: true });
        renderCounts(); renderCatBar(); renderList();
        toast('Actualizat');
      } catch (e) {
        toast('Nu am putut actualiza');
      }
    });

    $('#scrim').addEventListener('click', () => { closeSheet(); closeNotifyModal(); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeSheet(); closeNotifyModal(); }
    });
  }

  /* ---------- vizite și instalări (statistici anonime) ---------- */

  // id aleator, tinut pe telefon - desparte "vizitator nou" de "a revenit",
  // fara sa identifice persoana. Statisticile ajung in Workerul de push,
  // la /vizita si /instalare (vezi worker/src/index.js).
  const CHEIE_VIZITATOR = 'fabbv-id-vizitator';

  function idVizitator() {
    try {
      let id = localStorage.getItem(CHEIE_VIZITATOR);
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
        localStorage.setItem(CHEIE_VIZITATOR, id);
      }
      return id;
    } catch (_) { return null; }
  }

  function trimitePing(cale) {
    if (!PUSH_API) return;
    const v = idVizitator();
    const url = PUSH_API + cale + (v ? '?v=' + encodeURIComponent(v) : '');
    fetch(url, { keepalive: true }).catch(() => {});
  }

  /* ---------- întrebarea de la prima pornire ---------- */

  const CHEIE_INTREBAT = 'fabbv-intrebat-notificari';

  function amIntrebatDeja() {
    try { return localStorage.getItem(CHEIE_INTREBAT) === 'da'; }
    catch (_) { return false; }
  }

  function marcheazaIntrebat() {
    try { localStorage.setItem(CHEIE_INTREBAT, 'da'); } catch (_) {}
  }

  // Intrebam o singura data, la prima deschidere din aplicatia instalata.
  // Nu intrebam in tab de browser: pe iPhone abonarea nici nu e posibila
  // acolo, iar un refuz reflex ar fi definitiv.
  function poateIntrebaAcum() {
    return isStandalone()
      && 'Notification' in window
      && 'PushManager' in window
      && Notification.permission === 'default'
      && !amIntrebatDeja();
  }

  /* ---------- pornire ---------- */

  async function init() {
    wireUI();
    syncBellState();
    trimitePing('/vizita');
    window.addEventListener('appinstalled', () => trimitePing('/instalare'));

    try {
      await loadEvents();
      renderCounts();
      renderCatBar();
      renderList();
      if (state.updatedAt) {
        $('#meta-line').textContent = 'Ultima actualizare: ' + state.updatedAt;
      }
    } catch (err) {
      $('#list').setAttribute('aria-busy', 'false');
      $('#list').innerHTML =
        `<div class="empty">${icon('i-inbox')}<h3>Datele nu s-au încărcat</h3>
         <p>Verifică conexiunea și apasă reîmprospătare.</p></div>`;
      $('#today-count').textContent = 'Date indisponibile';
      console.error(err);
    }

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });

        // cautam un worker nou la pornire si la fiecare revenire in aplicatie
        const cautaVersiuneNoua = () => { reg.update().catch(() => {}); };
        cautaVersiuneNoua();
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) cautaVersiuneNoua();
        });

        // cand workerul nou preia controlul, reincarcam o singura data
        let reincarcat = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reincarcat) return;
          reincarcat = true;
          location.reload();
        });

        // daca permisiunea e deja data, ne reasiguram ca Workerul
        // are un abonament valid pentru telefonul asta
        subscribeToPush({ tacut: true }).then(syncBellState);
      } catch (e) { console.warn('SW nu s-a înregistrat:', e); }
    }

    if (poateIntrebaAcum()) {
      marcheazaIntrebat();
      // lasam interfata sa se aseze inainte de a cere ceva
      setTimeout(openNotifyModal, 1100);
    }

    // reîncarcă lista când revii în aplicație (poate s-a schimbat ziua)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { renderCounts(); renderList(); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
