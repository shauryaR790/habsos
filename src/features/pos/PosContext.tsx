import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  canTransition,
  normalizeMobile,
  priceCart,
  statusMessage,
  type Addon,
  type AddonGroup,
  type CafeSettings,
  type CustomerSummary,
  type MenuCategory,
  type MenuItem,
  type Order,
  type OrderStatus,
  type PaymentMethod,
  type TableInfo,
  type TableStatus,
} from '../../../shared/domain';
import { pushToast } from '../../components/Toast';
import type { ConnState } from '../../components/ConnectionStatus';
import { deviceId, enqueue, habdb, pendingQueue, readCatalog, writeCatalog, type LocalCatalog, type QueueOp } from '../../db/idb';
import { api, ApiError, isNetworkError } from '../../lib/api';

type User = { id: string; name: string; email: string; role: string };
type Snapshot = LocalCatalog & { orders: Order[]; serverTime: string };

type PosValue = {
  ready: boolean;
  conn: ConnState;
  pending: number;
  syncError: string | null;
  queue: QueueOp[];
  user: User | null;
  cafe: CafeSettings | null;
  categories: MenuCategory[];
  items: MenuItem[];
  addonGroups: AddonGroup[];
  tables: TableInfo[];
  orders: Order[];
  customers: CustomerSummary[];
  refresh: () => Promise<void>;
  flush: () => Promise<void>;
  setStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  pay: (orderId: string, method: PaymentMethod) => Promise<void>;
  createOrder: (input: { tableId: string; customerName: string; customerMobile: string; items: { menuItemId: string; quantity: number; addonIds: string[]; notes?: string }[] }) => Promise<void>;
  saveItem: (item: MenuItem) => Promise<void>;
  saveAddon: (addon: Pick<Addon, 'id' | 'name' | 'price' | 'isAvailable'>) => Promise<void>;
  saveTable: (id: string, status: TableStatus) => Promise<void>;
  moveItem: (id: string, direction: 'up' | 'down') => Promise<void>;
  saveGroups: (itemId: string, addonGroupIds: string[]) => Promise<void>;
  saveCategory: (id: string, name: string) => Promise<void>;
  saveSettings: (patch: { name?: string; taxBps?: number }) => Promise<void>;
  discard: (queueId: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const PosContext = createContext<PosValue | null>(null);

function sortOrders(orders: Order[]) {
  return orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function PosProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [conn, setConn] = useState<ConnState>(typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE');
  const [pending, setPending] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueOp[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [catalog, setCatalog] = useState<LocalCatalog | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const flushing = useRef(false);
  const connRef = useRef(conn);
  connRef.current = conn;

  const applyCatalog = useCallback((next: LocalCatalog | null) => {
    setCatalog(next);
  }, []);

  const reloadLocal = useCallback(async () => {
    const [stored, storedOrders, queued] = await Promise.all([readCatalog(), habdb.orders.toArray(), pendingQueue()]);
    if (stored) applyCatalog(stored);
    setOrders(sortOrders(storedOrders));
    setQueue(queued);
    setPending(queued.length);
    return { stored, queued };
  }, [applyCatalog]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    const queued = await pendingQueue();
    setQueue(queued);
    setPending(queued.length);
    if (!queued.length) {
      if (connRef.current !== 'SYNC_ERROR') setConn(navigator.onLine ? 'ONLINE' : 'OFFLINE');
      setSyncError(null);
      return;
    }
    if (!navigator.onLine) {
      setConn('OFFLINE');
      return;
    }
    const prior = connRef.current;
    flushing.current = true;
    setConn('SYNCING');
    try {
      const response = await api<{ results: { id: string; ok: boolean; error?: string; order?: Order; item?: MenuItem; addon?: Addon; table?: TableInfo }[] }>('/api/sync', {
        method: 'POST',
        body: JSON.stringify({
          operations: queued.map((op) => ({
            id: op.id,
            operation: op.operation,
            entity: op.entity,
            entityId: op.entityId,
            payload: op.payload,
            createdAt: op.createdAt,
          })),
        }),
      });
      let failed = false;
      for (const result of response.results) {
        if (!result.ok) {
          const current = queued.find((op) => op.id === result.id);
          await habdb.queue.update(result.id, { lastError: result.error ?? 'Sync failed', retryCount: (current?.retryCount ?? 0) + 1 });
          setSyncError(result.error ?? 'Sync failed');
          failed = true;
          break;
        }
        await habdb.queue.delete(result.id);
        if (result.order) await habdb.orders.put(result.order);
      }
      await reloadLocal();
      if (failed) setConn('SYNC_ERROR');
      else if ((await pendingQueue()).length === 0) {
        setConn('ONLINE');
        setSyncError(null);
        if (prior === 'OFFLINE' || prior === 'SYNC_ERROR') pushToast('All data synced');
      }
    } catch (error) {
      if (isNetworkError(error)) setConn('OFFLINE');
      else {
        setConn('SYNC_ERROR');
        setSyncError(error instanceof Error ? error.message : 'Sync failed');
      }
    } finally {
      flushing.current = false;
    }
  }, [reloadLocal]);

  const pull = useCallback(async () => {
    const snap = await api<Snapshot>('/api/sync/snapshot');
    const queued = await pendingQueue();
    const local = await readCatalog();
    const blockedOrders = new Set(queued.filter((op) => op.entity === 'orders').map((op) => op.entityId));
    const blockedItems = new Set(queued.filter((op) => op.operation === 'UPDATE_MENU').map((op) => op.entityId));
    const blockedAddons = new Set(queued.filter((op) => op.operation === 'UPDATE_ADDON').map((op) => op.entityId));
    const blockedTables = new Set(queued.filter((op) => op.operation === 'UPDATE_TABLE').map((op) => op.entityId));
    const next: LocalCatalog = {
      cafe: snap.cafe,
      categories: snap.categories,
      customers: snap.customers,
      items: snap.items.map((item) => (blockedItems.has(item.id) ? local?.items.find((entry) => entry.id === item.id) ?? item : item)),
      addonGroups: snap.addonGroups.map((group) => ({
        ...group,
        addons: group.addons.map((addon) => {
          if (!blockedAddons.has(addon.id)) return addon;
          const previous = local?.addonGroups.flatMap((entry) => entry.addons).find((entry) => entry.id === addon.id);
          return previous ?? addon;
        }),
      })),
      tables: snap.tables.map((table) => (blockedTables.has(table.id) ? local?.tables.find((entry) => entry.id === table.id) ?? table : table)),
    };
    await writeCatalog(next);
    for (const order of snap.orders) {
      if (!blockedOrders.has(order.id)) await habdb.orders.put(order);
    }
    await reloadLocal();
    await flush();
  }, [flush, reloadLocal]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const storedUser = await habdb.meta.get('user');
      if (!cancel && storedUser?.value) setUser(storedUser.value as User);
      await reloadLocal();
      if (cancel) return;
      setReady(true);
      if (!navigator.onLine) {
        setConn('OFFLINE');
        return;
      }
      try {
        const me = await api<{ user: User }>('/api/auth/me');
        if (cancel) return;
        setUser(me.user);
        await habdb.meta.put({ key: 'user', value: me.user });
        await pull();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          navigate('/pos/login', { replace: true });
          return;
        }
        setConn('OFFLINE');
      }
    })();
    return () => {
      cancel = true;
    };
  }, [navigate, pull, reloadLocal]);

  useEffect(() => {
    const onOffline = () => setConn('OFFLINE');
    const onOnline = () => {
      setConn('ONLINE');
      void flush();
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void fetch('/api/health', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error('down');
          setConn((current) => {
            if (current === 'OFFLINE') {
              void flush();
              return 'ONLINE';
            }
            return current;
          });
        })
        .catch(() => setConn('OFFLINE'));
    }, 20000);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.clearInterval(timer);
    };
  }, [flush]);

  useEffect(() => {
    if (!ready || !user || conn === 'OFFLINE') return;
    let source: EventSource | null = null;
    let stop = false;
    void deviceId().then((id) => {
      if (stop) return;
      source = new EventSource(`/api/events?device=${encodeURIComponent(id)}`);
      source.onmessage = (event) => {
        const data = JSON.parse(event.data) as { type?: string; order?: Order; item?: MenuItem; addon?: Addon; tableId?: string };
        if (!data.type || data.type === 'ping') return;
        if (data.type === 'order.upsert' && data.order) {
          void pendingQueue().then((queued) => {
            if (queued.some((op) => op.entityId === data.order?.id)) return;
            void habdb.orders.put(data.order!);
            setOrders((current) => sortOrders([data.order!, ...current.filter((order) => order.id !== data.order?.id)]));
          });
        }
        if (data.type === 'menu.updated' && data.item) {
          setCatalog((current) => current ? { ...current, items: current.items.map((item) => (item.id === data.item?.id ? { ...item, ...data.item } : item)) } : current);
        }
        if (data.type === 'addon.updated' && data.addon) {
          setCatalog((current) => current ? {
            ...current,
            addonGroups: current.addonGroups.map((group) => ({
              ...group,
              addons: group.addons.map((addon) => (addon.id === data.addon?.id ? { ...addon, ...data.addon } : addon)),
            })),
          } : current);
        }
        if (data.type === 'table.updated') {
          void api<{ tables: TableInfo[] }>('/api/tables').then((result) => {
            setCatalog((current) => current ? { ...current, tables: result.tables } : current);
          }).catch(() => undefined);
        }
      };
    });
    return () => {
      stop = true;
      source?.close();
    };
  }, [conn === 'OFFLINE', ready, user]);

  const rememberCatalog = useCallback(async (next: LocalCatalog) => {
    setCatalog(next);
    await writeCatalog(next);
  }, []);

  const value = useMemo<PosValue>(() => ({
    ready,
    conn,
    pending,
    syncError,
    queue,
    user,
    cafe: catalog?.cafe ?? null,
    categories: catalog?.categories ?? [],
    items: catalog?.items ?? [],
    addonGroups: catalog?.addonGroups ?? [],
    tables: catalog?.tables ?? [],
    orders,
    customers: catalog?.customers ?? [],
    refresh: pull,
    flush,
    setStatus: async (orderId, status) => {
      const order = orders.find((entry) => entry.id === orderId);
      if (!order) return;
      if (order.status !== status && !canTransition(order.status, status)) {
        pushToast(`Cannot move this order to ${status}.`, 'err');
        return;
      }
      const now = new Date().toISOString();
      const next: Order = {
        ...order,
        status,
        updatedAt: now,
        events: [...order.events, { id: crypto.randomUUID(), type: 'status', message: statusMessage(status), createdAt: now, actor: 'staff' }],
      };
      await habdb.orders.put(next);
      await enqueue({ operation: 'UPDATE_ORDER', entity: 'orders', entityId: orderId, payload: { status } });
      setOrders((current) => current.map((entry) => (entry.id === orderId ? next : entry)));
      await flush();
    },
    pay: async (orderId, method) => {
      const order = orders.find((entry) => entry.id === orderId);
      if (!order || order.paymentStatus === 'PAID') return;
      const now = new Date().toISOString();
      const next: Order = {
        ...order,
        paymentStatus: 'PAID',
        updatedAt: now,
        payments: [...order.payments, { id: crypto.randomUUID(), method, amount: order.total, status: 'PAID', createdAt: now }],
        events: [...order.events, { id: crypto.randomUUID(), type: 'payment', message: 'Paid', createdAt: now, actor: 'staff' }],
      };
      await habdb.orders.put(next);
      await enqueue({ operation: 'MARK_PAID', entity: 'orders', entityId: orderId, payload: { method } });
      setOrders((current) => current.map((entry) => (entry.id === orderId ? next : entry)));
      await flush();
    },
    createOrder: async (input) => {
      if (!catalog) throw new Error('Menu is not on this device yet.');
      const mobile = input.customerMobile.trim() ? normalizeMobile(input.customerMobile) : '';
      if (input.customerMobile.trim() && !mobile) throw new Error('Enter a valid 10-digit mobile number.');
      const quote = priceCart({ lines: input.items, items: catalog.items, groups: catalog.addonGroups, taxBps: catalog.cafe.taxBps });
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const table = catalog.tables.find((entry) => entry.id === input.tableId) ?? null;
      const order: Order = {
        id,
        orderNumber: 0,
        cafeId: catalog.cafe.id,
        tableId: table?.id ?? null,
        tableName: table?.name ?? null,
        customerId: null,
        customerName: input.customerName.trim(),
        customerMobile: mobile || '',
        status: 'CONFIRMED',
        paymentStatus: 'UNPAID',
        subtotal: quote.subtotal,
        tax: quote.tax,
        discount: quote.discount,
        total: quote.total,
        source: 'POS',
        notes: '',
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
        items: quote.lines.map((line) => ({
          id: crypto.randomUUID(),
          menuItemId: line.menuItemId,
          nameSnapshot: line.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: line.total,
          notes: line.notes,
          addons: line.addons.map((addon) => ({ id: crypto.randomUUID(), addonId: addon.addonId, nameSnapshot: addon.name, priceSnapshot: addon.price })),
        })),
        events: [{ id: crypto.randomUUID(), type: 'status', message: 'Order placed', createdAt: now, actor: 'staff' }],
        payments: [],
      };
      await habdb.orders.put(order);
      await enqueue({
        operation: 'CREATE_ORDER',
        entity: 'orders',
        entityId: id,
        payload: { id, tableId: order.tableId, customerName: order.customerName, customerMobile: order.customerMobile, items: input.items },
      });
      setOrders((current) => [order, ...current]);
      if (table) {
        const next = {
          ...catalog,
          tables: catalog.tables.map((entry) => (entry.id === table.id ? { ...entry, status: 'OCCUPIED' as const, openOrder: { id, orderNumber: 0, customerName: order.customerName, total: order.total, paymentStatus: 'UNPAID' as const, status: 'CONFIRMED' as const } } : entry)),
        };
        await rememberCatalog(next);
      }
      pushToast(navigator.onLine ? 'Order placed' : 'Order saved on this device');
      await flush();
    },
    saveItem: async (item) => {
      if (!catalog) return;
      const next = { ...catalog, items: catalog.items.map((entry) => (entry.id === item.id ? item : entry)) };
      await rememberCatalog(next);
      await enqueue({
        operation: 'UPDATE_MENU',
        entity: 'menu',
        entityId: item.id,
        payload: { name: item.name, description: item.description, price: item.price, isAvailable: item.isAvailable, imageUrl: item.imageUrl, isVeg: item.isVeg },
      });
      await flush();
    },
    saveAddon: async (addon) => {
      if (!catalog) return;
      const next = {
        ...catalog,
        addonGroups: catalog.addonGroups.map((group) => ({
          ...group,
          addons: group.addons.map((entry) => (entry.id === addon.id ? { ...entry, ...addon } : entry)),
        })),
      };
      await rememberCatalog(next);
      await enqueue({ operation: 'UPDATE_ADDON', entity: 'addon', entityId: addon.id, payload: addon });
      await flush();
    },
    saveTable: async (id, status) => {
      if (!catalog) return;
      const next = { ...catalog, tables: catalog.tables.map((table) => (table.id === id ? { ...table, status } : table)) };
      await rememberCatalog(next);
      await enqueue({ operation: 'UPDATE_TABLE', entity: 'table', entityId: id, payload: { status } });
      await flush();
    },
    moveItem: async (id, direction) => {
      try {
        await api(`/api/menu/items/${id}/move`, { method: 'POST', body: JSON.stringify({ direction }) });
        await pull();
      } catch (error) {
        pushToast(isNetworkError(error) ? 'Reordering needs a connection.' : error instanceof Error ? error.message : 'Could not reorder.', 'err');
      }
    },
    saveGroups: async (itemId, addonGroupIds) => {
      try {
        await api(`/api/menu/items/${itemId}/groups`, { method: 'PUT', body: JSON.stringify({ addonGroupIds }) });
        await pull();
      } catch (error) {
        pushToast(isNetworkError(error) ? 'Saving add-on links needs a connection.' : error instanceof Error ? error.message : 'Could not save add-ons.', 'err');
      }
    },
    saveCategory: async (id, name) => {
      try {
        await api(`/api/menu/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
        await pull();
      } catch (error) {
        pushToast(error instanceof Error ? error.message : 'Could not rename the category.', 'err');
      }
    },
    saveSettings: async (patch) => {
      try {
        const result = await api<{ cafe: CafeSettings }>('/api/settings', { method: 'PATCH', body: JSON.stringify(patch) });
        if (catalog) await rememberCatalog({ ...catalog, cafe: result.cafe });
        pushToast('Settings saved');
      } catch (error) {
        pushToast(error instanceof Error ? error.message : 'Could not save settings.', 'err');
      }
    },
    discard: async (queueId) => {
      const op = queue.find((entry) => entry.id === queueId);
      await habdb.queue.delete(queueId);
      if (op?.operation === 'CREATE_ORDER') await habdb.orders.delete(op.entityId);
      await reloadLocal();
      if (navigator.onLine) await pull();
    },
    signOut: async () => {
      try {
        await api('/api/auth/logout', { method: 'POST' });
      } catch {
        /* still leave the screen */
      }
      await habdb.meta.delete('user');
      navigate('/pos/login', { replace: true });
    },
  }), [catalog, conn, flush, orders, pending, pull, queue, ready, rememberCatalog, reloadLocal, syncError, user, navigate]);

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos() {
  const value = useContext(PosContext);
  if (!value) throw new Error('POS is unavailable.');
  return value;
}
