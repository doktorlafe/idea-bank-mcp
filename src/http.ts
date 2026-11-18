#!/usr/bin/env node
/**
 * Veřejný HTTP vstup (Streamable HTTP) pro hostování za Caddy/Cloudflare.
 * Servíruje JEN omezený veřejný server (src/public.ts), nikdy lokální stdio verzi.
 *
 * Proměnné prostředí:
 *   PORT                 port (výchozí 8787), poslouchá jen na HOST
 *   HOST                 výchozí 127.0.0.1 (v Dockeru 0.0.0.0)
 *   RATE_LIMIT           max. požadavků na IP za okno (výchozí 60)
 *   RATE_WINDOW_SEC      délka okna v s (výchozí 600)
 *   IDEA_BANK_IDEAS_JSON cesta k bance (připojit read-only)
 */
import { createServer, type IncomingMessage } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { buildPublicServer } from './public.js';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';
const LIMIT = Number(process.env.RATE_LIMIT ?? 60);
const WINDOW_MS = Number(process.env.RATE_WINDOW_SEC ?? 600) * 1000;
const MAX_BODY = 64 * 1024;

const mcp = createMcpHandler(() => buildPublicServer(), {
  maxRequestBodySize: MAX_BODY,
  onerror: (e) => console.error('[mcp]', e.message),
});
const handle = toNodeHandler(mcp, { maxRequestBodySize: MAX_BODY });

// --- jednoduchý rate limit v paměti (pevné okno na IP) ---------------------
const hits = new Map<string, { n: number; reset: number }>();

/** IP klienta: za Cloudflare je v Cf-Connecting-Ip (anti-spoof, viz CLAUDE.md). */
function clientIp(req: IncomingMessage): string {
  const cf = req.headers['cf-connecting-ip'];
  return (Array.isArray(cf) ? cf[0] : cf) ?? req.socket.remoteAddress ?? 'unknown';
}

function allowed(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now >= h.reset) {
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    return true;
  }
  return ++h.n <= LIMIT;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of hits) if (now >= h.reset) hits.delete(ip);
}, 60_000).unref();

// --- HTTP server -----------------------------------------------------------
const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0];

  if (path === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    return;
  }
  if (path !== '/mcp') {
    res.writeHead(404).end();
    return;
  }
  if (!allowed(clientIp(req))) {
    res.writeHead(429, { 'retry-after': String(Math.ceil(WINDOW_MS / 1000)) }).end('Too many requests');
    return;
  }
  try {
    await handle(req, res);
  } catch (e) {
    console.error('[http]', e);
    if (!res.headersSent) res.writeHead(500).end();
  }
});

server.listen(PORT, HOST, () => console.error(`idea-bank (veřejný) na http://${HOST}:${PORT}/mcp`));

const stop = () => server.close(() => void mcp.close().then(() => process.exit(0)));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
