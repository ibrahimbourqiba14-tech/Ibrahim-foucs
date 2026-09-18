const CACHE = 'ibrahim-focus-v2';
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

// Network-first: always try to fetch the latest version when online (and quietly
// refresh the cache), and only fall back to the cached copy when offline. The old
// version of this file was cache-first, which meant once a phone cached the app it
// would keep serving that exact snapshot forever and never notice updates — that
// was the real bug behind "the update isn't showing up". This fixes it going forward.
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return resp;
    }).catch(() => caches.match(e.request))
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
