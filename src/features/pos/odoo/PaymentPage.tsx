import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { dueTotal, formatOdooINR, noteValue, OPEN_STATUSES, type Order, type PaymentMethod } from '../../../../shared/domain';
import { pushToast } from '../../../components/Toast';
import { api } from '../../../lib/api';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';

type PayMethod = PaymentMethod | 'ACCOUNT';
type LocationState = { order?: Order } | null;

function CashIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 10v4M18 10v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 15h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10h16v9H4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 10V8a4 4 0 018 0v2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 14v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3h8l4 4v14H7V3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M15 3v4h4M10 12h6M10 16h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

const METHODS: { id: PayMethod; label: string; Icon: () => ReactElement }[] = [
  { id: 'CASH', label: 'Cash', Icon: CashIcon },
  { id: 'CARD', label: 'Card', Icon: CardIcon },
  { id: 'ACCOUNT', label: 'Customer Account', Icon: AccountIcon },
];

function splitAmount(value: number) {
  const formatted = formatOdooINR(value);
  const match = formatted.match(/^(₹\s*[\d,]+)(\.\d{2})$/);
  if (!match) return { whole: formatted, cents: '' };
  return { whole: match[1], cents: match[2] };
}

function isPayable(order: Order) {
  return order.paymentStatus !== 'PAID'
    && order.status !== 'CANCELLED'
    && (OPEN_STATUSES.includes(order.status) || order.paymentStatus === 'UNPAID');
}

