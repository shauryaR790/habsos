import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatINR, taxLabel, type PublicOrder } from '../../../shared/domain';
import { api, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useCart, type Bootstrap } from './cart';
import { PlacedBurst } from './PlacedBurst';

export function CheckoutPage() {
  useTitle('Checkout');
  const cart = useCart();
  const navigate = useNavigate();
  const clientKey = useRef(crypto.randomUUID());
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<PublicOrder | null>(null);

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

  if (placed) {
    return <PlacedBurst order={placed} onDone={() => navigate(`/order/${placed.id}`)} />;
  }

  if (!cart.tableCode || cart.lines.length === 0) {
    return (
      <div className="guest narrow">
        <main className="stack">
          <h1>Checkout</h1>
          <p>Your cart is empty, or this visit has no table QR.</p>
          <Link className="btn btn-primary" to="/menu">Back to menu</Link>
        </main>
      </div>
    );
  }

  async function place() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ order: PublicOrder }>('/api/checkout/place', {
        method: 'POST',
        body: JSON.stringify({
          tableCode: cart.tableCode,
          customerName: name,
          customerMobile: mobile,
          clientKey: clientKey.current,
          items: cart.lines.map((line) => ({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            addonIds: line.addonIds,
            notes: line.notes,
          })),
        }),
      });
      cart.clear();
      setPlaced(result.order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place the order.');
      setBusy(false);
    }
  }

  return (
    <div className="guest narrow">
      <header className="guest-bar">
        <Link className="guest-back" to="/cart">Back</Link>
        <p className="wordmark">Checkout</p>
      </header>
      <main className="guest-main stack">
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void place();
          }}
        >
          <Input label="Name" value={name} autoComplete="name" required maxLength={80} onChange={(event) => setName(event.target.value)} />
          <Input label="Mobile number" value={mobile} inputMode="tel" autoComplete="tel" required placeholder="10-digit mobile" onChange={(event) => setMobile(event.target.value)} />
          <ul className="checkout-lines">
            {cart.lineViews.map((line) => (
              <li key={line.lineId}>
                <span>{line.quantity} × {line.name}</span>
                <span>{line.total === null ? '—' : formatINR(line.total)}</span>
              </li>
            ))}
          </ul>
          {cart.totals ? <Totals subtotal={cart.totals.subtotal} tax={cart.totals.tax} discount={cart.totals.discount} total={cart.totals.total} taxBps={cart.catalog?.cafe.taxBps ?? 500} /> : null}
          {cart.quoteError ? <p className="field-error">{cart.quoteError}</p> : null}
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <Button type="submit" full disabled={busy || !cart.totals} aria-busy={busy}>
            {busy ? 'Placing order…' : cart.totals ? `Place order · ${formatINR(cart.totals.total)}` : 'Place order'}
          </Button>
        </form>
      </main>
    </div>
  );
}

function Totals({ subtotal, tax, discount, total, taxBps }: { subtotal: number; tax: number; discount: number; total: number; taxBps: number }) {
  return (
    <dl className="totals">
      <div><dt>Subtotal</dt><dd>{formatINR(subtotal)}</dd></div>
      {discount > 0 ? <div><dt>Discount</dt><dd>−{formatINR(discount)}</dd></div> : null}
      <div><dt>Tax ({taxLabel(taxBps)})</dt><dd>{formatINR(tax)}</dd></div>
      <div className="grand"><dt>Total</dt><dd>{formatINR(total)}</dd></div>
    </dl>
  );
}
