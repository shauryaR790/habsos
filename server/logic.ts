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
  type TableReservation,
  type TableStatus,
  LINE_QTY_MAX,
  OPEN_STATUSES,
  PAYMENT_METHODS,
  PriceError,
  applyLineQuantity,
  buildSalesReport,
  canTransition,
  cartLineKey,
  clampLineQuantity,
  defaultAddonGroupsForCategory,
  dueTotal,
  formatZonedYmd,
  normalizeMobile,
  normalizeShortcut,
  orderFlag,
  paidTotal,
  paymentPreferenceFromNotes,
  parseYmd,
  priceCart,
  shiftYmd,
  splitAmounts,
  statusMessage,
  zonedDayStart,
} from '../shared/domain';
import { defaultGuestMetaForCategory, parseIngredientList, serializeIngredients } from '../shared/menuDisplay';
import { all, get, run, tx } from './db';
import { CAFE_ID } from './ids';
import { hashOtp, makeOtpCode, otpProvider, peekDevCode, rememberDevCode } from './otp';
import { publish, type AddonEvent, type MenuEventItem } from './realtime';
import { publicRazorpayKey } from './razorpay';
import { consumeInventoryForOrder } from './inventory';
export { AppError } from './appError';
import { AppError } from './appError';

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
    throw new AppError(400, 'IMAGE', 'Image must be a URL or /uploads/ path.');
  }
  return value;
}

export function guestCheckoutNotes(input: {
  paymentPreference?: string;
  address?: string;
  locality?: string;
  extraInfo?: string;
}) {
  const parts: string[] = [];
  const pref = (input.paymentPreference ?? 'DESK').toUpperCase();
  if (pref === 'UPI' || pref === 'CARD') parts.push(`PAY_PREF:${pref}`);
  else parts.push('PAY_PREF:DESK');
  if (input.address?.trim()) parts.push(`ADDR:${input.address.trim()}`);
  if (input.locality?.trim()) parts.push(`LOCALITY:${input.locality.trim()}`);
  if (input.extraInfo?.trim()) parts.push(`EXTRA:${input.extraInfo.trim()}`);
  parts.push('MODE:DINE');
  return parts.join('\n');
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
    is_favorite: number;
    shortcut_num: string | null;
    shortcut_alpha: string | null;
    sort_order: number;
    menu_lead: string;
    menu_subtitle: string;
    kcal_label: string;
    ingredients_json: string;
  }>(
    'SELECT id, category_id, name, description, price, image_url, is_veg, is_available, is_favorite, shortcut_num, shortcut_alpha, sort_order, menu_lead, menu_subtitle, kcal_label, ingredients_json FROM menu_items WHERE cafe_id = ? ORDER BY sort_order, name',
    [CAFE_ID],
  ).map(
    (row): MenuItem => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description,
      price: row.price,
      imageUrl: row.image_url,
      isVeg: row.is_veg === 1,
      isAvailable: row.is_available === 1,
      isFavorite: row.is_favorite === 1,
      shortcutNum: row.shortcut_num,
      shortcutAlpha: row.shortcut_alpha,
      sortOrder: row.sort_order,
      menuLead: row.menu_lead ?? '',
      menuSubtitle: row.menu_subtitle ?? '',
      kcalLabel: row.kcal_label ?? '',
      ingredients: parseIngredientList(row.ingredients_json),
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
  notes?: string;
}) {
  const now = new Date().toISOString();
  const orderNumber = takeNumber();
  run(
    `INSERT INTO orders (
      id, order_number, cafe_id, table_id, table_name, customer_id, customer_name, customer_mobile,
      status, payment_status, subtotal, tax, discount, total, source, notes, client_key, created_at, updated_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'UNPAID', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.notes ?? '',
      input.clientKey,
      now,
      now,
      now,
    ],
  );
  writeQuoteLines(input.id, input.quote);
  if (input.eventMessage) {
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
      [randomUUID(), input.id, 'status', input.eventMessage, input.status, now, input.actor],
    );
  }
  if (OPEN_STATUSES.includes(input.status)) refreshTable(input.tableId);
  return getOrder(input.id)!;
}

function writeQuoteLines(orderId: string, quote: PriceQuote) {
  for (const line of quote.lines) {
    const itemId = randomUUID();
    run(
      `INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, quantity, unit_price, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, orderId, line.menuItemId, line.name, line.quantity, line.unitPrice, line.total, line.notes],
    );
    for (const addon of line.addons) {
      run(
        `INSERT INTO order_item_addons (id, order_item_id, addon_id, name_snapshot, price_snapshot) VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), itemId, addon.addonId, addon.name, addon.price],
      );
    }
  }
}

function isSplitTicket(notes: string) {
  return notes.split(/\n/).some((line) => /^(SPLIT(:.*)?|PARENT:)/.test(line.trim()));
}

function mergedIntoId(order: Order) {
  const line = order.notes.split(/\n/).map((entry) => entry.trim()).find((entry) => entry.startsWith('MERGED:'));
  return line ? line.slice(7).trim() || null : null;
}

function cartLinesFromOrder(order: Order): CartLineInput[] {
  return order.items.map((item) => {
    if (!item.menuItemId) throw new AppError(400, 'CART', 'An item in the cart is no longer on the menu.');
    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      addonIds: item.addons.map((addon) => addon.addonId).filter((id): id is string => Boolean(id)),
      notes: item.notes,
    };
  });
}

function mergeCartLines(current: CartLineInput[], incoming: CartLineInput[]): CartLineInput[] {
  const next = current.map((line) => ({
    menuItemId: line.menuItemId,
    quantity: line.quantity,
    addonIds: [...line.addonIds],
    notes: line.notes,
  }));
  for (const line of incoming) {
    const key = cartLineKey(line);
    const match = next.find((candidate) => cartLineKey(candidate) === key);
    if (match) {
      const applied = applyLineQuantity(match.quantity, line.quantity);
      match.quantity = applied.capped ? LINE_QTY_MAX : Math.max(match.quantity, applied.quantity);
    } else {
      next.push({
        menuItemId: line.menuItemId,
        quantity: clampLineQuantity(line.quantity),
        addonIds: [...line.addonIds],
        notes: line.notes,
      });
    }
  }
  return next;
}

function unpaidOpenOrdersOnTable(tableId: string, exceptId?: string) {
  const rows = all<OrderRow>(
    `${ORDER_SELECT} WHERE o.table_id = ? AND o.status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') AND o.payment_status != 'PAID'${exceptId ? ' AND o.id != ?' : ''} ORDER BY o.created_at ASC, o.order_number ASC`,
    exceptId ? [tableId, exceptId] : [tableId],
  );
  return rows.length ? hydrate(rows) : [];
}

