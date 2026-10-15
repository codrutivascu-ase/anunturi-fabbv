/* ===========================================================
   Anunțuri FABBV — logica aplicației
   Sursa de date: data/events.json (generat din Excel/Google Sheet)
   =========================================================== */

(() => {
  'use strict';

  const DATA_URL = 'data/events.json';

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
  const catOf = (k) => CATEGORIES[k] || CATEGORIES['anunt'];

  /* ---------- tipuri de anunț ---------- */
  const TIPURI_ANUNT = {
    'urgent':        { label: 'Urgent',        color: 'var(--an-urgent)' },
    'inscriere':     { label: 'Înscriere',     color: 'var(--an-inscriere)' },
    'oportunitate':  { label: 'Oportunitate',  color: 'var(--an-oportunitate)' },
    'administrativ': { label: 'Administrativ', color: 'var(--an-administrativ)' }
  };
  const tipOf = (k) => TIPURI_ANUNT[k] || TIPURI_ANUNT['administrativ'];

  /* ---------- stare ---------- */
  const state = {
    events: [],
    anunturi: [],
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
      .filter((k) => CATEGORIES[k]);

    const order = Object.keys(CATEGORIES).filter((k) => present.includes(k));

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
      ${a.descriere ? `<p class="anunt-desc">${esc(a.descriere)}</p>` : ''}
      <div class="anunt-foot">
        <span class="anunt-termen">${icon('i-calendar')}Termen: ${esc(fmtLong(a.valabil_pana_la))}</span>
        ${a.persoana_contact ? `<span>${icon('i-user')}${esc(a.persoana_contact)}</span>` : ''}
      </div>
      ${buton}
    `;
    return card;
  }

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
  }

  function renderList() {
    if (state.range === 'anunturi') { renderAnunturiTab(); return; }

    const main = $('#list');
    main.setAttribute('aria-busy', 'false');
    main.textContent = '';

    const list = visible();

    if (!list.length) {
      const e = el('div', 'empty');
      const why = state.q || state.cats.size
        ? 'Niciun eveniment nu corespunde filtrelor. Încearcă să le resetezi.'
        : state.range === 'azi'
          ? 'Nu e programat nimic astăzi. Vezi „Toate” pentru zilele următoare.'
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
        <p>Notificările sunt <strong>active</strong>. Vei primi un rezumat în fiecare dimineață la 7:30, în zilele cu evenimente.</p>
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
        <p>Primești o singură notificare pe zi, dimineața, cu evenimentele FABBV din ziua respectivă. Zero notificări în zilele libere.</p>
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

  async function requestPermission() {
    try {
      const p = await Notification.requestPermission();
      if (p === 'granted') {
        closeNotifyModal();
        syncBellState();
        const abonat = await subscribeToPush();
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

  function syncBellState() {
    const btn = $('#btn-notify');
    const on = 'Notification' in window && Notification.permission === 'granted';
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-label', on ? 'Notificări active' : 'Activează notificările zilnice');
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
        // categoriile sunt ale evenimentelor, nu ale anunțurilor
        document.querySelector('.cat-bar').hidden = (state.range === 'anunturi');
        renderList();
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

    $('#btn-notify').addEventListener('click', openNotifyModal);

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

  /* ---------- pornire ---------- */

  async function init() {
    wireUI();
    syncBellState();

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
        await navigator.serviceWorker.register('sw.js');
        // daca permisiunea e deja data, ne reasiguram ca Workerul
        // are un abonament valid pentru telefonul asta
        subscribeToPush({ tacut: true });
      } catch (e) { console.warn('SW nu s-a înregistrat:', e); }
    }

    // reîncarcă lista când revii în aplicație (poate s-a schimbat ziua)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { renderCounts(); renderList(); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
