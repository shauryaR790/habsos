import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  buildSalesReport,
  formatINR,
  formatTime,
  formatZonedYmd,
  shiftYmd,
  zonedDayStart,
  zonedHour,
  type OrderChannel,
  type SalesNamed,
  type SalesReport,
  tableLabel,
  type SalesTicket,
} from '../../../shared/domain';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { printSalesReport } from '../../lib/printReport';
import { api } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { usePos } from './PosContext';

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'items', label: 'Item Wise' },
  { id: 'categories', label: 'Category Wise' },
  { id: 'hours', label: 'Hour Wise' },
  { id: 'payments', label: 'Payments' },
  { id: 'cancelled', label: 'Cancelled / NC' },
] as const;

type Tab = (typeof TABS)[number]['id'];
type RangePreset = 'today' | 'yesterday' | 'week' | 'custom';

const CHANNEL: Record<OrderChannel, string> = {
  dine: 'Dine In',
  pickup: 'Pick Up',
  delivery: 'Delivery',
};

function weekStartYmd(timeZone: string, now = new Date()) {
  const today = formatZonedYmd(timeZone, now);
  const weekday = new Date(`${today}T12:00:00.000Z`).getUTCDay();
  const back = weekday === 0 ? 6 : weekday - 1;
  return shiftYmd(today, -back);
}

function localRange(pos: ReturnType<typeof usePos>, fromYmd: string, toYmd: string): SalesReport {
  const zone = pos.cafe?.timezone ?? 'Asia/Kolkata';
  const from = zonedDayStart(zone, fromYmd).toISOString();
  const to = zonedDayStart(zone, shiftYmd(toYmd, 1)).toISOString();
  const categoryName = (menuItemId: string | null) => {
    const item = pos.items.find((entry) => entry.id === menuItemId);
    if (!item) return 'Other';
    return pos.categories.find((category) => category.id === item.categoryId)?.name ?? 'Other';
  };
  return buildSalesReport({
    orders: pos.orders.filter((order) => order.createdAt >= from && order.createdAt < to),
    payments: pos.orders.flatMap((order) => order.payments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      status: payment.status,
      createdAt: payment.createdAt,
      complimentary: order.notes.split(/\n/).some((line) => line.trim() === 'COMPLIMENTARY'),
    }))),
    categoryName,
    timeZone: zone,
    from,
    to,
    fromYmd,
    toYmd,
  });
}