function unpaidOpenOnTable(tableId: string, exceptId?: string) {
  const opens = unpaidOpenOrdersOnTable(tableId, exceptId);
  if (!opens.length) return null;
  return opens.find((order) => !isSplitTicket(order.notes)) ?? opens[0];
}

function markMergedInto(orderId: string, targetId: string) {
  const current = getOrder(orderId);
  const now = new Date().toISOString();
  const notes = [`MERGED:${targetId}`, current?.notes ?? ''].filter(Boolean).join('\n').slice(0, 400);
  run(`UPDATE orders SET status = 'CANCELLED', notes = ?, updated_at = ?, synced_at = ? WHERE id = ?`, [notes, now, now, orderId]);
}

function appendItemsToOpenOrder(orderId: string, incoming: CartLineInput[], actor: string) {
  const current = getOrder(orderId);
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  if (current.paymentStatus === 'PAID' || current.status === 'COMPLETED' || current.status === 'CANCELLED' || current.status === 'OTP_PENDING') {
    throw new AppError(409, 'STATE', 'This order can no longer be edited.');
  }
  const merged = mergeCartLines(cartLinesFromOrder(current), incoming);
  const quote = quoteOrThrow(merged, current.discount);
  const now = new Date().toISOString();
  const reopen = current.status === 'SERVED' || current.status === 'READY' ? 'CONFIRMED' : current.status;
  run(`DELETE FROM order_item_addons WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)`, [orderId]);
  run('DELETE FROM order_items WHERE order_id = ?', [orderId]);
  writeQuoteLines(orderId, quote);
  run(
    `UPDATE orders SET subtotal = ?, tax = ?, discount = ?, total = ?, status = ?, updated_at = ?, synced_at = ? WHERE id = ?`,
    [quote.subtotal, quote.tax, quote.discount, quote.total, reopen, now, now, orderId],
  );
  run(
    `INSERT INTO order_events (id, order_id, type, message, created_at, actor) VALUES (?, ?, 'items', 'Items added', ?, ?)`,
    [randomUUID(), orderId, now, actor],
  );
  if (reopen !== current.status) {
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, ?, ?, ?, ?)`,
      [randomUUID(), orderId, statusMessage(reopen), current.status, reopen, now, actor],
    );
  }
  refreshTable(current.tableId);
  return getOrder(orderId)!;
}

function foldUnpaidTicketsOnTable(tableId: string, exceptId?: string) {
  const target = unpaidOpenOnTable(tableId, exceptId);
  if (!target) return null;
  const siblings = unpaidOpenOrdersOnTable(tableId, exceptId).filter((order) => {
    if (order.id === target.id) return false;
    if (isSplitTicket(order.notes)) return false;
    if (paidTotal(order) > 0) return false;
    return order.source === 'QR';
  });
  for (const sibling of siblings) {
    appendItemsToOpenOrder(target.id, cartLinesFromOrder(sibling), 'system');
    markMergedInto(sibling.id, target.id);
  }
  return getOrder(target.id);
}

export function replaceStaffOrderItems(orderId: string, input: {
  customerName?: string;
  customerMobile?: string;
  items: CartLineInput[];
  notes?: string;
  discount?: number;
}) {
  const order = tx(() => {
    const current = getOrder(orderId);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
    if (current.paymentStatus === 'PAID' || current.status === 'COMPLETED' || current.status === 'CANCELLED' || current.status === 'OTP_PENDING') {
      throw new AppError(409, 'STATE', 'This order can no longer be edited.');
    }
    const mobile = input.customerMobile?.trim() ? normalizeMobile(input.customerMobile) : current.customerMobile;
    if (input.customerMobile?.trim() && !mobile) throw new AppError(400, 'MOBILE', 'Enter a valid 10-digit mobile number.');
    const name = input.customerName?.trim() ? cleanName(input.customerName) : current.customerName;
    const quote = quoteOrThrow(input.items, input.discount ?? current.discount);
    const now = new Date().toISOString();
    run(`DELETE FROM order_item_addons WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)`, [orderId]);
    run('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    writeQuoteLines(orderId, quote);
    run(
      `UPDATE orders SET customer_name = ?, customer_mobile = ?, subtotal = ?, tax = ?, discount = ?, total = ?, notes = ?, updated_at = ?, synced_at = ? WHERE id = ?`,
      [name, mobile || '', quote.subtotal, quote.tax, quote.discount, quote.total, input.notes ?? current.notes, now, now, orderId],
    );
    run(
      `INSERT INTO order_events (id, order_id, type, message, created_at, actor) VALUES (?, ?, 'items', 'Items updated', ?, 'staff')`,
      [randomUUID(), orderId, now],
    );
    if (mobile) {
      const customerId = upsertCustomer(name, mobile, now);
      run('UPDATE orders SET customer_id = ? WHERE id = ?', [customerId, orderId]);
    }
    refreshTable(current.tableId);
    return getOrder(orderId)!;
  });
  notify(order);
  return order;
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
  if ((open?.n ?? 0) > 0) {
    run('UPDATE tables SET status = ?, updated_at = ? WHERE id = ?', ['OCCUPIED', new Date().toISOString(), tableId]);
    return;
  }
  const latest = get<{ status: string; payment_status: string }>(
    `SELECT status, payment_status FROM orders WHERE table_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [tableId],
  );
  const paid = latest?.status === 'COMPLETED' && latest.payment_status === 'PAID';
  run('UPDATE tables SET status = ?, updated_at = ? WHERE id = ?', [paid ? 'OCCUPIED' : 'AVAILABLE', new Date().toISOString(), tableId]);
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

