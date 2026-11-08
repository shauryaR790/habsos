import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import { pushToast } from '../../../components/Toast';
import { registerHrefFromCurrent } from '../../../lib/currentOrder';
import { CashInOutModal } from './CashInOutModal';
import { ClosingControlModal } from './ClosingControlModal';
import { FoHBurgerMenu, readFoHDark } from './FoHBurgerMenu';
import { usePos } from '../PosContext';

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 8h12l-1 12H7L6 8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 8V7a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function OdooFoHLayout() {
  const navigate = useNavigate();
  const pos = usePos();
  const [params, setParams] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [productQuery, setProductQuery] = useState(params.get('q') ?? '');
  const pill = params.get('label') || params.get('name') || params.get('table') || null;
  const initial = (pos.user?.name ?? 'S').trim().charAt(0).toUpperCase() || 'S';
  const paramKey = params.toString();
  const registerHref = useMemo(() => registerHrefFromCurrent(), [paramKey]);

  useEffect(() => {
    document.documentElement.classList.toggle('o-foh-dark', readFoHDark());
    return () => document.documentElement.classList.remove('o-foh-dark');
  }, []);

  return (
    <div className="odoo-pos o-foh">
      <header className="o-foh-nav">
        <div className="o-foh-tabs">
          <NavLink to="/pos/app/tables" className={({ isActive }) => `o-foh-tab${isActive ? ' is-active' : ''}`}>
            Tables
          </NavLink>
          <NavLink to={registerHref} className={({ isActive }) => `o-foh-tab${isActive ? ' is-active' : ''}`}>
            Register
          </NavLink>
          <NavLink to="/pos/app/orders" className={({ isActive }) => `o-foh-tab${isActive ? ' is-active' : ''}`}>
            Orders
          </NavLink>
        </div>
        {pill ? <span className="o-foh-pill">{pill}</span> : null}
        <div className="o-foh-nav__right">
          <label className="o-search">
            <SearchIcon />
            <input
              placeholder="Search products..."
              value={productQuery}
              onChange={(e) => {
                const value = e.target.value;
                setProductQuery(value);
                const next = new URLSearchParams(params);
                if (value.trim()) next.set('q', value);
                else next.delete('q');
                setParams(next, { replace: true });
              }}
            />
          </label>
          <button type="button" className="o-icon-btn" aria-label="Bag">
            <BagIcon />
          </button>
          <span className="o-avatar o-avatar--bw">{initial}</span>
          <button
            type="button"
            className="o-icon-btn"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        </div>
      </header>
      <div className="o-foh-body">
        <Outlet />
      </div>

      <FoHBurgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onCashInOut={() => setCashOpen(true)}
        onCloseRegister={() => setCloseOpen(true)}
      />

      {cashOpen ? (
        <CashInOutModal
          onDiscard={() => setCashOpen(false)}
          onConfirm={async (input) => {
            await api('/api/pos/cash-move', { method: 'POST', body: JSON.stringify(input) });
            pushToast(input.kind === 'IN' ? 'Cash in recorded' : 'Cash out recorded');
          }}
        />
      ) : null}
      {closeOpen ? (
        <ClosingControlModal
          onDiscard={() => setCloseOpen(false)}
          onCashInOut={() => {
            setCloseOpen(false);
            setCashOpen(true);
          }}
          onClose={async (countedCash, notes) => {
            await api('/api/pos/session/close', {
              method: 'POST',
              body: JSON.stringify({ countedCash, notes }),
            });
            pushToast('Session closed');
            navigate('/pos');
          }}
        />
      ) : null}
    </div>
  );
}
