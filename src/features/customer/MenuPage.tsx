import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { formatINR, taxLabel } from '../../../shared/domain';
import { api, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Modal } from '../../components/Modal';
import { ProductCard } from '../../components/ProductCard';
import { useCart, type Bootstrap, type CartLine } from './cart';
import { ItemSheet } from './ItemSheet';
import { TableScanner } from './TableScanner';

export function MenuPage() {
  useTitle('Menu');
  const cart = useCart();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ itemId: string; line?: CartLine } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const requested = params.get('table');
    try {
      const data = await api<Bootstrap>(`/api/bootstrap${requested ? `?table=${encodeURIComponent(requested)}` : ''}`);
      cart.setCatalog(data);
      if (data.table) cart.setTableCode(data.table.name);
      else if (requested) cart.setTableCode(requested);
      setActive(data.categories[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Menu unavailable.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const source = new EventSource('/api/menu/events');
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type?: string; item?: Bootstrap['items'][number]; addon?: { id: string; name: string; price: number; isAvailable: boolean } };
      if (data.type === 'ping') return;
      cart.setCatalog((current) => {
        if (!current) return current;
        if (data.type === 'menu.updated' && data.item) {
          return { ...current, items: current.items.map((item) => (item.id === data.item?.id ? { ...item, ...data.item } : item)) };
        }
        if (data.type === 'addon.updated' && data.addon) {
          return {
            ...current,
            addonGroups: current.addonGroups.map((group) => ({
              ...group,
              addons: group.addons.map((addon) => (addon.id === data.addon?.id ? { ...addon, ...data.addon } : addon)),
            })),
          };
        }
        return current;
      });
    };
    return () => source.close();
    // load once per table query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const onTable = useCallback((code: string) => {
    setScanning(false);
    navigate(`/menu?table=${encodeURIComponent(code)}`);
  }, [navigate]);

  const catalog = cart.catalog;
  const sheetItem = catalog?.items.find((item) => item.id === sheet?.itemId) ?? null;

  return (
    <div className="cust">
      <a className="skip" href="#menu">Skip to menu</a>
      <header className="cust-header">
        <div>
          <p className="eyebrow">Coffee · Breakfast · Café</p>
          <h1>{catalog?.cafe.name ?? 'After Dunes'}</h1>
        </div>
        <button type="button" className="table-chip" onClick={() => setScanning(true)}>
          {cart.tableCode ? `Table ${cart.tableCode}` : 'Scan table'}
        </button>
        <Link className="header-cart" to="/cart">Cart{cart.count ? ` ${cart.count}` : ''}</Link>
      </header>
      {catalog ? (
        <nav className="cats" aria-label="Categories">
          {catalog.categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={active === category.id ? 'cat-btn active' : 'cat-btn'}
              onClick={() => {
                setActive(category.id);
                document.getElementById(`cat-${category.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {category.name}
            </button>
          ))}
        </nav>
      ) : null}
      <main id="menu" className="cust-main">
        {loading && !catalog ? <LoadingState label="Loading menu" /> : null}
        {error ? (
          <EmptyState title="Menu unavailable" body={error} />
        ) : null}
        {error ? <Button onClick={() => void load()}>Retry</Button> : null}
        {!cart.tableCode && catalog ? (
          <div className="banner scan-banner">
            <span>Scan the QR on your table to order.</span>
            <button type="button" className="btn" onClick={() => setScanning(true)}>Scan table</button>
          </div>
        ) : null}
        {catalog ? (
          <div className="menu-layout">
            <div>
              {catalog.categories.map((category) => {
                const items = catalog.items.filter((item) => item.categoryId === category.id).sort((a, b) => a.sortOrder - b.sortOrder);
                return (
                  <section key={category.id} id={`cat-${category.id}`} className="menu-section">
                    <h2>{category.name}</h2>
                    <div className="menu-grid">
                      {items.map((item) => (
                        <ProductCard key={item.id} item={item} onSelect={(selected) => setSheet({ itemId: selected.id })} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
            <aside className="cart-rail" aria-label="Cart summary">
              <h2>Your order</h2>
              {cart.lineViews.length === 0 ? <p>Nothing added yet.</p> : null}
              <ul>
                {cart.lineViews.map((line) => (
                  <li key={line.lineId}>
                    <span>{line.quantity} × {line.name}</span>
                    <span className="price">{line.total === null ? '—' : formatINR(line.total)}</span>
                  </li>
                ))}
              </ul>
              {cart.totals ? (
                <p className="rail-total">
                  <span>Total incl. tax {taxLabel(catalog.cafe.taxBps)}</span>
                  <strong className="price">{formatINR(cart.totals.total)}</strong>
                </p>
              ) : null}
              <Link className="btn btn-primary btn-full" to="/cart">View cart</Link>
            </aside>
          </div>
        ) : null}
      </main>
      {cart.count > 0 ? (
        <Link className="cart-bar" to="/cart">
          <span>View cart · {cart.count}</span>
          <strong>{cart.totals ? formatINR(cart.totals.total) : 'Review'}</strong>
        </Link>
      ) : null}
      {sheetItem && catalog ? (
        <ItemSheet
          item={sheetItem}
          catalog={catalog}
          initial={sheet?.line ? { quantity: sheet.line.quantity, addonIds: sheet.line.addonIds, notes: sheet.line.notes } : undefined}
          onClose={() => setSheet(null)}
          onSave={(value) => {
            cart.addLine({ menuItemId: sheetItem.id, ...value, lineId: sheet?.line?.lineId });
            setSheet(null);
          }}
        />
      ) : null}
      <Modal open={scanning} title="Scan table" onClose={() => setScanning(false)}>
        {scanning ? <TableScanner onTable={onTable} /> : null}
      </Modal>
    </div>
  );
}
