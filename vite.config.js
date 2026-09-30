import { defineConfig } from 'vite';

// three's TTFLoader imports opentype.js from a CDN. Point that import at the
// local npm copy so nothing is fetched from a third party at runtime.
const OPENTYPE_CDN = 'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/+esm';

export default defineConfig({
  base: './',
  resolve: {
    alias: [{ find: OPENTYPE_CDN, replacement: 'opentype.js' }],
  },
  optimizeDeps: {
    // Pre-bundling would keep the CDN URL as an external import in dev.
    exclude: ['three'],
    include: ['opentype.js'],
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
  preview: { host: true },
});
