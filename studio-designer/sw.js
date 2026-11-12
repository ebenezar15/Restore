// Offline cache: every file the app needs is precached on install, so after the
// first visit RoomTone runs with no network connection at all.
const CACHE = 'roomtone-v7';
const FILES = [
  './',
  "css/app.css",
  "icon.svg",
  "index.html",
  "js/acoustics.js",
  "js/catalog.js",
  "js/export.js",
  "js/geometry.js",
  "js/main.js",
  "js/materials.js",
  "js/modes.js",
  "js/pro.js",
  "js/prompt.js",
  "js/scan.js",
  "js/shapebuilder.js",
  "js/studiomaterials.js",
  "manifest.webmanifest",
  "vendor/jspdf.umd.min.js",
  "vendor/three/addons/controls/OrbitControls.js",
  "vendor/three/addons/controls/TransformControls.js",
  "vendor/three/addons/environments/RoomEnvironment.js",
  "vendor/three/addons/exporters/GLTFExporter.js",
  "vendor/three/addons/exporters/OBJExporter.js",
  "vendor/three/addons/geometries/RoundedBoxGeometry.js",
  "vendor/three/addons/loaders/GLTFLoader.js",
  "vendor/three/addons/loaders/OBJLoader.js",
  "vendor/three/addons/utils/BufferGeometryUtils.js",
  "vendor/three/addons/utils/TextureUtils.js",
  "vendor/three/three.module.min.js",
  "icon-192.png",
  "icon-512.png",
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
