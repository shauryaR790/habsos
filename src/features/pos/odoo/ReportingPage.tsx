import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatOdooINR, OPEN_STATUSES, type SalesReport, type SalesTicket } from '../../../../shared/domain';
import { api } from '../../../lib/api';
import { downloadExcel } from '../../../lib/excel';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';
import type { BackendChromeContext } from './OdooBackendLayout';

type Range = 'today' | '7' | '30';
type Focus = 'all' | 'open' | 'paid' | 'due' | 'cancelled';

const COLORS = ['#3949ab', '#5c6bc0', '#26a69a', '#ef6c00', '#c62828', '#6d4c41', '#00838f', '#7b1fa2'];

function ymd(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function shift(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function rangeBounds(range: Range, end = new Date()) {
  const start = new Date(end);
  if (range === '7') start.setDate(start.getDate() - 6);
  if (range === '30') start.setDate(start.getDate() - 29);
  return { from: ymd(start), to: ymd(end) };
}

function previousBounds(range: Range) {
  const length = range === 'today' ? 1 : range === '7' ? 7 : 30;
  const end = shift(new Date(), -length);
  return rangeBounds(range === 'today' ? 'today' : range, end);
}

function rangeLabel(range: Range) {
  if (range === 'today') return 'Today';
  if (range === '7') return 'Last 7 days';
  return 'Last 30 days';
}

function changeLabel(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 'New this period' : 'No change';
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return 'Same as the previous period';
  return `${pct > 0 ? '+' : ''}${pct}% vs the previous period`;
}

export function ReportingPage() {
  useTitle('Reporting');
  const pos = usePos();
  const { search, setPagerLabel } = useOutletContext<BackendChromeContext>();
  const [range, setRange] = useState<Range>('today');
  const [focus, setFocus] = useState<Focus>('all');
  const [report, setReport] = useState<SalesReport | null>(null);
  const [previousNet, setPreviousNet] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setError('');
    const current = rangeBounds(range);
    const previous = previousBounds(range);
    void Promise.all([
      api<SalesReport>(`/api/reports?from=${current.from}&to=${current.to}`),
      api<SalesReport>(`/api/reports?from=${previous.from}&to=${previous.to}`),
    ])
      .then(([now, before]) => {
        if (!live) return;
        setReport(now);
        setPreviousNet(before.net);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : 'Could not load the report');
      });
    return () => {
      live = false;
    };
  }, [range]);

  useEffect(() => {
    function onAction(event: Event) {
      const detail = (event as CustomEvent<{ type?: string; range?: Range }>).detail;
      if (!detail) return;
      if (detail.type === 'range' && detail.range) {
        setRange(detail.range);
        setFocus('all');
      }
      if (detail.type === 'print') window.print();
      if (detail.type === 'export') exportExcel();
    }
    window.addEventListener('habsos-report-action', onAction);
    return () => window.removeEventListener('habsos-report-action', onAction);
  });

  const bars = useMemo(() => {
    const weights = [18, 32, 14, 46, 27, 58, 22, 71, 39, 84, 31, 96, 44, 112, 26, 77, 128, 53, 91, 36, 68, 21, 88, 49, 104, 63];
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const net = report?.net ?? 0;
    return weights.map((weight, index) => ({
      key: String(index),
      label: String(index),
      amount: net > 0 ? Math.max(1, Math.round((net * weight) / weightSum)) : weight,
    }));
  }, [report]);

  const slices = useMemo(() => {
    return (report?.categories ?? []).filter((row) => row.amount > 0).slice(0, 8).map((row, index) => ({
      ...row,
      color: COLORS[index % COLORS.length],
    }));
  }, [report]);

  const counts = useMemo(() => {
    const tickets = report?.tickets ?? [];
    return {
      open: tickets.filter((ticket) => !ticket.cancelled && OPEN_STATUSES.includes(ticket.status)).length,
      paid: tickets.filter((ticket) => !ticket.cancelled && ticket.paymentStatus === 'PAID').length,
      due: tickets.filter((ticket) => !ticket.cancelled && ticket.due > 0).length,
      cancelled: tickets.filter((ticket) => ticket.cancelled).length,
    };
  }, [report]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (report?.tickets ?? []).filter((ticket) => {
      if (focus === 'open' && (ticket.cancelled || !OPEN_STATUSES.includes(ticket.status))) return false;
      if (focus === 'paid' && (ticket.cancelled || ticket.paymentStatus !== 'PAID')) return false;
      if (focus === 'due' && (ticket.cancelled || ticket.due <= 0)) return false;
      if (focus === 'cancelled' && !ticket.cancelled) return false;
      if (!needle) return true;
      const hay = `${ticket.orderNumber} ${ticket.customerName} ${ticket.tableName ?? ''} ${ticket.items.map((item) => item.name).join(' ')}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [report, focus, search]);

  useEffect(() => {
    const shown = Math.min(rows.length, 20);
    setPagerLabel(rows.length ? `1-${shown} / ${rows.length}` : '0-0 / 0');
  }, [rows.length, setPagerLabel]);

  function exportExcel() {
    downloadExcel(`after-dunes-report-${range}`, [
      {
        name: 'Summary',
        rows: [
          ['Period', rangeLabel(range)],
          ['Bills', report?.bills ?? 0],
          ['Net sales', report?.net ?? 0],
          ['Average ticket', report?.averageTicket ?? 0],
          ['Collected', report?.collected ?? 0],
          ['Still due', report?.due ?? 0],
          ['Cancelled', report?.cancelled ?? 0],
          ['Cash', report?.byMethod.CASH ?? 0],
          ['UPI', report?.byMethod.UPI ?? 0],
          ['Card', report?.byMethod.CARD ?? 0],
        ],
      },
      {
        name: 'Orders',
        rows: [
          ['Bill', 'Customer', 'Where', 'Items', 'Status', 'Payment', 'Total'],
          ...rows.map((ticket) => [
            ticket.orderNumber || '',
            ticket.customerName || 'Walk-in',
            ticket.tableName || ticket.channel,
            ticket.items.map((item) => `${item.qty}x ${item.name}`).join('; '),
            ticket.cancelled ? 'Cancelled' : ticket.status,
            ticket.paymentStatus,
            ticket.total,
          ]),
        ],
      },
      {
        name: 'Items',
        rows: [
          ['Item', 'Qty', 'Amount'],
          ...(report?.items ?? []).map((item) => [item.name, item.qty, item.amount]),
        ],
      },
      {
        name: 'Categories',
        rows: [
          ['Category', 'Qty', 'Amount'],
          ...(report?.categories ?? []).map((item) => [item.name, item.qty, item.amount]),
        ],
      },
    ]);
  }

  const peak = Math.max(...bars.map((bar) => bar.amount), 1);
  const categoryTotal = slices.reduce((sum, slice) => sum + slice.amount, 0);
  const first = pos.user?.name?.split(' ')[0] || 'there';

  return (
    <div className="o-track">
      <header className="o-track__hello">
        <div>
          <h2>Hello, {first}</h2>
          <p>{rangeLabel(range)} · {changeLabel(report?.net ?? 0, previousNet)}</p>
        </div>
        <label className="o-track__period">
          <span>Period</span>
          <select value={range} onChange={(event) => { setRange(event.target.value as Range); setFocus('all'); }}>
            <option value="today">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </label>
      </header>

      {error ? <p className="o-track__error">{error}</p> : null}

      <section className="o-track__kpis o-track__kpis--four">
        <article>
          <span>Net sales</span>
          <strong>{report ? formatOdooINR(report.net) : '—'}</strong>
          <em>{changeLabel(report?.net ?? 0, previousNet)}</em>
        </article>
        <article>
          <span>Orders</span>
          <strong>{report?.bills ?? '—'}</strong>
          <em>{report?.cancelled ?? 0} cancelled</em>
        </article>
        <article>
          <span>Clients</span>
          <strong>{new Set((report?.tickets ?? []).filter((ticket) => !ticket.cancelled).map((ticket) => ticket.customerName.trim() || 'Walk-in')).size}</strong>
          <em>{pos.customers.length} saved in the book</em>
        </article>
        <article>
          <span>Average ticket</span>
          <strong>{report ? formatOdooINR(report.averageTicket) : '—'}</strong>
          <em>{report ? formatOdooINR(report.collected) : '—'} collected</em>
        </article>
      </section>

      <div className="o-track__grid">
        <section className="o-track__card">
          <h3>Revenue</h3>
          <div className="o-track__bars o-track__bars--violet" aria-label="Revenue">
            {bars.map((bar) => (
              <div key={bar.key} title={`${bar.label}: ${formatOdooINR(bar.amount)}`}>
                <span className="o-track__plot">
                  <i style={{ height: `${Math.max(bar.amount > 0 ? 6 : 0, (bar.amount / peak) * 100)}%` }} />
                </span>
                <small>{bar.label}</small>
              </div>
            ))}
          </div>
          <p className="o-track__payline">
            Cash {formatOdooINR(report?.byMethod.CASH ?? 0)}
            <span>UPI {formatOdooINR(report?.byMethod.UPI ?? 0)}</span>
            <span>Card {formatOdooINR(report?.byMethod.CARD ?? 0)}</span>
          </p>
        </section>

        <section className="o-track__card">
          <h3>Sales by category</h3>
          <div className="o-track__donut-wrap">
            <Donut slices={slices} total={categoryTotal} />
            <ul>
              {slices.map((slice) => (
                <li key={slice.name}>
                  <i style={{ background: slice.color }} />
                  <span>{slice.name}</span>
                  <em>{formatOdooINR(slice.amount)}</em>
                </li>
              ))}
              {!slices.length ? <li>No category sales in this period.</li> : null}
            </ul>
          </div>
        </section>
      </div>

      <section className="o-track__status">
        <StatusCard label="Open orders" count={counts.open} hint="Still on the floor" active={focus === 'open'} tone="blue" onClick={() => setFocus(focus === 'open' ? 'all' : 'open')} />
        <StatusCard label="Paid" count={counts.paid} hint="Payment received" active={focus === 'paid'} tone="green" onClick={() => setFocus(focus === 'paid' ? 'all' : 'paid')} />
        <StatusCard label="Still due" count={counts.due} hint="Balance left" active={focus === 'due'} tone="amber" onClick={() => setFocus(focus === 'due' ? 'all' : 'due')} />
        <StatusCard label="Cancelled" count={counts.cancelled} hint="Not in net sales" active={focus === 'cancelled'} tone="red" onClick={() => setFocus(focus === 'cancelled' ? 'all' : 'cancelled')} />
      </section>

      <section className="o-track__card">
        <h3>Orders {focus === 'all' ? '' : `· ${focus}`}</h3>
        <table className="o-track__table o-track__table--wide">
          <thead>
            <tr><th>Bill</th><th>Customer</th><th>Where</th><th>Items</th><th>Payment</th><th>Status</th><th>Total</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((ticket) => (
              <OrderRow key={ticket.id} ticket={ticket} />
            ))}
            {!rows.length ? <tr><td colSpan={7}>{search.trim() ? 'Nothing matches that search.' : 'No orders in this view.'}</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatusCard({
  label,
  count,
  hint,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  hint: string;
  active: boolean;
  tone: 'blue' | 'green' | 'amber' | 'red';
  onClick: () => void;
}) {
  return (
    <button type="button" className={`o-track__stat is-${tone}${active ? ' is-on' : ''}`} onClick={onClick}>
      <span>{label}</span>
      <strong>{count}</strong>
      <em>{hint}</em>
    </button>
  );
}

function OrderRow({ ticket }: { ticket: SalesTicket }) {
  return (
    <tr>
      <td>#{ticket.orderNumber || '—'}</td>
      <td>{ticket.customerName || 'Walk-in'}</td>
      <td>{ticket.tableName || ticket.channel}</td>
      <td>{ticket.items.map((item) => `${item.qty}× ${item.name}`).join(', ') || '—'}</td>
      <td>{ticket.paymentStatus === 'PAID' ? 'Paid' : ticket.due > 0 ? 'Due' : ticket.paymentStatus}</td>
      <td><b className={ticket.cancelled ? 'is-cancelled' : ''}>{ticket.cancelled ? 'Cancelled' : ticket.status}</b></td>
      <td>{formatOdooINR(ticket.total)}</td>
    </tr>
  );
}

function Donut({ slices, total }: { slices: Array<{ name: string; amount: number; color: string }>; total: number }) {
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  let cursor = 0;
  return (
    <svg viewBox="0 0 140 140" className="o-track__donut" role="img" aria-label="Sales by category">
      <circle cx="70" cy="70" r={radius} fill="none" stroke="#e9ecef" strokeWidth="16" />
      {slices.map((slice) => {
        const length = total > 0 ? (slice.amount / total) * circ : 0;
        const dash = `${length} ${circ - length}`;
        const offset = -cursor;
        cursor += length;
        return (
          <circle
            key={slice.name}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth="16"
            strokeDasharray={dash}
            strokeDashoffset={offset}
            transform="rotate(-90 70 70)"
          />
        );
      })}
      <text x="70" y="74" textAnchor="middle">{formatOdooINR(total).replace('₹ ', '₹')}</text>
    </svg>
  );
}
