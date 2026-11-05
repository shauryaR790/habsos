import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatOdooINR, type PosSession } from '../../../../shared/domain';
import { api } from '../../../lib/api';
import { useTitle } from '../../../lib/useTitle';
import { usePos } from '../PosContext';
import type { BackendChromeContext } from './OdooBackendLayout';

function statusLabel(order: { status: string; paymentStatus: string }) {
  if (order.status === 'CANCELLED') return 'Cancelled';
  if (order.paymentStatus === 'PAID') return 'Paid';
  if (order.status === 'CONFIRMED' || order.status === 'ACCEPTED') return 'New';
  return 'Ongoing';
}

function statusClass(label: string) {
  if (label === 'Paid') return 'o-be-status o-be-status--paid';
  if (label === 'Cancelled') return 'o-be-status o-be-status--cancelled';
  if (label === 'New') return 'o-be-status o-be-status--new';
  return 'o-be-status';
}

function sessionRef(session: PosSession) {
  return `${session.configName}/${String(session.sequence || 0).padStart(5, '0')}`;
}

function matchSession(sessions: PosSession[], createdAt: string): PosSession | null {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return sessions[0] ?? null;
  const hit = sessions.find((session) => {
    const open = Date.parse(session.openedAt);
    const close = session.closedAt ? Date.parse(session.closedAt) : Number.POSITIVE_INFINITY;
    return t >= open && t <= close;
  });
  return hit ?? sessions[0] ?? null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function receiptNumber(orderNumber: number) {
  return String(orderNumber).padStart(5, '0');
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayHeading(iso: string) {
  const date = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function BackendOrdersPage() {
  useTitle('Orders');
  const { orders, user } = usePos();
  const { search, setPagerLabel } = useOutletContext<BackendChromeContext>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [posName, setPosName] = useState('Restaurant');
  const employee = (user?.name ?? 'Staff').toUpperCase();
  const initial = employee.trim().charAt(0) || 'S';

  const loadMeta = useCallback(async () => {
    const [dash, sess] = await Promise.all([
      api<{ config: { name: string } }>('/api/pos/dashboard'),
      api<{ sessions: PosSession[] }>('/api/pos/sessions'),
    ]);
    setPosName(dash.config?.name || 'Restaurant');
    setSessions(sess.sessions);
  }, []);

  useEffect(() => {
    void loadMeta().catch(() => undefined);
  }, [loadMeta]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...orders]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((order) => {
        if (!q) return true;
        const session = matchSession(sessions, order.createdAt);
        return (
          String(order.orderNumber).includes(q)
          || order.customerName.toLowerCase().includes(q)
          || (order.tableName ?? '').toLowerCase().includes(q)
          || order.id.toLowerCase().includes(q)
          || posName.toLowerCase().includes(q)
          || (session ? sessionRef(session).toLowerCase().includes(q) : false)
        );
      });
  }, [orders, search, sessions, posName]);

  const groups = useMemo(() => {
    const list: { key: string; label: string; orders: typeof rows }[] = [];
    for (const order of rows) {
      const key = dayKey(order.createdAt);
      const last = list[list.length - 1];
      if (!last || last.key !== key) list.push({ key, label: dayHeading(order.createdAt), orders: [order] });
      else last.orders.push(order);
    }
    return list;
  }, [rows]);

  useEffect(() => {
    const n = rows.length;
    setPagerLabel(n ? `1-${n} / ${n}` : '0-0 / 0');
  }, [rows.length, setPagerLabel]);

  const total = rows.reduce((sum, order) => sum + order.total, 0);
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((row) => row.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="o-be-orders">
      <div className="o-be-table-wrap">
        <table className="o-be-table">
          <thead>
            <tr>
              <th className="o-be-table__check">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th>Order Ref.</th>
              <th>Session</th>
              <th>Date</th>
              <th>Point of Sale</th>
              <th>Receipt Number</th>
              <th>Customer</th>
              <th>Employee</th>
              <th className="o-be-table__num">Total</th>
              <th>Status</th>
              <th>Invoice Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.key}>
                <tr className="o-be-day">
                  <td colSpan={11}>
                    <div className="o-be-day__row">
                      <span>{group.label}</span>
                      <span className="o-be-day__line" />
                    </div>
                  </td>
                </tr>
                {group.orders.map((order) => {
                  const label = statusLabel(order);
                  const session = matchSession(sessions, order.createdAt);
                  return (
                    <tr key={order.id} className={selected.has(order.id) ? 'is-selected' : undefined}>
                      <td className="o-be-table__check">
                        <input
                          type="checkbox"
                          checked={selected.has(order.id)}
                          onChange={() => toggleOne(order.id)}
                          aria-label={`Select order ${order.orderNumber}`}
                        />
                      </td>
                      <td>{order.orderNumber}</td>
                      <td>
                        <span className="o-be-link">
                          {session ? sessionRef(session) : '—'}
                        </span>
                      </td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td><span className="o-be-link">{session?.configName ?? posName}</span></td>
                      <td><span className="o-be-link">{receiptNumber(order.orderNumber)}</span></td>
                      <td>{order.customerName || ''}</td>
                      <td>
                        <span className="o-be-employee">
                          <span className="o-be-employee__avatar">{initial}</span>
                          {employee}
                        </span>
                      </td>
                      <td className="o-be-table__num">{formatOdooINR(order.total)}</td>
                      <td><span className={statusClass(label)}>{label}</span></td>
                      <td />
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={11} className="o-be-table__empty">No orders yet</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {rows.length ? (
        <div className="o-be-orders__foot">
          <strong>{formatOdooINR(total)}</strong>
        </div>
      ) : null}
    </div>
  );
}
