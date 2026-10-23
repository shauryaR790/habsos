import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatINR, type PublicOrder } from '../../../shared/domain';
import { api, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';

const CONFIRM_MS = 5000;
const EXIT_MS = 580;

export function OrderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!order) return;
    const menuPath = `/menu${order.tableName ? `?table=${encodeURIComponent(order.tableName)}` : ''}`;
    const exitTimer = window.setTimeout(() => setLeaving(true), CONFIRM_MS);
    const navTimer = window.setTimeout(() => {
      navigate(menuPath, { replace: true });
    }, CONFIRM_MS + EXIT_MS);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(navTimer);
    };
  }, [order, navigate]);

  if (loading) {
    return (
      <div className="order-placed-screen order-placed-screen--loading">
        <LoadingState label="Loading order" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="guest narrow stack">
        <EmptyState title="Order unavailable" body={error ?? 'This order could not be loaded.'} />
        <Button onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  return (
    <div
      className={`placed order-placed-screen${leaving ? ' order-placed-screen--leave' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="placed-mark" aria-hidden="true">
        <svg viewBox="0 0 72 72">
          <circle className="placed-ring" cx="36" cy="36" r="32" />
          <path className="placed-check" d="M22 37.5 32 47.5 51 26" />
        </svg>
      </div>
      <h1 className="order-placed-screen-title">Order placed</h1>
      <div className="order-placed-details">
        <p className="order-placed-order-no">
          #{order.orderNumber}
          {order.tableName ? ` · Table ${order.tableName}` : ''}
        </p>
        <ul className="order-placed-lines">
          {order.items.map((item) => (
            <li key={item.id}>
              <span className="order-placed-line">
                {item.quantity} × {item.nameSnapshot}
              </span>
              <span className="order-placed-line-price">{formatINR(item.total)}</span>
            </li>
          ))}
        </ul>
        <p className="order-placed-total">
          Total <span>{formatINR(order.total)}</span>
        </p>
      </div>
    </div>
  );
}
