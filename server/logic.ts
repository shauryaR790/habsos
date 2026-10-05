import { randomUUID } from 'node:crypto';
import {
  type Addon,
  type AddonGroup,
  type CafeSettings,
  type CartLineInput,
  type CustomerSummary,
  type MenuCategory,
  type MenuItem,
  type Order,
  type OrderEvent,
  type OrderItem,
  type OrderItemAddon,
  type OrderSource,
  type OrderStatus,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
  type PriceQuote,
  type TableInfo,
  type TableStatus,
  OPEN_STATUSES,
  PAYMENT_METHODS,
  PriceError,
  canTransition,
  normalizeMobile,
  priceCart,
  startOfZonedDay,
  statusMessage,
} from '../shared/domain';
import { all, get, run, tx } from './db';
import { CAFE_ID } from './ids';
import { hashOtp, makeOtpCode, otpProvider, peekDevCode, rememberDevCode } from './otp';
import { publish, type AddonEvent, type MenuEventItem } from './realtime';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_WINDOW_MS = 15 * 60 * 1000;

type OrderRow = {
  id: string;
  order_number: number;
  cafe_id: string;
  table_id: string | null;
  table_name: string;
  customer_id: string | null;
  customer_name: string;
  customer_mobile: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  source: OrderSource;
  notes: string;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

type ItemRow = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes: string;
};

type AddonRow = {
  id: string;
  order_item_id: string;
  addon_id: string | null;
  name_snapshot: string;
  price_snapshot: number;
};

type EventRow = {
  id: string;
  order_id: string;
  type: string;
  message: string;
  created_at: string;
  actor: string;
};

type PaymentRow = {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  status: string;
  created_at: string;
};

function cleanName(name: string) {
  const value = name.trim().replace(/\s+/g, ' ');
  if (!value || value.length > 80 || /[\u0000-\u001F]/.test(value)) {
    throw new AppError(400, 'NAME', 'Enter a valid name.');
  }
  return value;
}

function cleanImage(url: string | null | undefined) {
  if (!url || !url.trim()) return null;
  const value = url.trim();
  if (value.length > 500 || (!/^https?:\/\//i.test(value) && !value.startsWith('/'))) {
    throw new AppError(400, 'IMAGE', 'Image must be an http(s) URL.');
  }
  return value;
}

function quoteOrThrow(lines: CartLineInput[], discount = 0): PriceQuote {
  const catalog = loadCatalog();
  try {
    return priceCart({
      lines,
      items: catalog.items,
      groups: catalog.addonGroups,
      taxBps: catalog.cafe.taxBps,
      discount,
    });
  } catch (error) {
    if (error instanceof PriceError) throw new AppError(400, 'CART', error.message);
    throw error;
  }
}

export function loadCatalog() {
  const cafeRow = get<{ id: string; name: string; tax_bps: number; timezone: string }>('SELECT id, name, tax_bps, timezone FROM cafes WHERE id = ?', [CAFE_ID]);
  if (!cafeRow) throw new AppError(500, 'CAFE', 'Cafe is not set up.');
  const cafe: CafeSettings = {
    id: cafeRow.id,
    name: cafeRow.name,
    taxBps: cafeRow.tax_bps,
    timezone: cafeRow.timezone,
  };
  const categories = all<{ id: string; name: string; sort_order: number }>('SELECT id, name, sort_order FROM menu_categories WHERE cafe_id = ? ORDER BY sort_order, name', [CAFE_ID]).map(
    (row): MenuCategory => ({ id: row.id, name: row.name, sortOrder: row.sort_order }),
  );
  const groupRows = all<{ id: string; name: string; min_select: number; max_select: number; sort_order: number }>(
    'SELECT id, name, min_select, max_select, sort_order FROM addon_groups WHERE cafe_id = ? ORDER BY sort_order, name',
    [CAFE_ID],
  );
  const addonRows = all<{ id: string; group_id: string; name: string; price: number; is_available: number; sort_order: number }>(
    `SELECT a.id, a.group_id, a.name, a.price, a.is_available, a.sort_order
     FROM addons a JOIN addon_groups g ON g.id = a.group_id
     WHERE g.cafe_id = ? ORDER BY a.sort_order, a.name`,
    [CAFE_ID],
  );
  const addonGroups: AddonGroup[] = groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    minSelect: group.min_select,
    maxSelect: group.max_select,
    sortOrder: group.sort_order,
    addons: addonRows
      .filter((addon) => addon.group_id === group.id)
      .map(
        (addon): Addon => ({
          id: addon.id,
          groupId: addon.group_id,
          name: addon.name,
          price: addon.price,
          isAvailable: addon.is_available === 1,
          sortOrder: addon.sort_order,
        }),
      ),
  }));
  const links = all<{ menu_item_id: string; addon_group_id: string }>('SELECT menu_item_id, addon_group_id FROM menu_item_addon_groups');
  const items = all<{
    id: string;
    category_id: string;
    name: string;
    description: string;
    price: number;
    image_url: string | null;
    is_veg: number;
    is_available: number;
    sort_order: number;
  }>('SELECT id, category_id, name, description, price, image_url, is_veg, is_available, sort_order FROM menu_items WHERE cafe_id = ? ORDER BY sort_order, name', [CAFE_ID]).map(
    (row): MenuItem => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description,
      price: row.price,
      imageUrl: row.image_url,
      isVeg: row.is_veg === 1,
      isAvailable: row.is_available === 1,
      sortOrder: row.sort_order,
      addonGroupIds: links.filter((link) => link.menu_item_id === row.id).map((link) => link.addon_group_id),
    }),
  );
  return { cafe, categories, items, addonGroups };
}

