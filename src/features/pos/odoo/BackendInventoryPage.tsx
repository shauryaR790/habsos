import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatOdooINR, type InventoryItem, type InventoryMovement, type MenuRecipeLine } from '../../../../shared/domain';
import { INGREDIENT_IDS, INGREDIENT_LABELS, INGREDIENT_STOCK, type IngredientId } from '../../../../shared/menuDisplay';
import { api } from '../../../lib/api';
import { useTitle } from '../../../lib/useTitle';
import { pushToast } from '../../../components/Toast';
import { usePos } from '../PosContext';

type Bundle = {
  items: InventoryItem[];
  movements: InventoryMovement[];
  recipes: Array<{ menuItemId: string; inventoryItemId: string; qtyPerPortion: number }>;
  summary: { itemCount: number; lowStockCount: number; stockValue: number; lowStock: InventoryItem[] };
};

function qtyLabel(qty: number, unit: string) {
  const rounded = Math.abs(qty) >= 10 ? qty.toFixed(1).replace(/\.0$/, '') : qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${rounded} ${unit}`;
}

export function BackendInventoryPage() {
  useTitle('Inventory');
  const pos = usePos();
  const [data, setData] = useState<Bundle | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [receiveId, setReceiveId] = useState('');
  const [receiveQty, setReceiveQty] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const bundle = await api<Bundle>('/api/inventory');
      setData(bundle);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load inventory');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = data?.items ?? [];
    if (!needle) return list;
    return list.filter((item) => item.name.toLowerCase().includes(needle) || item.sku.toLowerCase().includes(needle));
  }, [data, query]);

  const recipesByProduct = useMemo(() => {
    const map = new Map<string, MenuRecipeLine[]>();
    for (const line of data?.recipes ?? []) {
      const stock = data?.items.find((item) => item.id === line.inventoryItemId);
      const next = map.get(line.menuItemId) ?? [];
      next.push({
        menuItemId: line.menuItemId,
        inventoryItemId: line.inventoryItemId,
        inventoryItemName: stock?.name,
        unit: stock?.unit,
        qtyPerPortion: line.qtyPerPortion,
      });
      map.set(line.menuItemId, next);
    }
    return map;
  }, [data]);

  async function receive() {
    const qty = Number(receiveQty);
    if (!receiveId || !Number.isFinite(qty) || qty <= 0) {
      pushToast('Pick a stock line and a quantity.', 'err');
      return;
    }
    setBusy(true);
    try {
      await api('/api/inventory/movements', {
        method: 'POST',
        body: JSON.stringify({ itemId: receiveId, kind: 'PURCHASE', qty }),
      });
      setReceiveQty('');
      pushToast('Stock received');
      await load();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not receive stock', 'err');
    } finally {
      setBusy(false);
    }
  }

  const ingredientRows = INGREDIENT_IDS.map((id) => {
    const stockId = INGREDIENT_STOCK[id].stockId;
    const stock = data?.items.find((item) => item.id === stockId);
    const usedBy = pos.items.filter((item) => item.ingredients.includes(id)).length;
    return { id, label: INGREDIENT_LABELS[id], stock, usedBy, portion: INGREDIENT_STOCK[id].portion };
  });

  return (
    <div className="o-stock">
      <header className="o-track__head">
        <div>
          <h2>Inventory</h2>
          <p>Stock on hand, and the ingredients each product takes when it is sold.</p>
        </div>
        <label className="o-search">
          <span>⌕</span>
          <input placeholder="Search stock..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </header>

      {error ? <p className="o-track__error">{error}</p> : null}

      <section className="o-track__kpis">
        <article><span>Stock lines</span><strong>{data?.summary.itemCount ?? '—'}</strong></article>
        <article><span>Low stock</span><strong>{data?.summary.lowStockCount ?? '—'}</strong></article>
        <article><span>Stock value</span><strong>{data ? formatOdooINR(data.summary.stockValue) : '—'}</strong></article>
        <article><span>Products linked</span><strong>{recipesByProduct.size}</strong></article>
      </section>

      <div className="o-track__grid">
        <section className="o-track__card o-stock__wide">
          <h3>On hand</h3>
          <table className="o-track__table o-track__table--wide">
            <thead>
              <tr><th>Item</th><th>SKU</th><th>On hand</th><th>Reorder</th><th>Cost</th><th>Supplier</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={item.lowStock ? 'is-low' : ''}>
                  <td>{item.name}</td>
                  <td>{item.sku}</td>
                  <td>{qtyLabel(item.qty, item.unit)}</td>
                  <td>{qtyLabel(item.reorderLevel, item.unit)}</td>
                  <td>{formatOdooINR(item.costPerUnit)}</td>
                  <td>{item.supplier || '—'}</td>
                </tr>
              ))}
              {!items.length ? <tr><td colSpan={6}>{error ? 'Inventory is unavailable.' : 'No stock lines yet.'}</td></tr> : null}
            </tbody>
          </table>
          <form
            className="o-stock__receive"
            onSubmit={(event) => {
              event.preventDefault();
              void receive();
            }}
          >
            <span>Receive</span>
            <select value={receiveId} onChange={(event) => setReceiveId(event.target.value)} aria-label="Stock item">
              <option value="">Stock item</option>
              {(data?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input
              value={receiveQty}
              inputMode="decimal"
              placeholder="Qty"
              aria-label="Quantity received"
              onChange={(event) => setReceiveQty(event.target.value)}
            />
            <button type="submit" className="o-btn o-btn--primary" disabled={busy}>Add</button>
          </form>
        </section>

        <section className="o-track__card">
          <h3>Ingredients</h3>
          <table className="o-track__table">
            <thead><tr><th>Ingredient</th><th>On hand</th><th>Products</th></tr></thead>
            <tbody>
              {ingredientRows.map((row) => (
                <tr key={row.id} className={row.stock?.lowStock ? 'is-low' : ''}>
                  <td>{row.label}</td>
                  <td>{row.stock ? qtyLabel(row.stock.qty, row.stock.unit) : '—'}</td>
                  <td>{row.usedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="o-track__grid">
        <section className="o-track__card">
          <h3>Products</h3>
          <table className="o-track__table o-track__table--wide">
            <thead><tr><th>Product</th><th>Ingredients</th><th>Per sale</th></tr></thead>
            <tbody>
              {pos.items.filter((item) => item.isAvailable).map((item) => {
                const lines = recipesByProduct.get(item.id) ?? [];
                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.ingredients.map((id) => ((INGREDIENT_IDS as readonly string[]).includes(id) ? INGREDIENT_LABELS[id as IngredientId] : id)).join(', ') || '—'}</td>
                    <td>{lines.map((line) => `${line.inventoryItemName ?? 'Stock'} ${qtyLabel(line.qtyPerPortion, line.unit ?? '')}`).join(' · ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="o-track__card">
          <h3>Movements</h3>
          <table className="o-track__table">
            <thead><tr><th>When</th><th>Item</th><th>Kind</th><th>Qty</th></tr></thead>
            <tbody>
              {(data?.movements ?? []).slice(0, 14).map((move) => (
                <tr key={move.id}>
                  <td>{new Date(move.createdAt).toLocaleString()}</td>
                  <td>{move.itemName}</td>
                  <td>{move.kind}</td>
                  <td>{move.qtyDelta > 0 ? '+' : ''}{move.qtyDelta}</td>
                </tr>
              ))}
              {!data?.movements.length ? <tr><td colSpan={4}>No movements yet. A paid order draws recipe ingredients.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
