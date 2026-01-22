const CACHE_NAME = 'fliptracker-v1';
const BASE = '/Fliptracker-gemini/';

const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'assets/index-l0sNRNKZ.js',   // Remplace XXXX par le hash généré par Vite
  BASE + 'assets/manifest-DnkdpArx.json',  // idem
  // ajoute ici toutes les autres ressources statiques (images, icons...)
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