function seatHeldReservation(tableId: string | null) {
  if (!tableId) return;
  run(`UPDATE reservations SET status = 'SEATED' WHERE cafe_id = ? AND table_id = ? AND status = 'HELD'`, [CAFE_ID, tableId]);
}

function heldReservation(tableId: string): TableReservation | null {
  const row = get<{ id: string; table_id: string; customer_name: string; mobile: string; covers: number; starts_at: string }>(
    `SELECT id, table_id, customer_name, mobile, covers, starts_at FROM reservations WHERE cafe_id = ? AND table_id = ? AND status = 'HELD'`,
    [CAFE_ID, tableId],
  );
  if (!row) return null;
  return {
    id: row.id,
    tableId: row.table_id,
    customerName: row.customer_name,
    mobile: row.mobile,
    covers: row.covers,
    startsAt: row.starts_at,
  };
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
  if (!order || order.status === 'DRAFT') return;
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
    if (existing) {
      const mergedId = mergedIntoId(existing);
      if (mergedId) {
        const combined = getOrder(mergedId);
        if (combined && !['CANCELLED', 'OTP_PENDING', 'DRAFT'].includes(combined.status)) return combined;
      }
      if (!['CANCELLED', 'OTP_PENDING', 'DRAFT'].includes(existing.status)) return existing;
    }
  }
  const id = input.clientKey ?? randomUUID();
  const order = tx(() => {
    const now = new Date().toISOString();
    const customerId = upsertCustomer(name, mobile, now);
    foldUnpaidTicketsOnTable(table.id);
    const open = unpaidOpenOnTable(table.id);
    if (open) {
      const combined = appendItemsToOpenOrder(open.id, input.items, 'customer');
      seatHeldReservation(table.id);
      return combined;
    }
    const quote = quoteOrThrow(input.items);
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
    seatHeldReservation(table.id);
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
  paymentPreference?: string;
  address?: string;
  locality?: string;
  extraInfo?: string;
}) {
  const mobile = normalizeMobile(input.customerMobile);
  if (!mobile) throw new AppError(400, 'MOBILE', 'Enter a valid 10-digit mobile number.');
  const name = cleanName(input.customerName);
  const table = findTable(null, input.tableCode);
  if (!table) throw new AppError(404, 'TABLE', 'This table is not recognized. Scan the QR code on your table.');
  if (input.clientKey) {
    const existing = getOrderByClientKey(input.clientKey);
    if (existing && (existing.status === 'CANCELLED' || existing.status === 'DRAFT')) {
      run(`UPDATE orders SET client_key = NULL WHERE id = ?`, [existing.id]);
    } else if (existing && existing.status !== 'CANCELLED' && existing.status !== 'DRAFT') {
      const mergedId = mergedIntoId(existing);
      if (mergedId) {
        const combined = getOrder(mergedId);
        if (combined && combined.status !== 'CANCELLED' && combined.status !== 'DRAFT') return { order: combined };
      }
      if (existing.status === 'OTP_PENDING' || existing.status === 'CONFIRMED' || OPEN_STATUSES.includes(existing.status)) {
        const otp = existing.status === 'OTP_PENDING' ? await currentOtp(existing.id, existing.customerMobile) : null;
        return { order: existing, ...otp };
      }
    }
  }
  const id = randomUUID();
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
      notes: guestCheckoutNotes(input),
    });
  });
  try {
    const otp = await issueOtp(order.id, mobile);
    notify(getOrder(order.id));
    return { order, ...otp };
  } catch (error) {
    tx(() => {
      run(
        `UPDATE orders SET status = 'CANCELLED', client_key = NULL, updated_at = ? WHERE id = ? AND status = 'OTP_PENDING'`,
        [new Date().toISOString(), order.id],
      );
    });
    const message = error instanceof Error ? error.message : 'Could not send the verification code.';
    throw new AppError(502, 'OTP', message);
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
  const alreadyMerged = mergedIntoId(existing);
  if (alreadyMerged) {
    const combined = getOrder(alreadyMerged);
    if (combined && combined.status !== 'CANCELLED' && combined.status !== 'DRAFT') return combined;
  }
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
    run(`UPDATE otp_challenges SET status = 'VERIFIED' WHERE id = ?`, [challenge.id]);
    if (current.tableId) {
      foldUnpaidTicketsOnTable(current.tableId, current.id);
      const open = unpaidOpenOnTable(current.tableId, current.id);
      if (open) {
        const combined = appendItemsToOpenOrder(open.id, cartLinesFromOrder(current), 'customer');
        markMergedInto(current.id, combined.id);
        refreshTable(current.tableId);
        seatHeldReservation(current.tableId);
        return combined;
      }
    }
    run(
      `UPDATE orders SET status = 'CONFIRMED', customer_id = ?, updated_at = ?, synced_at = ? WHERE id = ?`,
      [customerId, now, now, orderId],
    );
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, 'OTP_PENDING', 'CONFIRMED', ?, 'customer')`,
      [randomUUID(), orderId, statusMessage('CONFIRMED'), now],
    );
    refreshTable(current.tableId);
    seatHeldReservation(current.tableId);
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
    run(`UPDATE orders SET status = 'CANCELLED', client_key = NULL, updated_at = ? WHERE id = ?`, [now, orderId]);
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
  notes?: string;
  discount?: number;
  allowOpenTable?: boolean;
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
    if (table && !input.allowOpenTable) {
      const busy = get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED')`,
        [table.id],
      );
      if ((busy?.n ?? 0) > 0) throw new AppError(409, 'TABLE_BUSY', 'This table already has an open order.');
    }
    const quote = quoteOrThrow(input.items, input.discount ?? 0);
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
      notes: input.notes ?? '',
    });
    if (mobile) {
      const customerId = upsertCustomer(name, mobile, created.createdAt);
      run('UPDATE orders SET customer_id = ? WHERE id = ?', [customerId, id]);
    }
    if (table) seatHeldReservation(table.id);
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

