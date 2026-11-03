import {
  dueTotal,
  formatAge,
  formatINR,
  noteValue,
  orderChannel,
  orderFlag,
  paidTotal,
  tableLabel,
  type Order,
  type PaymentMethod,
} from '../../shared/domain';

const LATE_MINUTES = 10;
const SYSTEM_NOTE = /^(MODE|COVER|CAPTAIN|SPLIT|PARENT|HOLD|DUE|COMPLIMENTARY)(:|$)/i;

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  OTHER: 'Other',
};

export function isPaid(order: Order) {
  return order.paymentStatus === 'PAID';
}

export function StateTag({ order }: { order: Order }) {
  if (order.status === 'CANCELLED') return <span className="state-tag is-void">Cancelled</span>;
  if (isPaid(order)) return <span className="state-tag is-paid">Paid</span>;
  if (paidTotal(order) > 0 && dueTotal(order) > 0) return <span className="state-tag is-part">Part</span>;
  if (orderFlag(order.notes, 'DUE')) return <span className="state-tag is-due">Due</span>;
  if (orderFlag(order.notes, 'HOLD')) return <span className="state-tag is-hold">Held</span>;
  if (order.status === 'SERVED') return <span className="state-tag is-print">Printed</span>;
  if (order.status === 'READY' || order.status === 'PREPARING') return <span className="state-tag is-kot">KOT</span>;
  return <span className="state-tag is-new">New</span>;
}

function hangTone(order: Order) {
  if (paidTotal(order) > 0 && dueTotal(order) > 0) return 'part';
  if (orderFlag(order.notes, 'DUE')) return 'due';
  if (orderFlag(order.notes, 'HOLD')) return 'hold';
  if (order.status === 'SERVED') return 'print';
  if (order.status === 'READY' || order.status === 'PREPARING') return 'kot';
  return 'new';
}

function hangingTitle(order: Order) {
  const channel = orderChannel(order);
  if (order.tableName) return tableLabel(order.tableName);
  if (channel === 'delivery') return 'Delivery';
  return 'Pick Up';
}

function kitchenNotes(notes: string) {
  return notes
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line && !SYSTEM_NOTE.test(line));
}

export function OrderLines({ order }: { order: Order }) {
  return (
    <ul className="ticket-items">
      {order.items.map((item) => (
        <li key={item.id}>
          <b>{item.quantity}×</b>
          <span>
            {item.nameSnapshot}
            {item.addons.length ? (
              <span className="specs">
                {item.addons.map((addon) => <i key={addon.id}>{addon.nameSnapshot}</i>)}
              </span>
            ) : null}
            {item.notes ? <strong className="ticket-note">{item.notes}</strong> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function OrderCard({
  order,
  now,
  onOpen,
  onSettle,
  onKot,
  onPrint,
}: {
  order: Order;
  now: number;
  onOpen: () => void;
  onSettle: () => void;
  onKot: () => void;
  onPrint: () => void;
}) {
  const paid = isPaid(order);
  const waiting = Math.floor((now - new Date(order.createdAt).getTime()) / 60000);
  const late = !paid && order.status !== 'CANCELLED' && waiting >= LATE_MINUTES;
  const remainder = dueTotal(order);
  const covers = noteValue(order.notes, 'COVER');
  const captain = noteValue(order.notes, 'CAPTAIN');
  const notes = kitchenNotes(order.notes);

  return (
    <article
      className={`hang hang-${hangTone(order)} motion-card${late ? ' is-late' : ''}`}
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <i className="hang-pin" aria-hidden="true" />
      <header className="hang-top">
        <strong className="hang-table">{hangingTitle(order)}</strong>
        <StateTag order={order} />
      </header>

      <p className="hang-meta">
        <span>{order.orderNumber ? `#${order.orderNumber}` : 'Unsynced'}</span>
        <span>{order.customerName || 'Walk-in'}</span>
        {covers ? <span>{covers} covers</span> : null}
        {captain ? <span>{captain}</span> : null}
        <span className={late ? 'hang-age is-late' : 'hang-age'}>{formatAge(order.createdAt, now)}</span>
      </p>

      <div className="hang-body">
        <OrderLines order={order} />
        {notes.map((note) => (
          <p key={note} className="ticket-note">{note}</p>
        ))}
      </div>

      <footer className="hang-foot">
        <div className="hang-total">
          <strong className="price">{formatINR(remainder)}</strong>
          {remainder !== order.total ? <small>of {formatINR(order.total)}</small> : null}
        </div>
        <div className="run-acts">
          <button type="button" onClick={(event) => { event.stopPropagation(); onKot(); }}>KOT</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onPrint(); }}>Print</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onSettle(); }}>Settle</button>
        </div>
      </footer>
    </article>
  );
}
