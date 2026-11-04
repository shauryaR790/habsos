import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { PosSession } from '../../../../shared/domain';
import { api } from '../../../lib/api';
import { useTitle } from '../../../lib/useTitle';
import type { BackendChromeContext } from './OdooBackendLayout';

function sessionRef(session: PosSession) {
  const seq = String(session.sequence || 0).padStart(5, '0');
  return `${session.configName}/${seq}`;
}

function statusLabel(status: PosSession['status']) {
  if (status === 'OPEN' || status === 'CLOSING') return 'In Progress';
  return 'Closed';
}

function statusClass(status: PosSession['status']) {
  if (status === 'OPEN' || status === 'CLOSING') return 'o-be-status o-be-status--progress';
  return 'o-be-status o-be-status--closed';
}

function formatSessionWhen(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.getDate();
  const mon = d.toLocaleString('en-GB', { month: 'short' });
  const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} ${mon} at ${time}`;
}

function formatDuration(openedAt: string, closedAt: string | null, now: number) {
  const end = closedAt ? Date.parse(closedAt) : now;
  const ms = Math.max(0, end - Date.parse(openedAt));
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function BackendSessionsPage() {
  useTitle('Sessions');
  const { search, setPagerLabel } = useOutletContext<BackendChromeContext>();
  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const data = await api<{ sessions: PosSession[] }>('/api/pos/sessions');
    setSessions(data.sessions);
    setError(null);
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sessions.'));
    const poll = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 8_000);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((session) => {
      if (!q) return true;
      return (
        sessionRef(session).toLowerCase().includes(q)
        || session.configName.toLowerCase().includes(q)
        || session.openedBy.toLowerCase().includes(q)
        || statusLabel(session.status).toLowerCase().includes(q)
      );
    });
  }, [sessions, search]);

  useEffect(() => {
    const n = rows.length;
    setPagerLabel(n ? `1-${n} / ${n}` : '0-0 / 0');
  }, [rows.length, setPagerLabel]);

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

  if (error) {
    return <p className="o-dash-error">{error}</p>;
  }

  return (
    <div className="o-be-sessions">
      <div className="o-be-table-wrap">
        <table className="o-be-table">
          <thead>
            <tr>
              <th className="o-be-table__check">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th>Session ID</th>
              <th>Point of Sale</th>
              <th>Opened By</th>
              <th>Opening Date</th>
              <th>Closing Date</th>
              <th>Duration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((session) => {
              const name = (session.openedBy || 'Staff').toUpperCase();
              const initial = name.trim().charAt(0) || 'S';
              const open = session.status === 'OPEN' || session.status === 'CLOSING';
              return (
                <tr key={session.id} className={selected.has(session.id) ? 'is-selected' : undefined}>
                  <td className="o-be-table__check">
                    <input
                      type="checkbox"
                      checked={selected.has(session.id)}
                      onChange={() => toggleOne(session.id)}
                      aria-label={`Select ${sessionRef(session)}`}
                    />
                  </td>
                  <td>{sessionRef(session)}</td>
                  <td>{session.configName}</td>
                  <td>
                    <span className="o-be-employee">
                      <span className="o-be-employee__avatar">{initial}</span>
                      {name}
                    </span>
                  </td>
                  <td>{formatSessionWhen(session.openedAt)}</td>
                  <td>{formatSessionWhen(session.closedAt)}</td>
                  <td className={open ? 'o-be-duration o-be-duration--live' : 'o-be-duration'}>
                    {formatDuration(session.openedAt, session.closedAt, now)}
                    {open ? <span className="o-be-duration__dot" aria-hidden /> : null}
                  </td>
                  <td>
                    <span className={statusClass(session.status)}>{statusLabel(session.status)}</span>
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="o-be-table__empty">No sessions yet — open a register from the dashboard</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
