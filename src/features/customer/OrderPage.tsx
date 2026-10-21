import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatINR, formatWhen, statusMessage, type PublicOrder } from '../../../shared/domain';
import { api, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { PaymentBadge } from '../../components/PaymentBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { collectRazorpayPayment } from '../../lib/razorpayCheckout';
import { pushToast } from '../../components/Toast';
export function OrderPage() {
  const { id = '' } = useParams();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [paying, setPaying] = useState(false);
  useTitle(order ? `Order #${order.orderNumber}` : 'Order');

  useEffect(() => {
    void api<{ razorpayKeyId: string }>('/api/payments/config')
      .then((config) => setRazorpayKeyId(config.razorpayKeyId || ''))
      .catch(() => undefined);
  }, []);

  async function load() {
    try {
      const data = await api<{ order: PublicOrder }>(`/api/orders/${id}/public`);
      setOrder(data.order);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Order unavailable.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const source = new EventSource(`/api/orders/${id}/events`);
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type?: string; order?: PublicOrder };
      if (data.type === 'order.upsert' && data.order) setOrder(data.order);
    };
    const poll = window.setInterval(() => {
      if (source.readyState === EventSource.CLOSED) void load();
    }, 12000);
    return () => {
      source.close();
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="guest narrow"><LoadingState label="Loading order" /></div>;
  if (!order) {
    return (
      <div className="guest narrow stack">
        <EmptyState title="Order unavailable" body={error ?? 'This order could not be loaded.'} />
        <Button onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="guest order-screen">
      <header className="guest-bar order-top-bar">
        <p className="wordmark">Order #{order.orderNumber}</p>
      </header>
      <main className="receipt order-bill order-bill-compact" role="status">
        <header className="order-bill-head">
          <div className="order-bill-status">
            <div className="placed-mark order-bill-mark" aria-hidden="true">
              <svg viewBox="0 0 72 72">
                <circle className="placed-ring" cx="36" cy="36" r="32" />
                <path className="placed-check" d="M22 37.5 32 47.5 51 26" />
              </svg>
            </div>
            <div>
              <p className="order-bill-kicker">{statusMessage(order.status)}</p>
              <p className="order-bill-meta">Thanks, {order.customerName}</p>
            </div>
          </div>
          <div className="badge-row order-bill-badges">
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
          </div>
        </header>
        <ul className="receipt-lines">
          {order.items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.quantity} × {item.nameSnapshot}</strong>
                {item.addons.length ? <p>{item.addons.map((addon) => addon.nameSnapshot).join(' · ')}</p> : null}
                {item.notes ? <p className="note">Note: {item.notes}</p> : null}
              </div>
              <span className="price">{formatINR(item.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="totals">
          <div><dt>Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
          {order.discount > 0 ? <div><dt>Discount</dt><dd>−{formatINR(order.discount)}</dd></div> : null}
          <div><dt>Tax</dt><dd>{formatINR(order.tax)}</dd></div>
          <div className="grand"><dt>Total</dt><dd>{formatINR(order.total)}</dd></div>
        </dl>
        <section>
          <h2>Updates</h2>
          <ol className="timeline">
            {order.events.map((event) => (
              <li key={event.id}>
                <time dateTime={event.createdAt}>{formatWhen(event.createdAt)}</time>
                <strong>{event.message}</strong>
              </li>
            ))}
          </ol>
        </section>
        {error ? <p className="field-error">{error}</p> : null}
      </main>
      {order.paymentStatus === 'UNPAID' && razorpayKeyId && order.status !== 'OTP_PENDING' && order.status !== 'CANCELLED' ? (
        <button
          type="button"
          className="pay-bar"
          disabled={paying}
          onClick={() => {
            setPaying(true);
            void collectRazorpayPayment({
              orderId: order.id,
              public: true,
              customerName: order.customerName,
            }).then(() => {
              pushToast('Payment received');
              return load();
            }).catch((err) => pushToast(err instanceof Error ? err.message : 'Payment failed', 'err'))
              .finally(() => setPaying(false));
          }}
        >
          <span>{paying ? 'Opening checkout…' : 'Pay bill online'}</span>
          <span>{formatINR(order.total)}</span>
        </button>
      ) : (
        <Link className="pay-bar" to={`/menu${order.tableName ? `?table=${encodeURIComponent(order.tableName)}` : ''}`}>
          <span>Back to menu</span>
        </Link>
      )}
    </div>
  );
}