function hydrate(rows: OrderRow[]): Order[] {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const marks = ids.map(() => '?').join(',');
  const itemRows = all<ItemRow>(`SELECT * FROM order_items WHERE order_id IN (${marks})`, ids);
  const itemIds = itemRows.map((row) => row.id);
  const addonRows = itemIds.length
    ? all<AddonRow>(`SELECT * FROM order_item_addons WHERE order_item_id IN (${itemIds.map(() => '?').join(',')})`, itemIds)
    : [];
  const eventRows = all<EventRow>(`SELECT id, order_id, type, message, created_at, actor FROM order_events WHERE order_id IN (${marks}) ORDER BY created_at ASC`, ids);
  const paymentRows = all<PaymentRow>(`SELECT id, order_id, method, amount, status, created_at FROM payments WHERE order_id IN (${marks}) ORDER BY created_at ASC`, ids);

  return rows.map((row) => {
    const items: OrderItem[] = itemRows
      .filter((item) => item.order_id === row.id)
      .map((item) => ({
        id: item.id,
        menuItemId: item.menu_item_id,
        nameSnapshot: item.name_snapshot,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        total: item.total,
        notes: item.notes,
        addons: addonRows
          .filter((addon) => addon.order_item_id === item.id)
          .map(
            (addon): OrderItemAddon => ({
              id: addon.id,
              addonId: addon.addon_id,
              nameSnapshot: addon.name_snapshot,
              priceSnapshot: addon.price_snapshot,
            }),
          ),
      }));
    const events: OrderEvent[] = eventRows
      .filter((event) => event.order_id === row.id)
      .map((event) => ({ id: event.id, type: event.type, message: event.message, createdAt: event.created_at, actor: event.actor }));
    const payments: Payment[] = paymentRows
      .filter((payment) => payment.order_id === row.id)
      .map((payment) => ({
        id: payment.id,
        method: payment.method,
        amount: payment.amount,
        status: payment.status,
        createdAt: payment.created_at,
      }));
    return {
      id: row.id,
      orderNumber: row.order_number,
      cafeId: row.cafe_id,
      tableId: row.table_id,
      tableName: row.table_name || null,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerMobile: row.customer_mobile,
      status: row.status,
      paymentStatus: row.payment_status,
      subtotal: row.subtotal,
      tax: row.tax,
      discount: row.discount,
      total: row.total,
      source: row.source,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncedAt: row.synced_at,
      items,
      events,
      payments,
    };
  });
}

const ORDER_SELECT = `SELECT o.id, o.order_number, o.cafe_id, o.table_id, o.table_name, o.customer_id, o.customer_name, o.customer_mobile,
  o.status, o.payment_status, o.subtotal, o.tax, o.discount, o.total, o.source, o.notes, o.created_at, o.updated_at, o.synced_at
  FROM orders o`;

export function getOrder(id: string): Order | null {
  const row = get<OrderRow>(`${ORDER_SELECT} WHERE o.id = ?`, [id]);
  return row ? hydrate([row])[0] : null;
}

export function getOrderByNumber(orderNumber: number): Order | null {
  const row = get<OrderRow>(`${ORDER_SELECT} WHERE o.cafe_id = ? AND o.order_number = ?`, [CAFE_ID, orderNumber]);
  return row ? hydrate([row])[0] : null;
}

export function getOrderByClientKey(clientKey: string): Order | null {
  const row = get<OrderRow>(`${ORDER_SELECT} WHERE o.client_key = ?`, [clientKey]);
  return row ? hydrate([row])[0] : null;
}

