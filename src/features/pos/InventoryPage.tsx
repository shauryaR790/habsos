import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatINR,
  formatWhen,
  type InventoryItem,
  type InventoryMovement,
  type InventoryMovementKind,
  type MenuRecipeLine,
} from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { pushToast } from '../../components/Toast';
import { usePos } from './PosContext';

type Tab = 'stock' | 'purchase' | 'wastage' | 'adjust' | 'recipes' | 'ledger';

type Bundle = {
  items: InventoryItem[];
  movements: InventoryMovement[];
  summary: { itemCount: number; lowStockCount: number; stockValue: number; lowStock: InventoryItem[] };
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'stock', label: 'Stock' },
  { id: 'purchase', label: 'Purchase' },
  { id: 'wastage', label: 'Wastage' },
  { id: 'adjust', label: 'Adjustment' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'ledger', label: 'Ledger' },
];

function fmtQty(qty: number, unit: string) {
  const rounded = Math.abs(qty) >= 10 ? qty.toFixed(1).replace(/\.0$/, '') : qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${rounded} ${unit}`;
}

export function InventoryPage() {
  useTitle('Inventory');
  const pos = usePos();
  const [tab, setTab] = useState<Tab>('stock');
  const [data, setData] = useState<Bundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [addItem, setAddItem] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);

  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newUnit, setNewUnit] = useState<'kg' | 'g' | 'l' | 'ml' | 'pcs'>('kg');
  const [newQty, setNewQty] = useState('');
  const [newReorder, setNewReorder] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newSupplier, setNewSupplier] = useState('');

  const [moveItemId, setMoveItemId] = useState('');
  const [moveQty, setMoveQty] = useState('');
  const [moveCost, setMoveCost] = useState('');
  const [moveSupplier, setMoveSupplier] = useState('');
  const [moveNotes, setMoveNotes] = useState('');
  const [adjustSigned, setAdjustSigned] = useState<'+' | '-'>('+');

  const [recipeMenuId, setRecipeMenuId] = useState('');
  const [recipeLines, setRecipeLines] = useState<MenuRecipeLine[]>([]);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (pos.conn === 'OFFLINE') {
      setLoadError('Go online to manage stock.');
      return false;
    }
    setLoadError(null);
    try {
      const bundle = await api<Bundle>('/api/inventory');
      setData(bundle);
      setLoadError(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load inventory';
      setLoadError(message);
      if (!opts?.quiet) pushToast(message, 'err');
      return false;
    }
  }, [pos.conn]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = 0;
    const boot = async () => {
      const ok = await load({ quiet: true });
      if (cancelled || ok) return;
      // One quiet retry covers a brief server blip without toast spam.
      retryTimer = window.setTimeout(() => {
        if (!cancelled) void load();
      }, 1200);
    };
    void boot();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [load]);

  useEffect(() => {
    if (data?.items[0] && !moveItemId) setMoveItemId(data.items[0].id);
  }, [data, moveItemId]);

  useEffect(() => {
    if (pos.items[0] && !recipeMenuId) setRecipeMenuId(pos.items[0].id);
  }, [pos.items, recipeMenuId]);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = data?.items ?? [];
    if (!needle) return list;
    return list.filter((item) => item.name.toLowerCase().includes(needle) || item.sku.toLowerCase().includes(needle));
  }, [data?.items, query]);

  async function saveNewItem() {
    setBusy(true);
    try {
      await api('/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          sku: newSku,
          unit: newUnit,
          qty: Number(newQty || 0),
          reorderLevel: Number(newReorder || 0),
          costPerUnit: Number(newCost || 0),
          supplier: newSupplier,
        }),
      });
      setAddItem(false);
      setNewName('');
      setNewSku('');
      setNewQty('');
      pushToast('Stock item added');
      await load();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Save failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function patchItem() {
    if (!editItem) return;
    setBusy(true);
    try {
      await api(`/api/inventory/items/${editItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editItem.name,
          sku: editItem.sku,
          unit: editItem.unit,
          reorderLevel: editItem.reorderLevel,
          costPerUnit: editItem.costPerUnit,
          supplier: editItem.supplier,
          category: editItem.category,
        }),
      });
      setEditItem(null);
      pushToast('Updated');
      await load();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Update failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function postMovement(kind: InventoryMovementKind) {
    setBusy(true);
    try {
      const raw = Number(moveQty);
      if (!moveItemId || !Number.isFinite(raw) || raw <= 0) throw new Error('Pick item and quantity.');
      const qty = kind === 'ADJUSTMENT' && adjustSigned === '-' ? -raw : raw;
      await api('/api/inventory/movements', {
        method: 'POST',
        body: JSON.stringify({
          itemId: moveItemId,
          kind,
          qty,
          unitCost: moveCost ? Number(moveCost) : undefined,
          supplier: moveSupplier,
          notes: moveNotes,
        }),
      });
      setMoveQty('');
      setMoveNotes('');
      pushToast(kind === 'PURCHASE' ? 'Purchase recorded' : kind === 'WASTAGE' ? 'Wastage recorded' : 'Stock adjusted');
      await load();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Movement failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function loadRecipe(menuItemId: string) {
    setRecipeMenuId(menuItemId);
    try {
      const result = await api<{ lines: MenuRecipeLine[] }>(`/api/inventory/recipes/${menuItemId}`);
      setRecipeLines(result.lines);
    } catch {
      setRecipeLines([]);
    }
  }

  useEffect(() => {
    if (tab === 'recipes' && recipeMenuId) void loadRecipe(recipeMenuId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when opening Recipes tab
  }, [tab, recipeMenuId]);

  async function saveRecipe() {
    if (!recipeMenuId) return;
    setBusy(true);
    try {
      await api(`/api/inventory/recipes/${recipeMenuId}`, {
        method: 'PUT',
        body: JSON.stringify({
          lines: recipeLines.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            qtyPerPortion: line.qtyPerPortion,
          })),
        }),
      });
      pushToast('Recipe saved · sales auto-deduct stock');
      await load();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Recipe save failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  const summary = data?.summary;

  return (
    <section className="pos-page">
      <header className="page-head">
        <h1>Inventory</h1>
        <p className="fine">Raw materials · purchase · wastage · recipes · auto deduction when a bill is paid</p>
      </header>

      {summary ? (
        <div className="inv-kpis">
          <div className="inv-kpi"><span>Items</span><strong>{summary.itemCount}</strong></div>
          <div className={`inv-kpi${summary.lowStockCount ? ' warn' : ''}`}>
            <span>Low stock</span>
            <strong>{summary.lowStockCount}</strong>
          </div>
          <div className="inv-kpi"><span>Stock value</span><strong>{formatINR(summary.stockValue)}</strong></div>
          <div className="inv-kpi"><span>Auto deduct</span><strong>On paid bill</strong></div>
        </div>
      ) : null}

      <div className="rpt-tools">
        <div className="bill-modes" role="tablist" aria-label="Inventory sections">
          {TABS.map((entry) => (
            <button key={entry.id} type="button" className={tab === entry.id ? 'on' : ''} onClick={() => setTab(entry.id)} role="tab" aria-selected={tab === entry.id}>
              {entry.label}
            </button>
          ))}
        </div>
        <label className="search">
          <span className="sr-only">Search stock</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SKU or name" />
        </label>
        <Button variant="ghost" onClick={() => void load()}>Refresh</Button>
        {tab === 'stock' ? <Button onClick={() => setAddItem(true)}>Add raw material</Button> : null}
      </div>

      {!data ? (
        <EmptyState
          title={loadError ? 'Inventory unavailable' : 'Loading inventory'}
          body={loadError ?? (pos.conn === 'OFFLINE' ? 'Go online to manage stock.' : 'Pulling stock from server…')}
        />
      ) : tab === 'stock' ? (
        items.length === 0 ? (
          <EmptyState title="No stock items" body="Add raw materials or restart the server to load the demo pantry." />
        ) : (
          <div className="people-list">
            <p className="people-head inv-head" aria-hidden="true">
              <span>Item</span>
              <span>SKU</span>
              <span>Unit</span>
              <span>On hand</span>
              <span>Reorder</span>
              <span>Value</span>
              <span />
            </p>
            {items.map((item) => (
              <article key={item.id} className="people-row inv-row people-row-wide">
                <strong>
                  {item.name}
                  {item.lowStock ? <small> Low</small> : null}
                </strong>
                <span>{item.sku || '—'}</span>
                <span>{item.unit}</span>
                <span className={item.lowStock ? 'inv-low' : 'inv-ok'}>{fmtQty(item.qty, item.unit)}</span>
                <span>{item.reorderLevel > 0 ? fmtQty(item.reorderLevel, item.unit) : '—'}</span>
                <span className="price">{formatINR(Math.round(item.qty * item.costPerUnit))}</span>
                <Button variant="ghost" onClick={() => setEditItem({ ...item })}>Edit</Button>
              </article>
            ))}
          </div>
        )
      ) : tab === 'ledger' ? (
        <div className="people-list">
          <p className="people-head inv-head" aria-hidden="true">
            <span>When</span>
            <span>Item</span>
            <span>Type</span>
            <span>Qty</span>
            <span>Notes</span>
            <span>By</span>
            <span />
          </p>
          {data.movements.map((row) => (
            <article key={row.id} className="people-row inv-row people-row-wide">
              <time dateTime={row.createdAt}>{formatWhen(row.createdAt)}</time>
              <strong>{row.itemName}</strong>
              <span>{row.kind}</span>
              <span className={row.qtyDelta < 0 ? 'inv-low' : 'inv-ok'}>{row.qtyDelta > 0 ? '+' : ''}{row.qtyDelta}</span>
              <span>{row.notes || row.supplier || '—'}</span>
              <span>{row.actor}</span>
              <span />
            </article>
          ))}
        </div>
      ) : tab === 'recipes' ? (
        <div className="panel" style={{ maxWidth: 720 }}>
          <label className="field">
            <span className="field-label">Menu item</span>
            <select value={recipeMenuId} onChange={(event) => void loadRecipe(event.target.value)}>
              {pos.items.filter((item) => item.isAvailable).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <p className="fine">Ingredients consumed per 1 portion (deducted when the bill is fully paid).</p>
          <ul className="bill-lines" style={{ marginTop: 12 }}>
            {recipeLines.map((line, index) => (
              <li key={`${line.inventoryItemId}-${index}`} style={{ gridTemplateColumns: '1fr auto auto' }}>
                <span>{line.inventoryItemName ?? data.items.find((item) => item.id === line.inventoryItemId)?.name ?? line.inventoryItemId}</span>
                <input
                  aria-label="Quantity per portion"
                  inputMode="decimal"
                  value={line.qtyPerPortion}
                  onChange={(event) => {
                    const qty = Number(event.target.value);
                    setRecipeLines((current) => current.map((entry, i) => (i === index ? { ...entry, qtyPerPortion: qty } : entry)));
                  }}
                  style={{ width: 72 }}
                />
                <span>{line.unit ?? data.items.find((item) => item.id === line.inventoryItemId)?.unit}</span>
              </li>
            ))}
          </ul>
          <div className="rpt-tools" style={{ marginTop: 12 }}>
            <Button
              variant="ghost"
              onClick={() => {
                const pick = data.items[0];
                if (!pick) return;
                setRecipeLines((current) => [...current, { menuItemId: recipeMenuId, inventoryItemId: pick.id, inventoryItemName: pick.name, unit: pick.unit, qtyPerPortion: 0.01 }]);
              }}
            >
              Add ingredient
            </Button>
            <Button disabled={busy || !recipeMenuId} onClick={() => void saveRecipe()}>Save recipe</Button>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ maxWidth: 480 }}>
          <h2>{tab === 'purchase' ? 'Purchase entry' : tab === 'wastage' ? 'Wastage' : 'Physical adjustment'}</h2>
          <label className="field">
            <span className="field-label">Stock item</span>
            <select value={moveItemId} onChange={(event) => setMoveItemId(event.target.value)}>
              {data.items.map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({fmtQty(item.qty, item.unit)})</option>
              ))}
            </select>
          </label>
          {tab === 'adjust' ? (
            <div className="bill-modes" role="group" aria-label="Adjustment direction">
              <button type="button" className={adjustSigned === '+' ? 'on' : ''} onClick={() => setAdjustSigned('+')}>Add stock</button>
              <button type="button" className={adjustSigned === '-' ? 'on' : ''} onClick={() => setAdjustSigned('-')}>Remove stock</button>
            </div>
          ) : null}
          <Input label="Quantity" inputMode="decimal" value={moveQty} onChange={(event) => setMoveQty(event.target.value)} />
          {tab === 'purchase' ? (
            <>
              <Input label="Unit cost (paise optional)" inputMode="numeric" value={moveCost} onChange={(event) => setMoveCost(event.target.value)} />
              <Input label="Supplier" value={moveSupplier} onChange={(event) => setMoveSupplier(event.target.value)} />
            </>
          ) : null}
          <Input label="Notes" value={moveNotes} onChange={(event) => setMoveNotes(event.target.value)} />
          <Button
            disabled={busy}
            onClick={() => void postMovement(tab === 'purchase' ? 'PURCHASE' : tab === 'wastage' ? 'WASTAGE' : 'ADJUSTMENT')}
          >
            {tab === 'purchase' ? 'Record purchase' : tab === 'wastage' ? 'Record wastage' : 'Apply adjustment'}
          </Button>
        </div>
      )}

      {addItem ? (
        <Modal open title="Add raw material" onClose={() => setAddItem(false)}>
          <Input label="Name" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <Input label="SKU" value={newSku} onChange={(event) => setNewSku(event.target.value)} />
          <label className="field">
            <span className="field-label">Unit</span>
            <select value={newUnit} onChange={(event) => setNewUnit(event.target.value as typeof newUnit)}>
              {['kg', 'g', 'l', 'ml', 'pcs'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </label>
          <Input label="Opening qty" inputMode="decimal" value={newQty} onChange={(event) => setNewQty(event.target.value)} />
          <Input label="Reorder level" inputMode="decimal" value={newReorder} onChange={(event) => setNewReorder(event.target.value)} />
          <Input label="Cost per unit (₹)" inputMode="numeric" value={newCost} onChange={(event) => setNewCost(event.target.value)} />
          <Input label="Supplier" value={newSupplier} onChange={(event) => setNewSupplier(event.target.value)} />
          <Button disabled={busy || !newName.trim()} onClick={() => void saveNewItem()}>Save</Button>
        </Modal>
      ) : null}

      {editItem ? (
        <Modal open title="Edit stock item" onClose={() => setEditItem(null)}>
          <Input label="Name" value={editItem.name} onChange={(event) => setEditItem({ ...editItem, name: event.target.value })} />
          <Input label="SKU" value={editItem.sku} onChange={(event) => setEditItem({ ...editItem, sku: event.target.value })} />
          <Input label="Reorder level" inputMode="decimal" value={String(editItem.reorderLevel)} onChange={(event) => setEditItem({ ...editItem, reorderLevel: Number(event.target.value) || 0 })} />
          <Input label="Cost per unit (₹)" inputMode="numeric" value={String(editItem.costPerUnit)} onChange={(event) => setEditItem({ ...editItem, costPerUnit: Number(event.target.value) || 0 })} />
          <Input label="Supplier" value={editItem.supplier} onChange={(event) => setEditItem({ ...editItem, supplier: event.target.value })} />
          <Button disabled={busy} onClick={() => void patchItem()}>Update</Button>
        </Modal>
      ) : null}
    </section>
  );
}
