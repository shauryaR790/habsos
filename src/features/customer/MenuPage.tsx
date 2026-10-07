import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Modal } from '../../components/Modal';
import { ProductCard } from '../../components/ProductCard';
import { useCart, type Bootstrap, type CartLine } from './cart';
import { CartPill } from './CartPill';
import { ItemSheet } from './ItemSheet';
import { isColdMenuItem } from '../../../shared/menuDisplay';
import { RECOMMENDED } from './menuFacts';
import { TableScanner } from './TableScanner';
import { GuestHeader } from './GuestHeader';

export function MenuPage() {
  useTitle('Menu');
  const cart = useCart();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<'drinks' | 'food'>('drinks');
  const [temperature, setTemperature] = useState<'all' | 'hot' | 'cold'>('all');
  const [sheet, setSheet] = useState<{ itemId: string; line?: CartLine } | null>(null);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    const requested = params.get('table');
    try {
      const data = await api<Bootstrap>(`/api/bootstrap${requested ? `?table=${encodeURIComponent(requested)}` : ''}`);
      cart.setCatalog(data);
      if (data.table) cart.setTableCode(data.table.name);
      else if (requested) cart.setTableCode(requested);
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
  const available = catalog?.items.filter((item) => item.isAvailable) ?? [];
  const categories = (catalog?.categories ?? [])
    .filter((category) => available.some((item) => item.categoryId === category.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const foodCategories = categories.filter((category) => category.id !== 'cat_drinks');
  const needle = search.trim().toLowerCase();
  const matchesSearch = (name: string, description: string) => {
    if (!needle) return true;
    return name.toLowerCase().includes(needle) || description.toLowerCase().includes(needle);
  };
  const drinks = available
    .filter((item) => item.categoryId === 'cat_drinks')
    .filter((item) => temperature === 'all' || (temperature === 'cold' ? isColdMenuItem(item) : !isColdMenuItem(item)))
    .filter((item) => matchesSearch(item.name, item.description))
    .sort((a, b) => {
      if (a.id === 'item_mint_latte') return 1;
      if (b.id === 'item_mint_latte') return -1;
      return a.sortOrder - b.sortOrder;
    });
  const recommended = RECOMMENDED
    .map((id) => available.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  function openSection(id: string) {
    setPane(id === 'cat_drinks' ? 'drinks' : 'food');
    window.setTimeout(() => {
      document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }

  return (
    <div className="guest">
      <a className="skip" href="#menu">Skip to menu</a>
      <GuestHeader
        brand={catalog?.cafe.name ?? 'After Dunes'}
        active="menu"
        pane={pane}
        onPane={setPane}
        search={search}
        onSearch={setSearch}
        onScan={() => setScanning(true)}
        cartCount={cart.count}
        showMenuNav
      />
      {catalog ? (
        <nav className="guest-tabs guest-tabs-mobile" aria-label="Menu">
          <button type="button" className={pane === 'drinks' ? 'active' : undefined} onClick={() => setPane('drinks')}>Drinks</button>
          <button type="button" className={pane === 'food' ? 'active' : undefined} onClick={() => setPane('food')}>Food</button>
        </nav>
      ) : null}
      <div className="menu-stage">
      {categories.length ? (
        <nav className="guest-rail" aria-label="Sections">
          {categories.map((category) => {
            const photo = available.find((item) => item.categoryId === category.id)?.imageUrl;
            const on = pane === 'drinks' ? category.id === 'cat_drinks' : category.id !== 'cat_drinks';
            return (
              <button key={category.id} type="button" className={on ? 'rail-btn active' : 'rail-btn'} onClick={() => openSection(category.id)}>
                {photo ? <img src={photo} alt="" /> : <span className="rail-dot" />}
                <span>{category.name}</span>
              </button>
            );
          })}
        </nav>
      ) : null}
      <main id="menu" className="guest-main">
        {loading && !catalog ? <LoadingState label="Loading menu" /> : null}
        {error ? <EmptyState title="Menu unavailable" body={error} /> : null}
        {error ? <Button onClick={() => void load()}>Retry</Button> : null}
        {!cart.tableCode && catalog ? (
          <div className="banner scan-banner">
            <span>Scan the QR on your table to order.</span>
            <button type="button" className="btn" onClick={() => setScanning(true)}>Scan table</button>
          </div>
        ) : null}
        {catalog && recommended.length ? (
          <section className="rec-block" aria-label="Recommended">
            <h2>Recommended</h2>
            <div className="rec-row">
              {recommended.map((item) => (
                <ProductCard key={item.id} compact item={item} onSelect={(selected) => setSheet({ itemId: selected.id })} />
              ))}
            </div>
          </section>
        ) : null}
        {pane === 'drinks' ? (
          <section id="cat-drinks" className="menu-block">
            <h2>Drinks</h2>
            <div className="temp-row" role="tablist" aria-label="Drink style">
              {(['all', 'hot', 'cold'] as const).map((value) => (
                <button key={value} type="button" className={temperature === value ? 'active' : undefined} onClick={() => setTemperature(value)}>
                  {value === 'all' ? 'All' : value === 'hot' ? 'Hot' : 'Cold'}
                </button>
              ))}
            </div>
            <div className="order-list">
              {drinks.map((item) => (
                <ProductCard key={item.id} item={item} onSelect={(selected) => setSheet({ itemId: selected.id })} />
              ))}
            </div>
          </section>
        ) : foodCategories.map((category) => {
          const items = available
            .filter((item) => item.categoryId === category.id)
            .filter((item) => matchesSearch(item.name, item.description))
            .sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <section key={category.id} id={`cat-${category.id}`} className="menu-block">
              <h2>{category.name}</h2>
              <div className="order-list">
                {items.map((item) => (
                  <ProductCard key={item.id} item={item} onSelect={(selected) => setSheet({ itemId: selected.id })} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
      </div>
      <CartPill hidden={Boolean(sheet)} />
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
