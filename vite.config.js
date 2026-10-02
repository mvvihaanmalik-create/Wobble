import { defineConfig } from 'vite';
import { handle, memoryStore, storeFromEnv } from './server/gallery-core.js';

// The shared wall in dev and preview: same handler as the Vercel function,
// backed by the real store when its env vars are set, else by memory.
function galleryApi() {
  const store = storeFromEnv() || memoryStore();
  const mount = (server) => {
    server.middlewares.use('/api/gallery', (req, res) => {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
        if (raw.length > 1e6) req.destroy();
      });
      req.on('end', async () => {
        let body = null;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          body = null;
        }
        const out = await handle(req.method, body, req.socket.remoteAddress, store);
        res.statusCode = out.status;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(out.json));
      });
    });
  };
  return { name: 'squishi-gallery', configureServer: mount, configurePreviewServer: mount };
}

export default defineConfig({
  base: './',
  plugins: [galleryApi()],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
  preview: { host: true },
});
