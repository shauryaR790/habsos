import { Link } from 'react-router-dom';
import {
  dueTotal,
  formatAge,
  formatINR,
  formatWhen,
  maskMobile,
  nextTicketStatus,
  paidTotal,
  PAYMENT_METHODS,
  taxLabel,
  type Order,
  type OrderStatus,
  type PaymentMethod,
} from '../../shared/domain';
import { Button } from './Button';
import { Modal } from './Modal';
import { isPaid, METHOD_LABEL, OrderLines, StateTag } from './OrderCard';
import { printTicket } from '../lib/printTicket';
import { pushToast } from './Toast';

export function OrderDialog({
  order,
  now,
  taxBps,
  cafeName = 'After Dunes',
  onPay,
  onStatus,
  onClose,
}: {
  order: Order | null;
  now: number;
  taxBps: number;
  cafeName?: string;
  onPay: (method: PaymentMethod) => void;
  onStatus?: (status: OrderStatus) => void;
  onClose: () => void;
}) {
  if (!order) return null;
  const ticket = order;
  const paid = isPaid(ticket);
  const payable = !paid && !['CANCELLED', 'OTP_PENDING', 'DRAFT'].includes(ticket.status);

  function kitchen() {
    printTicket(ticket, 'kot', taxBps, cafeName);
    const to = nextTicketStatus(ticket.status, 'kot');
    if (to) onStatus?.(to);
    pushToast('KOT sent');
  }

  function bill() {
    const ok = printTicket(ticket, 'bill', taxBps, cafeName);
    const to = nextTicketStatus(ticket.status, 'print');
    if (to) onStatus?.(to);
    if (!ok) pushToast('Allow pop-ups to print the bill.', 'err');
    else pushToast('Bill printed');
  }

  return (
    <Modal open title={order.orderNumber ? `Order #${order.orderNumber}` : 'Unsynced order'} onClose={onClose}>
      <div className="odlg">
        <header className="odlg-head">
          <strong className="odlg-table">{order.tableName ?? 'Counter'}</strong>
          <StateTag order={order} />
        </header>

        <p className="odlg-who">
          <span>{order.customerName}</span>
          {order.customerMobile ? <span>{maskMobile(order.customerMobile)}</span> : null}
          <span>{formatWhen(order.createdAt)}</span>
          <span>{formatAge(order.createdAt, now)} ago</span>
        </p>

        <OrderLines order={order} />
        {order.notes ? <p className="ticket-note">{order.notes}</p> : null}

        <div className="totals">
          <div><span>Subtotal</span><span className="price">{formatINR(order.subtotal)}</span></div>
          {order.discount ? <div><span>Discount</span><span className="price">−{formatINR(order.discount)}</span></div> : null}
          <div><span>Tax {taxLabel(taxBps)}</span><span className="price">{formatINR(order.tax)}</span></div>
          <div className="grand"><span>{paid ? 'Paid' : 'To collect'}</span><span className="price">{formatINR(paid ? order.total : dueTotal(order))}</span></div>
          {!paid && paidTotal(order) > 0 ? <div><span>Already paid</span><span className="price">{formatINR(paidTotal(order))}</span></div> : null}
        </div>

        {payable ? (
          <section className="odlg-pay">
            <div className="row-actions">
              <Button onClick={kitchen}>KOT</Button>
              <Button variant="ghost" onClick={bill}>Print bill</Button>
            </div>
            <h3>Paid by</h3>
            <div className="pay-methods">
              {PAYMENT_METHODS.map((method) => (
                <Button key={method} onClick={() => { onPay(method); onClose(); }}>
                  {METHOD_LABEL[method]}
                </Button>
              ))}
            </div>
          </section>
        ) : paid && order.payments.length ? (
          <p className="fine">
            {order.payments.map((payment) => `${METHOD_LABEL[payment.method]} · ${formatWhen(payment.createdAt)}`).join(' · ')}
          </p>
        ) : null}

        <Link className="odlg-record" to={`/pos/orders/${order.id}`}>Open full record</Link>
      </div>
    </Modal>
  );
}
