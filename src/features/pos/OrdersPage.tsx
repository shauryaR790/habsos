import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatINR, formatTime, OPEN_STATUSES } from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { EmptyState } from '../../components/EmptyState';
import { PaymentBadge } from '../../components/PaymentBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { usePos } from './PosContext';

const FILTERS = ['Open', 'Unpaid', 'All'] as const;

export function OrdersPage() {
  useTitle('Orders');
  const pos = usePos();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Open');
  const [query, setQuery] = useState('');
  const orders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pos.orders.filter((order) => {
      if (filter === 'Open' && !OPEN_STATUSES.includes(order.status)) return false;
      if (filter === 'Unpaid' && (order.paymentStatus !== 'UNPAID' || order.status === 'CANCELLED' || order.status === 'OTP_PENDING')) return false;
      if (!needle) return true;
      return `${order.orderNumber} ${order.customerName} ${order.tableName ?? ''}`.toLowerCase().includes(needle);
    });
  }, [filter, pos.orders, query]);

  return (
    <section className="stack">
      <h1>Orders</h1>
      <div className="filters" role="tablist">
        {FILTERS.map((item) => (
          <button key={item} type="button" className={filter === item ? 'cat-btn active' : 'cat-btn'} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>
      <label className="field">
        <span>Search</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Number, name, or table" />
      </label>
      {orders.length === 0 ? <EmptyState title="No orders" body="Nothing matches this view." /> : null}
      <div className="order-list">
        {orders.map((order) => (
          <Link key={order.id} className="order-row" to={`/pos/orders/${order.id}`}>
            <strong>#{order.orderNumber || '—'}</strong>
            <span>{order.tableName ? `Table ${order.tableName}` : 'No table'}</span>
            <span>{order.customerName}</span>
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
            <span className="price">{formatINR(order.total)}</span>
            <time>{formatTime(order.createdAt)}</time>
          </Link>
        ))}
      </div>
    </section>
  );
}