function insertPricedOrder(input: {
  id: string;
  clientKey: string | null;
  tableId: string | null;
  tableName: string;
  customerName: string;
  customerMobile: string;
  status: OrderStatus;
  source: OrderSource;
  quote: PriceQuote;
  actor: string;
  eventMessage: string | null;
}) {
  const now = new Date().toISOString();
  const orderNumber = takeNumber();
  run(
    `INSERT INTO orders (
      id, order_number, cafe_id, table_id, table_name, customer_id, customer_name, customer_mobile,
      status, payment_status, subtotal, tax, discount, total, source, notes, client_key, created_at, updated_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'UNPAID', ?, ?, ?, ?, ?, '', ?, ?, ?, ?)`,
    [
      input.id,
      orderNumber,
      CAFE_ID,
      input.tableId,
      input.tableName,
      input.customerName,
      input.customerMobile,
      input.status,
      input.quote.subtotal,
      input.quote.tax,
      input.quote.discount,
      input.quote.total,
      input.source,
      input.clientKey,
      now,
      now,
      now,
    ],
  );
  for (const line of input.quote.lines) {
    const itemId = randomUUID();
    run(
      `INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, quantity, unit_price, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, input.id, line.menuItemId, line.name, line.quantity, line.unitPrice, line.total, line.notes],
    );
    for (const addon of line.addons) {
      run(
        `INSERT INTO order_item_addons (id, order_item_id, addon_id, name_snapshot, price_snapshot) VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), itemId, addon.addonId, addon.name, addon.price],
      );
    }
  }
  if (input.eventMessage) {
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
      [randomUUID(), input.id, 'status', input.eventMessage, input.status, now, input.actor],
    );
  }
  if (OPEN_STATUSES.includes(input.status)) refreshTable(input.tableId);
  return getOrder(input.id)!;
}

function takeNumber() {
  const row = get<{ next_number: number }>('SELECT next_number FROM order_counters WHERE cafe_id = ?', [CAFE_ID]);
  if (!row) throw new AppError(500, 'COUNTER', 'Order counter is missing.');
  run('UPDATE order_counters SET next_number = ? WHERE cafe_id = ?', [row.next_number + 1, CAFE_ID]);
  return row.next_number;
}

function refreshTable(tableId: string | null) {
  if (!tableId) return;
  const open = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED')`,
    [tableId],
  );
  run('UPDATE tables SET status = ?, updated_at = ? WHERE id = ?', [(open?.n ?? 0) > 0 ? 'OCCUPIED' : 'AVAILABLE', new Date().toISOString(), tableId]);
}

function findTable(tableId?: string | null, tableCode?: string | null) {
  if (tableId) {
    const byId = get<{ id: string; name: string; qr_code: string; status: TableStatus }>('SELECT id, name, qr_code, status FROM tables WHERE id = ? AND cafe_id = ?', [tableId, CAFE_ID]);
    if (byId) return byId;
  }
  if (tableCode) {
    const code = tableCode.trim().toUpperCase();
    const byCode = get<{ id: string; name: string; qr_code: string; status: TableStatus }>('SELECT id, name, qr_code, status FROM tables WHERE cafe_id = ? AND (qr_code = ? OR name = ?)', [CAFE_ID, code, code]);
    if (byCode) return byCode;
  }
  return null;
}

function upsertCustomer(name: string, mobile: string, when: string) {
  const existing = get<{ id: string }>('SELECT id FROM customers WHERE cafe_id = ? AND mobile = ?', [CAFE_ID, mobile]);
  if (!existing) {
    const id = randomUUID();
    run('INSERT INTO customers (id, cafe_id, name, mobile, order_count, last_order_at, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)', [id, CAFE_ID, name, mobile, when, when]);
    return id;
  }
  run('UPDATE customers SET name = ?, order_count = order_count + 1, last_order_at = ? WHERE id = ?', [name, when, existing.id]);
  return existing.id;
}

function assertStillAvailable(order: Order) {
  for (const item of order.items) {
    if (!item.menuItemId) continue;
    const row = get<{ is_available: number; name: string }>('SELECT is_available, name FROM menu_items WHERE id = ?', [item.menuItemId]);
    if (!row || row.is_available !== 1) {
      throw new AppError(409, 'SOLD_OUT', `${item.nameSnapshot} is sold out.`);
    }
    for (const addon of item.addons) {
      if (!addon.addonId) continue;
      const addonRow = get<{ is_available: number; name: string }>('SELECT is_available, name FROM addons WHERE id = ?', [addon.addonId]);
      if (!addonRow || addonRow.is_available !== 1) {
        throw new AppError(409, 'SOLD_OUT', `${addon.nameSnapshot} is sold out.`);
      }
    }
  }
}

function notify(order: Order | null) {
  if (!order || order.status === 'OTP_PENDING' || order.status === 'DRAFT') return;
  publish({ type: 'order.upsert', order });
  if (order.tableId) publish({ type: 'table.updated', tableId: order.tableId });
}

type ChallengeRow = {
  id: string;
  mobile: string;
  code_hash: string;
  status: string;
  expires_at: string;
  attempts: number;
  provider_ref: string;
  created_at: string;
};

function latestChallenge(orderId: string) {
  return get<ChallengeRow>('SELECT id, mobile, code_hash, status, expires_at, attempts, provider_ref, created_at FROM otp_challenges WHERE order_id = ? ORDER BY created_at DESC LIMIT 1', [orderId]);
}

