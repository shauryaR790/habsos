import { useEffect, useState } from 'react';
import { BOARD_COLUMNS, PAYMENT_METHODS, type OrderStatus, type PaymentMethod } from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { OrderTicket } from '../../components/OrderTicket';
import { usePos } from './PosContext';

const NEXT: Partial<Record<OrderStatus, { label: string; status: OrderStatus }>> = {
  CONFIRMED: { label: 'Ready', status: 'READY' },
  ACCEPTED: { label: 'Ready', status: 'READY' },
  PREPARING: { label: 'Ready', status: 'READY' },
  READY: { label: 'Served', status: 'SERVED' },
};

export function BoardPage() {
  useTitle('Board');
  const pos = usePos();
  const [now, setNow] = useState(Date.now());
  const [paying, setPaying] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section>
      <h1 className="sr-only">Order board</h1>
      <div className="board">
        {BOARD_COLUMNS.map((column) => {
          const tickets = pos.orders
            .filter((order) => (column.statuses as readonly string[]).includes(order.status))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          return (
            <section key={column.id} className="board-col" data-col={column.id} aria-label={column.title}>
              <header>
                <h2>{column.title}</h2>
                <span>{tickets.length}</span>
              </header>
              {tickets.length === 0 ? <EmptyState title="Clear" body={column.id === 'NEW' ? 'No new orders.' : 'Nothing is waiting to be served.'} /> : null}
              {tickets.map((order) => {
                const next = NEXT[order.status];
                return (
                  <OrderTicket
                    key={order.id}
                    order={order}
                    now={now}
                    actions={
                      <>
                        {next ? (
                          <Button full onClick={() => void pos.setStatus(order.id, next.status)}>
                            {next.label}
                          </Button>
                        ) : null}
                        {order.paymentStatus === 'UNPAID' ? (
                          paying === order.id ? (
                            <div className="pay-row">
                              {PAYMENT_METHODS.map((method) => (
                                <Button key={method} variant="ghost" onClick={() => void pos.pay(order.id, method as PaymentMethod)}>
                                  {method}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <Button variant="ghost" full onClick={() => setPaying(order.id)}>Mark paid</Button>
                          )
                        ) : null}
                      </>
                    }
                  />
                );
              })}
            </section>
          );
        })}
      </div>
    </section>
  );
}