export function markPaid(orderId: string, method: PaymentMethod, amount?: number) {
  const order = tx(() => {
    const current = getOrder(orderId);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
    if (current.status === 'CANCELLED' || current.status === 'DRAFT' || current.status === 'OTP_PENDING') {
      throw new AppError(409, 'PAYMENT', 'This order cannot be marked paid.');
    }
    if (!PAYMENT_METHODS.includes(method)) throw new AppError(400, 'PAYMENT', 'Unknown payment method.');
    if (current.paymentStatus === 'PAID') return current;
    const remaining = dueTotal(current);
    const take = amount ?? remaining;
    if (!Number.isInteger(take) || take < 1) throw new AppError(400, 'PAYMENT', 'Enter an amount of at least ₹1.');
    if (take > remaining) throw new AppError(400, 'PAYMENT', 'Amount is more than the remainder.');
    const now = new Date().toISOString();
    run('INSERT INTO payments (id, order_id, method, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), orderId, method, take, 'PAID', now]);
    const closed = take === remaining;
    if (closed) {
      run(`UPDATE orders SET payment_status = 'PAID', status = 'COMPLETED', updated_at = ? WHERE id = ?`, [now, orderId]);
      run(
        `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'payment', 'Paid', ?, 'PAID', ?, 'staff')`,
        [randomUUID(), orderId, current.paymentStatus, now],
      );
      if (current.status !== 'COMPLETED') {
        run(
          `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, ?, 'COMPLETED', ?, 'staff')`,
          [randomUUID(), orderId, statusMessage('COMPLETED'), current.status, now],
        );
      }
    } else {
      run('UPDATE orders SET updated_at = ? WHERE id = ?', [now, orderId]);
      run(
        `INSERT INTO order_events (id, order_id, type, message, created_at, actor) VALUES (?, ?, 'payment', ?, ?, 'staff')`,
        [randomUUID(), orderId, `Part paid (${take})`, now],
      );
    }
    refreshTable(current.tableId);
    const updated = getOrder(orderId)!;
    if (closed) consumeInventoryForOrder(orderId, 'staff');
    return updated;
  });
  notify(order);
  return order;
}

export function splitStaffOrder(orderId: string, parts: number) {
  const current = getOrder(orderId);
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  let amounts: number[];
  try {
    amounts = splitAmounts(current.total, parts);
  } catch (error) {
    throw new AppError(400, 'SPLIT', error instanceof Error ? error.message : 'Cannot split this bill.');
  }
  const children = tx(() => {
    const current = getOrder(orderId);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
    if (current.paymentStatus === 'PAID' || current.status === 'CANCELLED' || current.status === 'OTP_PENDING' || current.status === 'DRAFT') {
      throw new AppError(409, 'SPLIT', 'This order can no longer be split.');
    }
    if (dueTotal(current) !== current.total) {
      throw new AppError(409, 'SPLIT', 'Split before taking part payment.');
    }
    const now = new Date().toISOString();
    const created: Order[] = [];
    const subtotals = current.subtotal < 1 ? amounts.map(() => 0) : splitAmounts(current.subtotal, amounts.length);
    const taxes = current.tax < 1 ? amounts.map(() => 0) : splitAmounts(current.tax, amounts.length);
    const discounts = current.discount < 1 ? amounts.map(() => 0) : splitAmounts(current.discount, amounts.length);
    for (let index = 0; index < amounts.length; index += 1) {
      const id = randomUUID();
      const notes = [`SPLIT:${index + 1}/${amounts.length}`, `PARENT:${current.id}`, current.notes].filter(Boolean).join('\n').slice(0, 400);
      run(
        `INSERT INTO orders (
          id, order_number, cafe_id, table_id, table_name, customer_id, customer_name, customer_mobile,
          status, payment_status, subtotal, tax, discount, total, source, notes, client_key, created_at, updated_at, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          takeNumber(),
          CAFE_ID,
          current.tableId,
          current.tableName ?? '',
          current.customerId,
          current.customerName,
          current.customerMobile,
          current.status,
          subtotals[index],
          taxes[index],
          discounts[index],
          amounts[index],
          current.source,
          notes,
          id,
          now,
          now,
          now,
        ],
      );
      for (const item of current.items) {
        const shares = item.total < 1 ? amounts.map(() => 0) : splitAmounts(item.total, amounts.length);
        const itemId = randomUUID();
        run(
          `INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, quantity, unit_price, total, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, id, item.menuItemId, item.nameSnapshot, item.quantity, item.unitPrice, shares[index], item.notes],
        );
        for (const addon of item.addons) {
          run(
            `INSERT INTO order_item_addons (id, order_item_id, addon_id, name_snapshot, price_snapshot) VALUES (?, ?, ?, ?, ?)`,
            [randomUUID(), itemId, addon.addonId, addon.nameSnapshot, addon.priceSnapshot],
          );
        }
      }
      run(
        `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, NULL, ?, ?, 'staff')`,
        [randomUUID(), id, `Split bill ${index + 1}/${amounts.length}`, current.status, now],
      );
      created.push(getOrder(id)!);
    }
    run(`UPDATE orders SET status = 'CANCELLED', notes = ?, updated_at = ? WHERE id = ?`, [
      [`SPLIT`, current.notes].filter(Boolean).join('\n').slice(0, 400),
      now,
      orderId,
    ]);
    run(
      `INSERT INTO order_events (id, order_id, type, message, from_status, to_status, created_at, actor) VALUES (?, ?, 'status', ?, ?, 'CANCELLED', ?, 'staff')`,
      [randomUUID(), orderId, `Split into ${amounts.length} bills`, current.status, now],
    );
    refreshTable(current.tableId);
    return created;
  });
  for (const child of children) notify(child);
  const parent = getOrder(orderId);
  if (parent) notify(parent);
  return children;
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
    isFavorite: item.isFavorite,
    shortcutNum: item.shortcutNum,
    shortcutAlpha: item.shortcutAlpha,
    sortOrder: item.sortOrder,
    addonGroupIds: item.addonGroupIds,
    menuLead: item.menuLead,
    menuSubtitle: item.menuSubtitle,
    kcalLabel: item.kcalLabel,
    ingredients: item.ingredients,
  };
}

