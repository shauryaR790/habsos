import { formatINR, formatWhen, PAYMENT_METHODS, type PaymentMethod } from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { usePos } from './PosContext';

export function PaymentsPage() {
  useTitle('Payments');
  const pos = usePos();
  const unpaid = pos.orders.filter((order) => order.paymentStatus === 'UNPAID' && !['CANCELLED', 'OTP_PENDING', 'DRAFT'].includes(order.status));
  const paid = pos.orders.flatMap((order) => order.payments.map((payment) => ({ payment, order }))).sort((a, b) => b.payment.createdAt.localeCompare(a.payment.createdAt));
  return (
    <section className="stack">
      <h1>Payments</h1>
      <h2>Unpaid</h2>
      {unpaid.length === 0 ? <EmptyState title="No unpaid orders" /> : null}
      {unpaid.map((order) => (
        <article key={order.id} className="admin-row">
          <div>
            <strong>#{order.orderNumber || '—'} · {order.tableName ?? 'No table'}</strong>
            <span>{order.customerName}</span>
            <span className="price">{formatINR(order.total)}</span>
          </div>
          <div className="pay-row">
            {PAYMENT_METHODS.map((method) => (
              <Button key={method} variant="ghost" onClick={() => void pos.pay(order.id, method as PaymentMethod)}>{method}</Button>
            ))}
          </div>
        </article>
      ))}
      <h2>Recorded</h2>
      {paid.length === 0 ? <p>No payments on this device yet.</p> : null}
      <ul className="plain-list">
        {paid.map(({ payment, order }) => (
          <li key={payment.id}>
            <span>{payment.method} · #{order.orderNumber || '—'} · {order.customerName}</span>
            <span>{formatINR(payment.amount)} · {formatWhen(payment.createdAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
