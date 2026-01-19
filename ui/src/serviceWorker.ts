/// <reference lib="webworker" />
/**
 * Service Worker for OurBlock PWA
 * Provides offline capability and caching
 */

const CACHE_NAME = 'ourblock-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

const sw = self as unknown as ServiceWorkerGlobalScope;

// Install event - cache essential resources
sw.addEventListener('install', (event: Event) => {
  const swEvent = event as ExtendableEvent;
  swEvent.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching essential resources');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches
sw.addEventListener('activate', (event: Event) => {
  const swEvent = event as ExtendableEvent;
  swEvent.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache when offline
sw.addEventListener('fetch', (event: Event) => {
  const fetchEvent = event as FetchEvent;
  fetchEvent.respondWith(
    caches.match(fetchEvent.request)
      .then((response) => {
        // Return cached response if found
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = fetchEvent.request.clone();

        // Make network request
        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache the fetched response
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(fetchEvent.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Message event - allow manual cache updates
sw.addEventListener('message', (event: Event) => {
  const messageEvent = event as ExtendableMessageEvent;
  if (messageEvent.data && messageEvent.data.type === 'SKIP_WAITING') {
    sw.skipWaiting();
  }
});