function cleanNumericShortcut(value: string | null | undefined) {
  const clean = normalizeShortcut(value ?? '');
  if (!clean) return null;
  if (!/^\d{1,4}$/.test(clean)) throw new AppError(400, 'SHORTCUT', 'Numeric shortcut must be 1–4 digits.');
  return clean;
}

function cleanAlphaShortcut(value: string | null | undefined) {
  const clean = normalizeShortcut(value ?? '');
  if (!clean) return null;
  if (!/^[A-Z]{1,8}$/.test(clean)) throw new AppError(400, 'SHORTCUT', 'Alphabetic shortcut must be 1–8 letters.');
  return clean;
}

function assertShortcutFree(itemId: string, num: string | null, alpha: string | null) {
  const codes = [num, alpha].filter((code): code is string => Boolean(code));
  if (!codes.length) return;
  const rows = all<{ id: string; name: string; shortcut_num: string | null; shortcut_alpha: string | null }>(
    'SELECT id, name, shortcut_num, shortcut_alpha FROM menu_items WHERE cafe_id = ? AND id != ?',
    [CAFE_ID, itemId],
  );
  for (const row of rows) {
    const taken = [row.shortcut_num, row.shortcut_alpha].filter(Boolean).map((code) => normalizeShortcut(code ?? ''));
    for (const code of codes) {
      if (taken.includes(code)) throw new AppError(400, 'SHORTCUT', `Shortcut ${code} is already used on ${row.name}.`);
    }
  }
}

