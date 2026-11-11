import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleEvents, handleStats, memoryStore, storeFromEnv } from './server/telemetry';

/**
 * Serves the telemetry API (/api/events, /api/stats) in `vite dev` and
 * `vite preview`, so the kiosk and the /stats dashboard work locally. Uses
 * Upstash Redis if its env vars are set, otherwise an in-memory store.
 * On Vercel the same handlers run as functions in api/.
 */
function telemetryApi(): Plugin {
  const store = storeFromEnv() ?? memoryStore();
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const path = (req.url ?? '').split('?')[0];
    const handler =
      path === '/api/events' ? (r: Request) => handleEvents(r, store) : path === '/api/stats' ? (r: Request) => handleStats(r, store, process.env.STATS_KEY || undefined) : null;
    if (!handler) return next();
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const response = await handler(request);
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(await response.text());
  };
  return {
    name: 'telemetry-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig({
  plugins: [react(), telemetryApi()],
});
