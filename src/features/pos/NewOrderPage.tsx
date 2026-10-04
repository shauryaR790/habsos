import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR, priceCart, PriceError } from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { pushToast } from '../../components/Toast';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { ProductCard } from '../../components/ProductCard';
import { ItemSheet } from '../customer/ItemSheet';
import type { Bootstrap } from '../customer/cart';
import { usePos } from './PosContext';

type Draft = { lineId: string; menuItemId: string; quantity: number; addonIds: string[]; notes: string };

export function NewOrderPage() {
  useTitle('New order');
  const pos = usePos();
  const navigate = useNavigate();
  const [tableId, setTableId] = useState<string | null>(null);
  const [lines, setLines] = useState<Draft[]>([]);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [itemId, setItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalog = useMemo<Bootstrap | null>(() => {
    if (!pos.cafe) return null;
    return { cafe: pos.cafe, table: null, categories: pos.categories, items: pos.items, addonGroups: pos.addonGroups };
  }, [pos.addonGroups, pos.cafe, pos.categories, pos.items]);
  const item = catalog?.items.find((entry) => entry.id === itemId) ?? null;
  const quote = useMemo(() => {
    if (!catalog || !lines.length) return null;
    try {
      return priceCart({ lines, items: catalog.items, groups: catalog.addonGroups, taxBps: catalog.cafe.taxBps });
    } catch (err) {
      return err instanceof PriceError ? err.message : 'Check the items.';
    }
  }, [catalog, lines]);

  async function place() {
    if (!tableId || !name.trim() || typeof quote !== 'object' || !quote) return;
    setBusy(true);
    setError(null);
    try {
      await pos.createOrder({ tableId, customerName: name, customerMobile: mobile, items: lines });
      navigate('/pos');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not place the order.';
      setError(message);
      pushToast(message, 'err');
    } finally {
      setBusy(false);
    }
  }

  if (!catalog) return <p>Menu is not on this device yet. Connect once to load it.</p>;

  return (
    <section className="stack">
      <h1>New order</h1>
      <div className="table-pick" role="listbox" aria-label="Tables">
        {pos.tables.map((table) => (
          <button key={table.id} type="button" className={tableId === table.id ? 'table-card picked' : 'table-card'} onClick={() => setTableId(table.id)}>
            <span className="table-name">{table.name}</span>
            <span>{table.status === 'OCCUPIED' ? 'Occupied' : 'Available'}</span>
          </button>
        ))}
      </div>
      {pos.categories.map((category) => (
        <section key={category.id}>
          <h2>{category.name}</h2>
          <div className="menu-grid">
            {pos.items.filter((entry) => entry.categoryId === category.id).map((entry) => (
              <ProductCard key={entry.id} item={entry} onSelect={(selected) => setItemId(selected.id)} />
            ))}
          </div>
        </section>
      ))}
      <div className="stack">
        <h2>This ticket</h2>
        {lines.length === 0 ? <p>No items yet.</p> : null}
        <ul className="plain-list">
          {typeof quote === 'object' && quote ? quote.lines.map((line, index) => (
            <li key={`${line.menuItemId}-${index}`}>
              <span>{line.quantity} × {line.name}{line.addons.length ? ` · ${line.addons.map((addon) => addon.name).join(', ')}` : ''}</span>
              <span className="price">{formatINR(line.total)}</span>
            </li>
          )) : null}
        </ul>
        {typeof quote === 'string' ? <p className="field-error">{quote}</p> : null}
        {typeof quote === 'object' && quote ? <p className="rail-total"><span>Total</span><strong className="price">{formatINR(quote.total)}</strong></p> : null}
        <Input label="Customer name" value={name} onChange={(event) => setName(event.target.value)} />
        <Input label="Mobile (optional)" value={mobile} inputMode="tel" onChange={(event) => setMobile(event.target.value)} />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <Button full disabled={!tableId || !name.trim() || typeof quote !== 'object' || !quote || busy} onClick={() => void place()}>
          {busy ? 'Placing…' : 'Place order'}
        </Button>
      </div>
      {item ? (
        <ItemSheet
          item={item}
          catalog={catalog}
          onClose={() => setItemId(null)}
          onSave={(value) => {
            setLines((current) => [...current, { lineId: crypto.randomUUID(), menuItemId: item.id, ...value }]);
            setItemId(null);
          }}
        />
      ) : null}
    </section>
  );
}
