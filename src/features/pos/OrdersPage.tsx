import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  dueTotal,
  nextTicketStatus,
  OPEN_STATUSES,
  orderFlag,
  paidTotal,
  registerPath,
  maskMobile,
  tableLabel,
  type Order,
} from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { EmptyState } from '../../components/EmptyState';
import { OrderCard } from '../../components/OrderCard';
import { OrderDialog } from '../../components/OrderDialog';
import { printTicket } from '../../lib/printTicket';
import { pushToast } from '../../components/Toast';
import { usePos } from './PosContext';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'kot', label: 'KOT' },
  { id: 'printed', label: 'Printed' },
  { id: 'due', label: 'Due' },
  { id: 'pickup', label: 'Pick Up' },
] as const;

type Filter = (typeof FILTERS)[number]['id'];

function isRunning(order: Order) {
  return order.paymentStatus !== 'PAID' && OPEN_STATUSES.includes(order.status);
}

function matchesFilter(order: Order, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'running') return order.status === 'CONFIRMED' || order.status === 'ACCEPTED';
  if (filter === 'kot') return order.status === 'READY' || order.status === 'PREPARING';
  if (filter === 'printed') return order.status === 'SERVED';
  if (filter === 'due') return dueTotal(order) > 0 && (paidTotal(order) > 0 || orderFlag(order.notes, 'DUE'));
  return !order.tableId;
}

export function OrdersPage() {
  useTitle('Running Orders');
  const pos = usePos();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const running = useMemo(
    () => pos.orders.filter(isRunning).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.orderNumber - a.orderNumber),
    [pos.orders],
  );
  const counts = {
    all: running.length,
    running: running.filter((order) => matchesFilter(order, 'running')).length,
    kot: running.filter((order) => matchesFilter(order, 'kot')).length,
    printed: running.filter((order) => matchesFilter(order, 'printed')).length,
    due: running.filter((order) => matchesFilter(order, 'due')).length,
    pickup: running.filter((order) => matchesFilter(order, 'pickup')).length,
  };

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return running.filter((order) => {
      if (!matchesFilter(order, filter)) return false;
      if (!needle) return true;
      return (
        String(order.orderNumber).includes(needle)
        || order.customerName.toLowerCase().includes(needle)
        || tableLabel(order.tableName ?? '').toLowerCase().includes(needle)
        || (order.tableName ?? '').toLowerCase().includes(needle)
      );
    });
  }, [filter, query, running]);

  const opened = pos.orders.find((order) => order.id === openId) ?? null;
  const taxBps = pos.cafe?.taxBps ?? 500;
  const cafeName = pos.cafe?.name ?? 'After Dunes';

  function openRegister(order: Order) {
    navigate(registerPath({
      tableId: order.tableId,
      orderId: order.id,
      mode: order.tableId ? 'dine' : 'pickup',
    }));
  }

  function kitchen(order: Order) {
    printTicket(order, 'kot', taxBps, cafeName);
    const to = nextTicketStatus(order.status, 'kot');
    if (to) void pos.setStatus(order.id, to);
    pushToast('KOT sent');
  }

  function bill(order: Order) {
    const ok = printTicket(order, 'bill', taxBps, cafeName);
    const to = nextTicketStatus(order.status, 'print');
    if (to) void pos.setStatus(order.id, to);
    if (!ok) pushToast('Allow pop-ups to print the bill.', 'err');
    else pushToast('Bill printed');
  }

  return (
    <section className="pos-page run">
      <header className="page-head">
        <h1>Running Orders</h1>
        <span className="run-count">{running.length} open</span>
      </header>

      <div className="list-tools">
        <label className="search">
          <span className="sr-only">Search running orders</span>
          <input
            value={query}
            placeholder="Bill, table or name"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="seg" role="group" aria-label="Filter running orders">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={filter === entry.id ? 'seg-btn active' : 'seg-btn'}
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
              <span className="seg-count">{counts[entry.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={query ? 'No match' : 'No running orders'}
          body={query ? 'No open order matches that search.' : 'Save or KOT a ticket and it stays here until it is paid.'}
        />
      ) : (
        <div className="run-board">
          {rows.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              onOpen={() => openRegister(order)}
              onSettle={() => setOpenId(order.id)}
              onKot={() => kitchen(order)}
              onPrint={() => bill(order)}
            />
          ))}
        </div>
      )}

      <OrderDialog
        order={opened}
        now={now}
        taxBps={taxBps}
        cafeName={cafeName}
        onPay={(method) => {
          if (opened) void pos.pay(opened.id, method);
        }}
        onStatus={(status) => {
          if (opened) void pos.setStatus(opened.id, status);
        }}
        onClose={() => setOpenId(null)}
      />
    </section>
  );
}
