import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ConnectionStatus } from '../../components/ConnectionStatus';
import { Drawer } from '../../components/Drawer';
import { usePos } from './PosContext';

const MAIN = [
  { to: '/pos', label: 'Board', end: true },
  { to: '/pos/orders', label: 'Orders', end: true },
  { to: '/pos/orders/new', label: 'New', end: false },
  { to: '/pos/menu', label: 'Menu', end: false },
  { to: '/pos/tables', label: 'Tables', end: false },
];

const MORE = [
  { to: '/pos/payments', label: 'Payments' },
  { to: '/pos/customers', label: 'Customers' },
  { to: '/pos/reports', label: 'Reports' },
  { to: '/pos/settings', label: 'Settings' },
];

export function PosLayout() {
  const pos = usePos();
  const [more, setMore] = useState(false);
  return (
    <div className="pos">
      <aside className="pos-side">
        <p className="brand-kicker">Cafe</p>
        <p className="brand-mark">After Dunes</p>
        <p className="side-user">{pos.user?.name ?? 'Staff'}</p>
        <nav aria-label="POS">
          {[...MAIN, ...MORE].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/pos' || item.to === '/pos/orders'} className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="pos-main">
        <header className="pos-top">
          <p className="pos-brand">After Dunes</p>
          <ConnectionStatus state={pos.conn} pending={pos.pending} />
          <NavLink className="btn btn-primary" to="/pos/orders/new">New order</NavLink>
        </header>
        {pos.conn === 'OFFLINE' ? <p className="banner">Offline. Orders are being saved locally.</p> : null}
        {pos.conn === 'SYNCING' ? <p className="banner">Syncing {pos.pending} {pos.pending === 1 ? 'change' : 'changes'}…</p> : null}
        {pos.conn === 'SYNC_ERROR' ? <p className="banner warn">Sync error. Open settings to inspect.</p> : null}
        <div className="pos-content">
          {pos.ready ? <Outlet /> : <p className="loading">Opening the register…</p>}
        </div>
      </div>
      <nav className="bottom-nav" aria-label="POS">
        {MAIN.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            {item.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setMore(true)}>More</button>
      </nav>
      <Drawer open={more} title="More" onClose={() => setMore(false)}>
        <div className="stack">
          {MORE.map((item) => (
            <NavLink key={item.to} className="btn btn-ghost btn-full" to={item.to} onClick={() => setMore(false)}>
              {item.label}
            </NavLink>
          ))}
        </div>
      </Drawer>
    </div>
  );
}
