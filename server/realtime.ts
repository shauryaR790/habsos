import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { Order } from '../shared/domain';
import { toPublicOrder } from '../shared/domain';
import { run } from './db';
import { CAFE_ID } from './ids';

export type MenuEventItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  isAvailable: boolean;
  sortOrder: number;
  addonGroupIds: string[];
};

export type AddonEvent = {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
};

export type ServerEvent =
  | { type: 'order.upsert'; order: Order }
  | { type: 'menu.updated'; item: MenuEventItem }
  | { type: 'addon.updated'; addon: AddonEvent }
  | { type: 'table.updated'; tableId: string }
  | { type: 'ping' };

type Client = {
  id: string;
  res: Response;
  kind: 'admin' | 'order' | 'menu';
  orderId?: string;
};

const clients = new Set<Client>();

export function addClient(client: Client) {
  clients.add(client);
  return () => clients.delete(client);
}

function write(client: Client, payload: unknown) {
  client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function publish(event: ServerEvent) {
  for (const client of clients) {
    try {
      if (client.kind === 'menu') {
        if (event.type === 'menu.updated' || event.type === 'addon.updated') write(client, event);
        continue;
      }
      if (client.kind === 'order') {
        if (event.type === 'order.upsert' && event.order.id === client.orderId) {
          write(client, { type: 'order.upsert', order: toPublicOrder(event.order) });
        }
        continue;
      }
      write(client, event);
    } catch {
      clients.delete(client);
    }
  }
}

export function openStream(res: Response, kind: Client['kind'], orderId?: string) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('\n');
  const id = randomUUID();
  const remove = addClient({ id, res, kind, orderId });
  res.on('close', () => remove());
  return id;
}

export function touchDevice(deviceId: string, name = 'POS') {
  const clean = deviceId.replace(/[^\w-]/g, '').slice(0, 80);
  if (!clean) return;
  const now = new Date().toISOString();
  run(
    `INSERT INTO devices (id, cafe_id, name, last_seen_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at, name = excluded.name`,
    [clean, CAFE_ID, name.slice(0, 80), now],
  );
}

const timer = setInterval(() => {
  for (const client of clients) {
    try {
      write(client, { type: 'ping' });
    } catch {
      clients.delete(client);
    }
  }
}, 20000);
timer.unref?.();
