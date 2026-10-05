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

export function OrderPage() {
  const { id = '' } = useParams();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useTitle(order ? `Order #${order.orderNumber}` : 'Order');

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
      <header className="guest-bar">
        <p className="wordmark">Order #{order.orderNumber}</p>
      </header>
      <div className="order-hero" role="status">
        <div className="placed-mark" aria-hidden="true">
          <svg viewBox="0 0 72 72">
            <circle className="placed-ring" cx="36" cy="36" r="32" />
            <path className="placed-check" d="M22 37.5 32 47.5 51 26" />
          </svg>
        </div>
        <p className="placed-kicker">{statusMessage(order.status)}</p>
      </div>
      <main className="receipt order-bill">
        <div className="badge-row">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
        <p>Thanks, {order.customerName}. The cafe has your order.</p>
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
      <Link className="pay-bar" to={`/menu${order.tableName ? `?table=${encodeURIComponent(order.tableName)}` : ''}`}>
        <span>Back to menu</span>
      </Link>
    </div>
  );
}