export function updateMenuItem(id: string, patch: Partial<{
  name: string;
  description: string;
  price: number;
  isAvailable: boolean;
  imageUrl: string | null;
  isVeg: boolean;
  isFavorite: boolean;
  shortcutNum: string | null;
  shortcutAlpha: string | null;
  menuLead: string;
  menuSubtitle: string;
  kcalLabel: string;
  ingredients: string[];
}>) {
  const current = loadCatalog().items.find((item) => item.id === id);
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Menu item not found.');
  const next = {
    name: patch.name !== undefined ? cleanName(patch.name) : current.name,
    description: patch.description !== undefined ? patch.description.trim().slice(0, 400) : current.description,
    price: patch.price !== undefined ? patch.price : current.price,
    isAvailable: patch.isAvailable !== undefined ? patch.isAvailable : current.isAvailable,
    imageUrl: patch.imageUrl !== undefined ? cleanImage(patch.imageUrl) : current.imageUrl,
    isVeg: patch.isVeg !== undefined ? patch.isVeg : current.isVeg,
    isFavorite: patch.isFavorite !== undefined ? patch.isFavorite : current.isFavorite,
    shortcutNum: patch.shortcutNum !== undefined ? cleanNumericShortcut(patch.shortcutNum) : current.shortcutNum,
    shortcutAlpha: patch.shortcutAlpha !== undefined ? cleanAlphaShortcut(patch.shortcutAlpha) : current.shortcutAlpha,
    menuLead: patch.menuLead !== undefined ? patch.menuLead.trim().slice(0, 24) : current.menuLead,
    menuSubtitle: patch.menuSubtitle !== undefined ? patch.menuSubtitle.trim().slice(0, 80) : current.menuSubtitle,
    kcalLabel: patch.kcalLabel !== undefined ? patch.kcalLabel.trim().slice(0, 40) : current.kcalLabel,
    ingredients: patch.ingredients !== undefined ? parseIngredientList(serializeIngredients(patch.ingredients)) : current.ingredients,
  };
  if (!Number.isInteger(next.price) || next.price < 0 || next.price > 100000) throw new AppError(400, 'PRICE', 'Enter a valid price.');
  if (next.shortcutNum && next.shortcutAlpha && next.shortcutNum === next.shortcutAlpha) {
    throw new AppError(400, 'SHORTCUT', 'Numeric and alphabetic shortcuts on one item must differ.');
  }
  assertShortcutFree(id, next.shortcutNum, next.shortcutAlpha);
  const now = new Date().toISOString();
  run(
    `UPDATE menu_items SET name = ?, description = ?, price = ?, is_available = ?, image_url = ?, is_veg = ?, is_favorite = ?, shortcut_num = ?, shortcut_alpha = ?, menu_lead = ?, menu_subtitle = ?, kcal_label = ?, ingredients_json = ?, updated_at = ? WHERE id = ?`,
    [
      next.name,
      next.description,
      next.price,
      next.isAvailable ? 1 : 0,
      next.imageUrl,
      next.isVeg ? 1 : 0,
      next.isFavorite ? 1 : 0,
      next.shortcutNum,
      next.shortcutAlpha,
      next.menuLead,
      next.menuSubtitle,
      next.kcalLabel,
      serializeIngredients(next.ingredients),
      now,
      id,
    ],
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

export type TableStage = 'blank' | 'running' | 'kot' | 'printed' | 'paid';

function latestOpenOrderOnTable(tableId: string) {
  const row = get<OrderRow>(
    `${ORDER_SELECT} WHERE o.table_id = ? AND o.payment_status != 'PAID' AND o.status IN ('OTP_PENDING','CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') ORDER BY o.updated_at DESC LIMIT 1`,
    [tableId],
  );
  return row ? hydrate([row])[0] : null;
}

export function setTableStage(tableId: string, stage: TableStage) {
  const table = listTables().find((entry) => entry.id === tableId);
  if (!table) throw new AppError(404, 'TABLE', 'Table not found.');
  const open = latestOpenOrderOnTable(tableId);
  if (stage === 'blank') {
    const activeRows = all<OrderRow>(
      `${ORDER_SELECT} WHERE o.table_id = ? AND o.status IN ('OTP_PENDING','CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') ORDER BY o.updated_at DESC`,
      [tableId],
    );
    for (const row of activeRows) {
      const order = hydrate([row])[0];
      if (order.status === 'OTP_PENDING') cancelCheckout(order.id);
      else if (canTransition(order.status, 'CANCELLED')) transitionOrder(order.id, 'CANCELLED');
    }
    const now = new Date().toISOString();
    run('UPDATE tables SET status = ?, updated_at = ? WHERE id = ?', ['AVAILABLE', now, tableId]);
    publish({ type: 'table.updated', tableId });
    return listTables().find((entry) => entry.id === tableId)!;
  }
  if (!open) throw new AppError(409, 'TABLE', 'No open order on this table.');
  if (stage === 'running') transitionOrder(open.id, 'CONFIRMED');
  else if (stage === 'kot') transitionOrder(open.id, 'PREPARING');
  else if (stage === 'printed') transitionOrder(open.id, 'SERVED');
  else if (stage === 'paid') {
    const pref = paymentPreferenceFromNotes(open.notes);
    markPaid(open.id, pref === 'CARD' ? 'CARD' : pref === 'UPI' ? 'UPI' : 'CASH');
  }
  refreshTable(tableId);
  return listTables().find((entry) => entry.id === tableId)!;
}

export function createMenuItem(input: {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string | null;
  isVeg?: boolean;
  isFavorite?: boolean;
  shortcutNum?: string | null;
  shortcutAlpha?: string | null;
  addonGroupIds?: string[];
  menuLead?: string;
  menuSubtitle?: string;
  kcalLabel?: string;
  ingredients?: string[];
}) {
  const category = loadCatalog().categories.find((entry) => entry.id === input.categoryId);
  if (!category) throw new AppError(404, 'NOT_FOUND', 'Category not found.');
  const id = `item_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const name = cleanName(input.name);
  const guestDefaults = defaultGuestMetaForCategory(input.categoryId, name);
  if (!Number.isInteger(input.price) || input.price < 0 || input.price > 100000) throw new AppError(400, 'PRICE', 'Enter a valid price.');
  const shortcutNum = cleanNumericShortcut(input.shortcutNum);
  const shortcutAlpha = cleanAlphaShortcut(input.shortcutAlpha);
  assertShortcutFree(id, shortcutNum, shortcutAlpha);
  const siblings = loadCatalog().items.filter((item) => item.categoryId === input.categoryId);
  const sortOrder = siblings.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;
  const now = new Date().toISOString();
  const imageUrl = cleanImage(input.imageUrl ?? null);
  const menuLead = (input.menuLead ?? guestDefaults.menuLead).trim().slice(0, 24);
  const menuSubtitle = (input.menuSubtitle ?? guestDefaults.menuSubtitle).trim().slice(0, 80);
  const kcalLabel = (input.kcalLabel ?? guestDefaults.kcalLabel).trim().slice(0, 40);
  const ingredients = parseIngredientList(
    serializeIngredients(input.ingredients?.length ? input.ingredients : guestDefaults.ingredients),
  );
  run(
    `INSERT INTO menu_items (id, cafe_id, category_id, name, description, price, image_url, is_veg, is_available, is_favorite, shortcut_num, shortcut_alpha, sort_order, menu_lead, menu_subtitle, kcal_label, ingredients_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      CAFE_ID,
      input.categoryId,
      name,
      (input.description ?? '').trim().slice(0, 400),
      input.price,
      imageUrl,
      input.isVeg === false ? 0 : 1,
      input.isFavorite ? 1 : 0,
      shortcutNum,
      shortcutAlpha,
      sortOrder,
      menuLead,
      menuSubtitle,
      kcalLabel,
      serializeIngredients(ingredients),
      now,
    ],
  );
  const addonGroupIds = input.addonGroupIds?.length
    ? input.addonGroupIds
    : defaultAddonGroupsForCategory(input.categoryId);
  if (addonGroupIds.length) setItemGroups(id, addonGroupIds);
  const item = loadCatalog().items.find((entry) => entry.id === id)!;
  publish({ type: 'menu.updated', item: itemEvent(item) });
  return item;
}

export function createTable(input: { name: string; area?: string }): TableInfo {
  const name = input.name.trim();
  if (!name) throw new AppError(400, 'TABLE', 'Enter a table name.');
  const area = input.area?.trim() || 'Ground Floor';
  const qr = name.replace(/\s+/g, '').toUpperCase();
  const clash = get<{ id: string }>('SELECT id FROM tables WHERE cafe_id = ? AND (name = ? OR qr_code = ?)', [CAFE_ID, name, qr]);
  if (clash) throw new AppError(409, 'TABLE', 'A table with that name already exists.');
  const id = `table_${qr.toLowerCase()}`;
  const now = new Date().toISOString();
  run(
    `INSERT INTO tables (id, cafe_id, name, qr_code, status, area, updated_at) VALUES (?, ?, ?, ?, 'AVAILABLE', ?, ?)`,
    [id, CAFE_ID, name, qr, area, now],
  );
  publish({ type: 'table.updated', tableId: id });
  const created = listTables().find((entry) => entry.id === id);
  if (!created) throw new AppError(500, 'TABLE', 'Could not create the table.');
  return created;
}

export function reassignOrderTable(orderId: string, tableId: string): Order {
  const order = tx(() => {
    const current = getOrder(orderId);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
    if (!OPEN_STATUSES.includes(current.status) || current.paymentStatus === 'PAID') {
      throw new AppError(409, 'ORDER', 'Only an open unpaid order can move.');
    }
    const dest = findTable(tableId);
    if (!dest) throw new AppError(404, 'TABLE', 'Table not found.');
    if (current.tableId === dest.id) return current;
    const busy = get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND id != ? AND status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED')`,
      [dest.id, orderId],
    );
    if ((busy?.n ?? 0) > 0) throw new AppError(409, 'TABLE_BUSY', 'That table already has an open order.');
    const now = new Date().toISOString();
    run('UPDATE orders SET table_id = ?, table_name = ?, updated_at = ? WHERE id = ?', [dest.id, dest.name, now, orderId]);
    refreshTable(current.tableId);
    refreshTable(dest.id);
    return getOrder(orderId)!;
  });
  notify(order);
  return order;
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
  const tables = all<{ id: string; name: string; qr_code: string; status: TableStatus; area: string }>(
    `SELECT id, name, qr_code, status, COALESCE(area, 'Ground Floor') AS area
     FROM tables WHERE cafe_id = ?
     ORDER BY CASE COALESCE(area, 'Ground Floor')
       WHEN 'Ground Floor' THEN 1
       WHEN 'Basement' THEN 2
       WHEN 'Party Hall' THEN 3
       ELSE 4
     END, name`,
    [CAFE_ID],
  );
  return tables.map((table) => {
    const opens = all<OrderRow>(
      `${ORDER_SELECT} WHERE o.table_id = ? AND o.status IN ('CONFIRMED','ACCEPTED','PREPARING','READY','SERVED') ORDER BY o.updated_at DESC`,
      [table.id],
    );
    let hydrated = opens.length ? hydrate(opens) : [];
    let latest = hydrated[0] ?? null;
    if (!latest) {
      const pending = all<OrderRow>(
        `${ORDER_SELECT} WHERE o.table_id = ? AND o.status = 'OTP_PENDING' ORDER BY o.updated_at DESC LIMIT 1`,
        [table.id],
      );
      if (pending.length) {
        hydrated = hydrate(pending);
        latest = hydrated[0] ?? null;
      }
    }
    const due = hydrated.reduce((sum, order) => sum + dueTotal(order), 0);
    const paidRows = latest || table.status !== 'OCCUPIED'
      ? []
      : all<OrderRow>(
        `${ORDER_SELECT} WHERE o.table_id = ? AND o.status = 'COMPLETED' AND o.payment_status = 'PAID' ORDER BY o.updated_at DESC LIMIT 1`,
        [table.id],
      );
    const paid = paidRows.length ? hydrate(paidRows)[0] ?? null : null;
    const shown = latest ?? paid;
    const hold = heldReservation(table.id);
    return {
      id: table.id,
      name: table.name,
      qrCode: table.qr_code,
      status: shown ? 'OCCUPIED' : table.status,
      area: table.area || 'Ground Floor',
      openOrder: shown
        ? {
            id: shown.id,
            orderNumber: shown.orderNumber,
            customerName: shown.customerName,
            total: latest ? hydrated.reduce((sum, order) => sum + order.total, 0) : shown.total,
            paymentStatus: shown.paymentStatus,
            status: shown.status,
            createdAt: shown.createdAt,
            due: latest ? due : 0,
          }
        : null,
      reservation: shown ? null : hold,
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

export function clearAllCustomers() {
  run('DELETE FROM customers WHERE cafe_id = ?', [CAFE_ID]);
  run('UPDATE orders SET customer_id = NULL WHERE cafe_id = ?', [CAFE_ID]);
}

export function listCustomers(): CustomerSummary[] {
  return all<{ id: string; name: string; mobile: string; order_count: number; spent: number; last_order_at: string | null }>(
    `SELECT c.id, c.name, c.mobile, c.last_order_at,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status NOT IN ('DRAFT','OTP_PENDING','CANCELLED')) AS order_count,
      (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.customer_id = c.id AND o.status NOT IN ('DRAFT','OTP_PENDING','CANCELLED')) AS spent
     FROM customers c WHERE c.cafe_id = ? ORDER BY c.last_order_at DESC`,
    [CAFE_ID],
  ).map((row) => ({
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    orderCount: row.order_count,
    spent: row.spent,
    lastOrderAt: row.last_order_at,
  }));
}

export function createCustomer(name: string, mobile: string): CustomerSummary {
  const digits = normalizeMobile(mobile);
  if (!digits) throw new AppError(400, 'MOBILE', 'Enter a valid 10-digit mobile number.');
  const label = cleanName(name);
  const now = new Date().toISOString();
  const existing = get<{ id: string }>('SELECT id FROM customers WHERE cafe_id = ? AND mobile = ?', [CAFE_ID, digits]);
  if (existing) {
    run('UPDATE customers SET name = ? WHERE id = ?', [label, existing.id]);
  } else {
    run(
      'INSERT INTO customers (id, cafe_id, name, mobile, order_count, last_order_at, created_at) VALUES (?, ?, ?, ?, 0, NULL, ?)',
      [randomUUID(), CAFE_ID, label, digits, now],
    );
  }
  const row = listCustomers().find((customer) => customer.mobile === digits);
  if (!row) throw new AppError(500, 'CUSTOMER', 'Could not save the customer.');
  return row;
}

export function listCustomerOrders(customerId: string) {
  const rows = all<OrderRow>(
    `${ORDER_SELECT} WHERE o.cafe_id = ? AND o.customer_id = ? AND o.status != 'DRAFT' ORDER BY o.created_at DESC LIMIT 80`,
    [CAFE_ID, customerId],
  );
  return hydrate(rows);
}

export function createReservation(input: {
  tableId: string;
  customerName: string;
  customerMobile?: string;
  covers: number;
  startsAt?: string;
}): TableReservation {
  const table = get<{ id: string }>('SELECT id FROM tables WHERE cafe_id = ? AND id = ?', [CAFE_ID, input.tableId]);
  if (!table) throw new AppError(404, 'TABLE', 'Table not found.');
  const current = listTables().find((entry) => entry.id === input.tableId);
  if (current?.openOrder) throw new AppError(409, 'TABLE_BUSY', 'This table is occupied.');
  if (heldReservation(input.tableId)) throw new AppError(409, 'RESERVED', 'This table is already reserved.');
  let mobile = '';
  if (input.customerMobile?.trim()) {
    const digits = normalizeMobile(input.customerMobile);
    if (!digits) throw new AppError(400, 'MOBILE', 'Enter a valid 10-digit mobile number.');
    mobile = digits;
  }
  let startsAt = new Date().toISOString();
  if (input.startsAt?.trim()) {
    const parsed = new Date(input.startsAt);
    if (Number.isNaN(parsed.getTime())) throw new AppError(400, 'TIME', 'Enter a valid reservation time.');
    startsAt = parsed.toISOString();
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  run(
    `INSERT INTO reservations (id, cafe_id, table_id, customer_name, mobile, covers, starts_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'HELD', ?)`,
    [id, CAFE_ID, input.tableId, cleanName(input.customerName), mobile, input.covers, startsAt, now],
  );
  publish({ type: 'table.updated', tableId: input.tableId });
  return heldReservation(input.tableId)!;
}

export function cancelReservation(id: string) {
  const row = get<{ id: string; table_id: string; status: string }>('SELECT id, table_id, status FROM reservations WHERE id = ? AND cafe_id = ?', [id, CAFE_ID]);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Reservation not found.');
  if (row.status !== 'HELD') throw new AppError(409, 'STATE', 'That reservation is no longer held.');
  run(`UPDATE reservations SET status = 'CANCELLED' WHERE id = ?`, [id]);
  publish({ type: 'table.updated', tableId: row.table_id });
  return listTables().find((entry) => entry.id === row.table_id)!;
}

function listOrdersCreatedBetween(fromIso: string, toIso: string) {
  const rows = all<OrderRow>(
    `${ORDER_SELECT} WHERE o.cafe_id = ? AND o.created_at >= ? AND o.created_at < ? AND o.status != 'DRAFT' ORDER BY o.created_at ASC`,
    [CAFE_ID, fromIso, toIso],
  );
  return hydrate(rows);
}

export function reportRange(fromYmd?: string, toYmd?: string) {
  const catalog = loadCatalog();
  const zone = catalog.cafe.timezone;
  const today = formatZonedYmd(zone);
  let startDay: string;
  let endDay: string;
  try {
    startDay = parseYmd(fromYmd || today);
    endDay = parseYmd(toYmd || fromYmd || today);
  } catch (error) {
    throw new AppError(400, 'RANGE', error instanceof Error ? error.message : 'Invalid date.');
  }
  if (endDay < startDay) throw new AppError(400, 'RANGE', 'End date must be on or after start date.');
  const from = zonedDayStart(zone, startDay);
  const to = zonedDayStart(zone, shiftYmd(endDay, 1));
  const days = Math.round((to.getTime() - from.getTime()) / 86400000);
  if (days > 62) throw new AppError(400, 'RANGE', 'Pick a range of 62 days or less.');
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const orders = listOrdersCreatedBetween(fromIso, toIso);
  const payRows = all<{ method: PaymentMethod; amount: number; status: string; created_at: string; notes: string }>(
    `SELECT p.method, p.amount, p.status, p.created_at, o.notes
     FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE o.cafe_id = ? AND p.created_at >= ? AND p.created_at < ? AND p.status = 'PAID'`,
    [CAFE_ID, fromIso, toIso],
  );
  const categoryByItem = new Map(catalog.items.map((item) => [
    item.id,
    catalog.categories.find((category) => category.id === item.categoryId)?.name ?? 'Other',
  ]));
  return buildSalesReport({
    orders,
    payments: payRows.map((row) => ({
      method: row.method,
      amount: row.amount,
      status: row.status,
      createdAt: row.created_at,
      complimentary: orderFlag(row.notes, 'COMPLIMENTARY'),
    })),
    categoryName: (menuItemId) => (menuItemId ? categoryByItem.get(menuItemId) ?? 'Other' : 'Other'),
    timeZone: zone,
    from: fromIso,
    to: toIso,
    fromYmd: startDay,
    toYmd: endDay,
  });
}

export function reportToday() {
  return reportRange();
}

export function snapshot() {
  const catalog = loadCatalog();
  const folded = tx(() => {
    const tables = all<{ id: string }>('SELECT id FROM tables WHERE cafe_id = ?', [CAFE_ID]);
    const changed: Order[] = [];
    for (const table of tables) {
      const before = unpaidOpenOrdersOnTable(table.id).map((order) => order.id).join(',');
      const combined = foldUnpaidTicketsOnTable(table.id);
      const after = unpaidOpenOrdersOnTable(table.id).map((order) => order.id).join(',');
      if (combined && before !== after) changed.push(combined);
    }
    return changed;
  });
  for (const order of folded) notify(order);
  return {
    cafe: catalog.cafe,
    categories: catalog.categories,
    items: catalog.items,
    addonGroups: catalog.addonGroups,
    tables: listTables(),
    orders: listOrders(),
    customers: listCustomers(),
    payments: { razorpayKeyId: publicRazorpayKey() },
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
          notes: String(payload.notes || ''),
          discount: typeof payload.discount === 'number' ? payload.discount : 0,
          allowOpenTable: Boolean(payload.allowOpenTable),
        });
        results.push({ id: op.id, ok: true, order });
        continue;
      }
      if (op.operation === 'UPDATE_ORDER' || op.operation === 'MARK_PREPARING' || op.operation === 'MARK_READY') {
        let order: Order | undefined;
        if (op.operation === 'UPDATE_ORDER' && Array.isArray(payload.items)) {
          order = replaceStaffOrderItems(op.entityId, {
            customerName: payload.customerName as string | undefined,
            customerMobile: payload.customerMobile as string | undefined,
            items: payload.items as CartLineInput[],
            notes: payload.notes as string | undefined,
            discount: typeof payload.discount === 'number' ? payload.discount : undefined,
          });
        }
        const status = (op.operation === 'MARK_PREPARING' ? 'PREPARING' : op.operation === 'MARK_READY' ? 'READY' : payload.status) as OrderStatus | undefined;
        if (status) order = transitionOrder(op.entityId, status);
        results.push({ id: op.id, ok: true, order: order ?? getOrder(op.entityId) ?? undefined });
        continue;
      }
      if (op.operation === 'MARK_PAID') {
        const order = markPaid(op.entityId, payload.method as PaymentMethod, typeof payload.amount === 'number' ? payload.amount : undefined);
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
          isFavorite: payload.isFavorite as boolean | undefined,
          shortcutNum: payload.shortcutNum as string | null | undefined,
          shortcutAlpha: payload.shortcutAlpha as string | null | undefined,
          menuLead: payload.menuLead as string | undefined,
          menuSubtitle: payload.menuSubtitle as string | undefined,
          kcalLabel: payload.kcalLabel as string | undefined,
          ingredients: payload.ingredients as string[] | undefined,
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