export function PaymentPage() {
  useTitle('Payment');
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const { orders, pay } = usePos();
  const stateOrder = (location.state as LocationState)?.order ?? null;

  const dueOrders = useMemo(
    () => orders.filter(isPayable).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [orders],
  );

  const matched = useMemo(() => {
    if (orderId) {
      return orders.find((o) => o.id === orderId)
        ?? (stateOrder?.id === orderId ? stateOrder : null)
        ?? null;
    }
    if (stateOrder && isPayable(stateOrder)) return stateOrder;
    if (dueOrders.length === 1) return dueOrders[0];
    return null;
  }, [orderId, orders, stateOrder, dueOrders]);

  const [fetched, setFetched] = useState<Order | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId && !matched));

  useEffect(() => {
    if (matched || !orderId) {
      setLoading(false);
      setFetched(null);
      return;
    }
    let cancel = false;
    setLoading(true);
    void api<{ order: Order }>(`/api/orders/${encodeURIComponent(orderId)}`)
      .then((result) => {
        if (!cancel) setFetched(result.order);
      })
      .catch(() => {
        if (!cancel) setFetched(null);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [orderId, matched]);

  useEffect(() => {
    if (orderId || matched || loading || dueOrders.length !== 1) return;
    navigate(`/pos/app/payment?order=${encodeURIComponent(dueOrders[0].id)}`, {
      replace: true,
      state: { order: dueOrders[0] },
    });
  }, [orderId, matched, loading, dueOrders, navigate]);

  const order = matched ?? fetched;
  const due = order ? dueTotal(order) : 0;
  const [method, setMethod] = useState<PayMethod>('CASH');
  const [lines, setLines] = useState<{ method: string; amount: number }[]>([]);
  const [buffer, setBuffer] = useState('');
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState(false);
  const paid = lines.reduce((s, l) => s + l.amount, 0);
  const remaining = Math.max(0, due - paid);
  const covers = Math.max(1, Number(order ? noteValue(order.notes, 'GUESTS') || noteValue(order.notes, 'COVERS') : 0) || 1);

  const display = useMemo(() => {
    if (buffer) {
      const n = Number(buffer);
      return Number.isFinite(n) ? n : 0;
    }
    return remaining || due;
  }, [buffer, remaining, due]);

  const amountParts = splitAmount(display);
  const perGuest = covers > 0 ? due / covers : due;

  function tapKey(key: string) {
    if (key === 'back') {
      setBuffer((b) => b.slice(0, -1));
      return;
    }
    if (key === '+10' || key === '+20' || key === '+50') {
      const add = Number(key.slice(1));
      setBuffer(String(((Number(buffer) || display || 0) + add).toFixed(2)).replace(/\.00$/, ''));
      return;
    }
    if (key === '+/-') {
      setBuffer((b) => {
        if (!b || b === '0') return b;
        return b.startsWith('-') ? b.slice(1) : `-${b}`;
      });
      return;
    }
    if (key === '.') {
      setBuffer((b) => (b.includes('.') ? b : `${b || '0'}.`));
      return;
    }
    setBuffer((b) => {
      if (b === '0' && key !== '.') return key;
      return `${b}${key}`.slice(0, 12);
    });
  }

  async function validate() {
    if (!order) return;
    const amount = buffer ? Number(buffer) || 0 : remaining || due;
    const toPay = lines.length
      ? lines
      : amount > 0
        ? [{ method: method === 'ACCOUNT' ? 'OTHER' : method, amount }]
        : [{ method: method === 'ACCOUNT' ? 'OTHER' : method, amount: due }];
    setBusy(true);
    try {
      for (const line of toPay) {
        await pay(order.id, line.method as PaymentMethod, line.amount);
      }
      pushToast(invoice ? 'Payment validated · Invoice' : 'Payment validated');
      navigate('/pos/app/tables');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Payment failed.', 'err');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="o-pay o-pay--empty">
        <p>Opening payment…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="o-pay o-pay--empty o-pay--pick">
        <p>{dueOrders.length ? 'Pick an open order to pay' : 'No open order to pay yet.'}</p>
        {dueOrders.length ? (
          <div className="o-pay-pick">
            {dueOrders.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="o-pay-pick__row"
                onClick={() => navigate(`/pos/app/payment?order=${encodeURIComponent(entry.id)}`, { state: { order: entry } })}
              >
                <strong>#{entry.orderNumber || '—'}</strong>
                <span>{entry.tableName || entry.customerName || 'Walk-in'}</span>
                <em>{formatOdooINR(dueTotal(entry))}</em>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="o-btn" onClick={() => navigate('/pos/app/register')}>
            Back to register
          </button>
        )}
      </div>
    );
  }

  const confirmLabel = method === 'CASH' ? 'Cash' : 'Validate';

  return (
    <div className="o-pay">
      <aside className="o-pay__side">
        <div className="o-pay-methods">
          {METHODS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`o-pay-method${method === id ? ' is-active' : ''}`}
              onClick={() => setMethod(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="o-pay__meta">
          <button type="button" className="o-pay__meta-btn">
            <PersonIcon />
            <span>{order.customerName?.trim() || 'Guest'}</span>
          </button>
          <button
            type="button"
            className={`o-pay__meta-btn${invoice ? ' is-on' : ''}`}
            onClick={() => setInvoice((v) => !v)}
          >
            <InvoiceIcon />
            <span>Invoice</span>
          </button>
        </div>

        <div className="o-pay-numpad">
          {(['1', '2', '3', '+10', '4', '5', '6', '+20', '7', '8', '9', '+50', '+/-', '0', '.', 'back'] as const).map((key) => {
            const className =
              key === 'back'
                ? 'o-pay-numpad__key o-pay-numpad__back'
                : key === '+/-'
                  ? 'o-pay-numpad__key o-pay-numpad__sign'
                  : key === '.'
                    ? 'o-pay-numpad__key o-pay-numpad__dot'
                    : key.startsWith('+')
                      ? 'o-pay-numpad__key o-pay-numpad__quick'
                      : 'o-pay-numpad__key';
            return (
              <button
                key={key}
                type="button"
                className={className}
                aria-label={key === 'back' ? 'Backspace' : undefined}
                onClick={() => tapKey(key)}
              >
                {key === 'back' ? (
                  <svg width="28" height="20" viewBox="0 0 28 20" fill="none" aria-hidden>
                    <path d="M10 2h15a2 2 0 012 2v12a2 2 0 01-2 2H10L2 10l8-8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                    <path d="M13 7l6 6M19 7l-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                ) : (
                  key
                )}
              </button>
            );
          })}
        </div>

        <div className="o-pay__actions">
          <button type="button" className="o-pay__back" onClick={() => navigate(-1)}>
            Back
          </button>
          <button
            type="button"
            className={`o-pay__confirm${method === 'CASH' ? ' o-pay__confirm--cash' : ' o-pay__confirm--validate'}`}
            disabled={busy}
            onClick={() => void validate()}
          >
            {confirmLabel}
          </button>
        </div>
      </aside>

      <section className="o-pay-center">
        <div className="o-pay-amount" aria-live="polite">
          <span className="o-pay-amount__whole">{amountParts.whole}</span>
          {amountParts.cents ? <span className="o-pay-amount__cents">{amountParts.cents}</span> : null}
        </div>
        <div className="o-pay-sub">
          {formatOdooINR(perGuest)}
          <span className="o-pay-sub__sep">/</span>
          Guest
          <span className="o-pay-sub__guests">{covers}</span>
        </div>
        {lines.length ? (
          <div className="o-pay-lines">
            {lines.map((line, index) => (
              <div key={`${line.method}-${index}`} className="o-pay-line">
                <span>{line.method}</span>
                <span>{formatOdooINR(line.amount)}</span>
                <button
                  type="button"
                  className="o-pay-line__x"
                  aria-label="Remove payment"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
