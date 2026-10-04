import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatINR, taxLabel, type PublicOrder } from '../../../shared/domain';
import { api, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useCart } from './cart';

type StartResponse = {
  order: PublicOrder;
  challengeId?: string;
  expiresAt?: string;
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
  const [phase, setPhase] = useState<'details' | 'otp'>('details');
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'send' | 'verify' | 'resend' | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  if (!cart.tableCode || cart.lines.length === 0) {
    return (
      <div className="cust narrow">
        <EmptyCheckout />
      </div>
    );
  }

  async function send() {
    setBusy('send');
    setError(null);
    try {
      const result = await api<StartResponse>('/api/checkout/start', {
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
      setOrder(result.order);
      setDevCode(result.devCode ?? null);
      setSeconds(result.resendAfter ?? 30);
      setPhase('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start checkout.');
      if (err instanceof ApiError && err.code === 'OTP_COOLDOWN' && err.details?.retryAfter) setSeconds(err.details.retryAfter);
    } finally {
      setBusy(null);
    }
  }

  async function verify(nextCode = code) {
    if (!order) return;
    setBusy('verify');
    setError(null);
    try {
      const result = await api<{ order: PublicOrder }>('/api/checkout/verify', {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id, code: nextCode }),
      });
      cart.clear();
      navigate(`/order/${result.order.id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Verification failed.';
      setError(message);
      if (err instanceof ApiError && (err.code === 'OTP_EXPIRED' || err.code === 'OTP_FAILED')) setCode('');
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    if (!order) return;
    setBusy('resend');
    setError(null);
    try {
      const result = await api<StartResponse>('/api/checkout/resend', {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id }),
      });
      setDevCode(result.devCode ?? null);
      setSeconds(result.resendAfter ?? 30);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend the code.');
      if (err instanceof ApiError && err.details?.retryAfter) setSeconds(err.details.retryAfter);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="cust narrow">
      <header className="cust-header">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1>{phase === 'otp' ? 'Verify mobile' : 'Your details'}</h1>
        </div>
        <p className="table-chip">Table {cart.tableCode}</p>
      </header>
      <main className="stack">
        {phase === 'details' ? (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <Input label="Name" value={name} autoComplete="name" required maxLength={80} onChange={(event) => setName(event.target.value)} />
            <Input label="Mobile number" value={mobile} inputMode="tel" autoComplete="tel" required placeholder="10-digit mobile" onChange={(event) => setMobile(event.target.value)} />
            {cart.totals ? <Totals subtotal={cart.totals.subtotal} tax={cart.totals.tax} discount={cart.totals.discount} total={cart.totals.total} taxBps={cart.catalog?.cafe.taxBps ?? 500} /> : null}
            {cart.quoteError ? <p className="field-error">{cart.quoteError}</p> : null}
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <Button type="submit" full disabled={busy === 'send' || !cart.totals} aria-busy={busy === 'send'}>
              {busy === 'send' ? 'Sending code…' : 'Send code'}
            </Button>
          </form>
        ) : (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              void verify();
            }}
          >
            <p>Enter the 6-digit code sent to {mobile}.</p>
            {order ? <Totals subtotal={order.subtotal} tax={order.tax} discount={order.discount} total={order.total} taxBps={cart.catalog?.cafe.taxBps ?? 500} /> : null}
            {import.meta.env.DEV && devCode ? <p className="dev-otp" role="status">Development code {devCode}</p> : null}
            <OtpInput value={code} disabled={busy === 'verify'} onChange={(value) => {
              setCode(value);
              if (value.length === 6) void verify(value);
            }} />
            {error ? <p className="field-error" role="alert">{error}</p> : null}
            <Button type="submit" full disabled={code.length !== 6 || busy === 'verify'} aria-busy={busy === 'verify'}>
              {busy === 'verify' ? 'Checking…' : 'Place order'}
            </Button>
            <Button variant="ghost" full disabled={seconds > 0 || busy === 'resend'} onClick={() => void resend()}>
              {seconds > 0 ? `Resend in ${seconds}s` : busy === 'resend' ? 'Sending…' : 'Resend code'}
            </Button>
          </form>
        )}
        <Link className="text-link" to="/cart">Back to cart</Link>
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

function OtpInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? '');
  function write(next: string) {
    onChange(next.replace(/\D/g, '').slice(0, 6));
  }
  return (
    <div className="otp" role="group" aria-label="One-time code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => { refs.current[index] = node; }}
          className="otp-box"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1}`}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(event) => {
            const text = event.target.value.replace(/\D/g, '');
            if (!text) {
              write(value.slice(0, index) + value.slice(index + 1));
              return;
            }
            if (text.length > 1) {
              const next = (value.slice(0, index) + text).replace(/\D/g, '').slice(0, 6);
              write(next);
              refs.current[Math.min(5, next.length)]?.focus();
              return;
            }
            const next = (value.slice(0, index) + text + value.slice(index + 1)).slice(0, 6);
            write(next);
            refs.current[Math.min(5, index + 1)]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digits[index] && index > 0) refs.current[index - 1]?.focus();
          }}
          onPaste={(event) => {
            event.preventDefault();
            write(event.clipboardData.getData('text'));
            refs.current[5]?.focus();
          }}
        />
      ))}
    </div>
  );
}

function EmptyCheckout() {
  return (
    <main className="stack">
      <h1>Checkout</h1>
      <p>Your cart is empty, or this visit has no table QR.</p>
      <Link className="btn btn-primary" to="/menu">Back to menu</Link>
    </main>
  );
}
