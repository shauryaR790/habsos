import { useEffect, useState } from 'react';
import { formatOdooINR, type PosSession } from '../../../../shared/domain';
import { api } from '../../../lib/api';
import { useTitle } from '../../../lib/useTitle';

export function ReportingPage() {
  useTitle('Orders Analysis');
  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    void api<{ sessions: PosSession[] }>('/api/pos/sessions').then((data) => {
      setSessions(data.sessions);
      setSessionId(data.sessions[0]?.id ?? '');
    });
  }, []);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Orders Analysis</h2>
        <button type="button" className="o-btn o-btn--primary" onClick={() => setReportOpen(true)}>
          Session Report
        </button>
      </div>
      <div style={{ background: '#fff', border: '1px solid var(--o-border)', borderRadius: 6, padding: 16, minHeight: 280 }}>
        <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
          <button type="button" className="o-btn">Total Price</button>
          <button type="button" className="o-btn">Spreadsheet</button>
        </div>
        <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 24, padding: '20px 12px 0', borderTop: '1px solid var(--o-border)' }}>
          <div style={{ flex: 1, background: '#4aaee6', height: '70%', borderRadius: 2 }} title="Food" />
        </div>
        <div style={{ textAlign: 'center', color: 'var(--o-muted)', marginTop: 8 }}>Food</div>
      </div>
      <div style={{ marginTop: 16 }}>
        <h3>Sessions</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {sessions.map((s) => (
            <div key={s.id} style={{ background: '#fff', border: '1px solid var(--o-border)', borderRadius: 6, padding: 12 }}>
              <strong>{s.configName}</strong> · {s.status} · opened {new Date(s.openedAt).toLocaleString()}
              <div style={{ color: 'var(--o-muted)' }}>
                Opening {formatOdooINR(s.openingCash)}
                {s.countedCash != null ? ` · Counted ${formatOdooINR(s.countedCash)}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
      {reportOpen ? (
        <div className="o-modal-backdrop" onClick={() => setReportOpen(false)} role="presentation">
          <div className="o-modal" onClick={(e) => e.stopPropagation()}>
            <div className="o-modal__head">
              <span>Session Report</span>
              <button type="button" className="o-icon-btn" onClick={() => setReportOpen(false)}>×</button>
            </div>
            <div className="o-modal__body">
              <div className="o-field">
                <label htmlFor="pos-session">Pos Session</label>
                <select id="pos-session" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.configName} — {new Date(s.openedAt).toLocaleString()} ({s.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="o-modal__foot">
              <button type="button" className="o-btn o-btn--primary" onClick={() => window.print()}>Print</button>
              <button type="button" className="o-btn" onClick={() => setReportOpen(false)}>Discard</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