async function issueOtp(orderId: string, mobile: string) {
  const since = new Date(Date.now() - OTP_WINDOW_MS).toISOString();
  const burst = get<{ n: number }>('SELECT COUNT(*) AS n FROM otp_challenges WHERE mobile = ? AND created_at >= ?', [mobile, since]);
  if ((burst?.n ?? 0) >= 5) throw new AppError(429, 'OTP_LIMIT', 'Too many codes sent. Wait a few minutes.');
  const last = latestChallenge(orderId);
  if (last) {
    const elapsed = Date.now() - new Date(last.created_at).getTime();
    if (elapsed < OTP_COOLDOWN_MS) {
      const retryAfter = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
      throw new AppError(429, 'OTP_COOLDOWN', `Wait ${retryAfter}s before resending.`, { retryAfter });
    }
  }
  const id = randomUUID();
  const code = makeOtpCode();
  const sent = await otpProvider.sendOtp({ mobile, code });
  rememberDevCode(id, code);
  const now = new Date();
  const expires = new Date(now.getTime() + OTP_TTL_MS).toISOString();
  run(
    `INSERT INTO otp_challenges (id, mobile, code_hash, status, expires_at, attempts, provider, provider_ref, order_id, created_at)
     VALUES (?, ?, ?, 'OTP_PENDING', ?, 0, ?, ?, ?, ?)`,
    [id, mobile, hashOtp(id, code), expires, otpProvider.name, sent.providerRef, orderId, now.toISOString()],
  );
  if (last && last.status === 'OTP_PENDING') {
    run(`UPDATE otp_challenges SET status = 'EXPIRED' WHERE id = ?`, [last.id]);
  }
  return {
    challengeId: id,
    expiresAt: expires,
    resendAfter: 30,
    devCode: peekDevCode(id),
  };
}

async function currentOtp(orderId: string, mobile: string) {
  const last = latestChallenge(orderId);
  if (last && last.status === 'OTP_PENDING' && new Date(last.expires_at).getTime() > Date.now() && last.attempts < OTP_MAX_ATTEMPTS) {
    const elapsed = Date.now() - new Date(last.created_at).getTime();
    return {
      challengeId: last.id,
      expiresAt: last.expires_at,
      resendAfter: Math.max(0, Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000)),
      devCode: peekDevCode(last.id),
    };
  }
  return issueOtp(orderId, mobile);
}

export function placeGuestOrder(input: {
  tableCode: string;
  customerName: string;
  customerMobile: string;
  items: CartLineInput[];
  clientKey?: string;
}) {
  const mobile = normalizeMobile(input.customerMobile);
  if (!mobile) throw new AppError(400, 'MOBILE', 'Enter a valid 10-digit mobile number.');
  const name = cleanName(input.customerName);
  const table = findTable(null, input.tableCode);
  if (!table) throw new AppError(404, 'TABLE', 'This table is not recognized. Scan the QR code on your table.');
  if (input.clientKey) {
    const existing = getOrderByClientKey(input.clientKey);
    if (existing && !['CANCELLED', 'OTP_PENDING', 'DRAFT'].includes(existing.status)) return existing;
  }
  const id = input.clientKey ?? randomUUID();
  const order = tx(() => {
    const quote = quoteOrThrow(input.items);
    const now = new Date().toISOString();
    const customerId = upsertCustomer(name, mobile, now);
    const created = insertPricedOrder({
      id,
      clientKey: input.clientKey ?? id,
      tableId: table.id,
      tableName: table.name,
      customerName: name,
      customerMobile: mobile,
      status: 'CONFIRMED',
      source: 'QR',
      quote,
      actor: 'customer',
      eventMessage: statusMessage('CONFIRMED'),
    });
    run(`UPDATE orders SET customer_id = ? WHERE id = ?`, [customerId, created.id]);
    return getOrder(created.id)!;
  });
  notify(order);
  return order;
}

export async function startCheckout(input: {
  tableCode: string;
  customerName: string;
  customerMobile: string;
  items: CartLineInput[];
  clientKey?: string;
}) {
  const mobile = normalizeMobile(input.customerMobile);
  if (!mobile) throw new AppError(400, 'MOBILE', 'Enter a valid 10-digit mobile number.');
  const name = cleanName(input.customerName);
  const table = findTable(null, input.tableCode);
  if (!table) throw new AppError(404, 'TABLE', 'This table is not recognized. Scan the QR code on your table.');
  if (input.clientKey) {
    const existing = getOrderByClientKey(input.clientKey);
    if (existing && (existing.status === 'OTP_PENDING' || existing.status === 'CONFIRMED')) {
      const otp = existing.status === 'OTP_PENDING' ? await currentOtp(existing.id, existing.customerMobile) : null;
      return { order: existing, ...otp };
    }
  }
  const id = input.clientKey ?? randomUUID();
  const order = tx(() => {
    const quote = quoteOrThrow(input.items);
    return insertPricedOrder({
      id,
      clientKey: input.clientKey ?? id,
      tableId: table.id,
      tableName: table.name,
      customerName: name,
      customerMobile: mobile,
      status: 'OTP_PENDING',
      source: 'QR',
      quote,
      actor: 'customer',
      eventMessage: null,
    });
  });
  try {
    const otp = await issueOtp(order.id, mobile);
    return { order, ...otp };
  } catch (error) {
    tx(() => {
      run(`UPDATE orders SET status = 'CANCELLED', updated_at = ? WHERE id = ? AND status = 'OTP_PENDING'`, [new Date().toISOString(), order.id]);
    });
    throw error;
  }
}

