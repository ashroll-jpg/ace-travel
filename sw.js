/* Ace Travel service worker — bulletproof offline */
const CACHE='ace-travel-v1';
const CORE=[
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600&display=swap'
];

// Install: pre-cache the app shell
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).catch(()=>{})));
});

// Activate: clean old caches
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

// Fetch strategy:
//  - Navigations & the app itself: network-first, fall back to cache (so you get updates online, but it works offline)
//  - Fonts & other GET assets: cache-first, update in background
//  - API calls (anthropic, openstreetmap, wikipedia, open-meteo): network-only (never cache; fail gracefully offline)
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);

  // never intercept API / tile / photo calls — let them hit network (and fail cleanly offline)
  if(/api\.anthropic\.com|nominatim\.openstreetmap|tile\.openstreetmap|basemaps\.cartocdn|wikipedia\.org|open-meteo\.com|cloudflare|unpkg\.com/.test(url.href)){
    return; // default browser handling
  }

  // app document: network-first
  if(req.mode==='navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/')){
    e.respondWith(
      fetch(req).then(res=>{
        const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy));
        return res;
      }).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html')))
    );
    return;
  }

  // other GET assets (fonts, etc.): cache-first, refresh in background
  e.respondWith(
    caches.match(req).then(cached=>{
      const network=fetch(req).then(res=>{
        const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy));
        return res;
      }).catch(()=>cached);
      return cached||network;
    })
  );
});
