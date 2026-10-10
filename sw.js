// Migração do cache antigo para acesso direto pelo navegador.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('helion')).map(key => caches.delete(key)));
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
