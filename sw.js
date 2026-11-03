// Service Worker: hält die Seite selbst offline verfügbar (Posts/Fotos kommen immer frisch aus der Datenbank)
const V = "kyushu-v22";
const ASSETS = ["./", "index.html", "cockpit.html", "style.css", "app.js", "trip.js", "config.js", "cockpit.js", "cockpit-flags.js", "route-map.js", "vendor/supabase.js?v=2.45.4", "vendor/591.supabase.js", "img/icon-192.png", "img/icon-512.png", "img/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => Promise.allSettled(ASSETS.map(a => c.add(a)))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if(e.request.method !== "GET" || u.origin !== location.origin) return;
  // Netz zuerst, bei Funkloch aus dem Speicher
  e.respondWith(fetch(e.request).then(r => { if(r.ok){ const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, {ignoreSearch: false}).then(m => m || caches.match("./"))));
});