export async function resendOtp(orderId: string) {
  const order = getOrder(orderId);
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  if (order.status !== 'OTP_PENDING') throw new AppError(409, 'STATE', 'This order is no longer waiting for a code.');
  const otp = await issueOtp(order.id, order.customerMobile);
  return { order, ...otp };
}

export async function verifyCheckout(orderId: string, code: string) {
  const existing = getOrder(orderId);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  if (existing.status === 'CONFIRMED' || OPEN_STATUSES.includes(existing.status)) return existing;
  if (existing.status !== 'OTP_PENDING') throw new AppError(409, 'STATE', 'This order can no longer be verified.');
  const challenge = latestChallenge(orderId);
  if (!challenge) throw new AppError(400, 'OTP', 'Request a code first.');
  if (new Date(challenge.expires_at).getTime() <= Date.now() || challenge.status === 'EXPIRED') {
    run(`UPDATE otp_challenges SET status = 'EXPIRED' WHERE id = ?`, [challenge.id]);
    throw new AppError(422, 'OTP_EXPIRED', 'That code has expired. Request a new one.');
  }
  if (challenge.status === 'FAILED' || challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError(422, 'OTP_FAILED', 'Too many attempts. Request a new code.');
  }
  const result = await otpProvider.verifyOtp({
    mobile: challenge.mobile,
    code,
    challengeId: challenge.id,
    providerRef: challenge.provider_ref,
    codeHash: challenge.code_hash,
  });
  if (result !== 'VERIFIED') {
    const attempts = challenge.attempts + 1;
    run(`UPDATE otp_challenges SET attempts = ?, status = ? WHERE id = ?`, [attempts, attempts >= OTP_MAX_ATTEMPTS ? 'FAILED' : 'OTP_PENDING', challenge.id]);
    if (attempts >= OTP_MAX_ATTEMPTS) throw new AppError(422, 'OTP_FAILED', 'Too many attempts. Request a new code.');
    throw new AppError(422, 'OTP_INVALID', 'That code is not correct.');
  }
  const order = tx(() => {
    const current = getOrder(orderId);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
    if (current.status === 'CONFIRMED') return current;
    if (current.status !== 'OTP_PENDING') throw new AppError(409, 'STATE', 'This order can no longer be verified.');
    assertStillAvailable(current);
    const now = new Date().toISOString();
    const customerId = current.customerMobile ? upsertCustomer(current.customerName, current.customerMobile, now) : null;
    run(
      `UPDATE orders SET status = 'CONFIRMED', customer_id = ?, updated_at = ?, synced_at = ? WHERE id = ?`,
      [customerId, now, now, orderId],
    );
    run(`UPDATE otp_challenges SET status = 'VERIFIED' WHERE id = ?`, [challenge.id]);
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, 'OTP_PENDING', 'CONFIRMED', ?, 'customer')`,
      [randomUUID(), orderId, statusMessage('CONFIRMED'), now],
    );
    refreshTable(current.tableId);
    return getOrder(orderId)!;
  });
  notify(order);
  return order;
}

export function cancelCheckout(orderId: string) {
  const order = tx(() => {
    const current = getOrder(orderId);
    if (!current) return null;
    if (current.status !== 'OTP_PENDING') return current;
    const now = new Date().toISOString();
    run(`UPDATE orders SET status = 'CANCELLED', updated_at = ? WHERE id = ?`, [now, orderId]);
    run(`UPDATE otp_challenges SET status = 'EXPIRED' WHERE order_id = ? AND status = 'OTP_PENDING'`, [orderId]);
    return getOrder(orderId);
  });
  return order;
}

export function createStaffOrder(input: {
  id?: string;
  tableId?: string | null;
  tableCode?: string;
  customerName: string;
  customerMobile?: string;
  items: CartLineInput[];
  clientKey?: string;
}) {
  const key = input.clientKey ?? input.id ?? null;
  if (key) {
    const existing = getOrder(key) ?? getOrderByClientKey(key);
    if (existing) return existing;
  }
  const mobile = input.customerMobile?.trim() ? normalizeMobile(input.customerMobile) : '';
  if (input.customerMobile?.trim() && !mobile) throw new AppError(400, 'MOBILE', 'Enter a valid 10-digit mobile number.');
  const name = cleanName(input.customerName);
  const table = findTable(input.tableId, input.tableCode);
  if ((input.tableId || input.tableCode) && !table) throw new AppError(404, 'TABLE', 'Table not found.');
  const id = input.id ?? randomUUID();
  const order = tx(() => {
    const quote = quoteOrThrow(input.items);
    const created = insertPricedOrder({
      id,
      clientKey: key ?? id,
      tableId: table?.id ?? null,
      tableName: table?.name ?? '',
      customerName: name,
      customerMobile: mobile || '',
      status: 'CONFIRMED',
      source: 'POS',
      quote,
      actor: 'staff',
      eventMessage: statusMessage('CONFIRMED'),
    });
    if (mobile) {
      const customerId = upsertCustomer(name, mobile, created.createdAt);
      run('UPDATE orders SET customer_id = ? WHERE id = ?', [customerId, id]);
    }
    return getOrder(id)!;
  });
  notify(order);
  return order;
}

export function transitionOrder(orderId: string, to: OrderStatus, actor = 'staff') {
  const order = tx(() => {
    const current = getOrder(orderId);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
    if (current.status === to) return current;
    if (!canTransition(current.status, to)) {
      throw new AppError(409, 'TRANSITION', `Cannot move an order from ${current.status} to ${to}.`);
    }
    const now = new Date().toISOString();
    run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [to, now, orderId]);
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, ?, ?, ?, ?)`,
      [randomUUID(), orderId, statusMessage(to), current.status, to, now, actor],
    );
    refreshTable(current.tableId);
    return getOrder(orderId)!;
  });
  notify(order);
  return order;
}

