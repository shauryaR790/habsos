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
  CONFIRMED: ['READY', 'CANCELLED'],
  ACCEPTED: ['READY', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
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
  sortOrder: number;
  addonGroupIds: string[];
};

export type CartLineInput = {
  menuItemId: string;
  quantity: number;
  addonIds: string[];
  notes?: string;
};

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
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
      throw new PriceError('Quantity must be between 1 and 20.');
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
    const notes = (line.notes ?? '').trim().slice(0, 180);
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

export function startOfZonedDay(timeZone: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  const utcGuess = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const zoned = new Date(utcGuess.toLocaleString('en-US', { timeZone }));
  return new Date(utcGuess.getTime() + (utcGuess.getTime() - zoned.getTime()));
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

export type TableInfo = {
  id: string;
  name: string;
  qrCode: string;
  status: TableStatus;
  openOrder: {
    id: string;
    orderNumber: number;
    customerName: string;
    total: number;
    paymentStatus: PaymentStatus;
    status: OrderStatus;
  } | null;
};

export type CustomerSummary = {
  id: string;
  name: string;
  mobile: string;
  orderCount: number;
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
  status: OrderStatus;
  paymentStatus: PaymentStatus;
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
    status: order.status,
    paymentStatus: order.paymentStatus,
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
