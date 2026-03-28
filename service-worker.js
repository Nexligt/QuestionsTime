// Version unique à changer à chaque déploiement
const CACHE_VERSION = '1.0.4';
const CACHE_NAME = `QuestionTime-${CACHE_VERSION}`;

// Fichiers à mettre en cache
const urlsToCache = [
  './index.html',
  './css/style.css',
  './image/apple-touch-icon.png',
  './image/favicon-96x96.png',
  './image/favicon.ico',
  './image/favicon.svg',
  './image/web-app-manifest-192x192.png',
  './image/web-app-manifest-512x512.png',
  './js/app.js',
  './js/questions.js',
  './js/storage.js',
  './data/questions.base.json'
];

// INSTALL
self.addEventListener('install', event => { 
  self.skipWaiting(); 
  event.waitUntil( 
    caches.open(CACHE_NAME).then(async cache => { 
      for (const url of urlsToCache) { 
        try { 
          const response = await fetch(url); 
          if (!response.ok) { 
            console.warn("⚠️ Skip non-ok:", url, response.status); 
            continue; // on skip ce fichier 
          } 
          await cache.put(url, response); 
        } catch (err) { 
          console.warn("❌ Skip fetch error:", url, err); 
        } 
      }
    }) 
  ); 
});

// ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.map(key => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim(); // prend le contrôle immédiatement
});

// FETCH
self.addEventListener('fetch', event => {
  const { request } = event;

  // Pour JS/CSS : réseau d'abord, fallback cache
  if (request.url.endsWith('.js') || request.url.endsWith('.css')) {
    event.respondWith(
      fetch(request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return resp;
        })
        .catch(() => caches.match(request))
    );
  } else {
    // Pour tout le reste : cache d'abord, fallback réseau
    event.respondWith(
      caches.match(request).then(resp => resp || fetch(request))
    );
  }
});

// Permet de forcer le SW à s'activer depuis la page
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});