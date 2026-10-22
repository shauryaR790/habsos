import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatINR, maskMobile, normalizeMobile, taxLabel, type GuestPaymentPreference, type PublicOrder } from '../../../shared/domain';
import { Modal } from '../../components/Modal';
import { GuestHeader } from './GuestHeader';
import { TableScanner } from './TableScanner';
import { collectRazorpayPayment } from '../../lib/razorpayCheckout';
import { api, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { Input } from '../../components/Input';
import { useCart, type Bootstrap } from './cart';
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
  const [payPref, setPayPref] = useState<GuestPaymentPreference>('DESK');
  const [address, setAddress] = useState('');
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const tax = cart.catalog?.cafe.taxBps ?? 500;

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

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const menuHref = `/menu${cart.tableCode ? `?table=${encodeURIComponent(cart.tableCode)}` : ''}`;

  if (!cart.tableCode || cart.lines.length === 0) {
    return (
      <div className="guest guest-flow-compact cart-screen checkout-screen ad-guest-cart checkout-screen-empty cart-screen-empty">
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
            <Chevron />
            Menu
          </Link>
          <p className="wordmark">Checkout</p>
        </header>
        <main className="guest-main checkout-main">
          <div className="cart-empty-stack">
            <div className="cart-empty">
              <div className="cart-empty-sticker">
                <img src="/ad/brew-sticker-1.png" alt="" width={220} height={220} decoding="async" />
              </div>
              <h2>Nothing to check out</h2>
            </div>
          </div>
        </main>
        <Link className="pay-bar cart-empty-foot" to={menuHref}>
          <span>Back to menu</span>
        </Link>
        <Modal open={scanning} title="Scan table" onClose={() => setScanning(false)}>
          {scanning ? <TableScanner onTable={onTable} /> : null}
        </Modal>
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
    navigate(`/order/${order.id}`, { replace: true });
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

  const orderList = (
    <ul>
      {cart.lineViews.map((line) => {
        const photo = cart.catalog?.items.find((item) => item.id === line.menuItemId)?.imageUrl;
        return (
          <li key={line.lineId}>
            <figure>
              {photo ? <img src={photo} alt="" /> : <span className="check-shot" />}
              {line.quantity > 1 ? <span className="check-qty">{line.quantity}</span> : null}
            </figure>
            <div className="check-line-copy">
              <strong>{line.name}</strong>
              {line.addons.length ? <em>{line.addons.map((addon) => addon.name).join(' · ')}</em> : null}
              {line.total != null ? <span className="check-line-price">{formatINR(line.total)}</span> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={`guest guest-flow-compact cart-screen checkout-screen ad-guest-cart${otp ? ' checkout-screen-otp' : ''}`}>
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
      <div className="checkout-layout">
        <main className="guest-main checkout-main">
          <header className="checkout-page-head">
            <h1 className="checkout-page-title">{otp ? 'Verify your mobile' : 'Checkout'}</h1>
            {cart.tableCode ? <p className="checkout-page-meta">Table {cart.tableCode}</p> : null}
          </header>
          {otp ? (
            <form id="otp-form" className="otp-stage" onSubmit={(event) => void verify(event)}>
              <div className="otp-core">
                <h1>The table is waiting</h1>
                <p className="otp-kicker">
                  Six digits to <span className="otp-phone">{maskMobile(otp.mobile)}</span>
                </p>
                <OtpBoxes value={code} onChange={fillCode} />
                {otp.devCode ? (
                  <button type="button" className="otp-dev" onClick={() => fillCode(otp.devCode ?? '')}>
                    Tap to fill {otp.devCode}
                  </button>
                ) : null}
                {error ? <p className="field-error" role="alert">{error}</p> : null}
                <button type="button" className="otp-resend" disabled={wait > 0 || busy} onClick={() => void resend()}>
                  {wait > 0 ? `New code in ${wait}s` : 'Send another code'}
                </button>
              </div>
              <div className="otp-mural" aria-hidden="true">
                <img className="otp-mural-sticker" src="/ad/hero-sticker-nametag.png" alt="" width={158} height={158} decoding="async" />
                <img className="otp-mural-sticker otp-mural-sticker--brew" src="/ad/brew-sticker-1.png" alt="" width={220} height={220} decoding="async" />
                <img className="otp-mural-sticker" src="/ad/hero-sticker-heart.png" alt="" width={118} height={118} decoding="async" />
              </div>
              <button
                type="submit"
                className="pay-bar checkout-desktop-cta"
                disabled={busy || code.length !== 6}
                aria-busy={busy}
              >
                <span>{busy ? 'Placing order…' : 'Place order'}</span>
                {cart.totals ? <span>{formatINR(cart.totals.total)}</span> : null}
              </button>
            </form>
          ) : (
            <form id="checkout-form" className="check-form" onSubmit={(event) => void start(event)}>
              <p className="table-stamp checkout-table-mobile">Table {cart.tableCode}</p>
              <section className="check-guest">
                <h2>Who’s at the table</h2>
                <Input label="Name" value={name} autoComplete="name" required maxLength={80} onChange={(event) => setName(event.target.value)} />
                <Input label="Mobile number" value={mobile} inputMode="tel" autoComplete="tel" required placeholder="10-digit mobile" onChange={(event) => setMobile(event.target.value)} />
                <div className="check-guest-optional">
                  <Input label="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
                </div>
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
              <section className="check-order checkout-order-mobile" aria-label="This order">
                <h2>This order</h2>
                {orderList}
              </section>
              {cart.quoteError ? <p className="field-error">{cart.quoteError}</p> : null}
              {error ? <p className="field-error" role="alert">{error}</p> : null}
            </form>
          )}
        </main>
        {!otp ? (
          <aside className="checkout-summary" aria-label="Order summary">
            <section className="check-order">
              <h2 className="checkout-summary-title">This order</h2>
              {orderList}
            </section>
            {cart.totals ? (
              <footer className="cart-dock checkout-totals">
                <dl>
                  <div><dt>Subtotal</dt><dd>{formatINR(cart.totals.subtotal)}</dd></div>
                  {cart.totals.discount > 0 ? <div><dt>Discount</dt><dd>−{formatINR(cart.totals.discount)}</dd></div> : null}
                  <div><dt>Tax ({taxLabel(tax)})</dt><dd>{formatINR(cart.totals.tax)}</dd></div>
                  <div className="grand"><dt>Total</dt><dd>{formatINR(cart.totals.total)}</dd></div>
                </dl>
              </footer>
            ) : null}
            <button
              type="submit"
              form="checkout-form"
              className="pay-bar checkout-desktop-cta"
              disabled={busy || !cart.totals}
              aria-busy={busy}
            >
              <span>{busy ? 'Sending code…' : 'Place order'}</span>
              {cart.totals ? <span>{formatINR(cart.totals.total)}</span> : null}
            </button>
          </aside>
        ) : null}
      </div>
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
      <Modal open={scanning} title="Scan table" onClose={() => setScanning(false)}>
        {scanning ? <TableScanner onTable={onTable} /> : null}
      </Modal>
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