export function markPaid(orderId: string, method: PaymentMethod) {
  const order = tx(() => {
    const current = getOrder(orderId);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
    if (current.status === 'CANCELLED' || current.status === 'DRAFT' || current.status === 'OTP_PENDING') {
      throw new AppError(409, 'PAYMENT', 'This order cannot be marked paid.');
    }
    if (!PAYMENT_METHODS.includes(method)) throw new AppError(400, 'PAYMENT', 'Unknown payment method.');
    if (current.paymentStatus === 'PAID') return current;
    const now = new Date().toISOString();
    run('INSERT INTO payments (id, order_id, method, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), orderId, method, current.total, 'PAID', now]);
    run(`UPDATE orders SET payment_status = 'PAID', updated_at = ? WHERE id = ?`, [now, orderId]);
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'payment', 'Paid', ?, 'PAID', ?, 'staff')`,
      [randomUUID(), orderId, current.paymentStatus, now],
    );
    return getOrder(orderId)!;
  });
  notify(order);
  return order;
}

function itemEvent(item: MenuItem): MenuEventItem {
  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl: item.imageUrl,
    isVeg: item.isVeg,
    isAvailable: item.isAvailable,
    sortOrder: item.sortOrder,
    addonGroupIds: item.addonGroupIds,
  };
}

export function updateMenuItem(id: string, patch: Partial<{ name: string; description: string; price: number; isAvailable: boolean; imageUrl: string | null; isVeg: boolean }>) {
  const current = loadCatalog().items.find((item) => item.id === id);
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Menu item not found.');
  const next = {
    name: patch.name !== undefined ? cleanName(patch.name) : current.name,
    description: patch.description !== undefined ? patch.description.trim().slice(0, 400) : current.description,
    price: patch.price !== undefined ? patch.price : current.price,
    isAvailable: patch.isAvailable !== undefined ? patch.isAvailable : current.isAvailable,
    imageUrl: patch.imageUrl !== undefined ? cleanImage(patch.imageUrl) : current.imageUrl,
    isVeg: patch.isVeg !== undefined ? patch.isVeg : current.isVeg,
  };
  if (!Number.isInteger(next.price) || next.price < 0 || next.price > 100000) throw new AppError(400, 'PRICE', 'Enter a valid price.');
  const now = new Date().toISOString();
  run(
    `UPDATE menu_items SET name = ?, description = ?, price = ?, is_available = ?, image_url = ?, is_veg = ?, updated_at = ? WHERE id = ?`,
    [next.name, next.description, next.price, next.isAvailable ? 1 : 0, next.imageUrl, next.isVeg ? 1 : 0, now, id],
  );
  const item = loadCatalog().items.find((entry) => entry.id === id)!;
  publish({ type: 'menu.updated', item: itemEvent(item) });
  return item;
}

export function moveMenuItem(id: string, direction: 'up' | 'down') {
  const catalog = loadCatalog();
  const item = catalog.items.find((entry) => entry.id === id);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Menu item not found.');
  const siblings = catalog.items.filter((entry) => entry.categoryId === item.categoryId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const index = siblings.findIndex((entry) => entry.id === id);
  const target = siblings[index + (direction === 'up' ? -1 : 1)];
  if (!target) return item;
  tx(() => {
    run('UPDATE menu_items SET sort_order = ? WHERE id = ?', [target.sortOrder, item.id]);
    run('UPDATE menu_items SET sort_order = ? WHERE id = ?', [item.sortOrder, target.id]);
  });
  const updated = loadCatalog().items.find((entry) => entry.id === id)!;
  publish({ type: 'menu.updated', item: itemEvent(updated) });
  publish({ type: 'menu.updated', item: itemEvent(loadCatalog().items.find((entry) => entry.id === target.id)!) });
  return updated;
}

export function updateCategory(id: string, name: string) {
  const clean = cleanName(name);
  const row = get<{ id: string }>('SELECT id FROM menu_categories WHERE id = ? AND cafe_id = ?', [id, CAFE_ID]);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Category not found.');
  run('UPDATE menu_categories SET name = ? WHERE id = ?', [clean, id]);
  return loadCatalog().categories.find((category) => category.id === id)!;
}

export function setItemGroups(itemId: string, addonGroupIds: string[]) {
  const item = loadCatalog().items.find((entry) => entry.id === itemId);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Menu item not found.');
  const known = new Set(loadCatalog().addonGroups.map((group) => group.id));
  if (addonGroupIds.some((id) => !known.has(id))) throw new AppError(400, 'ADDON', 'Unknown add-on group.');
  tx(() => {
    run('DELETE FROM menu_item_addon_groups WHERE menu_item_id = ?', [itemId]);
    for (const groupId of addonGroupIds) {
      run('INSERT INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)', [itemId, groupId]);
    }
  });
  const updated = loadCatalog().items.find((entry) => entry.id === itemId)!;
  publish({ type: 'menu.updated', item: itemEvent(updated) });
  return updated;
}

export function updateAddon(id: string, patch: Partial<{ name: string; price: number; isAvailable: boolean }>) {
  const row = get<{ id: string; name: string; price: number; is_available: number }>('SELECT id, name, price, is_available FROM addons WHERE id = ?', [id]);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Add-on not found.');
  const name = patch.name !== undefined ? cleanName(patch.name) : row.name;
  const price = patch.price !== undefined ? patch.price : row.price;
  const isAvailable = patch.isAvailable !== undefined ? patch.isAvailable : row.is_available === 1;
  if (!Number.isInteger(price) || price < 0) throw new AppError(400, 'PRICE', 'Enter a valid price.');
  run('UPDATE addons SET name = ?, price = ?, is_available = ? WHERE id = ?', [name, price, isAvailable ? 1 : 0, id]);
  const addon: AddonEvent = { id, name, price, isAvailable };
  publish({ type: 'addon.updated', addon });
  return addon;
}

export function updateTable(id: string, status: TableStatus) {
  const table = get<{ id: string }>('SELECT id FROM tables WHERE id = ? AND cafe_id = ?', [id, CAFE_ID]);
  if (!table) throw new AppError(404, 'NOT_FOUND', 'Table not found.');
  if (status === 'AVAILABLE') {
    const open = get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED')`,
      [id],
    );
    if ((open?.n ?? 0) > 0) throw new AppError(409, 'TABLE_BUSY', 'This table still has an open order.');
  }
  run('UPDATE tables SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), id]);
  publish({ type: 'table.updated', tableId: id });
  return listTables().find((entry) => entry.id === id)!;
}

export function updateSettings(patch: { name?: string; taxBps?: number }) {
  if (patch.name) run('UPDATE cafes SET name = ? WHERE id = ?', [cleanName(patch.name), CAFE_ID]);
  if (patch.taxBps !== undefined) {
    if (!Number.isInteger(patch.taxBps) || patch.taxBps < 0 || patch.taxBps > 2800) throw new AppError(400, 'TAX', 'Tax rate is out of range.');
    run('UPDATE cafes SET tax_bps = ? WHERE id = ?', [patch.taxBps, CAFE_ID]);
  }
  return loadCatalog().cafe;
}

export function listTables(): TableInfo[] {
  const tables = all<{ id: string; name: string; qr_code: string; status: TableStatus }>('SELECT id, name, qr_code, status FROM tables WHERE cafe_id = ? ORDER BY name', [CAFE_ID]);
  return tables.map((table) => {
    const open = get<OrderRow>(
      `${ORDER_SELECT} WHERE o.table_id = ? AND o.status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') ORDER BY o.created_at DESC LIMIT 1`,
      [table.id],
    );
    return {
      id: table.id,
      name: table.name,
      qrCode: table.qr_code,
      status: open ? 'OCCUPIED' : table.status,
      openOrder: open
        ? {
            id: open.id,
            orderNumber: open.order_number,
            customerName: open.customer_name,
            total: open.total,
            paymentStatus: open.payment_status,
            status: open.status,
          }
        : null,
    };
  });
}

export function listOrders() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const rows = all<OrderRow>(
    `${ORDER_SELECT} WHERE o.cafe_id = ? AND o.status != 'DRAFT' AND (
      o.status IN ('OTP_PENDING','CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') OR o.created_at >= ?
    ) ORDER BY o.created_at DESC LIMIT 300`,
    [CAFE_ID, since],
  );
  return hydrate(rows);
}

