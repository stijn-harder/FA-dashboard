// FA COCKPIT service worker: maakt installeren als app mogelijk. Pushmeldingen volgen later.
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>self.clients.claim());
self.addEventListener("fetch",()=>{});
