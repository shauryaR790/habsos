import Dexie, { type Table } from 'dexie';
import type { AddonGroup, CafeSettings, CustomerSummary, MenuCategory, MenuItem, Order, TableInfo } from '../../shared/domain';

export type QueueOp = {
  id: string;
  operation: string;
  entity: string;
  entityId: string;
  payload: unknown;
  createdAt: string;
  synced: 0 | 1;
  retryCount: number;
  lastError: string | null;
};

export type LocalCatalog = {
  cafe: CafeSettings;
  categories: MenuCategory[];
  items: MenuItem[];
  addonGroups: AddonGroup[];
  tables: TableInfo[];
  customers: CustomerSummary[];
};

class HabDB extends Dexie {
  orders!: Table<Order, string>;
  queue!: Table<QueueOp, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('habsos');
    this.version(1).stores({
      orders: 'id, status, createdAt, orderNumber',
      queue: 'id, synced, createdAt',
      meta: 'key',
    });
  }
}

export const habdb = new HabDB();

export async function deviceId() {
  const existing = await habdb.meta.get('deviceId');
  if (typeof existing?.value === 'string') return existing.value;
  const id = crypto.randomUUID();
  await habdb.meta.put({ key: 'deviceId', value: id });
  return id;
}

export async function readCatalog(): Promise<LocalCatalog | null> {
  const row = await habdb.meta.get('catalog');
  return (row?.value as LocalCatalog | undefined) ?? null;
}

export async function writeCatalog(catalog: LocalCatalog) {
  await habdb.meta.put({ key: 'catalog', value: catalog });
}

export async function pendingQueue() {
  return habdb.queue.where('synced').equals(0).sortBy('createdAt');
}

export async function enqueue(input: Omit<QueueOp, 'synced' | 'retryCount' | 'lastError' | 'id' | 'createdAt'> & { id?: string }) {
  const op: QueueOp = {
    id: input.id ?? crypto.randomUUID(),
    operation: input.operation,
    entity: input.entity,
    entityId: input.entityId,
    payload: input.payload,
    createdAt: new Date().toISOString(),
    synced: 0,
    retryCount: 0,
    lastError: null,
  };
  await habdb.queue.put(op);
  return op;
}
