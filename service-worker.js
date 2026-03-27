const CACHE_NAME = 'QuestionTime-V1';

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
  './js/question.js',
  './js/storage.js',
  './data/questions.base.json'
];


self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        urlsToCache.map(url => 
          fetch(url).then(resp => {
            if (!resp.ok) throw new Error(`Failed to fetch ${url}`);
            return cache.put(url, resp);
          })
        )
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
