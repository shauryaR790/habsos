import { tableLabel } from '../../shared/domain';

function Tick({ on }: { on: boolean }) {
  return on ? <span className="bill-meta-tick" aria-hidden="true">✓</span> : <span className="bill-meta-tick off" aria-hidden="true" />;
}

function IcoTable() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="10" rx="11" ry="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 14v10M16 14v10M24 14v10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IcoUser() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="11" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 27c1.2-5 4.5-8 9-8s7.8 3 9 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IcoGuests() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="11" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="21" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 26c.8-3.5 3-5.5 7-5.5M28 26c-.8-3.5-3-5.5-7-5.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 24c.6-2.8 2.5-4.5 6-4.5s5.4 1.7 6 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IcoNote() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="8" y="5" width="16" height="22" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 11h10M11 16h10M11 21h6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M20 21l4 4V21z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function IcoServe() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 14h14c3 0 5 2 5 5v2H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 21v4M18 21v4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22 8c2 1.5 3 3.5 3 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export type BillMetaPanel = 'customer' | 'covers' | 'note' | 'assign' | null;

export function BillMetaBar({
  tableName,
  modeLabel,
  panel,
  onPanel,
  customerDone,
  coversDone,
  noteDone,
  assignDone,
}: {
  tableName: string | null;
  modeLabel: string;
  panel: BillMetaPanel;
  onPanel: (next: BillMetaPanel) => void;
  customerDone: boolean;
  coversDone: boolean;
  noteDone: boolean;
  assignDone: boolean;
}) {
  const tableCode = tableName ? tableLabel(tableName) : modeLabel.slice(0, 4).toUpperCase();

  return (
    <header className="bill-meta">
      <div className="bill-meta-table" title={tableName ?? modeLabel}>
        <IcoTable />
        <strong>{tableCode}</strong>
      </div>
      <button type="button" className={`bill-meta-btn${panel === 'customer' ? ' on' : ''}${customerDone ? ' done' : ''}`} onClick={() => onPanel(panel === 'customer' ? null : 'customer')}>
        <IcoUser />
        <Tick on={customerDone} />
        <span className="sr-only">Customer</span>
      </button>
      <button type="button" className={`bill-meta-btn${panel === 'covers' ? ' on' : ''}${coversDone ? ' done' : ''}`} onClick={() => onPanel(panel === 'covers' ? null : 'covers')}>
        <IcoGuests />
        <Tick on={coversDone} />
        <span className="sr-only">Guests</span>
      </button>
      <button type="button" className={`bill-meta-btn${panel === 'note' ? ' on' : ''}${noteDone ? ' done' : ''}`} onClick={() => onPanel(panel === 'note' ? null : 'note')}>
        <IcoNote />
        <Tick on={noteDone} />
        <span className="sr-only">Order note</span>
      </button>
      <button type="button" className={`bill-meta-btn${panel === 'assign' ? ' on' : ''}${assignDone ? ' done' : ''}`} onClick={() => onPanel(panel === 'assign' ? null : 'assign')}>
        <IcoServe />
        <Tick on={assignDone} />
        <span className="sr-only">Captain</span>
      </button>
    </header>
  );
}
