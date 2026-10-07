import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatINR, maskMobile, normalizeMobile, type GuestPaymentPreference, type PublicOrder } from '../../../shared/domain';
import { collectRazorpayPayment } from '../../lib/razorpayCheckout';
import { api, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { Input } from '../../components/Input';
import { useCart, type Bootstrap } from './cart';
import { PlacedBurst } from './PlacedBurst';

type OtpStep = {
  orderId: string;
  mobile: string;
  devCode?: string;
};

type StartResponse = {
  order: PublicOrder;
  challengeId?: string;
  resendAfter?: number;
  devCode?: string;
};

export function CheckoutPage() {
  useTitle('Checkout');
  const cart = useCart();
  const navigate = useNavigate();
  const clientKey = useRef(crypto.randomUUID());
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [otp, setOtp] = useState<OtpStep | null>(null);
  const [wait, setWait] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<PublicOrder | null>(null);
  const [payPref, setPayPref] = useState<GuestPaymentPreference>('DESK');
  const [address, setAddress] = useState('');

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

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  if (placed) {
    return <PlacedBurst order={placed} onDone={() => navigate(`/order/${placed.id}`)} />;
  }

  const menuHref = `/menu${cart.tableCode ? `?table=${encodeURIComponent(cart.tableCode)}` : ''}`;

  if (!cart.tableCode || cart.lines.length === 0) {
    return (
      <div className="guest cart-screen">
        <header className="guest-bar cart-head">
          <Link className="guest-back" to={menuHref} aria-label="Back to menu">
            <Chevron />
            Menu
          </Link>
          <p className="wordmark">Checkout</p>
        </header>
        <main className="guest-main checkout-main">
          <div className="cart-empty">
            <h1>Nothing to check out</h1>
            <p>Your cart is empty, or this visit has no table QR.</p>
            <Link className="btn btn-primary" to={menuHref}>Back to menu</Link>
          </div>
        </main>
      </div>
    );
  }

  const items = cart.lines.map((line) => ({
    menuItemId: line.menuItemId,
    quantity: line.quantity,
    addonIds: line.addonIds,
    notes: line.notes,
  }));

  function finish(order: PublicOrder) {
    cart.clear();
    setPlaced(order);
  }

  async function start(event: React.FormEvent) {
    event.preventDefault();
    const digits = normalizeMobile(mobile);
    if (!digits) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<StartResponse>('/api/checkout/start', {
        method: 'POST',
        body: JSON.stringify({
          tableCode: cart.tableCode,
          customerName: name.trim(),
          customerMobile: digits,
          clientKey: clientKey.current,
          items,
          paymentPreference: payPref,
          address: address.trim() || undefined,
        }),
      });
      if (result.order.status === 'CONFIRMED' || !result.challengeId) {
        finish(result.order);
        return;
      }
      setOtp({ orderId: result.order.id, mobile: digits, devCode: result.devCode });
      setCode('');
      setWait(result.resendAfter ?? 30);
      setBusy(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the code.');
      setBusy(false);
    }
  }

  async function verify(event?: React.FormEvent) {
    event?.preventDefault();
    if (!otp || code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ order: PublicOrder }>('/api/checkout/verify', {
        method: 'POST',
        body: JSON.stringify({ orderId: otp.orderId, code }),
      });
      let order = result.order;
      if (order.paymentPreference !== 'DESK' && cart.catalog?.payments?.razorpayKeyId) {
        await collectRazorpayPayment({
          orderId: order.id,
          public: true,
          customerName: order.customerName,
          customerMobile: mobile,
        });
        const paid = await api<{ order: PublicOrder }>(`/api/orders/${order.id}/public`);
        order = paid.order;
      }
      finish(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code did not match.');
      setBusy(false);
    }
  }

  async function resend() {
    if (!otp || wait > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ resendAfter: number; devCode?: string }>('/api/checkout/resend', {
        method: 'POST',
        body: JSON.stringify({ orderId: otp.orderId }),
      });
      setOtp({ ...otp, devCode: result.devCode });
      setCode('');
      setWait(result.resendAfter ?? 30);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend the code.');
    } finally {
      setBusy(false);
    }
  }

  function fillCode(next: string) {
    setCode(next);
    if (next.length === 6) {
      window.setTimeout(() => {
        const form = document.getElementById('otp-form');
        if (form instanceof HTMLFormElement) form.requestSubmit();
      }, 40);
    }
  }

  return (
    <div className={`guest cart-screen${otp ? ' is-otp' : ''}`}>
      <header className="guest-bar cart-head">
        {otp ? (
          <button
            type="button"
            className="guest-back"
            aria-label="Back to details"
            onClick={() => {
              setOtp(null);
              setCode('');
              setError(null);
            }}
          >
            <Chevron />
            Back
          </button>
        ) : (
          <Link className="guest-back" to="/cart" aria-label="Back to cart">
            <Chevron />
            Cart
          </Link>
        )}
        <p className="wordmark">{otp ? 'Verify' : 'Checkout'}</p>
      </header>
      <main className="guest-main checkout-main">
        {otp ? (
          <form id="otp-form" className="otp-stage" onSubmit={(event) => void verify(event)}>
            <p className="table-stamp">Table {cart.tableCode}</p>
            <h1>The table is waiting</h1>
            <p className="otp-lead">A 6-digit code is on its way to</p>
            <p className="otp-phone">{maskMobile(otp.mobile)}</p>
            <OtpBoxes value={code} onChange={fillCode} />
            {otp.devCode ? (
              <button type="button" className="otp-dev" onClick={() => fillCode(otp.devCode ?? '')}>
                Tap to fill {otp.devCode}
              </button>
            ) : null}
            <button type="button" className="otp-resend" disabled={wait > 0 || busy} onClick={() => void resend()}>
              {wait > 0 ? `Resend in ${wait}s` : 'Send a new code'}
            </button>
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            {cart.totals ? <p className="otp-total">Then we send {formatINR(cart.totals.total)} to the kitchen</p> : null}
          </form>
        ) : (
          <form id="checkout-form" className="check-form" onSubmit={(event) => void start(event)}>
            <p className="table-stamp">Table {cart.tableCode}</p>
            <section className="check-guest">
              <h2>Who’s at the table</h2>
              <Input label="Name" value={name} autoComplete="name" required maxLength={80} onChange={(event) => setName(event.target.value)} />
              <Input label="Mobile number" value={mobile} inputMode="tel" autoComplete="tel" required placeholder="10-digit mobile" onChange={(event) => setMobile(event.target.value)} />
              <Input label="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
              <label className="field">
                <span>Payment method</span>
                <select
                  value={payPref}
                  aria-label="Payment method"
                  onChange={(event) => setPayPref(event.target.value as GuestPaymentPreference)}
                >
                  <option value="DESK">Pay at desk</option>
                  <option value="UPI">UPI online</option>
                  <option value="CARD">Card online</option>
                </select>
              </label>
              {payPref !== 'DESK' && !cart.catalog?.payments?.razorpayKeyId ? (
                <p className="fine">Online pay is not configured — you can still order and pay at the desk.</p>
              ) : null}
            </section>
            <section className="check-order">
              <h2>This order</h2>
              <ul>
                {cart.lineViews.map((line) => {
                  const photo = cart.catalog?.items.find((item) => item.id === line.menuItemId)?.imageUrl;
                  return (
                    <li key={line.lineId}>
                      <figure>
                        {photo ? <img src={photo} alt="" /> : <span className="check-shot" />}
                        {line.quantity > 1 ? <span className="check-qty">{line.quantity}</span> : null}
                      </figure>
                      <strong>{line.name}</strong>
                      {line.addons.length ? <em>{line.addons.map((addon) => addon.name).join(' · ')}</em> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
            {cart.quoteError ? <p className="field-error">{cart.quoteError}</p> : null}
            {error ? <p className="field-error" role="alert">{error}</p> : null}
          </form>
        )}
      </main>
      <footer className="checkout-dock">
        {otp ? (
          <button type="submit" form="otp-form" className="pay-bar" disabled={busy || code.length !== 6} aria-busy={busy}>
            <span>{busy ? 'Placing order…' : 'Place order'}</span>
            {cart.totals ? <span>{formatINR(cart.totals.total)}</span> : null}
          </button>
        ) : (
          <button type="submit" form="checkout-form" className="pay-bar" disabled={busy || !cart.totals} aria-busy={busy}>
            <span>{busy ? 'Sending code…' : 'Place order'}</span>
            {cart.totals ? <span>{formatINR(cart.totals.total)}</span> : null}
          </button>
        )}
      </footer>
    </div>
  );
}

function OtpBoxes({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="otp-boxes" onClick={() => ref.current?.focus()}>
      <label className="sr-only" htmlFor="otp-code">6-digit code</label>
      <input
        id="otp-code"
        ref={ref}
        className="otp-hidden"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className={`otp-cell${value[index] ? ' is-filled' : ''}${value.length === index ? ' is-active' : ''}`}
          aria-hidden="true"
        >
          {value[index] ?? ''}
        </span>
      ))}
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
