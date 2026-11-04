import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { tableLabel, type TableInfo } from '../../../../shared/domain';
import { pushToast } from '../../../components/Toast';

type Props = {
  tables: TableInfo[];
  anchorEl: HTMLElement | null;
  onJump: (table: TableInfo) => void;
  onClose: () => void;
};

function BackspaceIcon() {
  return (
    <svg width="32" height="24" viewBox="0 0 28 22" fill="none" aria-hidden>
      <path
        d="M10.5 2H24a2 2 0 012 2v14a2 2 0 01-2 2H10.5L3 11l7.5-9z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M13 7.5l7 7M20 7.5l-7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function normalizeNeedle(raw: string) {
  return raw.replace(/\D/g, '').replace(/^0+/, '') || '0';
}

export function findTableByNumber(tables: TableInfo[], raw: string): TableInfo | null {
  const needle = normalizeNeedle(raw);
  if (!raw.trim()) return null;

  const exact = tables.find((table) => {
    const label = normalizeNeedle(tableLabel(table.name));
    const digits = normalizeNeedle(table.name);
    return label === needle || digits === needle;
  });
  if (exact) return exact;

  const padded = needle.padStart(2, '0');
  return tables.find((table) => {
    const label = tableLabel(table.name).toUpperCase();
    const name = table.name.trim().toUpperCase();
    return name === `T${padded}` || name === `T${needle}` || label === padded || label === needle;
  }) ?? null;
}

export function JumpTableModal({ tables, anchorEl, onJump, onClose }: Props) {
  const [value, setValue] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 12 });

  useLayoutEffect(() => {
    function place() {
      const panel = panelRef.current;
      const anchor = anchorEl?.getBoundingClientRect();
      if (!anchor || !panel) return;
      const height = panel.offsetHeight || 420;
      const gap = 6;
      const right = Math.max(8, window.innerWidth - anchor.right);
      let top = anchor.bottom + gap;
      if (top + height > window.innerHeight - 12) {
        top = Math.max(12, anchor.top - height - gap);
      }
      setPos({ top, right });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorEl]);

  function jumpWith(raw: string) {
    const table = findTableByNumber(tables, raw);
    if (!table) {
      pushToast(raw ? `No table ${raw}` : 'Enter a table number', 'err');
      return;
    }
    onJump(table);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        jumpWith(value);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        setValue((v) => v.slice(0, -1));
        return;
      }
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        setValue((v) => (v + event.key).slice(0, 6));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [value, tables, onClose, onJump]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

  return (
    <div className="o-jump-backdrop" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className="o-jump"
        role="dialog"
        aria-modal="true"
        aria-label="Jump to table"
        style={{ top: pos.top, right: pos.right, left: 'auto' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`o-jump__display${value ? ' has-value' : ''}`}>
          {value || 'Enter a table number'}
        </div>
        <div className="o-jump__pad">
          {keys.map((key, index) => {
            if (key === '') {
              return <div key={`empty-${index}`} className="o-jump__key o-jump__key--empty" />;
            }
            if (key === 'back') {
              return (
                <button
                  key="back"
                  type="button"
                  className="o-jump__key o-jump__key--back"
                  aria-label="Backspace"
                  onClick={() => setValue((v) => v.slice(0, -1))}
                >
                  <BackspaceIcon />
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                className="o-jump__key"
                onClick={() => setValue((v) => (v + key).slice(0, 6))}
              >
                {key}
              </button>
            );
          })}
        </div>
        <button type="button" className="o-jump__go" onClick={() => jumpWith(value)}>
          Jump
        </button>
      </div>
    </div>
  );
}
