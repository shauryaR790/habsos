export const ORDER_STATUSES = [
  'DRAFT',
  'OTP_PENDING',
  'CONFIRMED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'SERVED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['UNPAID', 'PAID', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TABLE_STATUSES = ['AVAILABLE', 'OCCUPIED'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const ORDER_SOURCES = ['QR', 'POS'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const OTP_STATES = ['OTP_PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'] as const;
export type OtpState = (typeof OTP_STATES)[number];

export const SYNC_OPERATIONS = [
  'CREATE_ORDER',
  'UPDATE_ORDER',
  'MARK_PREPARING',
  'MARK_READY',
  'MARK_PAID',
  'UPDATE_MENU',
  'UPDATE_ADDON',
  'UPDATE_TABLE',
  'OPEN_SESSION',
  'CLOSE_SESSION',
  'CASH_MOVE',
  'SEND_LINES',
  'UPSERT_FLOOR',
] as const;

export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

export const OPEN_STATUSES: OrderStatus[] = ['CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'];

export const BOARD_COLUMNS = [
  { id: 'NEW', title: 'New', statuses: ['CONFIRMED', 'ACCEPTED', 'PREPARING'] as OrderStatus[] },
  { id: 'READY', title: 'Ready', statuses: ['READY'] as OrderStatus[] },
] as const;

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['OTP_PENDING', 'CANCELLED'],
  OTP_PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['READY', 'SERVED', 'CANCELLED'],
  ACCEPTED: ['READY', 'SERVED', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextTicketStatus(from: OrderStatus, action: 'kot' | 'print'): OrderStatus | null {
  const to = action === 'kot' ? 'READY' : 'SERVED';
  return canTransition(from, to) ? to : null;
}

export function orderFlag(notes: string, flag: 'HOLD' | 'COMPLIMENTARY' | 'DUE') {
  return notes.split(/\n/).some((line) => line.trim() === flag);
}

export function paidTotal(order: { payments: Array<{ amount: number; status: string }> }) {
  return order.payments.filter((payment) => payment.status === 'PAID').reduce((sum, payment) => sum + payment.amount, 0);
}

export function dueTotal(order: { total: number; payments: Array<{ amount: number; status: string }> }) {
  return Math.max(0, order.total - paidTotal(order));
}

export function splitAmounts(total: number, parts: number) {
  const count = Math.round(parts);
  if (!Number.isInteger(count) || count < 2 || count > 8) {
    throw new Error('Split into 2–8 bills.');
  }
  if (!Number.isInteger(total) || total < 1) {
    throw new Error('Nothing to split.');
  }
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
}

export function statusMessage(status: OrderStatus): string {
  switch (status) {
    case 'CONFIRMED':
      return 'Order placed';
    case 'ACCEPTED':
      return 'Accepted';
    case 'PREPARING':
      return 'Preparing';
    case 'READY':
      return 'Ready';
    case 'SERVED':
      return 'Served';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'OTP_PENDING':
      return 'Waiting for verification';
    default:
      return status;
  }
}

export type Addon = {
  id: string;
  groupId: string;
  name: string;
  price: number;
  isAvailable: boolean;
  sortOrder: number;
};

export type AddonGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  addons: Addon[];
};

export type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  isAvailable: boolean;
  isFavorite: boolean;
  shortcutNum: string | null;
  shortcutAlpha: string | null;
  sortOrder: number;
  addonGroupIds: string[];
  menuLead: string;
  menuSubtitle: string;
  kcalLabel: string;
  ingredients: string[];
};

export const DRINKS_CATEGORY_ID = 'cat_drinks';
export const DRINK_ADDON_GROUP_IDS = ['group_size', 'group_milk', 'group_extras'] as const;

export function defaultAddonGroupsForCategory(categoryId: string) {
  return categoryId === DRINKS_CATEGORY_ID ? [...DRINK_ADDON_GROUP_IDS] : [];
}

export function itemInitials(name: string) {
  return name
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export function normalizeShortcut(value: string) {
  return value.trim().toUpperCase().replace(/[\s./_-]+/g, '');
}

export function resolveMenuShortcut(items: MenuItem[], code: string): MenuItem | undefined {
  const needle = normalizeShortcut(code);
  if (!needle) return undefined;
  const available = items.filter((item) => item.isAvailable);
  const coded = available.find((item) => item.shortcutNum === needle || item.shortcutAlpha === needle);
  if (coded) return coded;
  const byInitials = available.filter((item) => itemInitials(item.name) === needle);
  return byInitials.length === 1 ? byInitials[0] : undefined;
}

export type CartLineInput = {
  menuItemId: string;
  quantity: number;
  addonIds: string[];
  notes?: string;
};

export const LINE_QTY_MIN = 1;
export const LINE_QTY_MAX = 20;
export const LINE_NOTE_MAX = 180;

export function clampLineQuantity(value: number) {
  if (!Number.isFinite(value)) return LINE_QTY_MIN;
  return Math.min(LINE_QTY_MAX, Math.max(LINE_QTY_MIN, Math.round(value)));
}

export function cartLineKey(line: { menuItemId: string; addonIds: string[]; notes?: string }) {
  return `${line.menuItemId}|${[...line.addonIds].sort().join(',')}|${(line.notes ?? '').trim()}`;
}

export function applyLineQuantity(current: number, delta: number) {
  const raw = current + delta;
  if (raw < LINE_QTY_MIN) return { quantity: 0, capped: false };
  if (raw > LINE_QTY_MAX) return { quantity: LINE_QTY_MAX, capped: true };
  return { quantity: raw, capped: false };
}

export type PricedAddon = {
  addonId: string;
  name: string;
  price: number;
};

export type PricedLine = {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  addons: PricedAddon[];
  total: number;
};

export type PriceQuote = {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

export class PriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriceError';
  }
}

export function computeTotals(subtotal: number, taxBps: number, discount = 0) {
  const safeDiscount = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const taxable = subtotal - safeDiscount;
  const tax = Math.round((taxable * taxBps) / 10000);
  return { subtotal, discount: safeDiscount, tax, total: taxable + tax };
}

export function priceCart(input: {
  lines: CartLineInput[];
  items: MenuItem[];
  groups: AddonGroup[];
  taxBps: number;
  discount?: number;
}): PriceQuote {
  if (!input.lines.length) throw new PriceError('Add at least one item.');
  if (input.lines.length > 30) throw new PriceError('Too many lines in one order.');

  const itemById = new Map(input.items.map((item) => [item.id, item]));
  const groupById = new Map(input.groups.map((group) => [group.id, group]));
  const lines: PricedLine[] = [];

  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < LINE_QTY_MIN || line.quantity > LINE_QTY_MAX) {
      throw new PriceError(`Quantity must be between ${LINE_QTY_MIN} and ${LINE_QTY_MAX}.`);
    }
    const item = itemById.get(line.menuItemId);
    if (!item) throw new PriceError('An item in the cart is no longer on the menu.');
    if (!item.isAvailable) throw new PriceError(`${item.name} is sold out.`);

    const addonIds = line.addonIds ?? [];
    if (new Set(addonIds).size !== addonIds.length) throw new PriceError('Duplicate add-ons are not allowed.');

    const linked = item.addonGroupIds
      .map((id) => groupById.get(id))
      .filter((group): group is AddonGroup => Boolean(group));
    const allowed = new Map<string, { addon: Addon; group: AddonGroup }>();
    for (const group of linked) {
      for (const addon of group.addons) allowed.set(addon.id, { addon, group });
    }

    const chosen: PricedAddon[] = [];
    for (const addonId of addonIds) {
      const found = allowed.get(addonId);
      if (!found) throw new PriceError(`That add-on is not available on ${item.name}.`);
      if (!found.addon.isAvailable) throw new PriceError(`${found.addon.name} is sold out.`);
      chosen.push({ addonId: found.addon.id, name: found.addon.name, price: found.addon.price });
    }

    for (const group of linked) {
      const count = chosen.filter((addon) => group.addons.some((candidate) => candidate.id === addon.addonId)).length;
      if (count < group.minSelect || count > group.maxSelect) {
        throw new PriceError(
          count > group.maxSelect
            ? `Choose at most ${group.maxSelect} in ${group.name}.`
            : `Choose at least ${group.minSelect} in ${group.name}.`,
        );
      }
    }

    const addonSum = chosen.reduce((sum, addon) => sum + addon.price, 0);
    const notes = (line.notes ?? '').trim().slice(0, LINE_NOTE_MAX);
    lines.push({
      menuItemId: item.id,
      name: item.name,
      unitPrice: item.price,
      quantity: line.quantity,
      notes,
      addons: chosen,
      total: (item.price + addonSum) * line.quantity,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  return { lines, ...computeTotals(subtotal, input.taxBps, input.discount ?? 0) };
}

export function normalizeMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function maskMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length < 4) return 'Hidden';
  return `${'X'.repeat(digits.length - 3)}${digits.slice(-3)}`;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Odoo-style money with two decimals: ₹ 38.80 */
export function formatOdooINR(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type PosSessionStatus = 'OPEN' | 'CLOSING' | 'CLOSED';

export type PosConfig = {
  id: string;
  name: string;
  isRestaurant: boolean;
};

export type PosSession = {
  id: string;
  configId: string;
  configName: string;
  /** Per-register sequence used in Odoo-style Session ID (e.g. Restaurant/00002). */
  sequence: number;
  status: PosSessionStatus;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  openingCash: number;
  closingCash: number | null;
  countedCash: number | null;
  notes: string;
};

export type PosSessionStats = {
  openingCash: number;
  soldTotal: number;
  soldOrders: number;
  ongoingTotal: number;
  ongoingOrders: number;
  /** Cumulative sold totals across the open session (oldest → newest). */
  salesSeries: number[];
};

export type PosCashMove = {
  id: string;
  sessionId: string;
  kind: 'IN' | 'OUT';
  amount: number;
  reason: string;
  createdAt: string;
  actor: string;
};

export type FloorPlan = {
  id: string;
  name: string;
  sortOrder: number;
  background: string;
};

export type TableGeometry = {
  tableId: string;
  floorId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  seats: number;
  shape: 'square' | 'round' | 'rect';
  color: string;
};

export function formatTime(iso: string, timeZone = 'Asia/Kolkata'): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

export function formatWhen(iso: string, timeZone = 'Asia/Kolkata', now = new Date()): string {
  const date = new Date(iso);
  const sameDay = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    === new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (sameDay) return formatTime(iso, timeZone);
  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone })} · ${formatTime(iso, timeZone)}`;
}

export function formatAge(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function zonedOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'));
  return asUtc - date.getTime();
}

export function startOfZonedDay(timeZone: string, now = new Date()): Date {
  return zonedDayStart(timeZone, formatZonedYmd(timeZone, now));
}

export type OrderItemAddon = {
  id: string;
  addonId: string | null;
  nameSnapshot: string;
  priceSnapshot: number;
};

export type OrderItem = {
  id: string;
  menuItemId: string | null;
  nameSnapshot: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes: string;
  addons: OrderItemAddon[];
};

export type OrderEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actor: string;
};

export type Payment = {
  id: string;
  method: PaymentMethod;
  amount: number;
  status: string;
  createdAt: string;
};

export type Order = {
  id: string;
  orderNumber: number;
  cafeId: string;
  tableId: string | null;
  tableName: string | null;
  customerId: string | null;
  customerName: string;
  customerMobile: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  source: OrderSource;
  notes: string;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
  items: OrderItem[];
  events: OrderEvent[];
  payments: Payment[];
};

export const TABLE_AREAS = [
  'Ground Floor',
  'Basement',
  'Party Hall',
  'Terrace',
  'Rooftop',
  'Lounge',
] as const;
export type TableArea = (typeof TABLE_AREAS)[number];

export type TableVisualState = 'blank' | 'running' | 'printed' | 'paid' | 'running-kot' | 'reserved' | 'otp-wait';

export type TableReservation = {
  id: string;
  tableId: string;
  customerName: string;
  mobile: string;
  covers: number;
  startsAt: string;
};

export type TableInfo = {
  id: string;
  name: string;
  qrCode: string;
  status: TableStatus;
  area: string;
  openOrder: {
    id: string;
    orderNumber: number;
    customerName: string;
    total: number;
    paymentStatus: PaymentStatus;
    status: OrderStatus;
    createdAt: string;
    due: number;
  } | null;
  reservation: TableReservation | null;
};

export function tableLabel(name: string) {
  const match = /^T(\d+)$/i.exec(name.trim());
  if (match) return String(Number(match[1]));
  return name;
}

export function tableVisualState(table: TableInfo): TableVisualState {
  const open = table.openOrder;
  if (!open) return table.reservation ? 'reserved' : 'blank';
  if (open.status === 'OTP_PENDING') return 'otp-wait';
  if (open.paymentStatus === 'PAID') return 'paid';
  if (open.status === 'SERVED') return 'printed';
  if (open.status === 'READY' || open.status === 'PREPARING') return 'running-kot';
  return 'running';
}

export function registerPath(input: {
  tableId?: string | null;
  orderId?: string | null;
  mode?: 'dine' | 'pickup' | 'delivery';
  customerName?: string | null;
  customerMobile?: string | null;
  covers?: string | number | null;
}) {
  const params = new URLSearchParams();
  const mode = input.mode ?? (input.tableId ? 'dine' : 'pickup');
  params.set('mode', mode);
  if (input.tableId) params.set('table', input.tableId);
  if (input.orderId) params.set('order', input.orderId);
  if (input.customerName) params.set('name', input.customerName);
  if (input.customerMobile) params.set('mobile', input.customerMobile);
  if (input.covers !== undefined && input.covers !== null && String(input.covers) !== '') params.set('covers', String(input.covers));
  return `/pos/app/register?${params.toString()}`;
}

export type GuestPaymentPreference = 'DESK' | 'UPI' | 'CARD';

export function paymentPreferenceFromNotes(notes: string): GuestPaymentPreference {
  const raw = noteValue(notes, 'PAY_PREF').toUpperCase();
  if (raw === 'UPI' || raw === 'CARD') return raw;
  return 'DESK';
}

export function noteValue(notes: string, key: string) {
  const prefix = `${key}:`;
  for (const line of notes.split(/\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return '';
}

export type OrderChannel = 'dine' | 'pickup' | 'delivery';

export function orderChannel(order: { tableId: string | null; notes: string }): OrderChannel {
  const mode = noteValue(order.notes, 'MODE').toUpperCase();
  if (mode === 'DELIVERY') return 'delivery';
  if (mode === 'PICKUP') return 'pickup';
  if (mode === 'DINE') return 'dine';
  return order.tableId ? 'dine' : 'pickup';
}

export function formatZonedYmd(timeZone: string, date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function parseYmd(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use YYYY-MM-DD dates.');
  const [year, month, day] = value.split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error('Invalid date.');
  }
  return value;
}

export function shiftYmd(ymd: string, days: number): string {
  const [year, month, day] = parseYmd(ymd).split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function zonedDayStart(timeZone: string, ymd: string): Date {
  const [year, month, day] = parseYmd(ymd).split('-').map(Number);
  const wall = Date.UTC(year, month - 1, day, 0, 0, 0);
  let utc = wall;
  for (let i = 0; i < 3; i += 1) {
    utc = wall - zonedOffsetMs(new Date(utc), timeZone);
  }
  return new Date(utc);
}

export function zonedHour(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  return Number.isFinite(hour) ? hour : 0;
}

function isSplitCancel(notes: string) {
  return notes.split(/\n/).some((line) => {
    const trimmed = line.trim();
    return trimmed === 'SPLIT' || trimmed.startsWith('SPLIT:');
  });
}

export type SalesNamed = { name: string; qty: number; amount: number };
export type SalesHour = { hour: number; bills: number; amount: number };
export type SalesTicket = {
  id: string;
  orderNumber: number;
  tableName: string | null;
  customerName: string;
  channel: OrderChannel;
  source: OrderSource;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  due: number;
  createdAt: string;
  complimentary: boolean;
  cancelled: boolean;
  items: Array<{ name: string; qty: number; amount: number }>;
};

export type SalesReport = {
  from: string;
  to: string;
  fromYmd: string;
  toYmd: string;
  bills: number;
  cancelled: number;
  complimentary: number;
  gross: number;
  discount: number;
  tax: number;
  net: number;
  averageTicket: number;
  due: number;
  collected: number;
  ncAmount: number;
  byMethod: Record<PaymentMethod, number>;
  byChannel: Record<OrderChannel, { bills: number; amount: number }>;
  bySource: Record<OrderSource, { bills: number; amount: number }>;
  hours: SalesHour[];
  items: SalesNamed[];
  categories: SalesNamed[];
  tickets: SalesTicket[];
};

function bumpNamed(map: Map<string, SalesNamed>, name: string, qty: number, amount: number) {
  const current = map.get(name) ?? { name, qty: 0, amount: 0 };
  current.qty += qty;
  current.amount += amount;
  map.set(name, current);
}

function sortNamed(map: Map<string, SalesNamed>) {
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

export function buildSalesReport(input: {
  orders: Order[];
  payments?: Array<{ method: PaymentMethod; amount: number; status: string; createdAt: string; complimentary?: boolean }>;
  categoryName: (menuItemId: string | null) => string;
  timeZone: string;
  from: string;
  to: string;
  fromYmd: string;
  toYmd: string;
}): SalesReport {
  const byMethod: Record<PaymentMethod, number> = { CASH: 0, UPI: 0, CARD: 0, OTHER: 0 };
  const byChannel: Record<OrderChannel, { bills: number; amount: number }> = {
    dine: { bills: 0, amount: 0 },
    pickup: { bills: 0, amount: 0 },
    delivery: { bills: 0, amount: 0 },
  };
  const bySource: Record<OrderSource, { bills: number; amount: number }> = {
    POS: { bills: 0, amount: 0 },
    QR: { bills: 0, amount: 0 },
  };
  const hours: SalesHour[] = Array.from({ length: 24 }, (_, hour) => ({ hour, bills: 0, amount: 0 }));
  const items = new Map<string, SalesNamed>();
  const categories = new Map<string, SalesNamed>();
  const tickets: SalesTicket[] = [];
  let bills = 0;
  let cancelled = 0;
  let complimentary = 0;
  let gross = 0;
  let discount = 0;
  let tax = 0;
  let net = 0;
  let due = 0;
  let ncAmount = 0;

  for (const order of input.orders) {
    if (order.status === 'DRAFT' || order.status === 'OTP_PENDING') continue;
    const splitOff = order.status === 'CANCELLED' && isSplitCancel(order.notes);
    if (splitOff) continue;
    const cancelledBill = order.status === 'CANCELLED';
    const complimentaryBill = orderFlag(order.notes, 'COMPLIMENTARY');
    const channel = orderChannel(order);
    const ticket: SalesTicket = {
      id: order.id,
      orderNumber: order.orderNumber,
      tableName: order.tableName,
      customerName: order.customerName,
      channel,
      source: order.source,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      due: dueTotal(order),
      createdAt: order.createdAt,
      complimentary: complimentaryBill,
      cancelled: cancelledBill,
      items: order.items.map((item) => ({ name: item.nameSnapshot, qty: item.quantity, amount: item.total })),
    };
    tickets.push(ticket);
    if (cancelledBill) {
      cancelled += 1;
      continue;
    }
    bills += 1;
    byChannel[channel].bills += 1;
    bySource[order.source].bills += 1;
    const hour = hours[zonedHour(order.createdAt, input.timeZone)];
    if (hour) hour.bills += 1;
    for (const item of order.items) {
      bumpNamed(items, item.nameSnapshot, item.quantity, item.total);
      bumpNamed(categories, input.categoryName(item.menuItemId), item.quantity, item.total);
    }
    if (complimentaryBill) {
      complimentary += 1;
      ncAmount += order.total;
      continue;
    }
    gross += order.subtotal;
    discount += order.discount;
    tax += order.tax;
    net += order.total;
    due += dueTotal(order);
    byChannel[channel].amount += order.total;
    bySource[order.source].amount += order.total;
    if (hour) hour.amount += order.total;
  }

  const payRows = input.payments ?? input.orders.flatMap((order) => (
    order.payments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      status: payment.status,
      createdAt: payment.createdAt,
      complimentary: orderFlag(order.notes, 'COMPLIMENTARY'),
    }))
  ));
  let collected = 0;
  for (const payment of payRows) {
    if (payment.status !== 'PAID') continue;
    if (payment.createdAt < input.from || payment.createdAt >= input.to) continue;
    if (payment.complimentary) continue;
    if (!PAYMENT_METHODS.includes(payment.method)) continue;
    byMethod[payment.method] += payment.amount;
    collected += payment.amount;
  }

  tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    from: input.from,
    to: input.to,
    fromYmd: input.fromYmd,
    toYmd: input.toYmd,
    bills,
    cancelled,
    complimentary,
    gross,
    discount,
    tax,
    net,
    averageTicket: bills - complimentary > 0 ? Math.round(net / (bills - complimentary)) : 0,
    due,
    collected,
    ncAmount,
    byMethod,
    byChannel,
    bySource,
    hours,
    items: sortNamed(items),
    categories: sortNamed(categories),
    tickets,
  };
}

export type CustomerSummary = {
  id: string;
  name: string;
  mobile: string;
  orderCount: number;
  spent: number;
  lastOrderAt: string | null;
};

export type CafeSettings = {
  id: string;
  name: string;
  taxBps: number;
  timezone: string;
};

export type PublicOrder = {
  id: string;
  orderNumber: number;
  tableName: string | null;
  customerName: string;
  customerMobile?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentPreference: GuestPaymentPreference;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
  events: OrderEvent[];
};

export function toPublicOrder(order: Order): PublicOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    tableName: order.tableName,
    customerName: order.customerName,
    customerMobile: order.customerMobile || undefined,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentPreference: paymentPreferenceFromNotes(order.notes),
    subtotal: order.subtotal,
    tax: order.tax,
    discount: order.discount,
    total: order.total,
    createdAt: order.createdAt,
    items: order.items,
    events: order.events,
  };
}

export function taxLabel(taxBps: number): string {
  const percent = taxBps / 100;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2)}%`;
}

export const INVENTORY_MOVEMENT_KINDS = ['PURCHASE', 'WASTAGE', 'ADJUSTMENT', 'SALE', 'RETURN'] as const;
export type InventoryMovementKind = (typeof INVENTORY_MOVEMENT_KINDS)[number];

export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  qty: number;
  reorderLevel: number;
  costPerUnit: number;
  supplier: string;
  isActive: boolean;
  updatedAt: string;
  lowStock: boolean;
};

export type InventoryMovement = {
  id: string;
  itemId: string;
  itemName: string;
  kind: InventoryMovementKind;
  qtyDelta: number;
  unitCost: number;
  reference: string;
  notes: string;
  supplier: string;
  createdAt: string;
  actor: string;
};

export type MenuRecipeLine = {
  menuItemId: string;
  inventoryItemId: string;
  inventoryItemName?: string;
  unit?: string;
  qtyPerPortion: number;
};
