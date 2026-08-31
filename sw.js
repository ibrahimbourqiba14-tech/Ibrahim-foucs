const CACHE = 'ibrahim-focus-v1';
const ASSETS = ['./index.html','./app.js','./manifest.json','./icon-192.png','./icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});

// Allow the page to ask the service worker to fire a local notification.
// This works while the OS keeps this PWA's service worker alive; Android may
// still suspend it after the app has been closed for a while — there is no
// way for a plain web app to guarantee delivery once fully killed, only a
// real native app (with a foreground service) can promise that.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'notify') {
    const { title, body, tag } = event.data;
    self.registration.showNotification(title, {
      body,
      tag,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      dir: 'rtl',
      lang: 'ar'
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('./index.html'));
});
