import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { TableScanner } from './TableScanner';
import { formatINR, taxLabel } from '../../../shared/domain';
import { api } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { CartItem } from '../../components/CartItem';
import { ItemSheet } from './ItemSheet';
import { useCart, type Bootstrap } from './cart';
import { GuestHeader } from './GuestHeader';
export function CartPage() {
  useTitle('Cart');
  const cart = useCart();
  const [editing, setEditing] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const tax = cart.catalog?.cafe.taxBps ?? 500;
  const editingLine = cart.lines.find((line) => line.lineId === editing) ?? null;
  const editingItem = cart.catalog?.items.find((item) => item.id === editingLine?.menuItemId) ?? null;
  const menuHref = `/menu${cart.tableCode ? `?table=${encodeURIComponent(cart.tableCode)}` : ''}`;

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
    <div className={`guest cart-screen ad-guest-cart${empty ? ' cart-screen-empty' : ''}`}>
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
              <div className="cart-empty">
                <div className="cart-empty-sticker">
                  <img src="/ad/brew-sticker-1.png" alt="" width={220} height={220} decoding="async" />
                </div>
                <h2>Nothing in the bag</h2>
              </div>
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
        <Link className="pay-bar cart-empty-foot" to={menuHref}>
          <span>Browse menu</span>
        </Link>
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
