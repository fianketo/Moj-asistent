// Service worker (web verzija): instalacija, rad bez interneta i klik na obaveštenje.
const CACHE = 'asistent-v28';
const SHELL = ['./', './index.html', './style.css', './home.js', './prices.js', './okolina.js', './subvencije.js', './app.js', './fonts/roboto-flex-latin.woff2', './fonts/roboto-flex-latin-ext.woff2', './catalog.js', './health.js', './recipes2.js', './recipes3.js', './steps.js', './nutrition.js', './safety.js', './reviews.js', './exercises-pro.js', './health-ui.js', './zones-ns.json', './vendor/capacitor.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && !k.startsWith('asistent-cene') && !k.startsWith('asistent-okolina')).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Mreža prvo (da uvek dobiješ najnoviju verziju), keš ako nema interneta.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const tab = e.notification.data?.tab || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { c.postMessage({ tab }); if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./index.html' + (tab ? '?tab=' + tab : ''));
  }));
});
