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
      <div className="pay-list">
        {unpaid.map((order) => (
          <article key={order.id} className="pay-card">
            <div className="name-row">
              <strong>#{order.orderNumber || '—'}</strong>
              <span>{order.tableName ? `Table ${order.tableName}` : 'No table'} · {order.customerName}</span>
            </div>
            <strong className="price">{formatINR(order.total)}</strong>
            <div className="pay-row">
              {PAYMENT_METHODS.map((method) => (
                <Button key={method} variant="ghost" onClick={() => void pos.pay(order.id, method as PaymentMethod)}>{method}</Button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <h2>Recorded</h2>
      {paid.length === 0 ? <p>No payments on this device yet.</p> : null}
      <div className="pay-list">
        {paid.map(({ payment, order }) => (
          <article key={payment.id} className="pay-card recorded">
            <div className="name-row">
              <strong>{payment.method}</strong>
              <span>#{order.orderNumber || '—'} · {order.customerName}</span>
            </div>
            <span className="price">{formatINR(payment.amount)}</span>
            <span className="fine">{formatWhen(payment.createdAt)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
