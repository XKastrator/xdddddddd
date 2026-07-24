import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // keep pixi in its own chunk so the game bundle stays cacheable
        manualChunks: { pixi: ['pixi.js'] },
      },
    },
  },
  server: { host: true, port: 5173 },
});
