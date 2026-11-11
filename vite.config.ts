import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleUsage, memoryStore, storeFromEnv } from './server/usage';

/**
 * Serves /api/usage in `vite dev` and `vite preview`, so the usage sync and
 * /stats work locally. Uses Upstash Redis if its env vars are set, otherwise an
 * in-memory store. On Vercel the same handler runs as api/usage.ts.
 */
function usageApi(): Plugin {
  const store = storeFromEnv() ?? memoryStore();
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if ((req.url ?? '').split('?')[0] !== '/api/usage') return next();
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const response = await handleUsage(request, store, process.env.STATS_KEY || undefined);
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(await response.text());
  };
  return {
    name: 'usage-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig({
  plugins: [react(), usageApi()],
});
