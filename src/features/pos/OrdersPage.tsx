import { useState } from 'react';
import { canTransition, formatINR, PAYMENT_METHODS, type OrderStatus, type PaymentMethod } from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { PaymentBadge } from '../../components/PaymentBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { usePos } from './PosContext';

const ACTIONS: { label: string; status: OrderStatus }[] = [
  { label: 'Ready', status: 'READY' },
  { label: 'Served', status: 'SERVED' },
  { label: 'Complete', status: 'COMPLETED' },
];

export function OrdersPage() {
  useTitle('Orders');
  const pos = usePos();
  const [tableId, setTableId] = useState<string | null>(null);
  const table = pos.tables.find((entry) => entry.id === tableId) ?? null;
  const order = table?.openOrder ? pos.orders.find((entry) => entry.id === table.openOrder?.id) ?? null : null;

  return (
    <section className="stack">
      <h1>Orders</h1>
      <div className="floor">
        {pos.tables.map((entry) => {
          const open = entry.openOrder;
          const tone = !open ? 'empty' : open.paymentStatus === 'PAID' ? 'paid' : 'unpaid';
          return (
            <button key={entry.id} type="button" className={`floor-table ${tone}`} onClick={() => setTableId(entry.id)}>
              <strong>{entry.name}</strong>
              <span className="floor-no">{open ? `#${open.orderNumber || '—'}` : 'Free'}</span>
            </button>
          );
        })}
      </div>
      <Drawer open={Boolean(table)} title={table?.name ?? 'Table'} onClose={() => setTableId(null)}>
        {!table ? null : !order ? (
          <p>No open order at this table.</p>
        ) : (
          <div className="stack">
            <div className="badge-row">
              <StatusBadge status={order.status} />
              <PaymentBadge status={order.paymentStatus} />
            </div>
            <p>{order.customerName}</p>
            <ul className="ticket-items">
              {order.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.quantity} × {item.nameSnapshot}</strong>
                  {item.addons.length ? <ul>{item.addons.map((addon) => <li key={addon.id}>{addon.nameSnapshot}</li>)}</ul> : null}
                </li>
              ))}
            </ul>
            <p className="price">{formatINR(order.total)}</p>
            <div className="row-actions">
              {ACTIONS.filter((action) => canTransition(order.status, action.status)).map((action) => (
                <Button key={action.status} onClick={() => void pos.setStatus(order.id, action.status)}>{action.label}</Button>
              ))}
              {canTransition(order.status, 'CANCELLED') ? (
                <Button variant="danger" onClick={() => void pos.setStatus(order.id, 'CANCELLED')}>Cancel</Button>
              ) : null}
            </div>
            {order.paymentStatus === 'UNPAID' && order.status !== 'CANCELLED' ? (
              <div className="pay-row">
                {PAYMENT_METHODS.map((method) => (
                  <Button key={method} variant="ghost" onClick={() => void pos.pay(order.id, method as PaymentMethod)}>{method}</Button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </Drawer>
    </section>
  );
}
