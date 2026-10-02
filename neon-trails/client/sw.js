// Offline support for the web/PWA build: cache the app shell, network-first.
const CACHE = 'neon-trails-v1';
const ASSETS = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/style.css',
  'fonts/orbitron.css', 'fonts/orbitron-latin-700-normal.woff2', 'fonts/orbitron-latin-900-normal.woff2',
  'js/main.js', 'js/render.js', 'js/input.js', 'js/audio.js', 'js/net.js', 'js/profile.js',
  'shared/game.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
