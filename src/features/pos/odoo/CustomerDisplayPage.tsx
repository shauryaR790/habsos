import { useMemo } from 'react';
import { formatOdooINR, OPEN_STATUSES } from '../../../../shared/domain';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';

export function CustomerDisplayPage() {
  useTitle('Customer Display');
  const { orders, cafe, ready } = usePos();

  const live = useMemo(() => {
    return orders
      .filter((order) => OPEN_STATUSES.includes(order.status) && order.paymentStatus !== 'PAID')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  }, [orders]);

  if (!ready) {
    return (
      <div className="o-cust-display">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="o-cust-display">
      <header className="o-cust-display__head">
        <strong>{cafe?.name ?? 'Point of Sale'}</strong>
        <span>Customer Display</span>
      </header>
      {live ? (
        <div className="o-cust-display__body">
          <p className="o-cust-display__table">{live.tableName ?? 'Walk-in'}</p>
          <ul className="o-cust-display__lines">
            {live.items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.quantity}× {item.nameSnapshot}
                </span>
                <strong>{formatOdooINR(item.total)}</strong>
              </li>
            ))}
          </ul>
          <div className="o-cust-display__total">
            <span>Total</span>
            <strong>{formatOdooINR(live.total)}</strong>
          </div>
        </div>
      ) : (
        <div className="o-cust-display__empty">
          <p>No open order</p>
          <span>Items will appear here as they are added</span>
        </div>
      )}
    </div>
  );
}
