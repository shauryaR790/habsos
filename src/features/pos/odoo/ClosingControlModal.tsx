import { useEffect, useMemo, useState } from 'react';
import { formatOdooINR } from '../../../../shared/domain';
import { api } from '../../../lib/api';
import { pushToast } from '../../../components/Toast';

type Preview = {
  stats: { soldTotal: number; soldOrders: number };
  byMethod: { method: string; total: number }[];
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  durationMs: number;
  session: { openedAt: string; openingCash: number };
};

type Props = {
  onClose: (countedCash: number, notes: string) => Promise<void>;
  onDiscard: () => void;
  onCashInOut?: () => void;
};

function money(amount: number) {
  return formatOdooINR(amount);
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 10l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CalcIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0M8 18h2M12 18h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ClosingControlModal({ onClose, onDiscard, onCashInOut }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [counted, setCounted] = useState('0.00');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<Preview>('/api/pos/session/closing').then((data) => {
      setPreview(data);
      setCounted(data.expectedCash.toFixed(2));
    }).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load closing control.'));
  }, []);

  const breakdown = useMemo(() => {
    if (!preview) return null;
    const cashPaid = preview.byMethod.find((m) => m.method === 'CASH')?.total ?? 0;
    const cardPaid = preview.byMethod.find((m) => m.method === 'CARD')?.total ?? 0;
    const accountPaid = preview.byMethod
      .filter((m) => m.method === 'UPI' || m.method === 'OTHER')
      .reduce((sum, row) => sum + row.total, 0);
    const cashMoves = preview.cashIn - preview.cashOut;
    const cashExpected = preview.expectedCash;
    const countedCash = Number(counted) || 0;
    return {
      cashPaid,
      cardPaid,
      accountPaid,
      cashMoves,
      cashExpected,
      cashDiff: countedCash - cashExpected,
      countedCash,
    };
  }, [preview, counted]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onClose(Number(counted) || 0, notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close session.');
    } finally {
      setBusy(false);
    }
  }

  function downloadDailySale() {
    if (!preview || !breakdown) return;
    const lines = [
      'Daily Sale',
      `Orders: ${preview.stats.soldOrders}`,
      `Total: ${money(preview.stats.soldTotal)}`,
      `Cash: ${money(breakdown.cashExpected)}`,
      `  Opening: ${money(preview.session.openingCash)}`,
      `  Payments in Cash: ${money(breakdown.cashPaid)}`,
      `  Cash In/Out: ${money(breakdown.cashMoves)}`,
      `Card: ${money(breakdown.cardPaid)}`,
      `Customer Account: ${money(breakdown.accountPaid)}`,
      notes.trim() ? `Note: ${notes.trim()}` : '',
    ].filter(Boolean);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-sale-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('Daily sale downloaded');
  }

  return (
    <div className="o-modal-backdrop" onClick={onDiscard} role="presentation">
      <div className="o-modal o-closing" role="dialog" aria-label="Closing Register" onClick={(e) => e.stopPropagation()}>
        <div className="o-closing__head">
          <h2>Closing Register</h2>
          {preview ? (
            <span className="o-closing__orders">
              {preview.stats.soldOrders} order{preview.stats.soldOrders === 1 ? '' : 's'}: {money(preview.stats.soldTotal)}
            </span>
          ) : null}
        </div>

        <div className="o-closing__body">
          {!preview && !error ? <p className="o-closing__loading">Loading…</p> : null}
          {preview && breakdown ? (
            <>
              <section className="o-closing__method">
                <div className="o-closing__method-head">
                  <strong>Cash</strong>
                  <strong>{money(breakdown.cashExpected)}</strong>
                </div>
                <div className="o-closing__row"><span>Opening</span><span>{money(preview.session.openingCash)}</span></div>
                <div className="o-closing__row"><span>Payments in Cash</span><span>{money(breakdown.cashPaid)}</span></div>
                <div className="o-closing__row">
                  <span>Cash In / Out</span>
                  <span>{breakdown.cashMoves >= 0 ? '+ ' : '− '}{money(Math.abs(breakdown.cashMoves))}</span>
                </div>
                <div className="o-closing__row"><span>Counted</span><span>{money(breakdown.countedCash)}</span></div>
                <div className="o-closing__row"><span>Difference</span><span>{money(breakdown.cashDiff)}</span></div>
              </section>

              <section className="o-closing__method">
                <div className="o-closing__method-head">
                  <strong>Card</strong>
                  <strong>{money(breakdown.cardPaid)}</strong>
                </div>
                <div className="o-closing__row"><span>Counted</span><span>{money(breakdown.cardPaid)}</span></div>
                <div className="o-closing__row"><span>Difference</span><span>{money(0)}</span></div>
              </section>

              <section className="o-closing__method">
                <div className="o-closing__method-head">
                  <strong>Customer Account</strong>
                  <strong>{money(breakdown.accountPaid)}</strong>
                </div>
                <div className="o-closing__row"><span>Counted</span><span>{money(breakdown.accountPaid)}</span></div>
                <div className="o-closing__row"><span>Difference</span><span>{money(0)}</span></div>
              </section>

              <label className="o-closing__field">
                <span>Cash Count</span>
                <div className="o-closing__cash-row">
                  <div className="o-closing__input-wrap">
                    <input
                      value={counted}
                      onChange={(e) => setCounted(e.target.value)}
                      inputMode="decimal"
                      aria-label="Cash count"
                    />
                    {counted ? (
                      <button type="button" className="o-closing__clear" aria-label="Clear" onClick={() => setCounted('')}>
                        <ClearIcon />
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="o-closing__calc"
                    title="Use expected cash"
                    aria-label="Use expected cash"
                    onClick={() => setCounted(preview.expectedCash.toFixed(2))}
                  >
                    <CalcIcon />
                  </button>
                </div>
              </label>

              <label className="o-closing__field">
                <span>Closing note</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add a closing note..."
                />
              </label>
            </>
          ) : null}
          {error ? <p className="o-closing__error">{error}</p> : null}
        </div>

        <div className="o-closing__foot">
          <div className="o-closing__foot-left">
            <button
              type="button"
              className="o-btn o-btn--primary o-closing__primary"
              disabled={busy || !preview}
              onClick={() => void confirm()}
              style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
            >
              <span className="o-closing__primary-label">Close Register</span>
            </button>
            <button type="button" className="o-btn" disabled={busy} onClick={onDiscard}>
              Discard
            </button>
          </div>
          <div className="o-closing__foot-right">
            <button
              type="button"
              className="o-btn"
              disabled={busy}
              onClick={() => {
                onCashInOut?.();
              }}
            >
              Cash In/Out
            </button>
            <button type="button" className="o-btn o-closing__daily" disabled={busy || !preview} onClick={downloadDailySale}>
              <DownloadIcon />
              <span>Daily Sale</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