export function listCustomers(): CustomerSummary[] {
  return all<{ id: string; name: string; mobile: string; order_count: number; last_order_at: string | null }>(
    'SELECT id, name, mobile, order_count, last_order_at FROM customers WHERE cafe_id = ? ORDER BY last_order_at DESC',
    [CAFE_ID],
  ).map((row) => ({
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    orderCount: row.order_count,
    lastOrderAt: row.last_order_at,
  }));
}

export function reportToday() {
  const cafe = loadCatalog().cafe;
  const start = startOfZonedDay(cafe.timezone).toISOString();
  const rows = all<{ status: OrderStatus; payment_status: PaymentStatus; total: number }>(
    `SELECT status, payment_status, total FROM orders WHERE cafe_id = ? AND created_at >= ? AND status NOT IN ('DRAFT','OTP_PENDING','CANCELLED')`,
    [CAFE_ID, start],
  );
  const byStatus: Record<string, number> = {};
  let paidTotal = 0;
  let unpaidTotal = 0;
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    if (row.payment_status === 'PAID') paidTotal += row.total;
    if (row.payment_status === 'UNPAID') unpaidTotal += row.total;
  }
  const gross = rows.reduce((sum, row) => sum + row.total, 0);
  return {
    from: start,
    ordersToday: rows.length,
    paidTotal,
    unpaidTotal,
    gross,
    averageTicket: rows.length ? Math.round(gross / rows.length) : 0,
    byStatus,
  };
}

