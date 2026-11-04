import { useState } from 'react';
import { formatOdooINR } from '../../../../shared/domain';

type Props = {
  onOpen: (openingCash: number) => Promise<void>;
  onDiscard: () => void;
};

export function OpeningCashModal({ onOpen, onDiscard }: Props) {
  const [cash, setCash] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onOpen(Number(cash) || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open register.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="o-modal-backdrop" role="presentation" onClick={onDiscard}>
      <div className="o-modal" role="dialog" aria-label="Opening Cash Control" onClick={(e) => e.stopPropagation()}>
        <div className="o-modal__head">
          <span>Opening Cash Control</span>
          <button type="button" className="o-icon-btn" onClick={onDiscard} aria-label="Close">
            ×
          </button>
        </div>
        <div className="o-modal__body">
          <p style={{ margin: 0, color: 'var(--o-muted)' }}>Enter the cash in the drawer before starting this shift.</p>
          <div className="o-field">
            <label htmlFor="opening-cash">Opening cash</label>
            <input
              id="opening-cash"
              inputMode="decimal"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ fontWeight: 600 }}>{formatOdooINR(Number(cash) || 0)}</div>
          {error ? <p style={{ color: 'var(--o-danger)', margin: 0 }}>{error}</p> : null}
        </div>
        <div className="o-modal__foot">
          <button type="button" className="o-btn o-btn--primary" disabled={busy} onClick={() => void confirm()}>
            Open Register
          </button>
          <button type="button" className="o-btn" disabled={busy} onClick={onDiscard}>
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
