import { formatINR, type TableInfo } from '../../shared/domain';
import { PaymentBadge } from './PaymentBadge';

export function TableCard({ table, onOpen }: { table: TableInfo; onOpen: (table: TableInfo) => void }) {
  return (
    <button type="button" className={`table-card ${table.status === 'OCCUPIED' ? 'busy' : ''}`} onClick={() => onOpen(table)}>
      <span className="table-name">{table.name}</span>
      <span className="badge">{table.status === 'OCCUPIED' ? 'Occupied' : 'Available'}</span>
      {table.openOrder ? (
        <span className="table-order">
          #{table.openOrder.orderNumber} · {table.openOrder.customerName}
          <br />
          {formatINR(table.openOrder.total)} <PaymentBadge status={table.openOrder.paymentStatus} />
        </span>
      ) : (
        <span className="table-order">No open order</span>
      )}
    </button>
  );
}
