import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { TableScanner } from './TableScanner';
import { formatINR, taxLabel, type MenuItem } from '../../../shared/domain';
import { api } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { CartItem } from '../../components/CartItem';
import { ItemSheet } from './ItemSheet';
import { useCart, type Bootstrap } from './cart';
import { GuestDrawerShell } from './GuestDrawerShell';
import { CartEmptyCarousel } from './CartEmptyCarousel';
import { guestOpenItemPath } from './guestOpenItemLink';
import { saveMenuScroll } from './guestMenuScroll';
import { useGuestDesktop } from './useGuestDesktop';
import { GuestFlowHeader } from './GuestFlowHeader';

export function CartPage() {
  useTitle('Cart');
  const cart = useCart();
  const navigate = useNavigate();
  const desktop = useGuestDesktop();
  const [editing, setEditing] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const tax = cart.catalog?.cafe.taxBps ?? 500;
  const editingLine = cart.lines.find((line) => line.lineId === editing) ?? null;
  const editingItem = cart.catalog?.items.find((item) => item.id === editingLine?.menuItemId) ?? null;
  const menuHref = `/menu${cart.tableCode ? `?table=${encodeURIComponent(cart.tableCode)}` : ''}`;

  const openMenuItem = useCallback(
    (item: MenuItem) => {
      navigate(guestOpenItemPath(item.id, cart.tableCode));
    },
    [cart.tableCode, navigate],
  );

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
  const itemCount = cart.lineViews.length;
  const itemsDensity = itemCount >= 4 ? 'cart-items-pane--compact' : '';

  const billDetails = cart.totals ? (
    <section className="ad-guest-drawer-bill" aria-label="Bill details">
      <h2 className="ad-guest-drawer-bill-title">Bill details</h2>
      <dl>
        <div><dt>Items total</dt><dd>{formatINR(cart.totals.subtotal)}</dd></div>
        {cart.totals.discount > 0 ? <div><dt>Discount</dt><dd>−{formatINR(cart.totals.discount)}</dd></div> : null}
        <div><dt>Tax ({taxLabel(tax)})</dt><dd>{formatINR(cart.totals.tax)}</dd></div>
        <div className="grand"><dt>Grand total</dt><dd>{formatINR(cart.totals.total)}</dd></div>
      </dl>
    </section>
  ) : null;

  const checkoutFooter =
    cart.totals && cart.tableCode ? (
      <Link className="pay-bar ad-guest-drawer-checkout" to="/checkout" onClick={() => saveMenuScroll()}>
        <span>{formatINR(cart.totals.total)}</span>
        <span>Proceed to checkout</span>
      </Link>
    ) : null;

  const cartBody = (
    <>
      <div className={`cart-items-pane${itemsDensity ? ` ${itemsDensity}` : ''}`.trim()}>
        <div className="cart-list ad-guest-drawer-cart-list">
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
        {cart.quoteError ? <p className="field-error" role="alert">{cart.quoteError}</p> : null}
      </div>
      {desktop ? billDetails : null}
      {!cart.tableCode && desktop ? (
        <p className="ad-guest-drawer-hint">Scan your table QR from the menu to checkout.</p>
      ) : null}
    </>
  );

  const emptyBrowse = (
    <Link className="pay-bar cart-empty-foot ad-guest-drawer-checkout" to={menuHref} onClick={() => saveMenuScroll()}>
      <span>Browse menu</span>
    </Link>
  );

  const emptyCartScreen = (
    <div
      className={`guest cart-screen ad-guest-cart cart-screen-empty ad-guest-surface-bg${
        desktop ? ' ad-guest-drawer-page cart-screen-empty--drawer' : ' guest-flow-compact'
      }`}
    >
      <GuestFlowHeader title="Cart" backTo={menuHref} />
          <div className="cart-layout">
            <main className="guest-main cart-main">
              <div className="cart-empty-stack">
                {desktop ? (
                  <h1 className="cart-empty-title cart-empty-title--drawer">Nothing in the bag</h1>
                ) : (
                  <h1 className="cart-empty-title ad-hero-title">
                    <span className="ad-hero-title-row">Nothing in</span>
                    <span className="ad-hero-title-line">the bag</span>
                  </h1>
                )}
                {cart.catalog ? (
                  <CartEmptyCarousel
                    items={cart.catalog.items}
                    onOpenItem={openMenuItem}
                    onAddItem={openMenuItem}
                  />
                ) : null}
              </div>
            </main>
          </div>
      {!desktop ? (
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
      ) : null}
      {!desktop ? (
        <Link className="pay-bar cart-empty-foot" to={menuHref}>
          <span>Browse menu</span>
        </Link>
      ) : null}
    </div>
  );

  return (
    <>
      {empty ? (
        desktop ? (
          <GuestDrawerShell title="My bag" closeTo={menuHref} footer={emptyBrowse}>
            {emptyCartScreen}
          </GuestDrawerShell>
        ) : (
          emptyCartScreen
        )
      ) : (
        <>
        <GuestDrawerShell title="My bag" closeTo={menuHref} footer={desktop ? checkoutFooter : undefined}>
          <div
            className={`guest cart-screen ad-guest-cart ad-guest-surface-bg${
              desktop ? ' ad-guest-drawer-page' : ' guest-flow-compact'
            }`}
          >
            <GuestFlowHeader title="Cart" backTo={menuHref} />
            <div className="cart-layout">
              <main className="guest-main cart-main">
                {cartBody}
              </main>
              {!desktop && cart.totals ? (
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
                  {!cart.tableCode ? (
                    <>
                      <button type="button" className="pay-bar cart-mobile-scan-cta" disabled>
                        <span>Scan a table to checkout</span>
                      </button>
                      <p className="cart-summary-hint">Open the menu and scan your table QR to pay.</p>
                    </>
                  ) : null}
                </aside>
              ) : null}
            </div>
            {!desktop && cart.tableCode && cart.totals ? (
              <footer className="checkout-dock cart-mobile-dock">
                <Link className="pay-bar" to="/checkout">
                  <span>Checkout</span>
                  <span>{formatINR(cart.totals.total)}</span>
                </Link>
              </footer>
            ) : null}
          </div>
        </GuestDrawerShell>
        </>
      )}
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
    </>
  );
}
