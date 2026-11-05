import { renameSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pullDatabase, pushDatabase } from './blobfile';
import { adoptIncoming } from './db';
import { app } from './http';
import { seed } from './seed';

let booted = false;
let tail: Promise<void> = Promise.resolve();

function lock<T>(fn: () => Promise<T>) {
  const run = tail.then(fn, fn);
  tail = run.then(() => undefined, () => undefined);
  return run;
}

function incomingUrl(req: IncomingMessage) {
  const current = req.url || '/';
  const pathOnly = current.split('?')[0];
  const collapsed = pathOnly === '/api/index' || pathOnly === '/index' || pathOnly === '/api';
  if (!collapsed) return current;
  const names = ['x-forwarded-uri', 'x-vercel-original-url', 'x-original-url', 'x-invoke-path', 'x-matched-path', 'x-forwarded-url'];
  for (const name of names) {
    const value = req.headers[name];
    const header = Array.isArray(value) ? value[0] : value;
    if (typeof header === 'string' && header.startsWith('/api/') && !header.startsWith('/api/index')) return header;
  }
  return current;
}

function apiUrl(req: IncomingMessage) {
  const raw = incomingUrl(req);
  if (raw === '/api' || raw.startsWith('/api/')) return raw;
  const queryAt = raw.indexOf('?');
  const path = queryAt === -1 ? raw : raw.slice(0, queryAt);
  const query = queryAt === -1 ? '' : raw.slice(queryAt);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `/api${suffix === '/' ? '' : suffix}${query}`;
}

async function refresh() {
  const dest = process.env.DB_PATH || '/tmp/habsos.db';
  const status = await pullDatabase(dest);
  if (!booted) {
    if (status === 'written') renameSync(`${dest}.incoming`, dest);
    await seed();
    booted = true;
    try {
      await pushDatabase(dest);
    } catch (error) {
      console.error('Initial database push failed — continuing with local SQLite.', error);
    }
    return;
  }
  if (status === 'written') adoptIncoming();
}

function isLive(req: IncomingMessage) {
  return (req.url || '').includes('/events');
}

export const maxDuration = 60;

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return lock(async () => {
    try {
      await refresh();
      req.url = apiUrl(req);
      if (isLive(req)) {
        app(req, res);
        return;
      }
      await new Promise<void>((resolve, reject) => {
        res.once('finish', () => resolve());
        res.once('error', reject);
        try {
          app(req, res);
        } catch (error) {
          reject(error);
        }
      });
      const method = req.method || 'GET';
      if (method !== 'GET' && method !== 'HEAD') await pushDatabase(process.env.DB_PATH || '/tmp/habsos.db');
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Menu could not be loaded.', code: 'SERVER' }));
      }
    }
  });
}
