import { useNavigate } from 'react-router-dom';
import {
  dueTotal,
  formatINR,
  formatWhen,
  OPEN_STATUSES,
  paidTotal,
  PAYMENT_METHODS,
  registerPath,
  startOfZonedDay,
  type PaymentMethod,
} from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { pushToast } from '../../components/Toast';
import { collectRazorpayPayment } from '../../lib/razorpayCheckout';
import { usePos } from './PosContext';

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  OTHER: 'Other',
};

export function PaymentsPage() {
  useTitle('Payments');
  const pos = usePos();
  const navigate = useNavigate();
  const dayStart = startOfZonedDay(pos.cafe?.timezone ?? 'Asia/Kolkata').toISOString();

  const unpaid = pos.orders
    .filter((order) => order.paymentStatus === 'UNPAID' && OPEN_STATUSES.includes(order.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const due = unpaid.reduce((sum, order) => sum + dueTotal(order), 0);

  const taken = pos.orders
    .flatMap((order) => order.payments.map((payment) => ({ payment, order })))
    .filter((row) => row.payment.createdAt >= dayStart)
    .sort((a, b) => b.payment.createdAt.localeCompare(a.payment.createdAt));
  const collected = taken.reduce((sum, row) => sum + row.payment.amount, 0);

  return (
    <section className="pos-page">
      <header className="page-head">
        <h1>Payments</h1>
      </header>

      <div className="money-grid">
        <article className="money-tile">
          <span>To collect</span>
          <strong>{formatINR(due)}</strong>
          <small>{unpaid.length} {unpaid.length === 1 ? 'order' : 'orders'}</small>
        </article>
        <article className="money-tile is-good">
          <span>Collected today</span>
          <strong>{formatINR(collected)}</strong>
          <small>{taken.length} {taken.length === 1 ? 'payment' : 'payments'}</small>
        </article>
      </div>

      <h2>To collect</h2>
      {unpaid.length === 0 ? (
        <EmptyState title="Nothing due" body="Every open order has been paid for." />
      ) : (
        <div className="due-list">
          {unpaid.map((order) => {
            const owed = dueTotal(order);
            const takenAmt = paidTotal(order);
            return (
              <article key={order.id} className={`due-card${takenAmt > 0 ? ' is-part' : ''}`}>
                <button
                  type="button"
                  className="due-open"
                  onClick={() => navigate(registerPath({
                    tableId: order.tableId,
                    orderId: order.id,
                    mode: order.tableId ? 'dine' : 'pickup',
                  }))}
                >
                  <strong>{order.tableName || 'Pick Up'}</strong>
                  <span>{order.orderNumber ? `#${order.orderNumber}` : 'Not synced'} · {order.customerName}</span>
                  <b className="due-total price">{formatINR(owed)}</b>
                  {takenAmt > 0 ? <small>of {formatINR(order.total)}</small> : null}
                </button>
                <div className="pay-methods">
                  {PAYMENT_METHODS.map((method) => (
                    <Button key={method} variant="ghost" onClick={() => void pos.pay(order.id, method as PaymentMethod)}>
                      {METHOD_LABEL[method as PaymentMethod]}
                    </Button>
                  ))}
                  {pos.payments.razorpayKeyId ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        void collectRazorpayPayment({
                          orderId: order.id,
                          amountInr: owed,
                          customerName: order.customerName,
                          customerMobile: order.customerMobile,
                        }).then(() => {
                          pushToast('Paid online');
                          return pos.refresh();
                        }).catch((err) => pushToast(err instanceof Error ? err.message : 'Payment failed', 'err'));
                      }}
                    >
                      UPI online
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <h2>Taken today</h2>
      {taken.length === 0 ? (
        <p className="fine">No payments recorded on this device today.</p>
      ) : (
        <div className="took-list">
          {taken.map(({ payment, order }) => (
            <p key={payment.id} className="took-row">
              <strong>{METHOD_LABEL[payment.method]}</strong>
              <span>
                {order.tableName ?? 'No table'} · {order.customerName}
              </span>
              <span className="price">{formatINR(payment.amount)}</span>
              <time dateTime={payment.createdAt}>{formatWhen(payment.createdAt)}</time>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