export function ReportsPage() {
  useTitle('Reports');
  const pos = usePos();
  const navigate = useNavigate();
  const zone = pos.cafe?.timezone ?? 'Asia/Kolkata';
  const today = formatZonedYmd(zone);
  const [fromYmd, setFromYmd] = useState(today);
  const [toYmd, setToYmd] = useState(today);
  const [preset, setPreset] = useState<RangePreset>('today');
  const [tab, setTab] = useState<Tab>('summary');
  const [itemFilter, setItemFilter] = useState<string | null>(null);
  const [hourFilter, setHourFilter] = useState<number | null>(null);
  const local = useMemo(() => localRange(pos, fromYmd, toYmd), [fromYmd, pos, toYmd]);
  const [report, setReport] = useState<SalesReport>(local);

  useEffect(() => {
    setReport(local);
    if (pos.conn === 'OFFLINE') return;
    void api<SalesReport>(`/api/reports?from=${encodeURIComponent(fromYmd)}&to=${encodeURIComponent(toYmd)}`)
      .then(setReport)
      .catch(() => setReport(local));
  }, [fromYmd, local, pos.conn, pos.orders, toYmd]);

  function applyPreset(next: RangePreset) {
    setPreset(next);
    setItemFilter(null);
    setHourFilter(null);
    if (next === 'today') {
      setFromYmd(today);
      setToYmd(today);
      return;
    }
    if (next === 'yesterday') {
      const day = shiftYmd(today, -1);
      setFromYmd(day);
      setToYmd(day);
      return;
    }
    if (next === 'week') {
      setFromYmd(weekStartYmd(zone));
      setToYmd(today);
    }
  }

  const peakHour = report.hours.reduce((max, row) => Math.max(max, row.amount), 0);
  const cancelled = report.tickets.filter((ticket) => ticket.cancelled);
  const nc = report.tickets.filter((ticket) => ticket.complimentary);
  const drilled = report.tickets.filter((ticket) => {
    if (ticket.cancelled) return false;
    if (itemFilter && !ticket.items.some((item) => item.name === itemFilter)) return false;
    if (hourFilter !== null && zonedHour(ticket.createdAt, zone) !== hourFilter) return false;
    return true;
  });

  return (
    <section className="pos-page rpt">
      <header className="page-head">
        <h1>Reports</h1>
        <p className="fine">
          {fromYmd === toYmd ? fromYmd : `${fromYmd} – ${toYmd}`}
          {' · '}
          {pos.conn === 'OFFLINE' ? 'Counted on this device' : 'Live from the server'}
        </p>
      </header>

      <div className="rpt-tools no-print">
        <div className="bill-modes" role="group" aria-label="Date range">
          <button type="button" className={preset === 'today' ? 'on' : ''} onClick={() => applyPreset('today')}>Today</button>
          <button type="button" className={preset === 'yesterday' ? 'on' : ''} onClick={() => applyPreset('yesterday')}>Yesterday</button>
          <button type="button" className={preset === 'week' ? 'on' : ''} onClick={() => applyPreset('week')}>This week</button>
        </div>
        <label className="rpt-date">
          <span className="sr-only">From date</span>
          <input
            type="date"
            value={fromYmd}
            max={today}
            onChange={(event) => {
              setPreset('custom');
              setFromYmd(event.target.value || today);
            }}
          />
        </label>
        <label className="rpt-date">
          <span className="sr-only">To date</span>
          <input
            type="date"
            value={toYmd}
            max={today}
            min={fromYmd}
            onChange={(event) => {
              setPreset('custom');
              setToYmd(event.target.value || today);
            }}
          />
        </label>
        <Button variant="ghost" onClick={() => printSalesReport(report, pos.cafe?.name ?? 'After Dunes')}>Print</Button>
      </div>

      <div className="seg no-print" role="tablist" aria-label="Report type">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={tab === entry.id ? 'seg-btn active' : 'seg-btn'}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'summary' || tab === 'payments' ? (
        <div className="money-grid rpt-kpis">
          <article className="money-tile">
            <span>Bills</span>
            <strong>{report.bills}</strong>
            <small>Avg {formatINR(report.averageTicket)}</small>
          </article>
          <article className="money-tile">
            <span>Gross</span>
            <strong>{formatINR(report.gross)}</strong>
            <small>Discount {formatINR(report.discount)}</small>
          </article>
          <article className="money-tile">
            <span>Tax</span>
            <strong>{formatINR(report.tax)}</strong>
            <small>Net {formatINR(report.net)}</small>
          </article>
          <article className="money-tile is-good">
            <span>Collected</span>
            <strong>{formatINR(report.collected)}</strong>
            <small>Due {formatINR(report.due)}</small>
          </article>
          <article className="money-tile">
            <span>Complimentary</span>
            <strong>{formatINR(report.ncAmount)}</strong>
            <small>{report.complimentary} NC · {report.cancelled} cancelled</small>
          </article>
        </div>
      ) : null}

      {tab === 'summary' || tab === 'payments' ? (
        <>
          <h2>Payment collection</h2>
          <div className="money-grid">
            {([['Cash', report.byMethod.CASH], ['Card', report.byMethod.CARD], ['UPI', report.byMethod.UPI], ['Other', report.byMethod.OTHER]] as const).map(([label, amount]) => (
              <article key={label} className="money-tile">
                <span>{label}</span>
                <strong>{formatINR(amount)}</strong>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {tab === 'summary' ? (
        <>
          <h2>Order type</h2>
          <div className="money-grid">
            {(['dine', 'pickup', 'delivery'] as const).map((channel) => (
              <article key={channel} className="money-tile">
                <span>{CHANNEL[channel]}</span>
                <strong>{formatINR(report.byChannel[channel].amount)}</strong>
                <small>{report.byChannel[channel].bills} bills</small>
              </article>
            ))}
            <article className="money-tile">
              <span>QR / Contactless</span>
              <strong>{formatINR(report.bySource.QR.amount)}</strong>
              <small>{report.bySource.QR.bills} bills</small>
            </article>
          </div>
        </>
      ) : null}

      {tab === 'summary' || tab === 'hours' ? (
        <>
          <h2>Hour wise</h2>
          {peakHour === 0 ? (
            <p className="fine">No billed hours in this range.</p>
          ) : (
            <div className="stage-list">
              {report.hours.filter((row) => tab === 'hours' || row.bills > 0).map((row) => (
                <button
                  key={row.hour}
                  type="button"
                  className={hourFilter === row.hour ? 'stage-row rpt-bar on' : 'stage-row rpt-bar'}
                  onClick={() => {
                    setHourFilter(hourFilter === row.hour ? null : row.hour);
                    setTab('hours');
                  }}
                >
                  <span>{String(row.hour).padStart(2, '0')}:00</span>
                  <span className="stage-bar" aria-hidden="true">
                    <i style={{ width: `${peakHour ? Math.max(6, (row.amount / peakHour) * 100) : 0}%` }} />
                  </span>
                  <strong>{formatINR(row.amount)}</strong>
                  <small>{row.bills}</small>
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}

      {tab === 'summary' || tab === 'items' ? (
        <NamedTable
          title="Item wise"
          rows={tab === 'summary' ? report.items.slice(0, 12) : report.items}
          selected={itemFilter}
          empty="No items sold in this range."
          onPick={(name) => {
            setItemFilter(itemFilter === name ? null : name);
            setTab('items');
          }}
        />
      ) : null}

      {tab === 'categories' ? (
        <NamedTable
          title="Category wise"
          rows={report.categories}
          selected={null}
          empty="No categories in this range."
        />
      ) : null}

      {tab === 'items' && itemFilter ? (
        <TicketTable
          title={`Bills with ${itemFilter}`}
          rows={drilled}
          zone={zone}
          onOpen={(id) => navigate(`/pos/orders/${id}`)}
          onClear={() => setItemFilter(null)}
        />
      ) : null}

      {tab === 'hours' && hourFilter !== null ? (
        <TicketTable
          title={`Bills at ${String(hourFilter).padStart(2, '0')}:00`}
          rows={drilled}
          zone={zone}
          onOpen={(id) => navigate(`/pos/orders/${id}`)}
          onClear={() => setHourFilter(null)}
        />
      ) : null}

      {tab === 'cancelled' ? (
        <>
          <TicketTable title="Cancelled" rows={cancelled} zone={zone} onOpen={(id) => navigate(`/pos/orders/${id}`)} />
          <TicketTable title="Complimentary" rows={nc} zone={zone} onOpen={(id) => navigate(`/pos/orders/${id}`)} />
        </>
      ) : null}

      {tab === 'payments' ? (
        <TicketTable
          title="Bills in range"
          rows={report.tickets.filter((ticket) => !ticket.cancelled)}
          zone={zone}
          onOpen={(id) => navigate(`/pos/orders/${id}`)}
        />
      ) : null}
    </section>
  );
}

function NamedTable({
  title,
  rows,
  selected,
  empty,
  onPick,
}: {
  title: string;
  rows: SalesNamed[];
  selected: string | null;
  empty: string;
  onPick?: (name: string) => void;
}) {
  return (
    <>
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="fine">{empty}</p>
      ) : (
        <div className="run-wrap">
          <table className="run-table rpt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.name}
                  className={selected === row.name ? 'on' : undefined}
                  role={onPick ? 'button' : undefined}
                  tabIndex={onPick ? 0 : undefined}
                  onClick={onPick ? () => onPick(row.name) : undefined}
                  onKeyDown={onPick ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onPick(row.name);
                    }
                  } : undefined}
                >
                  <td>{row.name}</td>
                  <td>{row.qty}</td>
                  <td className="price">{formatINR(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function TicketTable({
  title,
  rows,
  zone,
  onOpen,
  onClear,
}: {
  title: string;
  rows: SalesTicket[];
  zone: string;
  onOpen: (id: string) => void;
  onClear?: () => void;
}) {
  return (
    <>
      <header className="rpt-sub">
        <h2>{title}</h2>
        {onClear ? <Button variant="ghost" onClick={onClear}>Clear</Button> : null}
      </header>
      {rows.length === 0 ? (
        <EmptyState title="None" body="Nothing in this list for the selected range." />
      ) : (
        <div className="run-wrap">
          <table className="run-table rpt-table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Table</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpen(row.id);
                    }
                  }}
                >
                  <td>#{row.orderNumber || '—'}</td>
                  <td>{row.tableName ? tableLabel(row.tableName) : CHANNEL[row.channel]}</td>
                  <td>
                    {CHANNEL[row.channel]}
                    {row.complimentary ? ' · NC' : ''}
                    {row.cancelled ? ' · Cancelled' : ''}
                    {row.due > 0 ? ` · Due ${formatINR(row.due)}` : ''}
                  </td>
                  <td className="price">{formatINR(row.total)}</td>
                  <td><time dateTime={row.createdAt}>{formatTime(row.createdAt, zone)}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
