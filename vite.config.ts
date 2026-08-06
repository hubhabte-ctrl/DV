import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Silently handle offline backend — serves a 503 JSON response instead of
 * letting the Vite proxy throw noisy terminal errors when Fastify is down.
 */
function apiProxyFallbackPlugin(): Plugin {
  return {
    name: 'api-proxy-fallback',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          try {
            const check = await fetch('http://127.0.0.1:4174/api/health', {
              signal: AbortSignal.timeout(2000),
            });
            if (check.ok) {
              return next(); // Backend live — pass to Vite proxy
            }
          } catch {
            // Backend / PostgreSQL offline — return clean 200 OK offline payload (no console 503 errors)
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, offline: true, error: 'Offline local mode active' }));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiProxyFallbackPlugin()],

  resolve: {
    alias: [
      // @bs/schema
      {
        find: '@bs/schema',
        replacement: fileURLToPath(new URL('./packages/schema/src/index.ts', import.meta.url)),
      },
      // @bs/runtime
      {
        find: '@bs/runtime',
        replacement: fileURLToPath(new URL('./packages/runtime/src/index.ts', import.meta.url)),
      },
      // @bs/engine
      {
        find: '@bs/engine',
        replacement: fileURLToPath(new URL('./packages/engine/src/index.ts', import.meta.url)),
      },
      // @bs/services sub-paths — must appear BEFORE the bare '@bs/services' entry
      {
        find: '@bs/services/config',
        replacement: fileURLToPath(new URL('./packages/services/src/config.ts', import.meta.url)),
      },
      {
        find: '@bs/services/appData',
        replacement: fileURLToPath(new URL('./packages/services/src/appData.ts', import.meta.url)),
      },
      {
        find: '@bs/services/seed',
        replacement: fileURLToPath(new URL('./packages/services/src/seed.ts', import.meta.url)),
      },
      {
        find: '@bs/services',
        replacement: fileURLToPath(new URL('./packages/services/src/index.ts', import.meta.url)),
      },
    ],
  },

  server: {
    port: 5175, // Per ADR-005 & scripts/devAll.mjs (Frontend SPA on http://localhost:5175)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4174',
        changeOrigin: true,
      },
    },
  },

  ssr: {
    // Transform @bs/* workspace packages through Vite instead of resolving as Node externals
    noExternal: [/^@bs\//],
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three'))       return 'vendor-three';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom'))
                                                        return 'vendor-react';
          if (id.includes('node_modules/lucide-react')) return 'vendor-lucide';
          if (id.includes('/packages/ui-kit/'))         return 'ui-kit';
        },
      },
    },
  },
});
