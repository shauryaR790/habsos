import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { TableScanner } from './TableScanner';
import { formatINR, taxLabel, type MenuItem } from '../../../shared/domain';
import { api } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { CartItem } from '../../components/CartItem';
import { ItemSheet } from './ItemSheet';
import { useCart, type Bootstrap } from './cart';
import { GuestHeader } from './GuestHeader';
import { CartEmptyCarousel } from './CartEmptyCarousel';
function canQuickAdd(item: MenuItem, catalog: Bootstrap) {
  const groups = item.addonGroupIds
    .map((id) => catalog.addonGroups.find((group) => group.id === id))
    .filter((group) => group !== undefined);
  return groups.every((group) => group.minSelect === 0);
}

export function CartPage() {
  useTitle('Cart');
  const cart = useCart();
  const [editing, setEditing] = useState<string | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const tax = cart.catalog?.cafe.taxBps ?? 500;
  const editingLine = cart.lines.find((line) => line.lineId === editing) ?? null;
  const editingItem = cart.catalog?.items.find((item) => item.id === editingLine?.menuItemId) ?? null;
  const pickingItem = cart.catalog?.items.find((item) => item.id === pickingId) ?? null;
  const menuHref = `/menu${cart.tableCode ? `?table=${encodeURIComponent(cart.tableCode)}` : ''}`;

  const openMenuItem = useCallback((item: MenuItem) => {
    setPickingId(item.id);
  }, []);

  const addMenuItem = useCallback((item: MenuItem) => {
    if (!cart.catalog) return;
    if (canQuickAdd(item, cart.catalog)) {
      cart.addLine({ menuItemId: item.id, quantity: 1, addonIds: [], notes: '' });
      return;
    }
    setPickingId(item.id);
  }, [cart]);

  useEffect(() => {
    if (cart.catalog) return;
    const table = cart.tableCode;
    void api<Bootstrap>(`/api/bootstrap${table ? `?table=${encodeURIComponent(table)}` : ''}`)
      .then((data) => {
        cart.setCatalog(data);
        if (data.table) cart.setTableCode(data.table.name);
      })
      .catch(() => undefined);
  }, [cart.catalog, cart.setCatalog, cart.setTableCode, cart.tableCode]);

  const onTable = useCallback((code: string) => {
    setScanning(false);
    cart.setTableCode(code);
    void api<Bootstrap>(`/api/bootstrap?table=${encodeURIComponent(code)}`)
      .then((data) => {
        cart.setCatalog(data);
        if (data.table) cart.setTableCode(data.table.name);
      })
      .catch(() => undefined);
  }, [cart]);

  const empty = cart.lines.length === 0;

  return (
    <div className={`guest guest-flow-compact cart-screen ad-guest-cart${empty ? ' cart-screen-empty' : ''}`}>
      <div className="guest-desktop-head">
        <GuestHeader
          brand={cart.catalog?.cafe.name ?? 'After Dunes'}
          active="cart"
          search={search}
          onSearch={setSearch}
          onScan={() => setScanning(true)}
          cartCount={cart.count}
          showMenuNav
        />
      </div>
      <header className="guest-bar cart-head guest-bar-mobile-only">
        <Link className="guest-back" to={menuHref} aria-label="Back to menu">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Menu
        </Link>
        <p className="wordmark">Cart</p>
      </header>
      <div className="cart-layout">
        <main className="guest-main cart-main">
          <header className="cart-page-head">
            <h1 className="cart-page-title">Your bag</h1>
            {cart.tableCode ? <p className="cart-page-meta">Table {cart.tableCode}</p> : null}
          </header>
          {empty ? (
            <div className="cart-empty-stack">
              <h1 className="cart-empty-title ad-hero-title">
                <span className="ad-hero-title-row">Nothing in</span>
                <span className="ad-hero-title-line">the bag</span>
              </h1>
              {cart.catalog ? (
                <CartEmptyCarousel
                  items={cart.catalog.items}
                  onOpenItem={openMenuItem}
                  onAddItem={addMenuItem}
                />
              ) : null}
            </div>
          ) : (
            <div className="cart-list">
              {cart.lineViews.map((line) => (
                <CartItem
                  key={line.lineId}
                  line={line}
                  imageUrl={cart.catalog?.items.find((item) => item.id === line.menuItemId)?.imageUrl}
                  onInc={() => cart.setQty(line.lineId, line.quantity + 1)}
                  onDec={() => cart.setQty(line.lineId, line.quantity - 1)}
                  onRemove={() => cart.removeLine(line.lineId)}
                  onEdit={() => setEditing(line.lineId)}
                />
              ))}
            </div>
          )}
          {cart.quoteError ? <p className="field-error" role="alert">{cart.quoteError}</p> : null}
        </main>
        {cart.totals ? (
          <aside className="cart-end cart-summary" aria-label="Order summary">
            <footer className="cart-dock">
              <h2 className="cart-summary-title">Summary</h2>
              <dl>
                <div><dt>Subtotal</dt><dd>{formatINR(cart.totals.subtotal)}</dd></div>
                {cart.totals.discount > 0 ? <div><dt>Discount</dt><dd>−{formatINR(cart.totals.discount)}</dd></div> : null}
                <div><dt>Tax ({taxLabel(tax)})</dt><dd>{formatINR(cart.totals.tax)}</dd></div>
                <div className="grand"><dt>Total</dt><dd>{formatINR(cart.totals.total)}</dd></div>
              </dl>
            </footer>
            {cart.tableCode ? (
              <Link className="pay-bar cart-desktop-cta" to="/checkout">
                <span>Checkout</span>
                <span>{formatINR(cart.totals.total)}</span>
              </Link>
            ) : (
              <button type="button" className="pay-bar cart-desktop-cta" disabled>
                <span>Scan a table to checkout</span>
                <span>{formatINR(cart.totals.total)}</span>
              </button>
            )}
            {!cart.tableCode ? (
              <p className="cart-summary-hint">Open the menu and scan your table QR to pay.</p>
            ) : null}
          </aside>
        ) : null}
      </div>
      {empty ? (
        <>
          <div className="cart-empty-stage" aria-hidden="true">
            <div className="cart-empty-cookie-deco">
              <div className="cart-empty-orbit">
                <div className="cart-empty-orbit-spin">
                  <img
                    className="cart-empty-cookie"
                    src="/items/380246da263c0bed37b936b3e48da5c6-removebg-preview.png"
                    alt=""
                    width={640}
                    height={640}
                    decoding="async"
                  />
                </div>
              </div>
            </div>
          </div>
          <Link className="pay-bar cart-empty-foot" to={menuHref}>
            <span>Browse menu</span>
          </Link>
        </>
      ) : null}
      {pickingItem && cart.catalog ? (
        <ItemSheet
          mobileAd
          item={pickingItem}
          catalog={cart.catalog}
          onClose={() => setPickingId(null)}
          onSave={(value) => {
            cart.addLine({ menuItemId: pickingItem.id, ...value });
            setPickingId(null);
          }}
        />
      ) : null}
      {editingItem && editingLine && cart.catalog ? (
        <ItemSheet
          item={editingItem}
          catalog={cart.catalog}
          initial={{ quantity: editingLine.quantity, addonIds: editingLine.addonIds, notes: editingLine.notes }}
          onClose={() => setEditing(null)}
          onSave={(value) => {
            cart.updateLine(editingLine.lineId, { menuItemId: editingItem.id, ...value });
            setEditing(null);
          }}
        />
      ) : null}
      <Modal open={scanning} title="Scan table" onClose={() => setScanning(false)}>
        {scanning ? <TableScanner onTable={onTable} /> : null}
      </Modal>
    </div>
  );
}
