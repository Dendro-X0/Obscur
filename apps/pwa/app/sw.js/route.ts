type GetResult = Response;

const SERVICE_WORKER_JS = "/* eslint-disable */\n" +
  "const CACHE_NAME = 'nostr-messenger-shell-v1';\n" +
  "const ASSETS = ['/'];\n" +
  "self.addEventListener('install', (event) => {\n" +
  "  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));\n" +
  "});\n" +
  "self.addEventListener('activate', (event) => {\n" +
  "  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));\n" +
  "});\n" +
  "self.addEventListener('fetch', (event) => {\n" +
  "  const req = event.request;\n" +
  "  const url = new URL(req.url);\n" +
  "  if (req.method !== 'GET') return;\n" +
  "  if (url.origin !== self.location.origin) return;\n" +
  "  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));\n" +
  "});\n";

const GET = (): GetResult => {
  return new Response(SERVICE_WORKER_JS, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};

export { GET };
