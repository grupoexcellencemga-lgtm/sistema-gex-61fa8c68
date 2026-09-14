/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkOnly, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope;

// Precaching injetado pelo VitePWA
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Navegação SPA
const allowlist = [/^\/(?!.*supabase)/];
const denylist = [/^\/~oauth/, /^\/auth/, /^\/rest/, /^\/api/, /^\/inscricao/, /^\/inscricao-turma/, /^\/e\//];
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { allowlist, denylist }));

// Supabase: sempre rede
registerRoute(/^https:\/\/.*\.supabase\.co\/.*/i, new NetworkOnly());

// Fontes Google
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({ cacheName: "google-fonts-cache", plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31536000 }), new CacheableResponsePlugin({ statuses: [0, 200] })] })
);
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({ cacheName: "gstatic-fonts-cache", plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31536000 }), new CacheableResponsePlugin({ statuses: [0, 200] })] })
);

// Skip waiting ao receber mensagem do cliente
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json() as { title: string; body: string; url?: string; leadId?: string };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: payload.leadId ?? "gex-msg",
      renotify: true,
      data: { url: payload.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl: string = (event.notification.data as { url: string })?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(targetUrl));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
