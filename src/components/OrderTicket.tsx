import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatAge, formatINR, formatTime, maskMobile, type Order } from '../../shared/domain';
import { PaymentBadge } from './PaymentBadge';
import { StatusBadge } from './StatusBadge';

export function OrderTicket({
  order,
  now,
  actions,
  kot = false,
}: {
  order: Order;
  now: number;
  actions?: ReactNode;
  kot?: boolean;
}) {
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <article className={kot ? 'ticket kot' : 'ticket'}>
      <header className="ticket-head">
        <div>
          <p className="kicker">{kot ? `KOT #${order.orderNumber || '—'}` : 'Order'}</p>
          <h3>
            <Link to={`/pos/orders/${order.id}`}>#{order.orderNumber || '—'}</Link>
          </h3>
        </div>
        <div className="ticket-meta">
          <strong className="table-name">{order.tableName ? `Table ${order.tableName}` : 'No table'}</strong>
          <StatusBadge status={order.status} />
        </div>
      </header>
      <p className="who">
        <span>{order.customerName}</span>
        {kot && order.customerMobile ? <span>{maskMobile(order.customerMobile)}</span> : null}
      </p>
      <ul className="ticket-items">
        {order.items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>
                {item.quantity} × {item.nameSnapshot}
              </strong>
              {item.addons.length ? (
                <ul>
                  {item.addons.map((addon) => (
                    <li key={addon.id}>{addon.nameSnapshot}</li>
                  ))}
                </ul>
              ) : null}
              {item.notes ? <p className="note">Note: {item.notes}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      {kot ? <p className="units">Total items: {units}</p> : null}
      <footer className="ticket-foot">
        <strong className="price">{formatINR(order.total)}</strong>
        <PaymentBadge status={order.paymentStatus} />
        <time dateTime={order.createdAt}>
          {formatTime(order.createdAt)} · {formatAge(order.createdAt, now)}
        </time>
      </footer>
      {order.orderNumber === 0 ? <p className="note">Saved on this device. Waiting to sync.</p> : null}
      {actions ? <div className="ticket-actions">{actions}</div> : null}
    </article>
  );
}
