import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { pushToast } from '../../../components/Toast';
import { usePos } from '../PosContext';

type Props = {
  open: boolean;
  onClose: () => void;
  onCashInOut: () => void;
  onCloseRegister: () => void;
};

function MonitorIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15.5 3.5A8.5 8.5 0 1019.5 14.2 7 7 0 0115.5 3.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function InstallIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 9l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4 21h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="7" width="16" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="6" y="5" width="16" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" opacity=".55" />
      <circle cx="12" cy="12.5" r="2.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ReloadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 12a8 8 0 11-2.3-5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M20 4v5h-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14.5 6L8.5 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 14a4 4 0 005.7.2l2.1-2.1a4 4 0 00-5.7-5.7l-1.2 1.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14 10a4 4 0 00-5.7-.2L6.2 11.9a4 4 0 105.7 5.7l1.2-1.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="14" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M11 14h9l-2 2.5M16.5 14v2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Tile = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

const DARK_KEY = 'habsos.foh.dark';
const FLOOR_VIEW_KEY = 'habsos.foh.floorView';

export function readFoHDark() {
  try {
    return localStorage.getItem(DARK_KEY) === '1';
  } catch {
    return false;
  }
}

export function readFloorView(): 'boxes' | 'compact' {
  try {
    return localStorage.getItem(FLOOR_VIEW_KEY) === 'compact' ? 'compact' : 'boxes';
  } catch {
    return 'boxes';
  }
}

export function FoHBurgerMenu({ open, onClose, onCashInOut, onCloseRegister }: Props) {
  const navigate = useNavigate();
  const pos = usePos();
  const [dark, setDark] = useState(readFoHDark);
  const [installEvt, setInstallEvt] = useState<{ prompt: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      const e = event as Event & { prompt: () => Promise<void> };
      setInstallEvt({ prompt: () => e.prompt() });
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('o-foh-dark', dark);
    try {
      localStorage.setItem(DARK_KEY, dark ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [dark]);

  if (!open) return null;

  const cafeCode = (pos.cafe?.name ?? 'LNA')
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase() || 'LNA';

  async function copyLink() {
    const url = `${window.location.origin}/pos/app/tables`;
    try {
      await navigator.clipboard.writeText(url);
      pushToast('Register link copied');
    } catch {
      pushToast(url);
    }
    onClose();
  }

  async function installApp() {
    if (installEvt) {
      await installEvt.prompt();
      setInstallEvt(null);
      pushToast('Install prompted');
      onClose();
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    pushToast(
      ios
        ? 'Share → Add to Home Screen'
        : 'Use the browser menu to install this app',
    );
    onClose();
  }

  function openCustomerDisplay() {
    const url = `${window.location.origin}/pos/app/customer-display`;
    const win = window.open(url, 'foh-customer-display', 'popup=yes,width=900,height=640');
    if (!win) {
      navigate('/pos/app/customer-display');
    }
    onClose();
  }

  function toggleDark() {
    setDark((v) => {
      const next = !v;
      pushToast(next ? 'Dark mode on' : 'Dark mode off');
      return next;
    });
    onClose();
  }

  async function reloadData() {
    try {
      await pos.refresh();
      pushToast('Data reloaded');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Reload failed', 'err');
    }
    onClose();
  }

  function switchFloorView() {
    const next = readFloorView() === 'compact' ? 'boxes' : 'compact';
    try {
      localStorage.setItem(FLOOR_VIEW_KEY, next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('foh-floor-view', { detail: next }));
    pushToast(next === 'compact' ? 'Compact floor view' : 'Box floor view');
    onClose();
  }

  const tiles: Tile[] = [
    { id: 'display', label: 'Customer Display', icon: <MonitorIcon />, onClick: openCustomerDisplay },
    { id: 'dark', label: dark ? 'Switch to Light Mode' : 'Switch to Dark Mode', icon: <MoonIcon />, onClick: toggleDark },
    { id: 'install', label: 'Install App', icon: <InstallIcon />, onClick: () => void installApp() },
    { id: 'cash', label: 'Cash In/Out', icon: <CashIcon />, onClick: () => { onClose(); onCashInOut(); } },
    { id: 'reload', label: 'Reload Data', icon: <ReloadIcon />, onClick: () => void reloadData() },
    { id: 'product', label: 'Create Product', icon: <PlusIcon />, onClick: () => { onClose(); navigate('/pos/menu'); } },
    { id: 'floor', label: 'Switch Floor View', icon: <EyeIcon />, onClick: switchFloorView },
    { id: 'backend', label: 'Backend', icon: <BackIcon />, onClick: () => { onClose(); navigate('/pos'); } },
  ];

  return (
    <div className="o-burger-backdrop" onClick={onClose} role="presentation">
      <div
        className="o-burger"
        role="dialog"
        aria-modal="true"
        aria-label="Register menu"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="o-burger__head">
          <button type="button" className="o-burger__lna" onClick={() => void copyLink()} title="Copy register link">
            <LinkIcon />
            <span>{cafeCode}</span>
          </button>
          <button type="button" className="o-burger__x" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="o-burger__grid">
          {tiles.map((tile) => (
            <button key={tile.id} type="button" className="o-burger__tile" onClick={tile.onClick}>
              <span className="o-burger__icon">{tile.icon}</span>
              <span className="o-burger__label">{tile.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="o-burger__close-reg"
          onClick={() => {
            onClose();
            onCloseRegister();
          }}
          style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
        >
          <KeyIcon />
          <span style={{ color: '#fff', WebkitTextFillColor: '#fff' }}>Close Register</span>
        </button>
      </div>
    </div>
  );
}
