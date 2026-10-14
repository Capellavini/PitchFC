const BASE=new URL('./',self.location.href).pathname;
const CACHE='pitch-var-offline-v3-'+BASE;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Core ffmpeg hospedado fora (VITE_FFMPEG_CORE_BASE, Storage público): rede primeiro, cópia do pacote offline como reserva.
  if(event.request.method==='GET'&&url.origin!==self.location.origin&&url.pathname.includes('/storage/v1/object/public/')&&/\/ffmpeg-core\.(js|wasm)$/.test(url.pathname)){
    event.respondWith(fetch(event.request).catch(async()=>(await (await caches.open(CACHE)).match(url.href,{ignoreVary:true}))||Response.error()));
    return;
  }
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE)||url.pathname.startsWith('/api/'))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{return await fetch(event.request);}catch{
      const hit=await cache.match(event.request);if(hit)return hit;
      if(event.request.mode==='navigate'){const page=await cache.match(BASE);if(page)return page;}
      return new Response('Arquivo indisponível offline. Prepare o pacote antes de ir ao campo.',{status:503});
    }
  })());
});
