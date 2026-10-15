/* ===========================================================
   Service worker — Anunțuri FABBV
   - shell cache-first, date network-first
   - primește push-ul zilnic trimis de cron
   =========================================================== */

const VERSION = 'fabbv-v12';
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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // datele: încearcă rețeaua, cade pe cache (ca să mergem offline)
  if (url.pathname.endsWith('/data/events.json')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // shell: cache întâi
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match('index.html')))
  );
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
