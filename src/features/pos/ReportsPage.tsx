import { useEffect, useMemo, useState } from 'react';
import { formatINR, startOfZonedDay } from '../../../shared/domain';
import { api } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';
import { usePos } from './PosContext';

type Report = {
  ordersToday: number;
  paidTotal: number;
  unpaidTotal: number;
  gross: number;
  averageTicket: number;
  byStatus: Record<string, number>;
};

export function ReportsPage() {
  useTitle('Reports');
  const pos = usePos();
  const local = useMemo(() => localReport(pos), [pos]);
  const [report, setReport] = useState<Report>(local);
  useEffect(() => {
    setReport(local);
    if (pos.conn === 'OFFLINE') return;
    void api<Report>('/api/reports/today').then(setReport).catch(() => setReport(local));
  }, [local, pos.conn]);
  return (
    <section className="stack">
      <h1>Today</h1>
      <div className="report-grid">
        <article><span>Orders</span><strong>{report.ordersToday}</strong></article>
        <article><span>Paid</span><strong>{formatINR(report.paidTotal)}</strong></article>
        <article><span>Unpaid</span><strong>{formatINR(report.unpaidTotal)}</strong></article>
        <article><span>Average ticket</span><strong>{formatINR(report.averageTicket)}</strong></article>
      </div>
      <ul className="plain-list">
        {Object.entries(report.byStatus).map(([status, count]) => (
          <li key={status}><span>{status}</span><span>{count}</span></li>
        ))}
      </ul>
    </section>
  );
}

function localReport(pos: ReturnType<typeof usePos>): Report {
  const start = startOfZonedDay(pos.cafe?.timezone ?? 'Asia/Kolkata').toISOString();
  const rows = pos.orders.filter((order) => order.createdAt >= start && !['DRAFT', 'OTP_PENDING', 'CANCELLED'].includes(order.status));
  const byStatus: Record<string, number> = {};
  let paidTotal = 0;
  let unpaidTotal = 0;
  for (const order of rows) {
    byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;
    if (order.paymentStatus === 'PAID') paidTotal += order.total;
    if (order.paymentStatus === 'UNPAID') unpaidTotal += order.total;
  }
  const gross = rows.reduce((sum, order) => sum + order.total, 0);
  return {
    ordersToday: rows.length,
    paidTotal,
    unpaidTotal,
    gross,
    averageTicket: rows.length ? Math.round(gross / rows.length) : 0,
    byStatus,
  };
}
