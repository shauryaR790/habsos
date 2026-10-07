import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  canTransition,
  dueTotal,
  formatINR,
  formatWhen,
  maskMobile,
  nextTicketStatus,
  paidTotal,
  PAYMENT_METHODS,
  taxLabel,
} from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { METHOD_LABEL, OrderLines, StateTag } from '../../components/OrderCard';
import { printTicket } from '../../lib/printTicket';
import { pushToast } from '../../components/Toast';
import { collectRazorpayPayment } from '../../lib/razorpayCheckout';
import { usePos } from './PosContext';

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const pos = usePos();
  const order = pos.orders.find((entry) => entry.id === id) ?? null;
  const [cancel, setCancel] = useState(false);
  useTitle(order ? `Order #${order.orderNumber || 'new'}` : 'Order');
  if (!order) return <EmptyState title="Order not on this device" body="It may still be syncing, or the link is old." />;

  const ticket = order;
  const units = ticket.items.reduce((sum, item) => sum + item.quantity, 0);
  const open = ticket.paymentStatus === 'UNPAID' && !['CANCELLED', 'OTP_PENDING', 'DRAFT'].includes(ticket.status);
  const taxBps = pos.cafe?.taxBps ?? 500;
  const cafeName = pos.cafe?.name ?? 'After Dunes';

  function kitchen() {
    printTicket(ticket, 'kot', taxBps, cafeName);
    const to = nextTicketStatus(ticket.status, 'kot');
    if (to) void pos.setStatus(ticket.id, to);
    pushToast('KOT sent');
  }

  function bill() {
    const ok = printTicket(ticket, 'bill', taxBps, cafeName);
    const to = nextTicketStatus(ticket.status, 'print');
    if (to) void pos.setStatus(ticket.id, to);
    if (!ok) pushToast('Allow pop-ups to print the bill.', 'err');
    else pushToast('Bill printed');
  }

  return (
    <article className="detail">
      <div className="kot" id="kot">
        <header className="kot-head">
          <div>
            <p className="kicker">Order {order.orderNumber ? `#${order.orderNumber}` : 'not synced'}</p>
            <h1>{order.tableName ?? 'No table'}</h1>
          </div>
          <StateTag order={order} />
        </header>
        <p className="fine">
          {order.customerName}
          {order.customerMobile ? ` · ${maskMobile(order.customerMobile)}` : ''}
          {' · '}
          {formatWhen(order.createdAt)}
        </p>
        <OrderLines order={order} />
        <p className="units">{units} {units === 1 ? 'item' : 'items'}</p>
        <div className="totals">
          <div><span>Subtotal</span><span className="price">{formatINR(order.subtotal)}</span></div>
          {order.discount ? <div><span>Discount</span><span className="price">−{formatINR(order.discount)}</span></div> : null}
          <div><span>Tax {taxLabel(taxBps)}</span><span className="price">{formatINR(order.tax)}</span></div>
          <div className="grand"><span>Total</span><span className="price">{formatINR(order.total)}</span></div>
          {order.payments.length ? <div><span>Paid</span><span className="price">{formatINR(paidTotal(order))}</span></div> : null}
          {open ? <div className="grand"><span>Due</span><span className="price">{formatINR(dueTotal(order))}</span></div> : null}
        </div>
      </div>

      <div className="stack no-print">
        <div className="row-actions">
          {open ? <Button onClick={kitchen}>KOT</Button> : null}
          {open || order.paymentStatus === 'PAID' ? <Button variant="ghost" onClick={bill}>{order.status === 'SERVED' || order.paymentStatus === 'PAID' ? 'Reprint bill' : 'Print bill'}</Button> : null}
          {open ? <Button variant="ghost" onClick={() => { void pos.pay(order.id, 'OTHER'); pushToast('Complimentary'); }}>Complimentary</Button> : null}
          {canTransition(order.status, 'CANCELLED') ? <Button variant="danger" onClick={() => setCancel(true)}>Cancel</Button> : null}
        </div>

        <section className="stack">
          <h2>Payment</h2>
          {open ? (
            <div className="pay-methods">
              {PAYMENT_METHODS.map((method) => (
                <Button key={method} onClick={() => void pos.pay(order.id, method)}>
                  {METHOD_LABEL[method]}
                </Button>
              ))}
              {pos.payments.razorpayKeyId ? (
                <Button
                  onClick={() => {
                    void collectRazorpayPayment({
                      orderId: order.id,
                      amountInr: dueTotal(order),
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
          ) : null}
          {order.payments.length ? (
            order.payments.map((payment) => (
              <p key={payment.id} className="fine">
                {METHOD_LABEL[payment.method]} · {formatINR(payment.amount)} · {formatWhen(payment.createdAt)}
              </p>
            ))
          ) : open ? null : (
            <p className="fine">Nothing to collect.</p>
          )}
        </section>

        <section className="stack">
          <h2>Timeline</h2>
          <ol className="timeline">
            {order.events.map((event) => (
              <li key={event.id}>
                <time dateTime={event.createdAt}>{formatWhen(event.createdAt)}</time>
                <strong>{event.message}</strong>
              </li>
            ))}
          </ol>
        </section>

        <Link className="text-link" to="/pos">All orders</Link>
      </div>

      <Modal open={cancel} title="Cancel this order?" onClose={() => setCancel(false)}>
        <p>This cannot be undone from the board.</p>
        <div className="row-actions">
          <Button variant="ghost" onClick={() => setCancel(false)}>Keep it</Button>
          <Button variant="danger" onClick={() => { void pos.setStatus(order.id, 'CANCELLED'); setCancel(false); }}>Cancel order</Button>
        </div>
      </Modal>
    </article>
  );
}
