# Reguli de lucru

- După fiecare modificare a proiectului: commit și push pe `main` (site-ul rulează pe GitHub Pages și se actualizează din push).
- Când se schimbă un fișier static pe care îl ține în cache service worker-ul (`js/`, `css/`, `index.html` etc.), se crește `VERSION` din `sw.js`, ca telefoanele să primească versiunea nouă.
- Workerul (`worker/`) se publică separat, cu `npx wrangler deploy` din folderul `worker`. Pentru schimbările în Worker, push-ul pe GitHub nu e de ajuns.

# Context

- Workerul folosește KV (`ABONAMENTE`) pe planul gratuit Cloudflare: 1.000 de scrieri pe zi, 100.000 de citiri. Evită scrieri noi la fiecare deschidere a aplicației; limita de scrieri se atinge prima.
- Contorul de vizite a fost eliminat intenționat (consuma scrieri KV). Statisticile păstrate: numărul de abonați și `instalariTotal`, ambele la `/stare`.
