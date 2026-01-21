type GetResult = Response;

const SERVICE_WORKER_JS = "/* eslint-disable */\n" +
  "const CACHE_NAME = 'obscur-v1';\n" +
  "const RUNTIME_CACHE = 'obscur-runtime-v1';\n" +
  "const ASSETS = [\n" +
  "  '/',\n" +
  "  '/manifest.webmanifest',\n" +
  "  '/icon-192.png',\n" +
  "  '/icon-512.png'\n" +
  "];\n" +
  "\n" +
  "// Install event - cache core assets\n" +
  "self.addEventListener('install', (event) => {\n" +
  "  event.waitUntil(\n" +
  "    caches.open(CACHE_NAME)\n" +
  "      .then((cache) => cache.addAll(ASSETS))\n" +
  "      .then(() => self.skipWaiting())\n" +
  "  );\n" +
  "});\n" +
  "\n" +
  "// Activate event - clean up old caches\n" +
  "self.addEventListener('activate', (event) => {\n" +
  "  event.waitUntil(\n" +
  "    caches.keys().then((keys) => \n" +
  "      Promise.all(\n" +
  "        keys\n" +
  "          .filter((k) => k !== CACHE_NAME && k !== RUNTIME_CACHE)\n" +
  "          .map((k) => caches.delete(k))\n" +
  "      )\n" +
  "    ).then(() => self.clients.claim())\n" +
  "  );\n" +
  "});\n" +
  "\n" +
  "// Fetch event - network first, fallback to cache\n" +
  "self.addEventListener('fetch', (event) => {\n" +
  "  const req = event.request;\n" +
  "  const url = new URL(req.url);\n" +
  "  \n" +
  "  // Only handle GET requests\n" +
  "  if (req.method !== 'GET') return;\n" +
  "  \n" +
  "  // Skip cross-origin requests (except for relay connections)\n" +
  "  if (url.origin !== self.location.origin && !url.protocol.startsWith('ws')) {\n" +
  "    return;\n" +
  "  }\n" +
  "  \n" +
  "  // Network first strategy for API calls and dynamic content\n" +
  "  if (url.pathname.startsWith('/api/') || url.pathname.includes('relay')) {\n" +
  "    event.respondWith(\n" +
  "      fetch(req)\n" +
  "        .catch(() => caches.match(req))\n" +
  "    );\n" +
  "    return;\n" +
  "  }\n" +
  "  \n" +
  "  // Cache first strategy for static assets\n" +
  "  event.respondWith(\n" +
  "    caches.match(req).then((cached) => {\n" +
  "      if (cached) return cached;\n" +
  "      \n" +
  "      return fetch(req).then((response) => {\n" +
  "        // Cache successful responses\n" +
  "        if (response.status === 200) {\n" +
  "          const responseClone = response.clone();\n" +
  "          caches.open(RUNTIME_CACHE).then((cache) => {\n" +
  "            cache.put(req, responseClone);\n" +
  "          });\n" +
  "        }\n" +
  "        return response;\n" +
  "      }).catch(() => {\n" +
  "        // Return offline page or cached version\n" +
  "        return caches.match('/') || new Response('Offline', {\n" +
  "          status: 503,\n" +
  "          statusText: 'Service Unavailable'\n" +
  "        });\n" +
  "      });\n" +
  "    })\n" +
  "  );\n" +
  "});\n" +
  "\n" +
  "// Message event - handle commands from the app\n" +
  "self.addEventListener('message', (event) => {\n" +
  "  if (event.data && event.data.type === 'SKIP_WAITING') {\n" +
  "    self.skipWaiting();\n" +
  "  }\n" +
  "  if (event.data && event.data.type === 'CLEAR_CACHE') {\n" +
  "    event.waitUntil(\n" +
  "      caches.keys().then((keys) => \n" +
  "        Promise.all(keys.map((k) => caches.delete(k)))\n" +
  "      )\n" +
  "    );\n" +
  "  }\n" +
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
