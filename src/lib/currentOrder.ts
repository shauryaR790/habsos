const KEY = 'habsos.currentOrder';

export type CurrentOrderRef = {
  tableId: string | null;
  orderId: string | null;
  mode: 'dine' | 'pickup' | 'delivery';
  name?: string;
  label?: string;
  floor?: string;
};

export function writeCurrentOrder(value: CurrentOrderRef) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

export function readCurrentOrder(): CurrentOrderRef | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as CurrentOrderRef;
    if (!value || (value.mode !== 'dine' && value.mode !== 'pickup' && value.mode !== 'delivery')) return null;
    return value;
  } catch {
    return null;
  }
}

export function clearCurrentOrder() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

/** Build the FoH register URL for the ticket currently in progress. */
export function registerHrefFromCurrent(fallback = '/pos/app/register') {
  const current = readCurrentOrder();
  if (!current?.tableId && !current?.orderId) return fallback;
  const qs = new URLSearchParams();
  qs.set('mode', current.mode === 'pickup' ? 'takeout' : current.mode === 'delivery' ? 'delivery' : 'dine');
  if (current.tableId) qs.set('table', current.tableId);
  if (current.orderId) qs.set('order', current.orderId);
  if (current.name) qs.set('name', current.name);
  if (current.label) qs.set('label', current.label);
  if (current.floor) qs.set('floor', current.floor);
  return `/pos/app/register?${qs.toString()}`;
}
