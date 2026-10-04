import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  computeTotals,
  priceCart,
  PriceError,
  type AddonGroup,
  type CafeSettings,
  type MenuCategory,
  type MenuItem,
} from '../../../shared/domain';

export type Bootstrap = {
  cafe: CafeSettings;
  table: { id: string; name: string; status: string } | null;
  categories: MenuCategory[];
  items: MenuItem[];
  addonGroups: AddonGroup[];
};

export type CartLine = {
  lineId: string;
  menuItemId: string;
  quantity: number;
  addonIds: string[];
  notes: string;
};

type Stored = { tableCode: string | null; lines: CartLine[] };

const KEY = 'habsos.cart.v1';

function loadStored(): Stored {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { tableCode: null, lines: [] };
    const parsed = JSON.parse(raw) as Stored;
    return { tableCode: parsed.tableCode ?? null, lines: Array.isArray(parsed.lines) ? parsed.lines : [] };
  } catch {
    return { tableCode: null, lines: [] };
  }
}

function sameSelection(line: CartLine, addonIds: string[], notes: string) {
  return line.notes.trim() === notes.trim() && line.addonIds.slice().sort().join(',') === addonIds.slice().sort().join(',');
}

type CartContextValue = {
  catalog: Bootstrap | null;
  setCatalog: (catalog: Bootstrap | null | ((current: Bootstrap | null) => Bootstrap | null)) => void;
  tableCode: string | null;
  setTableCode: (code: string) => void;
  lines: CartLine[];
  count: number;
  quoteError: string | null;
  totals: { subtotal: number; tax: number; discount: number; total: number } | null;
  lineViews: Array<CartLine & { name: string; total: number | null; addons: { name: string; price: number }[]; error?: string }>;
  addLine: (input: Omit<CartLine, 'lineId'> & { lineId?: string }) => void;
  updateLine: (lineId: string, input: Omit<CartLine, 'lineId'>) => void;
  setQty: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const stored = loadStored();
  const [catalog, setCatalog] = useState<Bootstrap | null>(null);
  const [tableCode, setTableCodeState] = useState<string | null>(stored.tableCode);
  const [lines, setLines] = useState<CartLine[]>(stored.lines);

  useEffect(() => {
    sessionStorage.setItem(KEY, JSON.stringify({ tableCode, lines }));
  }, [tableCode, lines]);

  const derived = useMemo(() => {
    const views = lines.map((line) => {
      const item = catalog?.items.find((entry) => entry.id === line.menuItemId);
      if (!catalog || !item) {
        return { ...line, name: item?.name ?? 'Item', total: null, addons: [] as { name: string; price: number }[], error: catalog ? 'This item is no longer on the menu.' : undefined };
      }
      try {
        const priced = priceCart({
          lines: [{ menuItemId: line.menuItemId, quantity: line.quantity, addonIds: line.addonIds, notes: line.notes }],
          items: catalog.items,
          groups: catalog.addonGroups,
          taxBps: catalog.cafe.taxBps,
        }).lines[0];
        return { ...line, name: priced.name, total: priced.total, addons: priced.addons.map((addon) => ({ name: addon.name, price: addon.price })), error: undefined as string | undefined };
      } catch (error) {
        return {
          ...line,
          name: item.name,
          total: null,
          addons: line.addonIds.map((id) => ({ name: catalog.addonGroups.flatMap((group) => group.addons).find((addon) => addon.id === id)?.name ?? 'Add-on', price: 0 })),
          error: error instanceof PriceError ? error.message : 'This item needs a change.',
        };
      }
    });
    const quoteError = views.find((line) => line.error)?.error ?? null;
    let totals: CartContextValue['totals'] = null;
    if (catalog && lines.length && !quoteError) {
      try {
        const quote = priceCart({
          lines: lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity, addonIds: line.addonIds, notes: line.notes })),
          items: catalog.items,
          groups: catalog.addonGroups,
          taxBps: catalog.cafe.taxBps,
        });
        totals = computeTotals(quote.subtotal, catalog.cafe.taxBps, quote.discount);
      } catch (error) {
        return { views, totals: null, quoteError: error instanceof PriceError ? error.message : 'Cart needs a change.' };
      }
    }
    return { views, totals, quoteError };
  }, [catalog, lines]);

  const setCatalogValue = useCallback((next: Bootstrap | null | ((current: Bootstrap | null) => Bootstrap | null)) => {
    setCatalog((current) => (typeof next === 'function' ? next(current) : next));
  }, []);
  const setTableCode = useCallback((code: string) => setTableCodeState(code.trim().toUpperCase()), []);
  const addLine = useCallback((input: Omit<CartLine, 'lineId'> & { lineId?: string }) => {
    setLines((current) => {
      if (input.lineId) {
        return current.map((line) => (line.lineId === input.lineId ? { ...line, ...input, lineId: line.lineId } : line));
      }
      const match = current.find((line) => line.menuItemId === input.menuItemId && sameSelection(line, input.addonIds, input.notes));
      if (match) {
        return current.map((line) => (line.lineId === match.lineId ? { ...line, quantity: Math.min(20, line.quantity + input.quantity) } : line));
      }
      return [...current, { ...input, lineId: crypto.randomUUID() }];
    });
  }, []);
  const updateLine = useCallback((lineId: string, input: Omit<CartLine, 'lineId'>) => {
    setLines((current) => current.map((line) => (line.lineId === lineId ? { ...input, lineId } : line)));
  }, []);
  const setQty = useCallback((lineId: string, quantity: number) => {
    setLines((current) => current.flatMap((line) => {
      if (line.lineId !== lineId) return [line];
      if (quantity <= 0) return [];
      return [{ ...line, quantity: Math.min(20, quantity) }];
    }));
  }, []);
  const removeLine = useCallback((lineId: string) => setLines((current) => current.filter((line) => line.lineId !== lineId)), []);
  const clear = useCallback(() => setLines([]), []);

  const value: CartContextValue = {
    catalog,
    setCatalog: setCatalogValue,
    tableCode,
    setTableCode,
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    quoteError: derived.quoteError,
    totals: derived.totals,
    lineViews: derived.views,
    addLine,
    updateLine,
    setQty,
    removeLine,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('Cart is unavailable.');
  return value;
}
