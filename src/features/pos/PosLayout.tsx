import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { OrderAlertHost } from '../../components/OrderAlert';
import { pushToast } from '../../components/Toast';
import { OPEN_STATUSES, registerPath } from '../../../shared/domain';
import { readCurrentOrder } from '../../lib/currentOrder';
import { usePos } from './PosContext';

function Ico({ children, fill = 'none' }: { children: ReactNode; fill?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill={fill} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const NAV = [
  { to: '/pos', label: 'Table View' },
  { to: '/pos/orders/new', label: 'Now Order' },
  { to: '/pos/orders', label: 'Running Orders' },
  { to: '/pos/payments', label: 'Payments' },
  { to: '/pos/customers', label: 'Customers' },
  { to: '/pos/reports', label: 'Reports' },
  { to: '/pos/inventory', label: 'Inventory' },
  { to: '/pos/menu', label: 'Menu' },
  { to: '/pos/settings', label: 'Settings' },
] as const;

export function PosLayout() {
  const pos = usePos();
  const location = useLocation();
  const navigate = useNavigate();
  const [billNo, setBillNo] = useState('');
  const [support, setSupport] = useState(false);
  const [menu, setMenu] = useState(false);
  const fill = location.pathname === '/pos'
    || location.pathname === '/pos/tables'
    || location.pathname.startsWith('/pos/orders/new');

  function findBill(event: FormEvent) {
    event.preventDefault();
    const needle = billNo.trim();
    if (!needle) return;
    const match = pos.orders.find((order) => String(order.orderNumber) === needle || order.id === needle);
    if (!match) {
      pushToast(`No bill ${needle}`, 'err');
      return;
    }
    setBillNo('');
    if (match.paymentStatus !== 'PAID' && OPEN_STATUSES.includes(match.status)) {
      navigate(registerPath({ tableId: match.tableId, orderId: match.id, mode: match.tableId ? 'dine' : 'pickup' }));
      return;
    }
    navigate(`/pos/orders/${match.id}`);
  }

  function openCurrent() {
    const current = readCurrentOrder();
    navigate(current ? registerPath(current) : '/pos/orders/new');
  }

  function pingQueue() {
    if (pos.pending) {
      pushToast(`${pos.pending} waiting to sync`);
      navigate('/pos/settings');
      return;
    }
    pushToast(pos.conn === 'ONLINE' ? 'Online · nothing waiting' : `Connection: ${pos.conn}`);
  }

  const path = location.pathname;
  const onTable = path === '/pos' || path === '/pos/tables';
  const onCurrent = path.startsWith('/pos/orders/new');
  const onRunning = path === '/pos/orders';
  const cafe = pos.cafe?.name ?? 'After Dunes';

  return (
    <div className="pos">
      <OrderAlertHost />
      <div className="pos-main">
        <header className="pos-chrome no-print">
          <button type="button" className="pos-burger" aria-label="Open menu" onClick={() => setMenu(true)}>
            <Ico><path d="M4 7h16M4 12h16M4 17h16" /></Ico>
          </button>
          <Link className="pos-logo" to="/pos" aria-label={`${cafe} table view`}>
            <span className="pos-logo-name">{cafe}</span>
          </Link>
          <Link className="pos-new" to="/pos/orders/new">Now Order</Link>
          <form className="pos-bill-find" onSubmit={findBill}>
            <label>
              <span className="sr-only">Bill number</span>
              <input
                value={billNo}
                onChange={(event) => setBillNo(event.target.value)}
                placeholder="Bill No"
                inputMode="numeric"
              />
            </label>
          </form>
          <button type="button" className="pos-call" onClick={() => setSupport(true)}>
            <span className="pos-call-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 3h4l1 5-2 1a12 12 0 0 0 5 5l1-2 5 1v4a2 2 0 0 1-2 2A16 16 0 0 1 3 7a2 2 0 0 1 2-2z" />
              </svg>
            </span>
            <span>
              <b>Call For Support</b>
              <small>{pos.user?.name ?? 'Staff desk'}</small>
            </span>
          </button>
          <nav className="pos-tools" aria-label="Register tools">
            <Link className={onRunning ? 'on' : ''} to="/pos/orders" title="Running Orders" aria-label="Running Orders">
              <Ico><path d="M8 3h8v3H8z" /><path d="M6 6h12v15H6z" /><path d="M9 11h6M9 15h4" /></Ico>
            </Link>
            <Link className={onTable ? 'on' : ''} to="/pos" title="Table View" aria-label="Table View">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <rect x="3" y="3" width="8" height="8" rx="1.2" fill="#66bb6a" />
                <rect x="13" y="3" width="8" height="8" rx="1.2" fill="#ef5350" />
                <rect x="3" y="13" width="8" height="8" rx="1.2" fill="#ffa726" />
                <rect x="13" y="13" width="8" height="8" rx="1.2" fill="#66bb6a" />
              </svg>
            </Link>
            <button type="button" className={onCurrent ? 'on' : ''} title="Current Order" aria-label="Current Order" onClick={openCurrent}>
              <Ico><rect x="6" y="8" width="12" height="13" rx="1.5" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /><path d="M9 13h6M9 16h4" /></Ico>
            </button>
            <Link className={path.startsWith('/pos/payments') ? 'on' : ''} to="/pos/payments" title="Payments" aria-label="Payments">
              <Ico><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></Ico>
            </Link>
            <Link className={path.startsWith('/pos/menu') ? 'on' : ''} to="/pos/menu" title="Menu" aria-label="Menu">
              <Ico><rect x="3" y="4" width="18" height="14" rx="1.5" /><path d="M8 20h8M12 18v2" /><path d="M8 10h3M14 9l2 2 2-3" /></Ico>
            </Link>
            <Link className={path.startsWith('/pos/reports') ? 'on' : ''} to="/pos/reports" title="Reports" aria-label="Reports">
              <Ico><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4M10 12h6M10 16h4" /></Ico>
            </Link>
            <Link className={path.startsWith('/pos/inventory') ? 'on' : ''} to="/pos/inventory" title="Inventory" aria-label="Inventory">
              <Ico><path d="M4 7h16v12H4z" /><path d="M8 7V5h8v2M8 11h8M8 15h5" /></Ico>
            </Link>
            <Link className={path.startsWith('/pos/customers') ? 'on' : ''} to="/pos/customers" title="Customers" aria-label="Customers">
              <Ico><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></Ico>
            </Link>
            <button type="button" className="pos-bell" title="Notifications" aria-label="Notifications" onClick={pingQueue}>
              <Ico><path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></Ico>
              {pos.pending ? <i>{pos.pending > 9 ? '9+' : pos.pending}</i> : null}
            </button>
            <Link className={path.startsWith('/pos/settings') ? 'on' : ''} to="/pos/settings" title="Profile" aria-label="Profile">
              <Ico><circle cx="12" cy="8" r="3.2" /><path d="M5 19c1.4-3.2 3.8-5 7-5s5.6 1.8 7 5" /></Ico>
            </Link>
            <button type="button" className="pos-power" title="Sign out" aria-label="Sign out" onClick={() => void pos.signOut()}>
              <Ico><path d="M12 3v9" /><path d="M7 6.2a7 7 0 1 0 10 0" /></Ico>
            </button>
          </nav>
        </header>
        <main className={fill ? 'pos-content pos-fill' : 'pos-content'}>
          <Outlet />
        </main>
      </div>

      {menu ? (
        <div className="pos-navdraw-root">
          <button type="button" className="backdrop" aria-label="Close menu" onClick={() => setMenu(false)} />
          <nav className="pos-navdraw" aria-label="POS menu">
            <p>{cafe}</p>
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={path === item.to || (item.to !== '/pos' && path.startsWith(item.to)) || (item.to === '/pos' && onTable) ? 'on' : ''}
                onClick={() => setMenu(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}

      {support ? (
        <Modal open title="Support" onClose={() => setSupport(false)}>
          <dl className="pos-support-dl">
            <div><dt>Cafe</dt><dd>{cafe}</dd></div>
            <div><dt>Signed in</dt><dd>{pos.user?.name ?? 'Staff'} · {pos.user?.email ?? ''}</dd></div>
            <div><dt>Connection</dt><dd>{pos.conn}{pos.pending ? ` · ${pos.pending} waiting` : ''}</dd></div>
          </dl>
        </Modal>
      ) : null}
    </div>
  );
}
