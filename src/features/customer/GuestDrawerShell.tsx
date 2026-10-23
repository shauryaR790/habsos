import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { guestMotionMs, GUEST_DRAWER_CLOSE_MS } from './guestMotion';
import { useGuestDesktop } from './useGuestDesktop';

export function GuestDrawerShell({
  title,
  closeTo,
  children,
  footer,
  className = '',
  panelSurface = 'cart',
}: {
  title: string;
  closeTo: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Cart keeps sand lattice; checkout and other side panels use desert hero art. */
  panelSurface?: 'cart' | 'desert';
}) {
  const desktop = useGuestDesktop();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setClosing(false);
  }, [pathname]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(
      () => navigate(closeTo, { state: { preserveScroll: true } }),
      guestMotionMs(GUEST_DRAWER_CLOSE_MS),
    );
    return () => window.clearTimeout(timer);
  }, [closeTo, closing, navigate]);

  if (!desktop) {
    return <>{children}</>;
  }

  const close = () => {
    if (closing) return;
    setClosing(true);
  };

  return (
    <div
      className={`ad-guest-drawer-root${closing ? ' ad-guest-drawer-root--closing' : ''} ${className}`.trim()}
    >
      <button type="button" className="ad-guest-drawer-backdrop" onClick={close} aria-label="Close panel" />
      <aside
        className={`ad-guest-drawer-panel ${panelSurface === 'desert' ? 'ad-guest-desert-bg' : 'ad-guest-surface-bg'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-guest-drawer-title"
      >
        <header className="ad-guest-drawer-head">
          <button type="button" className="ad-guest-drawer-back" onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
              <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <h1 id="ad-guest-drawer-title" className="ad-guest-drawer-title">
            {title}
          </h1>
        </header>
        <div className="ad-guest-drawer-body ad-guest-drawer-body--swap" key={pathname}>
          {children}
        </div>
        {footer ? <footer className="ad-guest-drawer-foot">{footer}</footer> : null}
      </aside>
    </div>
  );
}
