// Minimal Service Worker to prevent 404 errors on registration
// In the future, this can be expanded with Workbox for offline support

self.addEventListener('install', (event) => {
    // Force this service worker to become the active service worker
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Claim any clients immediately, so that the page will be controlled by the service worker without a reload
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Pass through all requests to network for now to avoid stale cache issues
    // This effectively disables SW caching but keeps the PWA installable
    event.respondWith(fetch(event.request));
});