export function snapshot() {
  const catalog = loadCatalog();
  return {
    cafe: catalog.cafe,
    categories: catalog.categories,
    items: catalog.items,
    addonGroups: catalog.addonGroups,
    tables: listTables(),
    orders: listOrders().filter((order) => order.status !== 'OTP_PENDING'),
    customers: listCustomers(),
    serverTime: new Date().toISOString(),
  };
}

export function retimeOrder(orderId: string, startIso: string) {
  const events = all<{ id: string }>('SELECT id FROM order_events WHERE order_id = ? ORDER BY created_at ASC', [orderId]);
  events.forEach((event, index) => {
    const at = new Date(new Date(startIso).getTime() + index * 2 * 60 * 1000).toISOString();
    run('UPDATE order_events SET created_at = ? WHERE id = ?', [at, event.id]);
  });
  const end = new Date(new Date(startIso).getTime() + Math.max(0, events.length - 1) * 2 * 60 * 1000).toISOString();
  run('UPDATE orders SET created_at = ?, updated_at = ? WHERE id = ?', [startIso, end, orderId]);
  run('UPDATE payments SET created_at = ? WHERE order_id = ?', [end, orderId]);
}

type SyncOp = {
  id: string;
  operation: string;
  entityId: string;
  payload?: unknown;
};

export function applySyncBatch(operations: SyncOp[]) {
  const results: { id: string; ok: boolean; error?: string; order?: Order; item?: MenuItem; addon?: AddonEvent; table?: TableInfo }[] = [];
  for (const op of operations) {
    try {
      const payload = (op.payload ?? {}) as Record<string, unknown>;
      if (op.operation === 'CREATE_ORDER') {
        const items = payload.items as CartLineInput[];
        const order = createStaffOrder({
          id: String(payload.id || op.entityId),
          tableId: (payload.tableId as string | null) ?? null,
          tableCode: payload.tableCode as string | undefined,
          customerName: String(payload.customerName || ''),
          customerMobile: String(payload.customerMobile || ''),
          items,
          clientKey: String(payload.id || op.entityId),
        });
        results.push({ id: op.id, ok: true, order });
        continue;
      }
      if (op.operation === 'UPDATE_ORDER' || op.operation === 'MARK_PREPARING' || op.operation === 'MARK_READY') {
        const status = (op.operation === 'MARK_PREPARING' ? 'PREPARING' : op.operation === 'MARK_READY' ? 'READY' : payload.status) as OrderStatus;
        const order = transitionOrder(op.entityId, status);
        results.push({ id: op.id, ok: true, order });
        continue;
      }
      if (op.operation === 'MARK_PAID') {
        const order = markPaid(op.entityId, payload.method as PaymentMethod);
        results.push({ id: op.id, ok: true, order });
        continue;
      }
      if (op.operation === 'UPDATE_MENU') {
        const item = updateMenuItem(op.entityId, {
          name: payload.name as string | undefined,
          description: payload.description as string | undefined,
          price: payload.price as number | undefined,
          isAvailable: payload.isAvailable as boolean | undefined,
          imageUrl: payload.imageUrl as string | null | undefined,
          isVeg: payload.isVeg as boolean | undefined,
        });
        results.push({ id: op.id, ok: true, item });
        continue;
      }
      if (op.operation === 'UPDATE_ADDON') {
        const addon = updateAddon(op.entityId, {
          name: payload.name as string | undefined,
          price: payload.price as number | undefined,
          isAvailable: payload.isAvailable as boolean | undefined,
        });
        results.push({ id: op.id, ok: true, addon });
        continue;
      }
      if (op.operation === 'UPDATE_TABLE') {
        const table = updateTable(op.entityId, payload.status as TableStatus);
        results.push({ id: op.id, ok: true, table });
        continue;
      }
      results.push({ id: op.id, ok: false, error: 'Unknown operation.' });
      break;
    } catch (error) {
      results.push({ id: op.id, ok: false, error: error instanceof Error ? error.message : 'Sync failed' });
      break;
    }
  }
  return results;
}
