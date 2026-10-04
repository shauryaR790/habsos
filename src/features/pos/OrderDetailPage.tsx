import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { canTransition, formatINR, formatWhen, maskMobile, PAYMENT_METHODS, type OrderStatus, type PaymentMethod } from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { PaymentBadge } from '../../components/PaymentBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { usePos } from './PosContext';

const ACTIONS: { label: string; status: OrderStatus }[] = [
  { label: 'Ready', status: 'READY' },
  { label: 'Served', status: 'SERVED' },
  { label: 'Complete', status: 'COMPLETED' },
];

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const pos = usePos();
  const order = pos.orders.find((entry) => entry.id === id) ?? null;
  const [cancel, setCancel] = useState(false);
  useTitle(order ? `Order #${order.orderNumber || 'new'}` : 'Order');
  if (!order) return <EmptyState title="Order not on this device" body="It may still be syncing, or the link is old." />;
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <article className="detail">
      <div className="kot" id="kot">
        <p className="kicker">KOT #{order.orderNumber || '—'}</p>
        <h1>{order.tableName ? `Table ${order.tableName}` : 'No table'}</h1>
        <p>Customer: {order.customerName}</p>
        {order.customerMobile ? <p>Mobile: {maskMobile(order.customerMobile)}</p> : null}
        <p>Time: {formatWhen(order.createdAt)}</p>
        <ul className="ticket-items">
          {order.items.map((item) => (
            <li key={item.id}>
              <strong>{item.quantity} × {item.nameSnapshot}</strong>
              {item.addons.length ? <ul>{item.addons.map((addon) => <li key={addon.id}>{addon.nameSnapshot}</li>)}</ul> : null}
              {item.notes ? <p className="note">Note: {item.notes}</p> : null}
            </li>
          ))}
        </ul>
        <p className="units">Total items: {units}</p>
        <p className="price">{formatINR(order.total)}</p>
        <div className="badge-row">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
      </div>
      <div className="stack no-print">
        <div className="row-actions">
          {ACTIONS.filter((action) => canTransition(order.status, action.status)).map((action) => (
            <Button key={action.status} onClick={() => void pos.setStatus(order.id, action.status)}>{action.label}</Button>
          ))}
          {canTransition(order.status, 'CANCELLED') ? <Button variant="danger" onClick={() => setCancel(true)}>Cancel</Button> : null}
          <Button variant="ghost" onClick={() => window.print()}>Print KOT</Button>
        </div>
        {order.paymentStatus === 'UNPAID' && order.status !== 'CANCELLED' && order.status !== 'OTP_PENDING' ? (
          <div className="pay-row">
            {PAYMENT_METHODS.map((method) => (
              <Button key={method} variant="ghost" onClick={() => void pos.pay(order.id, method as PaymentMethod)}>{method}</Button>
            ))}
          </div>
        ) : null}
        <section>
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
        <Link className="text-link" to="/pos/orders">All orders</Link>
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
