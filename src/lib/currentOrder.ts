const KEY = 'habsos.currentOrder';

export type CurrentOrderRef = {
  tableId: string | null;
  orderId: string | null;
  mode: 'dine' | 'pickup' | 'delivery';
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
