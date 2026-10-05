import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatINR, taxLabel } from '../../../shared/domain';
import { api } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { CartItem } from '../../components/CartItem';
import { EmptyState } from '../../components/EmptyState';
import { ItemSheet } from './ItemSheet';
import { useCart, type Bootstrap } from './cart';

export function CartPage() {
  useTitle('Cart');
  const cart = useCart();
  const [editing, setEditing] = useState<string | null>(null);
  const tax = cart.catalog?.cafe.taxBps ?? 500;
  const editingLine = cart.lines.find((line) => line.lineId === editing) ?? null;
  const editingItem = cart.catalog?.items.find((item) => item.id === editingLine?.menuItemId) ?? null;

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

  return (
    <div className="guest narrow">
      <header className="guest-bar">
        <Link className="guest-back" to={`/menu${cart.tableCode ? `?table=${encodeURIComponent(cart.tableCode)}` : ''}`}>Menu</Link>
        <p className="wordmark">Your order</p>
      </header>
      <main className="guest-main stack">
        {cart.lines.length === 0 ? <EmptyState title="Cart is empty" body="Add something from the menu." /> : null}
        {cart.lineViews.map((line) => (
          <CartItem
            key={line.lineId}
            line={line}
            onInc={() => cart.setQty(line.lineId, line.quantity + 1)}
            onDec={() => cart.setQty(line.lineId, line.quantity - 1)}
            onRemove={() => cart.removeLine(line.lineId)}
            onEdit={() => setEditing(line.lineId)}
          />
        ))}
        {cart.totals ? (
          <dl className="totals" aria-live="polite">
            <div><dt>Subtotal</dt><dd>{formatINR(cart.totals.subtotal)}</dd></div>
            {cart.totals.discount > 0 ? <div><dt>Discount</dt><dd>−{formatINR(cart.totals.discount)}</dd></div> : null}
            <div><dt>Tax ({taxLabel(tax)})</dt><dd>{formatINR(cart.totals.tax)}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{formatINR(cart.totals.total)}</dd></div>
          </dl>
        ) : null}
        {cart.quoteError ? <p className="field-error" role="alert">{cart.quoteError}</p> : null}
        <div className="row-actions">
          <Link className="btn btn-ghost" to={`/menu${cart.tableCode ? `?table=${encodeURIComponent(cart.tableCode)}` : ''}`}>Add more</Link>
          {cart.totals && cart.tableCode ? <Link className="btn btn-primary" to="/checkout">Checkout</Link> : <button type="button" className="btn btn-primary" disabled>Checkout</button>}
        </div>
        {!cart.tableCode ? <p className="fine">Checkout stays closed until a table QR is scanned.</p> : null}
      </main>
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
    </div>
  );
}
