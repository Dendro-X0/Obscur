/* eslint-disable no-restricted-globals */

const SW_VERSION = "1.3.8";
const APP_SHELL_CACHE = `obscur-app-shell-${SW_VERSION}`;
const RUNTIME_CACHE = `obscur-runtime-${SW_VERSION}`;
const CACHE_PREFIXES = ["obscur-app-shell-", "obscur-runtime-"];

const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/obscur-logo-dark.svg",
  "/obscur-logo-light.svg",
];

const STATIC_ASSET_PATH_REGEX = /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico|json|webmanifest)$/i;

const isSameOrigin = (url) => url.origin === self.location.origin;
const isApiPath = (url) => url.pathname.startsWith("/api/");
const isStaticAssetPath = (url) => (
  url.pathname.startsWith("/_next/static/")
  || STATIC_ASSET_PATH_REGEX.test(url.pathname)
);

const cacheCoreAsset = async (cache, assetPath) => {
  try {
    const response = await fetch(assetPath, { cache: "no-store" });
    if (response.ok) {
      await cache.put(assetPath, response.clone());
    }
  } catch {
    // Keep install resilient. Missing non-critical assets should not brick SW install.
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    await Promise.allSettled(CORE_ASSETS.map((assetPath) => cacheCoreAsset(cache, assetPath)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      const shouldDelete = CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))
        && key !== APP_SHELL_CACHE
        && key !== RUNTIME_CACHE;
      return shouldDelete ? caches.delete(key) : Promise.resolve(false);
    }));
    await self.clients.claim();
  })());
});

const fallbackOfflineResponse = () => new Response(
  "<!doctype html><html><head><meta charset=\"utf-8\" /><title>Offline</title></head><body><h1>Offline</h1><p>Reconnect to continue.</p></body></html>",
  {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  },
);

const handleNavigationRequest = async (request) => {
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      await runtimeCache.put(request, networkResponse.clone());
      await runtimeCache.put("/", networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return (
      (await runtimeCache.match(request))
      || (await caches.match(request))
      || (await runtimeCache.match("/"))
      || (await caches.match("/"))
      || fallbackOfflineResponse()
    );
  }
};

const handleStaticAssetRequest = async (request) => {
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await runtimeCache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.ok) {
    await runtimeCache.put(request, networkResponse.clone());
  }
  return networkResponse;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (!isSameOrigin(requestUrl) || isApiPath(requestUrl)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (isStaticAssetPath(requestUrl)) {
    event.respondWith(handleStaticAssetRequest(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "OBSCUR_SW_SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const notificationData = (
      event.notification && typeof event.notification.data === "object"
        ? event.notification.data
        : {}
    );
    const href = typeof notificationData?.href === "string" && notificationData.href.length > 0
      ? notificationData.href
      : "/";
    const actionFromButton = typeof event.action === "string" && event.action.length > 0
      ? event.action
      : null;
    const overlayAction = actionFromButton
      || (typeof notificationData?.overlayAction === "string"
        ? notificationData.overlayAction
        : null);

    const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    let targetClient = windowClients[0] ?? null;

    if (targetClient) {
      try {
        await targetClient.focus();
      } catch {
        // best effort
      }
      if (typeof targetClient.navigate === "function") {
        try {
          await targetClient.navigate(href);
        } catch {
          // best effort
        }
      }
    } else if (typeof self.clients.openWindow === "function") {
      try {
        targetClient = await self.clients.openWindow(href);
      } catch {
        targetClient = null;
      }
    }

    if (!overlayAction) {
      return;
    }

    const messagePayload = {
      type: "OBSCUR_NOTIFICATION_CLICK",
      overlayAction,
    };

    if (windowClients.length > 0) {
      windowClients.forEach((client) => {
        client.postMessage(messagePayload);
      });
      return;
    }
    if (targetClient && typeof targetClient.postMessage === "function") {
      targetClient.postMessage(messagePayload);
    }
  })());
});
