import { useState } from 'react';

type Props = {
  onConfirm: (input: { kind: 'IN' | 'OUT'; amount: number; reason: string }) => Promise<void>;
  onDiscard: () => void;
};

export function CashInOutModal({ onConfirm, onDiscard }: Props) {
  const [kind, setKind] = useState<'IN' | 'OUT'>('IN');
  const [amount, setAmount] = useState('0.00');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await onConfirm({ kind, amount: Number(amount) || 0, reason });
      onDiscard();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="o-modal-backdrop" onClick={onDiscard} role="presentation">
      <div className="o-modal o-cash-modal" role="dialog" aria-label="Cash In Out" onClick={(e) => e.stopPropagation()}>
        <div className="o-modal__head">
          <span>Cash In / Out</span>
          <button type="button" className="o-icon-btn" onClick={onDiscard} aria-label="Close">
            ×
          </button>
        </div>
        <div className="o-modal__body">
          <div className="o-cash-modal__kinds" role="group" aria-label="Cash move type">
            <button
              type="button"
              className={`o-btn${kind === 'IN' ? ' o-btn--primary' : ''}`}
              onClick={() => setKind('IN')}
            >
              Cash In
            </button>
            <button
              type="button"
              className={`o-btn${kind === 'OUT' ? ' o-btn--danger' : ''}`}
              onClick={() => setKind('OUT')}
            >
              Cash Out
            </button>
          </div>
          <div className="o-field">
            <label htmlFor="cash-amount">Amount</label>
            <input
              id="cash-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoFocus
            />
          </div>
          <div className="o-field">
            <label htmlFor="cash-reason">Reason</label>
            <textarea id="cash-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <div className="o-modal__foot">
          <button type="button" className="o-btn o-btn--primary" disabled={busy} onClick={() => void submit()}>
            Confirm
          </button>
          <button type="button" className="o-btn" disabled={busy} onClick={onDiscard}>
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
