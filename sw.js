/* ===========================================================
   Service worker — Anunțuri FABBV
   - shell cache-first, date network-first
   - primește push-ul zilnic trimis de cron
   =========================================================== */

const VERSION = 'fabbv-v14';
const SHELL = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/logo-fabbv-alb.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // addAll e atomic: dacă un fișier lipsește, cade tot installul
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Interfața și datele se iau din rețea, cu timeout scurt și cădere pe cache.
// Așa aplicația arată ultima versiune publicată fără să mai urcăm VERSION
// la fiecare modificare, dar rămâne funcțională și offline.
const ASTEPTARE = 3500;

function dinRetea(req, ms) {
  return new Promise((rezolva, respinge) => {
    const ceas = setTimeout(() => respinge(new Error('timeout')), ms);
    fetch(req).then(
      (res) => { clearTimeout(ceas); rezolva(res); },
      (err) => { clearTimeout(ceas); respinge(err); }
    );
  });
}

function pastreaza(req, res) {
  if (res && res.ok) {
    const copie = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copie));
  }
  return res;
}

// rețea întâi, cache dacă rețeaua tace
function reteaIntai(req, rezerva) {
  return dinRetea(req, ASTEPTARE)
    .then((res) => pastreaza(req, res))
    .catch(() => caches.match(req).then((hit) => hit || (rezerva ? caches.match(rezerva) : undefined)));
}

// cache întâi, dar reîmprospătăm în fundal pentru data viitoare
function cacheSiReimprospatare(req) {
  return caches.match(req).then((hit) => {
    const proaspat = fetch(req).then((res) => pastreaza(req, res)).catch(() => hit);
    return hit || proaspat;
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // paginile: mereu ultima variantă publicată
  if (req.mode === 'navigate') {
    e.respondWith(reteaIntai(req, 'index.html'));
    return;
  }

  // interfața și datele: la fel, ca să nu rămână telefonul pe o versiune veche
  if (url.pathname.includes('/data/') ||
      /\.(?:css|js|webmanifest)$/.test(url.pathname)) {
    e.respondWith(reteaIntai(req));
    return;
  }

  // iconițe și imagini: se schimbă rar, le servim instant
  e.respondWith(cacheSiReimprospatare(req));
});

/* ---------------- push ---------------- */

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }

  const title = d.title || 'Anunțuri FABBV';
  const options = {
    body: d.body || 'Vezi evenimentele de azi.',
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-72.png',
    tag: d.tag || 'fabbv-daily',
    renotify: true,
    data: { url: d.url || './' },
    actions: [{ action: 'open', title: 'Vezi evenimentele' }]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(target); return c.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
